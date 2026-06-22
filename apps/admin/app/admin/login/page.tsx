'use client';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Form, Input, Button, Typography, message, Alert } from 'antd';
import React from 'react';
import { adminLogin } from '../../../lib/adminLogin';

function readQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function LoginPage() {
  const [returnUrl, setReturnUrl] = React.useState('/admin');
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReturnUrl(readQueryParam('returnUrl') || '/admin');
    const error = readQueryParam('error');
    setAuthError(error);
    if (error === 'admin_required') {
      message.error('This account does not have admin access.');
    } else if (error === 'session_expired') {
      message.warning('Your session expired. Please sign in again.');
    }
  }, []);

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await adminLogin(values.email, values.password);
      window.location.href = returnUrl;
    } catch (e: any) {
      if (e?.message === 'admin_required') {
        message.error('This account is not an admin.');
        return;
      }
      message.error(e?.response?.data?.error || e?.message || 'Login failed');
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at 20% 10%, rgba(24,144,255,0.15), transparent 35%), radial-gradient(circle at 80% 0%, rgba(122, 70, 255,0.15), transparent 35%), #f5f7fb',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 22,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          <Typography.Title level={3} style={{ margin: '0 0 14px', fontSize: 18 }}>
            Sign in to Your Admin
          </Typography.Title>

          {authError === 'admin_required' && (
            <Alert
              type="error"
              showIcon
              message="Admin access required"
              description="Your account is not marked as admin. In the database run: UPDATE users SET isAdmin = 1 WHERE email = 'admin@gmail.com';"
              style={{ marginBottom: 14 }}
            />
          )}
          {authError === 'session_expired' && (
            <Alert
              type="warning"
              showIcon
              message="Session expired"
              description="Please sign in again to continue."
              style={{ marginBottom: 14 }}
            />
          )}

          <Form name="admin_login" layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="admin@gmail.com" size="large" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" size="large" block>
                Login
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </main>
  );
}
