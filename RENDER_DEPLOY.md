Render deployment quick-start

This repository is configured to run a single Render Web Service that builds the frontend (Vite) and starts the backend (Express) with one command.

Quick steps (single service)

1. Create a new Web Service on Render
   - Service type: Web Service (Node)
   - Name: agent-pilgrims (or agent-pilgrims-api) — if taken append `-1`
   - Branch: refactor/ui-split-variants (or `master`)
   - Region: Oregon (US West)
   - Root Directory: leave blank (repo root)
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health check path: `/health`

2. Environment variables (Render → Environment)
   - TOKEN_SECRET = <long-random-secret>  (mark as secret)
   - VITE_API_BASE_URL = https://<your-service>.onrender.com
     - Example: `https://agent-pilgrims.onrender.com` (must match service name)
     - NOTE: Vite reads `VITE_` vars at build time; make sure this is set before the build step.
   - USE_S3 = false (or true if you configure S3)
   - If USE_S3=true then set: S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (secrets)

3. How it works
   - `npm start` (root) runs `npm run build:client && npm run start:server`.
     - `build:client` runs Vite build and writes `dist/` at repo root.
     - `start:server` runs `node pilgrim-backend/index.js` which serves API routes and serves static files from `../dist` (repo-root/dist) when present.
   - The backend exposes `/health` for Render to use as a health check.

4. Local testing
   - Install deps: `npm install`
   - Build & start locally (same as Render):
     - PowerShell example:
       ```powershell
       $env:VITE_API_BASE_URL='http://localhost:4000'
       npm start
       ```
   - If port 4000 is in use set PORT before starting:
       ```powershell
       $env:PORT=5000; $env:VITE_API_BASE_URL='http://localhost:5000'; npm start
       ```

5. Notes
   - Static uploads saved to local `/pilgrim-backend/uploads` are ephemeral on Render. Use S3 for persistent file storage.
   - If you change `VITE_API_BASE_URL`, rebuild the frontend so the SPA is built with the correct backend URL.

If you want, I can open a PR from `refactor/ui-split-variants` to your default branch and/or push the branch for you now.
