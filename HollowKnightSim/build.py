# Inserta imágenes y datos en fuente.html y genera index.html (un solo archivo que se abre con doble clic).
# Antes hay que haber ejecutado construir_mundo.py si cambian las salas o los enemigos.
import base64
from pathlib import Path

here = Path(__file__).parent
uri = lambda n: "data:image/png;base64," + base64.b64encode((here / n).read_bytes()).decode()
html = (here / "fuente.html").read_text(encoding="utf-8")
for mark, value in (("__SHEET__", uri("sprites.png")), ("__ENEMIES__", uri("enemigos.png")), ("__MAPA__", uri("mapa.png")),
                    ("__WORLD__", (here / "mundo.json").read_text(encoding="utf-8"))):
    html = html.replace(mark, value)
(here / "index.html").write_text(html, encoding="utf-8")
print("index.html", len(html) // 1024, "KB")
