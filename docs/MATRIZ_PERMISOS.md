# Matriz de permisos

| Acción | Vendedor | Supervisor | Gerencia | Administración |
|---|---:|---:|---:|---:|
| Ver leads propios | Sí | Equipo | Estructuras propias | Global |
| Pedir lead | Sí, RPC atómica | No | No | Sí, controlado |
| Registrar gestión/tarea/cierre | Propios | Consulta | Consulta | Corrección auditada |
| Importar Fox | No | Equipo por defecto | Estructuras propias | Global |
| Pausar vendedor | Propio | Su equipo | Bajo responsabilidad | Global |
| Alta/baja de vendedores | No | Alta sujeta a regla | Bajo responsabilidad | Global |
| Roles, marcas, reglas e integraciones | No | No | No | Sí |

Las políticas RLS aplican estas mismas fronteras en base de datos. Las bajas son desactivaciones: nunca se elimina un perfil ni historial comercial por acción de un supervisor.
