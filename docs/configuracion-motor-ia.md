# Configurar el motor de IA de actividades

En el panel de administración, la sección **Actividades → Comportamiento del motor de IA** permite definir por separado cómo se comporta la IA en los cinco puntos del análisis. Cada punto tiene un editor de texto plano y permite cargar o descargar su archivo `.txt`:

1. `uso-de-ia.txt`: cómo estima el uso de IA del estudiante.
2. `posible-nota.txt`: cómo valora los criterios de la rúbrica para proponer la nota.
3. `aciertos-y-mejoras.txt`: cómo comenta qué hizo bien y qué debe mejorar.
4. `comprension-del-tema.txt`: cómo evalúa y comenta la comprensión.
5. `indicadores.txt`: cómo considera pensamiento crítico, autonomía y autenticidad.

Los archivos de esta carpeta sirven como ejemplos. No necesitan encabezados, campos de configuración ni sintaxis Markdown. Cada texto admite hasta 5000 caracteres. Cargar un archivo solo cambia el punto seleccionado; pulsa **Guardar instrucciones** para aplicar los cambios.

El panel utiliza el modelo `default`, que toma `AI_MODEL` del servidor. La activación y las instrucciones generales se conservan desde la configuración guardada. Las instrucciones de cada punto se envían al motor con su nombre y guían la respuesta correspondiente en el mismo análisis. La posible nota sigue calculándose a partir de los niveles sugeridos por criterio. Las instrucciones de indicadores orientan las justificaciones y comentarios de los criterios aplicables; no crean nuevas métricas numéricas.

La configuración se guarda en la base de datos y solo administradores pueden cambiarla. Afecta a próximos análisis, sin modificar resultados anteriores. La migración `1791244800000-add-ai-stage-instructions` incorpora los cinco textos para PostgreSQL; SQLite usa la sincronización existente.

## Cambiar la API key desde el panel

En **API key del motor de IA**, escribe la nueva clave y pulsa **Guardar API key**. Se guarda cifrada con AES-256-GCM en la base de datos y se utiliza en próximos análisis, con prioridad sobre `AI_API_KEY` del servidor. El campo se vacía al guardar y las respuestas de la API nunca incluyen la clave ni su contenido cifrado. La actualización es independiente de los cinco textos de instrucciones.

## Actualización automática de la variable en Vercel

Al guardar la API key, el backend primero la guarda cifrada para aplicarla inmediatamente. Después actualiza `AI_API_KEY` del entorno **Production** del proyecto backend mediante la API oficial de Vercel y solicita un despliegue con su Deploy Hook. El panel muestra un indicador de carga durante la operación y una confirmación breve de guardado; esa confirmación se refiere a la clave guardada, sin afirmar que el despliegue haya terminado.

Configura una vez estas variables en el proyecto **teach-trace-backend**, sin prefijos `VITE_` y sin ponerlas en el frontend:

```env
VERCEL_AI_SYNC_ENABLED=true
VERCEL_API_TOKEN=<token-de-vercel-con-permisos-sobre-el-proyecto>
VERCEL_AI_PROJECT_ID=prj_4KnO7AP6pSmNHINRo7fzuqamYo5R
VERCEL_AI_TEAM_ID=team_Huezgmr5paBZvsktGGx7u5i6
VERCEL_AI_DEPLOY_HOOK_URL=<deploy-hook-del-backend>
```

El proyecto backend debe estar conectado a su repositorio Git. En Vercel, abre **Settings → Git → Deploy Hooks** y crea el hook asociado a la rama de producción. El hook despliega el último commit de esa rama: asegúrate de que sea la rama que publicas en producción. El backend verifica que el hook pertenece al mismo proyecto configurado y solo envía la nueva clave a la API oficial de Vercel. No modifica variables de Preview ni del proyecto frontend. La integración no se ejecuta desde despliegues Preview.

Haz un despliegue inicial para aplicar esta configuración y el código del panel. A partir de entonces, **Guardar API key** actualiza la variable y solicita el despliegue automáticamente. Si falta la configuración, el panel explica que la clave se guardó y la actualización automática no está disponible. Si falla la actualización automática, muestra un mensaje de error y ofrece **Reintentar actualización**, usando la clave cifrada ya guardada. El reintento aparece únicamente tras un fallo. Cada operación espera hasta diez segundos; no reintenta despliegues por su cuenta tras un timeout.

