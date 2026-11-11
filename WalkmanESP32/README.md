# W. Walkman Aero — Firmware dual ESP32 (ILI9341 2.8" táctil)

Reproductor portátil estilo Sony Walkman + Frutiger Aero sobre **dos ESP32-WROOM-32 clásicos** (sin PSRAM).

| Placa | Rol |
|---|---|
| **ESP32 #1** "Walkman" | Pantalla + táctil, MicroSD (MP3/WAV/FLAC/OGG + .LRC), **vídeo MJPEG**, A2DP Sink (Spotify desde el teléfono), DSP Biquad 3 bandas, I2S Master |
| **ESP32 #2** "BT Bridge" | I2S Slave RX → A2DP Source hacia audífonos Bluetooth, controlado por UART |

Simulador visual de referencia: `simulador_walkman_esp32_ili9341.html` (las coordenadas del firmware salen de ahí).

---

## 1. Pinout completo

### ESP32 #1 (Walkman)

| Función | Señal | GPIO | Notas |
|---|---|---|---|
| **VSPI – ILI9341** | SCK | 18 | Bus compartido TFT + táctil (IO_MUX nativo, 40 MHz) |
| | MOSI (SDI) | 23 | |
| | MISO (SDO) | 19 | También T_DO del táctil |
| | TFT_CS | 5 | |
| | TFT_DC (D/C) | 16 | |
| | TFT_RST | 17 | (o a EN si quieres liberar el pin) |
| | TFT_LED (retroiluminación) | 32 | PWM LEDC, vía transistor si el módulo consume >20 mA |
| **VSPI – XPT2046 táctil** | T_CLK / T_DIN / T_DO | 18 / 23 / 19 | Mismo bus que el TFT |
| | T_CS | 4 | |
| | T_IRQ | 36 (VP) | Solo entrada, opcional |
| **HSPI – ranura SD de la pantalla** | SD_SCK | 14 | Tira de 4 pines SD_* del módulo. Bus dedicado: el vídeo lee la SD mientras la DMA pinta la pantalla |
| | SD_MOSI | 13 | **No** unir con SDI/SCK/SDO de la pantalla |
| | SD_MISO | 27 | **No** uso GPIO12 (pin de arranque: con pull-up de la SD el ESP32 no arranca) |
| | SD_CS | 15 | Alimentación: la toma del VCC/GND de la pantalla |
| **I2S0 Master (salida)** | BCK (bit clock) | 26 | Va al PCM5102A **y** al ESP32 #2 en paralelo |
| | WS / LRCK | 25 | Ídem |
| | DOUT (data) | 22 | Ídem |
| **UART2 (Serial2) → ESP32 #2** | TX | 33 | → RX (GPIO16) del #2 |
| | RX | 35 | ← TX (GPIO17) del #2 (35 es solo entrada, perfecto para RX) |
| **Varios** | Batería (divisor 100k/100k) | 34 | ADC1, solo entrada |
| | Interruptor HOLD (opcional) | 21 | INPUT_PULLUP · pulsado al arrancar = recalibrar táctil |
| | Mute del jack (opcional) | 2 → XSMT | Desactivado por defecto (`PIN_DAC_MUTE -1`); si lo usas, quita el puente XSMT→3.3 V |

### PCM5102A (DAC → Jack 3.5 mm)

