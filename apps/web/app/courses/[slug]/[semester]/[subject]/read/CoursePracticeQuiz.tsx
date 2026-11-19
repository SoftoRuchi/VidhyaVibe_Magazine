'use client';

import Link from 'next/link';
import React from 'react';
import { useAuth } from '../../../../../../lib/authContext';
import {
  completeLearnActivity,
  courseLoginHref,
  fetchChapter,
  startLearnActivity,
} from '../../../../../../lib/coursesApi';

export type PracticeQuestion = { prompt: string; options: string[]; correctIndex?: number };

export function pickPracticeActivity(activities: any[] | undefined | null) {
  const acts = Array.isArray(activities) ? activities : [];
  return (
    acts.find((a: any) => a.activityType === 'QUIZ' && a.placement === 'PRACTICE') ||
    acts.find((a: any) => a.activityType === 'QUIZ') ||
    acts.find((a: any) => a.placement === 'PRACTICE') ||
    null
  );
}

export function questionsFromActivity(activity: any): PracticeQuestion[] {
  if (!activity) return [];
  if (Array.isArray(activity?.config?.questions)) return activity.config.questions;
  if (activity?.config?.prompt) {
    return [
      {
        prompt: activity.config.prompt,
        options: (activity.config.options || []).map((o: any) =>
          typeof o === 'string' ? o : o.label,
        ),
        correctIndex:
          activity.config.correctIndex ??
          (activity.config.options || []).findIndex(
            (o: any) => String(o?.id ?? o) === String(activity.config.correctOptionId || ''),
          ),
      },
    ];
  }
  return [];
}

function scoreLocally(questions: PracticeQuestion[], answers: number[]) {
  let correct = 0;
  questions.forEach((q, i) => {
    if (q.correctIndex != null && answers[i] === q.correctIndex) correct += 1;
  });
  const total = questions.length || 1;
  return { correct, total, score: Math.round((correct / total) * 100) };
}

