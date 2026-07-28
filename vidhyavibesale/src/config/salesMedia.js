/** Sales page media — drop final WebP/JPG/MP4 into public/images/sales/ using these filenames.
 *  Only set `webp` when the .webp file actually exists (missing WebP 404s break <picture> in Chrome).
 */
export const SALES_MEDIA = {
  hero: {
    jpg: '/images/sales/hero-parent-child.jpeg',
    webp: null,
    alt: 'Illustrated Indian parent and child doing a science experiment together',
    priority: true,
  },
  magazineMockup: {
    jpg: '/images/sales/magazine-mockup.jpg',
    webp: null,
    alt: 'Tablet mockup showing VidhyaVibe magazine sample spreads',
  },
  problem: {
    jpg: '/images/sales/problem-scroll.jpg',
    webp: null,
    alt: 'Illustrated child scrolling on a phone in cold blue light, with a warm home behind',
  },
  journey: [
    {
      jpg: '/images/sales/journey-month-1.jpg',
      webp: null,
      alt: 'Month 1 — sparking curiosity through stories and a starter activity',
    },
    {
      jpg: '/images/sales/journey-month-2.jpg',
      webp: null,
      alt: 'Month 2 — building confidence with experiments and challenges',
    },
    {
      jpg: '/images/sales/journey-month-3.jpg',
      webp: null,
      alt: 'Month 3 — parent and child connecting through conversation prompts',
    },
    {
      jpg: '/images/sales/journey-month-4.jpg',
      webp: null,
      alt: 'Month 4+ — skills compounding month after month',
    },
  ],
  explainer: {
    mp4: '/images/sales/saleVideo.mp4',
    posterJpg: '/images/sales/explainer-poster.jpg',
    youtubeId: '',
  },
  // Page header branding (UI) — transparent background logo
  logo: {
    src: '/images/sales/logo_rmbg.png',
    alt: 'VidhyaVibe — Educate. Grow. Connect.',
    width: 200,
    height: 64,
  },
  // Browser / app icon (tab favicon, PWA)
  appLogo: {
    src: '/images/sales/logonew.png',
    alt: 'VidhyaVibe',
  },
};
