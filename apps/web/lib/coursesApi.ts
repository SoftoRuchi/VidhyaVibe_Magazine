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
  price?: number | null;
  canRead?: boolean;
  purchasable?: boolean;
  accessModel?: string | null;
};

export function formatBookPrice(price?: number | null) {
  if (price == null || !Number.isFinite(Number(price))) return '';
  const n = Number(price);
  return `₹${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export type BookOffer = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  syllabusCode?: string | null;
  frontCoverUrl?: string | null;
  price: number | null;
  currency: string;
  canRead: boolean;
  alreadyOwned: boolean;
  purchasable: boolean;
  accessModel?: string | null;
  href: string;
  buyHref: string;
  course: { name: string; slug: string };
  semester: { number: number; title: string };
};

export async function fetchBookOffer(subjectId: number) {
  const res = await api.get<BookOffer>(`/api/courses/subjects/${subjectId}/offer`, {
    headers: courseAuthHeaders(),
  });
  return res.data;
}

export type BookCheckout = {
  needsPayment: true;
  orderId: number;
  amount: number;
  currency: string;
  provider: 'razorpay' | 'upi';
  status: string;
  rpOrderId?: string | null;
  razorpayKeyId?: string | null;
  upi?: string | null;
  href: string;
};

export async function purchaseBook(subjectId: number) {
  const res = await api.post(
    `/api/courses/subjects/${subjectId}/purchase`,
    {},
    {
      headers: courseAuthHeaders(),
    },
  );
  return res.data as BookCheckout;
}

export async function confirmBookPurchase(
  subjectId: number,
  body: {
    orderId: number;
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  },
) {
  const res = await api.post(`/api/courses/subjects/${subjectId}/purchase/confirm`, body, {
    headers: courseAuthHeaders(),
  });
  return res.data as { ok: boolean; href: string; purchaseCode?: string };
}

export async function uploadBookPurchaseProof(subjectId: number, orderId: number, file: File) {
  const fd = new FormData();
  fd.append('proof', file);
  const res = await api.post(`/api/courses/subjects/${subjectId}/purchase/${orderId}/proof`, fd, {
    headers: courseAuthHeaders(),
  });
  return res.data as { proofId: number; message?: string };
}

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
    coverKey?: string | null;
    semesters: CourseSemester[];
  };
}

export type CourseCatalogBook = {
  id: number;
  name: string;
  slug: string;
  syllabusCode?: string | null;
  coverKey?: string | null;
  frontCoverUrl?: string | null;
  price: number | null;
  chapterCount: number;
  semesterNumber: number;
  semesterTitle: string;
  href: string;
  buyHref: string;
  canRead?: boolean;
  purchasable?: boolean;
  accessModel?: string | null;
};

export type CourseCatalog = {
  id: number;
  name: string;
  slug: string;
  university?: string | null;
  description?: string | null;
  coverKey?: string | null;
  books: CourseCatalogBook[];
};

export async function fetchCourseCatalog(slug: string) {
  const res = await api.get<CourseCatalog>(`/api/courses/${encodeURIComponent(slug)}/catalog`, {
    headers: courseAuthHeaders(),
  });
  return res.data;
}

export async function fetchSemester(slug: string, n: number) {
  const res = await api.get(`/api/courses/${slug}/semesters/${n}`, {
    headers: courseAuthHeaders(),
  });
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

export type EntitledBook = {
  id: number;
  name: string;
  slug: string;
  coverKey?: string | null;
  courseName: string;
  courseSlug: string;
  semesterNumber: number;
  accessModel: 'BOOK_BANK' | 'LIBRARY' | 'INDIVIDUAL' | 'ADMIN' | 'OPEN';
  instituteName?: string | null;
  purchaseCode?: string | null;
  href: string;
  lastChapterTitle?: string | null;
  lastPageNumber?: number | null;
  lastReadAt?: string | null;
};

export function bookAccessLabel(model?: string | null) {
  if (model === 'BOOK_BANK') return 'Book bank';
  if (model === 'LIBRARY') return 'Library';
  if (model === 'INDIVIDUAL') return 'Purchased';
  if (model === 'ADMIN') return 'Admin';
  return '';
}

export async function fetchMyBooks() {
  const res = await api.get<{ books?: EntitledBook[] }>('/api/courses/my-books', {
    headers: courseAuthHeaders(),
  });
  return (res.data?.books || []) as EntitledBook[];
}

export type InstituteAdminCampus = {
  id: number;
  name: string;
  code: string;
  city?: string | null;
  status: string;
};

export type InstitutePortalLot = {
  id: number;
  subjectName: string;
  courseName: string;
  accessModel: string;
  seatCount: number;
  assignedSeats: number;
  liveReaders: number;
  remaining?: number;
  full?: boolean;
  purchaseCode: string;
  status: string;
};

export type InstitutePortalMember = {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: string;
  className?: string | null;
  rollNumber?: string | null;
};

export type InstitutePortalLive = {
  id: number;
  name: string;
  email: string;
  subjectName: string;
  courseName?: string;
  chapterTitle?: string | null;
  pageNumber?: number | null;
  deviceName?: string | null;
  ipAddress?: string | null;
  secondsActive?: number;
  lastHeartbeatAt?: string;
  openCount?: number;
  accessModel?: string;
};

export type InstitutePortalData = InstituteAdminCampus & {
  stats: {
    students: number;
    licenses: number;
    liveCount: number;
    todayOpens: number;
    todayReaders: number;
  };
  live: InstitutePortalLive[];
  members: InstitutePortalMember[];
  lots: InstitutePortalLot[];
};

export async function fetchInstituteCampuses() {
  try {
    const res = await api.get<{ institutes?: InstituteAdminCampus[] }>('/api/institute', {
      headers: courseAuthHeaders(),
    });
    return res.data?.institutes || [];
  } catch {
    return [] as InstituteAdminCampus[];
  }
}

export async function fetchInstitutePortal(instituteId: number) {
  const res = await api.get<InstitutePortalData>(`/api/institute/${instituteId}`, {
    headers: courseAuthHeaders(),
  });
  return res.data;
}

export async function fetchInstituteActivity(instituteId: number) {
  const res = await api.get<{ reading?: any[]; logins?: any[] }>(
    `/api/institute/${instituteId}/activity`,
    {
      headers: courseAuthHeaders(),
    },
  );
  return res.data;
}

export async function addInstituteStudent(
  instituteId: number,
  body: {
    email: string;
    name?: string;
    className?: string;
    rollNumber?: string;
    password?: string;
  },
) {
  const res = await api.post(`/api/institute/${instituteId}/members`, body, {
    headers: courseAuthHeaders(),
  });
  return res.data as { email: string; created?: boolean; emailed?: boolean };
}

export async function importInstituteLotStudents(
  instituteId: number,
  lotId: number,
  students: Array<{
    email: string;
    name?: string;
    className?: string;
    rollNumber?: string;
    password?: string;
  }>,
) {
  const res = await api.post(
    `/api/institute/${instituteId}/lots/${lotId}/students`,
    { students },
    { headers: courseAuthHeaders() },
  );
  return res.data as {
    assigned: number;
    emailed?: number;
    students: Array<{ email: string; created?: boolean }>;
  };
}

export async function endInstituteReadingSession(instituteId: number, sessionId: number) {
  const res = await api.post(
    `/api/institute/${instituteId}/live/${sessionId}/end`,
    {},
    { headers: courseAuthHeaders() },
  );
  return res.data as { ok: boolean; alreadyEnded?: boolean };
}

function saveBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportInstituteActivity(instituteId: number, kind: 'reading' | 'logins') {
  const res = await api.get(`/api/institute/${instituteId}/activity`, {
    params: { format: 'csv', kind },
    headers: courseAuthHeaders(),
    responseType: 'blob',
  });
  const header = String(res.headers?.['content-disposition'] || '');
  const match = header.match(/filename="?([^"]+)"?/i);
  saveBlob(res.data, match?.[1] || `college-${kind}.csv`);
}

export type CourseNoteItem = {
  id: number;
  pageNumber?: number | null;
  content: string;
  quote?: string | null;
};

export type CourseNoteRecord = CourseNoteItem & {
  chapterId: number;
  createdAt?: string;
  updatedAt?: string;
  chapterTitle: string;
  chapterSlug: string;
  subjectName: string;
  subjectSlug: string;
  courseName: string;
  courseSlug: string;
  semesterNumber: number;
  href: string;
  notesHref: string;
};

export async function fetchChapterStudy(chapterId: number) {
  const res = await api.get(`/api/courses/chapters/${chapterId}/study`, {
    headers: courseAuthHeaders(),
  });
  return res.data as {
    bookmarks: { id: number; pageNumber: number; markType?: CourseBookmarkType }[];
    notes: CourseNoteItem[];
    highlights: { id: number; pageNumber?: number | null; text: string; color?: string }[];
  };
}

export async function fetchAllCourseNotes() {
  const res = await api.get('/api/courses/notes', {
    headers: courseAuthHeaders(),
  });
  return ((res.data as { notes?: CourseNoteRecord[] })?.notes || []) as CourseNoteRecord[];
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

export function courseDeviceKey() {
  if (typeof window === 'undefined') return 'server';
  try {
    let key = window.localStorage.getItem('vv_device_key');
    if (!key) {
      key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now()}`;
      window.localStorage.setItem('vv_device_key', key);
    }
    return key;
  } catch {
    return 'unknown';
  }
}

