'use client';

import React from 'react';
import { getApiOrigin } from '../../../../../../lib/apiBase';
import {
  addCourseBookmark,
  addCourseFlashcard,
  addCourseHighlight,
  addCourseNote,
  deleteCourseBookmark,
  deleteCourseFlashcard,
  deleteCourseHighlight,
  deleteCourseNote,
  fetchChapterFlashcards,
  fetchChapterStudy,
  updateCourseNote,
  type CourseBookmarkType,
  type CourseFlashcard,
  type CourseQuickCheckItem,
} from '../../../../../../lib/coursesApi';
import CourseFlashcards from './CourseFlashcards';
import CourseQuickCheck from './CourseQuickCheck';

const HIGHLIGHTER_COLORS = ['#FFE66D', '#A8E6A1', '#FFB7C5', '#A8D8FF', '#FFC48A'];
const BOOKMARK_TYPES: { id: CourseBookmarkType; label: string; color: string }[] = [
  { id: 'important', label: 'Important', color: '#c4452d' },
  { id: 'doubt', label: 'Doubt', color: '#2b6cb0' },
  { id: 'revise', label: 'Revise', color: '#2d7a3e' },
];

function asBookmarkType(v?: string | null): CourseBookmarkType {
  if (v === 'doubt' || v === 'revise') return v;
  return 'important';
}

