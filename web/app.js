"use strict";

const $ = (sel) => document.querySelector(sel);

const root = document.documentElement;
const profileSelect = $("#profile");
const reloadBtn = $("#reload");
const countInput = $("#count");
const minInput = $("#min-delay");
const maxInput = $("#max-delay");
const headlessToggle = $("#headless");
const startBtn = $("#start");
const stopBtn = $("#stop");
const spinner = startBtn.querySelector(".spinner");
const startLabel = startBtn.querySelector(".btn-label");
const channelLabel = $("#channel-label");
const headMascot = $("#head-mascot");
const progressTrack = document.querySelector(".progress-track");
const progressFill = $("#progress-fill");
const counter = $("#counter");
const tallyOk = document.querySelector(".t-ok");
const tallySkip = document.querySelector(".t-skip");
const log = $("#log");
const empty = $("#empty");
const emptyTitle = $("#empty-title");
const announcer = $("#announcer");
const aboutDialog = $("#about");

let eventSource = null;
let running = false;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/* ── Mascot: clone the template into every slot ─────────────────── */
document.querySelectorAll("[data-mascot]").forEach((slot) => {
  slot.appendChild($("#mascot-template").content.cloneNode(true));
});

/* ── Theme: default dark, seed from prefers-color-scheme ────────── */
(function initTheme() {
  const saved = localStorage.getItem("quorum-theme");
  const preferred = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root.dataset.theme = saved || preferred;
})();

$("#theme-toggle").addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = next;
  localStorage.setItem("quorum-theme", next);
});

/* ── About dialog ───────────────────────────────────────────────── */
$("#about-btn").addEventListener("click", () => aboutDialog.showModal());
$("#about-close").addEventListener("click", () => aboutDialog.close());

/* ── Steppers ───────────────────────────────────────────────────── */
document.querySelectorAll(".step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.for);
    const step = parseFloat(btn.dataset.step);
    const min = parseFloat(input.min) || 0;
    const value = (parseFloat(input.value) || 0) + step;
    input.value = +Math.max(min, value).toFixed(1);
    input.dispatchEvent(new Event("change"));
  });
});

countInput.addEventListener("change", () => {
  countInput.value = Math.max(1, Math.round(parseFloat(countInput.value) || 1));
});
[minInput, maxInput].forEach((input) => {
  input.addEventListener("change", () => {
    input.value = +Math.max(0, parseFloat(input.value) || 0).toFixed(1);
    // keep min <= max by nudging the other bound
    if (parseFloat(minInput.value) > parseFloat(maxInput.value)) {
      (input === minInput ? maxInput : minInput).value = input.value;
    }
  });
});

/* ── Pill toggle (Run hidden) ───────────────────────────────────── */
headlessToggle.addEventListener("click", () => {
  const on = headlessToggle.getAttribute("aria-checked") === "true";
  headlessToggle.setAttribute("aria-checked", String(!on));
});

/* ── Profiles ───────────────────────────────────────────────────── */
async function loadProfiles() {
  let profiles = [];
  try {
    const res = await fetch("/api/profiles");
    profiles = await res.json();
  } catch {
    /* server unreachable; treated as no profiles */
  }
  const previous = profileSelect.value;
  profileSelect.innerHTML = "";
  for (const p of profiles) {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    profileSelect.appendChild(opt);
  }
  if (profiles.some((p) => p.name === previous)) profileSelect.value = previous;

  const none = profiles.length === 0;
  startBtn.disabled = none || running;
  emptyTitle.textContent = none ? "No profiles yet." : "Ready when you are.";
  return profiles;
}

reloadBtn.addEventListener("click", loadProfiles);

