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

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-clipboard">
                <div class="empty-icon">
                    <i class="fa-solid fa-clipboard"></i>
                </div>
                <h3>Your clipboard is empty</h3>
                <p>Dữ liệu sẽ xuất hiện ở đây khi bạn nhấn chuột phải vào văn bản và chọn <b>"Save to Helper Clipboard"</b>.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="clipboard-header">
            <h2>Clipboard History</h2>
            <button id="clearClipboard">Clear All</button>
        </div>
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
                            <button class="clipboard-btn copy-btn" data-text="${item.text.replace(/"/g, '&quot;')}" data-type="${item.type}">
                                <i class="fa-solid fa-copy"></i> Copy
                            </button>
                            ${item.type === 'image' ? `
                                <button class="clipboard-btn view-btn" data-index="${index}">
                                    <i class="fa-solid fa-expand"></i>
                                </button>
                            ` : ''}
                            <button class="clipboard-btn delete-btn" data-index="${index}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Add event listeners
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
