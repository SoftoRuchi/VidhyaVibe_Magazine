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

export function isCoverHtml(html: string) {
  return /course-book-cover/.test(html);
}

export function collapseQuickBlocks(html: string) {
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
  return wrap.innerHTML;
}

export function wrapPagePieces(pieces: string[]) {
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
