'use client';

import { BookOutlined, CopyOutlined, DeleteOutlined, ReadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Switch,
  Tag,
  message,
} from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import CopyBookModal from '../../../components/CopyBookModal';
import api from '../../../lib/api';

type Course = {
  id: number;
  name: string;
  slug: string;
  university?: string | null;
  description?: string | null;
  status: string;
  semesterCount?: number;
};

export default function AdminCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [open, setOpen] = React.useState(false);
  const [copyIntoId, setCopyIntoId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState('');
  const [form] = Form.useForm();

  const load = () => {
    api
      .get('/admin/courses')
      .then((r) => setCourses(r.data || []))
      .catch(() => message.error('Failed to load courses'));
  };

  React.useEffect(() => {
    load();
  }, []);

  const create = () => {
    form.validateFields().then((values) => {
      api
        .post('/admin/courses', {
          ...values,
          status: values.published ? 'PUBLISHED' : 'DRAFT',
        })
        .then(() => {
          message.success('Course created. Open it to add semesters, subjects, and chapters.');
          setOpen(false);
          form.resetFields();
          load();
        })
        .catch((e) => message.error(e.response?.data?.error || 'Create failed'));
    });
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/admin/courses/${id}`);
      message.success('Course deleted');
      load();
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Delete failed');
    }
  };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      [c.name, c.university, c.slug, c.description].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [courses, search]);

  return (
    <main className="vv-course-page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div>
          <h1>University courses</h1>
          <p className="vv-course-lead">
            These are digital textbooks, separate from magazines. Build them in this order so
            students can find them.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button icon={<ReadOutlined />} size="large" onClick={() => router.push('/admin/books')}>
            View all books
          </Button>
          <Button type="primary" size="large" onClick={() => setOpen(true)}>
            New course
          </Button>
        </div>
      </div>

      <div className="vv-course-steps">
        <span className="vv-course-step">
          <b>1</b> Course <em>e.g. BCA</em>
        </span>
        <span className="vv-course-step">
          <b>2</b> Semester
        </span>
        <span className="vv-course-step">
          <b>3</b> Subject <em>e.g. Maths</em>
        </span>
        <span className="vv-course-step">
          <b>4</b> Chapter
        </span>
      </div>

      <Input
        allowClear
        placeholder="Search by name or university"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />

      {filtered.length === 0 ? (
        <Empty
          description={
            courses.length === 0
              ? 'No courses yet. Create BCA (or another programme), then open it and add Semester 1.'
              : 'No courses match that search.'
          }
        >
          {courses.length === 0 ? (
            <Button type="primary" onClick={() => setOpen(true)}>
              Create first course
            </Button>
          ) : null}
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((c) => (
            <Col key={c.id} xs={24} md={12} xl={8}>
              <Card className="vv-course-card" styles={{ body: { padding: 16 } }}>
                <div className="vv-course-card-top">
                  <div style={{ display: 'flex', gap: 12 }}>
                    <BookOutlined style={{ fontSize: 26, color: '#2d7a3e', marginTop: 4 }} />
                    <div>
                      <h3>{c.name}</h3>
                      <p>{c.description || c.university || 'No description yet'}</p>
                    </div>
                  </div>
                  <Tag color={c.status === 'PUBLISHED' ? 'green' : 'gold'}>
                    {c.status === 'PUBLISHED' ? 'Live' : 'Draft'}
                  </Tag>
                </div>
                <div className="vv-course-meta">
                  <span>{c.university || 'University not set'}</span>
                  <span>·</span>
                  <span>
                    {c.semesterCount || 0} semester{(c.semesterCount || 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link href={`/admin/courses/${c.id}`}>
                    <Button type="primary">Open structure</Button>
                  </Link>
                  <Button icon={<CopyOutlined />} onClick={() => setCopyIntoId(c.id)}>
                    Copy a book here
                  </Button>
                  <Popconfirm
                    title="Delete this whole course and its chapters?"
                    onConfirm={() => remove(c.id)}
                  >
                    <Button danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="New course"
        open={open}
        onOk={create}
        onCancel={() => setOpen(false)}
        okText="Create course"
        destroyOnClose
      >
        <p className="vv-hint">
          Start with the programme name. You will add semesters inside the course next.
        </p>
        <Form form={form} layout="vertical" initialValues={{ published: true, sortOrder: 10 }}>
          <Form.Item name="name" label="Programme name" rules={[{ required: true }]}>
            <Input placeholder="BCA" />
          </Form.Item>
          <Form.Item name="university" label="University">
            <Input placeholder="CCS University" />
          </Form.Item>
          <Form.Item name="description" label="Short description">
            <Input.TextArea rows={3} placeholder="What students will find in this course" />
          </Form.Item>
          <Form.Item name="slug" label="Web address (optional)">
            <Input placeholder="bca" />
          </Form.Item>
          <Form.Item name="sortOrder" label="List order">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="published" label="Show to students" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <CopyBookModal
        open={copyIntoId != null}
        onClose={() => setCopyIntoId(null)}
        defaultDestCourseId={copyIntoId}
        currentCourseId={copyIntoId}
        onCopied={(result) => {
          setCopyIntoId(null);
          router.push(`/admin/courses/${result.courseId}`);
        }}
      />
    </main>
  );
}
