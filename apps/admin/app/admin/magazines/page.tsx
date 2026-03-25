'use client';
import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Card, Col, Empty, Input, Row, Space, Typography } from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../lib/api';

export default function MagazinesPage() {
  const [magazines, setMagazines] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    api.get('/admin/magazines/list').then((r) => setMagazines(r.data || []));
  }, []);

  const filteredMagazines = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return magazines;
    return magazines.filter((m: any) => {
      const title = String(m.title || '').toLowerCase();
      const slug = String(m.slug || '').toLowerCase();
      return title.includes(q) || slug.includes(q);
    });
  }, [magazines, search]);

  return (
    <main>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Magazines</span>
            <Space>
              <Input
                allowClear
                placeholder="Search magazines"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240 }}
              />
              <Link href="/admin/magazines/new">
                <Button type="primary">New Magazine</Button>
              </Link>
            </Space>
          </div>
        }
      >
        {filteredMagazines.length === 0 ? (
          <Empty description="No magazines found" />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredMagazines.map((m: any) => (
              <Col key={m.id} xs={24} sm={24} md={12} lg={8}>
                <Card
                  size="small"
                  bodyStyle={{
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                  style={{ borderRadius: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {m.coverKey ? (
                      <img
                        src={`/api/assets/serve?key=${encodeURIComponent(m.coverKey)}`}
                        alt={m.title}
                        style={{
                          width: 64,
                          height: 84,
                          objectFit: 'cover',
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 84,
                          borderRadius: 8,
                          background: '#f0f0f0',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <Typography.Text strong style={{ fontSize: 14, lineHeight: 1.25 }}>
                        {m.title}
                      </Typography.Text>
                      <br />
                      <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                        {m.slug}
                      </Typography.Text>
                    </div>
                  </div>

                  <Space size={12}>
                    <Link href={`/admin/magazines/${m.id}`}>
                      <Space size={4} style={{ color: '#1677ff' }}>
                        <EyeOutlined />
                        <span>Open</span>
                      </Space>
                    </Link>
                    <Link href={`/admin/magazines/${m.id}/edit`}>
                      <EditOutlined style={{ color: '#fa8c16' }} />
                    </Link>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </main>
  );
}
