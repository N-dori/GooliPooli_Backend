-- =============================================================================
-- 0002 — clients.is_active
-- =============================================================================
-- Soft-delete flag for clients. Web type already required this; this migration
-- adds the missing column on the API side. Defaults to true so existing rows
-- remain active.
-- Idempotent; safe to re-run.
-- =============================================================================

alter table public.clients
  add column if not exists is_active boolean not null default true;

create index if not exists clients_project_active_idx
  on public.clients (project_id, is_active);
