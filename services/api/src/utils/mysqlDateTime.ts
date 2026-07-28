/** Prefer literal YYYY-MM-DD HH:mm:ss digits; ignore trailing Z/offset. Never use Date/toISOString. */
export function toMysqlDateTime(expiresAt: unknown): string | null {
  if (expiresAt == null || expiresAt === '') return null;

  if (typeof expiresAt === 'object' && expiresAt !== null) {
    const any = expiresAt as any;
    if (typeof any.format === 'function') {
      try {
        return toMysqlDateTime(any.format('YYYY-MM-DD HH:mm:ss'));
      } catch {
        /* fall through */
      }
    }
    if (typeof any.year === 'function' && typeof any.month === 'function') {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${any.year()}-${pad(any.month() + 1)}-${pad(any.date())} ${pad(any.hour())}:${pad(any.minute())}:${pad(any.second())}`;
    }
  }

  const raw = String(expiresAt).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (m) {
    return `${m[1]} ${m[2]}`;
  }

  throw new Error('invalid_expiresAt');
}
