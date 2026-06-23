import axios from 'axios';
import { getApiBaseUrl } from './apiBase';
import { clearAuthSession, getStoredRefreshToken } from './authStorage';
import { refreshAccessToken } from './refreshAccessToken';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  pendingQueue = [];
}

function redirectToLogin(reason: 'session_expired' | 'admin_required' = 'session_expired') {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/admin/login')) return;
  clearAuthSession();
  window.location.href = `/admin/login?error=${reason}`;
}

function setHeader(config: { headers?: unknown }, name: string, value: string) {
  const headers = config.headers as Record<string, unknown> & {
    set?: (k: string, v: string) => void;
  };
  if (!headers) return;
  if (typeof headers.set === 'function') {
    headers.set(name, value);
  } else {
    headers[name] = value;
  }
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setHeader(config, 'Authorization', `Bearer ${token}`);
      setHeader(config, 'X-Access-Token', token);
    }
    const refresh = getStoredRefreshToken();
    if (refresh) {
      setHeader(config, 'X-Refresh-Token', refresh);
    }
    // Let axios set multipart boundary — do not override Content-Type on FormData.
    if (config.data instanceof FormData) {
      const headers = config.headers as Record<string, unknown> & {
        delete?: (k: string) => void;
      };
      if (headers?.delete) {
        headers.delete('Content-Type');
      } else if (headers) {
        delete headers['Content-Type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isMe = String(originalRequest?.url || '').includes('/auth/me');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token: string) => {
              setHeader(originalRequest, 'Authorization', `Bearer ${token}`);
              setHeader(originalRequest, 'X-Access-Token', token);
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        setHeader(originalRequest, 'Authorization', `Bearer ${newToken}`);
        setHeader(originalRequest, 'X-Access-Token', newToken);
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (!isMe) redirectToLogin('session_expired');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
