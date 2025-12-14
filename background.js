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

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "rebuild-water-reminder") {
        setupWaterAlarms();
    }
});

chrome.alarms.onAlarm.addListener(async alarm => {
    if (!alarm.name.startsWith("water_reminder")) return;

    const settings = (await chrome.storage.local.get('water_settings_v1')).water_settings_v1 || {};

    if (!settings.enabled) return; // <<--- thêm dòng này

    chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/media/logo.png",
        title: "Time to drink water 💧",
        message: "Stay hydrated!",
        priority: 2
    });

    if (settings.sound) {
        try {
            const ctx = new (self.AudioContext || self.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = 880;
            g.gain.value = 0.02;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            setTimeout(() => { o.stop(); ctx.close(); }, 350);
        } catch (e) { }
    }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "eye-relax") return;

    const { eyeRelax, eyeRelaxActive } =
        await chrome.storage.local.get(["eyeRelax", "eyeRelaxActive"]);

    if (eyeRelaxActive) return;

    if (!eyeRelax?.enabled) return;

    await chrome.storage.local.set({ eyeRelaxActive: true });

    chrome.notifications.create({
        type: "basic",
        iconUrl: "assets/media/logo.png",
        title: "Eye Relax",
        message: "Time to rest your eyes 👀"
    });

    chrome.windows.create({
        url: chrome.runtime.getURL(
            "features/eye-relax/relax-window.html"
        ),
        type: "popup",
        focused: true,
        width: 360,
        height: 360
    });
});

chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === "eye-snooze") {
        await chrome.storage.local.set({ eyeRelaxActive: false });

        const minutes = msg.minutes;

        const { eyeRelax } = await chrome.storage.local.get("eyeRelax");

        chrome.alarms.clear("eye-relax");

        // tạo alarm snooze
        chrome.alarms.create("eye-relax", {
            delayInMinutes: minutes
        });

        await chrome.storage.local.set({
            eyeRelaxRuntime: {
                snoozed: true,
                baseInterval: eyeRelax.interval
            }
        });
    }

    if (msg.action === "eye-dismiss") {
        await chrome.storage.local.set({ eyeRelaxActive: false });

        const { eyeRelaxRuntime } = await chrome.storage.local.get("eyeRelaxRuntime");

        if (eyeRelaxRuntime?.snoozed) {
            chrome.alarms.clear("eye-relax");

            chrome.alarms.create("eye-relax", {
                delayInMinutes: eyeRelaxRuntime.baseInterval,
                periodInMinutes: eyeRelaxRuntime.baseInterval
            });

            await chrome.storage.local.set({
                eyeRelaxRuntime: { snoozed: false }
            });
        }
    }
});

chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === "update-eye-relax") {
        const { eyeRelax } = await chrome.storage.local.get("eyeRelax");
        if (!eyeRelax?.enabled) return;

        chrome.alarms.clear("eye-relax");

        chrome.alarms.create("eye-relax", {
            delayInMinutes: eyeRelax.interval,
            periodInMinutes: eyeRelax.interval
        });

        await chrome.storage.local.set({
            eyeRelaxRuntime: {
                snoozed: false,
                baseInterval: eyeRelax.interval
            }
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

async function setupWaterAlarms() {
    // Clear old alarms
    const alarms = await chrome.alarms.getAll();
    for (const a of alarms) {
        if (a.name.startsWith("water_reminder")) {
            chrome.alarms.clear(a.name);
        }
    }

    // Load settings
    const settings = (await chrome.storage.local.get("water_settings_v1")).water_settings_v1;
    if (!settings) return;

    // MODE 1: Interval
    if (settings.mode === "interval") {
        chrome.alarms.create("water_reminder", {
            periodInMinutes: settings.intervalMinutes
        });
    }

    // MODE 2: Fixed Times
    if (settings.mode === "schedule") {
        settings.scheduleTimes.forEach(time => {
            const [h, m] = time.split(":").map(Number);
            const now = new Date();

            let target = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                h, m, 0
            ).getTime();

            if (target <= Date.now()) target += 24 * 60 * 60 * 1000; // next day

            chrome.alarms.create(`water_reminder_${time}`, {
                when: target,
                periodInMinutes: 24 * 60
            });
        });
    }
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