-- =============================================================================
-- Golipooli — initial schema (0001_init.sql)
-- =============================================================================
-- Apply via: supabase db push   (or paste into Supabase SQL Editor)
-- Idempotent where practical; safe to re-run against an empty database.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ----- ENUMS -----------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'project_manager', 'worker');
exception when duplicate_object then null; end $$;

do $$ begin
  create type auth_provider as enum ('password', 'google');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('active', 'paused', 'archived', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_member_role as enum ('owner', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visit_status as enum ('scheduled', 'in_progress', 'completed', 'missed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'visit_completed', 'visit_missed', 'visit_assigned',
    'visit_reassigned', 'project_created', 'schedule_changed'
  );
exception when duplicate_object then null; end $$;

-- ----- UTILITY: updatedAt trigger --------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----- TABLE: users ----------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  username        text not null unique,
  email           text not null unique,
  password_hash   text,
  role            user_role not null default 'worker',
  auth_provider   auth_provider not null default 'password',
  auth_provider_id text,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists users_email_idx on public.users (email);
create index if not exists users_role_idx  on public.users (role);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function set_updated_at();

-- ----- TABLE: projects -------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        char(6) not null unique,
  description text,
  status      project_status not null default 'active',
  created_by  uuid not null references public.users(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_status_idx     on public.projects (status);
create index if not exists projects_created_by_idx on public.projects (created_by);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function set_updated_at();

-- ----- TABLE: user_projects --------------------------------------------------
create table if not exists public.user_projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id)    on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role       project_member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  unique (user_id, project_id)
);
create index if not exists user_projects_user_idx    on public.user_projects (user_id);
create index if not exists user_projects_project_idx on public.user_projects (project_id);

-- ----- TABLE: clients --------------------------------------------------------
create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  name               text not null,
  address            text not null default '',
  phone              text,
  note               text,
  gate_code          text,
  latitude           double precision check (latitude  between -90  and 90),
  longitude          double precision check (longitude between -180 and 180),
  recurring_schedule jsonb,
  visits_per_month   integer not null default 0 check (visits_per_month >= 0),
  is_one_time        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists clients_project_idx on public.clients (project_id);
create index if not exists clients_name_idx    on public.clients (name);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function set_updated_at();

-- ----- TABLE: visits ---------------------------------------------------------
create table if not exists public.visits (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  client_id       uuid not null references public.clients(id)  on delete cascade,
  worker_id       uuid references public.users(id) on delete set null,
  scheduled_date  timestamptz not null,
  started_at      timestamptz,
  completed_at    timestamptz,
  gps_latitude    double precision check (gps_latitude  between -90  and 90),
  gps_longitude   double precision check (gps_longitude between -180 and 180),
  gps_validated   boolean not null default false,
  status          visit_status not null default 'scheduled',
  worker_notes    text,
  manager_notes   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists visits_project_idx          on public.visits (project_id);
create index if not exists visits_client_idx           on public.visits (client_id);
create index if not exists visits_worker_idx           on public.visits (worker_id);
create index if not exists visits_status_idx           on public.visits (status);
create index if not exists visits_scheduled_date_idx   on public.visits (scheduled_date);
create index if not exists visits_worker_date_idx      on public.visits (worker_id, scheduled_date);

drop trigger if exists visits_set_updated_at on public.visits;
create trigger visits_set_updated_at before update on public.visits
  for each row execute function set_updated_at();

-- ----- TABLE: visit_images ---------------------------------------------------
create table if not exists public.visit_images (
  id         uuid primary key default gen_random_uuid(),
  visit_id   uuid not null references public.visits(id) on delete cascade,
  image_url  text not null,
  created_at timestamptz not null default now()
);
create index if not exists visit_images_visit_idx on public.visit_images (visit_id);

-- ----- TABLE: notifications --------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  message    text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx        on public.notifications (user_id);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read = false;

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================
-- The Express API connects with the Supabase SERVICE ROLE key, which bypasses
-- RLS. RLS below protects direct access from clients that may someday talk to
-- Supabase directly using the anon key + a Supabase JWT whose `sub` matches
-- public.users.id.
--
-- Helper assumption: the JWT `sub` claim equals the application user id.
-- =============================================================================

create or replace function auth_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth_user_role() returns user_role
language sql stable as $$
  select role from public.users where id = auth_user_id();
$$;

create or replace function is_admin() returns boolean
language sql stable as $$
  select coalesce(auth_user_role() = 'admin', false);
$$;

create or replace function is_project_member(p_project_id uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from public.user_projects
    where project_id = p_project_id and user_id = auth_user_id()
  );
$$;

alter table public.users          enable row level security;
alter table public.projects       enable row level security;
alter table public.user_projects  enable row level security;
alter table public.clients        enable row level security;
alter table public.visits         enable row level security;
alter table public.visit_images   enable row level security;
alter table public.notifications  enable row level security;

-- ----- users -----------------------------------------------------------------
drop policy if exists users_self_select  on public.users;
drop policy if exists users_admin_all    on public.users;
drop policy if exists users_self_update  on public.users;

create policy users_self_select on public.users
  for select using (id = auth_user_id() or is_admin());
create policy users_self_update on public.users
  for update using (id = auth_user_id() or is_admin())
  with check    (id = auth_user_id() or is_admin());
create policy users_admin_all   on public.users
  for all using (is_admin()) with check (is_admin());

-- ----- projects --------------------------------------------------------------
drop policy if exists projects_member_select on public.projects;
drop policy if exists projects_admin_all     on public.projects;

create policy projects_member_select on public.projects
  for select using (is_admin() or is_project_member(id));
create policy projects_admin_all on public.projects
  for all using (is_admin()) with check (is_admin());

-- ----- user_projects ---------------------------------------------------------
drop policy if exists user_projects_self_select on public.user_projects;
drop policy if exists user_projects_admin_all   on public.user_projects;

create policy user_projects_self_select on public.user_projects
  for select using (user_id = auth_user_id() or is_admin());
create policy user_projects_admin_all on public.user_projects
  for all using (is_admin()) with check (is_admin());

-- ----- clients ---------------------------------------------------------------
drop policy if exists clients_member_select on public.clients;
drop policy if exists clients_pm_write      on public.clients;
drop policy if exists clients_admin_all     on public.clients;

create policy clients_member_select on public.clients
  for select using (is_admin() or is_project_member(project_id));
create policy clients_pm_write on public.clients
  for all using (
    is_admin() or (auth_user_role() = 'project_manager' and is_project_member(project_id))
  ) with check (
    is_admin() or (auth_user_role() = 'project_manager' and is_project_member(project_id))
  );

-- ----- visits ----------------------------------------------------------------
drop policy if exists visits_member_select on public.visits;
drop policy if exists visits_worker_update on public.visits;
drop policy if exists visits_pm_all        on public.visits;

create policy visits_member_select on public.visits
  for select using (
    is_admin()
    or is_project_member(project_id)
    or worker_id = auth_user_id()
  );

-- Workers may only update their own visit's check-in / completion fields.
create policy visits_worker_update on public.visits
  for update using (worker_id = auth_user_id())
  with check    (worker_id = auth_user_id());

create policy visits_pm_all on public.visits
  for all using (
    is_admin() or (auth_user_role() = 'project_manager' and is_project_member(project_id))
  ) with check (
    is_admin() or (auth_user_role() = 'project_manager' and is_project_member(project_id))
  );

-- ----- visit_images ----------------------------------------------------------
drop policy if exists visit_images_select on public.visit_images;
drop policy if exists visit_images_insert on public.visit_images;

create policy visit_images_select on public.visit_images
  for select using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (is_admin() or is_project_member(v.project_id) or v.worker_id = auth_user_id())
    )
  );
create policy visit_images_insert on public.visit_images
  for insert with check (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (is_admin() or v.worker_id = auth_user_id())
    )
  );

-- ----- notifications ---------------------------------------------------------
drop policy if exists notifications_self_select on public.notifications;
drop policy if exists notifications_self_update on public.notifications;
drop policy if exists notifications_admin_all   on public.notifications;

create policy notifications_self_select on public.notifications
  for select using (user_id = auth_user_id());
create policy notifications_self_update on public.notifications
  for update using (user_id = auth_user_id())
  with check    (user_id = auth_user_id());
create policy notifications_admin_all on public.notifications
  for all using (is_admin()) with check (is_admin());

-- =============================================================================
-- STORAGE
-- =============================================================================
-- Create buckets via the Supabase dashboard or CLI:
--   supabase storage create visit-images   --public=false
--   supabase storage create avatars        --public=true
--   supabase storage create project-images --public=true
-- =============================================================================
