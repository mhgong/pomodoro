(() => {
  "use strict";

  // --- Constants & state ------------------------------------------------
  const RING_CIRCUMFERENCE = 2 * Math.PI * 110; // r=110 in the SVG
  const STORE_KEY = "pomodoro.state.v1";

  const defaults = {
    cfg: { focus: 25, short: 5, long: 15, interval: 4, auto: false, sound: true },
    mode: "focus",
    cycle: 1,                  // current focus round number
    completedFocus: 0,         // total completed focus sessions
    focusMinutes: 0,           // total focused minutes
    history: {},               // { "YYYY-MM-DD": { sessions, minutes } }
    histRange: 7,              // window shown: 7 or 30 days
    tasks: [],                 // { id, text, done, pomos }
    activeTaskId: null,
    theme: "light",
  };

  let state = load();
  let remaining = minutesFor(state.mode) * 60; // seconds remaining
  let total = remaining;
  let ticking = false;
  let intervalId = null;

  // --- DOM elements -----------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const els = {
    time: $("time"),
    roundLabel: $("roundLabel"),
    ringFg: $("ringFg"),
    startBtn: $("startBtn"),
    resetBtn: $("resetBtn"),
    skipBtn: $("skipBtn"),
    modes: document.querySelectorAll(".mode"),
    statSessions: $("statSessions"),
    statMinutes: $("statMinutes"),
    histChart: $("histChart"),
    histTotal: $("histTotal"),
    histRanges: document.querySelectorAll(".hist-range"),
    exportBtn: $("exportBtn"),
    importBtn: $("importBtn"),
    importFile: $("importFile"),
    taskForm: $("taskForm"),
    taskInput: $("taskInput"),
    taskList: $("taskList"),
    emptyHint: $("emptyHint"),
    clearDoneBtn: $("clearDoneBtn"),
    themeBtn: $("themeBtn"),
    cfgFocus: $("cfgFocus"),
    cfgShort: $("cfgShort"),
    cfgLong: $("cfgLong"),
    cfgInterval: $("cfgInterval"),
    cfgAuto: $("cfgAuto"),
    cfgSound: $("cfgSound"),
  };

  els.ringFg.style.strokeDasharray = RING_CIRCUMFERENCE;

  // --- Persistence ------------------------------------------------------
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!saved) return structuredClone(defaults);
      return {
        ...structuredClone(defaults),
        ...saved,
        cfg: { ...defaults.cfg, ...(saved.cfg || {}) },
      };
    } catch {
      return structuredClone(defaults);
    }
  }
  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  // --- Timer logic ------------------------------------------------------
  function minutesFor(mode) {
    return mode === "focus" ? state.cfg.focus
      : mode === "short" ? state.cfg.short
      : state.cfg.long;
  }

  function setMode(mode, { resetClock = true } = {}) {
    state.mode = mode;
    els.modes.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    if (resetClock) {
      stop();
      total = minutesFor(mode) * 60;
      remaining = total;
    }
    renderTimer();
    save();
  }

  function start() {
    if (ticking) return;
    ticking = true;
    els.startBtn.textContent = "Pause";
    intervalId = setInterval(tick, 1000);
  }
  function pause() {
    ticking = false;
    els.startBtn.textContent = "Start";
    clearInterval(intervalId);
  }
  function stop() {
    pause();
  }
  function toggle() {
    ticking ? pause() : start();
  }

  function tick() {
    remaining--;
    if (state.mode === "focus" && remaining >= 0) {
      // focused minutes are counted on each full elapsed minute
    }
    if (remaining <= 0) {
      remaining = 0;
      renderTimer();
      complete();
      return;
    }
    renderTimer();
  }

  function complete() {
    pause();
    if (state.cfg.sound) beep();
    notify();

    if (state.mode === "focus") {
      state.completedFocus++;
      state.focusMinutes += state.cfg.focus;
      // log into today's history
      const day = todayKey();
      const h = state.history[day] || { sessions: 0, minutes: 0 };
      h.sessions++;
      h.minutes += state.cfg.focus;
      state.history[day] = h;
      // credit the active task
      const t = state.tasks.find((x) => x.id === state.activeTaskId && !x.done);
      if (t) t.pomos++;
      // pick the next break
      const next = state.cycle % state.cfg.interval === 0 ? "long" : "short";
      state.cycle++;
      save();
      renderStats();
      renderHistory();
      renderTasks();
      setMode(next);
    } else {
      save();
      setMode("focus");
    }

    if (state.cfg.auto) start();
  }

  function skip() {
    stop();
    if (state.mode === "focus") {
      const next = state.cycle % state.cfg.interval === 0 ? "long" : "short";
      state.cycle++;
      setMode(next);
    } else {
      setMode("focus");
    }
  }

  function reset() {
    stop();
    total = minutesFor(state.mode) * 60;
    remaining = total;
    renderTimer();
  }

  // --- Rendering --------------------------------------------------------
  function todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function renderTimer() {
    const txt = fmt(remaining);
    els.time.textContent = txt;
    els.roundLabel.textContent =
      state.mode === "focus" ? `Round ${state.cycle}`
      : state.mode === "short" ? "Short break" : "Long break";
    const frac = total > 0 ? remaining / total : 0;
    els.ringFg.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - frac);
    const label = state.mode === "focus" ? "Focus" : "Break";
    document.title = `${txt} · ${label} — Pomodoro`;
  }

  function renderStats() {
    els.statSessions.textContent = state.completedFocus;
    els.statMinutes.textContent = state.focusMinutes;
  }

  function renderHistory() {
    const range = state.histRange || 7;
    const compact = range > 7;
    const days = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = todayKey(d);
      const h = state.history[key] || { sessions: 0, minutes: 0 };
      days.push({ key, date: d, ...h });
    }
    const max = Math.max(1, ...days.map((d) => d.minutes));
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // active state of the range buttons
    els.histRanges.forEach((b) => b.classList.toggle("active", +b.dataset.range === range));

    els.histChart.classList.toggle("compact", compact);
    els.histChart.innerHTML = "";
    days.forEach((d, idx) => {
      const col = document.createElement("div");
      col.className = "hist-col" + (d.key === todayKey() ? " today" : "");
      col.title = `${d.key} · ${d.minutes} min · ${d.sessions} 🍅`;
      const barWrap = document.createElement("div");
      barWrap.className = "hist-barwrap";
      const bar = document.createElement("div");
      bar.className = "hist-bar";
      bar.style.height = `${Math.round((d.minutes / max) * 100)}%`;
      // value shown only in the 7-day view (otherwise too dense)
      if (!compact && d.sessions > 0) {
        const v = document.createElement("span");
        v.className = "hist-val";
        v.textContent = d.minutes;
        bar.appendChild(v);
      }
      barWrap.appendChild(bar);
      const lab = document.createElement("span");
      lab.className = "hist-day";
      // 7 d: weekday name; 30 d: day number every 5 days + today
      if (!compact) lab.textContent = weekdays[d.date.getDay()];
      else if (idx % 5 === 0 || d.key === todayKey()) lab.textContent = d.date.getDate();
      col.append(barWrap, lab);
      els.histChart.appendChild(col);
    });

    const sumMin = days.reduce((a, d) => a + d.minutes, 0);
    const sumSess = days.reduce((a, d) => a + d.sessions, 0);
    const today = state.history[todayKey()] || { sessions: 0, minutes: 0 };
    els.histTotal.innerHTML =
      `Today <b>${today.minutes} min · ${today.sessions} 🍅</b> · ` +
      `${range} d: <b>${sumMin} min · ${sumSess} 🍅</b> · ` +
      `total <b>${state.focusMinutes} min · ${state.completedFocus} 🍅</b>`;
  }

  function exportCSV() {
    const keys = Object.keys(state.history).sort();
    const rows = [["date", "sessions", "minutes"]];
    for (const k of keys) {
      rows.push([k, state.history[k].sessions, state.history[k].minutes]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pomodoro-history-${todayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Parse a "date,sessions,minutes" CSV -> { "YYYY-MM-DD": {sessions, minutes} }
  function parseCSV(text) {
    const out = {};
    let ok = 0, bad = 0;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const cells = line.split(",").map((c) => c.trim());
      const [date, s, m] = cells;
      if (!date || date.toLowerCase() === "date") continue; // header ignored
      const sessions = parseInt(s, 10);
      const minutes = parseInt(m, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(sessions) || isNaN(minutes) || sessions < 0 || minutes < 0) {
        bad++;
        continue;
      }
      out[date] = { sessions, minutes };
      ok++;
    }
    return { data: out, ok, bad };
  }

  function importCSV(text) {
    const { data, ok, bad } = parseCSV(text);
    if (ok === 0) {
      alert(bad > 0
        ? `No valid rows found (${bad} row(s) ignored). Expected format: date,sessions,minutes`
        : "The file is empty or contains no data.");
      return;
    }
    const conflicts = Object.keys(data).filter((k) => state.history[k]).length;
    const msg = `Import ${ok} day(s)?` +
      (conflicts ? `\n${conflicts} existing date(s) will be replaced.` : "") +
      (bad ? `\n${bad} invalid row(s) will be ignored.` : "");
    if (!confirm(msg)) return;

    // merge: imported dates overwrite the same dates
    state.history = { ...state.history, ...data };
    // recompute totals from the merged history
    state.completedFocus = Object.values(state.history).reduce((a, d) => a + d.sessions, 0);
    state.focusMinutes = Object.values(state.history).reduce((a, d) => a + d.minutes, 0);
    save();
    renderStats();
    renderHistory();
    alert(`Import complete: ${ok} day(s) loaded.`);
  }

  function renderTasks() {
    els.taskList.innerHTML = "";
    els.emptyHint.style.display = state.tasks.length ? "none" : "block";
    for (const t of state.tasks) {
      const li = document.createElement("li");
      li.className = "task-item" + (t.done ? " done" : "") + (t.id === state.activeTaskId ? " active" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = t.done;
      cb.addEventListener("change", () => {
        t.done = cb.checked;
        if (t.done && state.activeTaskId === t.id) state.activeTaskId = null;
        save();
        renderTasks();
      });

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = t.text;
      label.title = "Click to set as the current task";
      label.addEventListener("click", () => {
        if (t.done) return;
        state.activeTaskId = state.activeTaskId === t.id ? null : t.id;
        save();
        renderTasks();
      });

      const pomos = document.createElement("span");
      pomos.className = "pomos";
      pomos.textContent = "🍅".repeat(Math.min(t.pomos, 8)) + (t.pomos > 8 ? `+${t.pomos - 8}` : "");

      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "✕";
      del.title = "Delete";
      del.addEventListener("click", () => {
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        if (state.activeTaskId === t.id) state.activeTaskId = null;
        save();
        renderTasks();
      });

      li.append(cb, label, pomos, del);
      els.taskList.appendChild(li);
    }
  }

  function renderConfigInputs() {
    els.cfgFocus.value = state.cfg.focus;
    els.cfgShort.value = state.cfg.short;
    els.cfgLong.value = state.cfg.long;
    els.cfgInterval.value = state.cfg.interval;
    els.cfgAuto.checked = state.cfg.auto;
    els.cfgSound.checked = state.cfg.sound;
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    els.themeBtn.textContent = state.theme === "dark" ? "☀️" : "🌙";
  }

  // --- Sound & notification ---------------------------------------------
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [880, 660, 990].forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.frequency.value = freq;
        o.type = "sine";
        o.connect(g);
        g.connect(audioCtx.destination);
        const t0 = now + i * 0.18;
        g.gain.setValueAtTime(0.001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
        o.start(t0);
        o.stop(t0 + 0.18);
      });
    } catch { /* audio unavailable */ }
  }

  function notify() {
    const msg = state.mode === "focus" ? "Session complete! Take a break ☕" : "Break over, back to work 💪";
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Pomodoro", { body: msg });
    }
  }

  // --- Events -----------------------------------------------------------
  els.startBtn.addEventListener("click", () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    toggle();
  });
  els.resetBtn.addEventListener("click", reset);
  els.skipBtn.addEventListener("click", skip);
  els.modes.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

  els.taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.taskInput.value.trim();
    if (!text) return;
    state.tasks.push({ id: Date.now().toString(36), text, done: false, pomos: 0 });
    els.taskInput.value = "";
    save();
    renderTasks();
  });

  els.histRanges.forEach((b) =>
    b.addEventListener("click", () => {
      state.histRange = +b.dataset.range;
      save();
      renderHistory();
    })
  );
  els.exportBtn.addEventListener("click", exportCSV);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importCSV(String(reader.result));
    reader.readAsText(file);
    e.target.value = ""; // allow re-importing the same file
  });

  els.clearDoneBtn.addEventListener("click", () => {
    state.tasks = state.tasks.filter((t) => !t.done);
    save();
    renderTasks();
  });

  els.themeBtn.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    save();
  });

  const cfgMap = {
    cfgFocus: ["focus", true], cfgShort: ["short", true], cfgLong: ["long", true],
    cfgInterval: ["interval", true], cfgAuto: ["auto", false], cfgSound: ["sound", false],
  };
  for (const [id, [key, isNum]] of Object.entries(cfgMap)) {
    els[id].addEventListener("change", () => {
      const el = els[id];
      state.cfg[key] = isNum ? Math.max(1, parseInt(el.value, 10) || 1) : el.checked;
      if (isNum) el.value = state.cfg[key];
      save();
      if (!ticking && (key === state.mode || ["focus", "short", "long"].includes(key))) {
        // resync the clock if the current mode's duration changes
        if (key === state.mode) reset();
      }
    });
  }

  // Space = play/pause (outside text input)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "INPUT") {
      e.preventDefault();
      els.startBtn.click();
    }
  });

  // --- Initialization ---------------------------------------------------
  applyTheme();
  renderConfigInputs();
  setMode(state.mode, { resetClock: true });
  renderStats();
  renderHistory();
  renderTasks();
})();
