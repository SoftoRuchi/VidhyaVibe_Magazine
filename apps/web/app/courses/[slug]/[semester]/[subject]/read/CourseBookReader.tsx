'use client';

import Link from 'next/link';
import React from 'react';
import { getApiOrigin } from '../../../../../../lib/apiBase';
import {
  buildCourseInteractives,
  injectConceptHotspots,
} from '../../../../../../lib/courseInteractives';
import {
  addCourseBookmark,
  addCourseHighlight,
  addCourseNote,
  deleteCourseBookmark,
  deleteCourseHighlight,
  deleteCourseNote,
  fetchChapterStudy,
  updateCourseNote,
  type CourseBookmarkType,
  type CourseQuickCheckItem,
} from '../../../../../../lib/coursesApi';
import CourseInteractives from './CourseInteractives';
import CourseNotesPanel from './CourseNotesPanel';
import CourseQuickCheck from './CourseQuickCheck';

const HIGHLIGHTER_COLORS = ['#FFE66D', '#A8E6A1', '#FFB7C5', '#C5E8C8', '#FFC48A'];
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function coverPageHtml(src: string, label: string) {
  return `<figure class="course-book-cover"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" /></figure>`;
}

function withCoverPages(pages: string[][], front?: string | null, back?: string | null) {
  let next = pages;
  if (front) next = [[coverPageHtml(front, 'Front cover')], ...next];
  if (back) next = [...next, [coverPageHtml(back, 'Back cover')]];
  return next.length ? next : pages;
}

function isCoverHtml(html: string) {
  return /course-book-cover/.test(html);
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
  host.className = 'course-book-measure';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:absolute;left:-99999px;top:0;pointer-events:none;visibility:hidden;';
  host.style.setProperty('--course-text-scale', String(opts.font / 100));
  const sheetStyle = opts.a4
    ? 'width:100%;height:100%;font-size:' + opts.font + '%;min-height:0;box-sizing:border-box'
    : `width:${opts.width}px;height:${opts.height}px;font-size:${opts.font}%;min-height:0;box-sizing:border-box`;
  const inner = `<div class="course-book-sheet is-${opts.theme} is-verso" style="${sheetStyle}">
    <div class="course-book-running">${escapeHtml(opts.header || 'Chapter')}</div>
    <div class="course-book-running-title">${escapeHtml(opts.chapterTitle || ' ')}</div>
    <div class="course-chapter course-book-body"></div>
    <div class="course-book-folio">0</div>
  </div>`;
  host.innerHTML = opts.a4
    ? `<div class="course-book is-a4 is-spread" style="width:${opts.width}px"><div class="course-book-solo" style="width:${opts.width}px;height:${opts.height}px">${inner}</div></div>`
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
    return hayParts.some(
      (part) =>
        part === needle || part.startsWith(needle) || (needle.length >= 4 && part.includes(needle)),
    );
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

function collectHighlightNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue) continue;
    if (node.parentElement?.closest('mark, script, style')) continue;
    nodes.push(node);
  }
  return nodes;
}

function buildHighlightIndex(nodes: Text[]) {
  const chars: string[] = [];
  const map: { node: Text; offset: number }[] = [];
  let pendingSpace = false;
  nodes.forEach((node, nodeAt) => {
    const value = node.nodeValue || '';
    if (nodeAt > 0 && chars.length && !pendingSpace && value.length && !/^\s/.test(value)) {
      pendingSpace = true;
    }
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (/\s/.test(ch)) {
        pendingSpace = chars.length > 0;
        continue;
      }
      if (pendingSpace) {
        chars.push(' ');
        map.push({ node, offset: i });
        pendingSpace = false;
      }
      chars.push(foldText(ch) || ch.toLowerCase());
      map.push({ node, offset: i });
    }
  });
  return { hay: chars.join(''), map };
}

function locateHighlight(hay: string, rawNeedle: string, wholeWord?: boolean) {
  const needle = foldText(rawNeedle);
  if (needle.length < 2 || !hay) return [] as { at: number; len: number }[];
  const hits: { at: number; len: number }[] = [];
  const pushAll = (term: string) => {
    if (term.length < 2) return false;
    let from = 0;
    let found = false;
    while (from <= hay.length) {
      const at = hay.indexOf(term, from);
      if (at < 0) break;
      const last = at + term.length - 1;
      if (wholeWord) {
        const beforeOk = at === 0 || hay[at - 1] === ' ';
        const afterOk = last + 1 >= hay.length || hay[last + 1] === ' ';
        if (!beforeOk || !afterOk) {
          from = at + 1;
          continue;
        }
      }
      hits.push({ at, len: term.length });
      found = true;
      from = at + term.length;
    }
    return found;
  };
  if (pushAll(needle)) return hits;
  const compact = needle
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (compact !== needle && pushAll(compact)) return hits;
  if (needle.length > 18) pushAll(needle.slice(0, 18));
  return hits;
}

function wrapNodeRanges(
  node: Text,
  ranges: { start: number; end: number }[],
  color: string,
  markId?: string,
) {
  if (!node.parentNode || !ranges.length) return;
  const value = node.nodeValue || '';
  const ordered = [...ranges]
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, value.length)),
      end: Math.max(0, Math.min(range.end, value.length)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  if (!ordered.length) return;
  const merged: { start: number; end: number }[] = [];
  for (const range of ordered) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      frag.appendChild(document.createTextNode(value.slice(cursor, range.start)));
    }
    const mark = document.createElement('mark');
    mark.className = 'course-mark';
    mark.style.background = color;
    if (markId) mark.setAttribute('data-highlight-id', markId);
    mark.textContent = value.slice(range.start, range.end);
    frag.appendChild(mark);
    cursor = range.end;
  }
  if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
  node.parentNode.replaceChild(frag, node);
}

