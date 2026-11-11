import sys
import time

VERDE = "\033[92m"
ROJO = "\033[91m"
RESET = "\033[0m"
AMARILLO = "\033[33m"
AZUL = "\033[34m"

print("\n"*15)

print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Pago_Premium = str(input(f"El usuario ha realizado pagos para la cuenta {AMARILLO}premium?{RESET}    {AZUL}")).upper().strip()
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Periodo_de_prueba = str(input(f"Su cuenta esta en periodo de pureba?                     {AZUL}")).upper().strip()
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Actividad_cuenta = str(input(f"Que tan activa es su cuenta?  ({VERDE}Muy activa{RESET}/{ROJO}Poco activa{RESET})   {AZUL}")).upper().strip()
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")

def animacion_espera(segundos):
    print("Accediendo al contenido Premium", end="")
    for _ in range(segundos * 2):
        for puntos in [".  ", ".. ", "...", "   "]:
            sys.stdout.write(f"\rAccediendo al contenido {AMARILLO}Premium{RESET}{puntos}")
            sys.stdout.flush()
            time.sleep(0.18)

print("\n"*2)
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")

if (Actividad_cuenta == "MUY ACTIVA" and Pago_Premium == "SI") or (Periodo_de_prueba == "SI" and Actividad_cuenta == "MUY ACTIVA"):
    animacion_espera(3)
    print("")
    print(f"BIENVENIDO AL MODO {AMARILLO}PREMIUM{RESET}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
else:
    print(f"Lo sentimos, pero usted {ROJO} no puede acceder a el modo {AMARILLO}premium{RESET}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")