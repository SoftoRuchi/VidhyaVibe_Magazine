'use client';

import { EditOutlined, ThunderboltFilled } from '@ant-design/icons';
import { Table, Tag, Space, Button, Spin, Alert, Card, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';

const { Text } = Typography;

interface ChildType {
  id: number;
  name: string;
  age?: number;
  className?: string;
  schoolName?: string;
  schoolCity?: string;
}

interface UserType {
  key: string;
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
  childCount: number;
  childList: ChildType[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Fetch all users from the admin endpoint
        const response = await api.get('/admin/users');
        const usersData = response.data || [];

        // Keep only parent/account rows at top level.
        const filteredUsersData = usersData.filter((u: any) => {
          const email = String(u?.email || '').trim();
          const hasValidEmail = /.+@.+\..+/.test(email);
          const hasChildren = Number(u?.childCount || 0) > 0;
          const isAdmin = !!u?.isAdmin;
          return hasValidEmail || hasChildren || isAdmin;
        });

        // Transform user data to table format
        const transformedUsers: UserType[] = filteredUsersData.map((u: any, index: number) => ({
          key: String(u.id || index),
          id: u.id,
          name: u.name || 'Anonymous',
          email: u.email,
          role: u.isAdmin ? 'admin' : 'user',
          status: 'active',
          joinedAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A',
          childCount: Number(u.childCount || 0),
          childList: Array.isArray(u.children)
            ? u.children
            : Array.isArray(u.childList)
              ? u.childList
              : [],
        }));

        setUsers(transformedUsers);
      } catch (err: any) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users.');

        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const columns: ColumnsType<UserType> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'admin' ? 'volcano' : 'geekblue'}>
          {(role || 'user').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {(status || 'active').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Children',
      key: 'children',
      width: 280,
      render: (_, record) => {
        if (!record.childCount) return <Text type="secondary">No children</Text>;
        return (
          <Space size={10}>
            <Tag color="blue">
              {record.childCount} Child{record.childCount > 1 ? 'ren' : ''}
            </Tag>
            <Text type="secondary">Click + to view</Text>
          </Space>
        );
      },
    },
    {
      title: 'Joined Date',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            onClick={() => alert(`Edit ${record.name || record.email}`)}
          >
            <EditOutlined />
          </Button>
        </Space>
      ),
    },
  ];

  const renderExpandedChildren = (record: UserType) => {
    if (!record.childList?.length) {
      return <Text type="secondary">No children linked to this parent.</Text>;
    }

    return (
      <div
        style={{
          border: '1px solid #f0f0f0',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {record.childList.map((child, index) => (
          <div
            key={child.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
              gap: 10,
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: index === record.childList.length - 1 ? 'none' : '1px solid #f5f5f5',
            }}
          >
            <Text strong>
              <ThunderboltFilled style={{ color: '#595959', marginRight: 8 }} />
              {child.name}
            </Text>
            <Text>
              <Text type="secondary">Age:</Text> {child.age ?? '-'}
            </Text>
            <Text>
              <Text type="secondary">Class:</Text> {child.className || '-'}
            </Text>
            <Text>
              <Text type="secondary">School:</Text> {child.schoolName || '-'}
              {child.schoolCity ? `, ${child.schoolCity}` : ''}
            </Text>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <main>
        <Card title="User Management">
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main>
      <Card title="User Management">
        {error && <Alert message={error} type="warning" showIcon style={{ marginBottom: 12 }} />}
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          childrenColumnName="__tableChildren"
          expandable={{
            expandedRowRender: renderExpandedChildren,
            rowExpandable: (record) => record.childCount > 0,
          }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </main>
  );
}
