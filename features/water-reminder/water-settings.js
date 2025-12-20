import * as utils from './water-utils.js';

async function initWaterSettings() {
    const settings = await utils.getSettings();

    // Personal info
    document.getElementById('weight').value = settings.weight || '';
    document.getElementById('activity').value = settings.activity || '1.1';
    document.getElementById('dailyGoal').value = settings.goal || 2000;

    // Reminder mode
    const mode = settings.reminderMode || "interval";
    document.querySelector(`input[name="reminderMode"][value="${mode}"]`).checked = true;

    document.getElementById('interval-minutes').value = settings.intervalMinutes || 60;
    document.getElementById('sound').checked = settings.sound || false;

    (settings.scheduleTimes || []).forEach(t => addScheduleItem(t));

    document.getElementById('add-time').addEventListener('click', () => {
        addScheduleItem("08:00");
    });

    // Calculate recommended water
    document.getElementById('calcRec').addEventListener('click', () => {
        const w = Number(document.getElementById('weight').value) || 0;
        const activity = Number(document.getElementById('activity').value) || 1.0;
        const rec = Math.round(w * 35 * activity);
        document.getElementById('recValue').textContent = rec;
    });

    // Save daily goal
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

    document.getElementById('reminder-toggle').checked = settings.enabled ?? false;
    document.getElementById('reminder-toggle').addEventListener('change', async (e) => {
        await utils.saveSettings({ enabled: e.target.checked });
        chrome.runtime.sendMessage({ action: "rebuild-water-reminder" });
    });

    // Back button (nếu muốn quay về popup)
    document.getElementById('backToMain').addEventListener('click', () => {
        window.close(); // hoặc mở popup mới
    });
}

function addScheduleItem(initialTime = "08:00") {
    const list = document.getElementById('schedule-list');
    const div = document.createElement('div');
    div.className = 'time-item';
    div.innerHTML = `
        <input type="time" class="time-item-input" value="${initialTime}">
        <button type="button" class="remove-time">X</button>
    `;
    list.appendChild(div);
    div.querySelector('.remove-time').addEventListener('click', () => div.remove());
}

initWaterSettings();
