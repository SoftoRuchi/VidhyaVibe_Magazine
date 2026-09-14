import { getApiOrigin } from './apiBase';

export const HIGHLIGHTER_COLORS = ['#FFE66D', '#A8E6A1', '#FFB7C5', '#A8D8FF', '#FFC48A'];

export type CourseBlock = { id: string; kind: string; text: string; html: string };
export type CourseSpread = { left: number | null; right: number | null };
export type HighlightMark = { text: string; color?: string; wholeWord?: boolean };

function resolveSrc(src: string) {
  let value = src.replace(/&amp;/g, '&').trim();
  if (value.startsWith('//')) value = `https:${value}`;
  const origin = getApiOrigin();
  if (value.includes('/api/assets/serve')) {
    try {
      const u = new URL(value, origin || 'https://readerapi.vidhyavibe.in');
      const key = u.searchParams.get('key');
      if (key) {
        const path = `/api/assets/file/${key
          .split('/')
          .filter(Boolean)
          .map(encodeURIComponent)
          .join('/')}`;
        value = origin ? `${origin}${path}` : path;
      }
    } catch {
      /* keep value */
    }
  }
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (origin && value.startsWith('/')) return `${origin}${value}`;
  return value;
}

function rewriteImages(html: string) {
  return html.replace(/<img\b([^>]*?)\/?>/gi, (_full, attrs: string) => {
    const srcMatch = attrs.match(/src\s*=\s*("([^"]*)"|'([^']*)')/i);
    const raw = srcMatch?.[2] || srcMatch?.[3] || '';
    const src = resolveSrc(raw);
    const withoutSrc = attrs.replace(/src\s*=\s*("([^"]*)"|'([^']*)')/i, '').trim();
    return `<img src="${src}" referrerpolicy="no-referrer" ${withoutSrc} />`;
  });
}

export function blocksFromHtml(html: string): CourseBlock[] {
  if (typeof window === 'undefined') return [];
  const wrap = document.createElement('div');
  wrap.innerHTML = rewriteImages(html || '');
  const nodes = Array.from(
    wrap.querySelectorAll(
      'h1,h2,h3,p,ul,ol,li,nav.course-chapter-toc,div.course-callout,div.course-split,div.course-flash,figure,img,details.course-explain,aside.course-explain,div.course-explain,aside.course-quick-block,div.course-table-wrap,table.course-table',
    ),
  ).filter((el) => {
    if (el.closest('.course-flash') && !el.classList.contains('course-flash')) return false;
    if (el.closest('.course-explain') && !el.classList.contains('course-explain')) return false;
    if (el.closest('.course-quick-block') && !el.classList.contains('course-quick-block'))
      return false;
    if (el.closest('div.course-split') && !el.classList.contains('course-split')) return false;
    if (el.closest('div.course-callout') && !el.classList.contains('course-callout')) return false;
    if (el.closest('nav.course-chapter-toc') && el.tagName.toLowerCase() !== 'nav') return false;
    if (el.closest('.course-table-wrap') && !el.classList.contains('course-table-wrap'))
      return false;
    if (el.tagName.toLowerCase() === 'table' && el.closest('figure, div.course-table-wrap'))
      return false;
    if (el.tagName.toLowerCase() === 'li' && el.closest('ul, ol')) return false;
    if (
      el.tagName.toLowerCase() === 'p' &&
      el.closest('ul, ol, li, figure, table, .course-table-wrap')
    )
      return false;
    if (el.tagName.toLowerCase() !== 'img') return true;
    return !el.closest('figure, p, li, h1, h2, h3, details, aside, ul, ol, table');
  });
  return nodes
    .map((el, i) => {
      const tag = el.tagName.toLowerCase();
      const kind = el.classList.contains('course-split')
        ? 'split'
        : el.classList.contains('course-flash')
          ? 'flash'
          : el.classList.contains('course-quick-block')
            ? 'quick'
            : el.classList.contains('course-explain')
              ? 'explain'
              : el.classList.contains('course-callout')
                ? 'callout'
                : el.classList.contains('course-chapter-toc')
                  ? 'toc'
                  : el.classList.contains('course-table-wrap') ||
                      el.classList.contains('course-table')
                    ? 'table'
                    : tag === 'p' && el.classList.contains('course-formula')
                      ? 'formula'
                      : tag === 'p' && el.classList.contains('course-kicker')
                        ? 'kicker'
                        : tag;
      const id = `b-${i}`;
      if (kind === 'explain') el.setAttribute('data-explain-id', id);
      return { id, kind, text: (el.textContent || '').trim(), html: el.outerHTML };
    })
    .filter(
      (b) =>
        b.text.length > 0 ||
        b.kind === 'img' ||
        b.kind === 'figure' ||
        b.kind === 'split' ||
        b.kind === 'toc' ||
        b.kind === 'table' ||
        b.kind === 'ul' ||
        b.kind === 'ol',
    );
}

