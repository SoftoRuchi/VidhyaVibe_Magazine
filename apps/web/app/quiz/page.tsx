'use client';

import { Button, Card, Progress, Radio, Space, Typography } from 'antd';
import Image from 'next/image';
import React from 'react';
import childImg from '../../components/images/child.png';

type QuizQ = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

const QUESTIONS: QuizQ[] = [
  {
    id: 'q1',
    question: 'Which planet is known as the Red Planet?',
    options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
    answerIndex: 1,
    explanation: 'Mars looks reddish because of iron-rich dust.',
  },
  {
    id: 'q2',
    question: 'How many days are there in a leap year?',
    options: ['365', '366', '364', '367'],
    answerIndex: 1,
  },
  {
    id: 'q3',
    question: 'Which animal is the largest on Earth?',
    options: ['Elephant', 'Giraffe', 'Blue whale', 'Shark'],
    answerIndex: 2,
  },
  {
    id: 'q4',
    question: 'What do plants need to make their food?',
    options: ['Moonlight', 'Sunlight', 'Thunder', 'Snow'],
    answerIndex: 1,
  },
  {
    id: 'q5',
    question: 'Which one is NOT a continent?',
    options: ['Asia', 'Africa', 'Greenland', 'Antarctica'],
    answerIndex: 2,
  },
  {
    id: 'q6',
    question: 'How many sides does a triangle have?',
    options: ['2', '3', '4', '5'],
    answerIndex: 1,
  },
  {
    id: 'q7',
    question: 'What is H2O commonly called?',
    options: ['Salt', 'Water', 'Sugar', 'Sand'],
    answerIndex: 1,
  },
  {
    id: 'q8',
    question: 'Which is the fastest land animal?',
    options: ['Cheetah', 'Lion', 'Horse', 'Rabbit'],
    answerIndex: 0,
  },
];

function pickFive(): QuizQ[] {
  const copy = [...QUESTIONS];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 5);
}

export default function QuizPage() {
  const [quiz, setQuiz] = React.useState<QuizQ[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, number | null>>({});
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch('/api/quiz', { cache: 'no-store' });
      const j = await r.json();
      if (cancelled) return;
      const items: QuizQ[] = (j.items || []).map((it: any, i: number) => ({
        id: `q${i + 1}`,
        question: it.question,
        options: it.options,
        answerIndex: it.answerIndex,
      }));
      setQuiz(items);
      setAnswers(Object.fromEntries(items.map((q) => [q.id, null])));
      setIdx(0);
      setSubmitted(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = quiz[idx] as QuizQ | undefined;
  const total = quiz.length || 0;
  const answeredCount = quiz.length ? quiz.filter((qq) => answers[qq.id] != null).length : 0;

  const score = submitted
    ? quiz.reduce((acc, qq) => acc + (answers[qq.id] === qq.answerIndex ? 1 : 0), 0)
    : 0;

  const canSubmit = answeredCount === total;

  return (
    <main style={{ padding: '1.25rem 0 2.25rem', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: 900 }}>
        {/* Themed heading */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '84px 1fr 84px',
            alignItems: 'center',
            padding: '0.35rem 0',
            marginBottom: '1.0rem',
          }}
        >
          <div />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Image
              src={childImg}
              alt="Quiz"
              width={84}
              height={84}
              style={{ width: 84, height: 84, objectFit: 'contain' }}
              priority
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '2.05rem',
                  fontWeight: 800,
                  color: '#3d2914',
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.2px',
                  textAlign: 'center',
                }}
              >
                Daily Quiz
              </h1>
              <div
                style={{
                  width: '55%',
                  maxWidth: 240,
                  height: 3,
                  backgroundColor: '#3d2914',
                  borderRadius: 999,
                  marginTop: 8,
                  opacity: 0.95,
                }}
              />
            </div>
          </div>
          <div />
        </div>

        <Card
          style={{
            borderRadius: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.78)',
            border: '1px solid rgba(61,41,20,0.18)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
          }}
          bodyStyle={{ padding: '1.4rem 1.6rem' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Typography.Text style={{ color: '#3d2914', fontWeight: 700 }}>
              Question {idx + 1} / {total}
            </Typography.Text>
            <div style={{ width: 200 }}>
              <Progress
                percent={Math.round((answeredCount / total) * 100)}
                showInfo={false}
                strokeColor="#3d2914"
              />
            </div>
          </div>

          {q ? (
            <>
              <div style={{ marginTop: 14 }}>
                <Typography.Title level={4} style={{ margin: 0, color: '#2c1810' }}>
                  {q.question}
                </Typography.Title>
              </div>

              <div style={{ marginTop: 14 }}>
                <Radio.Group
                  value={answers[q.id] ?? undefined}
                  disabled={submitted}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: Number(e.target.value) }))
                  }
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {q.options.map((opt, i) => {
                    const chosen = answers[q.id] === i;
                    const correct = i === q.answerIndex;
                    const show = submitted;
                    const bg = show
                      ? correct
                        ? 'rgba(45,122,62,0.16)'
                        : chosen
                          ? 'rgba(192,57,43,0.16)'
                          : 'transparent'
                      : 'transparent';
                    const border = show
                      ? correct
                        ? 'rgba(45,122,62,0.55)'
                        : chosen
                          ? 'rgba(192,57,43,0.55)'
                          : 'rgba(61,41,20,0.18)'
                      : 'rgba(61,41,20,0.18)';

                    return (
                      <div
                        key={opt}
                        style={{
                          border: `1px solid ${border}`,
                          borderRadius: 12,
                          padding: '0.55rem 0.75rem',
                          background: bg,
                        }}
                      >
                        <Radio value={i}>{opt}</Radio>
                      </div>
                    );
                  })}
                </Radio.Group>
              </div>
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#5c4a3a' }}>Loading…</div>
          )}

          {submitted && (
            <div style={{ marginTop: 14 }}>
              <Typography.Text style={{ color: '#5c4a3a' }}>{q?.explanation ?? ''}</Typography.Text>
            </div>
          )}

          <div
            style={{
              marginTop: 18,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Space>
              <Button
                disabled={idx === 0}
                onClick={() => setIdx((v) => Math.max(0, v - 1))}
                style={{ borderRadius: 999 }}
              >
                Prev
              </Button>
              <Button
                disabled={idx === total - 1}
                onClick={() => setIdx((v) => Math.min(total - 1, v + 1))}
                style={{ borderRadius: 999 }}
              >
                Next
              </Button>
            </Space>

            {!submitted ? (
              <Button
                type="default"
                disabled={!canSubmit}
                onClick={() => setSubmitted(true)}
                style={{
                  borderRadius: 999,
                  background: 'var(--btn-view-green, #2d7a3e)',
                  borderColor: 'var(--btn-view-green, #2d7a3e)',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                Submit
              </Button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Typography.Text style={{ color: '#3d2914', fontWeight: 700 }}>
                  Score: {score}/{total}
                </Typography.Text>
                <Button
                  onClick={() => window.location.reload()}
                  style={{
                    borderRadius: 999,
                    background: 'var(--btn-read-red, #c0392b)',
                    borderColor: 'var(--btn-read-red, #c0392b)',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  Try New Quiz
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
