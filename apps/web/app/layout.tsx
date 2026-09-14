import React from 'react';
import './globals.css';
import AppProviders from '../components/AppProviders';

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
        <div className="vv-app-shell">
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}
