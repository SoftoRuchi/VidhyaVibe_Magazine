'use client';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  message,
} from 'antd';
import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api
      .get('/admin/plans')
      .then((r) => setPlans(r.data || []))
      .catch(() => setPlans([]))
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
      description: undefined,
      price: undefined,
      currency: 'INR',
      minMonths: 1,
      maxMonths: undefined,
      deliveryMode: 'BOTH',
      autoDispatch: true,
      dispatchFrequencyDays: undefined,
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (plan: any) => {
    setEditingId(plan.id);
    form.setFieldsValue({
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: plan.price != null ? plan.price : undefined,
      currency: plan.currency || 'INR',
      minMonths: plan.minMonths ?? 1,
      maxMonths: plan.maxMonths,
      deliveryMode: plan.deliveryMode || 'BOTH',
      autoDispatch: plan.autoDispatch !== false,
      dispatchFrequencyDays: plan.dispatchFrequencyDays,
      active: plan.active !== false,
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload = {
        name: values.name,
        slug: values.slug,
        description: values.description,
        price: Number(values.price),
        currency: values.currency || 'INR',
        minMonths: values.minMonths ?? 1,
        maxMonths: values.maxMonths || null,
        deliveryMode: values.deliveryMode || 'BOTH',
        autoDispatch: values.autoDispatch !== false,
        dispatchFrequencyDays: values.dispatchFrequencyDays || null,
        active: values.active !== false,
      };
      if (editingId) {
        api
          .put(`/admin/plans/${editingId}`, payload)
          .then(() => {
            message.success('Plan updated');
            setModalOpen(false);
            load();
          })
          .catch((e: any) => message.error(e.response?.data?.error || 'Update failed'));
      } else {
        api
          .post('/admin/plans', payload)
          .then(() => {
            message.success('Plan created');
            setModalOpen(false);
            load();
          })
          .catch((e: any) => message.error(e.response?.data?.error || 'Create failed'));
      }
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Slug', dataIndex: 'slug' },
    {
      title: 'Price',
      key: 'price',
      render: (_: any, r: any) =>
        r.price != null
          ? r.currency === 'INR'
            ? `₹${Number(r.price).toFixed(2)}`
            : `${Number(r.price).toFixed(2)} ${r.currency || 'USD'}`
          : '-',
    },
    {
      title: 'Months',
      key: 'months',
      render: (_: any, r: any) =>
        r.maxMonths ? `${r.minMonths || 1}-${r.maxMonths}` : (r.minMonths || 1).toString(),
    },
    { title: 'Delivery', dataIndex: 'deliveryMode' },
    {
      title: 'Active',
      dataIndex: 'active',
      render: (a: any) => (a ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => (
        <Button type="link" size="small" onClick={() => openEdit(r)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Subscription Plans"
        extra={
          <Button type="primary" onClick={openCreate}>
            New Plan
          </Button>
        }
      >
        <Table
          rowKey="id"
          dataSource={plans}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editingId ? 'Edit Plan' : 'New Plan'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Monthly Subscription" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Slug"
            rules={[{ required: true }]}
            extra="Unique identifier (e.g. monthly)"
          >
            <Input placeholder="e.g. monthly" disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="currency" label="Currency" initialValue="INR">
            <Select>
              <Select.Option value="INR">INR (₹)</Select.Option>
              <Select.Option value="USD">USD ($)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="price" label="Price" rules={[{ required: true }]}>
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              placeholder="e.g. 99 or 99.50"
            />
          </Form.Item>
          <Form.Item name="minMonths" label="Min Months">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxMonths" label="Max Months (optional)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="deliveryMode" label="Delivery Mode">
            <Select>
              <Select.Option value="ELECTRONIC">Electronic</Select.Option>
              <Select.Option value="PHYSICAL">Physical</Select.Option>
              <Select.Option value="BOTH">Both</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="autoDispatch" label="Auto Dispatch" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="dispatchFrequencyDays" label="Dispatch Frequency (days)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
