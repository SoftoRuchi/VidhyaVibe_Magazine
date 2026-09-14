import { useParams, usePathname } from 'next/navigation';
import React from 'react';
import api from '../lib/api';

export type AdminChapter = {
  id: number;
  title: string;
  slug: string;
  sortOrder: number;
  startPage?: number | null;
  endPage?: number | null;
  content?: string | null;
  contentFormat?: string | null;
  contentJson?: unknown;
  subjectId: number;
  subjectName: string;
  semesterId: number;
  semesterNumber: number;
  semesterTitle: string;
  courseId: number;
  courseName: string;
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
};

export function chapterStudioPath(
  courseId: number,
  chapterId: number,
  page: 'text' | 'preview' | 'simple-words' | 'flashcards' | 'quizzes' = 'text',
) {
  const base = `/admin/courses/${courseId}/chapters/${chapterId}`;
  if (page === 'text') return base;
  return `${base}/${page}`;
}

export function useAdminChapter() {
  const params = useParams();
  const pathname = usePathname();
  const courseId = Number(params?.id);
  const chapterId = Number(params?.chapterId);
  const [chapter, setChapter] = React.useState<AdminChapter | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!chapterId) return;
    api
      .get(`/admin/courses/chapters/${chapterId}`)
      .then((r) => {
        setChapter(r.data);
        setError(null);
      })
      .catch(() => setError('Could not load this chapter'));
  }, [chapterId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const page: 'text' | 'preview' | 'simple-words' | 'flashcards' | 'quizzes' = pathname?.includes(
    '/simple-words',
  )
    ? 'simple-words'
    : pathname?.includes('/flashcards')
      ? 'flashcards'
      : pathname?.includes('/quizzes')
        ? 'quizzes'
        : pathname?.includes('/preview')
          ? 'preview'
          : 'text';

  return { courseId, chapterId, chapter, error, load, page, pathname };
}

export async function saveAdminChapter(
  chapter: AdminChapter,
  patch: Partial<AdminChapter> & { contentJson?: unknown },
) {
  const body: Record<string, unknown> = {
    title: patch.title ?? chapter.title,
    slug: chapter.slug,
    sortOrder: patch.sortOrder ?? chapter.sortOrder,
    startPage: patch.startPage ?? chapter.startPage,
    endPage: patch.endPage ?? chapter.endPage,
  };
  if ('contentJson' in patch) body.contentJson = patch.contentJson;
  if ('content' in patch) body.content = patch.content;
  await api.put(`/admin/courses/chapters/${chapter.id}`, body);
}
