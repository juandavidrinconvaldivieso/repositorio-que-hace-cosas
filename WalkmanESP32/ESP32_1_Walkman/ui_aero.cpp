#include "ui_aero.h"
#include <math.h>

TFT_eSPI tft;

namespace aero {

static TFT_eSprite* strip = nullptr;
static const int STRIP_W = 320, STRIP_H = 24;

struct Bubble { int16_t x, y, r; };
static const Bubble BUBBLES[] = { {42, 90, 15}, {138, 177, 22}, {258, 102, 18}, {292, 192, 11}, {205, 48, 9} };

// ---------------------------------------------------------------- color
uint16_t to565(uint32_t c) {
  return ((c >> 8) & 0xF800) | ((c >> 5) & 0x07E0) | ((c & 0xFF) >> 3);
}
static inline uint32_t from565(uint16_t c) {
  uint32_t r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31;
  return ((r << 3 | r >> 2) << 16) | ((g << 2 | g >> 4) << 8) | (b << 3 | b >> 2);
}
static inline uint16_t swap16(uint16_t c) { return (c >> 8) | (c << 8); }

uint32_t lerp(uint32_t a, uint32_t b, float t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  uint32_t out = 0;
  for (int s = 0; s < 32; s += 8) {
    float ca = (a >> s) & 0xFF, cb = (b >> s) & 0xFF;
    out |= (uint32_t)(ca + (cb - ca) * t + 0.5f) << s;
  }
  return out;
}

static inline uint32_t blendRGB(uint32_t dst, uint32_t src, uint32_t a /*0..255*/) {
  uint32_t ia = 255 - a;
  uint32_t r = (((src >> 16) & 0xFF) * a + ((dst >> 16) & 0xFF) * ia) / 255;
  uint32_t g = (((src >> 8) & 0xFF) * a + ((dst >> 8) & 0xFF) * ia) / 255;
  uint32_t b = ((src & 0xFF) * a + (dst & 0xFF) * ia) / 255;
  return (r << 16) | (g << 8) | b;
}

static inline void plot(Gfx& g, int x, int y, uint32_t argb, float cover = 1.0f) {
  if (x < g.ox || x >= g.ox + g.w || y < g.oy || y >= g.oy + g.h) return;
  uint32_t a = (uint32_t)(((argb >> 24) & 0xFF) * cover);
  if (!a) return;
  uint16_t& px = g.buf[(y - g.oy) * STRIP_W + (x - g.ox)];
  uint32_t dst = from565(swap16(px));
  px = swap16(to565(a >= 255 ? (argb & 0xFFFFFF) : blendRGB(dst, argb, a)));
}

// ---------------------------------------------------------------- región
void begin(TFT_eSPI* t) {
  strip = new TFT_eSprite(t);
  strip->setColorDepth(16);
  strip->createSprite(STRIP_W, STRIP_H);
}

void renderRegion(int x, int y, int w, int h, SceneFn scene) {
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > 320) w = 320 - x;
  if (y + h > 240) h = 240 - y;
  if (w <= 0 || h <= 0) return;
  for (int sy = y; sy < y + h; sy += STRIP_H) {
    int sh = min(STRIP_H, y + h - sy);
    Gfx g{strip, (uint16_t*)strip->getPointer(), x, sy, w, sh};
    scene(g);
    strip->pushSprite(x, sy, 0, 0, w, sh);
  }
}

// ---------------------------------------------------------------- fondo
uint32_t bgPixel(int x, int y) {
  // Degradado vertical #0b4a6f → #072a47 → #031326 (Y 20..240)
  float t = (y - 20) / 220.0f; if (t < 0) t = 0;
  uint32_t c = t < 0.5f ? lerp(0x0b4a6f, 0x072a47, t * 2) : lerp(0x072a47, 0x031326, (t - 0.5f) * 2);

  // Aurora cian/verde (radial centrada arriba)
  float dx = x - 170, dy = (y - 50) * 1.4f;
  float d = sqrtf(dx * dx + dy * dy);
  if (d < 180) {
    float k = 1 - d / 180;
    uint32_t aur = d < 100 ? 0x22d3ee : 0x10b981;
    c = blendRGB(c, aur, (uint32_t)(k * k * 0.32f * 255));
  }
  // Burbujas: centro claro desplazado arriba-izquierda (orb especular)
  for (const Bubble& b : BUBBLES) {
    float bx = x - (b.x - b.r * 0.3f), by = y - (b.y - b.r * 0.3f);
    float ex = x - b.x, ey = y - b.y;
    float de = sqrtf(ex * ex + ey * ey);
    if (de >= b.r) continue;
    float dh = sqrtf(bx * bx + by * by) / b.r;
    float a = dh < 0.6f ? 0.24f - dh * 0.2f : 0.08f * (1 - de / b.r);
    uint32_t col = dh < 0.6f ? 0xFFFFFF : 0x38bdf8;
    c = blendRGB(c, col, (uint32_t)(a * 255));
  }
  return c;
}

