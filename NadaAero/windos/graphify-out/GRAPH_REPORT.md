# Graph Report - NadaAero/windos  (2026-10-24)

## Corpus Check
- Corpus is ~41,648 words - fits in a single context window. You may not need a graph.

## Summary
- 452 nodes · 986 edges · 22 communities detected
- Extraction: 44% EXTRACTED · 56% INFERRED · 0% AMBIGUOUS · INFERRED: 550 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Core` - 59 edges
2. `Api` - 56 edges
3. `t_on()` - 11 edges
4. `clean_profile()` - 11 edges
5. `isBot()` - 9 edges
6. `person()` - 9 edges
7. `select()` - 9 edges
8. `renderCenter()` - 9 edges
9. `callSig()` - 9 edges
10. `endCall()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Estado: version 2.5.1 sin publicar` --conceptually_related_to--> `Actualizaciones firmadas`  [INFERRED]
  NadaAero\windos\Memory.md → NadaAero\windos\ESPECIFICACIONES.md
- `Memory Wind OS Messenger` --references--> `Especificaciones Wind OS Messenger`  [EXTRACTED]
  NadaAero\windos\Memory.md → NadaAero\windos\ESPECIFICACIONES.md

## Communities

### Community 0 - "Core Account Engine"
Cohesion: 0.05
Nodes (32): Api, _check_new(), clean_avatar(), clean_profile(), clean_settings(), code_for(), data_dir(), free_port() (+24 more)

### Community 1 - "Core Messaging Operations"
Cohesion: 0.09
Nodes (7): clean_att(), Core, pretty(), t_in(), t_on(), t_x(), verify()

### Community 2 - "Main App UI"
Cohesion: 0.08
Nodes (40): applySettings(), botReply(), closeEditor(), contactRow(), custom(), edRefresh(), edTab(), group() (+32 more)

### Community 3 - "Forums"
Cohesion: 0.14
Nodes (25): addPost(), ago(), dateTime(), dirCard(), fidOf(), findPrivate(), fmatch(), forumIcon() (+17 more)

### Community 4 - "Release Publishing"
Cohesion: 0.15
Nodes (19): build(), generate_key(), set_in_file(), version_file(), canon(), channel(), check_manifest(), cleanup_old() (+11 more)

### Community 5 - "Home Feed"
Cohesion: 0.13
Nodes (19): addComment(), commentHtml(), composerCard(), homeTitle(), isHome(), mediaGrid(), observePosts(), onHomeEvent() (+11 more)

### Community 6 - "Web Server"
Cohesion: 0.15
Nodes (16): api_call(), download(), events(), files(), get_session(), _index_path(), _janitor(), _known_folder() (+8 more)

### Community 7 - "Shared UI Utilities"
Cohesion: 0.14
Nodes (17): actHtml(), actText(), api(), applyTheme(), avatarHtml(), avatarSrc(), dialog(), emoImg() (+9 more)

### Community 8 - "WebRTC Calls"
Cohesion: 0.27
Nodes (20): acceptCall(), callSig(), declineCall(), endCall(), fmtDur(), getMic(), handleSignal(), hangup() (+12 more)

### Community 9 - "Project Specifications"
Cohesion: 0.13
Nodes (17): Actualizaciones firmadas, Compilar y publicar, Datos locales datos.json, Foros publicos y privados, Identidad WIND-XXXX-XXXX (Curve25519), Inicio (feed), Limites de adjuntos y sesiones, Llamadas WebRTC P2P (+9 more)

### Community 10 - "Attachments and Media"
Cohesion: 0.17
Nodes (6): attHtml(), blobsToAtts(), blobToB64(), fetchForumAtt(), fmtSize(), openViewer()

### Community 11 - "Desktop Notifications and Files"
Cohesion: 0.22
Nodes (1): ToastApi

### Community 12 - "Media Player"
Cohesion: 0.38
Nodes (3): fmtT(), mediaOf(), wmpUpdate()

### Community 13 - "Shorts Video"
Cohesion: 0.53
Nodes (5): observeShorts(), renderShorts(), shortHtml(), shortsAttReady(), shortVideo()

### Community 14 - "Web Bridge Shim"
Cohesion: 0.33
Nodes (0): 

### Community 15 - "Authentication"
Cohesion: 0.4
Nodes (0): 

### Community 16 - "XEdDSA Signatures"
Cohesion: 0.6
Nodes (3): _clamp(), _h(), sign()

### Community 17 - "Translation i18n"
Cohesion: 1.0
Nodes (3): setLang(), tr(), trNode()

### Community 18 - "Window Manager"
Cohesion: 0.67
Nodes (2): dockAdd(), dockRemove()

### Community 19 - "Activity Presence"
Cohesion: 1.0
Nodes (2): current(), _foreground()

### Community 20 - "Threaded HTTP Server"
Cohesion: 0.67
Nodes (3): ThreadingMixIn, _ThreadingWSGI, WSGIServer

### Community 21 - "HTTP Request Handler"
Cohesion: 0.67
Nodes (2): _QuietHandler, WSGIRequestHandler

## Ambiguous Edges - Review These
- `Regla ahorro de tokens (subagentes Haiku/Fable)` → `graspologic no instala en Python 3.13`  [AMBIGUOUS]
  NadaAero\windos\Memory.md · relation: conceptually_related_to

## Knowledge Gaps
- **8 isolated node(s):** `Foros publicos y privados`, `Inicio (feed)`, `Llamadas WebRTC P2P`, `Limites de adjuntos y sesiones`, `Perfiles de prueba pruebaX y canal prueba` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Regla ahorro de tokens (subagentes Haiku/Fable)` and `graspologic no instala en Python 3.13`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Core` connect `Core Messaging Operations` to `Core Account Engine`, `Desktop Notifications and Files`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `Api` connect `Core Account Engine` to `Core Messaging Operations`, `Desktop Notifications and Files`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `ToastApi` connect `Desktop Notifications and Files` to `Core Account Engine`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `t_on()` (e.g. with `.stop()` and `._net_loop()`) actually correct?**
  _`t_on()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `clean_profile()` (e.g. with `clean_avatar()` and `.__init__()`) actually correct?**
  _`clean_profile()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `isBot()` (e.g. with `person()` and `statusOf()`) actually correct?**
  _`isBot()` has 8 INFERRED edges - model-reasoned connections that need verification._