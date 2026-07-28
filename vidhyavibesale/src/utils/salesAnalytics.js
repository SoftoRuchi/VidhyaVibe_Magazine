/** Analytics hook points — wire Facebook Pixel & GA4 when ready */

export function trackSalesPageView() {
  // GA4: gtag('event', 'page_view', { page_title: 'Sales' });
  // FB Pixel: fbq('track', 'PageView');
  if (process.env.NODE_ENV === 'development') console.debug('[analytics] PageView');
}

export function trackViewContent(payload) {
  if (process.env.NODE_ENV === 'development') console.debug('[analytics] ViewContent', payload);
}

export function trackAddToCart(payload) {
  if (process.env.NODE_ENV === 'development') console.debug('[analytics] AddToCart', payload);
}

export function trackInitiateCheckout(payload) {
  if (process.env.NODE_ENV === 'development')
    console.debug('[analytics] InitiateCheckout', payload);
}
