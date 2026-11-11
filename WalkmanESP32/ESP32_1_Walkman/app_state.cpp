#include "app_state.h"

AppState g;
portMUX_TYPE stateMux = portMUX_INITIALIZER_UNLOCKED;
QueueHandle_t cmdQueue = nullptr;
SemaphoreHandle_t sdMutex = nullptr;

void showToast(const char* msg, uint32_t ms) {
  portENTER_CRITICAL(&stateMux);
  strncpy(g.toast, msg, sizeof(g.toast) - 1);
  g.toast[sizeof(g.toast) - 1] = 0;
  g.toastUntil = millis() + ms;
  portEXIT_CRITICAL(&stateMux);
}

bool sendCmd(CmdType t, int32_t arg) {
  AudioCmd c{t, arg};
  return xQueueSend(cmdQueue, &c, pdMS_TO_TICKS(20)) == pdTRUE;
}
