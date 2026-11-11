"""
Limpia las caras exportadas para la pantalla:
  1. Convierte cada píxel a blanco o negro puro. Cuenta como dibujo todo
     lo que se distingue claramente del fondo (así no se cortan las líneas
     finas, como las burbujas) y el ruido casi invisible pasa a ser fondo.
  2. Elimina píxeles sueltos: manchas de 1-2 píxeles y píxeles cuyos
     4 vecinos (arriba, abajo, izquierda, derecha) son del color contrario.
  3. Invierte los colores (blanco <-> negro), estilo pantalla OLED.

Lee de  Caras/          (los originales no se modifican)
Guarda en Caras_limpias/ con las mismas carpetas y nombres.
Además incrusta las caras dentro de monitor.html, para que la página
funcione sola en cualquier computadora (sin necesitar las carpetas).

Uso:  python limpiar_caras.py
"""
import base64
import glob
import json
import os
import re

import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIGEN = os.path.join(AQUI, 'Caras')
DESTINO = os.path.join(AQUI, 'Caras_limpias')
PAGINA = os.path.join(AQUI, 'monitor.html')
UMBRAL = 70           # diferencia mínima con el fondo (0-255) para ser dibujo
MANCHA_MAX = 2        # manchas de este tamaño o menos se borran


def a_blanco_y_negro(ruta):
    """Devuelve (tinta, fondo_oscuro): tinta = True donde hay píxel negro."""
    im = np.asarray(Image.open(ruta).convert('RGBA')).astype(float)
    rgb, alfa = im[..., :3], im[..., 3:4] / 255
    gris = (rgb * alfa + 255 * (1 - alfa)).mean(axis=2)   # transparente = blanco
    fondo_oscuro = np.median(gris) < 128
    dibujo = (gris > UMBRAL) if fondo_oscuro else (gris < 255 - UMBRAL)
    tinta = ~dibujo if fondo_oscuro else dibujo
    return tinta


def borrar_manchas_pequenas(tinta):
    """Cambia de color cualquier grupo de MANCHA_MAX píxeles o menos (de ambos colores)."""
    h, w = tinta.shape
    resultado = tinta.copy()
    total = 0
    for color in (True, False):
        visto = np.zeros_like(tinta)
        for y in range(h):
            for x in range(w):
                if tinta[y, x] != color or visto[y, x]:
                    continue
                grupo, pila = [], [(y, x)]
                visto[y, x] = True
                while pila:
                    cy, cx = pila.pop()
                    grupo.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and not visto[ny, nx] and tinta[ny, nx] == color:
                                visto[ny, nx] = True
                                pila.append((ny, nx))
                if len(grupo) <= MANCHA_MAX:
                    for gy, gx in grupo:
                        resultado[gy, gx] = not color
                    total += len(grupo)
    return resultado, total


def quitar_pixeles_sueltos(tinta):
    """Cambia de color los píxeles rodeados (en cruz) por el color contrario."""
    total = 0
    while True:
        p = np.pad(tinta, 1, mode='edge')
        arriba, abajo = p[:-2, 1:-1], p[2:, 1:-1]
        izq, der = p[1:-1, :-2], p[1:-1, 2:]
        suelto_negro = tinta & ~arriba & ~abajo & ~izq & ~der
        suelto_blanco = ~tinta & arriba & abajo & izq & der
        cambios = suelto_negro | suelto_blanco
        n = int(cambios.sum())
        if n == 0:
            return tinta, total
        tinta = tinta ^ cambios
        total += n


incrustadas = {}
for ruta in sorted(glob.glob(os.path.join(ORIGEN, '*', '*.png'))):
    tinta = a_blanco_y_negro(ruta)
    tinta, manchas = borrar_manchas_pequenas(tinta)
    tinta, sueltos = quitar_pixeles_sueltos(tinta)
    sueltos += manchas
    # Invertido: lo que era tinta negra ahora es blanco sobre fondo negro
    salida = np.where(tinta, 255, 0).astype(np.uint8)
    rel = os.path.relpath(ruta, ORIGEN)
    destino = os.path.join(DESTINO, rel)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    Image.fromarray(salida, 'L').save(destino, optimize=True)
    with open(destino, 'rb') as f:
        incrustadas[rel.replace(os.sep, '/')] = 'data:image/png;base64,' + base64.b64encode(f.read()).decode()
    print(f'{rel:24s} píxeles sueltos quitados: {sueltos}')

# Incrusta las caras en monitor.html, entre las marcas CARAS-INICIO y CARAS-FIN
with open(PAGINA, encoding='utf-8') as f:
    html = f.read()
bloque = ('// CARAS-INICIO (lo genera limpiar_caras.py, no editar a mano)\n'
          'const CARAS_DATA = ' + json.dumps(incrustadas, indent=1) + ';\n'
          '// CARAS-FIN')
html, n = re.subn(r'// CARAS-INICIO.*?// CARAS-FIN', lambda m: bloque, html, flags=re.S)
if n != 1:
    raise SystemExit('No encontré las marcas CARAS-INICIO / CARAS-FIN en monitor.html')
with open(PAGINA, 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)
print(f'\n{len(incrustadas)} caras incrustadas en monitor.html')
