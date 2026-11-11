print("\n"*10)

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Alquiler_Finca = int(input("cuanto es el alquiler de la finca?        "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Mesas_incluidas = int(input("Cuantas mesas incluye?                   "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Sillas_incluidas = int(input("Cuantantas sillas incluye               "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

print("\n")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Modificar_costos_muebles = str(input("Va a modificar los costos de los muebles?         "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

if(Modificar_costos_muebles == "si" or Modificar_costos_muebles == "SI" or Modificar_costos_muebles == "Si"):

    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

    Costo_silla_adicional = int(input("Costo por cada silla adicional:                  "))

    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

    Costo_mesa_adicional = int(input("Costo por cada mesa adicional:                    "))

    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

elif(Modificar_costos_muebles == "no" or Modificar_costos_muebles == "NO" or Modificar_costos_muebles == "No"):

    Costo_silla_adicional = 3000

    Costo_mesa_adicional = 25000


print("\n")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Modificar_costos_comida = str(input("Va a modificar los costos de la comida?            "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")


if(Modificar_costos_comida == "si" or Modificar_costos_comida == "SI" or Modificar_costos_comida == "Si"):

    Comida_niño = int(input("Cuanto cuesta la comida de niños?                          "))

    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

    Comida_adultos = int(input("Cuanto cuesta la comida de adultos?                     "))

    print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

elif(Modificar_costos_comida == "no" or Modificar_costos_comida == "NO" or Modificar_costos_comida == "No"):

    Comida_adultos = 28000

    Comida_niño = 18000


print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Cantidad_adultos = int(input("Cuantos adultos asistiran?                                "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Cantidad_niños = int(input("Cuantos niños asistiran?                                    "))

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")



Mesas_necesarias = -(-Cantidad_adultos+Cantidad_niños)//6
Mesas_adicionales = Mesas_incluidas-Mesas_necesarias
Costo_de_mesa_adicional = Mesas_adicionales*Costo_mesa_adicional

#-*- = +
#+*+ = +
#+*- = -
#-*+ = -

Sillas_necesarias = Cantidad_niños+Cantidad_adultos
Sillas_adicionales = Sillas_necesarias-Sillas_incluidas
Costo_de_silla_adicional = Sillas_adicionales*Costo_silla_adicional

Costo_de_la_comida_de_adulto = Cantidad_adultos*Comida_adultos
Costo_de_la_comida_de_niño = Cantidad_niños*Comida_niño
Total_comida = Costo_de_la_comida_de_adulto+Costo_de_la_comida_de_niño

Total_evento = (Alquiler_Finca+Costo_de_mesa_adicional+Costo_de_silla_adicional+Total_comida)

Total_imprevitos = Total_evento*0.10
Cuota_persona = (Total_evento+Total_imprevitos)/(Cantidad_adultos)

print("\n"*10)


print("T  O  T  A  L")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

print(f"El alquiler de la finca insertado fue de {Alquiler_Finca}")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

print(f"Costo total mesas                        {Costo_de_mesa_adicional}")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

print(f"Costo total sillas                       {Costo_de_silla_adicional}")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

print(f"Costo total comida                       {Total_comida}")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")


print("\n"*2)


print("F  I  N  A  L")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

print(f"El total del evento es                   {Total_imprevitos:.2f}")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

print(f"Si se pagase por cada asistente          {Cuota_persona}")

print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")


input("presione \"ENTER\" para salir de el codigo")