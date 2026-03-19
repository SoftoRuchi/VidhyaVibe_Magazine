'use client';

import { Button, Card } from 'antd';
import Image from 'next/image';
import React from 'react';
import childImg from '../../components/images/child.png';

const FACTS = [
  'A day on Venus is longer than a year on Venus!',
  'Octopuses have three hearts.',
  'Honey never spoils (it can last thousands of years).',
  'Sharks have been around longer than dinosaurs.',
  'A group of flamingos is called a “flamboyance”.',
  'Some turtles can breathe through their bottoms.',
  'Bananas are berries, but strawberries are not.',
  'The Eiffel Tower can grow taller in summer heat.',
];

function pickNext(current: number) {
  if (FACTS.length <= 1) return 0;
  let n = Math.floor(Math.random() * FACTS.length);
  while (n === current) n = Math.floor(Math.random() * FACTS.length);
  return n;
}

export default function FactsPage() {
  const [flipped, setFlipped] = React.useState(false);
  const [fact, setFact] = React.useState<string>('');

  const next = React.useCallback(async () => {
    setFlipped(false);
    const r = await fetch('/api/facts', { cache: 'no-store' });
    const j = await r.json();
    setFact(j.fact || 'Learning is fun!');
  }, []);

  React.useEffect(() => {
    next();
  }, [next]);

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
              alt="Fun Facts"
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
                Fun Facts
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
          bodyStyle={{ padding: '1.6rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: 'min(520px, 100%)',
                height: 260,
                perspective: 1000,
              }}
            >
              <button
                type="button"
                onClick={() => setFlipped((v) => !v)}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                }}
                aria-label="Flip fact card"
                title="Flip"
              >
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 500ms ease',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backfaceVisibility: 'hidden',
                      borderRadius: 18,
                      border: '1px solid rgba(61,41,20,0.18)',
                      background:
                        'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(245,238,221,0.9) 100%)',
                      boxShadow: '0 16px 32px rgba(0,0,0,0.14)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      color: '#3d2914',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 800 }}>Tap to Flip</div>
                    <div style={{ fontSize: 44, lineHeight: 1 }}>❓</div>
                    <div style={{ fontSize: 13, color: '#5c4a3a' }}>Reveal a fun fact!</div>
                  </div>

                  {/* Back */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      borderRadius: 18,
                      border: '1px solid rgba(61,41,20,0.18)',
                      background: 'rgba(255,255,255,0.9)',
                      boxShadow: '0 16px 32px rgba(0,0,0,0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.2rem 1.3rem',
                      color: '#2c1810',
                      fontSize: 18,
                      lineHeight: 1.5,
                      textAlign: 'center',
                    }}
                  >
                    {fact || '...'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Button onClick={() => setFlipped((v) => !v)} style={{ borderRadius: 999 }}>
              {flipped ? 'Hide' : 'Flip'}
            </Button>
            <Button
              type="default"
              onClick={next}
              style={{
                borderRadius: 999,
                background: 'var(--btn-view-green, #2d7a3e)',
                borderColor: 'var(--btn-view-green, #2d7a3e)',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              Next Fact
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
