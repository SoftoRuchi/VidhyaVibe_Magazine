'use client';

import Link from 'next/link';
import React from 'react';
import { assetUrl } from '../lib/apiBase';
import { courseCountLabel } from '../lib/courseLabels';
import {
  fetchBookOffer,
  formatBookPrice,
  type BookOffer,
  type CourseSummary,
} from '../lib/coursesApi';

const COVER_TONES = [
  { bg: 'linear-gradient(160deg,#1f6b3a,#0f3d22)', fg: '#f4efe6' },
  { bg: 'linear-gradient(160deg,#8a3a22,#5a2414)', fg: '#f8efe6' },
  { bg: 'linear-gradient(160deg,#2c4a6e,#1a2e48)', fg: '#eef3f8' },
  { bg: 'linear-gradient(160deg,#6b4f1f,#3d2c10)', fg: '#f6ecd8' },
  { bg: 'linear-gradient(160deg,#3d5c4a,#1e3228)', fg: '#eef6f0' },
];

function coverTone(seed: string | number) {
  const n =
    typeof seed === 'number'
      ? seed
      : Array.from(String(seed)).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return COVER_TONES[Math.abs(n) % COVER_TONES.length];
}

export function CourseCover({
  src,
  title,
  seed = 0,
}: {
  src?: string | null;
  title: string;
  seed?: string | number;
}) {
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => {
    setBroken(false);
  }, [src]);
  const tone = coverTone(seed);
  const showImg = Boolean(src) && !broken;
  return (
    <span className="vv-course-cover" style={{ background: tone.bg, color: tone.fg }}>
      {showImg ? (
        <img src={src || ''} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="vv-course-cover-mark">{title}</span>
      )}
    </span>
  );
}

