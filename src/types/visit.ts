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

export const CheckInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

export type Visit = z.infer<typeof VisitSchema>;
export type VisitImage = z.infer<typeof VisitImageSchema>;
export type CheckInInput = z.infer<typeof CheckInSchema>;
