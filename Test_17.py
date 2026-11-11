Ana = {
    "Nombre":"Ana Belle",
    "Edad":22,
    "Departamento":101,
    "Estado":"Viva"
}
Pietro = {
    "Nombre":"Pietro Crespi",
    "Edad":25,
    "Vivienda":"Macondo",
    "Estado":"se mato :("
}

Nuevo_Vecino = str(input("Como se llama el nuevo vecino?               "))
Edad_nuevo_vecino = int(input("Cuantos años tiene el nuevo vecino?          "))
Departamento_nuevo_vecino = int(input("En que departamento vive el nuevo vecino?    "))
Estado_nuevo_vecino = str(input("Que estado esta el nuevo vecino?             "))

Vecino = Nuevo_Vecino

Vecino = {
    "Nombre":Nuevo_Vecino,
    "Edad":Edad_nuevo_vecino,
    "Departamento":Departamento_nuevo_vecino,
    "Estado":Estado_nuevo_vecino
}

print(Vecino)