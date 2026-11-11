"""Responde cualquier pregunta sin ayudar. La misma pregunta siempre da la misma respuesta.

Uso: python main.py "¿debería comer pizza?"   (sin argumentos, pregunta en bucle)
"""
import hashlib
import sys

RESPUESTAS = [
    "Sí, pero no.",
    "Depende de la humedad.",
    "Pregúntale a una cabra.",
    "La respuesta está dentro de ti, junto con el almuerzo.",
    "Las estrellas están ocupadas.",
    "Tal vez el martes.",
    "Eso ya lo sabías.",
    "Absolutamente quizá.",
]


def consultar(pregunta):
    limpia = pregunta.strip().lower().encode("utf-8")
    indice = int(hashlib.sha256(limpia).hexdigest(), 16) % len(RESPUESTAS)
    return RESPUESTAS[indice]


def main():
    if len(sys.argv) > 1:
        print(consultar(" ".join(sys.argv[1:])))
        return
    print("El Oráculo te escucha. Deja la línea vacía para irte.")
    while True:
        try:
            pregunta = input("> ")
        except (EOFError, KeyboardInterrupt):
            break
        if not pregunta.strip():
            break
        print(consultar(pregunta))
    print("El Oráculo vuelve a su siesta.")


if __name__ == "__main__":
    main()
