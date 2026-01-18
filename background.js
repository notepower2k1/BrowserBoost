/* =====================================================
   CONTEXT MENU
===================================================== */
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "addNote",
        title: "Add Sticky Note",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "copyToNote",
        title: "Copy to note",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "addNote") {
        const note = {
            id: Date.now(),
            content: "",
            x: info.pageX || 100,
            y: info.pageY || 100,
            width: 320,
            height: 240
        };

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (note) => window.createStickyNoteFromPopup(note),
            args: [note]
        });
    }

    if (info.menuItemId === "copyToNote") {
        await handleCopyToNote(info);
    }
});

/* =====================================================
   STORAGE HELPERS
===================================================== */
async function getEyeRelaxSettings() {
    const r = await chrome.storage.local.get("eyeRelax");
    return r.eyeRelax || {};
}

async function getWaterSettings() {
    const r = await chrome.storage.local.get("water_settings");
    return r.water_settings || {};
}

/* =====================================================
   ALARM HELPERS
===================================================== */
function scheduleOneShotAlarm(name, minutes = 20) {
    chrome.alarms.clear(name);
    chrome.alarms.create(name, {
        when: Date.now() + minutes * 60 * 1000
    });
}

/* =====================================================
   ALARM HANDLER
===================================================== */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    /* -------- Eye Relax -------- */
    if (alarm.name === "eye-relax") {
        const settings = await getEyeRelaxSettings();
        if (!settings.enabled) return;

        chrome.notifications.create("eye-relax-noti", {
            type: "basic",
            iconUrl: "assets/media/eye.png",
            title: "Eye Relax",
            message: "Time to rest your eyes 👀"
        });
    }

    /* -------- Water Reminder -------- */
    if (alarm.name === "water-reminder") {
        const settings = await getWaterSettings();
        if (!settings.enabled) return;

        chrome.notifications.create("water-reminder-noti", {
            type: "basic",
            iconUrl: "assets/media/water.png",
            title: "Time to drink water 💧",
            message: "Stay hydrated!",
            priority: 2
        });
    }
});

/* =====================================================
   NOTIFICATION CLICK
===================================================== */
chrome.notifications.onClicked.addListener((id) => {
    if (id === "eye-relax-noti") {
        chrome.windows.create({
            url: chrome.runtime.getURL("features/eye-relax/relax-window.html"),
            type: "popup",
            width: 360,
            height: 360
        });
    }

    if (id === "water-reminder-noti") {
        chrome.windows.create({
            url: chrome.runtime.getURL("features/water-reminder/water-popup.html"),
            type: "popup",
            width: 360,
            height: 360
        });
    }
});

let tempCaptureImage = null;

/* =====================================================
   MESSAGE HANDLER
===================================================== */
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    /* -------- Eye Relax -------- */
    if (msg.action === "eye-snooze") {
        const settings = await getEyeRelaxSettings();
        scheduleOneShotAlarm("eye-relax", msg.minutes || settings.interval || 20);
    }

    if (msg.action === "eye-dismiss") {
        const settings = await getEyeRelaxSettings();
        scheduleOneShotAlarm("eye-relax", settings.interval || 20);
    }

    if (msg.action === "update-eye-relax") {
        const settings = await getEyeRelaxSettings();
        if (!settings.enabled) return;
        scheduleOneShotAlarm("eye-relax", settings.interval || 20);
    }

    /* -------- Water Reminder -------- */
    if (msg.action === "update-water-intake") {
        const settings = await getWaterSettings();
        scheduleOneShotAlarm("water-reminder", settings.interval || 20);
    }

    if (msg.action === "update-water-reminder") {
        const settings = await getWaterSettings();
        if (!settings.enabled) return;
        scheduleOneShotAlarm("water-reminder", settings.interval || 20);
    }

    if (msg.action === "open-capture-area-page") {
        tempCaptureImage = msg.imageData || null;

        chrome.tabs.create({
            url: chrome.runtime.getURL("features/capture/capture-area.html")
        });
    }

    if (msg.action === "get-capture-image") {
        sendResponse({
            imageData: tempCaptureImage
        });
    }

    /* -------- Save Recording -------- */
    if (msg.action === "save-recording") {
        chrome.downloads.download({
            url: msg.blobUrl,
            filename: msg.filename,
            saveAs: true
        });

        sendResponse({ success: true });
    }
});

/* =====================================================
   COPY TO NOTE
===================================================== */
async function handleCopyToNote(info) {
    const selectedText = info.selectionText?.trim();
    if (!selectedText) return;

    const data = await chrome.storage.local.get("sidebarNotes");
    let notes = data.sidebarNotes || [];

    let note1 = notes.find(n => n.title === "Note 1");

    if (!note1) {
        note1 = {
            id: Date.now().toString(),
            title: "Note 1",
            content: ""
        };
        notes.push(note1);
    }

    note1.content += (note1.content ? "\n" : "") + selectedText;
    await chrome.storage.local.set({ sidebarNotes: notes });
}