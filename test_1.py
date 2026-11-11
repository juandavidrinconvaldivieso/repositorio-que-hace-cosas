#Enunciado: Una tienda anuncia un descuento sobre el precio de lista de un televisor. Después de aplicar el descuento, se debe sumar el impuesto nacional y el impuesto municipal (ambos como porcentajes), calculados sobre el precio ya descontado. Calcule el precio final al comprador.


chale = float(input("cuanto vale el precio?                                       "))
dscuento = float(input("cuanto es el descuento?                                      "))
impuesto_nacional = float(input("Cuanto es el impuesto nacional de su pais?                   "))
impuesto_municipal = float(input("Cuanto es el impuesto municipal de su pais?                  "))

resoult = dscuento*(chale/100)
resoult2 = chale-resoult
resoult_mun = impuesto_municipal*(chale/100)
resoult_nac = impuesto_nacional*(chale/100)
tot = resoult2 + resoult_nac + resoult_mun


print("\n"*3)
print("F A C T U R A")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"el descontado:                                              {resoult}")
print(f"el precio sin impuestos:                                    {resoult2}")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"los impuestos son:")
print(f"municipal:                                                  {resoult_mun}")
print(f"nacional:                                                   {resoult_nac}")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*10, "+", "="*10, "+")
print(f"El total es:                                                {tot}")


