/*******************************************************************************
 * W. WALKMAN AERO — ESP32 #2 "BT BRIDGE"
 * I2S Slave RX (audio ya ecualizado por el ESP32 #1) → A2DP Source → audífonos BT
 * Controlado por UART2 desde el ESP32 #1.
 *
 * Placa: ESP32 Dev Module (ESP32-WROOM-32) · Core Arduino-ESP32 3.3.x (ESP-IDF 5)
 * Partición: Huge APP (3MB No OTA)
 * Librería: ESP32-A2DP (pschatzmann) >= 1.8.0
 *
 * Pines:
 *   I2S  BCK=26  WS=25  DIN=22   (desde GPIO26/25/22 del #1)
 *   UART RX=16 (← TX33 del #1)   TX=17 (→ RX35 del #1)
 *   LED=2   BOTÓN=0 (BOOT, pulsación larga 3 s = olvidar audífonos)
 ******************************************************************************/
#include <Arduino.h>
#include "BluetoothA2DPSource.h"
#include "driver/i2s_std.h"

#define FW_VERSION      "BTB-1.1"
#define SWAP_LR         0       // pon 1 si en los audífonos se oyen izquierda y derecha cambiados

// ---------------- Pines ----------------
#define PIN_I2S_BCK     26
#define PIN_I2S_WS      25
#define PIN_I2S_DIN     22
#define PIN_UART_RX     16
#define PIN_UART_TX     17
#define PIN_LED         2
#define PIN_BTN         0

#define UART_BAUD       115200
#define SAMPLE_RATE     44100
#define I2S_PORT        I2S_NUM_0

// ---------------- Ring buffer SPSC (productor: tarea I2S, consumidor: callback BT) ----------------
#define RING_FRAMES     8192                    // 8192 frames * 4 bytes = 32 KB (~186 ms)
#define RING_MASK       (RING_FRAMES - 1)
#define RING_LOW        (RING_FRAMES / 4)       // por debajo: riesgo de corte
#define RING_HIGH       (RING_FRAMES * 3 / 4)   // por encima: el #1 va más rápido que BT → descartar
#define RING_START      (RING_FRAMES / 2)       // pre-buffer antes de empezar a sonar

static uint32_t ring[RING_FRAMES];              // L en 16 bits altos, R en 16 bits bajos
static volatile uint32_t ringHead = 0;          // solo escribe la tarea I2S
static volatile uint32_t ringTail = 0;          // solo escribe el callback BT

static inline uint32_t ringFill() {
  return (__atomic_load_n(&ringHead, __ATOMIC_ACQUIRE) - __atomic_load_n(&ringTail, __ATOMIC_ACQUIRE)) & 0xFFFFFFFF;
}

// ---------------- Estado ----------------
BluetoothA2DPSource a2dp_source;

enum ScanMode { SCAN_IDLE, SCAN_LISTING, SCAN_TARGET };
static volatile ScanMode scanMode = SCAN_TARGET;   // al arrancar acepta la última conexión (auto-reconnect)
static uint8_t  targetMac[6] = {0};
static volatile bool hasTarget = false;
static uint32_t scanEndMs = 0;

#define MAX_SEEN 12
static uint8_t seenMacs[MAX_SEEN][6];
static int     seenCount = 0;

static volatile bool outputEnabled = true;
static volatile bool prebuffering  = true;
static volatile bool i2sActive     = false;
static volatile uint32_t underruns = 0, drops = 0;
static char connectedName[64] = "";
static uint8_t volumeBT = 100;

static portMUX_TYPE seenMux = portMUX_INITIALIZER_UNLOCKED;
static SemaphoreHandle_t uartMutex;

// ---------------- Utilidades ----------------
static void uartSend(const char* fmt, ...) {
  char buf[128];
  va_list ap; va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  xSemaphoreTake(uartMutex, portMAX_DELAY);
  Serial2.println(buf);
  xSemaphoreGive(uartMutex);
  Serial.print("[TX→#1] "); Serial.println(buf);
}

static void macToStr(const uint8_t* m, char* out) {
  sprintf(out, "%02X:%02X:%02X:%02X:%02X:%02X", m[0], m[1], m[2], m[3], m[4], m[5]);
}

