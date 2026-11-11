# Intercambio Krita <-> Adobe Animate mediante una carpeta con PNG + manifest.json
import json
import os

from krita import Krita, Extension
from PyQt5.QtGui import QImage
from PyQt5.QtWidgets import QFileDialog, QMessageBox

MASCARAS = ("transparencymask", "filtermask", "transformmask", "selectionmask", "colorizemask")


def aviso(texto):
    QMessageBox.information(None, "Krita <-> Animate", texto)


def capas(nodo, ruta=""):
    """Capas finales de arriba abajo; los grupos se aplanan en el nombre (Grupo/Capa)."""
    for n in reversed(nodo.childNodes()):
        if n.type() in MASCARAS:
            continue
        if n.type() == "grouplayer":
            yield from capas(n, ruta + n.name() + "/")
        else:
            yield n, ruta + n.name()


def leer_manifest(carpeta):
    datos = open(os.path.join(carpeta, "manifest.json"), "rb").read()
    for cod in ("utf-8-sig", "cp1252"):
        try:
            return json.loads(datos.decode(cod))
        except (UnicodeDecodeError, ValueError):
            pass
    raise ValueError("manifest.json ilegible")


class Kra2Animate(Extension):
    def setup(self):
        pass

    def createActions(self, window):
        a = window.createAction("kra2animate_export", "Exportar para Adobe Animate...", "tools/scripts")
        a.triggered.connect(self.exportar)
        b = window.createAction("kra2animate_import", "Importar desde Adobe Animate...", "tools/scripts")
        b.triggered.connect(self.importar)

    def exportar(self):
        doc = Krita.instance().activeDocument()
        if not doc:
            return aviso("Abre primero un documento.")
        if doc.colorModel() != "RGBA" or doc.colorDepth() != "U8":
            return aviso("El documento debe estar en RGB/Alfa 8 bits.\n"
                         "Usa Imagen > Convertir espacio de color de la imagen.")
        carpeta = QFileDialog.getExistingDirectory(None, "Carpeta donde guardar la exportacion para Animate")
        if not carpeta:
            return
        w, h = doc.width(), doc.height()
        lista = list(capas(doc.rootNode()))
        animado = any(n.animated() for n, _ in lista)
        ini, fin = (doc.fullClipRangeStartTime(), doc.fullClipRangeEndTime()) if animado else (0, 0)
        salida = []
        for i, (n, nombre) in enumerate(lista):
            if n.animated():
                tiempos = sorted({ini} | {t for t in range(ini, fin + 1) if n.hasKeyframeAtTime(t)})
            else:
                tiempos = [ini]
            fotos = []
            for k, t in enumerate(tiempos):
                datos = bytes(n.pixelDataAtTime(t, 0, 0, w, h) if n.animated() else n.projectionPixelData(0, 0, w, h))
                dur = (tiempos[k + 1] if k + 1 < len(tiempos) else fin + 1) - t
                archivo = None
                if datos[3::4].count(0) != w * h:  # no esta vacio
                    archivo = "capa%03d_t%05d_kra.png" % (i, t)
                    QImage(datos, w, h, w * 4, QImage.Format_ARGB32).save(os.path.join(carpeta, archivo))
                fotos.append({"t": t, "dur": dur, "file": archivo})
            # Capas de archivo o con "[img]" en el nombre se quedan como imagen en Animate
            imagen = n.type() == "filelayer" or "[img]" in n.name().lower()
            salida.append({"name": nombre, "visible": n.visible(), "opacity": round(n.opacity() / 255.0, 3),
                           "bitmap": imagen, "frames": fotos})
        manifest = {"origen": "krita", "name": doc.name() or "Krita", "width": w, "height": h,
                    "fps": doc.framesPerSecond(), "start": ini, "frames": fin - ini + 1, "layers": salida}
        with open(os.path.join(carpeta, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=True, indent=1)
        aviso("Exportadas %d capas a:\n%s\n\nEn Animate: Comandos > Importar desde Krita" % (len(salida), carpeta))

    def importar(self):
        carpeta = QFileDialog.getExistingDirectory(None, "Carpeta exportada desde Animate (con manifest.json)")
        if not carpeta:
            return
        try:
            m = leer_manifest(carpeta)
        except (OSError, ValueError) as e:
            return aviso("No se pudo leer manifest.json:\n%s" % e)
        k = Krita.instance()
        w, h, ini = m["width"], m["height"], m.get("start", 0)
        doc = k.createDocument(w, h, m.get("name", "Animate"), "RGBA", "U8", "", 72.0)
        k.activeWindow().addView(doc)
        doc.setFramesPerSecond(int(round(m["fps"])))
        doc.setFullClipRangeStartTime(ini)
        doc.setFullClipRangeEndTime(ini + max(1, m["frames"]) - 1)
        nodos = [(doc.createNode(c["name"], "paintlayer"), c) for c in m["layers"] if c["frames"]]
        doc.rootNode().setChildNodes([n for n, _ in reversed(nodos)])
        for n, c in nodos:
            fotos = c["frames"]
            animada = len(fotos) > 1 or fotos[0]["t"] != ini
            doc.setActiveNode(n)
            for f in fotos:
                if animada:
                    doc.setCurrentTime(f["t"])
                    k.action("add_blank_frame").trigger()
                    doc.waitForDone()
                if f.get("file"):
                    img = QImage(os.path.join(carpeta, f["file"])).convertToFormat(QImage.Format_ARGB32)
                    ptr = img.constBits()
                    ptr.setsize(img.byteCount())
                    n.setPixelData(bytes(ptr), 0, 0, img.width(), img.height())
            n.setOpacity(int(c.get("opacity", 1) * 255))
            n.setVisible(c.get("visible", True))
        doc.setCurrentTime(ini)
        doc.refreshProjection()
        aviso("Importadas %d capas desde Animate." % len(nodos))
