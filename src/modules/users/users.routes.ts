import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PaginationQuerySchema, UpdateSelfSchema, UpdateUserSchema } from '../../types';
import * as controller from './users.controller';

export const usersRoutes = Router();
usersRoutes.use(authRequired);

const UserIdParam = z.object({ id: z.string().uuid() });

// Self-update — must come BEFORE /:id to avoid "me" being parsed as a UUID.
usersRoutes.patch('/me', validate('body', UpdateSelfSchema), controller.updateMe);

// Admin-only CRUD
usersRoutes.get('/', requireRole('admin'), validate('query', PaginationQuerySchema), controller.list);
usersRoutes.get('/:id', requireRole('admin'), validate('params', UserIdParam), controller.get);
usersRoutes.patch(
  '/:id',
  requireRole('admin'),
  validate('params', UserIdParam),
  validate('body', UpdateUserSchema),
  controller.update,
);
usersRoutes.delete(
  '/:id',
  requireRole('admin'),
  validate('params', UserIdParam),
  controller.remove,
);
