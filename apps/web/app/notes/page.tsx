'use client';

import { Empty, Spin } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useAuth } from '../../lib/authContext';
import {
  courseLoginHref,
  deleteCourseNote,
  fetchAllCourseNotes,
  updateCourseNote,
  type CourseNoteRecord,
} from '../../lib/coursesApi';
import { isChildAudience } from '../../lib/viewingContext';

function uniqueOptions(
  notes: CourseNoteRecord[],
  key: keyof Pick<CourseNoteRecord, 'courseSlug' | 'subjectSlug' | 'chapterSlug'>,
  label: keyof Pick<CourseNoteRecord, 'courseName' | 'subjectName' | 'chapterTitle'>,
) {
  const seen = new Map<string, string>();
  notes.forEach((note) => {
    const value = String(note[key] || '');
    if (value && !seen.has(value)) seen.set(value, String(note[label] || value));
  });
  return Array.from(seen.entries()).map(([value, text]) => ({ value, label: text }));
}

export default function NotesHubPage() {
  const router = useRouter();
  const { loggedIn, loading: authLoading } = useAuth();
  const [notes, setNotes] = React.useState<CourseNoteRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [book, setBook] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [chapter, setChapter] = React.useState('');
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editDraft, setEditDraft] = React.useState('');

  const loadNotes = React.useCallback(() => {
    fetchAllCourseNotes()
      .then(setNotes)
      .catch((e: any) => {
        if (e?.response?.status === 401) setNeedLogin(true);
        setNotes([]);
      });
  }, []);

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
    fetchAllCourseNotes()
      .then((rows) => {
        if (!cancelled) setNotes(rows);
      })
      .catch((e: any) => {
        if (cancelled) return;
        if (e?.response?.status === 401) setNeedLogin(true);
        setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, router]);

  const books = uniqueOptions(notes, 'courseSlug', 'courseName');
  const topics = uniqueOptions(
    notes.filter((n) => !book || n.courseSlug === book),
    'subjectSlug',
    'subjectName',
  );
  const chapters = uniqueOptions(
    notes.filter((n) => (!book || n.courseSlug === book) && (!topic || n.subjectSlug === topic)),
    'chapterSlug',
    'chapterTitle',
  );

  const filtered = notes.filter((note) => {
    if (book && note.courseSlug !== book) return false;
    if (topic && note.subjectSlug !== topic) return false;
    if (chapter && note.chapterSlug !== chapter) return false;
    const hay =
      `${note.content} ${note.quote || ''} ${note.chapterTitle} ${note.subjectName} ${note.courseName}`.toLowerCase();
    const needle = query.trim().toLowerCase();
    return !needle || hay.includes(needle);
  });

  const saveEdit = async (id: number) => {
    const content = editDraft.trim();
    if (!content) return;
    try {
      await updateCourseNote(id, content);
      setEditingId(null);
      loadNotes();
    } catch {
      alert('Could not update the note.');
    }
  };

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
        <Link href={courseLoginHref('/notes')} className="course-note-save">
          Login to view notes
        </Link>
      </main>
    );
  }

  return (
    <main className="course-notes-hub">
      <header className="course-notes-hub-head">
        <p className="course-card-kicker">Study</p>
        <h1>Notes</h1>
        <p>
          Find and manage every note by book, chapter, or topic — without opening the chapter first.
        </p>
      </header>

      <div className="course-notes-filters">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, quotes, or topics"
          aria-label="Search notes"
        />
        <select
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setTopic('');
            setChapter('');
          }}
          aria-label="Filter by book"
        >
          <option value="">All books</option>
          {books.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setChapter('');
          }}
          aria-label="Filter by topic"
        >
          <option value="">All topics</option>
          {topics.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          aria-label="Filter by chapter"
        >
          <option value="">All chapters</option>
          {chapters.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty
          description={
            notes.length
              ? 'No notes match these filters.'
              : 'No notes yet. Open a chapter and write from the Notes panel while you read.'
          }
        />
      ) : (
        <div className="course-notes-hub-list">
          {filtered.map((note) => (
            <article key={note.id} className="course-note-card course-notes-hub-card">
              <div className="course-notes-hub-meta">
                <span>
                  {note.courseName} · {note.subjectName}
                </span>
                <strong>{note.chapterTitle}</strong>
                {note.pageNumber ? <span>Page {note.pageNumber}</span> : null}
              </div>
              {note.quote ? (
                <blockquote className="course-note-quote">“{note.quote}”</blockquote>
              ) : null}
              {editingId === note.id ? (
                <>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={6}
                  />
                  <div className="course-note-actions">
                    <button type="button" onClick={() => saveEdit(note.id)}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>{note.content}</p>
                  <div className="course-note-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditDraft(note.content);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteCourseNote(note.id).then(loadNotes)}>
                      Remove
                    </button>
                    <Link href={note.href}>Open chapter</Link>
                    <Link href={note.notesHref}>Full screen</Link>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
