# MyTube API

FastAPI backend for MyTube — user accounts, real YouTube playlist/channel import via the official YouTube Data API v3, and study progress tracking. Pairs with the `mytube` static frontend.

> Built in a sandbox with no internet access, so it's syntax-checked (`ast.parse` on every file) but not yet run end-to-end. Follow the steps below on your own machine, where `pip install` and calls to Google's API will actually work.

## 1. Set up

```bash
cd mytube-backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

## 2. Get a YouTube Data API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create (or pick) a project.
2. **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials** → **Create Credentials → API key**.
4. Optional but recommended: click the key → **Restrict key** → limit it to "YouTube Data API v3" so it can't be used for anything else if leaked.
5. Paste it into `.env` as `YOUTUBE_API_KEY=...`.

The free quota is 10,000 units/day. Reading a playlist costs ~1–3 units per page of 50 videos, so this comfortably supports personal/small-scale use.

## 3. Set a real secret key

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Paste the output into `.env` as `SECRET_KEY`. This signs login tokens — don't skip it.

## 4. Run it

```bash
uvicorn app.main:app --reload
```

Visit `http://127.0.0.1:8000/docs` for interactive Swagger docs (try every endpoint right from the browser). `http://127.0.0.1:8000/health` should return `{"status": "ok"}`.

## API overview

All endpoints except `/auth/register`, `/auth/login`, and `/health` require an `Authorization: Bearer <token>` header.

| Method | Path | What it does |
|---|---|---|
| POST | `/auth/register` | Create an account, returns a token |
| POST | `/auth/login` | Log in (form fields: `username`=email, `password`), returns a token |
| GET | `/auth/me` | Current user info |
| GET | `/settings` | Get study/appearance/notification settings |
| PUT | `/settings` | Update settings (partial updates OK) |
| GET | `/playlists` | List your playlists, each with its videos |
| POST | `/playlists/from-youtube` | `{"url": "..."}` — imports a real YouTube playlist |
| GET | `/playlists/{id}` | One playlist with videos |
| DELETE | `/playlists/{id}` | Remove a playlist |
| PATCH | `/playlists/{id}/videos/{video_id}` | `{"completed": true}` — mark watched |
| GET | `/channels` | List your added channels |
| GET | `/channels/{id}` | One channel's details |
| POST | `/channels/resolve` | `{"url": "..."}` — looks up a channel, returns candidate playlists/videos to choose from (nothing saved yet) |
| POST | `/channels/confirm` | Saves a **new** channel + only the playlists/videos the user checked |
| POST | `/channels/{id}/add-content` | Adds more selected playlists/videos onto a channel that **already exists** (no duplicate channel row) |
| DELETE | `/channels/{id}` | Remove a channel (and its playlists) |
| GET | `/progress/summary` | Total minutes, videos completed, sessions, streak |
| GET | `/progress/today` | Today's focus minutes, sessions, and videos completed |
| GET | `/progress/weekly` | Last 7 days of focus minutes by weekday |
| GET | `/progress/courses` | Per-playlist completion percentage |
| POST | `/progress/sessions` | `{"minutes": 25, "playlist_id": 1}` — log a completed focus session |

### Example: register → import a playlist

```bash
curl -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password","display_name":"Gam"}'
# → {"access_token": "...", "token_type": "bearer"}

curl -X POST http://127.0.0.1:8000/playlists/from-youtube \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=PLxxxxxxxx"}'
```

### The channel flow is two calls on purpose

It mirrors the frontend's "choose what you want to study" screen:

1. `POST /channels/resolve` — the backend calls YouTube, returns the channel plus up to ~15 candidate playlists and ~10 recent videos. Nothing is written to the database yet.
2. `POST /channels/confirm` — send back the `youtube_channel_id`, the full `playlist_candidates`/`video_candidates` arrays from step 1 (so the backend doesn't need to re-query), and which `selected_playlist_ids`/`selected_video_ids` the user checked. Only those get saved.

## Architecture notes

- **Database**: SQLite by default (`mytube.db`, created automatically on first run) — swap `DATABASE_URL` in `.env` for Postgres in production; SQLAlchemy handles the rest. Schema is created with `Base.metadata.create_all()` on startup rather than migrations — fine for getting started; add [Alembic](https://alembic.sqlalchemy.org/) once the schema needs to evolve without wiping data.
- **Auth**: JWT bearer tokens (7-day expiry), passwords hashed with bcrypt via passlib. No refresh-token flow yet — the frontend can just prompt re-login when a request 401s.
- **YouTube calls**: server-side only, using your API key via `httpx`. The key is never sent to the browser. Only official, public YouTube Data API v3 endpoints are used — no scraping.
- **Streak logic**: computed from `focus_sessions` dates, not stored redundantly — it's derived fresh on every request from actual session history, so it can't drift out of sync.

## Deploying (free-tier options)

**Render.com** is the simplest path:
1. Push this folder to a GitHub repo.
2. New → Web Service → connect the repo.
3. Build command: `pip install -r requirements.txt`. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. Add your `.env` values as environment variables in the dashboard (don't commit `.env`).
5. Add a free Render Postgres instance and point `DATABASE_URL` at it if you want data to survive redeploys (Render's disk is ephemeral on the free tier, so SQLite there will reset periodically).

**Railway.app** works the same way and also offers a free Postgres add-on.

Either way, once deployed, set `CORS_ORIGINS` to your actual frontend URL(s) instead of `*`.

## Connecting the frontend

Done — the `mytube` frontend now calls this API directly instead of using `localStorage` for data. `js/api.js` holds the token and base URL; every page script (`dashboard.js`, `library.js`, `add-content.js`, `playlist.js`, `channel.js`, `progress.js`, `settings.html`) calls `api(...)` instead of reading/writing `localStorage`. `login.html`/`register.html` handle authentication and every protected page calls `requireAuth()` on load.

**Before deploying, update `js/api.js`:**
```js
const API_BASE = 'http://127.0.0.1:8000'; // change to your deployed backend URL
```

And on the backend, set `CORS_ORIGINS` in `.env` to your deployed frontend's URL instead of `*`.
