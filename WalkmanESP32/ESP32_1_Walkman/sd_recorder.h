#pragma once
#include <Arduino.h>
#include "config.h"

// ============================================================================
// Grabadora "Guardar Playlist en MicroSD"  — PREPARADA PERO DESACTIVADA (v1)
//   AudioTee: DspOutput copia el PCM pre-EQ a un StreamBuffer (no bloquea el BT)
//   taskRecorder vacía el buffer a /SPOTIFY/<album>/<artista - titulo>.wav
//   Cada evento AVRCP "track change" cierra el WAV (parchea cabecera) y abre otro.
// Activar: FEATURE_SPOTIFY_RECORD 1 en config.h  y  recorder.setEnabled(true)
// ============================================================================

class SdRecorder {
public:
  void begin();
  void setEnabled(bool e) { _enabled = e && FEATURE_SPOTIFY_RECORD; }
  bool enabled() const { return _enabled; }
  void tee(const int16_t* lr, size_t frames);          // desde DspOutput (contexto BT)
  void onTrackChange(const char* artist, const char* title, const char* album);
  bool albumQueued(const char* album) const;
  void run();                                          // cuerpo de taskRecorder
private:
  void closeFile();
  void openFile(const char* artist, const char* title, const char* album);
  volatile bool _enabled = false;
};

extern SdRecorder recorder;
void taskRecorder(void*);