export function courseAccessMessage(err: any) {
  return (
    err?.response?.data?.message ||
    (err?.response?.data?.error === 'no_license'
      ? 'You do not have a license for this book.'
      : err?.response?.data?.error === 'library_full'
        ? 'All library copies of this book are in use.'
        : err?.response?.data?.error === 'session_replaced'
          ? 'This book was opened on another device.'
          : '')
  );
}

export async function acquireBookSession(
  subjectId: number,
  opts?: { chapterId?: number; pageNumber?: number },
) {
  const res = await api.post(
    `/api/courses/subjects/${subjectId}/session`,
    {
      deviceKey: courseDeviceKey(),
      deviceName: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : null,
      chapterId: opts?.chapterId,
      pageNumber: opts?.pageNumber,
    },
    { headers: courseAuthHeaders() },
  );
  return res.data as { sessionId: number; accessModel: string; resumed?: boolean };
}

export async function heartbeatBookSession(
  subjectId: number,
  sessionId: number,
  opts?: { chapterId?: number; pageNumber?: number },
) {
  await api.post(
    `/api/courses/subjects/${subjectId}/session/heartbeat`,
    { sessionId, chapterId: opts?.chapterId, pageNumber: opts?.pageNumber },
    { headers: courseAuthHeaders() },
  );
}

export async function releaseBookSession(subjectId: number, sessionId: number) {
  await api.post(
    `/api/courses/subjects/${subjectId}/session/release`,
    { sessionId },
    { headers: courseAuthHeaders() },
  );
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
