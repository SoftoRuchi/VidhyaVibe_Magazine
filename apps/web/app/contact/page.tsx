import ContentPage from '../../components/ContentPage';
import { siteInfo } from '../../lib/siteInfo';

export const metadata = {
  title: `Contact Us | ${siteInfo.brandName}`,
  description: `Contact ${siteInfo.brandName} for support and enquiries.`,
};

export default function ContactPage() {
  return (
    <ContentPage title="Contact Us">
      <p>
        We&apos;re here to help with subscriptions, account issues, delivery questions, and general
        enquiries about {siteInfo.brandName}.
      </p>

      <section
        style={{
          display: 'grid',
          gap: 14,
          padding: '18px 20px',
          borderRadius: 14,
          background: 'rgba(45, 122, 62, 0.08)',
          border: '1px solid rgba(45, 122, 62, 0.2)',
        }}
      >
        <div>
          <strong>Email</strong>
          <div>
            <a
              href={`mailto:${siteInfo.supportEmail}`}
              style={{ color: 'var(--btn-view-green, #2d7a3e)' }}
            >
              {siteInfo.supportEmail}
            </a>
          </div>
        </div>

        <div>
          <strong>Phone</strong>
          <div>
            <a
              href={`tel:${siteInfo.phone.replace(/\s/g, '')}`}
              style={{ color: 'var(--btn-view-green, #2d7a3e)' }}
            >
              {siteInfo.phone}
            </a>
          </div>
        </div>

        <div>
          <strong>Website</strong>
          <div>
            <a
              href={siteInfo.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--btn-view-green, #2d7a3e)' }}
            >
              {siteInfo.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          </div>
        </div>

        <div>
          <strong>Location</strong>
          <div>{siteInfo.address}</div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Support Hours</h2>
        <p>
          Monday to Saturday, 10:00 AM – 6:00 PM IST. We aim to respond within 1–2 business days.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Before You Write</h2>
        <p>
          Please include your registered email address and, if relevant, your subscription or
          payment details so we can assist you faster.
        </p>
      </section>
    </ContentPage>
  );
}
