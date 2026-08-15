# MyTube

**Your YouTube. Your Playlist. Your Focus.**
A distraction-free study platform for students who use YouTube for educational content — built with plain HTML5, CSS3, and vanilla JavaScript (ES6+). No frameworks, no build step.

## Running it

Open `index.html` directly in a browser, or serve the folder locally:

```bash
npx serve .
# or
python3 -m http.server
```

Everything runs client-side. All data (playlists, channels, progress, settings, theme) is stored in `localStorage`, so it persists between visits on the same browser but resets if you clear site data.

## Project structure

```
mytube/
├── index.html          Landing page
├── dashboard.html       Home — continue learning, today's focus, streak
├── library.html         All saved playlists & channels, searchable
├── add-content.html     Add a playlist/channel URL, select what to study
├── playlist.html        Single playlist — video list & progress
├── channel.html          Single channel — selected content + add more
├── study.html            Study Mode — the core distraction-free screen
├── progress.html         Stats, weekly chart, per-course progress
├── settings.html         Account, study preferences, appearance, notifications
├── css/                  style.css (design system) + one file per page
├── js/                   app.js (shared utilities) + one file per page
├── assets/logo.svg
└── README.md
```

## What's real vs. mocked

This is a **frontend prototype**. Playlists, channels, and videos are realistic mock data (CodeWithHarry, freeCodeCamp.org, Apna College, and sample C/Python/Web Dev/DSA courses) seeded into `localStorage` on first load. The video player in Study Mode is a simulated player — it does not embed real YouTube video. No scraping, no unofficial API calls, no attempt to bypass YouTube. Real playback would be added later via YouTube's official embed player / Data API.

## Core features

- **Study Mode** — single-purpose player + queue + focus timer, nothing else on the page
- **Focus timer** — working countdown with 25/50/90/custom presets, start/pause/resume/reset, and a completion celebration
- **Library** — search and filter your saved playlists/channels
- **Add Content** — validate a pasted playlist/channel URL, then choose exactly which playlists or videos to study (no auto-import of a whole channel)
- **Progress** — total study time, streak, weekly activity chart, per-course completion
- **Settings** — dark/light/system theme (persisted), focus duration default, notification toggles

## localStorage keys

| Key | Contents |
|---|---|
| `mytube_playlists` | Array of playlists with their videos & completion state |
| `mytube_channels` | Array of added channels |
| `mytube_progress` | Totals, streak, today's stats, weekly activity |
| `mytube_sessions` | Log of completed focus sessions |
| `mytube_settings` | Study preferences & notification toggles |
| `mytube_theme` | `'dark'` \| `'light'` \| `'system'` |

## Notes for extending

- Swap the mock player in `study.html`/`study.js` for a real YouTube IFrame embed once API access is wired up.
- `add-content.js` and `channel.js` currently offer a small fixed set of mock playlists/videos per added channel — replace with real YouTube Data API results.
- All shared helpers (storage, toasts, theme, id generation, URL validation) live in `js/app.js` so every page script can reuse them.
