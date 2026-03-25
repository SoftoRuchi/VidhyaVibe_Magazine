'use client';
import {
  UserOutlined,
  ReadOutlined,
  FileTextOutlined,
  RiseOutlined,
  PlusOutlined,
  TeamOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { Card, Col, List, Row, Tag, Button, Spin } from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../lib/api';

export default function DashboardIndex() {
  const [summary, setSummary] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .get('/admin/dashboard/summary')
      .then((r) => setSummary(r.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const totalUsers = summary?.totalUsers ?? 0;
  const activeMagazines = summary?.totalMagazines ?? 0;
  const totalSubscriptions = summary?.totalSubscriptions ?? 0;
  const monthlyRevenue = (summary?.totalRevenueCents ?? 0) / 100;

  const kpis = [
    {
      label: 'TOTAL USERS',
      value: totalUsers,
      gradient: 'linear-gradient(135deg, rgba(34,197,94,0.85) 0%, rgba(16,185,129,0.70) 100%)',
      icon: <UserOutlined />,
    },
    {
      label: 'ACTIVE MAGAZINES',
      value: activeMagazines,
      gradient: 'linear-gradient(135deg, rgba(255,176,0,0.80) 0%, rgba(245,158,11,0.65) 100%)',
      icon: <ReadOutlined />,
    },
    {
      label: 'TOTAL SUBSCRIPTIONS',
      value: totalSubscriptions,
      gradient: 'linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(37,99,235,0.70) 100%)',
      icon: <FileTextOutlined />,
    },
    {
      label: 'MONTHLY REVENUE',
      value: monthlyRevenue.toFixed(2),
      gradient: 'linear-gradient(135deg, rgba(139,92,246,0.85) 0%, rgba(124,58,237,0.70) 100%)',
      icon: <RiseOutlined />,
    },
  ];

  const [recentActivity, setRecentActivity] = React.useState<
    { icon: React.ReactNode; text: string; time: string; bg: string }[]
  >([]);

  const timeAgo = (d: any) => {
    const ms = Date.now() - new Date(d).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '-';
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
    const day = Math.floor(hr / 24);
    return `${day} day${day === 1 ? '' : 's'} ago`;
  };

  const formatMoney = (amount: any, currency: string) => {
    const num = amount == null ? null : Number(amount);
    if (num == null || Number.isNaN(num)) return '-';
    const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
    return sym ? `${sym}${num.toFixed(2)}` : `${num.toFixed(2)} ${currency || ''}`.trim();
  };

  React.useEffect(() => {
    const run = async () => {
      try {
        const [usersRes, magsRes, ordersRes] = await Promise.all([
          api.get('/admin/users'),
          api.get('/admin/magazines/list'),
          api.get('/admin/payments/orders'),
        ]);

        const users = usersRes.data || [];
        const magazines = magsRes.data || [];
        const subscriptionOrders = ordersRes.data?.subscriptionOrders || [];
        const editionOrders = ordersRes.data?.editionOrders || [];

        const events: { createdAt: any; icon: React.ReactNode; text: string }[] = [];

        const latestUser = users[0];
        if (latestUser?.createdAt) {
          events.push({
            createdAt: latestUser.createdAt,
            icon: <UserOutlined />,
            text: `${latestUser.name || latestUser.email || 'User'} registered`,
          });
        }

        const latestMag = magazines[0];
        if (latestMag?.createdAt) {
          events.push({
            createdAt: latestMag.createdAt,
            icon: <ReadOutlined />,
            text: `${latestMag.title} added`,
          });
        }

        const secondMag = magazines[1];
        if (secondMag?.createdAt) {
          events.push({
            createdAt: secondMag.createdAt,
            icon: <ReadOutlined />,
            text: `${secondMag.title} updated`,
          });
        }

        const latestSubOrder = subscriptionOrders[0];
        if (latestSubOrder?.createdAt) {
          // subscription orders expose `finalAmount` already in major currency units.
          const amount =
            latestSubOrder.finalAmount != null ? latestSubOrder.finalAmount : latestSubOrder.amount;
          const currency = latestSubOrder.currency;
          events.push({
            createdAt: latestSubOrder.createdAt,
            icon: <FilePdfOutlined />,
            text: `New subscription payment (${formatMoney(amount, currency)})`,
          });
        }

        const latestEditionOrder = editionOrders[0];
        if (latestEditionOrder?.createdAt) {
          const amount =
            latestEditionOrder.amountCents != null
              ? latestEditionOrder.amountCents / 100
              : latestEditionOrder.amountCents;
          const currency = latestEditionOrder.currency;
          events.push({
            createdAt: latestEditionOrder.createdAt,
            icon: <ShoppingCartOutlined />,
            text: `New edition purchase payment (${formatMoney(amount, currency)})`,
          });
        }

        events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setRecentActivity(
          events.slice(0, 4).map((e) => ({
            icon: e.icon,
            text: e.text,
            time: timeAgo(e.createdAt),
            bg: '#f3f4f6',
          })),
        );
      } catch {
        setRecentActivity([]);
      }
    };

    run();
  }, []);

  const quickActions = [
    {
      href: '/admin/magazines/new',
      label: 'Add New Magazine',
      icon: <PlusOutlined />,
      bg: '#1d4ed8',
    },
    { href: '/admin/users', label: 'View Users', icon: <UserOutlined />, bg: '#0ea5e9' },
    {
      href: '/admin/plans',
      label: 'View Plans & Pricing',
      icon: <DollarOutlined />,
      bg: '#8b5cf6',
    },
    {
      href: '/admin/subscriptions',
      label: 'Manage Subscribers',
      icon: <TeamOutlined />,
      bg: '#22c55e',
    },
    { href: '/admin/readers', label: 'Manage Readers', icon: <FileTextOutlined />, bg: '#f97316' },
    {
      href: '/admin/orders',
      label: 'View Orders & Payments',
      icon: <ShoppingCartOutlined />,
      bg: '#ef4444',
    },
  ];

  return (
    <main style={{ padding: 24 }}>
      <div
        style={{
          background:
            'radial-gradient(circle at 10% 20%, rgba(24,144,255,0.20), transparent 35%), radial-gradient(circle at 90% 0%, rgba(122,70,255,0.18), transparent 30%), rgba(255,255,255,0.76)',
          border: '1px solid rgba(0,0,0,0.04)',
          borderRadius: 22,
          padding: 20,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>Dashboard Overview</div>
          <Tag
            style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', fontWeight: 700 }}
          >
            {new Date().toLocaleDateString()}
          </Tag>
        </div>

        {loading ? (
          <div style={{ padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {kpis.map((k) => (
                <Col key={k.label} xs={24} sm={12} lg={6}>
                  <Card
                    bordered={false}
                    style={{
                      borderRadius: 16,
                      background: k.gradient,
                      boxShadow: '0 10px 22px rgba(0,0,0,0.08)',
                      color: '#fff',
                    }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 0.4,
                            opacity: 0.92,
                          }}
                        >
                          {k.label}
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{k.value}</div>
                      </div>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          background: 'rgba(255,255,255,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                        }}
                      >
                        {k.icon}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Card
                  title={<span style={{ fontWeight: 900, color: '#0f172a' }}>Recent Activity</span>}
                  style={{ borderRadius: 18 }}
                  bodyStyle={{ padding: 16 }}
                >
                  <List
                    itemLayout="horizontal"
                    dataSource={recentActivity}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f0f2f5' }}>
                        <List.Item.Meta
                          avatar={
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 14,
                                background: item.bg,
                                color: '#0f172a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {item.icon}
                            </div>
                          }
                          title={
                            <span style={{ fontWeight: 700, color: '#111827' }}>{item.text}</span>
                          }
                        />
                        <div
                          style={{
                            marginLeft: 'auto',
                            color: '#6b7280',
                            fontSize: 12,
                            paddingTop: 4,
                          }}
                        >
                          {item.time}
                        </div>
                      </List.Item>
                    )}
                  />
                  {recentActivity.length === 0 && (
                    <div style={{ color: '#9ca3af', fontSize: 13, paddingTop: 8 }}>
                      No recent activity.
                    </div>
                  )}
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card
                  title={<span style={{ fontWeight: 900, color: '#0f172a' }}>Quick Actions</span>}
                  style={{ borderRadius: 18 }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Row gutter={[12, 12]}>
                    {quickActions.map((a) => (
                      <Col xs={24} sm={12} md={8} key={a.label}>
                        <Link href={a.href} style={{ textDecoration: 'none' }}>
                          <Button
                            block
                            style={{
                              height: 92,
                              borderRadius: 16,
                              border: '1px solid rgba(0,0,0,0.06)',
                              background: '#fff',
                              boxShadow: '0 10px 22px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 14,
                                  background: a.bg,
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {a.icon}
                              </div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontSize: 12,
                                  color: '#0f172a',
                                  textAlign: 'center',
                                }}
                              >
                                {a.label}
                              </div>
                            </div>
                          </Button>
                        </Link>
                      </Col>
                    ))}
                  </Row>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </div>
    </main>
  );
}
