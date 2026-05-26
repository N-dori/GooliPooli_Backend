import { z } from 'zod';
import { ProjectMemberRole, ProjectStatus } from './enums';

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  code: z
    .string()
    .length(6)
    .regex(/^[A-Z0-9]{6}$/),
  description: z.string().nullable(),
  status: ProjectStatus,
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).nullable().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: ProjectStatus.optional(),
});

export const UserProjectSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  role: ProjectMemberRole,
  joinedAt: z.string().datetime(),
});

export const ProjectWithStatsSchema = ProjectSchema.extend({
  clientCount: z.number().int().nonnegative(),
  workerCount: z.number().int().nonnegative(),
  visitsThisWeek: z.number().int().nonnegative(),
  visitsCompletedThisWeek: z.number().int().nonnegative(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type UserProject = z.infer<typeof UserProjectSchema>;
export type ProjectWithStats = z.infer<typeof ProjectWithStatsSchema>;
