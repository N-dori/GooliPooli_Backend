import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as service from './clients.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = req.query as unknown as { page: number; pageSize: number };
    const result = await service.listClients(page);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const client = await service.createClient(auth?.sub ?? null, req.body);
    res.status(201).json({ data: client });
  } catch (err) {
    console.log('Error creating client:', err);
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await service.getClient(String(req.params['id']));
    res.json({ data: client });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await service.updateClient(String(req.params['id']), req.body);
    res.json({ data: client });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deleteClient(String(req.params['id']));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
