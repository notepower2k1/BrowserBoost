import { getLocalStorage, setLocalStorage } from "../../helper.js";

const DEFAULT = {
    enabled: true,
    interval: 20,
};

export async function initEyeRelax() {
    const container = document.getElementById("eye-relax-container");

    // Load UI
    const html = await fetch("./features/eye-relax/eye-settings.html").then(r => r.text());
    container.innerHTML = html;

    // Load CSS (tránh load trùng)
    if (!document.getElementById("eye-relax-style")) {
        const link = document.createElement("link");
        link.id = "eye-relax-style";
        link.rel = "stylesheet";
        link.href = "./features/eye-relax/eye-settings.css";
        document.head.appendChild(link);
    }

    // Load saved setting
    const saved = await getLocalStorage("eyeRelax");
    const setting = { ...DEFAULT, ...(saved || {}) };

    // Apply to UI
    document.getElementById("er-enabled").checked = setting.enabled;
    document.getElementById("er-interval").value = setting.interval;

    const toggleEl = document.getElementById("er-enabled");

    toggleEl.addEventListener("change", async () => {
        const newSetting = {
            enabled: document.getElementById("er-enabled").checked,
            interval: Number(document.getElementById("er-interval").value) || 20,
        };

        await setLocalStorage("eyeRelax", newSetting);

        // báo background cập nhật alarm
        chrome.runtime.sendMessage({
            action: "update-eye-relax"
        });
    });

    // Save
    document.getElementById("er-save").onclick = async () => {
        const newSetting = {
            enabled: document.getElementById("er-enabled").checked,
            interval: Number(document.getElementById("er-interval").value) || 20,
        };

        await setLocalStorage("eyeRelax", newSetting);

        // báo background cập nhật alarm
        chrome.runtime.sendMessage({
            action: "update-eye-relax"
        });

        alert("Saved");
    };

}