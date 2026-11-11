#include "sd_recorder.h"
#include "app_state.h"
#include "bt_spotify.h"
#include <SD.h>
#include <freertos/stream_buffer.h>

SdRecorder recorder;

#if FEATURE_SPOTIFY_RECORD
static StreamBufferHandle_t recBuf = nullptr;    // 16 KB ≈ 93 ms de margen
static File wavFile;
static uint32_t dataBytes = 0;
static char pendingArtist[48], pendingTitle[64], pendingAlbum[48];
static volatile bool pendingSwitch = false;

static void writeWavHeader(File& f, uint32_t dataLen) {
  const uint32_t sr = OUT_SAMPLE_RATE, byteRate = sr * 4;
  uint8_t h[44] = {'R','I','F','F',0,0,0,0,'W','A','V','E','f','m','t',' ',16,0,0,0,1,0,2,0,
                   0,0,0,0, 0,0,0,0, 4,0,16,0,'d','a','t','a',0,0,0,0};
  uint32_t riff = dataLen + 36;
  memcpy(h + 4, &riff, 4); memcpy(h + 24, &sr, 4); memcpy(h + 28, &byteRate, 4); memcpy(h + 40, &dataLen, 4);
  f.seek(0); f.write(h, 44);
}
#endif

void SdRecorder::begin() {
#if FEATURE_SPOTIFY_RECORD
  recBuf = xStreamBufferCreate(16384, 1024);
  xTaskCreatePinnedToCore(taskRecorder, "rec", 4096, nullptr, 3, nullptr, 0);
#endif
}

bool SdRecorder::albumQueued(const char* album) const {
  for (int i = 0; i < spotify.seenCount; i++)
    if (!strcmp(spotify.seen[i].name, album)) return spotify.seen[i].queuedForSd;
  return false;
}

void SdRecorder::tee(const int16_t* lr, size_t frames) {
#if FEATURE_SPOTIFY_RECORD
  if (!_enabled || !recBuf) return;
  xStreamBufferSend(recBuf, lr, frames * 4, 0);       // timeout 0: si está lleno, se pierde (nunca bloquea el BT)
#endif
}

void SdRecorder::onTrackChange(const char* artist, const char* title, const char* album) {
#if FEATURE_SPOTIFY_RECORD
  strlcpy(pendingArtist, artist, sizeof(pendingArtist));
  strlcpy(pendingTitle, title, sizeof(pendingTitle));
  strlcpy(pendingAlbum, album, sizeof(pendingAlbum));
  pendingSwitch = true;
#endif
}

void SdRecorder::closeFile() {
#if FEATURE_SPOTIFY_RECORD
  if (!wavFile) return;
  writeWavHeader(wavFile, dataBytes);
  wavFile.close();
#endif
}

void SdRecorder::openFile(const char* artist, const char* title, const char* album) {
#if FEATURE_SPOTIFY_RECORD
  char dir[96], path[192];
  snprintf(dir, sizeof(dir), DIR_SPOTIFY_REC "/%s", album[0] ? album : "Sin_album");
  for (char* p = dir + strlen(DIR_SPOTIFY_REC) + 1; *p; p++) if (strchr("\\/:*?\"<>|", *p)) *p = '_';
  SD.mkdir(DIR_SPOTIFY_REC); SD.mkdir(dir);
  snprintf(path, sizeof(path), "%s/%s - %s.wav", dir, artist, title);
  wavFile = SD.open(path, FILE_WRITE);
  dataBytes = 0;
  if (wavFile) writeWavHeader(wavFile, 0);
#endif
}

void SdRecorder::run() {
#if FEATURE_SPOTIFY_RECORD
  static uint8_t chunk[4096];
  for (;;) {
    if (pendingSwitch) {
      pendingSwitch = false;
      closeFile();
      if (_enabled && albumQueued(pendingAlbum)) openFile(pendingArtist, pendingTitle, pendingAlbum);
    }
    size_t n = xStreamBufferReceive(recBuf, chunk, sizeof(chunk), pdMS_TO_TICKS(100));
    if (n && wavFile) { wavFile.write(chunk, n); dataBytes += n; }
  }
#endif
}

void taskRecorder(void*) { recorder.run(); vTaskDelete(nullptr); }
