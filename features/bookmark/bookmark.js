import { getLocalStorage, setLocalStorage, saveSettings, debounce, loadSettings } from "../../helper.js";

// =====================
// DATA & LOCAL STORAGE
// =====================
let groups = [];

let deleteMode = {};
let selectedForDelete = {};
let viewMode = "grid"; // hoặc "list"
const keyLocal = "websiteGroups";
const dateNow = Date.now();

// ---------- Lưu trữ localStorage ----------
function saveData() {
    setLocalStorage(keyLocal, groups);
}

async function loadData() {
    let result = await getLocalStorage(keyLocal);

    if (result) {
        groups = result;
    } else {
        // khởi tạo group mặc định
        groups = [
            {
                id: "group-1",
                name: "Others",
                pinned: false,
                pinnedTime: null,
                order: 0,               // vị trí hiển thị
                toggle: true,
                websites: [
                    { url: "https://www.google.com/", shortName: "Google", addedTime: dateNow },
                ]
            },
        ];
        saveData();
    }
}

// =====================
// URL NORMALIZE
// =====================
function normalizeUrl(url) {
    return url
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, "")
        .toLowerCase();
}

// Toggle selection khi click website
// 1) toggle selection helper
function toggleDeleteSelection(groupId, websiteUrl, element) {
    if (!selectedForDelete[groupId]) selectedForDelete[groupId] = new Set();

    if (selectedForDelete[groupId].has(websiteUrl)) {
        selectedForDelete[groupId].delete(websiteUrl);
        element.classList.remove("selected");
    } else {
        selectedForDelete[groupId].add(websiteUrl);
        element.classList.add("selected");
    }
}

// =====================
// RENDER GROUPS
// =====================
async function renderGroups() {
    const container = document.querySelector("#bookmark-container .groups-container");
    container.innerHTML = "";

    // Pinned đầu tiên
    const pinned = groups.filter(g => g.pinned).sort((a, b) => b.pinnedTime - a.pinnedTime);
    const unpinned = groups.filter(g => !g.pinned);
    const allGroups = [...pinned, ...unpinned];

    allGroups.forEach(group => {
        // BOX WRAPPER
        const box = document.createElement("div");
        const totalItem = group.websites.length ?? 0;

        box.className = (viewMode === "list") ? "group-box list-mode" : "group-box";
        box.dataset.id = group.id;

        // Disable delete/edit cho group-1
        const deleteBtnHTML = group.id === "group-1"
            ? ""
            : '<button class="btn delete-group"><i class="fa-solid fa-trash"></i></button>';

        const editBtnHTML = group.id === "group-1"
            ? ""
            : '<button class="btn edit-group"><i class="fa-solid fa-pen"></i></button>';

        // HEADER
        box.innerHTML = `
            <div class="group-header">
                <span class="group-title">${group.name} (${totalItem})</span>
                <div class="group-header-actions">
                    <button class="btn pin">
                        ${group.pinned ?
                '<i class="fa-solid fa-thumbtack-slash"></i>' :
                '<i class="fa-solid fa-thumbtack"></i>'}
                    </button>

                    ${deleteBtnHTML}
                    ${editBtnHTML}

                    <button class="toggle-btn">
                        ${group.toggle ?
                '<i class="fa-solid fa-minus"></i>' :
                '<i class="fa-solid fa-plus"></i>'}
                    </button>
                </div>
            </div>

            <div class="website-list" style="display:${group.toggle ? 'flex' : 'none'};"></div>

            <div class="actions" style="display:${group.toggle ? 'flex' : 'none'};">
                <button class="btn delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="btn add">
                    <i class="fa-solid fa-add"></i>
                </button>
            </div>
        `;

        container.appendChild(box);

        // RENDER WEBSITE ITEMS
        renderWebsites(group, box, viewMode);
    });

    // GRID MODE → AUTO SIZE
    if (viewMode === "grid") {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                autoResizeGroupsAll();
            });
        });
    } else {
        // LIST MODE → FULL AUTO HEIGHT
        document.querySelectorAll(".group-box").forEach(b => {
            b.style.height = "auto";
        });
    }

    attachGroupEvents();
    enableGroupDrag();
    enableWebsiteDrag();

    setupGroupBoxContextMenu();
    setupWebItemContextMenu();
}

