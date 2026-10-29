-- Controlled personnel management. Retiring a person preserves every historical lead,
-- assignment and audit record; it never deletes commercial evidence.

create or replace function public.can_manage_member(p_member_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles actor
    join public.team_memberships mine on mine.profile_id=actor.id and mine.left_at is null
    join public.team_memberships target on target.team_id=mine.team_id and target.profile_id=p_member_id and target.left_at is null
    where actor.id=auth.uid() and actor.status='active' and actor.role='gerencia'
  ) or exists (
    select 1 from public.team_memberships target
    join public.profiles actor on actor.id=auth.uid()
    where target.profile_id=p_member_id and target.reports_to=auth.uid() and target.left_at is null
      and actor.status='active' and actor.role='supervisor'
  )
$$;

create or replace function public.update_member_structure(
  p_member_id uuid,
  p_supervisor_id uuid,
  p_brand_ids uuid[],
  p_capacity integer,
  p_daily_target integer default 5
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid:=auth.uid(); v_membership public.team_memberships%rowtype; v_actor_role public.rotex_role;
begin
  if not public.can_manage_member(p_member_id) then raise exception 'No tenés permisos para modificar este asesor' using errcode='42501'; end if;
  select * into v_membership from public.team_memberships where profile_id=p_member_id and left_at is null order by joined_at desc limit 1 for update;
  if not found then raise exception 'El asesor no tiene una membresía activa' using errcode='P0001'; end if;
  select role into v_actor_role from public.profiles where id=v_actor;
  if not exists(select 1 from public.profiles where id=p_member_id and role='vendedor') then raise exception 'Solo se puede modificar la estructura de vendedores' using errcode='22023'; end if;
  if not exists(
    select 1 from public.profiles p join public.team_memberships tm on tm.profile_id=p.id and tm.left_at is null
    where p.id=p_supervisor_id and p.role='supervisor' and p.status='active' and tm.team_id=v_membership.team_id
  ) then raise exception 'El supervisor debe estar activo y pertenecer al mismo equipo' using errcode='22023'; end if;
  if v_actor_role='supervisor' and p_supervisor_id<>v_actor then raise exception 'Un supervisor solo puede administrar asesores de su propia nómina' using errcode='42501'; end if;
  if coalesce(array_length(p_brand_ids,1),0)=0 then raise exception 'Seleccioná al menos una marca para el asesor' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_brand_ids) as selected_brand(brand_id) where not exists(select 1 from public.brands b where b.id=selected_brand.brand_id and b.active)) then raise exception 'Una de las marcas seleccionadas no está disponible' using errcode='22023'; end if;
  update public.team_memberships
  set reports_to=p_supervisor_id, capacity=least(greatest(coalesce(p_capacity,15),1),100), daily_target=least(greatest(coalesce(p_daily_target,5),1),10)
  where id=v_membership.id;
  delete from public.seller_brands where profile_id=p_member_id;
  insert into public.seller_brands(profile_id,brand_id) select distinct p_member_id, selected_brand.brand_id from unnest(p_brand_ids) as selected_brand(brand_id);
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
  values(v_actor,'member_structure_updated','profile',p_member_id,jsonb_build_object('supervisor_id',p_supervisor_id,'brand_ids',p_brand_ids,'capacity',p_capacity,'daily_target',p_daily_target));
  return jsonb_build_object('updated',true);
end;
$$;

create or replace function public.set_member_status(p_member_id uuid, p_status public.member_status)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_assignment record; v_released integer:=0;
begin
  if not public.can_manage_member(p_member_id) then raise exception 'No tenés permisos para cambiar este estado' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=p_member_id and role='vendedor') then raise exception 'Solo se puede cambiar el estado de un vendedor desde esta pantalla' using errcode='22023'; end if;
  update public.team_memberships set status=p_status where profile_id=p_member_id and left_at is null;
  if p_status <> 'active' then
    for v_assignment in select a.id,a.lead_id from public.lead_assignments a where a.seller_id=p_member_id and a.released_at is null for update loop
      update public.lead_assignments set released_at=now(), release_reason='Asesor en pausa o inactivo' where id=v_assignment.id;
      update public.leads set state='queued', current_assignment_id=null where id=v_assignment.lead_id;
      insert into public.lead_activities(lead_id,assignment_id,author_id,kind,result,body)
      values(v_assignment.lead_id,v_assignment.id,v_actor,'rotacion','asesor_no_disponible','Dato liberado porque el asesor dejó de estar disponible.');
      v_released:=v_released+1;
    end loop;
  end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
  values(v_actor,'member_status_updated','profile',p_member_id,jsonb_build_object('status',p_status,'released_leads',v_released));
  return jsonb_build_object('updated',true,'released_leads',v_released);
end;
$$;

create or replace function public.retire_member(p_member_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_released jsonb;
begin
  if not public.is_admin() and not exists(select 1 from public.profiles where id=auth.uid() and role='gerencia' and status='active') then raise exception 'Solo Administración o Gerencia puede retirar asesores' using errcode='42501'; end if;
  if not public.can_manage_member(p_member_id) then raise exception 'No tenés permisos para retirar este asesor' using errcode='42501'; end if;
  select public.set_member_status(p_member_id,'inactive'::public.member_status) into v_released;
  update public.team_memberships set left_at=now(), status='inactive' where profile_id=p_member_id and left_at is null;
  update public.profiles set status='inactive' where id=p_member_id;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
  values(v_actor,'member_retired','profile',p_member_id,jsonb_build_object('reason',nullif(trim(p_reason),''),'release',v_released));
  return jsonb_build_object('retired',true);
end;
$$;

revoke all on function public.can_manage_member(uuid), public.update_member_structure(uuid,uuid,uuid[],integer,integer), public.set_member_status(uuid,public.member_status), public.retire_member(uuid,text) from public;
grant execute on function public.update_member_structure(uuid,uuid,uuid[],integer,integer), public.set_member_status(uuid,public.member_status), public.retire_member(uuid,text) to authenticated;
