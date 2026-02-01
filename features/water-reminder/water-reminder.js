// features/water-reminder/water-reminder.js
import * as utils from './water-utils.js';

const CONTAINER_ID = "water-container";

// exported to be called from popup.js lazy-loader
export async function initWaterReminder() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return console.error("Missing container:", CONTAINER_ID);

    // load html
    const html = await fetch(chrome.runtime.getURL('features/water-reminder/water-reminder.html')).then(r => r.text());
    container.innerHTML = html;

    // load css
    const cssHref = chrome.runtime.getURL('features/water-reminder/water-reminder.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    document.head.appendChild(link);

    // init logic
    await refreshUI();
    setupEventHandlers();
}

async function refreshUI() {
    const settings = await utils.getSettings();
    const day = await utils.getDayData();
    const goal = settings.goal || 2000;
    const intake = day.intake || 0;
    const percent = Math.min(100, Math.round(intake / goal * 100));

    // update cup
    const waterRect = document.getElementById("waterRect");
    const waterWave = document.getElementById("waterWave");
    const cupPercentage = document.getElementById("cupPercentage");
    const cupMlText = document.getElementById("cupMlText");
    if (waterRect) {
        const clipTop = 26;
        const clipBottom = 236;
        const clipHeight = clipBottom - clipTop; // = 210

        const fillHeight = Math.round(clipHeight * (percent / 100));

        // Khi 100% → y = clipTop
        const y = clipTop + (clipHeight - fillHeight);

        waterRect.setAttribute("x", 44);
        waterRect.setAttribute("y", y);
        waterRect.setAttribute("height", fillHeight);
        waterRect.setAttribute("width", 112);
    }
    if (waterWave) {
        const clipTop = 26;
        const clipBottom = 236;
        const clipHeight = clipBottom - clipTop;

        const fillHeight = Math.round(clipHeight * (percent / 100));
        const yBase = clipTop + (clipHeight - fillHeight) + 6;

        const path = `
        M44 ${yBase}
        q 20 -6 40 0
        q 20 6 40 0
        q 20 -6 40 0
        v 20 h -160 z
    `;

        waterWave.setAttribute("d", path);
    }

    if (cupPercentage) cupPercentage.textContent = `${percent}%`;
    if (cupMlText) cupMlText.textContent = `${intake} / ${goal} ml`;

    // streak & status
    const streakCountEl = document.getElementById("streakCount");
    const todayStatusEl = document.getElementById("todayStatus");
    const streak = await utils.computeStreak(goal);
    if (streakCountEl) streakCountEl.textContent = `${streak} days`;
    if (todayStatusEl) {
        todayStatusEl.textContent = (intake >= goal) ? "Completed" : "In Progress";
        todayStatusEl.className = (intake >= goal) ? "value completed" : "value in-progress";
    }

    document.getElementById('reminder-toggle').checked = settings.enabled ?? false;
}

function setupEventHandlers() {
    // quick add
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const amount = Number(btn.dataset.amount || 0);

            // Trigger animation
            const cupWrap = document.getElementById("cupWrap");
            if (cupWrap) {
                cupWrap.classList.remove("adding-water");
                void cupWrap.offsetWidth; // trigger reflow
                cupWrap.classList.add("adding-water");
                setTimeout(() => cupWrap.classList.remove("adding-water"), 600);
            }

            await utils.addIntake(amount);
            await checkIfCompletedAndUpdateAlarms();
            await refreshUI();
        });
    });

    // settings button
    const settingsBtn = document.getElementById("openSettings");
    if (settingsBtn) settingsBtn.addEventListener("click", async () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('features/water-reminder/water-settings.html')
        });
    });

    // reset today's intake
    const resetBtn = document.getElementById("resetToday");
    if (resetBtn) resetBtn.addEventListener('click', async () => {
        if (!confirm("Reset today's intake to 0?")) return;
        await utils.resetToday();
        await refreshUI();
    });

    document.getElementById('reminder-toggle').addEventListener('change', async (e) => {
        await utils.saveSettings({ enabled: e.target.checked });
        chrome.runtime.sendMessage({ action: "update-water-reminder" });
    });
}

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
            chrome.alarms.clear("water-reminder");
        }
    }
}
