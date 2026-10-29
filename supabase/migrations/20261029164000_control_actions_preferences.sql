-- Closing-stage control plane: one safe API for administration actions and
-- personal preferences. It preserves lead history; no commercial record is deleted.
create table if not exists public.user_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  whatsapp_template text not null default 'Hola {{nombre}}, ¿cómo estás? Te contacto por tu consulta sobre {{marca}} {{modelo}}.',
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy user_preferences_own on public.user_preferences for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create table if not exists public.lead_return_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id),
  recipient_seller_id uuid references public.profiles(id),
  first_name text not null, last_name text not null, phone text not null,
  reason text not null, status text not null default 'pending' check (status in ('pending','approved','rejected')),
  resolved_by uuid references public.profiles(id), resolved_at timestamptz, created_at timestamptz not null default now()
);
alter table public.lead_return_requests enable row level security;

create or replace function public.get_presence_report()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_role public.rotex_role;
begin
  select role into v_role from public.profiles where id=v_actor and status='active';
  if v_role not in ('administracion','gerencia','supervisor') then raise exception 'Sin permisos para consultar actividad' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'profile_id',p.id,'name',p.display_name,'role',p.role,'last_seen_at',up.last_seen_at,'session_started_at',up.session_started_at,
    'connected',coalesce(up.last_seen_at>=now()-interval '3 minutes',false),
    'connected_minutes',case when up.last_seen_at>=now()-interval '3 minutes' then floor(extract(epoch from(now()-up.session_started_at))/60)::integer else null end
  ) order by coalesce(up.last_seen_at,p.created_at) desc)
  from public.profiles p left join public.user_presence up on up.profile_id=p.id
  where p.status='active' and (
    v_role='administracion' or p.id=v_actor or exists(
      select 1 from public.team_memberships target join public.team_memberships mine on mine.team_id=target.team_id
      where target.profile_id=p.id and target.left_at is null and mine.profile_id=v_actor and mine.left_at is null
    )
  )), '[]'::jsonb);
end; $$;

