import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as service from './projects.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const page = await service.listProjects(
      auth,
      req.query as unknown as { page: number; pageSize: number },
    );
    res.json({ data: page });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const project = await service.createProject(auth.sub, req.body);
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await service.getProject(String(req.params['id']));
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await service.updateProject(String(req.params['id']), req.body);
    res.json({ data: project });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deleteProject(String(req.params['id']));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.addMember(String(req.params['id']), req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}
