'use client';

import Link from 'next/link';
import React from 'react';
import NotesWorkspace from '../../../../../../components/NotesWorkspace';
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
import CourseInteractives from './CourseInteractives';
import CourseNotesPanel from './CourseNotesPanel';
import CoursePracticeQuiz from './CoursePracticeQuiz';
import CourseQuickCheck, { CourseQuizPrompt } from './CourseQuickCheck';

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

function decodeFlashText(html: string) {
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

function flashcardsFromHtml(html: string): CourseFlashcard[] {
  if (!html) return [];
  const cards: CourseFlashcard[] = [];
  const seen = new Set<string>();
  const re =
    /<(div|section|aside)[^>]*class=["'][^"']*course-flash[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(html))) {
    const inner = m[2] || '';
    const strong = inner.match(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/i);
    const p = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const front = decodeFlashText(strong?.[2] || '').slice(0, 500);
    const rest = strong ? inner.replace(strong[0], ' ') : inner;
    const back = decodeFlashText(p?.[1] || rest).slice(0, 2000);
    const key = front.toLowerCase();
    if (front.length < 2 || seen.has(key)) continue;
    seen.add(key);
    cards.push({
      id: -(++i),
      chapterId: 0,
      front,
      back: back || 'No answer yet.',
    });
  }
  return cards;
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
      'h1,h2,h3,p,ul,ol,li,nav.course-chapter-toc,div.course-callout,div.course-split,div.course-flash,figure,img,details.course-explain,aside.course-explain,div.course-explain,aside.course-quick-block,div.course-table-wrap,table.course-table,pre.course-code,pre',
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
    if (el.tagName.toLowerCase() === 'code' && el.closest('pre')) return false;
    if (el.tagName.toLowerCase() === 'li' && el.closest('ul, ol')) return false;
    if (
      el.tagName.toLowerCase() === 'p' &&
      el.closest('ul, ol, li, figure, table, .course-table-wrap, pre')
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
                        : tag === 'pre' || el.classList.contains('course-code')
                          ? 'code'
                          : tag;
      const id = `b-${i}`;
      if (kind === 'explain') el.setAttribute('data-explain-id', id);
      return { id, kind, text: (el.textContent || '').trim(), html: el.outerHTML };
    })
    .filter(
      (b) =>
        b.text.length > 0 ||
        b.kind === 'code' ||
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

function coverImageSrc(html: string) {
  const match =
    html.match(/<img[^>]+src=["']([^"']+)["']/i) ||
    html.match(/<img[^>]+src=\{?["']([^"']+)["']/i);
  return match ? match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : null;
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

function canSplitList(kind: string) {
  return kind === 'toc' || kind === 'ol' || kind === 'ul';
}

function isSectionHeading(kind: string) {
  return kind === 'h1' || kind === 'h2' || kind === 'h3' || kind === 'h4' || kind === 'kicker';
}

function isChapterStart(kind: string, html: string) {
  if (kind === 'h1') return true;
  if (kind !== 'h2' && kind !== 'h3') return false;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^chapter\s+\d+/i.test(text);
}

function listPieces(html: string): string[] | null {
  if (typeof document === 'undefined') return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const root = wrap.firstElementChild as HTMLElement | null;
  if (!root) return null;
  const list = (root.matches('ul,ol') ? root : root.querySelector('ol, ul')) as HTMLElement | null;
  if (!list) return null;
  const items = Array.from(list.children).filter((el) => el.tagName.toLowerCase() === 'li');
  if (items.length < 2) return null;
  return items.map((el) => (el as HTMLElement).outerHTML);
}

function htmlWithListSlice(
  html: string,
  itemHtmls: string[],
  fromIndex: number,
  continued: boolean,
) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const root = wrap.firstElementChild as HTMLElement | null;
  if (!root) return html;
  const list = (root.matches('ul,ol') ? root : root.querySelector('ol, ul')) as HTMLElement | null;
  if (!list) return html;
  list.innerHTML = itemHtmls.join('');
  if (fromIndex > 0 && list.tagName.toLowerCase() === 'ol') {
    list.setAttribute('start', String(fromIndex + 1));
  }
  if (continued && root.classList.contains('course-chapter-toc')) {
    const kicker = root.querySelector('.course-kicker');
    if (kicker) {
      const base = (kicker.textContent || 'Contents').replace(/\s*\(continued\)\s*$/i, '').trim();
      kicker.textContent = `${base} (continued)`;
    }
  }
  return root.outerHTML;
}

function parseTableRoot(html: string) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const root = wrap.firstElementChild as HTMLElement | null;
  if (!root) return null;
  const table = (
    root.matches('table') ? root : root.querySelector('table')
  ) as HTMLTableElement | null;
  if (!table) return null;
  return { root, table };
}

function classifyTable(table: HTMLTableElement) {
  const headerRows: HTMLTableRowElement[] = [];
  const footerRows: HTMLTableRowElement[] = [];
  const bodyRows: HTMLTableRowElement[] = [];
  Array.from(table.rows).forEach((row) => {
    const parent = row.parentElement?.tagName.toLowerCase();
    if (parent === 'thead') headerRows.push(row);
    else if (parent === 'tfoot') footerRows.push(row);
    else bodyRows.push(row);
  });
  if (!headerRows.length && bodyRows.length) {
    const first = bodyRows[0];
    const cells = Array.from(first.cells);
    if (cells.length && cells.every((cell) => cell.tagName.toLowerCase() === 'th')) {
      headerRows.push(bodyRows.shift() as HTMLTableRowElement);
    }
  }
  return { headerRows, footerRows, bodyRows };
}

function tableBodyRows(html: string): string[] | null {
  if (typeof document === 'undefined') return null;
  const parsed = parseTableRoot(html);
  if (!parsed) return null;
  const { bodyRows } = classifyTable(parsed.table);
  if (bodyRows.length < 2) return null;
  return bodyRows.map((row) => row.outerHTML);
}

function htmlWithTableSlice(html: string, rowHtmls: string[], continued: boolean, isLast: boolean) {
  const parsed = parseTableRoot(html);
  if (!parsed) return html;
  const { root, table } = parsed;
  const caption = table.querySelector('caption');
  const { headerRows, footerRows } = classifyTable(table);
  const thead = document.createElement('thead');
  headerRows.forEach((row) => thead.appendChild(row));
  const tfoot = document.createElement('tfoot');
  footerRows.forEach((row) => tfoot.appendChild(row));
  caption?.remove();
  table.replaceChildren();
  if (caption && !continued) table.appendChild(caption);
  if (headerRows.length) table.appendChild(thead);
  const tbody = document.createElement('tbody');
  tbody.innerHTML = rowHtmls.join('');
  table.appendChild(tbody);
  if (isLast && footerRows.length) table.appendChild(tfoot);
  if (continued) {
    root.classList.add('is-table-continued');
  }
  if (!isLast) root.querySelectorAll('figcaption').forEach((el) => el.remove());
  return root.outerHTML;
}

function compositeChildHtmls(html: string): string[] | null {
  if (typeof document === 'undefined') return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const root = wrap.firstElementChild as HTMLElement | null;
  if (!root) return null;
  if (
    root.matches('table, ul, ol, p, h1, h2, h3, h4, img, pre, blockquote, li, details') ||
    root.classList.contains('course-flash') ||
    root.classList.contains('course-quick-block') ||
    root.classList.contains('course-book-cover') ||
    root.classList.contains('course-table-wrap') ||
    root.classList.contains('course-table') ||
    root.classList.contains('course-callout') ||
    root.classList.contains('course-explain') ||
    root.querySelector('table, ul, ol')
  ) {
    return null;
  }
  const hasLooseText = Array.from(root.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim().length > 0,
  );
  if (hasLooseText) return null;
  const kids = Array.from(root.children).filter(
    (el) => (el.textContent || '').trim().length > 0 || Boolean(el.querySelector('img, svg, video')),
  );
  if (kids.length < 2) return null;
  return kids.map((el) => el.outerHTML);
}

function htmlWithChildSlice(html: string, parts: string[], continued: boolean) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const root = wrap.firstElementChild as HTMLElement | null;
  if (!root) return html;
  root.innerHTML = parts.join('');
  if (continued) root.classList.add('is-flow-continued');
  return root.outerHTML;
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
    body.innerHTML = wrapPagePieces(pieces);
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

  const maxList = async (base: string[], html: string, rest: string[], offset: number) => {
    if (!rest.length) return 0;
    let lo = 1;
    let hi = rest.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const slice = htmlWithListSlice(html, rest.slice(0, mid), offset, offset > 0);
      if (await paint(base.concat(slice))) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };

  const emitList = async (html: string, items: string[]) => {
    let offset = 0;
    while (offset < items.length) {
      const rest = items.slice(offset);
      let fitted = await maxList(current, html, rest, offset);
      if (fitted <= 0 && current.length) {
        pages.push(current);
        current = [];
        fitted = await maxList(current, html, rest, offset);
      }
      if (fitted <= 0) {
        current.push(htmlWithListSlice(html, rest, offset, offset > 0));
        pages.push(current);
        current = [];
        break;
      }
      current.push(htmlWithListSlice(html, rest.slice(0, fitted), offset, offset > 0));
      offset += fitted;
      if (offset < items.length) {
        pages.push(current);
        current = [];
      }
    }
  };

  try {
    const endPage = () => {
      if (!current.length) return;
      pages.push(current);
      current = [];
    };

    const maxTable = async (base: string[], html: string, rest: string[], continued: boolean) => {
      if (!rest.length) return 0;
      let lo = 1;
      let hi = rest.length;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const slice = htmlWithTableSlice(html, rest.slice(0, mid), continued, mid === rest.length);
        if (await paint(base.concat(slice))) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return best;
    };

    const emitTable = async (html: string, rows: string[]) => {
      let offset = 0;
      while (offset < rows.length) {
        const rest = rows.slice(offset);
        const continued = offset > 0;
        let fitted = await maxTable(current, html, rest, continued);
        if (fitted <= 0 && current.length) {
          pages.push(current);
          current = [];
          fitted = await maxTable(current, html, rest, continued);
        }
        if (fitted <= 0) {
          current.push(htmlWithTableSlice(html, rest.slice(0, 1), continued, rest.length === 1));
          pages.push(current);
          current = [];
          offset += 1;
          continue;
        }
        current.push(
          htmlWithTableSlice(html, rest.slice(0, fitted), continued, offset + fitted >= rows.length),
        );
        offset += fitted;
        if (offset < rows.length) {
          pages.push(current);
          current = [];
        }
      }
    };

    const maxParts = async (base: string[], html: string, rest: string[], continued: boolean) => {
      if (!rest.length) return 0;
      let lo = 1;
      let hi = rest.length;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const slice = htmlWithChildSlice(html, rest.slice(0, mid), continued);
        if (await paint(base.concat(slice))) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return best;
    };

    const emitParts = async (html: string, parts: string[]) => {
      let offset = 0;
      while (offset < parts.length) {
        const rest = parts.slice(offset);
        const continued = offset > 0;
        let fitted = await maxParts(current, html, rest, continued);
        if (fitted <= 0 && current.length) {
          pages.push(current);
          current = [];
          fitted = await maxParts(current, html, rest, continued);
        }
        if (fitted <= 0) {
          current.push(htmlWithChildSlice(html, rest.slice(0, 1), continued));
          pages.push(current);
          current = [];
          offset += 1;
          continue;
        }
        current.push(htmlWithChildSlice(html, rest.slice(0, fitted), continued));
        offset += fitted;
        if (offset < parts.length) {
          pages.push(current);
          current = [];
        }
      }
    };

    const fillOverflow = async (full: string, kind: string) => {
      if (canSplitList(kind)) {
        const items = listPieces(full);
        if (items) {
          await emitList(full, items);
          return true;
        }
      }
      if (kind === 'table') {
        const rows = tableBodyRows(full);
        if (rows) {
          await emitTable(full, rows);
          return true;
        }
      }
      if (canSplitBlock(kind)) {
        const words = wordsFromHtml(full);
        const fitted = await maxWords(current, full, words);
        if (fitted > 0 && fitted < words.length) {
          current.push(htmlWithWords(full, words.slice(0, fitted)));
          pages.push(current);
          current = [];
          await emitWords(full, words.slice(fitted));
          return true;
        }
      }
      const parts = compositeChildHtmls(full);
      if (parts) {
        await emitParts(full, parts);
        return true;
      }
      return false;
    };

    const headingKeepsFollowing = async (
      base: string[],
      headingHtmls: string[],
      next: { id: string; kind: string; html: string } | undefined,
    ) => {
      if (!next) return true;
      const nextHtml = htmlForBlock(next, opts.openIds);
      if (await paint(base.concat(headingHtmls, nextHtml))) return true;
      if (next.kind === 'table') {
        const rows = tableBodyRows(nextHtml);
        if (!rows?.length) return false;
        const need = Math.min(rows.length, Math.max(3, Math.ceil(rows.length * 0.34)));
        return paint(
          base.concat(
            headingHtmls,
            htmlWithTableSlice(nextHtml, rows.slice(0, need), false, need >= rows.length),
          ),
        );
      }
      if (canSplitList(next.kind)) {
        const items = listPieces(nextHtml);
        if (!items?.length) return false;
        const need = Math.min(items.length, Math.max(2, Math.ceil(items.length * 0.34)));
        return paint(
          base.concat(headingHtmls, htmlWithListSlice(nextHtml, items.slice(0, need), 0, false)),
        );
      }
      if (canSplitBlock(next.kind)) {
        const words = wordsFromHtml(nextHtml);
        if (!words.length) return false;
        const need = Math.min(words.length, Math.max(28, Math.ceil(words.length * 0.34)));
        return paint(base.concat(headingHtmls, htmlWithWords(nextHtml, words.slice(0, need))));
      }
      return false;
    };

    for (let bi = 0; bi < blocks.length; bi += 1) {
      const block = blocks[bi];
      const full = htmlForBlock(block, opts.openIds);
      if (isChapterStart(block.kind, full)) endPage();
      if (current.length && isSectionHeading(block.kind) && !isChapterStart(block.kind, full)) {
        let runEnd = bi;
        const headingHtmls = [full];
        while (
          runEnd + 1 < blocks.length &&
          isSectionHeading(blocks[runEnd + 1].kind) &&
          !isChapterStart(blocks[runEnd + 1].kind, blocks[runEnd + 1].html)
        ) {
          runEnd += 1;
          headingHtmls.push(htmlForBlock(blocks[runEnd], opts.openIds));
        }
        if (!(await headingKeepsFollowing(current, headingHtmls, blocks[runEnd + 1]))) endPage();
      }

      if (await paint(current.concat(full))) {
        current.push(full);
        continue;
      }
      if (await fillOverflow(full, block.kind)) continue;
      if (current.length) {
        pages.push(current);
        current = [];
      }
      if (await paint([full])) {
        current.push(full);
        continue;
      }
      if (await fillOverflow(full, block.kind)) continue;
      if (canSplitBlock(block.kind)) {
        await emitWords(full, wordsFromHtml(full));
      } else {
        current.push(full);
        pages.push(current);
        current = [];
      }
    }
    if (current.length) pages.push(current);

    const htmlStartsChapter = (html: string) => {
      if (isCoverHtml(html)) return true;
      if (/<h1\b/i.test(html)) return true;
      const match = html.match(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/i);
      if (!match) return false;
      const text = match[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return /^chapter\s+\d+/i.test(text);
    };

    for (let i = 0; i < pages.length - 1; i += 1) {
      if (!pages[i].length || isCoverHtml(pages[i].join(''))) continue;
      while (pages[i + 1]?.length) {
        const nextHtml = pages[i + 1][0];
        if (htmlStartsChapter(nextHtml) || /is-table-continued/.test(nextHtml)) break;
        const nextIsHeading = /^<(h[1-4]|p\b[^>]*course-kicker)/i.test(nextHtml.trim());
        if (nextIsHeading) {
          const follow = pages[i + 1][1];
          if (!follow || !(await paint(pages[i].concat(nextHtml, follow)))) break;
          pages[i].push(pages[i + 1].shift() as string);
          pages[i].push(pages[i + 1].shift() as string);
          continue;
        }
        if (!(await paint(pages[i].concat(nextHtml)))) break;
        pages[i].push(pages[i + 1].shift() as string);
      }
      if (pages[i + 1] && !pages[i + 1].length) {
        pages.splice(i + 1, 1);
        i -= 1;
      }
    }
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

function pagePlainText(pieces: string[]) {
  return foldSearch(htmlToText(pieces.join(' ')));
}

function readingPlaceAnchor(pages: string[][], pageIndex: number) {
  const pieces = pages[pageIndex];
  if (!pieces?.length) return null;
  const html = pieces.join('');
  if (isCoverHtml(html)) {
    return {
      cover: true,
      coverSrc: coverImageSrc(html) || '',
      edge: (pageIndex === 0 ? 'front' : 'back') as 'front' | 'back',
      text: '',
    };
  }
  const text = pagePlainText(pieces).slice(0, 120);
  if (text.length < 8) return null;
  return { cover: false, coverSrc: '', edge: 'front' as const, text };
}

function pageIndexForAnchor(
  pages: string[][],
  anchor: { cover: boolean; coverSrc: string; edge: 'front' | 'back'; text: string },
  hint: number,
  prevCount: number,
) {
  const last = Math.max(0, pages.length - 1);
  const proportional =
    prevCount > 1 && pages.length > 1
      ? Math.round((Math.min(Math.max(0, hint), prevCount - 1) / (prevCount - 1)) * last)
      : Math.min(Math.max(0, hint), last);
  if (anchor.cover) {
    const found = pages.findIndex((pieces, i) => {
      const html = pieces.join('');
      if (!isCoverHtml(html)) return false;
      const src = coverImageSrc(html) || '';
      if (anchor.coverSrc && src !== anchor.coverSrc) return false;
      if (anchor.edge === 'front') return i === 0;
      return i === pages.length - 1;
    });
    if (found >= 0) return found;
    return anchor.edge === 'back' ? last : 0;
  }
  if (!anchor.text) return proportional;
  const needleSource = anchor.text;
  const lengths = [120, 80, 48, 28, 16];
  for (const len of lengths) {
    const needle = needleSource.slice(0, Math.min(len, needleSource.length));
    if (needle.length < 10) break;
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    pages.forEach((pieces, i) => {
      const at = pagePlainText(pieces).indexOf(needle);
      if (at < 0) return;
      const score = at * 100000 + Math.abs(i - proportional);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0) return best;
  }
  return proportional;
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

function tocCoverKey(item: { title: string; page: number }) {
  return `${item.page}::${item.title}`;
}

function tocDescendantKeys(
  items: { title: string; level: number; page: number }[],
  index: number,
) {
  const parent = items[index];
  if (!parent) return [] as string[];
  const keys: string[] = [];
  for (let i = index + 1; i < items.length; i += 1) {
    if (items[i].level <= parent.level) break;
    keys.push(tocCoverKey(items[i]));
  }
  return keys;
}

function coveredStoreKey(chapterId?: number, chapterSlug?: string) {
  return `vv_toc_checked:${chapterId || chapterSlug || 'anon'}`;
}

function ReaderBackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M15.2 5.2 8.4 12l6.8 6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readCoveredSet(storeKey: string) {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.localStorage.getItem(storeKey);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function TocTopicRow({
  item,
  current,
  done,
  onOpen,
  onToggleCovered,
}: {
  item: { title: string; level: number; page: number };
  current?: boolean;
  done?: boolean;
  onOpen: () => void;
  onToggleCovered: () => void;
}) {
  return (
    <div
      className={`course-toc-item is-level-${item.level}${current ? ' is-on' : ''}${done ? ' is-done' : ''}`}
      style={{ ['--toc-depth' as string]: String(Math.max(0, item.level - 1)) }}
    >
      <button
        type="button"
        className="course-toc-tick"
        aria-pressed={Boolean(done)}
        aria-label={done ? `Unmark ${item.title}` : `Mark ${item.title}`}
        title={done ? 'Uncheck this topic' : 'Mark this topic'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCovered();
        }}
      />
      <button
        type="button"
        className="course-toc-link"
        aria-label={`${item.title}, page ${item.page}`}
        onClick={onOpen}
      >
        <span className="course-toc-title">{item.title}</span>
        <span className="course-toc-page">{item.page}</span>
      </button>
    </div>
  );
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

function selectionPaintRects(root: HTMLElement) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return [];
  const origin = root.getBoundingClientRect();
  return Array.from(sel.getRangeAt(0).getClientRects())
    .filter((box) => box.width >= 1 && box.height >= 1)
    .map((box) => ({
      left: box.left - origin.left,
      top: box.top - origin.top,
      width: box.width,
      height: box.height,
    }));
}

function eventElement(target: EventTarget | Node | null): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  if (target instanceof Element) return target.parentElement;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function restorePhraseSelection(root: HTMLElement, phrase: string) {
  const folded = foldText(phrase);
  if (folded.length < 2) return false;
  const marks = Array.from(root.querySelectorAll('mark.course-mark')) as HTMLElement[];
  const mark = marks.find((el) => {
    const hay = foldText(el.textContent || '');
    return hay === folded || hay.includes(folded) || (folded.length >= 8 && folded.includes(hay));
  });
  try {
    const range = document.createRange();
    if (mark) {
      range.selectNodeContents(mark);
    } else {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (!node.nodeValue || node.parentElement?.closest('script, style')) continue;
        nodes.push(node);
      }
      const { hay, map } = buildHighlightIndex(nodes);
      const hit = locateHighlight(hay, phrase, false)[0];
      if (!hit || !map[hit.at] || !map[hit.at + hit.len - 1]) return false;
      const start = map[hit.at];
      const end = map[hit.at + hit.len - 1];
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset + 1);
    }
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  } catch {
    return false;
  }
}

function collapseQuickBlocks(html: string) {
  if (!html || typeof document === 'undefined' || !/course-quick-block/.test(html)) return html;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  wrap.querySelectorAll('.course-quick-block').forEach((el, i) => {
    if (el.querySelector('.course-quick-icon-btn')) return;
    const kind = el.getAttribute('data-kind') === 'mcq' ? 'Quiz' : 'Quick check';
    const slug = (el.textContent || '').replace(/[^a-z0-9]+/gi, '').slice(0, 24);
    const id = el.getAttribute('data-quick-id') || `quick-${i}-${slug}`;
    el.setAttribute('data-quick-id', id);
    el.classList.add('is-collapsed');
    const inner = el.innerHTML.trim();
    el.innerHTML = `<button type="button" class="course-quick-icon-btn" aria-expanded="false" aria-label="${kind}"><span class="course-quick-icon" aria-hidden="true"></span><span class="course-quick-icon-label">${kind}</span></button><template class="course-quick-expand">${inner}</template>`;
  });
  groupAdjacentQuizzes(wrap);
  return wrap.innerHTML;
}

function groupAdjacentQuizzes(root: HTMLElement) {
  const sequence: Array<{ kind: 'quiz' | 'other'; el?: HTMLElement }> = [];
  const walk = (parent: Element) => {
    Array.from(parent.children).forEach((child) => {
      if (child.classList.contains('course-quick-block')) {
        sequence.push({ kind: 'quiz', el: child as HTMLElement });
        return;
      }
      if (child.querySelector('.course-quick-block')) {
        walk(child);
        return;
      }
      const hasContent =
        Boolean((child.textContent || '').trim()) || Boolean(child.querySelector('img, table, svg, figure'));
      if (hasContent) sequence.push({ kind: 'other' });
    });
  };
  walk(root);
  const groups: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  sequence.forEach((item) => {
    if (item.kind === 'quiz' && item.el) {
      current.push(item.el);
      return;
    }
    if (current.length) groups.push(current);
    current = [];
  });
  if (current.length) groups.push(current);
  groups.forEach((group) => {
    if (group.length < 2) return;
    const gid = `qg-${group[0].getAttribute('data-quick-id') || 'stack'}`;
    group.forEach((el, i) => {
      el.setAttribute('data-quick-group', gid);
      el.setAttribute('data-quick-group-index', String(i));
      if (i > 0) {
        el.classList.add('is-grouped-hidden');
        return;
      }
      el.classList.add('is-quiz-stack');
      const label = el.querySelector('.course-quick-icon-label');
      if (label) label.textContent = `Quiz · ${group.length}`;
      const btn = el.querySelector('.course-quick-icon-btn');
      if (btn) {
        btn.setAttribute('aria-label', `${group.length} quizzes`);
      }
    });
  });
}

function quickFromBlock(
  block: HTMLElement,
  expand?: HTMLTemplateElement | HTMLElement | null,
): {
  id: string;
  answer: number;
  html: string;
  checked: boolean;
  picked: string | null;
} {
  const src =
    expand ||
    (block.querySelector('.course-quick-expand') as HTMLTemplateElement | HTMLElement | null);
  return {
    id: block.getAttribute('data-quick-id') || '',
    answer: Number(block.getAttribute('data-answer') || 0),
    html: src?.innerHTML || '',
    checked: block.classList.contains('is-checked'),
    picked: block.getAttribute('data-picked'),
  };
}

function wrapPagePieces(pieces: string[]) {
  return collapseQuickBlocks(
    pieces
      .map((html) => {
        if (!html) return '';
        if (isCoverHtml(html) || /course-select-block/.test(html)) return html;
        return `<div class="course-select-block">${html}</div>`;
      })
      .join(''),
  );
}

const SELECT_BLOCK =
  'p, h1, h2, h3, h4, li, td, th, figcaption, dt, dd, pre, blockquote, .course-formula, .course-kicker, .course-select-block';

function selectionIsland(node: Node | null) {
  const el = node instanceof Element ? node : node?.parentElement;
  if (!el) return null;
  const body = el.closest('.course-book-body') as HTMLElement | null;
  if (!body) return null;
  const block = el.closest(SELECT_BLOCK) as HTMLElement | null;
  if (block && body.contains(block) && block !== body) return block;
  const wrapped = el.closest('.course-select-block') as HTMLElement | null;
  if (wrapped && body.contains(wrapped)) return wrapped;
  return null;
}

function nearestTextBlock(body: HTMLElement, clientY: number) {
  const blocks = Array.from(body.querySelectorAll(SELECT_BLOCK)) as HTMLElement[];
  if (!blocks.length) return null;
  let inside: HTMLElement | null = null;
  let insideH = Number.POSITIVE_INFINITY;
  let below: HTMLElement | null = null;
  let belowDist = Number.POSITIVE_INFINITY;
  let above: HTMLElement | null = null;
  let aboveDist = Number.POSITIVE_INFINITY;
  for (const el of blocks) {
    if (el.closest(SELECT_BLOCK) !== el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) continue;
    if (clientY >= rect.top && clientY <= rect.bottom) {
      if (rect.height <= insideH) {
        inside = el;
        insideH = rect.height;
      }
      continue;
    }
    if (clientY < rect.top) {
      const dist = rect.top - clientY;
      if (dist < belowDist) {
        below = el;
        belowDist = dist;
      }
    } else {
      const dist = clientY - rect.bottom;
      if (dist < aboveDist) {
        above = el;
        aboveDist = dist;
      }
    }
  }
  if (inside) return inside;
  if (below && belowDist <= aboveDist + 8) return below;
  return above || below;
}

function islandFromPoint(x: number, y: number, root: HTMLElement | null) {
  if (!root) return null;
  const hit = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!hit || !root.contains(hit)) return null;
  const direct = selectionIsland(hit);
  if (direct) return direct;
  const body = hit.closest('.course-book-body') as HTMLElement | null;
  if (!body || !root.contains(body)) return null;
  return nearestTextBlock(body, y);
}

function caretFromPoint(x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos?.offsetNode) return { node: pos.offsetNode, offset: pos.offset };
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }
  return null;
}

function islandEdge(island: HTMLElement, which: 'start' | 'end') {
  const range = document.createRange();
  range.selectNodeContents(island);
  if (which === 'start') return { node: range.startContainer, offset: range.startOffset };
  return { node: range.endContainer, offset: range.endOffset };
}

function caretInIsland(island: HTMLElement, x: number, y: number) {
  const caret = caretFromPoint(x, y);
  if (caret && (caret.node === island || island.contains(caret.node))) return caret;
  const rect = island.getBoundingClientRect();
  if (y < rect.top + 1) return islandEdge(island, 'start');
  if (y > rect.bottom - 1) return islandEdge(island, 'end');
  if (x <= rect.left + 1) return islandEdge(island, 'start');
  return islandEdge(island, 'end');
}

function applyCaretSelection(
  start: { node: Node; offset: number },
  end: { node: Node; offset: number },
) {
  const sel = window.getSelection();
  if (!sel) return;
  try {
    sel.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
  } catch {
    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      if (range.collapsed) {
        range.setStart(end.node, end.offset);
        range.setEnd(start.node, start.offset);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      /* ignore */
    }
  }
}

function expandWordInIsland(island: HTMLElement, x: number, y: number) {
  const caret = caretInIsland(island, x, y);
  if (caret.node.nodeType !== Node.TEXT_NODE) {
    applyCaretSelection(islandEdge(island, 'start'), islandEdge(island, 'end'));
    return;
  }
  const text = caret.node.textContent || '';
  let start = caret.offset;
  let end = caret.offset;
  while (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1] || '')) start -= 1;
  while (end < text.length && /[\p{L}\p{N}]/u.test(text[end] || '')) end += 1;
  if (end <= start) {
    applyCaretSelection(islandEdge(island, 'start'), islandEdge(island, 'end'));
    return;
  }
  applyCaretSelection({ node: caret.node, offset: start }, { node: caret.node, offset: end });
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

