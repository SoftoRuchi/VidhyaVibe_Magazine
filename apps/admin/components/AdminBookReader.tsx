'use client';

import {
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  LeftOutlined,
  MenuOutlined,
  RightOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Empty, Select, Spin, Tag, Tooltip, message } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import api from '../lib/api';
import {
  applyHighlights,
  blocksFromHtml,
  courseSpreads,
  HIGHLIGHTER_COLORS,
  highlightOverlaps,
  highlightSame,
  isCoverHtml,
  paginateByMeasure,
  selectedText,
  spreadIndexFor,
  tocFromPages,
  wrapPagePieces,
} from '../lib/courseBookEngine';
import { asDoc, jsonToHtml, type TextbookDoc } from '../lib/textbookContent';

const OPEN_BOOK_MIN_WIDTH = 780;

type LocalHighlight = { id: number; text: string; color: string };

type ChapterSummary = {
  id: number;
  title: string;
  slug: string;
  sortOrder: number;
  startPage?: number | null;
  endPage?: number | null;
  activityCount?: number;
};

type SubjectDetails = {
  id: number;
  name: string;
  slug: string;
  syllabusCode?: string | null;
  description?: string | null;
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
  status: string;
  course: {
    id: number;
    name: string;
    slug: string;
    university?: string | null;
  };
  semester: {
    id: number;
    number: number;
    title: string;
  };
  chapters: ChapterSummary[];
};

type ChapterFull = {
  id: number;
  title: string;
  slug: string;
  startPage?: number | null;
  endPage?: number | null;
  content?: string | null;
  contentFormat?: string;
  contentJson?: any;
  subjectId: number;
  subjectName: string;
  courseId: number;
  courseName: string;
  semesterTitle: string;
  semesterNumber: number;
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
};

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

