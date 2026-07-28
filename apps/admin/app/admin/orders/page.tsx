'use client';
import { Card, Table, Tag, Button, Spin, message, Collapse } from 'antd';
import React from 'react';
import api from '../../../lib/api';

function buyerName(r: any) {
  return r.guestName || r.userName || '—';
}

function buyerEmail(r: any) {
  return r.guestEmail || r.userEmail || '—';
}

function buyerPhone(r: any) {
  return r.guestPhone || r.userPhone || '—';
}

function formatAmount(amount: number | null | undefined, currency?: string) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const cur = currency || 'INR';
  const prefix = cur === 'INR' ? '₹' : `${cur} `;
  return `${prefix}${Number(amount).toFixed(2)}`;
}

function formatDateTime(d: any) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrdersPage() {
  const [data, setData] = React.useState<{ subscriptionOrders: any[]; editionOrders: any[] }>({
    subscriptionOrders: [],
    editionOrders: [],
  });
  const [subscriptionProofs, setSubscriptionProofs] = React.useState<any[]>([]);
  const [editionProofs, setEditionProofs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const PAGE_SIZE = 10;
  const [subscriptionOrdersPage, setSubscriptionOrdersPage] = React.useState(1);
  const [editionOrdersPage, setEditionOrdersPage] = React.useState(1);

  const load = () => {
    setLoading(true);
    Promise.all([
      api
        .get('/admin/payments/orders')
        .then((r) => setData(r.data || { subscriptionOrders: [], editionOrders: [] })),
      api.get('/admin/payments/proofs/pending').then((r) => setSubscriptionProofs(r.data || [])),
      api.get('/admin/payments/edition-proofs/pending').then((r) => setEditionProofs(r.data || [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const verifySubscriptionProof = (id: number) => {
    api
      .post(`/admin/payments/proofs/${id}/verify`)
      .then(() => {
        message.success('Subscription order verified');
        load();
      })
      .catch((e: any) => message.error(e.response?.data?.message || 'Verify failed'));
  };

  const verifyEditionProof = (id: number) => {
    api
      .post(`/admin/payments/edition-proofs/${id}/verify`)
      .then(() => {
        message.success('Edition order verified');
        load();
      })
      .catch((e: any) => message.error(e.response?.data?.message || 'Verify failed'));
  };

  if (loading)
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );

  return (
    <main>
      <Card title="Payment Proofs Pending Verification" style={{ marginBottom: 16 }}>
        <Collapse
          defaultActiveKey={['subscription']}
          items={[
            {
              key: 'subscription',
              label: 'Subscription Proofs',
              children:
                subscriptionProofs.length > 0 ? (
                  <Table
                    rowKey="id"
                    dataSource={subscriptionProofs}
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: 'S/N',
                        key: 'serial',
                        width: 70,
                        render: (_: any, __: any, index: number) => index + 1,
                      },
                      { title: 'Order ID', dataIndex: 'order_id', width: 90 },
                      {
                        title: 'Amount',
                        dataIndex: 'final_cents',
                        render: (c: number) => (c ? `${(c / 100).toFixed(2)}` : '-'),
                      },
                      {
                        title: 'Created',
                        dataIndex: 'created_at',
                        render: (d: any) => formatDateTime(d),
                      },
                      {
                        title: 'Action',
                        render: (_: any, r: any) => (
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => verifySubscriptionProof(r.id)}
                          >
                            Verify
                          </Button>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <p style={{ color: '#888', margin: 0 }}>No pending subscription proofs.</p>
                ),
            },
            {
              key: 'edition',
              label: 'Edition Purchase Proofs',
              children:
                editionProofs.length > 0 ? (
                  <Table
                    rowKey="id"
                    dataSource={editionProofs}
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: 'S/N',
                        key: 'serial',
                        width: 70,
                        render: (_: any, __: any, index: number) => index + 1,
                      },
                      { title: 'Order ID', dataIndex: 'order_id', width: 90 },
                      { title: 'Edition ID', dataIndex: 'edition_id', width: 90 },
                      {
                        title: 'Amount',
                        dataIndex: 'amount_cents',
                        render: (c: number) => (c ? `${(c / 100).toFixed(2)}` : '-'),
                      },
                      {
                        title: 'Created',
                        dataIndex: 'created_at',
                        render: (d: any) => formatDateTime(d),
                      },
                      {
                        title: 'Action',
                        render: (_: any, r: any) => (
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => verifyEditionProof(r.id)}
                          >
                            Verify
                          </Button>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <p style={{ color: '#888', margin: 0 }}>No pending edition purchase proofs.</p>
                ),
            },
          ]}
        />
      </Card>

      <Card
        title="Purchase History"
        extra={
          <span style={{ color: '#666', fontSize: 13 }}>
            Buyer name, mobile, email · magazine · date &amp; time
          </span>
        }
      >
        <Collapse
          defaultActiveKey={['subscriptionOrders']}
          items={[
            {
              key: 'subscriptionOrders',
              label: 'Magazine Subscription Purchases',
              children: (
                <Table
                  rowKey="id"
                  dataSource={data.subscriptionOrders}
                  size="small"
                  scroll={{ x: 1100 }}
                  pagination={{
                    pageSize: PAGE_SIZE,
                    current: subscriptionOrdersPage,
                  }}
                  onChange={(pagination) => setSubscriptionOrdersPage(pagination.current || 1)}
                  columns={[
                    {
                      title: 'S/N',
                      key: 'serial',
                      width: 60,
                      fixed: 'left',
                      render: (_: any, __: any, index: number) =>
                        (subscriptionOrdersPage - 1) * PAGE_SIZE + index + 1,
                    },
                    {
                      title: 'Buyer Name',
                      key: 'buyerName',
                      width: 160,
                      render: (_: any, r: any) => buyerName(r),
                    },
                    {
                      title: 'Mobile',
                      key: 'buyerPhone',
                      width: 120,
                      render: (_: any, r: any) => buyerPhone(r),
                    },
                    {
                      title: 'Email',
                      key: 'buyerEmail',
                      width: 200,
                      render: (_: any, r: any) => buyerEmail(r),
                    },
                    {
                      title: 'Magazine',
                      dataIndex: 'magazineTitle',
                      width: 220,
                      render: (t: string) => t || '—',
                    },
                    {
                      title: 'Plan',
                      dataIndex: 'planName',
                      width: 140,
                      render: (t: string, r: any) =>
                        t ? `${t}${r.months ? ` (${r.months} mo)` : ''}` : '—',
                    },
                    {
                      title: 'Amount',
                      key: 'amt',
                      width: 110,
                      render: (_: any, r: any) =>
                        formatAmount(r.finalAmount ?? r.amount, r.currency),
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      width: 100,
                      render: (s: any) => (
                        <Tag
                          color={s === 'PAID' ? 'green' : s === 'PENDING' ? 'orange' : 'default'}
                        >
                          {s}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Purchase Date & Time',
                      dataIndex: 'createdAt',
                      width: 170,
                      render: (d: any) => formatDateTime(d),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'editionOrders',
              label: 'Edition Purchases',
              children: (
                <Table
                  rowKey="id"
                  dataSource={data.editionOrders}
                  size="small"
                  scroll={{ x: 1000 }}
                  pagination={{
                    pageSize: PAGE_SIZE,
                    current: editionOrdersPage,
                  }}
                  onChange={(pagination) => setEditionOrdersPage(pagination.current || 1)}
                  columns={[
                    {
                      title: 'S/N',
                      key: 'serial',
                      width: 60,
                      render: (_: any, __: any, index: number) =>
                        (editionOrdersPage - 1) * PAGE_SIZE + index + 1,
                    },
                    {
                      title: 'Buyer Name',
                      key: 'buyerName',
                      width: 160,
                      render: (_: any, r: any) => buyerName(r),
                    },
                    {
                      title: 'Mobile',
                      key: 'buyerPhone',
                      width: 120,
                      render: (_: any, r: any) => buyerPhone(r),
                    },
                    {
                      title: 'Email',
                      key: 'buyerEmail',
                      width: 200,
                      render: (_: any, r: any) => buyerEmail(r),
                    },
                    {
                      title: 'Magazine',
                      dataIndex: 'magazineTitle',
                      width: 200,
                      render: (t: string) => t || '—',
                    },
                    {
                      title: 'Edition',
                      key: 'ed',
                      width: 100,
                      render: (_: any, r: any) => (r.volume ? `Vol ${r.volume}` : r.editionId),
                    },
                    {
                      title: 'Amount',
                      key: 'amt',
                      width: 110,
                      render: (_: any, r: any) =>
                        r.amountCents != null
                          ? formatAmount(Number(r.amountCents) / 100, r.currency)
                          : '—',
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      width: 100,
                      render: (s: any) => (
                        <Tag
                          color={s === 'PAID' ? 'green' : s === 'PENDING' ? 'orange' : 'default'}
                        >
                          {s}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Purchase Date & Time',
                      dataIndex: 'createdAt',
                      width: 170,
                      render: (d: any) => formatDateTime(d),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </main>
  );
}
