'use client';

import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Form, Input, Button, Card, message } from 'antd';
import React, { useState } from 'react';
import { adminLogin } from '../../lib/adminLogin';

function readQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function LoginPage() {
  const [returnUrl, setReturnUrl] = useState('/admin');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setReturnUrl(readQueryParam('returnUrl') || '/admin');
  }, []);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await adminLogin(values.email, values.password);
      message.success('Login successful!');
      window.location.href = returnUrl;
    } catch (error: any) {
      if (error?.message === 'admin_required') {
        message.error('This account is not an admin.');
      } else {
        message.error(error?.response?.data?.error || 'Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        title={
          <div style={{ textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}>
            Magazine Admin Login
          </div>
        }
        style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      >
        <Form name="login" onFinish={onFinish} autoComplete="off" layout="vertical">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="admin@gmail.com" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Log In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
