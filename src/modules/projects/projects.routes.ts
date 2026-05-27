import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PaginationQuerySchema, UpdateProjectSchema } from '../../types';
import * as controller from './projects.controller';

export const projectsRoutes = Router();
projectsRoutes.use(authRequired);

const IdParam = z.object({ id: z.string().uuid() });

projectsRoutes.get('/', validate('query', PaginationQuerySchema), controller.list);

projectsRoutes.get('/:id', validate('params', IdParam), controller.get);

projectsRoutes.patch(
  '/:id',
  validate('params', IdParam),
  requireRole('admin', 'project_manager'),
  validate('body', UpdateProjectSchema),
  controller.update,
);
