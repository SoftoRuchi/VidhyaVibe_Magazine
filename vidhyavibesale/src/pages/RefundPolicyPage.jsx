import React from 'react';
import LegalPage from '../components/LegalPage';

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        We want parents to feel confident before paying. If VidhyaVibe is not the right fit, you can
        request a full refund within 7 days of purchase — no questions asked.
      </p>

      <section>
        <h2>7-day full money-back guarantee</h2>
        <p>
          Email <a href="mailto:support@vidhyavibe.in">support@vidhyavibe.in</a> within 7 days of
          your payment date with your order details. We will refund the full amount to the original
          payment method.
        </p>
      </section>

      <section>
        <h2>After 7 days</h2>
        <p>
          Refund requests made more than 7 days after purchase are reviewed case by case. Digital
          content already delivered may affect eligibility.
        </p>
      </section>

      <section>
        <h2>How payments work</h2>
        <p>
          Checkout is secured by Razorpay. The standard annual plan is a one-time payment — we do
          not auto-charge your card for renewal.
        </p>
      </section>
    </LegalPage>
  );
}
