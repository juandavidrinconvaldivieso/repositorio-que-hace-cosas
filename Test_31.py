intentos = 0
x = 1

while intentos < 3:
    usuario = input("Digite usuario             ")
    contraseña = input("Digite contraseña          ")
    intentos = intentos +1

    if usuario == "Juan" and contraseña == "123456":
        print("acceso permitido")
        intentos = 7
    else:
        print(f"Error, lleva {intentos} intentos")
if (intentos == 3):
    print("Bloqueado")
    
if intentos == 7:
    print("calculadora XD")
    while x < 10:
        numero = int(input("ingrese un numero           "))
        if numero % 2 == 0:
            print("Es un numero par")
        else:
            print("No es un par")
        x = x+1