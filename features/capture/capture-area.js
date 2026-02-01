/* ================== CAPTURE AREA - ADVANCED EDITOR ================== */

/* ---------- Helpers ---------- */
function el(tag, props = {}, className = '') {
    const e = document.createElement(tag);
    Object.assign(e, props);
    if (className) e.className = className;
    return e;
}

/* ---------- Main ---------- */
async function captureAreaAdvanced(fullCanvas) {
    /* ================== WRAPPER ================== */
    const workspace = el("div", { id: "workspace" });
    document.body.appendChild(workspace);

    /* ================== TOOLBAR ================== */
    const toolbar = el("div", {}, "snip-toolbar");

    const groupMain = el("div", {}, "toolbar-group");
    const btnDraw = el("button", { innerHTML: '<i class="fa-solid fa-pencil"></i> Draw', title: "Free draw" });
    const btnRect = el("button", { innerHTML: '<i class="fa-regular fa-square"></i> Rect', title: "Draw rectangle" });
    const btnCircle = el("button", { innerHTML: '<i class="fa-regular fa-circle"></i> Circle', title: "Draw circle" });
    const btnText = el("button", { innerHTML: '<i class="fa-solid fa-font"></i> Text', title: "Insert text" });
    const btnBlur = el("button", { innerHTML: '<i class="fa-solid fa-eye-slash"></i> Blur', title: "Blur area" });
    groupMain.append(btnDraw, btnRect, btnCircle, btnText, btnBlur);

    const divider1 = el("div", {}, "divider");

    const groupHistory = el("div", {}, "toolbar-group");
    const btnUndo = el("button", { innerHTML: '<i class="fa-solid fa-rotate-left"></i> Undo', title: "Undo last change" });
    const btnClear = el("button", { innerHTML: '<i class="fa-solid fa-trash"></i> Clear', title: "Clear all annotations" });
    groupHistory.append(btnUndo, btnClear);

    const divider2 = el("div", {}, "divider");

    const groupFinish = el("div", {}, "toolbar-group");
    const btnSave = el("button", { innerHTML: '<i class="fa-solid fa-check"></i> Save Image', title: "Save and download" }, "primary-btn");
    const btnCancel = el("button", { innerHTML: '<i class="fa-solid fa-xmark"></i> Cancel', title: "Discard changes" });
    groupFinish.append(btnSave, btnCancel);

    toolbar.append(groupMain, divider1, groupHistory, divider2, groupFinish);
    document.body.prepend(toolbar);

    /* ================== BG CANVAS (SELECTING) ================== */
    const bgCanvas = el("canvas", { width: fullCanvas.width, height: fullCanvas.height });
    bgCanvas.getContext("2d").drawImage(fullCanvas, 0, 0);
    workspace.appendChild(bgCanvas);

    const overlay = el("div", { id: "overlay" });
    Object.assign(overlay.style, {
        position: 'absolute',
        cursor: 'crosshair',
        background: 'rgba(0,0,0,0.3)',
        zIndex: 10
    });
    workspace.appendChild(overlay);

    const hint = el("div", { textContent: "Click and drag to select capture area" }, "cap-hint");
    document.body.appendChild(hint);

    // Sync overlay size with canvas display size
    const syncOverlaySize = () => {
        const rect = bgCanvas.getBoundingClientRect();
        Object.assign(overlay.style, {
            width: rect.width + 'px',
            height: rect.height + 'px',
            top: bgCanvas.offsetTop + 'px',
            left: bgCanvas.offsetLeft + 'px'
        });
    };
    window.addEventListener('resize', syncOverlaySize);
    setTimeout(syncOverlaySize, 100);

    let startX = 0, startY = 0, box = null;

    overlay.onmousedown = (e) => {
        const rect = overlay.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        box = el("div");
        Object.assign(box.style, {
            position: 'absolute',
            left: startX + 'px',
            top: startY + 'px',
            border: '2px dashed #fff',
            background: 'rgba(255,255,255,0.1)',
            pointerEvents: 'none'
        });
        overlay.appendChild(box);

        overlay.onmousemove = (ev) => {
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;
            const w = x - startX;
            const h = y - startY;
            box.style.width = Math.abs(w) + 'px';
            box.style.height = Math.abs(h) + 'px';
            box.style.left = (w < 0 ? x : startX) + 'px';
            box.style.top = (h < 0 ? y : startY) + 'px';
        };

        overlay.onmouseup = () => {
            overlay.onmousemove = null;
            overlay.onmouseup = null;
            const boxRect = box.getBoundingClientRect();
            const canvasRect = bgCanvas.getBoundingClientRect();

            const scaleX = fullCanvas.width / canvasRect.width;
            const scaleY = fullCanvas.height / canvasRect.height;

            const cropInfo = {
                sx: Math.round((boxRect.left - canvasRect.left) * scaleX),
                sy: Math.round((boxRect.top - canvasRect.top) * scaleY),
                sw: Math.round(boxRect.width * scaleX),
                sh: Math.round(boxRect.height * scaleY)
            };

            if (cropInfo.sw > 10 && cropInfo.sh > 10) {
                overlay.remove();
                bgCanvas.remove();
                hint.remove();
                initEditor(cropInfo);
            } else {
                box.remove();
            }
        };
    };

    function initEditor(cropInfo) {
        toolbar.style.display = 'flex';
        hint.textContent = "Use tools to annotate your selection";
        document.body.appendChild(hint);

        const editorContainer = el("div", {}, "editor-container");
        Object.assign(editorContainer.style, { position: 'relative' });
        workspace.appendChild(editorContainer);

        const viewCanvas = el("canvas", { width: cropInfo.sw, height: cropInfo.sh });
        viewCanvas.getContext("2d").drawImage(fullCanvas, cropInfo.sx, cropInfo.sy, cropInfo.sw, cropInfo.sh, 0, 0, cropInfo.sw, cropInfo.sh);
        editorContainer.appendChild(viewCanvas);

        const annCanvas = el("canvas", { width: cropInfo.sw, height: cropInfo.sh });
        Object.assign(annCanvas.style, { position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 1 });
        editorContainer.appendChild(annCanvas);

        const ctx = annCanvas.getContext("2d");
        ctx.lineCap = "round";

        // Editor State
        let mode = "draw", drawing = false, start = null, drawColor = "#ff0000", drawSize = 5;
        const undoStack = [];

        const snapshot = () => {
            const c = document.createElement("canvas");
            c.width = annCanvas.width; c.height = annCanvas.height;
            c.getContext("2d").drawImage(annCanvas, 0, 0);
            undoStack.push(c);
        };

        const setActive = (btn) => {
            [btnDraw, btnRect, btnCircle, btnText, btnBlur].forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
        };

        btnDraw.onclick = () => { mode = "draw"; setActive(btnDraw); };
        btnRect.onclick = () => { mode = "rect"; setActive(btnRect); };
        btnCircle.onclick = () => { mode = "circle"; setActive(btnCircle); };
        btnText.onclick = () => { mode = "text"; setActive(btnText); };
        btnBlur.onclick = () => { mode = "blur"; setActive(btnBlur); };

        setActive(btnDraw);

        btnUndo.onclick = () => {
            if (undoStack.length) {
                const last = undoStack.pop();
                ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
                ctx.drawImage(last, 0, 0);
            }
        };

        btnClear.onclick = () => { snapshot(); ctx.clearRect(0, 0, annCanvas.width, annCanvas.height); };

        btnCancel.onclick = () => location.reload();

        btnSave.onclick = () => {
            const out = document.createElement("canvas");
            out.width = cropInfo.sw; out.height = cropInfo.sh;
            const octx = out.getContext("2d");
            octx.drawImage(viewCanvas, 0, 0);
            octx.drawImage(annCanvas, 0, 0);
            chrome.runtime.sendMessage({
                action: "save-recording",
                blobUrl: out.toDataURL("image/png"),
                filename: `capture-${Date.now()}.png`
            });
        };

        annCanvas.onmousedown = (e) => {
            const x = e.offsetX, y = e.offsetY;
            if (mode === "text") {
                const txt = prompt("Enter text:");
                if (txt) {
                    snapshot();
                    ctx.fillStyle = drawColor;
                    ctx.font = "bold 24px Inter, sans-serif";
                    ctx.fillText(txt, x, y);
                }
                return;
            }
            snapshot();
            drawing = true;
            start = { x, y };
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        annCanvas.onmousemove = (e) => {
            if (!drawing) return;
            const x = e.offsetX, y = e.offsetY;
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = drawSize;

            const w = x - start.x;
            const h = y - start.y;

            if (mode === "draw") {
                ctx.lineTo(x, y);
                ctx.stroke();
            } else if (mode === "blur") {
                ctx.save();
                ctx.filter = "blur(10px)";
                ctx.drawImage(viewCanvas, x - 20, y - 20, 40, 40, x - 20, y - 20, 40, 40);
                ctx.restore();
            } else {
                ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
                const prev = undoStack[undoStack.length - 1];
                if (prev) ctx.drawImage(prev, 0, 0);

                if (mode === "rect") {
                    ctx.strokeRect(start.x, start.y, w, h);
                } else if (mode === "circle") {
                    ctx.beginPath();
                    ctx.ellipse(start.x + w / 2, start.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        };

        annCanvas.onmouseup = () => { drawing = false; };
    }
}

async function initCaptureArea(dataUrl) {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        captureAreaAdvanced(canvas);
    };
    img.src = dataUrl;
}

window.addEventListener("load", async () => {
    const res = await chrome.runtime.sendMessage({ action: "get-capture-image" });
    if (res?.imageData) initCaptureArea(res.imageData);
});
