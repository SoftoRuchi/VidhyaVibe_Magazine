'use client';

import { Button, Card, Alert } from 'antd';
import axios from 'axios';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import React from 'react';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function RazorpayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rpOrderId = searchParams?.get('rpOrderId') ?? '';
  const orderId = searchParams?.get('orderId') ?? '';
  const amount = searchParams?.get('amount') ?? '';
  const currency = searchParams?.get('currency') ?? 'INR';

  const [scriptReady, setScriptReady] = React.useState(false);
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const [successResponse, setSuccessResponse] = React.useState<{
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  } | null>(null);
  const [failureResponse, setFailureResponse] = React.useState<any>(null);
  const [confirmStatus, setConfirmStatus] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const canPay = Boolean(key && rpOrderId && amount && scriptReady);

  async function savePaymentToOrder(response: any) {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('unauthenticated');
    if (!orderId) throw new Error('missing_orderId');

    setConfirmStatus('saving');
    setConfirmError(null);
    try {
      await axios.post(
        '/api/payments/razorpay/confirm',
        {
          orderId: Number(orderId),
          razorpay_payment_id: response?.razorpay_payment_id,
          razorpay_order_id: response?.razorpay_order_id,
          razorpay_signature: response?.razorpay_signature,
        },
        { withCredentials: true, headers: { Authorization: `Bearer ${token}` } },
      );
      setConfirmStatus('saved');
    } catch (e: any) {
      setConfirmStatus('failed');
      setConfirmError(e?.response?.data?.message || e?.message || 'save_failed');
      throw e;
    }
  }

  function openCheckout(e?: React.MouseEvent) {
    e?.preventDefault();
    if (!key) return;
    if (!rpOrderId) return;
    if (!amount) return;
    if (!window.Razorpay) return;
    setSuccessResponse(null);
    setFailureResponse(null);
    setConfirmStatus('idle');
    setConfirmError(null);

    const options = {
      key,
      amount: String(amount),
      currency: String(currency),
      name: 'VidhyaVibe',
      description: 'Subscription Payment',
      order_id: String(rpOrderId),
      handler: async function (response: any) {
        setSuccessResponse({
          razorpay_payment_id: response?.razorpay_payment_id,
          razorpay_order_id: response?.razorpay_order_id,
          razorpay_signature: response?.razorpay_signature,
        });
        await savePaymentToOrder(response);
      },
      prefill: {},
      notes: {
        address: 'Razorpay Corporate Office',
      },
      theme: {
        color: '#3399cc',
      },
    };

    const rzp1 = new window.Razorpay(options);
    rzp1.on('payment.failed', function (response: any) {
      setFailureResponse(response);
    });
    rzp1.open();
  }

  return (
    <main style={{ minHeight: '80vh' }}>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720, marginTop: 24 }}>
          <Card
            style={{
              width: '100%',
              borderRadius: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(61,41,20,0.18)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
            }}
          >
            {!key && (
              <Alert
                type="error"
                showIcon
                message="Missing Razorpay key"
                description="Set NEXT_PUBLIC_RAZORPAY_KEY_ID for the web app."
                style={{ marginBottom: 16 }}
              />
            )}

            {!rpOrderId && (
              <Alert
                type="warning"
                showIcon
                message="Missing rpOrderId"
                description="Please go back and create an order first."
                style={{ marginBottom: 16 }}
              />
            )}

            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <strong>Razorpay Order ID:</strong> {rpOrderId || '-'}
              </div>
              <div>
                <strong>Local Order ID:</strong> {orderId || '-'}
              </div>
              <div>
                <strong>Amount:</strong> {amount || '-'} {currency}
              </div>

              {confirmStatus === 'saved' && (
                <div style={{ marginTop: 8 }}>
                  <Alert type="success" showIcon message="Saved to order and marked as PAID" />
                </div>
              )}
              {confirmStatus === 'saving' && (
                <div style={{ marginTop: 8 }}>
                  <Alert type="info" showIcon message="Saving payment to order..." />
                </div>
              )}
              {confirmStatus === 'failed' && (
                <div style={{ marginTop: 8 }}>
                  <Alert
                    type="error"
                    showIcon
                    message="Failed to save payment to order"
                    description={confirmError || undefined}
                  />
                </div>
              )}

              {successResponse && (
                <div style={{ marginTop: 8 }}>
                  <Alert
                    type="success"
                    showIcon
                    message="Payment successful"
                    description={
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div>
                          <strong>Payment ID:</strong> {successResponse.razorpay_payment_id || '-'}
                        </div>
                        <div>
                          <strong>Order ID:</strong> {successResponse.razorpay_order_id || '-'}
                        </div>
                        <div style={{ wordBreak: 'break-all' }}>
                          <strong>Signature:</strong> {successResponse.razorpay_signature || '-'}
                        </div>
                      </div>
                    }
                  />
                </div>
              )}

              {failureResponse?.error && (
                <div style={{ marginTop: 8 }}>
                  <Alert
                    type="error"
                    showIcon
                    message="Payment failed"
                    description={
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div>
                          <strong>Code:</strong> {failureResponse.error.code ?? '-'}
                        </div>
                        <div>
                          <strong>Description:</strong> {failureResponse.error.description ?? '-'}
                        </div>
                        <div>
                          <strong>Source:</strong> {failureResponse.error.source ?? '-'}
                        </div>
                        <div>
                          <strong>Step:</strong> {failureResponse.error.step ?? '-'}
                        </div>
                        <div>
                          <strong>Reason:</strong> {failureResponse.error.reason ?? '-'}
                        </div>
                        <div>
                          <strong>Order ID:</strong>{' '}
                          {failureResponse.error?.metadata?.order_id ?? '-'}
                        </div>
                        <div>
                          <strong>Payment ID:</strong>{' '}
                          {failureResponse.error?.metadata?.payment_id ?? '-'}
                        </div>
                      </div>
                    }
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <Button onClick={() => router.back()}>Back</Button>
                <Button
                  id="rzp-button1"
                  type="primary"
                  disabled={!canPay}
                  onClick={openCheckout}
                  style={{
                    background: 'var(--btn-view-green, #2d7a3e)',
                    borderColor: 'var(--btn-view-green, #2d7a3e)',
                    fontWeight: 700,
                    borderRadius: 10,
                    paddingInline: 18,
                  }}
                >
                  Pay
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
