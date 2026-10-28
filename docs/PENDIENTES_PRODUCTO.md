# Pendientes de producto

La hoja de ruta consolidada está en [ESTADO_PROYECTO.md](ESTADO_PROYECTO.md). Este archivo conserva los pendientes de experiencia visibles para el usuario.

## Acceso y recuperación

- Agregar control de ojo para mostrar u ocultar la contraseña en inicio, activación y recuperación.
- Reemplazar el flujo actual de “Olvidé mi contraseña” por una pantalla inicial dedicada y más clara, sin obligar a completar el formulario de inicio de sesión.

## Estructura y roles

- Administración y Gerencia deben poder crear, editar, desactivar, reactivar y reasignar vendedores.
- La marca del asesor debe provenir de su supervisor y solo poder ser modificada por Administración o Gerencia.
- La alta debe pedir correo electrónico para enviar invitación; WhatsApp no es un campo requerido.

## Datos y operación

- Mostrar los datos Fox importados y luego implementar asignación, vencimiento y rotación reales.
- Permitir revisar/corregir filas con teléfono inválido en vez de dejarlas invisibles para la operación.
- Reemplazar la aceptación aparente de Parte Diario por una integración real antes de volver a habilitarla.

## Interfaz y rendimiento

- Confirmar que el modal de cierre se mantenga dentro de pantalla y tenga desplazamiento propio en escritorio y móvil.
- Incorporar paginación y filtros desde servidor: limitar la cola a 200 es solo una medida transitoria de rendimiento.
