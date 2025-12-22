import { loadSettings, saveSettings } from "../../helper.js";

let viewMode = "grid";
let currentVisibleSites = [];
let currentWebsiteUrl = null;
let deleteMode = false;
let selectedWebsiteIds = new Set();

async function loadFolderOptions(select) {
    chrome.bookmarks.getTree(async tree => {
        const root = tree[0];

        // reset select, giữ All Bookmarks
        select.innerHTML = `<option value="all">All Bookmarks</option>`;
        function walk(node) {
            if (!node.children) return;

            node.children.forEach(child => {
                if (child.children && child.title) {
                    select.insertAdjacentHTML(
                        "beforeend",
                        `<option value="${child.id}">${child.title}</option>`
                    );
                    walk(child);
                }
            });
        }

        walk(root);

        const { lastBookmarkFolder } = await chrome.storage.local.get('lastBookmarkFolder');
        select.value = lastBookmarkFolder || 'all';
    });
}

function loadAllBookmarks(container) {
    chrome.bookmarks.getTree(tree => {
        const sites = [];

        function collect(node) {
            if (node.url) sites.push(node);
            if (node.children) node.children.forEach(collect);
        }

        collect(tree[0]);
        renderSites(sites, container);
        updateFolderCount(sites.length);
    });
}

function loadFolder(folderId, container) {
    container.innerHTML = '';
    currentVisibleSites = [];

    if (folderId === 'all') {
        chrome.bookmarks.getTree(tree => {
            const sites = [];

            function walk(node) {
                if (node.url) sites.push(node);
                if (node.children) node.children.forEach(walk);
            }

            walk(tree[0]);
            renderSites(sites, container);
            updateFolderCount(sites.length);
        });
        return;
    }

    chrome.bookmarks.getSubTree(folderId, nodes => {
        const sites = (nodes[0].children || []).filter(n => n.url);
        renderSites(sites, container);
        updateFolderCount(sites.length);
    });
}

function renderSites(sites, container) {
    container.innerHTML = "";
    currentVisibleSites = sites;

    sites.forEach(site => {
        const item = document.createElement("div");
        item.className = "website-item";

        item.dataset.id = site.id;
        item.dataset.title = (site.title || site.url).toLowerCase();
        item.dataset.url = site.url;

        item.innerHTML = `
            <img src="https://www.google.com/s2/favicons?domain=${site.url}&sz=32">
            <span class="website-title">${site.title || site.url}</span>
        `;

        item.onclick = () => {
            if (deleteMode) {
                toggleSelectItem(item);
            } else {
                chrome.tabs.create({ url: site.url });
            }
        };

        container.appendChild(item);
    });

    setupWebItemContextMenu(); // gắn lại event
}

function setupBookmarkListContextMenu(folderSelect, container) {
    const list = document.getElementById('bookmark-list');
    const modal = document.getElementById('folder-action-modal');

    const btnOpenAllTabs = modal.querySelector('#open-all-tabs');
    const btnOpenAllNewWindow = modal.querySelector('#open-all-new-window');
    const btnOpenIncognito = modal.querySelector('#open-incognito');
    const btnClose = modal.querySelector('#close-modal');
    const btnDelete = modal.querySelector('#delete-folder');

    list.addEventListener('contextmenu', e => {
        if (e.target.closest('.website-item')) return;
        e.preventDefault();
        if (folderSelect.value === 'all') return;
        modal.classList.remove('hidden');
    });

    btnClose.onclick = () => modal.classList.add('hidden');

    btnOpenAllTabs.onclick = () => {
        openSites(currentVisibleSites, false, 'current');
        modal.classList.add('hidden');
    };

    btnOpenAllNewWindow.onclick = () => {
        openSites(currentVisibleSites, false, 'new');
        modal.classList.add('hidden');
    };

    btnOpenIncognito.onclick = () => {
        openSites(currentVisibleSites, true, 'new');
        modal.classList.add('hidden');
    };

    btnDelete.onclick = async () => {
        const folderId = folderSelect.value;
        if (!folderId || folderId === 'all') return;

        chrome.bookmarks.removeTree(folderId, async () => {
            modal.classList.add('hidden');

            // Reload folder list
            await loadFolderOptions(folderSelect);

            // Reset view
            folderSelect.value = 'all';
            loadAllBookmarks(container);
        });
    };
}

