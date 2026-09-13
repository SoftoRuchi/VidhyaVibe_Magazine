'use client';

import Link from 'next/link';
import React from 'react';
import { chapterStudioPath, useAdminChapter } from '../../../../../../lib/useAdminChapter';

export default function ChapterStudioLayout({ children }: { children: React.ReactNode }) {
  const { courseId, chapterId, chapter, error, page } = useAdminChapter();

  return (
    <main className="vv-course-page">
      <div className="vv-crumb">
        <Link href="/admin/courses">Courses</Link>
        <span>/</span>
        {chapter ? (
          <Link href={`/admin/courses/${chapter.courseId}`}>{chapter.courseName}</Link>
        ) : (
          <span>Course</span>
        )}
        <span>/</span>
        <span>{chapter?.title || 'Chapter'}</span>
      </div>
      <h1>{chapter?.title || 'Chapter'}</h1>
      <p className="vv-course-lead">
        {chapter
          ? `${chapter.semesterTitle || `Semester ${chapter.semesterNumber}`} → ${chapter.subjectName}`
          : 'Loading chapter…'}
        {courseId ? (
          <>
            {' · '}
            <Link href={`/admin/courses/${courseId}`}>Back to chapters</Link>
          </>
        ) : null}
      </p>
      {error ? <p className="vv-hint">{error}</p> : null}
      <nav className="vv-studio-nav">
        {(
          [
            ['text', 'Write chapter'],
            ['simple-words', 'Simple words'],
            ['flashcards', 'Flashcards'],
            ['quizzes', 'Quizzes'],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={chapterStudioPath(courseId || chapter?.courseId || 0, chapterId, key)}
            className={page === key ? 'is-on' : ''}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="vv-course-editor">{children}</section>
    </main>
  );
}