function autoResizeGroupsAll() {
    document.querySelectorAll("#bookmark-container .group-box").forEach(box => {
        autoResizeGroups(box);
    });
}

function autoResizeGroups(box) {
    const header = box.querySelector(".group-header");
    const list = box.querySelector(".website-list");
    const actions = box.querySelector(".actions");
    const items = list.querySelectorAll(".website-item").length;

    list.getBoundingClientRect(); // force reflow

    if (!header || !list || !actions) return;

    if (items === 0) {
        box.style.width = "300px";
        return;
    }

    const itemSize = 36 + 8; // icon + gap
    const maxRowItems = 5;

    // width mới theo số item tối đa 5 mỗi dòng
    const width = Math.min(maxRowItems, items) * itemSize + 20;
    box.style.width = width + "px";

    // 💡 FORCE BROWSER REFLOW để cập nhật offsetHeight
    void box.offsetHeight;

    // Bây giờ offsetHeight mới đúng
    const headerH = header.offsetHeight;
    const listH = list.offsetHeight;
    const actionsH = actions.offsetHeight;

    const style = getComputedStyle(box);
    const paddingTop = parseInt(style.paddingTop);
    const paddingBottom = parseInt(style.paddingBottom);
    const borderTop = parseInt(style.borderTopWidth);
    const borderBottom = parseInt(style.borderBottomWidth);

    const totalPadding = paddingTop + paddingBottom + borderTop + borderBottom;

    const totalHeight = headerH + listH + actionsH + totalPadding + 8;

    box.style.height = totalHeight + "px";
}

