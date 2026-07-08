'use client';

import { Empty, Spin } from 'antd';
import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import libraryImg from '../../components/images/library.png';
import MagazineCard from '../../components/MagazineCard';
import PostCard, { type SitePostItem } from '../../components/PostCard';
import api from '../../lib/api';
import { assetUrl } from '../../lib/apiBase';
import { cachedGet } from '../../lib/requestCache';
import { getSelectedReaderId, isChildAudience } from '../../lib/viewingContext';

interface LibraryItem {
  type: string;
  magazineId: number;
  title: string;
  slug: string;
  coverKey: string | null;
  editionId: number | null;
  volume?: number;
  issueNumber?: number;
  publishedAt?: string;
  accessType: string;
}

export default function DashboardPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [posts, setPosts] = useState<SitePostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const token = localStorage.getItem('access_token');
      try {
        const readerId = isChildAudience() ? getSelectedReaderId() : null;
        const suffix = readerId ? `?readerId=${readerId}` : '';
        const requests: Promise<unknown>[] = [
          cachedGet<{ posts?: SitePostItem[] }>(api, '/api/posts', undefined, 60_000),
        ];
        if (token) {
          requests.push(
            api.get(`/api/library${suffix}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          );
        }

        const [postsRes, libraryRes] = await Promise.all(requests);
        if (cancelled) return;

        const postsData = postsRes as { data: { posts?: SitePostItem[] } };
        setPosts(postsData.data?.posts ?? []);

        if (libraryRes && typeof libraryRes === 'object' && 'data' in libraryRes) {
          setItems((libraryRes as { data: { items?: LibraryItem[] } }).data?.items || []);
        } else if (!token) {
          setItems([]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch dashboard data:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingPosts(false);
        }
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (publishedAt?: string) => {
    if (!publishedAt) return '';
    const d = new Date(publishedAt);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <main style={{ minHeight: '80vh' }}>
      <div className="container">
        {/* Themed heading (matches Subscribe/Profile) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '84px 1fr 84px',
            alignItems: 'center',
          }}
        >
          <div />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Image
              src={libraryImg}
              alt="My Library"
              width={84}
              height={84}
              style={{ width: 84, height: 84, objectFit: 'contain' }}
              loading="lazy"
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
                My Library
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

        {!loadingPosts && posts.length > 0 && (
          <section style={{ marginBottom: '1.5rem' }}>
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
                  fontSize: '1.2rem',
                  margin: '0 0 1rem',
                  color: '#3d2914',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                News & Updates
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                {posts.slice(0, 3).map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section style={{ marginBottom: '4rem' }}>
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
              My Subscriptions & Purchases
            </h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Spin size="large" />
              </div>
            ) : items.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {items.map((item, index) => (
                  <MagazineCard
                    key={`${item.accessType}-${item.magazineId}-${item.editionId || index}`}
                    title={item.title}
                    date={
                      formatDate(item.publishedAt) || (item.volume ? `Vol. ${item.volume}` : '')
                    }
                    description={item.accessType === 'subscription' ? 'Subscribed' : 'Purchased'}
                    image={item.coverKey ? assetUrl(item.coverKey) : ''}
                    editionId={item.editionId || undefined}
                  />
                ))}
              </div>
            ) : (
              <Empty description="You haven't subscribed to or purchased any magazines yet. Browse and subscribe to get started!" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
