import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaLock, FaShieldAlt, FaStar, FaBolt, FaUser } from 'react-icons/fa';
import {
  AGE_GROUP_PRICING,
  API_URL,
  CHILD_BENEFITS,
  COMPARISON_CRITERIA,
  CTA_LABEL,
  FAQ_ITEMS,
  FUTURE_SKILLS,
  INSIDE_EVERY_MONTH,
  MONTHLY_JOURNEY,
  PARENT_BENEFITS,
  SUPPORT_EMAIL,
  WEB_URL,
  formatInr,
  offerConfig,
} from '../config/salesPageConfig';
import { SALES_MEDIA } from '../config/salesMedia';
import ExplainerVideo from './ExplainerVideo';
import SalesPicture from './SalesPicture';
import {
  trackAddToCart,
  trackInitiateCheckout,
  trackSalesPageView,
  trackViewContent,
} from '../utils/salesAnalytics';
import '../sales.css';

function ratingDots(level, criteriaLabel, columnLabel) {
  const count = level === 'low' ? 1 : level === 'medium' ? 2 : 3;
  const quality = level === 'low' ? 'limited' : level === 'medium' ? 'good' : 'excellent';
  return (
    <span className="vv-sale-rating" aria-label={`${criteriaLabel}: ${quality} (${columnLabel})`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < count ? 'on' : ''} aria-hidden="true" />
      ))}
    </span>
  );
}

function resolveMagazineId(group, magazines, ageGroups) {
  // Prefer configured magazineId so links work even before API loads
  if (group.magazineId) return Number(group.magazineId);

  if (!magazines?.length) return null;

  // 1) Prefer explicit "Group N" in title (most reliable — API list order is reverse)
  const byTitle = magazines.find((m) => {
    const title = String(m.title || '');
    return new RegExp(`\\bGroup\\s*${group.group}\\b`, 'i').test(title);
  });
  if (byTitle) return Number(byTitle.id);

  // 2) Prefer magazine id matching group number when ids are 1..4
  const byId = magazines.find((m) => Number(m.id) === group.group);
  if (byId) return Number(byId.id);

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
      if (bySlug) return Number(bySlug.id);
    }

    const byCategoryRange = magazines.find((m) => {
      const cat = String(m.category || '');
      const m2 = cat.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (!m2) return false;
      const cLo = parseInt(m2[1], 10);
      const cHi = parseInt(m2[2], 10);
      return lo <= cHi && hi >= cLo;
    });
    if (byCategoryRange) return Number(byCategoryRange.id);
  }

  // 4) Last resort: sort by id ascending so index 0 = Group 1
  const sorted = [...magazines].sort((a, b) => Number(a.id) - Number(b.id));
  const fallback = sorted[group.group - 1] ?? sorted[0] ?? null;
  return fallback ? Number(fallback.id) : null;
}

function matchMagazineForGroup(group, magazines, ageGroups) {
  const id = resolveMagazineId(group, magazines, ageGroups);
  if (!id) return null;
  return magazines.find((m) => Number(m.id) === id) || { id };
}

function getSubscribeUrl(group, magazines, ageGroups) {
  const magazineId = resolveMagazineId(group, magazines, ageGroups);
  if (!magazineId) return `${WEB_URL}/subscribe`;
  return `${WEB_URL}/subscribe?magazineId=${magazineId}`;
}

