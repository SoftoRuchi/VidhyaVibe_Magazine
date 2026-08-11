'use client';

import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Divider,
  Alert,
} from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import api from '../lib/api';

export type ActivityFormValues = {
  title: string;
  description?: string;
  activityType: string;
  subjectId?: number;
  difficulty: string;
  estimatedMinutes: number;
  instructions?: string;
  successMessage?: string;
  explanation?: string;
  points: number;
  badgeLabel?: string;
  ageBands: string[];
  ageGroupIds?: number[];
  config: Record<string, any>;
};

const defaultConfig = (type: string): Record<string, any> => {
  switch (type) {
    case 'CONNECT_DOTS':
      return {
        dots: [
          { id: '1', label: '1', x: 20, y: 70 },
          { id: '2', label: '2', x: 40, y: 40 },
          { id: '3', label: '3', x: 60, y: 55 },
          { id: '4', label: '4', x: 80, y: 30 },
        ],
        sequence: ['1', '2', '3', '4'],
        revealLabel: 'Shape',
      };
    case 'PAINT':
      return {
        templateImageKey: '',
        colours: ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#6D4C41'],
        minCompletionPercent: 40,
      };
    case 'DRAG_DROP':
      return {
        targets: [
          { id: 'healthy', label: 'Healthy' },
          { id: 'sometimes', label: 'Sometimes' },
        ],
        items: [
          { id: 'apple', label: 'Apple', emoji: '🍎', target: 'healthy' },
          { id: 'veg', label: 'Vegetables', emoji: '🥦', target: 'healthy' },
          { id: 'chips', label: 'Chips', emoji: '🍟', target: 'sometimes' },
          { id: 'candy', label: 'Candy', emoji: '🍬', target: 'sometimes' },
        ],
      };
    case 'MATCHING':
      return {
        pairs: [
          { id: 'p1', left: 'Apple', right: 'Fruit' },
          { id: 'p2', left: 'Car', right: 'Vehicle' },
          { id: 'p3', left: 'Dog', right: 'Animal' },
        ],
      };
    case 'SORTING':
      return {
        categories: [
          { id: 'needs', label: 'Needs' },
          { id: 'wants', label: 'Wants' },
        ],
        items: [
          { id: 'food', label: 'Food', categoryId: 'needs' },
          { id: 'books', label: 'School books', categoryId: 'needs' },
          { id: 'toy', label: 'New toy', categoryId: 'wants' },
          { id: 'game', label: 'Video game', categoryId: 'wants' },
          { id: 'bill', label: 'Electricity bill', categoryId: 'needs' },
        ],
      };
    case 'ARRANGE_ORDER':
      return {
        items: [
          { id: 'a', label: 'Wake up' },
          { id: 'b', label: 'Brush teeth' },
          { id: 'c', label: 'Go to school' },
        ],
        correctOrder: ['a', 'b', 'c'],
      };
    case 'TAP_CORRECT':
      return {
        prompt: 'Tap the healthy snack',
        options: [
          { id: 'o1', label: 'Apple', emoji: '🍎' },
          { id: 'o2', label: 'Candy', emoji: '🍬' },
          { id: 'o3', label: 'Chips', emoji: '🍟' },
        ],
        correctOptionId: 'o1',
      };
    case 'FINANCIAL_DECISION':
      return {
        scenario: 'You receive ₹500 pocket money.',
        budget: 500,
        currency: '₹',
        choices: [
          {
            id: 'c1',
            label: 'Save ₹200 and spend ₹300',
            isBest: true,
            outcome: 'Saving part of your money builds a habit for future goals.',
            pointsMultiplier: 1,
          },
          {
            id: 'c2',
            label: 'Spend all ₹500',
            isBest: false,
            outcome: 'Spending everything leaves nothing for later needs.',
            pointsMultiplier: 0.4,
          },
          {
            id: 'c3',
            label: 'Save all ₹500',
            isBest: false,
            outcome: 'Saving is good — also plan a small reward so the habit sticks.',
            pointsMultiplier: 0.8,
          },
        ],
      };
    case 'QUIZ':
    case 'PATTERN':
    case 'PUZZLE':
    case 'LOGIC':
    default:
      return {
        questions: [
          {
            prompt: 'What is 2 + 2?',
            options: ['3', '4', '5', '22'],
            correctIndex: 1,
          },
        ],
      };
  }
};

