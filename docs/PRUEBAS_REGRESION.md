# Pruebas de regresión antes de publicar Rotex

Ejecutar esta lista completa luego de cada migración que cambie seguridad, cartera o estructura.

## Administración

- Inicia en **Control Operativo** y los contadores coinciden con `get_operational_metrics`.
- Ve la nómina completa una sola vez y puede invitar, activar, deshabilitar y modificar roles sin poder deshabilitar la última Administración.
- Desde Cartera puede asignar, liberar, cerrar o descartar; cada acción deja evento de auditoría.
- Ve presencia de todos los roles y no recibe pantallas vacías al refrescar.

## Gerencia

- Estadísticas muestra agregados de su estructura y Datos Cargados no queda en cero si existen datos visibles.
- Control de Estructura no duplica la misma nómina en estadísticas.
- Cartera nunca expone leads asignados a estructuras ajenas y no ofrece controles administrativos.

## Supervisión

- Monitoreo muestra urgencias y leads de su equipo; Mis Vendedores sólo nómina, conexión, estado y cupos.
- Puede invitar vendedores para su equipo, con la marca heredada.
- No puede operar personal ni cartera de otros equipos.

## Vendedor

- Con estado activo y cupo libre, el cron completa el cupo diario cada minuto.
- Pedir dato no supera capacidad, toma sólo marcas habilitadas o cartera sin marca y no da timeout.
- En franco, los plazos quedan detenidos; al reactivarlo se recalculan. A los siete días laborales se libera la cartera.
- Cinco registros de No responde habilitan Rotar dato; el sexto intento no puede volver a reprogramarse.
- Configuración permite cambiar contraseña, guardar la plantilla propia de WhatsApp y solicitar devolución.

## Plataforma

- Modo claro y oscuro: textos azules e indicadores conservan contraste suficiente.
- La invitación y recuperación de contraseña terminan en pantalla de definición de contraseña.
- `cron.job_run_details` no muestra errores consecutivos y `run_rotation_job()` devuelve `refill` sin timeout.
