#include "audio_engine.h"
#include "AudioTools/AudioCodecs/CodecMP3Helix.h"
#include "AudioTools/AudioCodecs/CodecFLAC.h"
#include "AudioTools/AudioCodecs/CodecVorbis.h"
#include "config.h"
#include "app_state.h"
#include "dsp_biquad.h"
#include "media_library.h"
#include "lrc_parser.h"
#include "bt_spotify.h"
#include "sd_recorder.h"

AudioEngine audio;

static MP3DecoderHelix decMp3;
static WAVDecoder      decWav;
// FLAC y Vorbis son StreamingDecoder (leen ellos del Stream): DecoderAdapter
// les da la interfaz write() de AudioDecoder que usa EncodedAudioStream.
static FLACDecoder     flacStream;
static VorbisDecoder   oggStream;
static DecoderAdapter  decFlac(flacStream, 4096);
static DecoderAdapter  decOgg(oggStream, 4096);

// ---------------------------------------------------------------- DspOutput
void DspOutput::setAudioInfo(AudioInfo info) {
  _channels = info.channels ? info.channels : 2;
  _bits = info.bits_per_sample ? info.bits_per_sample : 16;
  // Ojo: NO se propaga a I2S. La salida física es SIEMPRE 44100/16/2.
}

size_t DspOutput::write(const uint8_t* data, size_t len) {
  if (!mutex || xSemaphoreTake(mutex, pdMS_TO_TICKS(50)) != pdTRUE) return len;
  size_t consumed = 0;
  const size_t inFrameBytes = _channels * (_bits / 8);

  while (consumed + inFrameBytes <= len) {
    size_t frames = min((len - consumed) / inFrameBytes, (size_t)256);
    const uint8_t* p = data + consumed;
    for (size_t i = 0; i < frames; i++) {
      int16_t l, r;
      if (_bits == 16) {
        const int16_t* s = (const int16_t*)p + i * _channels;
        l = s[0]; r = _channels > 1 ? s[1] : s[0];       // mono → duplicar
      } else {                                           // 32 bit (FLAC 24 bit llega en int32)
        const int32_t* s = (const int32_t*)p + i * _channels;
        l = s[0] >> 16; r = (_channels > 1 ? s[1] : s[0]) >> 16;
      }
      _tmp[2 * i] = l; _tmp[2 * i + 1] = r;
    }
#if FEATURE_SPOTIFY_RECORD
    // AudioTee: copia PRE-ecualizador hacia la grabadora (no bloqueante)
    if (g.source == SRC_SPOTIFY) recorder.tee(_tmp, frames);
#endif
    dsp.process(_tmp, frames);
    _out.write((const uint8_t*)_tmp, frames * 4);
    _frames += frames;
    consumed += frames * inFrameBytes;
  }
  xSemaphoreGive(mutex);
  return len;
}

// ---------------------------------------------------------------- AudioEngine
bool AudioEngine::begin() {
  dspOut.mutex = xSemaphoreCreateMutex();

  auto cfg = i2s.defaultConfig(TX_MODE);
  cfg.sample_rate = OUT_SAMPLE_RATE;
  cfg.channels = 2;
  cfg.bits_per_sample = 16;
  cfg.pin_bck = PIN_I2S_BCK;
  cfg.pin_ws = PIN_I2S_WS;
  cfg.pin_data = PIN_I2S_DOUT;
  cfg.use_apll = true;        // reloj más preciso → menos deriva en el ESP32 #2
  cfg.auto_clear = true;      // silencio automático si no llegan datos (reloj I2S nunca para)
  cfg.buffer_count = 8;
  cfg.buffer_size = 512;
  if (!i2s.begin(cfg)) return false;

  dsp.begin(OUT_SAMPLE_RATE);
  dsp.setEq(g.eq.bass, g.eq.mid, g.eq.treble, g.megaBass);
  dsp.setVolume(g.volume);

  auto rc = resample.defaultConfig();
  rc.sample_rate = OUT_SAMPLE_RATE; rc.channels = 2; rc.bits_per_sample = 16;
  rc.to_sample_rate = OUT_SAMPLE_RATE;     // al cambiar la entrada, ResampleStream recalcula el paso
  resample.begin(rc);
  copier.resize(2048);
  return true;
}

bool AudioEngine::openDecoder(uint8_t fmt) {
  switch (fmt) {
    case FMT_MP3:  decoder = &decMp3;  break;
    case FMT_WAV:  decoder = &decWav;  break;
    case FMT_FLAC: decoder = &decFlac; break;
    case FMT_OGG:  decoder = &decOgg;  break;
    default: return false;
  }
  decoded.end();
  decoded.setOutput(resample);
  decoded.setDecoder(decoder);
  if (!decoded.begin()) return false;
  copier.begin(decoded, file);
  return true;
}

