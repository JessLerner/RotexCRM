# Estado de RotexCRM

Actualizado: 28 de octubre de 2026. Este documento ordena el trabajo realizado, las decisiones tomadas y el orden recomendado para continuar. Una casilla sin marcar requiere confirmación en la plataforma publicada.

## Decisiones ya tomadas

- La aplicación se publica en Cloudflare Workers, con Supabase como base de datos y autenticación.
- La estructura piloto es: Florencia Rodríguez (Gerencia), Juana Benitez (Supervisora, Peugeot) y Ailen Avalos (Vendedora de su equipo).
- Un asesor creado por un supervisor hereda la marca del supervisor. La marca solo debería poder modificarse por Administración o Gerencia.
- La importación Fox acepta los campos `Telefono` y `Celular`: se usa el primer número válido disponible.
- La marca se obtiene en este orden: `Marca` explícita, modelo reconocido y, si falta todo, cartera general sin marca. No se debe asumir Peugeot por defecto.
- Las únicas marcas operativas son: LEAPMOTOR, RENAULT, PEUGEOT, CITROEN, JEEP y FIAT. Etiquetas ambiguas o ajenas de Fox pasan a cartera general; modelos conocidos se normalizan a una de esas marcas.
- Los datos sin marca podrán ser gestionados por cualquier asesor cuando exista el motor real de asignación.
- No se utilizará Parte Diario/Google Sheets como mecanismo de producción hasta que tenga una integración real de servidor.

## Hecho en código

- Inicio de sesión con Supabase, detección de rol y salida de sesión.
- Flujo visual para activación de cuenta y recuperación de contraseña desde enlaces de Supabase.
- Plantillas de correo de invitación y recuperación con identidad Rotex, Nave Planes y `Created by J. Lerner`.
- Invitación de asesores desde la interfaz, con dirección de redirección a `/auth/activate`.
- Nómina conectada a Supabase: lectura de equipos, cambio persistente de estado y capacidad; se elimina la nómina demo cuando hay datos reales.
- Corrección de navegación duplicada para vendedor, supervisor y gerencia; el encabezado superior controla las vistas.
- Corrección del nombre del equipo de Juana y del texto/botón del vendedor: `Pedir Nuevo Dato`.
- Importador Fox: lectura de CSV con codificaciones habituales, vista previa, conservación de columnas de origen, detección por modelo, cartera general y lotes de hasta 1.000 filas.
- Validación de teléfonos: acepta 8 a 15 dígitos y rechaza faltantes, secuencias y números claramente ficticios; conserva el valor original y el normalizado.
- Modal de cierre contenido dentro de la pantalla, con desplazamiento interno.
- Límite previsto de 200 registros en la cola de importación para evitar renderizar todos los datos de Fox de una vez.

## Bloqueo actual de datos

Los nuevos datos de Fox están en `leads` de Supabase pero no se ven en Rotex. La causa identificada es una sobrecarga de `get_import_queue`: dos versiones compatibles de la función impiden que PostgREST elija una al invocarla desde la aplicación.

Acción inmediata:

1. Ejecutar `supabase/migrations/20261028145000_fix_import_queue_rpc.sql` en el SQL Editor de Supabase.
2. Recargar la aplicación con `Ctrl + F5`.
3. Confirmar que aparecen hasta 200 leads importados y que la carga es sensiblemente más rápida.

No hace falta borrar ni importar de nuevo la base de prueba: los registros existentes deberían quedar disponibles tras esta corrección.

## Ciclo operativo implementado — pendiente de aplicar en Supabase

La migración `20261028150000_operational_lead_lifecycle.sql` incorpora el circuito operativo real:

