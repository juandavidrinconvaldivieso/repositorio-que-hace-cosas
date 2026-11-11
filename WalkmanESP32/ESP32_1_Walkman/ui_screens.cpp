#include "ui_screens.h"
#include "ui_aero.h"
#include "config.h"
#include "app_state.h"
#include "audio_engine.h"
#include "bt_spotify.h"
#include "dsp_biquad.h"
#include "lrc_parser.h"
#include "media_library.h"
#include "uart_link.h"
#include "video_player.h"
#include <Preferences.h>

using namespace aero;

static float reelAngle = 0;
static int   lastLyricIdx = -2;
static bool  toastVisible = false;

// ============================================================ helpers
static void fmtTime(uint32_t ms, char* out) {
  uint32_t s = ms / 1000;
  sprintf(out, "%02u:%02u", (unsigned)(s / 60), (unsigned)(s % 60));
}

static uint32_t curDuration() {
  if (g.screen == SCR_VIDEO && video.durationMs()) return video.durationMs();
  return g.meta.durationMs ? g.meta.durationMs : 1;
}

static void clip(const char* in, char* out, int maxChars) {
  if (in == out) { if ((int)strlen(out) > maxChars) out[maxChars] = 0; return; }
  strlcpy(out, in, maxChars + 1);
}

static void handleDrag(int x, int y);

static void setOutput(OutputMode m) {
  g.output = m;
  bridge.enable(m == OUT_BT);
#if defined(PIN_DAC_MUTE) && PIN_DAC_MUTE >= 0
  digitalWrite(PIN_DAC_MUTE, m == OUT_BT ? LOW : HIGH);   // XSMT: LOW = jack en silencio
#endif
  g.dirty = true;
}

static void applyEq() {
  dsp.setEq(g.eq.bass, g.eq.mid, g.eq.treble, g.megaBass);
}

// ============================================================ barra superior (Y 0..20)
static void drawStatusBar(Gfx& G) {
  if (!G.rectIn(0, 0, 320, 20)) return;
  for (int y = 0; y < 20; y++) {
    float t = y / 20.0f;
    uint32_t c = t < 0.5f ? lerp(OPQ(0xf1f5f9), OPQ(0xcbd5e1), t * 2)
               : t < 0.52f ? OPQ(0x94a3b8) : lerp(OPQ(0x94a3b8), OPQ(0xe2e8f0), (t - 0.52f) / 0.48f);
    hspan(G, y, 0, 320, c);
  }
  gelPill(G, 3, 2, 22, 16, 5, OPQ(0x06b6d4), OPQ(0x0369a1));
  text(G, "W.", 7, 10, 1, 0xFFFFFF);

  bool spot = g.source == SRC_SPOTIFY;
  gelPill(G, 28, 2, 52, 16, 7, OPQ(spot ? 0x10b981 : 0x0284c7), OPQ(spot ? 0x047857 : 0x0369a1));
  text(G, g.meta.format[0] ? g.meta.format : "---", 33, 10, 1, 0xFFFFFF);

  bool ph = g.phoneConnected;
  gelPill(G, 84, 2, 84, 16, 7, OPQ(ph ? 0x10b981 : 0x64748b), OPQ(ph ? 0x047857 : 0x334155));
  text(G, ph ? "Phone: ON" : "No Phone", 92, 10, 1, 0xFFFFFF);
  if (!ph) iconLock(G, 154, 5, 0xfda4af);

  bool bt = g.output == OUT_BT;
  gelPill(G, 171, 2, 72, 16, 7, OPQ(bt ? 0x0891b2 : 0x334155), OPQ(bt ? 0x155e75 : 0x0f172a));
  text(G, bt ? "BT Audio" : "Jack 3.5", 180, 10, 1, 0xFFFFFF);
  if (!g.bridgeAlive) fillCircleA(G, 238, 6, 2, OPQ(0xf43f5e));    // #2 sin respuesta

  gelPill(G, 246, 2, 38, 16, 6, OPQ(g.megaBass ? 0x06b6d4 : 0x64748b), OPQ(g.megaBass ? 0x0e7490 : 0x334155));
  text(G, "BASS+", 250, 10, 1, 0xFFFFFF);

  // Batería: divisor 1/2, 4.2 V = lleno, 3.3 V = vacío
  static float vbat = 4.0f;
  vbat = vbat * 0.9f + (analogReadMilliVolts(PIN_BATTERY) * 2 / 1000.0f) * 0.1f;
  float lvl = constrain((vbat - 3.3f) / 0.9f, 0.05f, 1.0f);
  fillRectA(G, 290, 4, 23, 1, OPQ(0x334155)); fillRectA(G, 290, 15, 23, 1, OPQ(0x334155));
  fillRectA(G, 290, 4, 1, 12, OPQ(0x334155)); fillRectA(G, 312, 4, 1, 12, OPQ(0x334155));
  fillRectA(G, 313, 7, 2, 6, OPQ(0x334155));
  uint32_t bc = lvl > 0.25f ? 0x4ade80 : 0xf87171;
  gelPill(G, 292, 6, max(3, (int)(18 * lvl)), 8, 2, OPQ(bc), OPQ(lvl > 0.25f ? 0x16a34a : 0xb91c1c));
}

