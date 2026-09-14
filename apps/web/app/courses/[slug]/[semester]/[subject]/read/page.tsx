'use client';

import { Button, Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React from 'react';
import { useAuth } from '../../../../../../lib/authContext';
import {
  courseLoginHref,
  fetchChapter,
  fetchSemester,
  fetchSubject,
  quickChecksFromActivities,
  saveCourseProgress,
  type CourseQuickCheckItem,
} from '../../../../../../lib/coursesApi';
import CourseBookReader from './CourseBookReader';

export default function CourseReadPage() {
  const params = useParams();
  const search = useSearchParams();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const chapterSlug = String(search.get('chapter') || '');
  const pageParam = Number(search.get('page') || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));

  const [subject, setSubject] = React.useState<any>(null);
  const [chapter, setChapter] = React.useState<any>(null);
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
        if (!match) return;
        const sub = await fetchSubject(match.id);
        const chapters = sub.chapters || [];
        const chMeta = chapters.find((c: any) => c.slug === chapterSlug) || chapters[0];
        if (!chMeta) {
          if (!cancelled) setSubject(sub);
          return;
        }
        const ch = await fetchChapter(chMeta.id);
        if (cancelled) return;
        setSubject(sub);
        setChapter(ch);
        const idx = chapters.findIndex((c: any) => c.id === chMeta.id);
        const percent = chapters.length ? Math.round(((idx + 1) / chapters.length) * 100) : 0;
        saveCourseProgress({ subjectId: sub.id, chapterId: chMeta.id, percent }).catch(() => {});
      } catch (e: any) {
        if (e?.response?.status === 401) setNeedLogin(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, slug, number, subjectSlug, chapterSlug]);

  if (loading || authLoading) {
    return (
      <main className="container" style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }
  if (needLogin) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Link href={courseLoginHref()}>
          <Button type="primary">Login to read this chapter</Button>
        </Link>
      </main>
    );
  }
  if (!subject || !chapter) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Empty description="Chapter not found" />
      </main>
    );
  }

  const base = `/courses/${slug}/sem-${subject.semester.number}/${subject.slug}`;
  const chapters = subject.chapters || [];
  const idx = chapters.findIndex((c: any) => c.id === chapter.id);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const practiceActs = (chapter.activities || []).filter(
    (a: any) => a.placement === 'PRACTICE' || a.activityType === 'QUIZ',
  );
  const quickChecks = [
    ...(((chapter.quickChecks || []) as CourseQuickCheckItem[]) || []),
    ...quickChecksFromActivities(chapter.activities || []),
  ];

  return (
    <main className="container course-reader-page" style={{ padding: '16px 16px 80px' }}>
      <Link href={base} className="course-back">
        ← {subject.name}
      </Link>
      <div className="course-mode-switch">
        <span className="course-mode-switch-active">Read</span>
        <Link href={`${base}/quiz?chapter=${chapter.slug}`}>Practice</Link>
      </div>
      <CourseBookReader
        html={chapter.content || ''}
        header={`${subject.course.name} · ${subject.semester.title}`}
        chapterTitle={chapter.title}
        startPage={chapter.startPage || 1}
        chapterId={chapter.id}
        initialPage={Number.isFinite(pageParam) && pageParam > 0 ? pageParam : undefined}
        quickChecks={quickChecks}
        frontCoverUrl={subject.frontCoverUrl || chapter.subject?.frontCoverUrl}
        backCoverUrl={subject.backCoverUrl || chapter.subject?.backCoverUrl}
      />
      <div className="course-reader-nav">
        {prev ? (
          <Link href={`${base}/read?chapter=${prev.slug}`}>
            <Button>← {prev.title}</Button>
          </Link>
        ) : (
          <span />
        )}
        {practiceActs.length > 0 ? (
          <Link href={`${base}/quiz?chapter=${chapter.slug}`}>
            <Button type="primary">Practice this chapter</Button>
          </Link>
        ) : null}
        {next ? (
          <Link href={`${base}/read?chapter=${next.slug}`}>
            <Button>{next.title} →</Button>
          </Link>
        ) : null}
      </div>
    </main>
  );
}
