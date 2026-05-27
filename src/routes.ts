import { type Express, Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { clientsRoutes } from './modules/clients/clients.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { projectsRoutes } from './modules/projects/projects.routes';
import { usersRoutes } from './modules/users/users.routes';
import { visitsRoutes } from './modules/visits/visits.routes';

export function mountRoutes(app: Express): void {
  const v1 = Router();

  v1.use('/auth', authRoutes);
  v1.use('/projects', projectsRoutes);
  v1.use('/clients', clientsRoutes);
  v1.use('/visits', visitsRoutes);
  v1.use('/users', usersRoutes);
  v1.use('/notifications', notificationsRoutes);

  app.use('/api/v1', v1);
}
