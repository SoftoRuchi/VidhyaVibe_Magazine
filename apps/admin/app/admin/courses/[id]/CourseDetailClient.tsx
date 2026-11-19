'use client';

import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReadOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Upload,
  message,
} from 'antd';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import CopyBookModal from '../../../../components/CopyBookModal';
import api from '../../../../lib/api';
import { compareChapters, extractChapterNumber } from '../../../../lib/courseChapters';
import { apiUpload } from '../../../../lib/upload';

type Chapter = {
  id: number;
  title: string;
  slug: string;
  sortOrder: number;
  startPage?: number | null;
  endPage?: number | null;
  content?: string | null;
  activityCount: number;
};

type Subject = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  syllabusCode?: string | null;
  status: string;
  hasBookPdf?: boolean;
  coverKey?: string | null;
  backCoverKey?: string | null;
  frontCoverUrl?: string | null;
  backCoverUrl?: string | null;
  price?: number | null;
  physicalPrice?: number | null;
  bothPrice?: number | null;
  isbn?: string | null;
  bookBankPrice?: number | null;
  libraryPrice?: number | null;
  discountPct?: number | null;
  chapters: Chapter[];
};

type Semester = {
  id: number;
  number: number;
  title: string;
  subjects: Subject[];
};

type Course = {
  id: number;
  name: string;
  slug: string;
  university?: string | null;
  description?: string | null;
  status: string;
  sortOrder: number;
  semesters: Semester[];
};

type TabKey = 'course' | 'semester' | 'subject' | 'chapter';
type NextSel = {
  tab?: TabKey;
  semesterId?: number | null;
  subjectId?: number | null;
  chapterId?: number | null;
};

function fileFromUpload(value: unknown): File | undefined {
  if (value instanceof File) return value;
  const list = Array.isArray(value) ? value : [];
  for (const item of list as { originFileObj?: File }[]) {
    if (item?.originFileObj instanceof File) return item.originFileObj;
  }
  return undefined;
}

function uploadListEvent(e: unknown) {
  if (Array.isArray(e)) return e;
  if (e && typeof e === 'object' && 'fileList' in e) {
    return (e as { fileList?: unknown }).fileList;
  }
  return [];
}

