'use client';

import React from 'react';
import type { CourseQuickCheckItem } from '../../../../../../lib/coursesApi';

export type ParsedBookQuiz = {
  label: string;
  prompt: string;
  explanation: string;
  options: string[];
  answer: number;
};

function cleanChoice(raw: string) {
  const text = raw.replace(/\s+/g, ' ').trim();
  const marked =
    /^\*\s*/.test(text) ||
    /\s+\*\s*$/.test(text) ||
    /\((correct|right|answer)\)\s*$/i.test(text);
  const label = text
    .replace(/^\*\s*/, '')
    .replace(/\s+\*\s*$/, '')
    .replace(/\s*\((correct|right|answer)\)\s*$/i, '')
    .trim();
  return { label, marked };
}

export function parseBookQuiz(html: string, fallbackAnswer = 0): ParsedBookQuiz {
  const wrap = document.createElement('div');
  wrap.innerHTML = html || '';
  const label = (wrap.querySelector('.course-kicker')?.textContent || 'Quick check').trim();
  const prompt = (wrap.querySelector('.course-quick-prompt')?.textContent || '').trim();
  const explanation = (wrap.querySelector('.course-quick-explain')?.textContent || '').trim();
  const optionBox = wrap.querySelector('.course-quick-options');
  let nodes = Array.from(
    wrap.querySelectorAll(
      '.course-quick-options [data-opt], .course-quick-options button, .course-quick-options li',
    ),
  );
  if (!nodes.length && optionBox) nodes = Array.from(optionBox.children);
  let answer = Number.isFinite(fallbackAnswer) ? fallbackAnswer : 0;
  let markedAnswer = -1;
  const options = nodes.map((node, i) => {
    const choice = cleanChoice(node.textContent || '');
    if (choice.marked) markedAnswer = i;
    return choice.label;
  });
  if (markedAnswer >= 0) answer = markedAnswer;
  if (answer < 0 || answer >= options.length) answer = 0;
  return { label, prompt, explanation, options, answer };
}

export function CourseQuizPrompt({
  html,
  fallbackAnswer = 0,
  picked,
  onPick,
}: {
  html: string;
  fallbackAnswer?: number;
  picked: number | null;
  onPick: (index: number) => void;
}) {
  const quiz = React.useMemo(() => parseBookQuiz(html, fallbackAnswer), [html, fallbackAnswer]);
  const revealed = picked != null;
  const correct = revealed && picked === quiz.answer;
  if (!quiz.options.length) return null;
  return (
    <div className="course-quick-block">
      <p className="course-kicker">{quiz.label}</p>
      <p className="course-quick-prompt">{quiz.prompt}</p>
      <div className="course-quick-options" role="listbox" aria-label={quiz.prompt || quiz.label}>
        {quiz.options.map((opt, i) => {
          const state = !revealed
            ? ''
            : i === quiz.answer
              ? 'is-right'
              : i === picked
                ? 'is-wrong'
                : '';
          return (
            <button
              key={`${opt}-${i}`}
              type="button"
              className={state}
              aria-pressed={picked === i}
              disabled={revealed}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (revealed) return;
                onPick(i);
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {revealed ? (
        <p className={`course-quick-result${correct ? ' is-ok' : ' is-bad'}`}>
          {correct
            ? 'Correct.'
            : `Incorrect. The correct answer is ${quiz.options[quiz.answer] || ''}.`}
          {quiz.explanation ? ` ${quiz.explanation}` : ''}
        </p>
      ) : null}
    </div>
  );
}

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
  const choices = question.options.map((opt) => cleanChoice(opt));
  const marked = choices.findIndex((choice) => choice.marked);
  const correct = marked >= 0 ? marked : question.correctIndex;
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
        {choices.map((choice, i) => {
          const opt = choice.label;
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
          {ok
            ? 'Correct.'
            : wrong
              ? `Incorrect. The correct answer is ${choices[Number(correct)]?.label || ''}.`
              : 'Checked.'}{' '}
          {question.explanation || ''}
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
            Done. Keep reading, or open Practice for the full chapter quiz.
          </p>
        )}
      </div>
    </div>
  );
}
