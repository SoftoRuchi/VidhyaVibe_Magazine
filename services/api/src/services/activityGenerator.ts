/**
 * VidhyaVibe Learn — generates an ACTIVITY PACK (multiple interactive activities)
 * with subject-specific styles, age banding, and anti-repeat uniqueness.
 */

export type PackActivityType =
  | 'scientist_match'
  | 'lab_mix'
  | 'force_predict'
  | 'build_challenge'
  | 'math_puzzle'
  | 'word_game'
  | 'draw_prompt'
  | 'paint_studio'
  | 'observe_quiz'
  | 'story_choice';

export type HouseholdItem = {
  id: string;
  emoji: string;
  name: string;
};

export type PackActivity = {
  id: string;
  type: PackActivityType;
  title: string;
  badge?: string;
  intro: string;
  items?: HouseholdItem[];
  correctPair?: [string, string];
  reactionEmoji?: string;
  reactionTitle?: string;
  reactionExplain?: string;
  whatIsMade?: string;
  wrongPairHint?: string;
  colours?: { id: string; name: string; hex: string }[];
  targetScene?: string;
  paintSteps?: string[];
  suggestedColourIds?: string[];
  drawPrompt?: string;
  drawTips?: string[];
  puzzle?: string;
  choices?: string[];
  answerIndex?: number;
  explanation?: string;
  setup?: string;
  options?: string[];
  correctOptionIndex?: number;
  question?: string;
  questionOptions?: string[];
  questionAnswerIndex?: number;
  funFact?: string;
  safetyTips?: string[];
  learningBite?: string;
  estimatedMinutes?: number;
};

export type ActivityPack = {
  packTitle: string;
  subject: string;
  ageGroup: string;
  difficulty: string;
  theme: string;
  intro: string;
  activities: PackActivity[];
  source: 'ai';
};

const ALLOWED_SUBJECTS = [
  'Chemistry',
  'Physics',
  'Mathematics',
  'English',
  'Hindi',
  'Drawing',
  'Painting',
  'DIY',
  'Biology',
] as const;

const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
const ALLOWED_AGE_GROUPS = ['8-10', '11-13', '14-16', '17-21'] as const;

/** Remember recent packs so regenerate does not echo the same theme/title. */
const recentFingerprints: string[] = [];
const MAX_RECENT = 40;

function fingerprint(pack: ActivityPack): string {
  const first = pack.activities[0]?.title || '';
  return `${pack.subject}|${pack.ageGroup}|${pack.theme}|${first}`.toLowerCase();
}

function rememberPack(pack: ActivityPack) {
  recentFingerprints.unshift(fingerprint(pack));
  if (recentFingerprints.length > MAX_RECENT) recentFingerprints.pop();
}

function isTooSimilar(pack: ActivityPack): boolean {
  const fp = fingerprint(pack);
  if (recentFingerprints.includes(fp)) return true;
  const title = (pack.activities[0]?.title || '').trim().toLowerCase();
  if (!title) return false;
  const subject = pack.subject.toLowerCase();
  const age = pack.ageGroup;
  return recentFingerprints.some((r) => {
    const [s, a, , t] = r.split('|');
    return s === subject && a === age && t === title;
  });
}

export function normalizeAgeGroup(raw: string): (typeof ALLOWED_AGE_GROUPS)[number] {
  const cleaned = String(raw || '')
    .replace(/–/g, '-')
    .replace(/\s+/g, '')
    .trim();
  if ((ALLOWED_AGE_GROUPS as readonly string[]).includes(cleaned)) {
    return cleaned as (typeof ALLOWED_AGE_GROUPS)[number];
  }
  if (/8.*10/.test(cleaned)) return '8-10';
  if (/11.*13/.test(cleaned)) return '11-13';
  if (/14.*16/.test(cleaned)) return '14-16';
  if (/17.*21/.test(cleaned)) return '17-21';
  return '11-13';
}

