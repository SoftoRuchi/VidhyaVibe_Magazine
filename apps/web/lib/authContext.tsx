'use client';

import axios from 'axios';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from './api';
import { getApiOrigin } from './apiBase';
import { setupAxiosRefresh } from './authRefresh';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [welcomeName, setWelcomeName] = useState('');

  const clearAuth = useCallback(() => {
    setLoggedIn(false);
    setWelcomeName('');
    setLoading(false);
  }, []);

  const refreshAuth = useCallback(async () => {
    initAxiosClients();
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      clearAuth();
      return;
    }

    setLoggedIn(true);
    if (isChildAudience()) {
      setWelcomeName(getSelectedReaderName() || 'Reader');
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/api/auth/me');
      setWelcomeName(data?.name || data?.email || 'User');
    } catch {
      setWelcomeName('User');
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
