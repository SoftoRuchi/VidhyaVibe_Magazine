'use client';

import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Switch } from 'antd';
import React from 'react';
import api from '../lib/api';

const TYPE_OPTIONS = [
  { label: 'Banner (hero)', value: 'BANNER' },
  { label: 'Deal card', value: 'DEAL' },
  { label: 'Benefit bullet', value: 'BENEFIT' },
];

export function SaleOfferForm({ initialValues, onSubmit, submitLabel }: any) {
  const [form] = Form.useForm();
  const offerType = Form.useWatch('type', form) ?? initialValues?.type ?? 'DEAL';
  const linkedMagazineId = Form.useWatch('magazineId', form);
  const [magazines, setMagazines] = React.useState<{ id: number; title: string }[]>([]);
  const [plans, setPlans] = React.useState<{ id: number; name: string }[]>([]);

  React.useEffect(() => {
    api
      .get('/admin/magazines/list')
      .then((r) => setMagazines(r.data || []))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!linkedMagazineId) {
      setPlans([]);
      return;
    }
    api
      .get(`/admin/magazines/${linkedMagazineId}/plans`)
      .then((r) =>
        setPlans(
          (r.data || []).map((p: any) => ({
            id: p.planId ?? p.id,
            name: p.name,
          })),
        ),
      )
      .catch(() => setPlans([]));
  }, [linkedMagazineId]);

  React.useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        startsAt: initialValues.startsAt ? undefined : undefined,
        expiresAt: initialValues.expiresAt ? undefined : undefined,
      });
    }
  }, [initialValues, form]);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ type: 'DEAL', sortOrder: 0, active: true, ...initialValues }}
      onFinish={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        width: '100%',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select options={TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        {(offerType === 'BANNER' || offerType === 'DEAL') && (
          <Row gutter={16}>
            <Col xs={24} md={offerType === 'DEAL' ? 12 : 24}>
              <Form.Item name="badge" label="Badge / Tag">
                <Input placeholder="e.g. Best Value, Limited-time offer" />
              </Form.Item>
            </Col>
            {offerType === 'DEAL' && (
              <Col xs={24} md={12}>
                <Form.Item name="subtitle" label="Subtitle">
                  <Input />
                </Form.Item>
              </Col>
            )}
          </Row>
        )}

        {offerType === 'DEAL' && (
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="highlight" label="Price highlight">
                <Input placeholder="e.g. ₹950/year" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="color" label="Card background color">
                <Input placeholder="rgba(45,122,62,0.12)" />
              </Form.Item>
            </Col>
          </Row>
        )}

        {offerType === 'DEAL' && (
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="borderColor" label="Card border color">
                <Input placeholder="rgba(45,122,62,0.35)" />
              </Form.Item>
            </Col>
          </Row>
        )}

        {(offerType === 'BANNER' || offerType === 'DEAL') && (
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="magazineId" label="Magazine (for Razorpay checkout)">
                <Select
                  allowClear
                  placeholder="Select magazine"
                  options={magazines.map((m) => ({ label: m.title, value: m.id }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="planId" label="Plan (for Razorpay checkout)">
                <Select
                  allowClear
                  placeholder={linkedMagazineId ? 'Select plan' : 'Select magazine first'}
                  disabled={!linkedMagazineId}
                  options={plans.map((p) => ({ label: p.name, value: p.id }))}
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        {(offerType === 'BANNER' || offerType === 'DEAL') && (
          <Form.Item name="detail" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        )}

        {offerType === 'DEAL' && (
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="ctaLabel" label="Button label">
                <Input placeholder="Get Yearly" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="ctaHref" label="Button link (optional)">
                <Input placeholder="Leave empty to use Razorpay when plan + magazine are set" />
              </Form.Item>
            </Col>
          </Row>
        )}

        {offerType === 'BANNER' && (
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="ctaLabel" label="Button label">
                <Input placeholder="Subscribe Now" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="ctaHref" label="Button link (optional)">
                <Input placeholder="Leave empty to use Razorpay when plan + magazine are set" />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="sortOrder" label="Sort order">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="startsAt" label="Starts at (optional)">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="expiresAt" label="Expires at (optional)">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 16,
          marginTop: 8,
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
        }}
      >
        <Button type="primary" htmlType="submit" size="large">
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}

export function SalesOfferFormShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        padding: 16,
        height: 'calc(100vh - 88px)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Card
        title={title}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        styles={{
          body: {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            paddingBottom: 12,
          },
        }}
      >
        {children}
      </Card>
    </main>
  );
}
