# Pendientes de producto

La hoja de ruta consolidada está en [ESTADO_PROYECTO.md](ESTADO_PROYECTO.md). Este archivo conserva los pendientes de experiencia visibles para el usuario.

## Acceso y recuperación

- Implementado: control de ojo para mostrar u ocultar la contraseña en inicio y activación.
- Implementado: pantalla dedicada y clara para solicitar recuperación de contraseña.

## Estructura y roles

- Administración y Gerencia deben poder crear, editar, desactivar, reactivar y reasignar vendedores.
- La marca del asesor debe provenir de su supervisor y solo poder ser modificada por Administración o Gerencia.
- La alta debe pedir correo electrónico para enviar invitación; WhatsApp no es un campo requerido.

## Datos y operación

- Mostrar los datos Fox importados y luego implementar asignación, vencimiento y rotación reales.
- La carga diaria de cada vendedor debe poder mantenerse entre 5 y 10 datos; el límite de 200 de Administración no representa una asignación por persona.
- El tiempo de rotación debe contar únicamente dentro del horario laboral de 09:00 a 20:00.
- `No responde` permite hasta cinco reprogramaciones por lead; al sexto intento debe ofrecerse `Rotar dato` para liberarlo y reasignarlo.
- Los cierres se deben conservar con motivo y trazabilidad en historial, no eliminarse.
- Permitir revisar/corregir filas con teléfono inválido en vez de dejarlas invisibles para la operación.
- Reemplazar la aceptación aparente de Parte Diario por una integración real antes de volver a habilitarla.

## Interfaz y rendimiento

- Confirmar que el modal de cierre se mantenga dentro de pantalla y tenga desplazamiento propio en escritorio y móvil.
- Incorporar paginación y filtros desde servidor: limitar la cola a 200 es solo una medida transitoria de rendimiento.