// ============================================================ PLAYER
static void drawPlayer(Gfx& G) {
  bool ex = g.lyricsExpanded;
  char buf[80];

  if (!ex && G.rectIn(5, 23, 86, 168)) {
    glassPanel(G, 5, 23, 86, 168, 9);
    gelPill(G, 10, 28, 76, 84, 8, OPQ(0x0ea5e9), OPQ(0x1e3a8a), RGBA(0xFFFFFF, 0.8f));   // carátula
    fillRectA(G, 14, 32, 68, 16, RGBA(0x040F1E, 0.55f));
    text(G, "W. WALKMAN", 18, 40, 1, 0xFFFFFF);

    // Ventana del casete + 2 carretes de cristal
    gelPill(G, 14, 52, 68, 38, 6, RGBA(0x06182C, 0.72f), RGBA(0x06182C, 0.72f), RGBA(0xA5F3FC, 0.65f));
    for (int rx : {31, 65}) {
      fillCircleA(G, rx, 71, 11, RGBA(0x38bdf8, 0.28f));
      ringA(G, rx, 71, 11, 1.4f, OPQ(0xe0f2fe));
      for (int k = 0; k < 3; k++) {
        float a = reelAngle + k * 2.0944f;
        lineA(G, rx + sinf(a) * 3, 71 - cosf(a) * 3, rx + sinf(a) * 10, 71 - cosf(a) * 10, OPQ(0xFFFFFF));
      }
      fillCircleA(G, rx, 71, 3, OPQ(0x38bdf8));
    }
    text(G, "CLEAR AUDIO+", 13, 102, 1, 0xFFFFFF);

    // Vúmetros L/R
    text(G, "L", 13, 126, 1, 0xbae6fd);
    text(G, "R", 13, 140, 1, 0xbae6fd);
    glassPanel(G, 22, 121, 58, 10, 4);
    glassPanel(G, 22, 135, 58, 10, 4);
    gelPill(G, 23, 122, constrain((int)(g.vuL * 56), 4, 56), 8, 3, OPQ(0x34d399), OPQ(0x0284c7));
    gelPill(G, 23, 136, constrain((int)(g.vuR * 56), 4, 56), 8, 3, OPQ(0x22d3ee), OPQ(0x0284c7));

    gelPill(G, 11, 152, 74, 16, 6, OPQ(0x0ea5e9), OPQ(0x0369a1));
    snprintf(buf, sizeof(buf), "EQ:%s", g.presetName);
    clip(buf, buf, 12);
    text(G, buf, 15, 160, 1, 0xFFFFFF);
    clip(g.meta.bitrate, buf, 13);
    text(G, buf, 10, 180, 1, 0x7dd3fc);
  }

  // Panel de letras
  int lx = ex ? 5 : 95, lw = ex ? 310 : 220;
  if (G.rectIn(lx, 23, lw, 168)) {
    glassPanel(G, lx, 23, lw, 168, 9);
    clip(g.meta.title[0] ? g.meta.title : "Sin reproduccion", buf, ex ? 30 : 19);
    text(G, buf, lx + 8, 34, 2, 0xFFFFFF);
    snprintf(buf, sizeof(buf), "%s - %s", g.meta.artist, g.meta.album);
    clip(buf, buf, ex ? 40 : 26);
    text(G, buf, lx + 8, 48, 1, 0x7dd3fc);

    int bx = lx + lw - 54;
    gelPill(G, bx, 27, 48, 16, 6, OPQ(ex ? 0x10b981 : 0x0284c7), OPQ(ex ? 0x047857 : 0x0369a1));
    text(G, ex ? "Normal" : "Letra+", bx + 6, 35, 1, 0xFFFFFF);
    hspan(G, 56, lx + 6, lx + lw - 6, RGBA(0x7dd3fc, 0.28f));

    uint32_t t = g.posMs;
    int idx = lyrics.indexAt(t);
    int maxC = ex ? 48 : 34;
    const LyricLine* prev = lyrics.line(idx - 1);
    const LyricLine* cur  = lyrics.line(idx);
    const LyricLine* n1   = lyrics.line(idx + 1);
    const LyricLine* n2   = lyrics.line(idx + 2);
    bool none = lyrics.count() == 0;

    clip(prev ? prev->text : "~ Walkman ClearAudio+  LRC Sync ~", buf, maxC);
    text(G, buf, lx + 10, 69, 1, 0x93C5DD);

    int cx = lx + 6, cy = 82, cw = lw - 12, ch = 44;
    glassPanel(G, cx, cy, cw, ch, 8, RGBA(0x67e8f9, 0.85f));
    float prog = lyrics.progressAt(t, curDuration());
    gelPill(G, cx + 1, cy + 1, max(16, (int)((cw - 2) * (none ? 0.08f : prog))), ch - 2, 7,
            RGBA(0x06b6d4, 0.55f), RGBA(0x0284c7, 0.72f), RGBA(0xFFFFFF, 0.4f));
    const char* curText = cur ? cur->text : (none ? "Sin letra .LRC para esta pista" : "...");
    int split = ex ? 40 : 28;
    if ((int)strlen(curText) <= split) {
      text(G, curText, cx + 8, cy + 22, 2, 0xFFFFFF);
    } else {
      const char* cut = curText + split;
      while (cut > curText && *cut != ' ') cut--;
      if (cut == curText) cut = curText + split;
      char r1[LYRIC_TEXT_LEN]; strlcpy(r1, curText, min((int)sizeof(r1), (int)(cut - curText) + 1));
      text(G, r1, cx + 8, cy + 13, 2, 0xFFFFFF);
      clip(*cut == ' ' ? cut + 1 : cut, buf, split + 4);
      text(G, buf, cx + 8, cy + 31, 2, 0xFFFFFF);
    }
    clip(n1 ? n1->text : "~ ... ~", buf, maxC);
    text(G, buf, lx + 10, 142, 1, 0xe0f2fe);
    clip(n2 ? n2->text : "", buf, maxC);
    text(G, buf, lx + 10, 162, 1, 0x93c5fd);

    snprintf(buf, sizeof(buf), "LRC [%d/%d]  toca la barra para saltar", idx + 1, lyrics.count());
    clip(buf, buf, maxC);
    text(G, buf, lx + 10, 181, 1, 0x34d399);
  }

  // Barra de progreso líquida (Y 194..210)
  if (G.rectIn(0, 190, 320, 20)) {
    char a[8], b[8];
    fmtTime(g.posMs, a); fmtTime(curDuration(), b);
    text(G, a, 6, 201, 1, 0xbae6fd);
    text(G, b, 284, 201, 1, 0xbae6fd);
    const int bx = 42, by = 197, bw = 236, bh = 8;
    float ratio = constrain((float)g.posMs / curDuration(), 0.0f, 1.0f);
    glassPanel(G, bx, by, bw, bh, 4);
    int fw = max(8, (int)(bw * ratio));
    gelPill(G, bx, by, fw, bh, 4, OPQ(0x22d3ee), OPQ(0x0284c7), OPQ(0xbae6fd));
    fillCircleA(G, bx + fw, by + bh / 2.0f, 5, OPQ(0xFFFFFF));
    ringA(G, bx + fw, by + bh / 2.0f, 5, 1.5f, OPQ(0x0284c7));
  }
}

