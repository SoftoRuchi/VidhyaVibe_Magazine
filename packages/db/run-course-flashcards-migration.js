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
  const sqlPath = path.join(__dirname, 'migrations/202609110002_course_flashcards.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--') && !/^USE\s+/i.test(s));
  const conn = await mysql.createConnection({ uri: match[1] });
  try {
    for (const statement of statements) {
      try {
        await conn.query(statement);
      } catch (e) {
        if (e && (e.errno === 1050 || e.code === 'ER_TABLE_EXISTS_ERROR')) {
          continue;
        }
        throw e;
      }
    }
    console.log('Course flashcards migration applied.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
