// ===========================================================
//  Diagnóstico del sensor de humedad (sonda + módulo LM393)
//  Súbelo, abre el Monitor Serie (lupa arriba a la derecha)
//  a 9600 y lee el resultado. Cada 3 segundos repite la prueba.
//
//  Conexión esperada:
//    Módulo A0  -> Arduino A1
//    Módulo GND -> Arduino GND
//    Módulo VCC -> Arduino 5V  (o pin 7)
// ===========================================================

const int PIN_HUMEDAD = A1;
const int PIN_ALIM = 7;

int leer() {
  analogRead(PIN_HUMEDAD);
  delay(5);
  long s = 0;
  for (int i = 0; i < 20; i++) { s += analogRead(PIN_HUMEDAD); delay(2); }
  return s / 20;
}

void setup() {
  Serial.begin(9600);
  pinMode(PIN_ALIM, OUTPUT);
  delay(500);
  Serial.println();
  Serial.println("=== DIAGNOSTICO DEL SENSOR DE HUMEDAD ===");
  Serial.println("Deja la sonda AL AIRE (seca) para la primera prueba.");
}

void loop() {
  // 1) Pin 7 apagado
  digitalWrite(PIN_ALIM, LOW);
  delay(100);
  int apagado = leer();

  // 2) Pin 7 encendido
  digitalWrite(PIN_ALIM, HIGH);
  delay(100);
  int encendido = leer();

  // 3) ¿Está flotando? Se activa una resistencia interna que "jala" el
  //    pin hacia arriba. Si nada está conectado, el valor se dispara a ~1023.
  //    Si el módulo está conectado, el valor casi no cambia.
  pinMode(PIN_HUMEDAD, INPUT);
  int sinPullup = leer();
  pinMode(PIN_HUMEDAD, INPUT_PULLUP);
  delay(20);
  int conPullup = leer();
  pinMode(PIN_HUMEDAD, INPUT);

  Serial.println();
  Serial.println("-----------------------------------------");
  Serial.print("A1 con pin 7 APAGADO:   "); Serial.println(apagado);
  Serial.print("A1 con pin 7 ENCENDIDO: "); Serial.println(encendido);
  Serial.print("A1 normal:              "); Serial.println(sinPullup);
  Serial.print("A1 con resistencia int: "); Serial.println(conPullup);
  Serial.println();

  bool flotando = (conPullup - sinPullup) > 300;
  bool vccEnPin7 = (encendido - apagado) > 200;

  Serial.print("Diagnostico: ");
  if (flotando) {
    Serial.println("A1 NO esta conectado al modulo (pin flotando).");
    Serial.println("  -> Revisa el cable que va del pin A0 del MODULO al pin A1 del ARDUINO.");
    Serial.println("  -> Asegurate de no usar el pin D0 del modulo por error.");
  } else if (encendido < 100 && apagado < 100) {
    Serial.println("El modulo responde pero da casi 0: parece SIN CORRIENTE.");
    Serial.println("  -> Revisa VCC del modulo -> 5V del Arduino y GND -> GND.");
    Serial.println("  -> Debe encenderse una luz roja en el modulo.");
  } else {
    Serial.println("El modulo esta conectado y funciona.");
    if (vccEnPin7) Serial.println("  (VCC esta conectado al pin 7)");
    else           Serial.println("  (VCC esta conectado a 5V fijo)");
    Serial.println("  Ahora: al AIRE debe dar ALTO (900-1023);");
    Serial.println("         en AGUA debe BAJAR claramente (300-600).");
    Serial.println("  Si al aire da bajo, revisa que la sonda este bien");
    Serial.println("  conectada al modulo y que sus patas esten secas y limpias.");
  }
  delay(3000);
}
