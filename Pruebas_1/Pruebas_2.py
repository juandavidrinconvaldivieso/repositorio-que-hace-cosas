import time
import sys

VERDE = "\033[92m"
ROJO = "\033[91m"
RESET = "\033[0m"
AMARILLO = "\033[33m"
AZUL = "\033[34m"

print("\n"*5)

print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
Deportista = str(input(f"Es el estudiante un deportista destacado?       {AZUL}")).upper().strip()
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
Estrato = int(input(f"En que estrato esta el estudiante?              {AZUL}"))
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
Promedio = float(input(f"Cual es el promedio del estudiante?    (1-5)    {AZUL}"))
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")


def animacion_espera(segundos):
    print("Accediendo al contenido Premium", end="")
    for _ in range(segundos * 2):
        for puntos in [".  ", ".. ", "...", "   "]:
            sys.stdout.write(f"\rAccediendo al contenido {AMARILLO}Premium{RESET}{puntos}")
            sys.stdout.flush()
            time.sleep(0.14)


print("\n")
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
animacion_espera(3)
print("")


if ((Estrato == 1 or Estrato == 2) and Promedio >= 3.8):
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
    print(f"{VERDE}Recibe el beneficio")
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
elif(Deportista == "SI"):
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
    print(f"{VERDE}Recibe el beneficio")
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
else:
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
    print(f"{ROJO}No aplica para el beneficio")
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")