# Despliegue y mantenimiento

El piloto no se despliega con datos reales hasta contar con configuración Supabase, secreto de job, políticas RLS verificadas y backup/exportación manual probado. Se documentarán variables en `.env.example`, sin claves.

Administración revisará semanalmente errores de importación, cola sin asignar, ejecuciones programadas y usuarios desactivados. Antes de cualquier migración se exportarán datos, se probará restauración y se comunicará ventana operativa.

Costo previsto del piloto: USD 0 bajo límites del plan Free, sin respaldo gestionado ni garantía de continuidad. Escalar a producción exige aprobar infraestructura administrada o asumir formalmente la operación de un servidor propio.
