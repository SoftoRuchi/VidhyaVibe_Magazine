/** Show coupon datetime exactly as API/DB wall-clock string — no timezone reformatting. */
export function formatCouponDateTime(value: unknown): string {
  if (value == null || value === '') return '—';

  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    if (m) return `${m[1]} ${m[2]}`;
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  return String(value);
}
