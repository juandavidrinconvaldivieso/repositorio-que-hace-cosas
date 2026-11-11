print("\n"*10)
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Nombre_empleado = str(input("Como se llama el empleado?:                 "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Salario_Basico = int(input(f"Cuanto gano {Nombre_empleado}?                           "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Descuento_Salud = 4
Descuento_Pension = 4

Horas_extras = str(input(f"{Nombre_empleado} trabajo horas extra?                   "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Suma_horas_extra = 0

true1 = True

while (true1 == True):
    if (Horas_extras == "si" or Horas_extras == "SI" or Horas_extras == "Si"):
        print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
        Tipo_horas_extras = str(input(f"Que tipo de horas extra trabajo {Nombre_empleado}?       "))
        print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
        Tiempo_horas_extras = int(input(f"Por cuanto tiempo hizo {Nombre_empleado} horas extra?    "))
        print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
        if(Tipo_horas_extras == "diurna", Tipo_horas_extras == "DIURNA", Tipo_horas_extras == "Diurna"):
            Suma_horas_extra = Suma_horas_extra + (Salario_Basico*25)/100
        elif(Tipo_horas_extras == "nocturna", Tipo_horas_extras == "NOCTURNA", Tipo_horas_extras == "Nocturna"):
            Suma_horas_extra = Suma_horas_extra + (Salario_Basico*35)/100
        elif(Tipo_horas_extras == "Festvo", Tipo_horas_extras == "festivo", Tipo_horas_extras == "FESTIVO"):
            Suma_horas_extra = Suma_horas_extra + (Salario_Basico*75)/100
        elif(Tipo_horas_extras == "dominico", Tipo_horas_extras == "DOMINICO", Tipo_horas_extras == "Dominico"):
            Suma_horas_extra = Suma_horas_extra + (Salario_Basico*100)/100
        Volver = str(input(f"{Nombre_empleado} ha hecho mas horas extra?               "))
        if(Volver == "si" or Volver == "SI" or Volver == "Si"):
            continue
        elif(Volver == "no" or Volver == "NO" or Volver == "NO"):
            break
    elif (Horas_extras == "no" or Horas_extras == "NO" or Horas_extras == "No"):
        break
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Salario_semitotal = Salario_Basico + Suma_horas_extra

Resta_pension = (Salario_semitotal*Descuento_Pension)/100
Resta_salud = (Salario_semitotal*Descuento_Pension)/100

Resta_total = Resta_salud + Resta_pension

Salario_sin_contar_dias = Salario_semitotal - Resta_total
Dias_asistidos = int(input(f"Cuantos dias ha venido a trabajar {Nombre_empleado}?     "))
Salario_Casitotal = Salario_sin_contar_dias/30
Paga_por_dias = Salario_Casitotal*Dias_asistidos

print("\n"*5)
print("S A L A R I O")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"A {Nombre_empleado} se le paga ${Salario_Basico} como basico                    |")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"A {Nombre_empleado} se le paga ${Salario_semitotal} como salario mas horas extra|")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"A {Nombre_empleado} se le descuenta ${Salario_sin_contar_dias} del total        |")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"A {Nombre_empleado} se le paga ${Salario_Casitotal} por dia                     |")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"A {Nombre_empleado} se le paga ${Paga_por_dias} en total por el mes             |")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")