export default function CoursePracticeQuiz({
  activity: activityProp,
  chapterId,
  chapterTitle,
  subjectTitle,
  kicker,
  closeLabel = 'Back to book',
  embedded = false,
  onClose,
}: {
  activity?: any | null;
  chapterId?: number | null;
  chapterTitle?: string;
  subjectTitle?: string;
  kicker?: string;
  closeLabel?: string;
  embedded?: boolean;
  onClose: () => void;
}) {
  const { loggedIn } = useAuth();
  const [activity, setActivity] = React.useState<any | null>(activityProp || null);
  const [loading, setLoading] = React.useState(!activityProp && Boolean(chapterId));
  const [answers, setAnswers] = React.useState<number[]>(() => {
    const qs = questionsFromActivity(activityProp);
    return Array(qs.length).fill(-1);
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [practiceOnly, setPracticeOnly] = React.useState(false);
  const [error, setError] = React.useState('');
  const startedAt = React.useRef(Date.now());

  React.useEffect(() => {
    if (activityProp) {
      setActivity(activityProp);
      const qs = questionsFromActivity(activityProp);
      setAnswers(Array(qs.length).fill(-1));
      startedAt.current = Date.now();
    }
  }, [activityProp]);

  React.useEffect(() => {
    if (activityProp || !chapterId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ch = await fetchChapter(chapterId);
        if (cancelled) return;
        const quiz = pickPracticeActivity(ch.activities);
        setActivity(quiz);
        const qs = questionsFromActivity(quiz);
        setAnswers(Array(qs.length).fill(-1));
        startedAt.current = Date.now();
        if (quiz?.id) {
          try {
            await startLearnActivity(quiz.id);
          } catch (e: any) {
            if (e?.response?.status === 409) setPracticeOnly(true);
          }
        }
      } catch {
        if (!cancelled) setError('Could not load practice questions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityProp, chapterId]);

  React.useEffect(() => {
    if (!activityProp?.id) return;
    let cancelled = false;
    (async () => {
      try {
        await startLearnActivity(activityProp.id);
      } catch (e: any) {
        if (!cancelled && e?.response?.status === 409) setPracticeOnly(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityProp?.id]);

  const questions = questionsFromActivity(activity);

  const submit = async () => {
    if (!activity || submitting) return;
    if (answers.some((a) => a < 0)) {
      setError('Answer every question before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);
    const timeSpentSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const payload =
      questions.length > 1 || activity.activityType === 'QUIZ'
        ? { answers: answers.map((selectedIndex) => ({ selectedIndex })) }
        : {
            selectedIndex: answers[0],
            selectedOptionId: activity.config?.options?.[answers[0]]?.id,
          };
    try {
      if (!practiceOnly) {
        const res = await completeLearnActivity(activity.id, payload, timeSpentSec);
        setResult(res.data);
        setSubmitting(false);
        return;
      }
    } catch (e: any) {
      if (e?.response?.status !== 409) {
        setError(e.response?.data?.message || e.response?.data?.error || 'Could not submit');
        setSubmitting(false);
        return;
      }
      setPracticeOnly(true);
    }
    const local = scoreLocally(questions, answers);
    setResult({
      resultStatus: local.score === 100 ? 'CORRECT' : local.score >= 50 ? 'PARTIAL' : 'INCORRECT',
      resultMessage: practiceOnly
        ? 'Practice score (already submitted earlier).'
        : 'Practice score.',
      score: local.score,
      details: { correctCount: local.correct, total: local.total },
    });
    setSubmitting(false);
  };

  return (
    <div className="course-practice-panel">
      <div className="course-practice-toolbar">
        {embedded ? (
          <p className="course-card-kicker" style={{ margin: 0 }}>
            {kicker || chapterTitle}
          </p>
        ) : (
          <button type="button" className="course-practice-back" onClick={onClose}>
            ← {subjectTitle || closeLabel}
          </button>
        )}
        <div className="course-mode-switch" role="tablist" aria-label="Study mode">
          <button type="button" onClick={onClose}>
            Read
          </button>
          <span className="course-mode-switch-active">Practice</span>
        </div>
      </div>

      {!loggedIn ? (
        <div className="course-practice-body">
          <p className="course-notes-empty">Login to take this chapter quiz.</p>
          <Link href={courseLoginHref()} className="course-note-save">
            Login to practise
          </Link>
        </div>
      ) : loading ? (
        <p className="course-notes-empty">Loading practice questions…</p>
      ) : !activity || questions.length === 0 ? (
        <p className="course-notes-empty">No practice quiz is attached to this chapter yet.</p>
      ) : (
        <div className="course-practice-body">
          {embedded ? null : kicker || chapterTitle ? (
            <p className="course-card-kicker">{kicker || chapterTitle}</p>
          ) : null}
          <h1 id="course-practice-overlay-title" className="course-page-title">
            {activity.title || 'Chapter Quiz'}
          </h1>
          <p className="course-page-lead">
            {activity.instructions || 'Answer each question, then submit to see your score.'}
          </p>
          {practiceOnly ? (
            <p className="course-callout">
              You already submitted this quiz. You can still practise locally.
            </p>
          ) : null}
          {error ? <p className="course-quick-result is-bad">{error}</p> : null}

          {result ? (
            <div className="course-quiz-result">
              <h3>
                Score: {result.score ?? 0}%
                {result.details?.correctCount != null
                  ? ` (${result.details.correctCount}/${result.details.total})`
                  : ''}
              </h3>
              <p>{result.resultMessage}</p>
              {result.explanation ? <p>{result.explanation}</p> : null}
              <button type="button" className="course-note-save" onClick={onClose}>
                {closeLabel}
              </button>
            </div>
          ) : (
            <form
              className="course-quiz-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {questions.map((q, qi) => (
                <article key={qi} className="course-quiz-q">
                  <h2>
                    {qi + 1}. {q.prompt}
                  </h2>
                  <div className="course-quiz-opts" role="radiogroup" aria-label={`Question ${qi + 1}`}>
                    {(q.options || []).map((opt, oi) => (
                      <label
                        key={oi}
                        className={`course-quiz-opt${answers[qi] === oi ? ' is-on' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`practice-q-${qi}`}
                          checked={answers[qi] === oi}
                          onChange={() => {
                            const next = [...answers];
                            next[qi] = oi;
                            setAnswers(next);
                            setError('');
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </article>
              ))}
              <button type="submit" className="course-note-save" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit quiz'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
