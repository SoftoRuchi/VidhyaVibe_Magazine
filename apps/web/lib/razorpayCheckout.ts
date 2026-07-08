import axios from 'axios';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export type DeliveryMode = 'ELECTRONIC' | 'PHYSICAL' | 'BOTH';

export interface RazorpayCheckoutParams {
  planId: number;
  magazineId: number;
  months: number;
  deliveryMode?: DeliveryMode;
  couponCode?: string;
}

interface PlanLike {
  id: number;
  minMonths?: number;
  maxMonths?: number;
}

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
      : '/sales');
  window.location.href = `/login?redirect=${encodeURIComponent(path)}`;
}

/** Create a subscription order and redirect to Razorpay checkout. */
export async function startRazorpayCheckout(
  params: RazorpayCheckoutParams,
  router: AppRouterInstance,
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!token) {
    redirectToLogin();
    throw new Error('login_required');
  }

  const { data } = await axios.post('/api/payments/create-order', {
    planId: params.planId,
    magazineId: params.magazineId,
    months: params.months,
    deliveryMode: params.deliveryMode ?? 'ELECTRONIC',
    couponCode: params.couponCode,
  });

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
