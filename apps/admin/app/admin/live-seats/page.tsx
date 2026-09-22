'use client';

import { DesktopOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Popconfirm,
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

function fmtWhen(v?: string | null) {
  return formatAppDateTime(v);
}

function fmtMins(seconds?: number) {
  return formatDuration(seconds);
}

export default function AdminLiveSeatsPage() {
  const [readers, setReaders] = React.useState<any[]>([]);
  const [occupancy, setOccupancy] = React.useState<any[]>([]);
  const [institutes, setInstitutes] = React.useState<Institute[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [instituteId, setInstituteId] = React.useState<number | undefined>();
  const [subjectId, setSubjectId] = React.useState<number | undefined>();
  const [ending, setEnding] = React.useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string>('');

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

  const load = React.useCallback(
    (silent?: boolean) => {
      if (!silent) setLoading(true);
      const params: Record<string, number> = {};
      if (instituteId) params.instituteId = instituteId;
      if (subjectId) params.subjectId = subjectId;
      api
        .get('/admin/institutes/live', { params })
        .then((r) => {
          setReaders(r.data?.readers || []);
          setOccupancy(r.data?.occupancy || []);
          setUpdatedAt(new Date().toLocaleTimeString());
        })
        .catch(() => {
          if (!silent) message.error('Failed to load live seats');
        })
        .finally(() => setLoading(false));
    },
    [instituteId, subjectId],
  );

  React.useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  React.useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const endSession = (sessionId: number) => {
    setEnding(sessionId);
    api
      .post(`/admin/institutes/live/${sessionId}/end`)
      .then(() => {
        message.success('Seat released');
        load(true);
      })
      .catch((e) => message.error(e.response?.data?.message || 'Could not end the session'))
      .finally(() => setEnding(null));
  };

  const liveCount = readers.length;
  const libraryFull = occupancy.filter((r) => r.full).length;

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
            <DesktopOutlined /> Live seats
          </h1>
          <p className="vv-course-lead">
            Who has a textbook open right now. Library lots show used seats vs purchased seats.
            Ending a session frees that seat immediately — stale sessions also drop off after about
            two minutes.
            {updatedAt ? ` Last refresh ${updatedAt}.` : ''}
          </p>
        </div>
        <Space wrap>
          <Link href="/admin/book-activity">Activity history</Link>
          <Button icon={<ReloadOutlined />} onClick={() => load()}>
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
        <Stat label="Reading now" value={liveCount} />
        <Stat label="Library lots full" value={libraryFull} />
        <Stat label="Active lots" value={occupancy.length} />
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
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
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          Who is reading now
        </Typography.Title>
        {loading && !readers.length && !occupancy.length ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <Table
            size="small"
            rowKey="id"
            loading={loading}
            dataSource={readers}
            scroll={{ x: 1080 }}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty description="Nobody is reading a textbook right now." /> }}
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
              {
                title: 'Model',
                dataIndex: 'accessModel',
                render: (v: string) => (
                  <Tag color={v === 'LIBRARY' ? 'blue' : v === 'BOOK_BANK' ? 'green' : 'gold'}>
                    {v}
                  </Tag>
                ),
              },
              {
                title: 'Time',
                dataIndex: 'secondsActive',
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
                title: 'Action',
                width: 140,
                render: (_: unknown, r: any) => (
                  <Popconfirm
                    title="End this reading session and free the seat?"
                    onConfirm={() => endSession(r.id)}
                  >
                    <Button type="link" size="small" danger loading={ending === r.id}>
                      End session
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Card>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          License occupancy
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Library lots are a shared pool. When remaining is 0, the next student is blocked until
          someone closes the book.
        </Typography.Paragraph>
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={occupancy}
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="No active license lots." /> }}
          columns={[
            {
              title: 'Book',
              render: (_: unknown, r: any) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.subjectName}</div>
                  <div style={{ color: '#667085', fontSize: 12 }}>{r.courseName}</div>
                </div>
              ),
            },
            { title: 'Institute', dataIndex: 'instituteName' },
            {
              title: 'Model',
              dataIndex: 'accessModel',
              render: (v: string) => (
                <Tag color={v === 'LIBRARY' ? 'blue' : v === 'BOOK_BANK' ? 'green' : 'gold'}>
                  {v === 'BOOK_BANK' ? 'Book bank' : v === 'LIBRARY' ? 'Library' : v}
                </Tag>
              ),
            },
            {
              title: 'Seats',
              render: (_: unknown, r: any) => `${r.liveReaders} / ${r.seatCount}`,
            },
            {
              title: 'Remaining',
              render: (_: unknown, r: any) =>
                r.accessModel === 'LIBRARY' ? (
                  r.full ? (
                    <Tag color="red">Full</Tag>
                  ) : (
                    r.remaining
                  )
                ) : (
                  '—'
                ),
            },
            {
              title: 'Code',
              dataIndex: 'purchaseCode',
              render: (v: string) => <code>{v}</code>,
            },
          ]}
        />
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
