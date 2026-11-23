# TeachTrace — prototipo del piloto

Monolito modular para documentar y evaluar el proceso académico cuando se utiliza inteligencia
artificial generativa. La IA solo producirá una valoración preliminar: la decisión final permanece
en el docente.

El flujo base implementa:

- Autenticación y autorización para administradores, estudiantes y docentes.
- Alta de cuentas docentes por un administrador, con contraseña temporal enviada por correo.
- Gestión docente de clases, matrícula y retiro seguro de estudiantes con cuentas autorizadas.
- Creación automática de estudiantes con contraseña temporal enviada por correo y cambio obligatorio en el primer acceso.
- Actividades asociadas a una clase y resultados de aprendizaje, creadas primero como borrador y publicadas explícitamente por el docente después de asociar una rúbrica.
- Rúbricas configurables de uno a veinte criterios, con cuatro niveles por criterio.
- Bitácora estructurada obligatoria del proceso del estudiante.
- Entrega conjunta de PDF, declaración de uso de IA y conversación textual completa con al menos un prompt y una respuesta.
- Roster docente y consulta de todas las evidencias entregadas.
- Preferencias de notificación por evento y canal para estudiantes.
- Modo claro, oscuro o automático sincronizado con la cuenta del usuario.
- Accesibilidad global con texto ampliable, contraste AAA y movimiento reducido.
- Dashboard estudiantil filtrado con progreso, alertas de vencimiento y actividades nuevas.

## Manual de usuario

El [manual de usuario de TeachTrace](docs/manual-de-usuario-teachtrace.md) reúne los recorridos
de administradores, docentes y estudiantes, con instrucciones de operación, estados, límites,
formatos de archivos y solución de problemas.

## Inicio rápido

Antes de iniciar, copie `.env.example` como `.env` y sustituya `JWT_SECRET` por un valor aleatorio
propio de al menos 32 caracteres. La API rechaza el arranque si falta el secreto, si es demasiado
corto o si conserva el valor de ejemplo.

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:3000/api

La aplicación no crea usuarios académicos ni contenido de demostración al iniciar. Cada pantalla
obtiene la identidad desde la sesión y consulta únicamente la información persistida para esa
cuenta. El conjunto de datos fijo se habilita solamente dentro de las pruebas automatizadas con
`NODE_ENV=test` y `DEMO_SEED=true`; la única excepción es la cuenta administradora inicial cuando
sus tres variables están configuradas explícitamente.

Para crear la primera cuenta administradora configure `ADMIN_EMAIL`, `ADMIN_NAME` y
`ADMIN_TEMPORARY_PASSWORD` en `.env`. La cuenta se crea una sola vez y deberá cambiar esa
contraseña en su primer inicio de sesión. Después, el administrador registra a los docentes desde
`/admin`; cada docente recibe por SMTP su propia contraseña temporal y administra sus clases.

## Estructura del backend

El backend es un solo proceso NestJS, separado internamente por dominios:

- `auth`: autenticación transversal, sesiones y roles.
- `admin`: listado y creación de cuentas docentes; no administra clases ni evaluaciones.
- `classes`: clases y matrícula.
- `activities`: actividades y resultados de aprendizaje.
- `rubrics`: rúbricas y asociación con actividades.
- `logbooks`: bitácoras del estudiante.
- `ai-declarations`: declaración estructurada del uso de IA.
- `submissions`: entrega conjunta, archivos, evidencias y disparo de evaluación.
- `notification-preferences`: canales habilitados por usuario y tipo de evento.
- `users`: preferencias personales sincronizadas con la cuenta.
- `ai-engine`: motor de valoración preliminar conectado a Gemini, con salida estructurada,
  anonimización de identificadores conocidos, lectura del contenido PDF, estimación de comprensión
  de 1 a 100 por resultado de aprendizaje, sugerencia porcentual calculada desde todos los niveles
  de la rúbrica, y valoración cronológica de los prompts del estudiante por dimensiones. Estos
  indicadores son preliminares: el docente conserva la decisión final y debe confirmar cada criterio.
- `evaluations` e `indicators`: módulos y entidades preparados para los requerimientos pendientes.
- `student` y `teacher`: controladores de aplicación que orquestan los dominios según el rol.

## Archivos de entregas en Azure Blob Storage

Desde **Mis clases → Gestionar clase → Configurar actividad**, el docente propietario puede
cambiar el nombre de una actividad y guardar su nueva fecha por separado. Estas operaciones
conservan las entregas, las evaluaciones, la rúbrica y el estado de publicación.

La sección **Contexto privado para la IA** permite adjuntar, reemplazar, descargar o retirar un
PDF o Word (`.docx`) de hasta 10 MB con la definición de la tarea. El documento debe contener
texto extraíble; se admiten hasta 100 000 caracteres. Solo el docente propietario puede acceder
al archivo o a sus metadatos. Los estudiantes no reciben su nombre, su contenido ni enlaces.
El texto se utiliza como referencia privada en las próximas evaluaciones de IA, junto con la
rúbrica y las instrucciones del docente; no vuelve a evaluar entregas automáticamente.

