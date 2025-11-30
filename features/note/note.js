export function initNote() {
    if (chrome.sidePanel) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;

            chrome.sidePanel.setOptions({
                path: 'features/note/note-sidebar.html',
                enabled: true
            });

            chrome.sidePanel.open({ tabId }, () => {
                console.log('Sidebar opened');
            });
        });
    } else {
        alert('Browser not support sidebar!');
    }
}