static bool strToMac(const char* s, uint8_t* m) {
  unsigned v[6];
  if (sscanf(s, "%x:%x:%x:%x:%x:%x", &v[0], &v[1], &v[2], &v[3], &v[4], &v[5]) != 6) return false;
  for (int i = 0; i < 6; i++) m[i] = (uint8_t)v[i];
  return true;
}

// ---------------- Callbacks A2DP Source ----------------

// Se llama por cada dispositivo encontrado durante el descubrimiento.
// true = conectar a este dispositivo.
static bool onDeviceFound(const char* ssid, esp_bd_addr_t address, int rssi) {
  if (scanMode == SCAN_LISTING) {
    bool isNew = true;
    portENTER_CRITICAL(&seenMux);
    for (int i = 0; i < seenCount; i++) if (memcmp(seenMacs[i], address, 6) == 0) { isNew = false; break; }
    if (isNew && seenCount < MAX_SEEN) memcpy(seenMacs[seenCount++], address, 6);
    portEXIT_CRITICAL(&seenMux);
    if (isNew) {
      char mac[18]; macToStr(address, mac);
      uartSend("DEV %s %d %s", mac, rssi, (ssid && *ssid) ? ssid : "(sin_nombre)");
    }
    return false;   // seguimos listando
  }
  if (scanMode == SCAN_TARGET && hasTarget && memcmp(address, targetMac, 6) == 0) {
    strncpy(connectedName, ssid ? ssid : "BT", sizeof(connectedName) - 1);
    return true;
  }
  return false;
}

static void onConnectionState(esp_a2d_connection_state_t state, void* obj) {
  switch (state) {
    case ESP_A2D_CONNECTION_STATE_CONNECTED: {
      char mac[18]; macToStr(targetMac, mac);
      uartSend("STATE CONNECTED %s %s", mac, connectedName[0] ? connectedName : "Audifonos");
      a2dp_source.set_volume(volumeBT);
      prebuffering = true;
      break;
    }
    case ESP_A2D_CONNECTION_STATE_CONNECTING: {
      char mac[18]; macToStr(targetMac, mac);
      uartSend("STATE CONNECTING %s", mac);
      break;
    }
    case ESP_A2D_CONNECTION_STATE_DISCONNECTED:
      uartSend("STATE DISCONNECTED");
      break;
    default: break;
  }
}

// Botones físicos de los audífonos (AVRCP passthrough) → los reenvía al #1
static void onAvrcKey(uint8_t key, bool isReleased) {
  if (!isReleased) return;
  switch (key) {
    case 0x44: uartSend("KEY PLAY");  break;   // ESP_AVRC_PT_CMD_PLAY
    case 0x46: uartSend("KEY PAUSE"); break;   // ESP_AVRC_PT_CMD_PAUSE
    case 0x4B: uartSend("KEY NEXT");  break;   // ESP_AVRC_PT_CMD_FORWARD
    case 0x4C: uartSend("KEY PREV");  break;   // ESP_AVRC_PT_CMD_BACKWARD
    case 0x41: uartSend("KEY VOLUP"); break;
    case 0x42: uartSend("KEY VOLDN"); break;
    default: break;
  }
}

// Bluedroid pide 'frame_count' frames estéreo 16 bit. Corre en core 0: nada bloqueante aquí.
static int32_t getAudioFrames(Frame* frame, int32_t frame_count) {
  static int16_t lastL = 0, lastR = 0;
  static uint32_t dropCounter = 0;

  uint32_t fill = ringFill();

  if (prebuffering) {
    if (fill >= RING_START) prebuffering = false;
    else { memset(frame, 0, frame_count * sizeof(Frame)); return frame_count; }
  }

  uint32_t tail = ringTail;
  for (int32_t i = 0; i < frame_count; i++) {
    if (fill == 0) {
      // Underrun: decae suavemente la última muestra para no hacer "clic"
      lastL = (int16_t)(lastL * 0.95f); lastR = (int16_t)(lastR * 0.95f);
      frame[i].channel1 = lastL; frame[i].channel2 = lastR;
      if (i == 0) underruns++;
      continue;
    }
    // Deriva de reloj: el #1 (APLL) y la radio BT no van exactamente a 44 100 Hz
    if (fill > RING_HIGH && (++dropCounter & 63) == 0) {
      tail = (tail + 1) & RING_MASK; fill--; drops++;
      if (fill == 0) { i--; continue; }
    }
    uint32_t s = ring[tail];
    tail = (tail + 1) & RING_MASK; fill--;
    lastL = (int16_t)(s >> 16); lastR = (int16_t)(s & 0xFFFF);
    frame[i].channel1 = outputEnabled ? lastL : 0;
    frame[i].channel2 = outputEnabled ? lastR : 0;
  }
  __atomic_store_n(&ringTail, tail, __ATOMIC_RELEASE);
  if (fill < 64) prebuffering = true;   // se vació: volver a pre-cargar para evitar tartamudeo
  return frame_count;
}

