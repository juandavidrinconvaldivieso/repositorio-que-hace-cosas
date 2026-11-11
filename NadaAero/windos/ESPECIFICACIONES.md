# Especificaciones — Wind OS Messenger 2.5.x

## ⚠ Cómo explorar el código: usa el GRAFO, no leas carpetas
- Graphify está instalado (skill `/graphify`, código en `tools/graphify_src`, adaptado para no usar graspologic en Python 3.13).
- Grafo del proyecto: `NadaAero/windos/graphify-out/` (`GRAPH_REPORT.md`, `graph.json`, `wiki/index.md`).
- **Antes de abrir archivos**, consulta el grafo: `/graphify query "..."`, `/graphify explain "Nombre"`, `/graphify path "A" "B"`. Abre solo las líneas concretas que te indique.
- Si no existe el grafo: `/graphify NadaAero/windos --wiki`. Tras cambiar código: `/graphify NadaAero/windos --update` (solo procesa lo que cambió).
- Para delegar el trabajo de graphify, usa un subagente Haiku.

App de mensajería estilo Windows 7 Aero / MSN para Windows (.exe con PyInstaller + pywebview/WebView2), más una versión web.

## Archivos (carpeta `NadaAero/windos`)
| Archivo | Qué hace |
|---|---|
| `windos.py` | Núcleo. `Core` = una cuenta conectada (MQTT, cifrado, chats, adjuntos, foros, Inicio, gustos). `Api` = lo que llama la interfaz. `Store` = `datos.json`. Arranque: `--perfil X`, `--web [puerto]`, `--canal X`. |
| `websrv.py` | Versión web (bottle): `/api` (POST `{m,a}`), `/events` (SSE), `/upload`, `/files`, `/download`. Una sesión (cookie `wsid`) = un `Core`. Bloquea los métodos de escritorio (`DESKTOP_ONLY`). |
| `updater.py` | Actualizaciones: `VERSION`, `UPDATE_PK` (clave pública Ed25519), manifiesto firmado + trozos de 128 KB. Instala al cerrar o con «Reiniciar ahora». |
| `publicar_actualizacion.py` | Herramienta del desarrollador: `--generar-clave`, `--solo-compilar`, `X.Y.Z "notas" [--canal prueba]`. Contiene la lista `DATA` de archivos que se empaquetan. |
| `xsign.py` | Firmas XEdDSA con la misma clave X25519 del código WIND. |
| `main.html` | Interfaz (HTML + CSS propio). Carga los scripts en este orden: `i18n, retro, common, bots, player, media, calls, forums, home, shorts, auth, wm, app`. |
| `aero.css` / `skins.css` / `mobile.css` | Estilo Aero + reproductor + ventanas / estilos Discord e Instagram / teléfono (≤760 px). |
| `common.js` | Utilidades, emoticonos (`fmt`), temas (`applyTheme`), sonidos, `dialog()`. |
| `retro.js` | Todos los gráficos en SVG: emoticonos, iconos, 26 avatares, 18 stickers. Sin emojis del sistema. |
| `app.js` | Ventana principal: perfil, contactos, chat, panel derecho, editor, eventos de Python (`onEvent`), menús, navegación del teléfono. |
| `home.js` / `shorts.js` | Inicio (publicaciones, me gusta, comentarios, sugerencias) / Cortos (vídeo vertical). |
| `forums.js` | Foros públicos y privados, temas, respuestas. |
| `calls.js` | Llamadas WebRTC (negociación perfecta, compartir pantalla, TURN opcional). |
| `media.js` / `player.js` | Adjuntos, notas de voz, selector de emoticonos y stickers / reproductor estilo WMP11. |
| `auth.js` | Iniciar sesión, crear cuenta, cambiar contraseña, cerrar sesión. |
| `wm.js` | Ventanas internas que se mueven, se minimizan (barra inferior) y se maximizan. |
| `i18n.js` | Traducción al inglés en tiempo real (diccionario `EN` + patrones `EN_PAT`, `MutationObserver`). Lo que escribe la gente se excluye con `NO_I18N`. |
| `webshim.js` | En la web sustituye a pywebview (`window.WEBAPI`), sube archivos y recibe eventos. |
| `toast.html` | Notificación de escritorio (ventana aparte). |
| `bots.js` | Bot local «Nada». |

## Protocolo (MQTT, prefijo `windosmsgr/v1/`)
- Identidad: clave Curve25519. Código `WIND-XXXX-XXXX` = base32(sha256(pk))[:8].
- `<code>/key` (pk, retenido), `<code>/on` (presencia, retenido), `<code>/in` (mensajes NaCl Box), `<code>/x/<att>/<i>` (trozos de adjuntos).
- Cuentas: `acct/<hash(user)>` = copia de la cuenta cifrada con Argon2id(contraseña); `user/<hash>` = usuario → código (firmado).
- Foros: `fdir/<fid>` (directorio público), `fpriv/<hash(nombre)>`, `f/<fid>/m|t|r|a` (SecretBox con clave derivada del fid; publicaciones firmadas).
- Inicio: `feed/p/<pid>`, `feed/a/<att>/<i>`, `feed/l/<pid>/<code>`, `feed/c/<pid>/<cid>` (clave común `FEED_KEY`, firmado).
- Actualizaciones: `update/<canal>/manifest` y `update/<canal>/bin/<ver>/<i>`.
- Llamadas: la señalización va por `in` (`{"t":"rtc"}`); el audio y la pantalla van P2P por WebRTC.

## Datos locales
`%APPDATA%\WindOSMessenger\<perfil>\datos.json` (+ `archivos/`). `web\` = sesiones de la versión web. `actualizacion\` = actualización descargada. `desarrollador\` = clave de firma.

## Compilar y publicar
- Solo compilar: `python publicar_actualizacion.py --solo-compilar` → `dist\Wind OS Messenger.exe`.
- Publicar (lo hace el usuario): `python publicar_actualizacion.py X.Y.Z "notas"`.
- Si se añade un archivo de interfaz nuevo: añadirlo a `DATA` (en `publicar_actualizacion.py`) y a `PUBLIC_FILES` (en `websrv.py`).

## Límites
Archivo de 20 MB por adjunto, 60 MB por publicación, hasta 10 fotos o vídeos por publicación, publicaciones de Inicio durante 60 días, 40 sesiones web como máximo.
