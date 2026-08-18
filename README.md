# MyTube

**Your YouTube. Your Playlist. Your Focus.**
A distraction-free study platform for students who use YouTube for educational content. Plain HTML5, CSS3, and vanilla JavaScript (ES6+) — no frameworks, no build step. Backed by the real `mytube-backend` API: user accounts, actual YouTube playlists/channels via the YouTube Data API v3, and server-side progress tracking. No mock data.

## Running it

This is a static site, but it needs the backend running to do anything:

1. Get `mytube-backend` running first (see its README) — by default at `http://127.0.0.1:8000`.
2. Serve this folder:
   ```bash
   npx serve .
   # or
   python3 -m http.server
   ```
3. Open the site, click **Start Studying** to register, or **Log In** if you already have an account.

If your backend runs somewhere other than `http://127.0.0.1:8000`, update `API_BASE` at the top of `js/api.js` first.

## Project structure

```
mytube/
├── index.html            Landing page
├── login.html             Log in
├── register.html          Create an account
├── dashboard.html          Home — continue learning, today's focus, streak
├── library.html            All saved playlists & channels, searchable
├── add-content.html        Add a real YouTube playlist/channel URL, choose what to study
├── playlist.html            Single playlist — video list & progress
├── channel.html              Single channel — selected content + find more
├── study.html                 Study Mode — the core distraction-free screen
├── progress.html               Stats, weekly chart, per-course progress
├── settings.html                Account, study preferences, appearance, notifications
├── css/                  style.css (design system) + one file per page
├── js/
│   ├── app.js             Shared UI utilities: theme, toasts, nav highlighting
│   ├── api.js               Talks to the backend — token storage, fetch wrapper, login/register
│   ├── login.js / register.js
│   └── dashboard.js, library.js, add-content.js, playlist.js, channel.js, progress.js
├── assets/logo.svg
└── README.md
```

## How pages talk to the backend

Every protected page loads `js/app.js` → `js/api.js` → its own page script, and calls `requireAuth()` on load, which bounces to `login.html` if there's no saved token.

- **Dashboard** — `GET /playlists`, `GET /progress/today`, `GET /progress/summary`
- **Library** — `GET /playlists`, `GET /channels`, `DELETE /playlists/{id}`, `DELETE /channels/{id}`
- **Add Content** — `POST /playlists/from-youtube` (real playlist import); `POST /channels/resolve` then `POST /channels/confirm` for the two-step "choose what to study" channel flow
- **Playlist page** — `GET /playlists/{id}`, `PATCH /playlists/{id}/videos/{video_id}`, `DELETE /playlists/{id}`
- **Channel page** — `GET /channels/{id}`, `GET /playlists` (filtered client-side by `channel_id`), and `POST /channels/{id}/add-content` for finding more content from a channel you've already added
- **Study Mode** — `GET /playlists/{id}`, `PATCH .../videos/{video_id}` to mark complete, `POST /progress/sessions` when a focus timer finishes, `GET /settings` for the default timer length
- **Progress** — `GET /progress/summary`, `GET /progress/weekly`, `GET /progress/courses`
- **Settings** — `GET/PUT /settings`, `GET /auth/me`, logout clears the token

The only things still in `localStorage` are the JWT (`mytube_token`) and a cached theme value for instant paint on load — everything else is fetched from the backend.

## What's real vs. still simulated

- **Real**: accounts, playlists/channels imported via the official YouTube Data API v3, video completion state, focus sessions, streak/weekly/course progress — all persisted server-side.
- **Simulated**: the video player itself. Study Mode still shows a mock player (progress bar animates, play/pause toggles) rather than an embedded YouTube player — swapping in a real YouTube IFrame embed is the natural next step once you're ready for actual playback.

## Before deploying

1. In `js/api.js`, set `API_BASE` to your deployed backend's URL.
2. Deploy the backend (see its README — Render/Railway both have free tiers) with a real `YOUTUBE_API_KEY`, `SECRET_KEY`, and `CORS_ORIGINS` set to wherever you host this frontend.
3. Deploy this folder as a static site (Netlify, Vercel, GitHub Pages, or a static site on Render all work — no build step needed).
