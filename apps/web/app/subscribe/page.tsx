'use client';
import { Card, Form, Select, InputNumber, Button, Input, message, Radio, Alert, Tag } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { CouponCelebration } from '../../components/CouponCelebration';
import subscribeImg from '../../components/images/subscribe.png';
import { useAuth } from '../../lib/authContext';
import { startRazorpayCheckout } from '../../lib/razorpayCheckout';
import { isChildAudience } from '../../lib/viewingContext';

const DELIVERY_OPTIONS = [
  { value: 'ELECTRONIC', label: 'E-Magazine only (digital access)' },
  // { value: 'PHYSICAL', label: 'Physical copy only' },
  { value: 'BOTH', label: 'Both (E-Magazine + Physical)' },
];

type AvailableCoupon = {
  id: number;
  code: string;
  description?: string | null;
  discountPct?: number | null;
  discountFixed?: number | null;
  label: string;
};

export default function SubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loggedIn, loading: authLoading, refreshAuth } = useAuth();
  const magazineIdParam = searchParams?.get('magazineId');
  const groupParam = searchParams?.get('group');
  const [form] = Form.useForm();
  const [plans, setPlans] = React.useState<any[]>([]);
  const [magazines, setMagazines] = React.useState<any[]>([]);
  const [selectedMagazineId, setSelectedMagazineId] = React.useState<number | null>(
    magazineIdParam ? Number(magazineIdParam) : null,
  );
  const [deliveryMode, setDeliveryMode] = React.useState<'ELECTRONIC' | 'PHYSICAL' | 'BOTH'>(
    'ELECTRONIC',
  );
  const [selectedPlanId, setSelectedPlanId] = React.useState<number | null>(null);
  const [childMode, setChildMode] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [couponApplying, setCouponApplying] = React.useState(false);
  const [couponPreview, setCouponPreview] = React.useState<{
    code: string;
    amount: number;
    finalAmount: number;
    discountAmount: number;
    currency: string;
    message: string;
  } | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = React.useState<AvailableCoupon[]>([]);
  const [celebrateId, setCelebrateId] = React.useState(0);
  const [celebrateCopy, setCelebrateCopy] = React.useState<{ title: string; subtitle: string }>({
    title: 'Coupon unlocked!',
    subtitle: '',
  });

  // After auth settles: no valid session → guest checkout fields
  const needsGuestDetails = !authLoading && !loggedIn;

  React.useEffect(() => {
    setChildMode(isChildAudience());
  }, []);

  React.useEffect(() => {
    if (childMode) {
      message.info('Subscribe is not available in child mode.');
      router.replace('/dashboard');
    }
  }, [childMode, router]);

  React.useEffect(() => {
    axios.get('/api/magazines').then((r) => setMagazines(r.data || []));
  }, []);

  React.useEffect(() => {
    if (!magazines.length) return;

    if (magazineIdParam) {
      const id = Number(magazineIdParam);
      if (!Number.isFinite(id)) return;
      const exists = magazines.some((m: { id: number }) => Number(m.id) === id);
      if (!exists) return;
      form.setFieldsValue({ magazineId: id });
      setSelectedMagazineId(id);
      return;
    }

    if (groupParam) {
      const groupNum = Number(groupParam);
      if (!Number.isFinite(groupNum)) return;
      const byTitle = magazines.find((m: { title?: string }) =>
        new RegExp(`\\bGroup\\s*${groupNum}\\b`, 'i').test(String(m.title || '')),
      );
      const sorted = [...magazines].sort(
        (a: { id: number }, b: { id: number }) => Number(a.id) - Number(b.id),
      );
      const matched = byTitle ?? sorted[groupNum - 1];
      if (!matched) return;
      const id = Number(matched.id);
      form.setFieldsValue({ magazineId: id });
      setSelectedMagazineId(id);
    }
  }, [form, groupParam, magazineIdParam, magazines]);

  React.useEffect(() => {
    const id = selectedMagazineId;
    if (!id) {
      setPlans([]);
      return;
    }
    axios.get(`/api/subscriptions/plans?magazineId=${id}`).then((r) => setPlans(r.data || []));
  }, [selectedMagazineId]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (selectedMagazineId) params.set('magazineId', String(selectedMagazineId));
    if (selectedPlanId) params.set('planId', String(selectedPlanId));
    const qs = params.toString();
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    axios
      .get(`/api/coupons/available${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      .then((r) => setAvailableCoupons(r.data || []))
      .catch(() => setAvailableCoupons([]));
  }, [selectedMagazineId, selectedPlanId, loggedIn]);

  // Show plans that have a price for the selected delivery type (not only by plan.deliveryMode).
  // This way plans with prices.PHYSICAL show under "Physical", prices.BOTH under "Both", etc.
  const filteredPlans = plans.filter(
    (p) =>
      p.prices &&
      typeof p.prices[deliveryMode] === 'object' &&
      p.prices[deliveryMode]?.price != null,
  );
  const selectedPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : null;
  const price = selectedPlan?.prices?.[deliveryMode]?.price ?? selectedPlan?.price ?? 0;
  const currency =
    selectedPlan?.prices?.[deliveryMode]?.currency ?? selectedPlan?.currency ?? 'INR';
  const needsAddress = deliveryMode === 'PHYSICAL' || deliveryMode === 'BOTH';
  const minMonths = selectedPlan?.minMonths ?? 1;
  const maxMonths = selectedPlan?.maxMonths;
  const isFixedDuration = maxMonths != null && minMonths === maxMonths;
  const monthsValue = Form.useWatch('months', form) ?? minMonths;
  const totalPrice = isFixedDuration ? Number(price) : Number(price) * Number(monthsValue);

  function clearCouponPreview() {
    setCouponPreview(null);
    setCouponError(null);
  }

  async function applyCoupon(codeOverride?: string) {
    const code = String(codeOverride ?? form.getFieldValue('couponCode') ?? '')
      .trim()
      .toUpperCase();
    const planId = form.getFieldValue('planId') ?? selectedPlanId;
    const months = form.getFieldValue('months') ?? monthsValue;
    const magazineId = form.getFieldValue('magazineId') ?? selectedMagazineId;

    if (!code) {
      setCouponError('Enter a coupon code');
      setCouponPreview(null);
      return;
    }
    if (!planId || !months || !magazineId) {
      setCouponError('Select magazine, plan and months first');
      setCouponPreview(null);
      return;
    }

    form.setFieldValue('couponCode', code);
    setCouponApplying(true);
    setCouponError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const { data } = await axios.post(
        '/api/payments/validate-coupon',
        {
          couponCode: code,
          planId: Number(planId),
          magazineId: Number(magazineId),
          months: Number(months),
          deliveryMode,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      setCouponPreview({
        code,
        amount: Number(data.amount),
        finalAmount: Number(data.finalAmount),
        discountAmount: Number(data.discountAmount),
        currency: data.currency || currency,
        message: data.message || 'Coupon applied',
      });
      const saved = Number(data.discountAmount || 0);
      const curr = data.currency || currency || 'INR';
      const savedLabel =
        curr === 'INR' ? `You saved ₹${saved.toFixed(2)}` : `You saved ${saved.toFixed(2)} ${curr}`;
      setCelebrateCopy({
        title: `${code} applied!`,
        subtitle: `${savedLabel} · Now ${curr === 'INR' ? '₹' : ''}${Number(data.finalAmount).toFixed(2)}`,
      });
      setCelebrateId((n) => n + 1);
      message.success(data.message || 'Coupon applied');
    } catch (e: any) {
      setCouponPreview(null);
      const msg =
        e.response?.data?.message || e.response?.data?.error || e.message || 'Invalid coupon';
      setCouponError(msg);
      message.error(msg);
    } finally {
      setCouponApplying(false);
    }
  }

  async function onFinish(values: any) {
    const magazineId = values.magazineId
      ? Number(values.magazineId)
      : magazineIdParam
        ? Number(magazineIdParam)
        : undefined;
    if (!magazineId) {
      message.error('Please select a magazine to subscribe');
      return;
    }

    setSubmitting(true);
    try {
      // Re-validate session so expired tokens logout before checkout
      await refreshAuth();

      const stillLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('access_token');
      const useGuest = !stillLoggedIn;

      // Session expired while the logged-in form was showing — send to login
      if (useGuest && !needsGuestDetails) {
        message.error('Your session expired. Please sign in again.');
        const path = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?redirect=${encodeURIComponent(path)}`;
        return;
      }

      const rawCoupon = String(values.couponCode || '').trim();
      const mode = values.deliveryMode ?? deliveryMode;
      const needsShipping = mode === 'PHYSICAL' || mode === 'BOTH';
      const shipping = needsShipping
        ? {
            deliveryAddress: String(values.deliveryAddress || '').trim(),
            city: String(values.city || '').trim(),
            state: String(values.state || '').trim() || undefined,
            pincode: String(values.pincode || '').trim(),
          }
        : undefined;

      const checkoutResult = await startRazorpayCheckout(
        {
          planId: Number(values.planId),
          magazineId,
          months: Number(values.months),
          deliveryMode: mode,
          couponCode: rawCoupon || undefined,
          shipping,
          guest: useGuest
            ? {
                name: values.fullName,
                phone: values.mobile,
                email: values.email,
                deliveryAddress: shipping?.deliveryAddress,
                city: shipping?.city,
                state: shipping?.state,
                pincode: shipping?.pincode,
              }
            : undefined,
        },
        router,
      );
      if (useGuest) {
        if (checkoutResult.acknowledgementSent) {
          message.success('Acknowledgement sent to your email. Opening payment…');
        } else {
          message.success('Order created — opening payment…');
          message.warning(
            "We couldn't send the acknowledgement email right now. You can still complete payment.",
            6,
          );
        }
      } else {
        message.success('Order created — opening payment…');
      }
    } catch (e: any) {
      const errCode = e.response?.data?.error;
      const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'failed';
      if (errCode === 'already_purchased_magazine') {
        message.warning(msg);
      } else if (
        e.message === 'login_required' ||
        errCode === 'missing_authorization' ||
        errCode === 'token_expired' ||
        errCode === 'invalid_token' ||
        e?.response?.status === 401
      ) {
        message.error('Your session expired. Please sign in again.');
      } else {
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        // padding: '1.25rem 0 2.25rem',
        minHeight: '80vh',
      }}
    >
      <CouponCelebration
        key={celebrateId}
        active={celebrateId > 0}
        title={celebrateCopy.title}
        subtitle={celebrateCopy.subtitle}
      />
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
              onValuesChange={(changed) => {
                // Only react to fields the user actually changed — using `all`
                // would wipe plan/months whenever guest name/email/phone is typed.
                if ('magazineId' in changed) {
                  const id = changed.magazineId != null ? Number(changed.magazineId) : null;
                  setSelectedMagazineId(id);
                  setSelectedPlanId(null);
                  form.setFieldsValue({ planId: undefined, months: undefined });
                  clearCouponPreview();
                }
                if ('planId' in changed) {
                  const planId = changed.planId != null ? Number(changed.planId) : null;
                  setSelectedPlanId(planId);
                  const plan = planId != null ? plans.find((p) => p.id === planId) : null;
                  if (plan) form.setFieldValue('months', plan.minMonths ?? 1);
                  clearCouponPreview();
                }
                if ('deliveryMode' in changed && changed.deliveryMode != null) {
                  setDeliveryMode(changed.deliveryMode);
                  // Plan prices differ by delivery type — reset plan selection
                  setSelectedPlanId(null);
                  form.setFieldsValue({ planId: undefined, months: undefined });
                  clearCouponPreview();
                }
                if ('months' in changed) {
                  clearCouponPreview();
                }
                if ('couponCode' in changed && couponPreview) {
                  const next = String(changed.couponCode || '')
                    .trim()
                    .toUpperCase();
                  if (next !== couponPreview.code) clearCouponPreview();
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
                  options={magazines.map((m: any) => ({ label: m.title, value: Number(m.id) }))}
                  onChange={(v) => setSelectedMagazineId(v ? Number(v) : null)}
                />
              </Form.Item>
              <Form.Item
                name="deliveryMode"
                label="Delivery type"
                rules={[{ required: true }]}
                initialValue="ELECTRONIC"
              >
                <Radio.Group options={DELIVERY_OPTIONS} />
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
                    const fixed = p.maxMonths != null && p.minMonths === p.maxMonths;
                    const priceLabel = fixed
                      ? `${curr === 'INR' ? '₹' : ''}${Number(price).toFixed(2)} ${curr} total`
                      : `${curr === 'INR' ? '₹' : ''}${Number(price).toFixed(2)} ${curr}/mo`;
                    return {
                      label: `${p.name} (${monthsLabel}) - ${priceLabel}`,
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
                  <strong>Price:</strong>{' '}
                  {isFixedDuration ? (
                    <>
                      {currency === 'INR' ? '₹' : ''}
                      {Number(price).toFixed(2)} {currency} total for {maxMonths} months
                    </>
                  ) : (
                    <>
                      {currency === 'INR' ? '₹' : ''}
                      {Number(price).toFixed(2)} {currency} per month
                      {monthsValue > 1 && (
                        <>
                          {' '}
                          ({currency === 'INR' ? '₹' : ''}
                          {totalPrice.toFixed(2)} total)
                        </>
                      )}
                    </>
                  )}
                  {couponPreview && (
                    <div style={{ marginTop: 8, color: '#2d7a3e', fontWeight: 600 }}>
                      Coupon {couponPreview.code}: −{couponPreview.currency === 'INR' ? '₹' : ''}
                      {couponPreview.discountAmount.toFixed(2)} →{' '}
                      {couponPreview.currency === 'INR' ? '₹' : ''}
                      {couponPreview.finalAmount.toFixed(2)} {couponPreview.currency}
                    </div>
                  )}
                  {needsAddress && (
                    <Alert
                      type="info"
                      message="Physical delivery requires a shipping address below."
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
                <Form.Item
                  name="couponCode"
                  label="Coupon code"
                  validateStatus={couponError ? 'error' : couponPreview ? 'success' : undefined}
                  help={couponError || (couponPreview ? couponPreview.message : undefined)}
                >
                  <Input.Search
                    placeholder="Enter coupon"
                    enterButton="Apply"
                    loading={couponApplying}
                    onSearch={() => applyCoupon()}
                    onPressEnter={(e) => {
                      e.preventDefault();
                      applyCoupon();
                    }}
                  />
                </Form.Item>
              </div>

              {availableCoupons.length > 0 && (
                <div style={{ marginTop: -8, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: '#5c4a3a', marginBottom: 8 }}>
                    Available coupons — click to apply
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableCoupons.map((c) => {
                      const selected = couponPreview?.code === c.code;
                      return (
                        <Tag
                          key={c.id}
                          color={selected ? 'success' : undefined}
                          style={{
                            cursor: couponApplying ? 'wait' : 'pointer',
                            padding: '4px 10px',
                            fontSize: 13,
                            borderRadius: 8,
                            borderColor: selected ? '#2d7a3e' : 'rgba(61,41,20,0.25)',
                            background: selected ? 'rgba(45,122,62,0.1)' : '#fff',
                            color: '#3d2914',
                            userSelect: 'none',
                          }}
                          onClick={() => {
                            if (!couponApplying) applyCoupon(c.code);
                          }}
                          title={c.description || c.label}
                        >
                          {c.label}
                        </Tag>
                      );
                    })}
                  </div>
                </div>
              )}

              {!needsGuestDetails ? null : (
                <div
                  style={{
                    marginTop: 8,
                    marginBottom: 8,
                    padding: '14px 14px 4px',
                    borderRadius: 12,
                    background: 'rgba(61, 41, 20, 0.04)',
                    border: '1px solid rgba(61, 41, 20, 0.12)',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontWeight: 700,
                      color: '#3d2914',
                      fontSize: 14,
                    }}
                  >
                    Your contact details
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5c4a3a' }}>
                    We&apos;ll send an acknowledgement now, and a purchase confirmation after
                    successful payment.
                  </p>
                  <Form.Item
                    name="fullName"
                    label="Full Name"
                    rules={[
                      { required: true, message: 'Enter your full name' },
                      { min: 2, message: 'Name is too short' },
                    ]}
                  >
                    <Input placeholder="Parent / guardian full name" autoComplete="name" />
                  </Form.Item>
                  <Form.Item
                    name="mobile"
                    label="Mobile Number"
                    rules={[
                      { required: true, message: 'Enter your mobile number' },
                      {
                        pattern: /^(\+?91[-\s]?)?[6-9]\d{9}$/,
                        message: 'Enter a valid 10-digit Indian mobile number',
                      },
                    ]}
                  >
                    <Input placeholder="10-digit mobile number" autoComplete="tel" />
                  </Form.Item>
                  <Form.Item
                    name="email"
                    label="Email Address"
                    rules={[
                      { required: true, message: 'Enter your email address' },
                      { type: 'email', message: 'Enter a valid email' },
                    ]}
                  >
                    <Input placeholder="you@example.com" autoComplete="email" />
                  </Form.Item>
                </div>
              )}

              {needsAddress ? (
                <div
                  style={{
                    marginTop: 8,
                    marginBottom: 8,
                    padding: '14px 14px 4px',
                    borderRadius: 12,
                    background: 'rgba(61, 41, 20, 0.04)',
                    border: '1px solid rgba(61, 41, 20, 0.12)',
                  }}
                >
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontWeight: 700,
                      color: '#3d2914',
                      fontSize: 14,
                    }}
                  >
                    Delivery address
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5c4a3a' }}>
                    Required for physical magazine delivery.
                  </p>
                  <Form.Item
                    name="deliveryAddress"
                    label="Address"
                    rules={[
                      { required: true, message: 'Enter your delivery address' },
                      { min: 8, message: 'Please enter a complete address' },
                    ]}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="House / flat, street, area, landmark"
                      autoComplete="street-address"
                    />
                  </Form.Item>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                      gap: 16,
                    }}
                  >
                    <Form.Item
                      name="city"
                      label="City"
                      rules={[{ required: true, message: 'Enter your city' }]}
                    >
                      <Input placeholder="City" autoComplete="address-level2" />
                    </Form.Item>
                    <Form.Item name="state" label="State">
                      <Input placeholder="State" autoComplete="address-level1" />
                    </Form.Item>
                  </div>
                  <Form.Item
                    name="pincode"
                    label="PIN Code"
                    rules={[
                      { required: true, message: 'Enter PIN code' },
                      { pattern: /^\d{6}$/, message: 'Enter a valid 6-digit PIN code' },
                    ]}
                  >
                    <Input
                      placeholder="6-digit PIN code"
                      autoComplete="postal-code"
                      maxLength={6}
                    />
                  </Form.Item>
                </div>
              ) : null}

              <Form.Item style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="default"
                  htmlType="submit"
                  loading={submitting}
                  style={{
                    background: 'var(--btn-view-green, #2d7a3e)',
                    borderColor: 'var(--btn-view-green, #2d7a3e)',
                    color: '#fff',
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
