(function () {
    /* 
    document.addEventListener('copy', (event) => {
        // Handle Text
        const selectedText = window.getSelection().toString().trim();
        if (selectedText) {
            sendClipboardData({ type: 'text', text: selectedText });
        }

        // Handle Images in the clipboard data
        if (event.clipboardData && event.clipboardData.items) {
            for (const item of event.clipboardData.items) {
                if (item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            sendClipboardData({
                                type: 'image',
                                image: e.target.result,
                                text: `[Image] Captured at ${new Date().toLocaleTimeString()}`
                            });
                        };
                        reader.readAsDataURL(blob);
                    }
                }
            }
        }
    }, true);
    */

    // Grabbing image for context menu to avoid CORS issues in background
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'grab-image-data' && msg.srcUrl) {
            getImageDataUrl(msg.srcUrl).then(dataUrl => {
                sendResponse({ dataUrl: dataUrl });
            }).catch(() => {
                sendResponse({ dataUrl: null });
            });
            return true; // async callback
        }
    });

    async function getImageDataUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    function sendClipboardData(data) {
        chrome.runtime.sendMessage({
            action: 'save-clipboard',
            ...data,
            url: window.location.href,
            title: document.title,
            timestamp: Date.now()
        }, () => {
            if (chrome.runtime.lastError) {
                // Ignore orphaned script errors
            }
        });
    }
})();