- Al completar cupos, asigna hasta el objetivo diario de cada vendedor activo (5 por defecto, configurable entre 1 y 10), sin superar su capacidad máxima.
- Respeta la marca del vendedor y permite que la cartera sin marca se asigne a cualquier vendedor elegible.
- La asignación, el pedido de un nuevo dato, las reprogramaciones, las rotaciones y los cierres ocurren en Supabase de forma atómica; no dependen de datos guardados en el navegador.
- Los plazos operativos solo avanzan entre 09:00 y 20:00 de Argentina. En esta primera regla la franja se aplica todos los días; si se decide excluir fines de semana se modifica centralmente en la función de calendario.
- `No responde` permite cinco reprogramaciones de 15 minutos a 5 horas hábiles. En el sexto intento obliga a rotar el dato a otro asesor elegible o dejarlo en cola si no hubiera nadie disponible.
- El cierre archiva el lead con motivo, nota, responsable y fecha; lo retira de la bandeja activa, pero no lo elimina.
- Mientras haya una sesión Rotex abierta, se revisan vencimientos cada minuto de forma segura. Para automatización sin usuarios conectados se agregará una tarea programada de servidor en una etapa posterior.

La migración debe aplicarse antes de publicar el frontend que la utiliza.

## Verificaciones de despliegue pendientes

- [ ] Cloudflare terminó correctamente el último despliegue posterior a los arreglos de `AuthScreen`.
- [ ] Se aplicó la migración `20261028145000_fix_import_queue_rpc.sql` y se visualizan leads en la aplicación.
- [ ] La Edge Function `invite-team-member` aparece publicada en Supabase y una invitación crea el usuario/perfil esperado.
- [ ] La URL final de Cloudflare se cambió de `rotexcrm.jlerner-nave.workers.dev` a `rotexcrm.naveplanes.workers.dev`.
- [ ] En Supabase Auth, `Site URL` y la URL de redirección apuntan a la dirección final, incluyendo `/auth/activate`.
- [ ] Se volvieron a pegar las dos plantillas de correo después del cambio de URL para que los logos carguen desde el dominio correcto.

## Pendientes prioritarios

### 1. Operación real de leads

El importador guarda y muestra la cola, pero todavía no existe el circuito completo de producción. Falta implementar en servidor:

- Asignación automática respetando marca, capacidad y cartera general.
- Definir y aplicar la carga diaria objetivo por asesor (entre 5 y 10 datos activos por día), independiente del límite visual de 200 registros de Administración.
- Tiempos de gestión, vencimiento, rotación y reasignación.
- Cierre real del lead, actividades y auditoría conectados a Supabase.
- Estados y contadores reales en todos los paneles.
- Paginación, búsqueda y filtros desde base de datos; el límite de 200 es una contención temporal, no la solución escalable definitiva.

Reglas nuevas acordadas para ese circuito:

- El reloj de rotación solo cuenta horario laboral, de 09:00 a 20:00. El tiempo fuera de esa franja no debe consumir el plazo de gestión.
- Un vendedor puede registrar `No responde` y reprogramar el contacto hasta cinco veces por el mismo dato.
- En el sexto intento, ya no podrá reprogramar: se reemplaza la acción por `Rotar dato`, que libera el lead y permite asignarlo a otro vendedor elegible.
- Los datos cerrados deben conservarse con su motivo, fecha, vendedor y trazabilidad; salen de la bandeja activa y pasan a historial/reportes, no se eliminan.

### 2. Gestión de personas y estructura

- Implementado en código, pendiente de aplicar/publicar: Administración y Gerencia pueden editar supervisor, marcas, capacidad y cupo diario; además pueden pausar, reactivar o retirar asesores sin borrar su historial.
- Un retiro libera los leads activos a la cola, conserva las asignaciones y actividades previas, y deja auditoría.
- Supervisor: conserva un único botón de alta y no pide WhatsApp; utiliza correo para invitar.
- Pendiente de una fase posterior: creación/edición de supervisores y equipos completos, no solo de vendedores.

### 3. Tableros operativos

