'use client';

import { Button, Card, Space, Tag, Typography, message, Spin } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';
import api from '../../../../../lib/api';

const { Title, Paragraph, Text } = Typography;

/**
 * Mobile-sized admin preview — mirrors how the Flutter player will read config.
 * Interactive playtesting for each engine type is on the device; this shows the
 * exact payload + a simplified interactive shell for quiz/financial types.
 */
export default function PreviewActivityPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [loading, setLoading] = React.useState(true);
  const [activity, setActivity] = React.useState<any>(null);
  const [selected, setSelected] = React.useState<number | string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    api
      .get(`/admin/activities/${id}`)
      .then((r) => setActivity(r.data))
      .catch(() => message.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }
  if (!activity) {
    return <main style={{ padding: 24 }}>Not found</main>;
  }

  const cfg = activity.config || {};
  const isQuizLike = ['QUIZ', 'PATTERN', 'PUZZLE', 'LOGIC', 'TAP_CORRECT', 'FINANCIAL_DECISION'].includes(
    activity.activityType,
  );

  const tryAnswer = () => {
    if (activity.activityType === 'FINANCIAL_DECISION') {
      const choice = (cfg.choices || [])[Number(selected)];
      setResult(choice?.outcome || activity.explanation || 'Done');
      return;
    }
    if (activity.activityType === 'TAP_CORRECT') {
      const ok =
        String(selected) === String(cfg.correctOptionId) ||
        Number(selected) === Number(cfg.correctIndex);
      setResult(ok ? activity.successMessage : 'Try again');
      return;
    }
    const q = (cfg.questions || [])[0] || cfg;
    const ok = Number(selected) === Number(q.correctIndex);
    setResult(ok ? activity.successMessage : 'Try again — ' + (activity.explanation || ''));
  };

  return (
    <main style={{ padding: 24, background: '#f5f0e8', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Link href={`/admin/activities/${id}/edit`}>
          <Button>Edit</Button>
        </Link>
        <Link href="/admin/activities">
          <Button>All activities</Button>
        </Link>
        <Tag color={activity.status === 'PUBLISHED' ? 'green' : 'default'}>{activity.status}</Tag>
      </Space>

      <div
        style={{
          maxWidth: 390,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 24,
          border: '8px solid #222',
          minHeight: 640,
          padding: 20,
          boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        }}
      >
        <Text type="secondary">{activity.subjectName || 'Learn'}</Text>
        <Title level={3} style={{ marginTop: 4 }}>
          {activity.title}
        </Title>
        <Space wrap size={4} style={{ marginBottom: 12 }}>
          <Tag>{activity.activityType}</Tag>
          <Tag>{activity.difficulty}</Tag>
          <Tag>{activity.estimatedMinutes} min</Tag>
          <Tag>+{activity.points} pts</Tag>
        </Space>
        <Paragraph type="secondary">{activity.instructions || activity.description}</Paragraph>

        {isQuizLike && (
          <div>
            <Paragraph strong>
              {cfg.scenario ||
                cfg.prompt ||
                cfg.questions?.[0]?.prompt ||
                'Choose an option'}
            </Paragraph>
            <Space direction="vertical" style={{ width: '100%' }}>
              {(
                cfg.choices ||
                cfg.options ||
                cfg.questions?.[0]?.options ||
                []
              ).map((opt: any, i: number) => {
                const label = typeof opt === 'string' ? opt : opt.label || opt.id;
                const value =
                  activity.activityType === 'TAP_CORRECT'
                    ? opt.id ?? i
                    : activity.activityType === 'FINANCIAL_DECISION'
                      ? i
                      : i;
                return (
                  <Button
                    key={i}
                    block
                    type={selected === value ? 'primary' : 'default'}
                    onClick={() => setSelected(value)}
                    style={{ height: 'auto', whiteSpace: 'normal', padding: 12 }}
                  >
                    {typeof opt === 'object' && opt.emoji ? `${opt.emoji} ` : ''}
                    {label}
                  </Button>
                );
              })}
              <Button type="primary" disabled={selected == null} onClick={tryAnswer}>
                Submit
              </Button>
              {result && (
                <Card size="small" style={{ background: '#f6ffed' }}>
                  {result}
                </Card>
              )}
            </Space>
          </div>
        )}

        {!isQuizLike && (
          <Card size="small" title="Config preview">
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              This type ({activity.activityType}) is fully interactive on mobile. Admin preview shows
              the configuration payload used by the player.
            </Paragraph>
            <pre
              style={{
                fontSize: 11,
                maxHeight: 320,
                overflow: 'auto',
                background: '#fafafa',
                padding: 8,
              }}
            >
              {JSON.stringify(cfg, null, 2)}
            </pre>
          </Card>
        )}

        {activity.explanation && (
          <Paragraph style={{ marginTop: 16 }}>
            <strong>Learning:</strong> {activity.explanation}
          </Paragraph>
        )}
      </div>
    </main>
  );
}
