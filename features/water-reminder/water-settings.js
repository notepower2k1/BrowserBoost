import { getSettings, saveSettings } from './water-utils.js';

async function initWaterSettings() {
    const settings = await getSettings();

    document.getElementById('dailyGoal').value = settings.goal || 2000;

    document.getElementById('interval-minutes').value = settings.interval || 60;

    // Save reminder settings
    document.getElementById('save-settings').addEventListener('click', async () => {
        const interval = Number(document.getElementById('interval-minutes').value) || 60;
        const goal = Number(document.getElementById('dailyGoal').value) || 2000;

        await saveSettings({
            interval,
            goal
        });

        chrome.runtime.sendMessage({ action: "update-water-reminder" });
        alert('Reminder settings saved!');
    });
}

document.addEventListener("DOMContentLoaded", initWaterSettings);

