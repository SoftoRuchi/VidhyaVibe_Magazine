import type { NextFunction, Response } from 'express';
import { assertCanReadSubject, BookAccessError, subjectIdForChapter } from '../services/bookAccess';
import { requireAuth, type AuthRequest } from './auth';

function sendAccessError(res: Response, e: unknown) {
  if (e instanceof BookAccessError) {
    return res.status(e.status).json({ error: e.code, message: e.message });
  }
  console.error('[courseAccess]', e);
  return res.status(500).json({ error: 'access_check_failed' });
}

/** Logged-in user may open a book only with a valid license (or while the book is still open). */
export function requireCourseAuth(req: AuthRequest, res: Response, next: NextFunction) {
  return requireAuth(req, res, next);
}

export function requireSubjectAccess(req: AuthRequest, res: Response, next: NextFunction) {
  return requireAuth(req, res, async () => {
    const subjectId = Number(req.params.id);
    if (!subjectId) return res.status(400).json({ error: 'invalid_id' });
    try {
      await assertCanReadSubject(Number(req.user!.id), subjectId, req.user?.isAdmin);
      next();
    } catch (e) {
      sendAccessError(res, e);
    }
  });
}

export function requireChapterAccess(req: AuthRequest, res: Response, next: NextFunction) {
  return requireAuth(req, res, async () => {
    const chapterId = Number(req.params.id);
    if (!chapterId) return res.status(400).json({ error: 'invalid_id' });
    try {
      const subjectId = await subjectIdForChapter(chapterId);
      if (!subjectId) return res.status(404).json({ error: 'not_found' });
      await assertCanReadSubject(Number(req.user!.id), subjectId, req.user?.isAdmin);
      next();
    } catch (e) {
      sendAccessError(res, e);
    }
  });
}
