'use client';

import React from 'react';
import {
  applyHighlights,
  blocksFromHtml,
  courseSpreads,
  HIGHLIGHTER_COLORS,
  highlightOverlaps,
  highlightSame,
  paginateByMeasure,
  selectedText,
  spreadIndexFor,
  tocFromPages,
} from '../lib/courseBookEngine';
import { jsonToHtml, type TextbookDoc } from '../lib/textbookContent';

const OPEN_BOOK_MIN_WIDTH = 760;

type LocalHighlight = { id: number; text: string; color: string };

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

function useA4PageSize(
  slot: React.RefObject<HTMLElement | null>,
  leaves: 1 | 2,
  fit: 'page' | 'modal',
  ready: boolean,
) {
  const [size, setSize] = React.useState({ w: 420, h: 594 });
  React.useEffect(() => {
    if (!ready) return;
    const update = () => {
      const chrome = fit === 'modal' ? 170 : 300;
      const maxH = Math.min(Math.max(280, window.innerHeight - chrome), 820);
      const maxW = Math.max(240, (slot.current?.clientWidth || window.innerWidth - 280) - 4);
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
    const el = slot.current;
    const ro = el ? new ResizeObserver(update) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [leaves, slot, fit, ready]);
  return size;
}

export default function ChapterBookPreview({
  doc,
  header = 'Chapter',
  chapterTitle,
  startPage = 1,
  fit = 'page',
  frontCoverUrl,
  backCoverUrl,
}: {
  doc: TextbookDoc;
  header?: string;
  chapterTitle?: string;
  startPage?: number;
  fit?: 'page' | 'modal';
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
}) {
  const html = jsonToHtml(doc);
  const title = chapterTitle || doc.chapter.title || 'Chapter';
  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const bookRef = React.useRef<HTMLDivElement | null>(null);
  const lastSelection = React.useRef('');
  const htmlRef = React.useRef<string | null>(null);
  const explainAnchor = React.useRef<string | null>(null);
  const nextMarkId = React.useRef(1);

  const [index, setIndex] = React.useState(0);
  const [pages, setPages] = React.useState<string[][]>([['<p>Loading…</p>']]);
  const [wide, setWide] = React.useState(true);
  const [toolIndex, setToolIndex] = React.useState(0);
  const [picked, setPicked] = React.useState('');
  const [ink, setInk] = React.useState(HIGHLIGHTER_COLORS[0]);
  const [highlights, setHighlights] = React.useState<LocalHighlight[]>([]);
  const [openExplains, setOpenExplains] = React.useState<string[]>([]);

  React.useEffect(() => {
    const update = () => {
      const w = slotRef.current?.clientWidth || window.innerWidth;
      setWide(w >= OPEN_BOOK_MIN_WIDTH);
    };
    update();
    const el = slotRef.current;
    const ro = el ? new ResizeObserver(update) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [html]);

  const spread = wide;
  const spreads = React.useMemo(() => courseSpreads(pages.length), [pages.length]);
  const spreadAt = spreadIndexFor(spreads, index);
  const openSpread = spread
    ? spreads[spreadAt] || { left: index, right: null }
    : { left: index, right: null };
  const soloLeaf = !spread || openSpread.left == null || openSpread.right == null;
  const a4 = useA4PageSize(slotRef, spread && !soloLeaf ? 2 : 1, fit, Boolean(html));
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
    const pageW = spread ? a4.w : Math.min(a4.w, 720);
    const pageH = spread ? a4.h : Math.min(a4.h, 860);
    const htmlChanged = htmlRef.current !== html;
    htmlRef.current = html;
    paginateByMeasure(blocksFromHtml(html), {
      width: pageW,
      height: pageH,
      font: 100,
      theme: 'paper',
      openIds: openExplains,
      header,
      chapterTitle: title,
      a4: spread,
      imgMax,
    }).then((pagesHtml) => {
      if (cancelled) return;
      const next = withCoverPages(pagesHtml, frontCoverUrl || null, backCoverUrl || null);
      setPages(next);
      const anchor = explainAnchor.current;
      explainAnchor.current = null;
      setIndex((i) => {
        if (anchor) {
          const found = next.findIndex((page) =>
            page.some((item) => item.includes(`data-explain-id="${anchor}"`)),
          );
          if (found >= 0) return found;
        }
        const raw = htmlChanged ? 0 : i;
        return Math.min(Math.max(0, raw), Math.max(0, next.length - 1));
      });
      setToolIndex((i) => Math.min(Math.max(0, i), Math.max(0, next.length - 1)));
    });
    return () => {
      cancelled = true;
    };
  }, [html, a4.w, a4.h, openExplains, spread, header, title, imgMax, frontCoverUrl, backCoverUrl]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
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
        const chosen = Number(opt.getAttribute('data-opt'));
        const answer = Number(quiz.getAttribute('data-answer'));
        quiz.classList.add('is-checked');
        quiz.querySelectorAll('[data-opt]').forEach((btn) => {
          const i = Number(btn.getAttribute('data-opt'));
          btn.classList.toggle('is-on', i === chosen);
          btn.classList.toggle('is-right', i === answer);
          btn.classList.toggle('is-wrong', i === chosen && i !== answer);
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
      if (pageEl && bookRef.current?.contains(pageEl)) {
        const next = Number(pageEl.getAttribute('data-course-page'));
        if (Number.isFinite(next)) setToolIndex(next);
      } else if (text.length >= 2 && !bookRef.current?.contains(el || null)) {
        return;
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
  const pageCaption = (pageIndex: number) => {
    const pageHtml = pages[pageIndex]?.join('') || '';
    if (isCoverHtml(pageHtml)) return frontCoverUrl && pageIndex === 0 ? 'Cover' : 'Back';
    return String(startPage + pageIndex - coverShift);
  };
  const visiblePages = [openSpread.left, openSpread.right].filter((v): v is number => v != null);
  const toc = tocFromPages(
    pages.filter((page) => !isCoverHtml(page.join(''))),
    startPage,
  );
  const printed =
    startPage + Math.min(Math.max(0, toolIndex), Math.max(0, pages.length - 1)) - coverShift;
  const topicIndex = toc.reduce((best, item, i) => (item.page <= printed ? i : best), 0);
  const topicLabel = toc.length ? `Topic ${topicIndex + 1} of ${toc.length}` : '';
  const captions = visiblePages.map(pageCaption);
  const pageMeta = spread
    ? captions.length > 1
      ? `${captions[0]}–${captions[1]}`
      : captions[0] || 'Cover'
    : pageCaption(Math.min(Math.max(0, toolIndex), Math.max(0, pages.length - 1)));
  const canRemove = picked.length >= 2 && highlights.some((h) => highlightOverlaps(h.text, picked));
  const atStart = spread ? spreadAt <= 0 : index <= 0;
  const atEnd = spread ? spreadAt >= spreads.length - 1 : index >= pages.length - 1;

  const markedPage = (pageIndex: number) =>
    applyHighlights(pages[pageIndex]?.join('') || '', highlights);

  const highlightSelection = (color = ink) => {
    const text = (picked || lastSelection.current).trim();
    if (text.length < 2) return;
    setHighlights((items) => {
      const kept = items.filter((h) => !highlightSame(h.text, text));
      return [...kept, { id: nextMarkId.current++, text, color }];
    });
    window.getSelection()?.removeAllRanges();
    lastSelection.current = '';
    setPicked('');
  };

  const removeHighlights = () => {
    const text = (picked || lastSelection.current).trim();
    if (text.length < 2) return;
    setHighlights((items) => items.filter((h) => !highlightOverlaps(h.text, text)));
    window.getSelection()?.removeAllRanges();
    lastSelection.current = '';
    setPicked('');
  };

  const renderSheet = (pageIndex: number | null, side?: 'verso' | 'recto') => {
    const sideClass = side ? ` is-${side}` : '';
    if (pageIndex == null) {
      return (
        <div className={`course-book-sheet is-paper${sideClass} is-blank`}>
          <div className="course-book-running">{header}</div>
          <div className="course-book-running-title">{title}</div>
          <div className="course-book-body" />
        </div>
      );
    }
    const pageHtml = markedPage(pageIndex);
    const cover = isCoverHtml(pageHtml);
    return (
      <div
        className={`course-book-sheet is-paper${sideClass}${cover ? ' is-cover' : ''}`}
        data-course-page={pageIndex}
      >
        <div className="course-book-running">{header}</div>
        <div className="course-book-running-title">{title}</div>
        <div
          className="course-chapter course-book-body"
          data-course-page={pageIndex}
          dangerouslySetInnerHTML={{ __html: pageHtml }}
        />
        <div className="course-book-folio">{startPage + pageIndex - coverShift}</div>
      </div>
    );
  };

  if (!html) return <p className="vv-hint">Nothing to preview yet. Add content, then preview.</p>;

  return (
    <div className="vv-book-stage">
      <button
        type="button"
        className="vv-book-side-btn is-prev"
        disabled={atStart}
        aria-label="Previous pages"
        onClick={() => goSpread(-1)}
      >
        <span>←</span>
        Previous
      </button>
      <div className="vv-book-slot" ref={slotRef}>
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
            <div className="course-book-solo" style={{ width: a4.w, height: a4.h }}>
              {renderSheet(index)}
            </div>
          )}
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
              </>
            ) : (
              <p className="course-highlight-hint">Select text, then tap a color.</p>
            )}
            <div className="course-book-page-meta">
              <span>
                {spread ? `${pageMeta} · ${pages.length} pages` : `${index + 1} / ${pages.length}`}
              </span>
              {topicLabel ? <small>{topicLabel}</small> : null}
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="vv-book-side-btn is-next"
        disabled={atEnd}
        aria-label="Next pages"
        onClick={() => goSpread(1)}
      >
        <span>→</span>
        Next
      </button>
    </div>
  );
}
