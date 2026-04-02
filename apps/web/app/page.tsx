'use client';

import axios from 'axios';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import AgeGroupSection from '../components/AgeGroupSection';
import childImg from '../components/images/child.png';
import MagazineCard from '../components/MagazineCard';

interface Magazine {
  id: number;
  title: string;
  slug: string;
  description?: string;
  category?: string;
  createdAt: string;
  image: string;
}

export default function Page() {
  const [recentMagazines, setRecentMagazines] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMagazines = async () => {
      try {
        const response = await axios.get('/api/magazines');
        const magazines = response.data || [];

        // Map coverKey to full URL
        const mapped = magazines.map((m: any) => ({
          ...m,
          image: m.coverKey ? `/api/assets/serve?key=${m.coverKey}` : '',
        }));

        setRecentMagazines(mapped.slice(0, 6));
      } catch (error) {
        console.error('Failed to fetch magazines:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMagazines();
  }, []);

  const featuredMagazines = recentMagazines.slice(0, 3);
  const newReleases = recentMagazines.slice(3, 6);

  return (
    <main style={{ padding: '1.25rem 0 2.25rem' }}>
      {/* HERO (themed) */}
      <section>
        <div className="container">
          <div
            className="vv-home-heroCard"
            style={{
              padding: '1.8rem 2rem',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            <div
              className="vv-home-heroGrid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.9fr)',
                gap: '2rem',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(61,41,20,0.18)',
                    boxShadow: '0 8px 18px rgba(0,0,0,0.10)',
                    fontSize: 12,
                    color: '#5c4a3a',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 14 }}>✨</span>
                  Safe, ad‑free reading for kids
                </div>

                <div
                  className="vv-home-titleGrid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '84px 1fr 84px',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <div />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Image
                      src={childImg}
                      alt="Welcome"
                      width={84}
                      height={84}
                      className="vv-home-titleImg"
                      style={{ width: 84, height: 84, objectFit: 'contain' }}
                      priority
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <h1
                        className="vv-home-titleText"
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
                        Magazine Kids
                      </h1>
                      <div
                        className="vv-home-titleUnderline"
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

                <p
                  style={{
                    margin: '0.6rem 0 1rem',
                    color: '#3a2f26',
                    maxWidth: 560,
                    lineHeight: 1.6,
                  }}
                >
                  Explore space, oceans, animals, and adventures in every issue. Read anywhere,
                  anytime—safe and ad‑free.
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <a
                    href="/magazines"
                    style={{
                      padding: '0.7rem 1.2rem',
                      borderRadius: 999,
                      background: 'var(--btn-view-green, #2d7a3e)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 14,
                      boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
                    }}
                  >
                    Browse Magazines
                  </a>
                  <a
                    href="/subscribe"
                    style={{
                      padding: '0.7rem 1.2rem',
                      borderRadius: 999,
                      background: 'var(--btn-read-red, #c0392b)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 14,
                      boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
                    }}
                  >
                    Subscribe
                  </a>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {[
                    { label: 'New every month', bg: 'rgba(45,122,62,0.12)' },
                    { label: 'Kid‑friendly', bg: 'rgba(61,41,20,0.08)' },
                    { label: 'Read anywhere', bg: 'rgba(192,57,43,0.10)' },
                  ].map((chip) => (
                    <span
                      key={chip.label}
                      style={{
                        fontSize: 12,
                        color: '#3d2914',
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: chip.bg,
                        border: '1px solid rgba(61,41,20,0.12)',
                      }}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="vv-home-sideCard"
                style={{
                  borderRadius: 18,
                  padding: 14,
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(61,41,20,0.16)',
                }}
              >
                <div
                  className="vv-home-sideHero"
                  style={{
                    borderRadius: 14,
                    overflow: 'hidden',
                    background:
                      'linear-gradient(180deg, rgba(139,79,42,0.22) 0%, rgba(119,64,31,0.10) 60%, rgba(255,255,255,0.12) 100%)',
                    height: 220,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    color: '#3d2914',
                    fontWeight: 800,
                    fontFamily: 'Georgia, serif',
                    fontSize: 20,
                    paddingBottom: 10,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'radial-gradient(520px 220px at 20% 10%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%), linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,0.12) 100%)',
                    }}
                  />
                  <div
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <span style={{ fontSize: 18 }}>🌟</span>
                    Latest Adventures
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#5c4a3a', margin: '10px 0 0' }}>
                  Pick an age group to start reading right away.
                </p>
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href="/quiz"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#3d2914',
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(61,41,20,0.18)',
                    }}
                  >
                    Play Quiz →
                  </a>
                  <a
                    href="/facts"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#3d2914',
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(61,41,20,0.18)',
                    }}
                  >
                    Fun Facts →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED MAGAZINES */}
      <section style={{ padding: '1.5rem 0 1.25rem' }}>
        <div className="container">
          <div
            style={{
              padding: '1.4rem 1.6rem',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            <h2
              style={{
                fontSize: '1.4rem',
                margin: 0,
                marginBottom: '1rem',
                color: '#3d2914',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Featured Magazines
            </h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1.5rem',
                  justifyItems: 'center',
                }}
              >
                {featuredMagazines.map((magazine) => (
                  <MagazineCard
                    key={magazine.id}
                    id={magazine.id}
                    title={magazine.title}
                    description={magazine.description || ''}
                    date={new Date(magazine.createdAt).getFullYear().toString()}
                    image={magazine.image}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AGE GROUPS */}
      <AgeGroupSection />

      {/* NEW RELEASES */}
      <section style={{ padding: '1.5rem 0 1.25rem' }}>
        <div className="container">
          <div
            style={{
              padding: '1.4rem 1.6rem',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            <h2
              style={{
                fontSize: '1.4rem',
                margin: 0,
                marginBottom: '1rem',
                color: '#3d2914',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              New Releases
            </h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1.5rem',
                  justifyItems: 'center',
                }}
              >
                {newReleases.map((magazine) => (
                  <MagazineCard
                    key={magazine.id}
                    id={magazine.id}
                    title={magazine.title}
                    description={magazine.description || ''}
                    date={new Date(magazine.createdAt).getFullYear().toString()}
                    image={magazine.image}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FUN LEARNING GRID */}
      <section style={{ padding: '1.5rem 0 1.25rem' }}>
        <div className="container">
          <div
            style={{
              padding: '1.4rem 1.6rem',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            <h2
              style={{
                fontSize: '1.4rem',
                margin: 0,
                marginBottom: '1rem',
                color: '#3d2914',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Fun Learning Corners
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {[
                {
                  title: 'Science Facts',
                  color: '#bbf7d0',
                  text: 'Discover a wow fact about the world every day.',
                },
                {
                  title: 'Animal of the Week',
                  color: '#fed7aa',
                  text: 'Meet a new furry, feathery, or scaly friend.',
                },
                {
                  title: 'Space Explorer',
                  color: '#e9d5ff',
                  text: 'Zoom past stars, planets, and galaxies.',
                },
                {
                  title: 'Ocean Wonders',
                  color: '#bae6fd',
                  text: 'Dive deep to find glowing fish and coral reefs.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    borderRadius: 18,
                    padding: '1.1rem 1.2rem',
                    backgroundColor: item.color,
                    boxShadow: '0 6px 16px rgba(15,23,42,0.08)',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      marginBottom: 6,
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE STRIP */}
      <section style={{ padding: '1.5rem 0 1.25rem' }}>
        <div className="container">
          <div
            style={{
              padding: '1.4rem 1.6rem',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  borderRadius: 18,
                  padding: '1rem 1.1rem',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  boxShadow: '0 6px 14px rgba(15,23,42,0.08)',
                }}
              >
                <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Daily Quiz</h3>
                <p style={{ margin: 0, marginBottom: 8, fontSize: 13, color: '#4b5563' }}>
                  Answer 5 fun questions and earn a star badge!
                </p>
                <a href="/quiz" style={{ fontSize: 13, color: '#ea580c', fontWeight: 600 }}>
                  Play Quiz →
                </a>
              </div>
              <div
                style={{
                  borderRadius: 18,
                  padding: '1rem 1.1rem',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 6px 14px rgba(15,23,42,0.08)',
                }}
              >
                <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Fun Facts</h3>
                <p style={{ margin: 0, marginBottom: 8, fontSize: 13, color: '#4b5563' }}>
                  Tap to reveal a silly, smart, or surprising fact.
                </p>
                <a href="/facts" style={{ fontSize: 13, color: '#0f766e', fontWeight: 600 }}>
                  Flip a card →
                </a>
              </div>
              <div
                style={{
                  borderRadius: 18,
                  padding: '1rem 1.1rem',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 6px 14px rgba(15,23,42,0.08)',
                }}
              >
                <h3 style={{ margin: 0, marginBottom: 4, fontSize: 15 }}>Mini Games</h3>
                <p style={{ margin: 0, marginBottom: 8, fontSize: 13, color: '#4b5563' }}>
                  Word searches, puzzles, and memory challenges.
                </p>
                <a href="/games" style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
                  Open Games →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECOMMENDED & FOOTER */}
      <section style={{ padding: '1.5rem 0 1.25rem' }}>
        <div className="container">
          <div
            style={{
              padding: '1.4rem 1.6rem',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            <h2
              style={{
                fontSize: '1.4rem',
                margin: 0,
                marginBottom: '0.4rem',
                color: '#3d2914',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Recommended for You
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: 13, color: '#5c4a3a' }}>
              Hand‑picked based on the magazines you like most.
            </p>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1.5rem',
                  justifyItems: 'center',
                }}
              >
                {featuredMagazines.map((magazine) => (
                  <MagazineCard
                    key={`rec-${magazine.id}`}
                    id={magazine.id}
                    title={magazine.title}
                    description={magazine.description || ''}
                    date={new Date(magazine.createdAt).getFullYear().toString()}
                    image={magazine.image}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
