# Preguntas frecuentes

## Instalación y lanzamiento

### macOS dice que la app está "dañada" o "no se puede abrir"

La app no ha pasado por la notarización de Apple (la notarización cuesta $99/año — no vale la pena para un proyecto de código abierto). Ejecuta esto una vez en la Terminal para borrar el indicador de cuarentena:

```bash
xattr -dr com.apple.quarantine "/Applications/Lele Tools.app"
```

Alternativamente: haz clic derecho en la app → Abrir → Abrir de todas formas. Este es un paso único; después puedes iniciarla normalmente haciendo doble clic.

### Error al iniciar en Linux

Los paquetes `.deb` / `.rpm` declaran sus dependencias, por lo que una instalación normal con el gestor de paquetes las instalará automáticamente. Si instalaste manualmente y ves un error de biblioteca faltante, instala el paquete del sistema indicado. El AppImage incluye su propio entorno de ejecución y no necesita dependencias adicionales.

## Asistente de IA

### La IA no conecta / las solicitudes fallan

Sigue estos pasos en orden:

1. **Verifica tu API Key**: ve a Configuración → Asistente de IA y asegúrate de que la clave esté completa — sin espacios extra ni caracteres faltantes.
2. **Verifica la BaseURL**: si usas un endpoint personalizado, confirma que no tenga barra diagonal al final y que la dirección sea accesible.
3. **Proxy de red**: OpenAI, Claude y Grok requieren un proxy desde algunas regiones. DeepSeek y Ollama (local) funcionan sin uno.
4. **Probar conexión**: usa el botón "Probar conexión" en la página de configuración para ver el error exacto.
5. **Ollama**: asegúrate de que el servicio local de Ollama esté en ejecución (por defecto `http://localhost:11434`) y de que hayas descargado el modelo que deseas usar (`ollama pull <modelo>`).

## Datos y privacidad

### ¿Dónde se almacenan mis datos?

Todo se almacena en una base de datos SQLite local:

- **macOS**: `~/Library/Application Support/Lele Tools/lele.db`
- **Windows**: `%APPDATA%\Lele Tools\lele.db`
- **Linux**: `~/.config/Lele Tools/lele.db`

Haz una copia de seguridad de este archivo para migrar a otro equipo.

### ¿La app sube algo?

**No.** Todas las funciones se ejecutan localmente. La app no recopila ningún dato de usuario. Las solicitudes de IA van directamente desde el proceso principal de Electron al proveedor que configuraste — sin servidor intermediario.

## Sobre este proyecto

### ¿Por qué reescribir en Electron y dejar atrás la versión Qt?

La versión Qt ([lele-tools](https://github.com/duhbbx/lele-tools)) ha crecido hasta más de 50 herramientas, pero a medida que aumentó la cantidad, también creció la carga de mantenimiento en C++/Qt — entornos de compilación, empaquetado multiplataforma, mantener la UI consistente. El stack web Electron + Vue 3 hace el desarrollo de UI más rápido, la reutilización de componentes más sencilla y la integración de IA (SSE en streaming, SDKs de múltiples proveedores) completamente natural. La edición Electron empieza desde cero y gradualmente alcanzará a la versión Qt en cantidad de herramientas.

### Quiero agregar una herramienta o corregir un bug — ¿cómo contribuyo?

1. Haz un fork del [repositorio](https://github.com/duhbbx/lele-tools-electron)
2. Lee [Primeros pasos → Para desarrolladores: agregar una nueva herramienta](/es/docs/getting-started#para-desarrolladores-agregar-una-nueva-herramienta) para el resumen de la arquitectura
3. Abre un Pull Request

Los reportes de bugs y solicitudes de funciones son bienvenidos mediante [GitHub Issues](https://github.com/duhbbx/lele-tools-electron/issues).
