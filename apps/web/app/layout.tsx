import { App, ConfigProvider } from 'antd';
import Image from 'next/image';
import React from 'react';
import './globals.css';
import AuthProvider from '../components/AuthProvider';
import Footer from '../components/Footer';
import backgroundImg from '../components/images/background.png';
import Navbar from '../components/Navbar';
import PostLoginChildSetupModal from '../components/PostLoginChildSetupModal';
import StyledComponentsRegistry from '../lib/AntdRegistry';

export const metadata = {
  title: 'Magazine for Kids',
  description: 'Interactive and colorful magazine for students.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Full-app background image */}
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
            priority
            style={{ objectFit: 'cover', objectPosition: 'center top' }}
          />
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <StyledComponentsRegistry>
            <ConfigProvider
              theme={{
                token: {
                  colorPrimary: '#FF6B6B',
                },
              }}
            >
              <App>
                <AuthProvider>
                  <Navbar />
                  <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
                  <PostLoginChildSetupModal />
                </AuthProvider>
              </App>
              <Footer />
            </ConfigProvider>
          </StyledComponentsRegistry>
        </div>
      </body>
    </html>
  );
}
