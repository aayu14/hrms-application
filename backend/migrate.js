require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importLocal(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
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
  console.log('Imported', imported);
  await pool.end();
}

const filePath = process.argv[2] || '../local_export.json';
importLocal(filePath).catch(err => { console.error(err); process.exit(1); });
