#pragma once
#include <Arduino.h>
#include <TFT_eSPI.h>

// ============================================================================
// Primitivas Frutiger Aero para TFT_eSPI (sin PSRAM)
//
// Renderizado por FRANJAS: un único sprite de 320x24 (15 KB). Para pintar una
// región, se recorre en franjas; en cada una se dibuja TODA la escena con
// recorte (fondo → paneles → texto → dock → aviso). Resultado: cristal
// translúcido real (mezcla alfa con el fondo de burbujas), sin parpadeo y con
// el aviso flotante siempre encima.
//
// Colores en 0xAARRGGBB (AA=FF opaco), igual que los rgba() del simulador HTML.
// Coordenadas SIEMPRE absolutas de pantalla (las del simulador).
// ============================================================================

#define OPQ(rgb)      (0xFF000000UL | (uint32_t)(rgb))
#define RGBA(rgb, a)  (((uint32_t)(uint8_t)((a) * 255.0f + 0.5f) << 24) | (uint32_t)(rgb))

struct Gfx {
  TFT_eSprite* spr;
  uint16_t* buf;      // píxeles del sprite (565 con bytes intercambiados)
  int ox, oy;         // esquina de la ventana en coordenadas de pantalla
  int w, h;           // tamaño de la ventana
  bool rowIn(int y) const { return y >= oy && y < oy + h; }
  bool rectIn(int x, int y, int rw, int rh) const {
    return x < ox + w && x + rw > ox && y < oy + h && y + rh > oy;
  }
};

typedef void (*SceneFn)(Gfx& g);

namespace aero {
  void begin(TFT_eSPI* tft);
  // Pinta la región (x,y,w,h) de la pantalla ejecutando 'scene' por franjas
  void renderRegion(int x, int y, int w, int h, SceneFn scene);

  // Fondo azul Walkman + aurora + burbujas (función pura de x,y)
  uint32_t bgPixel(int x, int y);
  void background(Gfx& g);

  void hspan(Gfx& g, int y, float x0, float x1, uint32_t argb);   // span con alfa y bordes suaves
  void fillRectA(Gfx& g, int x, int y, int w, int h, uint32_t argb);
  void fillCircleA(Gfx& g, float cx, float cy, float r, uint32_t argb);
  void ringA(Gfx& g, float cx, float cy, float r, float thick, uint32_t argb);
  void lineA(Gfx& g, float x0, float y0, float x1, float y1, uint32_t argb);

  // Cápsula de gel Aqua: degradado 3 paradas + reflejo especular blanco + borde
  void gelPill(Gfx& g, int x, int y, int w, int h, int r, uint32_t top, uint32_t bot,
               uint32_t border = RGBA(0xFFFFFF, 0.68f), bool active = false);
  // Panel de cristal esmerilado
  void glassPanel(Gfx& g, int x, int y, int w, int h, int r, uint32_t border = RGBA(0xA5F3FC, 0.45f));

  // Texto (datum medio-izquierda como el simulador). font: 1 = 6x8 GLCD, 2 = 16px
  void text(Gfx& g, const char* s, int x, int y, uint8_t font, uint32_t rgb, uint8_t datum = ML_DATUM);
  void textCentered(Gfx& g, const char* s, int x, int y, int w, uint8_t font, uint32_t rgb);
  int  textWidth(const char* s, uint8_t font);

  // Iconos dibujados (no hay emojis en el TFT)
  void iconLock(Gfx& g, int x, int y, uint32_t rgb);
  void iconPlay(Gfx& g, int cx, int cy, int s, uint32_t rgb);
  void iconPause(Gfx& g, int cx, int cy, int s, uint32_t rgb);
  void iconTriangle(Gfx& g, int cx, int cy, int s, bool up, uint32_t rgb);
  void iconFilm(Gfx& g, int x, int y, uint32_t rgb);

  uint16_t to565(uint32_t rgb);
  uint32_t lerp(uint32_t a, uint32_t b, float t);   // ARGB
}

extern TFT_eSPI tft;
