import { getLocalStorage, saveSettings, debounce, loadSettings } from "../../helper.js";

let viewMode = "grid"; // hoặc "list"
let deleteMode = {};
let selectedForDelete = {};
let currentEditGroupId = null;
let currentSelectedColor = null;
let selectedWindowId = 'all';
let activeDeleteGroupId = null;

// Tạo HTML cho một group (header + tab-list placeholder + actions)
function createGroupBox({ id, title, color = "#eee", count = 0, viewMode = "grid" }) {
    const box = document.createElement("div");
    box.className = "group-box";
    if (viewMode === "list") box.classList.add("list-mode");
    box.dataset.id = id;

    // Disable delete/edit cho group-1
    const deleteBtnHTML = id === "ungrouped"
        ? ""
        : '<button class="btn delete-group"><i class="fa-solid fa-trash"></i></button>';

    const editBtnHTML = id === "ungrouped"
        ? ""
        : '<button class="btn edit-group"><i class="fa-solid fa-pen"></i></button>';

    box.innerHTML = `
    <div class="group-header" style="background-color:${color} !important">
      <span class="group-title">${title} (${count})</span>
        <div class="group-header-actions">
            ${deleteBtnHTML}
            ${editBtnHTML}
        </div>
    </div>

    <div class="tab-list ${viewMode === "list" ? "list-mode" : "grid-mode"}"></div>

    <div class="actions">
      <button class="btn delete"><i class="fa-solid fa-trash"></i></button>
      <button class="btn add"><i class="fa-solid fa-add"></i></button>
    </div>
  `;

    return box;
}

// renderTabList: nhận mảng tabs và box (không tạo box ở đây)
function renderTabList(tabs, box, mode = "grid") {
    const listEl = box.querySelector(".tab-list");
    if (!listEl) {
        console.warn("Không tìm thấy .tab-list trong box:", box);
        return;
    }
    listEl.innerHTML = "";

    tabs.forEach(tab => {
        const item = document.createElement("div");
        item.className = `tab-item ${mode === "list" ? "list-mode" : "grid-mode"}`;

        if (tab.active) item.classList.add("active");

        item.dataset.url = tab.url;
        item.title = tab.title || tab.url;
        item.dataset.tabId = tab.id; // cần cho drag
        item.dataset.title = tab.title || tab.url;

        if (mode === "grid") {
            const img = document.createElement("img");
            const favicon = tab.favIconUrl || "assets/media/chrome.png";
            img.src = favicon; img.alt = tab.title || tab.url;
            img.style.width = "100%";
            img.style.height = "100%";
            item.appendChild(img);
        } else {
            const icon = document.createElement("img");
            const favicon = tab.favIconUrl || "assets/media/chrome.png";
            icon.src = favicon;
            icon.className = "list-icon";
            const shortUrl = tab.url.length > 60 ? tab.url.slice(0, 60) + "..." : tab.url;
            const urlText = document.createElement("span");
            urlText.className = "list-url-text";
            urlText.textContent = tab.title || shortUrl;
            urlText.addEventListener("click", (e) => {
                const groupId = box.dataset.id;

                if (deleteMode[groupId]) {
                    e.preventDefault();
                    e.stopPropagation();
                    item.classList.toggle("selected");

                    if (item.classList.contains("selected")) {
                        selectedForDelete[groupId].add(tab.id);
                    } else {
                        selectedForDelete[groupId].delete(tab.id);
                    }
                    return;
                }

                // mở bình thường
                chrome.tabs.update(tab.id, { active: true });
                chrome.windows.update(tab.windowId, { focused: true });
            });
            item.appendChild(icon);
            item.appendChild(urlText);
        }

        // click item mở tab (dùng capture để tránh xung đột)
        item.addEventListener("click", (e) => {
            const groupId = box.dataset.id;

            // Nếu đang delete mode group khác → chặn
            if (isAnyDeleteModeActive() && activeDeleteGroupId !== groupId) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            // Nếu đang ở delete mode → toggle chọn để xóa
            if (deleteMode[groupId]) {
                e.stopPropagation();
                e.preventDefault();
                item.classList.toggle("selected");

                if (item.classList.contains("selected")) {
                    selectedForDelete[groupId].add(tab.id);
                } else {
                    selectedForDelete[groupId].delete(tab.id);
                }
                return; // KHÔNG mở tab
            }

            // Nếu không phải delete mode → mở tab bình thường
            chrome.tabs.update(tab.id, { active: true });
            chrome.windows.update(tab.windowId, { focused: true });
        });

        listEl.appendChild(item);
    });
}