export function listActivityMeta() {
  return {
    ageGroups: ALLOWED_AGE_GROUPS.map((g) => ({
      id: g,
      label: `Ages ${g.replace('-', '–')}`,
    })),
    subjects: ALLOWED_SUBJECTS.map((s) => ({ id: s, label: s })),
    difficulties: ALLOWED_DIFFICULTIES.map((d) => ({ id: d, label: d })),
    packNote:
      'AI generates 4–6 age-banded interactive activities (free Gemini by default). Set GEMINI_API_KEY.',
  };
}

function ageBandGuide(ageGroup: string): string {
  switch (ageGroup) {
    case '8-10':
      return `AGE 8–10 (primary):
- Very short sentences, playful words, lots of emoji cues.
- Concrete household / playground ideas only.
- Maths: numbers under 100, simple add/subtract/share.
- Science: colour, bubbles, sink/float, magnets — no formulas.
- Art: big shapes, 3–4 colour choices, simple scenes.
- NEVER use teen exam language, algebra, or abstract chemistry.`;
    case '11-13':
      return `AGE 11–13 (middle school):
- Curious detective tone; short explanations OK.
- Maths: fractions, percentages, patterns, word problems from cricket/bazaar.
- Science: acid/base ideas, forces, photosynthesis — still game-like, light jargon.
- Stories with choices; sketch with observation tips.
- Harder than 8–10 but not board-exam dense.`;
    case '14-16':
      return `AGE 14–16 (secondary):
- Challenge + real-life application; can use light scientific terms with plain English.
- Maths: ratios, linear thinking, estimation, data from sport/money.
- Science: energy, reactions, cells, circuits — still interactive games, not textbook pages.
- Art: composition, mood, perspective prompts.
- Distinct from younger packs — harder puzzles, richer vocabulary.`;
    case '17-21':
      return `AGE 17–21 (senior / young adult):
- Design challenges, critical thinking, careers & daily life (budget, environment, media).
- Maths: multi-step reasoning, percentages, rates, logic.
- Science: why mechanisms work; experiments framed as investigations.
- Writing/story with sharper voice; art with concept briefs.
- Must feel clearly older than the 8–10 and 11–13 packs.`;
    default:
      return 'Match difficulty to the stated age group.';
  }
}

function subjectStyleGuide(subject: string): string {
  const guides: Record<string, string> = {
    Chemistry:
      'Types: scientist_match, lab_mix, observe_quiz (max 1). Fresh household interactions (colour change, density, scent, static) — avoid baking-soda+vinegar cliché when possible.',
    Painting:
      'Types: paint_studio (main), draw_prompt optional. Hex colour palettes + paintSteps for ON-SCREEN painting. Never chemistry.',
    Drawing:
      'Types: draw_prompt (main). Observation sketch quests for finger-drawing on device. Max one observe_quiz.',
    Physics:
      'Types: force_predict, build_challenge. Motion, balance, light, sound, magnets.',
    Mathematics:
      'Types: math_puzzle missions (market, cricket, maps). Age-banded number size. Not identical worksheet every time.',
    English:
      'Types: word_game, story_choice. Captions, riddles, forks. No science labs.',
    Hindi:
      'Types: word_game, story_choice in simple Hindi. तुक, कहानी, शब्द खेल.',
    DIY:
      'Types: build_challenge. Recycle/cardboard maker quests with clear win conditions.',
    Biology:
      'Types: scientist_match + build_challenge nature missions. Living things, senses, plants, food chains.',
  };
  return guides[subject] || guides.Chemistry;
}

const THEME_SPARKS = [
  'monsoon detective',
  'space kitchen',
  'jungle gadget lab',
  'festival lights mission',
  'underwater treasure crew',
  'cricket score academy',
  'train journey explorers',
  'night-sky camp',
  'bazaar inventors',
  'robot pet workshop',
  'cloud castle builders',
  'desert oasis explorers',
  'Himalayan trail scouts',
  'city rooftop garden',
  'time-travel museum',
  'library secret door',
  'kitchen orchestra',
  'bus-stop inventors',
  'river picnic scientists',
  'diwali design studio',
];

