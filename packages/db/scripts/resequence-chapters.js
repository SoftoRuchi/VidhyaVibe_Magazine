const fs = require('fs');
const path = require('path');
const mysql = require('../node_modules/mysql2/promise');

function extractChapterNumber(title) {
  if (!title) return null;
  const t = title.trim();
  const match = t.match(/^(?:chapter|ch|unit|module|lesson)?\s*#?\s*(\d+)\b/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return null;
}

function compareChapters(a, b) {
  const numA = extractChapterNumber(a.title || '');
  const numB = extractChapterNumber(b.title || '');

  if (numA !== null && numB !== null) {
    if (numA !== numB) return numA - numB;
  } else if (numA !== null && numB === null) {
    const orderA = Number(a.sort_order ?? 0);
    const orderB = Number(b.sort_order ?? 0);
    if (orderB < orderA && orderB > 0) return 1;
    return -1;
  } else if (numA === null && numB !== null) {
    const orderA = Number(a.sort_order ?? 0);
    const orderB = Number(b.sort_order ?? 0);
    if (orderA < orderB && orderA > 0) return -1;
    return 1;
  }

  const orderA = Number(a.sort_order ?? 0);
  const orderB = Number(b.sort_order ?? 0);
  if (orderA !== orderB) return orderA - orderB;

  const idA = Number(a.id ?? 0);
  const idB = Number(b.id ?? 0);
  return idA - idB;
}

async function run() {
  const envPath = path.resolve(__dirname, '../../../.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) {
    console.error('DATABASE_URL missing from .env');
    process.exit(1);
  }
  const conn = await mysql.createConnection({ uri: match[1] });
  try {
    const [subjects] = await conn.query('SELECT DISTINCT subject_id FROM course_chapters');
    for (const { subject_id } of subjects) {
      const [chapters] = await conn.query(
        'SELECT id, title, sort_order FROM course_chapters WHERE subject_id = ?',
        [subject_id],
      );
      const sorted = [...chapters].sort(compareChapters);
      for (let i = 0; i < sorted.length; i++) {
        const newSort = (i + 1) * 10;
        await conn.query('UPDATE course_chapters SET sort_order = ? WHERE id = ?', [
          newSort,
          sorted[i].id,
        ]);
        console.log(`Subject ${subject_id}: Chapter ${sorted[i].id} ("${sorted[i].title}") -> sort_order = ${newSort}`);
      }
    }
    console.log('Chapter resequencing completed successfully.');
  } catch (e) {
    console.error('Error resequencing chapters:', e);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
