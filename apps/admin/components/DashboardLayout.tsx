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
} from '@ant-design/icons';
import { Layout, Menu, theme, Button } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import magzineLogo from './images/magzineLogo.png';

const { Sider, Content, Header, Footer } = Layout;

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname?.startsWith('/admin/login');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const getSelectedKey = () => {
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/magazines')) return 'magazines';
    if (pathname.includes('/plans')) return 'plans';
    if (pathname.includes('/subscriptions')) return 'subscriptions';
    if (pathname.includes('/readers')) return 'readers';
    if (pathname.includes('/orders')) return 'orders';
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
      label: <Link href="/admin/orders">Orders</Link>,
    },
  ];

  const handleLogout = async () => {
    // Clear local auth first so any in-flight requests stop using the old token.
    localStorage.removeItem('access_token');
    try {
      delete axios.defaults.headers.common['Authorization'];
    } catch {
      // ignore
    }

    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch (e) {
      // ignore logout API errors
    }
    window.location.href = '/admin/login';
  };

  if (isLoginRoute) {
    // Render login pages without sidebar/header chrome.
    return <>{children}</>;
  }

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
        }}
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              margin: collapsed ? '0 10px 8px' : '0 14px 10px',
              minHeight: 56,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 12,
                paddingLeft: collapsed ? 0 : 4,
              }}
            >
              <Image
                src={magzineLogo}
                alt="Magazine Admin"
                style={{
                  width: collapsed ? 40 : 50,
                  height: collapsed ? 40 : 50,
                  objectFit: 'contain',
                }}
                priority
              />

              {!collapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
                  <span
                    style={{
                      fontSize: 18,
                      letterSpacing: 1,
                      opacity: 0.95,
                      color: '#d8b46a',
                      textShadow: '0 1px 0 rgba(0,0,0,0.25)',
                    }}
                  >
                    MAGAZINE
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#f1d28a',
                      textShadow: '0 1px 0 rgba(0,0,0,0.25)',
                    }}
                  >
                    ADMIN
                  </span>
                </div>
              )}
            </div>
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={menuItems}
            style={{ background: 'transparent', flex: 1 }}
          />

          <div
            style={{
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
      `}</style>
    </Layout>
  );
};

export default DashboardLayout;
