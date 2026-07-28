import Image from 'next/image';
import React from 'react';
import './globals.css';
import AppProviders from '../components/AppProviders';
import backgroundImg from '../components/images/background.png';

export const metadata = {
  title: 'VidhyaVibe Magazine',
  description:
    'Digital and print magazines for readers of all ages — stories, learning, and discovery.',
  icons: {
    icon: '/images/brand/logonew.png',
    apple: '/images/brand/logonew.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <Image
            src={backgroundImg}
            alt=""
            fill
            fetchPriority="low"
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center top' }}
          />
        </div>

        <div className="vv-app-shell">
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}
