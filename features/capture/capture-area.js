/* ================== CAPTURE AREA - FULL EDITOR ================== */
/* Cancel = Reset | Mode Indicator */

/* ---------- Helpers ---------- */
function el(tag, props = {}, css = {}) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    Object.assign(e.style, css);
    return e;
}

/* ---------- Main ---------- */
async function captureAreaAdvanced(fullCanvas) {
    /* ================== WRAPPER ================== */
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        zIndex: 999999998
    });
    document.body.appendChild(wrapper);

    /* ================== BG CANVAS (DISPLAY IMAGE) ================== */
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = fullCanvas.width;
    bgCanvas.height = fullCanvas.height;
    bgCanvas.getContext("2d").drawImage(fullCanvas, 0, 0);

    Object.assign(bgCanvas.style, {
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
        display: "block",
        userSelect: "none"
    });
    wrapper.appendChild(bgCanvas);

    /* ================== SELECT OVERLAY ================== */
    const overlay = document.createElement("div");
    wrapper.appendChild(overlay);

    requestAnimationFrame(() => {
        const imgRect = bgCanvas.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        Object.assign(overlay.style, {
            position: "absolute",
            left: (imgRect.left - wrapperRect.left) + "px",
            top: (imgRect.top - wrapperRect.top) + "px",
            width: imgRect.width + "px",
            height: imgRect.height + "px",
            cursor: "crosshair",
            background: "rgba(0, 0, 0, 0.25)",
            zIndex: 1
        });
    });

    wrapper.appendChild(overlay);

    /* ===== MODE INDICATOR ===== */
    const modeIndicator = el("div", { textContent: "Mode: Select" }, {
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        padding: "6px 14px",
        borderRadius: "20px",
        fontSize: "13px",
        fontWeight: "600",
        zIndex: 1000000000
    });
    document.body.appendChild(modeIndicator);

    function setModeLabel(label) {
        modeIndicator.textContent = "Mode: " + label;
    }

    let startX = 0;
    let startY = 0;
    let box = null;

    function resetSelectUI() {
        if (box) {
            box.remove();
            box = null;
        }

        overlay.style.pointerEvents = "auto";
        overlay.style.display = "";
        overlay.style.background = "rgba(0,0,0,0.25)";
    }

    /* ===== STEP 1: SELECT ===== */
    overlay.onmousedown = (e) => {
        setModeLabel("Selecting");

        const rect = overlay.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        box = document.createElement("div");
        Object.assign(box.style, {
            position: "absolute",
            left: startX + "px",
            top: startY + "px",
            border: "2px dashed #fff",
            background: "rgba(255,255,255,0.12)",
            boxSizing: "border-box",
            pointerEvents: "none"
        });
        overlay.appendChild(box);

        overlay.onmousemove = (ev) => {
            const r = overlay.getBoundingClientRect();
            const x = ev.clientX - r.left;
            const y = ev.clientY - r.top;

            const w = x - startX;
            const h = y - startY;

            box.style.width = Math.abs(w) + "px";
            box.style.height = Math.abs(h) + "px";
            box.style.left = (w < 0 ? x : startX) + "px";
            box.style.top = (h < 0 ? y : startY) + "px";
        };

        overlay.onmouseup = () => {
            overlay.onmousemove = null;
            overlay.onmouseup = null;

            const boxRect = box.getBoundingClientRect();
            const imgRectNow = bgCanvas.getBoundingClientRect();

            const scaleX = fullCanvas.width / imgRectNow.width;
            const scaleY = fullCanvas.height / imgRectNow.height;

            const cropInfo = {
                sx: Math.round((boxRect.left - imgRectNow.left) * scaleX),
                sy: Math.round((boxRect.top - imgRectNow.top) * scaleY),
                sw: Math.round(boxRect.width * scaleX),
                sh: Math.round(boxRect.height * scaleY)
            };

            if (cropInfo.sw < 5 || cropInfo.sh < 5) {
                resetSelectUI();
                return;
            }

            overlay.remove();
            bgCanvas.style.display = "none";

            initEditor({ cropInfo, wrapper, fullCanvas });
        };
    };

    /* ===== STEP 2: EDITOR ===== */
    function initEditor({ cropInfo, wrapper, fullCanvas }) {
        setModeLabel("Edit");

        /* ================== CONTAINER ================== */
        const editorBox = document.createElement("div");
        Object.assign(editorBox.style, {
            position: "relative",
            border: "2px solid #fff",
            background: "#000",
            boxSizing: "border-box",
            zIndex: 10
        });

        wrapper.appendChild(editorBox);

        /* ================== VIEW CANVAS (IMAGE) ================== */
        const viewCanvas = document.createElement("canvas");
        viewCanvas.width = cropInfo.sw;
        viewCanvas.height = cropInfo.sh;

        viewCanvas.getContext("2d").drawImage(
            fullCanvas,
            cropInfo.sx,
            cropInfo.sy,
            cropInfo.sw,
            cropInfo.sh,
            0,
            0,
            cropInfo.sw,
            cropInfo.sh
        );

        Object.assign(viewCanvas.style, {
            display: "block"
        });

        editorBox.appendChild(viewCanvas);

        /* ================== ANNOTATION CANVAS ================== */
        const annCanvas = document.createElement("canvas");
        annCanvas.width = cropInfo.sw;
        annCanvas.height = cropInfo.sh;

        Object.assign(annCanvas.style, {
            position: "absolute",
            inset: 0,
            cursor: "crosshair"
        });

        editorBox.appendChild(annCanvas);
        const ctx = annCanvas.getContext("2d");
        ctx.lineCap = "round";

        /* ================== TOOLBAR ================== */
        const toolbar = document.createElement("div");
        Object.assign(toolbar.style, {
            position: "absolute",
            top: "-52px",
            left: 0,
            display: "flex",
            gap: "6px",
            padding: "6px",
            background: "rgba(30,30,30,0.9)",
            borderRadius: "8px"
        });
        editorBox.appendChild(toolbar);

        const mkBtn = (txt) => {
            const b = document.createElement("button");
            b.classList.add("tool-btn");

            b.textContent = txt;
            Object.assign(b.style, {
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer"
            });
            return b;
        };

        const btnDraw = mkBtn("✏️");
        const btnText = mkBtn("🔤");
        const btnBlur = mkBtn("🌫️");
        const btnRect = mkBtn("▭");
        const btnCircle = mkBtn("◯");
        const btnUndo = mkBtn("↩️");
        const btnClear = mkBtn("🗑️");
        const btnOk = mkBtn("✔️");
        const btnCancel = mkBtn("✖️");

        toolbar.append(
            btnDraw, btnText, btnBlur,
            btnRect, btnCircle,
            btnUndo, btnClear,
            btnOk, btnCancel
        );

        const colorPicker = document.createElement("input");
        colorPicker.type = "color";
        colorPicker.value = "#ff0000";

        const sizePicker = document.createElement("input");
        sizePicker.type = "range";
        sizePicker.min = 1;
        sizePicker.max = 30;
        sizePicker.value = 5;

        toolbar.append(colorPicker, sizePicker);

        /* ================== STATE ================== */
        let mode = "draw";
        let drawing = false;
        let start = null;
        let drawColor = "#ff0000";
        let drawSize = 5;
        const undoStack = [];

        const snapshot = () => {
            const c = document.createElement("canvas");
            c.width = annCanvas.width;
            c.height = annCanvas.height;
            c.getContext("2d").drawImage(annCanvas, 0, 0);
            undoStack.push(c);
        };

        const toolButtons = [btnDraw, btnText, btnBlur, btnRect, btnCircle];
        setActive(btnDraw);

        function setActive(btn) {
            toolButtons.forEach(b => b.classList.remove("active"));
            if (btn) btn.classList.add("active");
        }

        const setMode = (m, label, btn) => {
            mode = m;
            setModeLabel(label);
            setActive(btn);
        };

        btnDraw.onclick = () => setMode("draw", "Draw", btnDraw);
        btnText.onclick = () => setMode("text", "Text", btnText);
        btnBlur.onclick = () => setMode("blur", "Blur", btnBlur);
        btnRect.onclick = () => setMode("rect", "Rectangle", btnRect);
        btnCircle.onclick = () => setMode("circle", "Circle", btnCircle);

        btnUndo.onclick = () => {
            if (!undoStack.length) return;
            const last = undoStack.pop();
            ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
            ctx.drawImage(last, 0, 0);
        };

        btnClear.onclick = () => {
            snapshot();
            ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
        };

        colorPicker.oninput = () => drawColor = colorPicker.value;
        sizePicker.oninput = () => drawSize = +sizePicker.value;

        /* ================== DRAW LOGIC ================== */
        annCanvas.onmousedown = (e) => {
            const x = e.offsetX;
            const y = e.offsetY;

            if (mode === "text") {
                const txt = prompt("Text:");
                if (txt) {
                    snapshot();
                    ctx.fillStyle = drawColor;
                    ctx.font = `${drawSize * 4}px Arial`;
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

            const x = e.offsetX;
            const y = e.offsetY;

            ctx.strokeStyle = drawColor;
            ctx.lineWidth = drawSize;

            if (mode === "draw") {
                ctx.lineTo(x, y);
                ctx.stroke();
                return;
            }

            if (mode === "blur") {
                ctx.save();
                ctx.filter = "blur(8px)";
                ctx.drawImage(viewCanvas, x - 15, y - 15, 30, 30, x - 15, y - 15, 30, 30);
                ctx.restore();
                return;
            }

            ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);
            const prev = undoStack[undoStack.length - 1];
            if (prev) ctx.drawImage(prev, 0, 0);

            const w = x - start.x;
            const h = y - start.y;

            if (mode === "rect") {
                ctx.strokeRect(start.x, start.y, w, h);
            }

            if (mode === "circle") {
                ctx.beginPath();
                ctx.ellipse(
                    start.x + w / 2,
                    start.y + h / 2,
                    Math.abs(w / 2),
                    Math.abs(h / 2),
                    0, 0, Math.PI * 2
                );
                ctx.stroke();
            }
        };

        annCanvas.onmouseup = () => {
            drawing = false;
            start = null;
        };

        /* ================== FINAL ================== */
        btnOk.onclick = async () => {
            const out = document.createElement("canvas");
            out.width = Math.round(cropInfo.sw);
            out.height = Math.round(cropInfo.sh);

            const octx = out.getContext("2d");

            // crop ảnh gốc
            octx.drawImage(
                fullCanvas,
                cropInfo.sx,
                cropInfo.sy,
                cropInfo.sw,
                cropInfo.sh,
                0,
                0,
                out.width,
                out.height
            );

            // vẽ annotation scale đúng
            octx.drawImage(
                annCanvas,
                0,
                0,
                annCanvas.width,
                annCanvas.height,
                0,
                0,
                out.width,
                out.height
            );

            const dataUrl = out.toDataURL("image/png");

            chrome.runtime.sendMessage({
                action: "save-recording",
                blobUrl: dataUrl,
                filename: `capture-${Date.now()}.png`
            });
        };

        btnCancel.onclick = () => {
            editorBox.remove();

            wrapper.appendChild(overlay); // đưa overlay lại DOM
            bgCanvas.style.display = "";
            resetSelectUI();
            setModeLabel("Select");
        };
    }
}

/* ---------- INIT ---------- */
async function initCaptureAreaWithImage(dataUrl) {
    const img = new Image();
    img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        await captureAreaAdvanced(canvas);
    };
    img.src = dataUrl;
}

window.addEventListener("load", async () => {
    const res = await chrome.runtime.sendMessage({ action: "get-capture-image" });
    if (!res || !res.imageData) {
        alert("No image data found");
        return;
    }
    initCaptureAreaWithImage(res.imageData);
});
