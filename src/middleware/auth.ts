import type { Request, RequestHandler } from 'express';
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
