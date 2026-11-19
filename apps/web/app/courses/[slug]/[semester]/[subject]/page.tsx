'use client';

import { Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';
import { CourseCover, CourseEmpty } from '../../../../../components/CourseBrowse';
import { assetUrl, apiUrl } from '../../../../../lib/apiBase';
import { useAuth } from '../../../../../lib/authContext';
import { courseCountLabel } from '../../../../../lib/courseLabels';
import { compareChapters, extractChapterNumber } from '../../../../../lib/courseChapters';
import { fetchSemester, fetchSubject, formatBookPrice } from '../../../../../lib/coursesApi';
import CoursePracticeQuiz from './read/CoursePracticeQuiz';

export default function SubjectPage() {
  const params = useParams();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [publicBook, setPublicBook] = React.useState<any>(null);
  const [practiceChapter, setPracticeChapter] = React.useState<{
    id: number;
    title: string;
  } | null>(null);

  React.useEffect(() => {
    if (!practiceChapter) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPracticeChapter(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [practiceChapter]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!slug || !number || !subjectSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const sem = await fetchSemester(slug, number);
        const match = (sem.subjects || []).find((s: any) => s.slug === subjectSlug);
        if (!match) {
          if (!cancelled) setData(null);
          return;
        }
        if (!loggedIn) {
          if (!cancelled) {
            setPublicBook({ ...match, course: sem.course, semester: sem.semester });
          }
          return;
        }
        try {
          const subject = await fetchSubject(match.id);
          if (!cancelled) setData(subject);
        } catch (e: any) {
          if (e?.response?.status === 401 || e?.response?.status === 403) {
            if (!cancelled) {
              setPublicBook({ ...match, course: sem.course, semester: sem.semester });
            }
          } else if (!cancelled) setData(null);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, slug, number, subjectSlug]);

  if (loading || authLoading) {
    return (
      <main className="container" style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }

  if (publicBook && !data) {
    const priceRows = [
      ['E-book', publicBook.ebookPrice ?? publicBook.price],
      ['Physical', publicBook.physicalPrice],
      ['E-book and physical', publicBook.bothPrice],
    ].filter((row) => row[1] != null && Number(row[1]) > 0);
    const price = formatBookPrice(publicBook.price);
    const buyHref = `/courses/${slug}/sem-${number}/${subjectSlug}/buy`;
    const cover = publicBook.coverKey ? assetUrl(publicBook.coverKey) : null;
    const sampleHref = publicBook.sampleUrl ? apiUrl(publicBook.sampleUrl) : null;
    return (
      <main className="container" style={{ padding: '24px 16px 64px' }}>
        <Link href="/" className="course-back">
          ← All books
        </Link>
        <div className="course-closed-layout">
          <div className="course-closed-book" aria-hidden>
            <span className="course-closed-spine" />
            <span className="course-closed-cover">
              <CourseCover src={cover} title={publicBook.name} seed={publicBook.id} />
            </span>
            <span className="course-closed-pages" />
          </div>
          <section className="course-closed-chapters">
            <p className="course-card-kicker">
              {publicBook.course?.name || ''} · {publicBook.semester?.title || ''}
            </p>
            <h1 className="course-page-title">{publicBook.name}</h1>
            <div className="course-chip-row">
              {publicBook.syllabusCode ? (
                <span className="course-meta-chip">{publicBook.syllabusCode}</span>
              ) : null}
              {publicBook.chapterCount ? (
                <span className="course-meta-chip">
                  {courseCountLabel(publicBook.chapterCount, 'chapter')}
                </span>
              ) : null}
            </div>
            <h2 className="course-section-title">What this book covers</h2>
            <p className="course-page-lead">
              {publicBook.description || 'A description for this book has not been added yet.'}
            </p>
            <div className="course-ebook-perks">
              <span className="course-ebook-perks-title">
                <span>✨</span> Interactive e-book:
              </span>
              <span className="course-ebook-perk-pill">⚡ Quizzes & flashcards</span>
              <span className="course-ebook-perk-pill">🔍 Instant search</span>
              <span className="course-ebook-perk-pill">📱 Read on any device</span>
              <span className="course-ebook-perk-pill">💡 Always updated</span>
            </div>
            {priceRows.length ? (
              <>
                <h2 className="course-section-title">Student price</h2>
                <ul className="course-book-prices">
                  {priceRows.map(([label, amount]) => (
                    <li key={String(label)}>
                      <span>{label}</span>
                      <strong>{formatBookPrice(amount)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {sampleHref ? (
              <p className="course-page-lead">
                A sample of this book is available.{' '}
                <a className="course-sample-link" href={sampleHref} target="_blank" rel="noreferrer">
                  Open sample PDF
                </a>
              </p>
            ) : null}
            {publicBook.purchasable ? (
              <Link href={buyHref} className="course-buy-btn">
                Buy this book{price ? ` · ${price}` : ''}
              </Link>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Empty description="Subject not found" />
      </main>
    );
  }

  const base = `/courses/${slug}/sem-${data.semester.number}/${data.slug}`;
  const chapters = [...(data.chapters || [])].sort(compareChapters);
  const cover = data.frontCoverUrl || (data.coverKey ? assetUrl(data.coverKey) : null);
  const readHref = chapters[0] ? `${base}/read?chapter=${chapters[0].slug}` : `${base}/read`;

  return (
    <main className="container" style={{ padding: '24px 16px 64px' }}>
      <Link href={`/courses/${slug}/sem-${data.semester.number}`} className="course-back">
        ← {data.semester.title}
      </Link>
      <div className="course-closed-layout">
        <Link href={readHref} className="course-closed-book" aria-label={`Open ${data.name}`}>
          <span className="course-closed-spine" aria-hidden />
          <span className="course-closed-cover">
            <CourseCover src={cover} title={data.name} seed={data.id} />
          </span>
          <span className="course-closed-pages" aria-hidden />
        </Link>
        <section className="course-closed-chapters">
          <p className="course-card-kicker">
            {data.course.name} · {data.semester.title}
          </p>
          <h1 className="course-page-title">{data.name}</h1>
          {data.description ? <p className="course-page-lead">{data.description}</p> : null}
          <div className="course-ebook-perks is-compact">
            <span className="course-ebook-perk-pill">⚡ Chapter Quizzes & Flashcards</span>
            <span className="course-ebook-perk-pill">🔍 Instant Search</span>
            <span className="course-ebook-perk-pill">📝 Digital Notes</span>
            <span className="course-ebook-perk-pill">📱 Read on Any Device</span>
          </div>
          <h2 className="course-section-title">Chapters</h2>
          {chapters.length === 0 ? (
            <CourseEmpty message="No chapters in this subject yet." />
          ) : (
            <div className="course-chapter-list">
              {chapters.map((ch: any, i: number) => {
                const chNum = extractChapterNumber(ch.title) ?? (i + 1);
                return (
                  <div key={ch.id} className="course-chapter-row">
                    <Link
                      href={`${base}/read?chapter=${ch.slug}`}
                      className="course-chapter-open"
                    >
                      <span className="course-nav-badge">{chNum}</span>
                      <span>
                        <span className="course-card-kicker">Chapter {chNum}</span>
                        <h3>{ch.title}</h3>
                      </span>
                    </Link>
                    <div className="course-chapter-actions">
                      <Link href={`${base}/read?chapter=${ch.slug}`} className="course-read-btn">
                        Read
                      </Link>
                      <button
                        type="button"
                        className="course-practice-btn"
                        onClick={() => setPracticeChapter({ id: ch.id, title: ch.title })}
                      >
                        Practice
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {practiceChapter ? (
        <div
          className="course-practice-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-practice-overlay-title"
        >
          <CoursePracticeQuiz
            chapterId={practiceChapter.id}
            chapterTitle={practiceChapter.title}
            subjectTitle={data.name}
            kicker={`${data.course?.name || ''} · ${practiceChapter.title}`}
            closeLabel="Close"
            onClose={() => setPracticeChapter(null)}
          />
        </div>
      ) : null}
    </main>
  );
}
