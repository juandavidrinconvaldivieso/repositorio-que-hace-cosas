print("\n"*10)

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Placa_Carro = str(input("Que placa tiene su carro?                "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Horas_pasadas = int(input("Cuantas horas lleva su carro?          "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Minutos_pasados = int(input("Cuantos minutos lleva su carro?        "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Valor_por_Hora = 2

VERDE = "\033[92m"
ROJO = "\033[91m"
RESET = "\033[0m"
AMARILLO = "\033[33m"

if(Minutos_pasados >= 1 and Minutos_pasados <= 60):
    Minutos_pasados = 0
    Horas_pasadas = Horas_pasadas + 1
    Total_Parqueadero = Horas_pasadas*Valor_por_Hora
    print("\n"*7)
    print(f"{AMARILLO}F  A  C  T  U  R  A{RESET}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
    print(f"Tiene que pagar {VERDE}{Total_Parqueadero} Dolares ($){RESET} por su carro \nPlaca {AMARILLO}{Placa_Carro}{RESET}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

elif(Minutos_pasados == 0):
    Total_Parqueadero = Horas_pasadas*Valor_por_Hora
    print("\n"*7)
    print(f"{AMARILLO}F  A  C  T  U  R  A{RESET}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
    print(f"Tiene que pagar {VERDE}{Total_Parqueadero} Dolares ($){RESET} por su carro \nPlaca {AMARILLO}{Placa_Carro}{RESET}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

elif(Minutos_pasados >= 61):
    print("\n"*7)
    print(f"{ROJO}E R R O R\n"*50)
    print(f"{RESET}Ha sobrepasado el limite de minutos\n"*5)