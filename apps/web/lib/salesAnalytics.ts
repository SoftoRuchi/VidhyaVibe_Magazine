/**
 * Analytics hook points — wire Facebook Pixel & GA4 IDs when ready.
 * Events: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
 */

export type SalesAnalyticsEvent =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase';

export interface SalesEventPayload {
  ageGroup?: number;
  ageRange?: string;
  price?: number;
  magazineId?: number;
  planId?: number;
  orderId?: string;
}

/** GA4 / Facebook Pixel — PageView on sales page mount */
export function trackSalesPageView() {
  // GA4: gtag('event', 'page_view', { page_title: 'Sales', page_location: window.location.href });
  // FB Pixel: fbq('track', 'PageView');
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] PageView', { page: '/sales' });
  }
}

/** ViewContent — age group card seen / selected */
export function trackViewContent(payload: SalesEventPayload) {
  // GA4: gtag('event', 'view_item', { items: [{ item_id: `group-${payload.ageGroup}` }] });
  // FB Pixel: fbq('track', 'ViewContent', { content_ids: [`group-${payload.ageGroup}`] });
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] ViewContent', payload);
  }
}

/** AddToCart — age group selected for checkout */
export function trackAddToCart(payload: SalesEventPayload) {
  // GA4: gtag('event', 'add_to_cart', { value: payload.price, currency: 'INR' });
  // FB Pixel: fbq('track', 'AddToCart', { value: payload.price, currency: 'INR' });
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] AddToCart', payload);
  }
}

/** InitiateCheckout — Razorpay flow started */
export function trackInitiateCheckout(payload: SalesEventPayload) {
  // GA4: gtag('event', 'begin_checkout', { value: payload.price, currency: 'INR' });
  // FB Pixel: fbq('track', 'InitiateCheckout', { value: payload.price, currency: 'INR' });
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] InitiateCheckout', payload);
  }
}

/** Purchase — payment confirmed (call from razorpay success handler) */
export function trackPurchase(payload: SalesEventPayload) {
  // GA4: gtag('event', 'purchase', { transaction_id: payload.orderId, value: payload.price, currency: 'INR' });
  // FB Pixel: fbq('track', 'Purchase', { value: payload.price, currency: 'INR' });
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics] Purchase', payload);
  }
}
