(function () {
    const DOMAIN = location.hostname;
    const KEY = `stickyNotes_${DOMAIN}`;
    let notes = [];

    // Lấy note từ chrome.storage
    function loadNotes(callback) {
        chrome.storage.local.get([KEY], (res) => {
            notes = res[KEY] || [];
            if (callback) callback(notes);
        });
    }

    // Lưu note vào storage
    function saveNotes() {
        chrome.storage.local.set({ [KEY]: notes });
    }

    // Tạo note element
    function createNoteElement(note) {
        if (document.querySelector(`.sticky-note[data-id="${note.id}"]`)) return;

        const el = document.createElement('div');
        el.className = 'sticky-note';
        el.dataset.id = note.id;
        el.style.left = (note.x || 100) + 'px';
        el.style.top = (note.y || 100) + 'px';
        el.style.width = (note.width || 320) + 'px';
        el.style.height = (note.height || 240) + 'px';

        el.innerHTML = `
            <div class="sticky-note-header">
                <div class="format-toolbar">
                    <button data-cmd="bold" title="Bold"><b>B</b></button>
                    <button data-cmd="italic" title="Italic"><i>I</i></button>
                    <button data-cmd="underline" title="Underline"><u>U</u></button>
                    <button data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
                    <button class="font-dec" title="Decrease size">A−</button>
                    <button class="font-inc" title="Increase size">A+</button>
                </div>
                <div class="sticky-note-actions">
                    <button class="toggle-btn" title="Collapse/Expand">${note.collapsed ? '□' : '−'}</button>
                    <button class="add-btn" title="New Note">＋</button>
                    <button class="delete-btn" title="Delete Note">×</button>
                </div>
            </div>
            <div class="sticky-note-body" contenteditable="true">
                ${note.content || ""}
            </div>
            <div class="sticky-note-footer">
                <div class="drag-handle-bottom" title="Click and drag to move">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;

        if (note.collapsed) {
            el.classList.add('collapsed');
        }

        document.body.appendChild(el);

        const body = el.querySelector('.sticky-note-body');
        const toggleBtn = el.querySelector('.toggle-btn');

        toggleBtn.addEventListener('click', () => {
            el.classList.toggle('collapsed');
            const isCollapsed = el.classList.contains('collapsed');
            toggleBtn.textContent = isCollapsed ? '□' : '−';

            const i = notes.findIndex(n => n.id === note.id);
            if (i !== -1) {
                notes[i].collapsed = isCollapsed;
                saveNotes();
            }
        });
        el.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                body.focus();
                document.execCommand(btn.dataset.cmd, false, null);
            });
        });

        // Save content on blur
        body.addEventListener('blur', () => {
            const i = notes.findIndex(n => n.id === note.id);
            if (i !== -1) {
                notes[i].content = body.innerHTML;
                saveNotes();
            }
        });

        // Add note button
        el.querySelector('.add-btn').addEventListener('click', () => {
            const newNote = {
                id: Date.now(),
                content: '',
                x: el.offsetLeft + 20,
                y: el.offsetTop + 20,
                width: 320,
                height: 240
            };
            notes.push(newNote);
            saveNotes();
            createNoteElement(newNote);
        });

        // Delete note button
        el.querySelector('.delete-btn').addEventListener('click', () => {
            if (window.confirm('Do you want to delete this note?')) {
                notes = notes.filter(n => n.id !== note.id);
                saveNotes();
                el.remove();
            }
        });

        // Drag
        enableDrag(el, note.id);

        // Resize Observer để theo dõi người dùng resize
        const ro = new ResizeObserver(() => {
            if (el.classList.contains('collapsed')) return; // Không lưu size khi đang minimize

            const i = notes.findIndex(n => n.id === note.id);
            if (i !== -1) {
                notes[i].width = el.offsetWidth;
                notes[i].height = el.offsetHeight;
                notes[i].x = el.offsetLeft;
                notes[i].y = el.offsetTop;
                saveNotes();
            }
        });
        ro.observe(el);


        let fontSize = note.fontSize || 14;
        body.style.setProperty('--font-size', fontSize + 'px');

        el.querySelector('.font-inc').addEventListener('click', () => {
            fontSize += 1;
            body.style.setProperty('--font-size', fontSize + 'px');
            saveFont();
        });

        el.querySelector('.font-dec').addEventListener('click', () => {
            fontSize = Math.max(10, fontSize - 1);
            body.style.setProperty('--font-size', fontSize + 'px');
            saveFont();
        });

        function saveFont() {
            const i = notes.findIndex(n => n.id === note.id);
            if (i !== -1) {
                notes[i].fontSize = fontSize;
                saveNotes();
            }
        }
    }



    function enableDrag(el, id) {
        const handles = el.querySelectorAll('.sticky-note-header, .sticky-note-footer');
        let startX = 0, startY = 0;
        let dragging = false;

        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return; // Don't drag if clicking buttons

                dragging = true;
                startX = e.clientX - el.offsetLeft;
                startY = e.clientY - el.offsetTop;

                function onMove(ev) {
                    let newX = ev.clientX - startX;
                    let newY = ev.clientY - startY;

                    // Giới hạn trong vùng nhìn thấy (viewport)
                    const minX = window.scrollX;
                    const minY = window.scrollY;
                    const maxX = window.scrollX + window.innerWidth - el.offsetWidth;
                    const maxY = window.scrollY + window.innerHeight - el.offsetHeight;

                    newX = Math.max(minX, Math.min(newX, maxX));
                    newY = Math.max(minY, Math.min(newY, maxY));

                    el.style.left = newX + 'px';
                    el.style.top = newY + 'px';
                }

                function onUp() {
                    dragging = false;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    // Save position
                    const i = notes.findIndex(n => n.id === id);
                    if (i !== -1) {
                        notes[i].x = el.offsetLeft;
                        notes[i].y = el.offsetTop;
                        saveNotes();
                    }
                }

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    }

    // Public API: gọi từ popup
    window.createStickyNoteFromPopup = function (note) {
        notes.push(note);
        saveNotes();
        createNoteElement(note);
    };

    // Listen to messages
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "create-sticky-note") {
            const note = {
                id: Date.now(),
                content: msg.content || '',
                x: 100,
                y: 100,
                width: 320,
                height: 240
            };

            notes.push(note);
            saveNotes();
            createNoteElement(note);
        }
    });

    // Khởi tạo note
    function initNotes() {
        loadNotes((notes) => {
            // Delay render một chút để tránh giật lag khi load trang
            setTimeout(() => {
                notes.forEach(createNoteElement);
            }, 500);
        });
    }

    initNotes();
})();
