#pragma once
#include <Arduino.h>

// ============================================================================
// Spotify (o cualquier app) desde el teléfono: A2DP Sink + AVRCP
// El menú Spotify solo se desbloquea si a2dp_sink.is_connected() == true.
// ============================================================================

class SpotifyBT {
public:
  void begin();
  bool phoneConnected();               // a2dp_sink.is_connected()
  void takeOutput();                   // la fuente pasa a ser el teléfono → enviar PLAY
  void releaseOutput();                // otra fuente toma el I2S → enviar PAUSE
  void togglePlay();
  void next();
  void previous();
  uint32_t positionMs() const;
  void pollLyrics();                   // carga /LYRICS/Artista - Titulo.lrc al cambiar de pista (taskUI)
  void suspend(bool s);                // el vídeo suspende el stream para liberar CPU

  // Álbumes/playlists vistos por AVRCP (AVRCP no permite explorar las playlists del móvil)
  static const int MAX_SEEN = 4;
  struct Seen { char name[40]; uint16_t tracks; bool queuedForSd; };
  Seen seen[MAX_SEEN];
  int  seenCount = 0;

private:
  bool _outputTaken = false;
};

extern SpotifyBT spotify;
