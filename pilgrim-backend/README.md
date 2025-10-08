# Pilgrim Management Backend (Express + SQLite)

This is a Node.js Express backend using SQLite (better-sqlite3) for a pilgrim management system. It provides endpoints for signup, login, and CRUD for pilgrims, agents, and admins. Ready for deployment to Render.

## Features
- Express.js REST API
- SQLite database (single file)
- Endpoints for signup, login, and CRUD for pilgrims, agents, admins
- Easy deployment to Render

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the server:
   ```sh
   npm start
   ```

## Endpoints
- POST /signup
- POST /login
- CRUD for /pilgrims, /agents, /admins

## Notes
- Database file: `database.sqlite`
- For demo use only. Not production-hardened.
