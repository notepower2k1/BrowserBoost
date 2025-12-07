
import { getLocalStorage, setLocalStorage } from "../../helper.js";

export async function initWaterReminder() {
    const container = document.getElementById("water-container");

    // Load giao diện
    const html = await fetch("./features/water-reminder/water-reminder.html").then(r => r.text());
    container.innerHTML = html;

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./features/water-reminder/water-reminder.css";
    document.head.appendChild(link);

    // Khởi tạo logic sau khi giao diện sẵn sàng
    setupEvents();
}

function setupEvents() {
    const calcBtn = document.getElementById("calc-goal");
    const startBtn = document.getElementById("start-reminder");

    if (calcBtn) {
        calcBtn.addEventListener("click", () => {
            const weight = Number(document.getElementById("weight").value);
            const goal = weight * 35; // ml
            document.getElementById("custom-goal").value = goal;
        });
    }

    if (startBtn) {
        startBtn.addEventListener("click", async () => {
            const height = Number(document.getElementById("height").value);
            const weight = Number(document.getElementById("weight").value);
            const goal = Number(document.getElementById("custom-goal").value);
            const interval = Number(document.getElementById("interval").value);

            await setLocalStorage('water_settings', { height, weight, goal, interval });

            chrome.alarms.clear("water_reminder");
            chrome.alarms.create("water_reminder", {
                delayInMinutes: interval,
                periodInMinutes: interval
            });

            alert("Đã bật nhắc nhở uống nước!");
        });
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    const s = await getLocalStorage('water_settings');

    if (!s) return;

    document.getElementById("height").value = s.height || "";
    document.getElementById("weight").value = s.weight || "";
    document.getElementById("custom-goal").value = s.goal || "";
    document.getElementById("interval").value = s.interval || "60";
    document.getElementById("start-reminder").addEventListener("click", async () => {
        const height = Number(document.getElementById("height").value);
        const weight = Number(document.getElementById("weight").value);
        const customGoal = Number(document.getElementById("custom-goal").value);

        const intervalSelect = document.getElementById("interval").value;
        const interval = intervalSelect === "custom"
            ? Number(document.getElementById("custom-interval").value)
            : Number(intervalSelect);

        const goal = customGoal || (weight * 35);

        // Lưu setting
        await setLocalStorage('water_settings', { height, weight, goal, interval });

        // Clear alarm cũ
        chrome.alarms.clear("water_reminder");

        // Tạo alarm mới
        chrome.alarms.create("water_reminder", {
            delayInMinutes: interval,
            periodInMinutes: interval
        });

        alert("Đã bật nhắc nhở uống nước!");
    });

});