// ============================================================ MENU
static const char* CAT_LABEL[CAT_COUNT] = {"MicroSD", "Videos", "Spotify BT", "Guardar SD", "Salida Audio"};

static bool catLocked(int c) { return (c == CAT_SPOTIFY || c == CAT_SAVE_SD) && !g.phoneConnected; }

static void drawListRowBase(Gfx& G, int y, bool active, int h = 33) {
  gelPill(G, 117, y, 192, h, 7, active ? OPQ(0x0ea5e9) : RGBA(0x0f172a, 0.75f),
          active ? OPQ(0x0369a1) : RGBA(0x1e293b, 0.85f), RGBA(0xbae6fd, 0.5f), active);
}

static void drawScrollButtons(Gfx& G) {
  gelPill(G, 277, 26, 15, 16, 5, OPQ(0x0284c7), OPQ(0x0369a1));
  gelPill(G, 294, 26, 15, 16, 5, OPQ(0x0284c7), OPQ(0x0369a1));
  iconTriangle(G, 284, 34, 6, true, 0xFFFFFF);
  iconTriangle(G, 301, 34, 6, false, 0xFFFFFF);
}

static void drawMenu(Gfx& G) {
  char buf[64];
  glassPanel(G, 5, 23, 102, 187, 9);
  for (int i = 0; i < CAT_COUNT; i++) {
    int cy = 29 + i * 36;
    if (!G.rectIn(10, cy, 92, 32)) continue;
    bool sel = g.menuCat == i, lock = catLocked(i);
    uint32_t top = lock ? OPQ(0x475569) : sel ? OPQ(0x06b6d4) : OPQ(0x1e293b);
    uint32_t bot = lock ? OPQ(0x1e293b) : sel ? OPQ(0x0369a1) : OPQ(0x0f172a);
    gelPill(G, 10, cy, 92, 32, 8, top, bot, RGBA(0xFFFFFF, 0.6f), sel);
    text(G, CAT_LABEL[i], 15, cy + 10, 2, lock ? 0xcbd5e1 : 0xFFFFFF);
    switch (i) {
      case CAT_SD:      snprintf(buf, sizeof(buf), "%d pistas", library.trackCount()); break;
      case CAT_VIDEO:   snprintf(buf, sizeof(buf), "%d clips MJPEG", library.videoCount()); break;
      case CAT_SPOTIFY: strcpy(buf, lock ? "Sin telefono" : "Conectado"); break;
      case CAT_SAVE_SD: strcpy(buf, lock ? "Sin telefono" : "Playlists"); break;
      default:          strcpy(buf, g.output == OUT_BT ? "ESP32#2 BT" : "Jack 3.5mm"); break;
    }
    text(G, buf, 15, cy + 24, 1, lock ? 0xfda4af : 0xbae6fd);
    if (lock) iconLock(G, 89, cy + 19, 0xfda4af);
  }

  glassPanel(G, 111, 23, 204, 187, 9);

  if (g.menuCat == CAT_SD) {
    snprintf(buf, sizeof(buf), "MicroSD (%d)", library.trackCount());
    text(G, buf, 118, 34, 1, 0xFFFFFF);
    gelPill(G, 218, 26, 56, 16, 6, OPQ(0x10b981), OPQ(0x047857));
    text(G, "Re-scan", 225, 34, 1, 0xFFFFFF);
    drawScrollButtons(G);
    g.sdScroll = constrain(g.sdScroll, 0, max(0, library.trackCount() - 4));
    for (int i = 0; i < 4 && g.sdScroll + i < library.trackCount(); i++) {
      int idx = g.sdScroll + i, ry = 46 + i * 38;
      if (!G.rectIn(117, ry, 192, 33)) continue;
      const MediaEntry& e = library.track(idx);
      drawListRowBase(G, ry, idx == g.trackIdx && g.source == SRC_SD);
      gelPill(G, 122, ry + 5, 34, 14, 4, OPQ(0x22d3ee), OPQ(0x0369a1));
      textCentered(G, MediaLibrary::formatLabel(e.fmt), 122, ry + 12, 34, 1, 0xFFFFFF);
      clip(e.title, buf, 22);
      text(G, buf, 161, ry + 12, 1, 0xFFFFFF);
      clip(e.artist, buf, 30);
      text(G, buf, 122, ry + 25, 1, 0xbae6fd);
    }
    if (!library.trackCount()) text(G, "Copia musica en /MUSIC", 124, 70, 1, 0xfde68a);

  } else if (g.menuCat == CAT_VIDEO) {
    iconFilm(G, 118, 30, 0x7dd3fc);
    snprintf(buf, sizeof(buf), "Videos (%d)", library.videoCount());
    text(G, buf, 134, 34, 1, 0xFFFFFF);
    drawScrollButtons(G);
    g.videoScroll = constrain(g.videoScroll, 0, max(0, library.videoCount() - 4));
    for (int i = 0; i < 4 && g.videoScroll + i < library.videoCount(); i++) {
      int idx = g.videoScroll + i, ry = 46 + i * 38;
      if (!G.rectIn(117, ry, 192, 33)) continue;
      const MediaEntry& e = library.video(idx);
      drawListRowBase(G, ry, idx == g.videoIdx);
      gelPill(G, 122, ry + 5, 34, 14, 4, OPQ(0xa78bfa), OPQ(0x6d28d9));
      textCentered(G, "MJPG", 122, ry + 12, 34, 1, 0xFFFFFF);
      clip(e.title, buf, 22);
      text(G, buf, 161, ry + 12, 1, 0xFFFFFF);
      snprintf(buf, sizeof(buf), "%.1f MB  320x180", e.size / 1048576.0f);
      text(G, buf, 122, ry + 25, 1, 0xbae6fd);
    }
    if (!library.videoCount()) {
      text(G, "Copia clips en /VIDEO", 124, 64, 1, 0xfde68a);
      text(G, "Clip.mjpeg + Clip.mp3", 124, 78, 1, 0xbae6fd);
      text(G, "(+ Clip.srt opcional)", 124, 90, 1, 0xbae6fd);
      text(G, "Ver README: ffmpeg", 124, 104, 1, 0xbae6fd);
    }

  } else if (g.menuCat == CAT_SPOTIFY) {
    text(G, "Spotify (A2DP + AVRCP)", 120, 34, 1, 0x34d399);
    gelPill(G, 117, 46, 192, 46, 8, OPQ(0x10b981), OPQ(0x047857), OPQ(0xa7f3d0), true);
    iconPlay(G, 128, 59, 7, 0xFFFFFF);
    clip(g.source == SRC_SPOTIFY && g.meta.title[0] ? g.meta.title : "Escuchar el telefono", buf, 24);
    text(G, buf, 137, 59, 1, 0xFFFFFF);
    clip(g.source == SRC_SPOTIFY ? g.meta.artist : "Stream BT con letra .LRC", buf, 30);
    text(G, buf, 125, 73, 1, 0xd1fae5);
    text(G, "Toca para reproducir aqui", 125, 84, 1, 0xd1fae5);
    glassPanel(G, 117, 98, 192, 62, 8);
    text(G, "Guardar musica en MicroSD?", 124, 110, 1, 0xbae6fd);
    text(G, "Elige que playlists grabar", 124, 122, 1, 0xe0f2fe);
    gelPill(G, 124, 132, 178, 22, 7, OPQ(0x06b6d4), OPQ(0x0284c7));
    text(G, "Abrir gestor de playlists >", 132, 143, 1, 0xFFFFFF);
    text(G, "AVRCP Metadata + LRC: ACTIVO", 120, 175, 1, 0x6ee7b7);

  } else if (g.menuCat == CAT_SAVE_SD) {
    text(G, "Guardar Playlist en MicroSD", 118, 34, 1, 0x38bdf8);
    text(G, "Grabacion en pausa (v1)", 118, 46, 1, 0xfde68a);
    if (!spotify.seenCount) {
      text(G, "Reproduce algo en el", 124, 70, 1, 0xbae6fd);
      text(G, "telefono: aqui saldran", 124, 82, 1, 0xbae6fd);
      text(G, "sus albumes/playlists.", 124, 94, 1, 0xbae6fd);
    }
    for (int i = 0; i < spotify.seenCount; i++) {
      int ry = 55 + i * 36;
      if (!G.rectIn(117, ry, 192, 32)) continue;
      bool q = spotify.seen[i].queuedForSd;
      drawListRowBase(G, ry, q, 32);
      clip(spotify.seen[i].name, buf, 30);
      text(G, buf, 124, ry + 10, 1, 0xFFFFFF);
      snprintf(buf, sizeof(buf), q ? "[x] En cola SD (pausado)" : "[ ] Tocar para guardar");
      text(G, buf, 124, ry + 23, 1, q ? 0xfde047 : 0x94a3b8);
    }

  } else if (g.menuCat == CAT_OUTPUT) {
    text(G, "Salida de audio", 120, 34, 1, 0xFFFFFF);
    gelPill(G, 240, 26, 69, 16, 6, OPQ(bridge.scanning() ? 0xf59e0b : 0x10b981), OPQ(bridge.scanning() ? 0xb45309 : 0x047857));
    text(G, bridge.scanning() ? "Buscando" : "Buscar BT", 245, 34, 1, 0xFFFFFF);
    bool jack = g.output == OUT_JACK;
    gelPill(G, 117, 46, 192, 34, 7, OPQ(jack ? 0x10b981 : 0x1e293b), OPQ(jack ? 0x047857 : 0x0f172a), OPQ(0xa7f3d0), jack);
    text(G, "Jack 3.5mm (PCM5102A)", 124, 57, 1, 0xFFFFFF);
    text(G, "I2S 16-bit 44.1k directo", 124, 70, 1, 0xd1fae5);
    if (!g.bridgeAlive) {
      text(G, "ESP32 #2 no responde.", 124, 100, 1, 0xfda4af);
      text(G, "Revisa UART TX33/RX35", 124, 112, 1, 0xfda4af);
    }
    int n = bridge.deviceCount();
    // Si hay audífonos conectados que no salen en la lista, mostrarlos primero
    for (int i = 0; i < min(3, n); i++) {
      int ry = 86 + i * 38;
      if (!G.rectIn(117, ry, 192, 33)) continue;
      const BtDevice& d = bridge.device(i);
      bool act = g.output == OUT_BT && !strcmp(bridge.connectedMac, d.mac);
      gelPill(G, 117, ry, 192, 33, 7, OPQ(act ? 0x06b6d4 : 0x1e293b), OPQ(act ? 0x0e7490 : 0x0f172a), OPQ(0xa5f3fc), act);
      clip(d.name, buf, 28);
      text(G, buf, 124, ry + 11, 1, 0xFFFFFF);
      snprintf(buf, sizeof(buf), "%s %ddBm", d.mac, d.rssi);
      text(G, buf, 124, ry + 24, 1, 0xbae6fd);
    }
    if (!n && g.bridgeAlive) {
      if (g.btHeadphonesLinked) {
        gelPill(G, 117, 86, 192, 33, 7, OPQ(0x06b6d4), OPQ(0x0e7490), OPQ(0xa5f3fc), g.output == OUT_BT);
        clip(g.btHeadphonesName, buf, 28);
        text(G, buf, 124, 97, 1, 0xFFFFFF);
        text(G, "Conectado via ESP32#2", 124, 110, 1, 0xbae6fd);
      } else {
        text(G, "Pon tus audifonos en modo", 124, 100, 1, 0xbae6fd);
        text(G, "emparejar y pulsa Buscar", 124, 112, 1, 0xbae6fd);
      }
    }
  }
}

