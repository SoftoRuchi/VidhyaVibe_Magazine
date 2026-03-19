import React from 'react';

const Footer = () => {
  return (
    <footer
      style={{
        backgroundColor: '#2C3E50',
        color: '#fff',
        padding: 0,
        minHeight: 34,
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1,
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          fontSize: 12,
          width: '100%',
          padding: '0 16px',
        }}
      >
        <div style={{ whiteSpace: 'nowrap' }}>
          &copy; {new Date().getFullYear()} Magazine Kids. All rights reserved.
        </div>

        <div style={{ display: 'flex', gap: 16, whiteSpace: 'nowrap' }}>
          <a href="#" style={{ color: '#fff' }}>
            Terms
          </a>
          <a href="#" style={{ color: '#fff' }}>
            Privacy
          </a>
          <a href="#" style={{ color: '#fff' }}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
