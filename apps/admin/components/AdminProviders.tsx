'use client';

import { App, ConfigProvider } from 'antd';
import React from 'react';
import DashboardLayout from './DashboardLayout';

export default function AdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <App>
        <DashboardLayout>{children}</DashboardLayout>
      </App>
    </ConfigProvider>
  );
}
