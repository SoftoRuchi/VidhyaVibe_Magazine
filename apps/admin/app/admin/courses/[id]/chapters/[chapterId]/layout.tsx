'use client';

import { ArrowLeftOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Modal } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import ChapterBookPreview from '../../../../../../components/ChapterBookPreview';
import { asDoc } from '../../../../../../lib/textbookContent';
import { chapterStudioPath, useAdminChapter } from '../../../../../../lib/useAdminChapter';

export default function ChapterStudioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { courseId, chapterId, chapter, error, page } = useAdminChapter();
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (page === 'preview') setPreviewOpen(true);
  }, [page]);

  const closePreview = () => {
    setPreviewOpen(false);
    if (page === 'preview') {
      router.push(chapterStudioPath(courseId || chapter?.courseId || 0, chapterId, 'text'));
    }
  };

  const doc = chapter
    ? asDoc(chapter.contentJson, {
        id: String(chapter.id),
        title: chapter.title,
        html: chapter.content || '',
      })
    : null;

  const cId = courseId || chapter?.courseId || 0;
  const backHref = `/admin/courses/${cId}?tab=chapter${chapter?.subjectId ? `&subjectId=${chapter.subjectId}` : ''}${chapter?.id || chapterId ? `&chapterId=${chapter?.id || chapterId}` : ''}`;

  return (
    <main className="vv-course-page">
      <div className="vv-crumb">
        <Link href="/admin/courses">Courses</Link>
        <span>/</span>
        {chapter ? (
          <Link href={backHref}>{chapter.courseName}</Link>
        ) : (
          <span>Course</span>
        )}
        <span>/</span>
        <span>{chapter?.title || 'Chapter'}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{chapter?.title || 'Chapter'}</h1>
          <p className="vv-course-lead" style={{ margin: '4px 0 0' }}>
            {chapter
              ? `${chapter.semesterTitle || `Semester ${chapter.semesterNumber}`} → ${chapter.subjectName}`
              : 'Loading chapter…'}
            {cId ? (
              <>
                {' · '}
                <Link href={backHref}>Back to chapters</Link>
              </>
            ) : null}
          </p>
        </div>
        {cId ? (
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(backHref)}>
            Back to {chapter?.subjectName ? `${chapter.subjectName}` : 'chapters'}
          </Button>
        ) : null}
      </div>
      {error ? <p className="vv-hint">{error}</p> : null}
      <nav className="vv-studio-nav">
        {(
          [
            ['text', 'Write chapter'],
            ['preview', 'Preview'],
            ['simple-words', 'Simple words'],
            ['flashcards', 'Flashcards'],
            ['quizzes', 'Quizzes'],
          ] as const
        ).map(([key, label]) =>
          key === 'preview' ? (
            <button
              key={key}
              type="button"
              className={previewOpen ? 'is-on' : ''}
              onClick={() => setPreviewOpen(true)}
            >
              {label}
            </button>
          ) : (
            <Link
              key={key}
              href={chapterStudioPath(courseId || chapter?.courseId || 0, chapterId, key)}
              className={page === key ? 'is-on' : ''}
            >
              {label}
            </Link>
          ),
        )}
      </nav>
      <section className="vv-course-editor">{page === 'preview' ? null : children}</section>
      <Modal
        title="Book preview"
        open={previewOpen}
        onCancel={closePreview}
        footer={null}
        width="96vw"
        style={{ top: 12, maxWidth: 1400 }}
        wrapClassName="vv-book-preview-modal"
        destroyOnClose
      >
        {!chapter || !doc ? (
          <p className="vv-hint">Loading…</p>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <p className="vv-hint" style={{ margin: 0 }}>
                This is how the chapter looks in the book. Save on <strong>Write chapter</strong>{' '}
                first if you just edited it.
              </p>
              {chapter?.subjectId ? (
                <Link
                  href={`/admin/books/${chapter.subjectId}/read?chapter=${chapter.id}&from=${encodeURIComponent(backHref)}`}
                  target="_blank"
                >
                  <Button type="primary" size="small" icon={<EyeOutlined />}>
                    Open in Full Reader
                  </Button>
                </Link>
              ) : null}
            </div>
            <ChapterBookPreview
              doc={doc}
              header={`${chapter.courseName} · ${chapter.semesterTitle || `Semester ${chapter.semesterNumber}`}`}
              chapterTitle={chapter.title}
              startPage={chapter.startPage || 1}
              frontCoverUrl={chapter.frontCoverUrl}
              backCoverUrl={chapter.backCoverUrl}
              fit="modal"
            />
          </>
        )}
      </Modal>
    </main>
  );
}
