const ALARMS = {
    WATER: 'water-reminder',
    EYE: 'eye-relax'
};
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

    chrome.contextMenus.create({
        id: "saveImage",
        title: "Save Image to Helper Clipboard",
        contexts: ["image"]
    });

    chrome.contextMenus.create({
        id: "saveClipboard",
        title: "Save selection to Helper Clipboard",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "saveQuickCommand",
        title: "Save as Quick Command",
        contexts: ["selection"]
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

    if (info.menuItemId === "saveImage") {
        await handleSaveImage(info, tab);
    }

    if (info.menuItemId === "saveClipboard") {
        await handleSaveClipboard(info, tab);
    }

    if (info.menuItemId === "saveQuickCommand") {
        await handleSaveQuickCommand(info, tab);
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
async function scheduleOneShotAlarm(name, minutes = 20) {
    console.log('Setting new alert', name);
    console.log('Setting new minutes', minutes);

    await chrome.alarms.clear(name);
    chrome.alarms.create(name, {
        when: Date.now() + minutes * 60 * 1000
    });
}

/* =====================================================
   ALARM HANDLER
===================================================== */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    /* -------- Eye Relax -------- */
    if (alarm.name === ALARMS.EYE) {
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
    if (alarm.name === ALARMS.WATER) {
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
        chrome.tabs.create({
            url: chrome.runtime.getURL("features/eye-relax/relax-window.html")
        });
    }

    if (id === "water-reminder-noti") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("features/water-reminder/water-popup.html")
        });
    }
});

let tempCaptureImage = null;

/* =====================================================
   MESSAGE HANDLER
===================================================== */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Helper to handle async messaging
    const handleAsync = async () => {
        /* -------- Eye Relax -------- */
        if (msg.action === "eye-snooze") {
            const settings = await getEyeRelaxSettings();
            await scheduleOneShotAlarm(ALARMS.EYE, msg.minutes || settings.interval || 20);
        }

        if (msg.action === "update-eye-relax") {
            const settings = await getEyeRelaxSettings();
            if (!settings.enabled) return;
            await scheduleOneShotAlarm(ALARMS.EYE, settings.interval || 20);
        }

        /* -------- Water Reminder -------- */
        if (msg.action === "update-water-reminder") {
            const settings = await getWaterSettings();
            if (!settings.enabled) return;
            await scheduleOneShotAlarm(ALARMS.WATER, settings.interval || 20);
        }

        if (msg.action === "open-capture-area-page") {
            tempCaptureImage = msg.imageData || null;
            chrome.tabs.create({
                url: chrome.runtime.getURL("features/capture/capture-area.html")
            });
        }

        /* -------- Save Recording -------- */
        if (msg.action === "save-recording") {
            try {
                await chrome.downloads.download({
                    url: msg.blobUrl,
                    filename: msg.filename,
                    saveAs: true
                });
                return { success: true };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }

        /* -------- Clipboard Manager -------- */
        if (msg.action === "save-clipboard") {
            await addToClipboardHistory(msg);
        }
    };

    if (msg.action === "get-capture-image") {
        sendResponse({ imageData: tempCaptureImage });
        return false; // synchronous
    }

    // Run async tasks
    handleAsync().then(response => {
        sendResponse(response || { success: true });
    }).catch(err => {
        sendResponse({ success: false, error: err.message });
    });

    return true; // Keep the message channel open for handleAsync
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

async function handleSaveImage(info, tab) {
    if (!info.srcUrl || !tab.id) return;

    try {
        // Use content script to grab image as DataURL (more reliable for CORS)
        chrome.tabs.sendMessage(tab.id, {
            action: 'grab-image-data',
            srcUrl: info.srcUrl
        }, async (response) => {
            if (response && response.dataUrl) {
                await addToClipboardHistory({
                    type: 'image',
                    text: '[Image] Saved via Context Menu',
                    image: response.dataUrl,
                    url: info.pageUrl || tab.url,
                    title: tab.title || 'Context Menu Capture',
                    timestamp: Date.now()
                });

                // Show visual feedback
                chrome.notifications.create("img-save-" + Date.now(), {
                    type: "basic",
                    iconUrl: response.dataUrl,
                    title: "Image Saved",
                    message: "The image has been added to your clipboard history."
                });
            }
        });
    } catch (err) {
        console.error("Failed to save image:", err);
    }
}

async function handleSaveClipboard(info, tab) {
    const text = info.selectionText?.trim();
    if (!text) return;

    await addToClipboardHistory({
        type: 'text',
        text,
        url: info.pageUrl || tab.url,
        title: tab.title || 'Saved Selection',
        timestamp: Date.now()
    });

    // Visual feedback
    chrome.notifications.create("clip-save-" + Date.now(), {
        type: "basic",
        iconUrl: "icon-48x48.png",
        title: "Selection Saved",
        message: "The selected text has been added to your clipboard history."
    });
}

async function addToClipboardHistory(data) {
    const { type, text, image, url, title, timestamp } = data;
    try {
        const res = await chrome.storage.local.get("clipboardHistory");
        let history = res.clipboardHistory || [];

        // Skip if same as last entry (only for text)
        if (type === 'text' && history.length > 0 && history[0].text === text) return;

        // Add to start
        history.unshift({
            type: type || 'text',
            text,
            image,
            url,
            title,
            timestamp: timestamp || Date.now()
        });

        // Limit to 50
        if (history.length > 50) history = history.slice(0, 50);

        await chrome.storage.local.set({ clipboardHistory: history });
    } catch (err) {
        console.error("Storage error:", err);
    }
}

async function handleSaveQuickCommand(info, tab) {
    if (!tab.id) return;

    try {
        // Use message passing to get exact formatting
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'get-selection' });
        const text = response && response.selection ? response.selection : info.selectionText;

        if (!text) return;

        const res = await chrome.storage.local.get("quickCommands");
        let commands = res.quickCommands || [];

        // Check duplicate
        if (commands.some(c => c.text === text)) return;

        commands.unshift({
            id: Date.now().toString(),
            text,
            createdAt: Date.now()
        });

        await chrome.storage.local.set({ quickCommands: commands });

        // Visual feedback
        chrome.notifications.create("cmd-save-" + Date.now(), {
            type: "basic",
            iconUrl: "icon-48x48.png",
            title: "Command Saved",
            message: "Added to Quick Commands"
        });
    } catch (err) {
        console.error("Quick Command Save Error:", err);
    }
}
