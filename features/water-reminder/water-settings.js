// features/water-reminder/water-settings.js
import * as utils from './water-utils.js';

export async function initWaterSettings() {

    // Load HTML
    const container = document.getElementById('water-container');
    const html = await fetch(chrome.runtime.getURL('features/water-reminder/water-settings.html')).then(r => r.text());
    container.innerHTML = html;

    // Load CSS
    const cssHref = chrome.runtime.getURL('features/water-reminder/water-settings.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    document.head.appendChild(link);

    // Load Settings
    const settings = await utils.getSettings();

    document.getElementById('weight').value = settings.weight || '';
    document.getElementById('activity').value = settings.activity || '1.1';
    document.getElementById('dailyGoal').value = settings.goal || 2000;

    // Reminder Mode
    const mode = settings.reminderMode || "interval";
    document.querySelector(`input[name="reminderMode"][value="${mode}"]`).checked = true;

    document.getElementById('interval-minutes').value = settings.intervalMinutes || 60;
    document.getElementById('sound').checked = settings.sound || false;

    // Load schedule items
    (settings.scheduleTimes || []).forEach(t => {
        addScheduleItem(t);
    });

    // Add schedule time
    document.getElementById('add-time').addEventListener('click', () => {
        addScheduleItem("08:00");
    });

    // Calculate recommended water
    document.getElementById('calcRec').addEventListener('click', async () => {
        const w = Number(document.getElementById('weight').value) || 0;
        const activity = Number(document.getElementById('activity').value) || 1.0;
        const rec = Math.round(w * 35 * activity);
        document.getElementById('recValue').textContent = rec;
    });

    // Save goal only
    document.getElementById('saveGoal').addEventListener('click', async () => {
        const goal = Number(document.getElementById('dailyGoal').value) || 2000;
        await utils.saveSettings({ goal });
        alert('Saved daily goal: ' + goal + ' ml');
    });

    // Save reminder settings
    document.getElementById('save-settings').addEventListener('click', async () => {
        const reminderMode = document.querySelector('input[name="reminderMode"]:checked').value;
        const intervalMinutes = Number(document.getElementById('interval-minutes').value) || 60;
        const sound = document.getElementById('sound').checked;

        const scheduleTimes = [...document.querySelectorAll(".time-item-input")].map(inp => inp.value).filter(Boolean);

        await utils.saveSettings({
            reminderMode,
            intervalMinutes,
            sound,
            scheduleTimes
        });

        chrome.runtime.sendMessage({ action: "rebuild-water-reminder" });

        alert('Reminder settings saved!');
    });

    // Back button
    document.getElementById('backToMain').addEventListener('click', async () => {
        const module = await import('./water-reminder.js');
        module.initWaterReminder();
    });

    const toggleEl = document.getElementById("reminder-toggle");

    toggleEl.addEventListener("change", async () => {
        const enabled = toggleEl.checked;

        const data = (await chrome.storage.local.get("water_settings_v1"))["water_settings_v1"] || {};
        data.enabled = enabled;

        await chrome.storage.local.set({ water_settings_v1: data });

        // If enabled → create alarm again
        if (enabled) {
            chrome.alarms.create("water_reminder", {
                when: Date.now() + 1000 * 60 * (data.interval || 60),
                periodInMinutes: data.interval || 60
            });
        } else {
            chrome.alarms.clear("water_reminder");
        }
    });
}

/* --------------------------
 Helper: add schedule item
--------------------------- */
function addScheduleItem(initialTime = "08:00") {
    const list = document.getElementById('schedule-list');
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'time-item';

    div.innerHTML = `
        <input type="time" class="time-item-input" value="${initialTime}">
        <button type="button" class="remove-time">X</button>
    `;

    list.appendChild(div);

    div.querySelector('.remove-time').addEventListener('click', () => {
        div.remove();
    });
}