function pickSpark(exclude: string[] = []): string {
  const pool = THEME_SPARKS.filter((s) => !exclude.includes(s));
  const list = pool.length ? pool : THEME_SPARKS;
  return list[Math.floor(Math.random() * list.length)];
}

function extractJson(text: string): unknown {
  let trimmed = text.trim();
  // Strip markdown fences if the model wraps JSON anyway
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        throw new Error('invalid_json_from_model');
      }
    }
    throw new Error('invalid_json_from_model');
  }
}

function sanitizePack(
  raw: any,
  defaults: { subject: string; ageGroup: string; difficulty: string },
  minActivities = 3,
): ActivityPack | null {
  // Some models nest under pack / activityPack
  const root =
    raw?.activities != null
      ? raw
      : raw?.pack?.activities != null
        ? raw.pack
        : raw?.activityPack?.activities != null
          ? raw.activityPack
          : raw;

  const activitiesRaw = Array.isArray(root?.activities) ? root.activities : [];
  if (activitiesRaw.length === 0) {
    console.warn('[activities] sanitize: no activities in AI JSON keys=', Object.keys(raw || {}));
    return null;
  }

  const activities: PackActivity[] = activitiesRaw.slice(0, 6).map((a: any, i: number) => {
    const items = Array.isArray(a?.items)
      ? a.items.slice(0, 8).map((it: any, j: number) => ({
          id: String(it?.id || `item${j}`),
          emoji: String(it?.emoji || '🔹'),
          name: String(it?.name || `Item ${j + 1}`),
        }))
      : undefined;
    let correctPair: [string, string] | undefined;
    if (Array.isArray(a?.correctPair) && a.correctPair.length >= 2) {
      correctPair = [String(a.correctPair[0]), String(a.correctPair[1])];
    }
    const colours = Array.isArray(a?.colours)
      ? a.colours.slice(0, 8).map((c: any, j: number) => ({
          id: String(c?.id || `c${j}`),
          name: String(c?.name || `Colour ${j + 1}`),
          hex: String(c?.hex || '#888888'),
        }))
      : undefined;

    return {
      id: String(a?.id || `act-${i + 1}`),
      type: (a?.type as PackActivityType) || 'observe_quiz',
      title: String(a?.title || `Activity ${i + 1}`),
      badge: a?.badge ? String(a.badge) : `Activity ${i + 1}`,
      intro: String(a?.intro || ''),
      items,
      correctPair,
      reactionEmoji: a?.reactionEmoji ? String(a.reactionEmoji) : undefined,
      reactionTitle: a?.reactionTitle ? String(a.reactionTitle) : undefined,
      reactionExplain: a?.reactionExplain ? String(a.reactionExplain) : undefined,
      whatIsMade: a?.whatIsMade ? String(a.whatIsMade) : undefined,
      wrongPairHint: a?.wrongPairHint ? String(a.wrongPairHint) : undefined,
      colours,
      targetScene: a?.targetScene ? String(a.targetScene) : undefined,
      paintSteps: Array.isArray(a?.paintSteps)
        ? a.paintSteps.map((s: any) => String(s))
        : undefined,
      suggestedColourIds: Array.isArray(a?.suggestedColourIds)
        ? a.suggestedColourIds.map((s: any) => String(s))
        : undefined,
      drawPrompt: a?.drawPrompt ? String(a.drawPrompt) : undefined,
      drawTips: Array.isArray(a?.drawTips) ? a.drawTips.map((s: any) => String(s)) : undefined,
      puzzle: a?.puzzle ? String(a.puzzle) : undefined,
      choices: Array.isArray(a?.choices) ? a.choices.map((s: any) => String(s)) : undefined,
      answerIndex: Number.isFinite(Number(a?.answerIndex)) ? Number(a.answerIndex) : undefined,
      explanation: a?.explanation ? String(a.explanation) : undefined,
      setup: a?.setup ? String(a.setup) : undefined,
      options: Array.isArray(a?.options) ? a.options.map((s: any) => String(s)) : undefined,
      correctOptionIndex: Number.isFinite(Number(a?.correctOptionIndex))
        ? Number(a.correctOptionIndex)
        : undefined,
      question: a?.question ? String(a.question) : undefined,
      questionOptions: Array.isArray(a?.questionOptions)
        ? a.questionOptions.map((s: any) => String(s))
        : undefined,
      questionAnswerIndex: Number.isFinite(Number(a?.questionAnswerIndex))
        ? Number(a.questionAnswerIndex)
        : undefined,
      funFact: a?.funFact ? String(a.funFact) : undefined,
      safetyTips: Array.isArray(a?.safetyTips)
        ? a.safetyTips.map((s: any) => String(s))
        : undefined,
      learningBite: a?.learningBite ? String(a.learningBite) : undefined,
      estimatedMinutes: Number(a?.estimatedMinutes) || 10,
    };
  });

  let finalActivities = activities;

  // Soft-fix: keep at most one observe_quiz
  const quizCount = finalActivities.filter((a) => a.type === 'observe_quiz').length;
  if (quizCount > 1) {
    let seen = false;
    finalActivities = finalActivities.filter((a) => {
      if (a.type !== 'observe_quiz') return true;
      if (seen) return false;
      seen = true;
      return true;
    });
  }

  if (finalActivities.length < minActivities) {
    console.warn(
      `[activities] sanitize: got ${finalActivities.length} activities, need >= ${minActivities}`,
    );
    return null;
  }

  return {
    packTitle: String(root?.packTitle || raw?.packTitle || `${defaults.subject} Adventure Pack`),
    subject: defaults.subject,
    ageGroup: defaults.ageGroup,
    difficulty: defaults.difficulty,
    theme: String(root?.theme || raw?.theme || ''),
    intro: String(root?.intro || raw?.intro || ''),
    activities: finalActivities,
    source: 'ai',
  };
}

