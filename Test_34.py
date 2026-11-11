print("\n"*10)
Tabla_Inicial = int(input("Digite la tabla con la que se iniciara:      "))
Tabla_Final = int(input("Digite la tabla con la que se finalizara:    "))
Multiplicador_Inicial = int(input("Digite el multiplicador inicial:             "))
Multiplicador_Final = int(input("Digite el multiplicador final:               "))


while Tabla_Inicial <= Tabla_Final:
    Auxiliar_multipicador_inicial = Multiplicador_Inicial

    print("\n"*2)
    print(f"La tabla del {Tabla_Inicial}")
    print("\n")

    while Auxiliar_multipicador_inicial <= Multiplicador_Final:
        print(f"{Tabla_Inicial}X{Auxiliar_multipicador_inicial}={Tabla_Inicial*Auxiliar_multipicador_inicial}")
        Auxiliar_multipicador_inicial = Auxiliar_multipicador_inicial+1
    Tabla_Inicial = Tabla_Inicial+1