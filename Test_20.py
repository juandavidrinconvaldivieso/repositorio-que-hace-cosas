print("\n"*15)

Es_el_saldo_suficiente = str(input("Es el saldo suficiente?             "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
Monto_de_la_compra = float(input("Cuanto es el total del pago?        "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
Two_factors_autentification = str(input("Tiene el 2FA activado?         "))
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")

Twofa = False

print("\n"*3)

if(Two_factors_autentification == "Si" or Two_factors_autentification == "si" or Two_factors_autentification == "SI"):
   Twofa = True
else:
    Twofa = False

if((Es_el_saldo_suficiente == "Si" or Es_el_saldo_suficiente == "si" or Es_el_saldo_suficiente == "SI") and (Monto_de_la_compra <= 500)):
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
    print(f"COMPRA APROBADA!!      Debe pagar {Monto_de_la_compra}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
elif((Twofa == True)):
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
    print(f"COMPRA APROBADA!!      Debe pagar {Monto_de_la_compra}")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
else:
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
    print("COMPA RECHAZADA")
    print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")