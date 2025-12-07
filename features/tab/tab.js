import { getLocalStorage, saveSettings, debounce, loadSettings } from "../../helper.js";

let viewMode = "grid"; // hoặc "list"
let deleteMode = {};
let selectedForDelete = {};
let currentEditGroupId = null;
let currentSelectedColor = null;

// Tạo HTML cho một group (header + tab-list placeholder + actions)
function createGroupBox({ id, title, color = "#ccc", count = 0, viewMode = "grid" }) {
    const box = document.createElement("div");
    box.className = (viewMode === "list") ? "group-box list-mode" : "group-box";
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

    const tabs = await chrome.tabs.query({});
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

        container.appendChild(box);           // append trước khi render list
        renderTabList(groupTabs, box, viewMode);
    }

    // render ungrouped
    if (ungrouped.length) {
        const box = createGroupBox({
            id: "ungrouped",
            title: "Ungrouped",
            color: "#ccc",
            count: ungrouped.length,
            viewMode
        });
        container.appendChild(box);
        renderTabList(ungrouped, box, viewMode);
    }

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
    enableTabDrag();
}

function autoResizeGroupsAll() {
    document.querySelectorAll("#tabmanager-container .group-box").forEach(box => {
        autoResizeGroups(box);
    });
}

function autoResizeGroups(box) {
    const header = box.querySelector(".group-header");
    const list = box.querySelector(".tab-list");
    const actions = box.querySelector(".actions");
    const items = list.querySelectorAll(".tab-item").length;

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

    // 1. Tạo tab mới
    const newTab = await chrome.tabs.create({
        url,
        active: false
    });

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
                chrome.tabs.query({ groupId }, async (tabs) => {
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

                // Nếu chưa bật delete mode → bật
                if (!deleteMode[groupId]) {
                    deleteMode[groupId] = true;
                    selectedForDelete[groupId] = new Set();
                    box.querySelector(".tab-list").classList.add("delete-mode");
                    btn.classList.add("delete-mode");
                    return;
                }

                // Nếu bật delete mode nhưng chưa chọn gì → tắt mode
                if (selectedForDelete[groupId].size === 0) {
                    deleteMode[groupId] = false;
                    selectedForDelete[groupId] = new Set();
                    box.querySelector(".tab-list").classList.remove("delete-mode");
                    btn.classList.remove("delete-mode");
                    box.querySelectorAll(".tab-item.selected")
                        .forEach(it => it.classList.remove("selected"));
                    return;
                }

                // Xóa tabs được chọn
                const tabIdsToDelete = Array.from(selectedForDelete[groupId]);

                chrome.tabs.remove(tabIdsToDelete);

                // Reset
                deleteMode[groupId] = false;
                selectedForDelete[groupId] = new Set();
                box.querySelector(".tab-list").classList.remove("delete-mode");
                btn.classList.remove("delete-mode");

                // 2. Chờ tab được Chrome gán đầy đủ thông tin (quan trọng)
                await new Promise(resolve => setTimeout(resolve, 120));

                await renderTabGroup();
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

                if (groupId === null) {
                    // ungrouped → chỉ tạo tab mới
                    await chrome.tabs.create({ url: "chrome://newtab/", active: false });
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

            // === THAY GROUP TRÊN CHROME ===
            if (toGroupId === "ungrouped") {
                await chrome.tabs.ungroup(tabId);
            } else {
                await chrome.tabs.group({ groupId: Number(toGroupId), tabIds: tabId });
            }

            // === RENDER LẠI GIAO DIỆN ===
            renderTabGroup();
        });
    });
}

function highlightTabItems(keyword) {
    const items = document.querySelectorAll(".group-box .tab-item");
    const lower = keyword.trim().toLowerCase();

    items.forEach(item => {
        const title = item.dataset.title?.toLowerCase() || "";

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

function handleSearchWebInput() {
    const input = document.querySelector("#tabmanager-container #toolbar #search-web");
    const filterText = input.value.trim();
    highlightTabItems(filterText);
}


window.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll(".color-list span").forEach(el => {
        el.addEventListener("click", () => {
            document.querySelectorAll(".color-list span").forEach(x => x.classList.remove("selected"));
            el.classList.add("selected");
            currentSelectedColor = el.dataset.color;
        });
    });

    // Gắn sự kiện input
    document.querySelector("#tabmanager-container #toolbar #search-web").addEventListener("input", debounce(handleSearchWebInput, 500));

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
        const tabs = await chrome.tabs.query({});
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
});
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

    await renderTabGroup();
}
