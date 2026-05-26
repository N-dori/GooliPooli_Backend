import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as service from './notifications.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const result = await service.listNotifications(
      auth.sub,
      req.query as unknown as { page: number; pageSize: number },
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const notification = await service.markRead(String(req.params['id']), auth.sub);
    res.json({ data: notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    await service.markAllRead(auth.sub);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    await service.deleteNotification(String(req.params['id']), auth.sub);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
