import { type Express, Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { projectsRoutes } from './modules/projects/projects.routes';

export function mountRoutes(app: Express): void {
  const v1 = Router();
  v1.use('/auth', authRoutes);
  v1.use('/projects', projectsRoutes);
  app.use('/api/v1', v1);
}
