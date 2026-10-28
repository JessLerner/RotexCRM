# Auditoría técnica — Fase 1

Fecha: 27 de octubre de 2026. Alcance: revisión estática del repositorio y comandos locales no destructivos.

## Estado comprobado

La aplicación React/Vite conserva una interfaz y módulos útiles: tableros por rol, tabla de asesores, detalle de lead, tareas, cierres, ranking, temporizadores y modal de importación. El proyecto compila de forma potencial, pero no se pudo verificar: `npm run lint` y `npm run build` fallaron porque no están instaladas las dependencias (`tsc` y `vite` no se encuentran).

El CSV Fox de referencia está versionado en `HEAD` y contiene `sep=,`, encabezados y valores con NUL intercalado. Sus copias aparecen eliminadas en el directorio de trabajo; no se restauraron ni se inspeccionaron como datos operativos.

## Riesgos críticos

- No hay autenticación: `App.tsx` inicia como administración y `Header.tsx` permite elegir cualquier rol.
- Leads, asesores, configuraciones y auditoría viven en `localStorage`; el backend mantiene otros arreglos en memoria. Se pierden ante limpieza/reinicio y no se sincronizan correctamente.
- Los endpoints `/api/leads`, `/api/vendors` y `/api/rotation-logs` no autentican ni autorizan; los POST reemplazan colecciones completas.
- La rotación se ejecuta cada cuatro segundos en el navegador. Si no hay pestaña abierta, no rota; solicitudes concurrentes no son atómicas.
- El importador lee UTF-8 en cliente, no omite `sep=,`, no trata NUL/codificación, no exige ID ni `Vendido`, inventa IDs y asigna antes de una confirmación persistente.
- El proxy de Google acepta cualquier URL, posibilitando SSRF, y exige hojas publicadas; no usa Google API ni credenciales de servidor.
- Abrir WhatsApp se registra indebidamente como primera gestión. Las notificaciones son locales del navegador, no Web Push en segundo plano.
- No hay pruebas automatizadas, migraciones, Supabase ni documentación operativa. `GEMINI_API_KEY` es una dependencia heredada no usada por el CRM.

No se encontró la palabra prohibida `Doubletick` en el código rastreado.

## Conclusión

La interfaz es reutilizable, pero los mecanismos de identidad, persistencia, importación, autorización, integración y reglas comerciales deben reemplazarse antes de usar datos reales.
