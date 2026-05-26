import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { unauthorized } from '../../utils/errors';
import * as service from './auth.service';

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.signup(req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.login(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await service.refresh(req.body.refreshToken as string);
    res.json({ data: tokens });
  } catch {
    next(unauthorized('Invalid refresh token'));
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await service.getMe((req as AuthenticatedRequest).auth.sub);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export function googleStart(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.redirect(service.buildGoogleAuthUrl());
  } catch (err) {
    next(err);
  }
}

export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) throw unauthorized('Missing OAuth code');
    const session = await service.handleGoogleCallback(code);
    const url = service.buildOAuthSuccessRedirect(session);
    res.redirect(url);
  } catch (err) {
    next(err);
  }
}
