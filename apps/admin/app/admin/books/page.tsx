'use client';

import {
  BookOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  ReadOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  message,
} from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import api from '../../../lib/api';

type AdminBook = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  syllabusCode?: string | null;
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
  price?: number | null;
  physicalPrice?: number | null;
  bothPrice?: number | null;
  discountPct?: number | null;
  status: string;
  publishedAt?: string | null;
  courseId: number;
  courseName: string;
  courseSlug: string;
  university?: string | null;
  semesterId: number;
  semesterNumber: number;
  semesterTitle: string;
  chapterCount: number;
};

export default function AdminBooksPage() {
  const router = useRouter();
  const [books, setBooks] = React.useState<AdminBook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [courseFilter, setCourseFilter] = React.useState<number | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  const loadBooks = () => {
    setLoading(true);
    api
      .get('/admin/courses/books')
      .then((res) => {
        setBooks(res.data || []);
      })
      .catch((err) => {
        console.error('Failed to load books:', err);
        message.error('Failed to load books');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  React.useEffect(() => {
    loadBooks();
  }, []);

  // Compute unique courses for filter
  const courses = React.useMemo(() => {
    const map = new Map<number, string>();
    books.forEach((b) => {
      if (!map.has(b.courseId)) {
        map.set(b.courseId, b.courseName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [books]);

  // Filtered books
  const filteredBooks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((b) => {
      if (courseFilter && b.courseId !== courseFilter) return false;
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${b.name} ${b.syllabusCode || ''} ${b.courseName} ${b.semesterTitle} ${b.university || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [books, search, courseFilter, statusFilter]);

  const totalBooks = books.length;
  const publishedBooks = books.filter((b) => b.status === 'PUBLISHED').length;
  const totalChapters = books.reduce((acc, b) => acc + (b.chapterCount || 0), 0);

  return (
    <main className="vv-books-page" style={{ padding: '0 8px 48px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0f172a' }}>
            Textbooks & Course Books
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
            Browse and read any digital textbook in the exact two-page reader format as seen in the
            web application.
          </p>
        </div>
        <Space wrap>
          <Button icon={<FolderOpenOutlined />} onClick={() => router.push('/admin/courses')}>
            Manage Courses
          </Button>
        </Space>
      </div>

      {/* KPI Stats Bar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(15,23,42,0.05)',
              border: '1px solid rgba(15,23,42,0.06)',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Statistic
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                  TOTAL BOOKS AVAILABLE
                </span>
              }
              value={totalBooks}
              prefix={<BookOutlined style={{ color: '#ea580c', marginRight: 6 }} />}
              valueStyle={{ fontWeight: 900, color: '#0f172a' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(15,23,42,0.05)',
              border: '1px solid rgba(15,23,42,0.06)',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Statistic
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                  PUBLISHED TO STUDENTS
                </span>
              }
              value={publishedBooks}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a', marginRight: 6 }} />}
              valueStyle={{ fontWeight: 900, color: '#16a34a' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(15,23,42,0.05)',
              border: '1px solid rgba(15,23,42,0.06)',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Statistic
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                  ACTIVE PROGRAMMES
                </span>
              }
              value={courses.length}
              prefix={<FolderOpenOutlined style={{ color: '#2563eb', marginRight: 6 }} />}
              valueStyle={{ fontWeight: 900, color: '#0f172a' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(15,23,42,0.05)',
              border: '1px solid rgba(15,23,42,0.06)',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Statistic
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                  CHAPTERS WRITTEN
                </span>
              }
              value={totalChapters}
              prefix={<ThunderboltOutlined style={{ color: '#7c3aed', marginRight: 6 }} />}
              valueStyle={{ fontWeight: 900, color: '#0f172a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: '0 4px 12px rgba(15,23,42,0.05)',
          border: '1px solid rgba(15,23,42,0.06)',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search book title, syllabus code, or course…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ minWidth: 260, flex: 1, maxWidth: 420 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Course:</span>
          <Select
            value={courseFilter}
            onChange={setCourseFilter}
            style={{ width: 180 }}
            allowClear
            placeholder="All courses"
            options={courses.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Status:</span>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: 'All statuses' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'DRAFT', label: 'Draft' },
            ]}
          />
        </div>

        <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
          Showing {filteredBooks.length} of {totalBooks} books
        </div>
      </div>

      {/* Books Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 12, color: '#64748b' }}>Loading digital textbooks…</p>
        </div>
      ) : filteredBooks.length === 0 ? (
        <Empty
          description={
            books.length === 0
              ? 'No books available yet. Open Courses to add semesters and books.'
              : 'No books match the selected filters.'
          }
          style={{ padding: '60px 0' }}
        >
          {books.length === 0 ? (
            <Button type="primary" onClick={() => router.push('/admin/courses')}>
              Go to Courses
            </Button>
          ) : (
            <Button
              onClick={() => {
                setSearch('');
                setCourseFilter(null);
                setStatusFilter('ALL');
              }}
            >
              Reset filters
            </Button>
          )}
        </Empty>
      ) : (
        <Row gutter={[20, 20]}>
          {filteredBooks.map((book) => {
            const webReaderUrl =
              book.courseSlug && book.semesterNumber && book.slug
                ? `/courses/${book.courseSlug}/sem-${book.semesterNumber}/${book.slug}/read`
                : null;

            return (
              <Col key={book.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  bordered={false}
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 18,
                    overflow: 'hidden',
                    boxShadow: '0 6px 18px rgba(15,23,42,0.06)',
                    border: '1px solid rgba(15,23,42,0.07)',
                    background: '#ffffff',
                  }}
                  bodyStyle={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    padding: 16,
                  }}
                >
                  {/* Book Cover Banner */}
                  <div
                    style={{
                      height: 190,
                      background: book.frontCoverUrl
                        ? `url("${book.frontCoverUrl}") center/cover no-repeat`
                        : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                      borderRadius: 12,
                      marginBottom: 14,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: 12,
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.15)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Spine gradient overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 14,
                        background:
                          'linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(255,255,255,0.15) 60%, transparent 100%)',
                      }}
                    />

                    {/* Top Tags */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        zIndex: 2,
                      }}
                    >
                      <Tag
                        color={book.status === 'PUBLISHED' ? 'green' : 'orange'}
                        style={{ fontWeight: 800, fontSize: 10, margin: 0, border: 'none' }}
                      >
                        {book.status}
                      </Tag>
                      {book.syllabusCode ? (
                        <Tag
                          style={{
                            background: 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: 10,
                            margin: 0,
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          {book.syllabusCode}
                        </Tag>
                      ) : null}
                    </div>

                    {/* Book title on cover when no image */}
                    {!book.frontCoverUrl && (
                      <div
                        style={{
                          textAlign: 'center',
                          color: '#ffffff',
                          padding: '12px 8px',
                          zIndex: 2,
                        }}
                      >
                        <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>
                          {book.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                          {book.courseName} · {book.semesterTitle}
                        </div>
                      </div>
                    )}

                    {/* Bottom Chapter Badge */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        zIndex: 2,
                      }}
                    >
                      <Tag
                        style={{
                          background: 'rgba(15,23,42,0.85)',
                          color: '#f8fafc',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 11,
                          margin: 0,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {book.chapterCount} {book.chapterCount === 1 ? 'Chapter' : 'Chapters'}
                      </Tag>
                    </div>
                  </div>

                  {/* Book Metadata */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginBottom: 2 }}>
                      {book.courseName} · {book.semesterTitle}
                    </div>
                    <h3
                      style={{
                        margin: '0 0 6px',
                        fontSize: 15,
                        fontWeight: 800,
                        color: '#0f172a',
                        lineHeight: 1.35,
                      }}
                      title={book.name}
                    >
                      {book.name}
                    </h3>
                    {book.description ? (
                      <p
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          margin: '0 0 12px',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {book.description}
                      </p>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link
                        href={`/admin/books/${book.id}/read`}
                        style={{ flex: 1, textDecoration: 'none' }}
                      >
                        <Button
                          type="primary"
                          block
                          icon={<ReadOutlined />}
                          style={{
                            borderRadius: 10,
                            fontWeight: 700,
                            background: '#2563eb',
                          }}
                        >
                          View in Reader
                        </Button>
                      </Link>

                      <Tooltip title="Edit book & chapters in Course Studio">
                        <Button
                          icon={<SettingOutlined />}
                          style={{ borderRadius: 10 }}
                          onClick={() =>
                            router.push(
                              `/admin/courses/${book.courseId}?tab=subject&subjectId=${book.id}`,
                            )
                          }
                        />
                      </Tooltip>

                      {webReaderUrl ? (
                        <Tooltip title="Open in Student Web Application">
                          <a href={webReaderUrl} target="_blank" rel="noreferrer">
                            <Button icon={<GlobalOutlined />} style={{ borderRadius: 10 }} />
                          </a>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </main>
  );
}
