/**
 * Extracts a chapter sequence number from a title if present.
 */
export function extractChapterNumber(title?: string | null): number | null {
  if (!title) return null;
  const t = String(title).trim();
  const match = t.match(/^(?:chapter|ch|unit|module|lesson)?\s*#?\s*(\d+)\b/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Natural chapter comparator.
 * Prioritizes explicit chapter numbers so "Chapter 1" and "Chapter 2" always come before "Chapter 3",
 * even if they were added later in time.
 */
export function compareChapters<
  T extends {
    title?: string | null;
    sortOrder?: number | null;
    sort_order?: number | null;
    id?: number | string | bigint | null;
  },
>(a: T, b: T): number {
  const numA = extractChapterNumber(a?.title);
  const numB = extractChapterNumber(b?.title);

  if (numA !== null && numB !== null) {
    if (numA !== numB) return numA - numB;
  } else if (numA !== null && numB === null) {
    const orderA = Number(a?.sortOrder ?? (a as any)?.sort_order ?? 0);
    const orderB = Number(b?.sortOrder ?? (b as any)?.sort_order ?? 0);
    if (orderB < orderA && orderB > 0) return 1;
    return -1;
  } else if (numA === null && numB !== null) {
    const orderA = Number(a?.sortOrder ?? (a as any)?.sort_order ?? 0);
    const orderB = Number(b?.sortOrder ?? (b as any)?.sort_order ?? 0);
    if (orderA < orderB && orderA > 0) return -1;
    return 1;
  }

  const orderA = Number(a?.sortOrder ?? (a as any)?.sort_order ?? 0);
  const orderB = Number(b?.sortOrder ?? (b as any)?.sort_order ?? 0);
  if (orderA !== orderB) return orderA - orderB;

  const idA = Number(a?.id ?? 0);
  const idB = Number(b?.id ?? 0);
  return idA - idB;
}
