import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid request', details: err.flatten() },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  // In dev, surface the underlying message + stack so failures are debuggable
  // from the response body. In production we keep the generic message.
  const isDev = env.NODE_ENV !== 'production';
  res.status(500).json({
    error: {
      code: 'internal',
      message: 'Internal server error',
      ...(isDev && err instanceof Error
        ? { devMessage: err.message, devStack: err.stack?.split('\n').slice(0, 5) }
        : {}),
    },
  });
};
