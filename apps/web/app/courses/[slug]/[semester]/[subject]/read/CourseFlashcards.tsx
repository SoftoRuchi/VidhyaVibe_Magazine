'use client';

import React from 'react';
import type { CourseFlashcard } from '../../../../../../lib/coursesApi';

export default function CourseFlashcards({
  cards,
  onDelete,
}: {
  cards: CourseFlashcard[];
  onDelete?: (id: number) => void;
}) {
  const [queue, setQueue] = React.useState<CourseFlashcard[]>(cards);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [known, setKnown] = React.useState(0);

  React.useEffect(() => {
    setQueue(cards);
    setIndex(0);
    setFlipped(false);
    setKnown(0);
  }, [cards]);

  if (cards.length === 0) {
    return (
      <p className="course-notes-empty">
        No flashcards in this chapter yet. Select a term on the page and tap Flashcard.
      </p>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="course-flash-deck">
        <p className="course-notes-kicker">Done</p>
        <p className="course-flash-result">
          You marked {known} card{known === 1 ? '' : 's'} as known.
        </p>
        <button
          type="button"
          className="course-note-save"
          onClick={() => {
            setQueue(cards);
            setIndex(0);
            setFlipped(false);
            setKnown(0);
          }}
        >
          Restart deck
        </button>
      </div>
    );
  }

  const card = queue[Math.min(index, queue.length - 1)];
  const go = (next: number) => {
    setIndex((next + queue.length) % queue.length);
    setFlipped(false);
  };

  return (
    <div className="course-flash-deck">
      <p className="course-notes-kicker">
        Flashcards · {Math.min(index + 1, queue.length)} of {queue.length}
        {known ? ` · ${known} known` : ''}
      </p>
      <button
        type="button"
        className={`course-flash-card${flipped ? ' is-back' : ''}`}
        onClick={() => setFlipped((v) => !v)}
      >
        <span className="course-flash-side">{flipped ? 'Answer' : 'Term'}</span>
        <strong>{flipped ? card.back : card.front}</strong>
        <small>Tap to flip</small>
      </button>
      <div className="course-flash-actions">
        <button type="button" onClick={() => go(index - 1)} disabled={queue.length < 2}>
          Previous
        </button>
        <button
          type="button"
          className="course-flash-again"
          onClick={() => {
            const rest = queue.filter((_, i) => i !== index);
            setQueue([...rest, card]);
            setIndex(0);
            setFlipped(false);
          }}
        >
          Again
        </button>
        <button
          type="button"
          className="course-note-save"
          onClick={() => {
            const rest = queue.filter((_, i) => i !== index);
            setQueue(rest);
            setIndex(0);
            setFlipped(false);
            setKnown((n) => n + 1);
          }}
        >
          Knew it
        </button>
        <button type="button" onClick={() => go(index + 1)} disabled={queue.length < 2}>
          Next
        </button>
      </div>
      {card.owned && onDelete ? (
        <button type="button" className="course-note-page" onClick={() => onDelete(card.id)}>
          Remove my card
        </button>
      ) : null}
    </div>
  );
}
