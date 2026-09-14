# Cobertura del flujo base

| Historias | Implementación |
|---|---|
| HU-01, HU-02 | Inicio de sesión para estudiantes y docentes con cuentas autorizadas. |
| HU-03 | Cierre de sesión que revoca la sesión en la base de datos. |
| HU-04 | Guardas de backend y navegación de frontend separadas por rol. |
| Flujo de clases | Creación de clases y matrícula de estudiantes mediante correo autorizado. |
| HU-05 | Formulario y API para crear actividades dentro de una clase, con fecha y tipo. |
| HU-06 | Asociación de 1 a 20 resultados de aprendizaje, uno por línea y con un máximo de 500 caracteres cada uno. |
| HU-07, HU-08 | Creación obligatoria de siete dimensiones y descriptores para niveles 1–4. |
| HU-09 | Asociación exclusiva de una rúbrica existente con una actividad, con sustitución e idempotencia controladas. |
| HU-10 a HU-14 | Consulta y actualización de ideas, prompts, validaciones, decisiones y reflexión final. |
| HU-15 a HU-18 | Declaración de herramienta, nivel 1–3, propósito y prompts, guardada junto al producto. |
| HU-19, HU-20 | Entrega de texto, enlace o archivo y visualización del estado y fecha. |
| HU-21 | Consulta docente del producto, bitácora y declaración del estudiante. |
| HU-22 | Dashboard con filtros para los próximos siete días, el mes y todas las actividades; contador de pendientes, fechas, urgencia y sección colapsada de completadas. |
| HU-23 | Progreso calculado por actividad (bitácora 40 %, declaración IA 30 % y producto 30 %) con barra, semáforo y secciones faltantes. |
| HU-24 | Contador de actividades nuevas en navegación, marca visual durante tres días y primera vista persistida por estudiante. |
| HU-30 | Foro por clase para ambos roles con búsqueda, paginación, respuestas de un nivel, destacados, resolución, moderación y avisos al autor. |
| EP07 — Preferencias de notificación | Configuración por evento de email, push y avisos en plataforma; este último canal es obligatorio. |
| EP07 — Modo oscuro | Tema claro u oscuro instantáneo, persistido localmente y en la cuenta, con modo del sistema como valor inicial. |
| HU-41 | Tamaño de texto, alto contraste y movimiento reducido sincronizados con la cuenta. |

## Recorridos

### Estudiante

1. Inicia sesión y consulta únicamente las actividades de sus clases matriculadas.
2. Abre una actividad y actualiza la bitácora.
3. Completa la declaración de IA junto con el producto.
4. Entrega texto, enlace o archivo.
5. Consulta el estado y actualiza la entrega si es necesario.
6. Configura sus canales por tipo de evento desde `/settings/notifications`.
7. Alterna el modo claro u oscuro desde la barra de navegación.
8. Consulta el foro de cada clase, publica preguntas y responde a otros participantes.

### Docente

1. Inicia sesión, crea una clase y matricula estudiantes autorizados.
2. Crea una actividad dentro de la clase y define sus resultados de aprendizaje.
3. Crea una rúbrica de siete dimensiones y cuatro niveles.
4. Asocia la rúbrica con la actividad.
5. Consulta las entregas, descarga archivos y revisa toda la evidencia del estudiante.
6. Participa en los foros, destaca hilos, resuelve dudas y modera publicaciones.

## Controles incluidos

- Contraseñas derivadas mediante `scrypt` con sal individual.
- Sesiones JWT revocables y con vencimiento de ocho horas.
- JWT obligatorio de al menos 32 caracteres y sin clave predeterminada o de ejemplo.
- Sesión web en cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción; el JWT no se
  persiste en `localStorage`.
- Bloqueo temporal por cuenta después de intentos fallidos, con respuesta `429` y `Retry-After`.
- Verificación de rol en cada endpoint protegido.
- Validación y límites de longitud en los datos recibidos.
- Consultas de bitácora, declaración y entrega limitadas al estudiante autenticado.
- Actividades, rúbricas y entregas docentes limitadas a su propietario.
- Actividades estudiantiles limitadas a matrículas activas.
- Foros limitados a estudiantes matriculados y al docente propietario de la clase; solo el autor o
  el docente pueden resolver un hilo y únicamente el docente puede destacar o moderar.
- Producto y declaración de IA guardados en una única transacción.
- Nombre real de la herramienta de IA obligatorio, normalizado y limitado a 120 caracteres.
- Nivel de uso de IA sin valor predeterminado y con selección explícita entre 1, 2 y 3.
- Los endpoints JSON exigen un nivel numérico; la entrega multipart convierte únicamente las
  cadenas exactas `"1"`, `"2"` y `"3"`.
- Propósito del uso de IA obligatorio, normalizado y limitado a 5 000 caracteres, conservando
  párrafos y saltos de línea internos.
- Resumen de prompts obligatorio, normalizado y limitado a 10 000 caracteres, con el mismo
  comportamiento en la declaración independiente y en la entrega.
- Después de entregar, la declaración solo puede cambiarse al actualizar la entrega completa.
- Archivos almacenados en SQLite y limitados a 10 MB por entrega.
- El stub del motor de IA nunca persiste valoraciones simuladas.
- La fase de cada actividad distingue línea base interna y piloto.
- Los niveles declarados/detectados están restringidos a 1–3 y las valoraciones a 1–4.
- La caída del motor deja persistidos los estados de revisión manual en actividad y entrega.
- Las preferencias se consultan al momento de enviar; los nuevos eventos comienzan con todos los
  canales activos y los avisos en plataforma no pueden deshabilitarse.
- El tema se aplica antes de montar la interfaz, se conserva en `localStorage` y se recupera desde
  la cuenta en cada inicio o restauración de sesión.
- La accesibilidad se aplica globalmente mediante variables y clases CSS, combina la reducción de
  movimiento elegida con `prefers-reduced-motion` y se recupera desde la cuenta.

## Cobertura automatizada

Las pruebas incluyen unidades por dominio y una aplicación NestJS real sobre SQLite en memoria.
La integración verifica autenticación, cookies de sesión, limitación de intentos, cuentas inactivas,
sesiones expiradas, roles, aislamiento entre estudiantes, matrícula, rúbrica de
siete dimensiones, bitácora, entrega multipart, descarga autorizada, restricciones de base de datos,
declaraciones de IA inválidas, selección y persistencia de los tres niveles declarados, propósito y
resumen de prompts normalizados en declaración y entrega, bloqueo de cambios aislados tras la
entrega, separación entre valor IA y docente, referencia de línea base y degradación a revisión
manual.
Las historias HU-22 a HU-24 verifican filtros, progreso 0/70/100, conteo de novedades y vista
idempotente. HU-30 verifica creación y búsqueda de hilos, paginación de 20 elementos, anidación de
un nivel, permisos de destacado/resolución, notificación al autor y moderación docente.
También cubre los valores predeterminados de notificación, su actualización inmediata, la
obligatoriedad del canal en plataforma y el acceso autenticado.
Las pruebas de tema verifican la preferencia del sistema operativo y sus cambios en tiempo real,
el cambio instantáneo, la reversión ante errores, la persistencia local y remota, los valores
inválidos y contraste WCAG AA en colores principales, controles y gráficos.
Las pruebas de accesibilidad verifican límites, persistencia, vista previa, movimiento reducido y
contraste WCAG AAA de la paleta alternativa.
