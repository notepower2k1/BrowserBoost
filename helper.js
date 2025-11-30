
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