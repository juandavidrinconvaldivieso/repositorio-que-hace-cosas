"""Genera excusas para no hacer nada. Uso: python main.py [cantidad]"""
import random
import sys

SUJETOS = ["Mi gato", "El router", "Un vecino", "Mercurio retrógrado", "Mi tía de Cuenca", "El Wi-Fi del edificio"]
ACCIONES = ["se comió", "desconfiguró", "escondió", "le echó agua a", "vendió por internet", "maldijo"]
OBJETOS = ["mi despertador", "mis ganas", "el calendario", "las llaves", "mi sentido del tiempo", "la tarea"]
CIERRES = ["así que hoy no puedo.", "y estoy en duelo.", "y el seguro no lo cubre.", "pero mañana sin falta.", "no insistas."]


def excusa():
    return f"{random.choice(SUJETOS)} {random.choice(ACCIONES)} {random.choice(OBJETOS)}, {random.choice(CIERRES)}"


def main():
    try:
        cantidad = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    except ValueError:
        print("Eso no es un número, pero te sirve de excusa.")
        return
    for numero in range(1, cantidad + 1):
        print(f"{numero}. {excusa()}")


if __name__ == "__main__":
    main()
