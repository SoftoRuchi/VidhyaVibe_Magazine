import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { apiUrl } from './apiBase';

/**
 * Attach token refresh interceptors to an axios instance.
 * Call once at app initialisation (AuthProvider).
 */
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];
let sessionExpiredHandler: (() => void) | null = null;

/** Register a callback (e.g. AuthProvider.clearAuth) when the session cannot be refreshed. */
export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

function processQueue(error: unknown, token: string | null = null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  pendingQueue = [];
}

function isPublicAuthUrl(url: string) {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/guest-checkout') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password')
  );
}

function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
}

/** Clear local session and notify AuthProvider; optionally hard-redirect to login. */
export function expireSession(options?: { redirectToLogin?: boolean }) {
  clearStoredSession();
  try {
    sessionExpiredHandler?.();
  } catch {
    // ignore handler errors
  }

  if (options?.redirectToLogin === false) return;
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;

  // Soft-logout on public/marketing pages; hard-redirect on protected app pages
  const path = window.location.pathname;
  const publicPrefixes = [
    '/',
    '/magazines',
    '/magazine',
    '/posts',
    '/subscribe',
    '/sales',
    '/signup',
    '/forgot-password',
  ];
  const isPublic =
    path === '/' ||
    publicPrefixes.some((p) => p !== '/' && (path === p || path.startsWith(`${p}/`)));
  if (isPublic && options?.redirectToLogin !== true) return;

  const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.href = `/login?redirect=${redirect}`;
}

function setAuthHeader(config: InternalAxiosRequestConfig | { headers?: any }, token: string) {
  const headers = config.headers as
    | { set?: (k: string, v: string) => void; Authorization?: string }
    | undefined;
  if (!headers) {
    (config as any).headers = { Authorization: `Bearer ${token}` };
    return;
  }
  if (typeof headers.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.Authorization = `Bearer ${token}`;
  }
}

export function setupAxiosRefresh(client: AxiosInstance = axios) {
  client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const url = String(config.url || '');
      if (isPublicAuthUrl(url)) return config;
      const token = localStorage.getItem('access_token');
      if (token) setAuthHeader(config, token);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        const url = String(originalRequest.url || '');

        // Do not try to refresh for public auth endpoints (including refresh itself)
        if (isPublicAuthUrl(url)) {
          return Promise.reject(error);
        }

        // Guest checkout endpoints must not trigger login redirect loops
        if (
          url.includes('/payments/guest-create-order') ||
          url.includes('/payments/validate-coupon') ||
          url.includes('/razorpay/guest-confirm')
        ) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingQueue.push({
              resolve: (token: string) => {
                setAuthHeader(originalRequest, token);
                resolve(client(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshRes = await client.post(
            apiUrl('/api/auth/refresh'),
            {},
            { withCredentials: true },
          );
          const newToken = refreshRes.data?.access_token;

          if (newToken) {
            localStorage.setItem('access_token', newToken);
            setAuthHeader(originalRequest, newToken);
            processQueue(null, newToken);
            return client(originalRequest);
          }

          processQueue(new Error('missing_access_token'), null);
          expireSession();
          return Promise.reject(error);
        } catch (refreshError) {
          processQueue(refreshError, null);
          expireSession();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );
}
