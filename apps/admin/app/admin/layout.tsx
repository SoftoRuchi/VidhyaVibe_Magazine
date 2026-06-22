'use client';
import { Spin } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import React from 'react';
import { clearAuthSession } from '../../lib/authStorage';
import { verifyAdminSession } from '../../lib/session';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute =
    pathname?.startsWith('/admin/login') ||
    pathname === '/login' ||
    pathname?.startsWith('/login') ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/login'));
  const [authChecked, setAuthChecked] = React.useState(false);
  const verifiedRef = React.useRef(false);

  React.useEffect(() => {
    if (!pathname || pathname.startsWith('/admin/login')) {
      return;
    }

    const hasLocalToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token');
    if (!hasLocalToken) {
      router.replace('/admin/login?error=session_expired');
      return;
    }

    if (verifiedRef.current) {
      setAuthChecked(true);
      return;
    }

    let cancelled = false;
    setAuthChecked(false);

    verifyAdminSession()
      .then(() => {
        if (cancelled) return;
        verifiedRef.current = true;
        setAuthChecked(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        clearAuthSession();
        const reason =
          (err as { code?: string; message?: string })?.code === 'admin_required' ||
          (err as { message?: string })?.message === 'admin_required'
            ? 'admin_required'
            : 'session_expired';
        router.replace(`/admin/login?error=${reason}`);
      });

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (isLoginRoute) {
    return <>{children}</>;
  }

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
