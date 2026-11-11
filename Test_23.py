print("\n"*3)

Edad = int(input("Ingrese la edad                        "))
Genero = str (input("Ingrese el genero (Hombre o mujer)     ")).upper().strip()

if Genero == "HOMBRE":
    Pronombre_creo = "un"
    Genero_Usuario_Pequeño = "niño"
    Genero_Usuario_Medio = "adolecente"
    Genero_Usuario_Adulto = "adulto"
    Genero_Usuario_Mayor = "adulto mayor"
elif Genero == "MUJER":
    Pronombre_creo = "una"
    Genero_Usuario_Pequeño = "niña"
    Genero_Usuario_Medio = "adolecente"
    Genero_Usuario_Adulto = "adulta"
    Genero_Usuario_Mayor = "adulta mayor"

print("\n"*2)


if Edad >=0 and Edad <= 5:
    print(f"El usuario es {Pronombre_creo} {Genero_Usuario_Pequeño} pequeño")
elif Edad >= 6 and Edad <= 12:
    print(f"El usuario es {Pronombre_creo} {Genero_Usuario_Pequeño} grande")
elif Edad >= 13 and Edad <= 17:
    print(f"El usuario es {Pronombre_creo} {Genero_Usuario_Medio}")
elif Edad >= 18 and Edad <= 70:
    print(f"EL usuario es {Pronombre_creo} {Genero_Usuario_Adulto}")
elif Edad >= 71 and Edad <= 120:
    print(f"El usuario es {Pronombre_creo} {Genero_Usuario_Mayor}")
else:
    print(f"La edad \"{Edad}\" supera\nla capacidad admitida del\nsistema")