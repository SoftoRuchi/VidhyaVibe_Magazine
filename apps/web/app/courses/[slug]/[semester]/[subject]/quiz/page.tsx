'use client';

import { Button, Empty, Radio, Spin, message } from 'antd';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React from 'react';
import { useAuth } from '../../../../../../lib/authContext';
import {
  completeLearnActivity,
  courseLoginHref,
  fetchChapter,
  fetchSemester,
  fetchSubject,
  startLearnActivity,
} from '../../../../../../lib/coursesApi';

type Question = { prompt: string; options: string[]; correctIndex?: number };

function scoreLocally(questions: Question[], answers: number[]) {
  let correct = 0;
  questions.forEach((q, i) => {
    if (q.correctIndex != null && answers[i] === q.correctIndex) correct += 1;
  });
  const total = questions.length || 1;
  return { correct, total, score: Math.round((correct / total) * 100) };
}

export default function CourseQuizPage() {
  const params = useParams();
  const search = useSearchParams();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const chapterSlug = String(search.get('chapter') || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));

  const [subject, setSubject] = React.useState<any>(null);
  const [chapter, setChapter] = React.useState<any>(null);
  const [activity, setActivity] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [answers, setAnswers] = React.useState<number[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [practiceOnly, setPracticeOnly] = React.useState(false);
  const startedAt = React.useRef<number>(Date.now());

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
        const sub = await fetchSubject(match.id);
        const chapters = sub.chapters || [];
        const chMeta = chapters.find((c: any) => c.slug === chapterSlug) || chapters[0];
        if (!chMeta) {
          if (!cancelled) setSubject(sub);
          return;
        }
        const ch = await fetchChapter(chMeta.id);
        const acts = ch.activities || [];
        const quiz =
          acts.find((a: any) => a.activityType === 'QUIZ' && a.placement === 'PRACTICE') ||
          acts.find((a: any) => a.activityType === 'QUIZ') ||
          acts.find((a: any) => a.placement === 'PRACTICE') ||
          acts[0];
        if (cancelled) return;
        setSubject(sub);
        setChapter(ch);
        setActivity(quiz || null);
        const questions: Question[] = Array.isArray(quiz?.config?.questions)
          ? quiz.config.questions
          : [];
        setAnswers(Array(questions.length).fill(-1));
        startedAt.current = Date.now();
        if (quiz?.id) {
          try {
            await startLearnActivity(quiz.id);
          } catch (e: any) {
            if (e?.response?.status === 409) setPracticeOnly(true);
          }
        }
      } catch (e: any) {
        if (e?.response?.status === 401) setNeedLogin(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, slug, number, subjectSlug, chapterSlug]);

  const questions: Question[] = Array.isArray(activity?.config?.questions)
    ? activity.config.questions
    : activity?.config?.prompt
      ? [
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
        ]
      : [];

  const submit = async () => {
    if (!activity || submitting) return;
    if (answers.some((a) => a < 0)) {
      message.warning('Answer every question before submitting.');
      return;
    }
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
        message.error(e.response?.data?.message || e.response?.data?.error || 'Could not submit');
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
          <Button type="primary">Login to take the quiz</Button>
        </Link>
      </main>
    );
  }
  if (!subject || !chapter) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Empty description="Chapter not found" />
      </main>
    );
  }

  const base = `/courses/${slug}/sem-${subject.semester.number}/${subject.slug}`;

  if (!activity || questions.length === 0) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Link href={`${base}/read?chapter=${chapter.slug}`} className="course-back">
          ← Back to chapter
        </Link>
        <Empty description="No quiz is attached to this chapter yet." />
      </main>
    );
  }

  return (
    <main className="container course-quiz-page" style={{ padding: '16px 16px 80px' }}>
      <Link href={base} className="course-back">
        ← {subject.name}
      </Link>
      <div className="course-mode-switch">
        <Link href={`${base}/read?chapter=${chapter.slug}`}>Read</Link>
        <span className="course-mode-switch-active">Practice</span>
      </div>
      <p className="course-card-kicker">
        {subject.course.name} · {chapter.title}
      </p>
      <h1 className="course-page-title">{activity.title}</h1>
      {activity.instructions ? <p className="course-page-lead">{activity.instructions}</p> : null}
      {practiceOnly ? (
        <p className="course-callout">
          You already submitted this quiz. You can still practise locally.
        </p>
      ) : null}

      {result ? (
        <div className="course-quiz-result">
          <h2>
            Score: {result.score ?? 0}%
            {result.details?.correctCount != null
              ? ` (${result.details.correctCount}/${result.details.total})`
              : ''}
          </h2>
          <p>{result.resultMessage}</p>
          {result.explanation ? <p>{result.explanation}</p> : null}
          <Link href={`${base}/read?chapter=${chapter.slug}`}>
            <Button type="primary">Back to chapter</Button>
          </Link>
        </div>
      ) : (
        <form
          className="course-quiz-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {questions.map((q, qi) => (
            <fieldset key={qi} className="course-quiz-q">
              <legend>
                {qi + 1}. {q.prompt}
              </legend>
              <Radio.Group
                value={answers[qi]}
                onChange={(e) => {
                  const next = [...answers];
                  next[qi] = e.target.value;
                  setAnswers(next);
                }}
              >
                {(q.options || []).map((opt, oi) => (
                  <Radio key={oi} value={oi} style={{ display: 'block', margin: '8px 0' }}>
                    {opt}
                  </Radio>
                ))}
              </Radio.Group>
            </fieldset>
          ))}
          <Button type="primary" htmlType="submit" loading={submitting}>
            Submit quiz
          </Button>
        </form>
      )}
    </main>
  );
}
