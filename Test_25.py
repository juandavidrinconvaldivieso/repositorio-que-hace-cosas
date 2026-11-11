import time
import sys

print("\n"*15)

print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Computadoras_compradas = int(input("Cuantas computadoras va a comprar?      "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Precio = 11000
Pago_total = Computadoras_compradas * Precio

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

animacion_espera(3)
print("Espere")
print("")

if Computadoras_compradas < 5:
    Descuento = Pago_total*10/100
    Total_descontado = Pago_total - Descuento
elif Computadoras_compradas >= 5 and Computadoras_compradas <= 10:
    Descuento = Pago_total*20/100
    Total_descontado = Pago_total - Descuento
elif Computadoras_compradas > 10:
    Descuento = Pago_total*40/100
    Total_descontado = Pago_total - Descuento


print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
escribir_procedural(f"El total es {Pago_total}", velocidad = 0.03)
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
escribir_procedural(f"Usted recibio un descuento de {Descuento} a su compra", velocidad = 0.03)
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
escribir_procedural(f"El total con descuento es {Total_descontado}", velocidad = 0.03)
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")