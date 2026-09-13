'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
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
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import api from '../../../../lib/api';

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

export default function AdminCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  const applySel = (data: Course, next?: NextSel) => {
    const semesters = data.semesters || [];
    const nextSem = next?.semesterId ?? semesterId ?? semesters[0]?.id ?? null;
    const semester = semesters.find((s) => s.id === nextSem) || semesters[0];
    const nextSub = next?.subjectId ?? subjectId ?? semester?.subjects[0]?.id ?? null;
    const subject =
      semester?.subjects.find((s) => s.id === nextSub) ||
      semesters.flatMap((s) => s.subjects).find((s) => s.id === nextSub) ||
      semester?.subjects[0];
    const nextCh = next?.chapterId ?? chapterId ?? subject?.chapters[0]?.id ?? null;
    if (next?.tab) setTab(next.tab);
    setSemesterId(semester?.id ?? null);
    setSubjectId(subject?.id ?? null);
    setChapterId(
      subject?.chapters.some((c) => c.id === nextCh) ? nextCh : (subject?.chapters[0]?.id ?? null),
    );
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
    if (key === 'semester' && !semesterId && course?.semesters[0])
      setSemesterId(course.semesters[0].id);
    if (key === 'subject') {
      const sem = course?.semesters.find((s) => s.id === semesterId) || course?.semesters[0];
      if (sem && !sem.subjects.some((s) => s.id === subjectId))
        setSubjectId(sem.subjects[0]?.id ?? null);
    }
    if (key === 'chapter') {
      const sub =
        course?.semesters.flatMap((s) => s.subjects).find((s) => s.id === subjectId) ||
        course?.semesters[0]?.subjects[0];
      if (sub && !sub.chapters.some((c) => c.id === chapterId))
        setChapterId(sub.chapters[0]?.id ?? null);
    }
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
      fd.append('status', values.published ? 'PUBLISHED' : 'DRAFT');
      const file: File | undefined = values.bookPdf?.file?.originFileObj || values.bookPdf;
      if (file instanceof File) fd.append('bookPdf', file);
      api
        .post(`/admin/courses/semesters/${sid}/subjects`, fd)
        .then((r) => {
          message.success('Subject added');
          setSubjectOpen(null);
          subjectAddForm.resetFields();
          load({ tab: 'subject', semesterId: sid, subjectId: Number(r.data?.id) });
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
    });
  };

  const saveSubject = (sid: number) => {
    subjectForm.validateFields().then((values) => {
      const fd = new FormData();
      fd.append('name', values.name);
      if (values.slug) fd.append('slug', values.slug);
      if (values.description) fd.append('description', values.description);
      if (values.syllabusCode) fd.append('syllabusCode', values.syllabusCode);
      fd.append('status', values.published ? 'PUBLISHED' : 'DRAFT');
      const file: File | undefined = values.bookPdf?.file?.originFileObj || values.bookPdf;
      if (file instanceof File) fd.append('bookPdf', file);
      api
        .put(`/admin/courses/subjects/${sid}`, fd)
        .then(() => {
          message.success('Subject saved');
          load();
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
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
          if (newChapterId) {
            router.push(`/admin/courses/${id}/chapters/${newChapterId}`);
            return;
          }
          load({ tab: 'chapter', subjectId: sid });
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
    });
  };

  if (!course) {
    return (
      <main className="vv-course-page">
        <p className="vv-hint">Loading course…</p>
      </main>
    );
  }

  const addExtra =
    tab === 'semester' ? (
      <Button type="primary" icon={<PlusOutlined />} onClick={openAddSemester}>
        Add semester
      </Button>
    ) : tab === 'subject' ? (
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={!selectedSemester}
        onClick={() => selectedSemester && setSubjectOpen(selectedSemester.id)}
      >
        Add subject
      </Button>
    ) : tab === 'chapter' ? (
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={!selectedSubject}
        onClick={() => selectedSubject && setChapterOpen(selectedSubject.id)}
      >
        Add chapter
      </Button>
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
                    No semesters yet.
                    <div style={{ marginTop: 10 }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={openAddSemester}>
                        Add semester
                      </Button>
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
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setSubjectOpen(selectedSemester.id)}
                        >
                          Add subject
                        </Button>
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
                          <Form.Item name="description" label="What this subject covers">
                            <Input.TextArea rows={2} />
                          </Form.Item>
                          <Form.Item name="slug" label="Web address">
                            <Input />
                          </Form.Item>
                          <Form.Item name="bookPdf" label="Optional PDF">
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
                        onChange={(key) => setChapterId(Number(key))}
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
          <Form.Item name="description" label="Short description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="slug" label="Web address (optional)">
            <Input />
          </Form.Item>
          <Form.Item name="bookPdf" label="Optional PDF">
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
    </main>
  );
}
