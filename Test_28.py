print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Nombre_estudiante = str(input("Como se llama el estudiante?         "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Año_estudiante = int(input("En que año esta el estudiante?       "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Nota1_estudiante = float(input("1era nota tenga el estudiante?       "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Nota2_estudiante = float(input("2da nota tenga el estudiante?        "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Nota3_estudiante = float(input("3ra nota tenga el estudiante?        "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")
Nota4_estudiante = float(input("4da nota tenga el estudiante?        "))
print(f"="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+",  "="*10, "+", "="*5, "+")

Estudiante = {
    "Nombre":Nombre_estudiante,
    "Nota1":Nota1_estudiante,
    "Nota2":Nota2_estudiante,
    "Nota3":Nota3_estudiante,
    "Nota4":Nota4_estudiante,
    "Grado":Año_estudiante
}

Promedio = (Estudiante["Nota1"]+Estudiante["Nota2"]+Estudiante["Nota3"]+Estudiante["Nota4"])/4

print("\n")

if (Promedio >= 0) and (Promedio <= 1):
    print("La nota es DEFICIENTE")
elif (Promedio >= 1.1) and (Promedio <= 2.9):
    print("La nota es INSUFICIENTE")
elif (Promedio >= 3) and (Promedio <= 3.8):
    print("La nota es ACEPTABLE")
elif (Promedio >= 3.9) and (Promedio <= 4.6):
    print("La nota es SOBRESALIENTE")
elif (Promedio >= 4.7) and (Promedio <= 5):
    print("La nota es EXCELENTE")
else:
    print("ERROR")

if (Promedio <= 3.5):
    print(f"El estudiante reprobo y repetira su año")
elif (Promedio >= 3.6 and Estudiante["Grado"] <=10):
    print(f"El estudiante aprobo y va al siguiente (grado {Estudiante['Grado']+1})")
elif (Promedio >= 3.6 and Estudiante["Grado"] ==11):
    print("El estudiante aprobo y va a graduarse")