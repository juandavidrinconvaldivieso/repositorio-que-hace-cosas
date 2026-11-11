VERDE = "\033[92m"
ROJO = "\033[91m"
RESET = "\033[0m"
AMARILLO = "\033[33m"
AZUL = "\033[34m"
MORADO = '\033[95m'
NARANJA = "\033[38;5;208m"
AMARILLISIMO = "\033[93m"
ERROR = "\33[7;49;31m"

primera = float(input('''1er numero   '''))
segunda = float(input('''2do numero   '''))
inputing = int(input(f'''{AMARILLO}escoje una operacion:\n{VERDE}1:Sumar\n{MORADO}2:Restar\n{ROJO}3:Multiplicar\n{NARANJA}4:Dividir\n{AZUL}'''))
resultado = 0

match inputing:
    case 1:
        print(f"{VERDE}")
        resultado = primera + segunda
    case 2:
        print(f"{MORADO}")
        resultado = primera - segunda
    case 3:
        print(f"{ROJO}")
        resultado = primera*segunda
    case 4:
        print(f"{NARANJA}")
        resultado = primera/segunda

print(f"resultado = {resultado:,.1f}{RESET}")