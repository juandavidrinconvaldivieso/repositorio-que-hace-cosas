print("\033[251m C A L C U L A D O R A   D E   C A L O R I A S\033[0m")

VERDE = "\033[92m"
ROJO = "\033[91m"
RESET = "\033[0m"
AMARILLO = "\033[33m"

Calorias_Dormido = 1.08
Calorias_Sentado = 1.66

print("\n")
print(f"{VERDE}Digite 1 si ha Dormido{RESET} \n{ROJO}Digite 2 si ha estado Sentado{RESET}")
print("\n")
Actividad_realizada = int(input("Que tipo de actividad hizo?        "))
print("\n")

while True:
    if (Actividad_realizada == 1):
        print(f"{VERDE}", end="")
        Tiempo = int(input("Por cuanto tiempo ha dormido?     "))
        Calorias_Ganadas = Calorias_Dormido * Tiempo
        No_se_que_nombre_ponerle_a_esto = True
        break
    elif (Actividad_realizada == 2):
        print(f"{ROJO}", end="")
        Tiempo = int(input("Por cuanto tiempo se ha sentado?  "))
        Calorias_Ganadas = Calorias_Sentado * Tiempo
        No_se_que_nombre_ponerle_a_esto = True
        break
    else:
        print("No se ha reconocido comando\nIntentelo de nuevo")
        No_se_que_nombre_ponerle_a_esto = False
        break

if (No_se_que_nombre_ponerle_a_esto == True):
    print("\n")
    print(f"{RESET}Usted ha quemado {AMARILLO}{Calorias_Ganadas:.2f}{RESET} Calorias")
elif (No_se_que_nombre_ponerle_a_esto == False):
    print()
print("\n")