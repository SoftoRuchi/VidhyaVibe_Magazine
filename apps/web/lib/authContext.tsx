'use client';

import axios from 'axios';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from './api';
import { getApiOrigin } from './apiBase';
import { expireSession, onSessionExpired, setupAxiosRefresh } from './authRefresh';
import { getSelectedReaderName, isChildAudience } from './viewingContext';

interface AuthContextValue {
  loggedIn: boolean;
  loading: boolean;
  welcomeName: string;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let axiosInitialized = false;

function initAxiosClients() {
  if (axiosInitialized) return;
  const origin = getApiOrigin();
  if (origin) {
    axios.defaults.baseURL = origin;
    api.defaults.baseURL = origin;
  }
  axios.defaults.withCredentials = true;
  setupAxiosRefresh(axios);
  setupAxiosRefresh(api);
  axiosInitialized = true;
}

// Ensure interceptors are ready before any checkout / API call from child pages.
if (typeof window !== 'undefined') {
  initAxiosClients();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [welcomeName, setWelcomeName] = useState('');

  const clearAuth = useCallback(() => {
    setLoggedIn(false);
    setWelcomeName('');
    setLoading(false);
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setLoggedIn(false);
      setWelcomeName('');
      setLoading(false);
    });
    return () => onSessionExpired(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    initAxiosClients();
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      clearAuth();
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.get('/api/auth/me');
      setLoggedIn(true);
      if (isChildAudience()) {
        setWelcomeName(getSelectedReaderName() || 'Reader');
      } else {
        setWelcomeName(data?.name || data?.email || 'User');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      // Expired / invalid session — clear local auth (interceptor also redirects on refresh failure)
      if (status === 401 || status === 403 || !localStorage.getItem('access_token')) {
        expireSession({ redirectToLogin: false });
        clearAuth();
      } else {
        // Transient error: keep token, treat as logged in with a fallback name
        setLoggedIn(true);
        setWelcomeName(isChildAudience() ? getSelectedReaderName() || 'Reader' : 'User');
      }
    } finally {
      setLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const value = useMemo(
    () => ({ loggedIn, loading, welcomeName, refreshAuth, clearAuth }),
    [loggedIn, loading, welcomeName, refreshAuth, clearAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
