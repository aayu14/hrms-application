# Migration Notes — Replace `db.js` with server-backed API

Goal: Replace browser `localStorage` persistence (`db.js`) with a secure backend API and provide a compatibility shim to minimize frontend changes during rollout.

SUMMARY
- `db.js` currently uses `localStorage` as the single source of truth and exposes `window.db`.
- Several modules (including `netsuite.js`) store config in `localStorage`.
- Replace client-side persistence with a backend REST API, and provide a small `db-shim.js` that maps existing `db.*` calls to API endpoints or falls back to `localStorage` when offline.

FILES TO REVIEW / CHANGE
- `index.html` — remove or replace `<script src="db.js"></script>` with a shim (`db-shim.js`) loaded before other modules.
- `db.js` — keep as archived reference; do not run in production.
- `netsuite.js` — stop using `localStorage` for config; call backend endpoints `/api/integrations/netsuite/config`.
- `api-adapter.js` — ensure it exposes a stable client API (e.g., `APIAdapter.get(collection)`, `APIAdapter.create(collection, item)`, ...). Use the adapter from the shim.
- All modules that call `window.db` — verify compatibility with shim or update to new API over time.

RECOMMENDED BACKEND ENDPOINTS
- GET /api/{collection} -> list
- GET /api/{collection}/{id} -> single
- POST /api/{collection} -> create
- PUT /api/{collection}/{id} -> update
- DELETE /api/{collection}/{id} -> delete

- Integrations: POST /api/integrations/{name}/config (save), GET /api/integrations/{name}/config (read), POST /api/integrations/{name}/sync (trigger)
- Migration: POST /api/migrate/local-data — server accepts exported local JSON and imports into Postgres (admin-only)

SAMPLE `db-shim.js` (drop-in replacement for `db.js`)

```javascript
// db-shim.js — compatibility layer mapping window.db to server API
(function(global){
  const API_BASE = window.__API_BASE__ || '/api';

  async function request(method, path, body) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      // Network or server error — fallback to localStorage for offline mode
      console.warn('API error, falling back to localStorage:', err.message);
      return null;
    }
  }

  const shim = {
    async getCollection(name) {
      const data = await request('GET', `/${name}`);
      if (data) return data;
      // fallback
      const raw = localStorage.getItem('hrms_db_v2');
      return raw ? (JSON.parse(raw)[name] || []) : [];
    },

    async create(name, item) {
      const created = await request('POST', `/${name}`, item);
      if (created) return created;
      // fallback
      const db = JSON.parse(localStorage.getItem('hrms_db_v2') || '{}');
      db[name] = db[name] || [];
      const id = Date.now();
      const newItem = Object.assign({ id }, item);
      db[name].push(newItem);
      localStorage.setItem('hrms_db_v2', JSON.stringify(db));
      return newItem;
    },

    async update(name, id, fields) {
      const updated = await request('PUT', `/${name}/${id}`, fields);
      if (updated) return updated;
      const db = JSON.parse(localStorage.getItem('hrms_db_v2') || '{}');
      db[name] = db[name] || [];
      const idx = db[name].findIndex(i => String(i.id) === String(id));
      if (idx === -1) return null;
      db[name][idx] = Object.assign({}, db[name][idx], fields);
      localStorage.setItem('hrms_db_v2', JSON.stringify(db));
      return db[name][idx];
    },

    async delete(name, id) {
      const deleted = await request('DELETE', `/${name}/${id}`);
      if (deleted) return deleted;
      const db = JSON.parse(localStorage.getItem('hrms_db_v2') || '{}');
      db[name] = (db[name] || []).filter(i => String(i.id) !== String(id));
      localStorage.setItem('hrms_db_v2', JSON.stringify(db));
      return true;
    },

    // Minimal logging shim
    log(actor, action, module) {
      // Prefer server log endpoint
      request('POST', `/audit-logs`, { actor, action, module }).catch(()=>{});
    }
  };

  // Expose as `db` to keep existing code working
  global.db = shim;
})(window);
```

INDEX.HTML CHANGE (example)

Replace:
```html
<!-- db.js: Handles LocalStorage/Data Management -->
<script src="db.js"></script>
```
With (load shim or adapter first):
```html
<script>window.__API_BASE__ = '/api';</script>
<script src="db-shim.js"></script>
```

Then ensure `api-adapter.js` (or your real API client) is loaded before feature modules so they can use server endpoints where applicable.

MIGRATION PATH
1. Add backend API and migrations (Postgres). Use `migrations/001_initial_schema.sql` already provided.
2. Deploy backend and create admin-only endpoint: `POST /api/migrate/local-data` which validates and imports the JSON exported from the browser.
3. From a browser with existing data, run in console:

```javascript
const data = localStorage.getItem('hrms_db_v2');
console.log('Export this JSON and POST to server migration endpoint');
copy(data);
```

4. Server-side import: validate shapes, insert rows, and return counts.
5. Once data in Postgres, enable API mode (set `dataSource: 'api'`) and ensure `db-shim` prefers API responses.
6. Remove or archive `db.js` from production bundle.

TESTING & ROLLBACK
- Test shim in staging first. Verify reads/writes map to server.
- Keep a read-only copy of local backup before importing.
- Provide a rollback script to clear imported rows if needed.

NOTES / TODOS
- Update `netsuite.js` to use backend endpoints for storing credentials and triggering syncs (remove `localStorage` calls). See `NETSUITESETUP.md` and `migrations/` for endpoints.
- Update `IMPLEMENTATION.md` and `CONFIG.md` to remove "localStorage as primary DB" guidance and document server API mode.

If you want, I can now scaffold a `db-shim.js` file using the example above and update `index.html` to include it (non-destructive change: keep `db.js` as `db.js.bak`). Reply `scaffold` to proceed with that change.