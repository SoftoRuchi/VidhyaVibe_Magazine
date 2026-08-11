/**
 * Config-driven Learn Activity engine — types, validation, evaluation.
 * Admins configure activities as JSON; mobile renders by activityType.
 */

export const LEARN_ACTIVITY_TYPES = [
  'CONNECT_DOTS',
  'PAINT',
  'DRAG_DROP',
  'MATCHING',
  'SORTING',
  'ARRANGE_ORDER',
  'TAP_CORRECT',
  'QUIZ',
  'FINANCIAL_DECISION',
  'PATTERN',
  'PUZZLE',
  'LOGIC',
] as const;

export type LearnActivityType = (typeof LEARN_ACTIVITY_TYPES)[number];

export const LEARN_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export const LEARN_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const LEARN_AGE_BANDS = ['8-10', '11-13', '14-16', '17+'] as const;

export type LearnResultStatus =
  | 'COMPLETED_SUCCESS'
  | 'CORRECT'
  | 'PARTIAL'
  | 'INCORRECT'
  | 'TRY_AGAIN'
  | 'COMPLETED_CREATIVE';

export type ValidationIssue = { path: string; message: string };

export function isLearnActivityType(v: unknown): v is LearnActivityType {
  return typeof v === 'string' && (LEARN_ACTIVITY_TYPES as readonly string[]).includes(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v).trim();
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Validate type-specific config. Returns issues (empty = valid). */
export function validateActivityConfig(
  activityType: string,
  config: unknown,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isLearnActivityType(activityType)) {
    issues.push({ path: 'activityType', message: 'Unsupported activity type' });
    return issues;
  }
  if (!config || typeof config !== 'object') {
    issues.push({ path: 'config', message: 'Configuration is required' });
    return issues;
  }
  const c = config as Record<string, any>;

  switch (activityType) {
    case 'CONNECT_DOTS': {
      const dots = asArray(c.dots);
      if (dots.length < 3) issues.push({ path: 'config.dots', message: 'Need at least 3 dots' });
      dots.forEach((d: any, i) => {
        if (d?.x == null || d?.y == null) {
          issues.push({ path: `config.dots[${i}]`, message: 'Each dot needs x and y (0–100)' });
        }
      });
      const seq = asArray(c.sequence).map(String);
      if (seq.length < 3) {
        issues.push({ path: 'config.sequence', message: 'Correct sequence required' });
      }
      break;
    }
    case 'PAINT': {
      if (!str(c.templateImageKey) && !str(c.templateImageUrl)) {
        issues.push({ path: 'config.templateImageKey', message: 'Coloring template image required' });
      }
      break;
    }
    case 'DRAG_DROP': {
      const items = asArray(c.items);
      const targets = asArray(c.targets);
      if (targets.length < 1) issues.push({ path: 'config.targets', message: 'Need at least 1 target' });
      if (items.length < 2) issues.push({ path: 'config.items', message: 'Need at least 2 items' });
      items.forEach((it: any, i) => {
        if (!str(it?.id) || !str(it?.target)) {
          issues.push({ path: `config.items[${i}]`, message: 'Item needs id and target' });
        }
      });
      break;
    }
    case 'MATCHING': {
      const pairs = asArray(c.pairs);
      if (pairs.length < 2) issues.push({ path: 'config.pairs', message: 'Need at least 2 pairs' });
      pairs.forEach((p: any, i) => {
        if (!str(p?.left) || !str(p?.right)) {
          issues.push({ path: `config.pairs[${i}]`, message: 'Pair needs left and right' });
        }
      });
      break;
    }
    case 'SORTING': {
      const cats = asArray(c.categories);
      const items = asArray(c.items);
      if (cats.length < 2) issues.push({ path: 'config.categories', message: 'Need at least 2 categories' });
      if (items.length < 2) issues.push({ path: 'config.items', message: 'Need at least 2 items' });
      items.forEach((it: any, i) => {
        if (!str(it?.id) || !str(it?.categoryId)) {
          issues.push({ path: `config.items[${i}]`, message: 'Item needs id and categoryId' });
        }
      });
      break;
    }
    case 'ARRANGE_ORDER': {
      const items = asArray(c.items);
      if (items.length < 2) issues.push({ path: 'config.items', message: 'Need at least 2 items' });
      if (asArray(c.correctOrder).length < 2) {
        issues.push({ path: 'config.correctOrder', message: 'correctOrder required' });
      }
      break;
    }
    case 'TAP_CORRECT': {
      const options = asArray(c.options);
      if (options.length < 2) issues.push({ path: 'config.options', message: 'Need at least 2 options' });
      if (!str(c.correctOptionId) && !Number.isFinite(Number(c.correctIndex))) {
        issues.push({ path: 'config.correctOptionId', message: 'Correct option required' });
      }
      break;
    }
    case 'QUIZ':
    case 'PATTERN':
    case 'PUZZLE':
    case 'LOGIC': {
      const questions = asArray(c.questions);
      if (questions.length < 1) {
        // allow single-question shape
        if (!str(c.prompt) || asArray(c.options).length < 2) {
          issues.push({
            path: 'config',
            message: 'Provide questions[] or a single prompt with options',
          });
        }
      } else {
        questions.forEach((q: any, i) => {
          if (!str(q?.prompt) || asArray(q?.options).length < 2) {
            issues.push({ path: `config.questions[${i}]`, message: 'Each question needs prompt + options' });
          }
          if (q?.correctIndex == null && !str(q?.correctOptionId)) {
            issues.push({ path: `config.questions[${i}].correctIndex`, message: 'Correct answer required' });
          }
        });
      }
      break;
    }
    case 'FINANCIAL_DECISION': {
      if (!str(c.scenario)) issues.push({ path: 'config.scenario', message: 'Scenario text required' });
      const choices = asArray(c.choices);
      if (choices.length < 2) issues.push({ path: 'config.choices', message: 'Need at least 2 choices' });
      break;
    }
    default:
      break;
  }

  return issues;
}

