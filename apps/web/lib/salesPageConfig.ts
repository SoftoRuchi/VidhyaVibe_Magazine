export type UrgencyType = 'real-deadline' | 'evergreen';

export const offerConfig = {
  urgencyType: 'evergreen' as UrgencyType,
  /** When true: disclose auto-renewal near price & checkout. When false: one-time annual payment copy. */
  autoRenew: false,
  /** Only used when urgencyType === 'real-deadline' */
  deadlineIso: '2026-12-31T23:59:59+05:30',
  evergreenLabel: 'Founding Batch Pricing — Limited Seats This Month',
} as const;

export interface AgeGroupPricing {
  group: number;
  label: string;
  ageRange: string;
  worthYearly: number;
  todayPrice: number;
  save: number;
  accent: string;
  skills: string[];
}

export const AGE_GROUP_PRICING: AgeGroupPricing[] = [
  {
    group: 1,
    label: 'Group 1',
    ageRange: '8–10',
    worthYearly: 2388,
    todayPrice: 999,
    save: 1389,
    accent: '#2d7a3e',
    skills: ['Curiosity', 'Basic logic', 'Communication basics'],
  },
  {
    group: 2,
    label: 'Group 2',
    ageRange: '11–13',
    worthYearly: 2988,
    todayPrice: 1199,
    save: 1789,
    accent: '#3d6b8e',
    skills: ['Critical thinking', 'Financial basics', 'STEM experiments'],
  },
  {
    group: 3,
    label: 'Group 3',
    ageRange: '14–16',
    worthYearly: 3588,
    todayPrice: 1399,
    save: 2189,
    accent: '#8b6914',
    skills: ['AI awareness', 'Leadership', 'Career readiness'],
  },
  {
    group: 4,
    label: 'Group 4',
    ageRange: '17–21',
    worthYearly: 4188,
    todayPrice: 1599,
    save: 2589,
    accent: '#6b3d8e',
    skills: ['Planning', 'Civic sense', 'Future skills mastery'],
  },
];

export const CTA_VARIANTS = {
  primary: "Start My Child's Future Skills Journey",
  secondary: "Secure My Child's Annual Learning",
  tertiary: 'Help My Child Stay Ahead',
} as const;

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

export type CompareRating = 'low' | 'medium' | 'high';

export const COMPARISON_CRITERIA: {
  label: string;
  school: CompareRating;
  youtube: CompareRating;
  books: CompareRating;
  vidhyavibe: CompareRating;
}[] = [
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
    a: "No. VidhyaVibe is India's first Future Skills Learning System — practical life skills, curiosity, and confidence that complement school learning.",
  },
  {
    key: '3',
    q: 'Which age group should I choose?',
    a: "Pick the group matching your child's age: Group 1 (8–10), Group 2 (11–13), Group 3 (14–16), or Group 4 (17–21). Content depth scales with each band.",
  },
  {
    key: '4',
    q: 'How does payment work?',
    a: 'Secure checkout via Razorpay. [CONFIRM POLICY] for refunds, renewals, and billing details.',
  },
  {
    key: '5',
    q: 'Can I cancel or get a refund?',
    a: '[CONFIRM REFUND POLICY] — money-back guarantee badge displayed; final policy text to be confirmed.',
  },
  {
    key: '6',
    q: 'Does my subscription renew automatically?',
    a: offerConfig.autoRenew
      ? 'Yes — your annual plan renews automatically each year. You can cancel anytime before the next billing date. [CONFIRM POLICY]'
      : 'No auto-charge — this is a one-time annual payment for a full year of learning. [CONFIRM POLICY]',
  },
  {
    key: '7',
    q: 'We have children in two age groups — can we add a second plan?',
    a: 'Yes. [CONFIRM MULTI-CHILD DISCOUNT] — add a second age-group plan from the pricing section.',
  },
  {
    key: '8',
    q: "Is my child's data safe?",
    a: 'We take privacy seriously. Child data is protected — see [LINK TO PRIVACY POLICY] for full details.',
  },
];

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function renewalDisclosure() {
  return offerConfig.autoRenew
    ? 'Renews automatically each year — cancel anytime before your next billing date.'
    : 'One-time annual payment — no auto-charge.';
}
