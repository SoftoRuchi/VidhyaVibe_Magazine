'use client';
import { Card, Table, Tag, Select, Spin } from 'antd';
import React from 'react';
import api from '../../../lib/api';

export default function SubscriptionsPage() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>();

  const load = () => {
    setLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    api
      .get('/admin/subscriptions', { params })
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, [statusFilter]);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'User', key: 'user', render: (_: any, r: any) => r.userEmail || r.userName || '-' },
    { title: 'Magazine', dataIndex: 'magazineTitle' },
    { title: 'Plan', dataIndex: 'planName' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: any) => (
        <Tag color={s === 'ACTIVE' ? 'green' : s === 'CANCELLED' ? 'red' : 'default'}>{s}</Tag>
      ),
    },
    {
      title: 'Start',
      dataIndex: 'startsAt',
      render: (d: any) => (d ? new Date(d).toLocaleDateString() : '-'),
    },
    {
      title: 'End',
      dataIndex: 'endsAt',
      render: (d: any) => (d ? new Date(d).toLocaleDateString() : '-'),
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_: any, r: any) =>
        r.price != null ? `${Number(r.price).toFixed(2)} ${r.currency || 'USD'}` : '-',
    },
  ];

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Subscriptions"
        extra={
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            style={{ width: 160 }}
            onChange={(v) => setStatusFilter(v)}
          >
            <Select.Option value="ACTIVE">ACTIVE</Select.Option>
            <Select.Option value="PENDING">PENDING</Select.Option>
            <Select.Option value="CANCELLED">CANCELLED</Select.Option>
            <Select.Option value="EXPIRED">EXPIRED</Select.Option>
          </Select>
        }
      >
        {loading ? (
          <Spin />
        ) : (
          <Table rowKey="id" dataSource={rows} columns={columns} pagination={{ pageSize: 20 }} />
        )}
      </Card>
    </main>
  );
}