create or replace function public.admin_manage_lead(
  p_lead_id uuid, p_action text, p_seller_id uuid default null, p_outcome text default null, p_notes text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_old public.lead_assignments%rowtype; v_assignment uuid;
begin
  if not public.is_admin() then raise exception 'Solo Administración puede ejecutar esta acción' using errcode='42501'; end if;
  select a.* into v_old from public.lead_assignments a join public.leads l on l.current_assignment_id=a.id where l.id=p_lead_id and a.released_at is null for update;
  if p_action in ('assign','reassign') then
    if p_seller_id is null then raise exception 'Seleccioná un asesor para asignar el dato' using errcode='22023'; end if;
    if found then update public.lead_assignments set released_at=now(),release_reason='Reasignación administrativa' where id=v_old.id; end if;
    update public.leads set state='queued',current_assignment_id=null where id=p_lead_id;
    v_assignment:=public.rotex_assign_lead(p_lead_id,p_seller_id,v_actor,'Asignación manual de Administración.');
    if v_assignment is null then raise exception 'El asesor no está disponible, no coincide con la marca o no tiene capacidad' using errcode='P0001'; end if;
    insert into public.lead_rotations(lead_id,from_assignment_id,to_assignment_id,reason) values(p_lead_id,v_old.id,v_assignment,'manual_rotation');
  elsif p_action='release' then
    if not found then raise exception 'El dato no tiene una asignación activa' using errcode='P0001'; end if;
    update public.lead_assignments set released_at=now(),release_reason='Liberado por Administración' where id=v_old.id;
    update public.leads set state='queued',current_assignment_id=null where id=p_lead_id;
  elsif p_action in ('close_lost','discard') then
    if found then update public.lead_assignments set released_at=now(),release_reason='Cierre administrativo' where id=v_old.id; end if;
    update public.leads set state='closed_lost',current_assignment_id=null,closed_at=now(),closed_by=v_actor,
      closure_outcome=case when p_action='discard' then 'descartado_administracion' else coalesce(nullif(trim(p_outcome),''),'cerrado_administracion') end,
      closure_notes=nullif(trim(p_notes),'') where id=p_lead_id;
  else raise exception 'Acción de cartera inválida' using errcode='22023'; end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(v_actor,'admin_lead_'||p_action,'lead',p_lead_id,jsonb_build_object('seller_id',p_seller_id,'outcome',p_outcome,'notes',p_notes));
  return jsonb_build_object('updated',true,'action',p_action,'assignment_id',v_assignment);
end; $$;

create or replace function public.admin_update_staff_member(p_member_id uuid,p_status public.member_status,p_role public.rotex_role default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_role public.rotex_role; v_released integer:=0; v_item record;
begin
  if not public.is_admin() then raise exception 'Solo Administración puede modificar usuarios' using errcode='42501'; end if;
  select role into v_role from public.profiles where id=p_member_id for update;
  if v_role is null then raise exception 'Usuario inexistente' using errcode='P0001'; end if;
  if p_member_id=v_actor and p_status<>'active' then raise exception 'No podés deshabilitar tu propia cuenta' using errcode='22023'; end if;
  if v_role='administracion' and p_status<>'active' and (select count(*) from public.profiles where role='administracion' and status='active')<=1 then raise exception 'Debe permanecer al menos una cuenta de Administración activa' using errcode='22023'; end if;
  if p_status<>'active' and v_role='vendedor' then
    for v_item in select id,lead_id from public.lead_assignments where seller_id=p_member_id and released_at is null for update loop
      update public.lead_assignments set released_at=now(),release_reason='Usuario deshabilitado por Administración' where id=v_item.id;
      update public.leads set state='queued',current_assignment_id=null where id=v_item.lead_id;
      v_released:=v_released+1;
    end loop;
  end if;
  update public.profiles set status=p_status,role=coalesce(p_role,role) where id=p_member_id;
  update public.team_memberships set status=p_status where profile_id=p_member_id and left_at is null;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(v_actor,'staff_member_updated','profile',p_member_id,jsonb_build_object('status',p_status,'role',p_role,'released_leads',v_released));
  return jsonb_build_object('updated',true,'released_leads',v_released);
end; $$;

create or replace function public.create_lead_return_request(p_first_name text,p_last_name text,p_phone text,p_reason text,p_recipient_seller_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_role public.rotex_role; v_id uuid;
begin
  select role into v_role from public.profiles where id=v_actor and status='active';
  if v_role not in ('vendedor','supervisor') then raise exception 'Solo asesores y supervisores pueden solicitar una devolución' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_first_name,'')))<2 or char_length(trim(coalesce(p_last_name,'')))<2 or char_length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'))<8 or char_length(trim(coalesce(p_reason,'')))<5 then raise exception 'Completá nombre, apellido, teléfono y un motivo válido' using errcode='22023'; end if;
  if v_role='vendedor' then p_recipient_seller_id:=v_actor; end if;
  insert into public.lead_return_requests(requested_by,recipient_seller_id,first_name,last_name,phone,reason) values(v_actor,p_recipient_seller_id,trim(p_first_name),trim(p_last_name),trim(p_phone),trim(p_reason)) returning id into v_id;
  return jsonb_build_object('created',true,'id',v_id);
end; $$;

revoke all on function public.admin_manage_lead(uuid,text,uuid,text,text),public.create_lead_return_request(text,text,text,text,uuid),public.admin_update_staff_member(uuid,public.member_status,public.rotex_role) from public;
grant execute on function public.admin_manage_lead(uuid,text,uuid,text,text),public.create_lead_return_request(text,text,text,text,uuid),public.admin_update_staff_member(uuid,public.member_status,public.rotex_role),public.get_presence_report() to authenticated;