// ---------------- I2S Slave RX ----------------
// Driver I2S nuevo de ESP-IDF 5 (core 3.x). El antiguo driver/i2s.h está obsoleto
// y aborta en tiempo de ejecución si alguna librería enlaza el nuevo.
static i2s_chan_handle_t rxChan = nullptr;

static void setupI2S() {
  i2s_chan_config_t chanCfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_PORT, I2S_ROLE_SLAVE);
  chanCfg.dma_desc_num = 8;
  chanCfg.dma_frame_num = 256;
  ESP_ERROR_CHECK(i2s_new_channel(&chanCfg, nullptr, &rxChan));

  i2s_std_config_t stdCfg = {
    .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
    .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO),
    .gpio_cfg = {
      .mclk = I2S_GPIO_UNUSED,
      .bclk = (gpio_num_t)PIN_I2S_BCK,
      .ws   = (gpio_num_t)PIN_I2S_WS,
      .dout = I2S_GPIO_UNUSED,
      .din  = (gpio_num_t)PIN_I2S_DIN,
      .invert_flags = { .mclk_inv = false, .bclk_inv = false, .ws_inv = false },
    },
  };
  ESP_ERROR_CHECK(i2s_channel_init_std_mode(rxChan, &stdCfg));
  ESP_ERROR_CHECK(i2s_channel_enable(rxChan));
}

// Productor: lee del I2S y empuja al ring. Si el ring está lleno se descarta lo más nuevo.
static void taskI2SReader(void*) {
  static int16_t buf[512];   // 256 frames estéreo
  for (;;) {
    size_t bytesRead = 0;
    // Con timeout devuelve ESP_ERR_TIMEOUT pero puede traer datos parciales: usar bytesRead
    i2s_channel_read(rxChan, buf, sizeof(buf), &bytesRead, 30);
    if (bytesRead == 0) { i2sActive = false; continue; }   // el #1 no está enviando reloj
    i2sActive = true;

    uint32_t frames = bytesRead / 4;
    uint32_t head = ringHead;
    uint32_t freeSpace = RING_FRAMES - 1 - ringFill();
    if (frames > freeSpace) { drops += frames - freeSpace; frames = freeSpace; }
    for (uint32_t i = 0; i < frames; i++) {
      // I2S estándar: primero canal izquierdo, luego derecho (SWAP_LR corrige placas que lo invierten)
      int16_t l = buf[2 * i + SWAP_LR], r = buf[2 * i + 1 - SWAP_LR];
      ring[head] = ((uint32_t)(uint16_t)l << 16) | (uint16_t)r;
      head = (head + 1) & RING_MASK;
    }
    __atomic_store_n(&ringHead, head, __ATOMIC_RELEASE);
  }
}