void background(Gfx& g) {
  for (int yy = 0; yy < g.h; yy++)
    for (int xx = 0; xx < g.w; xx++)
      g.buf[yy * STRIP_W + xx] = swap16(to565(bgPixel(g.ox + xx, g.oy + yy)));
}

// ---------------------------------------------------------------- formas
void hspan(Gfx& g, int y, float x0, float x1, uint32_t argb) {
  if (!g.rowIn(y) || x1 <= x0) return;
  int i0 = (int)floorf(x0), i1 = (int)ceilf(x1) - 1;
  for (int x = max(i0, g.ox); x <= min(i1, g.ox + g.w - 1); x++) {
    float cover = 1.0f;
    if (x == i0) cover = 1.0f - (x0 - i0);
    if (x == i1) cover = min(cover, 1.0f - (i1 + 1 - x1));
    plot(g, x, y, argb, cover);
  }
}

void fillRectA(Gfx& g, int x, int y, int w, int h, uint32_t argb) {
  if (!g.rectIn(x, y, w, h)) return;
  for (int yy = max(y, g.oy); yy < min(y + h, g.oy + g.h); yy++) hspan(g, yy, x, x + w, argb);
}

// Inset horizontal de una fila dentro de un rectángulo redondeado
static inline float rowInset(float dy, int h, float r) {
  float yc = dy + 0.5f;
  float d = 0;
  if (yc < r) d = r - yc;
  else if (yc > h - r) d = yc - (h - r);
  else return 0;
  return r - sqrtf(max(0.0f, r * r - d * d));
}

void fillCircleA(Gfx& g, float cx, float cy, float r, uint32_t argb) {
  if (!g.rectIn(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2)) return;
  for (int y = (int)(cy - r); y <= (int)(cy + r); y++) {
    float dy = y + 0.5f - cy;
    if (fabsf(dy) > r) continue;
    float hw = sqrtf(r * r - dy * dy);
    hspan(g, y, cx - hw, cx + hw, argb);
  }
}

void ringA(Gfx& g, float cx, float cy, float r, float th, uint32_t argb) {
  if (!g.rectIn(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2)) return;
  for (int y = (int)(cy - r - 1); y <= (int)(cy + r + 1); y++)
    for (int x = (int)(cx - r - 1); x <= (int)(cx + r + 1); x++) {
      float d = sqrtf((x + 0.5f - cx) * (x + 0.5f - cx) + (y + 0.5f - cy) * (y + 0.5f - cy));
      float cov = 1.0f - fabsf(d - r) / (th * 0.5f + 0.5f);
      if (cov > 0) plot(g, x, y, argb, min(1.0f, cov));
    }
}

void lineA(Gfx& g, float x0, float y0, float x1, float y1, uint32_t argb) {
  // Wu simplificado: muestreo a medio píxel con cobertura por distancia
  float dx = x1 - x0, dy = y1 - y0;
  int n = (int)(max(fabsf(dx), fabsf(dy)) * 2) + 1;
  for (int i = 0; i <= n; i++) {
    float t = (float)i / n, px = x0 + dx * t, py = y0 + dy * t;
    int ix = (int)floorf(px), iy = (int)floorf(py);
    float fx = px - ix, fy = py - iy;
    plot(g, ix, iy, argb, (1 - fx) * (1 - fy) * 0.9f);
    plot(g, ix + 1, iy, argb, fx * (1 - fy) * 0.9f);
    plot(g, ix, iy + 1, argb, (1 - fx) * fy * 0.9f);
    plot(g, ix + 1, iy + 1, argb, fx * fy * 0.9f);
  }
}

static void outline(Gfx& g, int x, int y, int w, int h, float r, uint32_t argb, float width) {
  for (int dy = 0; dy < h; dy++) {
    int yy = y + dy;
    if (!g.rowIn(yy)) continue;
    float in = rowInset(dy, h, r);
    float inPrev = dy > 0 ? rowInset(dy - 1, h, r) : w / 2.0f;
    float inNext = dy < h - 1 ? rowInset(dy + 1, h, r) : w / 2.0f;
    if (dy == 0 || dy == h - 1) { hspan(g, yy, x + in, x + w - in, argb); continue; }
    float lo = min(in, min(inPrev, inNext)), hi = max(in, max(inPrev, inNext));
    float ext = max(width, hi - lo + 0.0f);
    hspan(g, yy, x + lo, x + lo + ext, argb);
    hspan(g, yy, x + w - lo - ext, x + w - lo, argb);
  }
}

