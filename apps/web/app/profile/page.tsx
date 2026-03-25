'use client';

import { UserOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { Card, Form, Input, Button, message, Spin, Select, InputNumber, Divider } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import profileImg from '../../components/images/profile.png';

const { Option } = Select;

interface UserProfile {
  id: number;
  email: string;
  name?: string;
  phone?: string;
}

interface Guardian {
  id: number;
  name: string;
  phone?: string;
  relation?: string;
}

interface Reader {
  id: number;
  name: string;
  dob?: string;
  age?: number;
  className?: string;
  schoolName?: string;
  schoolCity?: string;
  deliveryMode?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [_guardians, setGuardians] = useState<Guardian[]>([]);
  const [readers, setReaders] = useState<Reader[]>([]);

  // Edit states
  const [editingProfile, setEditingProfile] = useState(false);
  const [_editingGuardianId, _setEditingGuardianId] = useState<number | null>(null);
  const [editingReaderId, setEditingReaderId] = useState<number | null>(null);
  const [addingReader, setAddingReader] = useState(false);

  const [profileForm] = Form.useForm();
  const [_guardianForm] = Form.useForm();
  const [readerForm] = Form.useForm();
  const [newReaderForm] = Form.useForm();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.replace('/login?redirect=/profile');
      return;
    }
    fetchAll(token);
  }, []);

  async function fetchAll(token: string) {
    setLoading(true);
    try {
      const [meRes, readersRes] = await Promise.all([
        axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/readers', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setUser(meRes.data);
      setReaders(readersRes.data || []);
      setGuardians(meRes.data?.guardians || []);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('access_token');
        router.replace('/login?redirect=/profile');
      } else {
        message.error('Failed to load profile data');
      }
    } finally {
      setLoading(false);
    }
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  // ── Personal Info ──────────────────────────────────────────────────────────
  const startEditProfile = () => {
    profileForm.setFieldsValue({ name: user?.name, phone: user?.phone });
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    const vals = await profileForm.validateFields();
    try {
      await axios.put('/api/auth/me', vals, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser((u) => u && { ...u, ...vals });
      setEditingProfile(false);
      message.success('Profile updated!');
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Update failed');
    }
  };

  // ── Reader (School) info ───────────────────────────────────────────────────
  const startEditReader = (r: Reader) => {
    setEditingReaderId(r.id);
    readerForm.setFieldsValue({
      name: r.name,
      age: r.age,
      className: r.className,
      schoolName: r.schoolName,
      schoolCity: r.schoolCity,
      dob: r.dob ? r.dob.split('T')[0] : undefined,
      deliveryMode: r.deliveryMode || 'ELECTRONIC',
    });
  };

  const saveReader = async () => {
    if (!editingReaderId) return;
    const vals = await readerForm.validateFields();
    try {
      await axios.put(`/api/readers/${editingReaderId}`, vals, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReaders((rs) => rs.map((r) => (r.id === editingReaderId ? { ...r, ...vals } : r)));
      setEditingReaderId(null);
      message.success('Reader info updated!');
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Update failed');
    }
  };

  const createReader = async () => {
    const vals = await newReaderForm.validateFields();
    try {
      const res = await axios.post('/api/readers', vals, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReaders((rs) => [...rs, { id: res.data.id, ...vals }]);
      setAddingReader(false);
      newReaderForm.resetFields();
      message.success('Reader added!');
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Failed to add reader');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: '80vh',
        // padding: '1.25rem 0 2.25rem',
      }}
    >
      <div className="container" style={{ maxWidth: 980 }}>
        {/* Themed heading */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '84px 1fr 84px',
            alignItems: 'center',
            // padding: '0.35rem 0',
            marginBottom: '1.0rem',
          }}
        >
          <div />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Image
              src={profileImg}
              alt="Profile"
              width={84}
              height={84}
              style={{ width: 84, height: 84, objectFit: 'contain' }}
              priority
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '2.05rem',
                  fontWeight: 800,
                  color: '#3d2914',
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.2px',
                  textAlign: 'center',
                }}
              >
                My Profile
              </h1>
              <div
                style={{
                  width: '55%',
                  maxWidth: 240,
                  height: 3,
                  backgroundColor: '#3d2914',
                  borderRadius: 999,
                  marginTop: 8,
                  opacity: 0.95,
                }}
              />
            </div>
          </div>
          <div />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)',
            gap: '2rem',
            alignItems: 'flex-start',
          }}
        >
          {/* Left: Profile Summary / Edit */}
          <Card
            style={{
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
              paddingTop: 12,
            }}
            bodyStyle={{ padding: '1.4rem 1.6rem 1.6rem' }}
          >
            {editingProfile ? (
              <Form form={profileForm} layout="vertical">
                <h3 style={{ marginBottom: 16 }}>Edit Profile Details</h3>
                <Form.Item name="name" label="Full Name">
                  <Input placeholder="Your name" size="large" />
                </Form.Item>
                <Form.Item name="phone" label="Phone Number">
                  <Input placeholder="Your phone number" size="large" />
                </Form.Item>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <Button type="primary" icon={<SaveOutlined />} onClick={saveProfile} size="large">
                    Save
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={() => setEditingProfile(false)}
                    size="large"
                  >
                    Cancel
                  </Button>
                </div>
              </Form>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'linear-gradient(145deg, #fee2e2, #e0f2fe)',
                      margin: '0 auto 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36,
                    }}
                  >
                    <UserOutlined />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{user?.name || 'Parent User'}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                    Active Parent Account
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#f3f4ff',
                    borderRadius: 12,
                    padding: '0.75rem 0.9rem',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontSize: 13, color: '#4b5563' }}>{user?.email}</div>
                  {user?.phone && (
                    <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>{user.phone}</div>
                  )}
                </div>

                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: 16,
                    fontSize: 13,
                    color: '#6b7280',
                  }}
                >
                  <strong>{readers.length}</strong> Registered Readers
                </div>

                <Button
                  block
                  type="default"
                  icon={<EditOutlined />}
                  onClick={startEditProfile}
                  style={{ borderRadius: 999 }}
                >
                  Edit Profile Details
                </Button>
              </>
            )}
          </Card>

          {/* Right: Readers list */}
          <Card
            style={{
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
            bodyStyle={{ padding: '1.4rem 1.6rem 1.6rem' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Your Registered Readers</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Manage child reader profiles and delivery details.
                </div>
              </div>
            </div>

            {readers.map((r) => (
              <Card
                key={r.id}
                style={{
                  marginBottom: 14,
                  borderRadius: 16,
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                }}
                bodyStyle={{ padding: '0.9rem 1rem 0.85rem' }}
              >
                {editingReaderId === r.id ? (
                  <Form form={readerForm} layout="vertical">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                      <Form.Item name="name" label="Reader Name" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="age" label="Age">
                        <InputNumber min={1} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="dob" label="Date of Birth">
                        <Input type="date" />
                      </Form.Item>
                      <Form.Item name="className" label="Class / Grade">
                        <Input placeholder="e.g. 6th Grade" />
                      </Form.Item>
                      <Form.Item name="schoolName" label="School Name">
                        <Input placeholder="e.g. ABC Public School" />
                      </Form.Item>
                      <Form.Item name="schoolCity" label="School City">
                        <Input placeholder="e.g. Mumbai" />
                      </Form.Item>
                      <Form.Item name="deliveryMode" label="Preferred Delivery">
                        <Select>
                          <Option value="ELECTRONIC">E-Magazine</Option>
                          <Option value="PHYSICAL">Physical Copy</Option>
                          <Option value="BOTH">Both</Option>
                        </Select>
                      </Form.Item>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Button type="primary" icon={<SaveOutlined />} onClick={saveReader}>
                        Save
                      </Button>
                      <Button icon={<CloseOutlined />} onClick={() => setEditingReaderId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </Form>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: 999,
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Active (Subscribed)
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                        gap: '0.5rem 1.25rem',
                        marginBottom: 8,
                        fontSize: 12,
                      }}
                    >
                      {[
                        ['Age', r.age],
                        ['Grade', r.className],
                        ['School', r.schoolName],
                        ['City', r.schoolCity],
                        ['Delivery Method', r.deliveryMode],
                      ].map(([label, val]) => (
                        <div key={String(label)}>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{val || '—'}</div>
                        </div>
                      ))}
                    </div>

                    <Button icon={<EditOutlined />} onClick={() => startEditReader(r)} size="small">
                      Edit
                    </Button>
                  </>
                )}
              </Card>
            ))}

            {readers.length === 0 && !addingReader && (
              <p style={{ color: '#9ca3af', fontStyle: 'italic', marginBottom: 0 }}>
                No readers added yet.
              </p>
            )}

            <Divider />

            {addingReader ? (
              <>
                <h3 style={{ marginBottom: 16 }}>Add New Reader</h3>
                <Form form={newReaderForm} layout="vertical">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <Form.Item name="name" label="Reader Name" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                    <Form.Item name="age" label="Age">
                      <InputNumber min={1} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="dob" label="Date of Birth">
                      <Input type="date" />
                    </Form.Item>
                    <Form.Item name="className" label="Class / Grade">
                      <Input placeholder="e.g. 6th Grade" />
                    </Form.Item>
                    <Form.Item name="schoolName" label="School Name">
                      <Input placeholder="e.g. ABC Public School" />
                    </Form.Item>
                    <Form.Item name="schoolCity" label="School City">
                      <Input placeholder="e.g. Mumbai" />
                    </Form.Item>
                    <Form.Item
                      name="deliveryMode"
                      label="Preferred Delivery"
                      initialValue="ELECTRONIC"
                    >
                      <Select>
                        <Option value="ELECTRONIC">E-Magazine</Option>
                        <Option value="PHYSICAL">Physical Copy</Option>
                        <Option value="BOTH">Both</Option>
                      </Select>
                    </Form.Item>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Button type="primary" icon={<SaveOutlined />} onClick={createReader}>
                      Add Reader
                    </Button>
                    <Button icon={<CloseOutlined />} onClick={() => setAddingReader(false)}>
                      Cancel
                    </Button>
                  </div>
                </Form>
              </>
            ) : (
              <Button type="dashed" onClick={() => setAddingReader(true)} style={{ width: '100%' }}>
                + Add Reader Profile
              </Button>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
