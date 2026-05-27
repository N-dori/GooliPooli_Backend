import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { CreateClientSchema, PaginationQuerySchema, UpdateClientSchema } from '../../types';
import * as controller from './clients.controller';

/**
 * Mounted at /api/v1/clients.
 * Project is no longer a scope — any authenticated user may read clients;
 * admins and managers may write.
 */
export const clientsRoutes = Router();

clientsRoutes.use(authRequired);

const IdParam = z.object({ id: z.string().uuid() });

clientsRoutes.get('/', validate('query', PaginationQuerySchema), controller.list);

clientsRoutes.post(
  '/',
  requireRole('admin', 'project_manager'),
  validate('body', CreateClientSchema),
  controller.create,
);

clientsRoutes.get('/:id', validate('params', IdParam), controller.get);

clientsRoutes.patch(
  '/:id',
  validate('params', IdParam),
  requireRole('admin', 'project_manager'),
  validate('body', UpdateClientSchema),
  controller.update,
);

clientsRoutes.delete(
  '/:id',
  validate('params', IdParam),
  requireRole('admin'),
  controller.remove,
);
