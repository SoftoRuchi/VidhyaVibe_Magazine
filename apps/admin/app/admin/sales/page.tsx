'use client';

import { Button, Card, Popconfirm, Table, Tag, message } from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../lib/api';

export default function SalesAdminPage() {
  const [offers, setOffers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .get('/admin/sales/list')
      .then((r) => setOffers(r.data || []))
      .catch(() => message.error('Failed to load sales offers'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/sales/${id}`);
      message.success('Offer deleted');
      load();
    } catch {
      message.error('Delete failed');
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Sales & Offers"
        extra={
          <Link href="/admin/sales/new">
            <Button type="primary">New Offer</Button>
          </Link>
        }
      >
        <p style={{ color: '#64748b', marginBottom: 16 }}>
          Manage banner, deal cards, and benefit bullets shown on the public web app{' '}
          <code>/sales</code> page.
        </p>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={offers}
          columns={[
            { title: 'Order', dataIndex: 'sortOrder', width: 70 },
            {
              title: 'Type',
              dataIndex: 'type',
              width: 100,
              render: (t: string) => {
                const color = t === 'BANNER' ? 'red' : t === 'DEAL' ? 'green' : 'blue';
                return <Tag color={color}>{t}</Tag>;
              },
            },
            { title: 'Title', dataIndex: 'title' },
            { title: 'Badge', dataIndex: 'badge' },
            { title: 'Highlight', dataIndex: 'highlight' },
            {
              title: 'Active',
              dataIndex: 'active',
              width: 80,
              render: (v: boolean) => (v ? 'Yes' : 'No'),
            },
            {
              title: 'Actions',
              width: 160,
              render: (_: unknown, row: any) => (
                <span style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/admin/sales/${row.id}/edit`}>
                    <Button size="small">Edit</Button>
                  </Link>
                  <Popconfirm title="Delete this offer?" onConfirm={() => handleDelete(row.id)}>
                    <Button size="small" danger>
                      Delete
                    </Button>
                  </Popconfirm>
                </span>
              ),
            },
          ]}
        />
      </Card>
    </main>
  );
}
