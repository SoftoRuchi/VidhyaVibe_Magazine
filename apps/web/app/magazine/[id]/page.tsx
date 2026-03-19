'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Empty } from 'antd';
import axios from 'axios';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface Magazine {
  id: number;
  title: string;
  slug: string;
  description?: string;
  coverKey?: string;
  category?: string;
}

interface Edition {
  id: number;
  magazineId: number;
  volume?: number;
  issueNumber?: number;
  publishedAt?: string;
  pages?: number;
  description?: string;
  coverUrl?: string;
}

export default function MagazineDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const [magRes, editionsRes] = await Promise.all([
          axios.get(`/api/magazines/${id}`),
          axios.get(`/api/magazines/${id}/editions`),
        ]);
        setMagazine(magRes.data);
        setEditions(editionsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch magazine:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token || !magazine) return;
    axios
      .get(`/api/subscriptions/check/${magazine.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setSubscribed(r.data.subscribed))
      .catch(() => setSubscribed(false));
  }, [magazine]);

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading...</div>;
  if (!magazine) return <div style={{ textAlign: 'center' }}>Magazine not found.</div>;

  return (
    <main
      style={{
        padding: '0.6rem 0 2rem',
        minHeight: '80vh',
      }}
    >
      <div className="container" style={{ position: 'relative' }}>
        {/* Back button (top-left like your screenshot) */}
        <Link
          href="/magazines"
          style={{
            position: 'absolute',
            top: 6,
            left: 20,
            display: 'inline-flex',
            alignItems: 'center',
            color: '#2c1810',
            background: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(61,41,20,0.25)',
            borderRadius: 999,
            padding: '0.52rem 0.6rem',
            boxShadow: '0 6px 16px rgba(0,0,0,0.10)',
          }}
          aria-label="Back to Magazines"
          title="Back to Magazines"
        >
          <ArrowLeftOutlined />
        </Link>

        <div
          style={{
            padding: '1.8rem 3.0rem',
            borderRadius: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.78)',
            border: '1px solid rgba(61,41,20,0.18)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            marginBottom: '2.5rem',
            // marginTop: 46,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)',
              columnGap: '4.2rem',
              rowGap: '1.8rem',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 340,
                gridRow: '1 / span 2',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* 3D book cover (like Browse cards, but larger) */}
              <div
                style={{
                  width: '100%',
                  borderRadius: '0 18px 18px 0',
                  overflow: 'hidden',
                  background: 'linear-gradient(180deg, #8b4f2a 0%, #77401f 45%, #4b250f 100%)',
                  border: '3px solid #2a1408',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.32)',
                  flexShrink: 0,
                  padding: 10,
                  transform: 'perspective(1000px) rotateY(-10deg) rotateZ(-1deg)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '0 14px 14px 0',
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.08)',
                    border: '2px solid rgba(255,255,255,0.10)',
                  }}
                >
                  {/* Page edges on the right */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: -10,
                      bottom: 8,
                      width: 18,
                      borderRadius: '0 14px 14px 0',
                      background: 'linear-gradient(180deg, #fbf7ee 0%, #efe6d7 60%, #e5d8c5 100%)',
                      boxShadow:
                        'inset 1px 0 0 rgba(0,0,0,0.18), inset -1px 0 0 rgba(255,255,255,0.55), 2px 0 8px rgba(0,0,0,0.25)',
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  />

                  {magazine.coverKey ? (
                    <img
                      src={`/api/assets/serve?key=${magazine.coverKey}`}
                      alt={magazine.title}
                      style={{ width: '100%', height: 430, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 430,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      Cover
                    </div>
                  )}
                  {/* Lighting overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(145deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,0.25) 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>
              <Link href={`/subscribe?magazineId=${magazine.id}`}>
                <Button
                  type="default"
                  size="large"
                  style={{
                    borderRadius: 10,
                    paddingInline: 28,
                    fontWeight: 600,
                    alignSelf: 'center',
                    marginTop: '0.25rem',
                    width: '100%',
                    background: 'var(--btn-view-green, #2d7a3e)',
                    borderColor: 'var(--btn-view-green, #2d7a3e)',
                    color: '#fff',
                  }}
                >
                  Subscribe Now
                </Button>
              </Link>
            </div>

            <div style={{ minWidth: 260 }}>
              <h2
                style={{
                  margin: 0,
                  marginBottom: '0.35rem',
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#3d2914',
                  fontFamily: 'Georgia, serif',
                  lineHeight: 1.15,
                }}
              >
                {magazine.title}
              </h2>
              {magazine.description && (
                <p
                  style={{
                    color: '#3a2f26',
                    marginBottom: '1.0rem',
                    maxWidth: 560,
                    fontSize: '1rem',
                    lineHeight: 1.6,
                  }}
                >
                  {magazine.description}
                </p>
              )}
              {subscribed && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                    You’re subscribed to this magazine
                  </span>
                </div>
              )}
            </div>
            <div style={{ gridColumn: '2 / 3' }}>
              <h2
                style={{
                  fontSize: '1.2rem',
                  marginBottom: '0.9rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#3d2914',
                }}
              >
                Editions
              </h2>
              {editions.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {editions.map((ed) => (
                    <Card
                      key={ed.id}
                      hoverable
                      style={{
                        overflow: 'hidden',
                        borderRadius: 16,
                        boxShadow: '0 14px 30px rgba(0,0,0,0.16)',
                        padding: 0,
                        maxWidth: 360,
                        border: '1px solid rgba(61,41,20,0.16)',
                        background: 'rgba(255,255,255,0.86)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ed.coverUrl ? (
                          <img
                            src={ed.coverUrl}
                            alt=""
                            style={{
                              width: '100%',
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 14,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: 120,
                              background:
                                'linear-gradient(135deg, rgba(139,79,42,0.22) 0%, rgba(119,64,31,0.08) 60%, rgba(255,255,255,0.12) 100%)',
                              borderRadius: 14,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#6b7280',
                            }}
                          >
                            No cover
                          </div>
                        )}
                        <h3 style={{ margin: '0 0 2px', fontSize: '1rem', color: '#0f172a' }}>
                          {ed.volume
                            ? `Volume ${ed.volume}${ed.issueNumber ? `, Issue ${ed.issueNumber}` : ''}`
                            : 'Edition'}
                        </h3>
                        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                          {formatDate(ed.publishedAt)}
                          {ed.pages ? ` · ${ed.pages} pages` : ''}
                        </p>
                        {ed.description && (
                          <p style={{ fontSize: 12, color: '#4b5563', margin: 0 }}>
                            {ed.description}
                          </p>
                        )}
                        <div
                          style={{
                            marginTop: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          {subscribed ? (
                            <Link href={`/reader/${ed.id}`}>
                              <Button
                                type="default"
                                block
                                style={{
                                  background: 'var(--btn-view-green, #2d7a3e)',
                                  borderColor: 'var(--btn-view-green, #2d7a3e)',
                                  color: '#fff',
                                  fontWeight: 600,
                                }}
                              >
                                Read
                              </Button>
                            </Link>
                          ) : (
                            <>
                              {(ed as any).hasSample && (
                                <a
                                  href={`/api/editions/${ed.id}/sample`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Button block>📖 Read Free Sample</Button>
                                </a>
                              )}
                              <Link href={`/buy/${ed.id}`}>
                                <Button
                                  type="default"
                                  block
                                  style={{
                                    background: 'var(--btn-read-red, #c0392b)',
                                    borderColor: 'var(--btn-read-red, #c0392b)',
                                    color: '#fff',
                                    fontWeight: 600,
                                  }}
                                >
                                  Buy This Edition
                                </Button>
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty description="No published editions yet." />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
