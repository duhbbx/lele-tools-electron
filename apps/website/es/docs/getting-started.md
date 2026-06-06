# Primeros pasos

## Instalación

Ve a la página de [Descargar](/es/download) para obtener el instalador para tu plataforma y luego sigue los pasos a continuación.

- **Windows**: Haz doble clic en el instalador `.exe` y sigue el asistente.
- **macOS**: Abre el `.dmg`, arrastra la app a tu carpeta Aplicaciones. Si macOS dice que la app está "dañada", consulta las [Preguntas frecuentes](/es/docs/faq).
- **Linux**: Instala mediante el paquete `.deb` / `.rpm`, o ejecuta directamente el `.AppImage`.

¿Aún no hay versión oficial? Consulta [Compilar desde el código fuente](/es/download#compilar-desde-el-código-fuente) para compilarla tú mismo.

## Diseño de la interfaz

La app se divide en tres áreas:

**Panel lateral izquierdo**: Lista todas las herramientas con una barra de búsqueda por palabras clave; las herramientas usadas recientemente aparecen al final. Haz clic en cualquier herramienta para abrirla en una pestaña a la derecha.

**Área de múltiples pestañas a la derecha**: Cada herramienta tiene su propia pestaña. Abre tantas como quieras — no se interfieren entre sí. Al cerrar una pestaña se conserva el contenido no guardado (se restaura cuando vuelves a abrir la herramienta).

**Panel de IA**: Haz clic en el icono de IA en la esquina superior derecha para expandir el panel lateral. Disponible desde cualquier herramienta — pega contenido y haz preguntas directamente. El historial de conversaciones se guarda automáticamente en la base de datos local.

## Configurar el asistente de IA

Debes configurar un proveedor antes de usar el asistente de IA por primera vez:

1. Haz clic en el icono de **Configuración** en la barra de herramientas superior derecha (o presiona `Ctrl/Cmd + ,`).
2. Ve a la pestaña **Asistente de IA** y elige un proveedor:

| Proveedor | Requiere API Key |
|-----------|-----------------|
| Claude (Anthropic) | Sí |
| OpenAI | Sí |
| DeepSeek | Sí |
| Codex (OpenAI Codex) | Sí |
| Grok (xAI) | Sí |
| Ollama (local) | No — solo configura la BaseURL |

3. Ingresa tu API Key (para Ollama, ingresa la dirección local — por defecto `http://localhost:11434`), luego haz clic en **Probar conexión** para verificar.
4. Guarda y cierra la Configuración. El panel de IA ya está listo para usar.

> **Nota para usuarios que necesitan proxy:** OpenAI, Claude y Grok solo son accesibles con un proxy desde algunas regiones. DeepSeek y Ollama (local) funcionan sin uno.

## Para desarrolladores: agregar una nueva herramienta

Tres pasos:

**Paso 1**: Crea `meta.ts` y `Tool.vue` en `packages/ui/src/tools/<id>/`:

```ts
// packages/ui/src/tools/my-tool/meta.ts
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'my-tool',
  name: { zh: '我的工具', en: 'My Tool' },
  desc: { zh: '工具简介', en: 'Tool description' },
  category: 'misc',
  keywords: ['my-tool'],
  icon: '🔧',
  load: () => import('./Tool.vue'),
}
```

**Paso 2**: Regístrala al final del array `TOOLS` en `packages/ui/src/tools/index.ts`:

```ts
import { meta as myTool } from './my-tool/meta'

export const TOOLS: ToolMeta[] = [
  // ...herramientas existentes
  myTool,
]
```

**Paso 3**: Ejecuta `pnpm dev` — la nueva herramienta aparece en el panel izquierdo de inmediato.