export function canPublishActivity(input: {
  title?: string;
  activityType?: string;
  config?: unknown;
  ageBands?: string[];
  ageGroupIds?: number[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!str(input.title)) issues.push({ path: 'title', message: 'Title is required' });
  if (!isLearnActivityType(input.activityType)) {
    issues.push({ path: 'activityType', message: 'Activity type is required' });
  } else {
    issues.push(...validateActivityConfig(input.activityType, input.config ?? {}));
  }
  const bands = input.ageBands || [];
  const groups = input.ageGroupIds || [];
  if (bands.length === 0 && groups.length === 0) {
    issues.push({ path: 'ageBands', message: 'Assign at least one age group or age band' });
  }
  return issues;
}

export type EvaluateInput = {
  activityType: string;
  config: Record<string, any>;
  response: Record<string, any>;
  successMessage?: string | null;
  explanation?: string | null;
  points?: number;
};

export type EvaluateOutput = {
  resultStatus: LearnResultStatus;
  resultMessage: string;
  explanation: string;
  score: number; // 0–100
  pointsEarned: number;
  correct?: boolean;
  details?: Record<string, unknown>;
};

function appreciation(status: LearnResultStatus): string {
  switch (status) {
    case 'CORRECT':
    case 'COMPLETED_SUCCESS':
      return '🎉 Great Job!';
    case 'COMPLETED_CREATIVE':
      return '🌟 Wonderful work!';
    case 'PARTIAL':
      return '👏 Well Done — keep going!';
    case 'TRY_AGAIN':
    case 'INCORRECT':
      return '💡 Nice try — you can do it!';
    default:
      return '⭐ Excellent Work!';
  }
}

export function evaluateActivity(input: EvaluateInput): EvaluateOutput {
  const cfg = input.config || {};
  const res = input.response || {};
  const basePoints = Math.max(0, Number(input.points ?? 10) || 10);
  const explanation = str(input.explanation) || 'Keep practicing — every attempt helps you learn.';
  const success =
    str(input.successMessage) || '🎉 Great job! You completed the activity.';

  const type = input.activityType;

  if (type === 'PAINT') {
    const pct = Math.min(100, Math.max(0, num(res.completionPercent, num(cfg.minCompletionPercent, 50))));
    const minPct = num(cfg.minCompletionPercent, 40);
    const ok = res.completed === true || pct >= minPct;
    return {
      resultStatus: 'COMPLETED_CREATIVE',
      resultMessage: ok ? success : 'Keep painting — you are almost there!',
      explanation,
      score: ok ? Math.max(pct, 70) : pct,
      pointsEarned: ok ? basePoints : Math.round(basePoints * 0.3),
      correct: ok,
      details: { appreciation: appreciation('COMPLETED_CREATIVE'), completionPercent: pct },
    };
  }

  if (type === 'CONNECT_DOTS') {
    const expected = asArray(cfg.sequence).map(String);
    const given = asArray(res.sequence).map(String);
    const ok =
      expected.length > 0 &&
      expected.length === given.length &&
      expected.every((id, i) => id === given[i]);
    return {
      resultStatus: ok ? 'COMPLETED_SUCCESS' : 'TRY_AGAIN',
      resultMessage: ok ? success : '💡 Try again — connect the dots in number order.',
      explanation: ok
        ? explanation || 'You connected all the dots in the correct order.'
        : explanation,
      score: ok ? 100 : 0,
      pointsEarned: ok ? basePoints : 0,
      correct: ok,
      details: { appreciation: appreciation(ok ? 'COMPLETED_SUCCESS' : 'TRY_AGAIN') },
    };
  }

  if (type === 'DRAG_DROP') {
    const items = asArray(cfg.items) as Array<{ id: string; target: string }>;
    const placements = (res.placements || {}) as Record<string, string>;
    let correctCount = 0;
    for (const it of items) {
      if (placements[String(it.id)] === String(it.target)) correctCount += 1;
    }
    const total = items.length || 1;
    const score = Math.round((correctCount / total) * 100);
    const status: LearnResultStatus =
      score === 100 ? 'CORRECT' : score >= 50 ? 'PARTIAL' : 'INCORRECT';
    return {
      resultStatus: status,
      resultMessage:
        score === 100
          ? success
          : score >= 50
            ? '👏 Partially correct — review the hints and try again.'
            : '💡 Try again. Think about where each item belongs.',
      explanation,
      score,
      pointsEarned: Math.round(basePoints * (score / 100)),
      correct: score === 100,
      details: { appreciation: appreciation(status), correctCount, total },
    };
  }

  if (type === 'MATCHING') {
    const pairs = asArray(cfg.pairs) as Array<{ id?: string; left: string; right: string }>;
    const matches = (res.matches || {}) as Record<string, string>;
    let correctCount = 0;
    pairs.forEach((p, i) => {
      const key = str(p.id) || String(i);
      const leftKey = str(p.left);
      if (matches[key] === str(p.right) || matches[leftKey] === str(p.right)) correctCount += 1;
    });
    const total = pairs.length || 1;
    const score = Math.round((correctCount / total) * 100);
    const status: LearnResultStatus =
      score === 100 ? 'CORRECT' : score >= 50 ? 'PARTIAL' : 'INCORRECT';
    return {
      resultStatus: status,
      resultMessage: score === 100 ? success : '💡 Some pairs need another look.',
      explanation,
      score,
      pointsEarned: Math.round(basePoints * (score / 100)),
      correct: score === 100,
      details: { appreciation: appreciation(status), correctCount, total },
    };
  }

  if (type === 'SORTING') {
    const items = asArray(cfg.items) as Array<{ id: string; categoryId: string }>;
    const sorts = (res.sorts || res.placements || {}) as Record<string, string>;
    let correctCount = 0;
    for (const it of items) {
      if (sorts[String(it.id)] === String(it.categoryId)) correctCount += 1;
    }
    const total = items.length || 1;
    const score = Math.round((correctCount / total) * 100);
    const status: LearnResultStatus =
      score === 100 ? 'CORRECT' : score >= 50 ? 'PARTIAL' : 'INCORRECT';
    return {
      resultStatus: status,
      resultMessage: score === 100 ? success : '💡 Check which items are needs vs wants (or categories).',
      explanation,
      score,
      pointsEarned: Math.round(basePoints * (score / 100)),
      correct: score === 100,
      details: { appreciation: appreciation(status), correctCount, total },
    };
  }

  if (type === 'ARRANGE_ORDER') {
    const expected = asArray(cfg.correctOrder).map(String);
    const given = asArray(res.order).map(String);
    const ok =
      expected.length > 0 &&
      expected.length === given.length &&
      expected.every((id, i) => id === given[i]);
    return {
      resultStatus: ok ? 'CORRECT' : 'INCORRECT',
      resultMessage: ok ? success : '💡 Try arranging them in the correct order again.',
      explanation,
      score: ok ? 100 : 0,
      pointsEarned: ok ? basePoints : 0,
      correct: ok,
      details: { appreciation: appreciation(ok ? 'CORRECT' : 'INCORRECT') },
    };
  }

  if (type === 'TAP_CORRECT') {
    const correctId = str(cfg.correctOptionId);
    const correctIndex = num(cfg.correctIndex, -1);
    const pickedId = str(res.selectedOptionId);
    const pickedIndex = num(res.selectedIndex, -1);
    const ok =
      (correctId && pickedId === correctId) ||
      (correctIndex >= 0 && pickedIndex === correctIndex);
    return {
      resultStatus: ok ? 'CORRECT' : 'INCORRECT',
      resultMessage: ok ? success : '💡 Not quite — try another object.',
      explanation,
      score: ok ? 100 : 0,
      pointsEarned: ok ? basePoints : 0,
      correct: ok,
      details: { appreciation: appreciation(ok ? 'CORRECT' : 'INCORRECT') },
    };
  }

  if (type === 'FINANCIAL_DECISION') {
    const choices = asArray(cfg.choices) as Array<{
      id: string;
      label: string;
      isBest?: boolean;
      outcome?: string;
      pointsMultiplier?: number;
    }>;
    const selectedId = str(res.selectedChoiceId);
    const choice = choices.find((c) => String(c.id) === selectedId) || choices[num(res.selectedIndex, -1)];
    const best = choices.find((c) => c.isBest) || choices[0];
    const isBest = !!choice && best && String(choice.id) === String(best.id);
    const mult = choice?.pointsMultiplier != null ? Number(choice.pointsMultiplier) : isBest ? 1 : 0.5;
    const outcome = str(choice?.outcome) || explanation;
    return {
      resultStatus: isBest ? 'CORRECT' : 'PARTIAL',
      resultMessage: isBest ? success : '🌟 Good thinking — here is what your choice means.',
      explanation: outcome,
      score: isBest ? 100 : 60,
      pointsEarned: Math.round(basePoints * Math.min(1, Math.max(0, mult))),
      correct: isBest,
      details: {
        appreciation: appreciation(isBest ? 'CORRECT' : 'PARTIAL'),
        selectedChoiceId: selectedId,
        remainingBudget: res.remainingBudget,
      },
    };
  }

  // QUIZ / PATTERN / PUZZLE / LOGIC
  const questions = asArray(cfg.questions);
  if (questions.length > 0) {
    const answers = asArray(res.answers);
    let correctCount = 0;
    questions.forEach((q: any, i) => {
      const ans: any = answers[i];
      const idx = num(ans?.selectedIndex, num(ans, -1));
      const id = str(ans?.selectedOptionId);
      if (str(q.correctOptionId) && id === str(q.correctOptionId)) correctCount += 1;
      else if (num(q.correctIndex, -1) >= 0 && idx === num(q.correctIndex, -1)) correctCount += 1;
    });
    const total = questions.length;
    const score = Math.round((correctCount / total) * 100);
    const status: LearnResultStatus =
      score === 100 ? 'CORRECT' : score >= 50 ? 'PARTIAL' : 'INCORRECT';
    return {
      resultStatus: status,
      resultMessage: score === 100 ? success : '💡 Review the explanations and try again.',
      explanation,
      score,
      pointsEarned: Math.round(basePoints * (score / 100)),
      correct: score === 100,
      details: { appreciation: appreciation(status), correctCount, total },
    };
  }

  // single question quiz shape
  const opts = asArray(cfg.options);
  const idx = num(res.selectedIndex, -1);
  const ok = idx === num(cfg.correctIndex, -1) || str(res.selectedOptionId) === str(cfg.correctOptionId);
  return {
    resultStatus: ok ? 'CORRECT' : 'INCORRECT',
    resultMessage: ok ? success : '💡 Not quite — read the explanation and try again.',
    explanation,
    score: ok ? 100 : 0,
    pointsEarned: ok ? basePoints : 0,
    correct: ok,
    details: { appreciation: appreciation(ok ? 'CORRECT' : 'INCORRECT'), optionsCount: opts.length },
  };
}

export function listActivityTypeMeta() {
  return LEARN_ACTIVITY_TYPES.map((id) => ({
    id,
    label: id
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' '),
  }));
}

