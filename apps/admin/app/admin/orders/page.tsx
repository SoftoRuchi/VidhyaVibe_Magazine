'use client';
import { Card, Table, Tag, Button, Spin, message, Collapse } from 'antd';
import React from 'react';
import api from '../../../lib/api';

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
      <Card title="Payment Proofs Pending Verification">
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
                        render: (d: any) => (d ? new Date(d).toLocaleString() : '-'),
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
                        render: (d: any) => (d ? new Date(d).toLocaleString() : '-'),
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

      <Card title="All Orders">
        <Collapse
          defaultActiveKey={['subscriptionOrders']}
          items={[
            {
              key: 'subscriptionOrders',
              label: 'Subscription Orders',
              children: (
                <Table
                  rowKey="id"
                  dataSource={data.subscriptionOrders}
                  size="small"
                  pagination={{
                    pageSize: PAGE_SIZE,
                    current: subscriptionOrdersPage,
                  }}
                  onChange={(pagination) => setSubscriptionOrdersPage(pagination.current || 1)}
                  columns={[
                    {
                      title: 'S/N',
                      key: 'serial',
                      width: 70,
                      render: (_: any, __: any, index: number) =>
                        (subscriptionOrdersPage - 1) * PAGE_SIZE + index + 1,
                    },
                    { title: 'User', dataIndex: 'userEmail' },
                    { title: 'Magazine', dataIndex: 'magazineTitle' },
                    { title: 'Plan', dataIndex: 'planName' },
                    {
                      title: 'Amount',
                      key: 'amt',
                      render: (_: any, r: any) =>
                        r.finalCents ? `${(r.finalCents / 100).toFixed(2)} ${r.currency}` : '-',
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      render: (s: any) => (
                        <Tag
                          color={s === 'PAID' ? 'green' : s === 'PENDING' ? 'orange' : 'default'}
                        >
                          {s}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Created',
                      dataIndex: 'createdAt',
                      render: (d: any) => (d ? new Date(d).toLocaleString() : '-'),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'editionOrders',
              label: 'Edition Orders',
              children: (
                <Table
                  rowKey="id"
                  dataSource={data.editionOrders}
                  size="small"
                  pagination={{
                    pageSize: PAGE_SIZE,
                    current: editionOrdersPage,
                  }}
                  onChange={(pagination) => setEditionOrdersPage(pagination.current || 1)}
                  columns={[
                    {
                      title: 'S/N',
                      key: 'serial',
                      width: 70,
                      render: (_: any, __: any, index: number) =>
                        (editionOrdersPage - 1) * PAGE_SIZE + index + 1,
                    },
                    { title: 'User', dataIndex: 'userEmail' },
                    { title: 'Magazine', dataIndex: 'magazineTitle' },
                    {
                      title: 'Edition',
                      key: 'ed',
                      render: (_: any, r: any) => (r.volume ? `Vol ${r.volume}` : r.editionId),
                    },
                    {
                      title: 'Amount',
                      key: 'amt',
                      render: (_: any, r: any) =>
                        r.amountCents ? `${(r.amountCents / 100).toFixed(2)} ${r.currency}` : '-',
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      render: (s: any) => (
                        <Tag
                          color={s === 'PAID' ? 'green' : s === 'PENDING' ? 'orange' : 'default'}
                        >
                          {s}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Created',
                      dataIndex: 'createdAt',
                      render: (d: any) => (d ? new Date(d).toLocaleString() : '-'),
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
