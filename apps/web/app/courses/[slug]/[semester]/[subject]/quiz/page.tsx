'use client';

import { Button, Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { CourseAccessBlocked } from '../../../../../../components/CourseBrowse';
import { useAuth } from '../../../../../../lib/authContext';
import {
  courseAccessMessage,
  courseLoginHref,
  fetchChapter,
  fetchSemester,
  fetchSubject,
} from '../../../../../../lib/coursesApi';
import CoursePracticeQuiz, { pickPracticeActivity } from '../read/CoursePracticeQuiz';

export default function CourseQuizPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const chapterSlug = String(search.get('chapter') || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));

  const [subject, setSubject] = React.useState<any>(null);
  const [chapter, setChapter] = React.useState<any>(null);
  const [activity, setActivity] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [accessError, setAccessError] = React.useState('');
  const [blockedSubjectId, setBlockedSubjectId] = React.useState<number | null>(null);

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
          setActivity(pickPracticeActivity(ch.activities));
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
          <Button type="primary">Login to take the quiz</Button>
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

  const base = `/courses/${slug}/sem-${subject.semester.number}/${subject.slug}`;
  const readHref = `${base}/read?chapter=${encodeURIComponent(chapter.slug)}`;

  return (
    <div
      className="course-practice-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-practice-overlay-title"
    >
      <CoursePracticeQuiz
        activity={activity}
        chapterTitle={chapter.title}
        subjectTitle={subject.name}
        kicker={`${subject.course?.name || ''} · ${chapter.title}`.replace(/^\s·\s/, '')}
        onClose={() => router.push(readHref)}
      />
    </div>
  );
}
