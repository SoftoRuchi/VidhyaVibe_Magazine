'use client';

import {
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
  Statistic,
  Row,
  Col,
} from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../lib/api';

type ActivityRow = {
  id: number;
  title: string;
  activityType: string;
  subjectName?: string | null;
  difficulty: string;
  status: string;
  points: number;
  estimatedMinutes: number;
  completionCount: number;
  ageBands?: string[];
};

type Stats = {
  total: number;
  published: number;
  draft: number;
  archived: number;
  completions: number;
};

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PUBLISHED: 'green',
  ARCHIVED: 'orange',
};

export default function ActivitiesAdminPage() {
  const [items, setItems] = React.useState<ActivityRow[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<string | undefined>();
  const [activityType, setActivityType] = React.useState<string | undefined>();
  const [types, setTypes] = React.useState<{ id: string; label: string }[]>([]);

  const load = React.useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    if (status) params.status = status;
    if (activityType) params.activityType = activityType;
    Promise.all([
      api.get('/admin/activities', { params }),
      api.get('/admin/activities/stats').catch(() => ({ data: null })),
      api.get('/admin/activities/meta').catch(() => ({ data: null })),
    ])
      .then(([listRes, statsRes, metaRes]) => {
        setItems(listRes.data?.items || []);
        if (statsRes.data) setStats(statsRes.data);
        if (metaRes.data?.activityTypes) setTypes(metaRes.data.activityTypes);
      })
      .catch(() => message.error('Failed to load activities'))
      .finally(() => setLoading(false));
  }, [q, status, activityType]);

  React.useEffect(() => {
    load();
  }, [load]);

  const publish = async (id: number) => {
    try {
      await api.post(`/admin/activities/${id}/publish`);
      message.success('Published');
      load();
    } catch (e: any) {
      const issues = e?.response?.data?.issues;
      message.error(
        issues?.length
          ? `Cannot publish: ${issues.map((i: any) => i.message).join('; ')}`
          : e?.response?.data?.message || 'Publish failed',
      );
    }
  };

  const unpublish = async (id: number) => {
    try {
      await api.post(`/admin/activities/${id}/unpublish`);
      message.success('Unpublished');
      load();
    } catch {
      message.error('Unpublish failed');
    }
  };

  const duplicate = async (id: number) => {
    try {
      const r = await api.post(`/admin/activities/${id}/duplicate`);
      message.success('Duplicated as draft');
      window.location.href = `/admin/activities/${r.data.id}/edit`;
    } catch {
      message.error('Duplicate failed');
    }
  };

  const archive = async (id: number) => {
    try {
      await api.delete(`/admin/activities/${id}`);
      message.success('Archived');
      load();
    } catch {
      message.error('Archive failed');
    }
  };

  return (
    <main style={{ padding: 24 }}>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}>
            <Card>
              <Statistic title="Total" value={stats.total} />
            </Card>
          </Col>
          <Col xs={12} md={5}>
            <Card>
              <Statistic title="Published" value={stats.published} />
            </Card>
          </Col>
          <Col xs={12} md={5}>
            <Card>
              <Statistic title="Drafts" value={stats.draft} />
            </Card>
          </Col>
          <Col xs={12} md={5}>
            <Card>
              <Statistic title="Archived" value={stats.archived} />
            </Card>
          </Col>
          <Col xs={12} md={5}>
            <Card>
              <Statistic title="Completions" value={stats.completions} />
            </Card>
          </Col>
        </Row>
      )}

      <Card
        title="Interactive Activities"
        extra={
          <Link href="/admin/activities/new">
            <Button type="primary">Create activity</Button>
          </Link>
        }
      >
        <p style={{ marginTop: 0, color: '#666' }}>
          Configure reusable activity templates for the mobile app — no developer needed for each new
          activity.
        </p>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Search title"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => setQ(v)}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 140 }}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
          />
          <Select
            allowClear
            placeholder="Type"
            style={{ width: 180 }}
            value={activityType}
            onChange={setActivityType}
            options={types.map((t) => ({ value: t.id, label: t.label }))}
          />
          <Button onClick={load}>Refresh</Button>
        </Space>

        <Table<ActivityRow>
          rowKey="id"
          loading={loading}
          dataSource={items}
          scroll={{ x: 960 }}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 70 },
            { title: 'Title', dataIndex: 'title', ellipsis: true },
            {
              title: 'Type',
              dataIndex: 'activityType',
              width: 140,
              render: (t: string) => <Tag>{t}</Tag>,
            },
            {
              title: 'Subject',
              dataIndex: 'subjectName',
              width: 130,
              render: (v: string) => v || '—',
            },
            { title: 'Difficulty', dataIndex: 'difficulty', width: 100 },
            {
              title: 'Ages',
              dataIndex: 'ageBands',
              width: 120,
              render: (bands?: string[]) => (bands?.length ? bands.join(', ') : '—'),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 110,
              render: (s: string) => <Tag color={statusColor[s] || 'default'}>{s}</Tag>,
            },
            { title: 'Pts', dataIndex: 'points', width: 60 },
            { title: 'Done', dataIndex: 'completionCount', width: 70 },
            {
              title: 'Actions',
              width: 320,
              fixed: 'right',
              render: (_: unknown, row) => (
                <Space wrap size={4}>
                  <Link href={`/admin/activities/${row.id}/edit`}>
                    <Button size="small">Edit</Button>
                  </Link>
                  <Link href={`/admin/activities/${row.id}/preview`}>
                    <Button size="small">Preview</Button>
                  </Link>
                  {row.status !== 'PUBLISHED' ? (
                    <Button size="small" type="primary" onClick={() => publish(row.id)}>
                      Publish
                    </Button>
                  ) : (
                    <Button size="small" onClick={() => unpublish(row.id)}>
                      Unpublish
                    </Button>
                  )}
                  <Button size="small" onClick={() => duplicate(row.id)}>
                    Duplicate
                  </Button>
                  <Popconfirm title="Archive this activity?" onConfirm={() => archive(row.id)}>
                    <Button size="small" danger>
                      Archive
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </main>
  );
}
