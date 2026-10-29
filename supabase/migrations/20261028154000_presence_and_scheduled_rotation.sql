-- Presence is recorded by authenticated browser heartbeats. A person is considered connected
-- for three minutes after their latest activity; the report remains visible to their managers.
create table if not exists public.user_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  session_started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_signed_out_at timestamptz
);
alter table public.user_presence enable row level security;
create policy user_presence_no_direct_access on public.user_presence for all using (false) with check (false);

create or replace function public.touch_presence()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Perfil activo requerido' using errcode='42501'; end if;
  insert into public.user_presence(profile_id,session_started_at,last_seen_at,last_signed_out_at)
  values(v_actor,now(),now(),null)
  on conflict(profile_id) do update set last_seen_at=now(),last_signed_out_at=null,
    session_started_at=case when public.user_presence.last_seen_at < now()-interval '3 minutes' then now() else public.user_presence.session_started_at end;
  return jsonb_build_object('ok',true);
end; $$;

create or replace function public.end_presence()
returns void language plpgsql security definer set search_path=public as $$
begin update public.user_presence set last_seen_at=now(),last_signed_out_at=now() where profile_id=auth.uid(); end; $$;

create or replace function public.get_presence_report()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_role public.rotex_role;
begin
  select role into v_role from public.profiles where id=v_actor and status='active';
  if v_role not in ('administracion','gerencia','supervisor') then raise exception 'No tenés permisos para consultar presencia' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'profile_id',p.id,'name',p.display_name,'role',p.role,'last_seen_at',up.last_seen_at,'session_started_at',up.session_started_at,
    'connected',coalesce(up.last_seen_at>=now()-interval '3 minutes',false),
    'connected_minutes',case when up.last_seen_at>=now()-interval '3 minutes' then floor(extract(epoch from(now()-up.session_started_at))/60)::integer else null end
  ) order by coalesce(up.last_seen_at,p.created_at) desc)
  from public.profiles p left join public.user_presence up on up.profile_id=p.id
  left join public.team_memberships tm on tm.profile_id=p.id and tm.left_at is null
  where p.role in ('vendedor','supervisor') and (
    v_role='administracion' or tm.team_id in(select mine.team_id from public.team_memberships mine where mine.profile_id=v_actor and mine.left_at is null)
  )), '[]'::jsonb);
end; $$;

-- Cron invokes this definer function without a human session. It impersonates an active
-- administration profile only for audit attribution, never for a browser client.
create or replace function public.run_rotation_job()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_system_actor uuid; v_result jsonb;
begin
  select id into v_system_actor from public.profiles where role='administracion' and status='active' order by created_at limit 1;
  if v_system_actor is null then raise exception 'Se necesita una cuenta de Administración activa para ejecutar rotaciones programadas'; end if;
  perform set_config('request.jwt.claim.sub',v_system_actor::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  select public.process_due_rotations(500) into v_result;
  return v_result;
end; $$;

revoke all on function public.touch_presence(),public.end_presence(),public.get_presence_report(),public.run_rotation_job() from public;
grant execute on function public.touch_presence(),public.end_presence(),public.get_presence_report() to authenticated;
