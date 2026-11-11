Numero_usuario = int(input("Digite un Numero porfavor:      "))
x = 1
Contador = 0

while x <= Numero_usuario:
    if Numero_usuario % x == 0:
        Contador = Contador +1
    x=x+1

if  Contador == 2:
    print(f"El numero {Numero_usuario} es primo")
else:
    print(f"El numero {Numero_usuario} NO es primo")