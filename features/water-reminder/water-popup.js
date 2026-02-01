// ---------------------- INIT ----------------------
import * as utils from './water-utils.js';

const ALARMS = {
    WATER: 'water-reminder',
    EYE: 'eye-relax'
};

// when day reaches goal, we mark day completed and optionally clear alarms
async function checkIfCompletedAndUpdateAlarms() {
    const settings = await utils.getSettings();
    const day = await utils.getDayData();
    const goal = settings.goal || 2000;
    if (!day) return;
    if (day.intake >= goal && !day.completed) {
        // mark completed
        const all = await utils.getAllData();
        const key = utils.getTodayKey();
        all[key].completed = true;
        await utils.saveAllData(all);

        // optional: if reminders should stop when completed, clear alarm
        if (settings.enabled && settings.stopWhenComplete) {
            chrome.alarms.clear(ALARMS.WATER);
        }
    }
}

// quick add
document.querySelectorAll('.water-popup .quick-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        if (btn.disabled) return;

        // Visual feedback immediately
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const amount = Number(btn.dataset.amount || 0);
            await utils.addIntake(amount);
            await checkIfCompletedAndUpdateAlarms();

            // Send message and close window in callback
            chrome.runtime.sendMessage({ action: "update-water-reminder" }, () => {
                window.close();
            });
        } catch (err) {
            console.error("Failed to add intake:", err);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
});