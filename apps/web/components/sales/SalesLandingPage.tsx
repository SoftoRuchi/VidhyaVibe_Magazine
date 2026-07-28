'use client';

import {
  BookOutlined,
  CheckCircleOutlined,
  ExperimentOutlined,
  HeartOutlined,
  LockOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Collapse, Spin, message } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import type { AgeGroup } from '../../lib/ageGroups';
import api from '../../lib/api';
import { cachedGet } from '../../lib/requestCache';
import {
  trackAddToCart,
  trackInitiateCheckout,
  trackSalesPageView,
  trackViewContent,
} from '../../lib/salesAnalytics';
import {
  AGE_GROUP_PRICING,
  CHILD_BENEFITS,
  COMPARISON_CRITERIA,
  CTA_VARIANTS,
  FAQ_ITEMS,
  FUTURE_SKILLS,
  INSIDE_EVERY_MONTH,
  MONTHLY_JOURNEY,
  PARENT_BENEFITS,
  formatInr,
  offerConfig,
  renewalDisclosure,
  type AgeGroupPricing,
} from '../../lib/salesPageConfig';

interface Magazine {
  id: number;
  title: string;
  category?: string;
}

type CheckoutState = 'idle' | 'processing' | 'error';

function ratingDots(level: 'low' | 'medium' | 'high') {
  const count = level === 'low' ? 1 : level === 'medium' ? 2 : 3;
  return (
    <span className="vv-sale-rating">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className={i < count ? 'on' : ''} />
      ))}
    </span>
  );
}

function matchMagazineForGroup(
  group: AgeGroupPricing,
  magazines: Magazine[],
  ageGroups: AgeGroup[],
) {
  if (!magazines?.length) return null;

  // 1) Prefer explicit "Group N" in title (API magazine list is newest-first / reverse)
  const byTitle = magazines.find((m) => {
    const title = String(m.title || '');
    return new RegExp(`\\bGroup\\s*${group.group}\\b`, 'i').test(title);
  });
  if (byTitle) return byTitle;

  // 2) Prefer magazine id matching group number when ids are 1..4
  const byId = magazines.find((m) => Number(m.id) === group.group);
  if (byId) return byId;

  // 3) Overlap pricing age range with API age-group / magazine category (e.g. 8–10 ↔ 8–11)
  const [lo, hi] = group.ageRange.split('–').map((n) => parseInt(n, 10));
  if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
    const overlappingAg = ageGroups.find((g) => {
      if (g.minAge == null) return false;
      const max = g.maxAge == null ? Infinity : g.maxAge;
      return lo <= max && hi >= g.minAge;
    });
    if (overlappingAg) {
      const bySlug = magazines.find(
        (m) => m.category === overlappingAg.slug || m.category === String(overlappingAg.id),
      );
      if (bySlug) return bySlug;
    }

    const byCategoryRange = magazines.find((m) => {
      const cat = String(m.category || '');
      const m2 = cat.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (!m2) return false;
      const cLo = parseInt(m2[1], 10);
      const cHi = parseInt(m2[2], 10);
      return lo <= cHi && hi >= cLo;
    });
    if (byCategoryRange) return byCategoryRange;
  }

  // 4) Last resort: sort by id ascending so index 0 = Group 1
  const sorted = [...magazines].sort((a, b) => Number(a.id) - Number(b.id));
  return sorted[group.group - 1] ?? sorted[0] ?? null;
}

