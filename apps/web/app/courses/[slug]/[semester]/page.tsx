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
} from '../../../../components/CourseBrowse';
import { courseCountLabel } from '../../../../lib/courseLabels';
import { fetchSemester } from '../../../../lib/coursesApi';

export default function SemesterPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!slug || !number) return;
    fetchSemester(slug, number)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug, number]);

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
        <Empty description="Semester not found" />
      </main>
    );
  }

  const subjects = data.subjects || [];

  return (
    <main className="container" style={{ padding: '24px 16px 64px' }}>
      <Link href={`/courses/${slug}`} className="course-back">
        ← {data.course.name}
      </Link>
      <CourseHero
        kicker={data.course.name}
        title={data.semester.title}
        subtitle="Pick a subject to open the book and practise."
        chips={[courseCountLabel(subjects.length, 'subject')]}
      />
      <CourseSection title={subjects.length ? 'Subjects in this semester' : 'Subjects'} />
      {subjects.length === 0 ? (
        <CourseEmpty message="No subjects have been added to this semester yet." />
      ) : (
        <div className="course-nav-list">
          {subjects.map((s: any) => (
            <CourseNavCard
              key={s.id}
              href={`/courses/${slug}/sem-${data.semester.number}/${s.slug}`}
              badge="▣"
              title={s.name}
              subtitle={[s.syllabusCode, courseCountLabel(s.chapterCount || 0, 'chapter')]
                .filter(Boolean)
                .join(' · ')}
              muted={!s.chapterCount}
            />
          ))}
        </div>
      )}
    </main>
  );
}
