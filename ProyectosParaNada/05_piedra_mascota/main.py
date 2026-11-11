"""Una piedra mascota que recuerda tus visitas. Uso: python main.py [mirar|acariciar|alimentar]"""
import json
import os
import sys

ARCHIVO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "piedra.json")
REACCIONES = {
    "mirar": "La piedra te devuelve la mirada. O eso parece.",
    "acariciar": "La piedra sigue siendo una piedra, pero más limpia.",
    "alimentar": "La piedra rechaza la comida con total indiferencia.",
}


def cargar():
    try:
        with open(ARCHIVO, encoding="utf-8") as archivo:
            return json.load(archivo)
    except (OSError, ValueError):
        return {"mirar": 0, "acariciar": 0, "alimentar": 0}


def guardar(estado):
    with open(ARCHIVO, "w", encoding="utf-8") as archivo:
        json.dump(estado, archivo, indent=2)


def main():
    accion = sys.argv[1].lower() if len(sys.argv) > 1 else "mirar"
    if accion not in REACCIONES:
        print(f"La piedra no sabe '{accion}'. Opciones: {', '.join(REACCIONES)}")
        return
    estado = cargar()
    estado[accion] = estado.get(accion, 0) + 1
    guardar(estado)
    print(REACCIONES[accion])
    print(f"Interacciones totales: {sum(estado.values())}. Cariño recibido por la piedra: 0.")


if __name__ == "__main__":
    main()
