import Link from 'next/link';
import React from 'react';

const Footer = () => {
  const linkStyle: React.CSSProperties = {
    color: '#fff',
    opacity: 0.92,
    transition: 'opacity 0.15s ease',
  };

  return (
    <footer
      className="vv-app-footer"
      style={{
        backgroundColor: '#2C3E50',
        color: '#fff',
        padding: 0,
        minHeight: 34,
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 12,
          width: '100%',
          padding: '0 16px',
        }}
      >
        <div style={{ whiteSpace: 'nowrap' }}>
          &copy; {new Date().getFullYear()} VidhyaVibe Magazine. All rights reserved.
        </div>

        <div style={{ display: 'flex', gap: 16, whiteSpace: 'nowrap' }}>
          <Link href="/terms" style={linkStyle}>
            Terms
          </Link>
          <Link href="/privacy" style={linkStyle}>
            Privacy
          </Link>
          <Link href="/contact" style={linkStyle}>
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
