import { type Express, Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { clientsRoutes } from './modules/clients/clients.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { projectsRoutes } from './modules/projects/projects.routes';
import { usersRoutes } from './modules/users/users.routes';
import { projectVisitsRoutes, visitsRoutes } from './modules/visits/visits.routes';

export function mountRoutes(app: Express): void {
  const v1 = Router();

  v1.use('/auth', authRoutes);
  v1.use('/projects', projectsRoutes);

  // Nested resources under a project — mergeParams is set on the child routers.
  v1.use('/projects/:projectId/clients', clientsRoutes);
  v1.use('/projects/:projectId/visits', projectVisitsRoutes);

  // Standalone visit access (get / update / check-in / complete / images)
  v1.use('/visits', visitsRoutes);

  v1.use('/users', usersRoutes);
  v1.use('/notifications', notificationsRoutes);

  app.use('/api/v1', v1);
}
