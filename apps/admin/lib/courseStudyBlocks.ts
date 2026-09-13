function decodeText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeText(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const EXPLAIN_RE =
  /<(details|aside|div)\b[^>]*class=["'][^"']*course-explain[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
const FLASH_RE =
  /<(div|section|aside)\b[^>]*class=["'][^"']*course-flash[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;

function matchesOf(html: string, re: RegExp) {
  return Array.from(html.matchAll(new RegExp(re.source, re.flags)));
}

function replaceMatch(html: string, match: RegExpMatchArray, next: string) {
  const start = match.index ?? 0;
  return `${html.slice(0, start)}${next}${html.slice(start + match[0].length)}`;
}

export type ExplainBlock = { index: number; text: string };
export type FlashBlock = { index: number; front: string; back: string; section: string };
export type HeadingAnchor = { index: number; title: string };

const HEADING_RE = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;

export function listHeadings(html: string): HeadingAnchor[] {
  return matchesOf(html || '', HEADING_RE)
    .map((m, index) => ({ index, title: decodeText(m[1] || '') }))
    .filter((h) => h.title.length > 0);
}

function sectionBefore(html: string, pos: number) {
  const headings = listHeadings((html || '').slice(0, Math.max(0, pos)));
  return headings[headings.length - 1]?.title || 'Start of chapter';
}

export function listExplains(html: string): ExplainBlock[] {
  return matchesOf(html || '', EXPLAIN_RE).map((m, index) => {
    const inner = m[0].replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '');
    const withoutSummary = inner.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, ' ');
    return { index, text: decodeText(withoutSummary) };
  });
}

export function listFlashcards(html: string): FlashBlock[] {
  const body = html || '';
  return matchesOf(body, FLASH_RE).map((m, index) => {
    const inner = m[0].replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '');
    const strong = inner.match(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/i);
    const rest = strong ? inner.replace(strong[0], ' ') : inner;
    return {
      index,
      front: decodeText(strong?.[2] || ''),
      back: decodeText(rest),
      section: sectionBefore(body, m.index ?? 0),
    };
  });
}

export function explainSnippet(text: string) {
  const safe = escapeText(text.trim());
  return `
<details class="course-explain">
  <summary>In simple words</summary>
  <p>${safe}</p>
</details>
`;
}

export function flashSnippet(front: string, back: string) {
  return `
<div class="course-flash">
  <strong>${escapeText(front.trim())}</strong>
  <p>${escapeText(back.trim())}</p>
</div>
`;
}

export function upsertExplain(html: string, index: number | null, text: string) {
  const body = html || '';
  const snippet = explainSnippet(text);
  const matches = matchesOf(body, EXPLAIN_RE);
  if (index == null || index < 0 || !matches[index]) return `${body}\n${snippet}`;
  return replaceMatch(body, matches[index], snippet);
}

export function removeExplain(html: string, index: number) {
  const matches = matchesOf(html || '', EXPLAIN_RE);
  if (!matches[index]) return html || '';
  return replaceMatch(html || '', matches[index], '');
}

export function upsertFlash(
  html: string,
  index: number | null,
  front: string,
  back: string,
  afterHeadingIndex: number | null = null,
) {
  const body = html || '';
  const snippet = flashSnippet(front, back);
  const matches = matchesOf(body, FLASH_RE);
  if (index != null && index >= 0 && matches[index])
    return replaceMatch(body, matches[index], snippet);
  const headings = matchesOf(body, HEADING_RE);
  if (afterHeadingIndex == null || afterHeadingIndex < 0 || !headings[afterHeadingIndex]) {
    return body ? `${body}\n${snippet}` : snippet;
  }
  const next = headings[afterHeadingIndex + 1];
  if (!next || next.index == null) return `${body}\n${snippet}`;
  return `${body.slice(0, next.index)}${snippet}\n${body.slice(next.index)}`;
}

export function removeFlash(html: string, index: number) {
  const matches = matchesOf(html || '', FLASH_RE);
  if (!matches[index]) return html || '';
  return replaceMatch(html || '', matches[index], '');
}

const IMG_RE = /<img\b[^>]*\/?>/gi;

export type HtmlImg = {
  index: number;
  start: number;
  end: number;
  src: string;
  tag: string;
};

function imgSrc(tag: string) {
  const m = tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
  return (m?.[2] ?? m?.[3] ?? '').trim();
}

function withImgSrc(tag: string, url: string, alt: string) {
  const safeAlt = alt.replace(/"/g, '&quot;');
  let next = tag;
  if (/\bsrc\s*=/i.test(next)) {
    next = next.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*')/i, `src="${url}"`);
  } else {
    next = next.replace(/^<img/i, `<img src="${url}"`);
  }
  const altMatch = next.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
  const currentAlt = altMatch?.[2] ?? altMatch?.[3] ?? '';
  if (!altMatch) {
    next = next.replace(/^<img/i, `<img alt="${safeAlt}"`);
  } else if (!currentAlt.trim()) {
    next = next.replace(/\balt\s*=\s*("[^"]*"|'[^']*')/i, `alt="${safeAlt}"`);
  }
  return next;
}

export function listHtmlImgs(html: string): HtmlImg[] {
  return matchesOf(html || '', IMG_RE).map((m, index) => ({
    index,
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    src: imgSrc(m[0]),
    tag: m[0],
  }));
}

export function imgIndexAtCursor(html: string, pos: number) {
  const hit = listHtmlImgs(html).find((img) => pos >= img.start && pos <= img.end);
  return hit?.index ?? null;
}

export function putPictureOnImg(html: string, pos: number, url: string, alt: string) {
  const body = html || '';
  const imgs = listHtmlImgs(body);
  const atCursor = imgs.find((img) => pos >= img.start && pos <= img.end);
  const empty = imgs.find((img) => !img.src);
  const target = atCursor || empty;
  const snippet = `<img src="${url}" alt="${alt.replace(/"/g, '&quot;')}" />`;
  if (!target) {
    const start = Math.max(0, Math.min(pos, body.length));
    return {
      html: `${body.slice(0, start)}\n${snippet}\n${body.slice(start)}`,
      index: imgs.length,
    };
  }
  return {
    html: `${body.slice(0, target.start)}${withImgSrc(target.tag, url, alt)}${body.slice(target.end)}`,
    index: target.index,
  };
}
