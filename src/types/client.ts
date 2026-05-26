import { z } from 'zod';

export const RecurringScheduleSchema = z.object({
  // 0 = Sunday … 6 = Saturday
  weekdays: z.array(z.number().int().min(0).max(6)),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  intervalWeeks: z.number().int().positive().default(1),
});

export const ClientSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  address: z.string().max(500),
  phone: z.string().max(40).nullable(),
  note: z.string().max(2000).nullable(),
  gateCode: z.string().max(40).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  recurringSchedule: RecurringScheduleSchema.nullable(),
  visitsPerMonth: z.number().int().nonnegative(),
  isOneTime: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateClientSchema = ClientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateClientSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(40).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  gateCode: z.string().max(40).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  recurringSchedule: RecurringScheduleSchema.nullable().optional(),
  visitsPerMonth: z.number().int().nonnegative().optional(),
  isOneTime: z.boolean().optional(),
});

export type RecurringSchedule = z.infer<typeof RecurringScheduleSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
