import { getLocalStorage, setLocalStorage } from "../../helper.js";

const ALARMS = {
    WATER: 'water-reminder',
    EYE: 'eye-relax'
};

const DEFAULT = {
    enabled: false,
    interval: 20, // phút
    relaxDuration: 20 // giây
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
    document.getElementById("er-duration").value = setting.relaxDuration;

    const toggleEl = document.getElementById("er-enabled");

    toggleEl.addEventListener("change", async () => {
        const newSetting = {
            enabled: document.getElementById("er-enabled").checked,
            interval: Number(document.getElementById("er-interval").value) || 20,
            relaxDuration: Number(document.getElementById("er-duration").value) || 20
        };

        await setLocalStorage("eyeRelax", newSetting);

        // rebuild alarm
        chrome.runtime.sendMessage({ action: "update-eye-relax" });
    });

    // Save
    document.getElementById("er-save").onclick = async () => {
        const newSetting = {
            enabled: document.getElementById("er-enabled").checked,
            interval: Number(document.getElementById("er-interval").value) || 20,
            relaxDuration: Number(document.getElementById("er-duration").value) || 20
        };

        await setLocalStorage("eyeRelax", newSetting);

        // báo background cập nhật alarm
        chrome.runtime.sendMessage({
            action: "update-eye-relax"
        });

        alert("Saved");
    };

    await initAlarmCard();
}

async function initAlarmCard() {
    const listEl = document.getElementById("alarmList");
    const clearAllBtn = document.getElementById("clearAll");
    const refreshBtn = document.getElementById("refreshAll");

    /* Format timestamp -> readable */
    function formatTime(ts) {
        return new Date(ts).toLocaleString();
    }

    /* Render alarms */
    function loadAlarms() {
        chrome.alarms.getAll((alarms) => {
            listEl.innerHTML = "";

            if (!alarms.length) {
                listEl.innerHTML = "<li>No active alarms</li>";
                return;
            }

            alarms
                .sort((a, b) => a.scheduledTime - b.scheduledTime)
                .forEach(alarm => {
                    let formatAlarmName = alarm.name.replace(/[^a-zA-Z0-9]/g, " ");
                    formatAlarmName = formatAlarmName.charAt(0).toUpperCase() + formatAlarmName.slice(1);

                    const li = document.createElement("li");

                    li.innerHTML = `
                    <div>
                        <strong>${formatAlarmName}</strong>
                        <div class="alarm-time">
                            ${alarm.scheduledTime ? formatTime(alarm.scheduledTime) : "Repeating"}
                        </div>
                    </div>
                    <button class="clear-btn">Clear</button>
                `;

                    li.querySelector(".clear-btn").onclick = () => {                        
                        chrome.alarms.clear(alarm.name, async () => {                            
                            if (alarm.name === ALARMS.EYE) {
                                const currentSetting = await getLocalStorage("eyeRelax") || {};
                                currentSetting.enabled = false;
                                setLocalStorage("eyeRelax", currentSetting);
                                const erToggle = document.getElementById("er-enabled");
                                if (erToggle) erToggle.checked = false;
                            }

                            if (alarm.name === ALARMS.WATER) {
                                const currentSetting = await getLocalStorage("water_settings") || {};
                                currentSetting.enabled = false;
                                setLocalStorage("water_settings", currentSetting);
                            }

                            loadAlarms();
                        });
                    };

                    listEl.appendChild(li);
                });
        });
    }

    /* Clear all alarms */
    clearAllBtn.onclick = async () => {
        if (!confirm("Clear all alarms?")) return;

        const eyeRelaxSetting = await getLocalStorage("eyeRelax") || {};
        eyeRelaxSetting.enabled = false;
        setLocalStorage("eyeRelax", eyeRelaxSetting);
        const erToggle = document.getElementById("er-enabled");
        if (erToggle) erToggle.checked = false;

        const waterReminderSetting = await getLocalStorage("water_settings") || {};
        waterReminderSetting.enabled = false;
        setLocalStorage("water_settings", waterReminderSetting);

        chrome.alarms.clearAll(() => {
            loadAlarms();
        });
    };

    refreshBtn.onclick = () => {
        loadAlarms();
    };

    /* Init */
    loadAlarms();
}