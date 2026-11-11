Camisetas = 120
Valor_de_camiseta = 100

Total_produccion = Camisetas + Valor_de_camiseta
Porcentaje_Publicidad = 40
Cuanto_se_le_resta = (Total_produccion*Porcentaje_Publicidad)/100
Total_Ganancia = Total_produccion-Cuanto_se_le_resta



print("\n"*5)
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
print(f"El total de produccion fue:          {Total_produccion}")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
print(f"El dinero gastado en publicidad fue: {Cuanto_se_le_resta}")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")
print(f"El total de ganancia es:             {Total_Ganancia}")
print("="*11, "+", "="*10, "+", "="*10, "+", "="*5, "+")