// ============================================================ EQ
struct EqSlider { const char* label; const char* freq; int x; uint32_t top, bot; };
static const EqSlider SLIDERS[3] = {
  {"CLEAR BASS", "100 Hz", 44, 0x22d3ee, 0x0284c7},
  {"VOCAL+",     "2.0 kHz", 106, 0x34d399, 0x059669},
  {"TREBLE",     "10 kHz", 168, 0x38bdf8, 0x0369a1},
};
struct EqPreset { const char* label; const char* name; int y; uint32_t c1, c2; int8_t b, m, t; bool mega; };
static const EqPreset PRESETS[4] = {
  {"Mega Bass+",    "MEGA BASS", 50,  0x06b6d4, 0x0369a1,  8,  2,  4, true},
  {"Vocal Crystal", "VOCAL",     78,  0x10b981, 0x047857, -2,  6,  3, false},
  {"SynthV Punch",  "PUNCH",     106, 0xf43f5e, 0xbe123c,  6, -1,  6, false},
  {"Flat Studio",   "FLAT",      134, 0x64748b, 0x334155,  0,  0,  0, false},
};
static const int EQ_TOP = 56, EQ_H = 110;

static void drawEq(Gfx& G) {
  char buf[16];
  glassPanel(G, 5, 23, 310, 187, 9);
  text(G, "W. ClearAudio+ & Mega Bass DSP", 14, 34, 1, 0xFFFFFF);
  int8_t vals[3] = {g.eq.bass, g.eq.mid, g.eq.treble};
  int cyc = EQ_TOP + EQ_H / 2;
  for (int i = 0; i < 3; i++) {
    const EqSlider& s = SLIDERS[i];
    snprintf(buf, sizeof(buf), "%+ddB", vals[i]);
    text(G, buf, s.x - 14, 47, 1, 0xbae6fd);
    glassPanel(G, s.x - 6, EQ_TOP, 12, EQ_H, 6);
    int ky = cyc - vals[i] * (EQ_H / 2) / 12;
    gelPill(G, s.x - 5, min(cyc, ky), 10, max(6, abs(ky - cyc)), 5, OPQ(s.top), OPQ(s.bot));
    gelPill(G, s.x - 13, ky - 6, 26, 12, 6, OPQ(0xFFFFFF), OPQ(s.top), OPQ(0xFFFFFF));
    textCentered(G, s.label, s.x - 28, 178, 56, 1, 0xFFFFFF);
    textCentered(G, s.freq, s.x - 28, 190, 56, 1, 0x7dd3fc);
  }
  for (const EqPreset& p : PRESETS) {
    gelPill(G, 204, p.y, 102, 22, 10, OPQ(p.c1), OPQ(p.c2), RGBA(0xFFFFFF, 0.68f), !strcmp(g.presetName, p.name));
    textCentered(G, p.label, 204, p.y + 11, 102, 1, 0xFFFFFF);
  }
  gelPill(G, 204, 166, 34, 22, 8, OPQ(0x0284c7), OPQ(0x0369a1));
  gelPill(G, 272, 166, 34, 22, 8, OPQ(0x0284c7), OPQ(0x0369a1));
  text(G, "VOL-", 209, 177, 1, 0xFFFFFF);
  text(G, "VOL+", 277, 177, 1, 0xFFFFFF);
  snprintf(buf, sizeof(buf), "%d%%", g.volume);
  textCentered(G, buf, 238, 177, 34, 1, 0xbae6fd);
}

