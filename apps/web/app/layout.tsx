import React from 'react';
import './globals.css';
import AppProviders from '../components/AppProviders';

export const metadata = {
  title: 'VidhyaVibe',
  description:
    'Higher Education textbooks and Fun Learning magazines from VidhyaVibe.',
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