/** Printed leaf. Pagination always uses this box, so laptop and tablet show the same pages. */
const _PDF_LEAF = { w: 418, h: 888 };

type CourseChapterLink = { slug: string; title: string };
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

function useBookPageSize(
  slot: React.RefObject<HTMLElement | null>,
  leaves: 1 | 2,
  fill = false,
) {
  const [size, setSize] = React.useState({ w: 480, h: 680 });
  const [live, setLive] = React.useState({ w: 480, h: 680 });
  const fillRef = React.useRef(fill);
  fillRef.current = fill;
  React.useEffect(() => {
    const measure = (fullscreenBox: boolean) => {
      const el = slot.current;
      const slotH = el?.clientHeight || 0;
      const slotW = el?.clientWidth || 0;
      const cs = el ? getComputedStyle(el) : null;
      const padX = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0;
      const contentW = Math.max(0, slotW - padX);
      const maxH = Math.max(280, slotH || Math.round(window.innerHeight * (fullscreenBox ? 0.92 : 0.72)));
      const maxW = Math.max(
        240,
        contentW || Math.min(window.innerWidth - (fullscreenBox ? 48 : 120), fullscreenBox ? window.innerWidth : 720),
      );
      const gutter = leaves === 2 ? 14 : 0;
      const maxLeaf = leaves === 2 ? 680 : 720;
      let width = (maxW - gutter) / leaves;
      if (!fullscreenBox && width > maxLeaf) width = maxLeaf;
      return { w: Math.round(Math.max(80, width)), h: Math.round(maxH) };
    };
    const nativeFullscreen = () => {
      const native = document.fullscreenElement || (document as any).webkitFullscreenElement;
      return !!(native && slot.current && native.contains(slot.current));
    };
    const update = () => {
      const inFullscreen = fillRef.current || nativeFullscreen();
      const nextLive = measure(inFullscreen);
      setLive((prev) => (prev.w === nextLive.w && prev.h === nextLive.h ? prev : nextLive));
      if (inFullscreen) return;
      const next = measure(false);
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };
    update();
    const el = slot.current;
    const ro = el ? new ResizeObserver(() => update()) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    const later = window.setTimeout(update, 50);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
      window.clearTimeout(later);
    };
  }, [leaves, slot]);
  return { read: size, live };
}

