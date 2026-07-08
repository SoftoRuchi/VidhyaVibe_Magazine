import Image from 'next/image';
import Link from 'next/link';
import { assetUrl } from '../lib/apiBase';

export interface SitePostItem {
  id: number;
  title: string;
  body?: string | null;
  imageKey?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  sortOrder?: number;
  createdAt?: string | null;
}

export default function PostCard({ post }: { post: SitePostItem }) {
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
      {post.imageKey && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            background: 'rgba(61,41,20,0.06)',
          }}
        >
          <Image
            src={assetUrl(post.imageKey)}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'contain' }}
          />
        </div>
      )}
      <div style={{ padding: '1rem 1.1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#3d2914' }}>{post.title}</h3>
        {post.body && (
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 13,
              color: '#5c4a3a',
              lineHeight: 1.5,
              flex: 1,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.body}
          </p>
        )}
        <Link
          href={post.ctaHref || `/posts/${post.id}`}
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--btn-view-green, #2d7a3e)' }}
        >
          {post.ctaLabel || 'Read more'} →
        </Link>
      </div>
    </article>
  );
}
