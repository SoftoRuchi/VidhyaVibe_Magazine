import axios from 'axios';
import { apiUrl } from './apiBase';
import { getStoredRefreshToken, saveAuthSession } from './authStorage';

/** Refresh access token using httpOnly cookie and/or stored refresh token (SPA fallback). */
export async function refreshAccessToken(): Promise<string> {
  const storedRefresh = getStoredRefreshToken();
  const refreshRes = await axios.post(
    apiUrl('/auth/refresh'),
    storedRefresh ? { refresh_token: storedRefresh } : {},
    {
      withCredentials: true,
      headers: storedRefresh ? { 'X-Refresh-Token': storedRefresh } : undefined,
    },
  );
  const newToken = refreshRes.data?.access_token;
  if (!newToken) throw new Error('refresh_missing_access_token');
  const refreshToken = refreshRes.data?.refresh_token || storedRefresh || undefined;
  saveAuthSession(newToken, refreshToken);
  return newToken;
}
