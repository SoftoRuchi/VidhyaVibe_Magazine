'use client';

import {
  DownloadOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import Link from 'next/link';
import React from 'react';
import api from '../../../lib/api';
import { formatAppDateTime, formatDuration } from '../../../lib/formatAppDateTime';

type Institute = { id: number; name: string };
type Subject = { id: number; name: string; courseName?: string };
type ActivityPayload = {
  stats?: { liveCount: number; todayReaders: number; todayOpens: number; uniqueReaders: number };
  reading?: any[];
  logins?: any[];
};

function fmtWhen(v?: string | null) {
  return formatAppDateTime(v);
}

function fmtMins(seconds?: number) {
  return formatDuration(seconds);
}

function saveBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminBookActivityPage() {
  const [data, setData] = React.useState<ActivityPayload | null>(null);
  const [institutes, setInstitutes] = React.useState<Institute[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [instituteId, setInstituteId] = React.useState<number | undefined>();
  const [subjectId, setSubjectId] = React.useState<number | undefined>();
  const [live, setLive] = React.useState(false);
  const [exporting, setExporting] = React.useState<string | null>(null);

  const loadLookups = React.useCallback(() => {
    api
      .get('/admin/institutes')
      .then((r) => setInstitutes(r.data || []))
      .catch(() => {});
    api
      .get('/admin/book-licenses/subjects')
      .then((r) => setSubjects(r.data || []))
      .catch(() => {});
  }, []);

  const load = React.useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = {};
    if (q.trim()) params.q = q.trim();
    if (instituteId) params.instituteId = instituteId;
    if (subjectId) params.subjectId = subjectId;
    if (live) params.live = 1;
    api
      .get('/admin/institutes/activity', { params })
      .then((r) => setData(r.data || { reading: [], logins: [] }))
      .catch(() => {
        message.error('Failed to load book activity');
        setData({ reading: [], logins: [] });
      })
      .finally(() => setLoading(false));
  }, [q, instituteId, subjectId, live]);

  const activityParams = React.useMemo(() => {
    const params: Record<string, string | number> = { format: 'csv' };
    if (q.trim()) params.q = q.trim();
    if (instituteId) params.instituteId = instituteId;
    if (subjectId) params.subjectId = subjectId;
    if (live) params.live = 1;
    return params;
  }, [q, instituteId, subjectId, live]);

  const exportCsv = async (kind: 'reading' | 'logins') => {
    setExporting(kind);
    try {
      const res = await api.get('/admin/institutes/activity', {
        params: { ...activityParams, kind },
        responseType: 'blob',
      });
      const header = String(res.headers?.['content-disposition'] || '');
      const match = header.match(/filename="?([^"]+)"?/i);
      saveBlob(res.data, match?.[1] || `book-activity-${kind}.csv`);
    } catch {
      message.error('Could not export CSV');
    } finally {
      setExporting(null);
    }
  };

  React.useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  React.useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats || { liveCount: 0, todayReaders: 0, todayOpens: 0, uniqueReaders: 0 };

  return (
    <main className="vv-course-page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h1>
            <LineChartOutlined /> Book activity
          </h1>
          <p className="vv-course-lead">
            Who opened which textbook, for how long, from which device, and whether they are still
            reading. Individual purchases appear here even when they are not tied to an institute.
            Export uses the same filters as the tables.
          </p>
        </div>
        <Space wrap>
          <Link href="/admin/institutes">Book access</Link>
          <Link href="/admin/live-seats">Live seats</Link>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting === 'reading'}
            onClick={() => exportCsv('reading')}
          >
            Reading CSV
          </Button>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting === 'logins'}
            onClick={() => exportCsv('logins')}
          >
            Logins CSV
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat label="Reading now" value={stats.liveCount} />
        <Stat label="Opened today" value={stats.todayOpens} />
        <Stat label="Readers today" value={stats.todayReaders} />
        <Stat label="Unique readers" value={stats.uniqueReaders} />
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search student, email, or book"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 280 }}
        />
        <Select
          allowClear
          placeholder="All institutes"
          value={instituteId}
          onChange={setInstituteId}
          style={{ minWidth: 220 }}
          options={institutes.map((i) => ({ value: i.id, label: i.name }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All books"
          value={subjectId}
          onChange={setSubjectId}
          style={{ minWidth: 240 }}
          options={subjects.map((s) => ({
            value: s.id,
            label: s.courseName ? `${s.courseName} · ${s.name}` : s.name,
          }))}
        />
        <Button type={live ? 'primary' : 'default'} onClick={() => setLive((v) => !v)}>
          {live ? 'Live only' : 'All sessions'}
        </Button>
      </Space>

      <Card>
        {loading && !data ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Reading
            </Typography.Title>
            <Table
              size="small"
              rowKey="id"
              loading={loading}
              dataSource={data?.reading || []}
              scroll={{ x: 1100 }}
              pagination={{ pageSize: 12, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description="No reading activity yet." /> }}
              columns={[
                {
                  title: 'Student',
                  render: (_: unknown, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name || '—'}</div>
                      <div style={{ color: '#667085', fontSize: 12 }}>{r.email}</div>
                    </div>
                  ),
                },
                {
                  title: 'Book',
                  render: (_: unknown, r: any) => (
                    <div>
                      <div>{r.subjectName}</div>
                      <div style={{ color: '#667085', fontSize: 12 }}>{r.courseName}</div>
                    </div>
                  ),
                },
                {
                  title: 'Institute',
                  dataIndex: 'instituteName',
                  render: (v: string) => v || 'Individual',
                },
                {
                  title: 'Chapter',
                  render: (_: unknown, r: any) =>
                    r.chapterTitle
                      ? `${r.chapterTitle}${r.pageNumber ? ` · p.${r.pageNumber}` : ''}`
                      : '—',
                },
                { title: 'Opened', dataIndex: 'openCount', width: 90 },
                {
                  title: 'Time',
                  dataIndex: 'secondsActive',
                  width: 90,
                  render: (v: number) => fmtMins(v),
                },
                { title: 'Device', dataIndex: 'deviceName', render: (v: string) => v || '—' },
                { title: 'IP', dataIndex: 'ipAddress', render: (v: string) => v || '—' },
                {
                  title: 'Last seen',
                  dataIndex: 'lastHeartbeatAt',
                  render: (v: string) => fmtWhen(v),
                },
                {
                  title: 'Session',
                  width: 110,
                  render: (_: unknown, r: any) =>
                    r.live ? <Tag color="green">Active</Tag> : <Tag>{r.endReason || 'Ended'}</Tag>,
                },
              ]}
            />

            <Typography.Title level={5} style={{ marginTop: 28 }}>
              Logins
            </Typography.Title>
            <Table
              size="small"
              rowKey="id"
              loading={loading}
              dataSource={data?.logins || []}
              scroll={{ x: 980 }}
              pagination={{ pageSize: 12, hideOnSinglePage: true }}
              locale={{ emptyText: <Empty description="No login history yet." /> }}
              columns={[
                {
                  title: 'Student',
                  render: (_: unknown, r: any) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name || '—'}</div>
                      <div style={{ color: '#667085', fontSize: 12 }}>{r.email}</div>
                    </div>
                  ),
                },
                {
                  title: 'Institute',
                  dataIndex: 'instituteName',
                  render: (v: string) => v || '—',
                },
                { title: 'Login', dataIndex: 'loggedInAt', render: (v: string) => fmtWhen(v) },
                {
                  title: 'Last seen',
                  dataIndex: 'lastSeenAt',
                  render: (v: string) => fmtWhen(v),
                },
                { title: 'Logout', dataIndex: 'loggedOutAt', render: (v: string) => fmtWhen(v) },
                {
                  title: 'Duration',
                  dataIndex: 'secondsActive',
                  render: (v: number) => fmtMins(v),
                },
                { title: 'Device', dataIndex: 'deviceName', render: (v: string) => v || '—' },
                { title: 'IP', dataIndex: 'ipAddress', render: (v: string) => v || '—' },
                {
                  title: 'Status',
                  render: (_: unknown, r: any) =>
                    r.live ? <Tag color="green">Online</Tag> : <Tag>Signed out</Tag>,
                },
              ]}
            />
          </>
        )}
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card size="small" bodyStyle={{ padding: '12px 16px' }}>
      <div style={{ color: '#667085', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1f1f1f' }}>{value}</div>
    </Card>
  );
}
