print("\n"*5)

vacio={'poq648': '3/10/2012',
    'hjk234': '15/06/2015',
    'xyz789': '22/11/2018',
    'mno456': '10/01/2020',
    'abc123': '05/12/2023',
    'rtv987': '18/04/2016'}

while True:
    Numero_placa = str(input("Que placa va a ingresar?:       "))
    Fecha = str(input("Ingrese numero de fecha      "))
    vacio[Numero_placa]=Fecha
    Busqueda = str(input("Que placa se va a buscar?:        "))
    print(vacio[Busqueda])