let recorder = null;
let recordedChunks = [];
let stream = null;

// ------------------- INSERT UI -----------------------
function injectRecorderUI() {
    if (document.querySelector("#loom-recorder")) return;

    const div = document.createElement("div");
    div.id = "loom-recorder";

    div.innerHTML = `
        <div class="lr-container">
            <div class="lr-header">
                <div class="lr-title">Screen Recorder</div>
                <div class="lr-status">
                    <span class="lr-dot"></span>
                    <span class="lr-status-text">Idle</span>
                </div>
            </div>

            <div class="lr-controls">
                <button class="lr-btn lr-start">
                    <span class="lr-icon">⏺</span>
                    <span>Start</span>
                </button>

                <button class="lr-btn lr-stop" disabled>
                    <span class="lr-icon">⏹</span>
                    <span>Stop</span>
                </button>

                <button class="lr-btn lr-capture">
                    <span class="lr-icon">📸</span>
                    <span>Capture</span>
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
    div.querySelector(".lr-start").onclick = startRecording;
    div.querySelector(".lr-stop").onclick = stopRecording;
    div.querySelector(".lr-capture").onclick = captureImage;
    div.querySelector(".lr-close").onclick = () => div.remove();
}

// ------------------- RECORDING -----------------------
async function startRecording() {
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: true
        });

        recordedChunks = [];
        recorder = new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        recorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);

            chrome.runtime.sendMessage({
                action: "save-recording",
                blobUrl: url,
                filename: `record-${Date.now()}.webm`
            });
        };

        recorder.start();

        document.querySelector(".lr-status").classList.add("recording");
        document.querySelector(".lr-status-text").textContent = "Recording";

        document.querySelector(".lr-start").disabled = true;
        document.querySelector(".lr-stop").disabled = false;
    } catch (e) {
        alert("Record failed: " + e.message);
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
    document.querySelector(".lr-status-text").textContent = "Idle";

    document.querySelector(".lr-start").disabled = false;
    document.querySelector(".lr-stop").disabled = true;
}

// ------------------- CAPTURE IMAGE -----------------------
async function captureImage() {
    try {
        const imgStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = imgStream.getVideoTracks()[0];
        const capture = new ImageCapture(track);
        const bitmap = await capture.grabFrame();

        track.stop();

        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0);

        const dataUrl = canvas.toDataURL("image/png");

        chrome.runtime.sendMessage({
            action: "save-recording",
            blobUrl: dataUrl,
            filename: `capture-${Date.now()}.png`
        });
    } catch (e) {
        alert("Capture failed: " + e.message);
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
// ------------------- LISTEN FROM POPUP -----------------------
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "open-record-widget") {
        injectRecorderUI();
    }
});