// Render websites cho group
function renderWebsites(group, box, mode = "grid") {
    const list = box.querySelector(".website-list");

    list.innerHTML = "";
    list.classList.add(`${mode}-mode`);

    group.websites.forEach(site => {
        // tạo wrapper div để dễ add/remove class 'selected'
        const item = document.createElement("div");
        item.className = "website-item";
        item.dataset.url = site.url;
        item.dataset.shortName = site.shortName || site.url;
        item.title = site.shortName || site.url;

        if (mode === "grid") {
            item.classList.add("grid-mode");
            // inner img
            const img = document.createElement("img");
            img.src = `https://www.google.com/s2/favicons?domain=${site.url}&sz=32`;
            img.alt = site.shortName || site.url;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.display = "block";
            item.appendChild(img);

            // click: mở link hoặc toggle delete selection
            item.addEventListener("click", (e) => {
                const groupId = box.dataset.id;
                if (deleteMode[groupId]) {
                    e.preventDefault();
                    toggleDeleteSelection(groupId, site.url, item);
                    return;
                }
                window.open(site.url, "_blank");
            });

        } else { // list mode
            // LIST MODE
            item.classList.add("list-mode");

            // Favicon
            const icon = document.createElement("img");
            icon.src = `https://www.google.com/s2/favicons?domain=${site.url}&sz=32`;
            icon.alt = site.shortName || site.url;
            icon.className = "list-icon";

            // URL rút gọn + clickable
            const shortUrl = site.url.length > 60 ? site.url.slice(0, 60) + "..." : site.url;

            const urlText = document.createElement("span");
            urlText.className = "list-url-text";
            urlText.textContent = site.shortName || shortUrl;;

            // Click mở website nếu không ở delete mode
            urlText.addEventListener("click", (e) => {
                const groupId = box.dataset.id;

                // Nếu đang delete mode thì không mở link, chỉ toggle chọn
                if (deleteMode[groupId]) {
                    e.preventDefault();
                    toggleDeleteSelection(groupId, site.url, item);
                    return;
                }

                // Mở link
                window.open(site.url, "_blank");
            });

            // Append vào item
            item.appendChild(icon);
            item.appendChild(urlText);

            // CLICK trên toàn item để toggle trong delete-mode
            item.addEventListener("click", (e) => {
                const groupId = box.dataset.id;

                if (deleteMode[groupId]) {
                    e.preventDefault();
                    toggleDeleteSelection(groupId, site.url, item);
                }
            });
        }

        list.appendChild(item);
    });
}
// =====================
// GROUP EVENTS
// =====================
function attachGroupEvents() {
    // Toggle show/hide
    document.querySelectorAll("#bookmark-container .group-header .toggle-btn").forEach(btn => {
        btn.onclick = () => {
            const box = btn.closest(".group-box");
            const group = groups.find(g => g.id === box.dataset.id);
            group.toggle = !group.toggle;

            const list = box.querySelector(".website-list");
            const actions = box.querySelector(".actions");
            list.style.display = group.toggle ? "flex" : "none";
            actions.style.display = group.toggle ? "flex" : "none";
            btn.innerHTML = group.toggle
                ? '<i class="fa-solid fa-minus"></i>'
                : '<i class="fa-solid fa-plus"></i>';

            saveData();
            autoResizeGroups(box);
        };
    });

    // Pin/unpin
    document.querySelectorAll("#bookmark-container .group-header .pin").forEach(btn => {
        btn.onclick = () => {
            const box = btn.closest(".group-box");
            const group = groups.find(g => g.id === box.dataset.id);
            group.pinned = !group.pinned;
            group.pinnedTime = group.pinned ? Date.now() : null;
            saveData();
            renderGroups();
        };
    });

    // Rename
    document.querySelectorAll("#bookmark-container .group-header .edit-group").forEach(btn => {
        btn.onclick = () => {
            const box = btn.closest(".group-box");
            const group = groups.find(g => g.id === box.dataset.id);
            const newName = prompt("Nhập tên mới cho group:", group.name);
            if (!newName) return;
            group.name = newName;
            saveData();
            const boxTitle = box.querySelector(".group-title");
            boxTitle.textContent = group.name;
        };
    });

    // Delete group
    document.querySelectorAll("#bookmark-container.group-header .delete-group").forEach(btn => {
        btn.onclick = () => {
            const box = btn.closest(".group-box");
            const index = groups.findIndex(g => g.id === box.dataset.id);
            if (index === -1) return;
            if (!confirm(`Delete "${groups[index].name}"?`)) return;
            groups.splice(index, 1);
            saveData();
            renderGroups();
        };
    });

    // Delete website
    document.querySelectorAll("#bookmark-container .actions .delete").forEach(btn => {
        btn.onclick = () => {
            const box = btn.closest(".group-box");
            const groupId = box.dataset.id;
            const groupIndex = groups.findIndex(g => g.id === groupId);
            if (groupIndex === -1) return;

            const group = groups[groupIndex];

            // Bật delete mode (chưa chọn gì)
            if (!deleteMode[groupId]) {
                deleteMode[groupId] = true;
                selectedForDelete[groupId] = new Set();
                box.querySelector(".website-list").classList.add("delete-mode");
                btn.classList.add("delete-mode");
                return;
            }

            // Nếu đang bật nhưng chưa chọn gì -> tắt chế độ delete
            if (selectedForDelete[groupId].size === 0) {
                deleteMode[groupId] = false;
                selectedForDelete[groupId] = new Set();
                box.querySelector(".website-list").classList.remove("delete-mode");
                btn.classList.remove("delete-mode");
                // clear any residual .selected classes
                box.querySelectorAll(".website-item.selected").forEach(it => it.classList.remove("selected"));
                return;
            }

            // Xóa các website được chọn (dựa trên url)
            group.websites = group.websites.filter(w => !selectedForDelete[groupId].has(w.url));

            // Nếu group không còn website nào, xóa luôn group (trừ group-1)
            if (group.websites.length === 0 && group.id !== "group-1") {
                groups.splice(groupIndex, 1); // xóa group khỏi mảng
            };

            saveData();

            // Reset state
            deleteMode[groupId] = false;
            selectedForDelete[groupId] = new Set();
            box.querySelector(".website-list").classList.remove("delete-mode");
            btn.classList.remove("delete-mode");

            renderGroups();
        };
    });

    // Add website button
    document.querySelectorAll("#bookmark-container .actions .add").forEach(btn => {
        btn.onclick = () => {
            const box = btn.closest(".group-box");
            openAddModal(box.dataset.id); // truyền id nhóm
        };
    });
}

// =====================
// Drag & Drop reorder group
// =====================

