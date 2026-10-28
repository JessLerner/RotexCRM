# Reglas de negocio acordadas

- Un vendedor debe estar autenticado, activo, disponible, dentro de cupo, autorizado para la marca y el alcance del lote.
- El reparto prioriza menor carga activa y después la asignación más antigua; toda selección se realiza en una transacción/RPC con bloqueo de fila.
- Primera gestión: vence a los 30 minutos. Abrir WhatsApp o llamar no cuenta; se exige actividad explícita con tipo, resultado y fecha.
- Seguimiento: una gestión requiere tarea próxima dentro de cinco horas. Crear/editar tareas no reinicia plazos sin actividad válida.
- Cada asignación inicia un contador máximo de diez días para que ese vendedor venda o cierre. Si rota antes, el nuevo vendedor recibe un nuevo período de diez días. Al vencer, rota automáticamente.
- Los teléfonos de 8 a 15 dígitos se aceptan salvo cadenas repetidas o ficticias inequívocas; se preservan original y normalizado. Fuera de esa regla: revisión manual.
- Un cierre sin venta usa motivo configurable y excluye al vendedor saliente en la siguiente asignación según la política. Una venta detiene toda rotación.
- Sin vendedor elegible, marca conocida o dato suficiente, el lead queda en cola/revisión, nunca se pierde.
