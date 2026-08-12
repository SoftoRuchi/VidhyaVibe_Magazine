import { getEnv } from '@magazine/config';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  ActivityGenerateError,
  generateActivityPack,
  listActivityMeta,
  normalizeAgeGroup,
} from '../services/activityGenerator';

const env = getEnv();
const router = Router();

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.ACTIVITY_GENERATE_RATE_LIMIT_MAX || '30'),
  skip: () => env.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_activity_requests', message: 'Please wait and try again.' },
});

/** GET /api/activities/meta */
router.get('/meta', (_req, res) => {
  res.json(listActivityMeta());
});

/**
 * POST /api/activities/generate
 * AI-only multi-activity pack via free Gemini (default) or Groq.
 */
router.post('/generate', generateLimiter, async (req, res) => {
  try {
    const ageGroup = normalizeAgeGroup(String(req.body?.ageGroup || req.body?.age || '11-13'));
    const subject = String(req.body?.subject || 'Chemistry').trim();
    const difficulty = String(req.body?.difficulty || 'Easy').trim();

    if (!subject) {
      return res.status(400).json({ error: 'subject_required' });
    }

    const pack = await generateActivityPack({
      ageGroup,
      subject,
      difficulty,
    });

    res.json({
      ok: true,
      aiEnabled: true,
      provider: (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase(),
      pack,
      activityPack: pack,
    });
  } catch (e: any) {
    console.error('[activities/generate]', e);
    const code = e instanceof ActivityGenerateError ? e.code : 'activity_generate_failed';
    const status = code === 'ai_key_missing' ? 503 : 500;
    res.status(status).json({
      error: code,
      message: e?.message || 'Failed to generate activity pack',
    });
  }
});

export default router;
