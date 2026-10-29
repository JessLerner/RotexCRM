-- The prior clock could stop at 19:59:xx: floor(remaining seconds / 60) became 0,
-- so the loop never advanced. This broke every assignment that calculated the
-- 6,600-minute commercial closing window.
create or replace function public.rotex_add_work_minutes(p_start timestamptz, p_minutes integer)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  -- Business SLAs are expressed in whole minutes. Starting at the current minute
  -- avoids a fractional final minute becoming a non-progressing loop.
  v_local timestamp := date_trunc('minute', p_start at time zone 'America/Argentina/Buenos_Aires');
  v_remaining integer := greatest(coalesce(p_minutes, 0), 0);
  v_open timestamp;
  v_close timestamp;
  v_available integer;
  v_take integer;
  v_steps integer := 0;
begin
  while v_remaining > 0 loop
    v_steps := v_steps + 1;
    if v_steps > 10000 then
      raise exception 'No se pudo calcular el próximo horario laboral';
    end if;

    -- Sunday is entirely outside the commercial calendar. Monday through
    -- Saturday operate from 09:00 through 20:00 Argentina time.
    if extract(dow from v_local) = 0 then
      v_local := date_trunc('day', v_local + interval '1 day') + time '09:00';
      continue;
    end if;

    v_open := date_trunc('day', v_local) + time '09:00';
    v_close := date_trunc('day', v_local) + time '20:00';

    if v_local < v_open then
      v_local := v_open;
      continue;
    end if;

    if v_local >= v_close then
      v_local := date_trunc('day', v_local + interval '1 day') + time '09:00';
      continue;
    end if;

    v_available := floor(extract(epoch from (v_close - v_local)) / 60)::integer;
    if v_available <= 0 then
      -- Defensive branch for any legacy timestamp with residual seconds.
      v_local := v_close;
      continue;
    end if;

    v_take := least(v_remaining, v_available);
    v_local := v_local + make_interval(mins => v_take);
    v_remaining := v_remaining - v_take;
  end loop;

  return v_local at time zone 'America/Argentina/Buenos_Aires';
end;
$$;

-- Smoke checks for the two values used while assigning a lead. They should
-- always finish immediately and remain within Monday-Saturday 09:00-20:00.
do $$
begin
  perform public.rotex_add_work_minutes(now(), 30);
  perform public.rotex_add_work_minutes(now(), 6600);
end;
$$;
