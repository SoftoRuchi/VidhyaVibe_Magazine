import React from 'react';
import { Link } from 'react-router-dom';
import '../sales.css';

export default function LegalPage({ title, children }) {
  return (
    <div className="vv-sale-landing vv-sale-legalPage">
      <header className="vv-sale-legalHeader">
        <div className="container">
          <Link to="/" className="vv-sale-legalBack">
            ← Back to VidhyaVibe
          </Link>
          <h1 className="vv-sale-h2">{title}</h1>
        </div>
      </header>
      <main className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card vv-sale-legalCard">{children}</div>
        </div>
      </main>
      <footer className="vv-sale-footer">
        <div className="container">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund-policy">Refund Policy</Link>
          <a href="mailto:support@vidhyavibe.in">Contact</a>
        </div>
      </footer>
    </div>
  );
}