/* ── Log rendering ──────────────────────────────────────────────── */
const DOT_SVG = {
  ok: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="var(--ok)"/></svg>',
  timeout: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="var(--warn)"/><rect x="3" y="5" width="6" height="2" rx="1" fill="var(--surface-2)"/></svg>',
  error: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="var(--error)"/><path d="M4 4 L8 8 M8 4 L4 8" stroke="var(--surface-2)" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function isPinned() {
  return log.scrollHeight - log.scrollTop - log.clientHeight < 48;
}

function appendRow(build) {
  const pinned = isPinned();
  const row = document.createElement("div");
  build(row);
  log.appendChild(row);
  if (pinned) log.scrollTop = log.scrollHeight;
}

function addLogRow({ i, total, status, msg }) {
  appendRow((row) => {
    row.className = `row status-${status}`;

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.innerHTML = DOT_SVG[status] || DOT_SVG.error;

    const tag = document.createElement("span");
    tag.className = "tag mono";
    tag.textContent = `[${i}/${total}]`;

    const text = document.createElement("span");
    text.className = "msg";
    text.textContent = msg;
    text.setAttribute("aria-label", `${status}: ${msg}`);

    const time = document.createElement("span");
    time.className = "time mono";
    time.textContent = timestamp();

    row.append(dot, tag, text, time);
  });
}

function addSystemRow(msg) {
  appendRow((row) => {
    row.className = "row system";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.innerHTML = DOT_SVG.ok;
    const text = document.createElement("span");
    text.className = "msg";
    text.textContent = msg;
    const time = document.createElement("span");
    time.className = "time mono";
    time.textContent = timestamp();
    row.append(dot, text, time);
  });
}

/* ── Progress ───────────────────────────────────────────────────── */
function updateProgress({ done, total, ok, skipped }) {
  progressFill.style.transform = `scaleX(${total ? done / total : 0})`;
  progressTrack.setAttribute("aria-valuemax", total);
  progressTrack.setAttribute("aria-valuenow", done);
  counter.textContent = `${done} / ${total}`;
  tallyOk.textContent = `ok ${ok}`;
  tallySkip.textContent = `skipped ${skipped}`;
}

/* ── Confetti (skipped under reduced motion) ────────────────────── */
function confetti() {
  if (reducedMotion.matches) return;
  const colors = ["var(--accent)", "var(--accent-2)", "var(--ok)", "var(--warn)"];
  const bounds = log.getBoundingClientRect();
  for (let i = 0; i < 22; i++) {
    const dot = document.createElement("span");
    dot.className = "confetti-dot";
    dot.style.left = `${bounds.left + Math.random() * bounds.width}px`;
    dot.style.background = colors[i % colors.length];
    dot.style.animationDelay = `${Math.random() * 250}ms`;
    document.body.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  }
}

/* ── Run lifecycle ──────────────────────────────────────────────── */
function setRunning(active) {
  running = active;
  startBtn.disabled = active || profileSelect.options.length === 0;
  spinner.hidden = !active;
  startLabel.textContent = active ? "Running" : "Start";
  stopBtn.disabled = !active;
  stopBtn.textContent = "Stop";
  for (const el of [profileSelect, reloadBtn, countInput, minInput, maxInput, headlessToggle]) {
    el.disabled = active;
  }
  document.querySelectorAll(".step-btn").forEach((b) => (b.disabled = active));

  headMascot.hidden = false;
  headMascot.classList.toggle("m-running", active);
}

function finishRun() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  setRunning(false);
}

startBtn.addEventListener("click", async () => {
  if (running) return;
  const body = {
    profile: profileSelect.value,
    count: parseInt(countInput.value, 10) || 1,
    min_delay: parseFloat(minInput.value) || 0,
    max_delay: parseFloat(maxInput.value) || 0,
    headless: headlessToggle.getAttribute("aria-checked") === "true",
  };

  let res;
  try {
    res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    addSystemRow("Could not reach the server. Is uvicorn running?");
    return;
  }
  if (res.status === 409) {
    addSystemRow("A run is already in progress.");
    return;
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail;
    addSystemRow(`Could not start run: ${detail || res.statusText}`);
    return;
  }

  const { run_id } = await res.json();
  empty.hidden = true;
  log.querySelectorAll(".row").forEach((r) => r.remove());
  channelLabel.textContent = body.profile;
  headMascot.classList.remove("m-done");
  updateProgress({ done: 0, total: body.count, ok: 0, skipped: 0 });
  setRunning(true);
  announcer.textContent = `Run started: ${body.count} submissions to ${body.profile}.`;

  eventSource = new EventSource(`/api/stream/${run_id}`);
  eventSource.onmessage = (e) => handleEvent(JSON.parse(e.data));
  eventSource.onerror = () => {
    if (!running) return;
    addSystemRow("Lost connection to the run stream.");
    announcer.textContent = "Lost connection to the run stream.";
    finishRun();
  };
});

stopBtn.addEventListener("click", async () => {
  stopBtn.disabled = true;
  stopBtn.textContent = "Stopping…";
  announcer.textContent = "Stopping after the current submission.";
  await fetch("/api/stop", { method: "POST" }).catch(() => {});
});

function handleEvent(event) {
  switch (event.type) {
    case "log":
      addLogRow(event);
      break;
    case "progress":
      updateProgress(event);
      break;
    case "done":
      addSystemRow(`Run complete: ${event.ok} of ${event.total} ok.`);
      announcer.textContent = `Run complete: ${event.ok} of ${event.total} ok.`;
      finishRun();
      headMascot.classList.add("m-done");
      if (event.ok > 0) confetti();
      break;
  }
}

/* ── Boot ───────────────────────────────────────────────────────── */
lucide.createIcons();
updateProgress({ done: 0, total: 0, ok: 0, skipped: 0 });
loadProfiles();
