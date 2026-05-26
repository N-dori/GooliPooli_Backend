import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { PaginationQuerySchema } from '../../types';
import * as controller from './notifications.controller';

export const notificationsRoutes = Router();
notificationsRoutes.use(authRequired);

const NotifIdParam = z.object({ id: z.string().uuid() });

notificationsRoutes.get(
  '/',
  validate('query', PaginationQuerySchema),
  controller.list,
);

// Mark all read — must come BEFORE /:id routes.
notificationsRoutes.post('/read-all', controller.markAllRead);

notificationsRoutes.patch(
  '/:id/read',
  validate('params', NotifIdParam),
  controller.markRead,
);

notificationsRoutes.delete(
  '/:id',
  validate('params', NotifIdParam),
  controller.remove,
);
