export type RosterStudent = {
  email: string;
  name?: string;
  className?: string;
  rollNumber?: string;
  password?: string;
};

export const STUDENT_ROSTER_SAMPLE_CSV = `email,name,class,roll,password
anita.demo@vvcollege.edu,Anita Sharma,BCA-2,21,Demo@123
rahul.demo@vvcollege.edu,Rahul Verma,BCA-2,22,
priya.demo@vvcollege.edu,"Priya Nair",BCA-2,23,
`;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function normHeader(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function headerIndex(headers: string[], aliases: string[]) {
  const wanted = aliases.map(normHeader);
  return headers.findIndex((h) => wanted.includes(normHeader(h)));
}

export function parseStudentRosterCsv(text: string): RosterStudent[] {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const first = splitCsvLine(lines[0]);
  const looksLikeHeader = headerIndex(first, ['email', 'e-mail', 'studentemail']) >= 0;
  const headers = looksLikeHeader ? first : ['email', 'name', 'class', 'roll', 'password'];
  const emailAt = Math.max(0, headerIndex(headers, ['email', 'e-mail', 'studentemail', 'mail']));
  const nameAt = headerIndex(headers, ['name', 'studentname', 'fullname']);
  const classAt = headerIndex(headers, ['class', 'classname', 'section', 'batch']);
  const rollAt = headerIndex(headers, ['roll', 'rollnumber', 'rollno', 'enrollment']);
  const passAt = headerIndex(headers, ['password', 'pass', 'pwd']);
  const rows = looksLikeHeader ? lines.slice(1) : lines;

  return rows
    .map((line) => {
      const cols = splitCsvLine(line);
      const email = (cols[emailAt] || '').trim();
      return {
        email,
        name: nameAt >= 0 ? cols[nameAt] : cols[1],
        className: classAt >= 0 ? cols[classAt] : cols[2],
        rollNumber: rollAt >= 0 ? cols[rollAt] : cols[3],
        password: passAt >= 0 ? cols[passAt] : cols[4],
      };
    })
    .filter((row) => row.email && row.email.includes('@'));
}

export function downloadStudentRosterSample(filename = 'student-roster-sample.csv') {
  const blob = new Blob([STUDENT_ROSTER_SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
