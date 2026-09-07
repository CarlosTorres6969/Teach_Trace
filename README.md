# TeachTrace — prototipo del piloto

Monolito modular para documentar y evaluar el proceso académico cuando se utiliza inteligencia
artificial generativa. La IA solo producirá una valoración preliminar: la decisión final permanece
en el docente.

El flujo base implementa:

- Autenticación y autorización para estudiantes y docentes.
- Gestión docente de clases y matrícula con cuentas autorizadas.
- Actividades asociadas a una clase y resultados de aprendizaje.
- Rúbricas de exactamente siete dimensiones, con cuatro niveles por dimensión.
- Bitácora estructurada del proceso del estudiante.
- Entrega conjunta de producto, archivo y declaración de uso de IA.
- Roster docente y consulta de todas las evidencias entregadas.
- Preferencias de notificación por evento y canal para estudiantes.

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

## Usuarios de demostración

- Estudiante: `estudiante@unah.edu.hn` / `Estudiante123!`
- Docente: `docente@unah.edu.hn` / `Docente123!`

Al iniciar por primera vez se crea una clase con matrícula, una actividad, una rúbrica de siete
dimensiones, una bitácora, una declaración y una entrega de demostración. Consulta
[docs/HISTORIAS_USUARIO.md](docs/HISTORIAS_USUARIO.md) para ver la cobertura funcional.

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
- El limitador se conserva en memoria, apropiado para el monolito del piloto. Si se despliegan
  varias instancias deberá moverse a un almacén compartido.

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
