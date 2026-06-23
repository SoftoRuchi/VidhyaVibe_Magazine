import axios from 'axios';
import { apiUrl } from './apiBase';
import { saveAuthSession } from './authStorage';

export type LoginResult = {
  access_token: string;
  refresh_token?: string;
  user?: { id: number; email?: string; isAdmin?: boolean };
};

export async function adminLogin(email: string, password: string): Promise<LoginResult> {
  const res = await axios.post<LoginResult>(
    apiUrl('/auth/login'),
    { email, password, deviceName: 'admin-web' },
    { withCredentials: true },
  );
  const access = res.data?.access_token;
  if (!access) throw new Error('missing_access_token');
  if (!res.data?.user?.isAdmin) throw new Error('admin_required');
  saveAuthSession(access, res.data.refresh_token);
  return res.data;
}
