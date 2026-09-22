'use client';

import { Button, Spin, message } from 'antd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { QRCodeCanvas } from 'qrcode.react';
import React from 'react';
import { CourseAccessBlocked, CourseHero } from '../../../../../../components/CourseBrowse';
import { useAuth } from '../../../../../../lib/authContext';
import {
  confirmBookPurchase,
  courseLoginHref,
  fetchBookOffer,
  fetchSemester,
  formatBookPrice,
  purchaseBook,
  uploadBookPurchaseProof,
  type BookCheckout,
  type BookOffer,
} from '../../../../../../lib/coursesApi';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function CourseBookBuyPage() {
  const params = useParams();
  const router = useRouter();
  const { loggedIn, loading: authLoading } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));
  const [offer, setOffer] = React.useState<BookOffer | null>(null);
  const [checkout, setCheckout] = React.useState<BookCheckout | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [buying, setBuying] = React.useState(false);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [missing, setMissing] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);
  const [proofSent, setProofSent] = React.useState(false);

  React.useEffect(() => {
    if (authLoading) return;
    if (!loggedIn) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    if (!slug || !number || !subjectSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const sem = await fetchSemester(slug, number);
        const match = (sem.subjects || []).find((s: any) => s.slug === subjectSlug);
        if (!match) {
          if (!cancelled) setMissing(true);
          return;
        }
        const data = await fetchBookOffer(match.id);
        if (cancelled) return;
        setOffer(data);
        if (data.canRead && data.href) router.replace(data.href);
      } catch (e: any) {
        if (e?.response?.status === 401) setNeedLogin(true);
        else if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, slug, number, subjectSlug, router]);

  const startCheckout = async () => {
    if (!offer) return;
    setBuying(true);
    try {
      const result = await purchaseBook(offer.id);
      setCheckout(result);
      if (result.provider === 'razorpay' && result.rpOrderId && scriptReady && window.Razorpay) {
        openRazorpay(result);
      }
    } catch (e: any) {
      if (e?.response?.status === 409 && e?.response?.data?.href) {
        router.replace(e.response.data.href);
        return;
      }
      message.error(e?.response?.data?.message || 'Could not start checkout.');
    } finally {
      setBuying(false);
    }
  };

  const openRazorpay = (order: BookCheckout) => {
    const key = order.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!key || !order.rpOrderId || !window.Razorpay || !offer) {
      message.error('Card payment is not ready. Use UPI below if shown.');
      return;
    }
    const rzp = new window.Razorpay({
      key,
      amount: String(Math.round(order.amount * 100)),
      currency: order.currency || 'INR',
      name: 'VidhyaVibe',
      description: offer.name,
      order_id: order.rpOrderId,
      handler: async (response: any) => {
        try {
          const done = await confirmBookPurchase(offer.id, {
            orderId: order.orderId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });
          message.success('Payment received. This book is now on your account.');
          router.replace(done.href || offer.href);
        } catch (e: any) {
          message.error(
            e?.response?.data?.message ||
              'Payment succeeded but access was not opened. Contact support.',
          );
        }
      },
      theme: { color: '#2d7a3e' },
    });
    rzp.open();
  };

  const uploadProof = async (file: File) => {
    if (!offer || !checkout) return;
    try {
      const res = await uploadBookPurchaseProof(offer.id, checkout.orderId, file);
      setProofSent(true);
      message.success(res.message || 'Proof uploaded. We will confirm the payment shortly.');
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Could not upload the proof.');
    }
  };

  if (loading || authLoading) {
    return (
      <main className="container" style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }
  if (needLogin) {
    return (
      <main className="container" style={{ padding: '48px 16px' }}>
        <h1 className="course-page-title">Sign in to buy this book</h1>
        <p className="course-page-lead">Individual access is saved to your account.</p>
        <Link href={courseLoginHref()}>
          <Button type="primary">Login to continue</Button>
        </Link>
      </main>
    );
  }
  if (!offer || missing) {
    return (
      <CourseAccessBlocked
        title="Book not found"
        message="This textbook is not listed for sale."
        backHref={`/courses/${slug}${number ? `/sem-${number}` : ''}`}
      />
    );
  }
  if (!offer.purchasable) {
    return (
      <CourseAccessBlocked
        title="Not listed for sale"
        message="This book is not sold individually. Ask your college to add you to the class list."
        backHref={offer.href}
        subjectId={offer.id}
        showBuy={false}
      />
    );
  }

  const priceLabel = formatBookPrice(offer.price);
  const pay = checkout;

  return (
    <main className="container" style={{ padding: '24px 16px 64px', maxWidth: 720 }}>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <Link href={offer.href} className="course-back">
        ← Back to {offer.name}
      </Link>
      <CourseHero
        kicker={`${offer.course.name} · ${offer.semester.title}`}
        title={`Subscribe to ${offer.name}`}
        subtitle="Individual access is tied to this login and opens on one device at a time."
        chips={[...(offer.syllabusCode ? [offer.syllabusCode] : []), priceLabel].filter(Boolean)}
        coverSrc={offer.frontCoverUrl}
      />
      <div className="course-buy-panel">
        <strong>{priceLabel}</strong>
        {!pay ? (
          <>
            <p>
              Pay {priceLabel} to add this book to Your textbooks. If you already have a college
              seat, you do not need to buy it again.
            </p>
            {offer.description ? <p style={{ marginTop: 10 }}>{offer.description}</p> : null}
            <Button
              type="primary"
              size="large"
              loading={buying}
              onClick={startCheckout}
              style={{ marginTop: 16 }}
            >
              Subscribe · {priceLabel}
            </Button>
          </>
        ) : pay.provider === 'razorpay' ? (
          <>
            <p>
              Pay {formatBookPrice(pay.amount)} with Razorpay. Access opens as soon as payment
              succeeds.
            </p>
            <Button
              type="primary"
              size="large"
              onClick={() => openRazorpay(pay)}
              style={{ marginTop: 16 }}
            >
              Pay {formatBookPrice(pay.amount)}
            </Button>
          </>
        ) : (
          <>
            <p>
              Pay {formatBookPrice(pay.amount)} with UPI, then upload a screenshot of the success
              screen.
            </p>
            {pay.upi ? (
              <div
                style={{
                  display: 'inline-block',
                  padding: 10,
                  background: '#fff',
                  margin: '12px 0',
                }}
              >
                <QRCodeCanvas value={pay.upi} size={200} includeMargin />
              </div>
            ) : null}
            {pay.upi ? <p style={{ wordBreak: 'break-all', fontSize: 13 }}>{pay.upi}</p> : null}
            {proofSent ? (
              <p style={{ marginTop: 12 }}>
                Proof received. This book will unlock after VidhyaVibe confirms the payment.
              </p>
            ) : (
              <p style={{ marginTop: 12 }}>
                <label>
                  Upload payment proof:{' '}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])}
                  />
                </label>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
