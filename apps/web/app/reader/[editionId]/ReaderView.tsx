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
  const [pageWidth, setPageWidth] = React.useState(800);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [_dataLoaded, setDataLoaded] = React.useState(false);
  const [pdfLoadError, setPdfLoadError] = React.useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);
  /** Defer mounting react-pdf until client-only; reduces PDF.js worker teardown issues under React Strict Mode. */
  const [pdfMountReady, setPdfMountReady] = React.useState(false);
  const [pdfDocReady, setPdfDocReady] = React.useState(false);
  const flipBookRef = React.useRef<any>(null);
  React.useEffect(() => {
    setPdfMountReady(true);
    return () => setPdfMountReady(false);
  }, []);

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
    const w = Math.min(1100, window.innerWidth - 300);
    setPageWidth(w);
    const onResize = () => setPageWidth(Math.min(1100, window.innerWidth - 300));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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

  // when reader selected, load progress
  React.useEffect(() => {
    if (sampleMode || !readerId) return;
    axios
      .get(`/api/reader-progress/${readerId}/edition/${editionId}`, { headers: getAuthHeaders() })
      .then((pr) => {
        if (pr.data && pr.data.current_page) setCurrent(pr.data.current_page);
      });
  }, [readerId, editionId, sampleMode]);

  const useImageReader = pages.length > 0 && !imageLoadFailed;
  const usePdfReader = !!pdfUrl && !useImageReader && (!!token || sampleMode);
  const totalPages = usePdfReader ? numPdfPages : pages.length || 1;
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
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, totalPages]);
  const prev = () => flipBookRef.current?.pageFlip()?.flipPrev();
  const next = () => flipBookRef.current?.pageFlip()?.flipNext();
  const flipTo = (target: number) => {
    if (target < 1 || target > totalPages) return;
    flipBookRef.current?.pageFlip()?.flip(target - 1);
  };

  const flipPageWidth = Math.max(290, Math.min(460, Math.floor(pageWidth / 2)));
  const flipPageHeight = Math.floor(flipPageWidth * 1.36);
  const centerSinglePage = totalPages <= 1 || current <= 1;
  const singlePageOffset = centerSinglePage ? -Math.floor(flipPageWidth / 2) : 0;

  const hasContent = pdfUrl || pages.length > 0;

  return (
    <main>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <aside
          style={{
            width: 240,
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
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

        <div style={{ flex: 1, minWidth: 320, paddingTop: 10, paddingLeft: 10, paddingRight: 10 }}>
          <div
            className="book-with-side-nav"
            style={{
              display: hasContent ? 'flex' : 'block',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            {hasContent && (
              <Button
                className="nav-btn prev-nav-btn side-nav-btn"
                onClick={prev}
                disabled={current <= 1}
              >
                Previous
              </Button>
            )}
            {usePdfReader ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {!pdfMountReady ? (
                    <p>Loading PDF…</p>
                  ) : (
                    <Document
                      key={`${editionId}-${pdfUrl}`}
                      file={pdfFile}
                      options={pdfOptions}
                      onLoadSuccess={({ numPages }) => {
                        setNumPdfPages(numPages);
                        setCurrent((prev) => Math.min(Math.max(prev, 1), Math.max(numPages, 1)));
                        setPdfDocReady(true);
                        setPdfLoadError(null);
                      }}
                      onLoadError={(e) => {
                        setPdfDocReady(false);
                        setPdfLoadError(e?.message || 'Failed to load PDF');
                      }}
                      onSourceError={(e) => {
                        setPdfDocReady(false);
                        setPdfLoadError(e?.message || 'Failed to load PDF source');
                      }}
                      loading={<p>Loading PDF…</p>}
                      error={pdfLoadError ? <p>{pdfLoadError}</p> : <p>Failed to load PDF.</p>}
                    >
                      {pdfDocReady && numPdfPages > 0 ? (
                        <HTMLFlipBook
                          key={`pdf-book-${numPdfPages}-${flipPageWidth}`}
                          ref={flipBookRef}
                          width={flipPageWidth}
                          height={flipPageHeight}
                          size="fixed"
                          minWidth={220}
                          maxWidth={800}
                          minHeight={300}
                          maxHeight={1200}
                          drawShadow={true}
                          flippingTime={700}
                          usePortrait={false}
                          startZIndex={0}
                          autoSize={false}
                          maxShadowOpacity={0.5}
                          showCover={true}
                          startPage={Math.max(0, current - 1)}
                          mobileScrollSupport={true}
                          clickEventForward={true}
                          useMouseEvents={true}
                          swipeDistance={30}
                          showPageCorners={true}
                          disableFlipByClick={false}
                          className="flip-book"
                          style={{
                            marginLeft: singlePageOffset,
                            transition: 'margin-left 180ms ease',
                          }}
                          onFlip={(e: any) => setCurrent((e?.data ?? 0) + 1)}
                        >
                          {Array.from({ length: numPdfPages }, (_, i) => (
                            <div
                              key={`pdf-page-${i + 1}`}
                              className="flip-page"
                              style={{
                                background: '#fff',
                                display: 'flex',
                                justifyContent: 'center',
                              }}
                            >
                              <Page
                                pageNumber={i + 1}
                                width={flipPageWidth - 24}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                              />
                            </div>
                          ))}
                        </HTMLFlipBook>
                      ) : (
                        <p>Loading page…</p>
                      )}
                    </Document>
                  )}
                </div>
              </div>
            ) : useImageReader ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <HTMLFlipBook
                    key={`img-book-${pages.length}-${flipPageWidth}-${low ? 'low' : 'hi'}`}
                    ref={flipBookRef}
                    width={flipPageWidth}
                    height={flipPageHeight}
                    size="fixed"
                    minWidth={220}
                    maxWidth={800}
                    minHeight={300}
                    maxHeight={1200}
                    drawShadow={true}
                    flippingTime={700}
                    usePortrait={false}
                    startZIndex={0}
                    autoSize={false}
                    maxShadowOpacity={0.5}
                    showCover={true}
                    startPage={Math.max(0, current - 1)}
                    mobileScrollSupport={true}
                    clickEventForward={true}
                    useMouseEvents={true}
                    swipeDistance={30}
                    showPageCorners={true}
                    disableFlipByClick={false}
                    className="flip-book"
                    style={{ marginLeft: singlePageOffset, transition: 'margin-left 180ms ease' }}
                    onFlip={(e: any) => setCurrent((e?.data ?? 0) + 1)}
                  >
                    {pages.map((_: any, index: number) => {
                      const pageNo = index + 1;
                      return (
                        <div
                          key={`img-page-${pageNo}`}
                          className="flip-page"
                          style={{ background: '#fff', display: 'flex', alignItems: 'center' }}
                        >
                          <img
                            src={pageUrl(pageNo)}
                            onError={() => setImageLoadFailed(true)}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block',
                            }}
                            alt={`Page ${pageNo}`}
                          />
                        </div>
                      );
                    })}
                  </HTMLFlipBook>
                </div>
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
            {hasContent && (
              <Button
                className="nav-btn next-nav-btn side-nav-btn"
                onClick={next}
                disabled={current >= totalPages}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
      <p>
        {sampleMode ? 'Sample · ' : ''}Page {current} / {totalPages}
      </p>
      <style>{`
        .flip-page {
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
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
          flex-wrap: wrap;
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
