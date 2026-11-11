#pragma once
#include <Arduino.h>
#include <FS.h>

// ============================================================================
// Letras sincronizadas: .LRC (canciones) y .SRT (subtítulos de vídeo)
// Todo se guarda como lista ordenada de líneas con tiempo de inicio (y fin en SRT).
// ============================================================================

#define LYRIC_MAX_LINES 160
#define LYRIC_TEXT_LEN  72

struct LyricLine {
  uint32_t startMs;
  uint32_t endMs;                 // 0 = hasta la siguiente línea
  char text[LYRIC_TEXT_LEN];
};

class Lyrics {
public:
  bool begin();                   // reserva memoria (~12 KB) una sola vez
  void clear();
  bool loadLrc(fs::FS& fs, const char* path);
  bool loadSrt(fs::FS& fs, const char* path);
  int  count() const { return _count; }
  // Índice de la línea activa en 'ms' (-1 si aún no empieza). En SRT respeta endMs.
  int  indexAt(uint32_t ms) const;
  const LyricLine* line(int i) const { return (i >= 0 && i < _count) ? &_lines[i] : nullptr; }
  // Progreso 0..1 dentro de la línea activa (para el relleno líquido de la cápsula)
  float progressAt(uint32_t ms, uint32_t trackDurationMs) const;
  volatile uint32_t version = 0;  // cambia al recargar → la UI sabe que debe redibujar

private:
  void sortByTime();
  void addLine(uint32_t ms, uint32_t endMs, const char* txt);
  LyricLine* _lines = nullptr;
  int _count = 0;
  int32_t _offsetMs = 0;          // etiqueta [offset:+/-ms]
};

// Convierte UTF-8 con tildes a ASCII para las fuentes GLCD del TFT (á→a, ñ→n, ¿¡ fuera)
void utf8ToAscii(const char* in, char* out, size_t outLen);

extern Lyrics lyrics;