function enableGroupDrag() {
    const boxes = document.querySelectorAll("#bookmark-container .group-box");
    let dragSrcEl = null;

    boxes.forEach(box => {
        box.setAttribute("draggable", true);

        box.ondragstart = e => {
            dragSrcEl = box;
            e.dataTransfer.effectAllowed = "move";
            box.classList.add("dragging");
        };

        box.ondragover = e => e.preventDefault();
        box.ondragenter = () => box.classList.add("over");
        box.ondragleave = () => box.classList.remove("over");

        box.ondrop = e => {
            e.stopPropagation();
            if (dragSrcEl === box) return;

            const fromGroup = groups.find(g => g.id === dragSrcEl.dataset.id);
            const toGroup = groups.find(g => g.id === box.dataset.id);

            // Chỉ reorder group chưa pin
            if (fromGroup.pinned || toGroup.pinned) return;

            // Lấy mảng unpinned theo order
            const unpinned = groups.filter(g => !g.pinned).sort((a, b) => a.order - b.order);

            const fromIndex = unpinned.findIndex(g => g.id === fromGroup.id);
            const toIndex = unpinned.findIndex(g => g.id === toGroup.id);

            // reorder
            const [moved] = unpinned.splice(fromIndex, 1);
            unpinned.splice(toIndex, 0, moved);

            // cập nhật order mới
            unpinned.forEach((g, i) => g.order = i);

            // gộp pinned + unpinned
            const pinned = groups.filter(g => g.pinned);
            groups = [...pinned, ...unpinned];

            saveData();
            renderGroups();
            return false;
        };

        box.ondragend = () => {
            boxes.forEach(b => b.classList.remove("dragging", "over"));
        };
    });
}

function enableWebsiteDrag() {
    const items = document.querySelectorAll(".website-item");

    items.forEach(item => {
        item.setAttribute("draggable", true);

        item.addEventListener("dragstart", e => {
            e.dataTransfer.setData("text/plain", item.dataset.url);
            e.dataTransfer.setData("text/group-id", item.closest(".group-box").dataset.id);
            item.classList.add("dragging");
        });

        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
        });
    });

    // Drop vào website-list
    const lists = document.querySelectorAll(".website-list");
    lists.forEach(list => {
        list.addEventListener("dragover", e => e.preventDefault());
        list.addEventListener("drop", e => {
            e.preventDefault();

            const url = e.dataTransfer.getData("text/plain");
            const fromGroupId = e.dataTransfer.getData("text/group-id");
            const toGroupId = list.closest(".group-box").dataset.id;

            if (fromGroupId === toGroupId) return;

            // DOM update
            const draggingItem = document.querySelector(`.website-item[data-url='${url}']`);
            if (draggingItem) {       // <-- kiểm tra trước
                list.appendChild(draggingItem);
                // cập nhật data
                const fromGroup = groups.find(g => g.id === fromGroupId);
                const toGroup = groups.find(g => g.id === toGroupId);
                const index = fromGroup.websites.findIndex(w => w.url === url);
                if (index !== -1) {
                    const [websiteData] = fromGroup.websites.splice(index, 1);
                    toGroup.websites.push(websiteData);
                    saveData();
                    renderGroups();
                }
            }
        });
    });
}

// =====================
// MODAL ADD GROUP
// =====================

function renderGroupSelect() {
    const select = document.querySelector("#bookmark-container #group-select");
    if (!select) return;
    select.innerHTML = "";

    groups.forEach(group => {
        const opt = document.createElement("option");
        opt.value = group.id;     // value là id
        opt.textContent = group.name; // hiển thị tên
        select.appendChild(opt);
    });
}


function openAddModal(defaultGroupId, inputValue = '', shortNameInputValue = '') {
    const modal = document.querySelector("#bookmark-container #add-modal");
    const input = document.querySelector("#bookmark-container #add-url-input");
    const shortNameInput = document.querySelector("#bookmark-container #short-name-input");
    const select = document.querySelector("#bookmark-container #group-select");
    const confirm = document.querySelector("#bookmark-container #confirm-add");
    const cancel = document.querySelector("#bookmark-container #cancel-add");

    // Mở modal
    modal.classList.remove("hidden");
    input.value = inputValue ? inputValue : "";
    shortNameInput.value = shortNameInputValue ? shortNameInputValue : "";
    input.focus();

    // Render dropdown group
    renderGroupSelect();

    // Set default group
    let defaultGroup = groups.find(g => g.id === defaultGroupId);
    if (!defaultGroup) defaultGroup = groups[0];
    if (defaultGroup) select.value = defaultGroup.id;

    function handleUrlInput() {
        let url = input.value.trim();
        if (!url) return;
        if (!url.startsWith("http")) url = "https://" + url;

        try {
            const urlObj = new URL(url);
            const websiteName = urlObj.hostname.replace("www.", "");
            shortNameInput.value = websiteName;
        } catch (err) {
            // URL không hợp lệ, có thể clear shortNameInput hoặc để trống
            shortNameInput.value = "";
        }
    }

    // Gắn sự kiện input
    input.addEventListener("input", debounce(handleUrlInput, 500));

    // Xác nhận thêm website
    confirm.onclick = () => {
        let url = input.value.trim();
        if (!url) return;
        if (!url.startsWith("http")) url = "https://" + url;

        const selectedId = select.value;
        const group = groups.find(g => g.id === selectedId);
        if (!group) return alert("Group is not existed!");

        // Kiểm tra trùng URL
        if (group.websites.some(u => normalizeUrl(u.url) === normalizeUrl(url))) {
            alert("Website is existed!");
            return;
        }

        // Thêm website
        group.websites.push({
            url,
            shortName: shortNameInput.value.trim(),
            addedTime: Date.now()// số milliseconds
        });

        saveData();
        modal.classList.add("hidden");
        renderGroups();
    };

    // Hủy modal
    cancel.onclick = () => modal.classList.add("hidden");
}

