import api from './api';

export function courseAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type CourseSummary = {
  id: number;
  name: string;
  slug: string;
  university?: string | null;
  description?: string | null;
  coverKey?: string | null;
  semesterCount?: number;
};

export type CourseSemester = {
  id: number;
  number: number;
  title: string;
  subjectCount?: number;
};

export type CourseSubject = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  syllabusCode?: string | null;
  coverKey?: string | null;
  backCoverKey?: string | null;
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
  chapterCount?: number;
};

export async function fetchCourses() {
  const res = await api.get<CourseSummary[]>('/api/courses');
  return res.data || [];
}

export async function fetchCourse(slug: string) {
  const res = await api.get(`/api/courses/${slug}`);
  return res.data as {
    id: number;
    name: string;
    slug: string;
    university?: string | null;
    description?: string | null;
    semesters: CourseSemester[];
  };
}

export async function fetchSemester(slug: string, n: number) {
  const res = await api.get(`/api/courses/${slug}/semesters/${n}`);
  return res.data as {
    course: { id: number; name: string; slug: string; university?: string | null };
    semester: { id: number; number: number; title: string };
    subjects: CourseSubject[];
  };
}

export async function fetchSubject(id: number) {
  const res = await api.get(`/api/courses/subjects/${id}`, { headers: courseAuthHeaders() });
  return res.data;
}

export async function fetchChapter(id: number) {
  const res = await api.get(`/api/courses/chapters/${id}`, { headers: courseAuthHeaders() });
  return res.data;
}

export async function saveCourseProgress(body: {
  subjectId: number;
  chapterId?: number;
  currentPage?: number;
  percent?: number;
}) {
  await api.post('/api/courses/progress', body, { headers: courseAuthHeaders() });
}

export type CourseQuizQuestion = {
  prompt: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
};

export type CourseQuickCheckItem = {
  id: number;
  title: string;
  pageNumber?: number | null;
  questions: CourseQuizQuestion[];
};

function optionLabel(o: unknown) {
  if (typeof o === 'string' || typeof o === 'number') return String(o);
  if (o && typeof o === 'object' && 'label' in o)
    return String((o as { label?: unknown }).label ?? '');
  return String(o ?? '');
}

export function questionsFromActivityConfig(config: unknown): CourseQuizQuestion[] {
  if (!config || typeof config !== 'object') return [];
  const c = config as Record<string, unknown>;
  if (Array.isArray(c.questions) && c.questions.length) {
    return c.questions
      .map((raw) => {
        const q = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        const options = Array.isArray(q.options) ? q.options.map(optionLabel) : [];
        const correct = q.correctIndex != null ? Number(q.correctIndex) : undefined;
        return {
          prompt: String(q.prompt || ''),
          options,
          correctIndex: Number.isFinite(correct) ? correct : undefined,
          explanation: q.explanation ? String(q.explanation) : undefined,
        };
      })
      .filter((q) => q.prompt && q.options.length >= 2);
  }
  const prompt = c.prompt ? String(c.prompt) : '';
  const options = Array.isArray(c.options) ? c.options.map(optionLabel) : [];
  if (!prompt || options.length < 2) return [];
  let correct = c.correctIndex != null ? Number(c.correctIndex) : NaN;
  if (!Number.isFinite(correct) && c.correctOptionId != null && Array.isArray(c.options)) {
    const idx = c.options.findIndex(
      (o) =>
        o &&
        typeof o === 'object' &&
        String((o as { id?: unknown }).id) === String(c.correctOptionId),
    );
    correct = idx;
  }
  return [
    {
      prompt,
      options,
      correctIndex: Number.isFinite(correct) ? correct : undefined,
      explanation: c.explanation ? String(c.explanation) : undefined,
    },
  ];
}

export function quickChecksFromActivities(activities: unknown): CourseQuickCheckItem[] {
  const list = Array.isArray(activities) ? activities : [];
  const inline = list.filter(
    (a) => String((a as { placement?: string })?.placement || '') === 'INLINE',
  );
  const source = inline.length
    ? inline
    : list
        .filter((a) => String((a as { activityType?: string })?.activityType || '') === 'QUIZ')
        .slice(0, 1);
  return source
    .map((raw) => {
      const a = raw as {
        id?: number;
        title?: string;
        pageNumber?: number | null;
        config?: unknown;
        explanation?: string;
      };
      const questions = questionsFromActivityConfig(a.config)
        .slice(0, 3)
        .map((q) => ({
          ...q,
          explanation: q.explanation || a.explanation || undefined,
        }));
      return {
        id: Number(a.id) || 0,
        title: a.title || 'Quick check',
        pageNumber: a.pageNumber != null ? Number(a.pageNumber) : null,
        questions,
      };
    })
    .filter((item) => item.questions.length > 0);
}

