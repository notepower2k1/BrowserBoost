// ---------------------- INIT ----------------------
const text = document.getElementById("timeText");
const doneBtn = document.getElementById("done");
const ringWrapper = document.querySelector(".ring-wrapper");
const circle = document.querySelector(".progress");
const radius = 96;
const circumference = 2 * Math.PI * radius;

circle.style.strokeDasharray = circumference;
circle.style.strokeDashoffset = circumference;

doneBtn.disabled = true;

let TOTAL_SECONDS = 20; // default
let remaining = TOTAL_SECONDS;
let actionSent = false;

// ------------------- LOAD SETTINGS -------------------
async function init() {
    const stored = await chrome.storage.local.get("eyeRelax");
    const relaxDuration = stored.eyeRelax?.relaxDuration || 20;
    TOTAL_SECONDS = relaxDuration;
    remaining = TOTAL_SECONDS;

    updateUI();
    startTimer();
}

function updateUI() {
    text.textContent = `${remaining}s`;
    updateRing();
}

function updateRing() {
    const progress = remaining / TOTAL_SECONDS;
    circle.style.strokeDashoffset = circumference * (1 - progress);
}

// ------------------- TIMER -------------------
let timer;

function startTimer() {
    if (timer) clearInterval(timer);

    timer = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(timer);
            remaining = 0;

            ringWrapper.classList.remove("breathing");

            // ⭕ FULL CIRCLE
            circle.style.strokeDashoffset = 0;

            text.textContent = "Done";
            doneBtn.disabled = false;
            return;
        }

        text.textContent = `${remaining}s`;
        updateRing();
    }, 1000);
}

function sendOnce(msg) {
    if (actionSent) return;
    actionSent = true;
    console.log('sendOnce', msg);
    return new Promise(resolve => {
        chrome.runtime.sendMessage(msg, () => resolve());
    });
}

// ------------------- BUTTONS -------------------
document.getElementById("snooze5").onclick = async () => {
    await sendOnce({ action: "eye-snooze", minutes: 5 });
    window.close();
};

document.getElementById("snooze10").onclick = async () => {
    await sendOnce({ action: "eye-snooze", minutes: 10 });
    window.close();
};

doneBtn.onclick = async () => {
    await sendOnce({ action: "update-eye-relax" });
    window.close();
};
// ------------------- START -------------------
init();
