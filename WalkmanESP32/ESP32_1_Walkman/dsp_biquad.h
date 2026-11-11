#pragma once
#include <Arduino.h>

// ============================================================================
// DSP Walkman: 3 Biquad IIR (RBJ Audio EQ Cookbook) + volumen + limitador suave
//   CLEAR BASS    100 Hz  Low-Shelf  (S = 1)
//   VOCAL CLARITY 2 kHz   Peaking    (Q = 1.0)
//   TREBLE SHINE  10 kHz  High-Shelf (S = 1)
// Procesado en float (el ESP32 tiene FPU de precisión simple).
// ============================================================================

struct BiquadCoef { float b0, b1, b2, a1, a2; };

struct BiquadState { float z1 = 0, z2 = 0; };   // Forma directa II transpuesta

class WalkmanDSP {
public:
  void begin(float sampleRate);
  // Se puede llamar desde la UI: calcula en el buffer libre y avisa al audio
  void setEq(int8_t bassDb, int8_t midDb, int8_t trebleDb, bool megaBass);
  void setVolume(uint8_t vol0to100);
  // Procesa int16 estéreo intercalado in-place. Llamar SOLO desde la tarea de audio.
  void process(int16_t* lr, size_t frames);
  // Picos del último bloque (0..1) para los vúmetros
  float peakL() const { return _peakL; }
  float peakR() const { return _peakR; }
  void reset();

private:
  static BiquadCoef lowShelf(float fs, float f0, float gainDb);
  static BiquadCoef peaking(float fs, float f0, float gainDb, float q);
  static BiquadCoef highShelf(float fs, float f0, float gainDb);

  float _fs = 44100;
  BiquadCoef _coef[2][3];            // doble buffer [banco][banda]
  volatile uint8_t _active = 0;      // banco que usa el audio
  volatile bool _pending = false;    // hay banco nuevo listo
  BiquadState _st[3][2];             // [banda][canal]
  volatile float _gain = 0.7f;
  float _peakL = 0, _peakR = 0;
};

extern WalkmanDSP dsp;