function resolveSrc(src: string) {
  let value = src.replace(/&amp;/g, '&').trim();
  if (value.startsWith('//')) value = `https:${value}`;
  const origin = getApiOrigin();
  if (value.includes('/api/assets/serve')) {
    try {
      const u = new URL(value, origin || 'https://readerapi.vidhyavibe.in');
      const key = u.searchParams.get('key');
      if (key) {
        const path = `/api/assets/file/${key.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
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

function blocksFromHtml(html: string): { id: string; kind: string; text: string; html: string }[] {
  if (typeof window === 'undefined') return [];
  const wrap = document.createElement('div');
  wrap.innerHTML = rewriteImages(html || '');
  const nodes = Array.from(
    wrap.querySelectorAll(
      'h1,h2,h3,p,li,div.course-callout,div.course-split,div.course-flash,figure,img,details.course-explain,aside.course-explain,div.course-explain,aside.course-quick-block',
    ),
  ).filter((el) => {
    if (el.closest('.course-flash') && !el.classList.contains('course-flash')) return false;
    if (el.closest('.course-explain') && !el.classList.contains('course-explain')) return false;
    if (el.closest('.course-quick-block') && !el.classList.contains('course-quick-block'))
      return false;
    if (el.closest('div.course-split') && !el.classList.contains('course-split')) return false;
    if (el.tagName.toLowerCase() !== 'img') return true;
    return !el.closest('figure, p, li, h1, h2, h3, details, aside');
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
                : tag === 'p' && el.classList.contains('course-kicker')
                  ? 'kicker'
                  : tag;
      const id = `b-${i}`;
      if (kind === 'explain') el.setAttribute('data-explain-id', id);
      return { id, kind, text: (el.textContent || '').trim(), html: el.outerHTML };
    })
    .filter(
      (b) => b.text.length > 0 || b.kind === 'img' || b.kind === 'figure' || b.kind === 'split',
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function canSplitBlock(kind: string) {
  return (
    kind === 'p' || kind === 'li' || kind === 'callout' || kind === 'explain' || kind === 'kicker'
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

async function paginateByMeasure(
  blocks: { id: string; kind: string; text: string; html: string }[],
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

function foldText(value: string) {
  return value
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function foldSearch(value: string) {
  return foldText(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToText(html: string) {
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.innerHTML = html;
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function significantSearchWords(folded: string) {
  const stops = new Set([
    'a',
    'an',
    'the',
    'of',
    'in',
    'on',
    'to',
    'for',
    'and',
    'or',
    'is',
    'are',
    'was',
    'be',
    'by',
    'at',
    'as',
    'it',
    'if',
  ]);
  return folded.split(' ').filter((part) => part.length >= 2 && !stops.has(part));
}

function phraseMatchesSearch(hay: string, needle: string) {
  if (!needle || !hay) return false;
  const hayParts = hay.split(' ').filter(Boolean);
  if (!needle.includes(' ')) {
    if (needle.length <= 3) return hayParts.some((part) => part.startsWith(needle));
    return hayParts.includes(needle);
  }
  if (hay.includes(needle)) return true;
  const words = significantSearchWords(needle);
  if (!words.length) return false;
  const hayWords = significantSearchWords(hay);
  let j = 0;
  for (const word of hayWords) {
    if (j < words.length && word === words[j]) j += 1;
  }
  return j === words.length;
}

function clipSearchSnippet(text: string) {
  const snippet = text.replace(/\s+/g, ' ').trim();
  if (snippet.length <= 110) return snippet;
  return `${snippet.slice(0, 107).trim()}…`;
}

function findRanges(text: string, marks: { text: string; color?: string; wholeWord?: boolean }[]) {
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

function applyHighlights(
  html: string,
  marks: { text: string; color?: string; wholeWord?: boolean }[],
) {
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

function highlightOverlaps(highlightText: string, selection: string) {
  const a = foldText(highlightText);
  const b = foldText(selection);
  if (a.length < 2 || b.length < 2) return false;
  return a.includes(b) || b.includes(a);
}

function highlightSame(a: string, b: string) {
  const left = foldText(a);
  const right = foldText(b);
  return left.length >= 2 && left === right;
}

function tocFromPages(pages: string[][], startPage: number) {
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

function searchPages(pages: string[][], startPage: number, query: string) {
  const needle = foldSearch(query);
  if (needle.length < 2) return [] as { snippet: string; page: number; anchor: string }[];
  const hits: { snippet: string; page: number; anchor: string }[] = [];
  const seen = new Set<string>();
  tocFromPages(pages, startPage).forEach((item) => {
    const title = item.title.trim();
    const key = foldSearch(title);
    if (!title || seen.has(key) || !phraseMatchesSearch(key, needle)) return;
    seen.add(key);
    hits.push({ snippet: title, page: item.page, anchor: title });
  });
  pages.forEach((htmls, i) => {
    for (const html of htmls) {
      if (/<h[123]\b/i.test(html)) continue;
      const text = htmlToText(html);
      if (!text || /^loading/i.test(text)) continue;
      if (!phraseMatchesSearch(foldSearch(text), needle)) continue;
      const key = foldSearch(text);
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ snippet: clipSearchSnippet(text), page: startPage + i, anchor: text });
      break;
    }
  });
  return hits;
}

function selectedText() {
  if (typeof window === 'undefined') return '';
  return (window.getSelection()?.toString() || '').replace(/\s+/g, ' ').trim();
}

type StudyState = {
  bookmarks: { id: number; pageNumber: number; markType?: CourseBookmarkType }[];
  notes: { id: number; pageNumber?: number | null; content: string; quote?: string | null }[];
  highlights: { id: number; pageNumber?: number | null; text: string; color?: string }[];
};

const OPEN_BOOK_MIN_WIDTH = 900;

type CourseSpread = { left: number | null; right: number | null };

function courseSpreads(pageCount: number, _startPage: number): CourseSpread[] {
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

function spreadIndexFor(spreads: CourseSpread[], pageIndex: number) {
  const found = spreads.findIndex((s) => s.left === pageIndex || s.right === pageIndex);
  return found < 0 ? 0 : found;
}

function useA4PageSize(leaves: 1 | 2) {
  const [size, setSize] = React.useState({ w: 420, h: 594 });
  React.useEffect(() => {
    const update = () => {
      const maxH = Math.min(window.innerHeight * 0.78, 900);
      const maxW = Math.min(window.innerWidth - 40, 1360);
      const ratio = 297 / 210;
      const gutter = leaves === 2 ? 14 : 0;
      let height = maxH;
      let width = height / ratio;
      if (width * leaves + gutter > maxW) {
        width = (maxW - gutter) / leaves;
        height = width * ratio;
      }
      setSize({ w: Math.round(width), h: Math.round(height) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [leaves]);
  return size;
}

function useWideCourseReader() {
  const [wide, setWide] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth >= OPEN_BOOK_MIN_WIDTH,
  );
  React.useEffect(() => {
    const update = () => setWide(window.innerWidth >= OPEN_BOOK_MIN_WIDTH);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return wide;
}

export default function CourseBookReader({
  html,
  header,
  chapterTitle,
  startPage = 1,
  chapterId,
  initialPage,
  quickChecks = [],
}: {
  html: string;
  header: string;
  chapterTitle: string;
  startPage?: number;
  chapterId?: number;
  initialPage?: number;
  quickChecks?: CourseQuickCheckItem[];
}) {
  const [index, setIndex] = React.useState(0);
  const [pages, setPages] = React.useState<string[][]>([['<p>Loading…</p>']]);
  const wide = useWideCourseReader();
  const [wantSpread, setWantSpread] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('vv_course_spread') !== '0';
    } catch {
      return true;
    }
  });
  const [toolIndex, setToolIndex] = React.useState(0);
  const [study, setStudy] = React.useState<StudyState>({
    bookmarks: [],
    notes: [],
    highlights: [],
  });
  const [cards, setCards] = React.useState<CourseFlashcard[]>([]);
  const [cardFront, setCardFront] = React.useState('');
  const [cardBack, setCardBack] = React.useState('');
  const [picked, setPicked] = React.useState('');
  const [ink, setInk] = React.useState(HIGHLIGHTER_COLORS[0]);
  const [noteDraft, setNoteDraft] = React.useState('');
  const [noteQuote, setNoteQuote] = React.useState('');
  const [quoteMark, setQuoteMark] = React.useState('');
  const [openExplains, setOpenExplains] = React.useState<string[]>([]);
  const [ribbonPage, setRibbonPage] = React.useState<number | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editDraft, setEditDraft] = React.useState('');
  const [panel, setPanel] = React.useState<
    | 'contents'
    | 'search'
    | 'highlights'
    | 'notes'
    | 'display'
    | 'bookmarks'
    | 'progress'
    | 'check'
    | 'cards'
  >('contents');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'paper' | 'sepia' | 'night'>(() => {
    if (typeof window === 'undefined') return 'paper';
    try {
      const stored = window.localStorage.getItem('vv_course_theme');
      if (stored === 'paper' || stored === 'sepia' || stored === 'night') return stored;
    } catch {
      /* ignore */
    }
    return 'paper';
  });
  const [font, setFont] = React.useState(() => {
    if (typeof window === 'undefined') return 100;
    try {
      return Number(window.localStorage.getItem('vv_course_font')) || 100;
    } catch {
      return 100;
    }
  });
  const [query, setQuery] = React.useState('');
  const [submittedQuery, setSubmittedQuery] = React.useState('');
  const [activeSearch, setActiveSearch] = React.useState('');
  const lastSelection = React.useRef('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  const loadStudy = React.useCallback(() => {
    if (!chapterId) return;
    fetchChapterStudy(chapterId)
      .then(setStudy)
      .catch(() => {});
    fetchChapterFlashcards(chapterId)
      .then(setCards)
      .catch(() => setCards([]));
  }, [chapterId]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('vv_course_theme', theme);
      window.localStorage.setItem('vv_course_font', String(font));
      window.localStorage.setItem('vv_course_spread', wantSpread ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [theme, font, wantSpread]);

  const htmlRef = React.useRef<string | null>(null);
  const explainAnchor = React.useRef<string | null>(null);
  const bookRef = React.useRef<HTMLDivElement | null>(null);
  const spread = wide && wantSpread;
  const spreads = React.useMemo(
    () => courseSpreads(pages.length, startPage),
    [pages.length, startPage],
  );
  const spreadAt = spreadIndexFor(spreads, index);
  const openSpread = spread
    ? spreads[spreadAt] || { left: index, right: null }
    : { left: index, right: null };
  const soloLeaf = !spread || openSpread.left == null || openSpread.right == null;
  const a4 = useA4PageSize(spread && !soloLeaf ? 2 : 1);
  const imgMax = Math.max(120, Math.round(a4.h * 0.28));
  const goSpread = React.useCallback(
    (delta: number) => {
      if (!spread) {
        setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + delta)));
        return;
      }
      const nextAt = Math.min(spreads.length - 1, Math.max(0, spreadAt + delta));
      const next = spreads[nextAt];
      const target = next?.left ?? next?.right ?? 0;
      setIndex(target);
      setToolIndex(target);
    },
    [spread, spreadAt, spreads, pages.length],
  );

  React.useEffect(() => {
    let cancelled = false;
    const pageW = spread ? a4.w : Math.min(window.innerWidth - 40, 720);
    const pageH = spread ? a4.h : Math.min(window.innerHeight * 0.72, 860);
    const htmlChanged = htmlRef.current !== html;
    htmlRef.current = html;
    paginateByMeasure(blocksFromHtml(html), {
      width: pageW,
      height: pageH,
      font,
      theme,
      openIds: openExplains,
      header,
      chapterTitle,
      a4: spread,
      imgMax,
    }).then((pagesHtml) => {
      if (cancelled) return;
      setPages(pagesHtml);
      const anchor = explainAnchor.current;
      explainAnchor.current = null;
      setIndex((i) => {
        if (anchor) {
          const found = pagesHtml.findIndex((page) =>
            page.some((item) => item.includes(`data-explain-id="${anchor}"`)),
          );
          if (found >= 0) return found;
        }
        const raw = htmlChanged ? (initialPage ? Math.max(0, initialPage - startPage) : 0) : i;
        return Math.min(Math.max(0, raw), Math.max(0, pagesHtml.length - 1));
      });
      setToolIndex((i) => Math.min(Math.max(0, i), Math.max(0, pagesHtml.length - 1)));
    });
    return () => {
      cancelled = true;
    };
  }, [
    html,
    font,
    theme,
    a4.w,
    a4.h,
    openExplains,
    initialPage,
    startPage,
    spread,
    header,
    chapterTitle,
    imgMax,
  ]);

  React.useEffect(() => {
    loadStudy();
  }, [loadStudy]);

  React.useEffect(() => {
    if (ribbonPage == null) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('.course-book-ribbon-wrap')) return;
      setRibbonPage(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ribbonPage]);

  React.useEffect(() => {
    if (panel === 'search') searchRef.current?.focus();
  }, [panel]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement | null)?.isContentEditable
      )
        return;
      if (e.key === 'ArrowRight') goSpread(1);
      if (e.key === 'ArrowLeft') goSpread(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goSpread]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const flash = target?.closest?.('.course-flash') as HTMLElement | null;
      if (flash && bookRef.current?.contains(flash)) {
        e.preventDefault();
        e.stopPropagation();
        flash.classList.toggle('is-flipped');
        return;
      }
      const opt = target?.closest?.('.course-quick-block [data-opt]') as HTMLElement | null;
      const quiz = opt?.closest?.('.course-quick-block') as HTMLElement | null;
      if (quiz && opt && bookRef.current?.contains(quiz)) {
        e.preventDefault();
        e.stopPropagation();
        if (quiz.classList.contains('is-checked')) return;
        const picked = Number(opt.getAttribute('data-opt'));
        const answer = Number(quiz.getAttribute('data-answer'));
        quiz.classList.add('is-checked');
        quiz.querySelectorAll('[data-opt]').forEach((btn) => {
          const i = Number(btn.getAttribute('data-opt'));
          btn.classList.toggle('is-on', i === picked);
          btn.classList.toggle('is-right', i === answer);
          btn.classList.toggle('is-wrong', i === picked && i !== answer);
        });
        return;
      }
      const summary = target?.closest?.('.course-explain summary');
      if (!summary || !bookRef.current?.contains(summary)) return;
      const details = summary.closest('details.course-explain') as HTMLDetailsElement | null;
      if (!details) return;
      e.preventDefault();
      e.stopPropagation();
      const id = details.getAttribute('data-explain-id');
      if (!id) return;
      explainAnchor.current = id;
      const nextOpen = !details.open;
      setOpenExplains((ids) => {
        const has = ids.includes(id);
        if (nextOpen && !has) return [...ids, id];
        if (!nextOpen && has) return ids.filter((item) => item !== id);
        return ids;
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  React.useEffect(() => {
    const onSel = () => {
      const text = selectedText();
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement;
      const pageEl = el?.closest('[data-course-page]');
      if (pageEl) {
        const next = Number(pageEl.getAttribute('data-course-page'));
        if (Number.isFinite(next)) setToolIndex(next);
      }
      if (text.length >= 2) {
        lastSelection.current = text;
        setPicked(text);
        return;
      }
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPicked('');
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const toolPage = Math.min(Math.max(0, toolIndex), Math.max(0, pages.length - 1));
  const printed = startPage + toolPage;
  const visiblePages = [openSpread.left, openSpread.right].filter((v): v is number => v != null);
  const bookmarkFor = (pageIndex: number) =>
    study.bookmarks.find((b) => b.pageNumber === startPage + pageIndex);
  const searchMarks =
    activeSearch.trim().length >= 2
      ? [{ text: activeSearch.trim(), color: '#9EE7FF', wholeWord: true }]
      : [];
  const quoteMarks =
    quoteMark.trim().length >= 2
      ? [{ text: quoteMark.trim(), color: '#CDE8C5', wholeWord: false }]
      : [];
  const markedPage = (pageIndex: number) =>
    applyHighlights(pages[pageIndex]?.join('') || '', [
      ...study.highlights,
      ...searchMarks,
      ...quoteMarks,
    ]);
  const canRemove =
    picked.length >= 2 && study.highlights.some((h) => highlightOverlaps(h.text, picked));
  const toc = tocFromPages(pages, startPage);
  const searchHits = searchPages(pages, startPage, submittedQuery);

  const runSearch = () => {
    setSubmittedQuery(query.trim());
  };
  const topicIndex = toc.reduce((best, item, i) => (item.page <= printed ? i : best), 0);
  const topicLabel = toc.length ? `Topic ${topicIndex + 1} of ${toc.length}` : '';
  const lastPrinted = startPage + Math.max(0, pages.length - 1);
  const visiblePrinted = visiblePages.map((p) => startPage + p);
  const pageCheck =
    quickChecks.find(
      (item) => item.pageNumber != null && visiblePrinted.includes(item.pageNumber),
    ) ||
    (visiblePrinted.includes(lastPrinted)
      ? quickChecks.find((item) => item.pageNumber == null)
      : undefined);
  const panelTitle = {
    contents: 'Contents',
    search: 'Search',
    highlights: 'Highlights',
    notes: 'Notes',
    display: 'Display',
    bookmarks: 'Bookmarks',
    progress: 'Progress',
    check: 'Quick check',
    cards: 'Flashcards',
  }[panel];

  const setBookmark = async (markType: CourseBookmarkType, pageIndex = toolPage) => {
    if (!chapterId) return;
    try {
      await addCourseBookmark(chapterId, startPage + pageIndex, markType);
      setRibbonPage(null);
      loadStudy();
    } catch {
      alert('Could not update bookmark. Please login and try again.');
    }
  };

  const removeBookmark = async (id?: number) => {
    const target = id ?? bookmarkFor(toolPage)?.id;
    if (!target) return;
    try {
      await deleteCourseBookmark(target);
      setRibbonPage(null);
      loadStudy();
    } catch {
      alert('Could not update bookmark. Please login and try again.');
    }
  };

  const highlightSelection = async (color = ink) => {
    if (!chapterId) return;
    const text = (picked || lastSelection.current).trim();
    if (text.length < 2) {
      alert('Select a phrase in the page first, then choose a color.');
      return;
    }
    try {
      const same = study.highlights.filter((h) => highlightSame(h.text, text));
      await Promise.all(same.map((h) => deleteCourseHighlight(h.id)));
      await addCourseHighlight(chapterId, text, printed, color);
      window.getSelection()?.removeAllRanges();
      lastSelection.current = '';
      setPicked('');
      loadStudy();
    } catch {
      alert('Could not save highlight. Please login and try again.');
    }
  };

  const removeHighlights = async () => {
    if (!chapterId) return;
    const text = (picked || lastSelection.current).trim();
    const matches = study.highlights.filter((h) => highlightOverlaps(h.text, text));
    if (!matches.length) {
      alert('Select highlighted text to remove it.');
      return;
    }
    try {
      await Promise.all(matches.map((h) => deleteCourseHighlight(h.id)));
      window.getSelection()?.removeAllRanges();
      lastSelection.current = '';
      setPicked('');
      loadStudy();
    } catch {
      alert('Could not remove highlight.');
    }
  };

  const addNoteFromSelection = () => {
    const text = (picked || lastSelection.current).trim();
    setNoteQuote(text);
    setNoteDraft('');
    setPanel('notes');
    document.getElementById('course-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('course-note-draft')?.focus(), 250);
  };

  const addFlashcardFromSelection = () => {
    const text = (picked || lastSelection.current).trim();
    setCardFront(text);
    setCardBack('');
    setPanel('cards');
    document.getElementById('course-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('course-flash-back')?.focus(), 250);
  };

  const saveFlashcard = async () => {
    if (!chapterId) return;
    const front = cardFront.trim();
    const back = cardBack.trim();
    if (!front || !back) return;
    try {
      await addCourseFlashcard(chapterId, front, back, printed);
      setCardFront('');
      setCardBack('');
      loadStudy();
    } catch {
      alert('Could not save the flashcard. Please login and try again.');
    }
  };

  const saveNote = async () => {
    if (!chapterId) return;
    const content = noteDraft.trim();
    if (!content) return;
    try {
      await addCourseNote(chapterId, content, printed, noteQuote.trim() || undefined);
      setNoteDraft('');
      setNoteQuote('');
      loadStudy();
    } catch {
      alert('Could not save the note. Please login and try again.');
    }
  };

  const saveEdit = async (id: number) => {
    const content = editDraft.trim();
    if (!content) return;
    try {
      await updateCourseNote(id, content);
      setEditingId(null);
      loadStudy();
    } catch {
      alert('Could not update the note.');
    }
  };

  const renderSheet = (pageIndex: number | null, side?: 'verso' | 'recto') => {
    const sideClass = side ? ` is-${side}` : '';
    if (pageIndex == null) {
      return (
        <div
          className={`course-book-sheet is-${theme}${sideClass} is-blank`}
          style={{ fontSize: `${font}%` }}
        >
          <div className="course-book-running">{header}</div>
          <div className="course-book-running-title">{chapterTitle}</div>
          <div className="course-book-body" />
        </div>
      );
    }
    const pagePrinted = startPage + pageIndex;
    const bookmark = bookmarkFor(pageIndex);
    return (
      <div
        className={`course-book-sheet is-${theme}${sideClass}`}
        style={{ fontSize: `${font}%` }}
        data-course-page={pageIndex}
      >
        {chapterId ? (
          <div className="course-book-ribbon-wrap">
            <button
              type="button"
              className={`course-book-ribbon${bookmark ? ` is-on is-${asBookmarkType(bookmark.markType)}` : ''}`}
              aria-label={bookmark ? 'Change or remove bookmark' : 'Bookmark this page'}
              title={bookmark ? 'Change or remove bookmark' : 'Bookmark this page'}
              onClick={() => setRibbonPage((open) => (open === pagePrinted ? null : pagePrinted))}
            />
            {ribbonPage === pagePrinted ? (
              <div className="course-bookmark-picker" role="menu">
                {BOOKMARK_TYPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={
                      bookmark && asBookmarkType(bookmark.markType) === item.id ? 'is-on' : ''
                    }
                    onClick={() => setBookmark(item.id, pageIndex)}
                  >
                    <span className="course-bookmark-swatch" style={{ background: item.color }} />
                    {item.label}
                  </button>
                ))}
                {bookmark ? (
                  <button type="button" role="menuitem" onClick={() => removeBookmark(bookmark.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="course-book-running">{header}</div>
        <div className="course-book-running-title">{chapterTitle}</div>
        <div
          className="course-chapter course-book-body"
          data-course-page={pageIndex}
          dangerouslySetInnerHTML={{ __html: markedPage(pageIndex) }}
        />
        <div className="course-book-folio">{pagePrinted}</div>
      </div>
    );
  };

  const pageMeta = spread
    ? visiblePrinted.length > 1
      ? `${visiblePrinted[0]}–${visiblePrinted[visiblePrinted.length - 1]}`
      : String(visiblePrinted[0] || startPage)
    : String(printed);

  return (
    <div className={`course-reader-with-notes${spread ? ' is-spread' : ''}`}>
      <div
        ref={bookRef}
        className={`course-book${spread ? ' is-spread is-a4' : ''}${spread && soloLeaf ? ' is-solo' : ''}`}
        style={{ ['--course-img-max' as string]: `${imgMax}px` } as React.CSSProperties}
      >
        {spread && soloLeaf ? (
          <div className="course-book-solo" style={{ width: a4.w, height: a4.h }}>
            {renderSheet(openSpread.left ?? openSpread.right ?? index)}
          </div>
        ) : spread ? (
          <div className="course-book-open" style={{ width: a4.w * 2 + 14, height: a4.h }}>
            {renderSheet(openSpread.left, 'verso')}
            <div className="course-book-gutter" aria-hidden />
            {renderSheet(openSpread.right, 'recto')}
          </div>
        ) : (
          renderSheet(index)
        )}
        {chapterId ? (
          <div className="course-selection-bar">
            <div className="course-ink-row">
              {HIGHLIGHTER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`course-ink-dot${ink === color ? ' is-on' : ''}`}
                  style={{ background: color }}
                  aria-label={`Highlight ${color}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setInk(color);
                    if (picked.length >= 2) highlightSelection(color);
                  }}
                />
              ))}
            </div>
            {picked.length >= 2 ? (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => highlightSelection()}
                >
                  Highlight
                </button>
                {canRemove ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={removeHighlights}
                  >
                    Remove
                  </button>
                ) : null}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addNoteFromSelection}
                >
                  Add to notes
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addFlashcardFromSelection}
                >
                  Flashcard
                </button>
              </>
            ) : (
              <p className="course-highlight-hint">Select text, then tap a color.</p>
            )}
          </div>
        ) : null}
        <div className="course-book-nav">
          <button
            type="button"
            disabled={spread ? spreadAt <= 0 : index <= 0}
            onClick={() => goSpread(-1)}
          >
            ← Previous
          </button>
          <div className="course-book-page-meta">
            <span>
              {spread ? `${pageMeta} · ${pages.length} pages` : `${index + 1} / ${pages.length}`}
            </span>
            {topicLabel ? <small>{topicLabel}</small> : null}
          </div>
          <button
            type="button"
            disabled={spread ? spreadAt >= spreads.length - 1 : index >= pages.length - 1}
            onClick={() => goSpread(1)}
          >
            Next →
          </button>
        </div>
        {pageCheck ? (
          <button type="button" className="course-quick-launch" onClick={() => setPanel('check')}>
            <strong>Quick check</strong>
            <span>{pageCheck.title}</span>
          </button>
        ) : null}
        {cards.length ? (
          <button
            type="button"
            className="course-quick-launch course-flash-launch"
            onClick={() => setPanel('cards')}
          >
            <strong>Flashcards</strong>
            <span>
              {cards.length} card{cards.length === 1 ? '' : 's'} from this chapter
            </span>
          </button>
        ) : null}
      </div>
      {chapterId ? (
        <aside className="course-notes-section" id="course-notes">
          <div className="course-kebab-bar">
            <h2>{panelTitle}</h2>
            <div className="course-kebab">
              <button
                type="button"
                className="course-kebab-btn"
                aria-label="Reader menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ⋮
              </button>
              {menuOpen ? (
                <div className="course-kebab-menu" role="menu">
                  {(
                    [
                      ['contents', 'Contents'],
                      ['search', 'Search'],
                      ['highlights', 'Highlights'],
                      ['notes', 'Notes'],
                      ['bookmarks', 'Bookmarks'],
                      ['progress', 'Progress'],
                      ['display', 'Display'],
                      ...(quickChecks.length ? ([['check', 'Quick check']] as const) : []),
                      ['cards', 'Flashcards'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      className={panel === id ? 'is-on' : ''}
                      onClick={() => {
                        setPanel(id);
                        setMenuOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {panel === 'contents' ? (
            <>
              {toc.length === 0 ? (
                <p className="course-notes-empty">No headings in this chapter yet.</p>
              ) : null}
              {toc.map((item, i) => (
                <button
                  key={`${item.page}-${i}`}
                  type="button"
                  className="course-toc-item"
                  style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
                  onClick={() => setIndex(Math.max(0, item.page - startPage))}
                >
                  <span>{item.title}</span>
                  <span>p.{item.page}</span>
                </button>
              ))}
            </>
          ) : null}
          {panel === 'search' ? (
            <>
              <form
                className="course-search-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch();
                }}
              >
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Find a word or phrase"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                <button type="submit">Search</button>
              </form>
              {activeSearch ? (
                <p className="course-notes-kicker">
                  Showing “{activeSearch}”{' '}
                  <button
                    type="button"
                    className="course-note-page"
                    onClick={() => {
                      setActiveSearch('');
                      setQuery('');
                      setSubmittedQuery('');
                    }}
                  >
                    Remove search
                  </button>
                </p>
              ) : null}
              {!submittedQuery ? (
                <p className="course-notes-empty">Type a word, then press Search.</p>
              ) : submittedQuery.length < 2 ? (
                <p className="course-notes-empty">Type at least 2 letters.</p>
              ) : searchHits.length === 0 ? (
                <p className="course-notes-empty">No matches in this chapter.</p>
              ) : (
                <>
                  <p className="course-notes-kicker">
                    {searchHits.length} suggestion{searchHits.length === 1 ? '' : 's'}
                  </p>
                  {searchHits.map((hit, i) => (
                    <button
                      key={`${hit.page}-${i}`}
                      type="button"
                      className="course-toc-item"
                      onClick={() => {
                        const typed = query.trim();
                        setActiveSearch(typed);
                        const heading = foldSearch(hit.anchor);
                        const found = pages.findIndex((htmls) =>
                          htmls.some((html) => {
                            if (!/<h[123]\b/i.test(html)) return false;
                            const title = foldSearch(htmlToText(html));
                            return (
                              title === heading ||
                              (heading.length >= 8 && title.includes(heading)) ||
                              (title.length >= 8 && heading.includes(title))
                            );
                          }),
                        );
                        setIndex(
                          found >= 0
                            ? found
                            : Math.max(0, Math.min(pages.length - 1, hit.page - startPage)),
                        );
                      }}
                    >
                      <span>{hit.snippet}</span>
                      <span>p.{hit.page}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          ) : null}
          {panel === 'highlights' ? (
            <>
              {study.highlights.length === 0 ? (
                <p className="course-notes-empty">Select text, then choose a color.</p>
              ) : null}
              {study.highlights.map((h) => (
                <article key={`h-${h.id}`} className="course-note-card">
                  {h.pageNumber ? (
                    <button
                      type="button"
                      className="course-note-page"
                      onClick={() => setIndex(Math.max(0, h.pageNumber! - startPage))}
                    >
                      Page {h.pageNumber}
                    </button>
                  ) : null}
                  <p>
                    <mark className="course-mark" style={{ background: h.color || '#FFE66D' }}>
                      {h.text}
                    </mark>
                  </p>
                  <div className="course-note-actions">
                    <button
                      type="button"
                      onClick={() => deleteCourseHighlight(h.id).then(loadStudy)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </>
          ) : null}
          {panel === 'notes' ? (
            <>
              <p className="course-notes-kicker">Page {printed}</p>
              {study.notes.length === 0 ? (
                <p className="course-notes-empty">No notes yet for this chapter.</p>
              ) : null}
              {study.notes.map((n) => (
                <article key={`n-${n.id}`} className="course-note-card">
                  {n.pageNumber ? (
                    <button
                      type="button"
                      className="course-note-page"
                      onClick={() => {
                        setIndex(Math.max(0, n.pageNumber! - startPage));
                        setQuoteMark(n.quote || '');
                      }}
                    >
                      Page {n.pageNumber}
                    </button>
                  ) : null}
                  {n.quote ? (
                    <blockquote className="course-note-quote">“{n.quote}”</blockquote>
                  ) : null}
                  {editingId === n.id ? (
                    <>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={4}
                      />
                      <div className="course-note-actions">
                        <button type="button" onClick={() => saveEdit(n.id)}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{n.content}</p>
                      <div className="course-note-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditDraft(n.content);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCourseNote(n.id).then(loadStudy)}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
              <label htmlFor="course-note-draft">New note</label>
              {noteQuote ? (
                <blockquote className="course-note-quote">
                  “{noteQuote}”{' '}
                  <button
                    type="button"
                    className="course-note-page"
                    onClick={() => setNoteQuote('')}
                  >
                    Remove quote
                  </button>
                </blockquote>
              ) : (
                <p className="course-notes-kicker">Select text in the book to attach a quote.</p>
              )}
              <textarea
                id="course-note-draft"
                rows={5}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write your note for this page…"
              />
              <button type="button" className="course-note-save" onClick={saveNote}>
                Save note
              </button>
            </>
          ) : null}
          {panel === 'display' ? (
            <>
              <p className="course-notes-kicker">Paper</p>
              <div className="course-theme-row">
                {(['paper', 'sepia', 'night'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={theme === item ? 'is-on' : ''}
                    onClick={() => setTheme(item)}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
              <p className="course-notes-kicker">Text size</p>
              <div className="course-theme-row">
                <button type="button" onClick={() => setFont((v) => Math.max(85, v - 10))}>
                  A-
                </button>
                <span>{font}%</span>
                <button type="button" onClick={() => setFont((v) => Math.min(130, v + 10))}>
                  A+
                </button>
              </div>
              {wide ? (
                <>
                  <p className="course-notes-kicker">Layout</p>
                  <div className="course-theme-row">
                    <button
                      type="button"
                      className={wantSpread ? 'is-on' : ''}
                      onClick={() => setWantSpread(true)}
                    >
                      Open book
                    </button>
                    <button
                      type="button"
                      className={!wantSpread ? 'is-on' : ''}
                      onClick={() => setWantSpread(false)}
                    >
                      One page
                    </button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {panel === 'bookmarks' ? (
            <>
              {study.bookmarks.length === 0 ? (
                <p className="course-notes-empty">
                  Tap the ribbon and choose Important, Doubt, or Revise.
                </p>
              ) : null}
              {study.bookmarks.map((b) => {
                const type = BOOKMARK_TYPES.find((item) => item.id === asBookmarkType(b.markType));
                return (
                  <article key={`b-${b.id}`} className="course-note-card">
                    <button
                      type="button"
                      className="course-note-page"
                      onClick={() => setIndex(Math.max(0, b.pageNumber - startPage))}
                    >
                      Page {b.pageNumber}
                    </button>
                    <p className="course-mark-type" style={{ color: type?.color }}>
                      {type?.label || 'Important'}
                    </p>
                    <div className="course-note-actions">
                      <button type="button" onClick={() => removeBookmark(b.id)}>
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </>
          ) : null}
          {panel === 'progress' ? (
            <>
              <p className="course-notes-kicker">
                {toc.length
                  ? `Topic ${topicIndex + 1} of ${toc.length}`
                  : `Page ${index + 1} of ${pages.length}`}
              </p>
              <div className="course-progress-bar">
                <span
                  style={{
                    width: `${toc.length ? ((topicIndex + 1) / toc.length) * 100 : ((index + 1) / Math.max(pages.length, 1)) * 100}%`,
                  }}
                />
              </div>
              <p className="course-notes-kicker">{toc[topicIndex]?.title || chapterTitle}</p>
              {toc.length === 0 ? (
                <p className="course-notes-empty">No section headings in this chapter yet.</p>
              ) : null}
              {toc.map((item, i) => (
                <button
                  key={`${item.page}-${i}`}
                  type="button"
                  className={`course-toc-item${i === topicIndex ? ' is-on' : ''}`}
                  style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
                  onClick={() => setIndex(Math.max(0, item.page - startPage))}
                >
                  <span>
                    {item.page <= printed ? '✓ ' : ''}
                    {item.title}
                  </span>
                  <span>p.{item.page}</span>
                </button>
              ))}
            </>
          ) : null}
          {panel === 'check' ? (
            quickChecks.length === 0 ? (
              <p className="course-notes-empty">No quick check is attached to this chapter yet.</p>
            ) : (
              quickChecks.map((item) => <CourseQuickCheck key={item.id} item={item} />)
            )
          ) : null}
          {panel === 'cards' ? (
            <>
              <p className="course-notes-kicker">
                Cards are taken from this chapter. Add your own from selected text.
              </p>
              <label htmlFor="course-flash-front">Term</label>
              <input
                id="course-flash-front"
                value={cardFront}
                onChange={(e) => setCardFront(e.target.value)}
                placeholder="Term or heading"
              />
              <label htmlFor="course-flash-back">Meaning</label>
              <textarea
                id="course-flash-back"
                rows={3}
                value={cardBack}
                onChange={(e) => setCardBack(e.target.value)}
                placeholder="Write the meaning in your own words"
              />
              <button
                type="button"
                className="course-note-save"
                disabled={!cardFront.trim() || !cardBack.trim()}
                onClick={saveFlashcard}
              >
                Save my card
              </button>
              <CourseFlashcards
                cards={cards}
                onDelete={(id) => deleteCourseFlashcard(id).then(loadStudy)}
              />
            </>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
