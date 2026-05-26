import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as service from './users.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.listUsers(
      req.query as unknown as { page: number; pageSize: number },
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await service.getUser(String(req.params['id']));
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await service.updateUser(String(req.params['id']), req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deleteUser(String(req.params['id']));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const user = await service.updateSelf(auth.sub, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}
