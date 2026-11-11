print("\n"*3)
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Nota1 = float(input("Cuanto saco el estudiante en el primer examen?:    "))
Peso1 = float(input("Que tanto peso tiene esto en la nota final?        "))

disclamer1 = 100 - Peso1

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Nota2 = float(input("Cuanto saco el estudiante en el segundo examen?:   "))
print(f"Cuidado, solo puede usar {disclamer1} para el resto de notas")
Peso2 = float(input("Que tanto peso tiene esto en la nota final?        "))

disclamer2 = disclamer1 - Peso2

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Nota3 = float(input("Cuanto saco el estudiante en el tercer examen?:    "))
print(f"Cuidado, solo puede usar {disclamer2} para esta nota")
Peso3 = float(input("Que tanto peso tiene esto en la nota final?        "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

NombreAlumno = str(input("Como se llama el estudiante?                  "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Suma_de_notas = (Nota1 * Peso1) + (Nota2 * Peso2) + (Nota3 * Peso3)
Suma_de_peso_de_notas = Peso1 + Peso2 + Peso3

Nota_final = Suma_de_notas / Suma_de_peso_de_notas

print(f"La nota final de {NombreAlumno} es {Nota_final}")