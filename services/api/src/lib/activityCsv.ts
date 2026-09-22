import { sendCsv } from './csv';
import { formatAppDateTime, formatDuration } from './formatAppDateTime';

function when(value: unknown) {
  return formatAppDateTime(value, '');
}

function duration(seconds?: number) {
  return formatDuration(seconds);
}

const READING_HEADERS = [
  { key: 'name', label: 'Student' },
  { key: 'email', label: 'Email' },
  { key: 'book', label: 'Book' },
  { key: 'course', label: 'Course' },
  { key: 'institute', label: 'Institute' },
  { key: 'chapter', label: 'Chapter' },
  { key: 'page', label: 'Page' },
  { key: 'model', label: 'Access model' },
  { key: 'opens', label: 'Times opened' },
  { key: 'duration', label: 'Duration' },
  { key: 'device', label: 'Device' },
  { key: 'ip', label: 'IP' },
  { key: 'started', label: 'Started' },
  { key: 'lastSeen', label: 'Last seen' },
  { key: 'ended', label: 'Ended' },
  { key: 'session', label: 'Session' },
];

const LOGIN_HEADERS = [
  { key: 'name', label: 'Student' },
  { key: 'email', label: 'Email' },
  { key: 'institute', label: 'Institute' },
  { key: 'login', label: 'Login' },
  { key: 'lastSeen', label: 'Last seen' },
  { key: 'logout', label: 'Logout' },
  { key: 'duration', label: 'Duration' },
  { key: 'device', label: 'Device' },
  { key: 'ip', label: 'IP' },
  { key: 'status', label: 'Status' },
];

function readingRow(r: any) {
  return {
    name: r.name || '',
    email: r.email || '',
    book: r.subjectName || '',
    course: r.courseName || '',
    institute: r.instituteName || 'Individual',
    chapter: r.chapterTitle || '',
    page: r.pageNumber || '',
    model: r.accessModel || '',
    opens: r.openCount || 0,
    duration: duration(r.secondsActive),
    device: r.deviceName || '',
    ip: r.ipAddress || '',
    started: when(r.startedAt),
    lastSeen: when(r.lastHeartbeatAt),
    ended: when(r.endedAt),
    session: r.live ? 'Active' : r.endReason || 'Ended',
  };
}

function loginRow(r: any) {
  return {
    name: r.name || '',
    email: r.email || '',
    institute: r.instituteName || '',
    login: when(r.loggedInAt),
    lastSeen: when(r.lastSeenAt),
    logout: when(r.loggedOutAt),
    duration: duration(r.secondsActive),
    device: r.deviceName || '',
    ip: r.ipAddress || '',
    status: r.live ? 'Online' : 'Signed out',
  };
}

export function wantsCsv(req: { query?: Record<string, unknown> }) {
  return String(req.query?.format || '').toLowerCase() === 'csv';
}

export function sendActivityCsv(
  req: { query?: Record<string, unknown> },
  res: { setHeader: (k: string, v: string) => void; send: (b: string) => void },
  reading: any[],
  logins: any[],
  prefix = 'book-activity',
) {
  const kind = String(req.query?.kind || 'reading').toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  if (kind === 'logins') {
    sendCsv(res, `${prefix}-logins-${day}.csv`, LOGIN_HEADERS, logins.map(loginRow));
    return;
  }
  sendCsv(res, `${prefix}-reading-${day}.csv`, READING_HEADERS, reading.map(readingRow));
}
