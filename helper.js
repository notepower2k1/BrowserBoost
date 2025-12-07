
export function debounce(func, wait, immediate) {
    var timeout;
    return function () {
        var context = this,
            args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

export async function getLocalStorage(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

export async function setLocalStorage(key, data) {
    return chrome.storage.local.set({ [key]: data });
}

export async function deletelocalStorage(key) {
    return chrome.storage.local.remove(key);
}

export async function saveSettings(newData) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['setting'], (result) => {
            const current = result.setting || {};
            const updated = { ...current, ...newData }; // merge
            chrome.storage.local.set({ setting: updated }, () => resolve(updated));
        });
    });
}

export async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['setting'], (result) => {
            resolve(result.setting || {});
        });
    });
}

export async function saveWaterSettings(data) {
    return chrome.storage.local.set({ water_settings_v1: { ...(await getWaterSettingsSafe()), ...data } });
}

export async function getWaterSettings() {
    const r = await chrome.storage.local.get('water_settings_v1');
    return r['water_settings_v1'] || {
        weight: null, height: null, gender: null, activity: 1.1,
        goal: 2000, reminderEnabled: false, reminderInterval: 60, reminderSound: false, stopWhenComplete: false
    };
}

// safe helper used above
async function getWaterSettingsSafe() {
    const r = await chrome.storage.local.get('water_settings_v1');
    return r['water_settings_v1'] || {};
}

// optional small shim for older code compatibility:
export async function saveWaterData(key, value) {
    // e.g. used only if needed
    const r = await chrome.storage.local.get('water_data_v1');
    const all = r['water_data_v1'] || {};
    all[key] = value;
    await chrome.storage.local.set({ 'water_data_v1': all });
}