'use client';

import {
  CheckOutlined,
  CloseOutlined,
  HeartOutlined,
  MobileOutlined,
  ReadOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SmileOutlined,
  StarFilled,
  TagOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Collapse, Select, Spin, message } from 'antd';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import subscribeImg from '../../components/images/subscribe.png';
import type { AgeGroup } from '../../lib/ageGroups';
import api from '../../lib/api';
import { assetUrl } from '../../lib/apiBase';
import { getDefaultMonths } from '../../lib/razorpayCheckout';
import { cachedGet } from '../../lib/requestCache';

interface Plan {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  minMonths?: number;
  maxMonths?: number;
  price?: number;
  currency?: string;
  prices?: {
    ELECTRONIC?: { price: number; currency: string };
    PHYSICAL?: { price: number; currency: string };
    BOTH?: { price: number; currency: string };
  };
}

interface Magazine {
  id: number;
  title: string;
  slug?: string;
  description?: string;
  category?: string;
  coverKey?: string | null;
  image?: string;
  sampleEditionId?: number | null;
}

interface SaleOffer {
  id: number;
  type: 'BANNER' | 'DEAL' | 'BENEFIT';
  badge?: string | null;
  title: string;
  subtitle?: string | null;
  highlight?: string | null;
  detail?: string | null;
  color?: string | null;
  borderColor?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  planId?: number | null;
  magazineId?: number | null;
  sortOrder?: number;
}

interface SalesContent {
  banner: SaleOffer | null;
  deals: SaleOffer[];
  benefits: SaleOffer[];
}

const cardShell: React.CSSProperties = {
  padding: '1.4rem 1.6rem',
  borderRadius: 22,
  backgroundColor: 'rgba(255, 255, 255, 0.78)',
  border: '1px solid rgba(61,41,20,0.18)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  margin: '0 0 0.35rem',
  color: '#8b6914',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 700,
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.65rem',
  fontWeight: 800,
  color: '#3d2914',
  fontFamily: 'Georgia, serif',
};

const EMPTY_SALES: SalesContent = { banner: null, deals: [], benefits: [] };

const DEFAULT_BENEFITS = [
  'Unlimited digital access on any device',
  'New editions delivered every month',
  'Safe, ad-free reading experience',
  'Interactive stories & activities',
  'Physical copies available on select plans',
  'Secure payments via Razorpay',
];

const VALUE_PROPS = [
  {
    icon: <ReadOutlined style={{ fontSize: 26, color: '#2d7a3e' }} />,
    title: 'Curated editorial quality',
    text: 'Stories, science, culture, and ideas that spark curiosity — without distractions.',
  },
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 26, color: '#c0392b' }} />,
    title: 'Safe & ad-free',
    text: 'A trusted reading environment — no ads, no pop-ups, just quality content you can rely on.',
  },
  {
    icon: <ThunderboltOutlined style={{ fontSize: 26, color: '#8b6914' }} />,
    title: 'Instant access',
    text: 'Subscribe today and start reading within minutes on phone, tablet, or desktop.',
  },
  {
    icon: <TeamOutlined style={{ fontSize: 26, color: '#3d2914' }} />,
    title: 'Built for every reader',
    text: 'Personal libraries, reader profiles, and age-group browsing so everyone finds the right content.',
  },
  {
    icon: <MobileOutlined style={{ fontSize: 26, color: '#2d7a3e' }} />,
    title: 'Read anywhere',
    text: 'Your digital library travels with you — at home, at work, or on the go.',
  },
  {
    icon: <HeartOutlined style={{ fontSize: 26, color: '#c0392b' }} />,
    title: 'Habits that last',
    text: 'Monthly issues create a rhythm of learning and discovery that endless scrolling cannot replace.',
  },
];

const FEATURE_DEEP_DIVES = [
  {
    title: 'Rich, illustrated editions',
    detail:
      'Every issue is packed with vibrant visuals, stories, puzzles, and insights — designed to hold attention and build understanding.',
  },
  {
    title: 'Topics readers love',
    detail:
      'From science and current affairs to culture and creativity, each magazine connects ideas to everyday life.',
  },
  {
    title: 'Editor-approved content',
    detail:
      'No clickbait, no inappropriate ads, no algorithm-driven rabbit holes. Just editorial-quality material worth your time.',
  },
  {
    title: 'Digital + print flexibility',
    detail:
      'Prefer screen-free reading? Add a physical copy. Need something on the go? The E-Magazine is always in your pocket.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'I look forward to the new issue every month. It feels like a real magazine — thoughtful, visual, and easy to read on any device.',
    name: 'Priya M.',
    role: 'Subscriber',
    stars: 5,
  },
  {
    quote:
      'We tried free apps and they were full of ads. VidhyaVibe Magazine feels premium, focused, and much easier to access.',
    name: 'Rahul K.',
    role: 'Long-time reader',
    stars: 5,
  },
  {
    quote:
      'The age-group and topic sections make it simple to pick the right title. Subscribing took two minutes and reading started immediately.',
    name: 'Ananya S.',
    role: 'Digital subscriber',
    stars: 5,
  },
];

const DELIVERY_COMPARE = {
  headers: ['Feature', 'E-Magazine', 'Physical', 'Both'],
  rows: [
    ['Instant digital access', true, false, true],
    ['Read on phone & tablet', true, false, true],
    ['Printed copy delivered', false, true, true],
    ['Offline flipbook reader', true, false, true],
    ['New issue every month', true, true, true],
    ['Best for travel', true, false, true],
    ['Screen-free reading time', false, true, true],
  ],
};

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Pick a magazine',
    text: 'Choose from editions tailored to your interests, topics, or preferred age group.',
  },
  {
    step: '2',
    title: 'Select your plan',
    text: 'Digital, physical, or both — pick the duration that fits your reading routine.',
  },
  {
    step: '3',
    title: 'Start reading',
    text: 'Pay securely and unlock your library instantly. New issues arrive every month.',
  },
];

