-- The scheduled job must both rotate expired data and refill each active seller's daily cupo.
-- Without this, imported queued data waits for a manager to manually open the application.
create or replace function public.run_rotation_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_actor uuid;
  v_rotations jsonb;
  v_refill jsonb;
begin
  select id into v_system_actor
  from public.profiles
  where role = 'administracion' and status = 'active'
  order by created_at
  limit 1;
  if v_system_actor is null then
    raise exception 'Se necesita una cuenta de Administración activa para ejecutar la rotación programada';
  end if;
  perform set_config('request.jwt.claim.sub', v_system_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select public.process_due_rotations(500) into v_rotations;
  select public.fill_rotation_cupos(500) into v_refill;
  return jsonb_build_object('rotations', v_rotations, 'refill', v_refill);
end;
$$;
