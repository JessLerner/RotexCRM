# Modelo de datos propuesto

- Identidad: `auth.users` y `profiles`; `roles`, `user_roles`, `managements`, `teams`, `team_memberships` y `seller_brands`.
- Operación: `leads` conserva identidad Fox, campos originales/normalizados, marca, estado y alcance; `import_batches` e `import_rows` conservan resultados y errores.
- Historia inmutable: `lead_assignments`, `lead_activities`, `follow_up_tasks`, `lead_closures`, `lead_rotations`, `notifications` y `audit_events`.
- Configuración: `business_rules`, `brand_catalog`, `closure_reasons` y `integration_runs`.

`leads` no guarda historia embebida. Una asignación activa se identifica con `released_at IS NULL`; índices únicos evitan más de una asignación activa por lead y duplicados por `(source_system, fox_lead_id)`. Los datos personales se minimizan, se auditan en accesos administrativos y se muestran bajo RLS.
