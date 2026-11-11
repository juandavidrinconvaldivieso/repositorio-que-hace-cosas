import time
import sys

print("\n"*4)
Autos = {
    "BMW":650000,
    "Megane":120000,
    "Mercedes":700000,
    "Twingo":100000,
    "Chevrolet Aveo":150000
}

print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
print("Esta disponible el: BMW, Megane, Mercedes, Twingo y el Chevrolet Aveo")
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Vehiculo = str(input("Que vehiculo va a alquilar?         ")).strip().upper()
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
Dias_alquiler = int(input("Por cuantos dias va a alquilar?     "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
Seguro = str(input("Tomara el seguro todo riesgo?       ")).strip().upper()
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")

Total = 0
Descuento = 0
Totalisimo = 0

def escribir_procedural(texto, velocidad=0.05):
    for letra in texto:
        sys.stdout.write(letra)
        sys.stdout.flush()
        time.sleep(velocidad)
    print()

def animacion_espera(segundos):
    print("Espere", end="")
    for _ in range(segundos * 2):
        for puntos in [".  ", ".. ", "...", "   "]:
            sys.stdout.write(f"\rEspere{puntos}")
            sys.stdout.flush()
            time.sleep(0.10)


match Vehiculo:
    case "BMW":
        Total = Total + Autos["BMW"]
    case "MEGANE":
        Total = Total + Autos["Megane"]
    case "MERCEDES":
        Total = Total + Autos["Mercedes"]
    case "TWINGO":
        Total = Total + Autos["Twingo"]
    case "CHEVROLETAVEO":
        Total = Total + Autos["BMW"]
    case _:
        print("ERROR")

semitotal_alquiler = Total * Dias_alquiler

if Dias_alquiler >= 3 and Dias_alquiler <= 5:
    Descuento = semitotal_alquiler * 0.10
elif Dias_alquiler >= 6 and Dias_alquiler <= 10:
    Descuento = semitotal_alquiler * 0.15
elif Dias_alquiler > 10:
    Descuento = semitotal_alquiler * 0.20

casitotal_alquiler = semitotal_alquiler-Descuento

match Seguro:
    case "SI":
        Totalisimo = casitotal_alquiler*0.05
    case _:
        Totalisimo = casitotal_alquiler
animacion_espera(5)
print("Espere")
print("\n"*3)

print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
escribir_procedural(f"El auto que comprara es un         {Vehiculo}", velocidad=0.03)
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
escribir_procedural(f"Alquilala su auto por              {Dias_alquiler} dias", velocidad=0.03)
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
escribir_procedural(f"El precio sin descuento es         {semitotal_alquiler}", velocidad=0.03)
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
escribir_procedural(f"Debes de pagas la suma de          {Totalisimo}", velocidad=0.03)
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")