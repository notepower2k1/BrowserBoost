/**
 * Vietnamese Lunar Calendar & Holiday Feature (Split View & Fast Navigation)
 */

const LunarUtils = {
    getJD: function (d, m, y) {
        let a = Math.floor((14 - m) / 12);
        y = y + 4800 - a;
        m = m + 12 * a - 3;
        return d + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    },

    getLunarDate: function (dd, mm, yy) {
        const jdn = this.getJD(dd, mm, yy);
        const lunarDate = decodeLunarDate(dd, mm, yy);
        return {
            day: lunarDate[0],
            month: lunarDate[1],
            year: lunarDate[2],
            isLeap: lunarDate[3] === 1
        };
    },

    getHolidays: function (day, month, year, lDay, lMonth, lYear) {
        const holidays = [];

        // ===== DƯƠNG LỊCH - VIỆT NAM =====
        if (day === 1 && month === 1) holidays.push("New Year's Day");
        if (day === 3 && month === 2) holidays.push("Communist Party of Vietnam Foundation Day");
        if (day === 8 && month === 3) holidays.push("International Women's Day");
        if (day === 26 && month === 3) holidays.push("Ho Chi Minh Communist Youth Union Day");
        if (day === 30 && month === 4) holidays.push("Reunification Day");
        if (day === 1 && month === 5) holidays.push("International Workers' Day");
        if (day === 19 && month === 5) holidays.push("Ho Chi Minh's Birthday");
        if (day === 1 && month === 6) holidays.push("International Children's Day");
        if (day === 27 && month === 7) holidays.push("War Invalids and Martyrs Day");
        if (day === 19 && month === 8) holidays.push("August Revolution Day");
        if (day === 2 && month === 9) holidays.push("National Day");
        if (day === 10 && month === 10) holidays.push("Capital Liberation Day");
        if (day === 20 && month === 10) holidays.push("Vietnamese Women's Day");
        if (day === 20 && month === 11) holidays.push("Vietnamese Teachers' Day");
        if (day === 22 && month === 12) holidays.push("Vietnam People's Army Foundation Day");
        if (day === 25 && month === 12) holidays.push("Christmas");

        // ===== ÂM LỊCH - VIỆT NAM =====
        if (lDay === 1 && lMonth === 1) holidays.push("Lunar New Year (Day 1)");
        if (lDay === 2 && lMonth === 1) holidays.push("Lunar New Year (Day 2)");
        if (lDay === 3 && lMonth === 1) holidays.push("Lunar New Year (Day 3)");
        if (lDay === 15 && lMonth === 1) holidays.push("Lantern Festival");
        if (lDay === 10 && lMonth === 3) holidays.push("Hung Kings Festival");
        if (lDay === 15 && lMonth === 4) holidays.push("Vesak (Buddha's Birthday)");
        if (lDay === 5 && lMonth === 5) holidays.push("Dragon Boat Festival");
        if (lDay === 15 && lMonth === 7) holidays.push("Vu Lan Festival");
        if (lDay === 15 && lMonth === 8) holidays.push("Mid-Autumn Festival");
        if (lDay === 23 && lMonth === 12) holidays.push("Kitchen Guardians Day");

        // ===== NGÀY QUỐC TẾ =====
        if (day === 14 && month === 2) holidays.push("Valentine's Day");
        if (day === 22 && month === 4) holidays.push("Earth Day");
        if (day === 1 && month === 4) holidays.push("April Fools' Day");
        if (day === 31 && month === 10) holidays.push("Halloween");
        if (day === 20 && month === 3) holidays.push("International Day of Happiness");
        if (day === 21 && month === 6) holidays.push("International Yoga Day");
        if (day === 5 && month === 6) holidays.push("World Environment Day");
        if (day === 21 && month === 9) holidays.push("International Day of Peace");

        // ===== NGÀY GIA ĐÌNH - XÃ HỘI =====
        if (day === 28 && month === 6) holidays.push("Vietnam Family Day");
        if (day === 13 && month === 10) holidays.push("Vietnam Entrepreneurs Day");
        if (day === 9 && month === 11) holidays.push("Vietnam Law Day");

        return holidays;
    }
};

