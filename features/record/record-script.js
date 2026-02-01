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
                <span class="lr-status-text">Ready to Record</span>
            </div>
            <button class="lr-toggle" title="Minimize/Maximize Widget">🗕</button>
        </div>

        <div class="lr-controls">
            <button class="lr-btn lr-toggle-record" title="Start screen recording">
                <span class="lr-icon">⏺</span>
                <span class="lr-text">Record</span>
            </button>

            <button class="lr-btn lr-capture" title="Take full page screenshot">
                <span class="lr-icon">📸</span>
                <span>Screensot</span>
            </button>

            <button class="lr-btn lr-close" title="Close recorder widget">
                <span class="lr-icon">✖</span>
                <span>Close Widget</span>
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
            recordBtn.title = "Stop recording and save video";
        } else if (recorder.state === "recording") {
            // Stop recording
            stopRecording();
            recordBtn.querySelector(".lr-icon").textContent = "⏺"; // đổi icon thành Start
            recordBtn.querySelector(".lr-text").textContent = "Record";
            recordBtn.title = "Start screen recording";
        }
    };

    const container = div.querySelector(".lr-container");
    const toggleBtn = div.querySelector(".lr-toggle");
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        container.classList.toggle("minimized");
        const minimized = container.classList.contains("minimized");
        toggleBtn.textContent = minimized ? "🗖" : "🗕";
    };

}

function setButtonsLock(lock = true) {
    const buttons = document.querySelectorAll(".lr-btn");
    buttons.forEach(btn => btn.disabled = lock);
    isBusy = lock;
}

// ------------------- RECORDING -----------------------
async function startRecording() {
    if (isBusy) return;
    setButtonsLock(true);

    try {
        if (!stream) {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 60 },
                audio: true
            });
        }

        const videoTrack = stream.getVideoTracks()[0];

        videoTrack.onended = () => {
            if (recorder && recorder.state !== "inactive") {
                recorder.stop();
            }
            cleanupStream();
            resetUI();
        };

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
                    filename: `recording-${Date.now()}.webm`
                });
            }
            resetUI();
        };

        recorder.start();

        // Start timer
        recordStartTime = Date.now();
        recordTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
            const secs = String(elapsed % 60).padStart(2, "0");
            document.querySelector(".lr-status-text").textContent = `${mins}:${secs}`;
        }, 1000);

        document.querySelector(".lr-status").classList.add("recording");
    } catch (err) {
        console.error("Record failed:", err);
        resetUI();
    } finally {
        setButtonsLock(false);
    }
}

function stopRecording() {
    if (recorder && recorder.state !== "inactive") {
        recorder.stop();
    }
    cleanupStream();
}

function cleanupStream() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
}

function resetUI() {
    clearInterval(recordTimerInterval);
    recordTimerInterval = null;
    const statusText = document.querySelector(".lr-status-text");
    if (statusText) statusText.textContent = "Ready to Record";
    const status = document.querySelector(".lr-status");
    if (status) status.classList.remove("recording");

    const recordBtn = document.querySelector(".lr-toggle-record");
    if (recordBtn) {
        recordBtn.querySelector(".lr-icon").textContent = "⏺";
        recordBtn.querySelector(".lr-text").textContent = "Record";
        recordBtn.title = "Start screen recording";
    }
}

// ------------------- CAPTURE IMAGE -----------------------
async function captureImage() {
    if (isBusy) return;
    setButtonsLock(true);

    try {
        let track = null;
        if (stream) {
            const t = stream.getVideoTracks()[0];
            if (t && t.readyState === "live") track = t;
        }

        if (!track) {
            const newStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            track = newStream.getVideoTracks()[0];
        }

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
                filename: `screenshot-${Date.now()}.png`
            });
        }
    } catch (err) {
        console.error("Capture failed:", err);
    } finally {
        setButtonsLock(false);
    }
}

