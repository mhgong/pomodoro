# 🍅 Pomodoro · Focus

A Pomodoro timer with task tracking, in pure HTML/CSS/JS — no dependencies, no installation.

## Run

Just open `index.html` in a browser, or serve the folder:

```bash
cd pomodoro
python3 -m http.server 4173
# then open http://localhost:4173
```

## Features

- **Three modes**: Focus (25 min), short break (5 min), long break (15 min).
- **Animated progress ring** and countdown, with the tab title updated live.
- **Tasks**: add, complete, delete, and the "active" task earns a 🍅 each time a focus session finishes.
- **Statistics**: number of completed focus sessions and cumulative minutes.
- **History**: chart over **7 or 30 days** (toggleable), number of 🍅 and minutes per day, plus today / window / all-time totals.
- **CSV export**: a "⬇ CSV" button that downloads the full history (`date,sessions,minutes`) — handy as a durable backup.
- **CSV import**: a "⬆ CSV" button that reloads an exported history. Merge by date (imported dates replace existing ones), invalid rows ignored, totals recomputed automatically.
- **Settings**: customizable durations, number of rounds before the long break, auto-start, end sound.
- **Comfort**: light/dark theme, end sound (Web Audio), browser notifications, `Space` to start/pause.

## Where is the data stored?

Everything lives in the browser's `localStorage`: the data **persists** across sessions and restarts, but stays tied to **this browser + this address (origin)**. It is lost if you clear the site's data, switch browser/device, or use private mode. For a durable backup, export to CSV.

## Files

- `index.html` — structure
- `style.css` — styles + light/dark theme
- `app.js` — all the logic (timer, tasks, persistence)