// Duración: WAV y FLAC exactas desde la cabecera; MP3/OGG estimación por tamaño
void AudioEngine::readDuration(uint8_t fmt) {
  uint32_t dur = 0; uint8_t h[64];
  size_t pos = file.position();
  file.seek(0);
  size_t n = file.read(h, sizeof(h));
  file.seek(pos);
  if (fmt == FMT_WAV && n >= 44 && !memcmp(h, "RIFF", 4)) {
    uint32_t byteRate = h[28] | h[29] << 8 | h[30] << 16 | h[31] << 24;
    if (byteRate) dur = (uint32_t)((uint64_t)(file.size() - 44) * 1000 / byteRate);
    snprintf(g.meta.bitrate, sizeof(g.meta.bitrate), "%d bit / %.1fk", h[34], (h[24] | h[25] << 8 | h[26] << 16) / 1000.0f);
  } else if (fmt == FMT_FLAC && n >= 42 && !memcmp(h, "fLaC", 4)) {
    // STREAMINFO: 20 bits sample rate, 3 canales, 5 bits/muestra, 36 bits total muestras
    const uint8_t* si = h + 8;
    uint32_t sr = (si[10] << 12) | (si[11] << 4) | (si[12] >> 4);
    uint8_t bps = (((si[12] & 1) << 4) | (si[13] >> 4)) + 1;
    uint64_t total = ((uint64_t)(si[13] & 0x0F) << 32) | (si[14] << 24) | (si[15] << 16) | (si[16] << 8) | si[17];
    if (sr) dur = (uint32_t)(total * 1000 / sr);
    snprintf(g.meta.bitrate, sizeof(g.meta.bitrate), "FLAC %d/%.1fk", bps, sr / 1000.0f);
  } else {
    uint32_t kbps = (fmt == FMT_OGG) ? 160 : 192;     // estimación hasta conocer el bitrate real
    dur = (uint32_t)((uint64_t)file.size() * 8 / kbps);
    snprintf(g.meta.bitrate, sizeof(g.meta.bitrate), "%s ~%u kbps", fmt == FMT_OGG ? "OGG" : "MP3", (unsigned)kbps);
  }
  g.meta.durationMs = dur;
}

void AudioEngine::playFile(const char* path, bool isVideoAudio) {
  stop();
  file = SD.open(path, FILE_READ);
  if (!file) { showToast("No se pudo abrir el archivo"); return; }
  curFmt = MediaLibrary::formatFromName(path);
  readDuration(curFmt);
  if (!openDecoder(curFmt)) {
    file.close();
    showToast(curFmt == FMT_OGG ? "OGG: sin memoria, saltando" : "Formato no soportado");
    return;
  }
  videoAudio = isVideoAudio;
  active = true; paused = false;
  startFrame = dspOut.framesWritten(); seekBaseMs = 0;
  dsp.reset();
  g.playing = true;
  g.source = isVideoAudio ? SRC_VIDEO : SRC_SD;
}

void AudioEngine::playTrack(int idx) {
  if (idx < 0 || idx >= library.trackCount()) return;
  spotify.releaseOutput();                       // si venía de Spotify, pausar el teléfono
  const MediaEntry& e = library.track(idx);
  portENTER_CRITICAL(&stateMux);
  g.trackIdx = idx;
  strlcpy(g.meta.title, e.title, sizeof(g.meta.title));
  strlcpy(g.meta.artist, e.artist, sizeof(g.meta.artist));
  strlcpy(g.meta.album, "MicroSD", sizeof(g.meta.album));
  strlcpy(g.meta.format, MediaLibrary::formatLabel(e.fmt), sizeof(g.meta.format));
  g.dirty = true;
  portEXIT_CRITICAL(&stateMux);

  // Letra: mismo nombre .lrc junto al audio, si no en /LYRICS/
  char lrc[LIB_PATH_LEN];
  if (library.siblingWithExt(e.path, ".lrc", lrc, sizeof(lrc))) lyrics.loadLrc(SD, lrc);
  else {
    const char* base = strrchr(e.path, '/');
    snprintf(lrc, sizeof(lrc), DIR_LYRICS "%s", base ? base : "/x");
    char* dot = strrchr(lrc, '.'); if (dot) strcpy(dot, ".lrc");
    if (!SD.exists(lrc) || !lyrics.loadLrc(SD, lrc)) lyrics.clear();
  }
  playFile(e.path, false);
}

void AudioEngine::stop() {
  if (active) { decoded.end(); file.close(); }
  active = false; paused = false;
  g.playing = false;
}

void AudioEngine::togglePause() {
  if (g.source == SRC_SPOTIFY) { spotify.togglePlay(); return; }
  if (!active) { if (library.trackCount()) playTrack(max(0, g.trackIdx)); return; }
  paused = !paused;
  g.playing = !paused;
  g.dirty = true;
}

