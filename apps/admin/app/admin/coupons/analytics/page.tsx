'use client';
import { Card, Table, Button, message } from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../../lib/api';

export default function CouponsAnalytics() {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    api
      .get('/admin/dashboard/coupons/analytics')
      .then((r) => setRows(r.data.byCoupon || []))
      .catch(() => {
        message.error('Failed to load coupon analytics');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Coupons Analytics"
        extra={
          <Link href="/admin/coupons">
            <Button>Back to Coupons</Button>
          </Link>
        }
      >
        <Table
          loading={loading}
          dataSource={rows}
          rowKey="id"
          columns={[
            { title: 'Code', dataIndex: 'code' },
            {
              title: 'Discount',
              key: 'discount',
              render: (_, r) =>
                (r.discountPct ?? r.discount_pct) != null
                  ? `${r.discountPct ?? r.discount_pct}% off`
                  : (r.discountCents ?? r.discount_cents) != null
                    ? `₹${r.discountCents ?? r.discount_cents} off`
                    : '—',
            },
            { title: 'Uses', dataIndex: 'uses' },
          ]}
        />
      </Card>
    </main>
  );
}
