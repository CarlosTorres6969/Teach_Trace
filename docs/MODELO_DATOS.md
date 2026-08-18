# Modelo de datos del prototipo

El modelo se ejecuta sobre SQLite mediante TypeORM y `sql.js`. Para desarrollo se mantiene la
sincronización automática; las pruebas de integración utilizan una base completamente en memoria.

## Entidades y relaciones

- `User`: cuenta autorizada con rol `student` o `teacher`.
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

## Restricciones relevantes

- Una actividad no puede existir sin clase.
- Una matrícula no puede repetirse para el mismo estudiante y clase.
- Una bitácora, declaración o entrega no puede repetirse para estudiante y actividad.
- El nivel declarado y detectado de IA está restringido a 1–3.
- Los valores IA y docente de una valoración están restringidos a 1–4.
- Una rúbrica recibida por API debe contener exactamente siete dimensiones únicas.
- Si el motor externo no está disponible, la entrega y la actividad quedan marcadas para revisión
  manual sin crear valoraciones simuladas.

## Configuración

- `DATABASE_PATH`: ubicación del archivo SQLite. El valor `:memory:` crea una base en memoria.
- `DATABASE_AUTOSAVE`: activa la persistencia automática del archivo.
- `DATABASE_SYNCHRONIZE`: sincroniza el esquema durante la etapa de prototipo.

Antes de un despliegue institucional se debe reemplazar la sincronización automática por
migraciones versionadas.
