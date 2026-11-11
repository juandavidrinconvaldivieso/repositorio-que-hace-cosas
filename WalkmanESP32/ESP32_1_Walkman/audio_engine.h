#pragma once
#include <Arduino.h>
#include <SD.h>
#include "AudioTools.h"
#include "app_state.h"

// ============================================================================
// Motor de audio (taskAudio, core 0)
//   SD → Decoder (MP3/WAV/FLAC/OGG) → ResampleStream(→44.1k) → DspOutput → I2S0 Master
//   A2DP Sink (Spotify) ───────────────────────────────────────→ DspOutput
// I2S0 alimenta a la vez al PCM5102A (jack) y al ESP32 #2 (BT): mismos 3 cables.
// ============================================================================

// Salida final: convierte a estéreo 16 bit, aplica DSP, cuenta muestras (reloj del vídeo)
class DspOutput : public AudioOutput {
public:
  explicit DspOutput(Print& out) : _out(out) {}
  void setAudioInfo(AudioInfo info) override;
  size_t write(const uint8_t* data, size_t len) override;
  int availableForWrite() override { return 1024; }
  uint64_t framesWritten() const { return _frames; }
  void resetClock() { _frames = 0; }
  SemaphoreHandle_t mutex = nullptr;   // SD y A2DP no escriben a la vez
private:
  Print& _out;
  uint8_t _channels = 2, _bits = 16;
  int16_t _tmp[512];                   // 256 frames estéreo
  volatile uint64_t _frames = 0;
};

class AudioEngine {
public:
  bool begin();
  void playTrack(int idx);
  void playFile(const char* path, bool isVideoAudio);
  void stop();
  void togglePause();
  void seekMs(uint32_t ms);
  bool canSeek() const;
  uint32_t positionMs() const;
  uint64_t clockFrames() const { return dspOut.framesWritten(); }
  void loopOnce();                     // decodifica un bloque
  void handleCmd(const AudioCmd& c);

  I2SStream i2s;
  DspOutput dspOut{i2s};

private:
  bool openDecoder(uint8_t fmt);
  void readDuration(uint8_t fmt);
  void onTrackEnd();

  ResampleStream resample{dspOut};
  EncodedAudioStream decoded;
  StreamCopy copier;
  File file;
  AudioDecoder* decoder = nullptr;
  uint8_t curFmt = 0;
  bool active = false, paused = false, videoAudio = false;
  uint64_t startFrame = 0;             // frames emitidos al empezar (o tras seek)
  uint32_t seekBaseMs = 0;
};

extern AudioEngine audio;
void taskAudio(void*);