// ============================================================ VIDEO (zona inferior)
static void drawVideoChrome(Gfx& G) {
  bool big = g.videoDockHidden;
  int ph = big ? 54 : 27;
  glassPanel(G, 4, 184, 312, ph, 8);
  uint32_t t = g.posMs;
  const LyricLine* sub = lyrics.line(lyrics.indexAt(t));
  if (sub) {
    if (big) {
      char r1[LYRIC_TEXT_LEN]; strlcpy(r1, sub->text, 38);
      textCentered(G, r1, 4, 197, 312, 2, 0xFFFFFF);
      if (strlen(sub->text) > 37) textCentered(G, sub->text + 37, 4, 213, 312, 2, 0xFFFFFF);
    } else {
      char r1[54]; strlcpy(r1, sub->text, sizeof(r1));
      textCentered(G, r1, 4, 193, 312, 1, 0xFFFFFF);
    }
  }
  int by = big ? 229 : 203;
  char a[8], b[8];
  fmtTime(t, a); fmtTime(curDuration(), b);
  text(G, a, 10, by + 2, 1, 0xbae6fd);
  text(G, b, 282, by + 2, 1, 0xbae6fd);
  float ratio = constrain((float)t / curDuration(), 0.0f, 1.0f);
  glassPanel(G, 44, by, 232, 5, 2);
  gelPill(G, 44, by, max(6, (int)(232 * ratio)), 5, 2, OPQ(0xa78bfa), OPQ(0x6d28d9), OPQ(0xddd6fe));
  if (!g.playing) { iconPause(G, 160, 100, 20, 0xFFFFFF); }
}

