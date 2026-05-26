import { z } from 'zod';
import { VisitStatus } from './enums';

export const VisitSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
  workerId: z.string().uuid().nullable(),
  scheduledDate: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  gpsLatitude: z.number().min(-90).max(90).nullable(),
  gpsLongitude: z.number().min(-180).max(180).nullable(),
  gpsValidated: z.boolean(),
  status: VisitStatus,
  workerNotes: z.string().max(4000).nullable(),
  managerNotes: z.string().max(4000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const VisitImageSchema = z.object({
  id: z.string().uuid(),
  visitId: z.string().uuid(),
  imageUrl: z.string().url(),
  createdAt: z.string().datetime(),
});

export const CreateVisitSchema = z.object({
  clientId: z.string().uuid(),
  workerId: z.string().uuid().nullable().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  workerNotes: z.string().max(4000).nullable().optional(),
  managerNotes: z.string().max(4000).nullable().optional(),
});

export const UpdateVisitSchema = z.object({
  workerId: z.string().uuid().nullable().optional(),
  status: VisitStatus.optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  workerNotes: z.string().max(4000).nullable().optional(),
  managerNotes: z.string().max(4000).nullable().optional(),
});

export const AddVisitImageSchema = z.object({
  imageUrl: z.string().url(),
});

export const CheckInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

export const ListVisitsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  workerId: z.string().uuid().optional(),
  status: VisitStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export type Visit = z.infer<typeof VisitSchema>;
export type VisitImage = z.infer<typeof VisitImageSchema>;
export type CreateVisitInput = z.infer<typeof CreateVisitSchema>;
export type UpdateVisitInput = z.infer<typeof UpdateVisitSchema>;
export type AddVisitImageInput = z.infer<typeof AddVisitImageSchema>;
export type CheckInInput = z.infer<typeof CheckInSchema>;
export type ListVisitsQuery = z.infer<typeof ListVisitsQuerySchema>;
