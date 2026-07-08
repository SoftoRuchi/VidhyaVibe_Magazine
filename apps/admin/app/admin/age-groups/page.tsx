'use client';

import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';

type AgeGroup = {
  id: number;
  name: string;
  slug: string;
  minAge?: number | null;
  maxAge?: number | null;
  color?: string;
  sortOrder?: number;
  active?: boolean;
};

export default function AgeGroupsAdminPage() {
  const [groups, setGroups] = useState<AgeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api
      .get('/admin/age-groups')
      .then((r) => setGroups(r.data || []))
      .catch(() => message.error('Failed to load age groups'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    form.setFieldsValue({
      name: undefined,
      slug: undefined,
      minAge: undefined,
      maxAge: undefined,
      color: '#4ECDC4',
      sortOrder: (groups.length + 1) * 10,
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (group: AgeGroup) => {
    setEditingId(group.id);
    form.setFieldsValue({
      name: group.name,
      slug: group.slug,
      minAge: group.minAge,
      maxAge: group.maxAge,
      color: group.color || '#4ECDC4',
      sortOrder: group.sortOrder ?? 0,
      active: group.active !== false,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/age-groups/${id}`);
      message.success('Age group deleted');
      load();
    } catch (e: any) {
      message.error(e.response?.data?.message || e.response?.data?.error || 'Delete failed');
    }
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const color =
        typeof values.color === 'string'
          ? values.color
          : values.color?.toHexString?.() || '#4ECDC4';
      const payload = {
        name: values.name,
        slug: values.slug,
        minAge: values.minAge,
        maxAge: values.maxAge,
        color,
        sortOrder: values.sortOrder ?? 0,
        active: values.active !== false,
      };
      const req = editingId
        ? api.put(`/admin/age-groups/${editingId}`, payload)
        : api.post('/admin/age-groups', payload);
      req
        .then(() => {
          message.success(editingId ? 'Age group updated' : 'Age group created');
          setModalOpen(false);
          load();
        })
        .catch((e: any) => {
          message.error(e.response?.data?.error || 'Save failed');
        });
    });
  };

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Age Groups"
        extra={
          <Button type="primary" onClick={openCreate}>
            New Age Group
          </Button>
        }
      >
        <p style={{ color: '#64748b', marginBottom: 16 }}>
          Define age bands used to organize magazines on the public site. Assign a group when
          creating or editing a magazine.
        </p>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={groups}
          columns={[
            { title: 'Order', dataIndex: 'sortOrder', width: 70 },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Slug', dataIndex: 'slug', render: (s: string) => <code>{s}</code> },
            {
              title: 'Ages',
              width: 100,
              render: (_: unknown, r: AgeGroup) =>
                r.minAge != null && r.maxAge != null ? `${r.minAge}–${r.maxAge}` : '—',
            },
            {
              title: 'Color',
              dataIndex: 'color',
              width: 80,
              render: (c: string) => (
                <span
                  style={{
                    display: 'inline-block',
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: c || '#ccc',
                    border: '1px solid #ddd',
                  }}
                />
              ),
            },
            {
              title: 'Active',
              dataIndex: 'active',
              width: 80,
              render: (v: boolean) => (v !== false ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
            },
            {
              title: 'Actions',
              width: 120,
              render: (_: unknown, row: AgeGroup) => (
                <span style={{ display: 'flex', gap: 8 }}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                  <Popconfirm title="Delete this age group?" onConfirm={() => handleDelete(row.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingId ? 'Edit Age Group' : 'New Age Group'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Display name"
            rules={[{ required: true, message: 'Name is required' }]}
            extra='Shown on the site, e.g. "8-11"'
          >
            <Input placeholder="8-11" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="URL slug"
            extra="Used in links like /magazines/8-11. Leave blank to auto-generate from name."
          >
            <Input placeholder="8-11" />
          </Form.Item>
          <Form.Item name="minAge" label="Minimum age">
            <InputNumber min={0} max={99} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxAge" label="Maximum age">
            <InputNumber min={0} max={99} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="color" label="Card color">
            <ColorPicker showText format="hex" />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
