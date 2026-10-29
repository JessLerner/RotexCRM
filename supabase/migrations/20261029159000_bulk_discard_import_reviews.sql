-- Bulk discard keeps bad imports out of operations without deleting their audit trail.
create or replace function public.discard_import_reviews(p_lead_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_actor uuid := auth.uid(); v_count integer;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role in ('administracion', 'gerencia') and status = 'active') then
    raise exception 'No tenés permisos para descartar importaciones' using errcode = '42501';
  end if;
  if coalesce(array_length(p_lead_ids, 1), 0) = 0 then raise exception 'Seleccioná al menos un dato' using errcode = '22023'; end if;
  with discarded as (
    update public.leads set state = 'closed_lost', closed_at = now(), closed_by = v_actor,
      closure_outcome = 'dato_erroneo', closure_notes = 'Descartado masivamente durante la revisión de importación.', current_assignment_id = null
    where id = any(p_lead_ids) and state = 'review'
    returning id
  )
  insert into public.lead_activities(lead_id, author_id, kind, result, body)
  select id, v_actor, 'cierre', 'dato_erroneo', 'Dato descartado masivamente durante la revisión de importación.' from discarded;
  get diagnostics v_count = row_count;
  insert into public.audit_events(actor_id, event_type, entity_type, metadata)
  values (v_actor, 'import_reviews_discarded_bulk', 'lead', jsonb_build_object('requested', array_length(p_lead_ids, 1), 'discarded', v_count));
  return jsonb_build_object('discarded', v_count);
end;
$$;

revoke all on function public.discard_import_reviews(uuid[]) from public;
grant execute on function public.discard_import_reviews(uuid[]) to authenticated;
