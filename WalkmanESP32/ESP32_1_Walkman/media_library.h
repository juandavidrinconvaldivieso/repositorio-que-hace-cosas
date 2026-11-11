#pragma once
#include <Arduino.h>
#include <SD.h>

// ============================================================================
// Biblioteca de la MicroSD: /MUSIC (mp3 wav flac ogg) y /VIDEO (*.mjpeg)
// Título/artista salen del nombre "Artista - Titulo.ext" (rápido, sin abrir el archivo).
// ============================================================================

#define LIB_MAX_TRACKS 160
#define LIB_MAX_VIDEOS 40
#define LIB_PATH_LEN   96

enum MediaFormat : uint8_t { FMT_UNKNOWN, FMT_MP3, FMT_WAV, FMT_FLAC, FMT_OGG, FMT_MJPEG };

struct MediaEntry {
  char path[LIB_PATH_LEN];
  char title[48];
  char artist[32];
  MediaFormat fmt;
  uint32_t size;
};

class MediaLibrary {
public:
  bool begin(fs::FS& fs);
  int  scan();                             // devuelve nº total (pistas + vídeos)
  int  trackCount() const { return _nTracks; }
  int  videoCount() const { return _nVideos; }
  const MediaEntry& track(int i) const { return _tracks[i]; }
  const MediaEntry& video(int i) const { return _videos[i]; }
  static MediaFormat formatFromName(const char* name);
  static const char* formatLabel(MediaFormat f);
  // Busca archivo hermano con otra extensión: "/VIDEO/a.mjpeg" + ".mp3" → "/VIDEO/a.mp3"
  bool siblingWithExt(const char* path, const char* ext, char* out, size_t outLen);

private:
  void scanDir(const char* dir, int depth);
  void addFile(const char* path, uint32_t size);
  fs::FS* _fs = nullptr;
  MediaEntry* _tracks = nullptr;
  MediaEntry* _videos = nullptr;
  int _nTracks = 0, _nVideos = 0;
};

extern MediaLibrary library;
extern SPIClass sdSPI;