function Btn({ children, primary, ghost, loading, disabled, onClick, className = '', href }) {
  const classes = `vv-sale-btn ${primary ? 'vv-sale-ctaPrimary' : ghost ? 'vv-sale-ctaGhost' : ''} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={classes} disabled={loading || disabled} onClick={onClick}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

/** B5 — single risk-reversal line under every primary buy CTA */
function RiskReversalLine() {
  return (
    <p className="vv-sale-riskLine">
      <Link to="/refund-policy">7-day full refund</Link>
      {' · '}
      One-time payment — no auto-charge
      {' · '}
      Secure Razorpay checkout
    </p>
  );
}

function PolicyTrustLinks() {
  return (
    <div className="vv-sale-trustRow">
      <span>
        <FaLock /> Secure Razorpay checkout
      </span>
      <span>
        <FaShieldAlt /> <Link to="/refund-policy">7-day full refund</Link>
      </span>
      <span>
        <Link to="/privacy">Privacy Policy</Link>
      </span>
    </div>
  );
}

export default function SalesLandingPage() {
  const [magazines, setMagazines] = useState([]);
  const [ageGroups, setAgeGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(AGE_GROUP_PRICING[0]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    trackSalesPageView();
  }, []);

  // Browser back/forward restores the page from bfcache with React state intact —
  // clear the stuck "Please wait…" loading state when the user returns.
  useEffect(() => {
    const resetLoading = () => setCheckoutLoading(false);
    const onPageShow = (e) => {
      if (e.persisted) resetLoading();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resetLoading();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const hero = document.querySelector('.vv-sale-hero');
    const pricing = document.getElementById('age-pricing');
    if (!hero || !pricing) return undefined;

    let pastHero = false;
    let pricingVisible = false;

    const update = () => {
      // C4: show after hero, hide while pricing is in view
      setShowStickyCta(pastHero && !pricingVisible);
    };

    const heroObs = new IntersectionObserver(
      ([entry]) => {
        pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        update();
      },
      { threshold: 0 },
    );

    const pricingObs = new IntersectionObserver(
      ([entry]) => {
        pricingVisible = entry.isIntersecting;
        update();
      },
      { threshold: 0.15 },
    );

    heroObs.observe(hero);
    pricingObs.observe(pricing);
    return () => {
      heroObs.disconnect();
      pricingObs.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [magRes, agRes] = await Promise.all([
          axios.get(`${API_URL}/api/magazines`),
          axios.get(`${API_URL}/api/age-groups`),
        ]);
        if (!cancelled) {
          setMagazines(magRes.data || []);
          setAgeGroups(agRes.data || []);
        }
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

  const selectGroup = (group) => {
    setSelectedGroup(group);
    trackViewContent({ ageGroup: group.group, ageRange: group.ageRange, price: group.todayPrice });
  };

  const handleCheckout = useCallback(() => {
    const magazineId = resolveMagazineId(selectedGroup, magazines, ageGroups);
    trackAddToCart({
      ageGroup: selectedGroup.group,
      ageRange: selectedGroup.ageRange,
      price: selectedGroup.todayPrice,
      magazineId,
    });
    trackInitiateCheckout({
      ageGroup: selectedGroup.group,
      price: selectedGroup.todayPrice,
      magazineId,
    });

    setCheckoutLoading(true);
    // Always go to subscribe with magazineId
    const url = magazineId
      ? `${WEB_URL}/subscribe?magazineId=${magazineId}`
      : `${WEB_URL}/subscribe`;
    // If navigation is cancelled / user returns quickly, don't leave the button stuck.
    window.setTimeout(() => setCheckoutLoading(false), 2500);
    window.location.assign(url);
  }, [ageGroups, magazines, selectedGroup]);

  const handleGroupCheckout = useCallback(
    (group, event) => {
      if (event) event.stopPropagation();
      const magazineId = resolveMagazineId(group, magazines, ageGroups);

      trackAddToCart({
        ageGroup: group.group,
        ageRange: group.ageRange,
        price: group.todayPrice,
        magazineId,
      });
      trackInitiateCheckout({
        ageGroup: group.group,
        price: group.todayPrice,
        magazineId,
      });

      setSelectedGroup(group);
    },
    [ageGroups, magazines],
  );

  const urgencyBanner = (
    <div className="vv-sale-urgency vv-sale-urgency--founding">
      <FaStar />
      <div className="vv-sale-urgencyCopy">
        <strong>{offerConfig.foundingLabel}</strong>
        <span>{offerConfig.foundingHook}</span>
      </div>
    </div>
  );

  return (
    <div className="vv-sale-landing">
      {/* B3 — slim brand header */}
      <header className="vv-sale-brandHeader">
        <div className="container vv-sale-brandHeaderInner">
          <Link to="/" className="vv-sale-brandMark" aria-label="VidhyaVibe Magazine">
            <img
              src={SALES_MEDIA.logo.src}
              alt=""
              width={SALES_MEDIA.logo.width}
              height={SALES_MEDIA.logo.height}
              className="vv-sale-brandLogo"
            />
            <span className="vv-sale-titleBadge">
              <span className="vv-sale-titleIcon vv-sale-titleIcon--star" aria-hidden>
                ★
              </span>
              <span className="vv-sale-brandText">VidhyaVibe Magazine</span>
              <span className="vv-sale-titleIcon vv-sale-titleIcon--pen" aria-hidden>
                ✒
              </span>
            </span>
          </Link>
          <div className="vv-sale-brandActions">
            <button type="button" className="vv-sale-headerLink" onClick={scrollToPricing}>
              Pricing
            </button>
            <Btn
              primary
              className="vv-sale-btn--sm"
              loading={checkoutLoading}
              onClick={handleCheckout}
            >
              <span className="vv-sale-headerCtaFull">{CTA_LABEL}</span>
              <span className="vv-sale-headerCtaShort">Stay Ahead</span>
            </Btn>
          </div>
        </div>
      </header>

      <section className="vv-sale-hero">
        <div className="container">
          {urgencyBanner}
          <div className="vv-sale-heroGrid">
            <div className="vv-sale-heroCopy">
              {/* B2 */}
              <p className="vv-sale-eyebrow">A Future Skills Learning System for Indian Families</p>
              <h1 className="vv-sale-heroTitle">
                Give your child skills schools don&apos;t teach — delivered every month
              </h1>
              <p className="vv-sale-heroSub">
                Not tuition. Not another comic. VidhyaVibe builds curiosity, confidence, and
                practical intelligence through interactive monthly learning.
              </p>
              <div className="vv-sale-heroCtas">
                <Btn primary loading={checkoutLoading} onClick={handleCheckout}>
                  {CTA_LABEL}
                </Btn>
                <Btn ghost onClick={scrollToPricing}>
                  See age-group pricing
                </Btn>
              </div>
              <RiskReversalLine />
              <PolicyTrustLinks />
            </div>
            <div className="vv-sale-heroVisual">
              <SalesPicture
                className="vv-sale-heroImg"
                jpg={SALES_MEDIA.hero.jpg}
                webp={SALES_MEDIA.hero.webp}
                alt={SALES_MEDIA.hero.alt}
                priority
                width={800}
                height={600}
              />
            </div>
          </div>
        </div>
      </section>

      <ExplainerVideo onCtaClick={handleCheckout} ctaLoading={checkoutLoading} />

      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card">
            <p className="vv-sale-label">The problem</p>
            <h2 className="vv-sale-h2">Why today&apos;s education isn&apos;t enough</h2>
            <div className="vv-sale-problemLayout">
              <SalesPicture
                className="vv-sale-problemImg"
                jpg={SALES_MEDIA.problem.jpg}
                webp={SALES_MEDIA.problem.webp}
                alt={SALES_MEDIA.problem.alt}
                width={640}
                height={480}
              />
              <div>
                <p className="vv-sale-lead">
                  Schools excel at syllabus — but parents worry about screen addiction, weak
                  communication, no financial literacy, and children unprepared for an AI-shaped
                  future.
                </p>
                <ul className="vv-sale-painList">
                  <li>Endless screen time with little practical knowledge</li>
                  <li>No structured path for life skills outside textbooks</li>
                  <li>Confidence fading behind short videos</li>
                  <li>Fear that tomorrow&apos;s jobs need skills schools never teach</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="vv-sale-section">
        <div className="container">
          <p className="vv-sale-label">What your child learns</p>
          <h2 className="vv-sale-h2">Future skills children actually need</h2>
          <div className="vv-sale-skillGrid">
            {FUTURE_SKILLS.map((skill) => (
              <div key={skill} className="vv-sale-skillChip">
                <FaCheckCircle /> {skill}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card">
            {/* B1 — TRUST eyebrow removed; H2 already says Why VidhyaVibe */}
            <h2 className="vv-sale-h2">Why VidhyaVibe</h2>
            <p className="vv-sale-lead">
              We don&apos;t sell a magazine — we sell transformation. Monthly interactive editions
              that turn worry into confidence and passive consumption into skills that compound.
            </p>
            <div className="vv-sale-whyGrid">
              {[
                {
                  icon: <FaShieldAlt />,
                  t: 'Premium & ad-free',
                  d: 'No algorithms, no clickbait.',
                },
                {
                  icon: <FaBolt />,
                  t: 'Monthly momentum',
                  d: 'A rhythm of new challenges every month.',
                },
                {
                  icon: <FaUser />,
                  t: 'Built for parents',
                  d: 'Conversation prompts for families.',
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

      <section className="vv-sale-section">
        <div className="container">
          <p className="vv-sale-label">The journey</p>
          <h2 className="vv-sale-h2">The monthly transformation journey</h2>
          <div className="vv-sale-journey">
            {MONTHLY_JOURNEY.map((step, index) => {
              const art = SALES_MEDIA.journey[index];
              return (
                <div key={step.month} className="vv-sale-journeyStep">
                  {art && (
                    <SalesPicture
                      className="vv-sale-journeyImg"
                      jpg={art.jpg}
                      webp={art.webp}
                      alt={art.alt}
                      width={400}
                      height={400}
                    />
                  )}
                  <span className="vv-sale-journeyMonth">{step.month}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card vv-sale-insideCard">
            <p className="vv-sale-label">What&apos;s inside</p>
            <h2 className="vv-sale-h2">Every month, your child receives</h2>
            <div className="vv-sale-insideLayout">
              <SalesPicture
                className="vv-sale-insideImg"
                jpg={SALES_MEDIA.magazineMockup.jpg}
                webp={SALES_MEDIA.magazineMockup.webp}
                alt={SALES_MEDIA.magazineMockup.alt}
                width={720}
                height={540}
              />
              <ul className="vv-sale-checkList">
                {INSIDE_EVERY_MONTH.map((item) => (
                  <li key={item}>
                    <FaCheckCircle /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="vv-sale-section">
        <div className="container vv-sale-benefitGrid">
          <div className="vv-sale-card">
            <p className="vv-sale-label">For parents</p>
            <h2 className="vv-sale-h3">Parent benefits</h2>
            <ul className="vv-sale-checkList">
              {PARENT_BENEFITS.map((b) => (
                <li key={b}>
                  <FaCheckCircle /> {b}
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
                  <FaCheckCircle /> {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="vv-sale-section" id="age-pricing">
        <div className="container">
          <p className="vv-sale-label">Pricing</p>
          <h2 className="vv-sale-h2">Choose your child&apos;s age group</h2>
          <p className="vv-sale-lead vv-sale-lead--center">
            Full-year investment — twelve months of future skills.
          </p>
          <div className="vv-sale-pricingUrgency">{urgencyBanner}</div>
          <p className="vv-sale-tuitionAnchor">
            One month of tuition costs Rs.1,500–2,000. A full year of VidhyaVibe starts at Rs.999.
          </p>
          {loading ? (
            <div className="vv-sale-loading">Loading plans…</div>
          ) : (
            <div className="vv-sale-ageGrid">
              {AGE_GROUP_PRICING.map((group) => {
                const selected = selectedGroup.group === group.group;
                const mag = matchMagazineForGroup(group, magazines, ageGroups);
                return (
                  <div
                    key={group.group}
                    className={['vv-sale-ageCard', selected ? 'vv-sale-ageCard--selected' : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectGroup(group)}
                  >
                    <span className="vv-sale-ageBadge">{group.label}</span>
                    <span className="vv-sale-ageRange">
                      {group.audienceNote || `Ages ${group.ageRange}`}
                    </span>
                    <div className="vv-sale-priceBlock">
                      <span className="vv-sale-worth">{formatInr(group.worthYearly)}/yr</span>
                      <span className="vv-sale-today">{formatInr(group.todayPrice)}</span>
                      <span className="vv-sale-perMonth">{group.perMonthLine}</span>
                      <span className="vv-sale-save">Save {formatInr(group.save)}</span>
                    </div>
                    <ul className="vv-sale-ageSkills">
                      {group.skills.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    {mag && <span className="vv-sale-magHint">→ {mag.title}</span>}
                    <Btn
                      primary
                      className="vv-sale-ageCardBtn"
                      href={getSubscribeUrl(group, magazines, ageGroups)}
                      onClick={(event) => handleGroupCheckout(group, event)}
                    >
                      Subscribe Now
                    </Btn>
                  </div>
                );
              })}
            </div>
          )}
          <div className="vv-sale-pricingCta">
            <Btn primary loading={checkoutLoading} onClick={handleCheckout}>
              {CTA_LABEL}
            </Btn>
            <RiskReversalLine />
          </div>
          <PolicyTrustLinks />
        </div>
      </section>

      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card">
            <p className="vv-sale-label">Compare</p>
            <h2 className="vv-sale-h2">School vs YouTube vs Books vs VidhyaVibe</h2>
            <p className="vv-sale-compareLegend" aria-hidden="true">
              ● ● ● = excellent · ● ● ○ = good · ● ○ ○ = limited
            </p>
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
                      <td>{ratingDots(row.school, row.label, 'School')}</td>
                      <td>{ratingDots(row.youtube, row.label, 'YouTube')}</td>
                      <td>{ratingDots(row.books, row.label, 'Books')}</td>
                      <td className="vv-sale-compareHighlight">
                        {ratingDots(row.vidhyavibe, row.label, 'VidhyaVibe')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="vv-sale-section">
        <div className="container">
          <div className="vv-sale-card vv-sale-multiChild">
            <h2 className="vv-sale-h3">Have more than one child?</h2>
            <p>Add a second child&apos;s plan at 20% off at checkout.</p>
            <Btn ghost onClick={scrollToPricing}>
              View all age groups
            </Btn>
          </div>
        </div>
      </section>

      <section className="vv-sale-section">
        <div className="container">
          <p className="vv-sale-label">Questions</p>
          <h2 className="vv-sale-h2">Frequently asked questions</h2>
          <div className="vv-sale-faqList">
            {FAQ_ITEMS.map((f) => (
              <details key={f.key} className="vv-sale-faqItem">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="vv-sale-section vv-sale-finalCta">
        <div className="container">
          <div className="vv-sale-card vv-sale-finalCard">
            {urgencyBanner}
            <h2 className="vv-sale-h2">Your child&apos;s future skills start this year</h2>
            <p className="vv-sale-lead vv-sale-lead--center">
              One annual investment. Twelve months of learning.
            </p>
            <Btn primary loading={checkoutLoading} onClick={handleCheckout}>
              {CTA_LABEL}
            </Btn>
            <RiskReversalLine />
            <PolicyTrustLinks />
          </div>
        </div>
      </section>

      <footer className="vv-sale-footer">
        <div className="container">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund-policy">Refund Policy</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
          <span className="vv-sale-footerNote">7-day full refund · Secure Razorpay checkout</span>
        </div>
      </footer>

      <div className="vv-sale-stickyCta" data-visible={showStickyCta ? '1' : '0'}>
        <div className="vv-sale-stickyInner">
          <Btn
            primary
            className="vv-sale-stickyBtn"
            loading={checkoutLoading}
            onClick={handleCheckout}
          >
            {formatInr(selectedGroup.todayPrice)}/yr · {CTA_LABEL}
          </Btn>
        </div>
      </div>
    </div>
  );
}
