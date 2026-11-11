// ============================================================================
// TFT_eSPI — Setup para W. Walkman Aero (ILI9341 2.8" + XPT2046 en VSPI)
// Copia este archivo a  Arduino/libraries/TFT_eSPI/User_Setups/
// y en User_Setup_Select.h deja SOLO:
//     #include <User_Setups/User_Setup_Walkman.h>
// ============================================================================
#define USER_SETUP_ID 9341

#define ILI9341_DRIVER
#define TFT_WIDTH  240
#define TFT_HEIGHT 320

// VSPI (pines IO_MUX nativos → permite 40 MHz estable)
#define TFT_MISO 19
#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_CS    5
#define TFT_DC   16
#define TFT_RST  17
#define TOUCH_CS  4        // XPT2046 en el mismo bus

#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define LOAD_GFXFF
#define SMOOTH_FONT

#define SPI_FREQUENCY        40000000
#define SPI_READ_FREQUENCY   20000000
#define SPI_TOUCH_FREQUENCY   2500000

// Usa VSPI (por defecto). La SD va en HSPI, creada aparte en el sketch.
// #define USE_HSPI_PORT   ← NO activar
