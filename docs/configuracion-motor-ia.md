# Configurar el motor de IA de actividades

En el panel de administración, la sección **Actividades → Motor de IA** permite cargar, editar, descargar y guardar un archivo `.md`.

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

Solo administradores pueden consultar o cambiar esta configuración. Las credenciales y la URL del proveedor siguen en `AI_API_KEY` y `AI_API_URL` del servidor; no deben incluirse en el archivo Markdown. Guardar valida el formato, pero no comprueba la disponibilidad del modelo en el proveedor.

PostgreSQL crea la tabla mediante la migración `1791158400000-add-ai-engine-settings`; SQLite utiliza la sincronización de entidades existente.