function openSites(sites, incognito = false, targetWindow = 'current') {
    if (!sites || !sites.length) return;

    const urls = sites.map(s => s.url);

    if (targetWindow === 'current') {
        if (incognito) {
            chrome.windows.create({ url: urls, incognito: true });
        } else {
            urls.forEach(url => chrome.tabs.create({ url, active: false }));
        }
    } else {
        chrome.windows.create({ url: urls, incognito });
    }
}

function setupWebItemContextMenu() {
    let currentItem = null;
    let currentBookmarkId = null;

    const modal = document.getElementById('website-action-modal');

    const btnDelete = modal.querySelector('#delete-website');
    const btnOpenTab = modal.querySelector('#open-tab');
    const btnOpenWindow = modal.querySelector('#open-window');
    const btnOpenIncognito = modal.querySelector('#open-incognito');
    const btnClose = modal.querySelector('#close-website-modal');

    document.querySelectorAll('.website-item').forEach(item => {
        item.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            currentWebsiteUrl = item.dataset.url;
            currentItem = item;
            currentBookmarkId = item.dataset.id;
            modal.classList.remove('hidden');
        };
    });

    btnClose.onclick = () => {
        modal.classList.add('hidden');
        currentWebsiteUrl = null;
    };

    btnOpenTab.onclick = () => {
        chrome.tabs.create({ url: currentWebsiteUrl });
        modal.classList.add('hidden');
    };

    btnOpenWindow.onclick = () => {
        chrome.windows.create({ url: currentWebsiteUrl });
        modal.classList.add('hidden');
    };

    btnOpenIncognito.onclick = () => {
        chrome.windows.create({ url: currentWebsiteUrl, incognito: true });
        modal.classList.add('hidden');
    };

    btnDelete.onclick = () => {
        if (!currentBookmarkId) return;

        chrome.bookmarks.remove(currentBookmarkId, () => {
            // Xóa khỏi DOM
            currentItem.remove();

            // Xóa khỏi currentVisibleSites
            currentVisibleSites = currentVisibleSites.filter(
                s => s.id !== currentBookmarkId
            );

            updateFolderCount(currentVisibleSites.length);
            modal.classList.add('hidden');
        });
    };

}

function updateFolderCount(count) {
    const el = document.getElementById('folder-count');
    if (el) el.textContent = `${count} site${count > 1 ? 's' : ''}`;
}

function populateFolderSelect(selectEl, includeAll = false) {
    chrome.bookmarks.getTree(tree => {
        const root = tree[0];
        selectEl.innerHTML = includeAll
            ? `<option value="all">All Bookmarks</option>`
            : '';

        function walk(node, level = 0) {
            if (!node.children) return;

            node.children.forEach(child => {
                if (child.children && child.title) {
                    selectEl.insertAdjacentHTML(
                        'beforeend',
                        `<option value="${child.id}">
                            ${'— '.repeat(level)}${child.title}
                        </option>`
                    );
                    walk(child, level + 1);
                }
            });
        }

        walk(root);
    });
}

function setupAddFolderModal(mainFolderSelect) {
    const modal = document.getElementById('add-folder-modal');
    const input = document.getElementById('new-folder-name');
    const btnConfirm = document.getElementById('confirm-add-folder');
    const btnCancel = document.getElementById('cancel-add-folder');

    btnConfirm.onclick = async () => {
        const name = input.value.trim();
        if (!name) return;

        let parentId = mainFolderSelect.value;

        if (parentId === 'all') {
            const tree = await chrome.bookmarks.getTree();
            parentId = tree[0].children[0].id; // Bookmarks Bar
        }

        chrome.bookmarks.create({ parentId, title: name }, () => {
            modal.classList.add('hidden');
            input.value = '';
            loadFolderOptions(mainFolderSelect);
        });
    };

    btnCancel.onclick = () => {
        modal.classList.add('hidden');
        input.value = '';
    };
}

