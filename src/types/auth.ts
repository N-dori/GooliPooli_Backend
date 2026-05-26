import { z } from 'zod';
import { UserRole } from './enums';
import { PublicUserSchema } from './user';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const SignupSchema = z.object({
  username: z.string().min(2).max(64),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const AuthSessionSchema = z.object({
  user: PublicUserSchema,
  tokens: AuthTokensSchema,
});

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: UserRole,
  type: z.enum(['access', 'refresh']),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
