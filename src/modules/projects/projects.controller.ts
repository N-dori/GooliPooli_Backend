import type { NextFunction, Request, Response } from 'express';
import * as service from './projects.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = await service.listProjects(
      req.query as unknown as { page: number; pageSize: number },
    );
    res.json({ data: page });
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
