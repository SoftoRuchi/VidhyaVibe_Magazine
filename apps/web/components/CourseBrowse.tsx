import Link from 'next/link';
import React from 'react';

export function CourseHero({
  kicker,
  title,
  subtitle,
  chips = [],
}: {
  kicker?: string | null;
  title: string;
  subtitle?: string | null;
  chips?: string[];
}) {
  return (
    <div className="course-hero">
      {kicker ? <div className="course-card-kicker">{kicker}</div> : null}
      <h1 className="course-page-title" style={{ marginTop: kicker ? 8 : 0 }}>
        {title}
      </h1>
      {subtitle ? (
        <p className="course-page-lead" style={{ marginBottom: chips.length ? 14 : 0 }}>
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
    </div>
  );
}

export function CourseNavCard({
  href,
  badge,
  title,
  subtitle,
  muted,
}: {
  href: string;
  badge?: string;
  title: string;
  subtitle: string;
  muted?: boolean;
}) {
  return (
    <Link href={href} className={`course-nav-card${muted ? ' is-muted' : ''}`}>
      <span className="course-nav-badge">{badge || '▸'}</span>
      <span className="course-nav-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="course-nav-chevron" aria-hidden>
        ›
      </span>
    </Link>
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
      <div>
        <div className="course-card-kicker">Continue reading</div>
        <strong>{chapterTitle || 'Your last chapter'}</strong>
        <small>
          {[courseName, subjectName].filter(Boolean).join(' · ')}
          {percent ? ` · ${Math.round(percent)}%` : ''}
        </small>
      </div>
      <span className="course-nav-chevron" aria-hidden>
        ›
      </span>
    </Link>
  );
}