void gelPill(Gfx& g, int x, int y, int w, int h, int r, uint32_t top, uint32_t bot, uint32_t border, bool active) {
  if (w <= 0 || h <= 0 || !g.rectIn(x - 1, y - 1, w + 2, h + 2)) return;
  float rr = min((float)r, min(w, h) / 2.0f);
  // Cuerpo: top → bot (52 %) → top
  for (int dy = 0; dy < h; dy++) {
    int yy = y + dy;
    if (!g.rowIn(yy)) continue;
    float t = (dy + 0.5f) / h;
    uint32_t c = t < 0.52f ? lerp(top, bot, t / 0.52f) : lerp(bot, top, (t - 0.52f) / 0.48f);
    float in = rowInset(dy, h, rr);
    hspan(g, yy, x + in, x + w - in, c);
  }
  // Reflejo especular blanco (mitad superior)
  int sh = max(2, (int)(h * 0.46f));
  float sr = max(1.0f, rr - 1);
  for (int dy = 0; dy < sh; dy++) {
    int yy = y + 1 + dy;
    if (!g.rowIn(yy)) continue;
    float a = 0.78f + (0.06f - 0.78f) * (dy / (float)sh);
    float in = rowInset(dy, sh, sr) * 0.6f + rowInset(dy, h, rr) * 0.4f;
    hspan(g, yy, x + 1.5f + in, x + w - 1.5f - in, RGBA(0xFFFFFF, a));
  }
  outline(g, x, y, w, h, rr, active ? OPQ(0xFFFFFF) : border, active ? 1.4f : 0.9f);
}

void glassPanel(Gfx& g, int x, int y, int w, int h, int r, uint32_t border) {
  if (!g.rectIn(x - 1, y - 1, w + 2, h + 2)) return;
  for (int dy = 0; dy < h; dy++) {
    int yy = y + dy;
    if (!g.rowIn(yy)) continue;
    float t = (dy + 0.5f) / h;
    uint32_t c = t < 0.15f ? lerp(RGBA(0xFFFFFF, 0.22f), RGBA(0xFFFFFF, 0.09f), t / 0.15f)
                           : lerp(RGBA(0xFFFFFF, 0.09f), RGBA(0x04142A, 0.78f), (t - 0.15f) / 0.85f);
    float in = rowInset(dy, h, r);
    hspan(g, yy, x + in, x + w - in, c);
    int shineH = min(12, (int)(h * 0.3f));
    if (dy >= 1 && dy <= shineH) hspan(g, yy, x + 1 + in, x + w - 1 - in, RGBA(0xFFFFFF, 0.34f * (1 - (dy - 1) / (float)shineH)));
  }
  outline(g, x, y, w, h, r, border, 1.0f);
}

// ---------------------------------------------------------------- texto
void text(Gfx& g, const char* s, int x, int y, uint8_t font, uint32_t rgb, uint8_t datum) {
  int fh = font == 2 ? 16 : 8;
  if (y + fh < g.oy || y - fh > g.oy + g.h) return;
  g.spr->setTextDatum(datum);
  g.spr->setTextColor(to565(rgb));                 // sin color de fondo = transparente
  g.spr->drawString(s, x - g.ox, y - g.oy, font);
}

int textWidth(const char* s, uint8_t font) { return tft.textWidth(s, font); }

void textCentered(Gfx& g, const char* s, int x, int y, int w, uint8_t font, uint32_t rgb) {
  text(g, s, x + w / 2, y, font, rgb, MC_DATUM);
}

// ---------------------------------------------------------------- iconos
void iconLock(Gfx& g, int x, int y, uint32_t rgb) {
  ringA(g, x + 4, y + 3, 2.6f, 1.2f, OPQ(rgb));
  fillRectA(g, x, y + 4, 9, 6, OPQ(rgb));
  fillRectA(g, x + 4, y + 6, 1, 2, OPQ(0x1e293b));
}
void iconPlay(Gfx& g, int cx, int cy, int s, uint32_t rgb) {
  for (int i = 0; i < s; i++) {
    float hh = (s - i) * 0.55f;
    fillRectA(g, cx - s / 2 + i, (int)(cy - hh), 1, (int)(hh * 2) + 1, OPQ(rgb));
  }
}
void iconPause(Gfx& g, int cx, int cy, int s, uint32_t rgb) {
  fillRectA(g, cx - s / 2, cy - s / 2, s / 3, s, OPQ(rgb));
  fillRectA(g, cx + s / 2 - s / 3, cy - s / 2, s / 3, s, OPQ(rgb));
}
void iconTriangle(Gfx& g, int cx, int cy, int s, bool up, uint32_t rgb) {
  for (int i = 0; i < s; i++) {
    int yy = up ? cy - s / 2 + i : cy + s / 2 - i;
    hspan(g, yy, cx - i * 0.6f, cx + i * 0.6f + 1, OPQ(rgb));
  }
}
void iconFilm(Gfx& g, int x, int y, uint32_t rgb) {
  fillRectA(g, x, y, 12, 9, OPQ(rgb));
  for (int i = 0; i < 3; i++) { fillRectA(g, x + 1 + i * 4, y + 1, 2, 1, OPQ(0x0f172a)); fillRectA(g, x + 1 + i * 4, y + 7, 2, 1, OPQ(0x0f172a)); }
  iconPlay(g, x + 6, y + 4, 4, 0x0f172a);
}

} // namespace aero
