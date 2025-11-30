import { getLocalStorage, setLocalStorage, saveSettings, debounce, loadSettings } from "../../helper.js";

const addBtn = document.getElementById('add-note');
const deleteBtn = document.getElementById('delete-note');
const noteSelector = document.getElementById('note-selector');
const noteBody = document.getElementById('note-body');
const copyBtn = document.getElementById('copy-note');
const searchInput = document.getElementById('search-text');
const btnSearch = document.getElementById('btn-search');
const toggleDarkBtn = document.getElementById('toggle-dark');
const stickyNoteBtn = document.getElementById('sticky-note');

let notes = [];
let currentNoteId = null;

// ----------------- Storage -----------------
function saveNotes() {
    setLocalStorage('sidebarNotes', notes);
}

async function loadNotes() {
    const res = await getLocalStorage('sidebarNotes');

    if (res && Array.isArray(res)) {
        notes = res;
    } else {
        notes = [];
    }

    if (notes.length === 0) {
        // tạo note mặc định nhưng không overwrite cũ
        const id = Date.now().toString();
        notes.push({ id, title: 'Note 1', content: '' });
    }

    populateSelector();
    selectNote(notes[0].id);
    updateDeleteButton();
}

// ----------------- Note Operations -----------------
function populateSelector() {
    noteSelector.innerHTML = '';
    notes.forEach(note => {
        const opt = document.createElement('option');
        opt.value = note.id;
        opt.textContent = note.title || `Note ${note.id}`;
        noteSelector.appendChild(opt);
    });
}

function selectNote(id) {
    currentNoteId = id;
    const note = notes.find(n => n.id === id);
    if (note) {
        noteBody.innerHTML = note.content || '';
        noteSelector.value = id;
    }
    updateDeleteButton();
}

function addNote() {
    const id = Date.now().toString();
    const newNote = { id, title: `Note ${notes.length + 1}`, content: '' };
    notes.push(newNote);
    saveNotes();
    populateSelector();
    selectNote(id);
}

function deleteNote() {
    if (!currentNoteId) return;

    // Không cho xóa note đầu tiên
    const firstNoteId = notes[0].id;
    if (currentNoteId === firstNoteId) return;

    const index = notes.findIndex(n => n.id === currentNoteId);
    if (index !== -1) {
        notes.splice(index, 1);
        saveNotes();
        selectNote(notes[0].id);
    }
}

function updateDeleteButton() {
    // Nếu currentNote là note đầu tiên thì disable nút delete
    deleteBtn.disabled = (currentNoteId === notes[0].id);
}

function resizeImagesInNote(maxWidth) {
    const images = noteBody.querySelectorAll('img');
    images.forEach(img => {
        // Tạo canvas để resize ảnh
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const image = new Image();
        image.src = img.src;

        image.onload = () => {
            const ratio = image.width / image.height;
            let newWidth = Math.min(maxWidth, image.width);
            let newHeight = newWidth / ratio;

            canvas.width = newWidth;
            canvas.height = newHeight;

            ctx.drawImage(image, 0, 0, newWidth, newHeight);

            // Lấy dataURL mới
            img.src = canvas.toDataURL('image/png');
            img.style.width = '100%'; // luôn ngang div
            img.style.height = 'auto';
        };
    });
}

const toolbarButtons = document.querySelectorAll('#note-toolbar button, #note-toolbar input[type=color]');

toolbarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        let value = null;

        if (cmd === 'createLink' || cmd === 'insertImage') {
            value = prompt(btn.dataset.prompt, '');
            if (!value) return;
        } else if (cmd === 'undo' || cmd === 'redo') {
            document.execCommand(cmd, false, null);
        } else if (cmd === 'foreColor') {
            value = btn.value; // lấy màu từ input color
        }

        document.execCommand(cmd, false, value);
        saveCurrentNoteContent();
    });

    // Nếu là color input
    if (btn.tagName === 'INPUT' && btn.type === 'color') {
        btn.addEventListener('input', () => {
            const cmd = btn.dataset.cmd;
            document.execCommand(cmd, false, btn.value);
            saveCurrentNoteContent();
        });
    }
});

document.getElementById('font-size').addEventListener('change', (e) => {
    const size = e.target.value;
    document.execCommand('fontSize', false, 7); // set size max
    const fontElements = noteBody.querySelectorAll('font[size="7"]');
    fontElements.forEach(el => el.removeAttribute('size'));
    fontElements.forEach(el => el.style.fontSize = size);
});
// ----------------- Note Content -----------------
function saveCurrentNoteContent() {
    if (!currentNoteId) return;

    // Resize ảnh trước khi lưu
    const maxWidth = noteBody.clientWidth; // max width = width noteBody
    resizeImagesInNote(maxWidth);

    // Lưu HTML hiện tại
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
        note.content = noteBody.innerHTML;
        saveNotes();
    }
}

noteBody.addEventListener("input", debounce(saveCurrentNoteContent, 500));

// ----------------- Event Listeners -----------------
addBtn.addEventListener('click', addNote);
deleteBtn.addEventListener('click', deleteNote);

noteSelector.addEventListener('change', (e) => {
    saveCurrentNoteContent();
    selectNote(e.target.value);
});

copyBtn.addEventListener('click', () => {
    const range = document.createRange();
    range.selectNodeContents(noteBody);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
});

noteBody.addEventListener('dragover', (e) => {
    e.preventDefault(); // cho phép drop
});

noteBody.addEventListener('drop', (e) => {
    e.preventDefault();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;

                // Set width bằng width của noteBody
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '5px 0';

                noteBody.appendChild(img);

                saveCurrentNoteContent(); // lưu note sau khi thêm ảnh
            };
            reader.readAsDataURL(file);
        }
    }
});

btnSearch.addEventListener('click', () => {
    const searchValue = searchInput.value;
    if (!searchValue) return;

    // Xóa highlight cũ
    const spans = noteBody.querySelectorAll('span.search-highlight');
    spans.forEach(s => s.replaceWith(...s.childNodes));

    const regex = new RegExp(searchValue, 'gi');
    noteBody.innerHTML = noteBody.innerHTML.replace(regex, match => `<span class="search-highlight">${match}</span>`);
});

toggleDarkBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    saveSettings({
        'darkMode': document.body.classList.contains('dark-mode')
    });
});

stickyNoteBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "create-sticky-note",
            content: noteBody.textContent
        });
    });
})
// Load dark mode khi khởi tạo
async function getSetting() {
    const res = await loadSettings('setting');
    if (res?.darkMode) {
        document.body.classList.add('dark-mode');
    }
}

await getSetting();
// ----------------- Init -----------------
await loadNotes();
