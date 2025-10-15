CPANEL DEPLOYMENT
=================

This project builds a Vite React client and an Express backend that serves the built client from `pilgrim-backend/dist`.

Goal: produce a single folder you can upload to cPanel (File Manager) and run as a Node.js app.

Quick prepare steps (run locally before uploading):

1. Install dependencies (if not already):

```powershell
npm ci
```

2. Run the prepare script (this builds the client and copies `dist/` into `pilgrim-backend/dist`):

```powershell
npm run prepare:cpanel
```

3. After the script completes you will have `pilgrim-backend/dist` containing the built client plus the backend files in `pilgrim-backend/`.

4. Zip the `pilgrim-backend` folder and upload it via cPanel File Manager or use FTP/SFTP.

cPanel Node.js setup (one of these must be available on your cPanel account):

- If cPanel supports the "Setup Node.js App" feature:
  - Create an application, set the Application Root to the uploaded `pilgrim-backend` folder.
  - Set the Application startup file to `index.js`.
  - Set the Environment variables (if any): e.g. `PORT`, `TOKEN_SECRET`, `USE_S3`, etc.
  - Install dependencies in cPanel (File Manager > Terminal) or upload `node_modules` from your machine if necessary.

- If cPanel does not support Node.js, you can still host the static built client (the `dist/` folder) as a static site and host the backend elsewhere.

Important notes & troubleshooting
---------------------------------

- cPanel Node.js environments may have different Node versions; ensure compatibility with Node >= 18 if you use modern ESM and APIs.
- The `prepare:cpanel` script copies the built client to `pilgrim-backend/dist`. The backend `index.js` expects this folder to exist and will serve it.
- For persistent storage: the app uses SQLite file `pilgrim-backend/database.sqlite`. On many cPanel setups this will persist, but ensure you place the file in a persistent directory (e.g., outside temporary tmp folders).
- If you use S3 for uploads, set S3 env vars in the cPanel Node app settings.

Security
--------

- Remove or secure debug endpoints (`/_asset-logs`, `/_db-rows`, `/_message-logs`) before deploying to production.
- Set a strong `TOKEN_SECRET` environment variable in cPanel.
