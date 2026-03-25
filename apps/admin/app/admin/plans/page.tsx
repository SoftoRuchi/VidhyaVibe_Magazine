'use client';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Popconfirm,
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
      month: 1,
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (plan: any) => {
    setEditingId(plan.id);
    form.setFieldsValue({
      name: plan.name,
      month: plan.month ?? 1,
      active: plan.active !== false,
    });
    setModalOpen(true);
  };

  const deletePlan = (id: number) => {
    api
      .delete(`/admin/plans/${id}`)
      .then(() => {
        message.success('Plan deleted');
        load();
      })
      .catch((e: any) => message.error(e.response?.data?.error || 'Delete failed'));
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const month = Number(values.month ?? 1);
      const payload = {
        name: values.name,
        month,
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
    { title: 'Name', dataIndex: 'name' },
    {
      title: 'Month',
      dataIndex: 'month',
    },
    {
      title: 'Status',
      dataIndex: 'active',
      render: (a: any) => (a ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            <EditOutlined />
          </Button>

          <Popconfirm
            title="Delete this plan?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => deletePlan(Number(r.id))}
          >
            <Button type="link" size="small" danger>
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <main>
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
          <Form.Item name="month" label="Month" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="Status" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
