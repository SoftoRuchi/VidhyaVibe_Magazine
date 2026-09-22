'use client';

import { PlusOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Spin,
  message,
} from 'antd';
import axios from 'axios';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { useProductMode } from '../lib/productMode';
import { clearViewingContext, setChildAudience, setParentAudience } from '../lib/viewingContext';

const { Option } = Select;

const STORAGE_KEY = 'show_post_login_setup';

function getAuthHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PostLoginChildSetupModal() {
  const pathname = usePathname();
  const router = useRouter();
  const { setMode } = useProductMode();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<{
    id: number;
    email: string;
    name?: string;
    phone?: string;
    deliveryAddress?: string;
    isAdmin?: boolean;
    guardians?: { id: number; name: string; phone?: string; relation?: string }[];
  } | null>(null);
  const [readers, setReaders] = useState<{ id: number; name: string; age?: number }[]>([]);
  const [step, setStep] = useState<'product' | 'chooser' | 'setup'>('product');
  const [parentForm] = Form.useForm();
  const [childForm] = Form.useForm();

  const shouldRunOnPath =
    pathname &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/signup') &&
    !pathname.startsWith('/admin');

  const loadData = useCallback(async () => {
    const headers = getAuthHeader();
    if (!headers.Authorization) return;
    setLoading(true);
    try {
      const [meRes, readersRes] = await Promise.all([
        axios.get('/api/auth/me', { headers }),
        axios.get('/api/readers', { headers }),
      ]);
      const m = meRes.data;
      setMe(m);
      setReaders(readersRes.data || []);
      parentForm.setFieldsValue({
        name: m?.name || m?.guardians?.[0]?.name || '',
        phone: m?.phone || m?.guardians?.[0]?.phone || '',
        deliveryAddress: m?.deliveryAddress || '',
      });
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [parentForm]);

  useEffect(() => {
    if (!shouldRunOnPath) return;
    const flag = sessionStorage.getItem(STORAGE_KEY);
    const token = localStorage.getItem('access_token');
    if (flag !== '1' || !token) return;
    setStep('product');
    setOpen(true);
    loadData();
  }, [shouldRunOnPath, loadData, pathname]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('vv-post-login-open');
      return;
    }
    document.body.classList.add('vv-post-login-open');
    return () => document.body.classList.remove('vv-post-login-open');
  }, [open]);

  const closeAndClearFlag = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    document.body.classList.remove('vv-post-login-open');
    setOpen(false);
  };

  const chooseProduct = (next: 'magazine' | 'course') => {
    if (loading) return;
    setMode(next);
    if (next === 'course') {
      clearViewingContext();
      closeAndClearFlag();
      router.push('/');
      return;
    }
    setStep('chooser');
  };

  const saveParent = async () => {
    const vals = await parentForm.validateFields();
    try {
      await axios.put('/api/auth/me', vals, { headers: getAuthHeader() });
      message.success('Your details saved');
      setMe((prev) => (prev ? { ...prev, ...vals } : prev));
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Could not save profile');
    }
  };

  const addChild = async () => {
    const vals = await childForm.validateFields();
    try {
      await axios.post(
        '/api/readers',
        {
          name: vals.childName,
          age: vals.age ?? undefined,
          className: vals.className || undefined,
          schoolName: vals.schoolName || undefined,
          schoolCity: vals.schoolCity || undefined,
          deliveryMode: vals.deliveryMode || 'ELECTRONIC',
        },
        { headers: getAuthHeader() },
      );
      message.success('Child added');
      childForm.resetFields();
      const readersRes = await axios.get('/api/readers', { headers: getAuthHeader() });
      setReaders(readersRes.data || []);
      if ((readersRes.data || []).length > 0) {
        setStep('chooser');
      }
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Could not add child');
    }
  };

  const chooseParent = () => {
    setParentAudience();
    closeAndClearFlag();
    router.push('/');
  };

  const chooseChild = (readerId: number, readerName: string) => {
    setChildAudience(readerId, readerName);
    closeAndClearFlag();
    router.push('/');
  };

  const title =
    step === 'product'
      ? 'What would you like to open?'
      : step === 'chooser'
        ? 'Who is this login for?'
        : 'Welcome — set up your family';

  return (
    <Modal
      title={title}
      open={open}
      centered
      maskClosable={false}
      closable={false}
      keyboard={false}
      rootClassName="vv-post-login-modal"
      styles={{ mask: { background: 'var(--nav-oval-bg)', opacity: 1 } }}
      maskStyle={{ background: 'var(--nav-oval-bg)', opacity: 1 }}
      onCancel={() => undefined}
      footer={
        step === 'product' || step === 'chooser'
          ? null
          : [
              <Button
                key="later"
                onClick={() => {
                  setParentAudience();
                  closeAndClearFlag();
                }}
              >
                Skip for now
              </Button>,
              <Button
                key="done"
                type="primary"
                onClick={() => {
                  setParentAudience();
                  closeAndClearFlag();
                }}
              >
                Done
              </Button>,
            ]
      }
      width="92vw"
      style={{ maxWidth: 560 }}
      destroyOnClose={false}
    >
      <Spin spinning={loading}>
        {step === 'product' ? (
          <>
            <p style={{ color: '#666', marginBottom: 24, textAlign: 'center' }}>
              Choose one. Magazines are for families. Courses are for college textbooks.
            </p>
            <div className="vv-product-chooser">
              <button
                type="button"
                className="vv-product-circle"
                disabled={loading}
                onClick={() => chooseProduct('magazine')}
              >
                <span className="vv-product-circle-face is-magazine">M</span>
                <strong>Magazine</strong>
                <span>Stories and issues</span>
              </button>
              <button
                type="button"
                className="vv-product-circle"
                disabled={loading}
                onClick={() => chooseProduct('course')}
              >
                <span className="vv-product-circle-face is-course">C</span>
                <strong>Course</strong>
                <span>Books and notes</span>
              </button>
            </div>
          </>
        ) : null}
        {step === 'chooser' ? (
          <>
            <p style={{ color: '#666', marginBottom: 20 }}>
              Select who is using the app right now.
            </p>
            <div className="vv-login-chooser">
              <button
                type="button"
                onClick={chooseParent}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Avatar size={72} style={{ background: '#2563eb', fontWeight: 700 }}>
                  {(me?.name || 'P').slice(0, 1).toUpperCase()}
                </Avatar>
                <strong>{me?.name || 'Parent'}</strong>
                <span style={{ color: '#888', fontSize: 12 }}>Parent</span>
              </button>

              {readers.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => chooseChild(r.id, r.name)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Avatar size={72} style={{ background: '#16a34a', fontWeight: 700 }}>
                    {r.name.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <strong>{r.name}</strong>
                  <span style={{ color: '#888', fontSize: 12 }}>Child</span>
                </button>
              ))}
              {readers.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Avatar size={72} style={{ background: '#16a34a', fontWeight: 700 }}>
                    +
                  </Avatar>
                  <strong>Child</strong>
                  <span style={{ color: '#888', fontSize: 12 }}>Add a child</span>
                </button>
              ) : null}
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                onClick={() => {
                  clearViewingContext();
                  chooseParent();
                }}
              >
                Continue as parent
              </Button>
              <Button onClick={() => setStep('setup')}>Add a child</Button>
            </div>
          </>
        ) : step === 'setup' ? (
          <>
            <p style={{ color: '#666', marginBottom: 16 }}>
              Confirm your guardian details (we&apos;ve filled in what we already have). Then add
              one or more children — you can always add more later from{' '}
              <Link href="/profile" onClick={closeAndClearFlag}>
                Profile
              </Link>
              .
            </p>

            <Divider orientation="left">Guardian / parent</Divider>
            <Form form={parentForm} layout="vertical" size="middle">
              <Form.Item
                name="name"
                label="Your full name"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="Parent or guardian name" />
              </Form.Item>
              <Form.Item name="phone" label="Phone (optional)">
                <Input placeholder="Phone number" />
              </Form.Item>
              <Form.Item name="deliveryAddress" label="Delivery address">
                <Input.TextArea rows={2} placeholder="Address" />
              </Form.Item>
              <Button type="default" onClick={saveParent}>
                Save guardian details
              </Button>
            </Form>

            <Divider orientation="left">Children</Divider>
            {readers.length > 0 && (
              <List
                size="small"
                bordered
                dataSource={readers}
                style={{ marginBottom: 16 }}
                renderItem={(r) => (
                  <List.Item>
                    <strong>{r.name}</strong>
                    {r.age != null ? (
                      <span style={{ marginLeft: 8, color: '#888' }}>Age {r.age}</span>
                    ) : null}
                  </List.Item>
                )}
              />
            )}

            <Form form={childForm} layout="vertical" size="middle">
              <Form.Item
                name="childName"
                label="Child's name"
                rules={[{ required: true, message: "Please enter the child's name" }]}
              >
                <Input placeholder="Child's full name" />
              </Form.Item>
              <Form.Item name="age" label="Age (optional)">
                <InputNumber min={0} max={18} style={{ width: '100%' }} placeholder="Age" />
              </Form.Item>
              <Form.Item name="className" label="Class (optional)">
                <Input placeholder="e.g. Grade 3" />
              </Form.Item>
              <Form.Item name="schoolName" label="School (optional)">
                <Input placeholder="School name" />
              </Form.Item>
              <Form.Item name="schoolCity" label="City (optional)">
                <Input placeholder="City" />
              </Form.Item>
              <Form.Item name="deliveryMode" label="Delivery" initialValue="ELECTRONIC">
                <Select>
                  <Option value="ELECTRONIC">Electronic</Option>
                  <Option value="PRINT">Print</Option>
                </Select>
              </Form.Item>
              <Button type="primary" icon={<PlusOutlined />} onClick={addChild}>
                Add child
              </Button>
            </Form>
          </>
        ) : null}
      </Spin>
    </Modal>
  );
}