// ---------------- UART: órdenes desde el ESP32 #1 ----------------
static void handleCommand(char* line) {
  Serial.print("[RX←#1] "); Serial.println(line);
  char* arg = strchr(line, ' ');
  if (arg) { *arg = 0; arg++; while (*arg == ' ') arg++; }

  if (!strcmp(line, "PING")) {
    uartSend("PONG %s", FW_VERSION);
  } else if (!strcmp(line, "SCAN")) {
    portENTER_CRITICAL(&seenMux); seenCount = 0; portEXIT_CRITICAL(&seenMux);
    if (a2dp_source.is_connected()) a2dp_source.disconnect();
    scanMode = SCAN_LISTING;
    scanEndMs = millis() + 12000;
    uartSend("OK SCAN");
  } else if (!strcmp(line, "CONNECT") && arg) {
    uint8_t mac[6];
    if (!strToMac(arg, mac)) { uartSend("ERR BAD_MAC"); return; }
    if (a2dp_source.is_connected()) a2dp_source.disconnect();
    memcpy(targetMac, mac, 6);
    hasTarget = true;
    connectedName[0] = 0;
    scanMode = SCAN_TARGET;
    uartSend("STATE CONNECTING %s", arg);
  } else if (!strcmp(line, "DISCONNECT")) {
    hasTarget = false;
    scanMode = SCAN_IDLE;
    a2dp_source.disconnect();
  } else if (!strcmp(line, "FORGET")) {
    hasTarget = false;
    scanMode = SCAN_IDLE;
    a2dp_source.disconnect();
    a2dp_source.clean_last_connection();
    uartSend("OK FORGET");
  } else if (!strcmp(line, "VOL") && arg) {
    volumeBT = (uint8_t)constrain(atoi(arg), 0, 127);
    a2dp_source.set_volume(volumeBT);
    uartSend("OK VOL %d", volumeBT);
  } else if (!strcmp(line, "ENABLE") && arg) {
    outputEnabled = atoi(arg) != 0;
    uartSend("OK ENABLE %d", outputEnabled ? 1 : 0);
  } else if (!strcmp(line, "STATUS")) {
    uartSend(a2dp_source.is_connected() ? "STATE CONNECTED - %s" : "STATE DISCONNECTED%s",
             a2dp_source.is_connected() ? connectedName : "");
  } else {
    uartSend("ERR UNKNOWN %s", line);
  }
}

static void taskUart(void*) {
  static char line[96];
  int len = 0;
  for (;;) {
    while (Serial2.available()) {
      char c = Serial2.read();
      if (c == '\r') continue;
      if (c == '\n') {
        line[len] = 0;
        if (len > 0) handleCommand(line);
        len = 0;
      } else if (len < (int)sizeof(line) - 1) {
        line[len++] = c;
      }
    }
    if (scanMode == SCAN_LISTING && (int32_t)(millis() - scanEndMs) > 0) {
      scanMode = hasTarget ? SCAN_TARGET : SCAN_IDLE;
      uartSend("SCAN_END %d", seenCount);
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

// ---------------- Setup / Loop ----------------
void setup() {
  Serial.begin(115200);
  Serial2.begin(UART_BAUD, SERIAL_8N1, PIN_UART_RX, PIN_UART_TX);
  uartMutex = xSemaphoreCreateMutex();
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BTN, INPUT_PULLUP);

  setupI2S();

  a2dp_source.set_local_name("W.Walkman BT-Out");
  a2dp_source.set_ssid_callback(onDeviceFound);
  a2dp_source.set_on_connection_state_changed(onConnectionState);
  a2dp_source.set_avrc_passthru_command_callback(onAvrcKey);
  a2dp_source.set_auto_reconnect(true);           // al arrancar vuelve a los últimos audífonos
  a2dp_source.set_data_callback_in_frames(getAudioFrames);
  a2dp_source.set_volume(volumeBT);
  a2dp_source.start();

  xTaskCreatePinnedToCore(taskI2SReader, "i2sRx", 4096, nullptr, 6, nullptr, 1);
  xTaskCreatePinnedToCore(taskUart,      "uart",  4096, nullptr, 3, nullptr, 1);

  uartSend("BOOT %s", FW_VERSION);
}

void loop() {
  static uint32_t lastStat = 0, btnDown = 0;
  bool connected = a2dp_source.is_connected();

  // LED: fijo = conectado, parpadeo rápido = buscando, lento = inactivo
  uint32_t period = connected ? 0 : (scanMode == SCAN_IDLE ? 1000 : 200);
  digitalWrite(PIN_LED, connected ? HIGH : ((millis() / period) & 1));

  // Pulsación larga del botón BOOT: olvidar audífonos
  if (digitalRead(PIN_BTN) == LOW) {
    if (!btnDown) btnDown = millis();
    else if (millis() - btnDown > 3000) {
      char forget[] = "FORGET";
      handleCommand(forget);
      btnDown = 0;
      while (digitalRead(PIN_BTN) == LOW) delay(10);
    }
  } else btnDown = 0;

  if (millis() - lastStat > 5000) {
    lastStat = millis();
    uartSend("STAT %u %u %u %d", (unsigned)(ringFill() * 100 / RING_FRAMES),
             (unsigned)underruns, (unsigned)drops, i2sActive ? 1 : 0);
  }
  delay(20);
}
