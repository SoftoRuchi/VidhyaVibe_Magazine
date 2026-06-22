const REFRESH_KEY = 'refresh_token';
const SESSION_OK_KEY = 'admin_session_ok';

export function saveAuthSession(accessToken: string, refreshToken?: string) {
  localStorage.setItem('access_token', accessToken);
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_KEY, refreshToken);
  }
  sessionStorage.setItem(SESSION_OK_KEY, '1');
}

export function clearAuthSession() {
  localStorage.removeItem('access_token');
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(SESSION_OK_KEY);
}

export function getStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function isSessionMarkedOk(): boolean {
  try {
    return sessionStorage.getItem(SESSION_OK_KEY) === '1';
  } catch {
    return false;
  }
}
