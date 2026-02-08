async function initColorPicker() {
    const HTML_TEMPLATE = `
<div id="color-picker-overlay" class="hidden">
    <div class="color-picker-modal">
        <div class="cp-header">
            <h3>Color Picker</h3>
            <button id="close-cp-btn">x</button>
        </div>

        <div class="cp-preview-section">
            <div id="cp-color-preview" class="cp-preview-box"></div>
            <button id="cp-pick-btn" class="btn-primary">
                <i class="fa-solid fa-eye-dropper"></i> Pick Color
            </button>
        </div>

        <div class="cp-formats">
            <div class="cp-row">
                <label>HEX</label>
                <div class="cp-input-group">
                    <input type="text" id="cp-hex" readonly>
                    <button class="cp-copy-btn" data-target="cp-hex"><i class="fa-regular fa-copy"></i></button>
                </div>
            </div>

            <div class="cp-row">
                <label>RGB</label>
                <div class="cp-input-group">
                    <input type="text" id="cp-rgb" readonly>
                    <button class="cp-copy-btn" data-target="cp-rgb"><i class="fa-regular fa-copy"></i></button>
                </div>
            </div>

            <div class="cp-row">
                <label>HSL</label>
                <div class="cp-input-group">
                    <input type="text" id="cp-hsl" readonly>
                    <button class="cp-copy-btn" data-target="cp-hsl"><i class="fa-regular fa-copy"></i></button>
                </div>
            </div>

            <div class="cp-row">
                <label>HSV</label>
                <div class="cp-input-group">
                    <input type="text" id="cp-hsv" readonly>
                    <button class="cp-copy-btn" data-target="cp-hsv"><i class="fa-regular fa-copy"></i></button>
                </div>
            </div>
        </div>

        <div class="cp-gradient-section">
            <label>Linear Gradient (to right)</label>
            <div class="cp-input-group">
                <input type="text" id="cp-gradient" readonly>
                <button class="cp-copy-btn" data-target="cp-gradient"><i class="fa-regular fa-copy"></i></button>
            </div>
            <div id="cp-gradient-preview" class="cp-gradient-bar"></div>
        </div>
    </div>
</div>`;

    // 1. Inject HTML if not exists
    if (!document.getElementById("color-picker-overlay")) {
        document.body.insertAdjacentHTML("beforeend", HTML_TEMPLATE);
    }

    const overlay = document.getElementById("color-picker-overlay");

    // Prevent multiple initializations of listeners
    if (overlay.dataset.initialized) return;
    overlay.dataset.initialized = "true";

    const modal = document.querySelector(".color-picker-modal");
    const header = document.querySelector(".cp-header");

    // Draggable logic
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener("mousedown", (e) => {
        if (e.target.closest('button')) return; // Don't drag if clicking close button
        isDragging = true;
        offsetX = e.clientX - modal.getBoundingClientRect().left;
        offsetY = e.clientY - modal.getBoundingClientRect().top;
        header.style.cursor = 'grabbing';
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        // Keep inside viewport
        const bounds = modal.getBoundingClientRect();
        x = Math.max(10, Math.min(x, window.innerWidth - bounds.width - 10));
        y = Math.max(10, Math.min(y, window.innerHeight - bounds.height - 10));

        modal.style.left = x + 'px';
        modal.style.top = y + 'px';
        modal.style.right = 'auto'; // Disable initial right alignment
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        header.style.cursor = 'grab';
    });

    const closeBtn = document.getElementById("close-cp-btn");
    const pickBtn = document.getElementById("cp-pick-btn");

    const hexInput = document.getElementById("cp-hex");
    const rgbInput = document.getElementById("cp-rgb");
    const hslInput = document.getElementById("cp-hsl");
    const hsvInput = document.getElementById("cp-hsv");
    const previewBox = document.getElementById("cp-color-preview");
    const gradientInput = document.getElementById("cp-gradient");
    const gradientBar = document.getElementById("cp-gradient-preview");

    // Close logic
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        overlay.classList.add("hidden");
    });

    // Pick logic
    pickBtn.addEventListener("click", async () => {
        try {
            if (!window.EyeDropper) {
                alert("Your browser does not support the EyeDropper API");
                return;
            }

            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            const hex = result.sRGBHex;

            updateColors(hex);
        } catch (e) {
            console.error(e);
        }
    });

    // Copy logic
    document.querySelectorAll(".cp-copy-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input && input.value) {
                navigator.clipboard.writeText(input.value);

                // Feedback
                const icon = btn.querySelector("i");
                icon.className = "fa-solid fa-check";
                setTimeout(() => icon.className = "fa-regular fa-copy", 1500);
            }
        });
    });

    function updateColors(hex) {
        // Simple hex to RGB conversion
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        // RGB
        const rgbStr = `rgb(${r}, ${g}, ${b})`;

        // HSL
        const [h, s, l] = rgbToHsl(r, g, b);
        const hslStr = `hsl(${h}, ${s}%, ${l}%)`;

        // HSV
        const [hv, sv, v] = rgbToHsv(r, g, b);
        const hsvStr = `hsv(${hv}, ${sv}%, ${v}%)`;

        // Linear Gradient (default to transparent to solid)
        const gradientStr = `linear-gradient(to right, rgba(${r},${g},${b},0), ${hex})`;

        // Update UI
        hexInput.value = hex;
        rgbInput.value = rgbStr;
        hslInput.value = hslStr;
        hsvInput.value = hsvStr;
        gradientInput.value = gradientStr;

        previewBox.style.backgroundColor = hex;
        previewBox.style.backgroundImage = 'none'; // Remove checkerboard
        gradientBar.style.background = gradientStr;
    }

    // Helper: RGB to HSL
    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }

    // Helper: RGB to HSV
    function rgbToHsv(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        let v = Math.max(r, g, b), n = v - Math.min(r, g, b);
        let h = n && ((v == r) ? (g - b) / n : ((v == g) ? 2 + (b - r) / n : 4 + (r - g) / n));
        return [Math.round(60 * (h < 0 ? h + 6 : h)), Math.round(v && n / v * 100), Math.round(v * 100)];
    }
}

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "open-color-picker") {
        initColorPicker().then(() => {
            const overlay = document.getElementById("color-picker-overlay");
            if (overlay) {
                overlay.classList.remove("hidden");
            }
        });
    }
});
