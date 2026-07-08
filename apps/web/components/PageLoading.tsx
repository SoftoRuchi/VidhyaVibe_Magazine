import { Spin } from 'antd';
import React from 'react';

export default function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '2rem 1rem',
      }}
    >
      <Spin size="large" />
      <span style={{ color: '#5c4a3a', fontSize: 14, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
