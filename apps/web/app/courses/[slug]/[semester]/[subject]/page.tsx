'use client';

import { Button, Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';
import { CourseEmpty, CourseHero, CourseSection } from '../../../../../components/CourseBrowse';
import { useAuth } from '../../../../../lib/authContext';
import { courseCountLabel } from '../../../../../lib/courseLabels';
import { courseLoginHref, fetchSemester, fetchSubject } from '../../../../../lib/coursesApi';

export default function SubjectPage() {
  const params = useParams();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);

  React.useEffect(() => {
    if (authLoading) return;
    if (!loggedIn) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
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
        const subject = await fetchSubject(match.id);
        if (!cancelled) setData(subject);
      } catch (e: any) {
        if (e?.response?.status === 401) setNeedLogin(true);
        else if (!cancelled) setData(null);
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

  if (needLogin) {
    return (
      <main className="container" style={{ padding: '48px 16px' }}>
        <h1 className="course-page-title">Sign in to study this subject</h1>
        <p className="course-page-lead">Course books and quizzes are available after you log in.</p>
        <Link href={courseLoginHref()}>
          <Button type="primary">Login to continue</Button>
        </Link>
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
  const chapters = data.chapters || [];

  return (
    <main className="container" style={{ padding: '24px 16px 64px' }}>
      <Link href={`/courses/${slug}/sem-${data.semester.number}`} className="course-back">
        ← {data.semester.title}
      </Link>
      <CourseHero
        kicker={`${data.course.name} · ${data.semester.title}`}
        title={data.name}
        subtitle={data.description}
        chips={[
          ...(data.syllabusCode ? [data.syllabusCode] : []),
          courseCountLabel(chapters.length, 'chapter'),
        ]}
      />
      <CourseSection title={chapters.length ? 'Read a chapter' : 'Chapters'} />
      {chapters.length === 0 ? (
        <CourseEmpty message="No chapters in this subject yet." />
      ) : (
        <div className="course-chapter-list">
          {chapters.map((ch: any, i: number) => (
            <div key={ch.id} className="course-chapter-row">
              <div className="course-nav-badge">{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="course-card-kicker">Chapter {i + 1}</div>
                <h3>{ch.title}</h3>
              </div>
              <div className="course-chapter-actions">
                <Link href={`${base}/read?chapter=${ch.slug}`}>
                  <Button type="primary">Read</Button>
                </Link>
                <Link href={`${base}/quiz?chapter=${ch.slug}`}>
                  <Button>Practice</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