function buildCurriculumSystemPrompt(subject: string, ageGroup: string): string {
  return `You are a curriculum designer for VidhyaVibe Magazine (India).
Return ONLY a JSON object (no markdown). Create an activity pack kids play on a phone.

${ageBandGuide(ageGroup)}

Subject ${subject}: ${subjectStyleGuide(subject)}

Rules:
- "activities" must be an array of 4 to 6 items (prefer 5).
- Age content MUST match ${ageGroup} only.
- Invent NEW themes every time (no vinegar+baking-soda volcano cliché).
- Max one observe_quiz.
- Interactive types: scientist_match, lab_mix, paint_studio, draw_prompt, math_puzzle, word_game, story_choice, force_predict, build_challenge.
- No chemistry in Painting/Drawing/English/Hindi/Maths.
- Safe Indian home materials.
- Each activity needs: id, type, title, badge, intro, learningBite, estimatedMinutes, plus type-specific fields (items/correctPair, colours/paintSteps, drawPrompt, puzzle/choices/answerIndex, setup/options/correctOptionIndex, question/questionOptions/questionAnswerIndex).

Required JSON keys: packTitle, theme, intro, activities.`;
}

type AiCallResult =
  | { ok: true; pack: ActivityPack }
  | { ok: false; reason: string };

type AiProvider = 'gemini' | 'groq';

