export function csvCell(value: unknown): string {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  headers: { key: string; label: string }[],
  rows: Array<Record<string, unknown>>,
) {
  const head = headers.map((h) => csvCell(h.label)).join(',');
  const body = rows.map((row) => headers.map((h) => csvCell(row[h.key])).join(',')).join('\r\n');
  return `\uFEFF${head}\r\n${body}\r\n`;
}

export function sendCsv(
  res: { setHeader: (k: string, v: string) => void; send: (b: string) => void },
  filename: string,
  headers: { key: string; label: string }[],
  rows: Array<Record<string, unknown>>,
) {
  const safe = String(filename || 'export.csv').replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.send(toCsv(headers, rows));
}
