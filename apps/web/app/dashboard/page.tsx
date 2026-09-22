'use client';

import { Empty, Spin } from 'antd';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import {
  CourseBookTile,
  CourseContinueCard,
  CourseGrid,
  CourseHomeCard,
  CourseSection,
} from '../../components/CourseBrowse';
import libraryImg from '../../components/images/library.png';
import MagazineCard from '../../components/MagazineCard';
import PostCard, { type SitePostItem } from '../../components/PostCard';
import api from '../../lib/api';
import { assetUrl } from '../../lib/apiBase';
import { useAuth } from '../../lib/authContext';
import {
  bookAccessLabel,
  fetchAllCourseNotes,
  fetchCourseContinue,
  fetchCourses,
  fetchMyBooks,
  fetchInstituteCampuses,
  type CourseContinue,
  type CourseNoteRecord,
  type CourseSummary,
  type EntitledBook,
} from '../../lib/coursesApi';
import { useProductMode } from '../../lib/productMode';
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
  const router = useRouter();
  const { loggedIn, loading: authLoading } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [posts, setPosts] = useState<SitePostItem[]>([]);
  const [continueReading, setContinueReading] = useState<CourseContinue | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [recentNotes, setRecentNotes] = useState<CourseNoteRecord[]>([]);
  const [myBooks, setMyBooks] = useState<EntitledBook[]>([]);
  const [collegeAdmin, setCollegeAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const { mode, canUseCourses } = useProductMode();
  const showCourses = mode === 'course' && canUseCourses;

  useEffect(() => {
    if (authLoading) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!loggedIn && !token) {
      router.replace('/login?redirect=/dashboard');
    }
  }, [authLoading, loggedIn, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const token = localStorage.getItem('access_token');
      if (!token) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
          setLoadingPosts(false);
        }
        return;
      }
      try {
        const readerId = isChildAudience() ? getSelectedReaderId() : null;
        const suffix = readerId ? `?readerId=${readerId}` : '';
        const [postsRes, libraryRes, continueRes, coursesRes, notesRes, booksRes, campusRes] =
          await Promise.all([
            showCourses
              ? Promise.resolve({ data: { posts: [] as SitePostItem[] } })
              : cachedGet<{ posts?: SitePostItem[] }>(api, '/api/posts', undefined, 60_000),
            showCourses
              ? Promise.resolve({ data: { items: [] as LibraryItem[] } })
              : api.get(`/api/library${suffix}`, {
                  headers: { Authorization: `Bearer ${token}` },
                }),
            showCourses ? fetchCourseContinue() : Promise.resolve(null),
            showCourses
              ? fetchCourses().catch(() => [] as CourseSummary[])
              : Promise.resolve([] as CourseSummary[]),
            showCourses
              ? fetchAllCourseNotes().catch(() => [] as CourseNoteRecord[])
              : Promise.resolve([] as CourseNoteRecord[]),
            showCourses
              ? fetchMyBooks().catch(() => [] as EntitledBook[])
              : Promise.resolve([] as EntitledBook[]),
            showCourses ? fetchInstituteCampuses() : Promise.resolve([] as { id: number }[]),
          ]);
        if (cancelled) return;

        setPosts(postsRes.data?.posts ?? []);
        setItems((libraryRes.data as { items?: LibraryItem[] })?.items || []);
        setContinueReading(continueRes);
        setCourses(coursesRes || []);
        setRecentNotes((notesRes || []).slice(0, 3));
        setMyBooks(booksRes || []);
        setCollegeAdmin((campusRes || []).length > 0);
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

    if (!authLoading) loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, showCourses]);

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
                My {showCourses ? 'books' : 'Library'}
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

        {showCourses ? (
          <section style={{ marginBottom: '1.5rem' }}>
            <div className="course-home-stack">
              {continueReading?.href ? (
                <CourseContinueCard
                  href={continueReading.href}
                  chapterTitle={continueReading.chapterTitle}
                  courseName={continueReading.courseName}
                  subjectName={continueReading.subjectName}
                  percent={continueReading.percent}
                />
              ) : null}
              <CourseHomeCard
                subtitle={
                  courses.length
                    ? `${courses
                        .slice(0, 2)
                        .map((c) => c.name)
                        .join(', ')}${courses.length > 2 ? ' and more' : ''}`
                    : 'BCA, BBA and university textbooks'
                }
              />
              <CourseHomeCard
                href={courses.length === 1 ? `/courses/${courses[0].slug}/subscribe` : '/courses'}
                title="Subscribe"
                subtitle="Buy a textbook for individual access"
              />
              <CourseHomeCard
                href="/notes"
                title="Notes"
                subtitle={
                  recentNotes.length
                    ? recentNotes[0].chapterTitle
                      ? `Latest: ${recentNotes[0].chapterTitle}`
                      : `${recentNotes.length} saved note${recentNotes.length === 1 ? '' : 's'}`
                    : 'View and manage notes by book, chapter, or topic'
                }
              />
              <CourseHomeCard
                href="/books"
                title="My books"
                subtitle={
                  myBooks.length
                    ? `${myBooks.length} textbook${myBooks.length === 1 ? '' : 's'} you can open`
                    : 'Book bank, library, and books you bought'
                }
              />
              {collegeAdmin ? (
                <CourseHomeCard
                  href="/institute"
                  title="College"
                  subtitle="Who is reading, licenses, and student activity"
                />
              ) : null}
            </div>
            {myBooks.length ? (
              <div style={{ marginTop: '1.25rem' }}>
                <CourseSection title="Your textbooks" />
                <CourseGrid variant="book">
                  {myBooks.slice(0, 8).map((book) => (
                    <CourseBookTile
                      key={book.id}
                      title={book.name}
                      subtitle={[book.courseName, `Sem ${book.semesterNumber}`, book.instituteName]
                        .filter(Boolean)
                        .join(' · ')}
                      coverKey={book.coverKey}
                      href={book.href}
                      seed={book.id}
                      owned
                      tag={bookAccessLabel(book.accessModel)}
                    />
                  ))}
                </CourseGrid>
              </div>
            ) : null}
          </section>
        ) : null}

        {!showCourses && !loadingPosts && posts.length > 0 && (
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

        {!showCourses ? (
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
        ) : null}
      </div>
    </main>
  );
}