function highlightWebsiteItems(keyword) {
    const items = document.querySelectorAll(".group-box .website-item");

    const lower = keyword.trim().toLowerCase();

    items.forEach(item => {
        const title = item.dataset.shortName?.toLowerCase() || "";
        console.log(title);
        console.log(lower);

        if (!lower) {
            // reset highlight
            item.classList.remove("highlight");
            return;
        }

        if (title.includes(lower)) {
            item.classList.add("highlight");
        } else {
            item.classList.remove("highlight");
        }
    });
}

function setupGroupBoxContextMenu() {
    let currentGroup = null;
    const modal = document.querySelector('#group-action-modal');
    const btnOpenAllTabs = modal.querySelector('#open-all-tabs');
    const btnOpenAllNewWindow = modal.querySelector('#open-all-new-window');
    const btnOpenIncognito = modal.querySelector('#open-incognito');
    const btnClose = modal.querySelector('#close-modal');

    document.querySelectorAll("#bookmark-container .group-box").forEach(group => {
        group.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            // Chỉ mở group modal nếu click trực tiếp vào group-box, không phải website-item
            if (e.target.closest('.website-item')) return;

            currentGroup = this.dataset.id; // hoặc lưu element
            modal.classList.remove('hidden');
        });
    });

    // Đóng modal
    btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
        currentGroup = null;
    });

    // Mở tất cả URL trong tab hiện tại
    btnOpenAllTabs.addEventListener('click', () => {
        if (!currentGroup) return;
        openGroup(currentGroup, false, 'current');
        modal.classList.add('hidden');
    });

    // Mở tất cả URL trong window mới
    btnOpenAllNewWindow.addEventListener('click', () => {
        if (!currentGroup) return;
        openGroup(currentGroup, false, 'new');
        modal.classList.add('hidden');
    });

    // Mở tất cả URL trong incognito
    btnOpenIncognito.addEventListener('click', () => {
        if (!currentGroup) return;
        openGroup(currentGroup, true, 'new');
        modal.classList.add('hidden');
    });
}

function openGroup(groupId, incognito = false, targetWindow = 'current') {
    const index = groups.findIndex(g => g.id === groupId);
    if (index === -1) return;

    const allWebsites = groups[index].websites || [];
    if (!allWebsites.length) return;

    const urls = allWebsites.map(w => w.url);

    if (targetWindow === 'current') {
        if (incognito) {
            // không thể mở tab incognito trong window hiện tại → mở trong cửa sổ mới
            chrome.windows.create({ url: urls, incognito: true });
        } else {
            // mở từng tab trong window hiện tại
            urls.forEach(url => chrome.tabs.create({ url, active: false }));
        }
    } else if (targetWindow === 'new') {
        chrome.windows.create({ url: urls, incognito }); // incognito = true/false
    }
}

