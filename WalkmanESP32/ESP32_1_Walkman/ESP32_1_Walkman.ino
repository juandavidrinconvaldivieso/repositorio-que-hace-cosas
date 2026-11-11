/*******************************************************************************
 * W. WALKMAN AERO — ESP32 #1 "WALKMAN"
 * ILI9341 2.8" + XPT2046 (VSPI) · MicroSD (HSPI) · I2S0 Master → PCM5102A + ESP32 #2
 * A2DP Sink (Spotify) · MP3/WAV/FLAC/OGG + .LRC · Vídeo MJPEG + .SRT · DSP Biquad x3
 *
 * Placa: ESP32 Dev Module · Core Arduino-ESP32 3.3.x · Partición: Huge APP (3MB No OTA)
 * Librerías: TFT_eSPI >= 2.5.43, arduino-audio-tools >= 1.0, ESP32-A2DP >= 1.8, JPEGDEC
 * CPU 240 MHz · Flash 80 MHz QIO
 *
 * Módulos:
 *   config.h            pines y opciones
 *   app_state.*         estado compartido, cola de órdenes, mutex
 *   dsp_biquad.*        3 Biquad RBJ + volumen + limitador
 *   audio_engine.*      SD → decoder → resample → DSP → I2S (taskAudio, core 0)
 *   bt_spotify.*        A2DP Sink + AVRCP (metadatos, posición, controles)
 *   sd_recorder.*       Guardar playlist en SD (AudioTee + WAV por pista) — desactivado v1
 *   lrc_parser.*        .LRC y .SRT
 *   media_library.*     escaneo /MUSIC y /VIDEO
 *   video_player.*      MJPEG + JPEGDEC + DMA, sincronizado con el reloj del audio
 *   uart_link.*         protocolo con el ESP32 #2 (taskLink)
 *   ui_aero.*           primitivas Frutiger Aero (render por franjas con alfa)
 *   ui_screens.*        pantallas, dock, avisos, táctil (taskUI, core 1)
 ******************************************************************************/
#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include "config.h"
#include "app_state.h"
#include "audio_engine.h"
#include "bt_spotify.h"
#include "sd_recorder.h"
#include "lrc_parser.h"
#include "media_library.h"
#include "uart_link.h"
#include "ui_screens.h"

void setup() {
  Serial.begin(115200);
  Serial.println("\n[W.] Walkman Aero arrancando");

  cmdQueue = xQueueCreate(12, sizeof(AudioCmd));
  sdMutex = xSemaphoreCreateMutex();

  // 1) Pantalla primero: así el usuario ve algo mientras arranca el BT
  uiBegin();

  // 2) MicroSD en su propio bus HSPI
  sdSPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  if (!SD.begin(PIN_SD_CS, sdSPI, SD_FREQ_HZ)) {
    Serial.println("[SD] fallo al montar");
    showToast("MicroSD no detectada", 5000);
  } else {
    library.begin(SD);
    library.scan();
  }
  lyrics.begin();

  // 3) Audio (I2S siempre con reloj → el ESP32 #2 no pierde sincronía)
  if (!audio.begin()) Serial.println("[I2S] fallo");

  // 4) Bluetooth: A2DP Sink para el teléfono
  spotify.begin();
  recorder.begin();                         // no crea nada si FEATURE_SPOTIFY_RECORD == 0

  // 5) Enlace con el ESP32 #2
  bridge.begin();

  Serial.printf("[MEM] heap libre %u, bloque max %u\n", ESP.getFreeHeap(), ESP.getMaxAllocHeap());

  // ---- Tareas FreeRTOS ----
  //               función     nombre    stack  arg   prio  handle  core
  xTaskCreatePinnedToCore(taskAudio, "audio", 12288, nullptr, 10, nullptr, 0);  // FLAC/OGG piden stack
  xTaskCreatePinnedToCore(taskUI,    "ui",    8192,  nullptr, 2,  nullptr, 1);
  xTaskCreatePinnedToCore(taskLink,  "link",  4096,  nullptr, 3,  nullptr, 1);
}

void loop() {
  // Todo corre en tareas. Diagnóstico de memoria cada 10 s.
  static uint32_t t = 0;
  if (millis() - t > 10000) {
    t = millis();
    Serial.printf("[MEM] heap %u  min %u  src=%d  pos=%u\n", ESP.getFreeHeap(), ESP.getMinFreeHeap(),
                  g.source, (unsigned)g.posMs);
  }
  vTaskDelay(pdMS_TO_TICKS(500));
}
