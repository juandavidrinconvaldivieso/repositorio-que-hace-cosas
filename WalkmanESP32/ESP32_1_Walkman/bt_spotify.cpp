#include "bt_spotify.h"
#include "BluetoothA2DPSink.h"
#include "config.h"
#include "app_state.h"
#include "audio_engine.h"
#include "lrc_parser.h"
#include "sd_recorder.h"
#include <SD.h>

SpotifyBT spotify;

// Salida "con puerta": el teléfono solo suena si la fuente activa es Spotify
class GatedSpotifyOut : public Print {
public:
  size_t write(uint8_t) override { return 1; }
  size_t write(const uint8_t* d, size_t n) override {
    if (g.source == SRC_SPOTIFY) audio.dspOut.write(d, n);
    return n;
  }
} gatedOut;

static BluetoothA2DPSink a2dp_sink(gatedOut);

static char     newTitle[64], newArtist[48], newAlbum[48];
static volatile bool metaChanged = false;
static volatile uint32_t posBaseMs = 0, posBaseAt = 0;
static volatile bool phonePlaying = false;

static void onMetadata(uint8_t id, const uint8_t* text) {
  const char* t = (const char*)text;
  switch (id) {
    case ESP_AVRC_MD_ATTR_TITLE:  utf8ToAscii(t, newTitle, sizeof(newTitle)); metaChanged = true; break;
    case ESP_AVRC_MD_ATTR_ARTIST: utf8ToAscii(t, newArtist, sizeof(newArtist)); break;
    case ESP_AVRC_MD_ATTR_ALBUM:  utf8ToAscii(t, newAlbum, sizeof(newAlbum)); break;
    case ESP_AVRC_MD_ATTR_PLAYING_TIME: g.meta.durationMs = atol(t); break;
    default: break;
  }
}

static void onPlayStatus(esp_avrc_playback_stat_t st) {
  phonePlaying = (st == ESP_AVRC_PLAYBACK_PLAYING);
  posBaseAt = millis();
  if (g.source == SRC_SPOTIFY) { g.playing = phonePlaying; g.dirty = true; }
}

static void onPlayPos(uint32_t posMs) {
  posBaseMs = posMs;
  posBaseAt = millis();
}

static void onConnState(esp_a2d_connection_state_t st, void*) {
  bool conn = (st == ESP_A2D_CONNECTION_STATE_CONNECTED);
  g.phoneConnected = conn;
  g.dirty = true;
  if (conn) showToast("Telefono conectado: Spotify desbloqueado");
  else {
    if (g.source == SRC_SPOTIFY) { g.source = SRC_NONE; g.playing = false; }
    if (g.menuCat == CAT_SPOTIFY || g.menuCat == CAT_SAVE_SD) g.menuCat = CAT_SD;
    showToast("Telefono desconectado");
  }
}

void SpotifyBT::begin() {
  a2dp_sink.set_avrc_metadata_attribute_mask(ESP_AVRC_MD_ATTR_TITLE | ESP_AVRC_MD_ATTR_ARTIST |
                                             ESP_AVRC_MD_ATTR_ALBUM | ESP_AVRC_MD_ATTR_PLAYING_TIME);
  a2dp_sink.set_avrc_metadata_callback(onMetadata);
  a2dp_sink.set_avrc_rn_playstatus_callback(onPlayStatus);
  a2dp_sink.set_avrc_rn_play_pos_callback(onPlayPos, 1);     // posición cada 1 s → LRC preciso
  a2dp_sink.set_on_connection_state_changed(onConnState);
  a2dp_sink.set_auto_reconnect(true);
  a2dp_sink.start(BT_SINK_NAME);
}

bool SpotifyBT::phoneConnected() { return a2dp_sink.is_connected(); }

void SpotifyBT::takeOutput() {
  _outputTaken = true;
  strlcpy(g.meta.format, "SPOTIFY", sizeof(g.meta.format));
  strlcpy(g.meta.bitrate, "A2DP SBC 44.1k", sizeof(g.meta.bitrate));
  metaChanged = true;                                         // refrescar título/letra
  a2dp_sink.play();
  g.playing = true;
  g.dirty = true;
}

void SpotifyBT::releaseOutput() {
  if (!_outputTaken) return;
  _outputTaken = false;
  if (a2dp_sink.is_connected()) a2dp_sink.pause();
}

void SpotifyBT::togglePlay() { phonePlaying ? a2dp_sink.pause() : a2dp_sink.play(); }
void SpotifyBT::next()       { a2dp_sink.next(); }
void SpotifyBT::previous()   { a2dp_sink.previous(); }

void SpotifyBT::suspend(bool s) {
  // Durante el vídeo: pausa el teléfono (A2DP sigue enlazado, el menú sigue desbloqueado)
  if (s && phonePlaying) a2dp_sink.pause();
}

uint32_t SpotifyBT::positionMs() const {
  return posBaseMs + (phonePlaying ? (millis() - posBaseAt) : 0);
}

void SpotifyBT::pollLyrics() {
  if (!metaChanged) return;
  metaChanged = false;
  portENTER_CRITICAL(&stateMux);
  if (g.source == SRC_SPOTIFY) {
    strlcpy(g.meta.title, newTitle, sizeof(g.meta.title));
    strlcpy(g.meta.artist, newArtist, sizeof(g.meta.artist));
    strlcpy(g.meta.album, newAlbum, sizeof(g.meta.album));
    g.dirty = true;
  }
  portEXIT_CRITICAL(&stateMux);

  // Lista de álbumes/playlists vistos (para "Guardar en MicroSD")
  if (newAlbum[0]) {
    int i = 0;
    for (; i < seenCount; i++) if (!strcmp(seen[i].name, newAlbum)) { seen[i].tracks++; break; }
    if (i == seenCount) {
      if (seenCount == MAX_SEEN) { memmove(&seen[0], &seen[1], sizeof(Seen) * (MAX_SEEN - 1)); seenCount--; }
      strlcpy(seen[seenCount].name, newAlbum, sizeof(seen[0].name));
      seen[seenCount].tracks = 1; seen[seenCount].queuedForSd = false;
      seenCount++;
    }
  }

  recorder.onTrackChange(newArtist, newTitle, newAlbum);    // no hace nada en v1

  if (g.source == SRC_SPOTIFY) {
    char path[128];
    snprintf(path, sizeof(path), DIR_LYRICS "/%s - %s.lrc", newArtist, newTitle);
    if (!SD.exists(path) || !lyrics.loadLrc(SD, path)) lyrics.clear();
  }
}
