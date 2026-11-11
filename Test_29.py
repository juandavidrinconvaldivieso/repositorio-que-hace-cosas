print("\n"*5)

Raza_de_perros = {
    "Pitbull":6000000,
    "Buly":6500000,
    "Rottweiler":4000000,
    "Labrador":3500000,
    "Golden":3500000,
    "Doberman":5000000,
    "Dogo":5500000
}

print("Calculadora de Razas de perro basandose en su puesto")
print("\n")
print("1.Pitbull, 2.Buly, 3.Rottweiler, 4.Labrador, 5.Retriever, 6.Doverman, 7.Dogo argentino")
print("\n")

Raza = int(input("Que raza es el perro?       "))
Puesto = int(input("Que puesto tiene?           "))

match Raza:
    case 1:
        Valor_nuevo = 6000000
    case 2:
        Valor_nuevo = 6500000
    case 3:
        Valor_nuevo = 4000000
    case 4:
        Valor_nuevo = 3500000
    case 5:
        Valor_nuevo = 3500000
    case 6:
        Valor_nuevo = 5000000
    case 7:
        Valor_nuevo = 5500000

match Puesto:
    case 1:
        Valor_nuevo = Valor_nuevo*2
    case 2:
        Valor_nuevo = Valor_nuevo+800000
    case 3:
        Valor_nuevo = Valor_nuevo+200000

match Raza:
    case 1:
        Raza_de_perros["Pitbull"] = Valor_nuevo
    case 2:
        Raza_de_perros["Buly"] = Valor_nuevo
    case 3:
        Raza_de_perros["Rottweiler"] = Valor_nuevo
    case 4:
        Raza_de_perros["Labrador"] = Valor_nuevo
    case 5:
        Raza_de_perros["Golden"] = Valor_nuevo
    case 6:
        Raza_de_perros["Doberman"] = Valor_nuevo
    case 7:
        Raza_de_perros["Dogo"] = Valor_nuevo

print("\n")

print("N U E V O S  P R E C I O S")
print("Pitbull    = ", end="")
print(Raza_de_perros["Pitbull"])
print("Buly       = ", end="")
print(Raza_de_perros["Buly"])
print("Rottweiler = ", end="")
print(Raza_de_perros["Rottweiler"])
print("Labrador   = ", end="")
print(Raza_de_perros["Labrador"])
print("Golden     = ", end="")
print(Raza_de_perros["Golden"])
print("Doberman   = ", end="")
print(Raza_de_perros["Doberman"])
print("Dogo       = ", end="")
print(Raza_de_perros["Dogo"])