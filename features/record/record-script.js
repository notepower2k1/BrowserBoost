let recorder = null;
let recordedChunks = [];
let stream = null;
let recordStartTime = null;
let recordTimerInterval = null;
let isBusy = false; // true khi đang thực hiện capture/record
let snipActive = false;

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

    div.querySelector(".lr-capture-area").onclick = captureAreaAdvanced;
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

// Small convenience to create elements
function el(tag, props = {}, css = {}) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    Object.assign(e.style, css);
    return e;
}

// ---------------- Main advanced capture function ----------------
async function captureAreaAdvanced() {
    if (isBusy || snipActive) return;
    snipActive = true;
    setButtonsLock(true);

    try {
        const fullCanvas = await html2canvas(document.body, { useCORS: true });

        // ===== Overlay =====
        const overlay = el("div", {}, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.25)",
            zIndex: 999999999,
            cursor: "crosshair"
        });
        overlay.style.pointerEvents = "auto";
        document.body.appendChild(overlay);

        let startX, startY, box;

        // ===== STEP 1: VẼ KHUNG =====
        overlay.onmousedown = (e) => {
            startX = e.clientX;
            startY = e.clientY;

            box = el("div", {}, {
                position: "absolute",
                border: "2px dashed #fff",
                background: "rgba(255,255,255,0.1)",
                left: startX + "px",
                top: startY + "px",
                boxSizing: "border-box",
                resize: "both",
                overflow: "hidden",
                minWidth: "80px",
                minHeight: "60px",
                position: "relative"
            });

            overlay.appendChild(box);

            overlay.onmousemove = (ev) => {
                const w = ev.clientX - startX;
                const h = ev.clientY - startY;
                box.style.width = Math.abs(w) + "px";
                box.style.height = Math.abs(h) + "px";
                box.style.left = (w < 0 ? ev.clientX : startX) + "px";
                box.style.top = (h < 0 ? ev.clientY : startY) + "px";
            };

            overlay.onmouseup = (ev) => {
                ev.stopPropagation();   // ✅ CHỐT TẠI NGUỒN
                ev.preventDefault();
                overlay.onmousemove = null;
                overlay.onmouseup = null;
                overlay.onmousedown = null;
                overlay.style.cursor = "default";

                const rect = box.getBoundingClientRect();
                initEditor(rect, box);   // ⬅️ HIỆN TOOLBOX SAU KHI CÓ KHUNG
            };
        };

        // ===== STEP 2: TOOLBOX + EDIT =====
        function initEditor(rect, box) {
            if (box.querySelector(".snip-toolbar")) return;

            // Info size
            const info = el("div", { textContent: `${Math.round(rect.width)} x ${Math.round(rect.height)}` }, {
                position: "absolute",
                right: "6px",
                top: "-26px",
                background: "rgba(0,0,0,.7)",
                color: "#fff",
                padding: "4px 8px",
                borderRadius: "6px",
                fontSize: "12px"
            });
            box.appendChild(info);

            // Annotation canvas
            const annCanvas = document.createElement("canvas");
            annCanvas.width = rect.width;
            annCanvas.height = rect.height;
            Object.assign(annCanvas.style, {
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "100%"
            });
            box.appendChild(annCanvas);

            const ctx = annCanvas.getContext("2d");
            ctx.lineCap = "round";

            // ===== TOOLBAR =====
            const toolbar = el("div", {}, {
                position: "absolute",
                left: "0",
                top: "-52px",
                display: "flex",
                gap: "6px",
                padding: "6px",
                background: "rgba(30,30,30,0.9)",
                borderRadius: "8px",
                zIndex: 999999999
            });

            toolbar.className = "snip-toolbar";
            toolbar.style.pointerEvents = "auto";
            box.style.overflow = "visible";

            const btnDraw = el("button", { textContent: "✏" });
            const btnText = el("button", { textContent: "T" });
            const btnBlur = el("button", { textContent: "⬛" });
            const btnUndo = el("button", { textContent: "↩" });
            const btnClear = el("button", { textContent: "🗑" });
            const btnOk = el("button", { textContent: "✔" });
            const btnCancel = el("button", { textContent: "✖" });

            [btnDraw, btnText, btnBlur, btnUndo, btnClear, btnOk, btnCancel].forEach(b => {
                b.style.padding = "6px 10px";
                b.style.borderRadius = "6px";
                b.style.border = "none";
                b.style.cursor = "pointer";
                b.style.background = "#fff";
            });

            toolbar.append(btnDraw, btnText, btnBlur, btnUndo, btnClear, btnOk, btnCancel);

            const colorPicker = el("input");
            colorPicker.type = "color";
            colorPicker.value = "#ff0000";
            colorPicker.style.height = "32px";
            colorPicker.style.width = "36px";
            colorPicker.style.border = "none";

            const sizePicker = el("input");
            sizePicker.type = "range";
            sizePicker.min = 1;
            sizePicker.max = 30;
            sizePicker.value = 5;
            sizePicker.style.width = "90px";

            toolbar.append(colorPicker, sizePicker);

            box.appendChild(toolbar);

            const handle = el("div", {}, {
                position: "absolute",
                right: "-6px",
                bottom: "-6px",
                width: "14px",
                height: "14px",
                background: "#4CAF50",
                borderRadius: "50%",
                cursor: "nwse-resize",
                zIndex: 10
            });
            box.appendChild(handle);

            // ===== DRAW + TEXT =====
            let mode = "draw";
            let drawColor = "#ff0000";
            let drawSize = 3;

            btnDraw.classList.add("active");

            let drawing = false;
            const stack = [];

            function snap() {
                const c = document.createElement("canvas");
                c.width = annCanvas.width;
                c.height = annCanvas.height;
                c.getContext("2d").drawImage(annCanvas, 0, 0);
                stack.push(c);
            }

            function setMode(newMode, btn) {
                mode = newMode;
                [btnDraw, btnText, btnBlur].forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            }

            function syncCanvasSize() {
                const r = box.getBoundingClientRect();

                const tmp = document.createElement("canvas");
                tmp.width = annCanvas.width;
                tmp.height = annCanvas.height;
                tmp.getContext("2d").drawImage(annCanvas, 0, 0);

                annCanvas.width = r.width;
                annCanvas.height = r.height;
                ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
                ctx.drawImage(tmp, 0, 0);

                info.textContent = `${Math.round(r.width)} x ${Math.round(r.height)}`;
            }

            // cleanup accepts a flag removedFully: if true remove overlay and box, otherwise just restore UI
            function cleanup(removedFully = false) {
                try {
                    if (removedFully) {
                        // remove overlay and any child boxes
                        overlay.remove();
                    } else {
                        // remove overlay (keeps nothing) OR if you prefer restore state, remove overlay entirely
                        // Here we remove overlay to avoid accidental duplicates next time
                        overlay.remove();
                    }
                } catch (e) { /* ignore */ }

                try { setButtonsLock(false); } catch (e) { }
                snipActive = false;
            }

            new ResizeObserver(syncCanvasSize).observe(box);

            btnDraw.onclick = () => setMode("draw", btnDraw);
            btnText.onclick = () => setMode("text", btnText);
            btnBlur.onclick = () => setMode("blur", btnBlur);
            colorPicker.oninput = () => drawColor = colorPicker.value;
            sizePicker.oninput = () => drawSize = +sizePicker.value;

            handle.onmousedown = (e) => {
                e.stopPropagation();

                const startRect = box.getBoundingClientRect();
                const startX = e.clientX;
                const startY = e.clientY;

                document.onmousemove = (ev) => {
                    const w = startRect.width + (ev.clientX - startX);
                    const h = startRect.height + (ev.clientY - startY);

                    box.style.width = Math.max(80, w) + "px";
                    box.style.height = Math.max(60, h) + "px";
                };

                document.onmouseup = () => {
                    document.onmousemove = null;
                    document.onmouseup = null;
                    syncCanvasSize(); // ✅ canvas tự scale theo
                };
            };

            annCanvas.onmousedown = (e) => {
                e.stopPropagation();
                const r = annCanvas.getBoundingClientRect();
                const x = e.clientX - r.left;
                const y = e.clientY - r.top;

                if (mode === "draw" || mode === "blur") {
                    snap();
                    drawing = true;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                }

                if (mode === "text") {
                    const txt = prompt("Text:");
                    if (txt) {
                        snap();
                        ctx.fillStyle = drawColor;
                        ctx.font = "18px Arial";
                        ctx.fillText(txt, x, y);
                    }
                }
            };

            annCanvas.onmousemove = (e) => {
                if (!drawing) return;

                const r = annCanvas.getBoundingClientRect();
                const x = e.clientX - r.left;
                const y = e.clientY - r.top;

                if (mode === "draw") {
                    ctx.globalCompositeOperation = "source-over";
                    ctx.strokeStyle = drawColor;
                    ctx.lineWidth = drawSize;
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }

                if (mode === "blur") {
                    const blurSize = drawSize * 4;

                    // Quy đổi toạ độ về fullCanvas
                    const rectNow = box.getBoundingClientRect();
                    const scaleX = fullCanvas.width / document.documentElement.clientWidth;
                    const scaleY = fullCanvas.height / document.documentElement.clientHeight;

                    const fx = (rectNow.left + x) * scaleX;
                    const fy = (rectNow.top + y) * scaleY;

                    // Cắt vùng ảnh gốc
                    const src = document.createElement("canvas");
                    src.width = blurSize;
                    src.height = blurSize;
                    src.getContext("2d").drawImage(
                        fullCanvas,
                        fx - blurSize / 2,
                        fy - blurSize / 2,
                        blurSize,
                        blurSize,
                        0,
                        0,
                        blurSize,
                        blurSize
                    );

                    // Blur thật
                    ctx.save();
                    ctx.filter = "blur(8px)";
                    ctx.drawImage(
                        src,
                        x - blurSize / 2,
                        y - blurSize / 2
                    );
                    ctx.restore();
                }
            };

            annCanvas.onmouseup = () => {
                drawing = false;
                ctx.filter = "none";
                ctx.globalCompositeOperation = "source-over";
            };

            btnUndo.onclick = () => {
                const s = stack.pop();
                if (s) {
                    ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
                    ctx.drawImage(s, 0, 0);
                }
            };

            btnClear.onclick = () => {
                snap();
                ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
            };

            // ---- Thay thế toàn bộ btnOk.onclick và cleanup bằng đoạn này ----
            btnOk.onclick = async () => {
                try {
                    // Lấy rect hiện tại (sau khi user có thể đã resize/move)
                    const rectNow = box.getBoundingClientRect();

                    // Tính scale từ fullCanvas (html2canvas) -> toàn trang (document)
                    // fullCanvas thường có kích thước tương ứng với document.documentElement.scrollWidth/scrollHeight
                    const pageWidth = document.documentElement.scrollWidth;
                    const pageHeight = document.documentElement.scrollHeight;
                    const scaleX = fullCanvas.width / pageWidth;
                    const scaleY = fullCanvas.height / pageHeight;

                    // Tính toạ độ thực tế trên fullCanvas (bao gồm scroll)
                    const sx = Math.round((rectNow.left + window.scrollX) * scaleX);
                    const sy = Math.round((rectNow.top + window.scrollY) * scaleY);
                    const sw = Math.round(rectNow.width * scaleX);
                    const sh = Math.round(rectNow.height * scaleY);

                    // Ẩn overlay (không remove) để popup preview không bị che
                    overlay.style.display = "none";

                    // Crop from fullCanvas at the computed coords
                    const crop = document.createElement("canvas");
                    crop.width = sw || 1;
                    crop.height = sh || 1;
                    const cctx = crop.getContext("2d");
                    cctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

                    // Merge annotation — annCanvas is in CSS pixels of the box.
                    // Need to scale annotation to the pixel size (sw,sh).
                    const annTmp = document.createElement("canvas");
                    annTmp.width = sw || 1;
                    annTmp.height = sh || 1;
                    const atx = annTmp.getContext("2d");

                    // scale from box CSS size -> cropped pixel size
                    const scaleAnnX = (sw / rectNow.width) || 1;
                    const scaleAnnY = (sh / rectNow.height) || 1;

                    // draw annCanvas scaled onto annTmp (use drawImage with geometry rather than ctx.scale to avoid transform state)
                    atx.drawImage(annCanvas,
                        0, 0, annCanvas.width, annCanvas.height,
                        0, 0, Math.round(annCanvas.width * scaleAnnX), Math.round(annCanvas.height * scaleAnnY)
                    );

                    // composite annotations on top
                    cctx.drawImage(annTmp, 0, 0, sw, sh);

                    // export and preview
                    const dataUrl = crop.toDataURL("image/png");

                    // showPreview should return true/false; overlay hidden so its buttons are clickable
                    const confirmed = await showPreview(dataUrl, false);

                    if (confirmed) {
                        // user saved → send and cleanup fully
                        chrome.runtime.sendMessage({
                            action: "save-recording",
                            blobUrl: dataUrl,
                            filename: `capture-${Date.now()}.png`
                        });
                    }

                    // fully remove overlay & box
                    cleanup(true);

                } catch (err) {
                    console.error("btnOk error:", err);
                    try { overlay.style.display = ""; box.style.visibility = "visible"; } catch (e) { }
                }
            };

            btnCancel.onclick = () => cleanup(true);
        }

    } catch (err) {
        console.error("captureAreaAdvanced:", err);
        setButtonsLock(false);
        snipActive = false;
    }
}


// ------------------- LISTEN FROM POPUP -----------------------
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "open-record-widget") {
        injectRecorderUI();
    }
});
