import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const PAD = (n: number) => String(n).padStart(2, '0');

/** Build YYYY-MM-DD HH:mm:ss from picker value with no timezone conversion. */
export function wallClockFromPicker(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (
    dayjs.isDayjs(value) ||
    (typeof value === 'object' && value !== null && typeof (value as any).year === 'function')
  ) {
    const d = value as Dayjs;
    return `${d.year()}-${PAD(d.month() + 1)}-${PAD(d.date())} ${PAD(d.hour())}:${PAD(d.minute())}:${PAD(d.second())}`;
  }

  const raw = String(value).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  return null;
}

/** Parse API/DB wall-clock string into dayjs (local, no TZ shift). */
export function parseWallClock(value: unknown): Dayjs | null {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (m) {
    const parsed = dayjs(`${m[1]} ${m[2]}`, 'YYYY-MM-DD HH:mm:ss', true);
    return parsed.isValid() ? parsed : null;
  }
  return null;
}
