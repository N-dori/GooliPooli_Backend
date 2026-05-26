import { supabase } from '../../lib/supabase';
import type { Notification, Paginated } from '../../types';
import { forbidden, internal, notFound } from '../../utils/errors';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as Notification['type'],
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  };
}

export async function listNotifications(
  userId: string,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<Paginated<Notification>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw internal(error.message);
  const total = count ?? 0;
  return {
    items: (data as NotificationRow[] ?? []).map(toNotification),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function markRead(id: string, userId: string): Promise<Notification> {
  // Fetch first to verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .maybeSingle<NotificationRow>();

  if (fetchError) throw internal(fetchError.message);
  if (!existing) throw notFound('Notification not found');
  if (existing.user_id !== userId) throw forbidden();

  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .select('*')
    .single<NotificationRow>();

  if (error) throw internal(error.message);
  return toNotification(data);
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw internal(error.message);
}

export async function deleteNotification(id: string, userId: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle<{ id: string; user_id: string }>();

  if (fetchError) throw internal(fetchError.message);
  if (!existing) throw notFound('Notification not found');
  if (existing.user_id !== userId) throw forbidden();

  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw internal(error.message);
}
