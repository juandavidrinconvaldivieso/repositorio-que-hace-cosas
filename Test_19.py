Usuario1 = {
    "U_Contraseña":"ABC123",
    "N_Usuario":"Admin"
}

Usuario2 = {
    "U_Contraseña":"",
    "N_Usuario":""

}

True1 = True

Usuario = str(input("Cual es el usuario de la cuenta?        "))
Contraseña = str(input("Cual es la contraseña del usuario?      "))

def Inicio():
    while True:
        if((Usuario == Usuario1["N_Usuario"] and Contraseña == Usuario1["U_Contraseña"]) or (Usuario == Usuario2["N_Usuario"] and Contraseña == Usuario2["U_Contraseña"])):
            print(f"Bienvenido {Usuario1['N_Usuario']}")
            print("\n"*2)
            True1 = True
            Menu_principal()
        else:
            print("Error\nError\nError\nError\nError")

def Menu_principal():
    while True1 == True:
        print("Que desea hacer?")
        print("1 Crear cuenta nueva\n2 Cambiar parametros\n3 Cerrar sesion\n\n")
        opcion = int(input(""))
        if(opcion == 1):
            print("\n")
            Nuevo_usuario =str(input("Cual es el Nickname del nuevo usuario?            "))
            print("\n")
            Nueva_contraseña =str(input("Cual es la contraseña del nuevo usuario?           "))
            print("\n")
            Usuario2["N_Usuario"] = Nuevo_usuario
            Usuario2["U_Contraseña"] = Nueva_contraseña
            print("Creacion exitosa!!")
            print("\n")
            continue
        elif(opcion == 2):
            print("\n")
            print(f"El usuario actual es {Usuario1["N_Usuario"]}")
            Cambio_usuario = str(input("Cual es el nuevo usuario?                      "))
            print("\n")
            print(f"La contraseña actual es {Usuario1["U_Contraseña"]}")
            Cambio_contraseña = str(input("Cual es la nueva contraseña?                   "))
            print("\n")
            Usuario1["N_Usuario"] = Cambio_usuario
            Usuario1["U_Contraseña"] = Cambio_contraseña
            print("Cambio Exitoso!!")
            continue
        elif(opcion == 3):
            print("Cerrando sesion..")
            True1 = False
            return True1
        else:
            print("Comando no reconocido"*3)