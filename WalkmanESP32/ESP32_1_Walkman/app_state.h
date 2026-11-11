#pragma once
#include <Arduino.h>

// ============================================================================
// Estado compartido entre tareas. Escrituras cortas protegidas con stateMux.
// ============================================================================

enum ScreenMode  : uint8_t { SCR_PLAYER, SCR_MENU, SCR_EQ, SCR_VIDEO };
enum MenuCat     : uint8_t { CAT_SD, CAT_VIDEO, CAT_SPOTIFY, CAT_SAVE_SD, CAT_OUTPUT, CAT_COUNT };
// "MediaSource" y no "AudioSource": AudioTools.h ya define audio_tools::AudioSource y hace using namespace
enum MediaSource : uint8_t { SRC_NONE, SRC_SD, SRC_SPOTIFY, SRC_VIDEO };
enum OutputMode  : uint8_t { OUT_JACK, OUT_BT };

enum CmdType : uint8_t {
  CMD_PLAY_INDEX,   // arg = índice en la biblioteca
  CMD_TOGGLE_PAUSE,
  CMD_NEXT,
  CMD_PREV,
  CMD_SEEK,         // arg = posición en ms
  CMD_STOP,
  CMD_OPEN_VIDEO,   // arg = índice en la lista de vídeos
  CMD_SOURCE_SPOTIFY
};

struct AudioCmd { CmdType type; int32_t arg; };

struct TrackMeta {
  char title[64];
  char artist[48];
  char album[48];
  char format[8];     // "MP3" "FLAC" "WAV" "OGG" "SPOTIFY" "VIDEO"
  char bitrate[24];   // "320 kbps" / "16/44.1"
  uint32_t durationMs;
};

struct EqSettings { int8_t bass, mid, treble; };   // -12..+12 dB

struct AppState {
  // Pantalla
  ScreenMode screen = SCR_PLAYER;
  MenuCat    menuCat = CAT_SD;
  int        sdScroll = 0;
  int        videoScroll = 0;
  bool       lyricsExpanded = false;
  bool       videoDockHidden = false;
  bool       dirty = true;              // fuerza redibujo completo

  // Reproducción
  MediaSource source = SRC_NONE;
  bool       playing = false;
  int        trackIdx = -1;
  int        videoIdx = -1;
  uint32_t   posMs = 0;
  TrackMeta  meta = {};
  float      vuL = 0, vuR = 0;

  // Bluetooth
  bool       phoneConnected = false;    // a2dp_sink.is_connected()
  OutputMode output = OUT_JACK;
  bool       btHeadphonesLinked = false;
  char       btHeadphonesName[40] = "";
  bool       bridgeAlive = false;       // el ESP32 #2 responde

  // DSP
  EqSettings eq = {7, 4, 5};
  bool       megaBass = true;
  char       presetName[16] = "MEGA BASS";
  uint8_t    volume = 85;               // 0..100

  // Aviso flotante
  char       toast[48] = "";
  uint32_t   toastUntil = 0;

  // Grabación (desactivada en v1)
  bool       recordingArmed = false;
};

extern AppState g;
extern portMUX_TYPE stateMux;
extern QueueHandle_t cmdQueue;
extern SemaphoreHandle_t sdMutex;

void showToast(const char* msg, uint32_t ms = 2200);
bool sendCmd(CmdType t, int32_t arg = 0);
