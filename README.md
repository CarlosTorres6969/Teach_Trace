# TeachTrace — MVP inicial

Implementación funcional de las historias HU-01 a HU-21 del primer incremento:

- Autenticación y separación de funciones por rol.
- Creación de actividades, resultados de aprendizaje y rúbricas.
- Bitácora del proceso del estudiante.
- Declaración estructurada del uso de IA.
- Entrega del producto y consulta de su estado.
- Consulta docente de productos y evidencias.

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

Al iniciar por primera vez se crea una actividad de demostración con bitácora, declaración, entrega y rúbrica. Consulta [docs/HISTORIAS_USUARIO.md](docs/HISTORIAS_USUARIO.md) para ver la cobertura de las 21 historias.

## Comandos

```bash
npm run dev     # API y frontend en modo desarrollo
npm run build   # compilación de producción
```

Copie `.env.example` como `.env` y cambie `JWT_SECRET` antes de desplegar. El inicio rápido funciona con los valores de desarrollo sin crear ese archivo.
