#include "dsp_biquad.h"
#include <math.h>

WalkmanDSP dsp;

BiquadCoef WalkmanDSP::lowShelf(float fs, float f0, float gainDb) {
  float A = powf(10.0f, gainDb / 40.0f);
  float w0 = 2.0f * PI * f0 / fs, cw = cosf(w0), sw = sinf(w0);
  float alpha = sw / 2.0f * sqrtf(2.0f);          // S = 1
  float sA = 2.0f * sqrtf(A) * alpha;
  float a0 = (A + 1) + (A - 1) * cw + sA;
  BiquadCoef c;
  c.b0 = A * ((A + 1) - (A - 1) * cw + sA) / a0;
  c.b1 = 2 * A * ((A - 1) - (A + 1) * cw) / a0;
  c.b2 = A * ((A + 1) - (A - 1) * cw - sA) / a0;
  c.a1 = -2 * ((A - 1) + (A + 1) * cw) / a0;
  c.a2 = ((A + 1) + (A - 1) * cw - sA) / a0;
  return c;
}

BiquadCoef WalkmanDSP::peaking(float fs, float f0, float gainDb, float q) {
  float A = powf(10.0f, gainDb / 40.0f);
  float w0 = 2.0f * PI * f0 / fs, cw = cosf(w0), sw = sinf(w0);
  float alpha = sw / (2.0f * q);
  float a0 = 1 + alpha / A;
  BiquadCoef c;
  c.b0 = (1 + alpha * A) / a0;
  c.b1 = (-2 * cw) / a0;
  c.b2 = (1 - alpha * A) / a0;
  c.a1 = (-2 * cw) / a0;
  c.a2 = (1 - alpha / A) / a0;
  return c;
}

BiquadCoef WalkmanDSP::highShelf(float fs, float f0, float gainDb) {
  float A = powf(10.0f, gainDb / 40.0f);
  float w0 = 2.0f * PI * f0 / fs, cw = cosf(w0), sw = sinf(w0);
  float alpha = sw / 2.0f * sqrtf(2.0f);
  float sA = 2.0f * sqrtf(A) * alpha;
  float a0 = (A + 1) - (A - 1) * cw + sA;
  BiquadCoef c;
  c.b0 = A * ((A + 1) + (A - 1) * cw + sA) / a0;
  c.b1 = -2 * A * ((A - 1) + (A + 1) * cw) / a0;
  c.b2 = A * ((A + 1) + (A - 1) * cw - sA) / a0;
  c.a1 = 2 * ((A - 1) - (A + 1) * cw) / a0;
  c.a2 = ((A + 1) - (A - 1) * cw - sA) / a0;
  return c;
}

void WalkmanDSP::begin(float sampleRate) {
  _fs = sampleRate;
  reset();
  setEq(0, 0, 0, false);
  _active = 1 - _active; _pending = false;   // aplicar de inmediato
}

void WalkmanDSP::reset() {
  for (auto& b : _st) for (auto& s : b) s = BiquadState();
}

void WalkmanDSP::setEq(int8_t bassDb, int8_t midDb, int8_t trebleDb, bool megaBass) {
  float bass = bassDb + (megaBass ? 4.0f : 0.0f);   // MEGA BASS = +4 dB extra en el shelf grave
  uint8_t spare = 1 - _active;
  _coef[spare][0] = lowShelf(_fs, 100.0f, bass);
  _coef[spare][1] = peaking(_fs, 2000.0f, (float)midDb, 1.0f);
  _coef[spare][2] = highShelf(_fs, 10000.0f, (float)trebleDb);
  _pending = true;
}

void WalkmanDSP::setVolume(uint8_t v) {
  // Curva aproximadamente logarítmica: 0 → -∞, 100 → 0 dB
  float x = constrain(v, 0, 100) / 100.0f;
  _gain = x * x;
}

void WalkmanDSP::process(int16_t* lr, size_t frames) {
  if (_pending) { _active = 1 - _active; _pending = false; }
  const BiquadCoef* c = _coef[_active];
  const float gain = _gain;
  float pkL = 0, pkR = 0;

  for (size_t i = 0; i < frames; i++) {
    for (int ch = 0; ch < 2; ch++) {
      float x = lr[2 * i + ch] * (1.0f / 32768.0f);
      for (int b = 0; b < 3; b++) {
        BiquadState& s = _st[b][ch];
        float y = c[b].b0 * x + s.z1;
        s.z1 = c[b].b1 * x - c[b].a1 * y + s.z2;
        s.z2 = c[b].b2 * x - c[b].a2 * y;
        x = y;
      }
      x *= gain;
      // Limitador suave (evita recorte duro al subir graves): por encima de 0.8 comprime
      float ax = fabsf(x);
      if (ax > 0.8f) {
        float over = ax - 0.8f;
        ax = 0.8f + over / (1.0f + over * 5.0f);
        if (ax > 0.999f) ax = 0.999f;
        x = copysignf(ax, x);
      }
      if (ch == 0) { if (ax > pkL) pkL = ax; } else { if (ax > pkR) pkR = ax; }
      lr[2 * i + ch] = (int16_t)(x * 32767.0f);
    }
  }
  _peakL = pkL; _peakR = pkR;
}