async function renderTabGroup() {
    const container = document.querySelector("#tabmanager-container .groups-container");
    container.innerHTML = "";

    const tabs = selectedWindowId === "all"
        ? await chrome.tabs.query({})
        : await chrome.tabs.query({ windowId: Number(selectedWindowId) });

    const groupsMap = {};
    const ungrouped = [];

    tabs.forEach(t => {
        if (t.groupId !== -1) {
            if (!groupsMap[t.groupId]) groupsMap[t.groupId] = [];
            groupsMap[t.groupId].push(t);
        } else {
            ungrouped.push(t);
        }
    });

    updateTabCount(tabs.length);

    // render groups có id
    for (const gid of Object.keys(groupsMap)) {
        const groupTabs = groupsMap[gid];
        let groupInfo;

        try {
            groupInfo = await chrome.tabGroups.get(Number(gid));
        } catch (err) {
            // phòng trường hợp group đã bị xóa
            groupInfo = { id: gid, title: "Group", color: "#ddd" };
        }

        const box = createGroupBox({
            id: groupInfo.id,
            title: groupInfo.title || "Group",
            color: groupInfo.color || "#ddd",
            count: groupTabs.length,
            viewMode,
            favicon: groupInfo.favIconUrl
        });

        // CSS will handle grid/list display modes automatically
        container.appendChild(box);
        renderTabList(groupTabs, box, viewMode);
    }

    // render ungrouped
    if (ungrouped.length) {
        const box = createGroupBox({
            id: "ungrouped",
            title: "Ungrouped",
            color: "#f0f2f5",
            count: ungrouped.length,
            viewMode
        });
        container.appendChild(box);
        renderTabList(ungrouped, box, viewMode);
    }

    attachGroupEvents();
    enableTabDrag();
}

// Manual resize logic is no longer needed with modern CSS layout


function openEditGroupModal(groupId, oldName, oldColor) {
    currentEditGroupId = groupId;

    const modal = document.querySelector("#tabmanager-container #edit-group-modal");
    const nameInput = document.querySelector("#tabmanager-container #edit-group-name");

    nameInput.value = oldName || "";

    // Reset color selection
    document.querySelectorAll(".color-list span").forEach(el => {
        el.classList.remove("selected");
    });

    if (oldColor) {
        const oldColorEl = document.querySelector(`.color-list span[data-color='${oldColor}']`);
        if (oldColorEl) {
            oldColorEl.classList.add("selected");
            currentSelectedColor = oldColor;
        }
    }

    modal.classList.remove("hidden");
}

async function addNewTabToGroup(groupId, url = "chrome://newtab/") {
    groupId = Number(groupId);
    const windowId = getActiveWindowId();
    const createParams = { url, active: false };
    if (windowId) createParams.windowId = windowId;

    // 1. Tạo tab mới
    const newTab = await chrome.tabs.create(createParams);

    // 2. Chờ tab được Chrome gán đầy đủ thông tin (quan trọng)
    await new Promise(resolve => setTimeout(resolve, 120));

    // 3. Group tab
    try {
        await chrome.tabs.group({
            groupId,
            tabIds: newTab.id
        });
    } catch (err) {
        console.warn("Group tab thất bại:", err);
    }

    return newTab;
}

