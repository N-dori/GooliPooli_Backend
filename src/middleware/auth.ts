import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { supabase } from '../lib/supabase';
import type { JwtPayload, UserRole } from '../types';
import { forbidden, unauthorized } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  auth: JwtPayload;
}

export const authRequired: RequestHandler = (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized('Missing bearer token');
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw unauthorized('Missing bearer token');
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).auth = payload;
    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      next(unauthorized('Token expired'));
      return;
    }
    next(err instanceof Error ? unauthorized(err.message) : err);
  }
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) return next(unauthorized());
    if (!roles.includes(auth.role)) return next(forbidden('Insufficient role'));
    next();
  };
}

/**
 * Ensures the authenticated user has access to the project named by `:projectId`
 * in the URL. Admins are allowed everywhere; managers/workers must be a member.
 */
export async function requireProjectAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) throw unauthorized();
    if (auth.role === 'admin') return next();

    const projectId = req.params.projectId ?? req.params.id;
    if (!projectId) throw forbidden('Project not specified');

    const { data, error } = await supabase
      .from('user_projects')
      .select('id')
      .eq('user_id', auth.sub)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw forbidden('Not a project member');
    next();
  } catch (err) {
    next(err);
  }
}
