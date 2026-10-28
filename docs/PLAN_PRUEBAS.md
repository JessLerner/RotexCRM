# Plan de pruebas

- Unitarias: parser Fox, teléfonos, estados `Vendido`, normalización, reparto, plazos y cálculo de rankings.
- Integración: RLS de cada rol, RPC concurrente de solicitud/asignación, importación idempotente, cierres, exclusiones y job de vencimientos.
- E2E: login, permiso denegado por URL/API, wizard de importación, gestión explícita, cambio en tiempo real y recuperación tras reinicio.
- Carga: CSV de 4.600 filas, solicitudes simultáneas y reintentos del job sin doble rotación.

Las pruebas críticas bloquean cada fase. El estado inicial: no hay suite automatizada y build/lint pendientes de `npm install`.
