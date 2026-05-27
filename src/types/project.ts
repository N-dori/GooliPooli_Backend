import { z } from 'zod';
import { ProjectStatus } from './enums';

/**
 * Project is no longer a scope. It's the single global "app instance" record —
 * roughly the name/identity of this deployment.
 */
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  code: z
    .string()
    .length(6)
    .regex(/^[A-Z0-9]{6}$/),
  description: z.string().nullable(),
  status: ProjectStatus,
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: ProjectStatus.optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
