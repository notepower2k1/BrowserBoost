const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

// Hiển thị Bookmark mặc định
document.getElementById("tabmanager-container").classList.remove("hidden");

// Mặc định hiển thị bookmark
tabs.forEach(tab => {
    if (tab.dataset.tab === "tabmanager") tab.classList.add("active");
});

// Lazy load module ngay khi mở popup
if (!window.tabManagerLoaded) {
    import('./features/tab/tab.js').then(module => {
        module.initTabManager();
        window.tabManagerLoaded = true;
    });
}

// Event click cho tab
tabs.forEach(tab => {
    tab.addEventListener("click", async () => {
        const target = tab.dataset.tab;

        // hide all contents
        contents.forEach(c => c.classList.add("hidden"));
        document.getElementById(target + "-container").classList.remove("hidden");

        // highlight tab
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // load module lazily
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

        // load module lazily
        if (target === "water" && !window.waterLoaded) {
            const module = await import('./features/water-reminder/water-reminder.js');
            module.initWaterReminder();
            window.waterLoaded = true;
        }
    });
});

document.querySelector('#openNoteBtn').addEventListener('click', async () => {
    if (!window.noteLoaded) {
        const module = await import('./features/note/note.js');
        module.initNote();
        window.noteLoaded = true;

        // Close popup
        window.close();
    }
});

document.querySelector("#openRecorderBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "open-record-widget" });
    window.close();
});