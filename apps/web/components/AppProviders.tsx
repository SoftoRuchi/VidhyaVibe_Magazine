'use client';

import { App, ConfigProvider } from 'antd';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import React, { useEffect } from 'react';
import StyledComponentsRegistry from '../lib/AntdRegistry';
import api from '../lib/api';
import { AuthProvider } from '../lib/authContext';
import { prefetchCommonData } from '../lib/routePrefetch';
import Footer from './Footer';
import Navbar from './Navbar';

const PostLoginChildSetupModal = dynamic(() => import('./PostLoginChildSetupModal'), {
  ssr: false,
});

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    document.querySelector<HTMLElement>('.vv-main-scroll')?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    const warm = () => prefetchCommonData(api);
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(warm, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
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
            <div className="vv-app-frame">
              <Navbar />
              <main className="vv-main-scroll">{children}</main>
              <Footer />
              <PostLoginChildSetupModal />
            </div>
          </AuthProvider>
        </App>
      </ConfigProvider>
    </StyledComponentsRegistry>
  );
}
