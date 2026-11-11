data = []

VERDE = "\033[92m"
ROJO = "\033[91m"
RESET = "\033[0m"
AMARILLO = "\033[33m"
AZUL = "\033[34m"
MORADO = '\033[95m'
NARANJA = "\033[38;5;208m"
AMARILLISIMO = "\033[93m"
ERROR = "\33[7;49;31m"

while True:
    print("\n")
    print(f"""
{VERDE}    1. Registrar
{AMARILLO}    2. Actualizar
{NARANJA}    3. Consultar
{ROJO}    4. Eliminar
{MORADO}    5. Salir
{RESET}""")


    Desicion = int(input(f"{AMARILLISIMO}Que accion va a hacer?                         {AZUL}"))

    match Desicion:
        case 1:
            print("\n")
            insert_data = str(input(f"{VERDE}Registre su nombre                             {AZUL}")).upper()
            data.append(insert_data)
            print(f"{VERDE}Se ha registrado {insert_data} en la base de datos{RESET}")
        case 2:
            print("\n")
            if len(data) == 0:
                print(f"{ERROR}No hay datos en la base{RESET}")
            else:
                insert_data = input(f"{AMARILLO}Que nombre va a actualizar?                    {AZUL}").upper()
                place = data.index(insert_data)
                if insert_data not in data:
                    print(f"{ERROR} Los datos no estan en la variable{RESET}")
                else:
                    new_data = input(f"{AMARILLO}Por que va a reemplazar a {insert_data}?                {AZUL}").upper()
                    data[place] = new_data
                    print(f"{VERDE}listo, se ha reemplazado {insert_data} por {new_data}{RESET}")
                
        case 3:
            if not data:
                print(f"{ERROR}No hay datos en la base{RESET}")
            print(f"{NARANJA}{data}{RESET}")
        case 4:
            print("\n")
            if len(data) == 0:
                print(f"{ERROR}No hay datos que eliminar{RESET}")
            else:
                insert_data = (input(f"{ROJO}Que desea eliminar?(\"Todo\" para vaciar todo)   {AZUL}")).upper()
                if insert_data == ("TODO"):
                    for i in range (3):
                        seguridad = input(f"{ROJO}Esta seguro de eliminar todo?                  {AZUL}").upper().strip()
                        if seguridad == "SI":
                            pass
                        else:
                            break
                        if i  == 2:
                            data.clear()
                            print(f"{VERDE}listo, se ha eliminado TODO{RESET}")
                else:
                    place = data.index(insert_data)
                    data.pop(place)
                    print(f"{VERDE}listo, se ha eliminado {insert_data}{RESET}")
        case 5:
            print(f"{MORADO}Adios :){RESET}")
            break
        case _:
            print("\n")
            print(f"{ERROR}Comando no reconocido{RESET}")