El contexto se guarda en una columna opcional excluida de las consultas ordinarias de TypeORM.
La migración de PostgreSQL agrega únicamente esa columna, sin modificar los datos académicos.

Los PDF adjuntos pueden guardarse en un contenedor privado de Azure Blob Storage. Configure en
`.env` el proveedor y las credenciales de la cuenta de almacenamiento:

```env
DOCUMENT_STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=teachtrace-submissions
```

El backend crea el contenedor si no existe, carga cada archivo con su tipo MIME y conserva en la
base de datos únicamente una referencia `azure:`. Las descargas continúan protegidas por la sesión
y el rol docente; el contenedor no se publica. Si no se configura Azure, el proveedor
`filesystem` utiliza `DOCUMENT_REPOSITORY_PATH`. Las referencias locales creadas anteriormente
siguen siendo compatibles después de activar Azure.

Con Azure, el navegador sube los PDF de hasta 10 MB directamente al almacenamiento para evitar
el límite de tamaño de las funciones de Vercel. La API autoriza un único archivo durante diez
minutos, sin permisos de lectura, borrado ni sobrescritura. Antes de registrar la entrega valida
la autorización del estudiante, el tamaño y la firma PDF; las descargas siguen siendo privadas.
El docente autorizado recibe una URL de lectura por cinco minutos para descargar desde Azure
sin pasar el PDF por Vercel. Los archivos locales o históricos en base de datos usan la API.

Habilite CORS para el frontend antes de desplegar esta carga directa:

```bash
npm run storage:cors -w backend              # revisar la regla propuesta
npm run storage:cors -w backend -- --apply  # agregarla conservando las reglas existentes
```

El script permite el frontend de producción y los orígenes de `FRONTEND_ORIGIN`. Despliegue
primero el backend y luego el frontend. No se requieren migraciones ni cambios en las entregas
existentes. Con almacenamiento local se conserva la carga multipart.

En PostgreSQL se mantiene `DATABASE_SYNCHRONIZE=false`; las migraciones registradas se ejecutan al
iniciar el backend para agregar cambios pendientes sin recrear las tablas ni borrar información.

## Seguridad de la sesión

- El navegador recibe la sesión en una cookie `HttpOnly` y `SameSite=Strict`; con
  `NODE_ENV=production` también se activa `Secure`, por lo que producción requiere HTTPS.
- El frontend no almacena el JWT ni el usuario en `localStorage`: restaura la identidad mediante
  `GET /api/auth/me` y sincroniza el cierre de sesión entre pestañas.
- Después de cinco credenciales incorrectas para una cuenta, el login responde `429` durante la
  ventana configurada. Los valores se ajustan con `LOGIN_MAX_ATTEMPTS` y `LOGIN_WINDOW_MS`.
- Las sesiones revocadas o vencidas y las cuentas desactivadas son rechazadas en cada endpoint.
- Al matricular individualmente un correo nuevo, o al importarlo desde un Excel con las columnas
  `nombre` y `correo`, se crea la cuenta estudiantil con una contraseña temporal aleatoria. La
  contraseña solo se envía por SMTP y debe reemplazarse antes de acceder a las funciones académicas.
- El limitador se conserva en memoria, apropiado para el monolito del piloto. Si se despliegan
  varias instancias deberá moverse a un almacén compartido.

## Recuperación de contraseña por Gmail SMTP

La recuperación no envía contraseñas. Crea un token aleatorio de un solo uso, guarda únicamente su
hash, vence en 30 minutos y revoca las sesiones activas después del cambio. En desarrollo, con
`MAIL_ENABLED=false`, el enlace se escribe en el log del backend; para enviar por Gmail se usa una
contraseña de aplicación y nunca deben registrarse secretos en el repositorio.

Configure en `.env` los valores de `PUBLIC_APP_URL`, `MAIL_ENABLED`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER` y `SMTP_PASS`. Para Gmail, `SMTP_USER` es la cuenta remitente y `SMTP_PASS` es la
contraseña de aplicación, no la contraseña normal de la cuenta.

El endpoint `POST /api/entregas/actividad/:actividadId/evaluar` recorre las entregas, extrae de
forma local el texto del PDF privado, anonimiza los identificadores conocidos y solicita a Gemini
una valoración preliminar por cada criterio. La IA no genera una calificación global: el docente
debe confirmar todos los criterios antes de publicar. Los fallos temporales se reintentan y, si el
proveedor continúa sin responder o el PDF no contiene texto extraíble, la entrega queda disponible
para revisión manual y para un nuevo intento posterior.

El modelo, sus relaciones y restricciones están descritos en
[docs/MODELO_DATOS.md](docs/MODELO_DATOS.md).

## Comandos

```bash
npm run dev     # API y frontend en modo desarrollo
npm run build   # compilación de producción
npm test        # pruebas automatizadas del backend
```

Para pruebas, `DATABASE_PATH=:memory:` permite ejecutar la aplicación con SQLite en memoria sin
crear ni modificar el archivo local.
