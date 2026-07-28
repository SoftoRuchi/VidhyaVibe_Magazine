import React from 'react';
import LegalPage from '../components/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        VidhyaVibe respects your privacy. This policy explains what information we collect, how we
        use it, and the choices you have.
      </p>

      <section>
        <h2>Information We Collect</h2>
        <p>
          We collect information you provide when you subscribe or contact us — such as your name,
          email address, phone number, and payment-related details processed by our payment partner.
        </p>
      </section>

      <section>
        <h2>How We Use Information</h2>
        <p>
          We use your information to manage your subscription, deliver monthly editions, process
          payments, provide customer support, and improve our services. We do not sell your personal
          data to third parties.
        </p>
      </section>

      <section>
        <h2>Data Security</h2>
        <p>
          We use reasonable technical and organisational measures to protect your data. Payment
          details are handled by Razorpay and are not stored on our servers beyond what is needed
          for order records.
        </p>
      </section>

      <section>
        <h2>Children&apos;s Privacy</h2>
        <p>
          We never use real children&apos;s photos in our marketing. Child-related account details
          are protected and used only to deliver the learning experience you purchased.
        </p>
      </section>

      <section>
        <h2>Cookies &amp; Usage Data</h2>
        <p>
          We may use cookies and similar technologies to keep sessions working and to understand how
          our site is used. You can control cookies through your browser settings.
        </p>
      </section>

      <section>
        <h2>Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal information by
          contacting us at <a href="mailto:support@vidhyavibe.in">support@vidhyavibe.in</a>.
        </p>
      </section>
    </LegalPage>
  );
}
