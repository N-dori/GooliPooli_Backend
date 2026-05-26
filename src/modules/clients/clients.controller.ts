import type { NextFunction, Request, Response } from 'express';
import * as service from './clients.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params as { projectId: string };
    const page = req.query as unknown as { page: number; pageSize: number };
    const result = await service.listClients(projectId, page);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params as { projectId: string };
    const client = await service.createClient(projectId, req.body);
    res.status(201).json({ data: client });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, clientId } = req.params as { projectId: string; clientId: string };
    const client = await service.getClient(clientId, projectId);
    res.json({ data: client });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, clientId } = req.params as { projectId: string; clientId: string };
    const client = await service.updateClient(clientId, projectId, req.body);
    res.json({ data: client });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, clientId } = req.params as { projectId: string; clientId: string };
    await service.deleteClient(clientId, projectId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
