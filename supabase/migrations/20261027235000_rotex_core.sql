-- Rotex core: identities, commercial structure, leads and immutable history.
create extension if not exists pgcrypto;

create type public.rotex_role as enum ('vendedor', 'supervisor', 'gerencia', 'administracion');
create type public.member_status as enum ('active', 'paused', 'inactive');
create type public.lead_state as enum ('review', 'queued', 'assigned', 'in_progress', 'closed_won', 'closed_lost');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) > 1),
  role public.rotex_role not null default 'vendedor',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.managements (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true, created_at timestamptz not null default now());
create table public.teams (id uuid primary key default gen_random_uuid(), management_id uuid not null references public.managements(id), name text not null, active boolean not null default true, unique(management_id, name));
create table public.team_memberships (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete restrict,
  team_id uuid not null references public.teams(id), reports_to uuid references public.profiles(id) on delete restrict,
  status public.member_status not null default 'active', capacity integer not null default 15 check(capacity >= 0),
  joined_at timestamptz not null default now(), left_at timestamptz, unique(profile_id, team_id, joined_at)
);
create table public.brands (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true);
create table public.seller_brands (profile_id uuid not null references public.profiles(id) on delete restrict, brand_id uuid not null references public.brands(id), primary key(profile_id, brand_id));

create table public.import_batches (
  id uuid primary key default gen_random_uuid(), imported_by uuid not null references public.profiles(id), filename text not null, sha256 text not null, rotation_scope_team_id uuid references public.teams(id), status text not null check(status in ('analysed','committed','failed')), summary jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(imported_by, sha256)
);
create table public.leads (
  id uuid primary key default gen_random_uuid(), source_system text not null default 'fox_crm', fox_lead_id text not null,
  first_name text, last_name text, full_name text not null, phone_original text, mobile_original text, phone_normalized text, mobile_normalized text,
  brand_id uuid references public.brands(id), model_interest text, state public.lead_state not null default 'review',
  imported_batch_id uuid references public.import_batches(id), first_assigned_at timestamptz, current_assignment_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(source_system, fox_lead_id)
);
create table public.lead_assignments (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id), seller_id uuid not null references public.profiles(id),
  assigned_by uuid references public.profiles(id), assigned_at timestamptz not null default now(), released_at timestamptz,
  first_management_due_at timestamptz not null, follow_up_due_at timestamptz, seller_close_due_at timestamptz not null,
  release_reason text, check(released_at is null or released_at >= assigned_at)
);
create unique index lead_one_active_assignment on public.lead_assignments(lead_id) where released_at is null;
alter table public.leads add constraint leads_current_assignment_fk foreign key(current_assignment_id) references public.lead_assignments(id) deferrable initially deferred;
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id), assignment_id uuid references public.lead_assignments(id),
  author_id uuid not null references public.profiles(id), kind text not null check(kind in ('gestion','comentario','tarea','rotacion','cierre','sistema')),
  result text, body text, occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id), assignment_id uuid not null references public.lead_assignments(id),
  created_by uuid not null references public.profiles(id), due_at timestamptz not null, completed_at timestamptz, details text not null, created_at timestamptz not null default now()
);
create table public.lead_rotations (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id), from_assignment_id uuid references public.lead_assignments(id), to_assignment_id uuid references public.lead_assignments(id), reason text not null, executed_at timestamptz not null default now());
create table public.audit_events (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), event_type text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'administracion' and status = 'active') $$;
create or replace function public.is_manager_of(profile uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(select 1 from public.team_memberships target join public.team_memberships mine on mine.team_id = target.team_id where target.profile_id = profile and mine.profile_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('supervisor','gerencia')) and mine.status = 'active')
$$;
create or replace function public.can_view_lead(target_lead uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists(select 1 from public.lead_assignments a where a.lead_id = target_lead and (a.seller_id = auth.uid() or public.is_manager_of(a.seller_id)))
$$;

alter table public.profiles enable row level security; alter table public.managements enable row level security; alter table public.teams enable row level security; alter table public.team_memberships enable row level security; alter table public.brands enable row level security; alter table public.seller_brands enable row level security; alter table public.import_batches enable row level security; alter table public.leads enable row level security; alter table public.lead_assignments enable row level security; alter table public.lead_activities enable row level security; alter table public.follow_up_tasks enable row level security; alter table public.lead_rotations enable row level security; alter table public.audit_events enable row level security;
create policy profile_read on public.profiles for select using (id = auth.uid() or public.is_admin() or public.is_manager_of(id));
create policy profile_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy structure_read on public.managements for select using (auth.uid() is not null);
create policy structure_write on public.managements for all using (public.is_admin()) with check (public.is_admin());
create policy teams_read on public.teams for select using (auth.uid() is not null);
create policy teams_write on public.teams for all using (public.is_admin()) with check (public.is_admin());
create policy membership_read on public.team_memberships for select using (profile_id = auth.uid() or public.is_manager_of(profile_id));
create policy membership_write on public.team_memberships for all using (public.is_admin() or public.is_manager_of(profile_id)) with check (public.is_admin() or public.is_manager_of(profile_id));
create policy brands_read on public.brands for select using (auth.uid() is not null);
create policy brands_write on public.brands for all using (public.is_admin()) with check (public.is_admin());
create policy seller_brands_read on public.seller_brands for select using (profile_id = auth.uid() or public.is_manager_of(profile_id));
create policy seller_brands_write on public.seller_brands for all using (public.is_admin()) with check (public.is_admin());
create policy lead_read on public.leads for select using (public.can_view_lead(id));
create policy activity_read on public.lead_activities for select using (public.can_view_lead(lead_id));
create policy task_read on public.follow_up_tasks for select using (public.can_view_lead(lead_id));
create policy assignment_read on public.lead_assignments for select using (seller_id = auth.uid() or public.is_manager_of(seller_id));
create policy rotation_read on public.lead_rotations for select using (public.can_view_lead(lead_id));
create policy audit_admin_read on public.audit_events for select using (public.is_admin());
-- Writes to leads, assignments, tasks and audit records occur only through SECURITY DEFINER RPCs added with the import and rotation phases.

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
