#pragma once
#include <Arduino.h>

// ============================================================================
// Enlace UART2 con el ESP32 #2 (A2DP Source hacia audífonos)
// Protocolo de líneas ASCII: ver README.md §2
// ============================================================================

#define LINK_MAX_DEVICES 8

struct BtDevice { char mac[18]; char name[32]; int rssi; };

class BridgeLink {
public:
  void begin();
  void poll();                         // llamar desde taskLink
  void scan();
  void connect(const char* mac);
  void disconnect();
  void setVolume(uint8_t vol0to100);
  void enable(bool on);
  void ping();
  int  deviceCount() const { return _nDev; }
  const BtDevice& device(int i) const { return _dev[i]; }
  bool scanning() const { return _scanning; }
  char connectedMac[18] = "";

private:
  void send(const char* fmt, ...);
  void handleLine(char* line);
  BtDevice _dev[LINK_MAX_DEVICES];
  volatile int _nDev = 0;
  volatile bool _scanning = false;
  char _line[128];
  int _len = 0;
  uint32_t _lastPong = 0, _lastPing = 0;
};

extern BridgeLink bridge;
void taskLink(void*);
