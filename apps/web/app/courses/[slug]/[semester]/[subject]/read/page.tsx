'use client';

import { Button, Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React from 'react';
import { CourseAccessBlocked } from '../../../../../../components/CourseBrowse';
import { useAuth } from '../../../../../../lib/authContext';
import {
  acquireBookSession,
  courseAccessMessage,
  courseLoginHref,
  fetchChapter,
  fetchSemester,
  fetchSubject,
  heartbeatBookSession,
  quickChecksFromActivities,
  releaseBookSession,
  saveCourseProgress,
  type CourseQuickCheckItem,
} from '../../../../../../lib/coursesApi';
import { compareChapters } from '../../../../../../lib/courseChapters';
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
  const [accessError, setAccessError] = React.useState('');
  const [sessionBlocked, setSessionBlocked] = React.useState('');
  const [blockedSubjectId, setBlockedSubjectId] = React.useState<number | null>(null);
  const pageRef = React.useRef<number | undefined>(
    Number.isFinite(pageParam) && pageParam > 0 ? pageParam : undefined,
  );
  const sessionIdRef = React.useRef<number | null>(null);
  const [readingPage, setReadingPage] = React.useState<number | undefined>(pageRef.current);

  const onReadingPage = React.useCallback((page: number) => {
    pageRef.current = page;
    setReadingPage((prev) => (prev === page ? prev : page));
  }, []);

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
        try {
          const sub = await fetchSubject(match.id);
          const chapters = [...(sub.chapters || [])].sort(compareChapters);
          sub.chapters = chapters;
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

  React.useEffect(() => {
    if (!subject?.id || !chapter?.id) return;
    let sessionId: number | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        const session = await acquireBookSession(subject.id, {
          chapterId: chapter.id,
          pageNumber: pageRef.current,
        });
        if (cancelled) {
          await releaseBookSession(subject.id, session.sessionId).catch(() => {});
          return;
        }
        sessionId = session.sessionId;
        sessionIdRef.current = session.sessionId;
        const beat = () => {
          if (!sessionId) return;
          heartbeatBookSession(subject.id, sessionId, {
            chapterId: chapter.id,
            pageNumber: pageRef.current,
          }).catch((e: any) => {
            if (e?.response?.status === 409) {
              setSessionBlocked(courseAccessMessage(e) || 'This session ended.');
            }
          });
        };
        timer = setInterval(beat, 30000);
      } catch (e: any) {
        if (cancelled) return;
        if (e?.response?.status === 403 || e?.response?.status === 409) {
          setSessionBlocked(courseAccessMessage(e) || 'Could not open a reading session.');
        }
      }
    })();
    return () => {
      cancelled = true;
      sessionIdRef.current = null;
      if (timer) clearInterval(timer);
      if (sessionId && subject?.id) {
        releaseBookSession(subject.id, sessionId).catch(() => {});
      }
    };
  }, [subject?.id, chapter?.id]);

  React.useEffect(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || !subject?.id || !chapter?.id) return;
    const t = window.setTimeout(() => {
      heartbeatBookSession(subject.id, sessionId, {
        chapterId: chapter.id,
        pageNumber: pageRef.current,
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(t);
  }, [subject?.id, chapter?.id, readingPage]);

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
  if (accessError) {
    return (
      <CourseAccessBlocked
        title="You cannot open this book"
        message={accessError}
        backHref={`/courses/${slug}`}
        subjectId={blockedSubjectId}
      />
    );
  }
  if (sessionBlocked) {
    return (
      <CourseAccessBlocked
        title="Reading session ended"
        message={sessionBlocked}
        backHref={`/courses/${slug}`}
        showBuy={false}
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

  const base = `/courses/${slug}/sem-${subject.semester.number}/${subject.slug}`;
  const chapters = [...(subject.chapters || [])].sort(compareChapters);
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
    <main className="course-reader-page">
      <CourseBookReader
        key={chapter.id}
        html={chapter.content || ''}
        header={`${subject.course.name} · ${subject.semester.title}`}
        chapterTitle={chapter.title}
        subjectTitle={subject.name}
        closeHref={base}
        readBase={base}
        chapterSlug={chapter.slug}
        bookKey={`${slug}:${number}:${subject.slug}`}
        chapters={(chapters as { slug: string; title: string }[]).map((c) => ({
          slug: c.slug,
          title: c.title,
        }))}
        notesHref={`${base}/notes?chapter=${encodeURIComponent(chapter.slug)}`}
        practiceHref={practiceActs.length > 0 ? `${base}/quiz?chapter=${chapter.slug}` : null}
        practiceActivity={
          practiceActs.find((a: any) => a.activityType === 'QUIZ' && a.placement === 'PRACTICE') ||
          practiceActs.find((a: any) => a.activityType === 'QUIZ') ||
          practiceActs.find((a: any) => a.placement === 'PRACTICE') ||
          null
        }
        prevChapter={prev ? { slug: prev.slug, title: prev.title } : null}
        nextChapter={next ? { slug: next.slug, title: next.title } : null}
        startPage={chapter.startPage || 1}
        chapterId={chapter.id}
        initialPage={Number.isFinite(pageParam) && pageParam > 0 ? pageParam : undefined}
        quickChecks={quickChecks}
        contentJson={chapter.contentJson || null}
        frontCoverUrl={subject.frontCoverUrl || chapter.subject?.frontCoverUrl}
        backCoverUrl={subject.backCoverUrl || chapter.subject?.backCoverUrl}
        onReadingPage={onReadingPage}
        initialNotesOpen={search.get('notes') === '1'}
      />
    </main>
  );
}
