'use client';

import { Button, Spin, message } from 'antd';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import React from 'react';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type Offer = {
  purchaseCode: string;
  bookName: string;
  courseName: string;
  collegeName: string;
  accessModel: string;
  seatCount: number;
  amount: number;
  currency: string;
  paymentStatus: string;
  upi: string;
  upiVpa: string;
  razorpayEnabled: boolean;
  razorpayKeyId: string | null;
};

function rupees(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayLicenseClient() {
  const params = useParams();
  const code = String(params?.code || '');
  const [offer, setOffer] = React.useState<Offer | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [scriptReady, setScriptReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Razorpay) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      setScriptReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setScriptReady(true);
    document.body.appendChild(script);
  }, []);

  React.useEffect(() => {
    if (!code) return;
    let cancelled = false;
    axios
      .get(`/api/payments/institute-lot/${encodeURIComponent(code)}`)
      .then((r) => {
        if (!cancelled) setOffer(r.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.message || 'This payment link is not valid.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const payCard = async () => {
    if (!offer) return;
    try {
      const { data } = await axios.post(
        `/api/payments/institute-lot/${encodeURIComponent(code)}/razorpay`,
      );
      if (data.alreadyPaid) {
        setOffer({ ...offer, paymentStatus: 'PAID' });
        message.success('Already paid.');
        return;
      }
      const key = data.razorpayKeyId || offer.razorpayKeyId;
      if (!key || !data.rpOrderId || !window.Razorpay) {
        message.error('Card payment is not ready. Use UPI below.');
        return;
      }
      const rzp = new window.Razorpay({
        key,
        amount: String(Math.round(Number(data.amount) * 100)),
        currency: data.currency || 'INR',
        name: 'VidhyaVibe',
        description: offer.bookName,
        order_id: data.rpOrderId,
        handler: async (response: any) => {
          try {
            await axios.post(`/api/payments/institute-lot/${encodeURIComponent(code)}/confirm`, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            setOffer({ ...offer, paymentStatus: 'PAID' });
            message.success('Payment received. Thank you.');
          } catch (e: any) {
            message.error(e.response?.data?.message || 'Payment succeeded but was not recorded.');
          }
        },
        theme: { color: '#2d7a3e' },
      });
      rzp.open();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Could not start card payment.');
    }
  };

  if (loading) {
    return (
      <main className="container" style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }
  if (error || !offer) {
    return (
      <main className="container" style={{ padding: '48px 16px', maxWidth: 560 }}>
        <h1 className="course-page-title">Payment link</h1>
        <p className="course-page-lead">{error || 'Not found.'}</p>
      </main>
    );
  }

  const paid = offer.paymentStatus === 'PAID';
  const model = offer.accessModel === 'LIBRARY' ? 'Library seats' : 'Book bank copies';

  return (
    <main className="container" style={{ padding: '24px 16px 64px', maxWidth: 560 }}>
      <h1 className="course-page-title">{paid ? 'Payment received' : 'Pay for textbook licenses'}</h1>
      <p className="course-page-lead">
        {offer.collegeName}
        {offer.courseName ? ` · ${offer.courseName}` : ''}
      </p>
      <div className="course-buy-panel">
        <strong>{offer.bookName}</strong>
        <p>
          {model} · {offer.seatCount} license{offer.seatCount === 1 ? '' : 's'}
        </p>
        <p style={{ fontSize: 22, fontWeight: 700, margin: '12px 0' }}>{rupees(offer.amount)}</p>
        {paid ? (
          <p>Thank you. VidhyaVibe has recorded this payment.</p>
        ) : (
          <>
            {offer.razorpayEnabled ? (
              <Button
                type="primary"
                size="large"
                onClick={payCard}
                disabled={!scriptReady}
                style={{ marginBottom: 16 }}
              >
                Pay {rupees(offer.amount)} by card / UPI
              </Button>
            ) : null}
            {offer.upi && offer.upiVpa ? (
              <>
                <p>Or scan this VidhyaVibe UPI QR / pay to {offer.upiVpa}</p>
                <div
                  style={{
                    display: 'inline-block',
                    padding: 10,
                    background: '#fff',
                    margin: '12px 0',
                  }}
                >
                  <QRCodeCanvas value={offer.upi} size={200} includeMargin />
                </div>
              </>
            ) : (
              <p>UPI QR is not set. Use the button above, or ask VidhyaVibe to add their UPI ID.</p>
            )}
            <p style={{ fontSize: 12, color: '#667085' }}>Reference: {offer.purchaseCode}</p>
          </>
        )}
      </div>
    </main>
  );
}
