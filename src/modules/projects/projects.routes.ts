import { Router } from 'express';
import { z } from 'zod';
import {
  authRequired,
  requireProjectAccess,
  requireRole,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { CreateProjectSchema, PaginationQuerySchema, UpdateProjectSchema } from '../../types';
import * as controller from './projects.controller';

export const projectsRoutes = Router();
projectsRoutes.use(authRequired);

const IdParam = z.object({ id: z.string().uuid() });

const AssignSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'member']).default('member'),
});

projectsRoutes.get('/', validate('query', PaginationQuerySchema), controller.list);

projectsRoutes.post(
  '/',
  requireRole('admin'),
  validate('body', CreateProjectSchema),
  controller.create,
);

projectsRoutes.get(
  '/:id',
  validate('params', IdParam),
  requireProjectAccess,
  controller.get,
);

projectsRoutes.patch(
  '/:id',
  validate('params', IdParam),
  requireRole('admin', 'project_manager'),
  requireProjectAccess,
  validate('body', UpdateProjectSchema),
  controller.update,
);

projectsRoutes.delete(
  '/:id',
  validate('params', IdParam),
  requireRole('admin'),
  controller.remove,
);

// Assign a user to a project (admin only).
projectsRoutes.post(
  '/:id/members',
  validate('params', IdParam),
  requireRole('admin'),
  validate('body', AssignSchema),
  controller.addMember,
);
