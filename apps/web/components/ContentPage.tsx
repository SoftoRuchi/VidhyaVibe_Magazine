import { Card } from 'antd';
import React from 'react';

export default function ContentPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ minHeight: '80vh', padding: '32px 0 48px' }}>
      <div className="container" style={{ maxWidth: 860 }}>
        <Card
          style={{
            borderRadius: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            border: '1px solid rgba(61,41,20,0.18)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
          }}
        >
          <h1
            style={{
              marginBottom: 20,
              fontSize: 'clamp(1.6rem, 3vw, 2rem)',
              color: 'var(--leather-brown, #3d2914)',
            }}
          >
            {title}
          </h1>
          <div
            style={{
              display: 'grid',
              gap: 16,
              fontSize: 15,
              lineHeight: 1.7,
              color: '#374151',
            }}
          >
            {children}
          </div>
        </Card>
      </div>
    </main>
  );
}
