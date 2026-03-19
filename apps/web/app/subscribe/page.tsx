'use client';
import { Card, Form, Select, InputNumber, Button, Input, message, Radio, Alert } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import React from 'react';
import childImg from '../../components/images/child.png';
import subscribeImg from '../../components/images/subscribe.png';

const DELIVERY_OPTIONS = [
  { value: 'ELECTRONIC', label: 'E-Magazine only (digital access)' },
  { value: 'PHYSICAL', label: 'Physical copy only' },
  { value: 'BOTH', label: 'Both (E-Magazine + Physical)' },
];

export default function SubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const magazineIdParam = searchParams?.get('magazineId');
  const [form] = Form.useForm();
  const [plans, setPlans] = React.useState<any[]>([]);
  const [magazines, setMagazines] = React.useState<any[]>([]);
  const [order, setOrder] = React.useState<any>(null);
  const [selectedMagazineId, setSelectedMagazineId] = React.useState<number | null>(
    magazineIdParam ? Number(magazineIdParam) : null,
  );
  const [deliveryMode, setDeliveryMode] = React.useState<'ELECTRONIC' | 'PHYSICAL' | 'BOTH'>(
    'ELECTRONIC',
  );
  const [selectedPlanId, setSelectedPlanId] = React.useState<number | null>(null);

  React.useEffect(() => {
    axios.get('/api/magazines').then((r) => setMagazines(r.data || []));
  }, []);

  React.useEffect(() => {
    const id = magazineIdParam ? Number(magazineIdParam) : selectedMagazineId;
    if (id) {
      axios.get(`/api/subscriptions/plans?magazineId=${id}`).then((r) => setPlans(r.data || []));
    } else {
      setPlans([]);
    }
  }, [selectedMagazineId, magazineIdParam]);

  const filteredPlans = plans.filter((p) => p.deliveryMode === deliveryMode);
  const selectedPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : null;
  const price = selectedPlan?.prices?.[deliveryMode]?.price ?? selectedPlan?.price ?? 0;
  const currency =
    selectedPlan?.prices?.[deliveryMode]?.currency ?? selectedPlan?.currency ?? 'INR';
  const needsAddress = deliveryMode === 'PHYSICAL' || deliveryMode === 'BOTH';
  const minMonths = selectedPlan?.minMonths ?? 1;
  const maxMonths = selectedPlan?.maxMonths;

  async function onFinish(values: any) {
    const token = localStorage.getItem('access_token');
    if (!token) {
      message.error('Please login first');
      return;
    }
    const magazineId = values.magazineId
      ? Number(values.magazineId)
      : magazineIdParam
        ? Number(magazineIdParam)
        : undefined;
    if (!magazineId) {
      message.error('Please select a magazine to subscribe');
      return;
    }
    try {
      const payload = { ...values, magazineId, deliveryMode: values.deliveryMode ?? deliveryMode };
      const res = await axios.post('/api/payments/create-order', payload, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(res.data);
      message.success('Order created');

      // Redirect to Razorpay checkout page
      const rpOrderId = res.data?.rpOrderId;
      const orderId = res.data?.orderId;
      const amount = res.data?.finalAmount ?? res.data?.amount;
      const currency = res.data?.currency ?? 'INR';
      if (rpOrderId && orderId && amount != null) {
        router.push(
          `/razorpay?rpOrderId=${encodeURIComponent(String(rpOrderId))}&orderId=${encodeURIComponent(
            String(orderId),
          )}&amount=${encodeURIComponent(String(amount))}&currency=${encodeURIComponent(String(currency))}`,
        );
      }
    } catch (e: any) {
      message.error(e.response?.data?.error || e.response?.data?.message || 'failed');
    }
  }

  async function uploadProof(file: File) {
    if (!order) return;
    const fd = new FormData();
    fd.append('proof', file);
    const res = await axios.post(`/api/payments/${order.orderId}/proof`, fd, {
      withCredentials: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (res.data?.proofId) {
      message.success('Proof uploaded, awaiting admin verification');
    }
  }

  return (
    <main
      style={{
        // padding: '1.25rem 0 2.25rem',
        minHeight: '80vh',
      }}
    >
      <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 780 }}>
          {/* Themed heading */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '84px 1fr 84px',
              alignItems: 'center',
            }}
          >
            <div />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Image
                src={subscribeImg}
                alt="Subscribe"
                width={84}
                height={84}
                style={{ width: 84, height: 84, objectFit: 'contain' }}
                priority
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '2.05rem',
                    fontWeight: 800,
                    color: '#3d2914',
                    fontFamily: 'Georgia, serif',
                    letterSpacing: '0.2px',
                    textAlign: 'center',
                  }}
                >
                  Subscribe
                </h1>
                <div
                  style={{
                    width: '55%',
                    maxWidth: 240,
                    height: 3,
                    backgroundColor: '#3d2914',
                    borderRadius: 999,
                    marginTop: 8,
                    opacity: 0.95,
                  }}
                />
              </div>
            </div>
            <div />
          </div>

          <Card
            style={{
              width: '100%',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
              padding: '1.6rem 1.75rem 1.75rem',
            }}
            bodyStyle={{ padding: 0 }}
          >
            <Form
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                deliveryMode: 'ELECTRONIC',
                ...(magazineIdParam ? { magazineId: Number(magazineIdParam) } : {}),
              }}
              form={form}
              onValuesChange={(_, all) => {
                if (all.magazineId != null) {
                  setSelectedMagazineId(Number(all.magazineId));
                  // when magazine changes, clear previously selected plan & months
                  setSelectedPlanId(null);
                  form.setFieldValue('planId', undefined);
                  form.setFieldValue('months', undefined);
                }
                if (all.planId != null) {
                  setSelectedPlanId(Number(all.planId));
                  const plan = plans.find((p) => p.id === all.planId);
                  if (plan) form.setFieldValue('months', plan.minMonths ?? 1);
                }
                if (all.deliveryMode != null) {
                  // only update mode; keep current plan selection if still valid
                  setDeliveryMode(all.deliveryMode);
                }
              }}
              style={{ padding: '0 0.25rem' }}
            >
              <Form.Item
                name="magazineId"
                label="Magazine"
                rules={[{ required: true, message: 'Select a magazine' }]}
              >
                <Select
                  placeholder="Select magazine"
                  allowClear={false}
                  options={magazines.map((m: any) => ({ label: m.title, value: m.id }))}
                  onChange={(v) => setSelectedMagazineId(v ? Number(v) : null)}
                />
              </Form.Item>
              <Form.Item
                name="deliveryMode"
                label="Delivery type"
                rules={[{ required: true }]}
                initialValue="ELECTRONIC"
              >
                <Radio.Group options={DELIVERY_OPTIONS} onChange={() => setSelectedPlanId(null)} />
              </Form.Item>
              <Form.Item
                name="planId"
                label="Plan"
                rules={[{ required: true, message: 'Select a plan' }]}
                extra={
                  deliveryMode && selectedMagazineId
                    ? `Prices shown for ${deliveryMode === 'ELECTRONIC' ? 'E-Magazine' : deliveryMode === 'PHYSICAL' ? 'Physical' : 'Both'}`
                    : undefined
                }
              >
                <Select
                  placeholder={
                    selectedMagazineId
                      ? deliveryMode
                        ? filteredPlans.length
                          ? 'Select a plan'
                          : 'No plans for this delivery type'
                        : 'Select delivery type first'
                      : 'Select a magazine first'
                  }
                  disabled={!selectedMagazineId || !deliveryMode}
                  options={filteredPlans.map((p) => {
                    const price = p.prices?.[deliveryMode]?.price ?? p.price ?? 0;
                    const curr = p.prices?.[deliveryMode]?.currency ?? p.currency ?? 'INR';
                    const monthsLabel =
                      p.minMonths === p.maxMonths && p.maxMonths
                        ? `${p.minMonths} mo`
                        : p.maxMonths
                          ? `${p.minMonths}-${p.maxMonths} mo`
                          : `${p.minMonths}+ mo`;
                    return {
                      label: `${p.name} (${monthsLabel}) - ${curr === 'INR' ? '₹' : ''}${Number(price).toFixed(2)} ${curr}/mo`,
                      value: p.id,
                    };
                  })}
                  onChange={(v) => {
                    // ensure form field actually gets the value Ant Design validates
                    form.setFieldValue('planId', v);
                    setSelectedPlanId(v ? Number(v) : null);
                    const plan = plans.find((p) => p.id === v);
                    if (plan) {
                      form.setFieldValue('months', plan.minMonths ?? 1);
                    }
                    // clear any previous validation error once user picks a plan
                    form.setFields([{ name: 'planId', errors: [] }]);
                    // re-validate this field so the red message disappears
                    form.validateFields(['planId']).catch(() => {});
                  }}
                />
              </Form.Item>
              {selectedPlan && (
                <div
                  style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}
                >
                  <strong>Price:</strong> {currency === 'INR' ? '₹' : ''}
                  {Number(price).toFixed(2)} {currency} per month
                  {needsAddress && (
                    <Alert
                      type="info"
                      message="Physical delivery requires a shipping address. Please ensure your profile has an address saved."
                      style={{ marginTop: 12 }}
                      showIcon
                    />
                  )}
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 16,
                }}
              >
                <Form.Item
                  name="months"
                  label="Months"
                  rules={[{ required: true, message: 'Select months' }]}
                  extra={
                    selectedPlan && minMonths === maxMonths && maxMonths
                      ? 'Fixed duration for this plan'
                      : undefined
                  }
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={minMonths}
                    max={maxMonths ?? undefined}
                    disabled={!!selectedPlan && minMonths === maxMonths && !!maxMonths}
                  />
                </Form.Item>
                <Form.Item name="couponCode" label="Coupon code">
                  <Input />
                </Form.Item>
              </div>
              <Form.Item style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="default"
                  htmlType="submit"
                  style={{
                    background: 'var(--btn-view-green, #2d7a3e)',
                    borderColor: 'var(--btn-view-green, #2d7a3e)',
                    color: '#fff',
                    // left: '500px',

                    fontWeight: 700,
                    borderRadius: 10,
                    paddingInline: 18,
                  }}
                >
                  Continue
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </main>
  );
}
