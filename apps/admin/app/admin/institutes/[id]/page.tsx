'use client';

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import api from '../../../../lib/api';
import { formatAppDateTime, formatDuration } from '../../../../lib/formatAppDateTime';
import {
  downloadStudentRosterSample,
  parseStudentRosterCsv,
} from '../../../../lib/studentRosterCsv';

type Lot = {
  id: number;
  subjectName: string;
  courseName: string;
  accessModel: string;
  seatCount: number;
  assignedSeats: number;
  liveReaders: number;
  purchaseCode: string;
  status: string;
};

type Member = {
  id: number;
  name: string;
  email: string;
  role: string;
  className?: string | null;
  rollNumber?: string | null;
};

type SubjectOpt = { id: number; label: string };

export default function AdminInstituteDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState(search.get('tab') || 'licenses');
  const [lotOpen, setLotOpen] = React.useState(false);
  const [studentOpen, setStudentOpen] = React.useState<Lot | null>(null);
  const [memberOpen, setMemberOpen] = React.useState(false);
  const [individualOpen, setIndividualOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [subjects, setSubjects] = React.useState<SubjectOpt[]>([]);
  const [lotForm] = Form.useForm();
  const [studentForm] = Form.useForm();
  const [memberForm] = Form.useForm();
  const [individualForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/admin/institutes/${id}`)
      .then((r) => setData(r.data))
      .catch(() => message.error('Failed to load institute'))
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    load();
    api
      .get('/admin/book-licenses/subjects')
      .then((r) => setSubjects(r.data || []))
      .catch(() => {});
  }, [load]);

  React.useEffect(() => {
    const next = search.get('tab');
    if (next) setTab(next);
  }, [search]);

  const changeTab = (key: string) => {
    setTab(key);
    router.replace(`/admin/institutes/${id}?tab=${key}`);
  };

  const createLot = () => {
    lotForm.validateFields().then((values) => {
      api
        .post(`/admin/institutes/${id}/lots`, values)
        .then((r) => {
          message.success(`License created. Code ${r.data.purchaseCode}`);
          setLotOpen(false);
          lotForm.resetFields();
          load();
        })
        .catch((e) =>
          message.error(e.response?.data?.message || e.response?.data?.error || 'Failed'),
        );
    });
  };

  const addMember = () => {
    memberForm.validateFields().then((values) => {
      api
        .post(`/admin/institutes/${id}/members`, values)
        .then((r) => {
          message.success(
            values.role === 'INSTITUTE_ADMIN'
              ? r.data?.emailed
                ? 'Institute admin added. Login details were emailed.'
                : 'Institute admin added'
              : r.data?.emailed
                ? 'Student added. Login details were emailed.'
                : 'Student added. Could not send the login email — check Email Configuration.',
          );
          setMemberOpen(false);
          memberForm.resetFields();
          load();
          changeTab('students');
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
    });
  };

  const loadRosterFile = async (file: File) => {
    const text = await file.text();
    studentForm.setFieldsValue({ roster: text });
    const count = parseStudentRosterCsv(text).length;
    if (count) message.success(`Loaded ${count} student${count === 1 ? '' : 's'} from CSV`);
    else message.warning('No student emails found in that file. Check the sample CSV.');
    return false;
  };

  const importStudents = () => {
    studentForm.validateFields().then((values) => {
      const students = parseStudentRosterCsv(String(values.roster || ''));
      if (!students.length) {
        message.error(
          'No valid student emails found. Use the sample CSV or paste email, name, class, roll.',
        );
        return;
      }
      api
        .post(`/admin/book-licenses/${studentOpen?.id}/students`, { students })
        .then((r) => {
          const assigned = r.data?.assigned || 0;
          const emailed = r.data?.emailed || 0;
          message.success(
            emailed
              ? `Assigned ${assigned} students. Login details emailed to ${emailed}.`
              : `Assigned ${assigned} students. Could not send login emails — check Email Configuration.`,
          );
          setStudentOpen(null);
          studentForm.resetFields();
          load();
          changeTab('students');
        })
        .catch((e) =>
          message.error(e.response?.data?.message || e.response?.data?.error || 'Failed'),
        );
    });
  };

  const grantIndividual = () => {
    individualForm.validateFields().then((values) => {
      api
        .post('/admin/book-licenses/individual', values)
        .then((r) => {
          message.success(
            r.data?.emailed
              ? `Individual license ${r.data.purchaseCode}. Login emailed to ${r.data.email}.`
              : `Individual license ${r.data.purchaseCode}. Could not send the login email.`,
          );
          setIndividualOpen(false);
          individualForm.resetFields();
        })
        .catch((e) => message.error(e.response?.data?.error || 'Failed'));
    });
  };

  const saveInstitute = () => {
    editForm.validateFields().then((values) => {
      api
        .put(`/admin/institutes/${id}`, { ...values, status: data.status })
        .then(() => {
          message.success('Institute updated');
          setEditOpen(false);
          load();
        })
        .catch((e) => message.error(e.response?.data?.error || 'Update failed'));
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      message.success('Purchase code copied');
    } catch {
      message.info(code);
    }
  };

  const setLotStatus = (lotId: number, status: string) => {
    api
      .patch(`/admin/book-licenses/${lotId}`, { status })
      .then(() => {
        message.success(status === 'ACTIVE' ? 'License activated' : 'License cancelled');
        load();
      })
      .catch((e) => message.error(e.response?.data?.error || 'Update failed'));
  };

  const removeMember = (memberId: number) => {
    api
      .delete(`/admin/institutes/${id}/members/${memberId}`)
      .then(() => {
        message.success('Student removed');
        load();
      })
      .catch((e) => message.error(e.response?.data?.error || 'Remove failed'));
  };

  const setMemberRole = (memberId: number, role: string) => {
    api
      .patch(`/admin/institutes/${id}/members/${memberId}`, { role })
      .then(() => {
        message.success(
          role === 'INSTITUTE_ADMIN' ? 'Marked as institute admin' : 'Marked as student',
        );
        load();
      })
      .catch((e) => message.error(e.response?.data?.error || 'Update failed'));
  };

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <Empty description="Institute not found">
        <Link href="/admin/institutes">
          <Button>Back to institutes</Button>
        </Link>
      </Empty>
    );
  }

  return (
    <main className="vv-course-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
        >
          <div>
            <Link href="/admin/institutes">
              <Button type="text" icon={<ArrowLeftOutlined />}>
                All institutes
              </Button>
            </Link>
            <Typography.Title level={3} style={{ margin: '8px 0 0' }}>
              {data.name}{' '}
              <Tag color={data.status === 'ACTIVE' ? 'green' : 'default'}>{data.status}</Tag>
            </Typography.Title>
            <p className="vv-course-lead" style={{ marginTop: 6 }}>
              Code <Tag>{data.code}</Tag>
              {data.city ? ` · ${data.city}` : ''}
              {data.email ? ` · ${data.email}` : ''}
              {data.phone ? ` · ${data.phone}` : ''}
            </p>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={load}>
              Refresh
            </Button>
            <Button onClick={() => router.push('/admin/book-activity')}>All book activity</Button>
            <Button onClick={() => router.push('/admin/live-seats')}>Live seats</Button>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                editForm.setFieldsValue({
                  name: data.name,
                  email: data.email,
                  phone: data.phone,
                  city: data.city,
                });
                setEditOpen(true);
              }}
            >
              Edit institute
            </Button>
            <Button icon={<UserAddOutlined />} onClick={() => setMemberOpen(true)}>
              Add student
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setLotOpen(true)}>
              Add license
            </Button>
          </Space>
        </div>

        <Tabs
          className="vv-course-tabs"
          activeKey={tab}
          onChange={changeTab}
          items={[
            {
              key: 'licenses',
              label: `Licenses (${(data.lots || []).length})`,
              children: (
                <Card
                  extra={
                    <Space>
                      <Button onClick={() => setIndividualOpen(true)}>Grant individual</Button>
                      <Button type="primary" onClick={() => setLotOpen(true)}>
                        Book bank / Library
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    rowKey="id"
                    dataSource={data.lots || []}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty description="No licenses yet. Add a Book Bank or Library lot." />
                      ),
                    }}
                    columns={[
                      {
                        title: 'Book',
                        render: (_: unknown, r: Lot) => (
                          <div>
                            <div style={{ fontWeight: 600 }}>{r.subjectName}</div>
                            <div style={{ color: '#667085', fontSize: 12 }}>{r.courseName}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Model',
                        dataIndex: 'accessModel',
                        width: 130,
                        render: (v: string) => (
                          <Tag
                            color={v === 'LIBRARY' ? 'blue' : v === 'BOOK_BANK' ? 'green' : 'gold'}
                          >
                            {v === 'BOOK_BANK' ? 'Book bank' : v === 'LIBRARY' ? 'Library' : v}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Seats',
                        width: 110,
                        render: (_: unknown, r: Lot) => `${r.assignedSeats} / ${r.seatCount}`,
                      },
                      {
                        title: 'Reading now',
                        dataIndex: 'liveReaders',
                        width: 120,
                        render: (v: number) => (v ? <Tag color="green">{v} live</Tag> : '0'),
                      },
                      {
                        title: 'Purchase code',
                        dataIndex: 'purchaseCode',
                        render: (v: string) => (
                          <Space>
                            <code>{v}</code>
                            <Button
                              type="link"
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => copyCode(v)}
                            />
                          </Space>
                        ),
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        width: 110,
                        render: (v: string) => (
                          <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag>
                        ),
                      },
                      {
                        title: 'Action',
                        key: 'action',
                        width: 260,
                        render: (_: unknown, r: Lot) => (
                          <Space wrap size={0}>
                            {r.accessModel === 'BOOK_BANK' ? (
                              <Button type="link" size="small" onClick={() => setStudentOpen(r)}>
                                Enter students
                              </Button>
                            ) : (
                              <Typography.Text
                                type="secondary"
                                style={{ fontSize: 12, padding: '0 8px' }}
                              >
                                Shared pool
                              </Typography.Text>
                            )}
                            <Button
                              type="link"
                              size="small"
                              onClick={() => copyCode(r.purchaseCode)}
                            >
                              Copy code
                            </Button>
                            <Popconfirm
                              title={
                                r.status === 'ACTIVE'
                                  ? 'Cancel this license?'
                                  : 'Activate this license?'
                              }
                              onConfirm={() =>
                                setLotStatus(r.id, r.status === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE')
                              }
                            >
                              <Button type="link" size="small">
                                {r.status === 'ACTIVE' ? 'Cancel' : 'Activate'}
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: 'students',
              label: `Students (${(data.members || []).length})`,
              children: (
                <Card
                  extra={
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => setMemberOpen(true)}
                    >
                      Add student
                    </Button>
                  }
                >
                  <p className="vv-course-lead" style={{ marginBottom: 12 }}>
                    Institute admins log in on the reader site and open <strong>College</strong> to
                    see live readers and activity for this campus only.
                  </p>
                  <Table
                    rowKey="id"
                    dataSource={data.members || []}
                    pagination={{ pageSize: 10, hideOnSinglePage: true }}
                    locale={{
                      emptyText: (
                        <Empty description="No students yet. Add one, or enter a roster from a Book Bank license." />
                      ),
                    }}
                    columns={[
                      { title: 'Name', dataIndex: 'name', render: (v: string) => v || '—' },
                      { title: 'Email', dataIndex: 'email' },
                      { title: 'Class', dataIndex: 'className', render: (v: string) => v || '—' },
                      { title: 'Roll', dataIndex: 'rollNumber', render: (v: string) => v || '—' },
                      {
                        title: 'Role',
                        dataIndex: 'role',
                        render: (v: string) => (
                          <Tag>{v === 'INSTITUTE_ADMIN' ? 'Institute admin' : 'Student'}</Tag>
                        ),
                      },
                      {
                        title: 'Action',
                        key: 'action',
                        width: 280,
                        render: (_: unknown, r: Member) => (
                          <Space wrap size={0}>
                            <Button
                              type="link"
                              size="small"
                              onClick={() =>
                                setMemberRole(
                                  r.id,
                                  r.role === 'INSTITUTE_ADMIN' ? 'STUDENT' : 'INSTITUTE_ADMIN',
                                )
                              }
                            >
                              {r.role === 'INSTITUTE_ADMIN'
                                ? 'Make student'
                                : 'Make institute admin'}
                            </Button>
                            <Popconfirm
                              title="Remove this student from the institute?"
                              onConfirm={() => removeMember(r.id)}
                            >
                              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                Remove
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: 'live',
              label: `Live seats (${(data.lots || []).reduce((sum: number, lot: Lot) => sum + (lot.liveReaders || 0), 0)})`,
              children: <LiveSeatsCard instituteId={id} />,
            },
            {
              key: 'activity',
              label: 'Activity',
              children: <ActivityCard instituteId={id} />,
            },
          ]}
        />
      </Space>

      <Modal
        title="Purchase licenses"
        open={lotOpen}
        onOk={createLot}
        onCancel={() => setLotOpen(false)}
        okText="Create license"
      >
        <p className="vv-course-lead" style={{ marginBottom: 12 }}>
          Book bank assigns named students. Library shares a limited number of concurrent seats.
        </p>
        <Form
          form={lotForm}
          layout="vertical"
          initialValues={{ accessModel: 'BOOK_BANK', seatCount: 60 }}
        >
          <Form.Item
            name="subjectId"
            label="Book"
            rules={[{ required: true, message: 'Select a book' }]}
          >
            <Select
              showSearch
              placeholder="Search a subject"
              optionFilterProp="label"
              options={subjects.map((s) => ({ value: s.id, label: s.label }))}
            />
          </Form.Item>
          <Form.Item name="accessModel" label="Access model">
            <Select
              options={[
                { value: 'BOOK_BANK', label: 'Book bank — named students, each gets a copy' },
                { value: 'LIBRARY', label: 'Library — concurrent seats for the class' },
              ]}
            />
          </Form.Item>
          <Form.Item name="seatCount" label="Number of licenses">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input placeholder="Optional, e.g. FY BCA 2026 batch" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Enter students for ${studentOpen?.subjectName || 'book'}`}
        open={!!studentOpen}
        onOk={importStudents}
        onCancel={() => setStudentOpen(null)}
        width={640}
        okText="Assign seats"
      >
        <p>
          Upload a CSV or paste students. Columns: <code>email, name, class, roll, password</code>.
          Password is optional. The first row can be a header. Login details are emailed to each
          student — they are not shown here.
        </p>
        <Space wrap style={{ marginBottom: 12 }}>
          <Upload
            accept=".csv,.txt,text/csv"
            showUploadList={false}
            beforeUpload={(file) => {
              void loadRosterFile(file as File);
              return false;
            }}
          >
            <Button icon={<UserAddOutlined />}>Upload CSV</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={() => downloadStudentRosterSample()}>
            Download sample CSV
          </Button>
        </Space>
        <Form form={studentForm} layout="vertical">
          <Form.Item
            name="roster"
            rules={[{ required: true, message: 'Upload a CSV or paste at least one student' }]}
          >
            <Input.TextArea
              rows={10}
              placeholder="anita.demo@vvcollege.edu, Anita Sharma, BCA-2, 21, Demo@123"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add student"
        open={memberOpen}
        onOk={addMember}
        onCancel={() => setMemberOpen(false)}
        okText="Add student"
      >
        <Form form={memberForm} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="student@college.edu" />
          </Form.Item>
          <Form.Item name="name" label="Name">
            <Input />
          </Form.Item>
          <Form.Item name="className" label="Class">
            <Input placeholder="BCA-2" />
          </Form.Item>
          <Form.Item name="rollNumber" label="Roll number">
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password (optional)">
            <Input.Password placeholder="Leave blank to auto-generate" />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="STUDENT">
            <Select
              options={[
                { value: 'STUDENT', label: 'Student' },
                {
                  value: 'INSTITUTE_ADMIN',
                  label: 'Institute admin — College portal on the reader site',
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Grant individual book access"
        open={individualOpen}
        onOk={grantIndividual}
        onCancel={() => setIndividualOpen(false)}
        okText="Grant access"
      >
        <p className="vv-course-lead" style={{ marginBottom: 12 }}>
          The buyer can open this book on one device at a time.
        </p>
        <Form form={individualForm} layout="vertical">
          <Form.Item name="email" label="User email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Name">
            <Input />
          </Form.Item>
          <Form.Item name="subjectId" label="Book" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={subjects.map((s) => ({ value: s.id, label: s.label }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit institute"
        open={editOpen}
        onOk={saveInstitute}
        onCancel={() => setEditOpen(false)}
        okText="Save"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="City">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}

function LiveSeatsCard({ instituteId }: { instituteId: number }) {
  const [readers, setReaders] = React.useState<any[]>([]);
  const [occupancy, setOccupancy] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [ending, setEnding] = React.useState<number | null>(null);

  const load = React.useCallback(
    (silent?: boolean) => {
      if (!silent) setLoading(true);
      api
        .get('/admin/institutes/live', { params: { instituteId } })
        .then((r) => {
          setReaders(r.data?.readers || []);
          setOccupancy(r.data?.occupancy || []);
        })
        .catch(() => {
          setReaders([]);
          setOccupancy([]);
        })
        .finally(() => setLoading(false));
    },
    [instituteId],
  );

  React.useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const endSession = (sessionId: number) => {
    setEnding(sessionId);
    api
      .post(`/admin/institutes/live/${sessionId}/end`)
      .then(() => {
        message.success('Seat released');
        load(true);
      })
      .catch((e) => message.error(e.response?.data?.message || 'Could not end the session'))
      .finally(() => setEnding(null));
  };

  return (
    <Card
      extra={
        <Space>
          <Link href="/admin/live-seats">All live seats</Link>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => load()}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        Students with this college’s books open right now. Ending a session frees a library seat
        immediately.
      </Typography.Paragraph>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={readers}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        locale={{
          emptyText: <Empty description="Nobody from this college is reading right now." />,
        }}
        columns={[
          { title: 'Student', render: (_: unknown, r: any) => `${r.name || '—'} (${r.email})` },
          { title: 'Book', dataIndex: 'subjectName' },
          {
            title: 'Chapter',
            render: (_: unknown, r: any) =>
              r.chapterTitle
                ? `${r.chapterTitle}${r.pageNumber ? ` · p.${r.pageNumber}` : ''}`
                : '—',
          },
          { title: 'Model', dataIndex: 'accessModel', render: (v: string) => <Tag>{v}</Tag> },
          {
            title: 'Time',
            dataIndex: 'secondsActive',
            render: (v: number) => formatDuration(v),
          },
          { title: 'Device', dataIndex: 'deviceName', render: (v: string) => v || '—' },
          {
            title: 'Action',
            render: (_: unknown, r: any) => (
              <Popconfirm
                title="End this session and free the seat?"
                onConfirm={() => endSession(r.id)}
              >
                <Button type="link" size="small" danger loading={ending === r.id}>
                  End session
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        License occupancy
      </Typography.Title>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={occupancy}
        pagination={false}
        locale={{ emptyText: <Empty description="No licenses yet." /> }}
        columns={[
          { title: 'Book', dataIndex: 'subjectName' },
          {
            title: 'Model',
            dataIndex: 'accessModel',
            render: (v: string) => (
              <Tag>{v === 'BOOK_BANK' ? 'Book bank' : v === 'LIBRARY' ? 'Library' : v}</Tag>
            ),
          },
          { title: 'Seats', render: (_: unknown, r: any) => `${r.liveReaders} / ${r.seatCount}` },
          {
            title: 'Library',
            render: (_: unknown, r: any) =>
              r.accessModel === 'LIBRARY' ? (
                r.full ? (
                  <Tag color="red">Full</Tag>
                ) : (
                  `${r.remaining} left`
                )
              ) : (
                '—'
              ),
          },
        ]}
      />
    </Card>
  );
}

function ActivityCard({ instituteId }: { instituteId: number }) {
  const [rows, setRows] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState<string | null>(null);
  const load = () => {
    setLoading(true);
    api
      .get(`/admin/institutes/${instituteId}/activity`)
      .then((r) => setRows(r.data))
      .catch(() => setRows({ reading: [], logins: [] }))
      .finally(() => setLoading(false));
  };
  React.useEffect(() => {
    load();
  }, [instituteId]);

  const exportCsv = async (kind: 'reading' | 'logins') => {
    setExporting(kind);
    try {
      const res = await api.get(`/admin/institutes/${instituteId}/activity`, {
        params: { format: 'csv', kind },
        responseType: 'blob',
      });
      const header = String(res.headers?.['content-disposition'] || '');
      const match = header.match(/filename="?([^"]+)"?/i);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] || `institute-${kind}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      message.error('Could not export CSV');
    } finally {
      setExporting(null);
    }
  };

  if (loading && !rows) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  return (
    <Card
      extra={
        <Space wrap>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={exporting === 'reading'}
            onClick={() => exportCsv('reading')}
          >
            Reading CSV
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={exporting === 'logins'}
            onClick={() => exportCsv('logins')}
          >
            Logins CSV
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        Who opened which book, for how long, from which device, and which chapter they reached.
        Green means they are reading now. Individual buyers without this institute are on{' '}
        <Link href="/admin/book-activity">Book activity</Link>.
      </Typography.Paragraph>
      <Table
        size="small"
        rowKey="id"
        dataSource={rows?.reading || []}
        scroll={{ x: 1080 }}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="No reading activity yet." /> }}
        columns={[
          { title: 'Student', render: (_: unknown, r: any) => `${r.name || '—'} (${r.email})` },
          { title: 'Book', dataIndex: 'subjectName' },
          {
            title: 'Chapter',
            render: (_: unknown, r: any) =>
              r.chapterTitle
                ? `${r.chapterTitle}${r.pageNumber ? ` · p.${r.pageNumber}` : ''}`
                : '—',
          },
          {
            title: 'Model',
            dataIndex: 'accessModel',
            render: (v: string) => <Tag>{v}</Tag>,
          },
          {
            title: 'Time',
            dataIndex: 'secondsActive',
            render: (v: number) => formatDuration(v),
          },
          { title: 'Opened', dataIndex: 'openCount', width: 90 },
          { title: 'Device', dataIndex: 'deviceName', render: (v: string) => v || '—' },
          { title: 'IP', dataIndex: 'ipAddress', render: (v: string) => v || '—' },
          {
            title: 'Started',
            dataIndex: 'startedAt',
            render: (v: string) => formatAppDateTime(v),
          },
          {
            title: 'Last seen',
            dataIndex: 'lastHeartbeatAt',
            render: (v: string) => formatAppDateTime(v),
          },
          {
            title: 'Session',
            render: (_: unknown, r: any) =>
              r.live ? <Tag color="green">Active</Tag> : r.endReason || 'Ended',
          },
        ]}
      />
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Logins
      </Typography.Title>
      <Table
        size="small"
        rowKey="id"
        dataSource={rows?.logins || []}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="No login history yet." /> }}
        columns={[
          { title: 'Student', render: (_: unknown, r: any) => `${r.name || '—'} (${r.email})` },
          {
            title: 'Login',
            dataIndex: 'loggedInAt',
            render: (v: string) => formatAppDateTime(v),
          },
          {
            title: 'Last seen',
            dataIndex: 'lastSeenAt',
            render: (v: string) => formatAppDateTime(v),
          },
          {
            title: 'Logout',
            dataIndex: 'loggedOutAt',
            render: (v: string) => formatAppDateTime(v),
          },
          {
            title: 'Duration',
            dataIndex: 'secondsActive',
            render: (v: number) => formatDuration(v),
          },
          { title: 'Device', dataIndex: 'deviceName', render: (v: string) => v || '—' },
          { title: 'IP', dataIndex: 'ipAddress', render: (v: string) => v || '—' },
        ]}
      />
    </Card>
  );
}