function applyHighlights(
  html: string,
  marks: { text: string; color?: string; wholeWord?: boolean; id?: string | number }[],
) {
  const usable = marks.filter((m) => m.text.trim().length >= 2);
  if (!usable.length || typeof window === 'undefined') return html;
  const root = document.createElement('div');
  root.innerHTML = html;
  usable.forEach((mark) => {
    const nodes = collectHighlightNodes(root);
    if (!nodes.length) return;
    const { hay, map } = buildHighlightIndex(nodes);
    const hits = locateHighlight(hay, mark.text, mark.wholeWord);
    const color = mark.color || '#FFE66D';
    const byNode = new Map<Text, { start: number; end: number }[]>();
    hits.forEach((hit) => {
      for (let i = hit.at; i < hit.at + hit.len && i < map.length; i += 1) {
        if (hay[i] === ' ') continue;
        const point = map[i];
        const list = byNode.get(point.node) || [];
        const last = list[list.length - 1];
        if (last && point.offset >= last.start && point.offset <= last.end) {
          last.end = Math.max(last.end, point.offset + 1);
        } else {
          list.push({ start: point.offset, end: point.offset + 1 });
        }
        byNode.set(point.node, list);
      }
    });
    Array.from(byNode.entries()).forEach(([node, ranges]) => {
      wrapNodeRanges(node, ranges, color, mark.id != null ? String(mark.id) : undefined);
    });
  });
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

function tocFromPages(pages: string[][], startPage: number, coverShift = 0) {
  const items: { title: string; level: number; page: number }[] = [];
  pages.forEach((htmls, i) => {
    htmls.forEach((html) => {
      if (isCoverHtml(html)) return;
      const match = html.match(/<h([123])[^>]*>([\s\S]*?)<\/h\1>/i);
      if (!match) return;
      const title = match[2]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title) return;
      items.push({ title, level: Number(match[1]), page: startPage + i - coverShift });
    });
  });
  return items;
}

function searchPages(pages: string[][], startPage: number, query: string, coverShift = 0) {
  const needle = foldSearch(query);
  if (needle.length < 2) return [] as { snippet: string; page: number; anchor: string }[];
  const hits: { snippet: string; page: number; anchor: string }[] = [];
  const seen = new Set<string>();
  tocFromPages(pages, startPage, coverShift).forEach((item) => {
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
      hits.push({
        snippet: clipSearchSnippet(text),
        page: startPage + i - coverShift,
        anchor: text,
      });
      break;
    }
  });
  return hits;
}

function selectedText() {
  if (typeof window === 'undefined') return '';
  return (window.getSelection()?.toString() || '').replace(/\s+/g, ' ').trim();
}

type BookReveal = {
  token: number;
  page?: number | null;
  highlightId?: number;
  text?: string;
  conceptId?: string;
  selector?: string;
};

type StudyState = {
  bookmarks: { id: number; pageNumber: number; markType?: CourseBookmarkType }[];
  notes: { id: number; pageNumber?: number | null; content: string; quote?: string | null }[];
  highlights: { id: number; pageNumber?: number | null; text: string; color?: string }[];
};

const OPEN_BOOK_MIN_WIDTH = 1200;

type CourseChapterLink = { slug: string; title: string };
type CourseSpread = { left: number | null; right: number | null };

function isTabletLikeViewport() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const shortest = Math.min(window.innerWidth, window.innerHeight);
  return coarse && shortest >= 600 && shortest <= 1180;
}

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

function useBookPageSize(slot: React.RefObject<HTMLElement | null>, leaves: 1 | 2) {
  const [size, setSize] = React.useState({ w: 480, h: 680 });
  React.useEffect(() => {
    const update = () => {
      const el = slot.current;
      const slotH = el?.clientHeight || 0;
      const slotW = el?.clientWidth || 0;
      // Use content box so page never draws under side gutters/padding
      const cs = el ? getComputedStyle(el) : null;
      const padX = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0;
      const contentW = Math.max(0, slotW - padX);
      const maxH = Math.max(280, slotH || Math.round(window.innerHeight * 0.72));
      const maxW = Math.max(240, contentW || Math.min(window.innerWidth - 120, 720));
      const gutter = leaves === 2 ? 14 : 0;
      const maxLeaf = leaves === 2 ? 680 : 720;
      let width = (maxW - gutter) / leaves;
      if (width > maxLeaf) width = maxLeaf;
      setSize({ w: Math.round(width), h: Math.round(maxH) });
    };
    update();
    const el = slot.current;
    const ro = el ? new ResizeObserver(() => update()) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', update);
    const later = window.setTimeout(update, 50);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.clearTimeout(later);
    };
  }, [leaves, slot]);
  return size;
}

