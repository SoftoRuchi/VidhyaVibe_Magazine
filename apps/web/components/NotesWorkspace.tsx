'use client';

import { Spin } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import CourseNotesPanel from '../app/courses/[slug]/[semester]/[subject]/read/CourseNotesPanel';
import { useAuth } from '../lib/authContext';
import {
  addCourseNote,
  courseAccessMessage,
  courseLoginHref,
  deleteCourseNote,
  fetchAllCourseNotes,
  fetchMyBooks,
  fetchSemester,
  fetchSubject,
  updateCourseNote,
  type CourseNoteRecord,
  type EntitledBook,
} from '../lib/coursesApi';

const TAB_COLORS = [
  '#7719aa',
  '#ca5010',
  '#f2c811',
  '#0078d4',
  '#d13438',
  '#107c10',
  '#881798',
  '#e3008c',
  '#038387',
  '#5c2e91',
  '#498205',
  '#c239b3',
  '#004e8c',
  '#8e562e',
  '#e74856',
];

type BookRow = {
  key: string;
  subjectId: number | null;
  name: string;
  courseName: string;
  courseSlug: string;
  subjectSlug: string;
  semesterNumber: number;
  href: string;
  color: string;
};

type ChapterRow = {
  id: number;
  slug: string;
  title: string;
};

function bookKeyOf(courseSlug: string, semesterNumber: number, subjectSlug: string) {
  return `${courseSlug}:${semesterNumber}:${subjectSlug}`;
}

function booksFromLibrary(library: EntitledBook[], notes: CourseNoteRecord[]): BookRow[] {
  const rows: BookRow[] = [];
  const seen = new Set<string>();
  library.forEach((book) => {
    const key = bookKeyOf(book.courseSlug, book.semesterNumber, book.slug);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      key,
      subjectId: book.id,
      name: book.name,
      courseName: book.courseName,
      courseSlug: book.courseSlug,
      subjectSlug: book.slug,
      semesterNumber: book.semesterNumber,
      href: book.href,
      color: TAB_COLORS[rows.length % TAB_COLORS.length],
    });
  });
  notes.forEach((note) => {
    const key = bookKeyOf(note.courseSlug, note.semesterNumber, note.subjectSlug);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      key,
      subjectId: note.subjectId || null,
      name: note.subjectName,
      courseName: note.courseName,
      courseSlug: note.courseSlug,
      subjectSlug: note.subjectSlug,
      semesterNumber: note.semesterNumber,
      href: `/courses/${note.courseSlug}/sem-${note.semesterNumber}/${note.subjectSlug}`,
      color: TAB_COLORS[rows.length % TAB_COLORS.length],
    });
  });
  return rows;
}

