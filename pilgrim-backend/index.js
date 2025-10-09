const express = require('express');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');
const bodyParser = require('body-parser');

let db;

const PORT = process.env.PORT || 4000;

async function main() {
  // ...existing code...
  // ...existing code...
  // ...existing code...

  // ...existing code...
  // ...existing code...

  // ...existing code...
  // ...existing code...

  // ...existing code...
  db = await open({
    filename: "database.sqlite",
    driver: sqlite3.Database
  });
  
  await db.exec(`CREATE TABLE IF NOT EXISTS pilgrims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    passportNumber TEXT,
    status TEXT DEFAULT 'pending',
    agentId INTEGER,
    registeredBy TEXT,
    progress INTEGER,
    registrationDate TEXT,
    registrationSubmitted INTEGER,
    rejectionCount INTEGER DEFAULT 0,
    acceptanceCount INTEGER DEFAULT 0,
    travelHistory TEXT DEFAULT '',
    currentJourneyStatus TEXT DEFAULT 'not started'
  );`);
  
  await db.exec(`CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    status TEXT,
    joined TEXT
  );`);
  
  await db.exec(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT
  );`);
  
  await db.exec(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pilgrimId INTEGER,
    name TEXT,
    status TEXT,
    date TEXT,
    fileUrl TEXT
  );`);

  await db.exec(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pilgrimId INTEGER,
    sender TEXT,
    message TEXT,
    timestamp TEXT,
    fileUrl TEXT,
    fileType TEXT
  );`);

  await db.exec(`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    userType TEXT,
    action TEXT,
    details TEXT,
    date TEXT
  );`);

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // If a built frontend exists at ../dist, serve it as static files so
  // Render can host the frontend and backend with a single service.
  try {
    const path = require('path');
    const fs = require('fs');
    const clientBuildPath = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(clientBuildPath)) {
      console.log('[STATIC] Serving client build from', clientBuildPath);
      app.use(express.static(clientBuildPath));
      // For client-side routing, return index.html for GET requests that
      // appear to want HTML (skip API, uploads, and non-GET requests).
      app.get('*', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const accept = (req.get('accept') || '').toLowerCase();
        if (!accept.includes('text/html')) return next();
        if (req.path.startsWith('/uploads')) return next();
        // Serve index.html so the SPA can handle routing
        return res.sendFile(path.join(clientBuildPath, 'index.html'));
      });
    }
  } catch (e) {
    console.warn('[STATIC] Error while configuring static client serve', e && e.message);
  }

    // Debug endpoint: report whether the built client files exist and list assets.
    // Useful to call from Render after deploy to confirm files were produced and are reachable.
    app.get('/_static-check', (req, res) => {
      try {
        const path = require('path');
        const fs = require('fs');
        const clientBuildPath = path.join(__dirname, '..', 'dist');
        const assetsDir = path.join(clientBuildPath, 'assets');
        const exists = fs.existsSync(clientBuildPath);
        const assetsExist = fs.existsSync(assetsDir);
        const files = assetsExist ? fs.readdirSync(assetsDir) : [];
        return res.json({ clientBuildPath, exists, assetsExist, assetCount: files.length, files });
      } catch (e) {
        return res.status(500).json({ error: String(e && e.message ? e.message : e) });
      }
    });

  const USE_S3 = (process.env.USE_S3 || 'false').toLowerCase() === 'true';
  let s3Client = null;
  const S3_BUCKET = process.env.S3_BUCKET || null;
  const S3_REGION = process.env.S3_REGION || null;
  const S3_ENDPOINT = process.env.S3_ENDPOINT || null;
  if (USE_S3) {
    try {
      const { S3Client } = require("@aws-sdk/client-s3");
      const creds = {};
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        creds.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
      }
      const s3Opts = { region: S3_REGION || undefined, ...creds };
      if (S3_ENDPOINT) s3Opts.endpoint = S3_ENDPOINT;
      s3Client = new S3Client(s3Opts);
      console.log('[S3] S3 client configured', { bucket: S3_BUCKET, region: S3_REGION, endpoint: S3_ENDPOINT });
    } catch (e) {
      console.warn('[S3] Failed to configure S3 client', e.message || e);
      s3Client = null;
    }
  }

  // Simple token helpers using built-in crypto (no external deps)
  const crypto = require('crypto');
  const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';
  function signToken(payload) {
    const json = JSON.stringify({ ...payload, iat: Date.now() });
    const b = Buffer.from(json).toString('base64');
    const h = crypto.createHmac('sha256', TOKEN_SECRET).update(b).digest('hex');
    return `${b}.${h}`;
  }
  function verifyToken(token) {
    try {
      const [b, h] = token.split('.');
      if (!b || !h) return null;
      const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(b).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h))) return null;
      const json = Buffer.from(b, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
  const parseAuth = (req) => {
    const auth = req.get('authorization') || req.query.token || '';
    if (!auth) return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const token = m ? m[1] : auth;
    return verifyToken(token);
  };

  // --- Simple DB migrations: ensure optional columns exist on older DBs ---
  try {
    const ensureColumn = async (table, column, definition) => {
      const cols = await db.all(`PRAGMA table_info(${table})`);
      const names = cols.map(c => c.name);
      if (!names.includes(column)) {
        console.log(`[MIGRATE] Adding column ${column} to ${table}`);
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    };
    // Ensure optional columns exist on older databases
    // Documents table may be from an older schema without fileUrl/date
    await ensureColumn('documents', 'fileUrl', 'TEXT');
    await ensureColumn('documents', 'date', 'TEXT');
    // Messages optional columns
    await ensureColumn('messages', 'fileUrl', 'TEXT');
    await ensureColumn('messages', 'fileType', 'TEXT');
    // add agentId to messages to support agent-targeted messages
    await ensureColumn('messages', 'agentId', 'INTEGER');
    // ensure pilgrims has passportNumber column (older DBs may not)
    await ensureColumn('pilgrims', 'passportNumber', 'TEXT');
  } catch (e) {
    console.error('[MIGRATION ERROR]', e);
  }

  // Simple SSE clients map: pilgrimId -> Set of response objects
  const sseClients = new Map();
  // Activity SSE clients (system-wide)
  const activitySseClients = new Set();

  // File upload support
  const path = require('path');
  const fs = require('fs');
  const multer = require('multer');
  const uploadDir = path.join(__dirname, 'uploads');
  // If not using S3, keep the existing disk storage (and static serving). If using S3, use memoryStorage and upload to S3.
  if (!USE_S3) {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
  }
  const storage = USE_S3 ? multer.memoryStorage() : multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });
  const upload = multer({ storage });

  app.post('/upload', upload.single('file'), (req, res) => {
    console.log('[UPLOAD] Incoming upload request', { originalname: req.file && req.file.originalname });
    if (!req.file) {
      console.warn('[UPLOAD] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // If S3 is enabled and configured, upload the file buffer to S3 and return the S3 URL.
    if (USE_S3 && s3Client && S3_BUCKET) {
      (async () => {
        try {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          // derive key from original filename
          const key = `${uniqueSuffix}-${req.file.originalname}`.replace(/\s+/g, '_');
          const { PutObjectCommand } = require('@aws-sdk/client-s3');
          const put = new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            // Note: public-read may be required if bucket is public; see docs
            ACL: process.env.S3_PUBLIC === 'true' ? 'public-read' : undefined,
          });
          await s3Client.send(put);
          // Construct file URL. If a custom endpoint is provided use that.
          let fileUrl;
          if (S3_ENDPOINT) {
            // If endpoint includes protocol and host, use it
            fileUrl = `${S3_ENDPOINT.replace(/\/$/, '')}/${key}`;
          } else if (process.env.S3_PUBLIC === 'true') {
            fileUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
          } else {
            // Fallback to signed URL for private buckets (short expiry)
            try {
              const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
              const { GetObjectCommand } = require('@aws-sdk/client-s3');
              fileUrl = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn: 60 * 60 * 24 });
            } catch (e) {
              // If presigner unavailable, return S3 object URL (may be private)
              fileUrl = `s3://${S3_BUCKET}/${key}`;
            }
          }
          console.log('[UPLOAD][S3] Uploaded', { key, url: fileUrl });
          res.json({ fileUrl });
        } catch (e) {
          console.error('[UPLOAD][S3] upload error', e);
          return res.status(500).json({ error: 'S3 upload failed', details: e.message });
        }
      })();
      return;
    }
    // default: serve from local uploads folder
    const fileUrl = `/uploads/${req.file.filename}`;
    console.log('[UPLOAD] Saved file', { filename: req.file.filename, url: fileUrl });
    res.json({ fileUrl });
  });

  // Serve uploaded files statically when not using S3
  if (!USE_S3) {
    app.use('/uploads', express.static(uploadDir));
  }

  // Signup endpoint (role: pilgrim, agent, admin)
  app.post("/signup", async (req, res) => {
    const { name, email, password, role, passportNumber, agentId } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: "Missing fields" });
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log(`[SIGNUP] Role: ${role}, Email: ${email}`);
      if (role === 'pilgrim') {
        // For pilgrims we support optional passportNumber and agentId
        // If agentId not provided, auto-assign to the agent with the least pilgrims
        let assignedAgentId = agentId || null;
        if (!assignedAgentId) {
          try {
            const row = await db.get(`SELECT agents.id, (SELECT COUNT(*) FROM pilgrims WHERE agentId = agents.id) as cnt FROM agents ORDER BY cnt ASC LIMIT 1`);
            if (row && row.id) assignedAgentId = row.id;
          } catch (e) {
            console.warn('[AUTO-ASSIGN] failed to find agent', e);
          }
        }
        const info = await db.run(
          `INSERT INTO pilgrims (name, email, password, passportNumber, agentId, status, registrationDate) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [name, email, hashedPassword, passportNumber || null, assignedAgentId || null, 'pending', new Date().toISOString()]
        );
        res.json({ success: true, id: info.lastID, assignedAgentId });
        return;
      }
      // fallback: insert into agents or admins tables
      const table = role + "s";
      await db.run(`INSERT INTO ${table} (name, email, password) VALUES (?, ?, ?);`, [name, email, hashedPassword]);
      res.json({ success: true });
    } catch (e) {
      console.error('[SIGNUP ERROR]', e && e.stack ? e.stack : e);
      try { console.error('[SIGNUP] req.body (no password):', { email: req.body && req.body.email, role: req.body && req.body.role }); } catch (__) {}
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password || !role) return res.status(400).json({ error: "Missing fields" });
      let table = role + "s";
      const user = await db.get(`SELECT * FROM ${table} WHERE email = ?`, [email]);
      if (!user) {
        console.log(`[LOGIN] No user found for email: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.password);
      console.log(`[LOGIN] Email: ${email}, DB Hash present: ${!!user.password}, Valid: ${valid}`);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });
      // Don't send password hash to client
      const { password: _, ...userSafe } = user;
      // Issue a simple token with role and id
      const token = signToken({ id: userSafe.id, role });
      res.json({ success: true, user: userSafe, token });
    } catch (e) {
      console.error('[LOGIN ERROR]', e && e.stack ? e.stack : e);
      try { console.error('[LOGIN] req.body (no password):', { email: req.body && req.body.email, role: req.body && req.body.role }); } catch (__) {}
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // CRUD endpoints for pilgrims
  app.get("/pilgrims", async (req, res) => {
    const { agentId } = req.query;
    // If request is from an authenticated agent, ensure they only get their own pilgrims
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      const myId = String(auth.id);
      // ignore any agentId query and return only pilgrims assigned to this agent
      const pilgrims = await db.all("SELECT * FROM pilgrims WHERE agentId = ?", [myId]);
      return res.json(pilgrims);
    }
    // Public or admin: allow filtering by agentId or return all
    let pilgrims;
    if (agentId) {
      pilgrims = await db.all("SELECT * FROM pilgrims WHERE agentId = ?", [agentId]);
    } else {
      pilgrims = await db.all("SELECT * FROM pilgrims");
    }
    res.json(pilgrims);
  });
  
  app.get("/pilgrims/:id", async (req, res) => {
    const pilgrim = await db.get("SELECT * FROM pilgrims WHERE id = ?", [req.params.id]);
    if (!pilgrim) return res.status(404).json({ error: "Not found" });
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(pilgrim);
  });

  // Return the agent assigned to a pilgrim
  app.get('/pilgrims/:id/agent', async (req, res) => {
    const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [req.params.id]);
    if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
    if (!pilgrim.agentId) return res.status(404).json({ error: 'No agent assigned' });
    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [pilgrim.agentId]);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  });
  
  app.post("/pilgrims", async (req, res) => {
    const { name, email, password, passportNumber, status, agentId, registeredBy, progress, registrationDate, registrationSubmitted, rejectionCount, acceptanceCount, travelHistory, currentJourneyStatus } = req.body;
    if (!name || !email || !password || !passportNumber) return res.status(400).json({ error: "Missing fields" });
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = await db.run(
        `INSERT INTO pilgrims (name, email, password, passportNumber, status, agentId, registeredBy, progress, registrationDate, registrationSubmitted, rejectionCount, acceptanceCount, travelHistory, currentJourneyStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, hashedPassword, passportNumber, status || 'pending', agentId || null, registeredBy || '', progress || 0, registrationDate || new Date().toISOString(), registrationSubmitted || 0, rejectionCount || 0, acceptanceCount || 0, travelHistory || '', currentJourneyStatus || 'not started']
      );
      res.json({ id: info.lastID });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.put("/pilgrims/:id", async (req, res) => {
  const { name, email, password, passportNumber, status, agentId, registeredBy, progress, registrationDate, registrationSubmitted, rejectionCount, acceptanceCount, travelHistory, currentJourneyStatus } = req.body;
  const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;
  const fields = [];
  const values = [];
  if (name) { fields.push('name=?'); values.push(name); }
  if (email) { fields.push('email=?'); values.push(email); }
  if (passportNumber) { fields.push('passportNumber=?'); values.push(passportNumber); }
  if (status) { fields.push('status=?'); values.push(status); }
  if (agentId !== undefined) { fields.push('agentId=?'); values.push(agentId); }
  if (registeredBy) { fields.push('registeredBy=?'); values.push(registeredBy); }
  if (progress !== undefined) { fields.push('progress=?'); values.push(progress); }
  if (registrationDate) { fields.push('registrationDate=?'); values.push(registrationDate); }
  if (registrationSubmitted !== undefined) { fields.push('registrationSubmitted=?'); values.push(registrationSubmitted); }
  if (rejectionCount !== undefined) { fields.push('rejectionCount=?'); values.push(rejectionCount); }
  if (acceptanceCount !== undefined) { fields.push('acceptanceCount=?'); values.push(acceptanceCount); }
  if (travelHistory) { fields.push('travelHistory=?'); values.push(travelHistory); }
  if (currentJourneyStatus) { fields.push('currentJourneyStatus=?'); values.push(currentJourneyStatus); }
  if (hashedPassword) { fields.push('password=?'); values.push(hashedPassword); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  await db.run(`UPDATE pilgrims SET ${fields.join(', ')} WHERE id=?`, values);
  res.json({ success: true });
  });
  
  app.delete("/pilgrims/:id", async (req, res) => {
    await db.run("DELETE FROM pilgrims WHERE id=?", [req.params.id]);
    res.json({ success: true });
  });

  // CRUD endpoints for agents
  app.get("/agents", async (req, res) => {
    const agents = await db.all("SELECT * FROM agents");
    res.json(agents);
  });
  
  app.get("/agents/:id", async (req, res) => {
    const agent = await db.get("SELECT * FROM agents WHERE id = ?", [req.params.id]);
    if (!agent) return res.status(404).json({ error: "Not found" });
    res.json(agent);
  });
  
  app.post("/agents", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = await db.run("INSERT INTO agents (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword]);
      res.json({ id: info.lastID });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  

  // PATCH agent status only
  app.patch("/agents/:id", async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Missing status' });
    await db.run("UPDATE agents SET status=? WHERE id=?", [status, req.params.id]);
    res.json({ success: true });
  });

  app.put("/agents/:id", async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run("UPDATE agents SET name=?, email=?, password=? WHERE id=?", [name, email, hashedPassword, req.params.id]);
    res.json({ success: true });
  });
  
  app.delete("/agents/:id", async (req, res) => {
    await db.run("DELETE FROM agents WHERE id=?", [req.params.id]);
    res.json({ success: true });
  });

  // Simple stats endpoint for admin reports
  app.get('/stats', async (req, res) => {
    try {
      const totalPilgrimsRow = await db.get('SELECT COUNT(*) as count FROM pilgrims');
      const bannedPilgrimsRow = await db.get("SELECT COUNT(*) as count FROM pilgrims WHERE status = 'Banned'");
      const activeRegistrationsRow = await db.get("SELECT COUNT(*) as count FROM pilgrims WHERE status = 'pending'");
      // If you have a payments table, compute totalRevenue; otherwise return 0
      let totalRevenue = 0;
      try {
        const revRow = await db.get('SELECT SUM(amount) as total FROM payments');
        totalRevenue = revRow && revRow.total ? revRow.total : 0;
      } catch (e) {
        // payments table may not exist in current schema
        totalRevenue = 0;
      }
      res.json({
        totalPilgrims: totalPilgrimsRow?.count || 0,
        bannedPilgrims: bannedPilgrimsRow?.count || 0,
        activeRegistrations: activeRegistrationsRow?.count || 0,
        totalRevenue
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to compute stats' });
    }
  });

  // CRUD endpoints for admins
  app.get("/admins", async (req, res) => {
    const admins = await db.all("SELECT * FROM admins");
    res.json(admins);
  });
  
  app.get("/admins/:id", async (req, res) => {
    const admin = await db.get("SELECT * FROM admins WHERE id = ?", [req.params.id]);
    if (!admin) return res.status(404).json({ error: "Not found" });
    res.json(admin);
  });
  
  app.post("/admins", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = await db.run("INSERT INTO admins (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword]);
      res.json({ id: info.lastID });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  
  app.put("/admins/:id", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  await db.run("UPDATE admins SET name=?, email=?, password=? WHERE id=?", [name, email, hashedPassword, req.params.id]);
  res.json({ success: true });
  });
  
  app.delete("/admins/:id", async (req, res) => {
    await db.run("DELETE FROM admins WHERE id=?", [req.params.id]);
    res.json({ success: true });
  });

  // --- DOCUMENTS ENDPOINTS ---
  app.get("/documents", async (req, res) => {
    const { pilgrimId } = req.query;
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      // Agents can only access documents for pilgrims assigned to them
      const myId = String(auth.id);
      if (pilgrimId) {
        // check pilgrim ownership
        const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [pilgrimId]);
        if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
        if (String(pilgrim.agentId) !== String(myId)) return res.status(403).json({ error: 'Forbidden' });
        const docs = await db.all('SELECT * FROM documents WHERE pilgrimId = ?', [pilgrimId]);
        return res.json(docs);
      }
      // no pilgrimId provided: return documents for pilgrims assigned to this agent
      const docs = await db.all('SELECT d.* FROM documents d JOIN pilgrims p ON p.id = d.pilgrimId WHERE p.agentId = ?', [myId]);
      return res.json(docs);
    }
    // Public/admin
    let docs;
    if (pilgrimId) {
      docs = await db.all("SELECT * FROM documents WHERE pilgrimId = ?", [pilgrimId]);
    } else {
      docs = await db.all("SELECT * FROM documents");
    }
    res.json(docs);
  });
  
  app.post("/documents", async (req, res) => {
    const { pilgrimId, name, status, date, fileUrl } = req.body;
    if (!pilgrimId || !name || !status) return res.status(400).json({ error: "Missing fields" });
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      // agents can only create documents for pilgrims assigned to them
      const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [pilgrimId]);
      if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
      if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
    }
    const info = await db.run("INSERT INTO documents (pilgrimId, name, status, date, fileUrl) VALUES (?, ?, ?, ?, ?)", [pilgrimId, name, status, date || new Date().toISOString(), fileUrl || null]);
    const newDoc = { id: info.lastID, pilgrimId, name, status, date: date || new Date().toISOString(), fileUrl: fileUrl || null };
    // Notify SSE clients for pilgrim and agent and activity stream
    try {
      // fetch pilgrim to discover agent
      const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [pilgrimId]);
      const agentId = pilgrim ? pilgrim.agentId : null;
      const payload = JSON.stringify({ type: 'document', document: newDoc });
      // notify pilgrim stream
      const pkey = `pilgrim:${pilgrimId}`;
      if (sseClients.has(pkey)) {
        for (const clientRes of sseClients.get(pkey)) {
          try { clientRes.write(`data: ${payload}\n\n`); } catch (e) { /* ignore per-client */ }
        }
      }
      // notify agent stream
      if (agentId) {
        const akey = `agent:${agentId}`;
        if (sseClients.has(akey)) {
          for (const clientRes of sseClients.get(akey)) {
            try { clientRes.write(`data: ${payload}\n\n`); } catch (e) { /* ignore per-client */ }
          }
        }
      }
      // log activity for admin dashboards
      const infoAct = await db.run("INSERT INTO activity_log (userId, userType, action, details, date) VALUES (?, ?, ?, ?, ?)", [pilgrimId, 'pilgrim', 'Document Uploaded', `${name} uploaded`, new Date().toISOString()]);
      const newEntry = { id: infoAct.lastID, userId: pilgrimId, userType: 'pilgrim', action: 'Document Uploaded', details: `${name} uploaded`, date: new Date().toISOString() };
      const apayload = JSON.stringify(newEntry);
      for (const clientRes of activitySseClients) {
        try { clientRes.write(`data: ${apayload}\n\n`); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.error('[DOCUMENTS SSE NOTIFY ERROR]', e);
    }
    res.json({ id: info.lastID });
  });

  // SSE endpoint for document events (pilgrim or agent scoped)
  app.get('/documents/stream', (req, res) => {
    const { pilgrimId, agentId } = req.query;
    if (!pilgrimId && !agentId) return res.status(400).json({ error: 'pilgrimId or agentId required' });
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      // agent must only open stream for pilgrims assigned to them or for their agentId
      if (pilgrimId) {
        (async () => {
          const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [pilgrimId]);
          if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
          if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
        })();
      }
      if (agentId && String(agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.write(': connected\n\n');
    if (res.flushHeaders) try { res.flushHeaders(); } catch (e) { /* ignore */ }
    const key = pilgrimId ? `pilgrim:${pilgrimId}` : `agent:${agentId}`;
    if (!sseClients.has(key)) sseClients.set(key, new Set());
    const clients = sseClients.get(key);
    clients.add(res);
    req.on('close', () => { clients.delete(res); });
  });
  
  app.patch("/documents/:id", async (req, res) => {
    const { status, date, fileUrl } = req.body;
    const fields = [];
    const values = [];
    if (status) { fields.push('status=?'); values.push(status); }
    if (date) { fields.push('date=?'); values.push(date); }
    if (fileUrl) { fields.push('fileUrl=?'); values.push(fileUrl); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    // Authorization: if agent, ensure they own the pilgrim for this document
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [doc.pilgrimId]);
      if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
      if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
    }
    values.push(req.params.id);
    await db.run(`UPDATE documents SET ${fields.join(', ')} WHERE id=?`, values);
    res.json({ success: true });
  });
  
  app.delete("/documents/:id", async (req, res) => {
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [doc.pilgrimId]);
      if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
      if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
    }
    await db.run("DELETE FROM documents WHERE id=?", [req.params.id]);
    res.json({ success: true });
  });

  // --- MESSAGES ENDPOINTS ---
  app.get("/messages", async (req, res) => {
    const { pilgrimId, agentId } = req.query;
    let msgs;
    // Only log truly malformed/no-target requests to avoid poll noise
    if (!pilgrimId && !agentId) {
      const ua = req.get('user-agent') || 'unknown-agent';
      console.log('[MESSAGES] GET request (no target)', { pilgrimId, agentId, ip: req.ip, url: req.originalUrl, userAgent: ua });
    }
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      // agents may only access messages for pilgrims assigned to them
      if (!pilgrimId) return res.status(400).json({ error: 'pilgrimId required for agent' });
      const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [pilgrimId]);
      if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
      if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
      msgs = await db.all("SELECT * FROM messages WHERE pilgrimId = ? ORDER BY timestamp ASC", [pilgrimId]);
    } else {
      if (pilgrimId) {
        msgs = await db.all("SELECT * FROM messages WHERE pilgrimId = ? ORDER BY timestamp ASC", [pilgrimId]);
      } else if (agentId) {
        msgs = await db.all("SELECT * FROM messages WHERE agentId = ? ORDER BY timestamp ASC", [agentId]);
      } else {
        msgs = await db.all("SELECT * FROM messages ORDER BY timestamp ASC");
      }
    }
    res.json(msgs);
  });
  
  // Server-Sent Events endpoint for real-time messages per pilgrim
  app.get('/messages/stream', (req, res) => {
    const { pilgrimId, agentId } = req.query;
    if (!pilgrimId && !agentId) return res.status(400).json({ error: 'pilgrimId or agentId required' });
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      // agent must only open stream for pilgrims assigned to them
      if (!pilgrimId) return res.status(400).json({ error: 'pilgrimId required for agent' });
      // verify ownership
      (async () => {
        const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [pilgrimId]);
        if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
        if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
      })();
    }
    console.log('[SSE] New stream connection', { pilgrimId, agentId });
    // Set headers for SSE without overwriting existing CORS headers
    // (writing headers directly can remove Access-Control-Allow-Origin set by cors middleware)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // allow any origin for now (cors middleware usually handles this, but ensure it's present for SSE)
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Send a comment to establish the stream and keep it alive
    res.write(': connected\n\n');
    // flush headers if available
    if (res.flushHeaders) try { res.flushHeaders(); } catch (e) { /* ignore */ }
    const id = Date.now() + '-' + Math.random();
    const key = pilgrimId ? `pilgrim:${pilgrimId}` : `agent:${agentId}`;
    if (!sseClients.has(key)) sseClients.set(key, new Set());
    const clients = sseClients.get(key);
    clients.add(res);
    req.on('close', () => {
      clients.delete(res);
      console.log('[SSE] Connection closed', { key });
    });
  });
  
  app.post("/messages", async (req, res) => {
    const { pilgrimId, agentId, sender, message, fileUrl, fileType } = req.body;
    console.log('[MESSAGES] POST', { pilgrimId, agentId, sender, hasFile: !!fileUrl });
    if (!sender || !message) return res.status(400).json({ error: "Missing fields: sender and message required" });
    // If agent is posting and provides an agentId, ensure token matches
    const auth = parseAuth(req);
    if (auth && auth.role === 'agent') {
      if (agentId && String(agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
      // If posting for a pilgrim, ensure the pilgrim is assigned to this agent
      if (pilgrimId) {
        const pilgrim = await db.get('SELECT * FROM pilgrims WHERE id = ?', [pilgrimId]);
        if (!pilgrim) return res.status(404).json({ error: 'Pilgrim not found' });
        if (String(pilgrim.agentId) !== String(auth.id)) return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const timestamp = new Date().toISOString();
    const info = await db.run("INSERT INTO messages (pilgrimId, agentId, sender, message, timestamp, fileUrl, fileType) VALUES (?, ?, ?, ?, ?, ?, ?)", [pilgrimId || null, agentId || null, sender, message, timestamp, fileUrl || null, fileType || null]);
    const newMsg = { id: info.lastID, pilgrimId: pilgrimId || null, agentId: agentId || null, sender, message, timestamp, fileUrl: fileUrl || null, fileType: fileType || null };
    // Notify SSE clients for this pilgrimId and/or agentId
    try {
      if (pilgrimId) {
        const key = `pilgrim:${pilgrimId}`;
        if (sseClients.has(key)) {
          const clients = sseClients.get(key);
          const payload = JSON.stringify(newMsg);
          for (const clientRes of clients) {
            clientRes.write(`data: ${payload}\n\n`);
          }
        }
      }
      if (agentId) {
        const key = `agent:${agentId}`;
        if (sseClients.has(key)) {
          const clients = sseClients.get(key);
          const payload = JSON.stringify(newMsg);
          for (const clientRes of clients) {
            clientRes.write(`data: ${payload}\n\n`);
          }
        }
      }
    } catch (e) { console.error('[SSE NOTIFY ERROR]', e); }
    res.json({ id: info.lastID });
  });
  // --- ACTIVITY LOG ENDPOINTS ---
  app.get("/activity-log", async (req, res) => {
    const { userId, userType, action, details } = req.query;
    let query = "SELECT * FROM activity_log WHERE 1=1";
    const params = [];
    if (userId) { query += " AND userId=?"; params.push(userId); }
    if (userType) { query += " AND userType=?"; params.push(userType); }
    if (action) { query += " AND action LIKE ?"; params.push(`%${action}%`); }
    if (details) { query += " AND details LIKE ?"; params.push(`%${details}%`); }
    query += " ORDER BY date DESC";
    const logs = await db.all(query, params);
    res.json(logs);
  });

  // SSE stream for activity log (system-wide)
  app.get('/activity-log/stream', (req, res) => {
    console.log('[SSE ACTIVITY] New stream connection');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.write(': connected\n\n');
    if (res.flushHeaders) try { res.flushHeaders(); } catch (e) { /* ignore */ }
    activitySseClients.add(res);
    req.on('close', () => {
      activitySseClients.delete(res);
      console.log('[SSE ACTIVITY] Connection closed');
    });
  });

  // Simple healthcheck endpoint for Render / load balancers
  app.get('/health', (req, res) => {
    // lightweight check: database should be open
    const alive = !!db;
    res.status(alive ? 200 : 500).json({ ok: alive, time: new Date().toISOString() });
  });

  app.post("/activity-log", async (req, res) => {
    const { userId, userType, action, details } = req.body;
    if (!userId || !userType || !action) return res.status(400).json({ error: "Missing fields" });
    const info = await db.run("INSERT INTO activity_log (userId, userType, action, details, date) VALUES (?, ?, ?, ?, ?)", [userId, userType, action, details || '', new Date().toISOString()]);
    const newEntry = { id: info.lastID, userId, userType, action, details: details || '', date: new Date().toISOString() };
    // Notify SSE clients for activities
    try {
      const payload = JSON.stringify(newEntry);
      for (const clientRes of activitySseClients) {
        try { clientRes.write(`data: ${payload}\n\n`); } catch (e) { /* ignore per-client errors */ }
      }
    } catch (e) { console.error('[SSE ACTIVITY NOTIFY ERROR]', e); }
    res.json({ id: info.lastID });
  });
  
  app.delete("/messages/:id", async (req, res) => {
    await db.run("DELETE FROM messages WHERE id=?", [req.params.id]);
    res.json({ success: true });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();