El token y el hook permanecen exclusivamente en el servidor y no se devuelven al navegador. Puedes revisar el avance del despliegue en Vercel. El respaldo `AI_API_KEY` del servidor queda actualizado cuando termina el nuevo despliegue.

Referencias oficiales: [actualizar variables con upsert](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables), [crear y ejecutar Deploy Hooks](https://vercel.com/docs/deploy-hooks) y [aplicar cambios de variables mediante un nuevo despliegue](https://vercel.com/docs/deployments/managing-deployments).

El motor utiliza la última clave guardada en el panel. Los errores de esa clave se gestionan como fallos del análisis y requieren revisión manual; no provocan que el motor vuelva automáticamente a una clave anterior. `AI_API_KEY` del servidor se utiliza cuando todavía no hay una clave guardada desde el panel.

El servidor puede definir un secreto estable `AI_SETTINGS_ENCRYPTION_KEY` de al menos 32 caracteres. Si no está definido, se usa `JWT_SECRET` para derivar la clave de cifrado. Si cambia el secreto usado para cifrar, el administrador debe volver a guardar la API key. La URL del proveedor continúa en `AI_API_URL`.

Antes de guardar una API key, el servidor exige entre 20 y 4096 caracteres imprimibles sin espacios interiores y comprueba que Gemini la reconoce mediante una consulta autenticada a `models.list`, con un límite de diez segundos. Se admiten las claves estándar y las nuevas claves de autorización; el prefijo por sí solo no demuestra su validez. Si la clave es inválida, está revocada, carece de permisos o no puede verificarse, se conserva la clave actual y no se solicita ninguna actualización automática. El reintento también verifica la clave guardada antes de enviarla. El panel muestra un indicador de verificación y un mensaje de error cuando falla.

La comprobación no genera contenido ni garantiza saldo o cuota para futuros análisis. El validador corresponde al proveedor actual (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`); para cambiar de proveedor hay que implementar su comprobación autenticada antes de admitir nuevas claves. No se aceptan respuestas de endpoints públicos como prueba de validez. Referencias: [claves de Gemini](https://ai.google.dev/gemini-api/docs/api-key) y [consulta de modelos](https://ai.google.dev/api/models).

PostgreSQL incorpora la columna cifrada mediante `1791331200000-add-ai-api-key`; SQLite usa la sincronización existente.

## Compatibilidad con la configuración anterior

La API anterior sigue admitiendo la configuración global `.md` y conserva los textos de los cinco puntos. La siguiente información describe ese formato anterior:

Usa `motor-ia-actividades.md` de esta carpeta como plantilla. El bloque inicial admite exactamente dos campos:

```md
---
model: default
enabled: true
---
# Instrucciones
Evalúa con evidencia y respeta la rúbrica de la actividad.
```

- `model: default` utiliza `AI_MODEL` del servidor. Puedes reemplazar `default` por el identificador exacto de un modelo admitido por el proveedor configurado. El identificador se escribe sin comillas.
- `enabled: false` desactiva las llamadas al proveedor para nuevos análisis y mantiene la evaluación manual.
- El cuerpo Markdown contiene instrucciones generales que complementan las instrucciones del docente; las reglas de evaluación y el esquema JSON del motor siguen vigentes.

Los cambios se aplican al guardar y afectan a próximos análisis, sin modificar evaluaciones anteriores ni llamadas ya iniciadas. La configuración se conserva en la base de datos, incluso en entornos serverless. El límite es de 20000 caracteres.

Solo administradores pueden consultar o cambiar esta configuración. La API key se configura mediante el campo dedicado del panel o `AI_API_KEY` del servidor. La URL sigue en `AI_API_URL`. No incluyas credenciales en los textos de instrucciones. Guardar el archivo Markdown valida su formato, pero no comprueba la disponibilidad del modelo en el proveedor.

PostgreSQL crea la tabla mediante la migración `1791158400000-add-ai-engine-settings`; SQLite utiliza la sincronización de entidades existente.
