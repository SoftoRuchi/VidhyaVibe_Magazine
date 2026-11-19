'use client';

import { Button, Input, Radio, Spin, message } from 'antd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import React from 'react';
import { CourseAccessBlocked, CourseHero } from '../../../../../../components/CourseBrowse';
import { useAuth } from '../../../../../../lib/authContext';
import {
  confirmBookPurchase,
  fetchBookOffer,
  fetchSemester,
  formatBookPrice,
  guestBookCheckout,
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
  const { loggedIn, loading: authLoading, refreshAuth } = useAuth();
  const slug = String(params?.slug || '');
  const semesterParam = String(params?.semester || '');
  const subjectSlug = String(params?.subject || '');
  const number = Number(semesterParam.replace(/^sem-?/i, ''));
  const [offer, setOffer] = React.useState<BookOffer | null>(null);
  const [checkout, setCheckout] = React.useState<BookCheckout | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [buying, setBuying] = React.useState(false);
  const [missing, setMissing] = React.useState(false);
  const [format, setFormat] = React.useState<'EBOOK' | 'POD' | 'BOTH'>('EBOOK');
  const [guest, setGuest] = React.useState({ name: '', email: '', phone: '' });
  const [ship, setShip] = React.useState({
    deliveryAddress: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [scriptReady, setScriptReady] = React.useState(false);
  const [proofSent, setProofSent] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Razorpay) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
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
    if (authLoading) return;
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
        if (loggedIn && data.canRead && data.href) router.replace(data.href);
      } catch {
        if (!cancelled) setMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, slug, number, subjectSlug, router]);

  const purchaseBody = () => ({
    format,
    ...(format === 'POD' || format === 'BOTH' ? ship : {}),
  });

  const startCheckout = async () => {
    if (!offer) return;
    if (format === 'POD' || format === 'BOTH') {
      if (ship.deliveryAddress.trim().length < 8 || !ship.city.trim() || !/^\d{6}$/.test(ship.pincode.trim())) {
        message.error('Enter a full address, city, and 6-digit PIN code for the printed book.');
        return;
      }
    }
    setBuying(true);
    try {
      if (!loggedIn) {
        const name = guest.name.trim();
        const email = guest.email.trim();
        const phone = guest.phone.replace(/\D/g, '');
        if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 10) {
          message.error('Enter your name, a valid email, and a mobile number to continue.');
          setBuying(false);
          return;
        }
        await guestBookCheckout({ name, email, phone: phone.slice(-10) });
        await refreshAuth();
      }
      const result = await purchaseBook(offer.id, purchaseBody());
      setCheckout(result);
      if (result.provider === 'razorpay' && result.rpOrderId && scriptReady && window.Razorpay) {
        openRazorpay(result, loggedIn ? undefined : guest);
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

  const openRazorpay = (
    order: BookCheckout,
    contact?: { name: string; email: string; phone: string },
  ) => {
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
      prefill: contact
        ? { name: contact.name, email: contact.email, contact: contact.phone }
        : undefined,
      handler: async (response: any) => {
        try {
          const done = await confirmBookPurchase(offer.id, {
            orderId: order.orderId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });
          message.success('Payment received. This book is now on your account.');
          await refreshAuth();
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

  const chosen = offer.formats?.[format] || {
    price: offer.price,
    listPrice: offer.listPrice,
    discountPct: offer.discountPct,
  };
  const priceLabel = formatBookPrice(chosen.price);
  const listLabel =
    chosen.listPrice != null && Number(chosen.listPrice) > Number(chosen.price || 0)
      ? formatBookPrice(chosen.listPrice)
      : '';
  const pay = checkout;

  return (
    <main className="container" style={{ padding: '24px 16px 64px', maxWidth: 720 }}>
      <Link href={offer.href} className="course-back">
        ← Back to {offer.name}
      </Link>
      <CourseHero
        kicker={`${offer.course.name} · ${offer.semester.title}`}
        title={`Buy ${offer.name}`}
        subtitle="Choose the interactive e-book or a printed copy. You can pay without creating an account first."
        chips={[
          ...(offer.syllabusCode ? [offer.syllabusCode] : []),
          offer.discountPct ? `${offer.discountPct}% off` : '',
          priceLabel,
        ].filter(Boolean)}
        coverSrc={offer.frontCoverUrl}
      />
      <div className="course-buy-panel">
        <strong>
          {listLabel ? (
            <>
              <s style={{ color: '#9ca3af', marginRight: 8 }}>{listLabel}</s>
              {priceLabel}
            </>
          ) : (
            priceLabel
          )}
        </strong>
        {!pay ? (
          <>
            <p>
              Pay {priceLabel}. A printed order also opens the interactive e-book. If your college
              already gave you a seat, you do not need to buy it again.
            </p>
            {offer.description ? <p style={{ marginTop: 10 }}>{offer.description}</p> : null}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Format</div>
              <Radio.Group
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <Radio value="EBOOK">Interactive e-book</Radio>
                <Radio value="POD">Physical book, delivered to you</Radio>
                <Radio value="BOTH">E-book and physical book</Radio>
              </Radio.Group>
            </div>
            {format === 'POD' || format === 'BOTH' ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                <Input
                  placeholder="Delivery address"
                  value={ship.deliveryAddress}
                  onChange={(e) => setShip((s) => ({ ...s, deliveryAddress: e.target.value }))}
                />
                <Input
                  placeholder="City"
                  value={ship.city}
                  onChange={(e) => setShip((s) => ({ ...s, city: e.target.value }))}
                />
                <Input
                  placeholder="State"
                  value={ship.state}
                  onChange={(e) => setShip((s) => ({ ...s, state: e.target.value }))}
                />
                <Input
                  placeholder="PIN code"
                  value={ship.pincode}
                  onChange={(e) => setShip((s) => ({ ...s, pincode: e.target.value }))}
                  maxLength={6}
                />
              </div>
            ) : null}
            {!loggedIn ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                <div style={{ fontWeight: 700 }}>Your details</div>
                <p style={{ margin: 0 }}>
                  We save your name, email, and mobile with this order and email your receipt. You
                  do not need to sign up before paying.
                </p>
                <Input
                  placeholder="Full name"
                  value={guest.name}
                  onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
                />
                <Input
                  placeholder="Email"
                  value={guest.email}
                  onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                />
                <Input
                  placeholder="Mobile number"
                  value={guest.phone}
                  onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                />
              </div>
            ) : null}
            <Button
              type="primary"
              size="large"
              loading={buying}
              onClick={startCheckout}
              style={{ marginTop: 16 }}
            >
              {format === 'BOTH'
                ? 'Buy e-book and printed book'
                : format === 'POD'
                  ? 'Order printed book'
                  : 'Buy e-book'}{' '}
              · {priceLabel}
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