export function CourseHero({
  kicker,
  title,
  subtitle,
  chips = [],
  coverSrc,
  actions,
}: {
  kicker?: string | null;
  title: string;
  subtitle?: string | null;
  chips?: string[];
  coverSrc?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <div className="course-hero">
      <div className="vv-course-hero-row">
        {coverSrc ? <img src={coverSrc} alt="" className="vv-course-hero-cover" /> : null}
        <div className="vv-course-hero-copy">
          {kicker ? <div className="course-card-kicker">{kicker}</div> : null}
          <h1 className="course-page-title" style={{ marginTop: kicker ? 6 : 0 }}>
            {title}
          </h1>
          {subtitle ? (
            <p
              className="course-page-lead"
              style={{ marginBottom: chips.length || actions ? 12 : 0 }}
            >
              {subtitle}
            </p>
          ) : null}
          {chips.length ? (
            <div className="course-chip-row">
              {chips.map((chip) => (
                <span key={chip} className="course-meta-chip">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          {actions ? <div className="vv-course-hero-actions">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function CourseNavCard({
  href,
  badge,
  title,
  subtitle,
  muted,
  tag,
  locked,
}: {
  href: string;
  badge?: string;
  title: string;
  subtitle: string;
  muted?: boolean;
  tag?: string;
  locked?: boolean;
}) {
  return (
    <Link href={href} className={`course-nav-card${muted || locked ? ' is-muted' : ''}`}>
      <span className="course-nav-badge">{badge || '▸'}</span>
      <span className="course-nav-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {tag ? <span className={`course-access-tag${locked ? ' is-locked' : ''}`}>{tag}</span> : null}
      <span className="course-nav-chevron" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function CourseAccessBlocked({
  title,
  message,
  backHref = '/courses',
  subjectId,
  showBuy = true,
}: {
  title?: string;
  message: string;
  backHref?: string;
  subjectId?: number | null;
  showBuy?: boolean;
}) {
  const [offer, setOffer] = React.useState<BookOffer | null>(null);

  React.useEffect(() => {
    if (!showBuy || !subjectId) return;
    let cancelled = false;
    fetchBookOffer(subjectId)
      .then((data) => {
        if (!cancelled) setOffer(data);
      })
      .catch(() => {
        if (!cancelled) setOffer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showBuy, subjectId]);

  const priceLabel = offer?.purchasable ? formatBookPrice(offer.price) : '';

  return (
    <main className="container" style={{ padding: '48px 16px', maxWidth: 560 }}>
      <h1 className="course-page-title">{title || 'Access needed'}</h1>
      <p className="course-page-lead">{message}</p>
      {offer?.purchasable ? (
        <div className="course-buy-panel">
          <strong>Subscribe to this book</strong>
          <p>
            Individual access costs {priceLabel} and opens on one device at a time. College
            book-bank and library seats stay separate.
          </p>
          <Link href={offer.buyHref} className="course-buy-btn">
            Subscribe · {priceLabel}
          </Link>
        </div>
      ) : (
        <p className="course-page-lead">
          If your college bought this book, ask them to add your email to the class list. If you
          purchased it yourself, sign in with that account.
        </p>
      )}
      <Link href={backHref} className="course-back">
        ← Back to courses
      </Link>
    </main>
  );
}

export function CourseEmpty({ message }: { message: string }) {
  return <div className="course-empty-card">{message}</div>;
}

export function CourseSection({ title }: { title: string }) {
  return <h2 className="course-section-title">{title}</h2>;
}

export function CourseHomeCard({
  href = '/courses',
  title = 'Courses',
  subtitle = 'BCA, BBA and university textbooks',
}: {
  href?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="course-home-card">
      <span className="course-home-icon" aria-hidden>
        ▣
      </span>
      <span className="course-home-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="course-nav-chevron" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function CourseContinueCard({
  href,
  chapterTitle,
  courseName,
  subjectName,
  percent,
}: {
  href: string;
  chapterTitle?: string | null;
  courseName?: string | null;
  subjectName?: string | null;
  percent?: number | null;
}) {
  return (
    <Link href={href} className="course-continue-card">
      <span className="course-card-kicker">Continue reading</span>
      <strong>{chapterTitle || 'Your last chapter'}</strong>
      <small>
        {[courseName, subjectName].filter(Boolean).join(' · ')}
        {percent ? ` · ${Math.round(percent)}%` : ''}
      </small>
    </Link>
  );
}

export function CourseGrid({
  children,
  variant = 'course',
}: {
  children: React.ReactNode;
  variant?: 'course' | 'book' | 'semester';
}) {
  return <div className={`vv-course-grid is-${variant}`}>{children}</div>;
}

export function CourseProgramCard({ course }: { course: CourseSummary }) {
  const cover = course.coverKey ? assetUrl(course.coverKey) : null;
  const openHref = `/courses/${course.slug}`;
  const subscribeHref = `/courses/${course.slug}/subscribe`;
  const meta = [
    course.university,
    course.semesterCount ? courseCountLabel(course.semesterCount, 'semester') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className="vv-course-tile">
      <Link href={openHref} className="vv-course-cover-link" aria-label={course.name}>
        <CourseCover src={cover} title={course.name} seed={course.id} />
      </Link>
      <div className="vv-course-tile-body">
        <Link href={openHref} className="vv-course-tile-title">
          {course.name}
        </Link>
        {meta ? <small>{meta}</small> : null}
        <div className="vv-course-tile-actions">
          <Link href={openHref} className="vv-course-btn is-ghost">
            Open
          </Link>
          <Link href={subscribeHref} className="vv-course-btn is-subscribe">
            Subscribe
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CourseBookTile({
  title,
  subtitle,
  coverKey,
  href,
  subscribeHref,
  seed,
  owned,
  tag,
}: {
  title: string;
  subtitle?: string | null;
  coverKey?: string | null;
  href: string;
  subscribeHref?: string | null;
  seed?: string | number;
  owned?: boolean;
  tag?: string | null;
}) {
  const cover = coverKey ? assetUrl(coverKey) : null;
  const primaryHref = owned || !subscribeHref ? href : subscribeHref;
  return (
    <article className="vv-course-tile is-book">
      <Link href={primaryHref} className="vv-course-cover-link" aria-label={title}>
        <CourseCover src={cover} title={title} seed={seed || title} />
      </Link>
      <div className="vv-course-tile-body">
        <Link href={primaryHref} className="vv-course-tile-title">
          {title}
        </Link>
        {subtitle ? <small>{subtitle}</small> : null}
        <div className="vv-course-tile-actions">
          {owned ? (
            <Link href={href} className="vv-course-btn is-ghost">
              {tag || 'Open'}
            </Link>
          ) : subscribeHref ? (
            <Link href={subscribeHref} className="vv-course-btn is-subscribe">
              {tag || 'Subscribe'}
            </Link>
          ) : (
            <span className="vv-course-btn is-muted">{tag || 'License needed'}</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function CourseSemesterCard({
  href,
  number,
  title,
  subtitle,
  muted,
}: {
  href: string;
  number: number | string;
  title: string;
  subtitle: string;
  muted?: boolean;
}) {
  return (
    <Link href={href} className={`vv-sem-tile${muted ? ' is-muted' : ''}`}>
      <span className="vv-sem-num">{number}</span>
      <strong>{title}</strong>
      <small>{subtitle}</small>
    </Link>
  );
}
