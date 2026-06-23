import { apiUrl } from './apiBase';
import { getStoredRefreshToken } from './authStorage';
import { refreshAccessToken } from './refreshAccessToken';

function parseJwtExp(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Use stored access token when still valid; refresh only when missing or expired. */
export async function ensureAccessToken(): Promise<string> {
  const token = localStorage.getItem('access_token');
  if (token) {
    const exp = parseJwtExp(token);
    // Valid token, or cannot parse exp — use it (do not force refresh).
    if (exp === null || Date.now() < exp - 60_000) {
      return token;
    }
  }

  const refresh = getStoredRefreshToken();
  if (!refresh) {
    const err = new Error('session_expired') as Error & { response?: { status: number } };
    err.response = { status: 401 };
    throw err;
  }
  return refreshAccessToken();
}

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Access-Token': token,
  };
  const refresh = getStoredRefreshToken();
  if (refresh) headers['X-Refresh-Token'] = refresh;
  return headers;
}

/** Multipart upload via fetch — axios can drop Authorization on FormData in production. */
export async function apiUpload<T = unknown>(
  method: 'POST' | 'PUT',
  path: string,
  formData: FormData,
  options?: { onUploadProgress?: (pct: number) => void },
): Promise<T> {
  const url = apiUrl(path.startsWith('/') ? path : `/${path}`);
  let token = await ensureAccessToken();

  const doFetch = async (accessToken: string) => {
    if (options?.onUploadProgress && typeof XMLHttpRequest !== 'undefined') {
      return xhrUpload<T>(
        method,
        url,
        formData,
        authHeaders(accessToken),
        options.onUploadProgress,
      );
    }
    const res = await fetch(url, {
      method,
      body: formData,
      credentials: 'include',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body?.error || res.statusText) as Error & {
        response?: { status: number; data?: unknown };
      };
      err.response = { status: res.status, data: body };
      throw err;
    }
    return (await res.json()) as T;
  };

  try {
    return await doFetch(token);
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      token = await refreshAccessToken();
      return doFetch(token);
    }
    throw e;
  }
}

function xhrUpload<T>(
  method: string,
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = true;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
        else {
          const err = new Error(body?.error || xhr.statusText) as Error & {
            response?: { status: number; data?: unknown };
          };
          err.response = { status: xhr.status, data: body };
          reject(err);
        }
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new Error('upload_failed'));
    xhr.send(formData);
  });
}
