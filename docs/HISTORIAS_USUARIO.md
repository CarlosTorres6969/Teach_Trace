# Cobertura de historias de usuario

| Historias | Implementación |
|---|---|
| HU-01, HU-02 | Inicio de sesión para estudiantes y docentes con cuentas autorizadas. |
| HU-03 | Cierre de sesión que revoca la sesión en la base de datos. |
| HU-04 | Guardas de backend y navegación de frontend separadas por rol. |
| HU-05 | Formulario y API para crear actividades con asignatura, fecha y tipo. |
| HU-06 | Edición de resultados de aprendizaje, uno por línea. |
| HU-07, HU-08 | Creación de criterios, dimensiones y descriptores para niveles 1–4. |
| HU-09 | Asociación de una rúbrica existente con una actividad. |
| HU-10 a HU-14 | Consulta y actualización de ideas, prompts, validaciones, decisiones y reflexión final. |
| HU-15 a HU-18 | Declaración de herramienta, nivel 1–3, propósito y resumen de prompts. |
| HU-19, HU-20 | Entrega de texto o enlace y visualización del estado y fecha de entrega. |
| HU-21 | Consulta docente del producto, bitácora y declaración del estudiante. |

## Recorridos

### Estudiante

1. Inicia sesión.
2. Abre una actividad.
3. Actualiza la bitácora.
4. Completa la declaración de IA.
5. Entrega o actualiza el producto.
6. Consulta el estado de la entrega.

### Docente

1. Inicia sesión.
2. Crea una actividad y sus resultados de aprendizaje.
3. Crea una rúbrica con criterios y niveles.
4. Asocia la rúbrica con la actividad.
5. Consulta las entregas y toda la evidencia del estudiante.

## Controles incluidos

- Contraseñas derivadas mediante `scrypt` con sal individual.
- Sesiones JWT revocables y con vencimiento de ocho horas.
- Verificación de rol en cada endpoint protegido.
- Validación y límites de longitud en los datos recibidos.
- Consultas de bitácora, declaración y entrega limitadas al estudiante autenticado.
- Actividades, rúbricas y entregas docentes limitadas a su propietario.
