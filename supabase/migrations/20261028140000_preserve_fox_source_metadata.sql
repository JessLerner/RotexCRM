create or replace function public.import_fox_leads(p_filename text, p_sha256 text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid(); v_batch_id uuid; v_row jsonb; v_brand_id uuid; v_lead_id uuid;
  v_inserted integer := 0; v_skipped integer := 0; v_invalid integer := 0;
  v_fox_id text; v_full_name text; v_brand_name text;
begin
  if v_actor is null or not exists (select 1 from public.profiles where id=v_actor and status='active' and role in ('administracion','gerencia','supervisor')) then raise exception 'No tenés permisos para importar datos de Fox CRM' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)=0 then raise exception 'La importación debe contener al menos un registro' using errcode='22023'; end if;
  if jsonb_array_length(p_rows)>2000 then raise exception 'La importación excede el máximo de 2000 registros' using errcode='22023'; end if;
  insert into public.import_batches (imported_by,filename,sha256,status) values (v_actor,coalesce(nullif(trim(p_filename),''),'fox-crm.csv'),p_sha256,'analysed') on conflict (imported_by,sha256) do update set filename=excluded.filename returning id into v_batch_id;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_full_name:=nullif(trim(v_row->>'clientName'),''); v_brand_name:=nullif(trim(v_row->>'brand'),''); v_fox_id:=nullif(trim(v_row->>'foxLeadId'),''); v_lead_id:=null;
    if v_full_name is null or v_brand_name is null or v_fox_id is null then v_invalid:=v_invalid+1; continue; end if;
    insert into public.brands(name) values(v_brand_name) on conflict(name) do nothing; select id into v_brand_id from public.brands where name=v_brand_name;
    insert into public.leads (source_system,fox_lead_id,full_name,phone_original,mobile_original,phone_normalized,mobile_normalized,brand_id,model_interest,state,imported_batch_id,source_metadata)
    values ('fox_crm',v_fox_id,v_full_name,nullif(trim(v_row->>'phone'),''),nullif(trim(v_row->>'phone'),''),nullif(regexp_replace(coalesce(v_row->>'phone',''),'[^0-9+]','','g'),''),nullif(regexp_replace(coalesce(v_row->>'phone',''),'[^0-9+]','','g'),''),v_brand_id,nullif(trim(v_row->>'modelInterest'),''),'queued',v_batch_id,
      jsonb_strip_nulls(jsonb_build_object('email',nullif(trim(v_row->>'email'),''),'foxOriginalCloseDate',nullif(trim(v_row->>'foxOriginalCloseDate'),''),'foxOriginalCloseReason',nullif(trim(v_row->>'foxOriginalCloseReason'),''),'foxBranch',nullif(trim(v_row->>'foxBranch'),''),'foxNotes',nullif(trim(v_row->>'foxNotes'),'') ) || coalesce(v_row->'sourceMetadata','{}'::jsonb))
    on conflict(source_system,fox_lead_id) do nothing returning id into v_lead_id;
    if v_lead_id is null then v_skipped:=v_skipped+1; else v_inserted:=v_inserted+1; insert into public.lead_activities(lead_id,author_id,kind,body) values(v_lead_id,v_actor,'sistema','Importado desde Fox CRM y dejado en cola hasta habilitar la nómina comercial.'); end if;
  end loop;
  update public.import_batches set status='committed',summary=jsonb_build_object('inserted',v_inserted,'skipped',v_skipped,'invalid',v_invalid) where id=v_batch_id;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(v_actor,'fox_import_committed','import_batch',v_batch_id,jsonb_build_object('inserted',v_inserted,'skipped',v_skipped,'invalid',v_invalid));
  return jsonb_build_object('batchId',v_batch_id,'inserted',v_inserted,'skipped',v_skipped,'invalid',v_invalid);
end; $$;
