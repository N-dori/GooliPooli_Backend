import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import * as service from './visits.service';

// ── Cross-project diary feed: GET /visits ──────────────────────────────────

export async function listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const result = await service.listAllVisits(
      auth,
      req.query as unknown as Parameters<typeof service.listAllVisits>[1],
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ── Project-scoped (list + create) ─────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const { projectId } = req.params as { projectId: string };
    const result = await service.listVisits(
      projectId,
      auth,
      req.query as unknown as Parameters<typeof service.listVisits>[2],
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId } = req.params as { projectId: string };
    const visit = await service.createVisit(projectId, req.body);
    res.status(201).json({ data: visit });
  } catch (err) {
    next(err);
  }
}

// ── Standalone (get / update / check-in / complete / images) ───────────────

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const visit = await service.getVisit(String(req.params['id']));
    res.json({ data: visit });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const visit = await service.updateVisit(String(req.params['id']), auth, req.body);
    res.json({ data: visit });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.deleteVisit(String(req.params['id']));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const visit = await service.checkIn(String(req.params['id']), auth, req.body);
    res.json({ data: visit });
  } catch (err) {
    next(err);
  }
}

export async function completeVisit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const visit = await service.complete(String(req.params['id']), auth);
    res.json({ data: visit });
  } catch (err) {
    next(err);
  }
}

export async function getImages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const images = await service.listImages(String(req.params['id']));
    res.json({ data: images });
  } catch (err) {
    next(err);
  }
}

export async function addImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const image = await service.addImage(String(req.params['id']), req.body);
    res.status(201).json({ data: image });
  } catch (err) {
    next(err);
  }
}