function htmlForBlock(block: { id: string; kind: string; html: string }, openIds: string[]) {
  if (block.kind !== 'explain') return block.html;
  const open = openIds.includes(block.id);
  return block.html.replace(/<details\b([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = String(attrs || '').replace(/\sopen(?=\s|>|$)/gi, '');
    return `<details${cleaned}${open ? ' open' : ''}>`;
  });
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function canSplitBlock(kind: string) {
  return (
    kind === 'p' ||
    kind === 'li' ||
    kind === 'callout' ||
    kind === 'explain' ||
    kind === 'kicker' ||
    kind === 'formula'
  );
}

function wordsFromHtml(html: string) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  if (wrap.querySelector('summary')) wrap.querySelector('summary')?.remove();
  return (wrap.textContent || '').split(/\s+/).filter(Boolean);
}

function htmlWithWords(html: string, words: string[]) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const el = wrap.firstElementChild as HTMLElement | null;
  if (!el) return html;
  const text = words.join(' ');
  if (el.tagName.toLowerCase() === 'details') {
    const summary = el.querySelector('summary');
    const summaryHtml = summary?.outerHTML || '<summary>In simple words</summary>';
    el.innerHTML = `${summaryHtml}<p>${escapeHtml(text)}</p>`;
    return el.outerHTML;
  }
  el.textContent = text;
  return el.outerHTML;
}

function waitForProbeImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  if (!imgs.length) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          window.setTimeout(resolve, 800);
        }),
    ),
  );
}

export async function paginateByMeasure(
  blocks: CourseBlock[],
  opts: {
    width: number;
    height: number;
    font: number;
    theme: string;
    openIds: string[];
    header: string;
    chapterTitle: string;
    a4: boolean;
    imgMax?: number;
  },
) {
  if (typeof document === 'undefined' || opts.width < 80 || opts.height < 80) {
    return [blocks.map((b) => htmlForBlock(b, opts.openIds))];
  }
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:absolute;left:-99999px;top:0;pointer-events:none;visibility:hidden;';
  const sheetStyle = opts.a4
    ? 'width:100%;height:100%;font-size:' + opts.font + '%;min-height:0;box-sizing:border-box'
    : `width:${opts.width}px;height:${opts.height}px;font-size:${opts.font}%;min-height:0;box-sizing:border-box`;
  const inner = `<div class="course-book-sheet is-${opts.theme}" style="${sheetStyle}">
    <div class="course-book-running">${escapeHtml(opts.header || 'Chapter')}</div>
    <div class="course-book-running-title">${escapeHtml(opts.chapterTitle || ' ')}</div>
    <div class="course-chapter course-book-body"></div>
    <div class="course-book-folio">0</div>
  </div>`;
  host.innerHTML = opts.a4
    ? `<div class="course-book is-a4" style="width:${opts.width}px"><div class="course-book-solo" style="width:${opts.width}px;height:${opts.height}px">${inner}</div></div>`
    : `<div class="course-book" style="width:${opts.width}px">${inner}</div>`;
  document.body.appendChild(host);
  const sheet = host.querySelector('.course-book-sheet') as HTMLElement;
  const body = host.querySelector('.course-book-body') as HTMLElement;
  if (sheet) {
    sheet.style.width = `${opts.width}px`;
    sheet.style.height = `${opts.height}px`;
  }
  const maxBody = body?.clientHeight || 0;
  if (!body || maxBody < 80) {
    host.remove();
    return [blocks.map((b) => htmlForBlock(b, opts.openIds))];
  }
  const imgMax = Math.max(120, opts.imgMax || Math.round(maxBody * 0.4));
  body.style.flex = '0 0 auto';
  body.style.height = 'auto';
  body.style.minHeight = '0';
  body.style.overflow = 'visible';
  body.style.setProperty('--course-img-max', `${imgMax}px`);
  const fits = () => body.scrollHeight <= maxBody - 6;
  const pages: string[][] = [];
  let current: string[] = [];

  const paint = async (pieces: string[]) => {
    body.innerHTML = pieces.join('');
    await waitForProbeImages(body);
    return fits();
  };

  const maxWords = async (base: string[], html: string, words: string[]) => {
    if (!words.length) return 0;
    let lo = 1;
    let hi = words.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (await paint(base.concat(htmlWithWords(html, words.slice(0, mid))))) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };

  const emitWords = async (html: string, words: string[]) => {
    let rest = words;
    while (rest.length) {
      let fitted = await maxWords(current, html, rest);
      if (fitted <= 0 && current.length) {
        pages.push(current);
        current = [];
        fitted = await maxWords(current, html, rest);
      }
      if (fitted <= 0) {
        current.push(htmlWithWords(html, rest));
        pages.push(current);
        current = [];
        break;
      }
      current.push(htmlWithWords(html, rest.slice(0, fitted)));
      rest = rest.slice(fitted);
      if (rest.length) {
        pages.push(current);
        current = [];
      }
    }
  };

  try {
    for (const block of blocks) {
      const full = htmlForBlock(block, opts.openIds);
      if (await paint(current.concat(full))) {
        current.push(full);
        continue;
      }
      if (canSplitBlock(block.kind)) {
        const words = wordsFromHtml(full);
        const fitted = await maxWords(current, full, words);
        if (fitted > 0 && fitted < words.length) {
          current.push(htmlWithWords(full, words.slice(0, fitted)));
          pages.push(current);
          current = [];
          await emitWords(full, words.slice(fitted));
          continue;
        }
      }
      if (current.length) {
        pages.push(current);
        current = [];
      }
      if (await paint([full])) {
        current.push(full);
        continue;
      }
      if (canSplitBlock(block.kind)) {
        await emitWords(full, wordsFromHtml(full));
      } else {
        current.push(full);
        pages.push(current);
        current = [];
      }
    }
    if (current.length) pages.push(current);
  } finally {
    host.remove();
  }
  return pages.length ? pages : [['<p>No content yet.</p>']];
}

