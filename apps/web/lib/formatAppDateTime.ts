/** VidhyaVibe activity times are stored in UTC; always show India time. */
export const APP_TIME_ZONE = 'Asia/Kolkata';

export function parseAppDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const d = new Date(`${s.replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatAppDateTime(value: unknown): string {
  const d = parseAppDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatDuration(seconds?: number | null): string {
  const totalMin = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days === 1) parts.push('1 day');
  else if (days > 1) parts.push(`${days} days`);
  if (hours) parts.push(`${hours} hr`);
  if (!days && mins) parts.push(`${mins} min`);
  return parts.join(' ') || '0 min';
}
