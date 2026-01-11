// features/water-reminder/water-utils.js
// utilities: storage keys, date helpers, intake management

const SETTINGS_KEY = "water_settings";
const DATA_KEY = "water_data"; // object keyed by yyyy-mm-dd

export function getTodayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export async function getSettings() {
    const r = await chrome.storage.local.get(SETTINGS_KEY);
    return r[SETTINGS_KEY] || {
        weight: null, height: null, gender: null, goal: 2000,
        enabled: false, reminderInterval: 60, reminderSound: false
    };
}

export async function saveSettings(settings) {
    const cur = await getSettings();
    const merged = { ...cur, ...settings };
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
    return merged;
}

export async function getAllData() {
    const r = await chrome.storage.local.get(DATA_KEY);
    return r[DATA_KEY] || {};
}

export async function saveAllData(obj) {
    await chrome.storage.local.set({ [DATA_KEY]: obj });
    return obj;
}

export async function getDayData(date = new Date()) {
    const key = getTodayKey(date);
    const all = await getAllData();
    return all[key] || { intake: 0, history: [], completed: false };
}

export async function addIntake(amount, date = new Date()) {
    const key = getTodayKey(date);
    const all = await getAllData();
    const day = all[key] || { intake: 0, history: [], completed: false };
    const time = Date.now();
    day.history.push({ amount, time });
    day.intake += amount;
    all[key] = day;
    await saveAllData(all);
    return day;
}

export async function resetToday(date = new Date()) {
    const key = getTodayKey(date);
    const all = await getAllData();
    all[key] = { intake: 0, history: [], completed: false };
    await saveAllData(all);
    return all[key];
}

// compute streak (consecutive days including today if completed)
// rules: a day is 'completed' if intake >= goal at that day
export async function computeStreak(goal) {
    const all = await getAllData();
    let streak = 0;
    const today = new Date();
    for (let i = 0; ; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = getTodayKey(d);
        const day = all[key];
        if (!day) {
            // if no record → treat as 0 intake => break streak
            break;
        }
        const intake = day.intake || 0;
        if (intake >= goal) {
            streak++;
        } else break;
    }
    return streak;
}