function attachGroupEvents() {
    // ==============================
    // 1. DELETE GROUP (giữ nguyên các tab)
    // ==============================
    document.querySelectorAll("#tabmanager-container .group-header .delete-group")
        .forEach(btn => {
            btn.onclick = async () => {
                const box = btn.closest(".group-box");
                const groupId = Number(box.dataset.id);
                if (isNaN(groupId)) return;

                // ungroup ALL tabs
                chrome.tabs.query({ groupId, windowId: getActiveWindowId() }, async (tabs) => {
                    if (tabs.length > 0) {
                        await chrome.tabs.ungroup(tabs.map(t => t.id));
                    }
                    renderTabGroup();
                });
            };
        });

    // ==============================
    // 2. EDIT GROUP (modal)
    // ==============================
    document.querySelectorAll("#tabmanager-container .group-header .edit-group")
        .forEach(btn => {
            btn.onclick = async () => {
                const box = btn.closest(".group-box");
                const groupId = Number(box.dataset.id);

                const groupInfo = await chrome.tabGroups.get(groupId);
                openEditGroupModal(groupId, groupInfo.title, groupInfo.color);
            };
        });



    // ==============================
    // 3. DELETE TAB (delete mode)
    // ==============================
    document.querySelectorAll("#tabmanager-container .actions .delete")
        .forEach(btn => {
            btn.onclick = async () => {
                const box = btn.closest(".group-box");
                const groupId = box.dataset.id;

                // ===== BẬT DELETE MODE =====
                if (!deleteMode[groupId]) {
                    enterDeleteMode(groupId, box, btn);
                    return;
                }

                // ===== ĐANG DELETE MODE =====
                // Chưa chọn tab nào → thoát mode
                if (selectedForDelete[groupId].size === 0) {
                    exitDeleteMode(groupId);
                    return;
                }

                // ===== XÓA TAB =====
                const tabIdsToDelete = [...selectedForDelete[groupId]];

                if (tabIdsToDelete.length > 0) {
                    await chrome.tabs.remove(tabIdsToDelete);
                }

                exitDeleteMode(groupId);

                await new Promise(r => setTimeout(r, 120));
                renderTabGroup();
            };
        });

    // ==============================
    // 4. ADD TAB TO GROUP (tạo tab mới)
    // ==============================
    document.querySelectorAll("#tabmanager-container .actions .add")
        .forEach(btn => {
            btn.onclick = async () => {
                const box = btn.closest(".group-box");
                const groupId = box.dataset.id === "ungrouped" ? null : Number(box.dataset.id);

                if (groupId === null || groupId === "ungrouped") {
                    // ungrouped → chỉ tạo tab mới
                    const windowId = getActiveWindowId();
                    const createParams = { url: "chrome://newtab/", active: false };
                    if (windowId) createParams.windowId = windowId;
                    await chrome.tabs.create(createParams);
                } else {
                    // tạo tab mới rồi đưa vào group
                    await addNewTabToGroup(groupId);
                }

                await renderTabGroup();
            };
        });

}

function enableTabDrag() {
    const items = document.querySelectorAll("#tabmanager-container .tab-item");

    items.forEach(item => {
        item.setAttribute("draggable", true);

        item.addEventListener("dragstart", e => {
            if (isAnyDeleteModeActive()) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData("tab-id", item.dataset.tabId);
            e.dataTransfer.setData("from-group", item.closest(".group-box").dataset.id);
            item.classList.add("dragging");
        });

        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
        });
    });

    // Các danh sách tab
    const lists = document.querySelectorAll("#tabmanager-container .tab-list");

    lists.forEach(list => {
        list.addEventListener("dragover", e => e.preventDefault());

        list.addEventListener("drop", async e => {
            e.preventDefault();

            const tabId = Number(e.dataTransfer.getData("tab-id"));
            const fromGroupId = e.dataTransfer.getData("from-group");
            const toGroupId = list.closest(".group-box").dataset.id;

            if (!tabId || fromGroupId === toGroupId) return;
            const tab = await chrome.tabs.get(tabId);

            if (toGroupId !== "ungrouped") {
                const group = await chrome.tabGroups.get(Number(toGroupId));

                if (tab.windowId !== group.windowId) {
                    await chrome.tabs.move(tabId, {
                        windowId: group.windowId,
                        index: -1
                    });
                }

                await chrome.tabs.group({
                    groupId: Number(toGroupId),
                    tabIds: tabId
                });
            } else {
                await chrome.tabs.ungroup(tabId);
            }

            // === RENDER LẠI GIAO DIỆN ===
            renderTabGroup();
        });
    });
}

