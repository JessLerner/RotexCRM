# Plan de estabilización de Rotex

Este plan prioriza seguridad comercial y operación real antes de sumar pantallas.

## P0 — Bloquea la operación o expone información

1. Asignación automática: el cron completa cupos activos además de rotar vencimientos. Aplicado mediante `20261029162000_auto_refill_rotation_cupos.sql`; el reloj laboral fue estabilizado en `20261029163000_fix_work_clock_timeout.sql` para que los plazos largos no bloqueen el cron.
2. Aislamiento de cartera por estructura: Gerencia no debe navegar datos asignados de equipos ajenos; Administración sí puede controlar toda la operación.
3. Control de usuarios unificado: una sola nómina editable para Administración, incluyendo Administración, Gerencia, Supervisión y Vendedores.
4. Acciones de cartera para Administración: asignar, reasignar, cerrar y descartar con auditoría; no mostrar una lista pasiva como “rotación en vivo”.

## P1 — Control y experiencia de cada rol

1. Inicio de Administración como tablero de control: cartera total, disponibles, asignados, vencidos, conexiones, última actividad y carga por persona.
2. Separar definitivamente Supervisión: Monitoreo = urgencias/datos; Mis Vendedores = nómina, conexión, estado y cupos.
3. Simplificar Gerencia: Estadísticas sólo agregados; Control de estructura una única ficha por persona/equipo, sin duplicar asesores.
4. Revisar contrastes del modo oscuro y normalizar badges, enlaces y textos azules.

## P2 — Funciones personales acordadas

1. Configuración personal: cambio de contraseña, plantilla individual de WhatsApp y vista previa.
2. Solicitud de devolución: formulario con motivo, nombre, apellido, teléfono y destinatario para supervisores; requiere flujo de aprobación/auditoría.
3. Historial anonimizado para vendedores de ventas cerradas por otros asesores, sin teléfono ni identidad completa.

## P3 — Calidad y robustez

1. Pruebas de regresión por rol antes de cada despliegue: Administración, Gerencia, Supervisión y Vendedor.
2. Registro de migraciones aplicadas y una lista de verificación de despliegue.
3. Reemplazar vistas locales heredadas por lecturas paginadas y permisos de servidor donde todavía correspondan.

La lista ejecutable de control previo a un despliegue está en `docs/PRUEBAS_REGRESION.md`.
