'use client';

import { Button } from 'antd';
import axios from 'axios';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { clearViewingContext, getSelectedReaderName, isChildAudience } from '../lib/viewingContext';

const Navbar = () => {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [welcomeName, setWelcomeName] = React.useState<string>('');
  const pathname = usePathname();

  const hideOnAuthPages = pathname === '/login' || pathname === '/signup';

  React.useEffect(() => {
    if (hideOnAuthPages) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const isLoggedIn = !!token;
    setLoggedIn(isLoggedIn);
    if (!isLoggedIn) {
      setWelcomeName('');
      return;
    }
    if (isChildAudience()) {
      setWelcomeName(getSelectedReaderName() || 'Child');
      return;
    }
    axios
      .get('/api/auth/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        const name = res.data?.name || res.data?.email || 'User';
        setWelcomeName(name);
      })
      .catch(() => setWelcomeName('User'));
  }, [hideOnAuthPages]);

  // Hide header on auth pages (after hooks are called)
  if (hideOnAuthPages) return null;

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch (e) {
      // ignore logout API errors
    }
    localStorage.removeItem('access_token');
    clearViewingContext();
    sessionStorage.removeItem('show_post_login_setup');
    setLoggedIn(false);
    window.location.href = '/login';
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/magazines', label: 'Browse' },
    { href: '/dashboard', label: 'My Library' },
    { href: '/profile', label: 'Profile' },
  ];

  return (
    <nav
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        padding: '0.75rem 2rem',
        background: 'linear-gradient(180deg, #f5eedd 0%, #e8dfc8 100%)',
        borderBottom: '2px solid var(--parchment-border, #b8956a)',
        boxShadow: '0 2px 8px rgba(61,41,20,0.15)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}
    >
      {/* Scroll-style logo */}
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '0.4rem 1rem 0.4rem 1.2rem',
            background: 'linear-gradient(180deg, #f5eedd 0%, #e8dfc8 50%, #ddd4b8 100%)',
            border: '2px solid var(--parchment-border, #b8956a)',
            borderRadius: 4,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <span style={{ fontSize: 18, color: '#facc15' }}>★</span>
          <span
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#8b4513',
              fontFamily: 'Georgia, serif',
            }}
          >
            Magazine Kids
          </span>
          <span style={{ fontSize: 16, color: '#6b4423', opacity: 0.9 }}>✒</span>
        </div>
      </Link>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {loggedIn && (
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#3d2914',
              fontFamily: 'Georgia, serif',
              whiteSpace: 'nowrap',
              transform: 'translateX(150px)',
            }}
          >
            Welcome, {welcomeName}
          </div>
        )}
      </div>

      {/* Oval nav buttons on parchment strip */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '0.35rem 0.75rem',
          background: 'linear-gradient(180deg, #f5eedd 0%, #e8dfc8 100%)',
          border: '1px solid var(--parchment-border, #b8956a)',
          borderRadius: 999,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
        }}
      >
        {navLinks.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? '#2c1810' : '#5c4a3a',
                padding: '0.4rem 1rem',
                borderRadius: 999,
                backgroundColor: active ? 'rgba(255,255,255,0.8)' : 'transparent',
                border: '1px solid transparent',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                textDecoration: 'none',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
        {loggedIn ? (
          <>
            <Button
              type="default"
              danger
              onClick={handleLogout}
              style={{
                borderRadius: 999,
                marginLeft: 4,
                borderColor: 'var(--parchment-border, #b8956a)',
                color: '#c0392b',
              }}
            >
              Logout
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button
                type="default"
                style={{
                  borderRadius: 999,
                  borderColor: 'var(--parchment-border, #b8956a)',
                  color: '#5c4a3a',
                }}
              >
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                type="primary"
                style={{
                  borderRadius: 999,
                  backgroundColor: 'var(--primary-color)',
                  border: 'none',
                }}
              >
                Sign Up
              </Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
