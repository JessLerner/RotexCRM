-- A supervisor can be retired without losing commercial history or leaving sellers unmanaged.
create or replace function public.retire_supervisor(
  p_supervisor_id uuid,
  p_seller_action text,
  p_replacement_supervisor_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_team uuid;
  v_replacement_team uuid;
  v_seller record;
  v_assignment record;
  v_released integer := 0;
  v_affected integer := 0;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role in ('administracion', 'gerencia') and status = 'active') then
    raise exception 'Solo Administración o Gerencia puede deshabilitar un supervisor' using errcode = '42501';
  end if;
  if not public.can_manage_member(p_supervisor_id) then
    raise exception 'No tenés permisos sobre este supervisor' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_supervisor_id and role = 'supervisor' and status = 'active') then
    raise exception 'El perfil seleccionado no es un supervisor activo' using errcode = '22023';
  end if;
  if p_seller_action not in ('disable_sellers', 'move_to_supervisor', 'leave_with_manager') then
    raise exception 'Elegí qué hacer con los asesores a cargo' using errcode = '22023';
  end if;

  select team_id into v_target_team from public.team_memberships
  where profile_id = p_supervisor_id and left_at is null order by joined_at desc limit 1;

  if p_seller_action = 'move_to_supervisor' then
    if p_replacement_supervisor_id is null or p_replacement_supervisor_id = p_supervisor_id then
      raise exception 'Seleccioná otro supervisor activo para recibir al equipo' using errcode = '22023';
    end if;
    select tm.team_id into v_replacement_team
    from public.profiles p join public.team_memberships tm on tm.profile_id = p.id and tm.left_at is null
    where p.id = p_replacement_supervisor_id and p.role = 'supervisor' and p.status = 'active'
    order by tm.joined_at desc limit 1;
    if v_replacement_team is null then
      raise exception 'El supervisor de destino no está disponible' using errcode = '22023';
    end if;
  end if;

  for v_seller in
    select tm.id, tm.profile_id
    from public.team_memberships tm join public.profiles p on p.id = tm.profile_id
    where tm.reports_to = p_supervisor_id and tm.left_at is null and p.role = 'vendedor'
    for update of tm
  loop
    v_affected := v_affected + 1;
    if p_seller_action = 'disable_sellers' then
      for v_assignment in select a.id, a.lead_id from public.lead_assignments a where a.seller_id = v_seller.profile_id and a.released_at is null for update loop
        update public.lead_assignments set released_at = now(), release_reason = 'Deshabilitación junto con supervisor' where id = v_assignment.id;
        update public.leads set state = 'queued', current_assignment_id = null where id = v_assignment.lead_id;
        v_released := v_released + 1;
      end loop;
      update public.team_memberships set status = 'inactive', left_at = now(), availability_paused_at = null where id = v_seller.id;
      update public.profiles set status = 'inactive' where id = v_seller.profile_id;
    elsif p_seller_action = 'move_to_supervisor' then
      update public.team_memberships set reports_to = p_replacement_supervisor_id, team_id = v_replacement_team where id = v_seller.id;
    else
      -- The seller keeps their team and portfolio, but becomes directly accountable to the acting manager.
      update public.team_memberships set reports_to = v_actor where id = v_seller.id;
    end if;
  end loop;

  update public.team_memberships set status = 'inactive', left_at = now(), availability_paused_at = null
  where profile_id = p_supervisor_id and left_at is null;
  update public.profiles set status = 'inactive' where id = p_supervisor_id;

  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
  values (v_actor, 'supervisor_retired', 'profile', p_supervisor_id, jsonb_build_object(
    'seller_action', p_seller_action,
    'replacement_supervisor_id', p_replacement_supervisor_id,
    'affected_sellers', v_affected,
    'released_leads', v_released,
    'reason', nullif(trim(coalesce(p_reason, '')), '')
  ));
  return jsonb_build_object('retired', true, 'affected_sellers', v_affected, 'released_leads', v_released);
end;
$$;

revoke all on function public.retire_supervisor(uuid, text, uuid, text) from public;
grant execute on function public.retire_supervisor(uuid, text, uuid, text) to authenticated;