function resolveAiConfig(): {
  provider: AiProvider;
  apiKey: string;
  model: string;
} {
  const provider = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase() as AiProvider;

  if (provider === 'groq') {
    const apiKey = String(process.env.GROQ_API_KEY || '').trim();
    const model = (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
    return { provider: 'groq', apiKey, model };
  }

  // Default: free Google Gemini
  const apiKey = String(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '',
  ).trim();
  const model = (
    process.env.GEMINI_MODEL ||
    process.env.GOOGLE_AI_MODEL ||
    'gemini-2.0-flash'
  ).trim();
  return { provider: 'gemini', apiKey, model };
}

function buildUserPrompt(params: {
  subject: string;
  ageGroup: string;
  difficulty: string;
  spark: string;
  uniqueToken: string;
  attempt: number;
  avoidThemes: string[];
}): { system: string; user: string } {
  const system = buildCurriculumSystemPrompt(params.subject, params.ageGroup);
  const avoid =
    params.avoidThemes.length > 0
      ? `\nAvoid repeating: ${params.avoidThemes.slice(0, 8).join(' | ')}`
      : '';
  const targetCount = params.attempt === 1 ? 5 : 4;
  const user = `Create a fresh activity pack as JSON.

Age: ${params.ageGroup}
Subject: ${params.subject}
Difficulty: ${params.difficulty}
Theme spark: ${params.spark}
Token: ${params.uniqueToken}
Need ${targetCount}+ different game activities for this age only.
Kids must DO (match/paint/sketch/build/solve), not only read.${avoid}`;
  return { system, user };
}

function packFromContent(
  content: string,
  defaults: { subject: string; ageGroup: string; difficulty: string },
  minActivities: number,
  finish?: string,
): AiCallResult {
  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch (e: any) {
    console.error('[activities] JSON parse failed', content.slice(0, 240));
    return { ok: false, reason: `invalid_json: ${e?.message || e}` };
  }

  const pack = sanitizePack(parsed, defaults, minActivities);
  if (!pack) {
    return {
      ok: false,
      reason: `pack_rejected (need >=${minActivities} activities; finish=${finish || 'ok'})`,
    };
  }
  return { ok: true, pack };
}

/** Free Google Gemini (AI Studio) */
async function callGeminiPack(params: {
  apiKey: string;
  model: string;
  subject: string;
  ageGroup: string;
  difficulty: string;
  spark: string;
  uniqueToken: string;
  attempt: number;
  avoidThemes: string[];
  minActivities: number;
}): Promise<AiCallResult> {
  const { system, user } = buildUserPrompt(params);
  const temperature = params.attempt === 1 ? 0.85 : 0.7;
  const modelId = params.model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (e: any) {
    return { ok: false, reason: `network_error: ${e?.message || e}` };
  }

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.status ||
      `http_${resp.status}`;
    console.error('[activities] gemini error', data?.error || resp.status);
    return { ok: false, reason: `gemini_api: ${msg}` };
  }

  const block = data?.promptFeedback?.blockReason;
  if (block) {
    return { ok: false, reason: `gemini_blocked: ${block}` };
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const content = Array.isArray(parts)
    ? parts.map((p: any) => String(p?.text || '')).join('\n').trim()
    : '';
  const finish = data?.candidates?.[0]?.finishReason;

  if (!content) {
    console.error('[activities] gemini empty content', { finish, data: JSON.stringify(data).slice(0, 300) });
    return { ok: false, reason: `empty_content (finish=${finish || 'unknown'})` };
  }

  return packFromContent(
    content,
    {
      subject: params.subject,
      ageGroup: params.ageGroup,
      difficulty: params.difficulty,
    },
    params.minActivities,
    finish,
  );
}

/** Free Groq OpenAI-compatible API */
async function callGroqPack(params: {
  apiKey: string;
  model: string;
  subject: string;
  ageGroup: string;
  difficulty: string;
  spark: string;
  uniqueToken: string;
  attempt: number;
  avoidThemes: string[];
  minActivities: number;
}): Promise<AiCallResult> {
  const { system, user } = buildUserPrompt(params);
  const temperature = params.attempt === 1 ? 0.85 : 0.7;

  let resp: Response;
  try {
    resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        temperature,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (e: any) {
    return { ok: false, reason: `network_error: ${e?.message || e}` };
  }

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || data?.error?.code || `http_${resp.status}`;
    console.error('[activities] groq error', data?.error || resp.status);
    return { ok: false, reason: `groq_api: ${msg}` };
  }

  const content = data?.choices?.[0]?.message?.content;
  const finish = data?.choices?.[0]?.finish_reason;
  if (!content || typeof content !== 'string') {
    return { ok: false, reason: `empty_content (finish=${finish || 'unknown'})` };
  }

  return packFromContent(
    content,
    {
      subject: params.subject,
      ageGroup: params.ageGroup,
      difficulty: params.difficulty,
    },
    params.minActivities,
    finish,
  );
}

async function callAiPack(params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  subject: string;
  ageGroup: string;
  difficulty: string;
  spark: string;
  uniqueToken: string;
  attempt: number;
  avoidThemes: string[];
  minActivities: number;
}): Promise<AiCallResult> {
  if (params.provider === 'groq') return callGroqPack(params);
  return callGeminiPack(params);
}

