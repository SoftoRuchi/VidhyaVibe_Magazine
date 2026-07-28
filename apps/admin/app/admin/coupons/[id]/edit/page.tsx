'use client';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  DatePicker,
  Switch,
  Select,
  Row,
  Col,
  Radio,
  message,
  Space,
  Spin,
} from 'antd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import api from '../../../../../lib/api';
import { parseWallClock, wallClockFromPicker } from '../../../../../lib/wallClock';

export default function EditCouponPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);
  const [form] = Form.useForm();
  const [plans, setPlans] = React.useState<{ label: string; value: number }[]>([]);
  const [magazines, setMagazines] = React.useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingOptions, setLoadingOptions] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const discountType = Form.useWatch('discountType', form) || 'percent';

  React.useEffect(() => {
    setLoadingOptions(true);
    Promise.all([
      api.get('/admin/plans').then((r) =>
        (r.data || []).map((p: any) => ({
          label: p.name,
          value: Number(p.id),
        })),
      ),
      api.get('/admin/magazines/list').then((r) =>
        (r.data || []).map((m: any) => ({
          label: m.title,
          value: Number(m.id),
        })),
      ),
    ])
      .then(([planOpts, magazineOpts]) => {
        setPlans(planOpts);
        setMagazines(magazineOpts);
      })
      .catch(() => {
        message.error('Failed to load plans/magazines');
        setPlans([]);
        setMagazines([]);
      })
      .finally(() => setLoadingOptions(false));
  }, []);

  React.useEffect(() => {
    if (!Number.isFinite(id)) {
      message.error('Invalid coupon');
      router.replace('/admin/coupons');
      return;
    }
    setLoading(true);
    api
      .get(`/admin/coupons/${id}`)
      .then((r) => {
        const c = r.data;
        const isFixed = c.discountCents != null && c.discountPct == null;
        form.setFieldsValue({
          code: c.code,
          description: c.description || undefined,
          discountType: isFixed ? 'fixed' : 'percent',
          discountValue: isFixed ? Number(c.discountCents) : Number(c.discountPct),
          maxUses: c.maxUses != null ? Number(c.maxUses) : undefined,
          perUserLimit: c.perUserLimit != null ? Number(c.perUserLimit) : undefined,
          planId: c.planId != null ? Number(c.planId) : undefined,
          magazineId: c.magazineId != null ? Number(c.magazineId) : undefined,
          expiresAt: parseWallClock(c.expiresAt),
          active: !!c.active,
        });
      })
      .catch(() => {
        message.error('Coupon not found');
        router.replace('/admin/coupons');
      })
      .finally(() => setLoading(false));
  }, [form, id, router]);

  async function onFinish(values: any) {
    setSubmitting(true);
    try {
      const expiresAt = wallClockFromPicker(values.expiresAt);

      const payload: any = {
        code: String(values.code || '')
          .trim()
          .toUpperCase(),
        description: values.description || null,
        expiresAt,
        maxUses: values.maxUses || null,
        perUserLimit: values.perUserLimit || null,
        active: values.active !== false,
        planId: values.planId || null,
        magazineId: values.magazineId || null,
        discountPct: null,
        discountCents: null,
      };

      if (values.discountType === 'fixed') {
        payload.discountCents = Number(values.discountValue);
      } else {
        payload.discountPct = Number(values.discountValue);
      }

      await api.put(`/admin/coupons/${id}`, payload);
      message.success('Coupon updated');
      router.push('/admin/coupons');
    } catch (e: any) {
      message.error(e?.response?.data?.details || e?.response?.data?.error || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <Card
        title="Edit Coupon"
        extra={
          <Link href="/admin/coupons">
            <Button>Back</Button>
          </Link>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="code"
                  label="Code"
                  rules={[{ required: true, message: 'Enter code' }]}
                >
                  <Input placeholder="e.g. WELCOME20" style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="description" label="Description">
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="discountType"
                  label="Discount type"
                  rules={[{ required: true, message: 'Select discount type' }]}
                >
                  <Radio.Group
                    optionType="button"
                    buttonStyle="solid"
                    options={[
                      { value: 'percent', label: 'Percentage (%)' },
                      { value: 'fixed', label: 'Fixed amount (₹)' },
                    ]}
                    onChange={() => form.setFieldValue('discountValue', undefined)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="discountValue"
                  label={discountType === 'fixed' ? 'Discount amount (₹)' : 'Discount (%)'}
                  rules={[
                    { required: true, message: 'Enter discount value' },
                    {
                      validator: async (_, value) => {
                        if (value == null) return;
                        if (discountType === 'percent' && (value < 1 || value > 100)) {
                          throw new Error('Enter a percentage between 1 and 100');
                        }
                        if (discountType === 'fixed' && value < 1) {
                          throw new Error('Enter amount in rupees (₹)');
                        }
                      },
                    },
                  ]}
                  extra={
                    discountType === 'fixed'
                      ? 'Example: 50 = ₹50 off the subscription total'
                      : 'Example: 20 = 20% off the subscription total'
                  }
                >
                  <InputNumber
                    min={1}
                    max={discountType === 'percent' ? 100 : undefined}
                    style={{ width: '100%' }}
                    prefix={discountType === 'fixed' ? '₹' : undefined}
                    addonAfter={discountType === 'percent' ? '%' : undefined}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="maxUses" label="Max Uses">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="perUserLimit" label="Per-user Limit">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="planId" label="Plan (optional)">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={loadingOptions}
                    options={plans}
                    placeholder={plans.length ? 'Select plan' : 'No plans found'}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="magazineId" label="Magazine (optional)">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={loadingOptions}
                    options={magazines}
                    placeholder={magazines.length ? 'Select magazine' : 'No magazines found'}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16} align="middle">
              <Col xs={24} sm={12}>
                <Form.Item name="expiresAt" label="Expires At">
                  <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="active" label="Active" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  Save changes
                </Button>
                <Link href="/admin/coupons">
                  <Button>Cancel</Button>
                </Link>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>
    </main>
  );
}
