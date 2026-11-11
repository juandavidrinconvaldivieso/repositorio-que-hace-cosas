#pragma once
#include <Arduino.h>

// ============================================================================
// Pantallas Walkman Aero (coordenadas del simulador HTML, 320x240)
//   PLAYER : tarjeta Walkman (carátula + carretes + VU) + panel LRC de 4 líneas
//   MENU   : columna de 5 categorías (MicroSD, Videos, Spotify, Guardar SD, Salida)
//   EQ     : 3 deslizadores Biquad + presets + volumen
//   VIDEO  : MJPEG 320x180 + subtítulos .SRT + barra de progreso
// taskUI (core 1) es el ÚNICO dueño del TFT y del táctil.
// ============================================================================

void uiBegin();
void taskUI(void*);
