(() => {
  "use strict";

  // --- Constantes & état ------------------------------------------------
  const RING_CIRCUMFERENCE = 2 * Math.PI * 110; // r=110 dans le SVG
  const STORE_KEY = "pomodoro.state.v1";

  const defaults = {
    cfg: { focus: 25, short: 5, long: 15, interval: 4, auto: false, sound: true },
    mode: "focus",
    cycle: 1,                  // numéro du cycle de focus en cours
    completedFocus: 0,         // total de sessions focus terminées
    focusMinutes: 0,           // total de minutes concentrées
    history: {},               // { "YYYY-MM-DD": { sessions, minutes } }
    histRange: 7,              // fenêtre affichée : 7 ou 30 jours
    tasks: [],                 // { id, text, done, pomos }
    activeTaskId: null,
    theme: "light",
  };

  let state = load();
  let remaining = minutesFor(state.mode) * 60; // secondes restantes
  let total = remaining;
  let ticking = false;
  let intervalId = null;

  // --- Éléments DOM -----------------------------------------------------
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

  // --- Persistance ------------------------------------------------------
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

  // --- Logique du minuteur ---------------------------------------------
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
    els.startBtn.textContent = "Démarrer";
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
      // on compte la minute concentrée à chaque minute pleine écoulée
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
      // journalise dans l'historique du jour
      const day = todayKey();
      const h = state.history[day] || { sessions: 0, minutes: 0 };
      h.sessions++;
      h.minutes += state.cfg.focus;
      state.history[day] = h;
      // crédite la tâche active
      const t = state.tasks.find((x) => x.id === state.activeTaskId && !x.done);
      if (t) t.pomos++;
      // choisit la pause suivante
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

  // --- Rendu ------------------------------------------------------------
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
      state.mode === "focus" ? `Cycle ${state.cycle}`
      : state.mode === "short" ? "Pause courte" : "Pause longue";
    const frac = total > 0 ? remaining / total : 0;
    els.ringFg.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - frac);
    const label = state.mode === "focus" ? "Focus" : "Pause";
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
    const weekdays = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

    // état actif des boutons de plage
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
      // valeur affichée seulement en vue 7 jours (sinon trop dense)
      if (!compact && d.sessions > 0) {
        const v = document.createElement("span");
        v.className = "hist-val";
        v.textContent = d.minutes;
        bar.appendChild(v);
      }
      barWrap.appendChild(bar);
      const lab = document.createElement("span");
      lab.className = "hist-day";
      // 7 j : jour de semaine ; 30 j : numéro du jour tous les 5 jours + aujourd'hui
      if (!compact) lab.textContent = weekdays[d.date.getDay()];
      else if (idx % 5 === 0 || d.key === todayKey()) lab.textContent = d.date.getDate();
      col.append(barWrap, lab);
      els.histChart.appendChild(col);
    });

    const sumMin = days.reduce((a, d) => a + d.minutes, 0);
    const sumSess = days.reduce((a, d) => a + d.sessions, 0);
    const today = state.history[todayKey()] || { sessions: 0, minutes: 0 };
    els.histTotal.innerHTML =
      `Aujourd'hui <b>${today.minutes} min · ${today.sessions} 🍅</b> · ` +
      `${range} j : <b>${sumMin} min · ${sumSess} 🍅</b> · ` +
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
    a.download = `pomodoro-historique-${todayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Analyse un CSV "date,sessions,minutes" -> { "YYYY-MM-DD": {sessions, minutes} }
  function parseCSV(text) {
    const out = {};
    let ok = 0, bad = 0;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const cells = line.split(",").map((c) => c.trim());
      const [date, s, m] = cells;
      if (!date || date.toLowerCase() === "date") continue; // en-tête ignoré
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
        ? `Aucune ligne valide trouvée (${bad} ligne(s) ignorée(s)). Format attendu : date,sessions,minutes`
        : "Le fichier est vide ou ne contient pas de données.");
      return;
    }
    const conflicts = Object.keys(data).filter((k) => state.history[k]).length;
    const msg = `Importer ${ok} jour(s) ?` +
      (conflicts ? `\n${conflicts} date(s) déjà présente(s) seront remplacées.` : "") +
      (bad ? `\n${bad} ligne(s) invalide(s) seront ignorées.` : "");
    if (!confirm(msg)) return;

    // fusion : les dates importées écrasent les mêmes dates
    state.history = { ...state.history, ...data };
    // recalcule les totaux à partir de l'historique fusionné
    state.completedFocus = Object.values(state.history).reduce((a, d) => a + d.sessions, 0);
    state.focusMinutes = Object.values(state.history).reduce((a, d) => a + d.minutes, 0);
    save();
    renderStats();
    renderHistory();
    alert(`Import terminé : ${ok} jour(s) chargé(s).`);
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
      label.title = "Cliquer pour définir comme tâche en cours";
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
      del.title = "Supprimer";
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

  // --- Son & notification ----------------------------------------------
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
    } catch { /* audio indisponible */ }
  }

  function notify() {
    const msg = state.mode === "focus" ? "Session terminée ! Faites une pause ☕" : "Pause finie, au travail 💪";
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Pomodoro", { body: msg });
    }
  }

  // --- Événements -------------------------------------------------------
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
    e.target.value = ""; // permet de réimporter le même fichier
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
        // resynchronise l'horloge si on modifie la durée du mode courant
        if (key === state.mode) reset();
      }
    });
  }

  // Espace = play/pause (hors saisie de texte)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "INPUT") {
      e.preventDefault();
      els.startBtn.click();
    }
  });

  // --- Initialisation ---------------------------------------------------
  applyTheme();
  renderConfigInputs();
  setMode(state.mode, { resetClock: true });
  renderStats();
  renderHistory();
  renderTasks();
})();
