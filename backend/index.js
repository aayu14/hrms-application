require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const client = require('prom-client');

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json({ limit: '2mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_change_me';

function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid authorization format' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = payload;
    next();
  });
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (perms.includes('*') || perms.includes(perm) || req.user.role === 'Admin') return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

const netsuiteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

// Prometheus metrics
client.collectDefaultMetrics({ prefix: 'hrms_' });
const apiRequestCounter = new client.Counter({ name: 'hrms_api_requests_total', help: 'Total API requests' });
const netsuiteRequestCounter = new client.Counter({ name: 'hrms_netsuite_requests_total', help: 'Total NetSuite proxy requests' });

// Increment API request counter for all /api routes
app.use('/api', (req, res, next) => {
  apiRequestCounter.inc();
  next();
});

app.get('/api/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    return res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Authentication
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const userRes = await pool.query('SELECT u.*, r.name as role_name, r.permissions FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1 LIMIT 1', [email]);
    const user = userRes.rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const payload = { sub: user.id, email: user.email, role: user.role_name || null, permissions: user.permissions || [] };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role_name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});
// --- User Management Endpoints (admin)
app.get('/api/users', authenticateJWT, requirePermission('users.read'), async (req, res) => {
  try {
    const q = await pool.query('SELECT u.id, u.email, u.full_name, u.is_active, r.id as role_id, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id');
    res.json(q.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    // Allow users to fetch their own profile
    if (req.user && req.user.sub === id) {
      const q = await pool.query('SELECT id, email, full_name, is_active, role_id FROM users WHERE id = $1', [id]);
      return res.json(q.rows[0] || null);
    }
    // Otherwise require users.read permission
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!(perms.includes('*') || perms.includes('users.read') || req.user.role === 'Admin')) return res.status(403).json({ error: 'Forbidden' });
    const q = await pool.query('SELECT id, email, full_name, is_active, role_id FROM users WHERE id = $1', [id]);
    res.json(q.rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', authenticateJWT, requirePermission('users.write'), async (req, res) => {
  const { email, password, full_name, role_id, role_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    let rid = role_id;
    if (!rid && role_name) {
      const r = await pool.query('SELECT id FROM roles WHERE name = $1 LIMIT 1', [role_name]);
      if (r.rows[0]) rid = r.rows[0].id;
    }
    const hash = bcrypt.hashSync(password, 10);
    const inserted = await pool.query('INSERT INTO users(email, password_hash, full_name, role_id, is_active) VALUES($1,$2,$3,$4,$5) RETURNING id, email, full_name, role_id', [email, hash, full_name || null, rid || null, true]);
    res.json(inserted.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  try {
    // Only allow admin/users.write to update arbitrary users
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!(perms.includes('*') || perms.includes('users.write') || req.user.sub === id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const keys = Object.keys(payload).filter(k => k !== 'password');
    if (keys.length) {
      const setClause = keys.map((k, i) => `${k} = $${i+1}`).join(', ');
      const sql = `UPDATE users SET ${setClause}, updated_at = now() WHERE id = $${keys.length+1} RETURNING id, email, full_name, role_id`;
      const values = keys.map(k => payload[k]);
      values.push(id);
      const result = await pool.query(sql, values);
      // If password present, update separately
      if (payload.password) {
        const hash = bcrypt.hashSync(payload.password, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
      }
      return res.json(result.rows[0]);
    }
    res.status(400).json({ error: 'No updatable fields provided' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', authenticateJWT, requirePermission('users.write'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Roles management
app.get('/api/roles', authenticateJWT, requirePermission('roles.read'), async (req, res) => {
  try {
    const q = await pool.query('SELECT * FROM roles ORDER BY name');
    res.json(q.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/roles', authenticateJWT, requirePermission('roles.write'), async (req, res) => {
  const { name, permissions } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const q = await pool.query('INSERT INTO roles(name, permissions) VALUES($1,$2) RETURNING *', [name, permissions || []]);
    res.json(q.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/roles/:id', authenticateJWT, requirePermission('roles.write'), async (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body || {};
  try {
    const q = await pool.query('UPDATE roles SET name = $1, permissions = $2, updated_at = now() WHERE id = $3 RETURNING *', [name, permissions || [], id]);
    res.json(q.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/roles/:id', authenticateJWT, requirePermission('roles.write'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM roles WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// NetSuite config endpoints (example)
app.get('/api/integrations/netsuite/config', authenticateJWT, requirePermission('integrations.read'), async (req, res) => {
  try {
    const result = await pool.query('SELECT config FROM integrations WHERE name = $1 LIMIT 1', ['netsuite']);
    res.json(result.rows[0] ? result.rows[0].config : null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/integrations/netsuite/config', authenticateJWT, requirePermission('integrations.write'), async (req, res) => {
  const cfg = req.body;
  try {
    // Upsert manually (ensure unique index exists)
    const exists = await pool.query('SELECT id FROM integrations WHERE name = $1 LIMIT 1', ['netsuite']);
    if (exists.rows.length) {
      await pool.query('UPDATE integrations SET config = $1, enabled = $2, updated_at = now() WHERE name = $3', [cfg, true, 'netsuite']);
      const updated = await pool.query('SELECT * FROM integrations WHERE name = $1', ['netsuite']);
      return res.json(updated.rows[0]);
    } else {
      const inserted = await pool.query('INSERT INTO integrations(name, key, config, enabled) VALUES($1,$2,$3,$4) RETURNING *', ['netsuite','netsuite', cfg, true]);
      return res.json(inserted.rows[0]);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// NetSuite API Proxy Endpoint
app.post('/api/netsuite', authenticateJWT, netsuiteLimiter, async (req, res) => {
  const { method = 'GET', endpoint = '/', data = null } = req.body || {};
  const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey || null;
  try {
    // Validate basic endpoint input to avoid SSRF
    if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.includes('://')) {
      return res.status(400).json({ error: 'Invalid endpoint' });
    }

    // Fetch configured credentials from integrations table
    const cfgRes = await pool.query('SELECT config FROM integrations WHERE name = $1 LIMIT 1', ['netsuite']);
    const cfg = cfgRes.rows[0] ? cfgRes.rows[0].config : null;
    if (!cfg || !cfg.consumerId || !cfg.consumerSecret || !cfg.tokenId || !cfg.tokenSecret) {
      return res.status(400).json({ error: 'NetSuite not configured on server' });
    }

    // If idempotency key provided, check previous completed job
    if (idempotencyKey) {
      try {
        const prev = await pool.query("SELECT payload FROM jobs WHERE (payload->>'idempotency_key') = $1 AND status = 'completed' LIMIT 1", [idempotencyKey]);
        if (prev.rows.length && prev.rows[0].payload && prev.rows[0].payload.result) {
          return res.json(prev.rows[0].payload.result);
        }
      } catch (e) {
        console.warn('Idempotency lookup failed', e.message || e);
      }
    }

    // Construct target URL - allow config.baseUrl override
    const baseUrl = cfg.baseUrl || `https://${cfg.realm}.suitetalk.api.netsuite.com/services/rest/record/v1`;
    const targetUrl = endpoint.startsWith('/') ? (baseUrl + endpoint) : (baseUrl + '/' + endpoint);

    // Create OAuth 1.0a signer (HMAC-SHA256)
    const oauth = OAuth({
      consumer: { key: cfg.consumerId, secret: cfg.consumerSecret },
      signature_method: cfg.signature_method || 'HMAC-SHA256',
      hash_function(base_string, key) {
        return crypto.createHmac('sha256', key).update(base_string).digest('base64');
      }
    });

    const token = { key: cfg.tokenId, secret: cfg.tokenSecret };
    const requestData = { url: targetUrl, method: method.toUpperCase(), data: data || {} };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const axiosConfig = {
      method: method.toLowerCase(),
      url: targetUrl,
      headers: { ...authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      data: data,
      timeout: 30000
    };

    // Insert job record for idempotency/audit
    let jobId = null;
    try {
      const jobPayload = { method, endpoint, data, idempotency_key: idempotencyKey };
      const jobIns = await pool.query('INSERT INTO jobs(type, payload, status, attempts) VALUES($1,$2,$3,$4) RETURNING id', ['netsuite_proxy', jobPayload, 'in_progress', 0]);
      jobId = jobIns.rows[0].id;
    } catch (e) {
      console.warn('Failed to insert job record', e.message || e);
    }

    console.log(`NetSuite proxy called by user: ${req.user?.email || 'unknown'}`);
    try { netsuiteRequestCounter.inc(); } catch (e) {}

    const response = await axios(axiosConfig);

    // Update job with result
    if (jobId) {
      try {
        const payloadWithResult = { method, endpoint, data, idempotency_key: idempotencyKey, result: response.data };
        await pool.query('UPDATE jobs SET payload = $1, status = $2, updated_at = now() WHERE id = $3', [payloadWithResult, 'completed', jobId]);
      } catch (e) { console.warn('Failed to update job result', e.message || e); }
    }

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('NetSuite proxy error:', err.response?.data || err.message || err);
    // update job on failure
    if (jobId) {
      try { await pool.query('UPDATE jobs SET last_error = $1, status = $2, attempts = attempts + 1, updated_at = now() WHERE id = $3', [String(err.message || err), 'failed', jobId]); } catch (e) {}
    }
    res.status(err.response?.status || 500).json({ error: err.message || 'NetSuite proxy error' });
  }
});

// Migration endpoint - import localStorage JSON (admin only in production)
app.post('/api/migrate/local-data', authenticateJWT, requirePermission('migrate'), async (req, res) => {
  const data = req.body;
  try {
    // Minimal importer: import employees and candidates only for now
    const imported = { employees: 0, candidates: 0 };
    if (Array.isArray(data.employees)) {
      for (const emp of data.employees) {
        const keys = Object.keys(emp);
        const values = keys.map((k, i) => `$${i+1}`);
        const sql = `INSERT INTO employees(${keys.join(',')}) VALUES(${values.join(',')}) ON CONFLICT DO NOTHING`;
        await pool.query(sql, keys.map(k => emp[k]));
        imported.employees++;
      }
    }
    if (Array.isArray(data.recruitment)) {
      for (const cand of data.recruitment) {
        const keys = Object.keys(cand);
        const values = keys.map((k, i) => `$${i+1}`);
        const sql = `INSERT INTO candidates(${keys.join(',')}) VALUES(${values.join(',')}) ON CONFLICT DO NOTHING`;
        await pool.query(sql, keys.map(k => cand[k]));
        imported.candidates++;
      }
    }
    res.json({ imported });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Generic protected CRUD for known collections
const ALLOWED_COLLECTIONS = ['employees','departments','users','roles','attendance','leave_requests','candidates','performance_reviews','training_programs','benefits','documents','audit_logs','integrations','jobs','payroll_exports','shifts','training','expenses','goals','announcements','skills','compliance','complianceCompletions','shiftAssignments'];

app.get('/api/:collection', authenticateJWT, async (req, res) => {
  const { collection } = req.params;
  if (!ALLOWED_COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
  try {
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!(perms.includes('*') || perms.includes('data.read') || perms.includes(`${collection}.read`))) return res.status(403).json({ error: 'Forbidden' });
    const result = await pool.query(`SELECT * FROM ${collection} LIMIT 1000`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/:collection/:id', authenticateJWT, async (req, res) => {
  const { collection, id } = req.params;
  if (!ALLOWED_COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
  try {
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!(perms.includes('*') || perms.includes('data.read') || perms.includes(`${collection}.read`))) return res.status(403).json({ error: 'Forbidden' });
    const result = await pool.query(`SELECT * FROM ${collection} WHERE id = $1`, [id]);
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/:collection', authenticateJWT, async (req, res) => {
  const { collection } = req.params;
  const payload = req.body;
  if (!ALLOWED_COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
  try {
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!(perms.includes('*') || perms.includes('data.write') || perms.includes(`${collection}.write`))) return res.status(403).json({ error: 'Forbidden' });
    if (payload && typeof payload === 'object') {
      if (['employees','departments','users','roles','attendance','leave_requests','candidates','performance_reviews','training_programs','benefits','documents','audit_logs','integrations','jobs','payroll_exports'].includes(collection)) {
        const keys = Object.keys(payload);
        const values = keys.map((k, i) => `$${i+1}`);
        const sql = `INSERT INTO ${collection}(${keys.join(',')}) VALUES(${values.join(',')}) RETURNING *`;
        const result = await pool.query(sql, keys.map(k=>payload[k]));
        return res.json(result.rows[0]);
      } else {
        return res.status(400).json({ error: 'Unsupported collection for insert' });
      }
    }
    res.status(400).json({ error: 'Invalid payload' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/:collection/:id', authenticateJWT, async (req, res) => {
  const { collection, id } = req.params;
  const payload = req.body;
  if (!ALLOWED_COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
  try {
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!(perms.includes('*') || perms.includes('data.write') || perms.includes(`${collection}.write`))) return res.status(403).json({ error: 'Forbidden' });
    const keys = Object.keys(payload);
    const setClause = keys.map((k, i) => `${k} = $${i+1}`).join(', ');
    const sql = `UPDATE ${collection} SET ${setClause}, updated_at = now() WHERE id = $${keys.length+1} RETURNING *`;
    const values = keys.map(k=>payload[k]);
    values.push(id);
    const result = await pool.query(sql, values);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/:collection/:id', authenticateJWT, async (req, res) => {
  const { collection, id } = req.params;
  if (!ALLOWED_COLLECTIONS.includes(collection)) return res.status(400).json({ error: 'Unknown collection' });
  try {
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!(perms.includes('*') || perms.includes('data.write') || perms.includes(`${collection}.write`))) return res.status(403).json({ error: 'Forbidden' });
    await pool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`HRMS backend listening on ${PORT}`));