function highlightTabItems(keyword) {
    const items = document.querySelectorAll("#tabmanager-container .tab-item");
    const lower = keyword.trim().toLowerCase();

    items.forEach(item => {
        const title = item.dataset.title?.toLowerCase() || "";

        if (!lower) {
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

function handleSearchWebInput() {
    const input = document.querySelector("#tabmanager-container #toolbar #search-web");
    const filterText = input.value.trim();
    highlightTabItems(filterText);
}

async function loadWindowSelector() {
    const select = document.querySelector("#window-selector");
    const addBtn = document.querySelector(
        "#tabmanager-container #toolbar #open-add-group-modal"
    );

    if (!select || !addBtn) return;

    const windows = await chrome.windows.getAll();

    select.innerHTML = `<option value="all">All windows</option>`;

    windows.forEach((win, index) => {
        const opt = document.createElement("option");
        opt.value = win.id;
        opt.textContent = `Active window ${index + 1}`;
        select.appendChild(opt);
    });

    select.value = selectedWindowId ?? "all";
    addBtn.style.display = select.value === "all" ? "flex" : "none";
}

function updateTabCount(count) {
    const el = document.getElementById('tab-count');
    if (el) el.textContent = `${count} tab${count > 1 ? 's' : ''}`;
}

function isAnyDeleteModeActive() {
    return activeDeleteGroupId !== null;
}

function toggleDeleteButtons(activeGroupId) {
    document
        .querySelectorAll("#tabmanager-container .group-box")
        .forEach(box => {
            const groupId = box.dataset.id;
            const deleteBtn = box.querySelector(".actions .delete");

            if (!deleteBtn) return;

            if (activeGroupId && groupId !== String(activeGroupId)) {
                deleteBtn.disabled = true;
                deleteBtn.classList.add("disabled");
            } else {
                deleteBtn.disabled = false;
                deleteBtn.classList.remove("disabled");
            }
        });
}

function enterDeleteMode(groupId, box, btn) {
    // Nếu đang có group khác delete mode → thoát
    if (activeDeleteGroupId && activeDeleteGroupId !== groupId) {
        exitDeleteMode(activeDeleteGroupId);
    }

    activeDeleteGroupId = groupId;
    deleteMode[groupId] = true;
    selectedForDelete[groupId] = new Set();

    box.querySelector(".tab-list").classList.add("delete-mode");
    btn.classList.add("delete-mode");

    toggleDeleteButtons(groupId);
    toggleWindowSelector(false);
    disableOtherActions(true);
}

function exitDeleteMode(groupId) {
    const box = document.querySelector(`.group-box[data-id="${groupId}"]`);
    if (!box) return;

    deleteMode[groupId] = false;
    selectedForDelete[groupId] = new Set();

    box.querySelector(".tab-list").classList.remove("delete-mode");
    box.querySelector(".actions .delete")?.classList.remove("delete-mode");

    box.querySelectorAll(".tab-item.selected")
        .forEach(it => it.classList.remove("selected"));

    activeDeleteGroupId = null;

    toggleDeleteButtons(null);
    toggleWindowSelector(true);
    disableOtherActions(false);
}

function toggleWindowSelector(show) {
    const selector = document.querySelector("#window-selector");
    if (!selector) return;

    selector.disabled = show ? false : true;
}

function disableOtherActions(disabled) {
    document.querySelectorAll(
        "#toolbar button, .actions .add"
    ).forEach(el => {
        el.disabled = disabled;
    });
}

function getActiveWindowId() {
    return selectedWindowId === "all"
        ? null
        : Number(selectedWindowId);
}

function normalizeUrl(url) {
    try {
        const u = new URL(url);
        u.hash = ""; // bỏ #section
        return u.toString();
    } catch {
        return url;
    }
}

async function removeDuplicateTabs() {
    const windowId = selectedWindowId === "all"
        ? null
        : Number(selectedWindowId);

    if (activeDeleteGroupId) return; // không cho khi delete mode

    const tabs = windowId
        ? await chrome.tabs.query({ windowId })
        : await chrome.tabs.query({});

    const map = new Map(); // url -> tabId giữ lại
    const duplicateIds = [];

    tabs.forEach(tab => {
        if (!tab.url || tab.url.startsWith("chrome://")) return;

        const key = normalizeUrl(tab.url);

        if (!map.has(key)) {
            map.set(key, tab.id);
        } else {
            duplicateIds.push(tab.id);
        }
    });

    if (duplicateIds.length === 0) {
        alert("No duplicate tabs found");
        return;
    }

    await chrome.tabs.remove(duplicateIds);
    renderTabGroup();
}

// Khởi tạo
export async function initTabManager() {
    const container = document.getElementById("tabmanager-container");

    // Load giao diện
    const html = await fetch("./features/tab/tab.html").then(r => r.text());
    container.innerHTML = html;

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./features/tab/tab.css";
    document.head.appendChild(link);

    const setting = await loadSettings('setting');
    if (setting) {
        viewMode = setting.tabViewMode || "grid";
    }

    await loadWindowSelector();
    await renderTabGroup();

    document.querySelector("#window-selector").addEventListener("change", async (e) => {
        if (activeDeleteGroupId) {
            exitDeleteMode(activeDeleteGroupId);
        }

        selectedWindowId = e.target.value;
        document.querySelector("#tabmanager-container #toolbar #open-add-group-modal").style.display = e.target.value === "all"
            ? "flex"
            : "none";

        await renderTabGroup();
        handleSearchWebInput();
    });

    document.querySelectorAll(".color-list span").forEach(el => {
        el.addEventListener("click", () => {
            document.querySelectorAll(".color-list span").forEach(x => x.classList.remove("selected"));
            el.classList.add("selected");
            currentSelectedColor = el.dataset.color;
        });
    });

    // Gắn sự kiện input cho search
    const searchInput = document.querySelector("#tabmanager-container #search-web");
    if (searchInput) {
        searchInput.addEventListener("input", debounce((e) => {
            highlightTabItems(e.target.value);
        }, 300));
    }

    // Khi click "Add group" → mở modal edit, nhưng để tạo group mới
    document.querySelector("#tabmanager-container #toolbar #open-add-group-modal").onclick = () => {
        openEditGroupModal();
    };

    // Xử lý lưu modal edit group (dùng chung)
    document.querySelector("#tabmanager-container #edit-group-save").onclick = async () => {
        const newName = document.querySelector("#tabmanager-container #edit-group-name").value.trim();

        if (currentEditGroupId != null) {
            // Edit group hiện có
            await chrome.tabGroups.update(currentEditGroupId, {
                title: newName || undefined,
                color: currentSelectedColor || undefined
            });
        } else {
            // Tạo group mới: tạo 1 tab mới rỗng, sau đó group nó
            const newTab = await chrome.tabs.create({ url: "chrome://newtab/", active: false });
            const newGroup = await chrome.tabs.group({ tabIds: newTab.id });
            await chrome.tabGroups.update(newGroup, {
                title: newName || "Group",
                color: currentSelectedColor || "grey"
            });
        }

        document.querySelector("#tabmanager-container #edit-group-modal").classList.add("hidden");
        renderTabGroup();
    };

    // Hủy modal
    document.querySelector("#tabmanager-container #edit-group-cancel").onclick = () => {
        document.querySelector("#tabmanager-container #edit-group-modal").classList.add("hidden");
    };

    document.querySelector("#tabmanager-container #toolbar #delete-all-groups").onclick = async () => {
        // Lấy tất cả tab đang có group
        const windowId = getActiveWindowId();
        let tabs = null;

        if (windowId === null) {
            tabs = await chrome.tabs.query({});
        } else {
            tabs = await chrome.tabs.query({ windowId: windowId });
        }

        const groupedTabs = tabs.filter(t => t.groupId !== -1);

        if (groupedTabs.length === 0) return;

        // Ungroup tất cả tab
        await chrome.tabs.ungroup(groupedTabs.map(t => t.id));

        renderTabGroup();
    };

    document.querySelector("#tabmanager-container #toolbar #toggle-view-mode").onclick = async () => {
        viewMode = viewMode === "grid" ? "list" : "grid";
        renderTabGroup();

        await new Promise(resolve => setTimeout(resolve, 120));
        handleSearchWebInput();

        saveSettings({
            'tabViewMode': viewMode
        });
    };

    document.querySelector("#tabmanager-container #toolbar #remove-duplicate-tabs").onclick = async () => {
        if (!confirm("Remove duplicate tabs in current window?")) return;
        await removeDuplicateTabs();
    };
}
