let recorder = null;
let recordedChunks = [];
let stream = null;
let recordStartTime = null;
let recordTimerInterval = null;
let isBusy = false; // true khi đang thực hiện capture/record

// ------------------- INSERT UI -----------------------
function injectRecorderUI() {
    if (document.querySelector("#loom-recorder")) return;

    const div = document.createElement("div");
    div.id = "loom-recorder";

    div.innerHTML = `
    <div class="lr-container">
        <div class="lr-header">
            <div class="lr-status">
                <span class="lr-dot"></span>
                <span class="lr-status-text">Idle</span>
            </div>
            <button class="lr-toggle" title="Minimize">🗕</button>
        </div>

        <div class="lr-controls">
            <button class="lr-btn lr-toggle-record">
                <span class="lr-icon">⏺</span>
                <span class="lr-text">Start</span>
            </button>

            <button class="lr-btn lr-capture">
                <span class="lr-icon">📸</span>
                <span>Capture</span>
            </button>

            <button class="lr-btn lr-capture-area">
                <span class="lr-icon">✂️</span>
                <span>Capture Area</span>
            </button>

            <button class="lr-btn lr-close">
                <span class="lr-icon">✖</span>
            </button>
        </div>
    </div>
    `;

    document.body.appendChild(div);

    // Drag support
    dragElement(div);

    // Bind events
    div.querySelector(".lr-capture").onclick = captureImage;
    div.querySelector(".lr-close").onclick = () => div.remove();

    const recordBtn = div.querySelector(".lr-toggle-record");
    recordBtn.onclick = async () => {
        if (!recorder || recorder.state === "inactive") {
            // Start recording
            await startRecording();
            recordBtn.querySelector(".lr-icon").textContent = "⏹"; // đổi icon thành Stop
            recordBtn.querySelector(".lr-text").textContent = "Stop";
        } else if (recorder.state === "recording") {
            // Stop recording
            stopRecording();
            recordBtn.querySelector(".lr-icon").textContent = "⏺"; // đổi icon thành Start
            recordBtn.querySelector(".lr-text").textContent = "Start";
        }
    };

    const container = div.querySelector(".lr-container");
    const toggleBtn = div.querySelector(".lr-toggle");
    toggleBtn.onclick = () => {
        container.classList.toggle("minimized");
        const minimized = container.classList.contains("minimized");
        toggleBtn.textContent = minimized ? "🗖" : "🗕";
        toggleBtn.title = minimized ? "Maximize" : "Minimize";
    };

    div.querySelector(".lr-capture-area").onclick = captureArea;
}

function setButtonsLock(lock = true) {
    const buttons = document.querySelectorAll(".lr-btn");
    buttons.forEach(btn => btn.disabled = lock);
    isBusy = lock;
}

// ------------------- RECORDING -----------------------
async function startRecording() {
    if (isBusy) return; // nếu đang bận thì không làm gì
    setButtonsLock(true);

    try {
        if (!stream) {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 30 },
                audio: true
            });
        }

        recordedChunks = [];
        recorder = new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        recorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const confirmed = await showPreview(url, true);
            if (confirmed) {
                chrome.runtime.sendMessage({
                    action: "save-recording",
                    blobUrl: url,
                    filename: `record-${Date.now()}.webm`
                });
            }

            // Clear timer
            clearInterval(recordTimerInterval);
            recordTimerInterval = null;
            document.querySelector(".lr-status-text").textContent = "Idle";
        };

        recorder.start();

        // Start timer
        recordStartTime = Date.now();
        recordTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
            const secs = String(elapsed % 60).padStart(2, "0");
            document.querySelector(".lr-status-text").textContent = `Recording ${mins}:${secs}`;
        }, 1000);

        document.querySelector(".lr-status").classList.add("recording");
    } catch (err) {
        if (err.name === "NotAllowedError") {
            console.log("User cancelled the screen selection");
            // Không hiện alert, chỉ log hoặc reset UI
            document.querySelector(".lr-status-text").textContent = "Idle";
            return;
        } else {
            alert("Record failed: " + err.message);
        }
    } finally {
        setButtonsLock(false); // unlock nút sau khi xong
    }
}

function stopRecording() {
    if (recorder && recorder.state !== "inactive") {
        recorder.stop();
    }

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
    }

    document.querySelector(".lr-status").classList.remove("recording");

    // Clear timer
    clearInterval(recordTimerInterval);
    recordTimerInterval = null;
    document.querySelector(".lr-status-text").textContent = "Idle";
}

// ------------------- CAPTURE IMAGE -----------------------
async function captureImage() {
    if (isBusy) return; // nếu đang bận thì không làm gì
    setButtonsLock(true);

    try {
        const track = stream ? stream.getVideoTracks()[0] : (await navigator.mediaDevices.getDisplayMedia({ video: true })).getVideoTracks()[0];
        const capture = new ImageCapture(track);
        const bitmap = await capture.grabFrame();

        track.stop();

        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0);

        const dataUrl = canvas.toDataURL("image/png");

        const confirmed = await showPreview(dataUrl, false);

        if (confirmed) {
            chrome.runtime.sendMessage({
                action: "save-recording",
                blobUrl: dataUrl,
                filename: `capture-${Date.now()}.png`
            });
        } else {
            console.log("User canceled preview");
        }
    } catch (err) {
        if (err.name === "NotAllowedError") return;
        alert("Capture failed: " + err.message);
    } finally {
        setButtonsLock(false); // unlock nút sau khi xong
    }
}

