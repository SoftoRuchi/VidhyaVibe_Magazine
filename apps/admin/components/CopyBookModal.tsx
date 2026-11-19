'use client';

import { Form, Input, InputNumber, Modal, Select, message } from 'antd';
import React from 'react';
import api from '../lib/api';

const NEW_SEM = '__new__';

export type CatalogBook = {
  subjectId: number;
  name: string;
  semesterId: number;
  courseId: number;
  courseName: string;
  semesterNumber: number;
  semesterTitle: string;
  chapterCount: number;
};

export type CatalogCourse = {
  id: number;
  name: string;
  semesters: { id: number; number: number; title: string }[];
};

export type CopyResult = {
  courseId: number;
  subjectId: number;
  semesterId: number;
  createdSemester?: boolean;
};

export default function CopyBookModal({
  open,
  onClose,
  onCopied,
  sourceSubjectId,
  defaultName,
  defaultDestCourseId,
  excludeSemesterId,
  currentCourseId,
}: {
  open: boolean;
  onClose: () => void;
  onCopied?: (result: CopyResult) => void;
  sourceSubjectId?: number | null;
  defaultName?: string;
  defaultDestCourseId?: number | null;
  excludeSemesterId?: number | null;
  currentCourseId?: number | null;
}) {
  const [form] = Form.useForm();
  const [copying, setCopying] = React.useState(false);
  const [catalog, setCatalog] = React.useState<{ courses: CatalogCourse[]; books: CatalogBook[] }>({
    courses: [],
    books: [],
  });
  const destCourseId = Form.useWatch('destCourseId', form);
  const semesterKey = Form.useWatch('semesterKey', form);
  const destCourse = catalog.courses.find((c) => c.id === Number(destCourseId)) || null;
  const destSemesters = (destCourse?.semesters || []).filter(
    (sem) => sem.id !== excludeSemesterId,
  );
  const typingSemester = semesterKey === NEW_SEM || (destCourse != null && destSemesters.length === 0);

  const applyCourse = (courseId: number, courses = catalog.courses) => {
    const dest = courses.find((c) => c.id === courseId);
    const usable = (dest?.semesters || []).filter((sem) => sem.id !== excludeSemesterId);
    form.setFieldsValue({
      destCourseId: courseId,
      semesterKey: usable[0] ? usable[0].id : NEW_SEM,
      semesterNumber: usable.length ? usable.length + 1 : 1,
      semesterTitle: `Semester ${usable.length ? usable.length + 1 : 1}`,
    });
  };

  React.useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      sourceSubjectId: sourceSubjectId || undefined,
      name: defaultName,
      destCourseId: defaultDestCourseId || undefined,
      semesterKey: undefined,
      semesterNumber: 1,
      semesterTitle: 'Semester 1',
    });
    api
      .get('/admin/courses/book-catalog')
      .then((r) => {
        const next = {
          courses: (r.data?.courses || []) as CatalogCourse[],
          books: (r.data?.books || []) as CatalogBook[],
        };
        setCatalog(next);
        const destId =
          defaultDestCourseId ||
          (sourceSubjectId
            ? next.courses.find((c) => c.id !== currentCourseId)?.id
            : next.courses.find((c) => c.id === currentCourseId)?.id) ||
          next.courses.find((c) => c.id !== currentCourseId)?.id;
        if (destId) applyCourse(destId, next.courses);
      })
      .catch(() => message.error('Could not load books to copy'));
  }, [open, sourceSubjectId, defaultDestCourseId, currentCourseId, defaultName]);

  const submit = () => {
    form.validateFields().then((values) => {
      const bookId = Number(sourceSubjectId || values.sourceSubjectId);
      if (!bookId) {
        message.error('Pick a book to copy');
        return;
      }
      const courseId = Number(values.destCourseId);
      const creating = values.semesterKey === NEW_SEM || !destSemesters.length;
      setCopying(true);
      api
        .post(`/admin/courses/subjects/${bookId}/copy`, {
          targetCourseId: courseId,
          targetSemesterId: creating ? undefined : Number(values.semesterKey),
          createSemester: creating ? true : undefined,
          semesterNumber: creating ? values.semesterNumber : undefined,
          semesterTitle: creating ? values.semesterTitle : undefined,
          name: values.name,
        })
        .then((r) => {
          const chapters = Number(r.data?.chapterCount) || 0;
          message.success(
            r.data?.createdSemester
              ? `Added a semester and copied this book (${chapters} chapter${
                  chapters === 1 ? '' : 's'
                }).`
              : `Copied this book with ${chapters} chapter${chapters === 1 ? '' : 's'}.`,
          );
          onClose();
          onCopied?.({
            courseId: Number(r.data?.courseId),
            subjectId: Number(r.data?.id),
            semesterId: Number(r.data?.semesterId),
            createdSemester: Boolean(r.data?.createdSemester),
          });
        })
        .catch((e) =>
          message.error(
            e.response?.data?.message || e.response?.data?.error || 'Could not copy book',
          ),
        )
        .finally(() => setCopying(false));
    });
  };

  return (
    <Modal
      title={sourceSubjectId ? 'Copy this book to another course' : 'Copy a book into this course'}
      open={open}
      confirmLoading={copying}
      onOk={submit}
      onCancel={onClose}
      okText="Copy book"
      destroyOnClose
    >
      <p className="vv-hint">
        Reuse a textbook instead of uploading it again. If the course has no semester, type one
        here and it is created with the book.
      </p>
      <Form form={form} layout="vertical">
        {sourceSubjectId ? (
          <Form.Item name="name" label="Name in the other course">
            <Input />
          </Form.Item>
        ) : (
          <Form.Item
            name="sourceSubjectId"
            label="Book to copy"
            rules={[{ required: true, message: 'Pick a book' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Choose an existing textbook"
              options={catalog.courses
                .map((c) => ({
                  label: c.name,
                  options: catalog.books
                    .filter(
                      (b) =>
                        b.courseId === c.id &&
                        b.semesterId !== excludeSemesterId &&
                        b.subjectId !== sourceSubjectId,
                    )
                    .map((b) => ({
                      value: b.subjectId,
                      label: `${b.semesterTitle} · ${b.name} (${b.chapterCount} chapter${
                        b.chapterCount === 1 ? '' : 's'
                      })`,
                    })),
                }))
                .filter((g) => g.options.length > 0)}
              onChange={(value) => {
                const book = catalog.books.find((b) => b.subjectId === Number(value));
                if (book && !form.getFieldValue('name')) form.setFieldValue('name', book.name);
              }}
            />
          </Form.Item>
        )}
        {!sourceSubjectId ? (
          <Form.Item name="name" label="Name in this course (optional)">
            <Input placeholder="Leave blank to keep the same name" />
          </Form.Item>
        ) : null}
        <Form.Item
          name="destCourseId"
          label="Course"
          rules={[{ required: true, message: 'Pick a course' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Choose B.tech, BCA, or another programme"
            options={catalog.courses.map((c) => ({
              value: c.id,
              label:
                c.id === currentCourseId
                  ? `${c.name} (this course)`
                  : c.semesters.length
                    ? `${c.name} · ${c.semesters.length} semester${
                        c.semesters.length === 1 ? '' : 's'
                      }`
                    : `${c.name} · no semester yet`,
            }))}
            onChange={(value) => applyCourse(Number(value))}
          />
        </Form.Item>
        {destCourse && destSemesters.length > 0 ? (
          <Form.Item
            name="semesterKey"
            label="Semester"
            rules={[{ required: true, message: 'Pick a semester' }]}
          >
            <Select
              placeholder="Choose a semester"
              options={[
                ...destSemesters.map((sem) => ({
                  value: sem.id,
                  label: sem.title || `Semester ${sem.number}`,
                })),
                { value: NEW_SEM, label: '+ Add a new semester' },
              ]}
            />
          </Form.Item>
        ) : null}
        {destCourse && typingSemester ? (
          <>
            {destSemesters.length === 0 ? (
              <p className="vv-hint">
                {destCourse.name} has no semester yet. Enter the semester number and title below.
              </p>
            ) : (
              <p className="vv-hint">This semester will be added, then the book is copied into it.</p>
            )}
            <Form.Item
              name="semesterNumber"
              label="Semester number"
              rules={[{ required: true, message: 'Enter a semester number' }]}
            >
              <InputNumber
                min={1}
                style={{ width: '100%' }}
                onChange={(value) => {
                  const num = Number(value) || 1;
                  const title = String(form.getFieldValue('semesterTitle') || '');
                  if (!title || /^Semester\s+\d+$/i.test(title)) {
                    form.setFieldValue('semesterTitle', `Semester ${num}`);
                  }
                }}
              />
            </Form.Item>
            <Form.Item name="semesterTitle" label="Semester title">
              <Input placeholder="Semester 1" />
            </Form.Item>
          </>
        ) : null}
      </Form>
    </Modal>
  );
}
