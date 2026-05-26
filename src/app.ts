import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import { generalRateLimiter } from './middleware/rateLimit';
import { mountRoutes } from './routes';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(pinoHttp({ logger }));
  app.use(generalRateLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  mountRoutes(app);

  app.use(errorHandler);
  return app;
}
