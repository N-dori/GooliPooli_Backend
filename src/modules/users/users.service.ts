import { supabase } from '../../lib/supabase';
import type {
  Paginated,
  PublicUser,
  UpdateSelfInput,
  UpdateUserInput,
} from '../../types';
import { internal, notFound } from '../../utils/errors';

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'project_manager' | 'worker';
  auth_provider: 'password' | 'google';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    authProvider: row.auth_provider,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listUsers(
  { page, pageSize }: { page: number; pageSize: number },
): Promise<Paginated<PublicUser>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('users')
    .select('id, username, email, role, auth_provider, avatar_url, created_at, updated_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw internal(error.message);
  const total = count ?? 0;
  return {
    items: (data as UserRow[] ?? []).map(toPublicUser),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getUser(id: string): Promise<PublicUser> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, role, auth_provider, avatar_url, created_at, updated_at')
    .eq('id', id)
    .maybeSingle<UserRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('User not found');
  return toPublicUser(data);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<PublicUser> {
  const patch: Record<string, unknown> = {};
  if (input.username !== undefined) patch.username = input.username;
  if (input.role !== undefined) patch.role = input.role;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select('id, username, email, role, auth_provider, avatar_url, created_at, updated_at')
    .maybeSingle<UserRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('User not found');
  return toPublicUser(data);
}

export async function updateSelf(id: string, input: UpdateSelfInput): Promise<PublicUser> {
  const patch: Record<string, unknown> = {};
  if (input.username !== undefined) patch.username = input.username;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select('id, username, email, role, auth_provider, avatar_url, created_at, updated_at')
    .maybeSingle<UserRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('User not found');
  return toPublicUser(data);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw internal(error.message);
}
