#include "uart_link.h"
#include "config.h"
#include "app_state.h"
#include "lrc_parser.h"

BridgeLink bridge;

void BridgeLink::begin() {
  Serial2.begin(LINK_BAUD, SERIAL_8N1, PIN_LINK_RX, PIN_LINK_TX);
  ping();
}

void BridgeLink::send(const char* fmt, ...) {
  char buf[96];
  va_list ap; va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  Serial2.println(buf);
}

void BridgeLink::ping()                { send("PING"); _lastPing = millis(); }
void BridgeLink::scan()                { _nDev = 0; _scanning = true; send("SCAN"); }
void BridgeLink::connect(const char* m){ send("CONNECT %s", m); }
void BridgeLink::disconnect()          { send("DISCONNECT"); }
void BridgeLink::enable(bool on)       { send("ENABLE %d", on ? 1 : 0); }
// AVRCP absolute volume es 0..127. El DSP ya aplica el volumen, así que en BT dejamos
// el volumen del audífono alto y fijo salvo que el usuario lo cambie a propósito.
void BridgeLink::setVolume(uint8_t v)  { send("VOL %d", (int)(v * 127 / 100)); }

void BridgeLink::handleLine(char* line) {
  Serial.printf("[#2] %s\n", line);
  char* arg = strchr(line, ' ');
  if (arg) *arg++ = 0;

  if (!strcmp(line, "PONG") || !strcmp(line, "BOOT") || !strcmp(line, "STAT")) {
    _lastPong = millis();
    g.bridgeAlive = true;
  } else if (!strcmp(line, "DEV") && arg && _nDev < LINK_MAX_DEVICES) {
    BtDevice& d = _dev[_nDev];
    char name[64] = "";
    if (sscanf(arg, "%17s %d %63[^\n]", d.mac, &d.rssi, name) >= 2) {
      utf8ToAscii(name, d.name, sizeof(d.name));
      _nDev++;
      g.dirty = true;
    }
  } else if (!strcmp(line, "SCAN_END")) {
    _scanning = false;
    g.dirty = true;
  } else if (!strcmp(line, "STATE") && arg) {
    if (!strncmp(arg, "CONNECTED", 9)) {
      char mac[18] = "", name[64] = "";
      sscanf(arg + 9, "%17s %63[^\n]", mac, name);
      portENTER_CRITICAL(&stateMux);
      g.btHeadphonesLinked = true;
      utf8ToAscii(name, g.btHeadphonesName, sizeof(g.btHeadphonesName));
      g.output = OUT_BT;
      g.dirty = true;
      portEXIT_CRITICAL(&stateMux);
      strlcpy(connectedMac, mac, sizeof(connectedMac));
      enable(true);
      showToast("Audifonos BT conectados");
    } else if (!strncmp(arg, "DISCONNECTED", 12)) {
      portENTER_CRITICAL(&stateMux);
      g.btHeadphonesLinked = false;
      g.output = OUT_JACK;
      g.dirty = true;
      portEXIT_CRITICAL(&stateMux);
      connectedMac[0] = 0;
      showToast("BT desconectado: salida Jack 3.5");
    } else if (!strncmp(arg, "CONNECTING", 10)) {
      showToast("Conectando audifonos...");
    }
  } else if (!strcmp(line, "KEY") && arg) {
    // Botones de los audífonos → mismas acciones que el dock
    if (!strcmp(arg, "PLAY") || !strcmp(arg, "PAUSE")) sendCmd(CMD_TOGGLE_PAUSE);
    else if (!strcmp(arg, "NEXT")) sendCmd(CMD_NEXT);
    else if (!strcmp(arg, "PREV")) sendCmd(CMD_PREV);
    else if (!strcmp(arg, "VOLUP")) { g.volume = min(100, g.volume + 5); }
    else if (!strcmp(arg, "VOLDN")) { g.volume = max(0, g.volume - 5); }
  }
}

void BridgeLink::poll() {
  while (Serial2.available()) {
    char c = Serial2.read();
    if (c == '\r') continue;
    if (c == '\n') { _line[_len] = 0; if (_len) handleLine(_line); _len = 0; }
    else if (_len < (int)sizeof(_line) - 1) _line[_len++] = c;
  }
  if (millis() - _lastPing > 4000) ping();
  if (g.bridgeAlive && millis() - _lastPong > 12000) { g.bridgeAlive = false; g.dirty = true; }
}

void taskLink(void*) {
  for (;;) { bridge.poll(); vTaskDelay(pdMS_TO_TICKS(10)); }
}
