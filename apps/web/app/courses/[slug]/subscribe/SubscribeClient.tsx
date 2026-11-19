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
import { assetUrl } from '../../../../lib/apiBase';
import { useAuth } from '../../../../lib/authContext';
import { courseCountLabel } from '../../../../lib/courseLabels';
import {
  fetchCourseCatalog,
  fetchMyBooks,
  formatBookSaleTag,
  type CourseCatalog,
  type CourseCatalogBook,
  type EntitledBook,
} from '../../../../lib/coursesApi';

export default function CourseSubscribePage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const { loggedIn } = useAuth();
  const [data, setData] = React.useState<CourseCatalog | null>(null);
  const [myBooks, setMyBooks] = React.useState<EntitledBook[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!slug) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    Promise.all([
      fetchCourseCatalog(slug),
      token || loggedIn
        ? fetchMyBooks().catch(() => [] as EntitledBook[])
        : Promise.resolve([] as EntitledBook[]),
    ])
      .then(([catalog, books]) => {
        setData(catalog);
        setMyBooks(books);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug, loggedIn]);

  const ownedIds = React.useMemo(() => new Set(myBooks.map((b) => b.id)), [myBooks]);

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

  const groups = data.books.reduce<
    Array<{ title: string; number: number; books: CourseCatalogBook[] }>
  >((acc, book) => {
    const last = acc[acc.length - 1];
    if (!last || last.number !== book.semesterNumber) {
      acc.push({ title: book.semesterTitle, number: book.semesterNumber, books: [book] });
    } else {
      last.books.push(book);
    }
    return acc;
  }, []);

  return (
    <main className="container" style={{ padding: '24px 16px 64px' }}>
      <Link href={`/courses/${slug}`} className="course-back">
        ← {data.name}
      </Link>
      <CourseHero
        kicker={data.university || 'Subscribe'}
        title={`Subscribe to ${data.name}`}
        subtitle="Pick a textbook to subscribe. College seats stay separate from individual access."
        coverSrc={data.coverKey ? assetUrl(data.coverKey) : null}
        chips={[courseCountLabel(data.books.length, 'book')]}
      />
      {groups.length === 0 ? (
        <CourseEmpty message="No textbooks are listed for this course yet." />
      ) : (
        groups.map((group) => (
          <section key={group.number}>
            <CourseSection title={group.title || `Semester ${group.number}`} />
            <CourseGrid variant="book">
              {group.books.map((book) => {
                const owned = Boolean(book.canRead) || ownedIds.has(book.id);
                const canSubscribe = Boolean(book.purchasable);
                const priceLabel = formatBookSaleTag(book.price, book.listPrice, book.discountPct);
                return (
                  <CourseBookTile
                    key={book.id}
                    title={book.name}
                    subtitle={[
                      book.syllabusCode,
                      courseCountLabel(book.chapterCount || 0, 'chapter'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    coverKey={book.coverKey}
                    href={book.href}
                    subscribeHref={canSubscribe ? book.buyHref : null}
                    seed={book.id}
                    owned={owned}
                    tag={
                      owned ? 'Open' : canSubscribe ? priceLabel : 'License needed'
                    }
                  />
                );
              })}
            </CourseGrid>
          </section>
        ))
      )}
    </main>
  );
}
