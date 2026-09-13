const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function explain(text) {
  return `<details class="course-explain"><summary>In simple words</summary><p>${text}</p></details>`;
}

const inserts = [
  {
    after: 'Sets are usually written with capital letters: A, B, C.</p>',
    html: explain(
      'A set is just a clearly named group of unique things. If you cannot decide whether something is in or out, it is not a set yet.',
    ),
  },
  {
    after: '“Intelligent students” is not, unless you give an exact rule.</p>',
    html: explain(
      'Well-defined means there is a yes-or-no test. “Even numbers” has a test. “Nice numbers” does not.',
    ),
  },
  {
    after: 'If B ⊆ A and B ≠ A, B is a <strong>proper subset</strong>: <code>B ⊂ A</code>.</p>',
    html: explain(
      'A subset is a smaller (or equal) group taken from a bigger group. Every member of the subset is already in the original set.',
    ),
  },
  {
    after: 'If A has n elements, P(A) has <strong>2ⁿ</strong> elements.</p>',
    html: explain(
      'The power set is the list of every possible grouping of the original items, including “take none” and “take all”. Double the count each time you add one new item.',
    ),
  },
  {
    after: 'We subtract the overlap so it is not counted twice.</p>',
    html: explain(
      'Add the two groups, then subtract the people who were in both, because they were counted twice.',
    ),
  },
  {
    after: 'In computing: OR ↔ ∪, AND ↔ ∩, NOT ↔ complement.</p>',
    html: explain(
      'De Morgan: not (A or B) is the same as not A and not B. In code, !(x || y) equals !x && !y.',
    ),
  },
];

async function run() {
  const envText = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  const conn = await mysql.createConnection({ uri: match[1] });
  try {
    const [rows] = await conn.query('SELECT id, content FROM course_chapters WHERE id = 1 LIMIT 1');
    const row = rows[0];
    if (!row) {
      console.log('Chapter 1 not found.');
      return;
    }
    let html = row.content || '';
    if (html.includes('course-explain')) {
      console.log('Explanations already present.');
      return;
    }
    let added = 0;
    for (const item of inserts) {
      if (!html.includes(item.after)) {
        console.log('Anchor not found:', item.after.slice(0, 60));
        continue;
      }
      html = html.replace(item.after, `${item.after} ${item.html}`);
      added += 1;
    }
    await conn.query('UPDATE course_chapters SET content = ?, updated_at = NOW(3) WHERE id = ?', [
      html,
      row.id,
    ]);
    console.log(`Inserted ${added} simple explanations into chapter ${row.id}.`);
  } finally {
    await conn.end();
  }
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
