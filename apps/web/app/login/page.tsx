'use client';

import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Card, Form, Input, Button, message } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React from 'react';
import loginImg from '../../components/images/login.png';
import { clearViewingContext } from '../../lib/viewingContext';

export default function LoginPage() {
  const [loading, setLoading] = React.useState(false);
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect');

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', values, { withCredentials: true });

      if (res.data.access_token) {
        localStorage.setItem('access_token', res.data.access_token);
        clearViewingContext();
        message.success('Logged in successfully');
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('show_post_login_setup', '1');
        }

        if (redirect) {
          window.location.href = redirect;
        } else {
          window.location.href = '/';
        }
      } else {
        message.error('Login failed. Invalid response from server.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (!error.response) {
        message.error('Cannot reach server. Ensure the backend is running on port 4001.');
        return;
      }
      const data = error.response?.data;
      const errCode = typeof data?.error === 'string' ? data.error : data?.error?.code;
      let errMsg = 'Login failed. Please try again.';
      if (errCode === 'invalid_credentials') {
        errMsg = 'Invalid email or password.';
      } else if (errCode === 'login_failed' && data?.details) {
        errMsg = data.details;
      } else if (data?.details) {
        errMsg = data.details;
      } else if (typeof data?.error === 'object' && data?.error?.message) {
        errMsg = data.error.message;
      } else if (data?.message) {
        errMsg = data.message;
      } else if (errCode) {
        errMsg = String(errCode);
      }
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '80vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1.25rem 0 2.25rem',
      }}
    >
      <div className="container" style={{ maxWidth: 920 }}>
        <Card
          style={{
            borderRadius: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.78)',
            border: '1px solid rgba(61,41,20,0.18)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
          }}
          bodyStyle={{ padding: '1.6rem 1.75rem' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
              gap: '1.5rem',
              alignItems: 'center',
            }}
          >
            {/* Left: illustration */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(61,41,20,0.14)',
              }}
            >
              <Image
                src={loginImg}
                alt="Login"
                width={360}
                height={420}
                priority
                style={{ width: '100%', maxWidth: 320, height: 'auto', objectFit: 'contain' }}
              />
            </div>

            {/* Right: form */}
            <div>
              <div style={{ marginBottom: '1.1rem' }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '2.05rem',
                    fontWeight: 800,
                    color: '#3d2914',
                    fontFamily: 'Georgia, serif',
                    letterSpacing: '0.2px',
                  }}
                >
                  Welcome Back
                </h1>
                <div
                  style={{
                    width: 180,
                    height: 3,
                    backgroundColor: '#3d2914',
                    borderRadius: 999,
                    marginTop: 8,
                    opacity: 0.95,
                  }}
                />
                <p style={{ margin: '0.6rem 0 0', color: '#5c4a3a', fontSize: 13 }}>
                  Login to continue reading your favourite magazines.
                </p>
              </div>

              <Form
                name="login"
                initialValues={{ remember: true }}
                onFinish={onFinish}
                layout="vertical"
                size="large"
              >
                <Form.Item
                  name="email"
                  rules={[{ required: true, message: 'Please input your Email!' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="Email" />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[{ required: true, message: 'Please input your Password!' }]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="default"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{
                      height: '45px',
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderRadius: 10,
                      background: 'var(--btn-view-green, #2d7a3e)',
                      borderColor: 'var(--btn-view-green, #2d7a3e)',
                      color: '#fff',
                    }}
                  >
                    Log In
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                Don't have an account?{' '}
                <Link href="/signup" style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>
                  Sign up now
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