function setupRenameFolderModal(mainFolderSelect) {
    const modal = document.getElementById('rename-modal');
    const folderSelect = document.getElementById('folder-select');
    const input = document.getElementById('new-folder-name-input');
    const btnConfirm = document.getElementById('confirm-rename');
    const btnCancel = document.getElementById('cancel-rename');

    // Mở modal rename
    document.getElementById('open-rename-folder-modal').onclick = () => {
        modal.classList.remove('hidden');
        populateFolderSelect(folderSelect);
    };

    btnConfirm.onclick = () => {
        const folderId = folderSelect.value;
        const newName = input.value.trim();

        if (!folderId || !newName) return;

        chrome.bookmarks.update(folderId, { title: newName }, () => {
            modal.classList.add('hidden');
            input.value = '';
            loadFolderOptions(mainFolderSelect);
        });
    };

    btnCancel.onclick = () => {
        modal.classList.add('hidden');
        input.value = '';
    };
}

function toggleSelectItem(item) {
    const id = item.dataset.id;

    if (selectedWebsiteIds.has(id)) {
        selectedWebsiteIds.delete(id);
        item.classList.remove('selected');
    } else {
        selectedWebsiteIds.add(id);
        item.classList.add('selected');
    }
}

function setupDeleteModeButton(container) {
    const btn = document.getElementById('delete-multiple-web');

    btn.onclick = () => {
        // BẬT DELETE MODE
        if (!deleteMode) {
            deleteMode = true;
            selectedWebsiteIds.clear();
            btn.classList.add('active');
            return;
        }

        // CONFIRM DELETE
        if (!selectedWebsiteIds.size) {
            exitDeleteMode(btn);
            return;
        }

        const ids = [...selectedWebsiteIds];
        let done = 0;

        ids.forEach(id => {
            chrome.bookmarks.remove(id, () => {
                done++;
                if (done === ids.length) {
                    // Xóa khỏi UI
                    document
                        .querySelectorAll('.website-item.selected')
                        .forEach(el => el.remove());

                    currentVisibleSites = currentVisibleSites.filter(
                        s => !selectedWebsiteIds.has(s.id)
                    );

                    updateFolderCount(currentVisibleSites.length);
                    exitDeleteMode(btn);
                }
            });
        });
    };
}

function exitDeleteMode(btn) {
    deleteMode = false;
    selectedWebsiteIds.clear();

    document
        .querySelectorAll('.website-item.selected')
        .forEach(el => el.classList.remove('selected'));

    btn.classList.remove('active');
}

export async function initBookmark() {
    const root = document.getElementById("bookmark-container");

    // Load HTML
    root.innerHTML = await fetch("./features/bookmark/bookmark.html").then(r => r.text());

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./features/bookmark/bookmark.css";
    document.head.appendChild(link);

    // Load setting
    const setting = await loadSettings("setting");
    viewMode = setting?.bookMarkViewMode || "grid";

    const { lastBookmarkFolder } = await chrome.storage.local.get('lastBookmarkFolder');

    const folderSelect = document.getElementById("bookmark-folder-select");
    const listContainer = document.getElementById("bookmark-list");
    const toggleBtn = document.getElementById("toggle-view");

    listContainer.className = viewMode;

    toggleBtn.onclick = () => {
        viewMode = viewMode === "grid" ? "list" : "grid";
        listContainer.className = viewMode;
        saveSettings({
            'bookMarkViewMode': viewMode
        });
    };

    document.getElementById("search-input").addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll(".website-item").forEach(item => {
            item.style.display = item.dataset.title.includes(q) ? "" : "none";
        });
    });

    document.getElementById('open-add-folder-modal').onclick = () => {
        document.getElementById('add-folder-modal').classList.remove('hidden');
    };

    document.getElementById('more-action').onclick = () => {
        if (folderSelect.value === 'all') return;
        document
            .getElementById('folder-action-modal')
            .classList.remove('hidden');
    };

    folderSelect.onchange = () => {
        const value = folderSelect.value;
        chrome.storage.local.set({ lastBookmarkFolder: value });

        if (value === "all") {
            loadAllBookmarks(listContainer);
        } else {
            loadFolder(value, listContainer);
        }
    };

    // init
    loadFolderOptions(folderSelect);
    if (!lastBookmarkFolder) {
        loadAllBookmarks(listContainer);
    } else {
        loadFolder(lastBookmarkFolder, listContainer);
    }
    setupAddFolderModal(folderSelect);
    setupRenameFolderModal(folderSelect);
    setupBookmarkListContextMenu(folderSelect, listContainer);
    setupDeleteModeButton(listContainer);
}