export default function NotesWorkspace({
  initialBookKey = '',
  initialChapterSlug = '',
  onClose,
}: {
  initialBookKey?: string;
  initialChapterSlug?: string;
  onClose?: (currentBookKey?: string, currentChapterSlug?: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname() || '/notes';
  const { loggedIn, loading: authLoading } = useAuth();
  const [notes, setNotes] = React.useState<CourseNoteRecord[]>([]);
  const [books, setBooks] = React.useState<BookRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [bookKey, setBookKey] = React.useState(initialBookKey);
  const [chapterSlug, setChapterSlug] = React.useState(initialChapterSlug);
  const [chapterQuery, setChapterQuery] = React.useState('');
  const [chapters, setChapters] = React.useState<ChapterRow[]>([]);
  const [chaptersLoading, setChaptersLoading] = React.useState(false);
  const [accessError, setAccessError] = React.useState('');
  const [quote, setQuote] = React.useState('');
  const quoteChapter = React.useRef(initialChapterSlug);

  const reloadNotes = React.useCallback(async () => {
    const rows = await fetchAllCourseNotes();
    setNotes(rows);
    return rows;
  }, []);

  React.useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem('vv_pending_note_quote') || '';
      if (pending) {
        setQuote(pending);
        window.sessionStorage.removeItem('vv_pending_note_quote');
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (authLoading) return;
    if (!loggedIn) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchMyBooks().catch(() => [] as EntitledBook[]), fetchAllCourseNotes()])
      .then(([library, rows]) => {
        if (cancelled) return;
        setNotes(rows);
        setBooks(booksFromLibrary(library, rows));
      })
      .catch((e: any) => {
        if (cancelled) return;
        if (e?.response?.status === 401) setNeedLogin(true);
        setNotes([]);
        setBooks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn]);

  React.useEffect(() => {
    if (loading || !initialBookKey || books.some((book) => book.key === initialBookKey)) return;
    const [courseSlug, semRaw, subjectSlug] = initialBookKey.split(':');
    const semesterNumber = Number(semRaw);
    if (!courseSlug || !subjectSlug || !semesterNumber) return;
    let cancelled = false;
    fetchSemester(courseSlug, semesterNumber)
      .then((sem) => {
        if (cancelled) return;
        const match = (sem.subjects || []).find((s: { slug?: string }) => s.slug === subjectSlug);
        if (!match) return;
        const row: BookRow = {
          key: initialBookKey,
          subjectId: Number(match.id),
          name: String(match.name || subjectSlug),
          courseName: String(sem.course?.name || courseSlug),
          courseSlug,
          subjectSlug,
          semesterNumber,
          href: `/courses/${courseSlug}/sem-${semesterNumber}/${subjectSlug}`,
          color: TAB_COLORS[books.length % TAB_COLORS.length],
        };
        setBooks((prev) => (prev.some((book) => book.key === row.key) ? prev : [row, ...prev]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading, initialBookKey, books]);

  const book = books.find((item) => item.key === bookKey) || books[0] || null;
  const loadedBookKey = React.useRef('');

  React.useEffect(() => {
    if (!book) {
      setChapters([]);
      return;
    }
    if (book.key !== bookKey) setBookKey(book.key);
    const switched = loadedBookKey.current !== book.key;
    loadedBookKey.current = book.key;
    if (switched) setChapters([]);
    const fromNotes = () => {
      const seen = new Map<string, ChapterRow>();
      notes
        .filter(
          (note) =>
            note.courseSlug === book.courseSlug &&
            note.subjectSlug === book.subjectSlug &&
            note.semesterNumber === book.semesterNumber,
        )
        .forEach((note) => {
          if (!seen.has(note.chapterSlug)) {
            seen.set(note.chapterSlug, {
              id: note.chapterId,
              slug: note.chapterSlug,
              title: note.chapterTitle,
            });
          }
        });
      return Array.from(seen.values());
    };
    if (!book.subjectId) {
      setChapters(fromNotes());
      setAccessError('');
      return;
    }
    let cancelled = false;
    setChaptersLoading(true);
    setAccessError('');
    fetchSubject(book.subjectId)
      .then((sub) => {
        if (cancelled) return;
        const rows: ChapterRow[] = (sub.chapters || []).map(
          (ch: { id: number; slug: string; title: string }) => ({
            id: ch.id,
            slug: ch.slug,
            title: ch.title,
          }),
        );
        const known = new Set(rows.map((ch) => ch.slug));
        fromNotes().forEach((ch) => {
          if (!known.has(ch.slug)) rows.push(ch);
        });
        setChapters(rows);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setChapters(fromNotes());
        if (e?.response?.status === 403) {
          setAccessError(courseAccessMessage(e) || 'You do not have access to this book.');
        }
      })
      .finally(() => {
        if (!cancelled) setChaptersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [book, bookKey, notes]);

  React.useEffect(() => {
    if (!chapters.length) return;
    if (chapters.some((ch) => ch.slug === chapterSlug)) return;
    const preferred =
      chapters.find((ch) => ch.slug === initialChapterSlug && book?.key === initialBookKey) ||
      chapters.find((ch) =>
        notes.some(
          (note) =>
            note.chapterSlug === ch.slug &&
            note.subjectSlug === book?.subjectSlug &&
            note.courseSlug === book?.courseSlug,
        ),
      ) ||
      chapters[0];
    setChapterSlug(preferred.slug);
  }, [chapters, chapterSlug, initialChapterSlug, initialBookKey, book, notes]);

  const chapter = chapters.find((item) => item.slug === chapterSlug) || null;
  const needle = chapterQuery.trim().toLowerCase();
  const visibleChapters = needle
    ? chapters.filter((ch) => ch.title.toLowerCase().includes(needle))
    : chapters;
  const chapterNotes = notes.filter(
    (note) =>
      book &&
      note.courseSlug === book.courseSlug &&
      note.subjectSlug === book.subjectSlug &&
      note.semesterNumber === book.semesterNumber &&
      note.chapterSlug === (chapter?.slug || chapterSlug),
  );
  const noteCount = (slug: string) =>
    notes.filter(
      (note) =>
        book &&
        note.courseSlug === book.courseSlug &&
        note.subjectSlug === book.subjectSlug &&
        note.chapterSlug === slug,
    ).length;

  const remember = (nextBook: string, nextChapter: string) => {
    if (pathname === '/notes') {
      const q = new URLSearchParams();
      if (nextBook) q.set('book', nextBook);
      if (nextChapter) q.set('chapter', nextChapter);
      const href = q.toString() ? `/notes?${q}` : '/notes';
      router.replace(href, { scroll: false });
      return;
    }
    if (pathname.endsWith('/notes') && nextBook === initialBookKey) {
      router.replace(
        nextChapter ? `${pathname}?chapter=${encodeURIComponent(nextChapter)}` : pathname,
        { scroll: false },
      );
    }
  };

  const chooseBook = (key: string) => {
    setBookKey(key);
    setChapterSlug('');
    setChapterQuery('');
    setQuote('');
    if (pathname !== '/notes') {
      router.push(`/notes?book=${encodeURIComponent(key)}`);
      return;
    }
    remember(key, '');
  };

  const chooseChapter = (slug: string) => {
    setChapterSlug(slug);
    if (slug !== quoteChapter.current) setQuote('');
    remember(book?.key || bookKey, slug);
  };

  const [lastReadHref, setLastReadHref] = React.useState('');
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem('vv_last_read_href');
      if (saved) setLastReadHref(saved);
    } catch {
      // ignore storage access errors
    }
  }, []);

  const readHref =
    lastReadHref && book && lastReadHref.startsWith(`${book.href}/read`)
      ? lastReadHref
      : book && chapter
      ? `${book.href}/read?chapter=${encodeURIComponent(chapter.slug)}`
      : book?.href || '/books';

  if (loading || authLoading) {
    return (
      <div className="onenote-status">
        <Spin />
      </div>
    );
  }

  if (needLogin) {
    return (
      <div className="onenote-status">
        <Link href={courseLoginHref(pathname)} className="course-note-save">
          Login to view notes
        </Link>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="onenote-status">
        <h1>Notes</h1>
        <p>Open a book from your library. Chapters and notes will line up here.</p>
        <Link href="/books" className="course-note-save">
          My books
        </Link>
      </div>
    );
  }

  return (
    <div
      className="onenote-shell"
      style={{ ['--onenote-accent' as string]: book.color } as React.CSSProperties}
    >
      <aside className="onenote-books" aria-label="Books">
        <div className="onenote-notebook">My books</div>
        <div className="onenote-books-scroll">
          {books.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`onenote-book${item.key === book.key ? ' is-on' : ''}`}
              style={{ ['--tab' as string]: item.color } as React.CSSProperties}
              onClick={() => chooseBook(item.key)}
            >
              <span className="onenote-book-swatch" aria-hidden />
              <span>
                <strong>{item.name}</strong>
                <small>{item.courseName}</small>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <aside className="onenote-chapters" aria-label="Chapters">
        <div className="onenote-chapters-head">
          <strong>{book.name}</strong>
          <span>{chapters.length ? `${chapters.length} chapters` : 'Chapters'}</span>
        </div>
        <input
          type="search"
          value={chapterQuery}
          onChange={(e) => setChapterQuery(e.target.value)}
          placeholder="Find a chapter"
          aria-label="Find a chapter"
        />
        <div className="onenote-chapters-scroll">
          {chaptersLoading && chapters.length === 0 ? <Spin size="small" /> : null}
          {visibleChapters.map((ch) => {
            const count = noteCount(ch.slug);
            const on = ch.slug === chapter?.slug;
            const index = chapters.findIndex((item) => item.slug === ch.slug) + 1;
            return (
              <button
                key={ch.slug}
                type="button"
                className={`onenote-chap${on ? ' is-on' : ''}`}
                onClick={() => chooseChapter(ch.slug)}
              >
                <span className="onenote-chap-index">{index}</span>
                <span className="onenote-chap-title">{ch.title}</span>
                {count ? <span className="onenote-chap-count">{count}</span> : null}
              </button>
            );
          })}
          {!chaptersLoading && visibleChapters.length === 0 ? (
            <p className="onenote-blank">No chapters match.</p>
          ) : null}
        </div>
      </aside>

      <section className="onenote-canvas" aria-label="Notes">
        {accessError ? <p className="onenote-blank">{accessError}</p> : null}
        {chapter ? (
          <CourseNotesPanel
            key={chapter.id}
            variant="page"
            notes={chapterNotes}
            chapterTitle={chapter.title}
            quote={chapter.slug === quoteChapter.current ? quote : ''}
            onQuoteChange={setQuote}
            openHref={readHref}
            onClose={onClose ? () => onClose(book?.key || bookKey, chapter?.slug || chapterSlug) : undefined}
            onSave={async (content, savedQuote) => {
              const created = await addCourseNote(chapter.id, content, undefined, savedQuote);
              await reloadNotes();
              return created;
            }}
            onUpdate={async (id, content) => {
              await updateCourseNote(id, content);
            }}
            onDelete={async (id) => {
              await deleteCourseNote(id);
              await reloadNotes();
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 36px' }}>
            <p className="onenote-blank" style={{ margin: 0 }}>Choose a chapter to open its notes.</p>
            {onClose ? (
              <button
                type="button"
                className="course-notes-close-icon-btn"
                onClick={() => onClose(book?.key || bookKey, chapterSlug)}
                title="Close notes and return to book"
                aria-label="Close notes"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : readHref ? (
              <Link
                href={readHref}
                className="course-notes-close-icon-btn"
                title="Close notes and return to book"
                aria-label="Close notes"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
