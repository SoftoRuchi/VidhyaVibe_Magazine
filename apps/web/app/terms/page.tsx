import ContentPage from '../../components/ContentPage';
import { siteInfo } from '../../lib/siteInfo';

export const metadata = {
  title: `Terms of Service | ${siteInfo.brandName}`,
  description: `Terms of Service for ${siteInfo.brandName}.`,
};

export default function TermsPage() {
  return (
    <ContentPage title="Terms of Service">
      <p>
        Welcome to {siteInfo.brandName}. By using our website and subscription services, you agree
        to these Terms of Service. Please read them carefully before creating an account or making a
        purchase.
      </p>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>1. Service</h2>
        <p>
          {siteInfo.brandName} provides digital and physical magazine subscriptions for readers of
          all ages. Access to content depends on your active subscription plan and selected delivery
          mode.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>2. Accounts</h2>
        <p>
          You are responsible for keeping your login credentials secure and for all activity under
          your account. Information you provide during registration must be accurate and up to date.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>3. Subscriptions &amp; Payments</h2>
        <p>
          Subscription fees are charged according to the plan you select. Payments are processed
          securely through Razorpay. Refunds, if applicable, are handled according to our support
          policy and applicable law.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>4. Acceptable Use</h2>
        <p>
          Content is for personal, non-commercial use only. You may not copy, redistribute, or
          resell magazine content without written permission from {siteInfo.companyName}.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>5. Contact</h2>
        <p>
          For questions about these terms, email us at{' '}
          <a
            href={`mailto:${siteInfo.supportEmail}`}
            style={{ color: 'var(--btn-view-green, #2d7a3e)' }}
          >
            {siteInfo.supportEmail}
          </a>
          .
        </p>
      </section>
    </ContentPage>
  );
}
