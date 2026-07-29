import axios from 'axios';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { expireSession } from './authRefresh';

export type DeliveryMode = 'ELECTRONIC' | 'PHYSICAL' | 'BOTH';

export interface GuestContact {
  name: string;
  phone: string;
  email: string;
  /** Required when delivery includes physical copy */
  deliveryAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface RazorpayCheckoutParams {
  planId: number;
  magazineId: number;
  months: number;
  deliveryMode?: DeliveryMode;
  couponCode?: string;
  /** When provided and user is not logged in, uses guest checkout (no token). */
  guest?: GuestContact;
  /** Shipping address for PHYSICAL / BOTH (logged-in or guest). */
  shipping?: {
    deliveryAddress: string;
    city: string;
    state?: string;
    pincode: string;
  };
}

interface PlanLike {
  id: number;
  minMonths?: number;
  maxMonths?: number;
}

const GUEST_PREFILL_KEY = 'vv_guest_checkout_prefill';

export function getDefaultMonths(plan?: PlanLike | null): number {
  if (!plan) return 12;
  const min = plan.minMonths ?? 1;
  const max = plan.maxMonths;
  if (max != null && min === max) return max;
  return min >= 12 ? min : Math.max(min, 12);
}

export async function fetchPlanMonths(magazineId: number, planId: number): Promise<number> {
  const { data } = await axios.get<PlanLike[]>(`/api/subscriptions/plans?magazineId=${magazineId}`);
  const plan = (data || []).find((p) => p.id === planId);
  return getDefaultMonths(plan);
}

export function redirectToLogin(returnPath?: string) {
  const path =
    returnPath ||
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/subscribe');
  expireSession({ redirectToLogin: false });
  window.location.href = `/login?redirect=${encodeURIComponent(path)}`;
}

export function storeGuestPrefill(guest: GuestContact) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(GUEST_PREFILL_KEY, JSON.stringify(guest));
}

export function readGuestPrefill(): GuestContact | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GUEST_PREFILL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestContact;
  } catch {
    return null;
  }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Access-Token': token,
  };
}

function pushRazorpayPage(
  router: AppRouterInstance,
  data: {
    rpOrderId?: string;
    orderId?: number;
    finalAmount?: number;
    amount?: number;
    currency?: string;
  },
) {
  const rpOrderId = data?.rpOrderId;
  const orderId = data?.orderId;
  const amount = data?.finalAmount ?? data?.amount;
  const currency = data?.currency ?? 'INR';

  if (!rpOrderId || !orderId || amount == null) {
    throw new Error('order_create_failed');
  }

  const qs = new URLSearchParams({
    rpOrderId: String(rpOrderId),
    orderId: String(orderId),
    amount: String(amount),
    currency: String(currency),
    auto: '1',
  });
  router.push(`/razorpay?${qs.toString()}`);
}

/** Create a subscription order and redirect to Razorpay checkout. */
export async function startRazorpayCheckout(
  params: RazorpayCheckoutParams,
  router: AppRouterInstance,
): Promise<{ acknowledgementSent?: boolean; accountCreated?: boolean }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  // Guest path — no login token required
  if (!token && params.guest) {
    storeGuestPrefill(params.guest);
    const { data } = await axios.post(
      '/api/payments/guest-create-order',
      {
        name: params.guest.name,
        phone: params.guest.phone,
        email: params.guest.email,
        planId: params.planId,
        magazineId: params.magazineId,
        months: params.months,
        deliveryMode: params.deliveryMode ?? 'ELECTRONIC',
        couponCode: params.couponCode,
        deliveryAddress: params.shipping?.deliveryAddress || params.guest.deliveryAddress,
        city: params.shipping?.city || params.guest.city,
        state: params.shipping?.state || params.guest.state,
        pincode: params.shipping?.pincode || params.guest.pincode,
      },
      { withCredentials: true },
    );
    pushRazorpayPage(router, data);
    return {
      acknowledgementSent: Boolean(data?.acknowledgementSent),
      accountCreated: Boolean(data?.accountCreated),
    };
  }

  if (!token) {
    redirectToLogin();
    throw new Error('login_required');
  }

  // Logged-in path — always send Bearer explicitly (do not rely only on interceptors)
  try {
    const { data } = await axios.post(
      '/api/payments/create-order',
      {
        planId: params.planId,
        magazineId: params.magazineId,
        months: params.months,
        deliveryMode: params.deliveryMode ?? 'ELECTRONIC',
        couponCode: params.couponCode,
        deliveryAddress: params.shipping?.deliveryAddress,
        city: params.shipping?.city,
        state: params.shipping?.state,
        pincode: params.shipping?.pincode,
      },
      {
        withCredentials: true,
        headers: authHeaders(token),
      },
    );
    pushRazorpayPage(router, data);
    return {};
  } catch (e: any) {
    const status = e?.response?.status;
    const err = e?.response?.data?.error;
    if (
      status === 401 ||
      err === 'missing_authorization' ||
      err === 'token_expired' ||
      err === 'invalid_token' ||
      err === 'unauthenticated'
    ) {
      redirectToLogin();
      throw new Error('login_required');
    }
    throw e;
  }
}
