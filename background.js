chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "addNote",
        title: "Add Sticky Note",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "addBookmark",
        title: "Bookmark current website",
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

    if (info.menuItemId === "addBookmark") {
        await handleAddBookmark(tab);
    }

    if (info.menuItemId === "copyToNote") {
        await handleCopyToNote(info);
    }
});


async function getEyeRelaxSettings() {
    const res = await chrome.storage.local.get("eyeRelax");
    return res.eyeRelax || {};
}

async function scheduleEyeRelaxAlarm(delayMinutes) {
    chrome.alarms.clear("eye-relax");
    chrome.alarms.create("eye-relax", {
        when: Date.now() + (delayMinutes || 20) * 60 * 1000
    });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "eye-relax") return;

    const settings = await getEyeRelaxSettings();
    if (!settings.enabled) return;


    // Show notification
    chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/media/eye.png",
        title: "Eye Relax",
        message: `Time to rest your eyes 👀`
    });

    // Open relax popup
    chrome.notifications.onClicked.addListener((id) => {
        chrome.windows.create({
            url: chrome.runtime.getURL("features/eye-relax/relax-window.html"),
            type: "popup",
            focused: true,
            width: 360,
            height: 360
        });
    });
});

chrome.runtime.onMessage.addListener(async (msg) => {
    const settings = await getEyeRelaxSettings();

    if (msg.action === "eye-snooze") {
        await chrome.storage.local.set({ eyeRelaxActive: false });
        const minutes = msg.minutes || settings.interval || 20;
        await scheduleEyeRelaxAlarm(minutes);

        await chrome.storage.local.set({
            eyeRelaxRuntime: { snoozed: true, baseInterval: settings.interval }
        });
    }

    if (msg.action === "eye-dismiss") {
        const interval = settings.interval || 20;

        // Always reschedule
        await scheduleEyeRelaxAlarm(interval);

        await chrome.storage.local.set({
            eyeRelaxActive: false,
            eyeRelaxRuntime: {
                snoozed: false,
                baseInterval: interval
            }
        });
    }

    if (msg.action === "update-eye-relax") {
        if (!settings.enabled) return;

        // Reset active
        await chrome.storage.local.set({ eyeRelaxActive: false });

        // Schedule next one-shot
        await scheduleEyeRelaxAlarm(settings.interval);

        await chrome.storage.local.set({
            eyeRelaxRuntime: { snoozed: false, baseInterval: settings.interval }
        });
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "save-recording") {
        chrome.downloads.download({
            url: msg.blobUrl,
            filename: msg.filename,
            saveAs: true
        });

        sendResponse({ success: true });
    }
});

/* ===============================
   Message listener
================================ */
chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === "rebuild-water-reminder") {
        await clearAllWaterAlarms();

        const settings = await getWaterSettings();
        if (!settings || !settings.enabled) return;

        if (settings.reminderMode === "interval") {
            scheduleNextInterval(settings.intervalMinutes);
        }

        if (settings.reminderMode === "schedule") {
            (settings.scheduleTimes || []).forEach(time => {
                scheduleNextScheduleTime(time);
            });
        }
    }
});

/* ===============================
   Alarm handler (ONE-SHOT)
================================ */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    const settings = await getWaterSettings();
    if (!settings.enabled) return;

    /* ---------- INTERVAL ---------- */
    if (alarm.name === "water_interval") {
        notify(settings);

        // schedule next interval
        scheduleNextInterval(settings.intervalMinutes);
        return;
    }

    /* ---------- SCHEDULE ---------- */
    if (alarm.name.startsWith("water_schedule_")) {
        notify(settings);

        const time = alarm.name.replace("water_schedule_", "");
        scheduleNextScheduleTime(time);
    }
});

/* ===============================
   Interval
================================ */
function scheduleNextInterval(intervalMinutes = 60) {
    chrome.alarms.create("water_interval", {
        when: Date.now() + intervalMinutes * 60 * 1000
    });
}

/* ===============================
   Schedule fixed time
================================ */
function scheduleNextScheduleTime(time) {
    const [h, m] = time.split(":").map(Number);
    const now = new Date();

    let target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        h, m, 0
    ).getTime();

    if (target <= Date.now()) {
        target += 24 * 60 * 60 * 1000;
    }

    chrome.alarms.create(`water_schedule_${time}`, {
        when: target
    });
}

/* ===============================
   Clear all water alarms
================================ */
async function clearAllWaterAlarms() {
    const alarms = await chrome.alarms.getAll();
    for (const a of alarms) {
        if (a.name.startsWith("water_")) {
            chrome.alarms.clear(a.name);
        }
    }
}

function notify(settings) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/media/water.png",
        title: "Time to drink water 💧",
        message: "Stay hydrated!",
        priority: 2
    });

    if (settings.sound) {
        try {
            const ctx = new (self.AudioContext || self.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.frequency.value = 880;
            g.gain.value = 0.02;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            setTimeout(() => { o.stop(); ctx.close(); }, 350);
        } catch { }
    }
}

/* ===============================
   Settings loader
================================ */
async function getWaterSettings() {
    const r = await chrome.storage.local.get("water_settings_v1");
    return r["water_settings_v1"] || {};
}

async function handleAddBookmark(tab) {
    if (!tab || !tab.url) return;

    const url = tab.url;
    const shortName = tab.title || url;
    const addedTime = Date.now();

    const data = await chrome.storage.local.get("websiteGroups");
    let groups = data.websiteGroups || [];

    // Tìm group-1 / Khác
    let otherGroup = groups.find(g => g.id === "group-1");
    if (!otherGroup) {
        // Nếu chưa có thì tạo mới
        otherGroup = {
            id: "group-1",
            name: "Khác",
            order: 0,
            pinned: false,
            pinnedTime: null,
            toggle: true,
            websites: []
        };
        groups.push(otherGroup);
    }

    // Push website mới
    otherGroup.websites.unshift({
        addedTime,
        shortName,
        url
    });

    // Lưu lại
    await chrome.storage.local.set({ websiteGroups: groups });
}

async function handleCopyToNote(info) {
    const selectedText = info.selectionText?.trim();
    if (!selectedText) return;

    const data = await chrome.storage.local.get("sidebarNotes");
    let notes = data.sidebarNotes || [];

    // Tìm Note 1
    let note1 = notes.find(n => n.title === "Note 1");

    if (!note1) {
        // Nếu chưa có thì tạo mới
        note1 = {
            id: Date.now().toString(),
            title: "Note 1",
            content: ""
        };
        notes.push(note1);
    }

    // Append nội dung mới, xuống dòng nếu cần
    note1.content += (note1.content ? "\n" : "") + selectedText;

    await chrome.storage.local.set({ sidebarNotes: notes });
}