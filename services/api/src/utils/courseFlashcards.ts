/** Authored chapter flashcards — only explicit course-flash blocks, never guessed from headings. */

function decodeText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export type ParsedFlashcard = { front: string; back: string };

function collect(cards: ParsedFlashcard[], seen: Set<string>, front: string, back: string) {
  const f = decodeText(front).slice(0, 500);
  const b = decodeText(back).slice(0, 2000);
  if (f.length < 2 || b.length < 2) return;
  const key = f.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  cards.push({ front: f, back: b });
}

function fromFlashBlocks(html: string, cards: ParsedFlashcard[], seen: Set<string>) {
  const blockRe =
    /<(div|section|aside|dl)([^>]*class=["'][^"']*course-flash[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html))) {
    const attrs = m[2] || '';
    const inner = m[3] || '';
    const dataFront = attrs.match(/data-front=["']([^"']+)["']/i)?.[1];
    const pairs = inner.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi);
    let found = false;
    for (const pair of pairs) {
      collect(cards, seen, pair[1], pair[2]);
      found = true;
    }
    if (found) continue;
    const strong = inner.match(/<(strong|b|h[1-6]|summary)[^>]*>([\s\S]*?)<\/\1>/i);
    const rest = strong ? inner.replace(strong[0], ' ') : inner;
    collect(cards, seen, dataFront || strong?.[2] || '', rest);
  }
}

export function flashcardsFromChapterHtml(html: string): ParsedFlashcard[] {
  const cards: ParsedFlashcard[] = [];
  const seen = new Set<string>();
  if (!html) return cards;
  fromFlashBlocks(html, cards, seen);
  return cards;
}