function useBookPageSize(
  slot: React.RefObject<HTMLElement | null>,
  leaves: 1 | 2,
) {
  const [size, setSize] = React.useState({ w: 480, h: 680 });
  React.useEffect(() => {
    const measure = () => {
      const el = slot.current;
      const slotH = el?.clientHeight || 0;
      const slotW = el?.clientWidth || 0;
      const cs = el ? getComputedStyle(el) : null;
      const padX = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0;
      const contentW = Math.max(0, slotW - padX);
      const maxH = Math.max(280, slotH || Math.round(window.innerHeight * 0.76));
      const maxW = Math.max(
        240,
        contentW || Math.min(window.innerWidth - 120, 1400),
      );
      const gutter = leaves === 2 ? 14 : 0;
      const maxLeaf = leaves === 2 ? 680 : 720;
      let width = (maxW - gutter) / leaves;
      if (width > maxLeaf) width = maxLeaf;
      return { w: Math.round(Math.max(80, width)), h: Math.round(maxH) };
    };
    const update = () => {
      const next = measure();
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
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

export default function AdminBookReader({
  subjectId,
  initialChapterId,
  backHref = '/admin/books',
  backLabel = 'Back to Books',
}: {
  subjectId: number;
  initialChapterId?: number;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();

  // Subject and Chapter state
  const [subject, setSubject] = React.useState<SubjectDetails | null>(null);
  const [loadingSubject, setLoadingSubject] = React.useState(true);
  const [currentChapterId, setCurrentChapterId] = React.useState<number | null>(
    initialChapterId || null,
  );
  const [chapter, setChapter] = React.useState<ChapterFull | null>(null);
  const [loadingChapter, setLoadingChapter] = React.useState(false);

  // Reader configuration state
  const [theme, setTheme] = React.useState<'paper' | 'clean' | 'sepia' | 'night'>('paper');
  const [fontZoom, setFontZoom] = React.useState(100);
  const [forceSinglePage, setForceSinglePage] = React.useState(false);
  const [tocOpen, setTocOpen] = React.useState(false);

  // Pagination & book view state
  const [index, setIndex] = React.useState(0);
  const [pages, setPages] = React.useState<string[][]>([['<p>Loading…</p>']]);
  const [wide, setWide] = React.useState(true);
  const [toolIndex, setToolIndex] = React.useState(0);
  const [picked, setPicked] = React.useState('');
  const [ink, setInk] = React.useState(HIGHLIGHTER_COLORS[0]);
  const [highlights, setHighlights] = React.useState<LocalHighlight[]>([]);
  const [openExplains, setOpenExplains] = React.useState<string[]>([]);

  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const bookRef = React.useRef<HTMLDivElement | null>(null);
  const lastSelection = React.useRef('');
  const htmlRef = React.useRef<string | null>(null);
  const explainAnchor = React.useRef<string | null>(null);
  const nextMarkId = React.useRef(1);

  // Load subject
  React.useEffect(() => {
    let cancelled = false;
    setLoadingSubject(true);
    api
      .get(`/admin/courses/subjects/${subjectId}`)
      .then((res) => {
        if (cancelled) return;
        const sub: SubjectDetails = res.data;
        setSubject(sub);
        if (!currentChapterId && sub.chapters?.length) {
          setCurrentChapterId(sub.chapters[0].id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load subject', err);
        message.error('Failed to load book details');
      })
      .finally(() => {
        if (!cancelled) setLoadingSubject(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  // Load active chapter
  React.useEffect(() => {
    if (!currentChapterId) return;
    let cancelled = false;
    setLoadingChapter(true);
    api
      .get(`/admin/courses/chapters/${currentChapterId}`)
      .then((res) => {
        if (cancelled) return;
        setChapter(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load chapter', err);
        message.error('Failed to load chapter content');
      })
      .finally(() => {
        if (!cancelled) setLoadingChapter(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentChapterId]);

  // Convert chapter content to HTML
  const chapterDoc: TextbookDoc | null = React.useMemo(() => {
    if (!chapter) return null;
    return asDoc(chapter.contentJson, {
      id: String(chapter.id),
      title: chapter.title,
      html: chapter.content || '',
    });
  }, [chapter]);

  const htmlContent = React.useMemo(() => {
    if (!chapterDoc) return chapter?.content || '';
    return jsonToHtml(chapterDoc);
  }, [chapterDoc, chapter?.content]);

  // Responsive width detection
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
  }, []);

  const spread = wide && !forceSinglePage;
  const spreads = React.useMemo(() => courseSpreads(pages.length), [pages.length]);
  const spreadAt = spreadIndexFor(spreads, index);
  const openSpread = spread
    ? spreads[spreadAt] || { left: index, right: null }
    : { left: index, right: null };
  const soloLeaf = !spread || openSpread.left == null || openSpread.right == null;
  const a4 = useBookPageSize(slotRef, spread && !soloLeaf ? 2 : 1);
  const imgMax = Math.max(120, Math.round(a4.h * 0.28));
  const bookReadRatio =
    pages.length > 1 ? Math.min(1, Math.max(0, index / (pages.length - 1))) : 0;

  // Navigation handlers
  const chapters = subject?.chapters || [];
  const currentChapterIdx = chapters.findIndex((c) => c.id === currentChapterId);
  const prevChapter = currentChapterIdx > 0 ? chapters[currentChapterIdx - 1] : null;
  const nextChapter =
    currentChapterIdx >= 0 && currentChapterIdx < chapters.length - 1
      ? chapters[currentChapterIdx + 1]
      : null;

  const goToChapter = (chId: number) => {
    if (chId === currentChapterId) return;
    setCurrentChapterId(chId);
    setIndex(0);
    setToolIndex(0);
    setTocOpen(false);
  };

  const goSpread = React.useCallback(
    (delta: number) => {
      if (!spread) {
        const next = index + delta;
        if (next < 0 && prevChapter) {
          goToChapter(prevChapter.id);
          return;
        }
        if (next >= pages.length && nextChapter) {
          goToChapter(nextChapter.id);
          return;
        }
        setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + delta)));
        return;
      }
      const nextAt = spreadAt + delta;
      if (nextAt < 0 && prevChapter) {
        goToChapter(prevChapter.id);
        return;
      }
      if (nextAt >= spreads.length && nextChapter) {
        goToChapter(nextChapter.id);
        return;
      }
      const targetAt = Math.min(spreads.length - 1, Math.max(0, nextAt));
      const next = spreads[targetAt];
      const target = next?.left ?? next?.right ?? 0;
      setIndex(target);
      setToolIndex(target);
    },
    [spread, spreadAt, spreads, pages.length, index, prevChapter, nextChapter],
  );

  // Paginate content
  const headerText = subject
    ? `${subject.course.name} · ${subject.semester.title}`
    : chapter
      ? `${chapter.courseName} · ${chapter.semesterTitle}`
      : 'VidhyaVibe Reader';

  const chapterTitleText = chapter?.title || 'Chapter';
  const startPageNum = chapter?.startPage || 1;
  const frontCoverUrl = subject?.frontCoverUrl || chapter?.frontCoverUrl;
  const backCoverUrl = subject?.backCoverUrl || chapter?.backCoverUrl;

  React.useEffect(() => {
    let cancelled = false;
    const pageW = spread ? a4.w : Math.min(a4.w, 720);
    const pageH = spread ? a4.h : Math.min(a4.h, 860);
    const htmlChanged = htmlRef.current !== htmlContent;
    htmlRef.current = htmlContent;

    if (!htmlContent) {
      setPages([['<p className="vv-hint">This chapter has no text yet.</p>']]);
      return;
    }

    paginateByMeasure(blocksFromHtml(htmlContent), {
      width: pageW,
      height: pageH,
      font: fontZoom,
      theme,
      openIds: openExplains,
      header: headerText,
      chapterTitle: chapterTitleText,
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
  }, [
    htmlContent,
    a4.w,
    a4.h,
    fontZoom,
    theme,
    openExplains,
    spread,
    headerText,
    chapterTitleText,
    imgMax,
    frontCoverUrl,
    backCoverUrl,
  ]);

  // Keyboard navigation
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goSpread(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goSpread(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goSpread]);

  // Interactive widgets (flashcards, quick quizzes, explains)
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      // Flashcards
      const flash = target?.closest?.('.course-flash') as HTMLElement | null;
      if (flash && bookRef.current?.contains(flash)) {
        e.preventDefault();
        e.stopPropagation();
        flash.classList.toggle('is-flipped');
        return;
      }

      // Quick quiz options
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

      // Expandable explanations
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

  // Text selection & highlights
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

  const coverShift = frontCoverUrl ? 1 : 0;
  const pageCaption = (pageIndex: number) => {
    const pageHtml = pages[pageIndex]?.join('') || '';
    if (isCoverHtml(pageHtml)) return frontCoverUrl && pageIndex === 0 ? 'Cover' : 'Back';
    return String(startPageNum + pageIndex - coverShift);
  };

  const visiblePages = [openSpread.left, openSpread.right].filter((v): v is number => v != null);
  const captions = visiblePages.map(pageCaption);
  const pageMeta = spread
    ? captions.length > 1
      ? `${captions[0]}–${captions[1]}`
      : captions[0] || 'Cover'
    : pageCaption(Math.min(Math.max(0, toolIndex), Math.max(0, pages.length - 1)));

  const atStart = (spread ? spreadAt <= 0 : index <= 0) && !prevChapter;
  const atEnd = (spread ? spreadAt >= spreads.length - 1 : index >= pages.length - 1) && !nextChapter;
  const canRemove = picked.length >= 2 && highlights.some((h) => highlightOverlaps(h.text, picked));

  const toc = React.useMemo(
    () =>
      tocFromPages(
        pages.filter((page) => !isCoverHtml(page.join(''))),
        startPageNum,
      ),
    [pages, startPageNum],
  );

  const markedPages = React.useMemo(
    () =>
      pages.map((pieces) =>
        applyHighlights(wrapPagePieces(pieces), highlights),
      ),
    [pages, highlights],
  );

  const pageFolds = (side?: 'verso' | 'recto') => (
    <>
      {!atStart && side !== 'recto' ? (
        <button
          type="button"
          className="course-page-fold is-prev"
          aria-label="Previous page"
          onClick={(e) => {
            e.stopPropagation();
            goSpread(-1);
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
            goSpread(1);
          }}
        />
      ) : null}
    </>
  );

  const renderSheet = (pageIndex: number | null, side?: 'verso' | 'recto') => {
    const sideClass = side ? ` is-${side}` : '';
    if (pageIndex == null) {
      return (
        <div className={`course-book-sheet is-${theme}${sideClass} is-blank`}>
          <div className="course-book-running">{headerText}</div>
          <div className="course-book-running-title">{chapterTitleText}</div>
          <div className="course-book-body" />
          {pageFolds(side)}
        </div>
      );
    }
    const pageHtml = markedPages[pageIndex] || '';
    const cover = isCoverHtml(pageHtml);
    return (
      <div
        className={`course-book-sheet is-${theme}${sideClass}${cover ? ' is-cover' : ''}`}
        style={{ fontSize: `${fontZoom}%` }}
        data-course-page={pageIndex}
      >
        {!cover ? (
          <div className="course-book-ribbon-wrap">
            <span className="course-book-ribbon is-on is-important" title="Bookmark" />
          </div>
        ) : null}
        <div className="course-book-running">{headerText}</div>
        <div className="course-book-running-title">{chapterTitleText}</div>
        <div
          className="course-chapter course-book-body"
          data-course-page={pageIndex}
          dangerouslySetInnerHTML={{ __html: pageHtml }}
        />
        <div className="course-book-folio">{startPageNum + pageIndex - coverShift}</div>
        {!cover ? pageFolds(side) : null}
      </div>
    );
  };

  if (loadingSubject) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '80vh',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Spin size="large" />
        <span style={{ color: '#64748b', fontWeight: 600 }}>Loading book reader…</span>
      </div>
    );
  }

  if (!subject) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty description="Book not found" />
        <Button style={{ marginTop: 16 }} onClick={() => router.push(backHref)}>
          Return to Books
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`course-reader-workspace course-reader-with-notes is-desktop is-spread vv-admin-reader-root is-theme-${theme}`}
      style={{ ['--course-text-scale' as string]: fontZoom / 100 } as React.CSSProperties}
    >
      {/* Top Header Bar */}
      <header className="vv-admin-reader-header">
        <div className="vv-admin-reader-h-left">
          <Link href={backHref} className="vv-admin-reader-back-btn" title={backLabel}>
            <ArrowLeftOutlined />
            <span>{backLabel}</span>
          </Link>
          <div className="vv-admin-reader-h-divider" />
          <div className="vv-admin-reader-meta">
            <div className="vv-admin-reader-title-line">
              <span className="vv-admin-reader-book-title">{subject.name}</span>
              {subject.syllabusCode ? (
                <Tag color="blue" style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>
                  {subject.syllabusCode}
                </Tag>
              ) : null}
              <Tag
                color={subject.status === 'PUBLISHED' ? 'green' : 'orange'}
                style={{ fontSize: 11, fontWeight: 700, margin: 0 }}
              >
                {subject.status}
              </Tag>
            </div>
            <div className="vv-admin-reader-subtitle">
              {subject.course.name} · {subject.semester.title}
              {subject.course.university ? ` · ${subject.course.university}` : ''}
            </div>
          </div>
        </div>

        <div className="vv-admin-reader-h-center">
          {chapters.length > 0 ? (
            <div className="vv-admin-reader-chapter-select-wrap">
              <Tooltip title={prevChapter ? `Previous: ${prevChapter.title}` : 'First chapter'}>
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  disabled={!prevChapter}
                  onClick={() => prevChapter && goToChapter(prevChapter.id)}
                />
              </Tooltip>
              <Select
                value={currentChapterId || undefined}
                onChange={goToChapter}
                style={{ width: 260 }}
                size="middle"
                options={chapters.map((ch, i) => ({
                  value: ch.id,
                  label: `${i + 1}. ${ch.title}`,
                }))}
              />
              <Tooltip title={nextChapter ? `Next: ${nextChapter.title}` : 'Last chapter'}>
                <Button
                  size="small"
                  icon={<RightOutlined />}
                  disabled={!nextChapter}
                  onClick={() => nextChapter && goToChapter(nextChapter.id)}
                />
              </Tooltip>
            </div>
          ) : null}
        </div>

        <div className="vv-admin-reader-h-right">
          <Tooltip title="Table of Contents & Chapters">
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => setTocOpen(true)}
              className={tocOpen ? 'is-active' : ''}
            >
              Contents
            </Button>
          </Tooltip>

          {/* Theme Switcher */}
          <div className="vv-admin-reader-theme-group">
            {(
              [
                ['paper', 'Paper', '#faf6ee'],
                ['clean', 'Clean', '#ffffff'],
                ['sepia', 'Sepia', '#f4ecd8'],
                ['night', 'Dark', '#1b1814'],
              ] as const
            ).map(([tKey, tLabel, tBg]) => (
              <button
                key={tKey}
                type="button"
                className={`vv-admin-theme-dot${theme === tKey ? ' is-on' : ''}`}
                style={{ background: tBg }}
                onClick={() => setTheme(tKey)}
                title={`${tLabel} mode`}
                aria-label={`${tLabel} mode`}
              />
            ))}
          </div>

          {/* Zoom / Font Size */}
          <div className="vv-admin-reader-zoom-group">
            <Tooltip title="Decrease font">
              <Button
                size="small"
                icon={<ZoomOutOutlined />}
                disabled={fontZoom <= 85}
                onClick={() => setFontZoom((z) => Math.max(85, z - 10))}
              />
            </Tooltip>
            <span className="vv-admin-zoom-label">{fontZoom}%</span>
            <Tooltip title="Increase font">
              <Button
                size="small"
                icon={<ZoomInOutlined />}
                disabled={fontZoom >= 135}
                onClick={() => setFontZoom((z) => Math.min(135, z + 10))}
              />
            </Tooltip>
          </div>

          {/* Spread vs Single */}
          <Tooltip title={spread ? 'Switch to single page' : 'Switch to 2-page spread'}>
            <Button
              size="small"
              onClick={() => setForceSinglePage((v) => !v)}
              icon={<BookOutlined />}
            >
              {spread ? '2 Pages' : '1 Page'}
            </Button>
          </Tooltip>
        </div>
      </header>

      {/* Main Stage */}
      <div className="vv-admin-reader-body">
        {loadingChapter ? (
          <div className="vv-admin-reader-center-spin">
            <Spin size="large" />
            <p>Loading chapter pages…</p>
          </div>
        ) : (
          <div className="course-book-stage vv-book-stage">
            <button
              type="button"
              className="course-book-side-btn vv-book-side-btn is-prev"
              disabled={atStart}
              aria-label="Previous pages"
              onClick={() => goSpread(-1)}
            >
              <span>←</span>
              Previous
            </button>

            <div className="course-book-slot vv-book-slot" ref={slotRef}>
              <div
                ref={bookRef}
                className={`course-book${spread ? ' is-spread is-a4' : ''}${
                  spread && soloLeaf ? ' is-solo' : ''
                }`}
                style={{ ['--course-img-max' as string]: `${imgMax}px` } as React.CSSProperties}
              >
                <div
                  className={`course-book-volume${spread && !soloLeaf ? ' is-open' : ' is-solo'}${
                    frontCoverUrl && index === 0 ? ' is-cover-front' : ''
                  }`}
                  style={
                    {
                      ['--book-read' as string]: `${(3 + bookReadRatio * 10).toFixed(1)}px`,
                      ['--book-unread' as string]: frontCoverUrl && index === 0
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
                </div>

                {/* Highlighter bar */}
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
                    <p className="course-highlight-hint">Select text to highlight</p>
                  )}
                  <div className="course-book-page-meta">
                    <span>
                      {spread
                        ? `${pageMeta} · ${pages.length} pages`
                        : `${index + 1} / ${pages.length}`}
                    </span>
                    {chapter ? (
                      <small>
                        Chapter {currentChapterIdx + 1} of {chapters.length}
                      </small>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="course-book-side-btn vv-book-side-btn is-next"
              disabled={atEnd}
              aria-label="Next pages"
              onClick={() => goSpread(1)}
            >
              <span>→</span>
              Next
            </button>
          </div>
        )}
      </div>

      {/* Table of Contents & Chapter Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOutlined style={{ color: '#2563eb' }} />
            <span>Table of Contents · {subject.name}</span>
          </div>
        }
        placement="left"
        width={380}
        open={tocOpen}
        onClose={() => setTocOpen(false)}
      >
        <div className="vv-admin-toc-wrap">
          <p className="vv-hint" style={{ marginBottom: 16 }}>
            Select any chapter to jump directly to it:
          </p>
          <div className="vv-admin-toc-list">
            {chapters.map((ch, i) => {
              const isCurrent = ch.id === currentChapterId;
              return (
                <div
                  key={ch.id}
                  className={`vv-admin-toc-item${isCurrent ? ' is-current' : ''}`}
                  onClick={() => goToChapter(ch.id)}
                >
                  <div className="vv-admin-toc-item-header">
                    <span className="vv-admin-toc-index">{i + 1}</span>
                    <span className="vv-admin-toc-title">{ch.title}</span>
                  </div>
                  {isCurrent && toc.length > 0 ? (
                    <div className="vv-admin-toc-subtopics">
                      {toc.map((topic, ti) => (
                        <div
                          key={`${topic.page}-${ti}`}
                          className="vv-admin-toc-topic"
                          onClick={(e) => {
                            e.stopPropagation();
                            const foundIdx = pages.findIndex(
                              (p) =>
                                !isCoverHtml(p.join('')) &&
                                p.some((html) => html.includes(topic.title)),
                            );
                            if (foundIdx >= 0) {
                              setIndex(foundIdx);
                              setToolIndex(foundIdx);
                            }
                            setTocOpen(false);
                          }}
                        >
                          <span className="vv-admin-toc-dot">•</span>
                          <span className="vv-admin-toc-topic-text">{topic.title}</span>
                          <span className="vv-admin-toc-topic-page">p. {topic.page}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
