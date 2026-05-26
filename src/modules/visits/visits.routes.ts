import { Router } from 'express';
import { z } from 'zod';
import {
  authRequired,
  requireProjectAccess,
  requireRole,
  requireVisitProjectAccess,
} from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  AddVisitImageSchema,
  CheckInSchema,
  CreateVisitSchema,
  ListAllVisitsQuerySchema,
  ListVisitsQuerySchema,
  UpdateVisitSchema,
} from '../../types';
import * as controller from './visits.controller';

// ── Project-nested router: mounted at /api/v1/projects/:projectId/visits ───

/**
 * Handles list + create. Requires authenticated project member.
 * mergeParams: true so `:projectId` is available from parent router.
 */
export const projectVisitsRoutes = Router({ mergeParams: true });

projectVisitsRoutes.use(authRequired, requireProjectAccess);

const ProjectIdParam = z.object({ projectId: z.string().uuid() });

projectVisitsRoutes.get(
  '/',
  validate('params', ProjectIdParam),
  validate('query', ListVisitsQuerySchema),
  controller.list,
);

projectVisitsRoutes.post(
  '/',
  validate('params', ProjectIdParam),
  requireRole('admin', 'project_manager'),
  validate('body', CreateVisitSchema),
  controller.create,
);

// ── Standalone router: mounted at /api/v1/visits ───────────────────────────

/**
 * Handles get / update / delete / check-in / complete / images for a single visit.
 * Access control is enforced by the service layer (checks project membership via visit's projectId).
 */
export const visitsRoutes = Router();

visitsRoutes.use(authRequired);

const VisitIdParam = z.object({ id: z.string().uuid() });

// Diary feed — must be registered before /:id
visitsRoutes.get(
  '/',
  validate('query', ListAllVisitsQuerySchema),
  controller.listAll,
);

visitsRoutes.get(
  '/:id',
  validate('params', VisitIdParam),
  requireVisitProjectAccess,
  controller.get,
);

visitsRoutes.patch(
  '/:id',
  validate('params', VisitIdParam),
  requireVisitProjectAccess,
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
  requireVisitProjectAccess,
  validate('body', CheckInSchema),
  controller.checkIn,
);

visitsRoutes.post(
  '/:id/complete',
  validate('params', VisitIdParam),
  requireVisitProjectAccess,
  controller.completeVisit,
);

visitsRoutes.get(
  '/:id/images',
  validate('params', VisitIdParam),
  requireVisitProjectAccess,
  controller.getImages,
);

visitsRoutes.post(
  '/:id/images',
  validate('params', VisitIdParam),
  requireVisitProjectAccess,
  validate('body', AddVisitImageSchema),
  controller.addImage,
);
