# Cobertura del flujo base

| Historias | Implementación |
|---|---|
| HU-01, HU-02 | Inicio de sesión para estudiantes y docentes con cuentas autorizadas. |
| HU-03 | Cierre de sesión que revoca la sesión en la base de datos. |
| HU-04 | Guardas de backend y navegación de frontend separadas por rol. |
| Flujo de clases | Creación de clases y matrícula de estudiantes mediante correo autorizado. |
| HU-05 | Formulario y API para crear actividades dentro de una clase, con fecha y tipo. |
| HU-06 | Edición de resultados de aprendizaje, uno por línea. |
| HU-07, HU-08 | Creación obligatoria de siete dimensiones y descriptores para niveles 1–4. |
| HU-09 | Asociación de una rúbrica existente con una actividad. |
| HU-10 a HU-14 | Consulta y actualización de ideas, prompts, validaciones, decisiones y reflexión final. |
| HU-15 a HU-18 | Declaración de herramienta, nivel 1–3, propósito y prompts, guardada junto al producto. |
| HU-19, HU-20 | Entrega de texto, enlace o archivo y visualización del estado y fecha. |
| HU-21 | Consulta docente del producto, bitácora y declaración del estudiante. |

## Recorridos

### Estudiante

1. Inicia sesión y consulta únicamente las actividades de sus clases matriculadas.
2. Abre una actividad y actualiza la bitácora.
3. Completa la declaración de IA junto con el producto.
4. Entrega texto, enlace o archivo.
5. Consulta el estado y actualiza la entrega si es necesario.

### Docente

1. Inicia sesión, crea una clase y matricula estudiantes autorizados.
2. Crea una actividad dentro de la clase y define sus resultados de aprendizaje.
3. Crea una rúbrica de siete dimensiones y cuatro niveles.
4. Asocia la rúbrica con la actividad.
5. Consulta las entregas, descarga archivos y revisa toda la evidencia del estudiante.

## Controles incluidos

- Contraseñas derivadas mediante `scrypt` con sal individual.
- Sesiones JWT revocables y con vencimiento de ocho horas.
- Verificación de rol en cada endpoint protegido.
- Validación y límites de longitud en los datos recibidos.
- Consultas de bitácora, declaración y entrega limitadas al estudiante autenticado.
- Actividades, rúbricas y entregas docentes limitadas a su propietario.
- Actividades estudiantiles limitadas a matrículas activas.
- Producto y declaración de IA guardados en una única transacción.
- Archivos almacenados en SQLite y limitados a 10 MB por entrega.
- El stub del motor de IA nunca persiste valoraciones simuladas.
- La fase de cada actividad distingue línea base interna y piloto.
- Los niveles declarados/detectados están restringidos a 1–3 y las valoraciones a 1–4.
- La caída del motor deja persistidos los estados de revisión manual en actividad y entrega.

## Cobertura automatizada

Las pruebas incluyen unidades por dominio y una aplicación NestJS real sobre SQLite en memoria.
La integración verifica autenticación, roles, aislamiento entre estudiantes, matrícula, rúbrica de
siete dimensiones, bitácora, entrega multipart, descarga autorizada, restricciones de base de datos,
separación entre valor IA y docente, referencia de línea base y degradación a revisión manual.
