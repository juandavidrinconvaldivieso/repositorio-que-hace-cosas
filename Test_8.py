print("\n"*5)
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Cantidad_Ropa = float(input("Cuanta ropa trajo?                       "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Peso_de_Ropa = float(input("Cuanto pesa una prenda de su ropa?       "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
Va_a_hacer_secado = str(input("Va ha hacer el ciclo de secado? (+$2)  "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Precio_por_kilo = 5
Precio_por_secado = 2

Ropa_semitotal = (Cantidad_Ropa*Peso_de_Ropa)*Precio_por_kilo

if (Va_a_hacer_secado == "si" or Va_a_hacer_secado == "SI" or Va_a_hacer_secado == "Si"):
    Ropa_semitotal + Precio_por_secado
elif (Va_a_hacer_secado == "no" or Va_a_hacer_secado == "NO" or Va_a_hacer_secado == "No"):   
    Ropa_semitotal = Ropa_semitotal

print("\n"*3)
print("F  A  C  T  U  R  A")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"Va a pagar por {Cantidad_Ropa} prendas")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"Tiene que pagar {Ropa_semitotal}")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+")

Pago = int(input("Ingrese el valor con el que va a pagar:          "))


if(Ropa_semitotal != Pago):
    print(" 🡣 🡣 🡣 Se puede en 10, 5, 2 🡣 🡣 🡣 ")
    En_cuantas_monedas = int(input("En cuantas monedas quiere su  pago?   "))
    print("\n")

    Vuelto = Pago-Ropa_semitotal
    Cambio = Vuelto//En_cuantas_monedas
    Residual = Vuelto % En_cuantas_monedas
    if(Vuelto == 0):
        print("Ya esta todo pago!")
    elif(Vuelto > 0):
        print(f"Ya le estamos dando {Cambio:.0f} como vuelto")
elif(Ropa_semitotal == Pago):
    print("Ya esta todo pago!")