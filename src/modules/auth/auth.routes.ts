import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { LoginSchema, SignupSchema } from '../../types';
import * as controller from './auth.controller';

export const authRoutes = Router();

const RefreshSchema = z.object({ refreshToken: z.string().min(10) });

authRoutes.post('/signup', authRateLimiter, validate('body', SignupSchema), controller.signup);
authRoutes.post('/login', authRateLimiter, validate('body', LoginSchema), controller.login);
authRoutes.post('/refresh', validate('body', RefreshSchema), controller.refresh);
authRoutes.get('/me', authRequired, controller.me);
authRoutes.get('/google', controller.googleStart);
authRoutes.get('/google/callback', controller.googleCallback);
