export async function initQuickCommand() {
    const container = document.getElementById("quick-command-container");
    if (!container) return; // Guard clause

    // Load HTML
    try {
        const html = await fetch("./features/quick-command/quick-command.html").then(r => r.text());
        container.innerHTML = html;
    } catch (e) {
        console.error("Failed to load quick command HTML", e);
        container.innerHTML = "<p>Error loading module</p>";
        return;
    }

    // Load CSS
    // Note: We reuse clipboard.css for shared styles, plus quick-command.css
    if (!document.querySelector('link[href="./features/quick-command/quick-command.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "./features/quick-command/quick-command.css";
        document.head.appendChild(link);
    }
    // Ensure clipboard css is loaded if not already (it overlaps with popup.html loading but good to be safe)
    if (!document.querySelector('link[href="./features/clipboard/clipboard.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "./features/clipboard/clipboard.css";
        document.head.appendChild(link);
    }

    const input = container.querySelector("#command-input");
    const addBtn = container.querySelector("#add-command-btn");
    const list = container.querySelector("#command-list");
    const emptyState = container.querySelector("#empty-state");
    const clearAllBtn = container.querySelector("#clear-all-commands");

    // Create toast element
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = "Copied to clipboard!";
    container.appendChild(toast);

    let commands = [];

    // Load commands
    await loadCommands();
    // Force a render after load complete to ensure state is correct
    // (renderList is called inside loadCommands, but let's be safe)
    renderList(); // Initial render to show empty state if needed

    // Listen for storage changes (e.g. from context menu)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.quickCommands) {
            loadCommands();
        }
    });

    // Add command events
    addBtn.addEventListener("click", () => addCommand());
    input.addEventListener("keydown", (e) => {
        // Ctrl+Enter or Cmd+Enter to submit
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            addCommand();
        }
    });

    // Clear all event
    clearAllBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete ALL commands?")) {
            commands = [];
            chrome.storage.local.set({ quickCommands: commands }, renderList);
        }
    });

    async function loadCommands() {
        const data = await chrome.storage.local.get("quickCommands");
        commands = data.quickCommands || [];
        renderList();
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 2000);
    }

    function addCommand() {
        const cmd = input.value; // No trim() to preserve exact formatting if user desires spaces
        if (!cmd.trim()) return;

        // Prevent duplicates (optional, but good UX)
        if (commands.some(c => c.text === cmd)) {
            showToast("Command already exists!");
            return;
        }

        commands.unshift({
            id: Date.now().toString(),
            text: cmd,
            createdAt: Date.now()
        });

        chrome.storage.local.set({ quickCommands: commands }, () => {
            input.value = "";
            renderList();
            list.scrollTop = 0; // Scroll to top to see new item
        });
    }

    function renderList() {
        if (!list) return; // Guard
        list.innerHTML = "";

        if (!commands || commands.length === 0) {
            if (emptyState) emptyState.classList.remove("hidden");
            if (clearAllBtn) clearAllBtn.classList.add("hidden");
        } else {
            if (emptyState) emptyState.classList.add("hidden");
            if (clearAllBtn) clearAllBtn.classList.remove("hidden");

            commands.forEach((cmd, index) => {
                const item = document.createElement("div");
                item.className = "clipboard-item";
                item.innerHTML = `
                    <div class="code-block">${escapeHtml(cmd.text)}</div>
                    <div class="clipboard-meta">
                        <span class="clipboard-source">
                            <i class="fa-solid fa-code"></i> ${new Date(cmd.createdAt).toLocaleString()}
                        </span>
                        <div class="clipboard-actions">
                            <button class="clipboard-btn copy-btn" data-tooltip="Copy command">
                                <i class="fa-solid fa-copy"></i> Copy
                            </button>
                            <button class="clipboard-btn delete-btn" data-tooltip="Delete command">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;

                // Events
                const copyBtn = item.querySelector(".copy-btn");
                const deleteBtn = item.querySelector(".delete-btn");

                copyBtn.addEventListener("click", () => {
                    navigator.clipboard.writeText(cmd.text).then(() => {
                        const originalHtml = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                        copyBtn.style.color = 'var(--primary)';

                        setTimeout(() => {
                            copyBtn.innerHTML = originalHtml;
                            copyBtn.style.color = '';
                        }, 1500);
                    });
                });

                deleteBtn.addEventListener("click", () => {
                    if (confirm("Delete this command?")) {
                        commands = commands.filter(c => c.id !== cmd.id);
                        chrome.storage.local.set({ quickCommands: commands }, renderList);
                    }
                });

                list.appendChild(item);
            });
        }
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }
}
