import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { requireAuth } from './auth';

/** Logged-in user (or admin) may open published course books and quizzes. */
export function requireCourseAuth(req: AuthRequest, res: Response, next: NextFunction) {
  return requireAuth(req, res, next);
}
