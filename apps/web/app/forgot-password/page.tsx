'use client';

import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Steps, message } from 'antd';
import axios from 'axios';
import Link from 'next/link';
import React, { useState } from 'react';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [requestForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const requestOtp = async (values: { email: string }) => {
    setLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', { email: values.email });
      setEmail(values.email.trim().toLowerCase());
      resetForm.setFieldsValue({ email: values.email.trim().toLowerCase() });
      setStep(1);
      message.success('If an account exists, a 6-digit OTP was sent to your email.');
    } catch (e: any) {
      message.error(e.response?.data?.message || e.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (values: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', {
        email: values.email,
        otp: values.otp,
        newPassword: values.newPassword,
      });
      message.success('Password updated. You can log in now.');
      window.location.href = '/login';
    } catch (e: any) {
      message.error(e.response?.data?.message || e.response?.data?.error || 'Reset failed');
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
      <div className="container" style={{ maxWidth: 520 }}>
        <Card
          style={{
            borderRadius: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.78)',
            border: '1px solid rgba(61,41,20,0.18)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
          }}
          bodyStyle={{ padding: '1.6rem 1.75rem' }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.85rem',
              fontWeight: 800,
              color: '#3d2914',
              fontFamily: 'Georgia, serif',
            }}
          >
            Forgot password
          </h1>
          <p style={{ margin: '0.5rem 0 1.25rem', color: '#5c4a3a', fontSize: 13 }}>
            We will email a 6-digit OTP so you can set a new password.
          </p>

          <Steps
            current={step}
            size="small"
            style={{ marginBottom: 24 }}
            items={[{ title: 'Email' }, { title: 'OTP & new password' }]}
          />

          {step === 0 ? (
            <Form form={requestForm} layout="vertical" onFinish={requestOtp} size="large">
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Enter your email' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="Email" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 45,
                  background: 'var(--btn-view-green, #2d7a3e)',
                  borderColor: 'var(--btn-view-green, #2d7a3e)',
                }}
              >
                Send OTP
              </Button>
            </Form>
          ) : (
            <Form
              form={resetForm}
              layout="vertical"
              onFinish={resetPassword}
              size="large"
              initialValues={{ email }}
            >
              <Form.Item name="email" label="Email" rules={[{ required: true }]}>
                <Input prefix={<MailOutlined />} />
              </Form.Item>
              <Form.Item
                name="otp"
                label="6-digit OTP"
                rules={[
                  { required: true, message: 'Enter the OTP from your email' },
                  { pattern: /^\d{6}$/, message: 'OTP must be 6 digits' },
                ]}
              >
                <Input prefix={<SafetyOutlined />} placeholder="123456" maxLength={6} />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="New password"
                rules={[
                  { required: true, message: 'Enter a new password' },
                  { min: 6, message: 'At least 6 characters' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="New password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm password"
                rules={[{ required: true, message: 'Confirm your password' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Confirm password" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 45,
                  background: 'var(--btn-view-green, #2d7a3e)',
                  borderColor: 'var(--btn-view-green, #2d7a3e)',
                }}
              >
                Reset password
              </Button>
              <Button type="link" block style={{ marginTop: 8 }} onClick={() => setStep(0)}>
                Resend OTP
              </Button>
            </Form>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link href="/login" style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>
              Back to login
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