const FAQ_ITEMS = [
  {
    key: '1',
    label: 'What do I get with a subscription?',
    children:
      'Every subscription includes access to digital editions in your library, plus new issues as they are published. Depending on your plan, you can also receive physical copies at your doorstep.',
  },
  {
    key: '2',
    label: 'Can I choose digital-only or physical delivery?',
    children:
      'Yes. Plans support E-Magazine (digital), physical copy, or both. Use the subscribe page to pick your delivery preference before checkout.',
  },
  {
    key: '3',
    label: 'How does payment work?',
    children:
      'We use Razorpay for secure online payments. Click Pay Now on any plan to open checkout. You must be logged in to complete a purchase.',
  },
  {
    key: '4',
    label: 'Who are the magazines for?',
    children:
      'VidhyaVibe Magazine offers titles for students, families, and general readers. Browse by age group or topic to find editions that match your interests.',
  },
  {
    key: '5',
    label: 'Can I switch magazines later?',
    children:
      'Each subscription is tied to a specific magazine title. You can subscribe to additional magazines anytime from this page or the browse section.',
  },
  {
    key: '6',
    label: 'Do I need to create an account?',
    children:
      'Yes. A free account lets you manage subscriptions, access your library, and set up reader profiles. You will be prompted to log in before checkout.',
  },
  {
    key: '7',
    label: 'When do I get access after paying?',
    children:
      'Digital access is unlocked immediately after successful payment. Physical copies ship according to your plan and edition schedule.',
  },
  {
    key: '8',
    label: 'Can I read on multiple devices?',
    children:
      'Yes. Log in on any supported device. Reader profiles help families manage shared access when needed.',
  },
  {
    key: '9',
    label: 'Is there a sample I can preview?',
    children:
      'Many magazines offer a free sample edition on the browse page. Open any title and tap Read Sample to flip through before you subscribe.',
  },
];

function formatPrice(amount: number, currency = 'INR') {
  const symbol = currency === 'INR' ? '₹' : '';
  return `${symbol}${Number(amount).toFixed(currency === 'INR' && amount % 1 === 0 ? 0 : 2)}`;
}

function getElectronicPrice(plan: Plan) {
  return plan.prices?.ELECTRONIC?.price ?? plan.prices?.BOTH?.price ?? plan.price ?? 0;
}

function getPhysicalPrice(plan: Plan) {
  return plan.prices?.PHYSICAL?.price ?? null;
}

function getBothPrice(plan: Plan) {
  return plan.prices?.BOTH?.price ?? null;
}

function getCurrency(plan: Plan) {
  return plan.prices?.ELECTRONIC?.currency ?? plan.prices?.BOTH?.currency ?? plan.currency ?? 'INR';
}

function getMonthlyEquivalentPlan(plans: Plan[]): Plan | null {
  const monthly = plans.find((p) => {
    const min = p.minMonths ?? 1;
    const max = p.maxMonths;
    return min < 12 && (max == null || max >= min);
  });
  return monthly ?? null;
}

function computeYearlySavings(plan: Plan, monthlyPlan: Plan | null): string | null {
  if (!monthlyPlan || (plan.minMonths ?? 0) < 12) return null;
  const monthlyRate = getElectronicPrice(monthlyPlan);
  const yearlyTotal = getElectronicPrice(plan);
  const isFixed = plan.maxMonths != null && plan.minMonths === plan.maxMonths;
  const yearlyAsMonthly = isFixed ? yearlyTotal / (plan.minMonths ?? 12) : yearlyTotal;
  if (monthlyRate <= 0 || yearlyAsMonthly >= monthlyRate) return null;
  const saved = Math.round((1 - yearlyAsMonthly / monthlyRate) * 100);
  return saved > 0 ? `Save ~${saved}% vs monthly` : null;
}

function ageGroupLabel(g: AgeGroup) {
  if (g.minAge != null && g.maxAge != null) return `Ages ${g.minAge}–${g.maxAge}`;
  if (g.minAge != null) return `Ages ${g.minAge}+`;
  return 'All ages';
}

