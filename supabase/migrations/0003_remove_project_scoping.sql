-- =============================================================================
-- Golipooli — remove project scoping (0003)
-- =============================================================================
-- Project is no longer a scope; it's a single global "app instance" row.
-- This migration:
--   • drops project_id from clients/visits
--   • drops user_projects (no membership table)
--   • drops project_member_role enum + is_project_member() helper
--   • rebuilds the RLS policies that referenced any of the above
--   • relaxes projects.created_by to nullable (auto-created app row may not
--     have a creator)
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ----- Drop policies that referenced project_id / is_project_member ----------
drop policy if exists clients_member_select on public.clients;
drop policy if exists clients_pm_write      on public.clients;
drop policy if exists visits_member_select  on public.visits;
drop policy if exists visits_pm_all         on public.visits;
drop policy if exists visit_images_select   on public.visit_images;
drop policy if exists user_projects_self_select on public.user_projects;
drop policy if exists user_projects_admin_all   on public.user_projects;
drop policy if exists projects_member_select    on public.projects;

-- ----- Drop the membership helper + table + enum -----------------------------
drop function if exists public.is_project_member(uuid);
drop table    if exists public.user_projects;
drop type     if exists project_member_role;

-- ----- Drop project_id columns + their indexes -------------------------------
drop index if exists clients_project_idx;
drop index if exists visits_project_idx;

alter table public.clients drop column if exists project_id;
alter table public.visits  drop column if exists project_id;

-- ----- Relax projects.created_by to nullable ---------------------------------
-- The app instance can be auto-created with no associated user.
alter table public.projects alter column created_by drop not null;

-- ----- Rebuild simplified RLS policies ---------------------------------------
-- Defense-in-depth only — the Express API enforces RBAC via service-role.

-- projects: any authenticated user may read; admins manage.
create policy projects_authn_select on public.projects
  for select using (auth_user_id() is not null);

-- clients: authenticated users may read; admins and project_managers write.
create policy clients_authn_select on public.clients
  for select using (auth_user_id() is not null);
create policy clients_pm_write on public.clients
  for all using (
    is_admin() or auth_user_role() = 'project_manager'
  ) with check (
    is_admin() or auth_user_role() = 'project_manager'
  );

-- visits: admins/managers see all, workers see only their own.
create policy visits_authn_select on public.visits
  for select using (
    is_admin()
    or auth_user_role() = 'project_manager'
    or worker_id = auth_user_id()
  );
create policy visits_pm_all on public.visits
  for all using (
    is_admin() or auth_user_role() = 'project_manager'
  ) with check (
    is_admin() or auth_user_role() = 'project_manager'
  );

-- visit_images: visible to admin/managers and the visit's worker.
create policy visit_images_select on public.visit_images
  for select using (
    exists (
      select 1 from public.visits v
      where v.id = visit_id
        and (
          is_admin()
          or auth_user_role() = 'project_manager'
          or v.worker_id = auth_user_id()
        )
    )
  );

-- =============================================================================
-- END 0003
-- =============================================================================