type CourseReaderLayout = 'phone' | 'tablet' | 'desktop';

function readCourseReaderLayout(): CourseReaderLayout {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shortest = Math.min(w, h);
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (w >= OPEN_BOOK_MIN_WIDTH && h >= 760 && !(coarse && shortest <= 1180)) return 'desktop';
  if (w >= 600 && h >= 600) return 'tablet';
  return 'phone';
}

function useCourseReaderLayout() {
  const [layout, setLayout] = React.useState<CourseReaderLayout>(() =>
    typeof window === 'undefined' ? 'desktop' : readCourseReaderLayout(),
  );
  const [width, setWidth] = React.useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  React.useEffect(() => {
    const update = () => {
      setLayout(readCourseReaderLayout());
      setWidth(window.innerWidth);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return { layout, width };
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
  practiceActivity = null,
  notesHref: _notesHref,
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
  initialNotesOpen = false,
  bookKey = '',
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
  practiceActivity?: any | null;
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
  initialNotesOpen?: boolean;
  bookKey?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [pages, setPages] = React.useState<string[][]>([['<p>Loading…</p>']]);
  const { layout, width: viewportW } = useCourseReaderLayout();
  const wide = layout === 'desktop';
  const tablet = layout === 'tablet';
  const shelf = wide || tablet;
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
  const [userFlashcards, setUserFlashcards] = React.useState<CourseFlashcard[]>([]);
  const [picked, setPicked] = React.useState('');
  const [selRects, setSelRects] = React.useState<
    { left: number; top: number; width: number; height: number }[]
  >([]);
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
  const [bookFullscreen, setBookFullscreen] = React.useState(false);
  const [cssFullscreen, setCssFullscreen] = React.useState(false);
  const [notesFullscreen, setNotesFullscreen] = React.useState(initialNotesOpen);
  const [practiceFullscreen, setPracticeFullscreen] = React.useState(false);
  const [flashDeckOpen, setFlashDeckOpen] = React.useState(false);
  const [openQuick, setOpenQuick] = React.useState<{
    items: {
      id: string;
      answer: number;
      html: string;
      checked: boolean;
      picked: string | null;
    }[];
    index: number;
  } | null>(null);
  const [openFlash, setOpenFlash] = React.useState<{ front: string; back: string } | null>(null);
  const [flashFlipped, setFlashFlipped] = React.useState(false);
  const [flashEntering, setFlashEntering] = React.useState(false);
  const coveredKey = coveredStoreKey(chapterId, chapterSlug);
  const [covered, setCovered] = React.useState<Set<string>>(() => readCoveredSet(coveredKey));
  const [query, setQuery] = React.useState('');
  const [noteQuote, setNoteQuote] = React.useState('');
  const lastSelection = React.useRef('');
  const selectIslandRef = React.useRef<HTMLElement | null>(null);
  const restoreSelRef = React.useRef<string | null>(null);
  const holdSelectionRef = React.useRef(false);
  const dragSelRef = React.useRef<{
    island: HTMLElement;
    start: { node: Node; offset: number };
  } | null>(null);
  const pageTurnLockRef = React.useRef(0);
  const wheelGestureRef = React.useRef(false);
  const goSpreadRef = React.useRef<(delta: number) => void>(() => {});
  const flipLockRef = React.useRef(false);
  const flipTimerRef = React.useRef(0);
  const markedPagesRef = React.useRef<string[]>([]);
  const [flip, setFlip] = React.useState<null | {
    dir: 1 | -1;
    frontIndex: number;
    backIndex: number;
    underLeft: number | null;
    underRight: number | null;
    solo: boolean;
  }>(null);
  const setSelRectsRef = React.useRef(setSelRects);
  setSelRectsRef.current = setSelRects;
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
    fetchChapterFlashcards(chapterId)
      .then(setUserFlashcards)
      .catch(() => setUserFlashcards([]));
  }, [chapterId]);

  const bookFlashcards = React.useMemo(() => flashcardsFromHtml(html), [html]);
  const chapterFlashcards = React.useMemo(() => {
    const seen = new Set(bookFlashcards.map((card) => card.front.toLowerCase()));
    return [
      ...bookFlashcards,
      ...userFlashcards.filter((card) => {
        const key = (card.front || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    ];
  }, [bookFlashcards, userFlashcards]);

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
  const pagesRef = React.useRef(pages);
  const indexRef = React.useRef(index);
  pagesRef.current = pages;
  indexRef.current = index;
  const bookRef = React.useRef<HTMLDivElement | null>(null);
  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const toolsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const revealRef = React.useRef<(next: Omit<BookReveal, 'token'>) => void>(() => {});
  const spread = wantSpread && (wide || (tablet && viewportW >= 1024));
  const spreadRef = React.useRef(spread);
  const spreads = React.useMemo(
    () => courseSpreads(pages.length, startPage),
    [pages.length, startPage],
  );
  const spreadAt = spreadIndexFor(spreads, index);
  const openSpread = spread
    ? spreads[spreadAt] || { left: index, right: null }
    : { left: index, right: null };
  const soloLeaf = !spread || openSpread.left == null || openSpread.right == null;
  const coverPageIndex =
    !spread || soloLeaf ? (spread ? (openSpread.left ?? openSpread.right ?? index) : index) : null;
  const coverHtml = coverPageIndex != null ? pages[coverPageIndex]?.join('') || '' : '';
  const coverSrc =
    coverHtml && isCoverHtml(coverHtml) ? coverImageSrc(coverHtml) || frontCoverUrl || null : null;
  const pageFit = useBookPageSize(slotRef, spread ? 2 : 1, bookFullscreen);
  const a4 = pageFit.read;
  const imgMax = Math.max(110, Math.round(a4.h * 0.26));
  const layoutBookW = spread && !soloLeaf ? a4.w * 2 + 14 : a4.w;
  const pageScale =
    bookFullscreen && a4.w > 0 && a4.h > 0
      ? Math.max(0.2, Math.min(pageFit.live.w / a4.w, pageFit.live.h / a4.h))
      : 1;
  const visualBookW = Math.round(layoutBookW * pageScale);
  const visualBookH = Math.round(a4.h * pageScale);
  const goSpread = React.useCallback(
    (delta: number) => {
      if (flipLockRef.current) return;
      const flippingIndex =
        !spread || soloLeaf
          ? index
          : delta > 0
            ? (openSpread.right ?? openSpread.left ?? index)
            : (openSpread.left ?? openSpread.right ?? index);
      const commit = (target: number) => {
        setIndex(target);
        setToolIndex(target);
      };
      const beginFlip = (motion: {
        dir: 1 | -1;
        frontIndex: number;
        backIndex: number;
        underLeft: number | null;
        underRight: number | null;
        nextIndex: number;
        solo: boolean;
      }) => {
        const reduced =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
          commit(motion.nextIndex);
          return;
        }
        flipLockRef.current = true;
        pageTurnLockRef.current = Date.now() + 460;
        setFlip({
          dir: motion.dir,
          frontIndex: motion.frontIndex,
          backIndex: motion.backIndex,
          underLeft: motion.underLeft,
          underRight: motion.underRight,
          solo: motion.solo,
        });
        window.clearTimeout(flipTimerRef.current);
        flipTimerRef.current = window.setTimeout(() => {
          commit(motion.nextIndex);
          setFlip(null);
          flipLockRef.current = false;
        }, 400);
      };
      if (!spread) {
        const next = Math.min(pages.length - 1, Math.max(0, index + delta));
        if (next === index) return;
        beginFlip({
          dir: delta > 0 ? 1 : -1,
          frontIndex: index,
          backIndex: next,
          underLeft: next,
          underRight: null,
          nextIndex: next,
          solo: true,
        });
        return;
      }
      const nextAt = Math.min(spreads.length - 1, Math.max(0, spreadAt + delta));
      if (nextAt === spreadAt) return;
      const dest = spreads[nextAt] || { left: index, right: null };
      const current = spreads[spreadAt] || { left: openSpread.left, right: openSpread.right };
      const goingNext = delta > 0;
      const soloNow = current.left == null || current.right == null;
      const nextIndex = dest.left ?? dest.right ?? 0;
      beginFlip({
        dir: goingNext ? 1 : -1,
        frontIndex: goingNext
          ? (current.right ?? current.left ?? flippingIndex)
          : (current.left ?? current.right ?? flippingIndex),
        backIndex: goingNext
          ? (dest.left ?? dest.right ?? nextIndex)
          : (dest.right ?? dest.left ?? nextIndex),
        underLeft: soloNow ? nextIndex : goingNext ? current.left : dest.left,
        underRight: soloNow ? null : goingNext ? (dest.right ?? dest.left) : current.right,
        nextIndex,
        solo: soloNow,
      });
    },
    [
      spread,
      soloLeaf,
      index,
      openSpread.left,
      openSpread.right,
      spreadAt,
      spreads,
      pages.length,
    ],
  );
  goSpreadRef.current = goSpread;

  React.useEffect(
    () => () => {
      window.clearTimeout(flipTimerRef.current);
      flipLockRef.current = false;
    },
    [],
  );

  const exitBookFullscreen = React.useCallback(async () => {
    setCssFullscreen(false);
    setBookFullscreen(false);
    const native = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (!native) return;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  const toggleBookFullscreen = React.useCallback(async () => {
    if (bookFullscreen) {
      await exitBookFullscreen();
      return;
    }
    const el = stageRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
      else throw new Error('no_fs');
      setBookFullscreen(true);
    } catch {
      setCssFullscreen(true);
      setBookFullscreen(true);
    }
  }, [bookFullscreen, exitBookFullscreen]);

  const openNotesFullscreen = React.useCallback(async () => {
    if (bookFullscreen) await exitBookFullscreen();
    setPracticeFullscreen(false);
    setFlashDeckOpen(false);
    setNotesFullscreen(true);
  }, [bookFullscreen, exitBookFullscreen]);

  React.useEffect(() => {
    const handleToggle = () => {
      setNotesFullscreen((prev) => !prev);
    };
    window.addEventListener('vv-toggle-reader-notes', handleToggle);
    return () => window.removeEventListener('vv-toggle-reader-notes', handleToggle);
  }, []);

  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('vv-reader-notes-state', { detail: { open: notesFullscreen } }),
    );
  }, [notesFullscreen]);

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location.pathname.includes('/read')) {
        window.sessionStorage.setItem('vv_last_read_href', window.location.pathname + window.location.search);
      }
    } catch {
      // ignore storage access errors
    }
  }, [chapterSlug, index]);

  const openPracticePopup = React.useCallback(() => {
    setNotesFullscreen(false);
    setSheetOpen(false);
    setOpenQuick(null);
    setOpenFlash(null);
    setFlashDeckOpen(false);
    setPanel((prev) => (prev === 'check' ? 'highlights' : prev));
    setPracticeFullscreen(true);
  }, []);

  const openFlashDeck = React.useCallback(() => {
    setNotesFullscreen(false);
    setSheetOpen(false);
    setOpenQuick(null);
    setOpenFlash(null);
    setPracticeFullscreen(false);
    setFlashDeckOpen(true);
  }, []);

  React.useEffect(() => {
    const current = openQuick?.items[openQuick.index];
    if (!current?.checked || !stageRef.current) return;
    const quiz = stageRef.current.querySelector(
      '.course-quick-popup .course-quick-block',
    ) as HTMLElement | null;
    if (!quiz) return;
    const picked = Number(current.picked);
    const answer = current.answer;
    quiz.classList.add('is-checked');
    quiz.querySelectorAll('[data-opt]').forEach((btn) => {
      const i = Number(btn.getAttribute('data-opt'));
      btn.classList.toggle('is-on', i === picked);
      btn.classList.toggle('is-right', i === answer);
      btn.classList.toggle('is-wrong', i === picked && i !== answer);
    });
  }, [openQuick]);

  React.useEffect(() => {
    if (!notesFullscreen && !practiceFullscreen && !flashDeckOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [notesFullscreen, practiceFullscreen, flashDeckOpen]);

  React.useEffect(() => {
    const sync = () => {
      const el = stageRef.current;
      const native =
        document.fullscreenElement || (document as any).webkitFullscreenElement || null;
      if (el && native === el) setBookFullscreen(true);
      else if (!cssFullscreen) setBookFullscreen(false);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [cssFullscreen]);

  React.useEffect(() => {
    let cancelled = false;
    const pageW = a4.w;
    const pageH = a4.h;
    const htmlChanged = htmlRef.current !== sourceHtml;
    const spreadChanged = spreadRef.current !== spread;
    spreadRef.current = spread;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const currentPages = pagesRef.current;
      const currentIndex = indexRef.current;
      let anchorIndex = currentIndex;
      if (!htmlChanged && spread && !spreadChanged && currentPages.length) {
        const list = courseSpreads(currentPages.length, startPage);
        const open = list[spreadIndexFor(list, currentIndex)];
        if (open) anchorIndex = open.left ?? open.right ?? currentIndex;
      }
      const place = htmlChanged ? null : readingPlaceAnchor(currentPages, anchorIndex);
      const placeHint = anchorIndex;
      const placeCount = currentPages.length;
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
        const explainId = explainAnchor.current;
        explainAnchor.current = null;
        const coverShift = frontCoverUrl ? 1 : 0;
        let nextIndex = 0;
        if (explainId) {
          const found = next.findIndex((page) =>
            page.some((item) => item.includes(`data-explain-id="${explainId}"`)),
          );
          if (found >= 0) nextIndex = found;
          else if (place) nextIndex = pageIndexForAnchor(next, place, placeHint, placeCount);
        } else if (!htmlChanged && place) {
          nextIndex = pageIndexForAnchor(next, place, placeHint, placeCount);
        } else if (htmlChanged) {
          nextIndex = initialPage ? Math.max(0, initialPage - startPage) + coverShift : 0;
        } else {
          nextIndex = pageIndexForAnchor(
            next,
            { cover: false, coverSrc: '', edge: 'front', text: '' },
            placeHint,
            placeCount,
          );
        }
        nextIndex = Math.min(Math.max(0, nextIndex), Math.max(0, next.length - 1));
        setPages(next);
        setIndex(nextIndex);
        setToolIndex(nextIndex);
      });
    }, htmlChanged ? 0 : 90);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
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
    if (shelf && (panel === 'contents' || panel === 'bookmarks' || panel === 'notes')) {
      setPanel('highlights');
    }
  }, [shelf, panel]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === 'Escape' && notesFullscreen) {
        setNotesFullscreen(false);
        return;
      }
      if (e.key === 'Escape' && openFlash) {
        setOpenFlash(null);
        setFlashFlipped(false);
        setFlashEntering(false);
        return;
      }
      if (e.key === 'Escape' && openQuick) {
        setOpenQuick(null);
        return;
      }
      if (openQuick && openQuick.items.length > 1) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const delta = e.key === 'ArrowRight' ? 1 : -1;
          setOpenQuick((prev) => {
            if (!prev) return prev;
            const next = prev.index + delta;
            if (next < 0 || next >= prev.items.length) return prev;
            return { ...prev, index: next };
          });
          return;
        }
      }
      if (e.key === 'Escape' && flashDeckOpen) {
        setFlashDeckOpen(false);
        return;
      }
      if (e.key === 'Escape' && practiceFullscreen) {
        setPracticeFullscreen(false);
        return;
      }
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement | null)?.isContentEditable
      )
        return;
      if (notesFullscreen || practiceFullscreen || flashDeckOpen || openQuick || openFlash) return;
      if (e.key === 'ArrowRight') goSpread(1);
      if (e.key === 'ArrowLeft') goSpread(-1);
      if (e.key === 'Escape' && cssFullscreen) {
        setCssFullscreen(false);
        setBookFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goSpread, cssFullscreen, notesFullscreen, practiceFullscreen, flashDeckOpen, openQuick, openFlash]);

  React.useEffect(() => {
    if (!openFlash) {
      setFlashFlipped(false);
      setFlashEntering(false);
      return;
    }
    setFlashFlipped(false);
    setFlashEntering(true);
    let done = 0;
    const start = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setFlashFlipped(true);
        done = window.setTimeout(() => setFlashEntering(false), 750);
      });
    });
    return () => {
      window.cancelAnimationFrame(start);
      window.clearTimeout(done);
    };
  }, [openFlash]);

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let wheelIdle = 0;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let touchConsumed = false;
    const ignoreTarget = (node: EventTarget | null) => {
      const el = eventElement(node);
      return !!el?.closest(
        'input, textarea, select, [contenteditable], .course-reader-rail, .course-notes-section, .course-practice-popup, .course-quick-popup, .course-selection-bar',
      );
    };
    const turnOnce = (delta: number) => {
      if (Date.now() < pageTurnLockRef.current) return false;
      if (notesFullscreen || practiceFullscreen || flashDeckOpen || openQuick || openFlash) return false;
      pageTurnLockRef.current = Date.now() + 460;
      goSpreadRef.current(delta);
      return true;
    };
    const onWheel = (e: WheelEvent) => {
      if (ignoreTarget(e.target)) return;
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absX < 18 || absX < absY * 1.1) return;
      e.preventDefault();
      window.clearTimeout(wheelIdle);
      if (!wheelGestureRef.current) {
        wheelGestureRef.current = true;
        turnOnce(e.deltaX > 0 ? 1 : -1);
      }
      wheelIdle = window.setTimeout(() => {
        wheelGestureRef.current = false;
      }, 560);
    };
    const consumeTouch = (x: number, y: number) => {
      if (touchConsumed || dragSelRef.current) return;
      const dx = x - startX;
      const dy = y - startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
      touchConsumed = true;
      turnOnce(dx < 0 ? 1 : -1);
      pageTurnLockRef.current = Date.now() + 460;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || ignoreTarget(e.target)) {
        tracking = false;
        touchConsumed = false;
        return;
      }
      tracking = true;
      touchConsumed = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (touchConsumed || (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.15)) {
        e.preventDefault();
        consumeTouch(t.clientX, t.clientY);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (dragSelRef.current) {
        touchConsumed = false;
        return;
      }
      const t = e.changedTouches[0];
      if (t && !touchConsumed) consumeTouch(t.clientX, t.clientY);
      touchConsumed = false;
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd, { passive: true });
    stage.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(wheelIdle);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      stage.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [notesFullscreen, practiceFullscreen, flashDeckOpen, openQuick, openFlash]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const concept = target?.closest?.('.course-concept-hot') as HTMLElement | null;
      if (concept && bookRef.current?.contains(concept)) {
        if ((window.getSelection()?.toString() || '').trim().length >= 2) return;
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
        const front = (flash.querySelector('strong')?.textContent || '').trim();
        const back = (flash.querySelector('p')?.textContent || '').trim();
        setFlashFlipped(false);
        setFlashEntering(true);
        setFlashDeckOpen(false);
        setOpenFlash({ front: front || 'Flashcard', back: back || 'No answer yet.' });
        return;
      }
      const iconBtn = target?.closest?.('.course-quick-icon-btn') as HTMLElement | null;
      if (iconBtn && bookRef.current?.contains(iconBtn)) {
        e.preventDefault();
        e.stopPropagation();
        const block = iconBtn.closest('.course-quick-block') as HTMLElement | null;
        const expand = block?.querySelector('.course-quick-expand') as
          | HTMLTemplateElement
          | HTMLElement
          | null;
        if (!block || !expand) return;
        const group = block.getAttribute('data-quick-group');
        const items: {
          id: string;
          answer: number;
          html: string;
          checked: boolean;
          picked: string | null;
        }[] = [];
        if (group && bookRef.current) {
          bookRef.current
            .querySelectorAll(`.course-quick-block[data-quick-group="${group}"]`)
            .forEach((el) => items.push(quickFromBlock(el as HTMLElement)));
        }
        if (!items.length) items.push(quickFromBlock(block, expand));
        const start = Math.max(0, Number(block.getAttribute('data-quick-group-index') || 0));
        setOpenQuick({ items, index: Math.min(start, items.length - 1) });
        return;
      }
      if (target?.closest?.('.course-quick-popup')) return;
      const opt = target?.closest?.('.course-quick-block [data-opt]') as HTMLElement | null;
      const quiz = opt?.closest?.('.course-quick-block') as HTMLElement | null;
      const quizHost = Boolean(
        quiz && (bookRef.current?.contains(quiz) || stageRef.current?.contains(quiz)),
      );
      if (quiz && opt && quizHost) {
        e.preventDefault();
        e.stopPropagation();
        if (quiz.classList.contains('is-checked')) return;
        const picked = Number(opt.getAttribute('data-opt'));
        const answer = Number(quiz.getAttribute('data-answer'));
        quiz.classList.add('is-checked');
        quiz.setAttribute('data-picked', String(picked));
        quiz.querySelectorAll('[data-opt]').forEach((btn) => {
          const i = Number(btn.getAttribute('data-opt'));
          btn.classList.toggle('is-on', i === picked);
          btn.classList.toggle('is-right', i === answer);
          btn.classList.toggle('is-wrong', i === picked && i !== answer);
        });
        const id = quiz.getAttribute('data-quick-id');
        if (id && bookRef.current) {
          bookRef.current.querySelectorAll(`.course-quick-block[data-quick-id="${id}"]`).forEach((src) => {
            src.classList.add('is-checked');
            src.setAttribute('data-picked', String(picked));
          });
        }
        setOpenQuick((prev) => {
          if (!prev || !id) return prev;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === id ? { ...item, checked: true, picked: String(picked) } : item,
            ),
          };
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
    const skipSel = (target: EventTarget | Node | null) =>
      !!eventElement(target)?.closest(
        'button, a, input, textarea, select, [contenteditable], .course-flash, .course-quick-block, .course-explain summary, .course-book-turn, .course-selection-bar, .course-bookmark-picker, .course-page-fold',
      );

    const paint = () => {
      const root = bookRef.current;
      if (root) setSelRectsRef.current(selectionPaintRects(root));
    };

    const publishSel = () => {
      if (holdSelectionRef.current) return;
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
        paint();
      }
    };

    const onSelectStart = (e: Event) => {
      const node = e.target instanceof Node ? e.target : null;
      const target = eventElement(node);
      if (!node || !target || !bookRef.current?.contains(node)) return;
      if (skipSel(target)) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      if (target.closest('.course-book-body')) e.preventDefault();
    };

    const onDown = (e: PointerEvent) => {
      const node = e.target instanceof Node ? e.target : null;
      const target = eventElement(node);
      const root = bookRef.current;
      if (target?.closest('.course-quick-popup, .course-practice-popup, .course-flash-popup')) {
        return;
      }
      if (!node || !target || !root?.contains(node)) {
        dragSelRef.current = null;
        selectIslandRef.current = null;
        setSelRectsRef.current([]);
        setPicked('');
        return;
      }
      if (skipSel(target)) {
        dragSelRef.current = null;
        selectIslandRef.current = null;
        return;
      }
      if (e.pointerType === 'touch') return;
      const island = selectionIsland(target) || islandFromPoint(e.clientX, e.clientY, root);
      if (!island) {
        dragSelRef.current = null;
        selectIslandRef.current = null;
        setSelRectsRef.current([]);
        setPicked('');
        return;
      }
      const start = caretInIsland(island, e.clientX, e.clientY);
      selectIslandRef.current = island;
      dragSelRef.current = { island, start };
    };

    const onMove = (e: PointerEvent) => {
      const drag = dragSelRef.current;
      if (!drag || e.buttons !== 1) return;
      if (!bookRef.current?.contains(drag.island)) {
        dragSelRef.current = null;
        return;
      }
      e.preventDefault();
      applyCaretSelection(drag.start, caretInIsland(drag.island, e.clientX, e.clientY));
    };

    const onUp = () => {
      if (!dragSelRef.current) return;
      dragSelRef.current = null;
      publishSel();
    };

    const onDblClick = (e: MouseEvent) => {
      const node = e.target instanceof Node ? e.target : null;
      const target = eventElement(node);
      const root = bookRef.current;
      if (!node || !target || !root?.contains(node) || skipSel(target)) return;
      const island = selectionIsland(target) || islandFromPoint(e.clientX, e.clientY, root);
      if (!island) return;
      e.preventDefault();
      expandWordInIsland(island, e.clientX, e.clientY);
      paint();
      publishSel();
    };

    const onSelChange = () => {
      if (dragSelRef.current || holdSelectionRef.current) return;
      const text = selectedText();
      if (text.length >= 2) publishSel();
    };

    document.addEventListener('selectstart', onSelectStart, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('selectionchange', onSelChange);
    return () => {
      document.removeEventListener('selectstart', onSelectStart, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('dblclick', onDblClick, true);
      document.removeEventListener('selectionchange', onSelChange);
    };
  }, []);

  React.useEffect(() => {
    const phrase = restoreSelRef.current;
    if (!phrase) return;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        if (bookRef.current) {
          restorePhraseSelection(bookRef.current, phrase);
          setSelRectsRef.current(selectionPaintRects(bookRef.current));
        }
        lastSelection.current = phrase;
        setPicked(phrase);
        holdSelectionRef.current = false;
        restoreSelRef.current = null;
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [study.highlights]);

  React.useEffect(() => {
    setSelRects([]);
    setPicked('');
  }, [index]);

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
    setPracticeFullscreen(false);
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
  const markedPages = React.useMemo(
    () =>
      pages.map((pieces) =>
        applyHighlights(wrapPagePieces(pieces), [...study.highlights, ...searchMarks]),
      ),
    [pages, study.highlights, liveQuery],
  );
  markedPagesRef.current = markedPages;
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

  const toggleCovered = (item: { title: string; page: number }) => {
    const index = toc.findIndex((t) => tocCoverKey(t) === tocCoverKey(item));
    if (index < 0) return;
    const k = tocCoverKey(item);
    const descendants = tocDescendantKeys(toc, index);
    setCovered((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
        descendants.forEach((dk) => next.delete(dk));
      } else {
        next.add(k);
      }
      return next;
    });
  };

  React.useEffect(() => {
    setCovered(readCoveredSet(coveredKey));
  }, [coveredKey]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(coveredKey, JSON.stringify([...covered]));
    } catch {
      /* ignore */
    }
  }, [coveredKey, covered]);
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

  const notesPanelProps = chapterId
    ? {
        notes: study.notes,
        chapterTitle,
        pageNumber: printed,
        quote: noteQuote,
        onQuoteChange: setNoteQuote,
        onJumpPage: (page: number) => {
          goToPrinted(page);
          setNotesFullscreen(false);
          if (!wide) setSheetOpen(false);
        },
        onSave: async (content: string, quote?: string) => {
          const created = await addCourseNote(chapterId, content, printed, quote);
          loadStudy();
          return created;
        },
        onUpdate: async (id: number, content: string) => {
          await updateCourseNote(id, content);
        },
        onDelete: async (id: number) => {
          await deleteCourseNote(id);
          loadStudy();
        },
      }
    : null;

  const notesPanel = notesPanelProps ? (
    <CourseNotesPanel
      key={chapterId}
      {...notesPanelProps}
      onFullScreen={() => void openNotesFullscreen()}
    />
  ) : (
    <p className="course-notes-empty">Notes are available once this chapter is loaded.</p>
  );

  const addNoteFromSelection = () => {
    const text = (picked || lastSelection.current).trim();
    if (text.length >= 2) {
      holdSelectionRef.current = true;
      restoreSelRef.current = text;
      lastSelection.current = text;
      setPicked(text);
    }
    setNoteQuote(text);
    void openNotesFullscreen();
    window.requestAnimationFrame(() => {
      const phrase = restoreSelRef.current;
      if (phrase && bookRef.current) restorePhraseSelection(bookRef.current, phrase);
      holdSelectionRef.current = false;
      restoreSelRef.current = null;
    });
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
      holdSelectionRef.current = true;
      restoreSelRef.current = text;
      const same = study.highlights.filter((h) => highlightSame(h.text, text));
      await Promise.all(same.map((h) => deleteCourseHighlight(h.id)));
      await addCourseHighlight(chapterId, text, printed, color);
      lastSelection.current = text;
      setPicked(text);
      loadStudy();
    } catch {
      holdSelectionRef.current = false;
      restoreSelRef.current = null;
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
      holdSelectionRef.current = true;
      restoreSelRef.current = text;
      await Promise.all(matches.map((h) => deleteCourseHighlight(h.id)));
      lastSelection.current = text;
      setPicked(text);
      loadStudy();
    } catch {
      holdSelectionRef.current = false;
      restoreSelRef.current = null;
      alert('Could not remove highlight.');
    }
  };

  const atStart = spread ? spreadAt <= 0 : index <= 0;
  const atEnd = spread ? spreadAt >= spreads.length - 1 : index >= pages.length - 1;
  const bookReadRatio = pages.length > 1 ? index / (pages.length - 1) : 0;

  const turnByDelta = (delta: number) => {
    if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;
    if (Date.now() < pageTurnLockRef.current) return;
    goSpread(delta);
  };

  const pageFolds = (side?: 'verso' | 'recto') => (
    <>
      {!atStart && side !== 'recto' ? (
        <button
          type="button"
          className="course-page-fold is-prev"
          aria-label="Previous page"
          onClick={(e) => {
            e.stopPropagation();
            turnByDelta(-1);
          }}
        />
      ) : null}
      {!atEnd && side !== 'verso' ? (
        <button
          type="button"
          className="course-page-fold is-next"
          aria-label="Next page"
          onClick={(e) => {
            e.stopPropagation();
            turnByDelta(1);
          }}
        />
      ) : null}
    </>
  );

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
          {pageFolds(side)}
        </div>
      );
    }
    const html = markedPages[pageIndex] || '';
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
        {pageFolds(side)}
      </div>
    );
  };

  const viewSolo = flip ? flip.solo : !spread || soloLeaf;
  const viewLeft = flip
    ? flip.underLeft
    : spread
      ? (openSpread.left ?? openSpread.right ?? index)
      : index;
  const viewRight = flip ? flip.underRight : spread ? openSpread.right : null;

  const renderFlipFace = (pageIndex: number, face: 'front' | 'back') => {
    const html = markedPages[pageIndex] || '';
    const cover = isCoverHtml(html);
    return (
      <div
        className={`course-book-sheet is-${theme}${cover ? ' is-cover' : ''} course-book-flip-${face}`}
        style={{ fontSize: `${font}%` }}
      >
        {cover ? null : <div className="course-book-running">{header}</div>}
        {cover ? null : <div className="course-book-running-title">{chapterTitle}</div>}
        <div className="course-chapter course-book-body" dangerouslySetInnerHTML={{ __html: html }} />
        {cover ? null : <div className="course-book-folio">{printedFor(pageIndex)}</div>}
      </div>
    );
  };

  const captions = visiblePages.map(pageCaption);
  const pageMeta = spread
    ? captions.length > 1
      ? `${captions[0]}–${captions[captions.length - 1]}`
      : captions[0] || 'Cover'
    : pageCaption(toolPage);

  const progressPct = toc.length
    ? Math.round(((topicIndex + 1) / toc.length) * 100)
    : Math.round(((index + 1) / Math.max(pages.length, 1)) * 100);
  const dockMax = spread ? Math.max(0, spreads.length - 1) : Math.max(0, pages.length - 1);
  const dockValue = spread ? spreadAt : index;
  const openPanel = (id: typeof panel) => {
    setPanel(id);
    setMenuOpen(false);
    if (!shelf) setSheetOpen(true);
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

  return (
    <>
    <div
      className={`course-reader-workspace course-reader-with-notes${wide ? ' is-desktop' : tablet ? ' is-tablet' : ' is-compact'}${spread ? ' is-spread' : ''}${cssFullscreen ? ' is-book-fullscreen' : ''}`}
      style={{ ['--course-text-scale' as string]: String(font / 100) } as React.CSSProperties}
    >
      {layout === 'phone' ? (
        <header className="course-reader-toolbar">
          {closeHref ? (
            <Link href={closeHref} className="course-reader-close" aria-label="Back">
              <ReaderBackIcon />
            </Link>
          ) : null}
          <div className="course-reader-heading">
            <strong>{subjectTitle || chapterTitle}</strong>
            <small>{header}</small>
          </div>
          <button
            type="button"
            className="course-reader-menu-btn"
            aria-label={bookFullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={() => void toggleBookFullscreen()}
          >
            {bookFullscreen ? '✕' : '⛶'}
          </button>
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
      {shelf ? (
        <aside className="course-reader-rail is-toc">
          <div className="course-reader-heading is-rail">
            {closeHref ? (
              <Link href={closeHref} className="course-reader-close" aria-label="Back">
                <ReaderBackIcon />
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
              className={notesFullscreen ? 'is-on' : ''}
              onClick={() => void openNotesFullscreen()}
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
                                <span className="course-toc-chapter-index">{i + 1}</span>
                                <span>{ch.title}</span>
                              </Link>
                            ) : (
                              <span className="course-toc-chapter-link">
                                <span className="course-toc-chapter-index">{i + 1}</span>
                                <span>{ch.title}</span>
                              </span>
                            )}
                            {current
                              ? toc.map((item, ti) => (
                                  <TocTopicRow
                                    key={`${item.page}-${ti}`}
                                    item={item}
                                    current={item.page === printed}
                                    done={covered.has(tocCoverKey(item))}
                                    onOpen={() => {
                                      setPracticeFullscreen(false);
                                      setIndex(indexFromPrinted(item.page));
                                    }}
                                    onToggleCovered={() => toggleCovered(item)}
                                  />
                                ))
                              : null}
                          </div>
                        );
                      })
                    : toc.map((item, i) => (
                        <TocTopicRow
                          key={`${item.page}-${i}`}
                          item={item}
                          current={item.page === printed}
                          done={covered.has(tocCoverKey(item))}
                          onOpen={() => {
                            setPracticeFullscreen(false);
                            setIndex(indexFromPrinted(item.page));
                          }}
                          onToggleCovered={() => toggleCovered(item)}
                        />
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
      <div className="course-book-stage" ref={stageRef}>
        {bookFullscreen ? (
          <button
            type="button"
            className="course-book-fs-exit"
            aria-label="Exit full screen"
            onClick={() => void exitBookFullscreen()}
          >
            Exit full screen
          </button>
        ) : null}
        <div className="course-book-slot" ref={slotRef}>
          <div
            ref={bookRef}
            className={`course-book is-a4${spread ? ' is-spread' : ''}${!spread || soloLeaf ? ' is-solo' : ''}`}
            style={
              {
                ['--course-img-max' as string]: `${imgMax}px`,
                ['--course-book-w' as string]: `${visualBookW}px`,
              } as React.CSSProperties
            }
          >
            <button
              type="button"
              className="course-book-turn is-prev"
              aria-label="Previous page"
              disabled={atStart}
              onClick={(e) => {
                e.stopPropagation();
                turnByDelta(-1);
              }}
            />
            <button
              type="button"
              className="course-book-turn is-next"
              aria-label="Next page"
              disabled={atEnd}
              onClick={(e) => {
                e.stopPropagation();
                turnByDelta(1);
              }}
            />
            <div className="course-book-scale-frame" style={{ width: visualBookW, height: visualBookH }}>
            <div
              className="course-book-scale"
              style={{
                width: layoutBookW,
                height: a4.h,
                transform: pageScale === 1 ? undefined : `scale(${pageScale})`,
                transformOrigin: 'top left',
              }}
            >
            <div
              className={`course-book-volume${viewSolo ? ' is-solo' : ' is-open'}${coverSrc ? ' is-cover-front' : ''}${flip ? ` is-flipping ${flip.dir === 1 ? 'is-next' : 'is-prev'}` : ''}`}
              style={
                {
                  ['--book-read' as string]: `${(3 + bookReadRatio * 10).toFixed(1)}px`,
                  ['--book-unread' as string]: coverSrc
                    ? '14px'
                    : `${(3 + (1 - bookReadRatio) * 10).toFixed(1)}px`,
                } as React.CSSProperties
              }
            >
              <span className="course-book-cover-board" aria-hidden />
              <span className="course-book-spine" aria-hidden />
              <span className="course-book-binding" aria-hidden />
              <span className="course-book-edges is-read" aria-hidden />
              <span className="course-book-edges is-unread" aria-hidden />
              {spread && !viewSolo ? (
                <div className="course-book-open" style={{ width: a4.w * 2 + 14, height: a4.h }}>
                  {renderSheet(viewLeft, 'verso')}
                  <div className="course-book-gutter" aria-hidden />
                  {renderSheet(viewRight, 'recto')}
                </div>
              ) : (
                <div className="course-book-solo" style={{ width: a4.w, height: a4.h }}>
                  {renderSheet(viewLeft)}
                </div>
              )}
              {flip ? (
                <div
                  className={`course-book-flip ${flip.dir === 1 ? 'is-next' : 'is-prev'}${
                    flip.solo ? ' is-solo-flip' : ''
                  }${isCoverHtml(markedPages[flip.frontIndex] || '') ? ' is-cover' : ''}`}
                  aria-hidden="true"
                >
                  {renderFlipFace(flip.frontIndex, 'front')}
                  {renderFlipFace(flip.backIndex, 'back')}
                </div>
              ) : null}
            </div>
            </div>
            </div>
            {selRects.length ? (
              <div className="course-sel-paint-layer" aria-hidden="true">
                {selRects.map((box, i) => (
                  <i
                    key={`${box.left}-${box.top}-${box.width}-${i}`}
                    className="course-sel-paint"
                    style={{
                      left: box.left,
                      top: box.top,
                      width: box.width,
                      height: box.height,
                    }}
                  />
                ))}
              </div>
            ) : null}
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
        {practiceFullscreen ? (
          <div
            className="course-practice-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-practice-overlay-title"
          >
            <button
              type="button"
              className="course-practice-popup-backdrop"
              aria-label="Close practice"
              onClick={() => setPracticeFullscreen(false)}
            />
            <div className="course-practice-popup-card">
              <button
                type="button"
                className="course-practice-popup-close"
                aria-label="Close practice"
                onClick={() => setPracticeFullscreen(false)}
              >
                ×
              </button>
              <CoursePracticeQuiz
                activity={practiceActivity}
                chapterId={chapterId}
                chapterTitle={chapterTitle}
                subjectTitle={subjectTitle}
                kicker={header ? `${header.split('·')[0].trim()} · ${chapterTitle}` : chapterTitle}
                closeLabel="Close"
                embedded
                onClose={() => setPracticeFullscreen(false)}
              />
            </div>
          </div>
        ) : null}
        {flashDeckOpen ? (
          <div
            className="course-practice-popup course-flash-deck-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Flashcards"
          >
            <button
              type="button"
              className="course-practice-popup-backdrop"
              aria-label="Close flashcards"
              onClick={() => setFlashDeckOpen(false)}
            />
            <div className="course-practice-popup-card course-flash-deck-popup-card">
              <button
                type="button"
                className="course-practice-popup-close"
                aria-label="Close flashcards"
                onClick={() => setFlashDeckOpen(false)}
              >
                ×
              </button>
              <CourseFlashcards
                cards={chapterFlashcards}
                onDelete={
                  chapterId
                    ? async (id) => {
                        await deleteCourseFlashcard(id);
                        loadStudy();
                      }
                    : undefined
                }
              />
            </div>
          </div>
        ) : null}
        {openFlash ? (
          <div
            className="course-practice-popup course-flash-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Flashcard"
          >
            <button
              type="button"
              className="course-practice-popup-backdrop"
              aria-label="Close flashcard"
              onClick={() => {
                setOpenFlash(null);
                setFlashFlipped(false);
                setFlashEntering(false);
              }}
            />
            <div className="course-flash-popup-stage">
              <button
                type="button"
                className="course-practice-popup-close"
                aria-label="Close flashcard"
                onClick={() => {
                  setOpenFlash(null);
                  setFlashFlipped(false);
                  setFlashEntering(false);
                }}
              >
                ×
              </button>
              <p className="course-flash-popup-kicker">Flashcard</p>
              <button
                type="button"
                className={`course-flash-3d${flashEntering ? ' is-enter' : ''}${flashFlipped ? ' is-flipped' : ''}`}
                aria-pressed={flashFlipped}
                onClick={() => {
                  if (flashEntering) return;
                  setFlashFlipped((v) => !v);
                }}
              >
                <span className="course-flash-3d-inner">
                  <span className="course-flash-3d-face is-front">
                    <small>Term</small>
                    <strong>{openFlash.front}</strong>
                    <em>Tap to see answer</em>
                  </span>
                  <span className="course-flash-3d-face is-back">
                    <small>Answer</small>
                    <strong>{openFlash.back}</strong>
                    <em>Tap to see term</em>
                  </span>
                </span>
              </button>
            </div>
          </div>
        ) : null}
        {openQuick ? (
          <div
            className="course-practice-popup course-quick-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Quiz"
          >
            <button
              type="button"
              className="course-practice-popup-backdrop"
              aria-label="Close quiz"
              onClick={() => setOpenQuick(null)}
            />
            <div className="course-practice-popup-card course-quick-popup-card">
              <button
                type="button"
                className="course-practice-popup-close"
                aria-label="Close quiz"
                onClick={() => setOpenQuick(null)}
              >
                ×
              </button>
              {openQuick.items.length > 1 ? (
                <p className="course-quick-popup-kicker">
                  Quiz {openQuick.index + 1} of {openQuick.items.length}
                </p>
              ) : null}
              <CourseQuizPrompt
                html={openQuick.items[openQuick.index]?.html || ''}
                fallbackAnswer={openQuick.items[openQuick.index]?.answer ?? 0}
                picked={
                  openQuick.items[openQuick.index]?.checked
                    ? Number(openQuick.items[openQuick.index]?.picked)
                    : null
                }
                onPick={(choice) => {
                  const current = openQuick.items[openQuick.index];
                  if (!current || current.checked) return;
                  const id = current.id;
                  if (id && bookRef.current) {
                    bookRef.current
                      .querySelectorAll(`.course-quick-block[data-quick-id="${id}"]`)
                      .forEach((src) => {
                        src.classList.add('is-checked');
                        src.setAttribute('data-picked', String(choice));
                      });
                  }
                  setOpenQuick((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      items: prev.items.map((item) =>
                        item.id === id ? { ...item, checked: true, picked: String(choice) } : item,
                      ),
                    };
                  });
                }}
              />
              {openQuick.items.length > 1 ? (
                <div className="course-quick-nav">
                  <button
                    type="button"
                    className="is-prev"
                    disabled={openQuick.index <= 0}
                    onClick={() =>
                      setOpenQuick((prev) =>
                        prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev,
                      )
                    }
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="is-next"
                    disabled={openQuick.index >= openQuick.items.length - 1}
                    onClick={() =>
                      setOpenQuick((prev) =>
                        prev && prev.index < prev.items.length - 1
                          ? { ...prev, index: prev.index + 1 }
                          : prev,
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {chapterId ? (
        <aside
          className={`course-notes-section course-reader-rail is-tools${wide || tablet || sheetOpen ? ' is-open' : ''}`}
          id="course-notes"
        >
          {layout === 'phone' ? (
            <button
              type="button"
              className="course-reader-sheet-close"
              aria-label="Back"
              onClick={() => setSheetOpen(false)}
            >
              <ReaderBackIcon />
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
          {shelf ? (
            <div className="course-page-view-row" aria-label="Page view">
              <button
                type="button"
                className={wantSpread ? 'is-on' : ''}
                onClick={() => {
                  setPracticeFullscreen(false);
                  setWantSpread(true);
                }}
              >
                Open book
              </button>
              <button
                type="button"
                className={!wantSpread && !practiceFullscreen ? 'is-on' : ''}
                onClick={() => {
                  setPracticeFullscreen(false);
                  setWantSpread(false);
                }}
              >
                One page
              </button>
              <button
                type="button"
                className={bookFullscreen ? 'is-on' : ''}
                onClick={() => void toggleBookFullscreen()}
              >
                {bookFullscreen ? 'Exit full screen' : 'Full screen'}
              </button>
            </div>
          ) : null}
          <div className="course-study-tools">
            <h2>Study Tools</h2>
            {!shelf ? (
              <button
                type="button"
                className={panel === 'contents' ? 'is-on' : ''}
                onClick={() => openPanel('contents')}
              >
                Contents
              </button>
            ) : null}
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
            <button
              type="button"
              className={flashDeckOpen ? 'is-on' : ''}
              onClick={() => {
                if (flashDeckOpen) setFlashDeckOpen(false);
                else openFlashDeck();
              }}
            >
              Flashcards
            </button>
            {!shelf && chapterId ? (
              <button
                type="button"
                className={notesFullscreen ? 'is-on' : ''}
                onClick={() => void openNotesFullscreen()}
              >
                Notes
              </button>
            ) : null}
            {chapterId || practiceActivity || practiceHref || quickChecks.length ? (
              <button
                type="button"
                className={`course-study-practice${practiceFullscreen ? ' is-on' : ''}`}
                onClick={() => {
                  if (practiceFullscreen) setPracticeFullscreen(false);
                  else openPracticePopup();
                }}
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
                        ...(!shelf ? [['contents', 'Contents'] as [typeof panel, string]] : []),
                        ...(!shelf ? [['notes', 'Notes'] as [typeof panel, string]] : []),
                        ['search', 'Search'],
                        ['highlights', 'Highlights'],
                        ...(!shelf ? [['bookmarks', 'Bookmarks'] as [typeof panel, string]] : []),
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
                                <TocTopicRow
                                  key={`${item.page}-${ti}`}
                                  item={item}
                                  current={item.page === printed}
                                  done={covered.has(tocCoverKey(item))}
                                  onOpen={() => {
                                    setPracticeFullscreen(false);
                                    setIndex(indexFromPrinted(item.page));
                                    setSheetOpen(false);
                                  }}
                                  onToggleCovered={() => toggleCovered(item)}
                                />
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
                      <TocTopicRow
                        key={`${item.page}-${i}`}
                        item={item}
                        current={item.page === printed}
                        done={covered.has(tocCoverKey(item))}
                        onOpen={() => {
                          setPracticeFullscreen(false);
                          setIndex(indexFromPrinted(item.page));
                        }}
                        onToggleCovered={() => toggleCovered(item)}
                      />
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
                <p className="course-notes-kicker">View</p>
                <div className="course-theme-row">
                  <button
                    type="button"
                    className={bookFullscreen ? 'is-on' : ''}
                    onClick={() => void toggleBookFullscreen()}
                  >
                    {bookFullscreen ? 'Exit full screen' : 'Full screen'}
                  </button>
                </div>
              </>
            ) : null}
            {panel === 'bookmarks' && !shelf ? (
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
            {panel === 'notes' && !shelf ? (
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
                  <TocTopicRow
                    key={`${item.page}-${i}`}
                    item={item}
                    current={i === topicIndex}
                    done={covered.has(tocCoverKey(item))}
                    onOpen={() => {
                      setPracticeFullscreen(false);
                      setIndex(indexFromPrinted(item.page));
                    }}
                    onToggleCovered={() => toggleCovered(item)}
                  />
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
      {layout === 'phone' && sheetOpen ? (
        <button
          type="button"
          className="course-reader-sheet-mask"
          aria-label="Close panel"
          onClick={() => setSheetOpen(false)}
        />
      ) : null}
      <footer className="course-reader-dock">
        <button
          type="button"
          className="course-dock-turn"
          aria-label="Previous page"
          disabled={atStart}
          onClick={() => turnByDelta(-1)}
        >
          ‹
        </button>
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
        <button
          type="button"
          className="course-dock-turn"
          aria-label="Next page"
          disabled={atEnd}
          onClick={() => turnByDelta(1)}
        >
          ›
        </button>
      </footer>
    </div>
    {notesFullscreen ? (
      <div
        className="course-notes-overlay onenote-read-notes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-notes-overlay-title"
      >
        <NotesWorkspace
          initialBookKey={bookKey || ''}
          initialChapterSlug={chapterSlug}
          onClose={(nextBookKey, nextChapterSlug) => {
            setNotesFullscreen(false);
            if (nextChapterSlug && nextChapterSlug !== chapterSlug && readBase) {
              window.location.href = `${readBase}/read?chapter=${encodeURIComponent(nextChapterSlug)}`;
            }
          }}
        />
      </div>
    ) : null}
    </>
  );
}
