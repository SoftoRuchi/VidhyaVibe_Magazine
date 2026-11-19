'use client';

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  MailOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
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
import type { MenuProps } from 'antd';
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
  subjectId?: number;
  subjectName: string;
  courseName: string;
  accessModel: string;
  seatCount: number;
  assignedSeats: number;
  liveReaders: number;
  purchaseCode: string;
  status: string;
  notes?: string | null;
  amount?: number | null;
  discountPct?: number | null;
  paymentStatus?: string | null;
};

type Member = {
  id: number;
  name: string;
  email: string;
  role: string;
  className?: string | null;
  rollNumber?: string | null;
};

type SubjectOpt = {
  id: number;
  label: string;
  bookBankPrice?: number | null;
  libraryPrice?: number | null;
  discountPct?: number | null;
};

function applyPct(list?: number | null, pct?: number | null) {
  if (list == null || !Number.isFinite(Number(list))) return null;
  const cut = Number(pct);
  if (!Number.isFinite(cut) || cut <= 0) return Number(list);
  return Math.round(Number(list) * (1 - Math.min(100, cut) / 100) * 100) / 100;
}

function rupees(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function AdminInstituteDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const id = Number(params?.id);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState(search.get('tab') || 'licenses');
  const [lotOpen, setLotOpen] = React.useState(false);
  const [lotEditing, setLotEditing] = React.useState<Lot | null>(null);
  const [studentOpen, setStudentOpen] = React.useState<Lot | null>(null);
  const [memberOpen, setMemberOpen] = React.useState(false);
  const [individualOpen, setIndividualOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [subjects, setSubjects] = React.useState<SubjectOpt[]>([]);
  const [lotForm] = Form.useForm();
  const [lotEditForm] = Form.useForm();
  const [studentForm] = Form.useForm();
  const [memberForm] = Form.useForm();
  const [individualForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const lotSubjectId = Form.useWatch('subjectId', lotForm);
  const lotModel = Form.useWatch('accessModel', lotForm);
  const lotSeats = Form.useWatch('seatCount', lotForm);
  const lotExtraPct = Form.useWatch('discountPct', lotForm);
  const editLotModel = Form.useWatch('accessModel', lotEditForm);
  const editLotSeats = Form.useWatch('seatCount', lotEditForm);
  const editLotExtraPct = Form.useWatch('discountPct', lotEditForm);
  const lotBook = subjects.find((s) => s.id === lotSubjectId);
  const lotListUnit = lotModel === 'LIBRARY' ? lotBook?.libraryPrice : lotBook?.bookBankPrice;
  const lotCatalogUnit = applyPct(lotListUnit, lotBook?.discountPct);
  const lotUnit = applyPct(lotCatalogUnit, lotExtraPct);
  const lotListTotal =
    lotListUnit != null && lotSeats
      ? Math.round(Number(lotListUnit) * Number(lotSeats) * 100) / 100
      : null;
  const lotTotal =
    lotUnit != null && lotSeats
      ? Math.round(Number(lotUnit) * Number(lotSeats) * 100) / 100
      : null;
  const lotPerLabel = lotModel === 'LIBRARY' ? 'concurrent seat' : 'student';
  const hasCatalogCut =
    lotListUnit != null && lotCatalogUnit != null && lotCatalogUnit < lotListUnit;
  const hasExtraCut = lotCatalogUnit != null && lotUnit != null && lotUnit < lotCatalogUnit;
  const editLotBook = subjects.find((s) => s.id === lotEditing?.subjectId);
  const editLotListUnit =
    (editLotModel || lotEditing?.accessModel) === 'LIBRARY'
      ? editLotBook?.libraryPrice
      : editLotBook?.bookBankPrice;
  const editLotCatalogUnit = applyPct(editLotListUnit, editLotBook?.discountPct);
  const editLotUnit = applyPct(editLotCatalogUnit, editLotExtraPct);
  const editLotListTotal =
    editLotListUnit != null && editLotSeats
      ? Math.round(Number(editLotListUnit) * Number(editLotSeats) * 100) / 100
      : null;
  const editLotTotal =
    editLotUnit != null && editLotSeats
      ? Math.round(Number(editLotUnit) * Number(editLotSeats) * 100) / 100
      : null;
  const editHasCatalogCut =
    editLotListUnit != null &&
    editLotCatalogUnit != null &&
    editLotCatalogUnit < editLotListUnit;
  const editHasExtraCut =
    editLotCatalogUnit != null && editLotUnit != null && editLotUnit < editLotCatalogUnit;
  const editLotPerLabel =
    (editLotModel || lotEditing?.accessModel) === 'LIBRARY' ? 'concurrent seat' : 'student';

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
          if (r.data?.emailed) {
            message.success(`License created. Payment QR and link emailed to ${r.data.payEmail}.`);
          }
          if (r.data?.emailWarning) {
            message.warning(r.data.emailWarning);
          } else if (!r.data?.emailed) {
            message.success(`License created. Code ${r.data.purchaseCode}`);
          }
          setLotOpen(false);
          lotForm.resetFields();
          load();
        })
        .catch((e) =>
          message.error(e.response?.data?.message || e.response?.data?.error || 'Failed'),
        );
    });
  };

  const openLotModal = () => {
    lotForm.setFieldsValue({
      accessModel: 'BOOK_BANK',
      seatCount: 60,
      sendPaymentEmail: true,
      payEmail: data?.email || '',
    });
    setLotOpen(true);
  };

  const sendLotPayment = (lotId: number) => {
    api
      .post(`/admin/institutes/${id}/lots/${lotId}/payment-email`, {
        payEmail: data?.email || undefined,
      })
      .then((r) => {
        if (r.data?.emailed) message.success(`Payment QR and link emailed to ${r.data.to}.`);
        if (r.data?.emailWarning) message.warning(r.data.emailWarning);
        if (!r.data?.emailed && !r.data?.emailWarning)
          message.warning(
            r.data?.detail === 'not_configured'
              ? 'Email is not configured. Set it on Admin → Email Configuration.'
              : 'Could not send the payment email.',
          );
        load();
      })
      .catch((e) =>
        message.error(e.response?.data?.message || e.response?.data?.error || 'Failed'),
      );
  };

  const markLotPaid = (lotId: number) => {
    api
      .post(`/admin/institutes/${id}/lots/${lotId}/mark-paid`)
      .then(() => {
        message.success('Marked as paid.');
        load();
      })
      .catch(() => message.error('Could not mark as paid'));
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

  const openEditLot = (lot: Lot) => {
    setLotEditing(lot);
    lotEditForm.setFieldsValue({
      accessModel: lot.accessModel,
      seatCount: lot.seatCount,
      discountPct: lot.discountPct ?? undefined,
      notes: lot.notes || '',
    });
  };

  const saveLot = () => {
    if (!lotEditing) return;
    lotEditForm.validateFields().then((values) => {
      api
        .put(`/admin/institutes/${id}/lots/${lotEditing.id}`, values)
        .then(() => {
          message.success('License updated');
          setLotEditing(null);
          load();
        })
        .catch((e) =>
          message.error(e.response?.data?.message || e.response?.data?.error || 'Update failed'),
        );
    });
  };

  const lotMenu = (r: Lot): MenuProps['items'] => {
    const items: MenuProps['items'] = [];
    if (r.accessModel === 'BOOK_BANK') {
      items.push({
        key: 'students',
        label: 'Enter students',
        icon: <UserAddOutlined />,
        onClick: () => setStudentOpen(r),
      });
    }
    items.push(
      {
        key: 'copy',
        label: 'Copy code',
        icon: <CopyOutlined />,
        onClick: () => copyCode(r.purchaseCode),
      },
      {
        key: 'edit',
        label: 'Edit',
        icon: <EditOutlined />,
        onClick: () => openEditLot(r),
      },
    );
    if (r.amount != null) {
      items.push({
        key: 'pay',
        label: 'Send payment',
        icon: <MailOutlined />,
        onClick: () => sendLotPayment(r.id),
      });
    }
    if (r.paymentStatus !== 'PAID' && r.amount != null) {
      items.push({
        key: 'mark-paid',
        label: 'Mark paid',
        onClick: () => markLotPaid(r.id),
      });
    }
    items.push({
      key: 'status',
      label: r.status === 'ACTIVE' ? 'Cancel' : 'Activate',
      danger: r.status === 'ACTIVE',
      onClick: () => {
        Modal.confirm({
          title: r.status === 'ACTIVE' ? 'Cancel this license?' : 'Activate this license?',
          okText: r.status === 'ACTIVE' ? 'Cancel license' : 'Activate',
          okButtonProps: r.status === 'ACTIVE' ? { danger: true } : undefined,
          onOk: () => setLotStatus(r.id, r.status === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE'),
        });
      },
    });
    return items;
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openLotModal}>
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
                      <Button type="primary" onClick={openLotModal}>
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
                        title: 'Amount',
                        width: 140,
                        render: (_: unknown, r: Lot) =>
                          r.amount != null ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{rupees(r.amount)}</div>
                              {r.discountPct ? (
                                <div style={{ color: '#667085', fontSize: 12 }}>
                                  {r.discountPct}% extra off
                                </div>
                              ) : null}
                              {r.paymentStatus === 'PAID' ? (
                                <Tag color="green">Paid</Tag>
                              ) : r.paymentStatus === 'OFFLINE' ? (
                                <Tag>Offline</Tag>
                              ) : r.paymentStatus === 'UNPAID' || r.amount != null ? (
                                <Tag color="orange">Awaiting payment</Tag>
                              ) : null}
                            </div>
                          ) : (
                            '—'
                          ),
                      },
                      {
                        title: 'Purchase code',
                        dataIndex: 'purchaseCode',
                        render: (v: string) => <code>{v}</code>,
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
                        width: 72,
                        align: 'right' as const,
                        render: (_: unknown, r: Lot) => (
                          <Dropdown
                            menu={{ items: lotMenu(r) }}
                            trigger={['click']}
                            placement="bottomRight"
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<MoreOutlined style={{ fontSize: 18 }} />}
                              aria-label="License actions"
                            />
                          </Dropdown>
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
          initialValues={{ accessModel: 'BOOK_BANK', seatCount: 60, sendPaymentEmail: true }}
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
              options={subjects.map((s) => {
                const list = lotModel === 'LIBRARY' ? s.libraryPrice : s.bookBankPrice;
                const sale = applyPct(list, s.discountPct);
                let priceBit = ' · no list price';
                if (sale != null && list != null && sale < list) {
                  priceBit = ` · ${rupees(sale)} (${s.discountPct}% off)`;
                } else if (sale != null) {
                  priceBit = ` · ${rupees(sale)}`;
                }
                return { value: s.id, label: `${s.label}${priceBit}` };
              })}
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
          <Form.Item
            name="discountPct"
            label="Extra discount on this purchase (%)"
            extra="Optional. Stacks on the book’s catalog discount."
          >
            <InputNumber min={0} max={100} step={1} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              background: '#f6f8fb',
              border: '1px solid #e6ebf2',
              borderRadius: 8,
            }}
          >
            {!lotBook ? (
              <div style={{ color: '#667085' }}>Select a book to see list price and the charge.</div>
            ) : lotListUnit == null ? (
              <div style={{ color: '#b42318' }}>
                No {lotModel === 'LIBRARY' ? 'library' : 'book bank'} list price on this book yet.
                Set it on Courses → this subject.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: '#667085' }}>List price / {lotPerLabel}</span>
                  <span
                    style={
                      hasCatalogCut || hasExtraCut
                        ? { color: '#98a2b3', textDecoration: 'line-through' }
                        : { fontWeight: 600 }
                    }
                  >
                    {rupees(lotListUnit)}
                  </span>
                </div>
                {hasCatalogCut ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: '#667085' }}>
                      After catalog {lotBook.discountPct}% off
                    </span>
                    <span
                      style={hasExtraCut ? { color: '#98a2b3', textDecoration: 'line-through' } : { fontWeight: 600 }}
                    >
                      {rupees(lotCatalogUnit as number)}
                    </span>
                  </div>
                ) : null}
                {hasExtraCut ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: '#667085' }}>After extra {lotExtraPct}% off</span>
                    <span style={{ fontWeight: 600 }}>{rupees(lotUnit as number)}</span>
                  </div>
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid #e6ebf2',
                    fontWeight: 700,
                  }}
                >
                  <span>
                    {lotSeats || 0} license{(lotSeats || 0) === 1 ? '' : 's'}
                  </span>
                  <span>
                    {lotListTotal != null && lotTotal != null && lotTotal < lotListTotal ? (
                      <>
                        <s style={{ color: '#98a2b3', marginRight: 8, fontWeight: 500 }}>
                          {rupees(lotListTotal)}
                        </s>
                        {rupees(lotTotal)}
                      </>
                    ) : lotTotal != null ? (
                      rupees(lotTotal)
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </>
            )}
          </div>
          <Form.Item name="notes" label="Notes">
            <Input placeholder="Optional, e.g. FY BCA 2026 batch" />
          </Form.Item>
          <Form.Item
            name="sendPaymentEmail"
            valuePropName="checked"
            extra="The college gets a UPI QR, UPI ID, and a page where they can pay by QR, UPI, or card (Razorpay if configured)."
          >
            <Checkbox>Email payment QR and link to the college</Checkbox>
          </Form.Item>
          <Form.Item
            name="payEmail"
            label="Send payment to"
            extra="Defaults to the institute email. Change it if accounts should receive the invoice."
          >
            <Input placeholder={data?.email || 'accounts@college.edu'} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Edit license — ${lotEditing?.subjectName || 'book'}`}
        open={!!lotEditing}
        onOk={saveLot}
        onCancel={() => setLotEditing(null)}
        okText="Save"
      >
        <p className="vv-course-lead" style={{ marginBottom: 12 }}>
          {lotEditing?.courseName}
          {lotEditing?.purchaseCode ? ` · ${lotEditing.purchaseCode}` : ''}
        </p>
        <Form form={lotEditForm} layout="vertical">
          <Form.Item name="accessModel" label="Access model">
            <Select
              disabled={(lotEditing?.assignedSeats || 0) > 0}
              options={[
                { value: 'BOOK_BANK', label: 'Book bank — named students, each gets a copy' },
                { value: 'LIBRARY', label: 'Library — concurrent seats for the class' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="seatCount"
            label="Number of licenses"
            extra={
              lotEditing?.assignedSeats
                ? `${lotEditing.assignedSeats} already assigned — cannot go below that.`
                : undefined
            }
            rules={[{ required: true, message: 'Enter the number of licenses' }]}
          >
            <InputNumber min={Math.max(1, lotEditing?.assignedSeats || 1)} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="discountPct"
            label="Extra discount on this purchase (%)"
            extra="Optional. Stacks on the book’s catalog discount."
          >
            <InputNumber min={0} max={100} step={1} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              background: '#f6f8fb',
              border: '1px solid #e6ebf2',
              borderRadius: 8,
            }}
          >
            {editLotListUnit == null ? (
              <div style={{ color: '#b42318' }}>
                No {(editLotModel || lotEditing?.accessModel) === 'LIBRARY' ? 'library' : 'book bank'}{' '}
                list price on this book yet.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>List ({editLotPerLabel})</span>
                  <span>{rupees(Number(editLotListUnit))}</span>
                </div>
                {editHasCatalogCut ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>Catalog {editLotBook?.discountPct}% off</span>
                    <span>{rupees(Number(editLotCatalogUnit))}</span>
                  </div>
                ) : null}
                {editHasExtraCut ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>Extra {Number(editLotExtraPct)}% off</span>
                    <span>{rupees(Number(editLotUnit))}</span>
                  </div>
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginTop: 8,
                    fontWeight: 600,
                  }}
                >
                  <span>Charged total</span>
                  <span>
                    {editLotListTotal != null &&
                    editLotTotal != null &&
                    editLotTotal < editLotListTotal ? (
                      <>
                        <s style={{ color: '#98a2b3', marginRight: 8, fontWeight: 500 }}>
                          {rupees(editLotListTotal)}
                        </s>
                        {rupees(editLotTotal)}
                      </>
                    ) : editLotTotal != null ? (
                      rupees(editLotTotal)
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </>
            )}
          </div>
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
