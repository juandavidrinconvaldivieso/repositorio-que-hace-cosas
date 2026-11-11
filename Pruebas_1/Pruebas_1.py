VERDE = "\033[92m"
ROJO = "\033[91m"
RESET = "\033[0m"
AMARILLO = "\033[33m"
AZUL = "\033[34m"

print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Reconocimiento = int(input(f"Cuantos reconocimientos tiene el estudiante?  {AZUL}"))
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Promedio = float(input(f"Cual es el promedio de el estudiante          {AZUL}"))
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Asistencia = int(input(f"Cual es el porcentaje de asistencia? (%)      {AZUL}"))
print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")

print("\n")

if (Promedio >= 4 and Asistencia >= 85):
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
    print(f"{VERDE}Entra al torneo")
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
elif (Reconocimiento >= 1):
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
    print(f"{VERDE}Entra al torneo")
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
else:
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
    print(f"{ROJO}LARGO!!")
    print(f"{RESET}="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")