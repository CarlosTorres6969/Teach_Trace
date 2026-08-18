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

## Inicio rápido

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
- `ai-engine`: contrato del motor de IA; permanece como stub seguro.
- `evaluations` e `indicators`: módulos y entidades preparados para los requerimientos pendientes.
- `student` y `teacher`: controladores de aplicación que orquestan los dominios según el rol.

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

Copie `.env.example` como `.env` y cambie `JWT_SECRET` antes de desplegar. El inicio rápido funciona con los valores de desarrollo sin crear ese archivo.

Para pruebas, `DATABASE_PATH=:memory:` permite ejecutar la aplicación con SQLite en memoria sin
crear ni modificar el archivo local.
