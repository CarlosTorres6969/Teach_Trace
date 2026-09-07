# Modelo de datos del prototipo

El modelo se ejecuta sobre SQLite mediante TypeORM y `sql.js`. Para desarrollo se mantiene la
sincronización automática; las pruebas de integración utilizan una base completamente en memoria.

## Entidades y relaciones

- `User`: cuenta autorizada con rol `student` o `teacher` y tema `light`, `dark` o `system`.
- `AuthSession`: sesión JWT revocable y con vencimiento.
- `AcademicClass`: clase impartida por un docente.
- `Enrollment`: matrícula activa de un estudiante; la combinación estudiante–clase es única.
- `Activity`: actividad obligatoriamente asociada a una clase y clasificada como `baseline` o
  `pilot`.
- `Rubric`: siete dimensiones con descriptores para niveles 1–4.
- `Logbook`: bitácora única por estudiante y actividad.
- `AiDeclaration`: declaración única por estudiante y actividad, con nivel declarado, nivel
  detectado y alerta de discrepancia.
- `Submission`: producto único por estudiante y actividad, con archivo opcional y estado de
  evaluación.
- `Valuation`: una fila por criterio y entrega; conserva por separado el nivel propuesto por IA y
  el nivel asignado por el docente.
- `Indicator`: valor calculado y referencia de línea base.
- `NotificationPreference`: canales de notificación habilitados para una combinación única de
  usuario y tipo de evento.

## Restricciones relevantes

- Una actividad no puede existir sin clase.
- Una matrícula no puede repetirse para el mismo estudiante y clase.
- Una bitácora, declaración o entrega no puede repetirse para estudiante y actividad.
- El nivel declarado no tiene valor predeterminado: la API devuelve `null` mientras no exista una
  declaración y exige seleccionar explícitamente un entero entre 1 y 3 antes de crearla.
- El nivel declarado y detectado de IA está restringido a 1–3 en la API y en SQLite.
- El propósito declarado exige contenido real y admite hasta 5 000 caracteres. Los extremos se
  recortan y los saltos de línea se normalizan a `LF`, tanto en JSON como en entregas multipart.
- El resumen de prompts también exige contenido real, admite hasta 10 000 caracteres y aplica la
  misma normalización en JSON y multipart.
- Los valores IA y docente de una valoración están restringidos a 1–4.
- Una rúbrica recibida por API debe contener exactamente siete dimensiones únicas.
- Una rúbrica puede estar asociada como máximo a una actividad. Puede sustituirse por otra en la
  misma actividad, pero no trasladarse implícitamente ni reutilizarse en dos actividades.
- Si el motor externo no está disponible, la entrega y la actividad quedan marcadas para revisión
  manual sin crear valoraciones simuladas.
- Cada usuario tiene como máximo una preferencia por tipo de evento. Los tres canales comienzan
  activos y `IN_APP` es obligatorio; el backend consulta el valor vigente sin caché antes de que un
  emisor de notificaciones pueda usar un canal.
- El tema de un usuario solo admite `light`, `dark` o `system`; las cuentas nuevas utilizan
  `system` para respetar inicialmente la preferencia del dispositivo.

## Declaración de IA y actualización de la entrega

Durante el piloto, `AiDeclaration` y `Submission` representan la versión vigente de la evidencia;
no constituyen un historial de versiones. La declaración puede guardarse por separado mientras la
actividad no haya sido entregada. Después de la primera entrega, el endpoint independiente de la
declaración rechaza modificaciones: cualquier cambio debe realizarse mediante la actualización de
la entrega completa, que guarda producto y declaración en una sola transacción y renueva
`submittedAt`.

Si posteriormente se exige evidencia inmutable o trazabilidad de cada reentrega, se deberá agregar
una entidad de versiones o una instantánea de la declaración asociada a cada versión de la entrega.

## Configuración

- `DATABASE_PATH`: ubicación del archivo SQLite. El valor `:memory:` crea una base en memoria.
- `DATABASE_AUTOSAVE`: activa la persistencia automática del archivo.
- `DATABASE_SYNCHRONIZE`: sincroniza el esquema durante la etapa de prototipo.

Antes de un despliegue institucional se debe reemplazar la sincronización automática por
migraciones versionadas.
