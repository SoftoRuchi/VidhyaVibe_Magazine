import api from './api';
import { saveAuthSession, isSessionMarkedOk } from './authStorage';

export type AdminSessionUser = {
  id: number;
  email?: string;
  name?: string;
  isAdmin?: boolean;
};

/** Verify admin session once; uses Bearer token + refresh fallback via api interceptors. */
export async function verifyAdminSession(): Promise<AdminSessionUser> {
  const res = await api.get<AdminSessionUser & { access_token?: string }>('/auth/me');
  const user = res.data;
  if (res.data?.access_token) {
    saveAuthSession(res.data.access_token);
  }
  if (!user?.isAdmin) {
    const err = new Error('admin_required') as Error & { code: string };
    err.code = 'admin_required';
    throw err;
  }
  return user;
}

export { isSessionMarkedOk };
