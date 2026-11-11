#include "media_library.h"
#include "lrc_parser.h"
#include "config.h"

MediaLibrary library;
SPIClass sdSPI(HSPI);

bool MediaLibrary::begin(fs::FS& fs) {
  _fs = &fs;
  if (!_tracks) _tracks = (MediaEntry*)malloc(sizeof(MediaEntry) * LIB_MAX_TRACKS);
  if (!_videos) _videos = (MediaEntry*)malloc(sizeof(MediaEntry) * LIB_MAX_VIDEOS);
  return _tracks && _videos;
}

MediaFormat MediaLibrary::formatFromName(const char* name) {
  const char* dot = strrchr(name, '.');
  if (!dot) return FMT_UNKNOWN;
  if (!strcasecmp(dot, ".mp3"))   return FMT_MP3;
  if (!strcasecmp(dot, ".wav"))   return FMT_WAV;
  if (!strcasecmp(dot, ".flac"))  return FMT_FLAC;
  if (!strcasecmp(dot, ".ogg"))   return FMT_OGG;
  if (!strcasecmp(dot, ".mjpeg") || !strcasecmp(dot, ".mjpg")) return FMT_MJPEG;
  return FMT_UNKNOWN;
}

const char* MediaLibrary::formatLabel(MediaFormat f) {
  switch (f) {
    case FMT_MP3: return "MP3"; case FMT_WAV: return "WAV"; case FMT_FLAC: return "FLAC";
    case FMT_OGG: return "OGG"; case FMT_MJPEG: return "VIDEO"; default: return "?";
  }
}

void MediaLibrary::addFile(const char* path, uint32_t size) {
  MediaFormat fmt = formatFromName(path);
  if (fmt == FMT_UNKNOWN) return;
  MediaEntry* e;
  if (fmt == FMT_MJPEG) { if (_nVideos >= LIB_MAX_VIDEOS) return; e = &_videos[_nVideos++]; }
  else                  { if (_nTracks >= LIB_MAX_TRACKS) return; e = &_tracks[_nTracks++]; }
  strlcpy(e->path, path, sizeof(e->path));
  e->fmt = fmt; e->size = size;

  // "Artista - Titulo.ext"
  const char* base = strrchr(path, '/'); base = base ? base + 1 : path;
  char name[96]; strlcpy(name, base, sizeof(name));
  char* dot = strrchr(name, '.'); if (dot) *dot = 0;
  char* at = strchr(name, '@'); if (at) *at = 0;          // "Clip@12.mjpeg" → fps en el nombre
  char* sep = strstr(name, " - ");
  if (sep) {
    *sep = 0;
    utf8ToAscii(name, e->artist, sizeof(e->artist));
    utf8ToAscii(sep + 3, e->title, sizeof(e->title));
  } else {
    strlcpy(e->artist, fmt == FMT_MJPEG ? "Video" : "Desconocido", sizeof(e->artist));
    utf8ToAscii(name, e->title, sizeof(e->title));
  }
}

void MediaLibrary::scanDir(const char* dir, int depth) {
  File d = _fs->open(dir);
  if (!d || !d.isDirectory()) return;
  for (File f = d.openNextFile(); f; f = d.openNextFile()) {
    char full[LIB_PATH_LEN];
    const char* nm = f.name();
    // Core 2.x devuelve solo el nombre; algunas versiones la ruta completa
    if (nm[0] == '/') strlcpy(full, nm, sizeof(full));
    else snprintf(full, sizeof(full), "%s/%s", dir, nm);
    if (f.isDirectory()) { if (depth < 2) scanDir(full, depth + 1); }
    else if (nm[0] != '.') addFile(full, f.size());     // ignora "._xxx" de macOS
    f.close();
  }
  d.close();
}

int MediaLibrary::scan() {
  _nTracks = _nVideos = 0;
  if (!_fs) return 0;
  scanDir(DIR_MUSIC, 0);
  scanDir(DIR_VIDEO, 0);
  Serial.printf("[LIB] %d pistas, %d videos\n", _nTracks, _nVideos);
  return _nTracks + _nVideos;
}

bool MediaLibrary::siblingWithExt(const char* path, const char* ext, char* out, size_t outLen) {
  strlcpy(out, path, outLen);
  char* dot = strrchr(out, '.');
  if (!dot) return false;
  *dot = 0;
  strlcat(out, ext, outLen);
  return _fs->exists(out);
}