function CoverPicker({
  label,
  currentUrl,
  field,
  subjectId,
  onUpdated,
}: {
  label: string;
  currentUrl?: string | null;
  field: 'frontCover' | 'backCover';
  subjectId: number;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [local, setLocal] = React.useState<string | null>(null);
  const src = local || currentUrl || '';

  React.useEffect(() => {
    setLocal(null);
  }, [currentUrl]);

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setLocal(URL.createObjectURL(file));
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append(field, file);
        await apiUpload('POST', `/admin/courses/subjects/${subjectId}/covers`, fd);
        message.success(`${label} updated`);
        onUpdated();
      } catch (e: any) {
        setLocal(null);
        message.error(e?.response?.data?.message || e?.message || 'Cover upload failed');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  return (
    <div className="vv-cover-field">
      <p className="vv-cover-label">{label}</p>
      {src ? (
        <img src={src} alt={label} className="vv-cover-thumb" />
      ) : (
        <p className="vv-hint">No cover yet.</p>
      )}
      <Button onClick={pick} loading={busy}>
        {currentUrl ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      </Button>
    </div>
  );
}

export default function AdminCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(params?.id);
  const [course, setCourse] = React.useState<Course | null>(null);
  const [tab, setTab] = React.useState<TabKey>('course');
  const [semesterId, setSemesterId] = React.useState<number | null>(null);
  const [subjectId, setSubjectId] = React.useState<number | null>(null);
  const [chapterId, setChapterId] = React.useState<number | null>(null);
  const [form] = Form.useForm();
  const [semesterOpen, setSemesterOpen] = React.useState(false);
  const [subjectOpen, setSubjectOpen] = React.useState<number | null>(null);
  const [chapterOpen, setChapterOpen] = React.useState<number | null>(null);
  const [chapterForm] = Form.useForm();
  const [subjectForm] = Form.useForm();
  const [subjectAddForm] = Form.useForm();
  const [semForm] = Form.useForm();
  const [semAddForm] = Form.useForm();
  const [copyToOpen, setCopyToOpen] = React.useState(false);
  const [copyFromOpen, setCopyFromOpen] = React.useState(false);

  const persistView = React.useCallback(
    (newTab: TabKey, semId: number | null, subId: number | null, chId: number | null) => {
      if (typeof window === 'undefined') return;
      try {
        sessionStorage.setItem(
          `admin_course_${id}_view`,
          JSON.stringify({ tab: newTab, semesterId: semId, subjectId: subId, chapterId: chId }),
        );
        const url = new URL(window.location.href);
        url.searchParams.set('tab', newTab);
        if (semId) url.searchParams.set('semesterId', String(semId));
        else url.searchParams.delete('semesterId');
        if (subId) url.searchParams.set('subjectId', String(subId));
        else url.searchParams.delete('subjectId');
        if (chId) url.searchParams.set('chapterId', String(chId));
        else url.searchParams.delete('chapterId');
        window.history.replaceState(null, '', url.pathname + url.search);
      } catch {}
    },
    [id],
  );

  const autoSortChapters = (sid: number) => {
    api
      .put(`/admin/courses/subjects/${sid}/chapters/reorder`)
      .then(() => {
        message.success('Chapters arranged starting from Chapter 1');
        load({ tab: 'chapter', subjectId: sid, chapterId });
      })
      .catch(() => message.error('Failed to sort chapters'));
  };

  const moveChapter = (sid: number, chId: number, direction: -1 | 1) => {
    if (!selectedSubject) return;
    const chapters = [...selectedSubject.chapters];
    const idx = chapters.findIndex((c) => c.id === chId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= chapters.length) return;
    const [moved] = chapters.splice(idx, 1);
    chapters.splice(targetIdx, 0, moved);
    api
      .put(`/admin/courses/subjects/${sid}/chapters/reorder`, {
        chapterIds: chapters.map((c) => c.id),
      })
      .then(() => {
        message.success('Chapter moved');
        load({ tab: 'chapter', subjectId: sid, chapterId: chId });
      })
      .catch(() => message.error('Failed to move chapter'));
  };

  const applySel = (data: Course, next?: NextSel) => {
    const semesters = data.semesters || [];
    semesters.forEach((sem) => {
      sem.subjects?.forEach((sub) => {
        if (sub.chapters) {
          sub.chapters = [...sub.chapters].sort(compareChapters);
        }
      });
    });

    let targetTab = next?.tab;
    let targetSemId = next?.semesterId;
    let targetSubId = next?.subjectId;
    let targetChId = next?.chapterId;

    if (!targetTab) {
      const qTab = searchParams?.get('tab') as TabKey | null;
      const qSem = searchParams?.get('semesterId') ? Number(searchParams.get('semesterId')) : null;
      const qSub = searchParams?.get('subjectId') ? Number(searchParams.get('subjectId')) : null;
      const qCh = searchParams?.get('chapterId') ? Number(searchParams.get('chapterId')) : null;
      if (qTab) {
        targetTab = qTab;
        targetSemId = qSem;
        targetSubId = qSub;
        targetChId = qCh;
      } else if (typeof window !== 'undefined') {
        try {
          const savedStr = sessionStorage.getItem(`admin_course_${id}_view`);
          if (savedStr) {
            const saved = JSON.parse(savedStr);
            targetTab = saved.tab;
            targetSemId = saved.semesterId;
            targetSubId = saved.subjectId;
            targetChId = saved.chapterId;
          }
        } catch {}
      }
    }

    const nextSem = targetSemId ?? semesterId ?? semesters[0]?.id ?? null;
    const semester = semesters.find((s) => s.id === nextSem) || semesters[0];
    const nextSub = targetSubId ?? subjectId ?? semester?.subjects[0]?.id ?? null;
    const subject =
      semester?.subjects.find((s) => s.id === nextSub) ||
      semesters.flatMap((s) => s.subjects).find((s) => s.id === nextSub) ||
      semester?.subjects[0];
    const nextCh = targetChId ?? chapterId ?? subject?.chapters[0]?.id ?? null;

    const chosenTab = targetTab || tab || 'course';
    setTab(chosenTab);
    setSemesterId(semester?.id ?? null);
    setSubjectId(subject?.id ?? null);
    const chosenCh = subject?.chapters.some((c) => c.id === nextCh)
      ? nextCh
      : (subject?.chapters[0]?.id ?? null);
    setChapterId(chosenCh);
    persistView(chosenTab, semester?.id ?? null, subject?.id ?? null, chosenCh);
  };

  const load = (next?: NextSel) => {
    if (!id) return;
    api
      .get(`/admin/courses/${id}`)
      .then((r) => {
        setCourse(r.data);
        form.setFieldsValue({
          name: r.data.name,
          slug: r.data.slug,
          university: r.data.university,
          description: r.data.description,
          sortOrder: r.data.sortOrder,
          published: r.data.status === 'PUBLISHED',
        });
        applySel(r.data, next);
      })
      .catch(() => message.error('Failed to load course'));
  };

  React.useEffect(() => {
    load();
  }, [id]);

  React.useEffect(() => {
    if (subjectOpen != null) subjectAddForm.resetFields();
  }, [subjectOpen]);

  const selectedSemester =
    course?.semesters.find((s) => s.id === semesterId) || course?.semesters[0];
  const selectedSubject =
    selectedSemester?.subjects.find((s) => s.id === subjectId) ||
    course?.semesters.flatMap((s) => s.subjects).find((s) => s.id === subjectId) ||
    selectedSemester?.subjects[0];
  const selectedChapter =
    selectedSubject?.chapters.find((c) => c.id === chapterId) || selectedSubject?.chapters[0];
  const subjectSemester = course?.semesters.find((s) =>
    s.subjects.some((sub) => sub.id === selectedSubject?.id),
  );

  React.useEffect(() => {
    if (!selectedSubject) return;
    subjectForm.setFieldsValue({
      name: selectedSubject.name,
      slug: selectedSubject.slug,
      syllabusCode: selectedSubject.syllabusCode,
      description: selectedSubject.description,
      price: selectedSubject.price ?? null,
      physicalPrice: selectedSubject.physicalPrice ?? null,
      bothPrice: selectedSubject.bothPrice ?? null,
      isbn: selectedSubject.isbn ?? '',
      bookBankPrice: selectedSubject.bookBankPrice ?? null,
      libraryPrice: selectedSubject.libraryPrice ?? null,
      discountPct: selectedSubject.discountPct ?? null,
      published: selectedSubject.status === 'PUBLISHED',
    });
  }, [selectedSubject?.id]);

  React.useEffect(() => {
    if (!selectedSemester) return;
    semForm.setFieldsValue({ number: selectedSemester.number, title: selectedSemester.title });
  }, [selectedSemester?.id]);

  const openAddSemester = () => {
    semAddForm.setFieldsValue({
      number: (course?.semesters.length || 0) + 1,
      title: `Semester ${(course?.semesters.length || 0) + 1}`,
    });
    setSemesterOpen(true);
  };

  const changeTab = (next: string) => {
    const key = next as TabKey;
    setTab(key);
    let nextSem = semesterId;
    let nextSub = subjectId;
    let nextCh = chapterId;
    if (key === 'semester' && !nextSem && course?.semesters[0]) {
      nextSem = course.semesters[0].id;
      setSemesterId(nextSem);
    }
    if (key === 'subject') {
      const sem = course?.semesters.find((s) => s.id === nextSem) || course?.semesters[0];
      if (sem && !sem.subjects.some((s) => s.id === nextSub)) {
        nextSub = sem.subjects[0]?.id ?? null;
        setSubjectId(nextSub);
      }
    }
    if (key === 'chapter') {
      const sem = course?.semesters.find((s) => s.id === nextSem) || course?.semesters[0];
      const sub =
        sem?.subjects.find((s) => s.id === nextSub) ||
        course?.semesters.flatMap((s) => s.subjects).find((s) => s.id === nextSub) ||
        sem?.subjects[0];
      nextSub = sub?.id ?? null;
      setSubjectId(nextSub);
      if (sub && !sub.chapters.some((c) => c.id === nextCh)) {
        nextCh = sub.chapters[0]?.id ?? null;
        setChapterId(nextCh);
      }
    }
    persistView(key, nextSem, nextSub, nextCh);
  };

  const saveCourse = () => {
    form.validateFields().then((values) => {
      api
        .put(`/admin/courses/${id}`, {
          ...values,
          status: values.published ? 'PUBLISHED' : 'DRAFT',
        })
        .then(() => {
          message.success('Course details saved');
          load();
        })
        .catch((e) => message.error(e.response?.data?.error || 'Save failed'));
    });
  };

  const addSemester = () => {
    semAddForm.validateFields().then((values) => {
      api
        .post(`/admin/courses/${id}/semesters`, values)
        .then((r) => {
          message.success('Semester added');
          setSemesterOpen(false);
          semAddForm.resetFields();
          load({ tab: 'semester', semesterId: Number(r.data?.id) });
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
    });
  };

  const saveSemester = (sid: number) => {
    semForm.validateFields().then((values) => {
      api
        .put(`/admin/courses/semesters/${sid}`, values)
        .then(() => {
          message.success('Semester saved');
          load();
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
    });
  };

  const addSubject = (sid: number) => {
    subjectAddForm.validateFields().then((values) => {
      const fd = new FormData();
      fd.append('name', values.name);
      if (values.slug) fd.append('slug', values.slug);
      if (values.description) fd.append('description', values.description);
      if (values.syllabusCode) fd.append('syllabusCode', values.syllabusCode);
      if (values.isbn) fd.append('isbn', String(values.isbn).trim());
      if (values.price != null && values.price !== '') fd.append('price', String(values.price));
      if (values.physicalPrice != null && values.physicalPrice !== '')
        fd.append('physicalPrice', String(values.physicalPrice));
      if (values.bothPrice != null && values.bothPrice !== '')
        fd.append('bothPrice', String(values.bothPrice));
      if (values.bookBankPrice != null && values.bookBankPrice !== '')
        fd.append('bookBankPrice', String(values.bookBankPrice));
      if (values.libraryPrice != null && values.libraryPrice !== '')
        fd.append('libraryPrice', String(values.libraryPrice));
      if (values.discountPct != null && values.discountPct !== '')
        fd.append('discountPct', String(values.discountPct));
      fd.append('status', values.published ? 'PUBLISHED' : 'DRAFT');
      const front = fileFromUpload(values.frontCover);
      const back = fileFromUpload(values.backCover);
      if (front) fd.append('frontCover', front);
      if (back) fd.append('backCover', back);
      const file = fileFromUpload(values.bookPdf);
      if (file) fd.append('bookPdf', file);
      apiUpload('POST', `/admin/courses/semesters/${sid}/subjects`, fd)
        .then((r: any) => {
          message.success('Subject added');
          setSubjectOpen(null);
          subjectAddForm.resetFields();
          load({ tab: 'subject', semesterId: sid, subjectId: Number(r?.id) });
        })
        .catch((e) =>
          message.error(e.response?.data?.message || e.response?.data?.error || e.message || 'Failed'),
        );
    });
  };

  const saveSubject = (sid: number) => {
    subjectForm.validateFields().then((values) => {
      const fd = new FormData();
      fd.append('name', values.name);
      if (values.slug) fd.append('slug', values.slug);
      if (values.description) fd.append('description', values.description);
      if (values.syllabusCode) fd.append('syllabusCode', values.syllabusCode);
      fd.append('isbn', values.isbn != null ? String(values.isbn).trim() : '');
      fd.append('price', values.price != null && values.price !== '' ? String(values.price) : '');
      fd.append(
        'physicalPrice',
        values.physicalPrice != null && values.physicalPrice !== '' ? String(values.physicalPrice) : '',
      );
      fd.append(
        'bothPrice',
        values.bothPrice != null && values.bothPrice !== '' ? String(values.bothPrice) : '',
      );
      fd.append(
        'bookBankPrice',
        values.bookBankPrice != null && values.bookBankPrice !== '' ? String(values.bookBankPrice) : '',
      );
      fd.append(
        'libraryPrice',
        values.libraryPrice != null && values.libraryPrice !== '' ? String(values.libraryPrice) : '',
      );
      fd.append(
        'discountPct',
        values.discountPct != null && values.discountPct !== '' ? String(values.discountPct) : '',
      );
      fd.append('status', values.published ? 'PUBLISHED' : 'DRAFT');
      const front = fileFromUpload(values.frontCover);
      const back = fileFromUpload(values.backCover);
      if (front) fd.append('frontCover', front);
      if (back) fd.append('backCover', back);
      const file = fileFromUpload(values.bookPdf);
      if (file) fd.append('bookPdf', file);
      apiUpload('PUT', `/admin/courses/subjects/${sid}`, fd)
        .then(() => {
          message.success('Subject saved');
          load();
        })
        .catch((e) =>
          message.error(e.response?.data?.message || e.response?.data?.error || e.message || 'Failed'),
        );
    });
  };

  const addChapter = (sid: number) => {
    chapterForm.validateFields().then((values) => {
      api
        .post(`/admin/courses/subjects/${sid}/chapters`, values)
        .then((r) => {
          const newChapterId = Number(r.data?.id);
          message.success('Chapter added');
          setChapterOpen(null);
          chapterForm.resetFields();
          persistView('chapter', selectedSemester?.id ?? null, sid, newChapterId || null);
          if (newChapterId) {
            router.push(`/admin/courses/${id}/chapters/${newChapterId}`);
            return;
          }
          load({ tab: 'chapter', subjectId: sid });
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
    });
  };

  const openCopyFrom = () => setCopyFromOpen(true);
  const openCopyTo = () => setCopyToOpen(true);

  if (!course) {
    return (
      <main className="vv-course-page">
        <p className="vv-hint">Loading course…</p>
      </main>
    );
  }

  const addExtra =
    tab === 'semester' ? (
      <Space wrap>
        <Button icon={<CopyOutlined />} onClick={openCopyFrom}>
          Copy a book here
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddSemester}>
          Add semester
        </Button>
      </Space>
    ) : tab === 'subject' ? (
      <Space wrap>
        <Button icon={<CopyOutlined />} onClick={openCopyFrom}>
          Copy from another course
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!selectedSemester}
          onClick={() => selectedSemester && setSubjectOpen(selectedSemester.id)}
        >
          Add subject
        </Button>
      </Space>
    ) : tab === 'chapter' ? (
      <Space wrap>
        {selectedSubject && selectedSubject.chapters.length > 1 ? (
          <Button
            icon={<SortAscendingOutlined />}
            onClick={() => selectedSubject && autoSortChapters(selectedSubject.id)}
          >
            Sort by chapter number
          </Button>
        ) : null}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!selectedSubject}
          onClick={() => selectedSubject && setChapterOpen(selectedSubject.id)}
        >
          Add chapter
        </Button>
      </Space>
    ) : null;

  return (
    <main className="vv-course-page">
      <div className="vv-crumb">
        <Link href="/admin/courses">Courses</Link>
        <span>/</span>
        <span>{course.name}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div>
          <h1>{course.name}</h1>
          <p className="vv-course-lead">
            Use the tabs to add a semester, then a subject, then a chapter.
          </p>
        </div>
        <Tag color={course.status === 'PUBLISHED' ? 'green' : 'gold'}>
          {course.status === 'PUBLISHED' ? 'Live for students' : 'Draft — students cannot see this'}
        </Tag>
      </div>

      <div className="vv-course-editor">
        <Tabs
          className="vv-course-tabs"
          activeKey={tab}
          onChange={changeTab}
          tabBarExtraContent={addExtra}
          items={[
            {
              key: 'course',
              label: '1. Course',
              children: (
                <>
                  <p className="vv-hint">Programme students pick first, such as BCA.</p>
                  <Form form={form} layout="vertical">
                    <Form.Item name="name" label="Programme name" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="university" label="University">
                      <Input />
                    </Form.Item>
                    <Form.Item name="description" label="Short description">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item name="slug" label="Web address">
                      <Input />
                    </Form.Item>
                    <Form.Item name="sortOrder" label="List order">
                      <InputNumber />
                    </Form.Item>
                    <Form.Item
                      name="published"
                      label="Show this course to students"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                    <Button type="primary" onClick={saveCourse}>
                      Save course
                    </Button>
                  </Form>
                </>
              ),
            },
            {
              key: 'semester',
              label: '2. Semester',
              children:
                course.semesters.length === 0 ? (
                  <div className="vv-empty-box">
                    No semesters yet. Add one, or copy a book from another course and type the
                    semester here.
                    <div style={{ marginTop: 10 }}>
                      <Space wrap>
                        <Button icon={<CopyOutlined />} onClick={openCopyFrom}>
                          Copy a book here
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAddSemester}>
                          Add semester
                        </Button>
                      </Space>
                    </div>
                  </div>
                ) : (
                  <>
                    <Tabs
                      type="card"
                      activeKey={String(selectedSemester?.id || '')}
                      onChange={(key) => setSemesterId(Number(key))}
                      items={course.semesters.map((sem) => ({
                        key: String(sem.id),
                        label: sem.title || `Semester ${sem.number}`,
                      }))}
                    />
                    {selectedSemester ? (
                      <>
                        <p className="vv-hint">
                          A semester holds subjects, for example Mathematics in Semester 1.
                        </p>
                        <Form form={semForm} layout="vertical">
                          <Form.Item
                            name="number"
                            label="Semester number"
                            rules={[{ required: true }]}
                          >
                            <InputNumber min={1} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item name="title" label="Title students see">
                            <Input placeholder="Semester 1" />
                          </Form.Item>
                          <Space wrap>
                            <Button
                              type="primary"
                              onClick={() => saveSemester(selectedSemester.id)}
                            >
                              Save semester
                            </Button>
                            <Popconfirm
                              title="Delete this semester and everything inside it?"
                              onConfirm={() =>
                                api
                                  .delete(`/admin/courses/semesters/${selectedSemester.id}`)
                                  .then(() => {
                                    setSemesterId(null);
                                    load({ tab: 'semester' });
                                  })
                              }
                            >
                              <Button danger>Delete semester</Button>
                            </Popconfirm>
                          </Space>
                        </Form>
                      </>
                    ) : null}
                  </>
                ),
            },
            {
              key: 'subject',
              label: '3. Subject',
              children: !selectedSemester ? (
                <div className="vv-empty-box">
                  Add a semester first, then add subjects inside it.
                  <div style={{ marginTop: 10 }}>
                    <Button onClick={() => changeTab('semester')}>Go to Semester</Button>
                  </div>
                </div>
              ) : (
                <>
                  {course.semesters.length > 1 ? (
                    <div style={{ marginBottom: 12 }}>
                      <span className="vv-hint" style={{ marginRight: 8 }}>
                        Semester
                      </span>
                      <Select
                        value={selectedSemester.id}
                        style={{ minWidth: 220 }}
                        onChange={(value) => {
                          const sem = course.semesters.find((s) => s.id === value);
                          setSemesterId(value);
                          setSubjectId(sem?.subjects[0]?.id ?? null);
                        }}
                        options={course.semesters.map((sem) => ({
                          value: sem.id,
                          label: sem.title || `Semester ${sem.number}`,
                        }))}
                      />
                    </div>
                  ) : (
                    <p className="vv-hint">
                      Subjects in {selectedSemester.title || `Semester ${selectedSemester.number}`}.
                    </p>
                  )}
                  {selectedSemester.subjects.length === 0 ? (
                    <div className="vv-empty-box">
                      No subjects in this semester.
                      <div style={{ marginTop: 10 }}>
                        <Space wrap>
                          <Button icon={<CopyOutlined />} onClick={openCopyFrom}>
                            Copy from another course
                          </Button>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setSubjectOpen(selectedSemester.id)}
                          >
                            Add subject
                          </Button>
                        </Space>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Tabs
                        type="card"
                        activeKey={String(selectedSubject?.id || '')}
                        onChange={(key) => setSubjectId(Number(key))}
                        items={selectedSemester.subjects.map((sub) => ({
                          key: String(sub.id),
                          label: sub.name,
                        }))}
                      />
                      {selectedSubject ? (
                        <Form form={subjectForm} layout="vertical">
                          <Form.Item name="name" label="Subject name" rules={[{ required: true }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item name="syllabusCode" label="Syllabus code">
                            <Input placeholder="BCA-S1-MATH" />
                          </Form.Item>
                          <Form.Item name="isbn" label="ISBN" extra="Optional.">
                            <Input placeholder="978-93-00000-00-0" />
                          </Form.Item>
                          <Form.Item name="description" label="What this subject covers">
                            <Input.TextArea rows={2} />
                          </Form.Item>
                          <p className="vv-hint" style={{ marginBottom: 8 }}>
                            Student price. Leave a price empty if that option is not sold.
                          </p>
                          <Form.Item name="price" label="E-book price (₹)">
                            <InputNumber
                              min={0}
                              step={50}
                              style={{ width: '100%' }}
                              placeholder="499"
                            />
                          </Form.Item>
                          <Form.Item name="physicalPrice" label="Physical price (₹)">
                            <InputNumber
                              min={0}
                              step={50}
                              style={{ width: '100%' }}
                              placeholder="699"
                            />
                          </Form.Item>
                          <Form.Item
                            name="bothPrice"
                            label="Both price (₹)"
                            extra="E-book and a printed copy together."
                          >
                            <InputNumber
                              min={0}
                              step={50}
                              style={{ width: '100%' }}
                              placeholder="899"
                            />
                          </Form.Item>
                          <Form.Item
                            name="bookBankPrice"
                            label="Book bank price (₹ per student)"
                            extra="College buys named copies. Total charged = this × number of students on the license."
                          >
                            <InputNumber
                              min={0}
                              step={50}
                              style={{ width: '100%' }}
                              placeholder="299"
                            />
                          </Form.Item>
                          <Form.Item
                            name="libraryPrice"
                            label="Library price (₹ per concurrent seat)"
                            extra="College buys shared class seats. Total charged = this × number of live seats."
                          >
                            <InputNumber
                              min={0}
                              step={50}
                              style={{ width: '100%' }}
                              placeholder="199"
                            />
                          </Form.Item>
                          <Form.Item
                            name="discountPct"
                            label="Discount (%)"
                            extra="Optional. Applies to the student prices and the college list prices."
                          >
                            <InputNumber
                              min={0}
                              max={100}
                              step={1}
                              style={{ width: '100%' }}
                              placeholder="0"
                            />
                          </Form.Item>
                          <p className="vv-hint">
                            Students see these as the first and last pages of the open book in every
                            chapter. Use Replace to change a cover — it saves as soon as you pick a
                            new picture.
                          </p>
                          <div className="vv-cover-row">
                            <CoverPicker
                              label="Front cover"
                              currentUrl={selectedSubject.frontCoverUrl}
                              field="frontCover"
                              subjectId={selectedSubject.id}
                              onUpdated={() => load()}
                            />
                            <CoverPicker
                              label="Back cover"
                              currentUrl={selectedSubject.backCoverUrl}
                              field="backCover"
                              subjectId={selectedSubject.id}
                              onUpdated={() => load()}
                            />
                          </div>
                          <Form.Item name="slug" label="Web address">
                            <Input />
                          </Form.Item>
                          <Form.Item
                            name="bookPdf"
                            label="Sample PDF"
                            valuePropName="fileList"
                            getValueFromEvent={uploadListEvent}
                          >
                            <Upload
                              beforeUpload={() => false}
                              maxCount={1}
                              accept="application/pdf"
                            >
                              <Button>Choose PDF</Button>
                            </Upload>
                          </Form.Item>
                          <Form.Item
                            name="published"
                            label="Show this subject to students"
                            valuePropName="checked"
                          >
                            <Switch />
                          </Form.Item>
                          <Space wrap>
                            <Link
                              href={`/admin/books/${selectedSubject.id}/read?from=/admin/courses/${id}?tab=subject&subjectId=${selectedSubject.id}`}
                              target="_blank"
                            >
                              <Button icon={<ReadOutlined />}>View in Reader</Button>
                            </Link>
                            <Button icon={<CopyOutlined />} onClick={openCopyTo}>
                              Copy to another course
                            </Button>
                            <Button type="primary" onClick={() => saveSubject(selectedSubject.id)}>
                              Save subject
                            </Button>
                            <Popconfirm
                              title="Delete this subject and its chapters?"
                              onConfirm={() =>
                                api
                                  .delete(`/admin/courses/subjects/${selectedSubject.id}`)
                                  .then(() => {
                                    setSubjectId(null);
                                    load({ tab: 'subject', semesterId: selectedSemester.id });
                                  })
                              }
                            >
                              <Button danger>Delete subject</Button>
                            </Popconfirm>
                          </Space>
                        </Form>
                      ) : null}
                    </>
                  )}
                </>
              ),
            },
            {
              key: 'chapter',
              label: '4. Chapter',
              children: !selectedSubject ? (
                <div className="vv-empty-box">
                  Add a subject first, then add chapters.
                  <div style={{ marginTop: 10 }}>
                    <Button onClick={() => changeTab('subject')}>Go to Subject</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap',
                      marginBottom: 12,
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {course.semesters.length > 1 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                          Semester:
                        </span>
                        <Select
                          value={selectedSemester?.id}
                          style={{ minWidth: 160 }}
                          onChange={(value) => {
                            const sem = course.semesters.find((s) => s.id === value);
                            setSemesterId(value);
                            const nextSub = sem?.subjects[0];
                            setSubjectId(nextSub?.id ?? null);
                            const nextCh = nextSub?.chapters[0]?.id ?? null;
                            setChapterId(nextCh);
                            persistView('chapter', value, nextSub?.id ?? null, nextCh);
                          }}
                          options={course.semesters.map((sem) => ({
                            value: sem.id,
                            label: sem.title || `Semester ${sem.number}`,
                          }))}
                        />
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                        Subject:
                      </span>
                      <Select
                        value={selectedSubject.id}
                        style={{ minWidth: 260, maxWidth: 420, flex: 1 }}
                        onChange={(value) => {
                          const sem =
                            course.semesters.find((s) => s.subjects.some((sub) => sub.id === value)) ||
                            selectedSemester;
                          if (sem && sem.id !== selectedSemester?.id) {
                            setSemesterId(sem.id);
                          }
                          setSubjectId(value);
                          const sub =
                            sem?.subjects.find((s) => s.id === value) ||
                            course.semesters.flatMap((s) => s.subjects).find((s) => s.id === value);
                          const nextCh = sub?.chapters[0]?.id ?? null;
                          setChapterId(nextCh);
                          persistView('chapter', sem?.id ?? null, value, nextCh);
                        }}
                        options={(selectedSemester
                          ? selectedSemester.subjects
                          : course.semesters.flatMap((s) => s.subjects)
                        ).map((sub) => ({
                          value: sub.id,
                          label: sub.name,
                        }))}
                      />
                    </div>
                  </div>

                  <p className="vv-hint">
                    {subjectSemester ? `${subjectSemester.title} → ` : ''}
                    {selectedSubject.name}. Open a page for the chapter text, simple words,
                    flashcards, or quizzes.
                  </p>
                  {selectedSubject.chapters.length === 0 ? (
                    <div className="vv-empty-box">
                      No chapters yet.
                      <div style={{ marginTop: 10 }}>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setChapterOpen(selectedSubject.id)}
                        >
                          Add chapter
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Tabs
                        type="card"
                        activeKey={String(selectedChapter?.id || '')}
                        onChange={(key) => {
                          const chId = Number(key);
                          setChapterId(chId);
                          persistView(
                            'chapter',
                            selectedSemester?.id ?? null,
                            selectedSubject.id,
                            chId,
                          );
                        }}
                        items={selectedSubject.chapters.map((ch, i) => ({
                          key: String(ch.id),
                          label: `${i + 1}. ${ch.title}`,
                        }))}
                      />
                      {selectedChapter ? (
                        <>
                          <div className="vv-tool-grid">
                            <Link
                              className="vv-tool"
                              href={`/admin/books/${selectedSubject.id}/read?chapter=${selectedChapter.id}&from=/admin/courses/${id}?tab=chapter&subjectId=${selectedSubject.id}&chapterId=${selectedChapter.id}`}
                              target="_blank"
                            >
                              <strong>View in Reader</strong>
                              <span>Read in authentic book format</span>
                            </Link>
                            <Link
                              className="vv-tool"
                              href={`/admin/courses/${id}/chapters/${selectedChapter.id}`}
                            >
                              <strong>Chapter text</strong>
                              <span>Write the book students read</span>
                            </Link>
                            <Link
                              className="vv-tool"
                              href={`/admin/courses/${id}/chapters/${selectedChapter.id}/simple-words`}
                            >
                              <strong>Simple words</strong>
                              <span>Add, edit, or delete notes</span>
                            </Link>
                            <Link
                              className="vv-tool"
                              href={`/admin/courses/${id}/chapters/${selectedChapter.id}/flashcards`}
                            >
                              <strong>Flashcards</strong>
                              <span>Add, edit, or delete cards</span>
                            </Link>
                            <Link
                              className="vv-tool"
                              href={`/admin/courses/${id}/chapters/${selectedChapter.id}/quizzes`}
                            >
                              <strong>Quizzes</strong>
                              <span>
                                {selectedChapter.activityCount
                                  ? `${selectedChapter.activityCount} attached`
                                  : 'Attach, edit, or remove quizzes'}
                              </span>
                            </Link>
                          </div>
                          <Space wrap style={{ marginTop: 12 }}>
                            <Button
                              icon={<ArrowLeftOutlined />}
                              disabled={
                                selectedSubject.chapters.findIndex((c) => c.id === selectedChapter.id) <= 0
                              }
                              onClick={() => moveChapter(selectedSubject.id, selectedChapter.id, -1)}
                            >
                              Move earlier
                            </Button>
                            <Button
                              icon={<ArrowRightOutlined />}
                              disabled={
                                selectedSubject.chapters.findIndex((c) => c.id === selectedChapter.id) >=
                                selectedSubject.chapters.length - 1
                              }
                              onClick={() => moveChapter(selectedSubject.id, selectedChapter.id, 1)}
                            >
                              Move later
                            </Button>
                            <Popconfirm
                              title="Delete this chapter?"
                              onConfirm={() =>
                                api
                                  .delete(`/admin/courses/chapters/${selectedChapter.id}`)
                                  .then(() => {
                                    setChapterId(null);
                                    load({ tab: 'chapter', subjectId: selectedSubject.id });
                                  })
                              }
                            >
                              <Button danger icon={<DeleteOutlined />}>
                                Delete chapter
                              </Button>
                            </Popconfirm>
                          </Space>
                        </>
                      ) : null}
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="Add semester"
        open={semesterOpen}
        onOk={addSemester}
        onCancel={() => setSemesterOpen(false)}
        okText="Add semester"
      >
        <p className="vv-hint">
          Use the university semester number. Students will see this under the course.
        </p>
        <Form form={semAddForm} layout="vertical">
          <Form.Item name="number" label="Semester number" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="title" label="Title">
            <Input placeholder="Semester 1" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add subject"
        open={subjectOpen != null}
        onOk={() => subjectOpen && addSubject(subjectOpen)}
        onCancel={() => setSubjectOpen(null)}
        okText="Add subject"
      >
        <p className="vv-hint">
          A subject is one paper in this semester, such as Mathematics for Computer Applications.
        </p>
        <Form form={subjectAddForm} layout="vertical" initialValues={{ published: true }}>
          <Form.Item name="name" label="Subject name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="syllabusCode" label="Syllabus code">
            <Input />
          </Form.Item>
          <Form.Item name="isbn" label="ISBN" extra="Optional.">
            <Input placeholder="978-93-00000-00-0" />
          </Form.Item>
          <Form.Item name="description" label="Short description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <p className="vv-hint" style={{ marginBottom: 8 }}>
            Student price. Leave a price empty if that option is not sold.
          </p>
          <Form.Item name="price" label="E-book price (₹)">
            <InputNumber min={0} step={50} style={{ width: '100%' }} placeholder="499" />
          </Form.Item>
          <Form.Item name="physicalPrice" label="Physical price (₹)">
            <InputNumber min={0} step={50} style={{ width: '100%' }} placeholder="699" />
          </Form.Item>
          <Form.Item
            name="bothPrice"
            label="Both price (₹)"
            extra="E-book and a printed copy together."
          >
            <InputNumber min={0} step={50} style={{ width: '100%' }} placeholder="899" />
          </Form.Item>
          <Form.Item
            name="bookBankPrice"
            label="Book bank price (₹ per student)"
            extra="College named-copy rate. Total = this × students on the license."
          >
            <InputNumber min={0} step={50} style={{ width: '100%' }} placeholder="299" />
          </Form.Item>
          <Form.Item
            name="libraryPrice"
            label="Library price (₹ per concurrent seat)"
            extra="College shared-seat rate. Total = this × live seats."
          >
            <InputNumber min={0} step={50} style={{ width: '100%' }} placeholder="199" />
          </Form.Item>
          <Form.Item
            name="discountPct"
            label="Discount (%)"
            extra="Optional. Applies to all three list prices above."
          >
            <InputNumber min={0} max={100} step={1} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item
            name="frontCover"
            label="Front cover"
            extra="First page of the open book."
            valuePropName="fileList"
            getValueFromEvent={uploadListEvent}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*">
              <Button>Upload front cover</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="backCover"
            label="Back cover"
            extra="Last page of the open book."
            valuePropName="fileList"
            getValueFromEvent={uploadListEvent}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*">
              <Button>Upload back cover</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="slug"
            label="Web address (optional)"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="bookPdf"
            label="Sample PDF"
            valuePropName="fileList"
            getValueFromEvent={uploadListEvent}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept="application/pdf">
              <Button>Choose PDF</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="published" label="Show to students" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add chapter"
        open={chapterOpen != null}
        onOk={() => chapterOpen && addChapter(chapterOpen)}
        onCancel={() => setChapterOpen(null)}
        okText="Add chapter"
      >
        <p className="vv-hint">
          Give it a student-facing title. You can paste the full text after it is created.
        </p>
        <Form form={chapterForm} layout="vertical">
          <Form.Item name="title" label="Chapter title" rules={[{ required: true }]}>
            <Input placeholder="Principles of Set Theory" />
          </Form.Item>
          <Form.Item name="content" label="Chapter text (optional for now)">
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>

      <CopyBookModal
        open={copyFromOpen}
        onClose={() => setCopyFromOpen(false)}
        currentCourseId={id}
        defaultDestCourseId={id}
        excludeSemesterId={selectedSemester?.id}
        onCopied={(result) => {
          if (result.courseId !== id) {
            router.push(`/admin/courses/${result.courseId}`);
            return;
          }
          load({ tab: 'subject', semesterId: result.semesterId, subjectId: result.subjectId });
        }}
      />

      <CopyBookModal
        open={copyToOpen}
        onClose={() => setCopyToOpen(false)}
        sourceSubjectId={selectedSubject?.id}
        defaultName={selectedSubject?.name}
        currentCourseId={id}
        excludeSemesterId={selectedSemester?.id}
        onCopied={(result) => {
          if (result.courseId !== id) {
            router.push(`/admin/courses/${result.courseId}`);
            return;
          }
          load({ tab: 'subject', semesterId: result.semesterId, subjectId: result.subjectId });
        }}
      />
    </main>
  );
}
