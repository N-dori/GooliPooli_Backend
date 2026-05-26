import { z } from 'zod';

export const UserRole = z.enum(['admin', 'project_manager', 'worker']);
export const AuthProvider = z.enum(['password', 'google']);
export const ProjectStatus = z.enum(['active', 'paused', 'archived', 'done']);
export const ProjectMemberRole = z.enum(['owner', 'member']);
export const VisitStatus = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'missed',
  'cancelled',
]);
export const NotificationType = z.enum([
  'visit_completed',
  'visit_missed',
  'visit_assigned',
  'visit_reassigned',
  'project_created',
  'schedule_changed',
]);

export type UserRole = z.infer<typeof UserRole>;
export type AuthProvider = z.infer<typeof AuthProvider>;
export type ProjectStatus = z.infer<typeof ProjectStatus>;
export type ProjectMemberRole = z.infer<typeof ProjectMemberRole>;
export type VisitStatus = z.infer<typeof VisitStatus>;
export type NotificationType = z.infer<typeof NotificationType>;