function dragElement(el) {
    let posX = 0, posY = 0, mouseX = 0, mouseY = 0;

    el.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        mouseX = e.clientX;
        mouseY = e.clientY;
        document.onmouseup = closeDrag;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        posX = mouseX - e.clientX;
        posY = mouseY - e.clientY;
        mouseX = e.clientX;
        mouseY = e.clientY;
        el.style.top = (el.offsetTop - posY) + "px";
        el.style.left = (el.offsetLeft - posX) + "px";
    }

    function closeDrag() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

async function captureArea() {
    if (isBusy) return; // nếu đang bận thì không làm gì
    setButtonsLock(true);

    try {
        // 1️⃣ Capture toàn bộ trang hiện tại
        const canvasFull = await html2canvas(document.body);

        // 2️⃣ Overlay khoanh vùng
        const selection = await new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.top = 0;
            overlay.style.left = 0;
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.cursor = "crosshair";
            overlay.style.zIndex = 99999999;
            overlay.style.background = "rgba(0,0,0,0.1)";
            document.body.appendChild(overlay);

            let startX, startY, rect;

            overlay.onmousedown = (e) => {
                startX = e.clientX;
                startY = e.clientY;

                rect = document.createElement("div");
                rect.style.position = "absolute";
                rect.style.border = "2px dashed #fff";
                rect.style.background = "rgba(255,255,255,0.2)";
                rect.style.left = startX + "px";
                rect.style.top = startY + "px";
                overlay.appendChild(rect);

                overlay.onmousemove = (ev) => {
                    const w = ev.clientX - startX;
                    const h = ev.clientY - startY;
                    rect.style.width = Math.abs(w) + "px";
                    rect.style.height = Math.abs(h) + "px";
                    rect.style.left = (w < 0 ? ev.clientX : startX) + "px";
                    rect.style.top = (h < 0 ? ev.clientY : startY) + "px";
                };

                overlay.onmouseup = (ev) => {
                    overlay.onmousemove = null;
                    const x = parseInt(rect.style.left);
                    const y = parseInt(rect.style.top);
                    const w = parseInt(rect.style.width);
                    const h = parseInt(rect.style.height);
                    document.body.removeChild(overlay);
                    resolve({ x, y, width: w, height: h });
                };
            };
        });

        // 3️⃣ Crop theo vùng chọn
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = selection.width;
        croppedCanvas.height = selection.height;
        const ctx = croppedCanvas.getContext("2d");
        ctx.drawImage(
            canvasFull,
            selection.x, selection.y, selection.width, selection.height,
            0, 0, selection.width, selection.height
        );

        const dataUrl = croppedCanvas.toDataURL("image/png");

        // 4️⃣ Popup preview trước khi lưu
        const confirmed = await showPreview(dataUrl, false);
        if (confirmed) {
            chrome.runtime.sendMessage({
                action: "save-recording",
                blobUrl: dataUrl,
                filename: `capture-area-${Date.now()}.png`
            });
        }
    } catch (err) {
        console.error("Capture failed:", err);
    } finally {
        setButtonsLock(false); // unlock nút sau khi xong
    }
}

function showPreview(dataUrl, isVideo = false) {
    return new Promise((resolve) => {
        // Tạo overlay
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.background = "rgba(0,0,0,0.5)";
        overlay.style.zIndex = 99999999;
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";

        const popup = document.createElement("div");
        popup.style.background = "#fff";
        popup.style.padding = "20px";
        popup.style.borderRadius = "12px";
        popup.style.display = "flex";
        popup.style.flexDirection = "column";
        popup.style.alignItems = "center";
        popup.style.width = "960px";      // set cứng width
        popup.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
        popup.style.overflow = "hidden";

        // Media
        let media;
        if (isVideo) {
            media = document.createElement("video");
            media.src = dataUrl;
            media.controls = true;
            media.autoplay = true;
            media.style.maxWidth = "100%";
            media.style.maxHeight = "calc(100% - 60px)";
        } else {
            media = document.createElement("img");
            media.src = dataUrl;
            media.style.maxWidth = "100%";
            media.style.maxHeight = "calc(100% - 60px)";
        }

        popup.appendChild(media);

        // Buttons container
        const btnContainer = document.createElement("div");
        btnContainer.style.marginTop = "10px";
        btnContainer.style.display = "flex";
        btnContainer.style.justifyContent = "center";
        btnContainer.style.gap = "15px";

        // Save button
        const btnSave = document.createElement("button");
        btnSave.textContent = "Save";
        btnSave.style.padding = "6px 16px";
        btnSave.style.border = "none";
        btnSave.style.borderRadius = "8px";
        btnSave.style.background = "#4CAF50";
        btnSave.style.color = "#fff";
        btnSave.style.fontWeight = "600";
        btnSave.style.cursor = "pointer";
        btnSave.onmouseover = () => btnSave.style.background = "#45a049";
        btnSave.onmouseout = () => btnSave.style.background = "#4CAF50";

        // Cancel button
        const btnCancel = document.createElement("button");
        btnCancel.textContent = "Cancel";
        btnCancel.style.padding = "6px 16px";
        btnCancel.style.border = "none";
        btnCancel.style.borderRadius = "8px";
        btnCancel.style.background = "#f44336";
        btnCancel.style.color = "#fff";
        btnCancel.style.fontWeight = "600";
        btnCancel.style.cursor = "pointer";
        btnCancel.onmouseover = () => btnCancel.style.background = "#e53935";
        btnCancel.onmouseout = () => btnCancel.style.background = "#f44336";

        btnContainer.appendChild(btnSave);
        btnContainer.appendChild(btnCancel);
        popup.appendChild(btnContainer);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        // Event
        btnSave.onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
        };
        btnCancel.onclick = () => {
            document.body.removeChild(overlay);
            resolve(false);
        };
    });
}

// ------------------- LISTEN FROM POPUP -----------------------
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "open-record-widget") {
        injectRecorderUI();
    }
});
