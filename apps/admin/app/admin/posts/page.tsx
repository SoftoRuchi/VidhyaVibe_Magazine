'use client';

import { Button, Card, Popconfirm, Table, Tag, message } from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../lib/api';

interface PostListItem {
  id: number;
  type: string;
  title: string;
  sortOrder?: number;
  active?: boolean;
  media?: unknown[];
}

export default function PostsAdminPage() {
  const [items, setItems] = React.useState<PostListItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .get('/admin/posts/list')
      .then((r) => setItems(r.data || []))
      .catch(() => message.error('Failed to load posts'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/admin/posts/${id}`);
      message.success('Deleted');
      load();
    } catch {
      message.error('Delete failed');
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Posts & Carousel"
        extra={
          <Link href="/admin/posts/new">
            <Button type="primary">New Post / Slide</Button>
          </Link>
        }
      >
        <p style={{ marginTop: 0, color: '#666' }}>
          Manage blog-style posts and homepage carousel slides for the public web app.
        </p>
        <Table<PostListItem>
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 70 },
            {
              title: 'Type',
              dataIndex: 'type',
              width: 100,
              render: (t: string, row: PostListItem) => (
                <Tag color={t === 'CAROUSEL' ? 'purple' : 'blue'}>
                  {t === 'CAROUSEL' && row.media?.length ? `CAROUSEL (${row.media.length})` : t}
                </Tag>
              ),
            },
            { title: 'Title', dataIndex: 'title', ellipsis: true },
            { title: 'Order', dataIndex: 'sortOrder', width: 70 },
            {
              title: 'Active',
              dataIndex: 'active',
              width: 80,
              render: (v: boolean) => (v ? 'Yes' : 'No'),
            },
            {
              title: 'Actions',
              width: 160,
              render: (_: unknown, row: PostListItem) => (
                <>
                  <Link href={`/admin/posts/${row.id}/edit`}>
                    <Button size="small" style={{ marginRight: 8 }}>
                      Edit
                    </Button>
                  </Link>
                  <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(row.id)}>
                    <Button size="small" danger>
                      Delete
                    </Button>
                  </Popconfirm>
                </>
              ),
            },
          ]}
        />
      </Card>
    </main>
  );
}
