#pragma once
// ============================================================================
// W. WALKMAN AERO — ESP32 #1 · Configuración de pines y funciones
// Los pines del TFT/táctil (VSPI) están en User_Setup_Walkman.h (TFT_eSPI).
// ============================================================================

// ---- HSPI dedicado a la MicroSD ----
#define PIN_SD_SCK      14
#define PIN_SD_MOSI     13
#define PIN_SD_MISO     27      // NO usar GPIO12 (pin de arranque)
#define PIN_SD_CS       15
#define SD_FREQ_HZ      25000000

// ---- I2S0 Master → PCM5102A + ESP32 #2 (en paralelo) ----
#define PIN_I2S_BCK     26
#define PIN_I2S_WS      25
#define PIN_I2S_DOUT    22
#define OUT_SAMPLE_RATE 44100

// ---- UART2 ↔ ESP32 #2 ----
#define PIN_LINK_TX     33
#define PIN_LINK_RX     35
#define LINK_BAUD       115200

// ---- Varios ----
#define PIN_BACKLIGHT   32
#define PIN_BATTERY     34      // divisor 100k/100k
#define PIN_HOLD        21      // mantener pulsado al arrancar = recalibrar táctil
#define PIN_DAC_MUTE    -1      // opcional: GPIO2 → XSMT del PCM5102A para silenciar el jack en modo BT

// ---- Funciones ----
#define FEATURE_VIDEO           1   // Reproductor MJPEG (/VIDEO)
#define FEATURE_SPOTIFY_RECORD  0   // v1: arquitectura AudioTee + WAV por pista PREPARADA pero DESACTIVADA
#define BT_SINK_NAME            "W.Walkman Aero"

// ---- Carpetas en la SD ----
#define DIR_MUSIC       "/MUSIC"
#define DIR_LYRICS      "/LYRICS"   // Artista - Titulo.lrc (para Spotify); para SD se busca junto al archivo
#define DIR_VIDEO       "/VIDEO"
#define DIR_SPOTIFY_REC "/SPOTIFY"

// ---- Layout (sale del simulador HTML, 320x240) ----
#define SCR_W           320
#define SCR_H           240
#define STATUS_H        20          // Y 0..20
#define DOCK_Y          213         // Y 213..238 (dock compacto)
#define VIDEO_Y         2           // Y 2..181 → 320x180 (en modo vídeo no hay barra superior)
#define VIDEO_H         180
