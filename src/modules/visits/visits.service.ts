import { dayRangeBounds } from '../../lib/utils/date';
import { isWithinRadius } from '../../lib/utils/gps';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import type {
  AddVisitImageInput,
  CheckInInput,
  Client,
  CreateVisitInput,
  JwtPayload,
  ListVisitsQuery,
  Paginated,
  PublicUser,
  UpdateVisitInput,
  Visit,
  VisitImage,
  VisitWithDetails,
} from '../../types';
import { badRequest, forbidden, internal, notFound } from '../../utils/errors';

type VisitRow = {
  id: string;
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

// ── Row types for joined data ──────────────────────────────────────────────

type ClientRow = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  note: string | null;
  gate_code: string | null;
  latitude: number | null;
  longitude: number | null;
  recurring_schedule: unknown;
  visits_per_month: number;
  is_one_time: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

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

type VisitWithDetailsRow = VisitRow & {
  client: ClientRow | null;
  worker: UserRow | null;
};

function toClientPartial(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    note: row.note,
    gateCode: row.gate_code,
    latitude: row.latitude,
    longitude: row.longitude,
    recurringSchedule: row.recurring_schedule as Client['recurringSchedule'],
    visitsPerMonth: row.visits_per_month,
    isOneTime: row.is_one_time,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicUserPartial(row: UserRow): PublicUser {
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

function toVisitWithDetails(row: VisitWithDetailsRow): VisitWithDetails {
  return {
    ...toVisit(row),
    client: row.client ? toClientPartial(row.client) : undefined,
    worker: row.worker ? toPublicUserPartial(row.worker) : undefined,
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
  _creatorId: string | null,
  input: CreateVisitInput,
): Promise<Visit> {
  const { data, error } = await supabase
    .from('visits')
    .insert({
      client_id: input.clientId,
      worker_id: input.workerId ?? null,
      scheduled_date: input.scheduledDate,
      status: 'scheduled',
      worker_notes: input.workerNotes ?? null,
      manager_notes: input.managerNotes ?? null,
      gps_latitude: input.gpsLatitude ?? null,
      gps_longitude: input.gpsLongitude ?? null,
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
  if (input.completedAt !== undefined) patch.completed_at = input.completedAt;
  if (input.status === 'completed' && input.completedAt === undefined) {
    patch.completed_at = new Date().toISOString();
  }
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

/**
 * Diary feed — global, no project scope.
 * GET /api/v1/visits?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 *
 * Workers: only their own visits.
 * Admins/managers: all visits (optionally filtered by workerId).
 */
export async function listVisits(
  auth: JwtPayload,
  query: ListVisitsQuery,
): Promise<Paginated<VisitWithDetails>> {
  const { page, pageSize, dateFrom, dateTo, date, workerId, status } = query;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const joinSelect = [
    '*',
    'client:clients!client_id(id,name,address,phone,note,gate_code,latitude,longitude,recurring_schedule,visits_per_month,is_one_time,is_active,created_at,updated_at)',
    'worker:users!worker_id(id,username,email,role,auth_provider,avatar_url,created_at,updated_at)',
  ].join(',');

  let q = supabase
    .from('visits')
    .select(joinSelect, { count: 'exact' })
    .order('scheduled_date', { ascending: true });

  if (auth.role === 'worker') {
    q = q.eq('worker_id', auth.sub);
  } else if (workerId) {
    q = q.eq('worker_id', workerId);
  }

  // `date` is shorthand for a single calendar day.
  if (date) {
    const { start, nextDay } = dayRangeBounds(date);
    q = q.gte('scheduled_date', start).lt('scheduled_date', nextDay);
  } else {
    if (dateFrom) q = q.gte('scheduled_date', dayRangeBounds(dateFrom).start);
    if (dateTo) q = q.lt('scheduled_date', dayRangeBounds(dateTo).nextDay);
  }

  if (status) q = q.eq('status', status);

  const { data, error, count } = await q.range(from, to);
  if (error) {
    logger.error({ err: error, op: 'listVisits', auth, query }, 'supabase query failed');
    throw internal(error.message);
  }

  const total = count ?? 0;
  return {
    items: ((data as unknown as VisitWithDetailsRow[]) ?? []).map(toVisitWithDetails),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
