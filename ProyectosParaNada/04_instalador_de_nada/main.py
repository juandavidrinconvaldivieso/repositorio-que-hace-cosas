"""Instala absolutamente nada, con barra de progreso. Uso: python main.py [segundos_por_paso]"""
import sys
import time

PASOS = [
    "Descargando 0 bytes",
    "Descomprimiendo el vacío",
    "Verificando que no haya nada",
    "Registrando la ausencia",
    "Limpiando lo que no se ensució",
]
ANCHO = 30


def barra(fraccion):
    llenos = int(ANCHO * fraccion)
    return "[" + "#" * llenos + "-" * (ANCHO - llenos) + f"] {int(fraccion * 100):3d}%"


def main():
    try:
        pausa = float(sys.argv[1]) if len(sys.argv) > 1 else 0.4
    except ValueError:
        pausa = 0.4
    for numero, paso in enumerate(PASOS, start=1):
        print(f"{paso}...")
        time.sleep(max(pausa, 0))
        print(barra(numero / len(PASOS)))
    print("Instalación completada. Se instalaron 0 archivos en 0 carpetas.")


if __name__ == "__main__":
    main()
