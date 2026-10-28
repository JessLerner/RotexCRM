-- Borra solamente leads importados desde Fox CRM y sus registros dependientes.
-- No borra usuarios, equipos, marcas ni perfiles.
do $$
declare v_batch_ids uuid[];
begin
  select coalesce(array_agg(distinct imported_batch_id), '{}'::uuid[]) into v_batch_ids
  from public.leads where source_system = 'fox_crm';

  delete from public.follow_up_tasks t using public.leads l where t.lead_id = l.id and l.source_system = 'fox_crm';
  delete from public.lead_activities a using public.leads l where a.lead_id = l.id and l.source_system = 'fox_crm';
  delete from public.lead_rotations r using public.leads l where r.lead_id = l.id and l.source_system = 'fox_crm';
  update public.leads set current_assignment_id = null where source_system = 'fox_crm';
  delete from public.lead_assignments a using public.leads l where a.lead_id = l.id and l.source_system = 'fox_crm';
  delete from public.leads where source_system = 'fox_crm';
  delete from public.import_batches where id = any(v_batch_ids);
end;
$$;
