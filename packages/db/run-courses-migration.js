#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const envPath = path.join(__dirname, '../../.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) {
    console.error('DATABASE_URL missing from .env');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, 'migrations/202609100001_courses.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection({
    uri: match[1],
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    console.log('Courses migration applied.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
