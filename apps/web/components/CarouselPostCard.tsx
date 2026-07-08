'use client';

import Image from 'next/image';
import Link from 'next/link';
import { assetUrl } from '../lib/apiBase';
import PostMediaCarousel, { type CarouselMediaItem } from './PostMediaCarousel';
import VideoWithSoundToggle from './VideoWithSoundToggle';

export interface PostMediaItem {
  id: number;
  mediaType: 'IMAGE' | 'VIDEO' | string;
  mediaKey: string;
  sortOrder?: number;
}

export interface CarouselPostItem {
  id: number;
  type: 'CAROUSEL';
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  sortOrder?: number;
  media?: PostMediaItem[];
  imageKey?: string | null;
}

export default function CarouselPostCard({ post }: { post: CarouselPostItem }) {
  const items: CarouselMediaItem[] =
    post.media && post.media.length > 0
      ? post.media
      : post.imageKey
        ? [{ id: 0, mediaType: 'IMAGE', mediaKey: post.imageKey }]
        : [];

  return (
    <article
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgba(61,41,20,0.14)',
        background: 'rgba(255,255,255,0.85)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {items.length > 0 && (
        <div style={{ background: 'rgba(61,41,20,0.06)', padding: '0 0 4px' }}>
          {items.length === 1 ? (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}>
              {String(items[0].mediaType).toUpperCase() === 'VIDEO' ||
              /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|$)/i.test(items[0].mediaKey) ? (
                <VideoWithSoundToggle
                  src={assetUrl(items[0].mediaKey)}
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
                  src={assetUrl(items[0].mediaKey)}
                  alt={post.title}
                  fill
                  style={{ objectFit: 'contain' }}
                  unoptimized
                />
              )}
            </div>
          ) : (
            <PostMediaCarousel
              items={items}
              title={post.title}
              mediaFit="contain"
              showArrows
              clickToNavigate
              imageIntervalMs={5000}
            />
          )}
        </div>
      )}
      <div style={{ padding: '1rem 1.1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#7c3aed',
            marginBottom: 6,
          }}
        >
          Carousel · {items.length} slide{items.length === 1 ? '' : 's'}
        </span>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#3d2914' }}>{post.title}</h3>
        {post.subtitle && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5c4a3a', lineHeight: 1.5 }}>
            {post.subtitle}
          </p>
        )}
        <Link
          href={post.ctaHref || `/posts/${post.id}`}
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--btn-view-green, #2d7a3e)' }}
        >
          {post.ctaLabel || 'View slides'} →
        </Link>
      </div>
    </article>
  );
}
