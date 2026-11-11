import time
import sys

Email = str(input("Ingrese sui Mail:        "))

def escribir_procedural(texto, velocidad=0.03):
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
            time.sleep(0.08)

x = False

for i in (Email):
    if i == "@":
        animacion_espera(1)
        print("\n"*2)
        escribir_procedural("El mail es Valido")
        x = True
        break
if x == False:
    escribir_procedural("El mail NO es valido")
    