| Pin módulo | Conexión |
|---|---|
| VIN | 3.3 V (o 5 V si el módulo trae regulador) |
| GND | GND |
| BCK | GPIO26 (#1) |
| LRCK (LCK) | GPIO25 (#1) |
| DIN | GPIO22 (#1) |
| SCK | **GND** (el PCM5102A genera su reloj con PLL interno) |
| FMT | GND (formato I2S) |
| FLT / DEMP | GND |
| XSMT | 3.3 V (sin mute) |

### ESP32 #2 (BT Bridge)

| Función | Señal | GPIO | Conectar a |
|---|---|---|---|
| **I2S0 Slave RX** | BCK | 26 | GPIO26 del #1 |
| | WS | 25 | GPIO25 del #1 |
| | DIN | 22 | GPIO22 del #1 |
| **UART2** | RX | 16 | GPIO33 (TX) del #1 |
| | TX | 17 | GPIO35 (RX) del #1 |
| **Varios** | LED estado | 2 | LED integrado |
| | Botón emparejar | 0 (BOOT) | Pulsación larga = olvidar audífonos |
| **GND** | | | **GND común obligatorio** entre #1, #2 y DAC |

> Cables I2S cortos (<15 cm) y, si puedes, una resistencia serie de 33 Ω en BCK cerca del #1 para evitar reflexiones al alimentar dos cargas.

### Alimentación sugerida
2× 18650 **en paralelo** (1S2P, 3.0–4.2 V) → TP4056 USB-C **con protección** (DW01 + 8205, sin fusible) → interruptor de balancín KCD11 → **MT3608 ajustado a 5.0 V** (sin micro USB) → raíl 5 V para el **VIN** de los dos ESP32, el **VCC de la pantalla (J1 abierto, de fábrica)** y el **VIN del PCM5102A**.
- **Ajustar el MT3608 a 5.0 V con el multímetro ANTES de conectar cargas** (de fábrica puede dar 12 V o más).
- 470 µF/16 V a la salida del MT3608; 10 µF + 100 nF junto al VIN de cada ESP32.
- Consumo estimado ~350–480 mA → ~5–6 h con una 18650 de 3000 mAh, ~10–12 h con dos.
- Alternativa con más autonomía: buck-boost 3.3 V (TPS63020) a los pines 3V3 y la pantalla con J1 cerrado.
- Nivel de batería: B+ → 100 kΩ → GPIO34 → 100 kΩ → GND.
- Celdas de marca y del mismo modelo, cargadas al mismo voltaje antes de unirlas; nunca en serie.

---

## 2. Arquitectura FreeRTOS dual-core (ESP32 #1)

```
            CORE 0 (PRO_CPU)                         CORE 1 (APP_CPU)
 ┌──────────────────────────────────┐   ┌────────────────────────────────────┐
 │ Bluedroid + controlador BT (IDF) │   │ taskUI  prio 2  (~30 fps)          │
 │  └ callback A2DP Sink ──┐        │   │  · único dueño del TFT y del táctil│
 │                         ▼        │   │  · dibuja PLAYER/MENU/EQ/VIDEO      │
 │ taskAudio prio 10                │   │  · en modo VIDEO llama a           │
 │  SD → decoder(MP3/WAV/FLAC/OGG)  │   │    video.step(): lee JPEG de la SD,│
 │   → Resample 44.1k → DspStream   │   │    decodifica (JPEGDEC) y empuja   │
 │      (Biquad x3 + vol + VU)      │   │    por DMA. Sincroniza con el reloj│
 │   → I2S0 Master ─┬→ PCM5102A     │   │    de audio (muestras emitidas)    │
 │                  └→ ESP32 #2     │   │                                    │
 │ taskRecorder prio 3 (desactivado)│   │ taskLink prio 3                    │
 │  ring → WAV en /SPOTIFY/...      │   │  · UART2 ↔ ESP32 #2 (líneas ASCII) │
 └──────────────────────────────────┘   └────────────────────────────────────┘
        ▲ cola cmdQueue (PLAY, NEXT, SEEK, OPEN_VIDEO…) ─────────┘
        sdMutex: protege el bus HSPI (audio, vídeo, grabación, listados)
        stateMux: spinlock del estado compartido (AppState)
        EQ: coeficientes en doble buffer, el audio los cambia entre bloques
```

Reglas:
- **Solo taskUI toca el TFT/táctil** → no hay choques en VSPI (antes de leer el táctil se espera a que acabe la DMA).
- **Solo taskAudio escribe en I2S.** El callback del A2DP Sink escribe en el mismo `DspStream`, pero solo cuando la fuente activa es Spotify (el reproductor SD está parado).
- **Salida siempre 44 100 Hz / 16 bit / estéreo**: lo que tenga otra frecuencia se re-muestrea en el #1. Así el #2 nunca tiene que reconfigurarse y SBC (A2DP) trabaja a su frecuencia nativa.
- El volumen y el EQ se aplican **antes** de dividir la señal, así jack y BT suenan igual.

### ESP32 #2
```
 I2S Slave RX (task core 1, prio 6) ──► ring buffer SPSC 32 KB ──► callback A2DP Source (core 0, Bluedroid)
                                         · <25 % lleno: rellena con la última muestra (sin clics)
                                         · >75 % lleno: descarta 1 frame cada 64 (corrige deriva de reloj)
 UART2 task (core 1, prio 3): SCAN / CONNECT / DISCONNECT / VOL / ENABLE / PING
```

### Protocolo UART (115200 8N1, una orden por línea, `\n`)

| #1 → #2 | Respuesta #2 → #1 |
|---|---|
| `PING` | `PONG <versión>` |
| `SCAN` | `DEV <mac> <rssi> <nombre>` (varias), luego `SCAN_END` |
| `CONNECT <mac>` | `STATE CONNECTING <mac>` → `STATE CONNECTED <mac> <nombre>` |
| `DISCONNECT` | `STATE DISCONNECTED` |
| `VOL <0-127>` | `OK VOL <n>` |
| `ENABLE 0/1` | `OK ENABLE <n>` (0 = silencio hacia los audífonos) |
| `FORGET` | `OK FORGET` |
| — | `KEY PLAY / PAUSE / NEXT / PREV` (botones de los audífonos, el #1 los ejecuta) |
| — | `STAT <fill%> <underruns> <drops>` cada 5 s (diagnóstico) |

---

## 3. Estructura modular del ESP32 #1

```
ESP32_1_Walkman/
├─ ESP32_1_Walkman.ino   setup(): pantalla → SD (HSPI) → I2S → A2DP Sink → UART; crea las 3 tareas
├─ config.h              pines, opciones (FEATURE_VIDEO, FEATURE_SPOTIFY_RECORD), layout
├─ User_Setup_Walkman.h  configuración de TFT_eSPI (copiar a la librería)
├─ app_state.h/.cpp      AppState g, cola cmdQueue (UI → audio), sdMutex, showToast()
├─ dsp_biquad.h/.cpp     WalkmanDSP: 3 Biquad RBJ (DF-II transpuesta, float), volumen, limitador, picos VU
├─ audio_engine.h/.cpp   AudioEngine + DspOutput (el punto único que escribe en I2S y cuenta muestras)
├─ bt_spotify.h/.cpp     A2DP Sink, metadatos/posición AVRCP, carga de .LRC por "Artista - Titulo"
├─ sd_recorder.h/.cpp    AudioTee → StreamBuffer → WAV por pista (compilado fuera con FEATURE 0)
├─ lrc_parser.h/.cpp     .LRC (varias marcas por línea, [offset:]) y .SRT; UTF-8 → ASCII para el TFT
├─ media_library.h/.cpp  /MUSIC y /VIDEO, "Artista - Titulo.ext", archivos hermanos (.lrc .mp3 .srt)
├─ video_player.h/.cpp   MJPEG: SOI/EOI → JPEGDEC → DMA ping-pong, salto de fotogramas por reloj de audio
├─ uart_link.h/.cpp      BridgeLink: SCAN/CONNECT/VOL/ENABLE, eventos STATE/KEY del ESP32 #2
├─ ui_aero.h/.cpp        gelPill(), glassPanel(), fondo con aurora y burbujas, texto, iconos
└─ ui_screens.h/.cpp     PLAYER / MENU (5 categorías) / EQ / VIDEO + dock + avisos + táctil
```

**Cómo se dibuja sin PSRAM:** un único sprite de 320x24 (15 KB). Cada zona que cambia (carretes, VU, cápsula de letra, barra de progreso) se vuelve a componer franja a franja con toda la escena recortada, así el cristal es translúcido de verdad sobre el fondo y el aviso flotante queda siempre encima, sin parpadeo. En el simulador hay emojis; en el TFT se sustituyen por iconos dibujados (candado, play/pausa, triángulos, película) y las tildes se convierten a ASCII.

**Estructura de la MicroSD:**
```
/MUSIC/Artista - Titulo.mp3|.wav|.flac|.ogg   (+ mismo nombre .lrc al lado)
/LYRICS/Artista - Titulo.lrc                  (letras para Spotify y alternativa para SD)
/VIDEO/Clip.mjpeg + Clip.mp3|.wav (+ Clip.srt)
/SPOTIFY/<album>/Artista - Titulo.wav         (solo cuando se active la grabación)
```

---

## 4. Vídeo (nuevo)

ESP32 clásico **sin PSRAM** no puede decodificar H.264/MP4. La vía realista es **MJPEG** (cada fotograma es un JPEG baseline) + audio aparte:

```
/VIDEO/MiClip.mjpeg   ← vídeo 320x180, 12–15 fps
/VIDEO/MiClip.mp3     ← audio (o .wav)
/VIDEO/MiClip.srt     ← subtítulos opcionales (se muestran en la cápsula Aqua)
```

Conversión en el PC con ffmpeg:

```bash
# Vídeo: 320x180 (16:9 cabe exacto entre la barra superior y el dock), 15 fps, JPEG baseline
ffmpeg -i entrada.mp4 -an -vf "fps=15,scale=320:180:flags=lanczos" -pix_fmt yuvj420p -q:v 8 -f mjpeg MiClip.mjpeg
# Audio: MP3 44.1 kHz estéreo 128 kbps (o -c:a pcm_s16le MiClip.wav para usar menos CPU)
ffmpeg -i entrada.mp4 -vn -ac 2 -ar 44100 -c:a libmp3lame -b:a 128k MiClip.mp3
```

- Si el clip no es de 15 fps, ponlo en el nombre: `MiClip@12.mjpeg` (y el audio `MiClip@12.mp3`).
- Pantalla de vídeo: la barra superior se oculta y el vídeo ocupa Y 2..181 (320x180). Debajo, panel de cristal con subtítulos + barra de progreso violeta, y el dock normal.
- Toque en el vídeo = "modo cine" (oculta el dock y agranda los subtítulos); doble toque = pausa; tocar la barra = saltar. MENU sale a la lista de vídeos.
- En el menú hay una categoría nueva **Videos** (entre MicroSD y Spotify) con la lista de clips.
- La imagen se sincroniza con el **reloj del audio** (muestras enviadas al I2S): si va tarde, se saltan fotogramas; si va adelantada, espera.
- Rendimiento esperado (estimación, no medido): JPEGDEC 320x180 ≈ 25–35 ms + envío DMA a 40 MHz ≈ 23 ms en paralelo → **12–15 fps**. Si va justo, usa `fps=12` o `-q:v 10`.
- Durante el vídeo se pausa el A2DP Sink (Spotify) para liberar CPU y RAM; la salida jack y BT (#2) siguen funcionando con el audio del vídeo y con el EQ.

---

## 5. Librerías (Arduino IDE)

| Librería | Uso | Placa |
|---|---|---|
| Arduino-ESP32 core **3.3.x** (escrito para la 3.3.7; aún sin compilar) | ESP-IDF 5: el #2 usa el driver I2S nuevo (`i2s_std`) | #1 y #2 |
| ESP32-A2DP (pschatzmann) | A2DP Sink / Source + AVRCP | #1 y #2 |
| arduino-audio-tools (pschatzmann) | Decoders, I2SStream, ResampleStream | #1 |
| arduino-libhelix | MP3 | #1 |
| arduino-libflac | FLAC | #1 |
| arduino-libvorbis-tremor | OGG Vorbis | #1 |
| TFT_eSPI (Bodmer) | ILI9341 + XPT2046 + DMA | #1 |
| JPEGDEC (bitbank2) | Fotogramas MJPEG | #1 |

Particiones: **Huge APP (3MB No OTA)** en ambas placas (BT + códecs no caben en 1.2 MB).

TFT_eSPI: copia `ESP32_1_Walkman/User_Setup_Walkman.h` a la carpeta de TFT_eSPI y apúntalo desde `User_Setup_Select.h`.

Límites conocidos del ESP32 sin PSRAM:
- OGG Vorbis consume ~60–90 KB de heap; funciona con BT activo pero va justo. Si falla al abrir un .ogg, el firmware lo salta y muestra un aviso.
- AVRCP del ESP-IDF **no permite explorar las playlists del teléfono**: "Guardar Playlist" graba lo que el teléfono va reproduciendo, cortando un WAV por cada cambio de pista. En v1 está desactivado (`FEATURE_SPOTIFY_RECORD 0`). Grabar streams de Spotify va contra sus condiciones de uso; queda solo como estructura.
