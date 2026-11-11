#include "lrc_parser.h"

Lyrics lyrics;

void utf8ToAscii(const char* in, char* out, size_t outLen) {
  size_t o = 0;
  const uint8_t* p = (const uint8_t*)in;
  while (*p && o + 1 < outLen) {
    if (*p < 0x80) { out[o++] = *p++; continue; }
    if ((*p & 0xE0) == 0xC0 && p[1]) {
      uint16_t cp = ((p[0] & 0x1F) << 6) | (p[1] & 0x3F);
      p += 2;
      char c = 0;
      if (cp >= 0xC0 && cp <= 0xC5) c = 'A'; else if (cp >= 0xE0 && cp <= 0xE5) c = 'a';
      else if (cp >= 0xC8 && cp <= 0xCB) c = 'E'; else if (cp >= 0xE8 && cp <= 0xEB) c = 'e';
      else if (cp >= 0xCC && cp <= 0xCF) c = 'I'; else if (cp >= 0xEC && cp <= 0xEF) c = 'i';
      else if (cp >= 0xD2 && cp <= 0xD6) c = 'O'; else if (cp >= 0xF2 && cp <= 0xF6) c = 'o';
      else if (cp >= 0xD9 && cp <= 0xDC) c = 'U'; else if (cp >= 0xF9 && cp <= 0xFC) c = 'u';
      else if (cp == 0xD1) c = 'N'; else if (cp == 0xF1) c = 'n';
      else if (cp == 0xC7) c = 'C'; else if (cp == 0xE7) c = 'c';
      if (c) out[o++] = c;          // ¿ ¡ y otros símbolos se omiten
      continue;
    }
    // Secuencias de 3-4 bytes (emojis, CJK): se sustituyen por '?'
    int skip = ((*p & 0xF0) == 0xE0) ? 3 : ((*p & 0xF8) == 0xF0) ? 4 : 1;
    while (skip-- && *p) p++;
    out[o++] = '?';
  }
  out[o] = 0;
}

bool Lyrics::begin() {
  if (!_lines) _lines = (LyricLine*)malloc(sizeof(LyricLine) * LYRIC_MAX_LINES);
  return _lines != nullptr;
}

void Lyrics::clear() { _count = 0; _offsetMs = 0; version++; }

void Lyrics::addLine(uint32_t ms, uint32_t endMs, const char* txt) {
  if (!_lines || _count >= LYRIC_MAX_LINES) return;
  LyricLine& l = _lines[_count++];
  l.startMs = ms; l.endMs = endMs;
  utf8ToAscii(txt, l.text, LYRIC_TEXT_LEN);
}

void Lyrics::sortByTime() {
  // Inserción: las LRC suelen venir casi ordenadas
  for (int i = 1; i < _count; i++) {
    LyricLine tmp = _lines[i];
    int j = i - 1;
    while (j >= 0 && _lines[j].startMs > tmp.startMs) { _lines[j + 1] = _lines[j]; j--; }
    _lines[j + 1] = tmp;
  }
}

// Formato: [mm:ss.xx]texto  — admite varias etiquetas por línea: [00:12.00][01:30.50]Coro
bool Lyrics::loadLrc(fs::FS& fs, const char* path) {
  clear();
  File f = fs.open(path, FILE_READ);
  if (!f) return false;
  char buf[192];
  while (f.available()) {
    int n = f.readBytesUntil('\n', buf, sizeof(buf) - 1);
    buf[n] = 0;
    if (n && buf[n - 1] == '\r') buf[--n] = 0;
    char* p = buf;
    if ((uint8_t)p[0] == 0xEF && (uint8_t)p[1] == 0xBB) p += 3;   // BOM UTF-8

    if (!strncmp(p, "[offset:", 8)) { _offsetMs = atoi(p + 8); continue; }

    uint32_t stamps[8]; int ns = 0;
    while (*p == '[' && ns < 8) {
      int mm, ss, frac = 0; char sep = 0;
      int got = sscanf(p, "[%d:%d%c%d]", &mm, &ss, &sep, &frac);
      char* close = strchr(p, ']');
      if (!close) break;
      if (got >= 2 && mm >= 0 && ss >= 0) {
        // fracción de 2 dígitos = centésimas, 3 dígitos = milésimas
        int fracDigits = (got == 4) ? (int)(close - strchr(p, sep) - 1) : 0;
        uint32_t fracMs = fracDigits == 3 ? frac : fracDigits == 2 ? frac * 10 : frac * 100;
        int32_t t = (int32_t)(mm * 60000 + ss * 1000 + (got == 4 ? fracMs : 0)) - _offsetMs;
        stamps[ns++] = t < 0 ? 0 : t;
      }
      p = close + 1;
    }
    for (int i = 0; i < ns; i++) addLine(stamps[i], 0, p);
  }
  f.close();
  sortByTime();
  version++;
  return _count > 0;
}

static uint32_t parseSrtTime(const char* s) {
  int h, m, sec, ms;
  if (sscanf(s, "%d:%d:%d,%d", &h, &m, &sec, &ms) != 4 &&
      sscanf(s, "%d:%d:%d.%d", &h, &m, &sec, &ms) != 4) return 0;
  return ((h * 60 + m) * 60 + sec) * 1000UL + ms;
}

// Bloques: número / "00:00:01,000 --> 00:00:03,500" / 1-2 líneas de texto / línea vacía
bool Lyrics::loadSrt(fs::FS& fs, const char* path) {
  clear();
  File f = fs.open(path, FILE_READ);
  if (!f) return false;
  char buf[160], text[LYRIC_TEXT_LEN * 2];
  uint32_t st = 0, en = 0; bool inBlock = false; text[0] = 0;
  while (true) {
    bool eof = !f.available();
    int n = eof ? 0 : f.readBytesUntil('\n', buf, sizeof(buf) - 1);
    buf[n] = 0;
    if (n && buf[n - 1] == '\r') buf[--n] = 0;
    if (n == 0) {
      if (inBlock && text[0]) addLine(st, en, text);
      inBlock = false; text[0] = 0;
      if (eof) break;
      continue;
    }
    char* arrow = strstr(buf, "-->");
    if (arrow) { st = parseSrtTime(buf); en = parseSrtTime(arrow + 4); inBlock = true; continue; }
    if (inBlock) {
      // Quitar etiquetas <i> </i>
      for (char* t; (t = strchr(buf, '<'));) { char* e = strchr(t, '>'); if (!e) break; memmove(t, e + 1, strlen(e)); }
      if (text[0]) strlcat(text, " ", sizeof(text));
      strlcat(text, buf, sizeof(text));
    }
  }
  f.close();
  sortByTime();
  version++;
  return _count > 0;
}

int Lyrics::indexAt(uint32_t ms) const {
  int lo = 0, hi = _count - 1, ans = -1;
  while (lo <= hi) {                       // búsqueda binaria: última línea con startMs <= ms
    int mid = (lo + hi) / 2;
    if (_lines[mid].startMs <= ms) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (ans >= 0 && _lines[ans].endMs && ms > _lines[ans].endMs) return -1;   // SRT: hueco sin subtítulo
  return ans;
}

float Lyrics::progressAt(uint32_t ms, uint32_t durMs) const {
  int i = indexAt(ms);
  if (i < 0) return 0;
  uint32_t a = _lines[i].startMs;
  uint32_t b = _lines[i].endMs ? _lines[i].endMs : (i + 1 < _count ? _lines[i + 1].startMs : durMs);
  if (b <= a) return 1;
  float p = (float)(ms - a) / (float)(b - a);
  return p < 0.08f ? 0.08f : (p > 1 ? 1 : p);
}
