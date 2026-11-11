#include "video_player.h"
#include <JPEGDEC.h>
#include "config.h"
#include "lrc_parser.h"
#include "media_library.h"

MjpegPlayer video;

#define VBUF_SIZE   32768          // un JPEG 320x180 con -q:v 8 pesa ~8-16 KB
#define DMA_PIXELS  (16 * 320)     // JPEGDEC entrega franjas de 1 MCU (16 líneas) de alto

static JPEGDEC jpeg;
static uint16_t* dmaBuf[2] = {nullptr, nullptr};
static uint8_t dmaSel = 0;
static TFT_eSPI* sTft = nullptr;
static int16_t sY0 = 0;

// JPEGDEC → TFT: copia la franja a un buffer ping-pong y la envía por DMA
static int jpegDraw(JPEGDRAW* d) {
  size_t px = (size_t)d->iWidth * d->iHeight;
  if (px > DMA_PIXELS) return 0;
  uint16_t* dst = dmaBuf[dmaSel];
  dmaSel ^= 1;
  memcpy(dst, d->pPixels, px * 2);   // la DMA anterior usa el otro buffer → sin esperar
  sTft->pushImageDMA(d->x, d->y + sY0, d->iWidth, d->iHeight, dst);
  return 1;
}

bool MjpegPlayer::begin(TFT_eSPI* tft) {
  _tft = sTft = tft;
  return true;
}

bool MjpegPlayer::open(const char* path) {
  close();
  // Memoria solo mientras hay vídeo (se libera al salir)
  _buf = (uint8_t*)malloc(VBUF_SIZE);
  dmaBuf[0] = (uint16_t*)heap_caps_malloc(DMA_PIXELS * 2, MALLOC_CAP_DMA);
  dmaBuf[1] = (uint16_t*)heap_caps_malloc(DMA_PIXELS * 2, MALLOC_CAP_DMA);
  if (!_buf || !dmaBuf[0] || !dmaBuf[1]) { close(); return false; }

  _file = SD.open(path, FILE_READ);
  if (!_file) { close(); return false; }

  // fps desde el nombre: "Clip@12.mjpeg"
  _fps = 15;
  const char* at = strrchr(path, '@');
  if (at) { int f = atoi(at + 1); if (f >= 5 && f <= 30) _fps = f; }

  _fill = 0; _frameLen = 0; _eof = false; _frameIdx = 0;
  framesShown = framesSkipped = 0; _fpsT0 = millis(); _fpsN = 0; measuredFps = 0;

  // Duración aproximada: tamaño / tamaño del primer fotograma
  uint8_t* j; size_t len;
  _durMs = 0;
  if (nextFrame(&j, &len)) {
    uint32_t frames = _file.size() / max((size_t)1, len);
    _durMs = frames * 1000UL / _fps;
    _file.seek(0); _fill = 0; _frameLen = 0;
  }

  char srt[LIB_PATH_LEN];
  if (library.siblingWithExt(path, ".srt", srt, sizeof(srt))) lyrics.loadSrt(SD, srt);
  else lyrics.clear();
  return true;
}

void MjpegPlayer::close() {
  if (_tft) _tft->dmaWait();
  if (_file) _file.close();
  free(_buf); _buf = nullptr;
  heap_caps_free(dmaBuf[0]); heap_caps_free(dmaBuf[1]);
  dmaBuf[0] = dmaBuf[1] = nullptr;
}

// Busca SOI (FF D8) al inicio del buffer y EOI (FF D9) para delimitar el fotograma.
// En datos JPEG un 0xFF real siempre va seguido de 0x00, así que FF D9 es fiable.
bool MjpegPlayer::nextFrame(uint8_t** jpg, size_t* len) {
  // descartar el fotograma anterior
  if (_frameLen) { memmove(_buf, _buf + _frameLen, _fill - _frameLen); _fill -= _frameLen; _frameLen = 0; }

  size_t scan = 2;
  for (;;) {
    // alinear al SOI
    if (_fill >= 2 && !(_buf[0] == 0xFF && _buf[1] == 0xD8)) {
      size_t k = 1;
      while (k + 1 < _fill && !(_buf[k] == 0xFF && _buf[k + 1] == 0xD8)) k++;
      memmove(_buf, _buf + k, _fill - k); _fill -= k; scan = 2;
    }
    for (; scan + 1 < _fill; scan++) {
      if (_buf[scan] == 0xFF && _buf[scan + 1] == 0xD9) {
        _frameLen = scan + 2;
        *jpg = _buf; *len = _frameLen;
        return true;
      }
    }
    if (_fill == VBUF_SIZE) { _fill = 0; scan = 2; continue; }      // fotograma gigante: descartar
    size_t n = _file.read(_buf + _fill, VBUF_SIZE - _fill);
    if (n == 0) { _eof = true; return false; }
    _fill += n;
  }
}

bool MjpegPlayer::decodeAndDraw(uint8_t* j, size_t len, int16_t y0) {
  sY0 = y0;
  if (!jpeg.openRAM(j, (int)len, jpegDraw)) return false;
  jpeg.setPixelType(RGB565_BIG_ENDIAN);   // ya en orden de bytes del SPI → sin swap
  int w = jpeg.getWidth(), h = jpeg.getHeight();
  int x = (SCR_W - w) / 2; if (x < 0) x = 0;
  int scale = (w > SCR_W) ? JPEG_SCALE_HALF : 0;   // vídeos 640 de ancho se reducen a la mitad
  _tft->startWrite();
  jpeg.decode(x, max(0, (VIDEO_H - (scale ? h / 2 : h)) / 2), scale);
  _tft->dmaWait();
  _tft->endWrite();
  jpeg.close();
  return true;
}

void MjpegPlayer::seekMs(uint32_t ms) {
  if (!_file || !_durMs) return;
  if (ms > _durMs) ms = _durMs;
  _file.seek((uint64_t)_file.size() * ms / _durMs);
  _fill = 0; _frameLen = 0; _eof = false;
  _frameIdx = (uint64_t)ms * _fps / 1000;
}

bool MjpegPlayer::step(uint32_t clockMs, int16_t y0) {
  if (!_file || _eof) return false;
  uint32_t target = (uint64_t)clockMs * _fps / 1000;
  if (_frameIdx > target) return false;                 // vamos adelantados: esperar al audio

  uint8_t* j; size_t len;
  // Vamos tarde: saltar fotogramas sin decodificarlos (solo lectura)
  while (_frameIdx < target) {
    if (!nextFrame(&j, &len)) return false;
    _frameIdx++; framesSkipped++;
  }
  if (!nextFrame(&j, &len)) return false;
  _frameIdx++;
  bool ok = decodeAndDraw(j, len, y0);
  if (ok) framesShown++;

  if (++_fpsN >= 15) {
    uint32_t now = millis();
    measuredFps = _fpsN * 1000.0f / max(1UL, (unsigned long)(now - _fpsT0));
    _fpsT0 = now; _fpsN = 0;
  }
  return ok;
}