export class ActivityGenerateError extends Error {
  constructor(
    message: string,
    public code: 'ai_key_missing' | 'ai_failed' | 'invalid_pack' = 'ai_failed',
  ) {
    super(message);
    this.name = 'ActivityGenerateError';
  }
}

/** @deprecated — use generateActivityPack */
export async function generateActivity(input: {
  ageGroup: string;
  subject: string;
  difficulty?: string;
  activityType?: string;
}): Promise<ActivityPack> {
  return generateActivityPack(input);
}

/**
 * AI-only pack generation via free Gemini (default) or Groq.
 * Never returns hardcoded activities.
 */
export async function generateActivityPack(input: {
  ageGroup: string;
  subject: string;
  difficulty?: string;
  activityType?: string;
}): Promise<ActivityPack> {
  const ageGroup = normalizeAgeGroup(input.ageGroup);
  const subject = (ALLOWED_SUBJECTS as readonly string[]).includes(input.subject)
    ? input.subject
    : 'Chemistry';
  const difficulty = (ALLOWED_DIFFICULTIES as readonly string[]).includes(
    String(input.difficulty || ''),
  )
    ? String(input.difficulty)
    : 'Easy';

  const { provider, apiKey, model } = resolveAiConfig();
  if (!apiKey) {
    const hint =
      provider === 'groq'
        ? 'Set GROQ_API_KEY in .env (free at https://console.groq.com/keys)'
        : 'Set GEMINI_API_KEY in .env (free at https://aistudio.google.com/apikey)';
    throw new ActivityGenerateError(
      `${provider.toUpperCase()} API key is missing. ${hint}`,
      'ai_key_missing',
    );
  }

  const avoidThemes = recentFingerprints.slice(0, 15);
  const usedSparks: string[] = [];
  let lastError = 'AI did not return a usable activity pack';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const spark = pickSpark(usedSparks);
    usedSparks.push(spark);
    const uniqueToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-a${attempt}`;
    const minActivities = attempt === 1 ? 4 : 3;

    const result = await callAiPack({
      provider,
      apiKey,
      model,
      subject,
      ageGroup,
      difficulty,
      spark,
      uniqueToken,
      attempt,
      avoidThemes,
      minActivities,
    });

    if (!result.ok) {
      lastError = result.reason;
      console.warn(`[activities] attempt ${attempt} failed:`, result.reason);
      continue;
    }

    if (isTooSimilar(result.pack) && attempt < 3) {
      console.warn('[activities] similar pack rejected — retrying');
      lastError = 'AI returned a repeated pack';
      continue;
    }

    rememberPack(result.pack);
    return result.pack;
  }

  throw new ActivityGenerateError(
    `Could not generate a fresh AI pack after retries. ${lastError}`,
    'ai_failed',
  );
}

