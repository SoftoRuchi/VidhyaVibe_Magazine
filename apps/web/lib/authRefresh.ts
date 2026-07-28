import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { apiUrl } from './apiBase';

/**
 * Attach token refresh interceptors to an axios instance.
 * Call once at app initialisation (AuthProvider).
 */
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

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
    url.includes('/auth/guest-checkout')
  );
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
        const url = originalRequest.url || '';
        if (url.includes('/auth/login') || url.includes('/auth/register')) {
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
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('access_token');
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            const redirect = encodeURIComponent(
              `${window.location.pathname}${window.location.search}`,
            );
            window.location.href = `/login?redirect=${redirect}`;
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );
}
