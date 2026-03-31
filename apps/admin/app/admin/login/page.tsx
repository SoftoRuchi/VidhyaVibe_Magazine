'use client';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Form, Input, Button, Typography, message } from 'antd';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const returnUrl = search.get('returnUrl') || '/admin';

  const onFinish = async (values: any) => {
    try {
      const res = await axios.post('/api/auth/login', values, { withCredentials: true });
      const access = res.data?.access_token;
      if (!access) {
        message.error('Login failed.');
        return;
      }
      localStorage.setItem('access_token', access);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      // Use full-page navigation so middleware sees the fresh httpOnly cookie
      // immediately in production deployments.
      window.location.href = returnUrl;
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Login failed');
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
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 22,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            width: '100%',
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <Typography.Title level={3} style={{ margin: 0, fontSize: 18 }}>
              Sign in to Your Admin
            </Typography.Title>
          </div>

          <Form name="admin_login" layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="Email Address" size="large" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: -6,
                marginBottom: 14,
              }}
            >
              <Typography.Link onClick={() => message.info('Forgot password flow not implemented')}>
                Forgot Password?
              </Typography.Link>
            </div>

            <Form.Item>
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
