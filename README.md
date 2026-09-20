# TeachTrace — prototipo del piloto

Monolito modular para documentar y evaluar el proceso académico cuando se utiliza inteligencia
artificial generativa. La IA solo producirá una valoración preliminar: la decisión final permanece
en el docente.

El flujo base implementa:

- Autenticación y autorización para estudiantes y docentes.
- Gestión docente de clases y matrícula con cuentas autorizadas.
- Creación automática de estudiantes con contraseña temporal enviada por correo y cambio obligatorio en el primer acceso.
- Actividades asociadas a una clase y resultados de aprendizaje, creadas primero como borrador y publicadas explícitamente por el docente después de asociar una rúbrica.
- Rúbricas de exactamente siete dimensiones, con cuatro niveles por dimensión.
- Bitácora estructurada obligatoria del proceso del estudiante.
- Entrega conjunta de PDF, declaración de uso de IA y conversación textual completa con al menos un prompt y una respuesta.
- Roster docente y consulta de todas las evidencias entregadas.
- Preferencias de notificación por evento y canal para estudiantes.
- Modo claro, oscuro o automático sincronizado con la cuenta del usuario.
- Accesibilidad global con texto ampliable, contraste AAA y movimiento reducido.
- Dashboard estudiantil filtrado con progreso, alertas de vencimiento y actividades nuevas.

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

La aplicación no crea usuarios ni contenido de demostración al iniciar. Cada pantalla obtiene la
identidad desde la sesión y consulta únicamente la información persistida para esa cuenta. El
conjunto de datos fijo se habilita solamente dentro de las pruebas automatizadas con
`NODE_ENV=test` y `DEMO_SEED=true`.

## Estructura del backend

El backend es un solo proceso NestJS, separado internamente por dominios:

- `auth`: autenticación transversal, sesiones y roles.
- `classes`: clases y matrícula.
- `activities`: actividades y resultados de aprendizaje.
- `rubrics`: rúbricas y asociación con actividades.
- `logbooks`: bitácoras del estudiante.
- `ai-declarations`: declaración estructurada del uso de IA.
- `submissions`: entrega conjunta, archivos, evidencias y disparo de evaluación.
- `notification-preferences`: canales habilitados por usuario y tipo de evento.
- `users`: preferencias personales sincronizadas con la cuenta.
- `ai-engine`: contrato del motor de IA; permanece como stub seguro.
- `evaluations` e `indicators`: módulos y entidades preparados para los requerimientos pendientes.
- `student` y `teacher`: controladores de aplicación que orquestan los dominios según el rol.

## Seguridad de la sesión

- El navegador recibe la sesión en una cookie `HttpOnly` y `SameSite=Strict`; con
  `NODE_ENV=production` también se activa `Secure`, por lo que producción requiere HTTPS.
- El frontend no almacena el JWT ni el usuario en `localStorage`: restaura la identidad mediante
  `GET /api/auth/me` y sincroniza el cierre de sesión entre pestañas.
- Después de cinco credenciales incorrectas para una cuenta, el login responde `429` durante la
  ventana configurada. Los valores se ajustan con `LOGIN_MAX_ATTEMPTS` y `LOGIN_WINDOW_MS`.
- Las sesiones revocadas o vencidas y las cuentas desactivadas son rechazadas en cada endpoint.
- Al matricular individualmente un correo nuevo, se crea la cuenta estudiantil con una contraseña
  temporal aleatoria. La contraseña solo se envía por SMTP y debe reemplazarse antes de acceder a
  las funciones académicas.
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

El endpoint `POST /api/entregas/actividad/:actividadId/evaluar` ya recorre las entregas e invoca
el contrato del motor. Mientras el proveedor no esté implementado no persiste valoraciones falsas
y marca las entregas para revisión manual.

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
