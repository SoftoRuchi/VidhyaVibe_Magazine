'use client';

import Link from 'next/link';
import React from 'react';
import { useAuth } from '../../../../../../lib/authContext';
import { courseLoginHref } from '../../../../../../lib/coursesApi';

export type CourseNoteItem = {
  id: number;
  pageNumber?: number | null;
  content: string;
  quote?: string | null;
};

export default function CourseNotesPanel({
  notes,
  chapterTitle,
  pageNumber,
  quote = '',
  onQuoteChange,
  fullScreenHref,
  allNotesHref = '/notes',
  onJumpPage,
  onSave,
  onUpdate,
  onDelete,
}: {
  notes: CourseNoteItem[];
  chapterTitle?: string;
  pageNumber?: number;
  quote?: string;
  onQuoteChange?: (value: string) => void;
  fullScreenHref?: string;
  allNotesHref?: string;
  onJumpPage?: (page: number) => void;
  onSave: (content: string, quote?: string) => Promise<void>;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { loggedIn } = useAuth();
  const [draft, setDraft] = React.useState('');
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editDraft, setEditDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const draftRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (quote) draftRef.current?.focus();
  }, [quote]);

  const saveNote = async () => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      await onSave(content, quote.trim() || undefined);
      setDraft('');
      onQuoteChange?.('');
    } catch {
      alert('Could not save the note. Please login and try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: number) => {
    const content = editDraft.trim();
    if (!content) return;
    try {
      await onUpdate(id, content);
      setEditingId(null);
    } catch {
      alert('Could not update the note.');
    }
  };

  if (!loggedIn) {
    return (
      <div className="course-notes-panel">
        <p className="course-notes-empty">Login to create and view notes for this chapter.</p>
        <Link href={courseLoginHref()} className="course-note-save">
          Login to write notes
        </Link>
      </div>
    );
  }

  return (
    <div className="course-notes-panel">
      <div className="course-notes-panel-bar">
        <div>
          <strong>Chapter notes</strong>
          {chapterTitle ? <small>{chapterTitle}</small> : null}
        </div>
        <div className="course-notes-panel-links">
          {fullScreenHref ? (
            <Link
              href={fullScreenHref}
              className="course-notes-fullscreen"
              onClick={() => {
                if (!quote.trim()) return;
                try {
                  window.sessionStorage.setItem('vv_pending_note_quote', quote.trim());
                } catch {
                  /* ignore */
                }
              }}
            >
              Full screen
            </Link>
          ) : null}
          <Link href={allNotesHref} className="course-note-page">
            All notes
          </Link>
        </div>
      </div>

      <div className="course-notes-list-body">
        {notes.length === 0 ? (
          <p className="course-notes-empty">No notes yet for this chapter. Write one below.</p>
        ) : null}
        {notes.map((note) => (
          <article key={note.id} className="course-note-card">
            {note.pageNumber ? (
              onJumpPage ? (
                <button
                  type="button"
                  className="course-note-page"
                  onClick={() => onJumpPage(note.pageNumber as number)}
                >
                  Page {note.pageNumber}
                </button>
              ) : (
                <span className="course-note-page">Page {note.pageNumber}</span>
              )
            ) : null}
            {note.quote ? (
              <blockquote className="course-note-quote">“{note.quote}”</blockquote>
            ) : null}
            {editingId === note.id ? (
              <>
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={5}
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
                  <button type="button" onClick={() => onDelete(note.id)}>
                    Remove
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      <div className="course-notes-composer-mini">
        <label htmlFor="course-note-rail-draft">Add a note</label>
        {quote ? (
          <blockquote className="course-note-quote">
            “{quote}”{' '}
            <button type="button" className="course-note-page" onClick={() => onQuoteChange?.('')}>
              Remove quote
            </button>
          </blockquote>
        ) : (
          <p className="course-notes-kicker">
            {pageNumber ? `Saved to page ${pageNumber}. ` : ''}
            Select text in the book and tap Add to notes to attach a quote.
          </p>
        )}
        <textarea
          id="course-note-rail-draft"
          ref={draftRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write your note here…"
          rows={5}
        />
        <button
          type="button"
          className="course-note-save"
          disabled={saving || !draft.trim()}
          onClick={saveNote}
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}
