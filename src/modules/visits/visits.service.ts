import { isWithinRadius } from '../../lib/utils/gps';
import { supabase } from '../../lib/supabase';
import type {
  AddVisitImageInput,
  CheckInInput,
  CreateVisitInput,
  JwtPayload,
  ListVisitsQuery,
  Paginated,
  UpdateVisitInput,
  Visit,
  VisitImage,
} from '../../types';
import { badRequest, forbidden, internal, notFound } from '../../utils/errors';

type VisitRow = {
  id: string;
  project_id: string;
  client_id: string;
  worker_id: string | null;
  scheduled_date: string;
  started_at: string | null;
  completed_at: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_validated: boolean;
  status: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
  worker_notes: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
};

type VisitImageRow = {
  id: string;
  visit_id: string;
  image_url: string;
  created_at: string;
};

function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    projectId: row.project_id,
    clientId: row.client_id,
    workerId: row.worker_id,
    scheduledDate: row.scheduled_date,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    gpsLatitude: row.gps_latitude,
    gpsLongitude: row.gps_longitude,
    gpsValidated: row.gps_validated,
    status: row.status,
    workerNotes: row.worker_notes,
    managerNotes: row.manager_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVisitImage(row: VisitImageRow): VisitImage {
  return {
    id: row.id,
    visitId: row.visit_id,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

export async function listVisits(
  projectId: string,
  auth: JwtPayload,
  query: ListVisitsQuery,
): Promise<Paginated<Visit>> {
  const { page, pageSize, date, workerId, status } = query;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('visits')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('scheduled_date', { ascending: true });

  // Workers only see their own visits
  if (auth.role === 'worker') {
    q = q.eq('worker_id', auth.sub);
  } else if (workerId) {
    q = q.eq('worker_id', workerId);
  }

  if (date) {
    q = q.eq('scheduled_date', date);
  }

  if (status) {
    q = q.eq('status', status);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw internal(error.message);

  const total = count ?? 0;
  return {
    items: (data as VisitRow[] ?? []).map(toVisit),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getVisit(id: string): Promise<Visit> {
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('id', id)
    .maybeSingle<VisitRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('Visit not found');
  return toVisit(data);
}

export async function createVisit(
  projectId: string,
  input: CreateVisitInput,
): Promise<Visit> {
  const { data, error } = await supabase
    .from('visits')
    .insert({
      project_id: projectId,
      client_id: input.clientId,
      worker_id: input.workerId ?? null,
      scheduled_date: input.scheduledDate,
      status: 'scheduled',
      worker_notes: input.workerNotes ?? null,
      manager_notes: input.managerNotes ?? null,
      gps_validated: false,
    })
    .select('*')
    .single<VisitRow>();

  if (error) throw internal(error.message);
  if (!data) throw internal('Failed to create visit');
  return toVisit(data);
}

export async function updateVisit(
  id: string,
  auth: JwtPayload,
  input: UpdateVisitInput,
): Promise<Visit> {
  // Workers can only update their own visits and only notes + status
  const existing = await getVisit(id);

  if (auth.role === 'worker') {
    if (existing.workerId !== auth.sub) throw forbidden('Not assigned to this visit');
    // Workers can only update worker_notes and status (in_progress / completed / missed)
    const allowedStatuses = new Set(['in_progress', 'completed', 'missed']);
    if (input.status && !allowedStatuses.has(input.status)) {
      throw badRequest('Workers may only set status to in_progress, completed, or missed');
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.workerId !== undefined) patch.worker_id = input.workerId;
  if (input.status !== undefined) patch.status = input.status;
  if (input.scheduledDate !== undefined) patch.scheduled_date = input.scheduledDate;
  if (input.workerNotes !== undefined) patch.worker_notes = input.workerNotes;
  // Only admins/managers can set manager_notes
  if (input.managerNotes !== undefined && auth.role !== 'worker') {
    patch.manager_notes = input.managerNotes;
  }

  const { data, error } = await supabase
    .from('visits')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle<VisitRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('Visit not found');
  return toVisit(data);
}

export async function checkIn(
  id: string,
  auth: JwtPayload,
  input: CheckInInput,
): Promise<Visit> {
  const existing = await getVisit(id);

  if (auth.role === 'worker' && existing.workerId !== auth.sub) {
    throw forbidden('Not assigned to this visit');
  }

  if (existing.status !== 'scheduled' && existing.status !== 'in_progress') {
    throw badRequest('Visit is not in a check-in eligible state');
  }

  // Validate GPS against client location if available
  let gpsValidated = false;
  if (existing.clientId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('latitude, longitude')
      .eq('id', existing.clientId)
      .maybeSingle<{ latitude: number | null; longitude: number | null }>();

    if (
      clientRow !== null &&
      clientRow.latitude !== null &&
      clientRow.longitude !== null
    ) {
      gpsValidated = isWithinRadius(
        { latitude: clientRow.latitude, longitude: clientRow.longitude },
        { latitude: input.latitude, longitude: input.longitude },
      );
    }
  }

  const { data, error } = await supabase
    .from('visits')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      gps_latitude: input.latitude,
      gps_longitude: input.longitude,
      gps_validated: gpsValidated,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle<VisitRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('Visit not found');
  return toVisit(data);
}

export async function complete(id: string, auth: JwtPayload): Promise<Visit> {
  const existing = await getVisit(id);

  if (auth.role === 'worker' && existing.workerId !== auth.sub) {
    throw forbidden('Not assigned to this visit');
  }

  if (existing.status !== 'in_progress') {
    throw badRequest('Visit must be in_progress before completing');
  }

  const { data, error } = await supabase
    .from('visits')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle<VisitRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('Visit not found');
  return toVisit(data);
}

export async function listImages(visitId: string): Promise<VisitImage[]> {
  const { data, error } = await supabase
    .from('visit_images')
    .select('*')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true });

  if (error) throw internal(error.message);
  return (data as VisitImageRow[] ?? []).map(toVisitImage);
}

export async function addImage(
  visitId: string,
  input: AddVisitImageInput,
): Promise<VisitImage> {
  const { data, error } = await supabase
    .from('visit_images')
    .insert({ visit_id: visitId, image_url: input.imageUrl })
    .select('*')
    .single<VisitImageRow>();

  if (error) throw internal(error.message);
  if (!data) throw internal('Failed to save image');
  return toVisitImage(data);
}

export async function deleteVisit(id: string): Promise<void> {
  const { error } = await supabase.from('visits').delete().eq('id', id);
  if (error) throw internal(error.message);
}
