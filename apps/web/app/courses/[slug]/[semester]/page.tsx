'use client';

import { Empty, Spin } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';
import {
  CourseBookTile,
  CourseEmpty,
  CourseGrid,
  CourseHero,
  CourseSection,
} from '../../../../components/CourseBrowse';
import { courseCountLabel } from '../../../../lib/courseLabels';
import {
  fetchMyBooks,
  fetchSemester,
  formatBookPrice,
  type EntitledBook,
} from '../../../../lib/coursesApi';

export default function SemesterPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [myBooks, setMyBooks] = React.useState<EntitledBook[]>([]);

  React.useEffect(() => {
    if (!slug || !number) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    Promise.all([
      fetchSemester(slug, number),
      token
        ? fetchMyBooks().catch(() => [] as EntitledBook[])
        : Promise.resolve([] as EntitledBook[]),
    ])
      .then(([sem, books]) => {
        setData(sem);
        setMyBooks(books);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug, number]);

  const accessById = React.useMemo(() => {
    const map = new Map<number, EntitledBook>();
    myBooks.forEach((b) => map.set(b.id, b));
    return map;
  }, [myBooks]);

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
        subtitle="Open a book you already have, or subscribe to one for individual access."
        chips={[courseCountLabel(subjects.length, 'subject')]}
        actions={
          <Link href={`/courses/${slug}/subscribe`} className="vv-course-btn is-subscribe">
            Subscribe
          </Link>
        }
      />
      <CourseSection title={subjects.length ? 'Subjects in this semester' : 'Subjects'} />
      {subjects.length === 0 ? (
        <CourseEmpty message="No subjects have been added to this semester yet." />
      ) : (
        <CourseGrid variant="book">
          {subjects.map((s: any) => {
            const entitled = accessById.get(s.id);
            const owned = Boolean(entitled) || s.canRead;
            const priceLabel = formatBookPrice(s.price);
            const href = `/courses/${slug}/sem-${data.semester.number}/${s.slug}`;
            const canSubscribe = Boolean(s.purchasable);
            return (
              <CourseBookTile
                key={s.id}
                title={s.name}
                subtitle={[s.syllabusCode, courseCountLabel(s.chapterCount || 0, 'chapter')]
                  .filter(Boolean)
                  .join(' · ')}
                coverKey={s.coverKey}
                href={href}
                subscribeHref={canSubscribe ? `${href}/buy` : null}
                seed={s.id}
                owned={owned}
                tag={owned ? 'Open' : canSubscribe ? `Subscribe ${priceLabel}` : 'License needed'}
              />
            );
          })}
        </CourseGrid>
      )}
    </main>
  );
}