// ============================================================ DOCK (Y 213..238)
struct DockBtn { const char* id; const char* label; int x, w; };
static const DockBtn DOCK[6] = {
  {"PREV", "|<<", 6, 42}, {"PLAY", "", 52, 50}, {"NEXT", ">>|", 106, 42},
  {"EQ", "EQ", 152, 44}, {"SAVE", "SaveSD", 200, 52}, {"MENU", "MENU", 256, 58},
};

static void drawDock(Gfx& G) {
  if (!G.rectIn(3, 213, 314, 25)) return;
  glassPanel(G, 3, 213, 314, 25, 9);
  for (const DockBtn& b : DOCK) {
    bool act = (!strcmp(b.id, "PLAY") && g.playing) ||
               (!strcmp(b.id, "EQ") && g.screen == SCR_EQ) ||
               (!strcmp(b.id, "MENU") && (g.screen == SCR_MENU || g.screen == SCR_VIDEO)) ||
               (!strcmp(b.id, "SAVE") && g.screen == SCR_MENU && g.menuCat == CAT_SAVE_SD);
    gelPill(G, b.x, 216, b.w, 19, 9, OPQ(act ? 0x10b981 : 0x0ea5e9), OPQ(act ? 0x047857 : 0x0369a1),
            RGBA(0xFFFFFF, 0.75f), act);
    if (!strcmp(b.id, "PLAY")) {
      if (g.playing) iconPause(G, b.x + b.w / 2, 225, 8, 0xFFFFFF);
      else iconPlay(G, b.x + b.w / 2, 225, 8, 0xFFFFFF);
    } else {
      textCentered(G, b.label, b.x, 225, b.w, 1, 0xFFFFFF);
    }
  }
}

// ============================================================ aviso flotante
static void drawToast(Gfx& G) {
  if (!g.toast[0] || millis() > g.toastUntil) return;
  if (!G.rectIn(16, 170, 288, 22)) return;
  gelPill(G, 16, 170, 288, 22, 11, RGBA(0x0f172a, 0.92f), RGBA(0x0369a1, 0.95f), OPQ(0x67e8f9), true);
  textCentered(G, g.toast, 16, 181, 288, 1, 0xFFFFFF);
}

// ============================================================ escena completa
static void scene(Gfx& G) {
  background(G);
  if (g.screen != SCR_VIDEO) drawStatusBar(G);
  switch (g.screen) {
    case SCR_PLAYER: drawPlayer(G); break;
    case SCR_MENU:   drawMenu(G); break;
    case SCR_EQ:     drawEq(G); break;
    case SCR_VIDEO:  drawVideoChrome(G); break;
  }
  if (!(g.screen == SCR_VIDEO && g.videoDockHidden)) drawDock(G);
  drawToast(G);
}

static void fullRedraw() {
  g.dirty = false;
  if (g.screen == SCR_VIDEO) renderRegion(0, 182, 320, 58, scene);   // el vídeo pinta 0..181
  else renderRegion(0, 0, 320, 240, scene);
}

// ============================================================ acciones
static void openMenuCat(MenuCat c) {
  if ((c == CAT_SPOTIFY || c == CAT_SAVE_SD) && !g.phoneConnected) {
    showToast("Conecta un smartphone por Bluetooth primero");
    return;
  }
  g.screen = SCR_MENU; g.menuCat = c; g.dirty = true;
}

static void startVideo(int idx) {
  const MediaEntry& v = library.video(idx);
  spotify.suspend(true);
  tft.fillRect(0, 0, 320, 182, TFT_BLACK);
  if (!video.open(v.path)) { showToast("Sin memoria para el video"); g.dirty = true; return; }
  g.videoIdx = idx;
  strlcpy(g.meta.title, v.title, sizeof(g.meta.title));
  strlcpy(g.meta.artist, v.artist, sizeof(g.meta.artist));
  strlcpy(g.meta.format, "VIDEO", sizeof(g.meta.format));
  g.meta.durationMs = video.durationMs();
  g.screen = SCR_VIDEO; g.videoDockHidden = false; g.dirty = true;
  sendCmd(CMD_OPEN_VIDEO, idx);
}

static void stopVideo() {
  video.close();
  sendCmd(CMD_STOP);
  lyrics.clear();
  g.screen = SCR_MENU; g.menuCat = CAT_VIDEO; g.dirty = true;
}

static void dockAction(const char* id) {
  if (!strcmp(id, "PREV")) sendCmd(CMD_PREV);
  else if (!strcmp(id, "PLAY")) sendCmd(CMD_TOGGLE_PAUSE);
  else if (!strcmp(id, "NEXT")) sendCmd(CMD_NEXT);
  else if (!strcmp(id, "EQ")) {
    if (g.screen == SCR_VIDEO) stopVideo();
    g.screen = g.screen == SCR_EQ ? SCR_PLAYER : SCR_EQ;
  } else if (!strcmp(id, "SAVE")) {
    if (g.screen == SCR_VIDEO) stopVideo();
    openMenuCat(CAT_SAVE_SD);
  } else if (!strcmp(id, "MENU")) {
    if (g.screen == SCR_VIDEO) { stopVideo(); return; }
    g.screen = g.screen == SCR_MENU ? SCR_PLAYER : SCR_MENU;
  }
  g.dirty = true;
}

