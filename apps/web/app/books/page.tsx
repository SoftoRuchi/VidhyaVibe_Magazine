'use client';

import { Empty, Spin } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import { CourseBookTile, CourseGrid } from '../../components/CourseBrowse';
import { useAuth } from '../../lib/authContext';
import {
  bookAccessLabel,
  courseLoginHref,
  fetchMyBooks,
  type EntitledBook,
} from '../../lib/coursesApi';
import { isChildAudience } from '../../lib/viewingContext';

export default function MyBooksPage() {
  const router = useRouter();
  const { loggedIn, loading: authLoading } = useAuth();
  const [books, setBooks] = React.useState<EntitledBook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [course, setCourse] = React.useState('');
  const [model, setModel] = React.useState('');

  React.useEffect(() => {
    if (authLoading) return;
    if (isChildAudience()) {
      router.replace('/dashboard');
      return;
    }
    if (!loggedIn) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMyBooks()
      .then((rows) => {
        if (!cancelled) setBooks(rows);
      })
      .catch((e: any) => {
        if (cancelled) return;
        if (e?.response?.status === 401) setNeedLogin(true);
        setBooks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, router]);

  const courses = React.useMemo(() => {
    const seen = new Map<string, string>();
    books.forEach((book) => {
      if (book.courseSlug && !seen.has(book.courseSlug)) seen.set(book.courseSlug, book.courseName);
    });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [books]);

  const models = React.useMemo(() => {
    const seen = new Set<string>();
    books.forEach((book) => {
      if (book.accessModel) seen.add(book.accessModel);
    });
    return Array.from(seen);
  }, [books]);

  const filtered = books.filter((book) => {
    if (course && book.courseSlug !== course) return false;
    if (model && book.accessModel !== model) return false;
    const hay =
      `${book.name} ${book.courseName} ${book.instituteName || ''} ${book.lastChapterTitle || ''}`.toLowerCase();
    const needle = query.trim().toLowerCase();
    return !needle || hay.includes(needle);
  });

  if (loading || authLoading) {
    return (
      <main className="container" style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }

  if (needLogin) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Link href={courseLoginHref('/books')} className="course-note-save">
          Login to view your books
        </Link>
      </main>
    );
  }

  return (
    <main className="course-notes-hub">
      <header className="course-notes-hub-head">
        <p className="course-card-kicker">Study</p>
        <h1>My books</h1>
        <p>Every textbook you can open — book bank, library, or a book you bought.</p>
      </header>

      <div className="course-notes-filters">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search books or last chapter"
          aria-label="Search books"
        />
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          aria-label="Filter by course"
        >
          <option value="">All courses</option>
          {courses.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          aria-label="Filter by access"
        >
          <option value="">All access</option>
          {models.map((item) => (
            <option key={item} value={item}>
              {bookAccessLabel(item) || item}
            </option>
          ))}
        </select>
      </div>

      {!filtered.length ? (
        <Empty
          description={
            books.length
              ? 'No books match these filters.'
              : 'No licensed textbooks yet. Browse a course to subscribe, or use a college license.'
          }
        >
          <Link href="/courses" className="course-note-save" style={{ marginRight: 8 }}>
            Browse courses
          </Link>
          <Link href="/courses" className="vv-course-btn is-subscribe">
            Subscribe
          </Link>
        </Empty>
      ) : (
        <CourseGrid variant="book">
          {filtered.map((book) => (
            <CourseBookTile
              key={book.id}
              title={book.name}
              subtitle={[
                book.courseName,
                `Sem ${book.semesterNumber}`,
                book.instituteName,
                book.lastChapterTitle
                  ? `Last: ${book.lastChapterTitle}${book.lastPageNumber ? ` p.${book.lastPageNumber}` : ''}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              coverKey={book.coverKey}
              href={book.href}
              seed={book.id}
              owned
              tag={bookAccessLabel(book.accessModel)}
            />
          ))}
        </CourseGrid>
      )}
    </main>
  );
}
