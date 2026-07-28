'use client';

import { Button, Card, Alert } from 'antd';
import axios from 'axios';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import React from 'react';
import { readGuestPrefill } from '../../lib/razorpayCheckout';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface UserPrefill {
  name?: string;
  email?: string;
  phone?: string;
}

function formatContactForRazorpay(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits || undefined;
}

export default function RazorpayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rpOrderId = searchParams?.get('rpOrderId') ?? '';
  const orderId = searchParams?.get('orderId') ?? '';
  const amount = searchParams?.get('amount') ?? '';
  const currency = searchParams?.get('currency') ?? 'INR';
  const autoOpen = searchParams?.get('auto') === '1';

  const [scriptReady, setScriptReady] = React.useState(false);
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const [failureResponse, setFailureResponse] = React.useState<any>(null);
  const [confirmStatus, setConfirmStatus] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const [userPrefill, setUserPrefill] = React.useState<UserPrefill | null>(null);
  const [userPrefillLoaded, setUserPrefillLoaded] = React.useState(false);
  const autoOpenedRef = React.useRef(false);
  const canPay = Boolean(key && rpOrderId && amount && scriptReady);

  React.useEffect(() => {
    const guest = readGuestPrefill();
    if (guest) {
      setUserPrefill({
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
      });
      setUserPrefillLoaded(true);
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setUserPrefillLoaded(true);
      return;
    }

    axios
      .get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setUserPrefill({
          name: data?.name,
          email: data?.email,
          phone: data?.phone || data?.guardians?.[0]?.phone,
        });
      })
      .catch(() => {})
      .finally(() => setUserPrefillLoaded(true));
  }, []);

  async function savePaymentToOrder(response: any) {
    if (!orderId) {
      setConfirmStatus('failed');
      setConfirmError('missing_orderId');
      return;
    }

    setConfirmStatus('saving');
    setConfirmError(null);
    try {
      const token = localStorage.getItem('access_token');
      // Guest checkout orders are confirmed by Razorpay signature (no JWT required)
      const useGuestConfirm = Boolean(readGuestPrefill()) || !token;
      const endpoint = useGuestConfirm
        ? '/api/payments/razorpay/guest-confirm'
        : '/api/payments/razorpay/confirm';
      const config =
        !useGuestConfirm && token
          ? { withCredentials: true, headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
          : { withCredentials: true, timeout: 60000 };

      await axios.post(
        endpoint,
        {
          orderId: Number(orderId),
          razorpay_payment_id: response?.razorpay_payment_id,
          razorpay_order_id: response?.razorpay_order_id,
          razorpay_signature: response?.razorpay_signature,
        },
        config,
      );
      setConfirmStatus('saved');
      // Guest checkout has no session yet — library would look empty; send users to Browse
      setTimeout(() => {
        router.push('/magazines');
      }, 1500);
    } catch (e: any) {
      setConfirmStatus('failed');
      setConfirmError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Failed to save payment. Please contact support with your payment ID.',
      );
      // Do not rethrow — Razorpay handler would surface a Next.js error overlay
    }
  }

  function openCheckout(e?: React.MouseEvent) {
    e?.preventDefault();
    if (!key) return;
    if (!rpOrderId) return;
    if (!amount) return;
    if (!window.Razorpay) return;
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
        await savePaymentToOrder(response);
      },
      prefill: {
        name: userPrefill?.name || undefined,
        email: userPrefill?.email || undefined,
        contact: formatContactForRazorpay(userPrefill?.phone),
      },
      notes: {
        orderId: String(orderId),
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

  React.useEffect(() => {
    if (!autoOpen || !canPay || !userPrefillLoaded || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    openCheckout();
  }, [autoOpen, canPay, userPrefillLoaded]);

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
              {confirmStatus !== 'saved' && (
                <div>
                  <strong>Amount:</strong> {amount ? `₹${amount} ${currency}` : '-'}
                </div>
              )}

              {confirmStatus === 'saved' && (
                <div style={{ marginTop: 8 }}>
                  <Alert
                    type="success"
                    showIcon
                    message="Payment successful"
                    description="Your subscription has been saved and activated."
                  />
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

              {failureResponse?.error && (
                <div style={{ marginTop: 8 }}>
                  <Alert
                    type="error"
                    showIcon
                    message="Payment failed"
                    description={
                      failureResponse.error.description ||
                      failureResponse.error.reason ||
                      'Something went wrong. Please try again.'
                    }
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <Button
                  onClick={() =>
                    confirmStatus === 'saved' ? router.push('/magazines') : router.back()
                  }
                >
                  {confirmStatus === 'saved' ? 'Browse Magazines' : 'Back'}
                </Button>
                {confirmStatus !== 'saved' && (
                  <Button
                    id="rzp-button1"
                    type="primary"
                    disabled={!canPay || confirmStatus === 'saving'}
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
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
