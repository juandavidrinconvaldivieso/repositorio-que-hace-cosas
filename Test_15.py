import random
print("\n"*3)
valor_compra = int(input("Cuanto es el total de su compra?      "))
print("\n")

#ya estoy cansado, no lo voy a decorar

Descuento_Aleatorio = random.randint(0,100)
if (Descuento_Aleatorio < 74):
    Descuento = valor_compra*15/100
    Felicitaciones = False
else:
    Descuento = valor_compra*20/100
    Felicitaciones = True

Total_compra = valor_compra-Descuento


print(f"El valor total de su compra es de {valor_compra}")
if (Felicitaciones == False):
    print(f"Por el evento actual a su compra se le desconto el 15%")
    print("\n")
    print(f"Su total de compra es igual a {Total_compra}")
elif (Felicitaciones == True):
    print("WOOOWIE ZOWIEE, HAS GANADO UN ESCUENTAZO DEL 20 %")
    print("\n")
    print(f"Su total de compra es igual a {Total_compra}")
