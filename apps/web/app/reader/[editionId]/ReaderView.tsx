'use client';
import { Button } from 'antd';
import axios from 'axios';
import { useParams, useSearchParams } from 'next/navigation';
import React from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Same-origin worker (public/pdf.worker.min.mjs via postinstall) avoids null worker / sendWithPromise failures
// from cross-origin CDN workers, Strict Mode double-mount, or blocked third-party scripts.
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** react-pageflip requires forwardRef on every page child or pages stack vertically. */
const FlipPageShell = React.forwardRef<
  HTMLDivElement,
  { pageNo: number; children: React.ReactNode }
>(function FlipPageShell({ pageNo, children }, ref) {
  return (
    <div ref={ref} className="flip-page" data-page={pageNo}>
      <div className="flip-page-content">{children}</div>
    </div>
  );
});

export default function ReaderView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const editionId = params?.editionId;
  const sampleMode = searchParams?.get('sample') === '1' || searchParams?.get('sample') === 'true';

  // Support token passthrough when admin opens Read link (cross-origin, different localStorage)
  React.useEffect(() => {
    const token = searchParams?.get('token');
    const sampleQ =
      searchParams?.get('sample') === '1' || searchParams?.get('sample') === 'true'
        ? '?sample=1'
        : '';
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
      window.history.replaceState({}, '', `/reader/${editionId}${sampleQ}`);
      window.location.reload();
    }
  }, [editionId, searchParams]);
  const [pages, setPages] = React.useState<any[]>([]);
  const [current, setCurrent] = React.useState(1);
  const [low, _setLow] = React.useState(false);
  const [readerId, setReaderId] = React.useState<number | null>(null);
  const [_readers, setReaders] = React.useState<any[]>([]);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [numPdfPages, setNumPdfPages] = React.useState<number>(0);
  const [viewport, setViewport] = React.useState({ width: 800, height: 700, isMobile: false });
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [_dataLoaded, setDataLoaded] = React.useState(false);
  const [pdfLoadError, setPdfLoadError] = React.useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);
  /** Defer mounting react-pdf until client-only; reduces PDF.js worker teardown issues under React Strict Mode. */
  const [pdfMountReady, setPdfMountReady] = React.useState(false);
  const [pdfDocReady, setPdfDocReady] = React.useState(false);
  /** Height/width from PDF or first page image — keeps flip slots tall enough to avoid bottom clipping. */
  const [pageAspectRatio, setPageAspectRatio] = React.useState(1.414);
  const [flipDimensionsReady, setFlipDimensionsReady] = React.useState(false);
  const flipBookRef = React.useRef<any>(null);
  React.useEffect(() => {
    setPdfMountReady(true);
    return () => setPdfMountReady(false);
  }, []);

  React.useEffect(() => {
    setPageAspectRatio(1.414);
    setFlipDimensionsReady(false);
  }, [editionId, pdfUrl]);

  /** If page-1 probe never fires, still open the book with default aspect ratio. */
  React.useEffect(() => {
    if (!pdfDocReady || flipDimensionsReady) return;
    const t = window.setTimeout(() => setFlipDimensionsReady(true), 5000);
    return () => window.clearTimeout(t);
  }, [pdfDocReady, flipDimensionsReady]);

  React.useEffect(() => {
    setLoadError(null);
    setDataLoaded(false);
    setImageLoadFailed(false);

    if (sampleMode) {
      axios
        .get(`/api/editions/${editionId}/sample/pages`)
        .then((r) => {
          setPages(r.data?.list || []);
          setPdfUrl(r.data?.pdfUrl || null);
          setDataLoaded(true);
          setLoadError(null);
        })
        .catch((err) => {
          setPages([]);
          setPdfUrl(null);
          setDataLoaded(true);
          const status = err?.response?.status;
          const msg = err?.response?.data?.error || err?.response?.data?.message;
          if (status === 404) setLoadError('Sample not available for this edition.');
          else setLoadError(msg || 'Failed to load sample. Please try again.');
        });
      return;
    }

    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      const redirect = encodeURIComponent(`/reader/${editionId}`);
      window.location.href = `/login?redirect=${redirect}`;
      return;
    }
    axios
      .get(`/api/editions/${editionId}/pages`, { headers })
      .then((r) => {
        setPages(r.data?.list || []);
        setPdfUrl(r.data?.pdfUrl || null);
        setDataLoaded(true);
        setLoadError(null);
      })
      .catch((err) => {
        if (err?.response?.status === 401) {
          const redirect = encodeURIComponent(`/reader/${editionId}`);
          window.location.href = `/login?redirect=${redirect}`;
          return;
        }
        setPages([]);
        setPdfUrl(null);
        setDataLoaded(true);
        const status = err?.response?.status;
        const msg = err?.response?.data?.error || err?.response?.data?.message;
        if (status === 403)
          setLoadError("You don't have access to this edition. Subscribe or purchase to read.");
        else if (status === 404) setLoadError('Edition not found.');
        else setLoadError(msg || 'Failed to load edition. Please try again.');
      });
    axios
      .get('/api/readers', { headers })
      .then((r) => {
        const rs = r.data || [];
        setReaders(rs);
        if (rs.length) {
          setReaderId(rs[0].id);
        }
      })
      .catch((err) => {
        if (err?.response?.status === 401) {
          const redirect = encodeURIComponent(`/reader/${editionId}`);
          window.location.href = `/login?redirect=${redirect}`;
          return;
        }
      });
  }, [editionId, sampleMode]);

  React.useEffect(() => {
    const MOBILE_MAX = 768;
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < MOBILE_MAX;
      setViewport({ width, height, isMobile });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  // save progress (debounced)
  React.useEffect(() => {
    if (sampleMode) return;
    const t = setTimeout(() => {
      if (!readerId) return;
      const total = usePdfReader ? numPdfPages : pages.length || 1;
      if (total < 1) return;
      axios.post(
        `/api/reader-progress/${readerId}/progress`,
        {
          editionId: Number(editionId),
          currentPage: current,
          percent: Math.round((current / total) * 100),
        },
        { headers: getAuthHeaders() },
      );
    }, 1000);
    return () => clearTimeout(t);
  }, [current, readerId, editionId, pages.length, pdfUrl, token, numPdfPages, sampleMode]);
  const pageUrl = (p: number) =>
    `/api/editions/${editionId}/pages/${p}?lowBandwidth=${low ? '1' : '0'}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

  // preload adjacent pages for smoother transitions
  React.useEffect(() => {
    if (!pages.length) return;
    const toPreload: number[] = [];
    const next = Math.min(pages.length, current + 1);
    const prev = Math.max(1, current - 1);
    toPreload.push(prev);
    toPreload.push(next);
    const next2 = Math.min(pages.length, current + 2);
    if (next2 !== next) toPreload.push(next2);

    const imgs: HTMLImageElement[] = [];
    toPreload.forEach((p) => {
      const img = new Image();
      img.src = pageUrl(p);
      imgs.push(img);
    });

    return () => {
      imgs.forEach((i) => {
        i.src = '';
      });
    };
  }, [current, pages.length, editionId, low, token]);

  const startFromBeginning =
    searchParams?.get('start') === '1' || searchParams?.get('start') === 'first';

  // when reader selected, load saved progress (unless ?start=1)
  React.useEffect(() => {
    if (sampleMode || !readerId || startFromBeginning) return;
    axios
      .get(`/api/reader-progress/${readerId}/edition/${editionId}`, { headers: getAuthHeaders() })
      .then((pr) => {
        if (pr.data && pr.data.current_page) setCurrent(pr.data.current_page);
      });
  }, [readerId, editionId, sampleMode, startFromBeginning]);

  React.useEffect(() => {
    if (!startFromBeginning) return;
    setCurrent(1);
  }, [startFromBeginning, editionId]);

  const useImageReader = pages.length > 0 && !imageLoadFailed;
  const usePdfReader = !!pdfUrl && !useImageReader && (!!token || sampleMode);
  const totalPages = usePdfReader ? numPdfPages : pages.length || 1;

  React.useEffect(() => {
    if (!flipDimensionsReady || totalPages < 1) return;
    const pf = flipBookRef.current?.pageFlip();
    if (!pf || typeof pf.getCurrentPageIndex !== 'function') return;
    const targetIndex = current - 1;
    if (pf.getCurrentPageIndex() !== targetIndex) {
      pf.turnToPage(targetIndex);
    }
  }, [current, flipDimensionsReady, totalPages]);
  const pdfFile = React.useMemo(() => {
    if (!pdfUrl || typeof window === 'undefined') return null;
    return { url: `${window.location.origin}${pdfUrl}` };
  }, [pdfUrl]);
  const pdfOptions = React.useMemo(
    () =>
      token && !sampleMode ? { httpHeaders: { Authorization: `Bearer ${token}` } } : undefined,
    [token, sampleMode],
  );

  // keyboard navigation
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        flipTo(current - 1);
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        flipTo(current + 1);
      } else if (e.key === 'Home') {
        flipTo(1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, totalPages]);
  const prev = () => flipBookRef.current?.pageFlip()?.flipPrev();
  const next = () => flipBookRef.current?.pageFlip()?.flipNext();
  /** Jump instantly to a page (flip() animates one page at a time). */
  const flipTo = (target: number) => {
    if (target < 1 || target > totalPages) return;
    const pf = flipBookRef.current?.pageFlip();
    if (!pf) return;
    pf.turnToPage(target - 1);
    setCurrent(target);
  };
  const goToStart = () => flipTo(1);

  const { width: viewportWidth, height: viewportHeight, isMobile } = viewport;

  /** Size flip slots so the full page fits on screen (no vertical clipping on mobile). */
  const { flipPageWidth, flipPageHeight } = React.useMemo(() => {
    const ratio = pageAspectRatio * 1.02;
    if (!isMobile) {
      const availableWidth = Math.max(560, viewportWidth - 340);
      const availableHeight = Math.max(480, viewportHeight - 100);
      let w = Math.max(290, Math.min(460, Math.floor(availableWidth / 2)));
      let h = Math.ceil(w * ratio);
      if (h > availableHeight) {
        h = availableHeight;
        w = Math.max(280, Math.floor(h / ratio));
        h = Math.ceil(w * ratio);
      }
      return { flipPageWidth: w, flipPageHeight: h };
    }
    const availableWidth = Math.max(240, viewportWidth - 16);
    const availableHeight = Math.max(360, viewportHeight - 118);
    let w = availableWidth;
    let h = Math.ceil(w * ratio);
    if (h > availableHeight) {
      h = availableHeight;
      w = Math.max(240, Math.floor(h / ratio));
      h = Math.ceil(w * ratio);
    }
    return { flipPageWidth: w, flipPageHeight: h };
  }, [isMobile, viewportWidth, viewportHeight, pageAspectRatio]);

  const applyPageAspectRatio = React.useCallback((ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setPageAspectRatio((prev) => (Math.abs(prev - ratio) > 0.01 ? ratio : prev));
  }, []);

  const onPdfDocumentLoad = React.useCallback((pdf: { numPages: number }) => {
    setNumPdfPages(pdf.numPages);
    setCurrent((prev) => Math.min(Math.max(prev, 1), Math.max(pdf.numPages, 1)));
    setPdfDocReady(true);
    setPdfLoadError(null);
    // Flipbook mounts after page 1 probe sets aspect — avoids wrong-size remount and blank desktop pages.
  }, []);

  /** Use loaded Page viewport — avoid pdf.getPage() which can hit a destroyed PDF.js worker. */
  const onPdfPageLoad = React.useCallback(
    (pageNo: number) =>
      (page: { getViewport: (opts: { scale: number }) => { width: number; height: number } }) => {
        if (pageNo !== 1) return;
        const vp = page.getViewport({ scale: 1 });
        applyPageAspectRatio(vp.height / vp.width);
        setFlipDimensionsReady(true);
      },
    [applyPageAspectRatio],
  );

  React.useEffect(() => {
    if (!useImageReader || pages.length === 0) return;
    setFlipDimensionsReady(false);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        applyPageAspectRatio(img.naturalHeight / img.naturalWidth);
      }
      setFlipDimensionsReady(true);
    };
    img.onerror = () => setFlipDimensionsReady(true);
    img.src = pageUrl(1);
  }, [useImageReader, pages.length, editionId, low, token, applyPageAspectRatio]);

  /** Desktop first/last page alone — showCover spread leaves a blank companion page. */
  const desktopSinglePageView =
    !isMobile && totalPages > 0 && (current <= 1 || current >= totalPages);
  const centerSinglePage = isMobile || totalPages <= 1 || desktopSinglePageView;
  const hasContent = pdfUrl || pages.length > 0;
  const bookStageWidth = centerSinglePage ? flipPageWidth : flipPageWidth * 2;
  const flipLayoutKey = isMobile
    ? 'm'
    : current <= 1
      ? 'cover'
      : current >= totalPages
        ? 'end'
        : 'spread';

  const flipBookProps = {
    style: {} as React.CSSProperties,
    width: flipPageWidth,
    height: flipPageHeight,
    size: 'fixed' as const,
    minWidth: isMobile ? 240 : 220,
    maxWidth: isMobile ? 560 : 800,
    minHeight: 280,
    maxHeight: isMobile ? flipPageHeight + 8 : 1200,
    drawShadow: true,
    flippingTime: isMobile ? 500 : 700,
    usePortrait: isMobile || desktopSinglePageView,
    startZIndex: 0,
    autoSize: false,
    maxShadowOpacity: isMobile ? 0.45 : 0.72,
    showCover: !isMobile && !desktopSinglePageView,
    startPage: Math.max(0, current - 1),
    mobileScrollSupport: true,
    clickEventForward: true,
    useMouseEvents: true,
    swipeDistance: 30,
    showPageCorners: true,
    disableFlipByClick: false,
    className: 'flip-book',
    onFlip: (e: { data?: number }) => setCurrent((e?.data ?? 0) + 1),
  };

  return (
    <main className="reader-page">
      <div className="reader-layout">
        <aside className="reader-sidebar">
          {/* <div>
            <label style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>Reader</label>
            <select
              value={readerId || ''}
              onChange={(e) => setReaderId(Number(e.target.value))}
              style={{ padding: 8, minWidth: 210, width: '100%' }}
            >
              {readers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div> */}

          {hasContent && !sampleMode && (
            <div className="actions-panel">
              <button
                type="button"
                className="reader-action-btn reader-start-btn"
                onClick={goToStart}
                disabled={current <= 1}
              >
                Start
              </button>
              <button
                className="reader-action-btn bookmark-btn"
                onClick={async () => {
                  if (!readerId) return;
                  try {
                    await axios.post(
                      '/api/interactions/bookmarks',
                      { readerId, editionId: Number(editionId), pageNumber: current },
                      { headers: getAuthHeaders() },
                    );
                    alert('Bookmarked');
                  } catch (e: any) {
                    alert('Bookmark failed');
                  }
                }}
              >
                Bookmark
              </button>
              {/* <button
                className="reader-action-btn note-btn"
                onClick={async () => {
                  const content = prompt('Enter note for page ' + current);
                  if (!content || !readerId) return;
                  try {
                    await axios.post(
                      '/api/interactions/notes',
                      { readerId, editionId: Number(editionId), pageNumber: current, content },
                      { headers: getAuthHeaders() },
                    );
                    alert('Note saved');
                  } catch (e: any) {
                    alert('Save note failed');
                  }
                }}
              >
                Add Note
              </button> */}
              {/* <button
                className="reader-action-btn highlight-btn"
                onClick={async () => {
                  const text = prompt('Highlight text (short)');
                  if (!text || !readerId) return;
                  try {
                    await axios.post(
                      '/api/interactions/highlights',
                      {
                        readerId,
                        editionId: Number(editionId),
                        pageNumber: current,
                        text,
                        color: '#ff0',
                      },
                      { headers: getAuthHeaders() },
                    );
                    alert('Highlight saved');
                  } catch (e: any) {
                    alert('Save highlight failed');
                  }
                }}
              >
                Highlight
              </button>
              <button
                className="reader-action-btn video-btn"
                onClick={async () => {
                  try {
                    const res = await axios.get(`/api/editions/${editionId}/videos?page=${current}`, {
                      headers: getAuthHeaders(),
                    });
                    const vids = res.data || [];
                    if (!vids.length) return alert('No videos for this page');
                    window.open(vids[0].url, '_blank');
                  } catch (e: any) {
                    alert('Failed to fetch videos');
                  }
                }}
              >
                Videos
              </button> */}
            </div>
          )}
        </aside>

        <div
          className={`reader-main-column${hasContent && totalPages > 0 ? ' reader-main-column--toolbar' : ''}`}
        >
          {hasContent && totalPages > 0 && (
            <div className="reader-page-indicator" aria-live="polite">
              {sampleMode ? <span className="reader-page-indicator__sample">Sample · </span> : null}
              Page {current} / {totalPages}
            </div>
          )}
          <div className="book-with-side-nav">
            {hasContent && !isMobile && (
              <Button
                className="nav-btn reader-start-btn side-nav-btn reader-desktop-nav"
                onClick={goToStart}
                disabled={current <= 1}
              >
                Start
              </Button>
            )}
            {hasContent && !isMobile && (
              <Button
                className="nav-btn prev-nav-btn side-nav-btn reader-desktop-nav"
                onClick={prev}
                disabled={current <= 1}
              >
                Previous
              </Button>
            )}
            {usePdfReader ? (
              <div
                className={`book-reader-stage${centerSinglePage ? ' book-reader-stage--single' : ''}${isMobile ? ' book-reader-stage--mobile' : ''}`}
                style={{ width: bookStageWidth, height: flipPageHeight }}
              >
                {!pdfMountReady ? (
                  <p>Loading PDF…</p>
                ) : pdfLoadError ? (
                  <p>{pdfLoadError}</p>
                ) : (
                  <Document
                    key={`${editionId}-${pdfUrl}`}
                    file={pdfFile}
                    options={pdfOptions}
                    onLoadSuccess={onPdfDocumentLoad}
                    onLoadError={(e) => {
                      setPdfDocReady(false);
                      setPdfLoadError(e?.message || 'Failed to load PDF');
                    }}
                    onSourceError={(e) => {
                      setPdfDocReady(false);
                      setPdfLoadError(e?.message || 'Failed to load PDF source');
                    }}
                    loading={<p>Loading PDF…</p>}
                    error={<p>Failed to load PDF.</p>}
                    className="flip-book-document"
                  >
                    {pdfDocReady && !flipDimensionsReady && (
                      <div className="pdf-aspect-probe" aria-hidden>
                        <Page pageNumber={1} width={360} onLoadSuccess={onPdfPageLoad(1)} />
                      </div>
                    )}
                    {pdfDocReady && flipDimensionsReady && numPdfPages > 0 ? (
                      <HTMLFlipBook
                        key={`pdf-book-${numPdfPages}-${flipPageWidth}-${flipPageHeight}-${flipLayoutKey}`}
                        ref={flipBookRef}
                        {...flipBookProps}
                      >
                        {Array.from({ length: numPdfPages }, (_, i) => {
                          const pageNo = i + 1;
                          return (
                            <FlipPageShell key={`pdf-page-${pageNo}`} pageNo={pageNo}>
                              <Page
                                pageNumber={pageNo}
                                width={flipPageWidth}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                            </FlipPageShell>
                          );
                        })}
                      </HTMLFlipBook>
                    ) : pdfDocReady ? (
                      <p>Preparing pages…</p>
                    ) : (
                      <p>Loading page…</p>
                    )}
                  </Document>
                )}
              </div>
            ) : useImageReader ? (
              <div
                className={`book-reader-stage${centerSinglePage ? ' book-reader-stage--single' : ''}${isMobile ? ' book-reader-stage--mobile' : ''}`}
                style={{ width: bookStageWidth, height: flipPageHeight }}
              >
                {(flipDimensionsReady || pages.length === 0) && (
                  <HTMLFlipBook
                    key={`img-book-${pages.length}-${flipPageWidth}-${flipPageHeight}-${flipLayoutKey}-${low ? 'low' : 'hi'}`}
                    ref={flipBookRef}
                    {...flipBookProps}
                  >
                    {pages.map((_: unknown, index: number) => {
                      const pageNo = index + 1;
                      return (
                        <FlipPageShell key={`img-page-${pageNo}`} pageNo={pageNo}>
                          <img
                            src={pageUrl(pageNo)}
                            onError={() => setImageLoadFailed(true)}
                            alt={`Page ${pageNo}`}
                          />
                        </FlipPageShell>
                      );
                    })}
                  </HTMLFlipBook>
                )}
                {!flipDimensionsReady && pages.length > 0 && <p>Loading pages…</p>}
              </div>
            ) : loadError ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
                <p style={{ marginBottom: 16 }}>{loadError}</p>
                <Button type="primary" onClick={() => (window.location.href = '/')}>
                  Go to Home
                </Button>
              </div>
            ) : (
              <p>Loading...</p>
            )}
            {hasContent && !isMobile && (
              <Button
                className="nav-btn next-nav-btn side-nav-btn reader-desktop-nav"
                onClick={next}
                disabled={current >= totalPages}
              >
                Next
              </Button>
            )}
          </div>
          {hasContent && isMobile && (
            <div className="reader-mobile-bar">
              <Button
                className="nav-btn reader-start-btn"
                onClick={goToStart}
                disabled={current <= 1}
              >
                Start
              </Button>
              <Button className="nav-btn prev-nav-btn" onClick={prev} disabled={current <= 1}>
                Previous
              </Button>
              <Button
                className="nav-btn next-nav-btn"
                onClick={next}
                disabled={current >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .reader-page {
          width: 100%;
          max-width: 100vw;
          overflow-x: hidden;
        }
        .reader-layout {
          display: flex;
          align-items: flex-start;
          gap: 20;
          flex-wrap: wrap;
        }
        .reader-sidebar {
          width: 240px;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .reader-main-column {
          position: relative;
          flex: 1;
          min-width: 0;
          width: 100%;
          min-height: 70vh;
          padding: 10px;
        }
        .reader-main-column--toolbar {
          padding-top: 40px;
        }
        .reader-page-indicator {
          position: absolute;
          top: 0;
          right: 10px;
          z-index: 30;
          padding: 8px 14px;
          background: rgba(55, 65, 81, 0.88);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          font-variant-numeric: tabular-nums;
          pointer-events: none;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.18);
        }
        .reader-page-indicator__sample {
          opacity: 0.9;
        }
        .book-reader-stage {
          position: relative;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #fff;
          border-radius: 8px;
          filter: drop-shadow(0 14px 32px rgba(15, 23, 42, 0.28));
        }
        .flip-book-document {
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
        }
        .flip-book-document .react-pdf__Document {
          line-height: 0;
        }
        .pdf-aspect-probe {
          position: absolute;
          width: 0;
          height: 0;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
        }
        .book-reader-stage .flip-book,
        .book-reader-stage .stf__parent,
        .book-reader-stage .stf__wrapper {
          margin: 0 auto;
        }
        .book-reader-stage::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 28px;
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 20;
          background: linear-gradient(
            90deg,
            rgba(15, 23, 42, 0.14) 0%,
            rgba(15, 23, 42, 0.05) 38%,
            rgba(15, 23, 42, 0.05) 62%,
            rgba(15, 23, 42, 0.14) 100%
          );
        }
        .book-reader-stage--single::after {
          display: none;
        }
        .book-reader-stage .stf__parent {
          border-radius: 8px;
        }
        .book-reader-stage .stf__wrapper {
          border-radius: 8px;
        }
        .flip-page {
          position: relative;
          background: #fff;
          border: none;
          border-radius: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .flip-page-content {
          width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .flip-page-content img {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
        }
        .flip-page-content .react-pdf__Page {
          margin: 0 !important;
          line-height: 0;
          display: flex !important;
          align-items: center;
          justify-content: center;
          width: 100% !important;
          height: 100% !important;
          max-width: 100%;
          max-height: 100%;
        }
        .flip-page-content .react-pdf__Page__canvas {
          display: block;
          margin: 0 auto;
          max-width: 100% !important;
          max-height: 100% !important;
          width: auto !important;
          height: auto !important;
        }
        .actions-panel {
          margin-top: 4px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.38);
          border-radius: 12px;
          backdrop-filter: blur(3px);
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .reader-action-btn {
          border: none;
          border-radius: 8px;
          padding: 8px 10px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .reader-action-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .book-with-side-nav {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          justify-content: center;
          gap: 16px;
          width: 100%;
        }
        .reader-mobile-bar {
          display: none;
        }
        @media (max-width: 767px) {
          .reader-layout {
            flex-direction: column;
            gap: 8px;
          }
          .reader-sidebar {
            display: none;
          }
          .reader-main-column {
            min-height: auto;
            padding: 4px 8px 88px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .book-with-side-nav {
            flex-direction: column;
            gap: 8px;
          }
          .book-reader-stage {
            width: 100% !important;
            max-width: 100%;
            margin: 0 auto;
            filter: drop-shadow(0 8px 20px rgba(15, 23, 42, 0.2));
          }
          .book-reader-stage::after {
            display: none;
          }
          .book-reader-stage--mobile .stf__parent,
          .book-reader-stage--mobile .stf__wrapper {
            margin: 0 auto;
          }
          .reader-page-indicator {
            top: 4px;
            right: 8px;
            font-size: 12px;
            padding: 6px 10px;
          }
          .reader-mobile-bar {
            display: flex;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 40;
            gap: 8px;
            padding: 10px 10px;
            padding-bottom: max(10px, env(safe-area-inset-bottom));
            background: rgba(255, 255, 255, 0.94);
            border-top: 1px solid rgba(15, 23, 42, 0.1);
            box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.12);
          }
          .reader-mobile-bar .nav-btn {
            flex: 1;
            min-width: 0;
            height: 44px;
            font-size: 13px;
            padding: 0 6px;
          }
          .reader-mobile-bar .reader-start-btn {
            flex: 0.85;
          }
        }
        .side-nav-btn {
          flex-shrink: 0;
        }
        .nav-btn {
          min-width: 108px;
          height: 38px;
          border: none !important;
          color: #fff !important;
          font-weight: 600;
          border-radius: 8px !important;
        }
        .reader-start-btn {
          background: linear-gradient(135deg, #64748b, #475569) !important;
        }
        .prev-nav-btn {
          background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
        }
        .next-nav-btn {
          background: linear-gradient(135deg, #16a34a, #15803d) !important;
        }
        .nav-btn[disabled] {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .bookmark-btn { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        .note-btn { background: linear-gradient(135deg, #06b6d4, #0891b2); }
        .highlight-btn { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .video-btn { background: linear-gradient(135deg, #ef4444, #dc2626); }
      `}</style>
    </main>
  );
}
