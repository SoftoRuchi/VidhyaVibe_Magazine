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
} from 'antd';
import { useRouter } from 'next/navigation';
import React from 'react';
import api from '../../../../lib/api';
import { wallClockFromPicker } from '../../../../lib/wallClock';

export default function NewCouponPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [plans, setPlans] = React.useState<{ label: string; value: number }[]>([]);
  const [magazines, setMagazines] = React.useState<{ label: string; value: number }[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const discountType = Form.useWatch('discountType', form) || 'percent';
  const restrictToUsers = Form.useWatch('restrictToUsers', form);
  const [userOptions, setUserOptions] = React.useState<{ label: string; value: number }[]>([]);

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
      api.get('/admin/users').then((r) =>
        (r.data || []).map((u: any) => ({
          label: `${u.email}${u.name ? ` (${u.name})` : ''}`,
          value: Number(u.id),
        })),
      ),
    ])
      .then(([planOpts, magazineOpts, usersOpts]) => {
        setPlans(planOpts);
        setMagazines(magazineOpts);
        setUserOptions(usersOpts);
      })
      .catch(() => {
        message.error('Failed to load plans/magazines/users');
        setPlans([]);
        setMagazines([]);
        setUserOptions([]);
      })
      .finally(() => setLoadingOptions(false));
  }, []);

  async function onFinish(values: any) {
    setSubmitting(true);
    try {
      // Keep the picker wall-clock time as-is (no UTC conversion)
      const expiresAt = wallClockFromPicker(values.expiresAt);
      if (values.code) values.code = String(values.code).trim().toUpperCase();

      const payload: any = {
        code: values.code,
        description: values.description || null,
        expiresAt,
        maxUses: values.maxUses || null,
        perUserLimit: values.perUserLimit || null,
        active: values.active !== false,
        showToUsers: values.showToUsers !== false,
        restrictToUsers: Boolean(values.restrictToUsers),
        assignedUserIds: values.restrictToUsers ? values.assignedUserIds || [] : [],
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

      await api.post('/admin/coupons', payload);
      message.success('Coupon created');
      router.push('/admin/coupons');
    } catch (e: any) {
      message.error(e?.response?.data?.details || e?.response?.data?.error || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <Card title="New Coupon">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            active: true,
            showToUsers: true,
            restrictToUsers: false,
            discountType: 'percent',
          }}
        >
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
              <Form.Item
                name="active"
                label="Active"
                valuePropName="checked"
                extra="Inactive coupons cannot be used"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} align="middle">
            <Col xs={24} sm={12}>
              <Form.Item
                name="showToUsers"
                label="Show to users"
                valuePropName="checked"
                extra="Off = hidden from subscribe coupon list (code can still be typed if not user-restricted)"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="restrictToUsers"
                label="Only selected users"
                valuePropName="checked"
                extra="On = only chosen users can see and redeem this coupon"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          {restrictToUsers ? (
            <Form.Item
              name="assignedUserIds"
              label="Selected users"
              rules={[
                {
                  validator: async (_, value) => {
                    if (!value || !value.length) {
                      throw new Error('Select at least one user');
                    }
                  },
                },
              ]}
            >
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                loading={loadingOptions}
                options={userOptions}
                placeholder="Search and select users"
                style={{ width: '100%' }}
              />
            </Form.Item>
          ) : null}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Create
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </main>
  );
}
