#pragma once
#include <Arduino.h>
#include <SD.h>
#include <TFT_eSPI.h>

// ============================================================================
// Reproductor de vídeo MJPEG (JPEG baseline concatenados, 320x180, 12-15 fps)
//   /VIDEO/Clip.mjpeg (+ Clip.mp3 | Clip.wav) (+ Clip.srt)   ·  fps en el nombre: "Clip@12.mjpeg"
// Lo llama SOLO taskUI (dueño del TFT). Decodifica con JPEGDEC y empuja por DMA
// con doble buffer ping-pong mientras se decodifica la siguiente franja.
// El reloj maestro es el audio: frame objetivo = muestras_emitidas / 44100 * fps.
// ============================================================================

class MjpegPlayer {
public:
  bool begin(TFT_eSPI* tft);
  bool open(const char* path);           // abre .mjpeg y carga .srt si existe
  void close();
  // Avanza: devuelve true si pintó un fotograma. 'clockMs' = posición del audio.
  bool step(uint32_t clockMs, int16_t y0);
  // Salto: posiciona por proporción de bytes y re-sincroniza en el siguiente SOI
  void seekMs(uint32_t ms);
  bool isOpen() const { return (bool)_file; }
  bool finished() const { return _eof; }
  uint8_t fps() const { return _fps; }
  uint32_t framesShown = 0, framesSkipped = 0;
  float measuredFps = 0;
  uint32_t durationMs() const { return _durMs; }

private:
  bool nextFrame(uint8_t** jpg, size_t* len);   // extrae el siguiente JPEG (SOI..EOI)
  bool decodeAndDraw(uint8_t* jpg, size_t len, int16_t y0);
  TFT_eSPI* _tft = nullptr;
  File _file;
  uint8_t* _buf = nullptr;               // buffer de lectura/fotograma (32 KB)
  size_t _fill = 0, _frameLen = 0;
  bool _eof = false;
  uint8_t _fps = 15;
  uint32_t _frameIdx = 0;
  uint32_t _durMs = 0;
  uint32_t _fpsT0 = 0, _fpsN = 0;
};

extern MjpegPlayer video;