bool AudioEngine::canSeek() const {
  // FLAC/OGG necesitan tabla de seek: en v1 solo se salta en MP3 y WAV
  return active && (curFmt == FMT_MP3 || curFmt == FMT_WAV);
}

void AudioEngine::seekMs(uint32_t ms) {
  if (g.source == SRC_VIDEO && !active) {          // vídeo sin audio: solo mover el reloj
    seekBaseMs = ms; startFrame = dspOut.framesWritten(); return;
  }
  if (!canSeek() || !g.meta.durationMs) { showToast("Salto no disponible en este formato"); return; }
  if (ms > g.meta.durationMs) ms = g.meta.durationMs;
  uint32_t dataStart = curFmt == FMT_WAV ? 44 : 0;
  uint64_t target = dataStart + (uint64_t)(file.size() - dataStart) * ms / g.meta.durationMs;
  if (curFmt == FMT_WAV) target &= ~3ULL;          // alinear a frame estéreo 16 bit
  file.seek(target);
  if (curFmt == FMT_MP3) decMp3.begin();           // re-sincroniza con la siguiente cabecera MP3
  seekBaseMs = ms;
  startFrame = dspOut.framesWritten();
}

uint32_t AudioEngine::positionMs() const {
  if (g.source == SRC_SPOTIFY) return spotify.positionMs();
  return seekBaseMs + (uint32_t)((dspOut.framesWritten() - startFrame) * 1000ULL / OUT_SAMPLE_RATE);
}

void AudioEngine::onTrackEnd() {
  stop();
  if (videoAudio) return;                          // el vídeo decide qué hacer al terminar
  int next = g.trackIdx + 1;
  if (next < library.trackCount()) playTrack(next);
  else g.dirty = true;
}

void AudioEngine::handleCmd(const AudioCmd& c) {
  switch (c.type) {
    case CMD_PLAY_INDEX:   playTrack(c.arg); break;
    case CMD_TOGGLE_PAUSE: togglePause(); break;
    case CMD_NEXT:
      if (g.source == SRC_SPOTIFY) spotify.next();
      else if (g.source == SRC_SD) playTrack((g.trackIdx + 1) % max(1, library.trackCount()));
      break;
    case CMD_PREV:
      if (g.source == SRC_SPOTIFY) spotify.previous();
      else if (g.source == SRC_SD) {
        if (positionMs() > 3000) playTrack(g.trackIdx);        // como en un Walkman: reinicia
        else playTrack(g.trackIdx > 0 ? g.trackIdx - 1 : library.trackCount() - 1);
      }
      break;
    case CMD_SEEK:  seekMs((uint32_t)c.arg); break;
    case CMD_STOP:  stop(); g.source = SRC_NONE; break;
    case CMD_OPEN_VIDEO: {
      // El audio del vídeo es un archivo hermano .mp3 o .wav
      char snd[LIB_PATH_LEN];
      const MediaEntry& v = library.video(c.arg);
      spotify.releaseOutput();
      if (library.siblingWithExt(v.path, ".mp3", snd, sizeof(snd)) ||
          library.siblingWithExt(v.path, ".wav", snd, sizeof(snd))) playFile(snd, true);
      else { stop(); g.source = SRC_VIDEO; g.playing = true; startFrame = dspOut.framesWritten(); seekBaseMs = 0; }
      break;
    }
    case CMD_SOURCE_SPOTIFY:
      stop();
      g.source = SRC_SPOTIFY;
      spotify.takeOutput();
      break;
  }
}

void AudioEngine::loopOnce() {
  if (!active || paused) {
    // Vídeo sin pista de audio: el reloj avanza escribiendo silencio
    if (g.source == SRC_VIDEO && !active && !paused && g.playing) {
      static const uint8_t silence[1024] = {0};
      dspOut.write(silence, sizeof(silence));
    } else {
      vTaskDelay(pdMS_TO_TICKS(10));
    }
    return;
  }
  size_t n = copier.copy();
  if (n == 0 && !file.available()) onTrackEnd();
}

void taskAudio(void*) {
  AudioCmd c;
  uint8_t lastVol = 255;
  for (;;) {
    while (xQueueReceive(cmdQueue, &c, 0) == pdTRUE) audio.handleCmd(c);
    if (g.volume != lastVol) { lastVol = g.volume; dsp.setVolume(lastVol); }
    audio.loopOnce();

    // VU con caída suave
    float l = dsp.peakL(), r = dsp.peakR();
    g.vuL = l > g.vuL ? l : g.vuL * 0.92f;
    g.vuR = r > g.vuR ? r : g.vuR * 0.92f;
    g.posMs = audio.positionMs();
    taskYIELD();
  }
}
