# Importación de Fox CRM

El servidor recibirá el archivo, detectará BOM/codificación, retirará `sep=,` y NUL de forma trazable, analizará comillas, saltos de línea y delimitadores, y normalizará encabezados. No se modificará el archivo original guardado con el lote.

La vista previa clasificará por fila: aceptado, vendido, teléfono inválido, ID faltante, duplicado, marca desconocida, revisión o error técnico. `Vendido=No` es elegible; `Sí/Si` se rechaza; el resto se revisa. El ID Fox es obligatorio y único por fuente. La confirmación persiste lote, incidencias y leads en una transacción idempotente; solo después ingresa a cola de asignación.

El fixture real se recuperará solo con autorización o se reemplazará por una copia anonimizada con la misma estructura antes de las pruebas.
