'use client';

import { Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';
import {
  CourseEmpty,
  CourseHero,
  CourseNavCard,
  CourseSection,
} from '../../../components/CourseBrowse';
import { courseCountLabel } from '../../../lib/courseLabels';
import { fetchCourse } from '../../../lib/coursesApi';

export default function CourseDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!slug) return;
    fetchCourse(slug)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="container" style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Empty description="Course not found" />
      </main>
    );
  }

  const semesters = data.semesters || [];
  const subjectTotal = semesters.reduce((sum: number, s: any) => sum + (s.subjectCount || 0), 0);

  return (
    <main className="container" style={{ padding: '24px 16px 64px' }}>
      <Link href="/courses" className="course-back">
        ← All courses
      </Link>
      <CourseHero
        kicker={data.university}
        title={data.name}
        subtitle={data.description}
        chips={[
          courseCountLabel(semesters.length, 'semester'),
          courseCountLabel(subjectTotal, 'subject'),
        ]}
      />
      <CourseSection title={semesters.length ? 'Choose a semester' : 'Semesters'} />
      {semesters.length === 0 ? (
        <CourseEmpty message="No semesters in this course yet." />
      ) : (
        <div className="course-nav-list">
          {semesters.map((s: any) => (
            <CourseNavCard
              key={s.id}
              href={`/courses/${slug}/sem-${s.number}`}
              badge={String(s.number)}
              title={s.title}
              subtitle={
                s.subjectCount ? courseCountLabel(s.subjectCount, 'subject') : 'No subjects yet'
              }
              muted={!s.subjectCount}
            />
          ))}
        </div>
      )}
    </main>
  );
}
