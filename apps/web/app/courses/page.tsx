'use client';

import { Empty, Spin } from 'antd';
import React from 'react';
import {
  CourseContinueCard,
  CourseHero,
  CourseNavCard,
  CourseSection,
} from '../../components/CourseBrowse';
import { courseCountLabel } from '../../lib/courseLabels';
import {
  fetchCourses,
  fetchCourseContinue,
  type CourseContinue,
  type CourseSummary,
} from '../../lib/coursesApi';

export default function CoursesPage() {
  const [courses, setCourses] = React.useState<CourseSummary[]>([]);
  const [cont, setCont] = React.useState<CourseContinue | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    Promise.all([
      fetchCourses().catch(() => [] as CourseSummary[]),
      token ? fetchCourseContinue() : Promise.resolve(null),
    ])
      .then(([list, next]) => {
        setCourses(list);
        setCont(next);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container" style={{ padding: '24px 16px 64px' }}>
      <CourseHero
        kicker="VidhyaVibe courses"
        title="Read. Practise. Revise."
        subtitle="University textbooks you can read like a book, then practise with quizzes."
      />
      {cont?.href ? (
        <CourseContinueCard
          href={cont.href}
          chapterTitle={cont.chapterTitle}
          courseName={cont.courseName}
          subjectName={cont.subjectName}
          percent={cont.percent}
        />
      ) : null}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : courses.length === 0 ? (
        <>
          <CourseSection title="Courses" />
          <Empty description="No courses published yet" />
        </>
      ) : (
        <>
          <CourseSection title="Your programmes" />
          <div className="course-nav-list">
            {courses.map((c) => (
              <CourseNavCard
                key={c.id}
                href={`/courses/${c.slug}`}
                badge="▣"
                title={c.name}
                subtitle={[c.university, courseCountLabel(c.semesterCount || 0, 'semester')]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
