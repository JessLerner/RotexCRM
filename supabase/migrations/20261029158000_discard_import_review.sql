-- A discard is permanent for operations while preserving the record and its audit trail.
create or replace function public.discard_import_review(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_actor uuid := auth.uid();
begin
  if not exists (select 1 from public.profiles where id = v_actor and role in ('administracion', 'gerencia') and status = 'active') then
    raise exception 'No tenés permisos para descartar importaciones' using errcode = '42501';
  end if;
  if not exists (select 1 from public.leads where id = p_lead_id and state = 'review' for update) then
    raise exception 'El dato ya no está disponible para revisión' using errcode = 'P0001';
  end if;
  update public.leads set state = 'closed_lost', closed_at = now(), closed_by = v_actor,
    closure_outcome = 'dato_erroneo', closure_notes = 'Descartado durante la revisión de importación.', current_assignment_id = null
  where id = p_lead_id;
  insert into public.lead_activities(lead_id, author_id, kind, result, body)
  values (p_lead_id, v_actor, 'cierre', 'dato_erroneo', 'Dato descartado permanentemente durante la revisión de importación.');
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
  values (v_actor, 'import_review_discarded', 'lead', p_lead_id, '{}'::jsonb);
  return jsonb_build_object('discarded', true);
end;
$$;

revoke all on function public.discard_import_review(uuid) from public;
grant execute on function public.discard_import_review(uuid) to authenticated;
