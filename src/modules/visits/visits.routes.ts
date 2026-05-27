import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  AddVisitImageSchema,
  CheckInSchema,
  CreateVisitSchema,
  ListVisitsQuerySchema,
  UpdateVisitSchema,
} from '../../types';
import * as controller from './visits.controller';

/**
 * Mounted at /api/v1/visits.
 * No project scoping — workers see only their own visits (enforced in the
 * service); admins/managers see all.
 */
export const visitsRoutes = Router();

visitsRoutes.use(authRequired);

const VisitIdParam = z.object({ id: z.string().uuid() });

visitsRoutes.get('/', validate('query', ListVisitsQuerySchema), controller.list);

visitsRoutes.post(
  '/',
  requireRole('admin', 'project_manager'),
  validate('body', CreateVisitSchema),
  controller.create,
);

visitsRoutes.get('/:id', validate('params', VisitIdParam), controller.get);

visitsRoutes.patch(
  '/:id',
  validate('params', VisitIdParam),
  validate('body', UpdateVisitSchema),
  controller.update,
);

visitsRoutes.delete(
  '/:id',
  validate('params', VisitIdParam),
  requireRole('admin'),
  controller.remove,
);

visitsRoutes.post(
  '/:id/check-in',
  validate('params', VisitIdParam),
  validate('body', CheckInSchema),
  controller.checkIn,
);

visitsRoutes.post(
  '/:id/complete',
  validate('params', VisitIdParam),
  controller.completeVisit,
);

visitsRoutes.get(
  '/:id/images',
  validate('params', VisitIdParam),
  controller.getImages,
);

visitsRoutes.post(
  '/:id/images',
  validate('params', VisitIdParam),
  validate('body', AddVisitImageSchema),
  controller.addImage,
);
