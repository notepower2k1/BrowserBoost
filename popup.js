import { saveSettings, loadSettings } from "./helper.js";

const BLOCKED_HOSTS = [
    "youtube.com",
    "google.com",
    "mail.google.com",
    "keep.google.com",
    "facebook.com",
    "twitter.com",
    "instagram.com"
];

const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

/* ===============================
   Restore last active tab
================================ */
async function restoreLastTab() {
    const settings = await loadSettings();
    const activeTab = settings.activePopupTab || "tabmanager";

    // show content
    contents.forEach(c => {
        c.classList.add("hidden");
        c.classList.remove("active");
    });

    const targetEl = document.getElementById(activeTab + "-container");
    if (targetEl) {
        targetEl.classList.remove("hidden");
        // Force reflow to ensure animation triggers
        void targetEl.offsetWidth;
        targetEl.classList.add("active");
    }

    // highlight tab
    tabs.forEach(t => t.classList.remove("active"));
    tabs.forEach(tab => {
        if (tab.dataset.tab === activeTab) {
            tab.classList.add("active");
        }
    });

    // lazy load đúng module
    await loadModule(activeTab);
}

/* ===============================
   Lazy load module
================================ */
async function loadModule(target) {
    if (target === "bookmark" && !window.bookmarkLoaded) {
        const module = await import('./features/bookmark/bookmark.js');
        module.initBookmark();
        window.bookmarkLoaded = true;
    }

    if (target === "tabmanager" && !window.tabManagerLoaded) {
        const module = await import('./features/tab/tab.js');
        module.initTabManager();
        window.tabManagerLoaded = true;
    }

    if (target === "water" && !window.waterLoaded) {
        const module = await import('./features/water-reminder/water-reminder.js');
        module.initWaterReminder();
        window.waterLoaded = true;
    }

    if (target === "eye-relax" && !window.eyeLoaded) {
        const module = await import('./features/eye-relax/eye-settings.js');
        module.initEyeRelax();
        window.eyeLoaded = true;
    }

    if (target === "clipboard" && !window.clipboardLoaded) {
        const module = await import('./features/clipboard/clipboard.js');
        module.initClipboard();
        window.clipboardLoaded = true;
    }

    if (target === "quick-command" && !window.quickCommandLoaded) {
        const module = await import('./features/quick-command/quick-command.js');
        module.initQuickCommand();
        window.quickCommandLoaded = true;
    }
}

/* ===============================
   Tab click handler
================================ */
tabs.forEach(tab => {
    tab.addEventListener("click", async () => {
        const target = tab.dataset.tab;

        contents.forEach(c => {
            c.classList.remove("active");
            c.classList.add("hidden");
        });

        const targetEl = document.getElementById(target + "-container");
        console.log(targetEl);

        targetEl.classList.remove("hidden");

        void targetEl.offsetWidth;
        targetEl.classList.add("active");

        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        saveSettings({ activePopupTab: target });

        // lazy load module
        await loadModule(target);
    });
});

/* ===============================
   Note button
================================ */
document.querySelector('#openNoteBtn').addEventListener('click', async () => {
    if (!window.noteLoaded) {
        const module = await import('./features/note/note.js');
        module.initNote();
        window.noteLoaded = true;
    }
});

/* ===============================
   Recorder
================================ */
document.querySelector("#openRecorderBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: "open-record-widget" });
});

/* ===============================
   Sticky Note
================================ */
document.querySelector("#addStickyBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
        await chrome.tabs.sendMessage(tab.id, { action: "create-sticky-note" });
    } catch (e) {
        console.error("Error sending message:", e);
        alert('You can not use sticky notes on this page! Please refresh and try again.');
    }
});

/* ===============================
   INIT popup
================================ */
restoreLastTab();
