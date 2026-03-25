export type LoginAudience = 'parent' | 'child';

const KEY_AUDIENCE = 'login_audience';
const KEY_READER_ID = 'selected_reader_id';
const KEY_READER_NAME = 'selected_reader_name';

export function setParentAudience() {
  localStorage.setItem(KEY_AUDIENCE, 'parent');
  localStorage.removeItem(KEY_READER_ID);
  localStorage.removeItem(KEY_READER_NAME);
}

export function setChildAudience(readerId: number, readerName: string) {
  localStorage.setItem(KEY_AUDIENCE, 'child');
  localStorage.setItem(KEY_READER_ID, String(readerId));
  localStorage.setItem(KEY_READER_NAME, readerName);
}

export function getAudience(): LoginAudience {
  if (typeof window === 'undefined') return 'parent';
  return localStorage.getItem(KEY_AUDIENCE) === 'child' ? 'child' : 'parent';
}

export function isChildAudience(): boolean {
  return getAudience() === 'child';
}

export function getSelectedReaderId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY_READER_ID);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getSelectedReaderName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY_READER_NAME);
}

export function clearViewingContext() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY_AUDIENCE);
  localStorage.removeItem(KEY_READER_ID);
  localStorage.removeItem(KEY_READER_NAME);
}
