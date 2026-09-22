'use client';

import {
  BankOutlined,
  EditOutlined,
  EyeOutlined,
  LineChartOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import { useRouter } from 'next/navigation';
import React from 'react';
import api from '../../../lib/api';

type Institute = {
  id: number;
  name: string;
  code: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  status: string;
  memberCount?: number;
  lotCount?: number;
};

export default function AdminInstitutesPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<Institute[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Institute | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api
      .get('/admin/institutes')
      .then((r) => setRows(r.data || []))
      .catch(() => message.error('Failed to load institutes'))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.code, r.city, r.email, r.phone].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (row: Institute) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      email: row.email,
      phone: row.phone,
      city: row.city,
      status: row.status,
    });
    setOpen(true);
  };

  const save = () => {
    form.validateFields().then((values) => {
      setSaving(true);
      const req = editing
        ? api.put(`/admin/institutes/${editing.id}`, {
            ...values,
            status: values.status || editing.status,
          })
        : api.post('/admin/institutes', values);
      req
        .then(() => {
          message.success(editing ? 'Institute updated' : 'Institute created');
          setOpen(false);
          form.resetFields();
          setEditing(null);
          load();
        })
        .catch((e) => message.error(e.response?.data?.error || 'Save failed'))
        .finally(() => setSaving(false));
    });
  };

  const toggleStatus = (row: Institute) => {
    const next = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    api
      .put(`/admin/institutes/${row.id}`, {
        name: row.name,
        email: row.email,
        phone: row.phone,
        city: row.city,
        status: next,
      })
      .then(() => {
        message.success(next === 'ACTIVE' ? 'Institute activated' : 'Institute deactivated');
        load();
      })
      .catch((e) => message.error(e.response?.data?.error || 'Update failed'));
  };

  const totals = {
    institutes: rows.length,
    students: rows.reduce((n, r) => n + Number(r.memberCount || 0), 0),
    licenses: rows.reduce((n, r) => n + Number(r.lotCount || 0), 0),
    active: rows.filter((r) => r.status === 'ACTIVE').length,
  };

  return (
    <main className="vv-course-page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h1>
            <BankOutlined /> Book access
          </h1>
          <p className="vv-course-lead">
            Manage institutes, sell book-bank or library seats, and see who is reading. Use the{' '}
            <strong>Action</strong> column — you no longer need to click the institute name.
          </p>
        </div>
        <Space wrap>
          <Button icon={<LineChartOutlined />} onClick={() => router.push('/admin/book-activity')}>
            Book activity
          </Button>
          <Button onClick={() => router.push('/admin/live-seats')}>Live seats</Button>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreate}>
            Add institute
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat label="Institutes" value={totals.institutes} />
        <Stat label="Active" value={totals.active} />
        <Stat label="Students" value={totals.students} />
        <Stat label="License lots" value={totals.licenses} />
      </div>

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search by name, code, city, or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 420, marginBottom: 16 }}
      />

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={filtered}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty description="No institutes yet. Add one to start Book Bank or Library licenses." />
              ),
            }}
            columns={[
              {
                title: 'Institute',
                render: (_: unknown, r: Institute) => (
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ color: '#667085', fontSize: 12 }}>{r.email || 'No email'}</div>
                  </div>
                ),
              },
              { title: 'Code', dataIndex: 'code', width: 120 },
              { title: 'City', dataIndex: 'city', render: (v: string) => v || '—', width: 120 },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 110,
                render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v}</Tag>,
              },
              {
                title: 'Students',
                dataIndex: 'memberCount',
                width: 100,
                render: (v: number) => v || 0,
              },
              {
                title: 'Licenses',
                dataIndex: 'lotCount',
                width: 100,
                render: (v: number) => v || 0,
              },
              {
                title: 'Action',
                key: 'action',
                width: 280,
                render: (_: unknown, r: Institute) => (
                  <Space wrap size={0}>
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => router.push(`/admin/institutes/${r.id}`)}
                    >
                      View
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      icon={<TeamOutlined />}
                      onClick={() => router.push(`/admin/institutes/${r.id}?tab=students`)}
                    >
                      Students
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(r)}
                    >
                      Edit
                    </Button>
                    <Popconfirm
                      title={
                        r.status === 'ACTIVE'
                          ? 'Deactivate this institute?'
                          : 'Activate this institute?'
                      }
                      onConfirm={() => toggleStatus(r)}
                    >
                      <Button type="link" size="small">
                        {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        title={editing ? 'Edit institute' : 'New institute'}
        open={open}
        okText={editing ? 'Save changes' : 'Create'}
        confirmLoading={saving}
        onOk={save}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Institute name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. VidhyaVibe Demo College" />
          </Form.Item>
          {editing ? null : (
            <Form.Item name="code" label="Code (optional)">
              <Input placeholder="Auto-generated if empty" />
            </Form.Item>
          )}
          <Form.Item name="email" label="Email">
            <Input placeholder="office@college.edu" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="9876543210" />
          </Form.Item>
          <Form.Item name="city" label="City">
            <Input placeholder="Pune" />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
      <div style={{ color: '#667085', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1f1f1f' }}>{value}</div>
    </Card>
  );
}
