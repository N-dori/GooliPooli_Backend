import { z } from 'zod';
import { NotificationType } from './enums';

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationType,
  title: z.string().max(200),
  message: z.string().max(2000),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof NotificationSchema>;
