# Rotex CRM — estado de reanudación

Actualizado: 29 de octubre de 2026. Este documento permite pausar Rotex sin perder contexto mientras se prioriza Nave Gestión.

## Estado actual

La aplicación está publicada en `https://rotexcrm.naveplanes.workers.dev` y el código más reciente publicado es el commit `e96fdaa` (`feat: add anonymized seller sales history`).

El build de Vite pasó localmente antes de la última publicación. Cloudflare realiza el despliegue desde la rama `Master`.

Supabase: proyecto `mbtrzlnxpkgwwnbwlubt`. Las migraciones se aplicaron manualmente en SQL Editor; no asumir que una migración está aplicada sólo porque existe en el repositorio: verificar con una consulta funcional si hubiera dudas.

## Lo que está implementado

- Autenticación, invitaciones y recuperación de contraseña mediante Supabase Auth y Edge Function `invite-team-member`.
- Roles: Administración, Gerencia, Supervisión y Vendedor.
- Marcas habilitadas: LEAPMOTOR, RENAULT, PEUGEOT, CITROEN, JEEP y FIAT.
- Importación y revisión de datos, validación de teléfonos y cola de revisión.
- Rotación automática: lunes a sábado, 09:00–20:00 Argentina; domingos detenidos.
- Franco: detiene los plazos sin quitar cartera; luego de siete días laborales de inactividad la cartera se libera.
- Cron de Supabase `rotex-rotation-every-minute` (job id 1) que ejecuta `public.run_rotation_job()` cada minuto.
- Asignación automática de cupos y petición manual de dato por vendedor.
- Perfil vendedor con no-responde, recontacto, límite de cinco intentos, rotación y cierre.
- Paneles de Administración, Gerencia y Supervisión; presencia/última actividad.
- Administración: tablero inicial, nómina única, acciones de cartera auditadas y manejo de accesos.
- Gerencia: cartera restringida a su estructura y sin acciones administrativas.
- Configuración personal: cambio de contraseña, plantilla individual de WhatsApp y solicitud de devolución.
- Modo oscuro con contraste reforzado para enlaces y pestañas.
- Historial anonimizado de ventas posteriores para vendedores.

## Migraciones relevantes aplicadas

Las últimas funciones que deben existir en la base son:

- `20261029162000_auto_refill_rotation_cupos.sql`: cron rellena cupos diarios.
- `20261029163000_fix_work_clock_timeout.sql`: corrige el timeout del reloj laboral. Validado: `run_rotation_job()` devolvió `{"refill":{"assigned":5}}`.
- `20261029164000_control_actions_preferences.sql`: preferencias, solicitudes de devolución, control administrativo, presencia ampliada.
- `20261029165000_vendor_anonymized_sales_history.sql`: historial protegido del vendedor.

## Pendientes por prioridad

### P0 — antes de habilitar usuarios reales masivamente

1. **Bandeja de solicitudes de devolución.** Ya se crean en `lead_return_requests`, pero falta la pantalla para Administración que permita aprobar, rechazar o convertir una solicitud aprobada en un lead trazable. No entregar solicitudes a vendedores sin ese control.
2. **Prueba de regresión por los cuatro roles.** Ejecutar `docs/PRUEBAS_REGRESION.md` con las cuentas reales de prueba: Administración, Florencia (Gerencia), Juana (Supervisión) y Ailen (Vendedor). Confirmar en especial permisos de cartera, estado franco, cron y cambio de rol.
3. **Auditar cambios de rol en nómina.** La nueva nómina permite editar roles. Antes de usarlo con personal real, definir una regla de negocio para el cambio Vendedor ↔ Supervisor/Gerencia: equipo destino, responsable, marcas y permisos. Hoy el cambio de rol está protegido/auditado, pero no abre un asistente de reestructuración.
4. **Validar la entrega de emails de invitación y recuperación** con un correo que no sea de prueba, incluyendo URL final de Rotex.

### P1 — operación y claridad

1. Terminar de simplificar Gerencia: Estadísticas debe quedar sólo con agregados y Estructura con fichas operativas; revisar visualmente con varios supervisores y 30+ vendedores.
2. Agregar a Administración indicadores de solicitudes de devolución pendientes y actividad por equipo en el tablero inicial.
3. Añadir confirmaciones más descriptivas a acciones de cartera (cerrar, descartar, reasignar) y opción de escribir motivo administrativo.
4. Probar importación de un archivo real grande después del cierre de la cola y medir tiempos de carga/consulta.

### P2 — mejoras recomendadas

1. Código dividido por pantalla (`dynamic import`) para reducir el bundle de JavaScript: el build advierte un chunk de aproximadamente 662 kB, no bloquea la operación pero afecta la primera carga.
2. Notificaciones reales de navegador/correo para vencimientos, invitaciones y solicitudes aprobadas.
3. Catálogo administrable de motivos de cierre y reportes exportables.
4. Auditoría visual de cambios de estructura, cupo, rol y marca.
5. Filtros/ordenamientos guardados por usuario en cartera y nómina.

## Orden seguro para retomar

1. Confirmar que el sitio público cargue el commit publicado y que `cron.job_run_details` no tenga timeouts nuevos.
2. Implementar y desplegar la bandeja P0 de solicitudes de devolución junto con su RPC de resolución.
3. Ejecutar la lista `PRUEBAS_REGRESION.md` y corregir únicamente fallas reproducibles.
4. Recién después avanzar con P1 y P2, de a un bloque funcional por despliegue.

## Reglas de no regresión

- Nunca publicar interfaz que dependa de una RPC/migración antes de que la migración esté aplicada.
- Para cada cambio de base: migración pequeña, validación en SQL Editor, build local y despliegue separado.
- No tocar `run_rotation_job`, `rotex_add_work_minutes`, `fill_rotation_cupos` ni permisos de cartera sin ejecutar las pruebas de vendedor y cron.
- Conservar siempre el historial; los descartes operativos se cierran/auditan, no se borran físicamente.
