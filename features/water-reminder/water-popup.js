// ---------------------- INIT ----------------------
import * as utils from './water-utils.js';
let actionSent = false;
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

function sendOnce(msg) {
    if (actionSent) return;
    actionSent = true;
    console.log('sendOnce', msg);
    return new Promise(resolve => {
        chrome.runtime.sendMessage(msg, () => resolve());
    });
}

// quick add
document.querySelectorAll('.water-popup .quick-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        if (btn.disabled) return;

        btn.disabled = true;
        btn.classList.add('loading');

        try {
            const amount = Number(btn.dataset.amount || 0);
            await utils.addIntake(amount);
            await checkIfCompletedAndUpdateAlarms();

            await sendOnce({ action: "update-water-reminder" });
        } finally {
            window.close(); // chỉ close sau khi async xong
        }
    });
});