import time

Edad_usuario =int(input("Cuantos años tiene el usuario?     "))

if (Edad_usuario >= 18):
    print("ACCESO_PERMITIDO")
    time.sleep(1)
    print("PASE_POR_FAVOR")
else:
    print("LARGO_DE_AQUI!!!")
    time.sleep(1.2)
    print("ESTO_ES_UN_BAR   ")
    time.sleep(0.7)
    print("PARA_ADULTOS   ")
    time.sleep(0.7)
    print("NIÑO")