export async function initClipboard() {
    const container = document.getElementById('clipboard-container');
    if (!container) return;

    renderClipboard();

    // Listen for storage changes to update UI in real-time
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.clipboardHistory) {
            renderClipboard();
        }
    });
}

async function renderClipboard() {
    const container = document.getElementById('clipboard-container');
    const res = await chrome.storage.local.get("clipboardHistory");
    const history = res.clipboardHistory || [];

    // Load auto-save setting
    const settings = await chrome.storage.local.get("autoSaveClipboard");
    const isAutoSave = settings.autoSaveClipboard || false;

    container.innerHTML = `
        <div class="clipboard-header">
            <h2>Clipboard History</h2>
            <div class="clipboard-controls">
                <label class="switch-label">
                    <span>Auto Save</span>
                    <label class="switch">
                        <input type="checkbox" id="autoSaveToggle" ${isAutoSave ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </label>
                ${history.length > 0 ? `<button id="clearClipboard" data-tooltip="Clear all history">Clear All</button>` : ''}
            </div>
        </div>
    `;

    if (history.length === 0) {
        container.innerHTML += `
            <div class="empty-clipboard">
                <div class="empty-icon">
                    <i class="fa-solid fa-clipboard"></i>
                </div>
                <h3>Your clipboard is empty</h3>
                <p>Turn on <b>Auto Save</b> or right-click text and select <b>"Save to Helper Clipboard"</b>.</p>
            </div>
        `;
    } else {
        container.innerHTML += `
            <div class="clipboard-list">
                ${history.map((item, index) => `
                    <div class="clipboard-item ${item.type === 'image' ? 'is-image' : ''}" data-index="${index}">
                        ${item.type === 'image' ? `
                            <div class="clipboard-image-container">
                                <img src="${item.image}" alt="Captured Image" class="clipboard-preview-img">
                            </div>
                        ` : `
                            <div class="clipboard-text">${escapeHtml(item.text)}</div>
                        `}
                        <div class="clipboard-meta">
                            <a href="${item.url || '#'}" class="clipboard-source" target="_blank" title="${item.url}">
                                <i class="fa-solid fa-link"></i> ${item.title || item.url || 'Unknown source'}
                            </a>
                            <div class="clipboard-actions">
                                <button class="clipboard-btn copy-btn" data-text="${item.text.replace(/"/g, '&quot;')}" data-type="${item.type}" tooltip="Copy text">
                                    <i class="fa-solid fa-copy"></i> Copy
                                </button>
                                ${item.type === 'image' ? `
                                    <button class="clipboard-btn view-btn" data-index="${index}" tooltip="View image">
                                        <i class="fa-solid fa-expand"></i>
                                    </button>
                                ` : ''}
                                <button class="clipboard-btn delete-btn" data-index="${index}" tooltip="Delete this alarm">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Add event listeners
    const toggle = container.querySelector('#autoSaveToggle');
    if (toggle) {
        toggle.addEventListener('change', async (e) => {
            await chrome.storage.local.set({ autoSaveClipboard: e.target.checked });
        });
    }

    container.querySelector('#clearClipboard')?.addEventListener('click', async () => {
        if (confirm('Xóa toàn bộ lịch sử clipboard?')) {
            await chrome.storage.local.set({ clipboardHistory: [] });
            renderClipboard();
        }
    });

    container.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const text = btn.dataset.text;
            const type = btn.dataset.type;
            try {
                if (type === 'image') {
                    const response = await fetch(text);
                    const blob = await response.blob();
                    await navigator.clipboard.write([
                        new ClipboardItem({ [blob.type]: blob })
                    ]);
                } else {
                    await navigator.clipboard.writeText(text);
                }

                // Visual feedback
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Done!';
                btn.style.color = 'var(--primary)';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.color = '';
                }, 1500);
            } catch (err) {
                console.error('Failed to copy!', err);
            }
        });
    });

    container.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const res = await chrome.storage.local.get("clipboardHistory");
            const item = res.clipboardHistory[index];
            if (item && item.image) {
                const newTab = window.open();
                newTab.document.body.innerHTML = `<img src="${item.image}" style="max-width:100%; height:auto;">`;
                newTab.document.title = "Clipboard Image View";
            }
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const res = await chrome.storage.local.get("clipboardHistory");
            let history = res.clipboardHistory || [];
            history.splice(index, 1);
            await chrome.storage.local.set({ clipboardHistory: history });
            renderClipboard();
        });
    });
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
