import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { supabase } from '../lib/supabase';
import type { JwtPayload, UserRole } from '../types';
import { forbidden, notFound, unauthorized } from '../utils/errors';
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

/**
 * Loads the visit at `:id`, then ensures the caller is allowed to touch it.
 * Admins pass through. The assigned worker passes through. Otherwise the
 * caller must be a member of the visit's project.
 *
 * Use on any standalone /visits/:id route — without this, an authenticated
 * user can read or mutate any visit by guessing IDs.
 */
export async function requireVisitProjectAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) throw unauthorized();
    if (auth.role === 'admin') return next();

    const visitId = req.params.id;
    if (!visitId) throw forbidden('Visit not specified');

    const { data: visit, error } = await supabase
      .from('visits')
      .select('project_id, worker_id')
      .eq('id', visitId)
      .maybeSingle<{ project_id: string; worker_id: string | null }>();
    if (error) throw error;
    if (!visit) throw notFound('Visit not found');

    if (visit.worker_id === auth.sub) return next();

    const { data: membership, error: memErr } = await supabase
      .from('user_projects')
      .select('id')
      .eq('user_id', auth.sub)
      .eq('project_id', visit.project_id)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership) throw forbidden("Not authorized for this visit's project");
    next();
  } catch (err) {
    next(err);
  }
}
