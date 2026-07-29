'use client';

import { MenuOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/authContext';
import { prefetchRouteData } from '../lib/routePrefetch';
import { clearViewingContext, getSelectedReaderName, isChildAudience } from '../lib/viewingContext';
import brandLogo from './images/logo_rmbg.png';

const Navbar = () => {
  const { loggedIn, welcomeName: authWelcomeName, clearAuth } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  const hideOnAuthPages = pathname === '/login' || pathname === '/signup';
  const welcomeName = isChildAudience() ? getSelectedReaderName() || 'Reader' : authWelcomeName;

  if (hideOnAuthPages) return null;

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
    } catch {
      // ignore logout API errors
    }
    localStorage.removeItem('access_token');
    clearViewingContext();
    sessionStorage.removeItem('show_post_login_setup');
    clearAuth();
    setMobileOpen(false);
    window.location.href = '/login';
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/magazines', label: 'Browse' },
    { href: '/posts', label: 'Posts' },
    // { href: '/sales', label: 'Sales' },
    { href: '/dashboard', label: 'My Library', requiresAuth: true },
    { href: '/profile', label: 'Profile', requiresAuth: true },
  ];

  const resolveHref = (tab: { href: string; requiresAuth?: boolean }) => {
    if (tab.requiresAuth && !loggedIn) {
      return `/login?redirect=${encodeURIComponent(tab.href)}`;
    }
    return tab.href;
  };

  const prefetchNav = (href: string) => {
    prefetchRouteData(api, href);
  };

  return (
    <header className="vv-app-header">
      <nav className="vv-navbar">
        <Link href="/" className="vv-navbar-brand" aria-label="VidhyaVibe Magazine">
          <Image
            src={brandLogo}
            alt=""
            width={240}
            height={64}
            className="vv-navbar-logo"
            priority
          />
          <span className="vv-navbar-titleBadge">
            <span className="vv-navbar-titleIcon" style={{ color: '#facc15' }} aria-hidden>
              ★
            </span>
            <span className="vv-navbar-brandText">VidhyaVibe Magazine</span>
            <span
              className="vv-navbar-titleIcon"
              style={{ color: '#6b4423', opacity: 0.9 }}
              aria-hidden
            >
              ✒
            </span>
          </span>
        </Link>

        <div className="vv-navbar-center">
          {navLinks.map((tab) => {
            const href = resolveHref(tab);
            const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={href}
                prefetch
                onMouseEnter={() => prefetchNav(href)}
                onFocus={() => prefetchNav(href)}
                className={`vv-navbar-tab${active ? ' vv-navbar-tab--active' : ''}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="vv-navbar-end">
          {loggedIn && <span className="vv-navbar-user">Welcome, {welcomeName}</span>}

          <Button
            className="vv-navbar-hamburger"
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open menu"
            style={{
              borderRadius: 999,
              border: '1px solid var(--parchment-border, #b8956a)',
              background: 'rgba(255,255,255,0.75)',
            }}
          />

          {loggedIn ? (
            <Button
              type="default"
              danger
              onClick={handleLogout}
              className="vv-navbar-tab"
              style={{
                borderRadius: 999,
                borderColor: 'var(--parchment-border, #b8956a)',
                color: '#c0392b',
              }}
            >
              Logout
            </Button>
          ) : (
            <>
              <Link href="/login">
                <Button
                  type="default"
                  className="vv-navbar-tab"
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
                  className="vv-navbar-tab"
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

      <div className="vv-mobile-panel" data-open={mobileOpen ? '1' : '0'}>
        <div className="vv-mobile-panel-inner">
          {loggedIn && <div className="vv-mobile-welcome">Welcome, {welcomeName}</div>}

          <div className="vv-mobile-menu">
            {navLinks.map((tab) => {
              const href = resolveHref(tab);
              return (
                <Link
                  key={tab.href}
                  href={href}
                  prefetch
                  onMouseEnter={() => prefetchNav(href)}
                  onClick={() => setMobileOpen(false)}
                  className="vv-mobile-menu-item"
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="vv-mobile-auth">
            {loggedIn ? (
              <Button danger block onClick={handleLogout} style={{ borderRadius: 12 }}>
                Logout
              </Button>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button block style={{ borderRadius: 12 }}>
                    Login
                  </Button>
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)}>
                  <Button type="primary" block style={{ borderRadius: 12 }}>
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default React.memo(Navbar);