function dragElement(el) {
    let startX = 0, startY = 0;
    el.onmousedown = (e) => {
        if (e.target.closest('button')) return;
        startX = e.clientX - el.offsetLeft;
        startY = e.clientY - el.offsetTop;
        document.onmousemove = (ev) => {
            el.style.left = (ev.clientX - startX) + "px";
            el.style.top = (ev.clientY - startY) + "px";
            el.style.right = 'auto'; // Disable fixed right
        };
        document.onmouseup = () => {
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}

function showPreview(dataUrl, isVideo = false) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = 'lr-preview-overlay';

        const content = document.createElement("div");
        content.className = 'lr-preview-content';

        const mediaContainer = document.createElement("div");
        mediaContainer.className = 'lr-preview-media';

        if (isVideo) {
            const playerWrap = document.createElement("div");
            playerWrap.className = 'custom-player';

            const video = document.createElement("video");
            video.src = dataUrl;
            video.autoplay = true;

            // SVG Icons
            const svgPlay = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
            const svgPause = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
            const svgBack = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>`;
            const svgForward = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;

            // Custom Controls HTML
            playerWrap.innerHTML = `
                <div class="center-play-pause">
                    <div class="center-icon">${svgPlay}</div>
                </div>
                <div class="player-controls">
                    <div class="progress-container">
                        <div class="progress-bar"></div>
                    </div>
                    <div class="bottom-controls">
                        <button class="player-btn toggle-play" title="Play/Pause (Space)">${svgPause}</button>
                        <button class="player-btn skip-back" title="Back 10s (←)">${svgBack}</button>
                        <button class="player-btn skip-forward" title="Forward 10s (→)">${svgForward}</button>
                        <div class="time-display">0:00 / 0:00</div>
                    </div>
                </div>
            `;
            playerWrap.prepend(video);
            mediaContainer.appendChild(playerWrap);

            // Logic
            const playBtn = playerWrap.querySelector('.toggle-play');
            const skipBack = playerWrap.querySelector('.skip-back');
            const skipForward = playerWrap.querySelector('.skip-forward');
            const progressContainer = playerWrap.querySelector('.progress-container');
            const progressBar = playerWrap.querySelector('.progress-bar');
            const timeDisplay = playerWrap.querySelector('.time-display');
            const centerIcon = playerWrap.querySelector('.center-icon');

            const togglePlay = () => {
                if (video.paused) {
                    video.play();
                    playBtn.innerHTML = svgPause;
                    showCenterIcon(svgPlay);
                } else {
                    video.pause();
                    playBtn.innerHTML = svgPlay;
                    showCenterIcon(svgPause);
                }
            };

            const showCenterIcon = (svgCode) => {
                centerIcon.innerHTML = svgCode;
                centerIcon.classList.remove('animate');
                void centerIcon.offsetWidth; // trigger reflow
                centerIcon.classList.add('animate');
            };

            const formatTime = (seconds) => {
                if (isNaN(seconds)) return "0:00";
                const m = Math.floor(seconds / 60);
                const s = Math.floor(seconds % 60);
                return `${m}:${s < 10 ? '0' : ''}${s}`;
            };

            video.onclick = togglePlay;
            playBtn.onclick = (e) => { e.stopPropagation(); togglePlay(); };

            skipBack.onclick = (e) => {
                e.stopPropagation();
                video.currentTime -= 10;
                showCenterIcon(svgBack);
            };
            skipForward.onclick = (e) => {
                e.stopPropagation();
                video.currentTime += 10;
                showCenterIcon(svgForward);
            };

            video.ontimeupdate = () => {
                const percent = (video.currentTime / video.duration) * 100;
                progressBar.style.width = percent + '%';
                timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
            };

            progressContainer.onclick = (e) => {
                e.stopPropagation();
                const rect = progressContainer.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                video.currentTime = pos * video.duration;
            };

            // Keyboard support
            const keyHandler = (e) => {
                if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
                if (e.code === 'ArrowLeft') video.currentTime -= 5;
                if (e.code === 'ArrowRight') video.currentTime += 5;
            };
            window.addEventListener('keydown', keyHandler);
            overlay.addEventListener('remove', () => window.removeEventListener('keydown', keyHandler));

        } else {
            const img = document.createElement("img");
            img.src = dataUrl;
            mediaContainer.appendChild(img);
        }

        const footer = document.createElement("div");
        footer.className = 'lr-preview-footer';

        const btnSave = document.createElement("button");
        btnSave.className = 'lr-modal-btn lr-btn-save';
        btnSave.textContent = isVideo ? "Download Video" : "Download Screenshot";

        const btnExtract = document.createElement("button");
        btnExtract.className = 'lr-modal-btn lr-btn-extract';
        btnExtract.textContent = "Edit with Capture Tool";

        const btnCancel = document.createElement("button");
        btnCancel.className = 'lr-modal-btn lr-btn-cancel';
        btnCancel.textContent = "Discard";

        if (!isVideo) footer.appendChild(btnExtract);
        footer.appendChild(btnSave);
        footer.appendChild(btnCancel);

        content.appendChild(mediaContainer);
        content.appendChild(footer);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        btnSave.onclick = () => { overlay.remove(); resolve(true); };
        btnCancel.onclick = () => { overlay.remove(); resolve(false); };
        btnExtract.onclick = () => {
            chrome.runtime.sendMessage({ action: "open-capture-area-page", imageData: dataUrl });
            overlay.remove();
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
