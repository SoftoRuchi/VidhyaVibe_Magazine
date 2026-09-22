'use client';

import { Button, Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React from 'react';
import { CourseAccessBlocked } from '../../../../../../components/CourseBrowse';
import { useAuth } from '../../../../../../lib/authContext';
import {
  addCourseNote,
  courseAccessMessage,
  courseLoginHref,
  deleteCourseNote,
  fetchChapter,
  fetchChapterStudy,
  fetchSemester,
  fetchSubject,
  updateCourseNote,
} from '../../../../../../lib/coursesApi';

type NoteItem = {
  id: number;
  pageNumber?: number | null;
  content: string;
  quote?: string | null;
};

export default function CourseNotesPage() {
  const params = useParams();
  const search = useSearchParams();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const chapterSlug = String(search.get('chapter') || '');
  const pageParam = Number(search.get('page') || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));

  const [subject, setSubject] = React.useState<any>(null);
  const [chapter, setChapter] = React.useState<any>(null);
  const [notes, setNotes] = React.useState<NoteItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [accessError, setAccessError] = React.useState('');
  const [blockedSubjectId, setBlockedSubjectId] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState('');
  const [quote, setQuote] = React.useState('');
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editDraft, setEditDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const pageNumber = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : undefined;

  const loadNotes = React.useCallback((chapterId: number) => {
    fetchChapterStudy(chapterId)
      .then((study) => setNotes(study.notes || []))
      .catch(() => setNotes([]));
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
    if (!slug || !number || !subjectSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const sem = await fetchSemester(slug, number);
        const match = (sem.subjects || []).find((s: any) => s.slug === subjectSlug);
        if (!match) return;
        try {
          const sub = await fetchSubject(match.id);
          const chapters = sub.chapters || [];
          const chMeta = chapters.find((c: any) => c.slug === chapterSlug) || chapters[0];
          if (!chMeta) {
            if (!cancelled) setSubject(sub);
            return;
          }
          const ch = await fetchChapter(chMeta.id);
          if (cancelled) return;
          setSubject(sub);
          setChapter(ch);
          loadNotes(ch.id);
        } catch (e: any) {
          if (e?.response?.status === 401) setNeedLogin(true);
          else if (e?.response?.status === 403) {
            setBlockedSubjectId(match.id);
            setAccessError(courseAccessMessage(e) || 'You do not have access to this book.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, slug, number, subjectSlug, chapterSlug, loadNotes]);

  const base = subject ? `/courses/${slug}/sem-${subject.semester.number}/${subject.slug}` : '';
  const readHref = chapter
    ? `${base}/read?chapter=${encodeURIComponent(chapter.slug)}${pageNumber ? `&page=${pageNumber}` : ''}`
    : base;

  const saveNote = async () => {
    if (!chapter?.id) return;
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      await addCourseNote(chapter.id, content, pageNumber, quote.trim() || undefined);
      setDraft('');
      setQuote('');
      loadNotes(chapter.id);
    } catch {
      alert('Could not save the note. Please login and try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: number) => {
    const content = editDraft.trim();
    if (!content || !chapter?.id) return;
    try {
      await updateCourseNote(id, content);
      setEditingId(null);
      loadNotes(chapter.id);
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
        <Link href={courseLoginHref()}>
          <Button type="primary">Login to write notes</Button>
        </Link>
      </main>
    );
  }
  if (accessError) {
    return (
      <CourseAccessBlocked
        message={accessError}
        backHref={`/courses/${slug}`}
        subjectId={blockedSubjectId}
      />
    );
  }
  if (!subject || !chapter) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Empty description="Chapter not found" />
      </main>
    );
  }

  return (
    <main className="course-notes-page">
      <header className="course-notes-page-head">
        <Link href={readHref} className="course-back">
          ← Back to book
        </Link>
        <h1>Notes</h1>
        <p>
          {subject.name} · {chapter.title}
          {pageNumber ? ` · Page ${pageNumber}` : ''}
        </p>
        <Link href="/notes" className="course-notes-all">
          All notes
        </Link>
      </header>

      <div className="course-notes-split">
        <section className="course-notes-list">
          <h2>Saved notes</h2>
          <div className="course-notes-list-body">
            {notes.length === 0 ? (
              <p className="course-notes-empty">No notes yet for this chapter.</p>
            ) : null}
            {notes.map((n) => (
              <article key={n.id} className="course-note-card">
                {n.pageNumber ? (
                  <Link
                    href={`${base}/read?chapter=${encodeURIComponent(chapter.slug)}&page=${n.pageNumber}`}
                    className="course-note-page"
                  >
                    Page {n.pageNumber}
                  </Link>
                ) : null}
                {n.quote ? (
                  <blockquote className="course-note-quote">“{n.quote}”</blockquote>
                ) : null}
                {editingId === n.id ? (
                  <>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={8}
                    />
                    <div className="course-note-actions">
                      <button type="button" onClick={() => saveEdit(n.id)}>
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{n.content}</p>
                    <div className="course-note-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditDraft(n.content);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCourseNote(n.id).then(() => loadNotes(chapter.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="course-notes-composer">
          <label htmlFor="course-note-draft">Add a note</label>
          {quote ? (
            <blockquote className="course-note-quote">
              “{quote}”{' '}
              <button type="button" className="course-note-page" onClick={() => setQuote('')}>
                Remove quote
              </button>
            </blockquote>
          ) : (
            <p className="course-notes-kicker">
              Select text in the book and tap Add to notes to attach a quote.
            </p>
          )}
          <textarea
            id="course-note-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your note here…"
          />
          <button
            type="button"
            className="course-note-save"
            disabled={saving || !draft.trim()}
            onClick={saveNote}
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </section>
      </div>
    </main>
  );
}
