'use client';
import { EditOutlined } from '@ant-design/icons';
import { Table, Button, Card, Space, Tag, message } from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../lib/api';
import { formatCouponDateTime } from '../../../lib/formatCouponDateTime';

export default function CouponsPage() {
  const [coupons, setCoupons] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    api
      .get('/admin/coupons/list')
      .then((r) => setCoupons(r.data || []))
      .catch(() => {
        message.error('Failed to load coupons');
        setCoupons([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Coupons"
        extra={
          <Space>
            <Link href="/admin/coupons/history">
              <Button>Usage History</Button>
            </Link>
            <Link href="/admin/coupons/analytics">
              <Button>Analytics</Button>
            </Link>
            <Link href="/admin/coupons/new">
              <Button type="primary">New Coupon</Button>
            </Link>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={coupons}
          columns={[
            { title: 'Code', dataIndex: 'code' },
            {
              title: 'Discount',
              key: 'discount',
              render: (_, r) =>
                r.discountPct != null
                  ? `${r.discountPct}% off`
                  : r.discountCents != null
                    ? `₹${r.discountCents} off`
                    : '—',
            },
            {
              title: 'Uses',
              dataIndex: 'useCount',
              render: (v) => Number(v || 0),
            },
            {
              title: 'Max uses',
              dataIndex: 'maxUses',
              render: (v) => (v != null ? v : '∞'),
            },
            {
              title: 'Active',
              dataIndex: 'active',
              render: (v) =>
                v ? <Tag color="green">Active</Tag> : <Tag color="default">Inactive</Tag>,
            },
            {
              title: 'Expires',
              dataIndex: 'expiresAt',
              render: (v) => formatCouponDateTime(v),
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 100,
              render: (_, r) => (
                <Link href={`/admin/coupons/${r.id}/edit`}>
                  <Button type="link" icon={<EditOutlined />} style={{ paddingInline: 0 }}>
                    Edit
                  </Button>
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </main>
  );
}