// ============================================================ táctil
static void handleTap(int x, int y) {
  // Dock
  if (y >= 213 && !(g.screen == SCR_VIDEO && g.videoDockHidden)) {
    for (const DockBtn& b : DOCK) if (x >= b.x && x <= b.x + b.w) { dockAction(b.id); return; }
    return;
  }
  // Barra superior
  if (y <= 20 && g.screen != SCR_VIDEO) {
    if (x >= 84 && x <= 168) {
      showToast(g.phoneConnected ? "Telefono enlazado (A2DP Sink)" : "Empareja tu movil con 'W.Walkman Aero'");
    } else if (x >= 171 && x <= 243) {
      if (g.btHeadphonesLinked) setOutput(g.output == OUT_BT ? OUT_JACK : OUT_BT);
      else openMenuCat(CAT_OUTPUT);
    } else if (x >= 246 && x <= 286) {
      g.megaBass = !g.megaBass; applyEq();
      showToast(g.megaBass ? "Walkman MEGA BASS: ON" : "MEGA BASS: OFF");
      g.dirty = true;
    }
    return;
  }

  switch (g.screen) {
    case SCR_PLAYER: {
      int lx = g.lyricsExpanded ? 5 : 95, lw = g.lyricsExpanded ? 310 : 220, bx = lx + lw - 54;
      if (x >= bx && x <= bx + 48 && y >= 25 && y <= 46) { g.lyricsExpanded = !g.lyricsExpanded; g.dirty = true; return; }
      if (x >= 42 && x <= 278 && y >= 190 && y <= 212) {
        sendCmd(CMD_SEEK, (int32_t)((x - 42) / 236.0f * curDuration()));
        return;
      }
      if (!g.lyricsExpanded && x >= 10 && x <= 86 && y >= 28 && y <= 112) sendCmd(CMD_TOGGLE_PAUSE);
      if (!g.lyricsExpanded && x >= 11 && x <= 85 && y >= 152 && y <= 168) { g.screen = SCR_EQ; g.dirty = true; }
      return;
    }
    case SCR_MENU: {
      if (x >= 10 && x <= 102 && y >= 29 && y < 29 + CAT_COUNT * 36) {
        int c = (y - 29) / 36;
        if (c == CAT_OUTPUT && !bridge.deviceCount() && g.bridgeAlive && !g.btHeadphonesLinked) bridge.scan();
        openMenuCat((MenuCat)c);
        return;
      }
      if (x < 111) return;
      if (g.menuCat == CAT_SD || g.menuCat == CAT_VIDEO) {
        int& scroll = g.menuCat == CAT_SD ? g.sdScroll : g.videoScroll;
        if (y >= 26 && y <= 42) {
          if (x >= 277 && x <= 292) { scroll = max(0, scroll - 1); g.dirty = true; return; }
          if (x >= 294 && x <= 309) { scroll++; g.dirty = true; return; }
          if (g.menuCat == CAT_SD && x >= 218 && x <= 274) {
            showToast("Escaneando MicroSD...");
            xSemaphoreTake(sdMutex, portMAX_DELAY); library.scan(); xSemaphoreGive(sdMutex);
            g.dirty = true; return;
          }
        }
        if (y >= 46 && y < 46 + 4 * 38) {
          int idx = scroll + (y - 46) / 38;
          if (g.menuCat == CAT_SD && idx < library.trackCount()) { sendCmd(CMD_PLAY_INDEX, idx); g.screen = SCR_PLAYER; g.dirty = true; }
          if (g.menuCat == CAT_VIDEO && idx < library.videoCount()) startVideo(idx);
        }
      } else if (g.menuCat == CAT_SPOTIFY) {
        if (y >= 46 && y <= 92) { sendCmd(CMD_SOURCE_SPOTIFY); g.screen = SCR_PLAYER; g.dirty = true; }
        else if (y >= 132 && y <= 154) openMenuCat(CAT_SAVE_SD);
      } else if (g.menuCat == CAT_SAVE_SD) {
        if (y >= 55) {
          int i = (y - 55) / 36;
          if (i < spotify.seenCount) {
            spotify.seen[i].queuedForSd = !spotify.seen[i].queuedForSd;
            showToast(FEATURE_SPOTIFY_RECORD ? "Cola de grabacion actualizada" : "En cola (grabacion desactivada en v1)");
            g.dirty = true;
          }
        }
      } else if (g.menuCat == CAT_OUTPUT) {
        if (y >= 26 && y <= 42 && x >= 240) { bridge.scan(); showToast("Buscando audifonos (12 s)..."); g.dirty = true; }
        else if (y >= 46 && y <= 80) setOutput(OUT_JACK);
        else if (y >= 86 && y < 86 + 3 * 38) {
          int i = (y - 86) / 38;
          if (i < bridge.deviceCount()) bridge.connect(bridge.device(i).mac);
          else if (g.btHeadphonesLinked && i == 0) setOutput(OUT_BT);
        }
      }
      return;
    }
    case SCR_EQ: {
      handleDrag(x, y);                            // tocar directamente un deslizador
      for (const EqPreset& p : PRESETS) {
        if (x >= 204 && x <= 306 && y >= p.y && y <= p.y + 22) {
          g.eq = {p.b, p.m, p.t}; g.megaBass = p.mega;
          strlcpy(g.presetName, p.name, sizeof(g.presetName));
          applyEq(); g.dirty = true; return;
        }
      }
      if (y >= 166 && y <= 188) {
        if (x >= 204 && x <= 238) { g.volume = max(0, g.volume - 5); g.dirty = true; }
        if (x >= 272 && x <= 306) { g.volume = min(100, g.volume + 5); g.dirty = true; }
      }
      return;
    }
    case SCR_VIDEO: {
      static uint32_t lastTap = 0;
      int barY = g.videoDockHidden ? 226 : 200;
      if (y >= barY && y <= barY + 12 && x >= 44 && x <= 276) {
        uint32_t ms = (uint32_t)((x - 44) / 232.0f * curDuration());
        video.seekMs(ms);
        sendCmd(CMD_SEEK, ms);
        return;
      }
      if (y < 182) {
        if (millis() - lastTap < 350) { sendCmd(CMD_TOGGLE_PAUSE); lastTap = 0; }   // doble toque: pausa
        else { g.videoDockHidden = !g.videoDockHidden; lastTap = millis(); }
        g.dirty = true;
      }
      return;
    }
  }
}

