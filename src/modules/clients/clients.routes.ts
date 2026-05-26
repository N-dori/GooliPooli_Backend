import { Router } from 'express';
import { z } from 'zod';
import {
  authRequired,
  requireProjectAccess,
  requireRole,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { CreateClientSchema, PaginationQuerySchema, UpdateClientSchema } from '../../types';
import * as controller from './clients.controller';

/**
 * Mounted at /api/v1/projects/:projectId/clients (mergeParams: true).
 * All routes require the caller to be authenticated and a member of the project.
 */
export const clientsRoutes = Router({ mergeParams: true });

clientsRoutes.use(authRequired, requireProjectAccess);

const ClientIdParam = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
});
const ProjectIdParam = z.object({ projectId: z.string().uuid() });

clientsRoutes.get(
  '/',
  validate('params', ProjectIdParam),
  validate('query', PaginationQuerySchema),
  controller.list,
);

clientsRoutes.post(
  '/',
  validate('params', ProjectIdParam),
  requireRole('admin', 'project_manager'),
  validate('body', CreateClientSchema),
  controller.create,
);

clientsRoutes.get(
  '/:clientId',
  validate('params', ClientIdParam),
  controller.get,
);

clientsRoutes.patch(
  '/:clientId',
  validate('params', ClientIdParam),
  requireRole('admin', 'project_manager'),
  validate('body', UpdateClientSchema),
  controller.update,
);

clientsRoutes.delete(
  '/:clientId',
  validate('params', ClientIdParam),
  requireRole('admin'),
  controller.remove,
);
