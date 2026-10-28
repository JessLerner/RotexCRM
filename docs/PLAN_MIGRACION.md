# Plan de migración

1. Crear proyecto Supabase Free y configurar únicamente secretos/URL públicas necesarios.
2. Añadir migraciones, perfiles, RLS y RPC; sustituir el selector de rol por Auth.
3. Reemplazar `storageService` por repositorios Supabase y adaptar UI sin rediseñarla.
4. Implementar importador servidor, motor programado, auditoría y notificaciones internas.
5. Cargar datos de prueba anonimizados, ejecutar piloto limitado y recién entonces importar datos reales autorizados.

No se migrarán automáticamente datos de `localStorage`; se los tratará como demostración. Para una futura base compartida se exportará el esquema y se realizará conciliación antes del corte.
