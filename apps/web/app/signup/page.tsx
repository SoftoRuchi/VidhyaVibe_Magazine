'use client';

import { Card, Form, Input, Button, message, Select, Row, Col } from 'antd';
import axios from 'axios';
import Link from 'next/link';
import React from 'react';

const { Option } = Select;

export default function SignupPage() {
  const [loading, setLoading] = React.useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        email: values.email,
        password: values.password,
        name: values.parentName?.trim(),
        phone: values.phone?.trim(),
        relation: values.relation,
        deliveryAddress: values.deliveryAddress?.trim(),
      };

      await axios.post('/api/auth/register', payload);
      message.success('Account created! Log in to add your children.');
      window.location.href = '/login';
    } catch (error: any) {
      const data = error.response?.data;
      const msg =
        data?.message ||
        data?.error ||
        (typeof data?.error === 'string' ? data.error : null) ||
        'Signup failed. Please try again.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background:
          'linear-gradient(135deg, var(--background-color) 0%, var(--secondary-color) 100%)',
        padding: '2rem',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '550px',
          borderRadius: '20px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        }}
        bodyStyle={{ padding: '3rem 2rem' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--primary-color)', fontSize: '2rem', marginBottom: '0.5rem' }}>
            Join the Fun!
          </h1>
          <p style={{ color: '#888' }}>
            Create your guardian account first. After you log in, you can add your children.
          </p>
        </div>

        <Form name="signup" onFinish={onFinish} layout="vertical" size="large" scrollToFirstError>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="parentName"
                label="Parent / guardian full name"
                rules={[
                  { required: true, message: 'Please enter your full name', whitespace: true },
                ]}
              >
                <Input placeholder="Your full name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="E-mail"
                rules={[
                  { type: 'email', message: 'The input is not valid E-mail!' },
                  { required: true, message: 'Please input your E-mail!' },
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="Phone"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="relation"
                label="Relation to child"
                rules={[{ required: true, message: 'Please select relation' }]}
              >
                <Select placeholder="Select relation">
                  <Option value="Parent">Parent</Option>
                  <Option value="Father">Father</Option>
                  <Option value="Mother">Mother</Option>
                  <Option value="Guardian">Guardian</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: 'Please input your password!' },
                  { min: 6, message: 'Password must be at least 6 characters!' },
                ]}
                hasFeedback
              >
                <Input.Password placeholder="Create a password" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="confirm"
                label="Confirm Password"
                dependencies={['password']}
                hasFeedback
                rules={[
                  { required: true, message: 'Please confirm your password!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('The two passwords do not match!'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Confirm your password" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="deliveryAddress"
            label="Delivery Address"
            rules={[{ required: true, message: 'Please enter delivery address' }]}
          >
            <Input.TextArea rows={3} placeholder="House no, street, area, city, state, pincode" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                backgroundColor: 'var(--primary-color)',
                borderColor: 'var(--primary-color)',
                height: '45px',
                fontWeight: 600,
              }}
            >
              Register
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--secondary-color)', fontWeight: 600 }}>
            Login here
          </Link>
        </div>
      </Card>
    </div>
  );
}
