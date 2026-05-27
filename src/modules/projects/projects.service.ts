import { supabase } from '../../lib/supabase';
import type {
  Paginated,
  Project,
  UpdateProjectInput,
} from '../../types';
import { internal, notFound } from '../../utils/errors';

type ProjectRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'active' | 'paused' | 'archived' | 'done';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  code: row.code,
  description: row.description,
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Project is a global singleton — the "app instance". Listing returns every
 * row (typically just one); the web app reads `.items[0]` as the app entry.
 */
export async function listProjects(
  { page, pageSize }: { page: number; pageSize: number },
): Promise<Paginated<Project>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: true })
    .range(from, to);
  if (error) throw internal(error.message);
  const total = count ?? 0;
  return {
    items: (data ?? []).map(toProject),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle<ProjectRow>();
  if (error) throw internal(error.message);
  if (!data) throw notFound('Project not found');
  return toProject(data);
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle<ProjectRow>();
  if (error) throw internal(error.message);
  if (!data) throw notFound('Project not found');
  return toProject(data);
}
