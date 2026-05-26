import { supabase } from '../../lib/supabase';
import { generateProjectCode } from '../../lib/utils/projectCode';
import type {
  CreateProjectInput,
  JwtPayload,
  Paginated,
  Project,
  ProjectMemberRole,
  UpdateProjectInput,
  UserProject,
} from '../../types';
import { conflict, internal, notFound } from '../../utils/errors';

type ProjectRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'active' | 'paused' | 'archived' | 'done';
  created_by: string;
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

export async function listProjects(
  auth: JwtPayload,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<Paginated<Project>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (auth.role === 'admin') {
    const { data, error, count } = await supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
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

  // Non-admin: only projects they belong to.
  const { data, error, count } = await supabase
    .from('user_projects')
    .select('project:projects(*)', { count: 'exact' })
    .eq('user_id', auth.sub)
    .order('joined_at', { ascending: false })
    .range(from, to);
  if (error) throw internal(error.message);
  const rows = (data as unknown as { project: ProjectRow | null }[] ?? [])
    .map((r) => r.project)
    .filter((p): p is ProjectRow => Boolean(p));
  const total = count ?? rows.length;
  return {
    items: rows.map(toProject),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createProject(
  creatorId: string,
  input: CreateProjectInput,
): Promise<Project> {
  // Retry a few times on the (extremely unlikely) project code collision.
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generateProjectCode(6);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: input.name,
        code,
        description: input.description ?? null,
        created_by: creatorId,
        status: 'active',
      })
      .select('*')
      .single<ProjectRow>();
    if (!error && data) {
      // Auto-add creator as project owner so they retain access.
      await supabase
        .from('user_projects')
        .insert({ user_id: creatorId, project_id: data.id, role: 'owner' });
      return toProject(data);
    }
    if (error?.code !== '23505') throw internal(error?.message ?? 'create failed');
  }
  throw conflict('Could not allocate a unique project code');
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

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw internal(error.message);
}

export async function addMember(
  projectId: string,
  { userId, role }: { userId: string; role: ProjectMemberRole },
): Promise<UserProject> {
  const { data, error } = await supabase
    .from('user_projects')
    .insert({ project_id: projectId, user_id: userId, role })
    .select('*')
    .single<{
      id: string;
      user_id: string;
      project_id: string;
      role: ProjectMemberRole;
      joined_at: string;
    }>();
  if (error) {
    if (error.code === '23505') throw conflict('User already a member');
    throw internal(error.message);
  }
  return {
    id: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    role: data.role,
    joinedAt: data.joined_at,
  };
}
