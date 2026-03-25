import axios from 'axios';

/**
 * Set up axios interceptors for token refresh on the web app.
 * Call this once at app initialisation.
 */
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  pendingQueue = [];
}

function isPublicAuthUrl(url: string) {
  // Relative: /api/auth/login — or absolute URLs containing the same path
  return (
    url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')
  );
}

export function setupAxiosRefresh() {
  // Request interceptor — attach access token (never on login/register/refresh)
  axios.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const url = String(config.url || '');
      if (isPublicAuthUrl(url)) {
        return config;
      }
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  // Response interceptor — attempt refresh on 401
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        // Don't refresh on login/register endpoints
        const url = originalRequest.url || '';
        if (url.includes('/auth/login') || url.includes('/auth/register')) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingQueue.push({
              resolve: (token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(axios(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshRes = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
          const newToken = refreshRes.data?.access_token;

          if (newToken) {
            localStorage.setItem('access_token', newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            processQueue(null, newToken);
            return axios(originalRequest);
          }
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('access_token');
          // Only redirect if not already on login page
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
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
