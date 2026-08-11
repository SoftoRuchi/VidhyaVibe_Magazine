'use client';

import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ArrowLeftOutlined,
  DashboardOutlined,
  UserOutlined,
  ReadOutlined,
  LogoutOutlined,
  TeamOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  TagOutlined,
  PictureOutlined,
  AppstoreOutlined,
  MailOutlined,
  PercentageOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { Layout, Menu, theme, Button } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { clearAuthSession, getStoredRefreshToken } from '../lib/authStorage';
import magzineLogo from './images/logo_rmbg.png';

const { Sider, Content, Header, Footer } = Layout;

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute =
    pathname?.startsWith('/admin/login') || pathname === '/login' || pathname?.startsWith('/login');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  if (isLoginRoute) {
    return <>{children}</>;
  }

  const getSelectedKey = () => {
    if (!pathname) return 'dashboard';
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/magazines')) return 'magazines';
    if (pathname.includes('/age-groups')) return 'age-groups';
    if (pathname.includes('/plans')) return 'plans';
    if (pathname.includes('/subscriptions')) return 'subscriptions';
    if (pathname.includes('/readers')) return 'readers';
    if (pathname.includes('/orders')) return 'orders';
    if (pathname.includes('/sales')) return 'sales';
    if (pathname.includes('/posts')) return 'posts';
    if (pathname.includes('/email-settings')) return 'email-settings';
    if (pathname.includes('/coupons')) return 'coupons';
    if (pathname.includes('/activities')) return 'activities';
    return 'dashboard';
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/admin">Dashboard</Link>,
    },
    {
      key: 'magazines',
      icon: <ReadOutlined />,
      label: <Link href="/admin/magazines">Magazines</Link>,
    },
    {
      key: 'age-groups',
      icon: <AppstoreOutlined />,
      label: <Link href="/admin/age-groups">Age Groups</Link>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <Link href="/admin/users">Users</Link>,
    },
    {
      key: 'plans',
      icon: <DollarOutlined />,
      label: <Link href="/admin/plans">Plans & Pricing</Link>,
    },
    {
      key: 'coupons',
      icon: <PercentageOutlined />,
      label: <Link href="/admin/coupons">Coupons</Link>,
    },
    {
      key: 'sales',
      icon: <TagOutlined />,
      label: <Link href="/admin/sales">Sales & Offers</Link>,
    },
    {
      key: 'posts',
      icon: <PictureOutlined />,
      label: <Link href="/admin/posts">Posts & Carousel</Link>,
    },
    {
      key: 'activities',
      icon: <ExperimentOutlined />,
      label: <Link href="/admin/activities">Activities</Link>,
    },
    {
      key: 'subscriptions',
      icon: <TeamOutlined />,
      label: <Link href="/admin/subscriptions">Subscribers</Link>,
    },
    {
      key: 'readers',
      icon: <FileTextOutlined />,
      label: <Link href="/admin/readers">Readers</Link>,
    },
    {
      key: 'orders',
      icon: <ShoppingCartOutlined />,
      label: <Link href="/admin/orders">Purchase History</Link>,
    },
    {
      key: 'email-settings',
      icon: <MailOutlined />,
      label: <Link href="/admin/email-settings">Email Configuration</Link>,
    },
  ];

  const handleLogout = async () => {
    const refreshToken = getStoredRefreshToken();
    clearAuthSession();
    try {
      delete axios.defaults.headers.common['Authorization'];
    } catch {
      // ignore
    }

    try {
      await axios.post('/api/auth/logout', refreshToken ? { refresh_token: refreshToken } : {}, {
        withCredentials: true,
      });
    } catch {
      // ignore logout API errors
    }
    window.location.href = '/admin/login';
  };

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={250}
        collapsedWidth={88}
        style={{
          background: 'linear-gradient(180deg, #0a2746 0%, #08213b 48%, #061b32 100%)',
          paddingTop: 12,
          height: '100vh',
          overflow: 'hidden',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: '0 0 auto',
              margin: collapsed ? '0 8px 12px' : '0 12px 14px',
              minHeight: collapsed ? 56 : 72,
              padding: collapsed ? '8px 6px' : '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: '#f5eedd',
              borderRadius: 12,
              border: '1px solid rgba(184, 149, 106, 0.45)',
            }}
          >
            <Image
              src={magzineLogo}
              alt="VidhyaVibe Magazine Admin"
              style={{
                width: 'auto',
                height: collapsed ? 52 : 70,
                maxWidth: collapsed ? 68 : 210,
                objectFit: 'contain',
                background: 'transparent',
              }}
              priority
            />
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
            }}
            className="admin-sider-menu-scroll"
          >
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[getSelectedKey()]}
              items={menuItems}
              style={{ background: 'transparent', borderInlineEnd: 'none' }}
            />
          </div>

          <div
            style={{
              flex: '0 0 auto',
              borderTop: '1px solid rgba(255,255,255,0.14)',
              margin: collapsed ? '8px 10px 10px' : '10px 14px 12px',
              paddingTop: 10,
            }}
          >
            <Button
              type="text"
              onClick={handleLogout}
              icon={<LogoutOutlined />}
              style={{
                color: '#ff6b81',
                width: '100%',
                textAlign: 'left',
                justifyContent: collapsed ? 'center' : 'flex-start',
                height: 40,
                borderRadius: 10,
                paddingLeft: collapsed ? 0 : 10,
              }}
            >
              {collapsed ? '' : 'Logout'}
            </Button>
          </div>
        </div>
      </Sider>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        <Header
          style={{
            padding: 0,
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            height: 48,
            lineHeight: '48px',
            flex: '0 0 48px',
            borderBottom: '1px solid rgba(15,23,42,0.06)',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 2 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 48,
                height: 48,
              }}
            />
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.back()}
              style={{
                fontSize: '16px',
                width: 42,
                height: 42,
              }}
              title="Back"
            />
          </div>
        </Header>
        <Content
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            padding: '10px 12px',
          }}
        >
          {children}
        </Content>
        <Footer
          style={{
            flex: '0 0 auto',
            textAlign: 'center',
            fontSize: 12,
            color: '#94a3b8',
            background: colorBgContainer,
            borderTop: '1px solid rgba(15,23,42,0.06)',
            padding: '10px 0 14px',
            zIndex: 2,
          }}
        >
          Magazine Admin © {new Date().getFullYear()} - All rights reserved.
        </Footer>
      </Layout>
      <style jsx global>{`
        .ant-table-thead > tr > th {
          background: #4b5563 !important;
          color: #ffffff !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
        }

        .ant-table-tbody > tr > td {
          padding-top: 8px !important;
          padding-bottom: 8px !important;
        }

        /* Sidebar look (dashboard screenshot style) */
        .ant-menu-dark.ant-menu-root .ant-menu-item,
        .ant-menu-dark.ant-menu-root .ant-menu-submenu-title {
          margin: 4px 12px;
          border-radius: 999px;
          padding-left: 16px !important;
          height: 44px;
          display: flex;
          align-items: center;
          color: rgba(255, 255, 255, 0.86) !important;
        }

        .ant-menu-dark .ant-menu-item-selected,
        .ant-menu-dark .ant-menu-submenu-selected > .ant-menu-submenu-title {
          background: linear-gradient(
            90deg,
            rgba(115, 186, 255, 0.28) 0%,
            rgba(115, 186, 255, 0.14) 62%,
            rgba(115, 186, 255, 0.35) 100%
          ) !important;
          box-shadow:
            inset 0 0 0 1px rgba(156, 209, 255, 0.28),
            0 0 16px rgba(115, 186, 255, 0.22);
          color: #f2f8ff !important;
          font-weight: 700;
        }

        .ant-menu-dark .ant-menu-item-selected::after,
        .ant-menu-dark .ant-menu-submenu-selected > .ant-menu-submenu-title::after {
          border-right: none !important;
        }

        .admin-sider-menu-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
        }

        .admin-sider-menu-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .admin-sider-menu-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.28);
          border-radius: 999px;
        }

        .admin-sider-menu-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </Layout>
  );
};

export default DashboardLayout;
