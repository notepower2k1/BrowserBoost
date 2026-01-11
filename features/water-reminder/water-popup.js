// ---------------------- INIT ----------------------
import * as utils from './water-utils.js';

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
            chrome.alarms.clear("water_reminder");
        }
    }

    chrome.runtime.sendMessage({ action: "update-water-ỉntake" });
    window.close();
}

// quick add
document.querySelectorAll('.water-popup .quick-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const amount = Number(btn.dataset.amount || 0);
        await utils.addIntake(amount);
        await checkIfCompletedAndUpdateAlarms();
    });

});

window.addEventListener("beforeunload", () => {
    chrome.runtime.sendMessage({ action: "eye-dismiss", force: true });
});