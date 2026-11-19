import React from 'react';
import AdminProviders from '../components/AdminProviders';
import ReaderBaseUrlScript from '../components/ReaderBaseUrlScript';
import StyledComponentsRegistry from '../lib/AntdRegistry';
import './globals.css';

export const metadata = {
  title: 'VidhyaVibe Admin',
  description: 'Admin panel for VidhyaVibe Magazine',
  icons: {
    icon: '/images/brand/logonew.png',
    apple: '/images/brand/logonew.png',
  },
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <ReaderBaseUrlScript />
        <StyledComponentsRegistry>
          <AdminProviders>{children}</AdminProviders>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
