-- Ejecutar UNA VEZ después de habilitar el módulo Cron (pg_cron) en Supabase Dashboard.
-- Procesa vencimientos cada minuto, aun cuando no haya ninguna persona conectada a Rotex.
select cron.schedule(
  'rotex-rotation-every-minute',
  '* * * * *',
  $$ select public.run_rotation_job(); $$
);
