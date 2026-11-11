"""Cuenta toda la nada que hay en una carpeta: archivos vacíos y carpetas vacías."""
import os
import sys


def contar_nada(ruta):
    archivos_vacios = 0
    carpetas_vacias = 0
    for actual, carpetas, archivos in os.walk(ruta):
        if not carpetas and not archivos:
            carpetas_vacias += 1
        for nombre in archivos:
            try:
                if os.path.getsize(os.path.join(actual, nombre)) == 0:
                    archivos_vacios += 1
            except OSError:
                pass
    return archivos_vacios, carpetas_vacias


def main():
    ruta = sys.argv[1] if len(sys.argv) > 1 else "."
    if not os.path.isdir(ruta):
        print(f"'{ruta}' no existe, lo cual ya es bastante nada.")
        return
    archivos, carpetas = contar_nada(ruta)
    print(f"Inspeccionando la nada en: {os.path.abspath(ruta)}")
    print(f"Archivos vacíos:  {archivos}")
    print(f"Carpetas vacías:  {carpetas}")
    print(f"Nada total:       {archivos + carpetas} unidades")
    print("Veredicto: " + ("hay mucha nada." if archivos + carpetas else "aquí ni la nada quiso venir."))


if __name__ == "__main__":
    main()