export function ActivityForm({
  mode,
  activityId,
  initial,
}: {
  mode: 'create' | 'edit';
  activityId?: number;
  initial?: Partial<ActivityFormValues>;
}) {
  const router = useRouter();
  const [form] = Form.useForm<ActivityFormValues>();
  const [saving, setSaving] = React.useState(false);
  const [meta, setMeta] = React.useState<any>(null);
  const activityType = Form.useWatch('activityType', form);

  React.useEffect(() => {
    api.get('/admin/activities/meta').then((r) => setMeta(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        difficulty: 'Easy',
        estimatedMinutes: 10,
        points: 10,
        ageBands: ['11-13'],
        ...initial,
        config: initial.config || defaultConfig(initial.activityType || 'QUIZ'),
      });
    } else {
      form.setFieldsValue({
        activityType: 'QUIZ',
        difficulty: 'Easy',
        estimatedMinutes: 10,
        points: 10,
        ageBands: ['11-13'],
        successMessage: '🎉 Great job! You completed the activity.',
        explanation: 'You practiced an important skill. Keep going!',
        config: defaultConfig('QUIZ'),
      });
    }
  }, [initial, form]);

  const onTypeChange = (type: string) => {
    form.setFieldValue('config', defaultConfig(type));
  };

  const submit = async (publishAfter = false) => {
    try {
      const values = await form.validateFields();
      let config = values.config;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch {
          message.error('Config JSON is invalid');
          return;
        }
      }
      setSaving(true);
      const payload = { ...values, config };
      let id = activityId;
      if (mode === 'create') {
        const r = await api.post('/admin/activities', payload);
        id = r.data.id;
        message.success('Activity created as draft');
      } else {
        await api.put(`/admin/activities/${activityId}`, payload);
        message.success('Activity saved');
      }
      if (publishAfter && id) {
        try {
          await api.post(`/admin/activities/${id}/publish`);
          message.success('Published');
        } catch (e: any) {
          const issues = e?.response?.data?.issues;
          message.warning(
            issues?.length
              ? `Saved but not published: ${issues.map((i: any) => i.message).join('; ')}`
              : 'Saved as draft — fix config to publish',
          );
        }
      }
      router.push(id ? `/admin/activities/${id}/edit` : '/admin/activities');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={mode === 'create' ? 'Create activity' : 'Edit activity'}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Configuration-driven"
        description="Pick an activity type, fill the form, then edit the JSON config if you need advanced options. Only published activities appear in the mobile app."
      />
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input placeholder="Save for Your Goal" />
        </Form.Item>
        <Form.Item name="description" label="Short description">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Space wrap style={{ width: '100%' }} size="large">
          <Form.Item
            name="activityType"
            label="Activity type"
            rules={[{ required: true }]}
            style={{ minWidth: 220 }}
          >
            <Select
              options={(meta?.activityTypes || []).map((t: any) => ({
                value: t.id,
                label: t.label,
              }))}
              onChange={onTypeChange}
            />
          </Form.Item>
          <Form.Item name="subjectId" label="Subject" style={{ minWidth: 200 }}>
            <Select
              allowClear
              options={(meta?.subjects || []).map((s: any) => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="difficulty" label="Difficulty" style={{ minWidth: 140 }}>
            <Select
              options={(meta?.difficulties || []).map((d: any) => ({
                value: d.id,
                label: d.label,
              }))}
            />
          </Form.Item>
          <Form.Item name="estimatedMinutes" label="Minutes" style={{ minWidth: 120 }}>
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="points" label="Points" style={{ minWidth: 120 }}>
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item
          name="ageBands"
          label="Age bands"
          rules={[{ required: true, message: 'Select at least one age band' }]}
        >
          <Checkbox.Group
            options={(meta?.ageBands || []).map((b: any) => ({
              value: b.id,
              label: b.label,
            }))}
          />
        </Form.Item>
        <Form.Item name="instructions" label="Instructions">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="successMessage" label="Success / appreciation message">
          <Input />
        </Form.Item>
        <Form.Item name="explanation" label="Learning explanation">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="badgeLabel" label="Badge label (optional)">
          <Input placeholder="Smart Saver" />
        </Form.Item>

        <Divider>Type configuration (JSON)</Divider>
        <p style={{ color: '#666', marginTop: -8 }}>
          Current type: <strong>{activityType || '—'}</strong>. Starter template loads when you change
          type. Validate before publish.
        </p>
        <Form.Item
          name="config"
          label="Config"
          getValueProps={(v) => ({
            value: typeof v === 'string' ? v : JSON.stringify(v ?? {}, null, 2),
          })}
          normalize={(v) => {
            if (typeof v !== 'string') return v;
            try {
              return JSON.parse(v);
            } catch {
              return v;
            }
          }}
          rules={[
            {
              validator: async (_, value) => {
                if (typeof value === 'string') {
                  try {
                    JSON.parse(value);
                  } catch {
                    throw new Error('Invalid JSON');
                  }
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={16} style={{ fontFamily: 'monospace', fontSize: 12 }} />
        </Form.Item>

        <Space wrap>
          <Button type="primary" loading={saving} onClick={() => submit(false)}>
            Save draft
          </Button>
          <Button loading={saving} onClick={() => submit(true)}>
            Save & publish
          </Button>
          {activityId ? (
            <Link href={`/admin/activities/${activityId}/preview`}>
              <Button>Preview</Button>
            </Link>
          ) : null}
          <Button onClick={() => router.push('/admin/activities')}>Back</Button>
        </Space>
      </Form>
    </Card>
  );
}
