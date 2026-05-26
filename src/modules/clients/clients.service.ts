import { supabase } from '../../lib/supabase';
import type {
  Client,
  CreateClientInput,
  Paginated,
  UpdateClientInput,
} from '../../types';
import { internal, notFound } from '../../utils/errors';

type ClientRow = {
  id: string;
  project_id: string;
  name: string;
  address: string;
  phone: string | null;
  note: string | null;
  gate_code: string | null;
  latitude: number | null;
  longitude: number | null;
  recurring_schedule: {
    weekdays: number[];
    timeOfDay?: string;
    intervalWeeks: number;
  } | null;
  visits_per_month: number;
  is_one_time: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    note: row.note,
    gateCode: row.gate_code,
    latitude: row.latitude,
    longitude: row.longitude,
    recurringSchedule: row.recurring_schedule,
    visitsPerMonth: row.visits_per_month,
    isOneTime: row.is_one_time,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listClients(
  projectId: string,
  { page, pageSize }: { page: number; pageSize: number },
): Promise<Paginated<Client>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('name', { ascending: true })
    .range(from, to);

  if (error) throw internal(error.message);
  const total = count ?? 0;
  return {
    items: (data as ClientRow[] ?? []).map(toClient),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getClient(id: string, projectId: string): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle<ClientRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('Client not found');
  return toClient(data);
}

export async function createClient(
  projectId: string,
  input: CreateClientInput,
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert({
      project_id: projectId,
      name: input.name,
      address: input.address,
      phone: input.phone ?? null,
      note: input.note ?? null,
      gate_code: input.gateCode ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      recurring_schedule: input.recurringSchedule ?? null,
      visits_per_month: input.visitsPerMonth ?? 0,
      is_one_time: input.isOneTime ?? false,
      // Falls back to DB default (true) when omitted.
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    })
    .select('*')
    .single<ClientRow>();

  if (error) throw internal(error.message);
  if (!data) throw internal('Failed to create client');
  return toClient(data);
}

export async function updateClient(
  id: string,
  projectId: string,
  input: UpdateClientInput,
): Promise<Client> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.address !== undefined) patch.address = input.address;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.note !== undefined) patch.note = input.note;
  if (input.gateCode !== undefined) patch.gate_code = input.gateCode;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.recurringSchedule !== undefined) patch.recurring_schedule = input.recurringSchedule;
  if (input.visitsPerMonth !== undefined) patch.visits_per_month = input.visitsPerMonth;
  if (input.isOneTime !== undefined) patch.is_one_time = input.isOneTime;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .eq('project_id', projectId)
    .select('*')
    .maybeSingle<ClientRow>();

  if (error) throw internal(error.message);
  if (!data) throw notFound('Client not found');
  return toClient(data);
}

export async function deleteClient(id: string, projectId: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('project_id', projectId);

  if (error) throw internal(error.message);
}