function useWideCourseReader() {
  const [wide, setWide] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth >= OPEN_BOOK_MIN_WIDTH &&
      !isTabletLikeViewport(),
  );
  React.useEffect(() => {
    const update = () =>
      setWide(window.innerWidth >= OPEN_BOOK_MIN_WIDTH && !isTabletLikeViewport());
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
  subjectTitle,
  closeHref,
  readBase,
  chapterSlug,
  chapters = [],
  practiceHref,
  notesHref,
  prevChapter,
  nextChapter,
  startPage = 1,
  chapterId,
  initialPage,
  quickChecks = [],
  contentJson = null,
  frontCoverUrl,
  backCoverUrl,
  onReadingPage,
}: {
  html: string;
  header: string;
  chapterTitle: string;
  subjectTitle?: string;
  closeHref?: string;
  readBase?: string;
  chapterSlug?: string;
  chapters?: CourseChapterLink[];
  practiceHref?: string | null;
  notesHref?: string | null;
  prevChapter?: CourseChapterLink | null;
  nextChapter?: CourseChapterLink | null;
  startPage?: number;
  chapterId?: number;
  initialPage?: number;
  quickChecks?: CourseQuickCheckItem[];
  contentJson?: unknown;
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
  onReadingPage?: (page: number) => void;
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
  const [picked, setPicked] = React.useState('');
  const [ink, setInk] = React.useState(HIGHLIGHTER_COLORS[0]);
  const [openExplains, setOpenExplains] = React.useState<string[]>([]);
  const [ribbonPage, setRibbonPage] = React.useState<number | null>(null);
  const [reveal, setReveal] = React.useState<BookReveal | null>(null);
  const [panel, setPanel] = React.useState<
    | 'contents'
    | 'search'
    | 'highlights'
    | 'display'
    | 'bookmarks'
    | 'progress'
    | 'check'
    | 'interact'
    | 'notes'
  >('highlights');
  const [activeConceptId, setActiveConceptId] = React.useState<string | null>(null);
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
  const [leftTab, setLeftTab] = React.useState<'contents' | 'bookmarks' | 'notes'>('contents');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [noteQuote, setNoteQuote] = React.useState('');
  const lastSelection = React.useRef('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  const interactives = React.useMemo(
    () =>
      buildCourseInteractives({
        contentJson: contentJson as any,
        html,
        chapterTitle,
        subjectTitle,
      }),
    [contentJson, html, chapterTitle, subjectTitle],
  );

  const sourceHtml = React.useMemo(
    () => injectConceptHotspots(html, interactives),
    [html, interactives],
  );

  React.useEffect(() => {
    if (!activeConceptId && interactives[0]) setActiveConceptId(interactives[0].id);
  }, [interactives, activeConceptId]);

  const openConcept = React.useCallback((id: string) => {
    setActiveConceptId(id);
    setPanel('interact');
    setSheetOpen(true);
    setMenuOpen(false);
    revealRef.current({ conceptId: id });
  }, []);

  const loadStudy = React.useCallback(() => {
    if (!chapterId) return;
    fetchChapterStudy(chapterId)
      .then(setStudy)
      .catch(() => {});
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
  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const toolsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const revealRef = React.useRef<(next: Omit<BookReveal, 'token'>) => void>(() => {});
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
  const a4 = useBookPageSize(slotRef, spread ? 2 : 1);
  const imgMax = Math.max(110, Math.round(a4.h * 0.26));
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
    const pageW = a4.w;
    const pageH = a4.h;
    const htmlChanged = htmlRef.current !== sourceHtml;
    htmlRef.current = sourceHtml;
    paginateByMeasure(blocksFromHtml(sourceHtml), {
      width: pageW,
      height: pageH,
      font,
      theme,
      openIds: openExplains,
      header,
      chapterTitle,
      a4: true,
      imgMax,
    }).then((pagesHtml) => {
      if (cancelled) return;
      const next = withCoverPages(
        pagesHtml,
        frontCoverUrl ? resolveSrc(frontCoverUrl) : null,
        backCoverUrl ? resolveSrc(backCoverUrl) : null,
      );
      setPages(next);
      const anchor = explainAnchor.current;
      explainAnchor.current = null;
      const coverShift = frontCoverUrl ? 1 : 0;
      setIndex((i) => {
        if (anchor) {
          const found = next.findIndex((page) =>
            page.some((item) => item.includes(`data-explain-id="${anchor}"`)),
          );
          if (found >= 0) return found;
        }
        const raw = htmlChanged
          ? initialPage
            ? Math.max(0, initialPage - startPage) + coverShift
            : 0
          : i;
        return Math.min(Math.max(0, raw), Math.max(0, next.length - 1));
      });
      setToolIndex((i) => Math.min(Math.max(0, i), Math.max(0, next.length - 1)));
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
    frontCoverUrl,
    backCoverUrl,
    sourceHtml,
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
    if (wide && (panel === 'contents' || panel === 'bookmarks' || panel === 'notes')) {
      setPanel('highlights');
    }
  }, [wide, panel]);

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
      const concept = target?.closest?.('.course-concept-hot') as HTMLElement | null;
      if (concept && bookRef.current?.contains(concept)) {
        e.preventDefault();
        e.stopPropagation();
        const id = concept.getAttribute('data-concept-id');
        if (id) openConcept(id);
        return;
      }
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
  }, [openConcept]);

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

  const coverShift = frontCoverUrl ? 1 : 0;
  const toolPage = Math.min(Math.max(0, toolIndex), Math.max(0, pages.length - 1));
  const pageCaption = (pageIndex: number) => {
    const pageHtml = pages[pageIndex]?.join('') || '';
    if (isCoverHtml(pageHtml)) return frontCoverUrl && pageIndex === 0 ? 'Cover' : 'Back';
    return String(startPage + pageIndex - coverShift);
  };
  const printedFor = (pageIndex: number) => startPage + pageIndex - coverShift;
  const indexFromPrinted = (page: number) => Math.max(0, page - startPage + coverShift);
  const goToPrinted = (page: number) => {
    const next = Math.min(pages.length - 1, Math.max(0, indexFromPrinted(page)));
    setIndex(next);
    setToolIndex(next);
  };

  const pageIndexForHtml = (test: (html: string) => boolean) =>
    pages.findIndex((page) => test(page.join('')));

  const revealInBook = (next: Omit<BookReveal, 'token'>) => {
    let pageIndex: number | null = null;
    if (next.page != null && Number.isFinite(Number(next.page))) {
      pageIndex = indexFromPrinted(Number(next.page));
    }
    if ((pageIndex == null || pageIndex < 0) && next.highlightId != null) {
      const hit = study.highlights.find((item) => item.id === next.highlightId);
      if (hit?.pageNumber != null) pageIndex = indexFromPrinted(hit.pageNumber);
      const needle = foldText(hit?.text || next.text || '').slice(0, 32);
      if ((pageIndex == null || pageIndex < 0) && needle.length >= 2) {
        const found = pageIndexForHtml((html) => foldText(htmlToText(html)).includes(needle));
        if (found >= 0) pageIndex = found;
      }
    }
    if ((pageIndex == null || pageIndex < 0) && next.conceptId) {
      const found = pageIndexForHtml((html) =>
        html.includes(`data-concept-id="${next.conceptId}"`),
      );
      if (found >= 0) pageIndex = found;
      else {
        const item = interactives.find((row) => row.id === next.conceptId);
        const needle = foldText(item?.label || '').slice(0, 24);
        if (needle.length >= 2) {
          const foundText = pageIndexForHtml((html) => foldText(htmlToText(html)).includes(needle));
          if (foundText >= 0) pageIndex = foundText;
        }
      }
    }
    if ((pageIndex == null || pageIndex < 0) && next.selector) {
      const cls = next.selector.replace(/^[.#]/, '');
      const found = pageIndexForHtml((html) => html.includes(cls));
      if (found >= 0) pageIndex = found;
    }
    if ((pageIndex == null || pageIndex < 0) && next.text) {
      const needle = foldText(next.text).slice(0, 32);
      if (needle.length >= 2) {
        const found = pageIndexForHtml((html) => foldText(htmlToText(html)).includes(needle));
        if (found >= 0) pageIndex = found;
      }
    }
    if (pageIndex != null && pageIndex >= 0) {
      setIndex(Math.min(pages.length - 1, pageIndex));
      setToolIndex(Math.min(pages.length - 1, pageIndex));
    }
    setReveal({ ...next, token: Date.now() });
    toolsScrollRef.current?.scrollTo({ top: 0 });
  };
  revealRef.current = revealInBook;

  React.useEffect(() => {
    if (!reveal || !bookRef.current) return;
    const root = bookRef.current;
    const apply = () => {
      root
        .querySelectorAll('.is-book-reveal')
        .forEach((el) => el.classList.remove('is-book-reveal'));
      let target: HTMLElement | null = null;
      if (reveal.highlightId != null) {
        target = root.querySelector(`[data-highlight-id="${reveal.highlightId}"]`);
      }
      if (!target && reveal.conceptId) {
        target = root.querySelector(`[data-concept-id="${reveal.conceptId}"]`);
      }
      if (!target && reveal.selector) {
        target = root.querySelector(reveal.selector);
      }
      if (!target && reveal.text) {
        const needle = foldText(reveal.text);
        const marks = Array.from(root.querySelectorAll('mark.course-mark')) as HTMLElement[];
        target =
          marks.find((item) => {
            const hay = foldText(item.textContent || '');
            return hay.includes(needle.slice(0, 24)) || (hay.length >= 8 && needle.includes(hay));
          }) || null;
      }
      if (!target) return;
      target.classList.add('is-book-reveal');
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const show = window.setTimeout(apply, 80);
    const hide = window.setTimeout(() => {
      root
        .querySelectorAll('.is-book-reveal')
        .forEach((el) => el.classList.remove('is-book-reveal'));
    }, 2600);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [reveal, index, pages]);
  const printed = printedFor(toolPage);
  React.useEffect(() => {
    onReadingPage?.(printed);
  }, [printed, onReadingPage]);
  const visiblePages = [openSpread.left, openSpread.right].filter((v): v is number => v != null);
  const bookmarkFor = (pageIndex: number) =>
    study.bookmarks.find((b) => b.pageNumber === printedFor(pageIndex));
  const liveQuery = query.trim();
  const searchMarks =
    liveQuery.length >= 2 ? [{ text: liveQuery, color: '#C5E8C8', wholeWord: false }] : [];
  const markedPage = (pageIndex: number) =>
    applyHighlights(pages[pageIndex]?.join('') || '', [...study.highlights, ...searchMarks]);
  const canRemove =
    picked.length >= 2 && study.highlights.some((h) => highlightOverlaps(h.text, picked));
  const toc = tocFromPages(pages, startPage, coverShift);
  const searchHits = searchPages(pages, startPage, liveQuery, coverShift).slice(0, 24);

  const jumpToHit = (hit: { snippet: string; page: number; anchor: string }) => {
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
    setIndex(found >= 0 ? found : Math.max(0, Math.min(pages.length - 1, hit.page - startPage)));
    setToolIndex(
      found >= 0 ? found : Math.max(0, Math.min(pages.length - 1, hit.page - startPage)),
    );
  };

  const runSearch = () => {
    if (searchHits[0]) jumpToHit(searchHits[0]);
  };
  const topicIndex = toc.reduce((best, item, i) => (item.page <= printed ? i : best), 0);
  const lastContentIndex = pages.reduce(
    (last, page, i) => (isCoverHtml(page.join('')) ? last : i),
    -1,
  );
  const lastPrinted = lastContentIndex >= 0 ? printedFor(lastContentIndex) : startPage;
  const visiblePrinted = visiblePages
    .filter((p) => !isCoverHtml(pages[p]?.join('') || ''))
    .map((p) => printedFor(p));
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
    display: 'Display',
    bookmarks: 'Bookmarks',
    progress: 'Progress',
    check: 'Quick check',
    interact: 'Interact',
    notes: 'Notes',
  }[panel];

  const notesUrl = (quote?: string) => {
    if (!notesHref) return '';
    const url = new URL(notesHref, 'https://vidhyavibe.local');
    url.searchParams.set('page', String(printed));
    if (quote) {
      try {
        window.sessionStorage.setItem('vv_pending_note_quote', quote);
      } catch {
        /* ignore */
      }
    }
    return `${url.pathname}?${url.searchParams.toString()}`;
  };

  const addNoteFromSelection = () => {
    const text = (picked || lastSelection.current).trim();
    setNoteQuote(text);
    setLeftTab('notes');
    if (!wide) {
      setPanel('notes');
      setMenuOpen(false);
      setSheetOpen(true);
    }
  };

  const setBookmark = async (markType: CourseBookmarkType, pageIndex = toolPage) => {
    if (!chapterId) return;
    try {
      await addCourseBookmark(chapterId, printedFor(pageIndex), markType);
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
    const html = markedPage(pageIndex);
    const cover = isCoverHtml(html);
    const pagePrinted = printedFor(pageIndex);
    const bookmark = cover ? undefined : bookmarkFor(pageIndex);
    return (
      <div
        className={`course-book-sheet is-${theme}${sideClass}${cover ? ' is-cover' : ''}`}
        style={{ fontSize: `${font}%` }}
        data-course-page={pageIndex}
      >
        {chapterId && !cover ? (
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
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="course-book-folio">{pagePrinted}</div>
      </div>
    );
  };

  const captions = visiblePages.map(pageCaption);
  const pageMeta = spread
    ? captions.length > 1
      ? `${captions[0]}–${captions[captions.length - 1]}`
      : captions[0] || 'Cover'
    : pageCaption(toolPage);

  const atStart = spread ? spreadAt <= 0 : index <= 0;
  const atEnd = spread ? spreadAt >= spreads.length - 1 : index >= pages.length - 1;
  const progressPct = toc.length
    ? Math.round(((topicIndex + 1) / toc.length) * 100)
    : Math.round(((index + 1) / Math.max(pages.length, 1)) * 100);
  const dockMax = spread ? Math.max(0, spreads.length - 1) : Math.max(0, pages.length - 1);
  const dockValue = spread ? spreadAt : index;
  const openPanel = (id: typeof panel) => {
    setPanel(id);
    setMenuOpen(false);
    if (!wide) setSheetOpen(true);
    if (id === 'interact') {
      const conceptId = activeConceptId || interactives[0]?.id;
      if (conceptId) revealInBook({ conceptId });
    }
    if (id === 'check') {
      const item = pageCheck || quickChecks[0];
      revealInBook({
        page: item?.pageNumber,
        selector: '.course-quick-block',
        text: item?.title,
      });
    }
  };
  const goDock = (value: number) => {
    if (spread) {
      const next = spreads[Math.min(dockMax, Math.max(0, value))];
      const target = next?.left ?? next?.right ?? 0;
      setIndex(target);
      setToolIndex(target);
      return;
    }
    const target = Math.min(pages.length - 1, Math.max(0, value));
    setIndex(target);
    setToolIndex(target);
  };

  const notesPanel = chapterId ? (
    <CourseNotesPanel
      notes={study.notes}
      chapterTitle={chapterTitle}
      pageNumber={printed}
      quote={noteQuote}
      onQuoteChange={setNoteQuote}
      fullScreenHref={notesUrl()}
      onJumpPage={(page) => {
        goToPrinted(page);
        if (!wide) setSheetOpen(false);
      }}
      onSave={async (content, quote) => {
        await addCourseNote(chapterId, content, printed, quote);
        loadStudy();
      }}
      onUpdate={async (id, content) => {
        await updateCourseNote(id, content);
        loadStudy();
      }}
      onDelete={async (id) => {
        await deleteCourseNote(id);
        loadStudy();
      }}
    />
  ) : (
    <p className="course-notes-empty">Notes are available once this chapter is loaded.</p>
  );

  return (
    <div
      className={`course-reader-workspace course-reader-with-notes${wide ? ' is-desktop' : ' is-compact'}${spread ? ' is-spread' : ''}`}
      style={{ ['--course-text-scale' as string]: String(font / 100) } as React.CSSProperties}
    >
      {!wide ? (
        <header className="course-reader-toolbar">
          {closeHref ? (
            <Link href={closeHref} className="course-reader-close" aria-label="Close reader">
              ×
            </Link>
          ) : null}
          <div className="course-reader-heading">
            <strong>{subjectTitle || chapterTitle}</strong>
            <small>{header}</small>
          </div>
          <button
            type="button"
            className="course-reader-menu-btn"
            aria-label="Reader menu"
            onClick={() => {
              setSheetOpen((open) => !open);
              setMenuOpen(false);
            }}
          >
            ☰
          </button>
        </header>
      ) : null}
      {wide ? (
        <aside className="course-reader-rail is-toc">
          <div className="course-reader-heading is-rail">
            {closeHref ? (
              <Link href={closeHref} className="course-reader-close" aria-label="Close reader">
                ×
              </Link>
            ) : null}
            <div>
              <strong>{subjectTitle || chapterTitle}</strong>
              <small>{header}</small>
            </div>
          </div>
          <div className="course-reader-tabs">
            <button
              type="button"
              className={leftTab === 'contents' ? 'is-on' : ''}
              onClick={() => setLeftTab('contents')}
            >
              Contents
            </button>
            <button
              type="button"
              className={leftTab === 'bookmarks' ? 'is-on' : ''}
              onClick={() => setLeftTab('bookmarks')}
            >
              Bookmarks
            </button>
            <button
              type="button"
              className={leftTab === 'notes' ? 'is-on' : ''}
              onClick={() => setLeftTab('notes')}
            >
              Notes
            </button>
          </div>
          {leftTab === 'contents' ? (
            <>
              <form
                className="course-search-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPanel('search');
                  runSearch();
                }}
              >
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value.trim().length >= 2) setPanel('search');
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search in this book…"
                  autoComplete="off"
                />
              </form>
              <div className="course-toc-scroll">
                <div className="course-toc-tree">
                  {chapters.length
                    ? chapters.map((ch, i) => {
                        const current = ch.slug === chapterSlug;
                        return (
                          <div
                            key={ch.slug}
                            className={`course-toc-chapter${current ? ' is-current' : ''}`}
                          >
                            {readBase ? (
                              <Link
                                href={`${readBase}/read?chapter=${encodeURIComponent(ch.slug)}`}
                                className="course-toc-chapter-link"
                              >
                                {current ? '▾' : '▸'} {i + 1}. {ch.title}
                              </Link>
                            ) : (
                              <span className="course-toc-chapter-link">
                                {current ? '▾' : '▸'} {i + 1}. {ch.title}
                              </span>
                            )}
                            {current
                              ? toc.map((item, ti) => (
                                  <button
                                    key={`${item.page}-${ti}`}
                                    type="button"
                                    className={`course-toc-item${item.page === printed ? ' is-on' : ''}`}
                                    style={{ paddingLeft: 18 + (item.level - 1) * 12 }}
                                    onClick={() => setIndex(indexFromPrinted(item.page))}
                                  >
                                    <span>{item.title}</span>
                                  </button>
                                ))
                              : null}
                          </div>
                        );
                      })
                    : toc.map((item, i) => (
                        <button
                          key={`${item.page}-${i}`}
                          type="button"
                          className={`course-toc-item${item.page === printed ? ' is-on' : ''}`}
                          style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
                          onClick={() => setIndex(indexFromPrinted(item.page))}
                        >
                          <span>{item.title}</span>
                          <span>p.{item.page}</span>
                        </button>
                      ))}
                </div>
              </div>
            </>
          ) : leftTab === 'bookmarks' ? (
            <div className="course-toc-scroll">
              {study.bookmarks.length === 0 ? (
                <p className="course-notes-empty">
                  Tap the ribbon and choose Important, Doubt, or Revise.
                </p>
              ) : null}
              {study.bookmarks.map((b) => {
                const type = BOOKMARK_TYPES.find((item) => item.id === asBookmarkType(b.markType));
                return (
                  <button
                    key={`rail-b-${b.id}`}
                    type="button"
                    className={`course-note-card course-bookmark-jump${printed === b.pageNumber ? ' is-on' : ''}`}
                    onClick={() => goToPrinted(b.pageNumber)}
                  >
                    <span className="course-note-page">Page {b.pageNumber}</span>
                    <p className="course-mark-type" style={{ color: type?.color }}>
                      {type?.label || 'Important'}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="course-notes-rail">{notesPanel}</div>
          )}
          {readBase && (prevChapter || nextChapter) && leftTab !== 'notes' ? (
            <div className="course-toc-chapter-nav">
              {prevChapter ? (
                <Link href={`${readBase}/read?chapter=${encodeURIComponent(prevChapter.slug)}`}>
                  ← Prev chapter
                </Link>
              ) : (
                <span />
              )}
              {nextChapter ? (
                <Link href={`${readBase}/read?chapter=${encodeURIComponent(nextChapter.slug)}`}>
                  Next chapter →
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </aside>
      ) : null}
      <div className="course-book-stage">
        <button
          type="button"
          className="course-book-side-btn is-prev"
          disabled={atStart}
          aria-label="Previous pages"
          onClick={() => goSpread(-1)}
        >
          <span>←</span>
        </button>
        <div className="course-book-slot" ref={slotRef}>
          <div
            ref={bookRef}
            className={`course-book is-a4${spread ? ' is-spread' : ''}${!spread || soloLeaf ? ' is-solo' : ''}`}
            style={{ ['--course-img-max' as string]: `${imgMax}px` } as React.CSSProperties}
          >
            {spread && !soloLeaf ? (
              <div className="course-book-open" style={{ width: a4.w * 2 + 14, height: a4.h }}>
                {renderSheet(openSpread.left, 'verso')}
                <div className="course-book-gutter" aria-hidden />
                {renderSheet(openSpread.right, 'recto')}
              </div>
            ) : (
              <div className="course-book-solo" style={{ width: a4.w, height: a4.h }}>
                {renderSheet(spread ? (openSpread.left ?? openSpread.right ?? index) : index)}
              </div>
            )}
            {picked.length >= 2 ? (
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
                        highlightSelection(color);
                      }}
                    />
                  ))}
                </div>
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
                {chapterId ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={addNoteFromSelection}
                  >
                    Add to notes
                  </button>
                ) : null}
              </div>
            ) : null}
            {pageCheck ? (
              <button
                type="button"
                className="course-quick-launch"
                onClick={() => openPanel('check')}
              >
                <strong>Quick check</strong>
                <span>{pageCheck.title}</span>
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="course-book-side-btn is-next"
          disabled={atEnd}
          aria-label="Next pages"
          onClick={() => goSpread(1)}
        >
          <span>→</span>
        </button>
      </div>
      {chapterId ? (
        <aside
          className={`course-notes-section course-reader-rail is-tools${wide || sheetOpen ? ' is-open' : ''}`}
          id="course-notes"
        >
          {!wide ? (
            <button
              type="button"
              className="course-reader-sheet-close"
              aria-label="Close panel"
              onClick={() => setSheetOpen(false)}
            >
              ×
            </button>
          ) : null}
          <div className="course-reader-toolbar-actions is-rail">
            <button
              type="button"
              className={panel === 'display' ? 'is-on' : ''}
              onClick={() => openPanel('display')}
            >
              Aa
              <span>Text Size</span>
            </button>
            <button
              type="button"
              className={panel === 'display' ? 'is-on' : ''}
              onClick={() => openPanel('display')}
            >
              ◐<span>Theme</span>
            </button>
          </div>
          {wide ? (
            <div className="course-page-view-row" aria-label="Page view">
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
          ) : null}
          <div className="course-study-tools">
            <h2>Study Tools</h2>
            <button
              type="button"
              className={panel === 'highlights' ? 'is-on' : ''}
              onClick={() => openPanel('highlights')}
            >
              Highlights
            </button>
            {interactives.length ? (
              <button
                type="button"
                className={panel === 'interact' ? 'is-on' : ''}
                onClick={() => openPanel('interact')}
              >
                Interact
              </button>
            ) : null}
            {!wide && chapterId ? (
              <button
                type="button"
                className={panel === 'notes' ? 'is-on' : ''}
                onClick={() => openPanel('notes')}
              >
                Notes
              </button>
            ) : null}
            {practiceHref ? (
              <Link href={practiceHref} className="course-study-practice">
                Practice
              </Link>
            ) : quickChecks.length ? (
              <button
                type="button"
                className={panel === 'check' ? 'is-on' : ''}
                onClick={() => openPanel('check')}
              >
                Practice
              </button>
            ) : null}
          </div>
          <div className="course-reader-progress-card">
            <h3>Chapter Progress</h3>
            <div className="course-progress-bar">
              <span style={{ width: `${progressPct}%` }} />
            </div>
            <p>
              {toc.length
                ? `Section ${topicIndex + 1} of ${toc.length}`
                : `Page ${index + 1} of ${pages.length}`}
              <strong>{progressPct}%</strong>
            </p>
            <small>
              {progressPct >= 80
                ? 'Almost there — finish this chapter!'
                : "Keep going! You're making great progress."}
            </small>
          </div>
          <div className="course-tools-scroll" ref={toolsScrollRef}>
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
                        ...(!wide ? [['contents', 'Contents'] as [typeof panel, string]] : []),
                        ...(!wide ? [['notes', 'Notes'] as [typeof panel, string]] : []),
                        ['search', 'Search'],
                        ['highlights', 'Highlights'],
                        ...(!wide ? [['bookmarks', 'Bookmarks'] as [typeof panel, string]] : []),
                        ['progress', 'Progress'],
                        ['display', 'Display'],
                        ...(interactives.length
                          ? [['interact', 'Interact'] as [typeof panel, string]]
                          : []),
                        ...(quickChecks.length
                          ? [['check', 'Quick check'] as [typeof panel, string]]
                          : []),
                      ] as [typeof panel, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="menuitem"
                        className={panel === id ? 'is-on' : ''}
                        onClick={() => openPanel(id)}
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
                {chapters.length
                  ? chapters.map((ch, i) => {
                      const current = ch.slug === chapterSlug;
                      return (
                        <div
                          key={`panel-${ch.slug}`}
                          className={`course-toc-chapter${current ? ' is-current' : ''}`}
                        >
                          {readBase ? (
                            <Link
                              href={`${readBase}/read?chapter=${encodeURIComponent(ch.slug)}`}
                              className="course-toc-chapter-link"
                              onClick={() => setSheetOpen(false)}
                            >
                              {i + 1}. {ch.title}
                            </Link>
                          ) : (
                            <span className="course-toc-chapter-link">
                              {i + 1}. {ch.title}
                            </span>
                          )}
                          {current
                            ? toc.map((item, ti) => (
                                <button
                                  key={`${item.page}-${ti}`}
                                  type="button"
                                  className={`course-toc-item${item.page === printed ? ' is-on' : ''}`}
                                  style={{ paddingLeft: 18 + (item.level - 1) * 12 }}
                                  onClick={() => {
                                    setIndex(indexFromPrinted(item.page));
                                    setSheetOpen(false);
                                  }}
                                >
                                  <span>{item.title}</span>
                                  <span>p.{item.page}</span>
                                </button>
                              ))
                            : null}
                        </div>
                      );
                    })
                  : null}
                {!chapters.length && toc.length === 0 ? (
                  <p className="course-notes-empty">No headings in this chapter yet.</p>
                ) : null}
                {!chapters.length
                  ? toc.map((item, i) => (
                      <button
                        key={`${item.page}-${i}`}
                        type="button"
                        className="course-toc-item"
                        style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
                        onClick={() => setIndex(indexFromPrinted(item.page))}
                      >
                        <span>{item.title}</span>
                        <span>p.{item.page}</span>
                      </button>
                    ))
                  : null}
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
                </form>
                {liveQuery ? (
                  <p className="course-notes-kicker">
                    {liveQuery.length < 2
                      ? 'Keep typing…'
                      : `${searchHits.length} suggestion${searchHits.length === 1 ? '' : 's'}`}
                    {liveQuery.length >= 2 ? (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="course-note-page"
                          onClick={() => {
                            setQuery('');
                          }}
                        >
                          Clear
                        </button>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="course-notes-empty">Suggestions appear as you type.</p>
                )}
                {liveQuery.length >= 2 && searchHits.length === 0 ? (
                  <p className="course-notes-empty">No matches in this chapter.</p>
                ) : null}
                {searchHits.map((hit, i) => (
                  <button
                    key={`${hit.page}-${i}`}
                    type="button"
                    className="course-toc-item"
                    onClick={() => jumpToHit(hit)}
                  >
                    <span>{hit.snippet}</span>
                    <span>p.{hit.page}</span>
                  </button>
                ))}
              </>
            ) : null}
            {panel === 'highlights' ? (
              <>
                {study.highlights.length === 0 ? (
                  <p className="course-notes-empty">Select text, then choose a color.</p>
                ) : null}
                {study.highlights.map((h) => (
                  <article
                    key={`h-${h.id}`}
                    className="course-note-card is-jump"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      revealInBook({ highlightId: h.id, page: h.pageNumber, text: h.text })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        revealInBook({ highlightId: h.id, page: h.pageNumber, text: h.text });
                      }
                    }}
                  >
                    {h.pageNumber ? (
                      <span className="course-note-page">Page {h.pageNumber}</span>
                    ) : null}
                    <p>
                      <mark className="course-mark" style={{ background: h.color || '#FFE66D' }}>
                        {h.text}
                      </mark>
                    </p>
                    <div className="course-note-actions">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCourseHighlight(h.id).then(loadStudy);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
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
                  <button type="button" onClick={() => setFont((v) => Math.max(80, v - 10))}>
                    A-
                  </button>
                  <span>{font}%</span>
                  <button type="button" onClick={() => setFont((v) => Math.min(150, v + 10))}>
                    A+
                  </button>
                </div>
              </>
            ) : null}
            {panel === 'bookmarks' && !wide ? (
              <>
                {study.bookmarks.length === 0 ? (
                  <p className="course-notes-empty">
                    Tap the ribbon and choose Important, Doubt, or Revise.
                  </p>
                ) : null}
                {study.bookmarks.map((b) => {
                  const type = BOOKMARK_TYPES.find(
                    (item) => item.id === asBookmarkType(b.markType),
                  );
                  return (
                    <button
                      key={`b-${b.id}`}
                      type="button"
                      className={`course-note-card course-bookmark-jump${printed === b.pageNumber ? ' is-on' : ''}`}
                      onClick={() => {
                        goToPrinted(b.pageNumber);
                        setSheetOpen(false);
                      }}
                    >
                      <span className="course-note-page">Page {b.pageNumber}</span>
                      <p className="course-mark-type" style={{ color: type?.color }}>
                        {type?.label || 'Important'}
                      </p>
                    </button>
                  );
                })}
              </>
            ) : null}
            {panel === 'notes' && !wide ? (
              <div className="course-notes-rail">{notesPanel}</div>
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
                    onClick={() => setIndex(indexFromPrinted(item.page))}
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
                <p className="course-notes-empty">
                  No quick check is attached to this chapter yet.
                </p>
              ) : (
                quickChecks.map((item) => (
                  <div key={item.id} className="course-quick-panel-item">
                    <button
                      type="button"
                      className="course-note-page"
                      onClick={() =>
                        revealInBook({
                          page: item.pageNumber,
                          selector: '.course-quick-block',
                          text: item.title,
                        })
                      }
                    >
                      Show in book{item.pageNumber ? ` · Page ${item.pageNumber}` : ''}
                    </button>
                    <CourseQuickCheck item={item} />
                  </div>
                ))
              )
            ) : null}
            {panel === 'interact' ? (
              <CourseInteractives
                items={interactives}
                activeId={activeConceptId}
                onSelect={(id) => {
                  setActiveConceptId(id);
                  revealInBook({ conceptId: id });
                }}
              />
            ) : null}
          </div>
        </aside>
      ) : null}
      {!wide && sheetOpen ? (
        <button
          type="button"
          className="course-reader-sheet-mask"
          aria-label="Close panel"
          onClick={() => setSheetOpen(false)}
        />
      ) : null}
      <footer className="course-reader-dock">
        <div className="course-dock-track">
          <input
            type="range"
            min={0}
            max={dockMax}
            value={dockValue}
            onChange={(e) => goDock(Number(e.target.value))}
            aria-label="Page"
          />
          <span>
            {spread
              ? `Page ${pageMeta} of ${pages.length}`
              : `Page ${index + 1} of ${pages.length}`}
          </span>
        </div>
      </footer>
    </div>
  );
}
