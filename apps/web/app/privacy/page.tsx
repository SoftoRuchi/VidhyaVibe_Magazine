import ContentPage from '../../components/ContentPage';
import { siteInfo } from '../../lib/siteInfo';

export const metadata = {
  title: `Privacy Policy | ${siteInfo.brandName}`,
  description: `Privacy Policy for ${siteInfo.brandName}.`,
};

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy">
      <p>
        {siteInfo.companyName} ({siteInfo.brandName}) respects your privacy. This policy explains
        what information we collect, how we use it, and the choices you have.
      </p>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Information We Collect</h2>
        <p>
          We collect information you provide when you register, subscribe, or contact us — such as
          your name, email address, phone number, delivery address, and payment-related details
          processed by our payment partner.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>How We Use Information</h2>
        <p>
          We use your information to manage your account, deliver subscriptions, process payments,
          provide customer support, and improve our services. We do not sell your personal data to
          third parties.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Data Security</h2>
        <p>
          We use reasonable technical and organisational measures to protect your data. Payment
          details are handled by Razorpay and are not stored on our servers beyond what is needed
          for order records.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Cookies &amp; Usage Data</h2>
        <p>
          We may use cookies and similar technologies to keep you signed in and to understand how
          our site is used. You can control cookies through your browser settings.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal information by
          contacting us. Family accounts may include optional reader profiles for shared
          subscriptions.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Contact</h2>
        <p>
          For privacy-related questions, email{' '}
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