export function foldText(value: string) {
  return value
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findRanges(text: string, marks: HighlightMark[]) {
  const foldedChars: string[] = [];
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      pendingSpace = foldedChars.length > 0;
      continue;
    }
    if (pendingSpace) {
      foldedChars.push(' ');
      map.push(i);
      pendingSpace = false;
    }
    foldedChars.push(foldText(ch) || ch.toLowerCase());
    map.push(i);
  }
  const hay = foldedChars.join('');
  const raw: { start: number; end: number; color: string; z: number }[] = [];
  marks.forEach((mark, z) => {
    const needle = foldText(mark.text);
    if (needle.length < 2) return;
    let from = 0;
    while (from <= hay.length) {
      const at = hay.indexOf(needle, from);
      if (at < 0) break;
      const last = at + needle.length - 1;
      if (last >= map.length) break;
      if (mark.wholeWord) {
        const beforeOk = at === 0 || hay[at - 1] === ' ';
        const afterOk = last + 1 >= hay.length || hay[last + 1] === ' ';
        if (!beforeOk || !afterOk) {
          from = at + 1;
          continue;
        }
      }
      raw.push({ start: map[at], end: map[last] + 1, color: mark.color || '#FFE66D', z });
      from = at + needle.length;
    }
  });
  const points = Array.from(new Set(raw.flatMap((r) => [r.start, r.end]))).sort((a, b) => a - b);
  const painted: { start: number; end: number; color: string }[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (a >= b) continue;
    let best: { z: number; color: string } | null = null;
    for (const range of raw) {
      if (range.start <= a && range.end >= b && (best == null || range.z < best.z)) {
        best = { z: range.z, color: range.color };
      }
    }
    if (!best) continue;
    const last = painted[painted.length - 1];
    if (last && last.end === a && last.color === best.color) last.end = b;
    else painted.push({ start: a, end: b, color: best.color });
  }
  return painted;
}

export function applyHighlights(html: string, marks: HighlightMark[]) {
  const usable = marks.filter((m) => m.text.trim().length >= 2);
  if (!usable.length || typeof window === 'undefined') return html;
  const root = document.createElement('div');
  root.innerHTML = html;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue || node.parentElement?.closest('mark, script, style')) continue;
    nodes.push(node);
  }
  for (const node of nodes) {
    const value = node.nodeValue || '';
    const ranges = findRanges(value, usable);
    if (!ranges.length) continue;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor)
        frag.appendChild(document.createTextNode(value.slice(cursor, range.start)));
      const mark = document.createElement('mark');
      mark.className = 'course-mark';
      mark.style.background = range.color;
      mark.textContent = value.slice(range.start, range.end);
      frag.appendChild(mark);
      cursor = range.end;
    }
    if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
    node.parentNode?.replaceChild(frag, node);
  }
  return root.innerHTML;
}

export function highlightOverlaps(highlightText: string, selection: string) {
  const a = foldText(highlightText);
  const b = foldText(selection);
  if (a.length < 2 || b.length < 2) return false;
  return a.includes(b) || b.includes(a);
}

export function highlightSame(a: string, b: string) {
  const left = foldText(a);
  const right = foldText(b);
  return left.length >= 2 && left === right;
}

export function tocFromPages(pages: string[][], startPage: number) {
  const items: { title: string; level: number; page: number }[] = [];
  pages.forEach((htmls, i) => {
    htmls.forEach((html) => {
      const match = html.match(/<h([123])[^>]*>([\s\S]*?)<\/h\1>/i);
      if (!match) return;
      const title = match[2]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title) return;
      items.push({ title, level: Number(match[1]), page: startPage + i });
    });
  });
  return items;
}

export function courseSpreads(pageCount: number): CourseSpread[] {
  const spreads: CourseSpread[] = [];
  if (pageCount <= 0) return [{ left: 0, right: null }];
  spreads.push({ left: 0, right: null });
  let i = 1;
  while (i < pageCount) {
    spreads.push({ left: i, right: i + 1 < pageCount ? i + 1 : null });
    i += 2;
  }
  return spreads;
}

export function spreadIndexFor(spreads: CourseSpread[], pageIndex: number) {
  const found = spreads.findIndex((s) => s.left === pageIndex || s.right === pageIndex);
  return found < 0 ? 0 : found;
}

export function selectedText() {
  if (typeof window === 'undefined') return '';
  return (window.getSelection()?.toString() || '').replace(/\s+/g, ' ').trim();
}
