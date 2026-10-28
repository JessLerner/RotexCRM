# Arquitectura objetivo

## Decisión de piloto

Rotex usará un proyecto Supabase independiente en plan Free, sin integrar Nave Gestión Comercial ni requerir gasto. La app queda preparada para una migración posterior a una base empresarial compartida. El plan Free es solo para piloto: su pausa por inactividad y falta de backups administrados impiden prometer operación crítica.

## Componentes

- React/Vite conserva la UI y usa Supabase Auth, consultas con RLS y Realtime; nunca usa claves privilegiadas.
- PostgreSQL/Supabase contiene `rotex` como esquema propio, migraciones versionadas, RLS, RPC transaccionales y auditoría.
- Edge Functions o servicio de servidor protegido reciben importaciones, consultan Google Sheets y ejecutan acciones administrativas.
- Un job programado invoca una función idempotente para vencimientos de 30 minutos, cinco horas y diez días aunque no haya navegadores abiertos.
- Google Sheets se integra con cuenta de servicio u OAuth de servidor; la hoja permanece privada.

Los secretos solo se guardan en variables de entorno del servidor/Supabase. El frontend recibe únicamente URL y anon key públicas.

## Migración futura

El modelo tendrá IDs UUID, claves externas estables y exportación por tablas. Una migración a una base compartida se hará con ventana de solo lectura, backup, carga transaccional, conciliación de conteos y cambio de configuración; no habrá sincronización bidireccional improvisada.
