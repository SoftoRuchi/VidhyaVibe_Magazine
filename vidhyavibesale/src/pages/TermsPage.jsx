import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        Welcome to VidhyaVibe. By using this website and purchasing a subscription, you agree to
        these Terms of Service. Please read them carefully before making a purchase.
      </p>

      <section>
        <h2>1. Service</h2>
        <p>
          VidhyaVibe provides an annual digital magazine subscription with monthly interactive
          learning editions, calibrated by age group. Access depends on your active subscription
          plan.
        </p>
      </section>

      <section>
        <h2>2. Payments</h2>
        <p>
          Subscription fees are charged according to the age-group plan you select. Payments are
          processed securely through Razorpay. Plans are one-time annual payments unless otherwise
          stated at checkout — there is no auto-renewal charge for the standard annual plan.
        </p>
      </section>

      <section>
        <h2>3. Refunds</h2>
        <p>
          Refunds are handled according to our <Link to="/refund-policy">Refund Policy</Link>.
        </p>
      </section>

      <section>
        <h2>4. Acceptable Use</h2>
        <p>
          Content is for personal, non-commercial use only. You may not copy, redistribute, or
          resell magazine content without written permission from VidhyaVibe.
        </p>
      </section>

      <section>
        <h2>5. Contact</h2>
        <p>
          For questions about these terms, email{' '}
          <a href="mailto:support@vidhyavibe.in">support@vidhyavibe.in</a>.
        </p>
      </section>
    </LegalPage>
  );
}