export default function SalesLandingPage() {
  const router = useRouter();
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<AgeGroupPricing>(AGE_GROUP_PRICING[0]);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    trackSalesPageView();
  }, []);

  // Reset stuck "processing" CTA when user returns via browser back (bfcache) or tab focus.
  useEffect(() => {
    const reset = () => setCheckoutState('idle');
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reset();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reset();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>('.vv-main-scroll');
    if (!scrollEl) return;
    const onScroll = () => setShowStickyCta(scrollEl.scrollTop > 480);
    onScroll();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (offerConfig.urgencyType !== 'real-deadline') return;
    const tick = () => {
      const end = new Date(offerConfig.deadlineIso).getTime();
      const diff = end - Date.now();
      if (diff <= 0) {
        setCountdown('Offer ended');
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [magRes, agRes] = await Promise.all([
          cachedGet<Magazine[]>(api, '/api/magazines', undefined, 120_000),
          cachedGet<AgeGroup[]>(api, '/api/age-groups', undefined, 120_000),
        ]);
        if (cancelled) return;
        setMagazines(magRes.data || []);
        setAgeGroups(agRes.data || []);
      } catch {
        if (!cancelled) {
          setMagazines([]);
          setAgeGroups([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMagazine = useMemo(
    () => matchMagazineForGroup(selectedGroup, magazines, ageGroups),
    [selectedGroup, magazines, ageGroups],
  );

  const scrollToPricing = () => {
    document.getElementById('age-pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectGroup = (group: AgeGroupPricing) => {
    setSelectedGroup(group);
    trackViewContent({ ageGroup: group.group, ageRange: group.ageRange, price: group.todayPrice });
  };

  const handleCheckout = async (_ctaLabel: string) => {
    trackAddToCart({
      ageGroup: selectedGroup.group,
      ageRange: selectedGroup.ageRange,
      price: selectedGroup.todayPrice,
      magazineId: selectedMagazine?.id,
    });
    trackInitiateCheckout({
      ageGroup: selectedGroup.group,
      price: selectedGroup.todayPrice,
      magazineId: selectedMagazine?.id,
    });

    if (!selectedMagazine) {
      router.push('/subscribe');
      return;
    }

    setCheckoutState('processing');
    try {
      router.push(`/subscribe?magazineId=${selectedMagazine.id}`);
    } catch {
      setCheckoutState('error');
      message.error('Could not open subscribe. Please try again.');
    } finally {
      setCheckoutState('idle');
    }
  };

  const urgencyBanner =
    offerConfig.urgencyType === 'real-deadline' ? (
      <div className="vv-sale-urgency vv-sale-urgency--deadline">
        <ThunderboltOutlined /> Offer ends in <strong>{countdown}</strong>
      </div>
    ) : (
      <div className="vv-sale-urgency vv-sale-urgency--evergreen">
        <StarOutlined /> {offerConfig.evergreenLabel}
      </div>
    );

  return (
    <div className="vv-sale-landing">
      {/* ── 1. HERO ── */}
      <section className="vv-sale-hero">
        <div className="container">
          {urgencyBanner}
          <div className="vv-sale-heroGrid">
            <div className="vv-sale-heroCopy">
              <p className="vv-sale-eyebrow">India&apos;s First Future Skills Learning System</p>
              <h1 className="vv-sale-heroTitle">
                Give your child skills schools don&apos;t teach — delivered every month
              </h1>
              <p className="vv-sale-heroSub">
                Not tuition. Not another comic. VidhyaVibe builds curiosity, confidence, and
                practical intelligence through interactive monthly learning — science, finance,
                communication, AI awareness, and more.
              </p>
              <div className="vv-sale-heroCtas">
                <Button
                  type="primary"
                  size="large"
                  className="vv-sale-ctaPrimary"
                  loading={checkoutState === 'processing'}
                  onClick={() => handleCheckout(CTA_VARIANTS.primary)}
                >
                  {CTA_VARIANTS.primary}
                </Button>
                <Button size="large" className="vv-sale-ctaGhost" onClick={scrollToPricing}>
                  See age-group pricing
                </Button>
              </div>
              <p className="vv-sale-renewalNote">{renewalDisclosure()}</p>
            </div>
            <div className="vv-sale-heroVisual" aria-hidden>
              <div className="vv-sale-illusOrbit">
                <div className="vv-sale-illusCore">
                  <RocketOutlined />
                </div>
                <div className="vv-sale-illusSat vv-sale-illusSat--1">
                  <ExperimentOutlined />
                </div>
                <div className="vv-sale-illusSat vv-sale-illusSat--2">
                  <BookOutlined />
                </div>
                <div className="vv-sale-illusSat vv-sale-illusSat--3">
                  <HeartOutlined />
                </div>
              </div>
              <p className="vv-sale-illusCaption">Illustration only — no real child photos</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. SOCIAL PROOF (placeholders) ── */}
      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card vv-sale-social">
            <p className="vv-sale-label">Social proof</p>
            <div className="vv-sale-placeholderGrid">
              {/* TESTIMONIAL PLACEHOLDER */}
              <div className="vv-sale-placeholder">
                [TESTIMONIAL PLACEHOLDER — PARENT NAME, CITY]
                <span>Quote to be added when real reviews are available</span>
              </div>
              <div className="vv-sale-placeholder">
                [INSERT SUBSCRIBER COUNT]
                <span>Families learning with VidhyaVibe</span>
              </div>
              <div className="vv-sale-placeholder">
                [INSERT SCHOOL PARTNER LOGOS]
                <span>Partner institutions — logos pending</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. WHY TODAY'S EDUCATION ISN'T ENOUGH ── */}
      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card">
            <p className="vv-sale-label">The realization</p>
            <h2 className="vv-sale-h2">Why today&apos;s education isn&apos;t enough</h2>
            <p className="vv-sale-lead">
              Schools excel at syllabus — but parents worry about screen addiction, weak
              communication, no financial literacy, and children unprepared for an AI-shaped future.
              You feel it every time your child scrolls without learning anything lasting.
            </p>
            <ul className="vv-sale-painList">
              <li>Endless screen time with little practical knowledge</li>
              <li>No structured path for life skills outside textbooks</li>
              <li>Confidence and curiosity fading behind short videos</li>
              <li>Fear that tomorrow&apos;s jobs need skills schools never teach</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── 4. FUTURE SKILLS ── */}
      <section className="vv-sale-section">
        <div className="container">
          <p className="vv-sale-label">Hope</p>
          <h2 className="vv-sale-h2">Future skills children actually need</h2>
          <div className="vv-sale-skillGrid">
            {FUTURE_SKILLS.map((skill) => (
              <div key={skill} className="vv-sale-skillChip">
                <CheckCircleOutlined /> {skill}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WHY VIDHYAVIBE ── */}
      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card vv-sale-why">
            <p className="vv-sale-label">Trust</p>
            <h2 className="vv-sale-h2">Why VidhyaVibe</h2>
            <p className="vv-sale-lead">
              We don&apos;t sell a magazine — we sell transformation. Monthly interactive editions
              that turn worry into confidence, scrolling into structured discovery, and passive
              consumption into skills that compound year after year.
            </p>
            <div className="vv-sale-whyGrid">
              {[
                {
                  icon: <SafetyCertificateOutlined />,
                  t: 'Premium & ad-free',
                  d: 'No algorithms, no clickbait — editorial-quality learning.',
                },
                {
                  icon: <ThunderboltOutlined />,
                  t: 'Monthly momentum',
                  d: 'A rhythm of new challenges, not one-off downloads.',
                },
                {
                  icon: <UserOutlined />,
                  t: 'Built for parents',
                  d: 'Conversation prompts that bring you into the journey.',
                },
              ].map((item) => (
                <div key={item.t} className="vv-sale-whyCard">
                  <div className="vv-sale-whyIcon">{item.icon}</div>
                  <h3>{item.t}</h3>
                  <p>{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. MONTHLY TRANSFORMATION ── */}
      <section className="vv-sale-section">
        <div className="container">
          <p className="vv-sale-label">Excitement</p>
          <h2 className="vv-sale-h2">The monthly transformation journey</h2>
          <div className="vv-sale-journey">
            {MONTHLY_JOURNEY.map((step, i) => (
              <div
                key={step.month}
                className="vv-sale-journeyStep"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="vv-sale-journeyMonth">{step.month}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. WHAT'S INSIDE ── */}
      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card">
            <p className="vv-sale-label">What&apos;s inside</p>
            <h2 className="vv-sale-h2">Every month, your child receives</h2>
            <ul className="vv-sale-checkList">
              {INSIDE_EVERY_MONTH.map((item) => (
                <li key={item}>
                  <CheckCircleOutlined /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 8. INTERACTIVE LEARNING ── */}
      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card vv-sale-interactive">
            <p className="vv-sale-label">Interactive learning</p>
            <h2 className="vv-sale-h2">Videos, QR codes, experiments & challenges</h2>
            <p className="vv-sale-lead">
              Each edition is designed for active participation — scan, try, reflect, and complete.
              Learning sticks when children do, not just read.
            </p>
            <div className="vv-sale-interactiveIcons">
              <span>
                <ExperimentOutlined /> Experiments
              </span>
              <span>
                <BookOutlined /> Stories & comics
              </span>
              <span>
                <ThunderboltOutlined /> QR activities
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9 & 10. PARENT + CHILD BENEFITS ── */}
      <section className="vv-sale-section">
        <div className="container vv-sale-benefitGrid">
          <div className="vv-sale-card">
            <p className="vv-sale-label">For parents</p>
            <h2 className="vv-sale-h3">Parent benefits</h2>
            <ul className="vv-sale-checkList">
              {PARENT_BENEFITS.map((b) => (
                <li key={b}>
                  <CheckCircleOutlined /> {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="vv-sale-card">
            <p className="vv-sale-label">For children</p>
            <h2 className="vv-sale-h3">Child benefits</h2>
            <ul className="vv-sale-checkList">
              {CHILD_BENEFITS.map((b) => (
                <li key={b}>
                  <CheckCircleOutlined /> {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 11. AGE GROUPS + PRICING ── */}
      <section className="vv-sale-section" id="age-pricing">
        <div className="container">
          <p className="vv-sale-label">Confidence</p>
          <h2 className="vv-sale-h2">Choose your child&apos;s age group</h2>
          <p className="vv-sale-lead vv-sale-lead--center">
            Full-year investment — one annual plan, twelve months of future skills.
          </p>
          {loading ? (
            <div className="vv-sale-loading">
              <Spin size="large" />
            </div>
          ) : (
            <div className="vv-sale-ageGrid">
              {AGE_GROUP_PRICING.map((group) => {
                const selected = selectedGroup.group === group.group;
                const mag = matchMagazineForGroup(group, magazines, ageGroups);
                return (
                  <button
                    key={group.group}
                    type="button"
                    className={`vv-sale-ageCard${selected ? ' vv-sale-ageCard--selected' : ''}`}
                    onClick={() => selectGroup(group)}
                    style={{ '--accent': group.accent } as React.CSSProperties}
                  >
                    <span className="vv-sale-ageBadge">{group.label}</span>
                    <span className="vv-sale-ageRange">Ages {group.ageRange}</span>
                    <div className="vv-sale-priceBlock">
                      <span className="vv-sale-worth">{formatInr(group.worthYearly)}/yr</span>
                      <span className="vv-sale-today">{formatInr(group.todayPrice)}</span>
                      <span className="vv-sale-save">Save {formatInr(group.save)}</span>
                    </div>
                    <ul className="vv-sale-ageSkills">
                      {group.skills.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    {mag && <span className="vv-sale-magHint">→ {mag.title}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="vv-sale-pricingCta">
            <p className="vv-sale-renewalNote">{renewalDisclosure()}</p>
            <Button
              type="primary"
              size="large"
              className="vv-sale-ctaPrimary"
              loading={checkoutState === 'processing'}
              onClick={() => handleCheckout(CTA_VARIANTS.secondary)}
            >
              {CTA_VARIANTS.secondary}
            </Button>
            {checkoutState === 'error' && (
              <p className="vv-sale-checkoutError">
                Payment failed — please retry or{' '}
                <Link
                  href={
                    selectedMagazine ? `/subscribe?magazineId=${selectedMagazine.id}` : '/subscribe'
                  }
                >
                  use subscribe page
                </Link>
              </p>
            )}
          </div>
          <div className="vv-sale-trustRow">
            <span>
              <LockOutlined /> Secure Razorpay checkout
            </span>
            <span>
              <SafetyCertificateOutlined /> [CONFIRM REFUND POLICY]
            </span>
            <span>
              <Link href="/privacy">[LINK TO PRIVACY POLICY]</Link>
            </span>
          </div>
        </div>
      </section>

      {/* ── 12. COMPARISON TABLE ── */}
      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card">
            <p className="vv-sale-label">Compare</p>
            <h2 className="vv-sale-h2">School vs YouTube vs Books vs VidhyaVibe</h2>
            <div className="vv-sale-compareWrap">
              <table className="vv-sale-compareTable">
                <thead>
                  <tr>
                    <th>Criteria</th>
                    <th>School</th>
                    <th>YouTube</th>
                    <th>Books</th>
                    <th className="vv-sale-compareHighlight">VidhyaVibe</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_CRITERIA.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{ratingDots(row.school)}</td>
                      <td>{ratingDots(row.youtube)}</td>
                      <td>{ratingDots(row.books)}</td>
                      <td className="vv-sale-compareHighlight">{ratingDots(row.vidhyavibe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── 13. MULTI-CHILD ── */}
      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card vv-sale-multiChild">
            <h2 className="vv-sale-h3">Have more than one child?</h2>
            <p>
              Add a second age-group plan for your family. [CONFIRM MULTI-CHILD DISCOUNT] — contact
              us or add another plan at checkout.
            </p>
            <Button className="vv-sale-ctaGhost" onClick={scrollToPricing}>
              View all age groups
            </Button>
          </div>
        </div>
      </section>

      {/* ── 14. FAQ ── */}
      <section className="vv-sale-section">
        <div className="container">
          <p className="vv-sale-label">Questions</p>
          <h2 className="vv-sale-h2">Frequently asked questions</h2>
          <Collapse
            className="vv-sale-faq"
            items={FAQ_ITEMS.map((f) => ({
              key: f.key,
              label: f.q,
              children: <p>{f.a}</p>,
            }))}
          />
        </div>
      </section>

      {/* ── 15. FINAL CTA ── */}
      <section className="vv-sale-section vv-sale-finalCta">
        <div className="container">
          <div className="vv-sale-card vv-sale-finalCard">
            {urgencyBanner}
            <h2 className="vv-sale-h2">Your child&apos;s future skills start this year</h2>
            <p className="vv-sale-lead vv-sale-lead--center">
              One annual investment. Twelve months of curiosity, confidence, and practical learning.
            </p>
            <Button
              type="primary"
              size="large"
              className="vv-sale-ctaPrimary"
              loading={checkoutState === 'processing'}
              onClick={() => handleCheckout(CTA_VARIANTS.tertiary)}
            >
              {CTA_VARIANTS.tertiary}
            </Button>
            <p className="vv-sale-renewalNote">{renewalDisclosure()}</p>
          </div>
        </div>
      </section>

      {/* ── 16. FOOTER LINKS ── */}
      <footer className="vv-sale-footer">
        <div className="container">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/contact">Contact</Link>
          <span className="vv-sale-footerNote">[CONFIRM REFUND POLICY] · Payment via Razorpay</span>
        </div>
      </footer>

      {/* Sticky CTA — mobile bottom bar */}
      <div className="vv-sale-stickyCta" data-visible={showStickyCta ? '1' : '0'}>
        <div className="vv-sale-stickyInner">
          <div className="vv-sale-stickyPrice">
            <span>{formatInr(selectedGroup.todayPrice)}/year</span>
            <small>Ages {selectedGroup.ageRange}</small>
          </div>
          <Button
            type="primary"
            className="vv-sale-ctaPrimary vv-sale-stickyBtn"
            loading={checkoutState === 'processing'}
            onClick={() => handleCheckout(CTA_VARIANTS.primary)}
          >
            {CTA_VARIANTS.primary}
          </Button>
        </div>
      </div>
    </div>
  );
}
