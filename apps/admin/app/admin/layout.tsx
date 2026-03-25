'use client';
import { Spin } from 'antd';
import axios from 'axios';
import { useRouter, usePathname } from 'next/navigation';

import React from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname?.startsWith('/admin/login');
  const [authChecked, setAuthChecked] = React.useState(isLoginRoute);

  React.useEffect(() => {
    // Don't block the login page with auth verification spinner.
    if (isLoginRoute) {
      setAuthChecked(true);
      return;
    }

    setAuthChecked(false);
    // Session check via cookie-aware endpoint.
    // Avoid strict localStorage token checks because access tokens can expire
    // while a valid refresh cookie still exists.
    axios
      .get('/api/auth/me', { withCredentials: true })
      .then((r) => {
        if (!r.data?.isAdmin) {
          localStorage.removeItem('access_token');
          router.replace('/admin/login');
        } else {
          // Keep access token in sync if API returns one (defensive for future changes).
          if (r.data?.access_token) {
            localStorage.setItem('access_token', r.data.access_token);
          }
          setAuthChecked(true);
        }
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        router.replace('/admin/login');
      });
  }, [router, pathname, isLoginRoute]);

  if (!authChecked) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin size="large" tip="Verifying session…" />
      </div>
    );
  }

  return <>{children}</>;
}
