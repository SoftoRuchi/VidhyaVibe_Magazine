'use client';

import { Button, Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { CourseAccessBlocked } from '../../../../../../components/CourseBrowse';
import { useAuth } from '../../../../../../lib/authContext';
import { buildCourseInteractives } from '../../../../../../lib/courseInteractives';
import {
  courseAccessMessage,
  courseLoginHref,
  fetchChapter,
  fetchSemester,
  fetchSubject,
} from '../../../../../../lib/coursesApi';
import CourseInteractives from '../read/CourseInteractives';

export default function CourseExplainPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const chapterSlug = String(search.get('chapter') || '');
  const conceptParam = String(search.get('concept') || '');
  const pageParam = Number(search.get('page') || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));

  const [subject, setSubject] = React.useState<any>(null);
  const [chapter, setChapter] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [accessError, setAccessError] = React.useState('');
  const [blockedSubjectId, setBlockedSubjectId] = React.useState<number | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(conceptParam || null);

  const pageNumber = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : undefined;

  React.useEffect(() => {
    if (authLoading) return;
    if (!slug || !number || !subjectSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const sem = await fetchSemester(slug, number);
        const match = (sem.subjects || []).find((s: any) => s.slug === subjectSlug);
        if (!match) return;
        try {
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
        } catch (e: any) {
          if (e?.response?.status === 401) setNeedLogin(true);
          else if (e?.response?.status === 403) {
            setBlockedSubjectId(match.id);
            setAccessError(courseAccessMessage(e) || 'You do not have access to this book.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, slug, number, subjectSlug, chapterSlug]);

  const interactives = React.useMemo(
    () =>
      buildCourseInteractives({
        contentJson: chapter?.contentJson || null,
        html: chapter?.content || '',
        chapterTitle: chapter?.title,
        subjectTitle: subject?.name,
      }),
    [chapter, subject],
  );

  React.useEffect(() => {
    if (conceptParam && interactives.some((item) => item.id === conceptParam)) {
      setActiveId(conceptParam);
      return;
    }
    if (!activeId && interactives[0]) setActiveId(interactives[0].id);
  }, [conceptParam, interactives, activeId]);

  const base = subject ? `/courses/${slug}/sem-${subject.semester.number}/${subject.slug}` : '';
  const readHref = chapter
    ? `${base}/read?chapter=${encodeURIComponent(chapter.slug)}${pageNumber ? `&page=${pageNumber}` : ''}`
    : base;

  const selectConcept = (id: string) => {
    setActiveId(id);
    const next = new URLSearchParams(search.toString());
    next.set('concept', id);
    if (chapter?.slug) next.set('chapter', chapter.slug);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

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
          <Button type="primary">Login to view explanations</Button>
        </Link>
      </main>
    );
  }
  if (accessError) {
    return (
      <CourseAccessBlocked
        message={accessError}
        backHref={`/courses/${slug}`}
        subjectId={blockedSubjectId}
      />
    );
  }
  if (!subject || !chapter) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Empty description="Chapter not found" />
      </main>
    );
  }

  return (
    <main className="course-notes-page course-explain-page">
      <header className="course-notes-page-head">
        <Link href={readHref} className="course-back">
          ← Back to book
        </Link>
        <h1>Explain</h1>
        <p>
          {subject.name} · {chapter.title}
          {pageNumber ? ` · Page ${pageNumber}` : ''}
        </p>
      </header>
      <CourseInteractives
        variant="page"
        items={interactives}
        activeId={activeId}
        onSelect={selectConcept}
      />
    </main>
  );
}
