'use client';
import { Card, Table, Button, message } from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../../lib/api';

export default function CouponHistoryPage() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    api
      .get('/admin/coupons/usages')
      .then((r) => setRows(r.data || []))
      .catch(() => {
        message.error('Failed to load coupon history');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Coupon Usage History"
        extra={
          <Link href="/admin/coupons">
            <Button>Back to Coupons</Button>
          </Link>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: 'Used at',
              dataIndex: 'usedAt',
              render: (v) => (v ? new Date(v).toLocaleString() : '—'),
            },
            { title: 'Coupon', dataIndex: 'couponCode' },
            {
              title: 'User',
              key: 'user',
              render: (_, r) =>
                r.userName || r.userEmail
                  ? `${r.userName || '—'} (${r.userEmail || r.userPhone || r.userId})`
                  : '—',
            },
            {
              title: 'Magazine',
              dataIndex: 'magazineTitle',
              render: (v) => v || '—',
            },
            {
              title: 'Subscription',
              dataIndex: 'subscriptionId',
              render: (v) => (v != null ? `#${v}` : '—'),
            },
            {
              title: 'Paid',
              key: 'paid',
              render: (_, r) =>
                r.subscriptionPrice != null
                  ? `${r.subscriptionCurrency === 'INR' || !r.subscriptionCurrency ? '₹' : ''}${Number(r.subscriptionPrice).toFixed(2)}`
                  : '—',
            },
            {
              title: 'Discount',
              key: 'discount',
              render: (_, r) =>
                r.discountPct != null
                  ? `${r.discountPct}%`
                  : r.discountCents != null
                    ? `₹${r.discountCents}`
                    : '—',
            },
          ]}
        />
      </Card>
    </main>
  );
}
