import { z } from 'zod';
import { AuthProvider, UserRole } from './enums';

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(2).max(64),
  email: z.string().email(),
  role: UserRole,
  authProvider: AuthProvider,
  authProviderId: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PublicUserSchema = UserSchema.omit({ authProviderId: true });

export const CreateUserSchema = z.object({
  username: z.string().min(2).max(64),
  email: z.string().email(),
  password: z.string().min(8).max(128).optional(),
  role: UserRole.default('worker'),
});

export type User = z.infer<typeof UserSchema>;
export type PublicUser = z.infer<typeof PublicUserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
