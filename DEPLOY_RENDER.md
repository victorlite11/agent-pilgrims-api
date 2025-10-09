# Deploying agent-pilgrims to Render

This short guide explains how to deploy the frontend (Vite + React) and backend (Node/Express + SQLite) to Render. It also lists recommended environment variables and production notes (uploads, persistence, SSE/CORS).

---

## Repo layout
- Frontend: repository root (has `package.json` with `build`/`dev` scripts)
- Backend: `pilgrim-backend/` (has `package.json` with `start` script that runs `node index.js`)

---

## Quick local checks
Build frontend:

```powershell
npm install
npm run build
```

Run backend locally (from `pilgrim-backend`):

```powershell
cd pilgrim-backend
npm install
npm start
# backend listens on process.env.PORT || 4000
```

Visit the frontend with `npm run dev` and the backend at `http://localhost:4000` by default.

---

## Backend (Render) — recommended: Web Service
1. In Render dashboard, click "New" → "Web Service".
2. Connect your GitHub repo and pick branch `refactor/ui-split-variants`.
3. Set the "Root Directory" to `pilgrim-backend`.
4. Build command: (leave blank) — Render runs `npm install` automatically.
5. Start command: `npm start` (already in `pilgrim-backend/package.json`).
6. Set the health check path to `/health` (the backend exposes `/health` and will return `{ ok: true }`).
7. Environment variables (see list below).
8. For uploads and database persistence, either:
   - Attach a Persistent Disk to the service (Render supports persistent disk for web services), or
   - Implement S3 (recommended) and set S3 credentials in environment variables (see below).

Notes:
- Render provides the `PORT` environment variable; the backend reads `process.env.PORT`.
- If you rely on local filesystem uploads (`/uploads`), those are ephemeral unless you configure Persistent Disk or S3.

---

## Frontend (Render) — recommended: Static Site
1. In Render dashboard, click "New" → "Static Site".
2. Connect your GitHub repo and pick branch `refactor/ui-split-variants`.
3. Root directory: repository root (the frontend `package.json` is here).
4. Build command: `npm run build`.
5. Publish directory: `dist`.
6. Environment variables (see list below). Most importantly, set the API base URL the frontend should use:
   - `VITE_API_BASE_URL` = `https://<your-backend-service>.onrender.com` (replace with your backend URL)

Notes:
- Vite embeds `VITE_` prefixed environment variables at build time. Set `VITE_API_BASE_URL` before triggering the static site build on Render.

---

## Suggested environment variables
- For backend (set in the Render Web Service settings):
  - `PORT` — Render sets this automatically.
  - `TOKEN_SECRET` — a long random string used to sign tokens (default in code falls back to `dev-secret-change-me` but you should override in production).
  - `DATABASE_FILE` — optional path to SQLite file if you want to control location (default `database.sqlite`).
  - `USE_S3` — `true` if you switch to S3 uploads.
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` — when using S3 for uploads.
  - `UPLOADS_DIR` — if using persistent disk, point to a folder on the mounted disk.

- For frontend (Static Site settings):
  - `VITE_API_BASE_URL` — e.g. `https://your-backend.onrender.com` (used by the front-end at build time).

---

## Uploads & persistence
- Current backend implementation stores uploads under `pilgrim-backend/uploads/` and uses a SQLite file `database.sqlite` in the backend directory.
- On Render, the container filesystem is ephemeral across deploys and instance restarts. To persist uploads you should:
  1. Use Render's Persistent Disk (attach to web service) and set `UPLOADS_DIR` to a folder on that disk. Update the backend to read `UPLOADS_DIR` from env var (or the existing uploads directory).
  2. Or, better: switch to S3-compatible storage and set `USE_S3` and related AWS env vars. I can add a small adapter to write to S3 if you want.

---

## CORS / SSE
- The backend sets `Access-Control-Allow-Origin: *` for SSE endpoints; if you tighten CORS for production make sure to allow your frontend origin (e.g., `https://your-frontend.onrender.com`).
- Server-Sent Events (EventSource) are used for real-time updates. If you deploy frontend and backend on different domains ensure CORS allows EventSource connections.

---

## Troubleshooting
- Blank page / runtime module errors: ensure the branch deployed contains the latest compiled frontend (rebuild after updating `VITE_API_BASE_URL`).
- Uploads return 404 after deploy: check whether uploads persist (if you didn't mount persistent disk or use S3 they will be missing); examine backend logs for upload paths.
- Backend failing to boot: check logs for database migration errors; ensure `DATABASE_FILE` path points to writable location.

---

## Optional follow-ups I can do for you
- Add S3 upload adapter and env var wiring (so uploads persist across deploys).
- Add a small README entry in the project root (this file is saved as `DEPLOY_RENDER.md`).
- Create a PR from `refactor/ui-split-variants` to `master` and open it in GitHub.

If you want me to push additional helpers (S3 adapter or an env var loader), tell me which option and I'll implement it and push the changes to `refactor/ui-split-variants`.

---

## Enabling S3 uploads (optional)
The backend contains optional S3 support. To enable uploads to S3 instead of local disk:

1. In Render Web Service environment, set:
  - `USE_S3` = `true`
  - `S3_BUCKET` = your bucket name
  - `S3_REGION` = region (e.g., `us-east-1`)
  - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (or configure instance role)
  - `S3_PUBLIC` = `true` if your bucket objects should be public (optional)
  - `S3_ENDPOINT` = (optional) for S3-compatible providers or custom endpoints

2. Deploy. The `/upload` endpoint will accept multipart `file` and upload to S3. The response will include `fileUrl` which is either a public S3 URL (if `S3_PUBLIC=true`) or a signed URL (default).

3. For the frontend, you don't need to change upload code — the backend returns a `fileUrl` which the frontend uses for preview/download links.

Notes:
- If you prefer signed URLs with different expiry, I can change the expiry or return both a public URL and a signed URL, depending on your security posture.
- Be sure to restrict bucket permissions in production.
