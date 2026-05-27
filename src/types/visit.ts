import { z } from 'zod';
import { VisitStatus } from './enums';
import type { Client } from './client';
import type { PublicUser } from './user';

export const VisitSchema = z.object({
  id: z.string().uuid(),
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

// Accepts YYYY-MM-DD or a full ISO 8601 datetime (with optional TZ offset).
const ScheduledDateString = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/,
    'Expected YYYY-MM-DD or ISO datetime',
  );

export const CreateVisitSchema = z.object({
  clientId: z.string().uuid(),
  workerId: z.string().uuid().nullable().optional(),
  scheduledDate: ScheduledDateString,
  gpsLatitude: z.number().min(-90).max(90).nullable().optional(),
  gpsLongitude: z.number().min(-180).max(180).nullable().optional(),
  workerNotes: z.string().max(4000).nullable().optional(),
  managerNotes: z.string().max(4000).nullable().optional(),
});

export const UpdateVisitSchema = z.object({
  workerId: z.string().uuid().nullable().optional(),
  status: VisitStatus.optional(),
  scheduledDate: ScheduledDateString.optional(),
  workerNotes: z.string().max(4000).nullable().optional(),
  managerNotes: z.string().max(4000).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

export const AddVisitImageSchema = z.object({
  imageUrl: z.string().url(),
});

export const CheckInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

const DayOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ListVisitsQuerySchema = z.object({
  dateFrom: DayOnlyString.optional(),
  dateTo: DayOnlyString.optional(),
  date: DayOnlyString.optional(),
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

/** Visit with optionally-joined related records. */
export interface VisitWithDetails extends Visit {
  client?: Client;
  worker?: PublicUser;
}
