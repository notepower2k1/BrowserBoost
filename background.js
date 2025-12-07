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

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "water_reminder") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "assets/media/chrome.png",
            title: "Đến giờ uống nước 💧",
            message: "Uống nước đi nào, tốt cho sức khoẻ!",
            priority: 2
        });
    }
});

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