function INT(n) { return Math.floor(n); }
function getNewMoonDay(k, timeZone) {
    let T = k / 1236.85;
    let dr = Math.PI / 180;
    let t0 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T * T - 0.000000155 * T * T * T;
    let M = (359.2242 + 29.10535608 * k - 0.0000333 * T * T - 0.00000347 * T * T * T) * dr;
    let Mprime = (212.2047 + 385.81693528 * k + 0.0117938 * T * T + 0.00000065 * T * T * T) * dr;
    let F = (144.0118 + 390.67050274 * k - 0.0016528 * T * T - 0.00000227 * T * T * T) * dr;
    let deltat0 = (0.1734 - 0.000393 * T) * Math.sin(M) + 0.0021 * Math.sin(2 * M) - 0.4068 * Math.sin(Mprime) + 0.0161 * Math.sin(2 * Mprime) - 0.0004 * Math.sin(3 * Mprime) + 0.0104 * Math.sin(2 * F) - 0.0051 * Math.sin(M + Mprime) - 0.0074 * Math.sin(M - Mprime) + 0.0004 * Math.sin(2 * F + M) - 0.0004 * Math.sin(2 * F - M) - 0.0006 * Math.sin(2 * F + Mprime) + 0.0104 * Math.sin(2 * F - Mprime) + 0.0005 * Math.sin(M + 2 * Mprime);
    return t0 + deltat0 + timeZone / 24;
}
function getSunLongitude(jdn, timeZone) {
    let T = (jdn + 0.5 - timeZone / 24 - 2451545.0) / 36525;
    let L = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    let dr = Math.PI / 180;
    L = L % 360; M = M % 360;
    let C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * dr) + (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr) + 0.000289 * Math.sin(3 * M * dr);
    return (L + C) % 360;
}
function getLunarMonth11(y, timeZone) {
    let off = LunarUtils.getJD(31, 12, y) - 2415021;
    let k = INT(off / 29.5305888);
    let nm = getNewMoonDay(k, timeZone);
    let sunLong = getSunLongitude(nm, timeZone);
    if (sunLong >= 280) { k -= 1; nm = getNewMoonDay(k, timeZone); }
    return INT(nm + 0.5);
}
function getLeapMonthOffset(a11, b11, timeZone) {
    let k = INT((b11 - a11) / 29.5305888 + 0.5);
    if (k <= 12) return -1;
    let i = 1;
    while (i <= k) {
        let nm = getNewMoonDay(INT((a11 - 2415021) / 29.5305888 + 0.5) + i, timeZone);
        let s2 = getSunLongitude(nm + 30, timeZone);
        if (INT(getSunLongitude(nm, timeZone) / 30) === INT(s2 / 30)) return i;
        i++;
    }
    return -1;
}
function decodeLunarDate(d, m, y) {
    let timeZone = 7.0;
    let jdn = LunarUtils.getJD(d, m, y);
    let a11 = getLunarMonth11(y, timeZone);
    if (a11 > jdn) a11 = getLunarMonth11(y - 1, timeZone);
    let b11 = getLunarMonth11(y + 1, timeZone);
    if (b11 <= jdn) { a11 = b11; b11 = getLunarMonth11(y + 2, timeZone); }
    let k = INT((jdn - a11) / 29.5305888 + 0.5);
    let nm = getNewMoonDay(INT((a11 - 2415021) / 29.5305888 + 0.5) + k, timeZone);
    while (INT(nm + 0.5) > jdn) { k--; nm = getNewMoonDay(INT((a11 - 2415021) / 29.5305888 + 0.5) + k, timeZone); }
    let leapMonth = getLeapMonthOffset(a11, b11, timeZone);
    let isLeap = 0, lunarMonth = (k + 10) % 12 + 1;
    if (leapMonth !== -1 && k > leapMonth) {
        if (k === leapMonth + 1) isLeap = 1;
        lunarMonth = (k + 9) % 12 + 1;
    }
    let lunarDay = jdn - INT(nm + 0.5) + 1;
    let lunarYear = lunarMonth >= 11 && k < 3 ? y - 1 : y;
    return [lunarDay, lunarMonth, lunarYear, isLeap];
}

let currentDate = new Date();
let selectedDate = new Date();
let userEvents = {};