- Vendedor: datos asignados, cupo disponible, intentos de contacto y próximas reprogramaciones.
- Supervisor: cantidad total de datos de su marca/equipo, disponibles para asignar, asignados, próximos a rotar, rotados y cerrados.
- Gerencia/Administración: los mismos indicadores consolidados por marca, equipo y usuario, sin confundir la muestra visual de 200 con el total existente.
- Todos los contadores deben provenir de consultas agregadas a Supabase y no del listado visible en pantalla.

### 4. Calidad de importación Fox

- Mostrar cuántas filas quedaron en cola, en revisión y rechazadas, con motivo descargable/corregible.
- Crear una pantalla de revisión manual para teléfonos inválidos y campos ambiguos.
- Definir las reglas finales para duplicados, actualizaciones del mismo ID y campos como `Vendido`/`Fecha de Cierre`.
- Procesar lotes secuencialmente o en servidor si el volumen crece.

### 5. Experiencia de acceso y UI

- Probar en escritorio y móvil el modal de cierre y los formularios extensos.
- Continuar aplicando la identidad visual de Rotex en reportes, estados vacíos y futuras vistas, manteniendo el logo disponible en acceso, encabezado y favicon.

## Migraciones y estado de aplicación

La aplicación real debe verificarse en Supabase; la confirmación de `Success` del SQL Editor es la referencia válida.

| Migración | Propósito | Estado informado |
| --- | --- | --- |
| `20261027235000_rotex_core.sql` | Modelo principal, roles y seguridad | Aplicada en las primeras pruebas |
| `20261028010000_import_fox_leads.sql` | Importación Fox inicial | Aplicada |
| `20261028120000_roster_read_model.sql` | Lectura de nómina | Por verificar |
| `20261028123000_seed_test_structure.sql` | Florencia, Juana, Ailen y Peugeot | Aplicada/visible en la nómina |
| `20261028130000_vendor_roster_supervisor.sql` | Supervisor del vendedor | Informada como aplicada |
| `20261028140000_preserve_fox_source_metadata.sql` | Datos de origen Fox | Confirmar versión corregida |
| `20261028141000_allow_unbranded_fox_leads.sql` | Cartera sin marca | Por verificar |
| `20261028142000_validate_fox_phone_numbers.sql` | Validación de teléfonos | Informada como aplicada |
| `20261028143000_expose_import_queue.sql` | Cola visible en la app | Por verificar |
| `20261028144000_limit_import_queue_read.sql` | Límite de cola (generó ambigüedad) | No es solución final |
| `20261028145000_fix_import_queue_rpc.sql` | Elimina ambigüedad y limita a 200 | **Pendiente crítico** |
| `20261028150000_operational_lead_lifecycle.sql` | Asignación, gestión, rotación, cierres, horarios y métricas reales | **Pendiente de aplicar antes del nuevo despliegue** |
| `20261028151000_structure_management.sql` | Edición, pausas y retiro trazable de asesores | **Pendiente de aplicar antes del nuevo despliegue** |

## Orden recomendado

1. Aplicar y comprobar la migración 145; confirmar que se ven los leads existentes.
2. Validar el despliegue y la URL definitiva antes de invitar usuarios reales.
3. Completar gestión de estructura: personas, equipos, supervisor y marcas.
4. Implementar asignación y rotación real de leads en servidor.
5. Completar revisión de importación, métricas y paginación.
6. Resolver mejoras de acceso y pulido visual antes de abrir la plataforma a terceros.

## Documentos relacionados

- `PLAN_MIGRACION.md`: plan técnico inicial.
- `PLAN_PRUEBAS.md`: guía de pruebas funcionales y de seguridad.
- `REGLAS_NEGOCIO.md`: reglas vigentes, incluidas las de teléfonos.
- `IMPORTACION_FOX.md`: formato y proceso de carga Fox.
- `PENDIENTES_PRODUCTO.md`: lista breve de mejoras de interfaz y producto.
