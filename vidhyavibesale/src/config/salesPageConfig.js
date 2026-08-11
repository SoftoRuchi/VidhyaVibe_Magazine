export const offerConfig = {
  // E1 Option A (recommended): honest date-based founding price — no fake countdown
  urgencyType: 'founding-date',
  autoRenew: false,
  deadlineIso: '2026-08-15T23:59:59+05:30',
  foundingLabel: 'Independence Offer — from Rs.999 · ends 15 August, then from Rs.1,499 🎉',
  // foundingHook: 'Founding families keep this price for life.',
};

export const AGE_GROUP_PRICING = [
  {
    group: 1,
    label: 'Group 1',
    ageRange: '8–10',
    // Live magazine IDs from reader.vidhyavibe.in
    magazineId: 1,
    worthYearly: 2388,
    todayPrice: 999,
    save: 1389,
    perMonthLine: "That's under Rs.85/month",
    featured: false,
    skills: ['Curiosity', 'Basic logic', 'Communication basics'],
  },
  {
    group: 2,
    label: 'Group 2',
    ageRange: '11–13',
    magazineId: 2,
    worthYearly: 2988,
    todayPrice: 1199,
    save: 1789,
    perMonthLine: "That's under Rs.100/month",
    featured: true,
    skills: ['Critical thinking', 'Financial basics', 'STEM experiments'],
  },
  {
    group: 3,
    label: 'Group 3',
    ageRange: '14–16',
    magazineId: 3,
    worthYearly: 3588,
    todayPrice: 1399,
    save: 2189,
    perMonthLine: "That's under Rs.117/month",
    featured: false,
    skills: ['AI awareness', 'Leadership', 'Career readiness'],
  },
  {
    group: 4,
    label: 'Group 4',
    ageRange: '17–21',
    magazineId: 4,
    // D4 Option B — framed for young adults, not "your child"
    audienceNote: 'Ages 17–21 — for young adults (gift it, or they join themselves)',
    worthYearly: 4188,
    todayPrice: 1599,
    save: 2589,
    perMonthLine: "That's under Rs.134/month",
    featured: false,
    skills: ['Self-directed planning', 'Civic sense', 'Career & future skills'],
  },
];

export const RECOMMENDED_GROUP = 2;

export const CTA_LABEL = 'Help My Child Stay Ahead';

/** @deprecated Use CTA_LABEL — kept for any external imports */
export const CTA_VARIANTS = {
  primary: CTA_LABEL,
  secondary: CTA_LABEL,
  tertiary: CTA_LABEL,
};

export const FUTURE_SKILLS = [
  'Science Experiments',
  'Real Life Mathematics',
  'Financial Literacy',
  'Communication Skills',
  'Health & Nutrition',
  'AI Awareness',
  'Logical Thinking',
  'Emotional Intelligence',
  'Leadership & Planning',
  'Creativity & DIY',
  'Civic Sense',
  'Critical Thinking',
];

export const MONTHLY_JOURNEY = [
  {
    month: 'Month 1',
    title: 'Spark curiosity',
    text: 'Your child discovers a new theme through stories, comics, and a hands-on starter activity.',
  },
  {
    month: 'Month 2',
    title: 'Build confidence',
    text: 'Structured challenges turn knowledge into action — experiments, puzzles, and real-world math.',
  },
  {
    month: 'Month 3',
    title: 'Connect with you',
    text: 'Parent interaction prompts create meaningful conversations beyond screen time.',
  },
  {
    month: 'Month 4+',
    title: 'Compound growth',
    text: 'Each edition layers skills — communication, logic, finance, and future readiness — month after month.',
  },
];

export const INSIDE_EVERY_MONTH = [
  'Interactive digital magazine edition',
  'Embedded videos & QR-linked activities',
  'Experiments & DIY projects',
  'Stories, comics & challenges',
  'Parent conversation starters',
  'Age-calibrated difficulty',
];

export const PARENT_BENEFITS = [
  'Turn screen time into structured learning',
  'No ads, no random algorithm feeds',
  'Clear monthly rhythm you can trust',
  'Conversation starters that connect families',
  'Skills schools rarely teach — in one place',
];

export const CHILD_BENEFITS = [
  'Practical knowledge for real life',
  'Confidence through completion & challenges',
  'Curiosity that outlasts a single scroll session',
  'Future-ready skills: AI, finance, communication',
  'Fun format — not another textbook',
];

export const COMPARISON_CRITERIA = [
  {
    label: 'Cost (annual value)',
    school: 'high',
    youtube: 'low',
    books: 'medium',
    vidhyavibe: 'medium',
  },
  {
    label: 'Structured curriculum',
    school: 'high',
    youtube: 'low',
    books: 'medium',
    vidhyavibe: 'high',
  },
  {
    label: 'Life-skills coverage',
    school: 'low',
    youtube: 'low',
    books: 'medium',
    vidhyavibe: 'high',
  },
  {
    label: 'Screen-time health',
    school: 'high',
    youtube: 'low',
    books: 'high',
    vidhyavibe: 'high',
  },
  {
    label: 'Parent involvement',
    school: 'medium',
    youtube: 'low',
    books: 'medium',
    vidhyavibe: 'high',
  },
  {
    label: 'Practical application',
    school: 'medium',
    youtube: 'low',
    books: 'low',
    vidhyavibe: 'high',
  },
];

export const FAQ_ITEMS = [
  {
    key: '1',
    q: 'What exactly does my child receive each month?',
    a: "A full interactive digital magazine edition with videos, QR activities, experiments, stories, comics, challenges, and parent interaction prompts — calibrated to your child's age group.",
  },
  {
    key: '2',
    q: 'Is this a school textbook or tuition?',
    a: 'No. VidhyaVibe is a Future Skills Learning System for Indian families — practical life skills, curiosity, and confidence that complement school learning.',
  },
  {
    key: '3',
    q: 'Which age group should I choose?',
    a: "Pick the group matching the learner's age: Group 1 (8–10), Group 2 (11–13), Group 3 (14–16), or Group 4 (17–21 — for young adults; gift it, or they join themselves).",
  },
  {
    key: '4',
    q: 'How does payment work?',
    a: 'Secure one-time checkout via Razorpay. We offer a 7-day full money-back guarantee; see our Refund Policy for details.',
  },
  {
    key: '5',
    q: 'Can I cancel or get a refund?',
    a: 'Yes — 7-day full money-back guarantee, no questions asked.',
  },
  {
    key: '6',
    q: 'Does my subscription renew automatically?',
    a: offerConfig.autoRenew
      ? 'Yes — your annual plan renews automatically each year. Cancel anytime before your next billing date.'
      : 'No auto-charge — this is a one-time annual payment for a full year of learning.',
  },
  {
    key: '7',
    q: 'We have children in two age groups — can we add a second plan?',
    a: "Yes. Add a second child's plan at 20% off at checkout.",
  },
  {
    key: '8',
    q: "Is my child's data safe?",
    a: "We take privacy seriously. We never use real children's photos in our marketing. Child data is protected — see our Privacy Policy for full details.",
  },
];

export function formatInr(amount) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function renewalDisclosure() {
  return offerConfig.autoRenew
    ? 'Renews automatically each year — cancel anytime before your next billing date.'
    : 'One-time annual payment — no auto-charge.';
}

export const WEB_URL = process.env.REACT_APP_WEB_URL || 'https://reader.vidhyavibe.in';
export const API_URL = process.env.REACT_APP_API_URL || 'https://readerapi.vidhyavibe.in';
export const SUPPORT_EMAIL = 'support@vidhyavibe.in';