export default function SalesPage() {
  const router = useRouter();
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [salesContent, setSalesContent] = useState<SalesContent>(EMPTY_SALES);
  const [selectedMagazineId, setSelectedMagazineId] = useState<number | null>(null);
  const [loadingMagazines, setLoadingMagazines] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingSales, setLoadingSales] = useState(true);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>('.vv-main-scroll');
    if (!scrollEl) return;

    const onScroll = () => setShowStickyCta(scrollEl.scrollTop > 520);
    onScroll();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToPricing() {
    const scrollEl = document.querySelector<HTMLElement>('.vv-main-scroll');
    const target = document.getElementById('pricing');
    if (!scrollEl || !target) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    scrollEl.scrollTo({
      top: scrollEl.scrollTop + (targetRect.top - scrollRect.top) - 12,
      behavior: 'smooth',
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSalesData() {
      try {
        const [groupsRes, salesRes, magazinesRes] = await Promise.all([
          cachedGet<AgeGroup[]>(api, '/api/age-groups', undefined, 120_000),
          cachedGet<{
            banner?: SaleOffer | null;
            deals?: SaleOffer[];
            benefits?: SaleOffer[];
          }>(api, '/api/sales', undefined, 60_000),
          cachedGet<
            Array<{
              id: number;
              title: string;
              slug?: string;
              description?: string;
              category?: string;
              coverKey?: string | null;
              sampleEditionId?: number | null;
            }>
          >(api, '/api/magazines', undefined, 120_000),
        ]);

        if (cancelled) return;

        setAgeGroups(groupsRes.data || []);
        const data = salesRes.data || {};
        setSalesContent({
          banner: data.banner ?? null,
          deals: data.deals ?? [],
          benefits: data.benefits ?? [],
        });

        const list: Magazine[] = (magazinesRes.data || []).map((m) => ({
          id: m.id,
          title: m.title,
          slug: m.slug,
          description: m.description,
          category: m.category,
          coverKey: m.coverKey,
          image: m.coverKey ? assetUrl(m.coverKey) : '',
          sampleEditionId: m.sampleEditionId,
        }));
        setMagazines(list);
        if (list.length > 0) setSelectedMagazineId(list[0].id);
      } catch {
        if (!cancelled) {
          setAgeGroups([]);
          setSalesContent(EMPTY_SALES);
          setMagazines([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSales(false);
          setLoadingMagazines(false);
        }
      }
    }

    loadSalesData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMagazineId) {
      setPlans([]);
      return;
    }
    setLoadingPlans(true);
    axios
      .get(`/api/subscriptions/plans?magazineId=${selectedMagazineId}`)
      .then((r) => setPlans(r.data || []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, [selectedMagazineId]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.minMonths ?? 0) - (b.minMonths ?? 0)),
    [plans],
  );

  const monthlyPlan = useMemo(() => getMonthlyEquivalentPlan(sortedPlans), [sortedPlans]);

  const featuredMagazines = useMemo(() => magazines.slice(0, 6), [magazines]);

  const selectedMagazine = magazines.find((m) => m.id === selectedMagazineId) ?? null;

  const deliveryPriceSummary = useMemo(() => {
    if (!sortedPlans.length) return null;
    const sample = sortedPlans[0];
    const electronic = getElectronicPrice(sample);
    const physical = getPhysicalPrice(sample);
    const both = getBothPrice(sample);
    const currency = getCurrency(sample);
    return { electronic, physical, both, currency };
  }, [sortedPlans]);

  const subscribeHref = selectedMagazineId
    ? `/subscribe?magazineId=${selectedMagazineId}`
    : '/subscribe';

  const banner = salesContent.banner;
  const deals = salesContent.deals;
  const benefits = salesContent.benefits;

  const heroTitle = banner?.title ?? 'Discover something worth reading — every month';
  const heroDetail =
    banner?.detail ??
    'Join thousands of readers who trust VidhyaVibe Magazine for ad-free, thoughtfully curated editions. Unlock digital access, exclusive deals, and fresh issues on a schedule that works for you.';
  const heroBadge = banner?.badge ?? 'Special offers available now';

  const benefitList =
    benefits.length > 0
      ? benefits.map((b) => ({ title: b.title, detail: b.detail ?? b.subtitle ?? null }))
      : DEFAULT_BENEFITS.map((title) => ({ title, detail: null }));

  function resolveHref(offer: SaleOffer) {
    if (offer.ctaHref) return offer.ctaHref;
    if (offer.magazineId && offer.planId) return null;
    if (offer.magazineId) return `/subscribe?magazineId=${offer.magazineId}`;
    return subscribeHref;
  }

  function offerUsesRazorpay(offer: SaleOffer) {
    return Boolean(offer.planId && offer.magazineId && !offer.ctaHref);
  }

  async function handleRazorpayCheckout(
    key: string,
    params: { planId: number; magazineId: number; months?: number },
  ) {
    setCheckoutKey(key);
    try {
      const { fetchPlanMonths, startRazorpayCheckout } = await import('../../lib/razorpayCheckout');
      const months = params.months ?? (await fetchPlanMonths(params.magazineId, params.planId));
      await startRazorpayCheckout({ ...params, months }, router);
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        response?: { data?: { message?: string; error?: string } };
      };
      if (err?.message !== 'login_required') {
        message.error(
          err?.response?.data?.message || err?.response?.data?.error || 'Payment could not start',
        );
      }
    } finally {
      setCheckoutKey(null);
    }
  }

  function renderOfferCta(offer: SaleOffer, buttonProps?: React.ComponentProps<typeof Button>) {
    const label = offer.ctaLabel || (offerUsesRazorpay(offer) ? 'Claim Offer' : 'Learn More');
    const href = resolveHref(offer);

    if (offerUsesRazorpay(offer)) {
      const key = `offer-${offer.id}`;
      return (
        <Button
          {...buttonProps}
          loading={checkoutKey === key}
          onClick={() =>
            handleRazorpayCheckout(key, {
              planId: offer.planId!,
              magazineId: offer.magazineId!,
            })
          }
        >
          {label}
        </Button>
      );
    }

    return (
      <Link href={href || subscribeHref}>
        <Button {...buttonProps}>{label}</Button>
      </Link>
    );
  }

  const primaryCtaProps = {
    type: 'primary' as const,
    size: 'large' as const,
    style: {
      background: 'var(--btn-read-red, #c0392b)',
      borderColor: 'var(--btn-read-red, #c0392b)',
      fontWeight: 700,
      borderRadius: 999,
      paddingInline: 28,
      height: 46,
      boxShadow: '0 10px 24px rgba(192,57,43,0.25)',
    },
  };

  return (
    <div className="vv-sales-page" style={{ padding: '0 0 6rem', minHeight: 'min(100%, 80vh)' }}>
      {/* ── HERO ── */}
      <section
        className="vv-sales-hero"
        style={{
          padding: '2rem 0 2.25rem',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(232,220,196,0.35) 100%)',
          borderBottom: '1px solid rgba(61,41,20,0.12)',
        }}
      >
        <div className="container">
          <div
            className="vv-sales-heroGrid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.15fr 0.85fr',
              gap: '2rem',
              alignItems: 'center',
            }}
          >
            <div>
              {loadingSales ? (
                <Spin />
              ) : (
                <>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: 'rgba(192,57,43,0.12)',
                      border: '1px solid rgba(192,57,43,0.28)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#c0392b',
                      marginBottom: 14,
                    }}
                  >
                    <TagOutlined /> {heroBadge}
                  </div>

                  <h1
                    className="vv-sales-heroTitle"
                    style={{
                      margin: '0 0 1rem',
                      fontSize: '2.35rem',
                      fontWeight: 800,
                      color: '#3d2914',
                      fontFamily: 'Georgia, serif',
                      lineHeight: 1.2,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {heroTitle}
                  </h1>

                  <p
                    style={{
                      margin: '0 0 1.5rem',
                      fontSize: '1.05rem',
                      color: '#5c4a3a',
                      lineHeight: 1.7,
                      maxWidth: 540,
                    }}
                  >
                    {heroDetail}
                  </p>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    {banner && offerUsesRazorpay(banner) ? (
                      renderOfferCta(banner, primaryCtaProps)
                    ) : (
                      <Button {...primaryCtaProps} onClick={scrollToPricing}>
                        {banner?.ctaLabel ?? 'See Plans & Pricing'}
                      </Button>
                    )}
                    <Link href="/magazines">
                      <Button
                        size="large"
                        style={{
                          fontWeight: 700,
                          borderRadius: 999,
                          paddingInline: 24,
                          height: 46,
                          borderColor: 'rgba(61,41,20,0.25)',
                          color: '#3d2914',
                        }}
                      >
                        Browse Magazines
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>

            <div
              className="vv-sales-heroVisual"
              style={{
                borderRadius: 22,
                padding: '1.5rem',
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(61,41,20,0.16)',
                boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
                textAlign: 'center',
              }}
            >
              <Image
                src={subscribeImg}
                alt="Magazine subscription"
                width={200}
                height={200}
                style={{ width: 'auto', height: 180, objectFit: 'contain', margin: '0 auto' }}
                loading="lazy"
              />
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <StarFilled key={n} style={{ color: '#f5a623', fontSize: 16 }} />
                  ))}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: '#3d2914',
                    fontWeight: 700,
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  Loved by readers everywhere
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5c4a3a' }}>
                  Educational, entertaining, and completely ad-free
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR + VALUE PROPOSITION ── */}
      <section style={{ padding: '1.25rem 0 2rem' }}>
        <div className="container">
          <div
            style={{
              ...cardShell,
              padding: '1.5rem 1.6rem 1.75rem',
            }}
          >
            <div
              className="vv-sales-trustBar"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.75rem',
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(61,41,20,0.12)',
              }}
            >
              {[
                { label: 'Ad-free', sub: 'Quality content' },
                { label: 'Monthly', sub: 'Fresh editions' },
                { label: 'Any device', sub: 'Read anywhere' },
                { label: 'Flexible', sub: 'Digital or print' },
              ].map((item) => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, color: '#3d2914', fontSize: 15 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#5c4a3a', marginTop: 2 }}>{item.sub}</div>
                </div>
              ))}
            </div>

            <p style={sectionLabel}>Why VidhyaVibe Magazine</p>
            <h2 style={sectionTitle}>Everything you need for a better reading habit</h2>
            <p style={{ margin: '0 0 1.5rem', color: '#5c4a3a', maxWidth: 620, lineHeight: 1.6 }}>
              A subscription is more than magazines — it is a habit of curiosity, confidence, and
              joy in learning.
            </p>
            <div
              className="vv-sales-valueGrid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
              }}
            >
              {VALUE_PROPS.map((item) => (
                <div
                  key={item.title}
                  style={{
                    padding: '1.35rem 1.4rem',
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.92)',
                    border: '1px solid rgba(61,41,20,0.14)',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.08)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.9)',
                      border: '1px solid rgba(61,41,20,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    {item.icon}
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#3d2914' }}>
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 14, color: '#5c4a3a', lineHeight: 1.55 }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '0.5rem' }}>
        {/* ── STATS ── */}
        <section style={{ marginBottom: '2rem' }}>
          <div
            className="vv-sales-trustBar"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              padding: '1.35rem 1.5rem',
              borderRadius: 20,
              background:
                'linear-gradient(135deg, rgba(45,122,62,0.1) 0%, rgba(255,255,255,0.75) 100%)',
              border: '1px solid rgba(45,122,62,0.2)',
            }}
          >
            {[
              {
                value: loadingMagazines ? '…' : String(magazines.length || '10+'),
                label: 'Magazine titles',
              },
              { value: ageGroups.length ? String(ageGroups.length) : '4+', label: 'Age groups' },
              { value: '100%', label: 'Ad-free reading' },
              { value: '24/7', label: 'Digital library access' },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#2d7a3e',
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: '#5c4a3a', marginTop: 4, fontWeight: 600 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PROBLEM / SOLUTION ── */}
        <section style={{ marginBottom: '2rem' }}>
          <div
            style={{
              ...cardShell,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem',
              padding: '1.6rem 1.75rem',
            }}
            className="vv-sales-heroGrid"
          >
            <div>
              <p style={sectionLabel}>The challenge</p>
              <h2 style={{ ...sectionTitle, fontSize: '1.45rem' }}>Scrolling without substance</h2>
              <p style={{ margin: 0, color: '#5c4a3a', lineHeight: 1.65, fontSize: 14 }}>
                Readers want depth, discovery, and trust — but free apps trade attention for ads.
                Endless scrolling replaces focused reading, and it is hard to know what content is
                truly worthwhile.
              </p>
            </div>
            <div
              style={{
                padding: '1.25rem 1.35rem',
                borderRadius: 16,
                background: 'rgba(45,122,62,0.08)',
                border: '1px solid rgba(45,122,62,0.18)',
              }}
            >
              <p style={sectionLabel}>Our solution</p>
              <h2 style={{ ...sectionTitle, fontSize: '1.45rem' }}>
                Quality magazines, one simple subscription
              </h2>
              <p style={{ margin: 0, color: '#5c4a3a', lineHeight: 1.65, fontSize: 14 }}>
                VidhyaVibe Magazine delivers editor-curated issues on a predictable schedule — like
                a print magazine, but with instant digital access. You choose the title, plan, and
                delivery. You get stories and ideas worth your time.
              </p>
            </div>
          </div>
        </section>

        {/* ── FEATURE DEEP DIVES ── */}
        <section style={{ marginBottom: '2rem' }}>
          <p style={sectionLabel}>Inside every issue</p>
          <h2 style={{ ...sectionTitle, marginBottom: '1.25rem' }}>
            What makes our magazines different
          </h2>
          <div
            className="vv-sales-featureGrid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}
          >
            {FEATURE_DEEP_DIVES.map((item) => (
              <div
                key={item.title}
                style={{
                  padding: '1.25rem 1.35rem',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(61,41,20,0.14)',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#3d2914' }}>
                  {item.title}
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: '#5c4a3a', lineHeight: 1.6 }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── MAGAZINE SHOWCASE ── */}
        {!loadingMagazines && featuredMagazines.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <div style={cardShell}>
              <p style={sectionLabel}>Our collection</p>
              <h2 style={{ ...sectionTitle, marginBottom: '0.5rem' }}>
                Magazines you can subscribe to today
              </h2>
              <p
                style={{ margin: '0 0 1.25rem', color: '#5c4a3a', fontSize: 14, lineHeight: 1.55 }}
              >
                Browse covers, pick a title, and subscribe in minutes. Each magazine publishes fresh
                editions regularly.
              </p>
              <div
                className="vv-sales-magGrid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                {featuredMagazines.map((mag) => (
                  <div
                    key={mag.id}
                    style={{
                      borderRadius: 16,
                      overflow: 'hidden',
                      border: '1px solid rgba(61,41,20,0.16)',
                      background: 'rgba(255,255,255,0.85)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ position: 'relative', height: 200, background: '#e8dcc4' }}>
                      {mag.image ? (
                        <Image
                          src={mag.image}
                          alt={mag.title}
                          fill
                          sizes="200px"
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#8b6914',
                            fontWeight: 700,
                          }}
                        >
                          {mag.title}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        padding: '12px 14px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <h3
                        style={{
                          margin: '0 0 6px',
                          fontSize: 15,
                          color: '#3d2914',
                          fontFamily: 'Georgia, serif',
                        }}
                      >
                        {mag.title}
                      </h3>
                      {mag.category && (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#8b6914',
                            fontWeight: 700,
                            marginBottom: 6,
                          }}
                        >
                          {mag.category}
                        </span>
                      )}
                      <p
                        style={{
                          margin: '0 0 12px',
                          fontSize: 12,
                          color: '#5c4a3a',
                          lineHeight: 1.45,
                          flex: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {mag.description || 'Engaging stories and insights for curious readers.'}
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link href={`/magazine/${mag.id}`}>
                          <Button size="small" style={{ borderRadius: 8, fontWeight: 600 }}>
                            View
                          </Button>
                        </Link>
                        <Button
                          size="small"
                          type="primary"
                          style={{
                            borderRadius: 8,
                            fontWeight: 600,
                            background: 'var(--btn-view-green, #2d7a3e)',
                            borderColor: 'var(--btn-view-green, #2d7a3e)',
                          }}
                          onClick={() => {
                            setSelectedMagazineId(mag.id);
                            scrollToPricing();
                          }}
                        >
                          Subscribe
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── AGE GROUPS ── */}
        {ageGroups.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <div style={cardShell}>
              <p style={sectionLabel}>Who it&apos;s for</p>
              <h2 style={{ ...sectionTitle, marginBottom: '0.5rem' }}>
                Content matched to every age
              </h2>
              <p style={{ margin: '0 0 1.25rem', color: '#5c4a3a', fontSize: 14 }}>
                Pick an age group to browse magazines written for that reading level and interest.
              </p>
              <div
                className="vv-sales-ageGrid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                {ageGroups.map((g) => (
                  <Link key={g.id} href={`/magazines/${g.slug}`} style={{ textDecoration: 'none' }}>
                    <div
                      style={{
                        padding: '1.1rem 1rem',
                        borderRadius: 14,
                        background: g.color || '#4ECDC4',
                        color: '#fff',
                        textAlign: 'center',
                        boxShadow: '0 8px 18px rgba(0,0,0,0.12)',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      <SmileOutlined style={{ fontSize: 22, marginBottom: 8 }} />
                      <div style={{ fontWeight: 800, fontSize: 16, fontFamily: 'Georgia, serif' }}>
                        {g.name}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4 }}>
                        {ageGroupLabel(g)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
        {(loadingSales || deals.length > 0) && (
          <section style={{ marginBottom: '2rem' }}>
            <div style={cardShell}>
              <p style={sectionLabel}>Limited-time offers</p>
              <h2 style={{ ...sectionTitle, marginBottom: '1.25rem' }}>
                Exclusive deals you won&apos;t want to miss
              </h2>
              {loadingSales ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <Spin />
                </div>
              ) : (
                <div
                  className="vv-sales-dealsGrid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      style={{
                        borderRadius: 18,
                        padding: '1.35rem 1.4rem',
                        background:
                          deal.color ||
                          'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(232,220,196,0.5) 100%)',
                        border: `2px solid ${deal.borderColor || 'rgba(61,41,20,0.18)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      {deal.badge && (
                        <span
                          style={{
                            alignSelf: 'flex-start',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: 'rgba(192,57,43,0.12)',
                            color: '#c0392b',
                          }}
                        >
                          {deal.badge}
                        </span>
                      )}
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.2rem',
                          color: '#3d2914',
                          fontFamily: 'Georgia, serif',
                        }}
                      >
                        {deal.title}
                      </h3>
                      {deal.subtitle && (
                        <p style={{ margin: 0, fontSize: 13, color: '#5c4a3a' }}>{deal.subtitle}</p>
                      )}
                      {deal.highlight && (
                        <div
                          style={{
                            fontSize: '1.85rem',
                            fontWeight: 800,
                            color: '#3d2914',
                            fontFamily: 'Georgia, serif',
                            lineHeight: 1.1,
                          }}
                        >
                          {deal.highlight}
                        </div>
                      )}
                      {deal.detail && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            color: '#5c4a3a',
                            flex: 1,
                            lineHeight: 1.5,
                          }}
                        >
                          {deal.detail}
                        </p>
                      )}
                      <div style={{ marginTop: 8 }}>
                        {renderOfferCta(deal, {
                          block: true,
                          size: 'large',
                          type: deal.badge === 'Best Value' ? 'primary' : 'default',
                          style: {
                            borderRadius: 12,
                            fontWeight: 700,
                            height: 44,
                            ...(deal.badge === 'Best Value'
                              ? {
                                  background: 'var(--btn-view-green, #2d7a3e)',
                                  borderColor: 'var(--btn-view-green, #2d7a3e)',
                                }
                              : {}),
                          },
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── DELIVERY COMPARISON ── */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={cardShell}>
            <p style={sectionLabel}>Compare options</p>
            <h2 style={{ ...sectionTitle, marginBottom: '0.5rem' }}>Digital, physical, or both?</h2>
            <p style={{ margin: '0 0 1.25rem', color: '#5c4a3a', fontSize: 14, maxWidth: 640 }}>
              Not sure which delivery type fits your family? Use this guide, then customize on the
              subscribe page.
              {selectedMagazine && (
                <span style={{ display: 'block', marginTop: 6, fontWeight: 600, color: '#3d2914' }}>
                  Showing plans for: {selectedMagazine.title}
                </span>
              )}
            </p>
            <div className="vv-sales-compareWrap">
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 14,
                  minWidth: 480,
                }}
              >
                <thead>
                  <tr>
                    {DELIVERY_COMPARE.headers.map((h, i) => (
                      <th
                        key={h}
                        style={{
                          textAlign: i === 0 ? 'left' : 'center',
                          padding: '12px 10px',
                          borderBottom: '2px solid rgba(61,41,20,0.2)',
                          color: '#3d2914',
                          fontWeight: 700,
                          background: i === 3 ? 'rgba(45,122,62,0.08)' : 'transparent',
                        }}
                      >
                        {h}
                        {i === 3 && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 10,
                              fontWeight: 600,
                              color: '#2d7a3e',
                              marginTop: 2,
                            }}
                          >
                            RECOMMENDED
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DELIVERY_COMPARE.rows.map((row) => (
                    <tr key={row[0] as string}>
                      <td
                        style={{
                          padding: '10px',
                          borderBottom: '1px solid rgba(61,41,20,0.1)',
                          color: '#3a2f26',
                        }}
                      >
                        {row[0] as string}
                      </td>
                      {[1, 2, 3].map((col) => (
                        <td
                          key={col}
                          style={{
                            textAlign: 'center',
                            padding: '10px',
                            borderBottom: '1px solid rgba(61,41,20,0.1)',
                            background: col === 3 ? 'rgba(45,122,62,0.04)' : 'transparent',
                          }}
                        >
                          {row[col] ? (
                            <CheckOutlined style={{ color: '#2d7a3e', fontSize: 16 }} />
                          ) : (
                            <CloseOutlined
                              style={{ color: '#c0392b', fontSize: 14, opacity: 0.7 }}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {deliveryPriceSummary && (
              <div
                style={{
                  marginTop: '1.25rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {[
                  { label: 'E-Magazine from', price: deliveryPriceSummary.electronic },
                  ...(deliveryPriceSummary.physical != null
                    ? [{ label: 'Physical from', price: deliveryPriceSummary.physical }]
                    : []),
                  ...(deliveryPriceSummary.both != null
                    ? [{ label: 'Both from', price: deliveryPriceSummary.both }]
                    : []),
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(61,41,20,0.12)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#5c4a3a' }}>{item.label}</div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: '#3d2914',
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      {formatPrice(item.price, deliveryPriceSummary.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" style={{ marginBottom: '2rem', scrollMarginTop: 90 }}>
          <div style={cardShell}>
            <p style={sectionLabel}>Simple pricing</p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h2 style={{ ...sectionTitle, marginBottom: 4 }}>
                  Choose the plan that fits your family
                </h2>
                <p style={{ margin: 0, color: '#5c4a3a', fontSize: 14 }}>
                  Transparent pricing — no hidden fees. Pay once and start reading immediately.
                </p>
              </div>
              {!loadingMagazines && magazines.length > 0 && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#5c4a3a',
                      marginBottom: 6,
                    }}
                  >
                    Select magazine
                  </label>
                  <Select
                    style={{ minWidth: 240 }}
                    value={selectedMagazineId ?? undefined}
                    onChange={(v) => setSelectedMagazineId(Number(v))}
                    options={magazines.map((m) => ({ label: m.title, value: m.id }))}
                    placeholder="Select magazine"
                  />
                </div>
              )}
            </div>

            {loadingMagazines || loadingPlans ? (
              <div style={{ textAlign: 'center', padding: '2.5rem' }}>
                <Spin size="large" />
              </div>
            ) : sortedPlans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#5c4a3a' }}>
                <RocketOutlined style={{ fontSize: 32, marginBottom: 12, color: '#8b6914' }} />
                <p style={{ margin: 0 }}>
                  Select a magazine above to view available subscription plans.
                </p>
              </div>
            ) : (
              <div
                className="vv-sales-pricingGrid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
                  gap: '1rem',
                }}
              >
                {sortedPlans.map((plan) => {
                  const price = getElectronicPrice(plan);
                  const currency = getCurrency(plan);
                  const isYearly = (plan.minMonths ?? 0) >= 12;
                  const isFixedDuration =
                    plan.maxMonths != null && plan.minMonths === plan.maxMonths;
                  const monthsLabel =
                    plan.minMonths === plan.maxMonths && plan.maxMonths
                      ? `${plan.minMonths} months`
                      : plan.maxMonths
                        ? `${plan.minMonths}–${plan.maxMonths} months`
                        : `${plan.minMonths ?? 1}+ months`;
                  const savingsLabel = computeYearlySavings(plan, monthlyPlan);
                  const physicalAvail = getPhysicalPrice(plan) != null;
                  const bothAvail = getBothPrice(plan) != null;

                  return (
                    <div
                      key={plan.id}
                      style={{
                        borderRadius: 20,
                        padding: '1.5rem 1.45rem',
                        border: isYearly
                          ? '2px solid var(--btn-view-green, #2d7a3e)'
                          : '1px solid rgba(61,41,20,0.18)',
                        background: isYearly
                          ? 'linear-gradient(180deg, rgba(45,122,62,0.08) 0%, rgba(255,255,255,0.7) 100%)'
                          : 'rgba(255,255,255,0.65)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {isYearly && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -11,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '5px 14px',
                            borderRadius: 999,
                            background: 'var(--btn-view-green, #2d7a3e)',
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            letterSpacing: '0.04em',
                          }}
                        >
                          MOST POPULAR
                        </span>
                      )}
                      <h3
                        style={{
                          margin: '0 0 6px',
                          fontSize: '1.15rem',
                          color: '#3d2914',
                          fontFamily: 'Georgia, serif',
                        }}
                      >
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p
                          style={{
                            margin: '0 0 14px',
                            fontSize: 13,
                            color: '#5c4a3a',
                            lineHeight: 1.45,
                          }}
                        >
                          {plan.description}
                        </p>
                      )}
                      <div
                        style={{
                          fontSize: '2rem',
                          fontWeight: 800,
                          color: '#3d2914',
                          fontFamily: 'Georgia, serif',
                          marginBottom: 4,
                        }}
                      >
                        {formatPrice(price, currency)}
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#5c4a3a' }}>
                          {' '}
                          {isFixedDuration ? ' total' : ' / month'}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#5c4a3a' }}>
                        Duration: {monthsLabel}
                      </p>
                      {savingsLabel && (
                        <div
                          style={{
                            alignSelf: 'flex-start',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#2d7a3e',
                            background: 'rgba(45,122,62,0.12)',
                            padding: '4px 10px',
                            borderRadius: 999,
                            marginBottom: 12,
                          }}
                        >
                          {savingsLabel}
                        </div>
                      )}
                      <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0, flex: 1 }}>
                        {[
                          'Full digital library access',
                          'All new issues during your plan',
                          'Read on phone, tablet & desktop',
                          ...(physicalAvail ? ['Physical delivery available'] : []),
                          ...(bothAvail ? ['Combo digital + print available'] : []),
                        ].map((feat) => (
                          <li
                            key={feat}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 13,
                              color: '#3a2f26',
                              marginBottom: 6,
                            }}
                          >
                            <CheckOutlined
                              style={{ color: 'var(--btn-view-green, #2d7a3e)', fontSize: 12 }}
                            />
                            {feat}
                          </li>
                        ))}
                      </ul>
                      <Button
                        block
                        size="large"
                        type={isYearly ? 'primary' : 'default'}
                        loading={checkoutKey === `plan-${plan.id}`}
                        onClick={() => {
                          if (!selectedMagazineId) {
                            message.error('Select a magazine first');
                            return;
                          }
                          handleRazorpayCheckout(`plan-${plan.id}`, {
                            planId: plan.id,
                            magazineId: selectedMagazineId,
                            months: getDefaultMonths(plan),
                          });
                        }}
                        style={{
                          borderRadius: 12,
                          fontWeight: 700,
                          height: 46,
                          ...(isYearly
                            ? {
                                background: 'var(--btn-view-green, #2d7a3e)',
                                borderColor: 'var(--btn-view-green, #2d7a3e)',
                              }
                            : {}),
                        }}
                      >
                        Get Started
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <p
              style={{ margin: '1.25rem 0 0', fontSize: 12, color: '#5c4a3a', textAlign: 'center' }}
            >
              Prices shown for digital (E-Magazine) delivery. Physical and combo options available
              on the{' '}
              <Link href={subscribeHref} style={{ color: '#2d7a3e', fontWeight: 600 }}>
                subscribe page
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ── WHAT'S INCLUDED ── */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={cardShell}>
            <p style={sectionLabel}>What you get</p>
            <h2 style={{ ...sectionTitle, marginBottom: '1.25rem' }}>
              Every subscription includes
            </h2>
            <ul
              className="vv-sales-benefitsGrid"
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.85rem',
              }}
            >
              {benefitList.map((item) => (
                <li
                  key={item.title}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: 14,
                    color: '#3a2f26',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(45,122,62,0.06)',
                    border: '1px solid rgba(45,122,62,0.12)',
                  }}
                >
                  <CheckOutlined
                    style={{ color: 'var(--btn-view-green, #2d7a3e)', marginTop: 3, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    {item.detail && (
                      <div
                        style={{ fontSize: 13, color: '#5c4a3a', marginTop: 4, lineHeight: 1.45 }}
                      >
                        {item.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={{ marginBottom: '2rem' }}>
          <p style={sectionLabel}>How it works</p>
          <h2 style={{ ...sectionTitle, marginBottom: '1.25rem' }}>Three steps to start reading</h2>
          <div
            className="vv-sales-stepsGrid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
            }}
          >
            {HOW_IT_WORKS.map((step, idx) => (
              <div
                key={step.step}
                style={{
                  ...cardShell,
                  padding: '1.35rem 1.4rem',
                  textAlign: 'center',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.08)',
                  position: 'relative',
                }}
              >
                {idx < HOW_IT_WORKS.length - 1 && (
                  <span
                    className="vv-sales-stepArrow"
                    style={{
                      position: 'absolute',
                      right: -18,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#8b6914',
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                    aria-hidden
                  >
                    →
                  </span>
                )}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--btn-read-red, #c0392b)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  {step.step}
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#3d2914' }}>
                  {step.title}
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: '#5c4a3a', lineHeight: 1.5 }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={cardShell}>
            <p style={sectionLabel}>Real readers</p>
            <h2 style={{ ...sectionTitle, marginBottom: '1.25rem' }}>
              What subscribers are saying
            </h2>
            <div
              className="vv-sales-testimonialGrid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
              }}
            >
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  style={{
                    padding: '1.25rem 1.3rem',
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(61,41,20,0.14)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', gap: 3 }}>
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <StarFilled key={i} style={{ color: '#f5a623', fontSize: 14 }} />
                    ))}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: '#3a2f26',
                      lineHeight: 1.6,
                      fontStyle: 'italic',
                      flex: 1,
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#3d2914' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#5c4a3a' }}>{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PARENT PEACE OF MIND ── */}
        <section style={{ marginBottom: '2rem' }}>
          <div
            style={{
              ...cardShell,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1.5rem',
              padding: '1.75rem 1.85rem',
              background:
                'linear-gradient(135deg, rgba(192,57,43,0.06) 0%, rgba(255,255,255,0.85) 100%)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'rgba(192,57,43,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#c0392b' }} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 style={{ ...sectionTitle, fontSize: '1.35rem', marginBottom: 8 }}>
                Read with confidence
              </h2>
              <p style={{ margin: 0, color: '#5c4a3a', lineHeight: 1.65, fontSize: 14 }}>
                Secure Razorpay checkout, no third-party ads, and content organised by topic and age
                group. You stay in control of your library — we handle the quality, delivery, and
                access.
              </p>
            </div>
            <Link href={subscribeHref}>
              <Button
                type="primary"
                size="large"
                style={{
                  background: 'var(--btn-view-green, #2d7a3e)',
                  borderColor: 'var(--btn-view-green, #2d7a3e)',
                  fontWeight: 700,
                  borderRadius: 999,
                  paddingInline: 24,
                  height: 46,
                }}
              >
                Start Secure Checkout
              </Button>
            </Link>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={cardShell}>
            <p style={sectionLabel}>Questions</p>
            <h2 style={{ ...sectionTitle, marginBottom: '1rem' }}>Frequently asked questions</h2>
            <Collapse
              items={FAQ_ITEMS}
              bordered={false}
              style={{ background: 'transparent' }}
              expandIconPosition="end"
            />
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section>
          <div
            style={{
              ...cardShell,
              textAlign: 'center',
              padding: '2.5rem 2rem',
              background:
                'linear-gradient(135deg, rgba(45,122,62,0.12) 0%, rgba(255,255,255,0.85) 50%, rgba(192,57,43,0.08) 100%)',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.75rem',
                fontSize: '1.85rem',
                fontWeight: 800,
                color: '#3d2914',
                fontFamily: 'Georgia, serif',
              }}
            >
              Ready to start your reading journey?
            </h2>
            <p
              style={{
                margin: '0 auto 1.5rem',
                maxWidth: 480,
                color: '#5c4a3a',
                lineHeight: 1.6,
                fontSize: 15,
              }}
            >
              Pick a plan above or explore our full magazine collection. Your next great read is one
              click away.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button {...primaryCtaProps} onClick={scrollToPricing}>
                View Plans & Pricing
              </Button>
              <Link href="/magazines">
                <Button
                  size="large"
                  style={{
                    fontWeight: 700,
                    borderRadius: 999,
                    paddingInline: 28,
                    height: 46,
                    borderColor: 'rgba(61,41,20,0.25)',
                    color: '#3d2914',
                  }}
                >
                  Explore Magazines
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ── STICKY CTA BAR ── */}
      <div className="vv-sales-stickyCta" data-visible={showStickyCta ? '1' : '0'}>
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                color: '#3d2914',
                fontSize: 15,
                fontFamily: 'Georgia, serif',
              }}
            >
              Start reading today
            </div>
            <div style={{ fontSize: 12, color: '#5c4a3a' }}>
              {selectedMagazine
                ? `Plans for ${selectedMagazine.title}`
                : 'Pick a plan and subscribe in minutes'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              type="primary"
              size="large"
              onClick={scrollToPricing}
              style={{
                background: 'var(--btn-read-red, #c0392b)',
                borderColor: 'var(--btn-read-red, #c0392b)',
                fontWeight: 700,
                borderRadius: 999,
              }}
            >
              View Pricing
            </Button>
            <Link href={subscribeHref}>
              <Button
                size="large"
                style={{
                  fontWeight: 700,
                  borderRadius: 999,
                  borderColor: 'rgba(61,41,20,0.25)',
                  color: '#3d2914',
                }}
              >
                Full Subscribe Form
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