export async function initCalendar() {
    const result = await chrome.storage.local.get('vCalendarEvents');
    userEvents = result.vCalendarEvents || {};
    renderCalendar();
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();

    container.innerHTML = `
        <div class="calendar-split-wrapper">
            <!-- Left Side: Calendar Grid -->
            <div class="calendar-main-card">
                <div class="calendar-header-v2">
                    <div class="nav-controls">
                        <select id="monthSelect" class="cal-select"></select>
                        <select id="yearSelect" class="cal-select"></select>
                    </div>
                    <div class="nav-btns-v2">
                        <button class="nav-btn-v2" id="prevMonth" data-tooltip="Previous Month"><i class="fa-solid fa-chevron-left"></i></button>
                        <button class="nav-btn-v2" id="todayBtn" data-tooltip="Today"><i class="fa-solid fa-calendar-day"></i></button>
                        <button class="nav-btn-v2" id="nextMonth" data-tooltip="Next Month"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
                <div class="calendar-grid-v2" id="calendarGrid">
                    <div class="weekday-v2">Mon</div><div class="weekday-v2">Tue</div><div class="weekday-v2">Wed</div><div class="weekday-v2">Thu</div><div class="weekday-v2">Fri</div><div class="weekday-v2">Sat</div><div class="weekday-v2">Sun</div>
                </div>
            </div>
            
            <!-- Right Side: Event Details -->
            <div class="calendar-side-panel" id="dateDetails"></div>
        </div>
    `;

    // Populate Selects
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    monthNames.forEach((name, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = name;
        if (idx === month) opt.selected = true;
        monthSelect.appendChild(opt);
    });

    for (let y = year - 10; y <= year + 10; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === year) opt.selected = true;
        yearSelect.appendChild(opt);
    }

    monthSelect.onchange = (e) => { currentDate.setMonth(parseInt(e.target.value)); renderCalendar(); };
    yearSelect.onchange = (e) => { currentDate.setFullYear(parseInt(e.target.value)); renderCalendar(); };

    const grid = document.getElementById('calendarGrid');
    let startDayIdx = (firstDay === 0) ? 6 : firstDay - 1;

    for (let i = startDayIdx - 1; i >= 0; i--) {
        grid.appendChild(createDayEl(prevDaysInMonth - i, month === 0 ? 11 : month - 1, month === 0 ? year - 1 : year, true));
    }
    for (let i = 1; i <= daysInMonth; i++) {
        grid.appendChild(createDayEl(i, month, year, false));
    }
    const rem = 42 - (startDayIdx + daysInMonth);
    for (let i = 1; i <= rem; i++) {
        grid.appendChild(createDayEl(i, month === 11 ? 0 : month + 1, month === 11 ? year + 1 : year, true));
    }

    document.getElementById('prevMonth').onclick = () => { currentDate.setMonth(month - 1); renderCalendar(); };
    document.getElementById('nextMonth').onclick = () => { currentDate.setMonth(month + 1); renderCalendar(); };
    document.getElementById('todayBtn').onclick = () => { currentDate = new Date(); selectedDate = new Date(); renderCalendar(); };
    updateDetails();
}

function createDayEl(day, month, year, isOther) {
    const div = document.createElement('div');
    div.className = `day-v2 ${isOther ? 'other-month-v2' : ''}`;
    const now = new Date();

    const lunar = LunarUtils.getLunarDate(day, month + 1, year);
    const holidays = LunarUtils.getHolidays(day, month + 1, year, lunar.day, lunar.month, lunar.year);
    const eventKey = `${day}-${month}-${year}`;
    const hasPersonalEvent = userEvents[eventKey] && userEvents[eventKey].length > 0;

    // Color categories
    if (holidays.length > 0) div.classList.add('holiday-cell');
    if (hasPersonalEvent) div.classList.add('event-cell');

    if (day === now.getDate() && month === now.getMonth() && year === now.getFullYear()) div.classList.add('today-v2');
    if (day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()) div.classList.add('active-v2');

    div.innerHTML = `<span class="solar-v2">${day}</span><span class="lunar-v2">${lunar.day}/${lunar.month}</span>`;
    div.onclick = () => { selectedDate = new Date(year, month, day); renderCalendar(); };
    return div;
}

function updateDetails() {
    const details = document.getElementById('dateDetails');
    const day = selectedDate.getDate(), month = selectedDate.getMonth(), year = selectedDate.getFullYear();
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const lunar = LunarUtils.getLunarDate(day, month + 1, year);
    const holidays = LunarUtils.getHolidays(day, month + 1, year, lunar.day, lunar.month, lunar.year);
    const eventKey = `${day}-${month}-${year}`;
    const personalEvents = userEvents[eventKey] || [];

    details.innerHTML = `
        <div class="panel-header">
            <div class="big-day">${day}</div>
            <div class="day-info">
                <div class="weekday-name">${weekdayNames[selectedDate.getDay()]}</div>
                <div class="full-solar">${monthNames[month]} ${day}, ${year}</div>
            </div>
        </div>
        <div class="lunar-section">
            <div class="lunar-item"><span>Lunar:</span> <strong>${lunar.day}/${lunar.month}/${lunar.year}</strong></div>
            ${lunar.isLeap ? '<div class="leap-tag">Leap Month</div>' : ''}
        </div>
        <div class="event-scrollarea">
            ${holidays.map(h => `<div class="evt holiday-v2"><span>${h}</span></div>`).join('')}
            ${personalEvents.map((e, idx) => `
                <div class="evt personal-v2">
                    <span>${e}</span>
                    <button class="del-evt" data-idx="${idx}"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('')}
        </div>
        <button class="add-btn-v2"><i class="fa-solid fa-plus"></i> Add Anniversary</button>
    `;

    details.querySelector('.add-btn-v2').onclick = () => {
        const title = prompt("Anniversary content:");
        if (title) { if (!userEvents[eventKey]) userEvents[eventKey] = []; userEvents[eventKey].push(title); saveEvents(); }
    };
    details.querySelectorAll('.del-evt').forEach(btn => {
        btn.onclick = () => { userEvents[eventKey].splice(btn.dataset.idx, 1); if (userEvents[eventKey].length === 0) delete userEvents[eventKey]; saveEvents(); };
    });
}

async function saveEvents() {
    await chrome.storage.local.set({ vCalendarEvents: userEvents });
    renderCalendar();
}