// Arrastre continuo (solo los deslizadores del EQ)
static void handleDrag(int x, int y) {
  if (g.screen != SCR_EQ || y < EQ_TOP - 8 || y > EQ_TOP + EQ_H + 8) return;
  for (int i = 0; i < 3; i++) {
    if (abs(x - SLIDERS[i].x) > 16) continue;
    int cyc = EQ_TOP + EQ_H / 2;
    int v = constrain((int)lroundf((cyc - y) * 12.0f / (EQ_H / 2)), -12, 12);
    int8_t* tgt = i == 0 ? &g.eq.bass : i == 1 ? &g.eq.mid : &g.eq.treble;
    if (*tgt != v) {
      *tgt = v;
      strlcpy(g.presetName, "CUSTOM", sizeof(g.presetName));
      applyEq();
      renderRegion(5, 23, 195, 187, scene);       // solo la zona de deslizadores
    }
  }
}

// ============================================================ arranque
static void calibrateTouch() {
  Preferences p;
  p.begin("touch", false);
  uint16_t cal[5];
  bool force = digitalRead(PIN_HOLD) == LOW;          // HOLD al arrancar = recalibrar
  if (!force && p.getBytes("cal", cal, sizeof(cal)) == sizeof(cal)) {
    tft.setTouch(cal);
  } else {
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.drawCentreString("Toca las esquinas marcadas", 160, 110, 2);
    tft.calibrateTouch(cal, TFT_CYAN, TFT_BLACK, 15);
    p.putBytes("cal", cal, sizeof(cal));
  }
  p.end();
}

void uiBegin() {
  pinMode(PIN_HOLD, INPUT_PULLUP);
  ledcAttach(PIN_BACKLIGHT, 5000, 8);     // core 3.x: el canal se asigna solo
  ledcWrite(PIN_BACKLIGHT, 220);
#if defined(PIN_DAC_MUTE) && PIN_DAC_MUTE >= 0
  pinMode(PIN_DAC_MUTE, OUTPUT); digitalWrite(PIN_DAC_MUTE, HIGH);
#endif
  tft.init();
  tft.setRotation(1);           // 320x240 apaisado
  tft.initDMA();
  tft.setSwapBytes(false);      // JPEGDEC entrega RGB565 big-endian
  calibrateTouch();
  aero::begin(&tft);
  video.begin(&tft);
  g.dirty = true;
}

// ============================================================ tarea UI (core 1)
void taskUI(void*) {
  bool wasTouched = false;
  uint32_t lastAnim = 0, lastSlow = 0, lastVideoChrome = 0, lastPhoneCheck = 0;
  uint32_t lastLyricsVer = 0;

  for (;;) {
    uint32_t now = millis();

    // --- táctil (nunca durante DMA: el vídeo hace dmaWait+endWrite antes de volver) ---
    uint16_t tx, ty;
    bool touched = tft.getTouch(&tx, &ty, 500);
    if (touched && !wasTouched) handleTap(tx, ty);
    else if (touched) handleDrag(tx, ty);
    wasTouched = touched;

    // --- estado del teléfono (regla: Spotify solo con a2dp_sink.is_connected()) ---
    if (now - lastPhoneCheck > 500) {
      lastPhoneCheck = now;
      bool ph = spotify.phoneConnected();
      if (ph != g.phoneConnected) { g.phoneConnected = ph; g.dirty = true; }
      spotify.pollLyrics();
    }

    // --- aviso flotante: aparecer / desaparecer ---
    bool tv = g.toast[0] && now < g.toastUntil;
    if (tv != toastVisible) {
      toastVisible = tv;
      if (g.screen == SCR_VIDEO) g.dirty = true;
      else renderRegion(16, 170, 288, 22, scene);
    }

    if (g.dirty) fullRedraw();

    if (g.screen == SCR_VIDEO) {
      if (g.playing) video.step(g.posMs, VIDEO_Y);
      if (now - lastVideoChrome > 250) { lastVideoChrome = now; renderRegion(0, 182, 320, g.videoDockHidden ? 58 : 30, scene); }
      if (video.finished()) { stopVideo(); showToast("Fin del video"); }
      vTaskDelay(1);
      continue;
    }

    // --- animaciones (≈20 fps): carretes, VU, cápsula LRC ---
    if (now - lastAnim >= 50) {
      lastAnim = now;
      if (g.screen == SCR_PLAYER) {
        if (g.playing) reelAngle += 0.13f;
        int idx = lyrics.indexAt(g.posMs);
        if (idx != lastLyricIdx || lyrics.version != lastLyricsVer) {
          lastLyricIdx = idx; lastLyricsVer = lyrics.version;
          int lx = g.lyricsExpanded ? 5 : 95, lw = g.lyricsExpanded ? 310 : 220;
          renderRegion(lx, 57, lw, 134, scene);                   // 4 líneas de letra
        } else {
          int lx = g.lyricsExpanded ? 5 : 95, lw = g.lyricsExpanded ? 310 : 220;
          renderRegion(lx + 6, 82, lw - 12, 44, scene);           // relleno líquido de la cápsula
        }
        if (!g.lyricsExpanded) {
          if (g.playing) renderRegion(14, 52, 68, 38, scene);     // carretes
          renderRegion(22, 121, 58, 24, scene);                   // vúmetros
        }
      }
    }
    // --- cosas lentas (4 fps): barra de progreso, barra superior ---
    if (now - lastSlow >= 250) {
      lastSlow = now;
      if (g.screen == SCR_PLAYER) renderRegion(0, 192, 320, 20, scene);
      renderRegion(0, 0, 320, 20, scene);
    }
    vTaskDelay(pdMS_TO_TICKS(8));
  }
}
