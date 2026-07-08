'use client';

import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import PostMediaCarousel, { type CarouselMediaItem } from '../../../components/PostMediaCarousel';
import VideoWithSoundToggle from '../../../components/VideoWithSoundToggle';
import { assetUrl } from '../../../lib/apiBase';

interface SitePost {
  id: number;
  type?: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  imageKey?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  media?: CarouselMediaItem[];
}

export default function PostDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [post, setPost] = useState<SitePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    axios
      .get(`/api/posts/${id}`)
      .then((r) => setPost(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: '3rem 0', textAlign: 'center' }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main style={{ padding: '3rem 0', textAlign: 'center' }}>
        <p>Post not found.</p>
        <Link href="/posts">Back to posts</Link>
      </main>
    );
  }

  const mediaItems: CarouselMediaItem[] =
    post.media && post.media.length > 0
      ? post.media
      : post.imageKey
        ? [{ id: 0, mediaType: 'IMAGE', mediaKey: post.imageKey }]
        : [];

  return (
    <main style={{ padding: '1.5rem 0 2.5rem' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <article
          style={{
            padding: '1.6rem 1.8rem',
            borderRadius: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.78)',
            border: '1px solid rgba(61,41,20,0.18)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
          }}
        >
          {mediaItems.length > 0 && (
            <div
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 20,
                background: 'rgba(61,41,20,0.06)',
              }}
            >
              {mediaItems.length === 1 ? (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16 / 9',
                    maxHeight: 420,
                  }}
                >
                  {mediaItems[0].mediaType === 'VIDEO' ? (
                    <VideoWithSoundToggle
                      src={assetUrl(mediaItems[0].mediaKey)}
                      autoPlay
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        background: '#000',
                      }}
                    />
                  ) : (
                    <Image
                      src={assetUrl(mediaItems[0].mediaKey)}
                      alt={post.title}
                      fill
                      style={{ objectFit: 'contain' }}
                      priority
                      unoptimized
                    />
                  )}
                </div>
              ) : (
                <PostMediaCarousel
                  items={mediaItems}
                  title={post.title}
                  mediaFit="contain"
                  showArrows
                  clickToNavigate
                  imageIntervalMs={5000}
                />
              )}
            </div>
          )}
          <h1
            style={{
              margin: '0 0 0.5rem',
              fontSize: '2rem',
              color: '#3d2914',
              fontFamily: 'Georgia, serif',
            }}
          >
            {post.title}
          </h1>
          {post.subtitle && (
            <p style={{ margin: '0 0 1rem', color: '#5c4a3a', fontSize: 15 }}>{post.subtitle}</p>
          )}
          {post.body && (
            <div
              style={{
                color: '#3a2f26',
                lineHeight: 1.75,
                whiteSpace: 'pre-wrap',
                marginBottom: 24,
              }}
            >
              {post.body}
            </div>
          )}
          {post.ctaHref && (
            <Link
              href={post.ctaHref}
              style={{
                display: 'inline-block',
                padding: '0.65rem 1.2rem',
                borderRadius: 999,
                background: 'var(--btn-view-green, #2d7a3e)',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {post.ctaLabel || 'Continue'}
            </Link>
          )}
          <div style={{ marginTop: 16 }}>
            <Link href="/posts" style={{ fontSize: 14, fontWeight: 600, color: '#5c4a3a' }}>
              ← All posts
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
