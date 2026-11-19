'use client';

import Link from 'next/link';
import React from 'react';
import WordNotesEditor from '../../../../../../components/WordNotesEditor';
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
  fullScreen = false,
  onFullScreen,
  allNotesHref = '/notes',
  openHref,
  variant = 'rail',
  onJumpPage,
  onClose,
  onSave,
  onUpdate,
  onDelete,
}: {
  notes: CourseNoteItem[];
  chapterTitle?: string;
  pageNumber?: number;
  quote?: string;
  onQuoteChange?: (value: string) => void;
  fullScreen?: boolean;
  onFullScreen?: () => void;
  allNotesHref?: string;
  openHref?: string;
  variant?: 'rail' | 'page';
  onJumpPage?: (page: number) => void;
  onClose?: () => void;
  onSave: (content: string, quote?: string) => Promise<{ id: number } | void>;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { loggedIn } = useAuth();

  if (!loggedIn) {
    return (
      <div className={`course-notes-panel${fullScreen ? ' is-fullscreen' : ''}`}>
        <p className="course-notes-empty">Login to create and view notes for this chapter.</p>
        <Link href={courseLoginHref()} className="course-note-save">
          Login to write notes
        </Link>
      </div>
    );
  }

  const editor = (
    <WordNotesEditor
      notes={notes}
      quote={quote}
      onQuoteChange={onQuoteChange}
      compact={variant !== 'page'}
      onSave={onSave}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );

  const closeButton = onClose ? (
    <button
      type="button"
      className="course-notes-close-icon-btn"
      onClick={onClose}
      title="Close notes and return to book"
      aria-label="Close notes"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  ) : onFullScreen ? (
    <button
      type="button"
      className="course-notes-close-icon-btn"
      onClick={onFullScreen}
      title={fullScreen ? 'Close notes and return to book' : 'Full screen'}
      aria-label={fullScreen ? 'Close notes' : 'Full screen'}
    >
      {fullScreen ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      )}
    </button>
  ) : openHref ? (
    <Link
      href={openHref}
      className="course-notes-close-icon-btn"
      title="Close notes and return to book"
      aria-label="Close notes"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </Link>
  ) : null;

  if (variant === 'page') {
    return (
      <div className={`course-notes-panel is-page${fullScreen ? ' is-fullscreen' : ''}`}>
        <header className="onenote-page-bar">
          <div>
            <p className="onenote-kicker">Notes</p>
            <h1 id={fullScreen ? 'course-notes-overlay-title' : undefined}>{chapterTitle || 'Notes'}</h1>
          </div>
          <div className="course-notes-panel-links">
            {closeButton}
          </div>
        </header>
        {pageNumber && onJumpPage ? (
          <p className="word-notes-kicker">
            Currently on page {pageNumber}.{' '}
            <button type="button" className="course-note-page" onClick={() => onJumpPage(pageNumber)}>
              Jump to this page
            </button>
          </p>
        ) : null}
        <div className="onenote-page-scroll">{editor}</div>
      </div>
    );
  }

  return (
    <div className={`course-notes-panel${fullScreen ? ' is-fullscreen' : ''}`}>
      <div className="course-notes-panel-bar">
        <div>
          <strong id="course-notes-overlay-title">Chapter notes</strong>
          {chapterTitle ? <small>{chapterTitle}</small> : null}
        </div>
        <div className="course-notes-panel-links">
          {onFullScreen ? (
            <button type="button" className="course-notes-fullscreen" onClick={onFullScreen}>
              {fullScreen ? 'Back to book' : 'Full screen'}
            </button>
          ) : null}
          {!fullScreen ? (
            <Link href={allNotesHref} className="course-note-page">
              All notes
            </Link>
          ) : null}
        </div>
      </div>
      {editor}
    </div>
  );
}
