'use client';

import React from 'react';
import type { CourseQuickCheckItem } from '../../../../../../lib/coursesApi';

export default function CourseQuickCheck({
  item,
  compact = false,
}: {
  item: CourseQuickCheckItem;
  compact?: boolean;
}) {
  const [qIndex, setQIndex] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [revealed, setRevealed] = React.useState(false);
  const question = item.questions[qIndex];
  if (!question) return null;
  const correct = question.correctIndex;
  const ok = revealed && picked != null && correct != null && picked === correct;
  const wrong = revealed && picked != null && correct != null && picked !== correct;

  return (
    <div className={`course-quick-check${compact ? ' is-compact' : ''}`}>
      <p className="course-notes-kicker">
        Quick check{item.questions.length > 1 ? ` · ${qIndex + 1} of ${item.questions.length}` : ''}
      </p>
      <h3>{item.title}</h3>
      <p className="course-quick-prompt">{question.prompt}</p>
      <div className="course-quick-options">
        {question.options.map((opt, i) => {
          const state =
            revealed && correct === i
              ? 'is-right'
              : revealed && picked === i
                ? 'is-wrong'
                : picked === i
                  ? 'is-on'
                  : '';
          return (
            <button
              key={`${item.id}-${qIndex}-${i}`}
              type="button"
              className={state}
              disabled={revealed}
              onClick={() => setPicked(i)}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {revealed ? (
        <p className={`course-quick-result${ok ? ' is-ok' : wrong ? ' is-bad' : ''}`}>
          {ok ? 'Correct.' : wrong ? 'Not quite.' : 'Checked.'} {question.explanation || ''}
        </p>
      ) : null}
      <div className="course-quick-actions">
        {!revealed ? (
          <button
            type="button"
            className="course-note-save"
            disabled={picked == null}
            onClick={() => setRevealed(true)}
          >
            Check
          </button>
        ) : qIndex < item.questions.length - 1 ? (
          <button
            type="button"
            className="course-note-save"
            onClick={() => {
              setQIndex((n) => n + 1);
              setPicked(null);
              setRevealed(false);
            }}
          >
            Next question
          </button>
        ) : (
          <p className="course-notes-kicker">
            Done. Keep reading, or open Practice for the full quiz.
          </p>
        )}
      </div>
    </div>
  );
}
