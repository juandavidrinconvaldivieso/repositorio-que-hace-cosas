// ===========================================================
//  Monitor de Planta - envía los sensores por USB (Serial)
//  Reemplaza la pantalla OLED: los datos se ven en monitor.html
// ===========================================================
//
//  Conexiones (ajusta los pines si los tienes en otros):
//   - Sensor de luz (LDR / fotoresistencia con divisor) -> A0
//   - Sensor de humedad de suelo: sonda + módulo (chip LM393)
//
//        Sonda (2 cables) -> los 2 pines del lado del módulo
//        Módulo VCC -> pin D7 del Arduino
//        Módulo GND -> GND del Arduino
//        Módulo A0  -> pin A1 del Arduino
//        Módulo D0  -> no se usa
//
//     El módulo se alimenta desde D7 solo al medir, así la sonda
//     se corroe mucho menos con el tiempo. Si prefieres conectar
//     VCC a 5V fijo, también funciona.
//     Con el módulo: tierra seca = valor alto, mojada = valor bajo
//     (la página web lo convierte a % correctamente).
//
//  Formato que se envía cada segundo (una línea):
//      luz=523;hum=687
//  Son valores crudos de 0 a 1023. La conversión a % y la
//  calibración se hacen en la página web, así no hay que volver
//  a cargar el programa para ajustar.
//
//  IMPORTANTE: cierra el "Monitor Serie" del IDE de Arduino antes
//  de conectar la página, porque solo un programa puede usar el
//  puerto a la vez.
// ===========================================================

const int PIN_LUZ = A0;
const int PIN_HUMEDAD = A1;
const int PIN_ALIM_HUMEDAD = 7;   // alimenta el módulo solo al medir
const unsigned long INTERVALO_MS = 1000;

// Toma 20 lecturas, descarta las 5 más altas y las 5 más bajas
// (picos de ruido) y promedia las 10 del medio.
const int N_LECTURAS = 20;
const int DESCARTAR = 5;

int leerPromedio(int pin) {
  // El Arduino tiene un solo conversor para todas las entradas
  // analógicas: al cambiar de pin, la primera lectura puede arrastrar
  // el valor del pin anterior. Se descarta y se espera un poco.
  analogRead(pin);
  delay(5);

  int lecturas[N_LECTURAS];
  for (int i = 0; i < N_LECTURAS; i++) {
    lecturas[i] = analogRead(pin);
    delay(3);
  }

  // Ordena de menor a mayor (método sencillo, son pocos datos)
  for (int i = 1; i < N_LECTURAS; i++) {
    int v = lecturas[i], j = i - 1;
    while (j >= 0 && lecturas[j] > v) { lecturas[j + 1] = lecturas[j]; j--; }
    lecturas[j + 1] = v;
  }

  long suma = 0;
  for (int i = DESCARTAR; i < N_LECTURAS - DESCARTAR; i++) suma += lecturas[i];
  return suma / (N_LECTURAS - 2 * DESCARTAR);
}

void setup() {
  Serial.begin(9600);
  pinMode(PIN_ALIM_HUMEDAD, OUTPUT);
  digitalWrite(PIN_ALIM_HUMEDAD, LOW);
}

void loop() {
  int luz = leerPromedio(PIN_LUZ);

  digitalWrite(PIN_ALIM_HUMEDAD, HIGH);   // enciende el módulo
  delay(50);                              // le da tiempo a estabilizarse
  int humedad = leerPromedio(PIN_HUMEDAD);
  digitalWrite(PIN_ALIM_HUMEDAD, LOW);    // la apaga para que no se corroa

  Serial.print("luz=");
  Serial.print(luz);
  Serial.print(";hum=");
  Serial.println(humedad);

  delay(INTERVALO_MS);
}

// -----------------------------------------------------------
//  ¿Tu sensor de humedad es un DHT11/DHT22 (humedad del AIRE)?
//  Instala la librería "DHT sensor library" de Adafruit y cambia
//  el loop por algo así (la página también mostrará "temp"):
//
//    #include <DHT.h>
//    DHT dht(2, DHT11);           // pin de datos 2
//    // en setup():  dht.begin();
//    // en loop():
//    Serial.print("luz=");  Serial.print(leerPromedio(PIN_LUZ));
//    Serial.print(";hum="); Serial.print(dht.readHumidity());
//    Serial.print(";temp=");Serial.println(dht.readTemperature());
//
//  y en la página marca la opción "La humedad ya viene en %".
// -----------------------------------------------------------