function setupWebItemContextMenu() {
    let currentWebsiteUrl = null;

    const modalOverlay = document.querySelector('#website-action-modal');
    const btnOpenTab = modalOverlay.querySelector('#open-tab');
    const btnOpenWindow = modalOverlay.querySelector('#open-window');
    const btnOpenIncognito = modalOverlay.querySelector('#open-incognito');
    const btnCloseWebsiteModal = modalOverlay.querySelector('#close-website-modal');

    // Click phải vào website-item
    document.querySelectorAll(".website-item").forEach(item => {
        item.addEventListener('contextmenu', function (e) {
            e.preventDefault(); // chặn menu chuột phải mặc định
            e.stopPropagation(); // <--- ngăn event “bong bóng” lên group-box

            currentWebsiteUrl = this.dataset.url;
            modalOverlay.classList.remove('hidden');
        });
    });

    // Click ngoài modal hoặc nút Cancel → đóng modal
    btnCloseWebsiteModal.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        currentWebsiteUrl = null;
    });

    // Open in new tab
    btnOpenTab.addEventListener('click', () => {
        if (!currentWebsiteUrl) return;
        chrome.tabs.create({ url: currentWebsiteUrl });
        modalOverlay.classList.add('hidden');
    });

    // Open in new window
    btnOpenWindow.addEventListener('click', () => {
        if (!currentWebsiteUrl) return;
        chrome.windows.create({ url: currentWebsiteUrl, incognito: false });
        modalOverlay.classList.add('hidden');
    });

    // Open in incognito window
    btnOpenIncognito.addEventListener('click', () => {
        if (!currentWebsiteUrl) return;
        chrome.windows.create({ url: currentWebsiteUrl, incognito: true });
        modalOverlay.classList.add('hidden');
    });
}

function handleSearchWebInput() {
    const input = document.querySelector("#bookmark-container #toolbar #search-web");
    const filterText = input.value.trim();
    highlightWebsiteItems(filterText);
}


export async function initBookmark() {
    const container = document.getElementById("bookmark-container");

    // Load giao diện
    const html = await fetch("./features/bookmark/bookmark.html").then(r => r.text());
    container.innerHTML = html;

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./features/bookmark/bookmark.css";
    document.head.appendChild(link);

    const setting = await loadSettings('setting');

    if (setting) {
        viewMode = setting.bookMarkViewMode || "grid";
    }

    await loadData();
    await renderGroups();



    // Mở modal thêm group
    document.querySelector("#bookmark-container #open-add-group-modal").onclick = () => {
        const modal = document.querySelector("#bookmark-container #add-group-modal");
        const input = document.querySelector("#bookmark-container #new-group-name");
        modal.classList.remove("hidden");
        input.value = "";
        input.focus();
    };

    // Xác nhận thêm group
    document.querySelector("#bookmark-container #confirm-add-group").onclick = () => {
        const input = document.querySelector("#bookmark-container #new-group-name");
        const name = input.value.trim();
        if (!name) return alert("Group name not empty!");

        // Kiểm tra trùng tên
        if (groups.some(g => g.name === name)) {
            return alert("Group is existed!");
        }

        // Tạo group mới
        const newGroup = {
            id: "group-" + Date.now(), // id duy nhất
            name: name,
            pinned: false,
            pinnedTime: null,
            toggle: true,
            websites: []
        };

        groups.push(newGroup);
        saveData();
        renderGroups();

        // Ẩn modal
        document.querySelector("#bookmark-container #add-group-modal").classList.add("hidden");
    };

    // Hủy thêm group
    document.querySelector("#bookmark-container #cancel-add-group").onclick = () => {
        document.querySelector("#bookmark-container #add-group-modal").classList.add("hidden");
    };

    document.querySelector("#bookmark-container #delete-all-groups").onclick = () => {
        // Confirm
        if (!confirm("Delete all groups?")) return;

        groups = [];
        deletelocalStorage(keyLocal);
        renderGroups();
    };

    // Gắn sự kiện input
    document.querySelector("#bookmark-container #toolbar #search-web").addEventListener("input", debounce(handleSearchWebInput, 500));

    document.querySelector("#bookmark-container #toolbar #toggle-view-mode").onclick = async () => {
        viewMode = viewMode === "grid" ? "list" : "grid";
        renderGroups();

        await new Promise(resolve => setTimeout(resolve, 120));
        handleSearchWebInput();
        saveSettings({
            'bookMarkViewMode': viewMode
        });
    };


    document.querySelector("#bookmark-container #toolbar #book-mark-current-web").onclick = () => {
        // chrome.tabs.query cần permissions ["tabs"]
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab) return;

            const url = tab.url || '';
            const title = tab.title || '';

            // Gọi hàm mở modal, điền giá trị URL + short name
            openAddModal('group-1', url, title);
        });
    }
}