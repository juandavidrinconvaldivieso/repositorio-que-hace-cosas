# W. Walkman Aero (dual ESP32) — Memoria

Referencia visual: `D:\DATOS\Downloads\simulador_walkman_esp32_ili9341.html` (coordenadas 320x240 copiadas de ahí).
Documentación completa (pinout, arquitectura, protocolo UART, vídeo, librerías): `README.md`.

## Estado actual
- v1 escrita (2026-11-09). **#1 compila** en IDE 2 / core 3.3.7 (~1,5 MB flash, 69 KB RAM global) → exige Partition Scheme "Huge APP". Aún sin probar en hardware.
- Adaptado a core ESP32 **3.3.7** (el instalado): #2 con `i2s_std`, backlight con `ledcAttach`.
- Librerías clonadas (2026-11-09) en `D:\DATOS\Documents\Arduino\libraries`: audio-tools, libhelix, libflac, libvorbis-tremor, ESP32-A2DP, JPEGDEC, TFT_eSPI (Bodmer, ya apuntando a User_Setup_Walkman.h), **codec-ogg** (pschatzmann; la necesitan libflac y tremor; "arduino-libogg" no existe). Firmas de API revisadas: coinciden.
- El usuario compila con **Arduino IDE 1.8.19 (Windows Store)** → core ESP32 **3.0.5** en `D:\DATOS\Documents\ArduinoData` (GCC 12). La 3.3.7 de AppData es del IDE 2.
- Decisión (2026-11-09): compilar en **Arduino IDE 2 con core 3.3.7** (ya instalada). La 3.3.12 no baja: GitHub corta las descargas del IDE (~2,4 GB).
- audio-tools fijada en tag **v1.3.0** + parche local en `AudioBasic/Format.h` (`__has_include(<format>)`), porque GCC 12 no trae `<format>`.
- ESP32 del usuario detectado en COM14 (CH340, ESP32-D0WD-V3). COM15 es una pantalla USB, no un ESP32.
- ESP32 #2 completo: `ESP32_2_BT_Bridge/` (I2S Slave RX → ring 32 KB → A2DP Source, UART2).
- ESP32 #1 modular: `ESP32_1_Walkman/` (ver README §3).
- Vídeo: MJPEG 320x180 + audio hermano .mp3/.wav + .srt, categoría "Videos" en el menú.
- Grabación Spotify→SD: estructura hecha, `FEATURE_SPOTIFY_RECORD 0`.

- SD: se usa la **ranura de la pantalla** (pines SD_* → 14/13/27/15), no módulo aparte.
- Alimentación elegida (2026-11-10): 2×18650 paralelo → TP4056 USB-C protegido → KCD11 → **MT3608 a 5 V** → VIN de ambos ESP32, pantalla (J1 abierto) y DAC. Diagrama: https://claude.ai/artifact/R5h75EWB2EVudFTqVqHfvy

## Decisiones
- Salida siempre 44.1k/16/estéreo (resample en #1) → el #2 no se reconfigura nunca.
- Un solo bus I2S del #1 alimenta DAC y #2 en paralelo.
- MISO de la SD en GPIO27 (no GPIO12, pin de arranque). UART #1: TX33/RX35.
- UI: render por franjas 320x24 con alfa real; solo taskUI toca TFT/táctil.
- AVRCP no lista playlists del móvil: "Guardar SD" usa álbumes vistos por metadatos.

## Pendientes
- Compilar ambos sketches y corregir diferencias de API (AudioTools / ESP32-A2DP según versión).
- Medir fps reales de vídeo y heap libre con BT activo.
- Seek en FLAC/OGG; duración real de MP3 (ahora estimada a 192 kbps).

## Problemas ya resueltos
- (ninguno todavía)
