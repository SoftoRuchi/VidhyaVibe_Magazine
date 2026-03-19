'use client';

import { Button, Card, Input, Tabs, message } from 'antd';
import Image from 'next/image';
import React from 'react';
import childImg from '../../components/images/child.png';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SCRAMBLE_WORDS = [
  'PLANET',
  'ROCKET',
  'OCEAN',
  'ANIMAL',
  'GALAXY',
  'MAGAZINE',
  'SCIENCE',
  'ADVENTURE',
];

function newScramble() {
  const word = SCRAMBLE_WORDS[randInt(0, SCRAMBLE_WORDS.length - 1)];
  const scrambled = shuffle(word.split('')).join('');
  return { word, scrambled: scrambled === word ? shuffle(word.split('')).join('') : scrambled };
}

export default function GamesPage() {
  // Game 1: Word Scramble
  const [{ word, scrambled }, setScramble] = React.useState<{ word: string; scrambled: string }>({
    word: '',
    scrambled: '',
  });
  const [guess, setGuess] = React.useState('');
  const [solved, setSolved] = React.useState(false);

  // Game 2: Quick Math
  const [a, setA] = React.useState(() => randInt(1, 9));
  const [b, setB] = React.useState(() => randInt(1, 9));
  const [mathAns, setMathAns] = React.useState('');
  const [streak, setStreak] = React.useState(0);

  const loadScramble = React.useCallback(async () => {
    const r = await fetch('/api/games/word', { cache: 'no-store' });
    const j = await r.json();
    setScramble({ word: String(j.word || '').toUpperCase(), scrambled: j.scrambled || '' });
  }, []);

  React.useEffect(() => {
    loadScramble();
  }, [loadScramble]);

  const resetScramble = () => {
    loadScramble();
    setGuess('');
    setSolved(false);
  };

  const checkScramble = () => {
    if (guess.trim().toUpperCase() === word) {
      setSolved(true);
      message.success('Correct!');
    } else {
      message.error('Try again!');
    }
  };

  const nextMath = () => {
    setA(randInt(1, 12));
    setB(randInt(1, 12));
    setMathAns('');
  };

  const checkMath = () => {
    const num = Number(mathAns);
    if (!Number.isFinite(num)) return;
    if (num === a + b) {
      const next = streak + 1;
      setStreak(next);
      message.success(`Nice! Streak: ${next}`);
      nextMath();
    } else {
      message.error('Oops! Resetting streak.');
      setStreak(0);
      nextMath();
    }
  };

  return (
    <main style={{ padding: '1.25rem 0 2.25rem', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: 950 }}>
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
              alt="Games"
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
                Mini Games
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
          bodyStyle={{ padding: '1.2rem 1.3rem' }}
        >
          <Tabs
            items={[
              {
                key: 'scramble',
                label: 'Word Scramble',
                children: (
                  <div style={{ maxWidth: 520 }}>
                    <div style={{ color: '#5c4a3a', marginBottom: 8 }}>Unscramble the word:</div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        letterSpacing: 2,
                        color: '#3d2914',
                        background: 'rgba(255,255,255,0.7)',
                        border: '1px solid rgba(61,41,20,0.16)',
                        borderRadius: 14,
                        padding: '0.8rem 1rem',
                        display: 'inline-block',
                      }}
                    >
                      {scrambled || '......'}
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Input
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="Type your answer"
                        style={{ maxWidth: 240, borderRadius: 10 }}
                        disabled={solved}
                      />
                      <Button
                        onClick={checkScramble}
                        disabled={solved || !guess.trim() || !word}
                        style={{
                          borderRadius: 10,
                          background: 'var(--btn-view-green, #2d7a3e)',
                          borderColor: 'var(--btn-view-green, #2d7a3e)',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        Check
                      </Button>
                      <Button onClick={resetScramble} style={{ borderRadius: 10 }}>
                        New Word
                      </Button>
                      <Button
                        onClick={() => message.info(`Hint: it starts with “${word[0]}”`)}
                        style={{ borderRadius: 10 }}
                      >
                        Hint
                      </Button>
                    </div>

                    {solved && (
                      <div style={{ marginTop: 12, color: '#2d7a3e', fontWeight: 700 }}>
                        Great job! The word was {word}.
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'math',
                label: 'Quick Math',
                children: (
                  <div style={{ maxWidth: 520 }}>
                    <div style={{ color: '#5c4a3a', marginBottom: 8 }}>
                      Answer quickly and build a streak!
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: '#3d2914',
                        background: 'rgba(255,255,255,0.7)',
                        border: '1px solid rgba(61,41,20,0.16)',
                        borderRadius: 14,
                        padding: '0.8rem 1rem',
                        display: 'inline-block',
                      }}
                    >
                      {a} + {b} = ?
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Input
                        value={mathAns}
                        onChange={(e) => setMathAns(e.target.value)}
                        placeholder="Your answer"
                        style={{ maxWidth: 180, borderRadius: 10 }}
                        onPressEnter={checkMath}
                      />
                      <Button
                        onClick={checkMath}
                        disabled={!mathAns.trim()}
                        style={{
                          borderRadius: 10,
                          background: 'var(--btn-view-green, #2d7a3e)',
                          borderColor: 'var(--btn-view-green, #2d7a3e)',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        Check
                      </Button>
                      <Button onClick={nextMath} style={{ borderRadius: 10 }}>
                        Skip
                      </Button>
                      <Button
                        onClick={() => {
                          setStreak(0);
                          nextMath();
                        }}
                        style={{
                          borderRadius: 10,
                          background: 'var(--btn-read-red, #c0392b)',
                          borderColor: 'var(--btn-read-red, #c0392b)',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        Reset
                      </Button>
                    </div>

                    <div style={{ marginTop: 10, color: '#3d2914', fontWeight: 700 }}>
                      Streak: {streak}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </main>
  );
}
