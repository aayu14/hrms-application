require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const MIGRATION_FILE = process.env.MIGRATION_FILE || path.resolve(__dirname, '../migrations/001_initial_schema.sql');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function waitForDb(retries = 12, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Postgres not ready yet (${i+1}/${retries}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Postgres did not become ready in time');
}

(async () => {
  try {
    await waitForDb();
    console.log('Applying migrations from', MIGRATION_FILE);
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    await pool.query(sql);
    console.log('Migrations applied successfully');
    // Ensure an Admin role exists
    let roleRes = await pool.query('SELECT id FROM roles WHERE name = $1 LIMIT 1', ['Admin']);
    let adminRoleId;
    if (roleRes.rows.length) {
      adminRoleId = roleRes.rows[0].id;
    } else {
      const perms = ['*'];
      const inserted = await pool.query('INSERT INTO roles(name, permissions) VALUES($1,$2) RETURNING id', ['Admin', perms]);
      adminRoleId = inserted.rows[0].id;
      console.log('Created Admin role');
    }

    // Optionally create an admin user if env vars provided
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPass = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPass) {
      const u = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [adminEmail]);
      if (!u.rows.length) {
        const hash = bcrypt.hashSync(adminPass, 10);
        await pool.query('INSERT INTO users(email, password_hash, full_name, role_id, is_active) VALUES($1,$2,$3,$4,$5)', [adminEmail, hash, 'Admin User', adminRoleId, true]);
        console.log('Created admin user:', adminEmail);
      } else {
        console.log('Admin user already exists:', adminEmail);
      }
    } else {
      console.log('ADMIN_EMAIL or ADMIN_PASSWORD not provided — skipping admin user creation');
    }
  } catch (err) {
    console.error('Migration error:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