export type CourseBookmarkType = 'important' | 'doubt' | 'revise';

export type CourseFlashcard = {
  id: number;
  chapterId: number;
  front: string;
  back: string;
  pageNumber?: number | null;
  owned?: boolean;
};

export type CourseContinue = {
  subjectId: number;
  chapterId: number;
  currentPage?: number | null;
  percent?: number | null;
  chapterTitle?: string | null;
  chapterSlug?: string | null;
  subjectName?: string | null;
  subjectSlug?: string | null;
  semesterNumber?: number | null;
  semesterTitle?: string | null;
  courseName?: string | null;
  courseSlug?: string | null;
  university?: string | null;
  href: string;
};

export async function fetchCourseContinue() {
  try {
    const res = await api.get<CourseContinue | null>('/api/courses/continue', {
      headers: courseAuthHeaders(),
    });
    return res.data || null;
  } catch {
    return null;
  }
}

export async function fetchChapterStudy(chapterId: number) {
  const res = await api.get(`/api/courses/chapters/${chapterId}/study`, {
    headers: courseAuthHeaders(),
  });
  return res.data as {
    bookmarks: { id: number; pageNumber: number; markType?: CourseBookmarkType }[];
    notes: { id: number; pageNumber?: number | null; content: string; quote?: string | null }[];
    highlights: { id: number; pageNumber?: number | null; text: string; color?: string }[];
  };
}

export async function addCourseBookmark(
  chapterId: number,
  pageNumber: number,
  markType: CourseBookmarkType = 'important',
) {
  const res = await api.post(
    `/api/courses/chapters/${chapterId}/bookmarks`,
    { pageNumber, markType },
    { headers: courseAuthHeaders() },
  );
  return res.data;
}

export async function deleteCourseBookmark(id: number) {
  await api.delete(`/api/courses/bookmarks/${id}`, { headers: courseAuthHeaders() });
}

export async function addCourseNote(
  chapterId: number,
  content: string,
  pageNumber?: number,
  quote?: string,
) {
  const res = await api.post(
    `/api/courses/chapters/${chapterId}/notes`,
    { content, pageNumber, quote },
    { headers: courseAuthHeaders() },
  );
  return res.data;
}

export async function updateCourseNote(id: number, content: string) {
  await api.put(`/api/courses/notes/${id}`, { content }, { headers: courseAuthHeaders() });
}

export async function deleteCourseNote(id: number) {
  await api.delete(`/api/courses/notes/${id}`, { headers: courseAuthHeaders() });
}

export async function addCourseHighlight(
  chapterId: number,
  text: string,
  pageNumber?: number,
  color = '#FFE66D',
) {
  const res = await api.post(
    `/api/courses/chapters/${chapterId}/highlights`,
    { text, pageNumber, color },
    { headers: courseAuthHeaders() },
  );
  return res.data;
}

export async function deleteCourseHighlight(id: number) {
  await api.delete(`/api/courses/highlights/${id}`, { headers: courseAuthHeaders() });
}

export async function fetchChapterFlashcards(chapterId: number) {
  const res = await api.get(`/api/courses/chapters/${chapterId}/flashcards`, {
    headers: courseAuthHeaders(),
  });
  return (res.data || []) as CourseFlashcard[];
}

export async function addCourseFlashcard(
  chapterId: number,
  front: string,
  back: string,
  pageNumber?: number,
) {
  const res = await api.post(
    `/api/courses/chapters/${chapterId}/flashcards`,
    { front, back, pageNumber },
    { headers: courseAuthHeaders() },
  );
  return res.data as CourseFlashcard;
}

export async function deleteCourseFlashcard(id: number) {
  await api.delete(`/api/courses/flashcards/${id}`, { headers: courseAuthHeaders() });
}

export async function startLearnActivity(activityId: number) {
  return api.post(
    `/api/learn/activities/${activityId}/start`,
    {},
    { headers: courseAuthHeaders() },
  );
}

export async function completeLearnActivity(
  activityId: number,
  response: Record<string, unknown>,
  timeSpentSec?: number,
) {
  return api.post(
    `/api/learn/activities/${activityId}/complete`,
    { response, timeSpentSec },
    { headers: courseAuthHeaders() },
  );
}

export function courseLoginHref(path?: string) {
  const redirect =
    path ||
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/courses');
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}
