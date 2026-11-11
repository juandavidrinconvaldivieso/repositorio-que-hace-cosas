# Memory — Wind OS Messenger (máx. 60 líneas)

Léelo al empezar. Para el código, consulta el grafo (ver `ESPECIFICACIONES.md`), no leas carpetas.

## Reglas permanentes del usuario
- AHORRO DE TOKENS: subagentes solo **Haiku** (simple) o **Fable** (programación). **Sonnet** solo si es
  EXTREMADAMENTE necesario y avisando. Nunca Opus. El modelo principal lo elige el usuario con `/model`.
- El ahorro es SOLO eligiendo modelos. NO recortar explicaciones, pruebas ni calidad. Respuestas en español,
  claras y completas (al usuario le molestó que fueran demasiado escuetas).
- Publicar actualizaciones al canal real lo hace EL USUARIO (Claude no tiene permiso): dale el comando.
- Probar con `--perfil pruebaX` y `--canal prueba`; al acabar, borrar todo (disco y servidor).
- No tocar la cuenta real: `%APPDATA%\WindOSMessenger\principal`.

## Resumen del proyecto
Nada.exe → Nada Messenger → **Wind OS Messenger** (`NadaAero/windos`): mensajería estilo Windows 7 / MSN.
Python + pywebview (.exe con PyInstaller) y versión web (`websrv.py`). Servidor MQTT público
`broker.hivemq.com`, prefijo `windosmsgr/v1/`, todo cifrado y firmado.
- Contactos por código WIND o usuario; cuentas con contraseña (copia cifrada en el servidor).
- Chats con archivos, stickers y notas de voz; reproductor estilo WMP; llamadas WebRTC con pantalla compartida.
- Foros públicos y privados (búsqueda sin tildes; privados solo por nombre completo o código).
- Inicio tipo Instagram con recomendaciones locales; Cortos; perfil con la app en uso («Jugando a…», `activity.py`).
- Ventanas internas que se mueven y minimizan; temas Aero/Discord/Instagram; versión para teléfono.
- Actualización automática firmada (`updater.py` + `publicar_actualizacion.py`). Idioma ES/EN (`i18n.js`).
- Versión web compartible: Archivo › Versión web → enlace https de Cloudflare (`websrv.tunnel()`).

## Estado actual (2026-10-24)
- `.exe` instalado: **2.5.0**. **2.5.1 lista pero SIN PUBLICAR** (todo lo de inglés, actividad, foros y enlace web).
  Publicar (en `NadaAero\windos`): `python publicar_actualizacion.py 2.5.1 "Inglés, actividad, foros y enlace web"`
  Probar sin publicar: `python windos.py` (usa la cuenta real del usuario).
- Foros privados antiguos BORRADOS del servidor; la app purga los anteriores a `PRIV_CUTOFF`. Queda el público «all».
- cloudflared.exe se descarga a `%APPDATA%\WindOSMessenger\bin`. CLI: `windos.py --web 8765 --publico`.
- Clave de firma: `%APPDATA%\WindOSMessenger\desarrollador\clave_actualizaciones.key` (con copia de seguridad).
- **Grafo generado** (2026-10-24): `NadaAero/windos/graphify-out/` (452 nodos, 986 aristas, 22 comunidades;
  `GRAPH_REPORT.md`, `graph.json`, `graph.html`, `wiki/index.md`). God nodes: `Core`, `Api` (windos.py).
  El código solo tiene extracción AST. Tras cambiar código: `/graphify NadaAero/windos --update`.

## Pendientes para la próxima sesión
1. El usuario publica la 2.5.1 (o lo autoriza) y comprueba que su app se actualiza.
2. Revisar la traducción al inglés en llamadas y foros con contenido (no probado).
3. Probar la versión web (enlace de Cloudflare) en un teléfono real.
4. Opcional: certificado de firma de código (SmartScreen) y servidor TURN propio para las llamadas.

## Problemas ya resueltos (no repetir)
- Notificación con rectángulo negro → se crea oculta y se muestra tras `events.loaded` (sin rAF).
- Reinicio de un .exe de PyInstaller → `updater.relaunch()` con `PYINSTALLER_RESET_ENVIRONMENT=1`.
- Permiso de micrófono de WebView2 escondido → `allow_media_permissions()`.
- `.small` chocaba con `.btn.small` → `.small:not(.btn):not(.bigbtn)`.
- PowerShell `Set-Content -Encoding utf8` añade BOM → escribir con Python o `UTF8Encoding($false)`.
- graspologic no instala en Python 3.13 → `cluster.py` de graphify usa Louvain de networkx.
- `i18n`: no traduce dentro de `NO_I18N` (contenido de usuarios); textos con variables en `EN_PAT`.
- Cloudflare: la URL buena lleva guiones (no coger `api.trycloudflare.com` del registro).
- Los subagentes no pueden lanzar otros subagentes: la parte semántica de graphify la hace el propio Haiku.
