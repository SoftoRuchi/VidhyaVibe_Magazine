'use client';

import { Spin } from 'antd';
import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import CarouselPostCard, { type CarouselPostItem } from '../../components/CarouselPostCard';
import subscribeImg from '../../components/images/subscribe.png';
import PostCard, { type SitePostItem } from '../../components/PostCard';
import api from '../../lib/api';
import { cachedGet } from '../../lib/requestCache';

const cardShell: React.CSSProperties = {
  padding: '1.4rem 1.6rem',
  borderRadius: 22,
  backgroundColor: 'rgba(255, 255, 255, 0.78)',
  border: '1px solid rgba(61,41,20,0.18)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
};

type FeedItem =
  | { kind: 'POST'; sortOrder: number; post: SitePostItem }
  | { kind: 'CAROUSEL'; sortOrder: number; post: CarouselPostItem };

export default function PostsPage() {
  const [posts, setPosts] = useState<SitePostItem[]>([]);
  const [carousels, setCarousels] = useState<CarouselPostItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedGet<{ posts?: SitePostItem[]; carousel?: CarouselPostItem[] }>(
      api,
      '/api/posts',
      undefined,
      60_000,
    )
      .then((r) => {
        setPosts(r.data?.posts ?? []);
        setCarousels(r.data?.carousel ?? []);
      })
      .catch(() => {
        setPosts([]);
        setCarousels([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const feed = useMemo(() => {
    const items: FeedItem[] = [
      ...posts.map((post) => ({
        kind: 'POST' as const,
        sortOrder: post.sortOrder ?? 0,
        post,
      })),
      ...carousels.map((post) => ({
        kind: 'CAROUSEL' as const,
        sortOrder: post.sortOrder ?? 0,
        post,
      })),
    ];
    return items.sort((a, b) => a.sortOrder - b.sortOrder || b.post.id - a.post.id);
  }, [posts, carousels]);

  return (
    <main style={{ padding: '1.25rem 0 2.25rem', minHeight: '80vh' }}>
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '84px 1fr 84px',
            alignItems: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <div />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Image
              src={subscribeImg}
              alt="Posts"
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
                News & Updates
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

        <div style={cardShell}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem' }}>
              <Spin size="large" />
            </div>
          ) : feed.length === 0 ? (
            <p style={{ margin: 0, textAlign: 'center', color: '#5c4a3a', padding: '2rem 0' }}>
              No posts yet. Check back soon for news and updates!
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {feed.map((item) =>
                item.kind === 'CAROUSEL' ? (
                  <CarouselPostCard key={`carousel-${item.post.id}`} post={item.post} />
                ) : (
                  <PostCard key={`post-${item.post.id}`} post={item.post} />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
