Nombre_Usuario = input("Como se llama?                      ").strip().lower()
Contraseña_Usuario = input("Cual es su contraseña?              ").strip().lower()

Verificacion_1 = False
Verificacion_2 = False
Verificacion_3 = False

Contraseña_available = False
Nombre_available = False
Email_available = False


Usuario_1 = {
    "Nombre":"clark",
    "Contraseña":"123456"
}

if Nombre_Usuario == Usuario_1["Nombre"] and Contraseña_Usuario == Usuario_1["Contraseña"]:
        Email_Usuario = input("Ingrese su mail                     ")

        for i in Email_Usuario:
              if i == "@":
                    Verificacion_1 = True
              if i == ".":
                    Verificacion_2 = True


              if Verificacion_1 == True and Verificacion_2 == True:
                    Verificacion_3 = True
              else:
                   print("Usuario no detectado")
            
else:
     print("Usuario no detectado")

if Verificacion_3 == True:
    with open("Usuario1.txt", "a+", encoding="utf-8") as archivo:
        archivo.seek(0)
        if  Usuario_1["Contraseña"] in Usuario_1:
            Contraseña_available = True
            archivo.seek(0)
        if Usuario_1["Nombre"] in Usuario_1:
            Nombre_available = True
            archivo.seek(0)
        if Email_Usuario in Usuario_1:
            Email_available = True
            archivo.seek(0)

        if (Contraseña_available == True and Nombre_available == True and Email_available == True) or (Contraseña_available == True and Nombre_available == True and Email_available == False):
             archivo.write(Usuario_1["Contraseña"])
             archivo.write(Usuario_1["Nombre"])
             archivo.write(Email_Usuario)
        else:
             print()
else:
     ("Usuario no detectado")