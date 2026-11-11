"""Subtítulos en el escritorio: capa transparente, siempre encima y que deja pasar los clics.

Recibe los subtítulos de la extensión «Subtítulos PiP» por http://127.0.0.1:47321 y los dibuja
con el mismo estilo (colores, fondo semitransparente, sombras, bordes, posición).
Control: icono de la bandeja del sistema o el menú de la extensión.
"""
import json
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PySide6.QtCore import QObject, QPointF, QRect, QRectF, Qt, QTimer, Signal
from PySide6.QtGui import (QAction, QColor, QFont, QFontMetricsF, QGuiApplication, QIcon, QPainter,
                           QPainterPath, QPen, QPixmap)
from PySide6.QtWidgets import QApplication, QMenu, QSystemTrayIcon, QWidget

PORT = 47321
CONFIG = Path(__file__).with_name('config_escritorio.json')
GENERIC = {'sans-serif': 'Arial', 'serif': 'Times New Roman', 'monospace': 'Consolas',
           'cursive': 'Comic Sans MS', 'system-ui': 'Segoe UI'}
NAMED = {'white': '#ffffff', 'black': '#000000', 'yellow': '#ffff00', 'red': '#ff0000', 'lime': '#00ff00',
         'cyan': '#00ffff', 'blue': '#0000ff', 'magenta': '#ff00ff', 'transparent': 'rgba(0,0,0,0)'}


def css_color(s, default='#ffffff'):
    """Convierte un color CSS (rgb/rgba/#hex/nombre) en QColor."""
    s = NAMED.get((s or default).strip().lower(), (s or default).strip())
    m = re.match(r'rgba?\(([^)]*)\)', s)
    if m:
        p = [float(x) for x in re.split(r'[,\s/]+', m.group(1).strip()) if x]
        c = QColor(int(p[0]), int(p[1]), int(p[2]))
        c.setAlphaF(p[3] if len(p) > 3 else 1.0)
        return c
    c = QColor(s)
    return c if c.isValid() else QColor(default)


def make_font(r, px):
    fams = [f.strip().strip('"\'') for f in (r.get('f') or 'Arial').split(',')]
    f = QFont()
    f.setFamilies([GENERIC.get(x, x) for x in fams if x])
    f.setPixelSize(max(1, round(px)))
    w = r.get('w') or '400'
    f.setWeight(QFont.Weight.Bold if w in ('bold', 'bolder') or (w.isdigit() and int(w) >= 600) else QFont.Weight.Normal)
    f.setItalic(bool(r.get('i')))
    if r.get('sc'):
        f.setCapitalization(QFont.Capitalization.SmallCaps)
    return f


class Bridge(QObject):
    subs = Signal(dict)
    cmd = Signal(str)


class Overlay(QWidget):
    def __init__(self, bridge):
        super().__init__()
        self.data = {'blocks': [], 'settings': {}}
        self.last = 0.0
        self.editing = False
        self.drag = None
        cfg = json.loads(CONFIG.read_text('utf-8')) if CONFIG.exists() else {}
        self.full = cfg.get('full', False)
        scr = QGuiApplication.primaryScreen().availableGeometry()
        self.box = QRect(*cfg.get('box', [scr.x() + scr.width() // 6, scr.bottom() - 260, scr.width() * 2 // 3, 220]))
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setWindowTitle('Subtítulos en el escritorio')
        bridge.subs.connect(self.on_subs)
        bridge.cmd.connect(self.on_cmd)
        t = QTimer(self)
        t.timeout.connect(self.watchdog)
        t.start(1000)
        self.apply()

    # ---- ventana ----
    def apply(self):
        flags = Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool
        if not self.editing:
            flags |= Qt.WindowType.WindowTransparentForInput  # los clics pasan a lo que hay detrás
        self.setWindowFlags(flags)
        self.setGeometry(QGuiApplication.primaryScreen().geometry() if self.full else self.box)
        self.show()
        self.update()

    def save(self):
        CONFIG.write_text(json.dumps({'full': self.full, 'box': [self.box.x(), self.box.y(), self.box.width(), self.box.height()]}), 'utf-8')

    def on_cmd(self, c):
        if c == 'edit':
            self.editing, self.full = True, False
        elif c == 'lock':
            self.editing = False
        elif c == 'toggle':
            self.editing = not self.editing
            self.full = self.full and not self.editing
        elif c == 'full':
            self.full, self.editing = True, False
        elif c == 'box':
            self.full = False
        elif c == 'hide':
            self.hide()
            return
        elif c == 'quit':
            QApplication.quit()
            return
        self.save()
        self.apply()

    def on_subs(self, d):
        self.data = d
        self.last = time.time()
        self.update()

    def watchdog(self):  # sin noticias de la extensión (pestaña cerrada) → limpiar
        if self.data['blocks'] and time.time() - self.last > 5:
            self.data = {'blocks': [], 'settings': self.data.get('settings', {})}
            self.update()

    # ---- mover / redimensionar en modo edición ----
    def mousePressEvent(self, e):
        p = e.position().toPoint()
        corner = p.x() > self.width() - 24 and p.y() > self.height() - 24
        self.drag = ('resize' if corner else 'move', e.globalPosition().toPoint(), QRect(self.geometry()))

    def mouseMoveEvent(self, e):
        if not self.drag:
            return
        kind, start, g = self.drag
        d = e.globalPosition().toPoint() - start
        if kind == 'move':
            self.move(g.topLeft() + d)
        else:
            self.resize(max(160, g.width() + d.x()), max(60, g.height() + d.y()))

    def mouseReleaseEvent(self, e):
        self.drag = None
        self.box = QRect(self.geometry())
        self.save()

    def mouseDoubleClickEvent(self, e):
        self.on_cmd('lock')

    # ---- dibujo ----
    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setRenderHint(QPainter.RenderHint.TextAntialiasing)
        W, H = self.width(), self.height()
        if self.editing:
            p.fillRect(self.rect(), QColor(20, 20, 28, 140))
            p.setPen(QPen(QColor('#fa1e4e'), 3))
            p.drawRect(1, 1, W - 3, H - 3)
            p.fillRect(W - 22, H - 22, 20, 20, QColor('#fa1e4e'))
            p.setPen(QColor('white'))
            p.setFont(QFont('Segoe UI', 10))
            p.drawText(QRectF(10, 8, W - 20, 40), Qt.AlignmentFlag.AlignLeft,
                       'Arrastra para mover · esquina roja para redimensionar · doble clic para fijar')
        st = self.data.get('settings', {})
        blocks = self.data.get('blocks', [])
        if not blocks and self.editing:
            blocks = [{'h': 'center', 'x': .5, 'v': 'bottom', 'y': .06, 'w': .6, 'refH': 360, 'align': 'center', 'win': None,
                       'runs': [{'t': 'Así se verán los subtítulos', 'fs': 18, 'c': '#fff', 'bg': 'rgba(8,8,8,.75)', 'pad': .25, 'f': 'Roboto, Arial'}]}]
        compact = st.get('layout') == 'compact'
        stack_y = H - 6
        for b in reversed(blocks) if compact else blocks:
            k = st.get('scale', 1) if st.get('mode') == 'fixed' else H / max(1, b.get('refH', 360)) * st.get('scale', 1)
            lines, bw, bh = self.layout(b, k, max(st.get('minFontPx', 10), 1), W * (0.96 if compact else min(1, b.get('w', 1) * 1.1 + .05)))
            if compact:
                x, y = (W - bw) / 2, stack_y - bh
                stack_y = y - 4
            else:
                x = {'center': b['x'] * W - bw / 2, 'left': b['x'] * W}.get(b['h'], W - b['x'] * W - bw)
                y = b['y'] * H if b['v'] == 'top' else H - b['y'] * H - bh
            self.draw(p, b, lines, bw, bh, min(max(x, 2), max(2, W - bw - 2)), min(max(y, 0), max(0, H - bh)))
        p.end()

    def layout(self, b, k, minpx, maxw):
        lines, cur = [], {'runs': [], 'w': 0.0, 'h': 0.0}

        def end():
            nonlocal cur
            while cur['runs'] and cur['runs'][-1]['sp']:
                cur['w'] -= cur['runs'].pop()['wd']
            if cur['runs']:
                lines.append(cur)
            cur = {'runs': [], 'w': 0.0, 'h': 0.0}

        for r in b.get('runs', []):
            if r is None:
                end()
                continue
            px = max(minpx, r.get('fs', 16) * k)
            font = make_font(r, px)
            fm = QFontMetricsF(font)
            for word in re.split(r'(\s+)', r.get('t', '')):
                if not word:
                    continue
                sp = not word.strip()
                if sp and not cur['runs']:
                    continue
                text = ' ' if sp else word
                wd = fm.horizontalAdvance(text)
                if not sp and cur['w'] + wd > maxw and cur['runs']:
                    end()
                cur['runs'].append({'r': r, 'text': text, 'wd': wd, 'px': px, 'font': font, 'asc': fm.ascent(), 'sp': sp})
                cur['w'] += wd
                cur['h'] = max(cur['h'], px * 1.25)
        end()
        return lines, max([l['w'] for l in lines] or [0]), sum(l['h'] for l in lines)

    def draw(self, p, b, lines, bw, bh, x, y):
        if b.get('win') and lines:
            pad = lines[0]['runs'][0]['px'] * .3
            p.fillRect(QRectF(x - pad, y - pad * .4, bw + 2 * pad, bh + pad * .8), css_color(b['win']))
        align = b.get('align', 'center')
        for ln in lines:
            x0 = x + ((bw - ln['w']) / 2 if align == 'center' else bw - ln['w'] if align == 'right' else 0)
            base = y + (ln['h'] - ln['runs'][0]['px'] * 1.0) / 2 + max(r['asc'] for r in ln['runs'])
            runs = ln['runs']
            lx = x0
            for i, it in enumerate(runs):  # fondos del texto
                bg = it['r'].get('bg')
                if bg:
                    pad = (it['r'].get('pad') or 0) * it['px']
                    pl = pad if i == 0 or runs[i - 1]['r'].get('bg') != bg else 0
                    pr = pad if i == len(runs) - 1 or runs[i + 1]['r'].get('bg') != bg else 0
                    p.fillRect(QRectF(lx - pl, y, it['wd'] + pl + pr + .5, ln['h']), css_color(bg))
                lx += it['wd']
            lx = x0
            for it in runs:  # texto: sombras, trazo, relleno, subrayado
                r = it['r']
                p.setOpacity(r.get('a', 1))
                path = QPainterPath()
                path.addText(QPointF(lx, base), it['font'], it['text'])
                for sx, sy, blur, col in reversed(r.get('sh') or []):
                    c = css_color(col, '#000')
                    if blur > 0:  # desenfoque aproximado con varias pasadas suaves
                        c.setAlphaF(c.alphaF() / 3)
                        for dx, dy in ((0, 0), (blur * it['px'] / 3, 0), (0, blur * it['px'] / 3)):
                            p.fillPath(path.translated(sx * it['px'] + dx, sy * it['px'] + dy), c)
                    else:
                        p.fillPath(path.translated(sx * it['px'], sy * it['px']), c)
                m = re.match(r'(-?[\d.]+)(em|px)\s+(.+)', r.get('st') or '')
                if m and float(m.group(1)) > 0:
                    wpx = float(m.group(1)) * (it['px'] if m.group(2) == 'em' else 1)
                    p.strokePath(path, QPen(css_color(m.group(3), '#000'), wpx * 2))
                col = css_color(r.get('c'))
                p.fillPath(path, col)
                if r.get('u'):
                    yy = base - it['px'] * .3 if 'line-through' in r['u'] else base + it['px'] * .1
                    p.fillRect(QRectF(lx, yy, it['wd'], max(1, it['px'] * .06)), col)
                lx += it['wd']
            p.setOpacity(1)
            y += ln['h']


def serve(bridge):
    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)) or 0)
            try:
                d = json.loads(body or b'{}')
                if self.path == '/subs':
                    bridge.subs.emit(d)
                elif self.path == '/cmd':
                    bridge.cmd.emit(str(d.get('cmd', '')))
                self.send_response(200)
            except Exception:
                self.send_response(400)
            self.end_headers()

    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()


def tray_icon():
    pm = QPixmap(64, 64)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.setBrush(QColor('#fa1e4e'))
    p.setPen(Qt.PenStyle.NoPen)
    p.drawRoundedRect(4, 10, 56, 44, 10, 10)
    p.setBrush(QColor('white'))
    p.drawRoundedRect(14, 36, 36, 6, 3, 3)
    p.drawRoundedRect(20, 24, 24, 6, 3, 3)
    p.end()
    return QIcon(pm)


def already_running():
    """Si ya hay una copia abierta, la muestra en modo «mover / ajustar» y devuelve True."""
    import urllib.request
    try:
        req = urllib.request.Request(f'http://127.0.0.1:{PORT}/cmd', data=b'{"cmd": "edit"}', method='POST')
        urllib.request.urlopen(req, timeout=1)
        return True
    except Exception:
        return False


def main():
    if already_running():
        return
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    bridge = Bridge()
    ov = Overlay(bridge)
    threading.Thread(target=serve, args=(bridge,), daemon=True).start()
    ov.on_cmd('edit')  # al abrir se ve el rectángulo para que quede claro que está activo
    tray = QSystemTrayIcon(tray_icon(), app)
    tray.setToolTip('Subtítulos en el escritorio')
    menu = QMenu()
    for label, cmd in (('Mover / ajustar el rectángulo', 'edit'), ('Fijar (dejar pasar los clics)', 'lock'),
                       ('Pantalla completa', 'full'), ('Rectángulo', 'box'), ('Ocultar', 'hide'), ('Mostrar', 'box'), ('Salir', 'quit')):
        a = QAction(label, menu)
        a.triggered.connect(lambda _=False, c=cmd: ov.on_cmd(c))
        menu.addAction(a)
    tray.setContextMenu(menu)
    tray.activated.connect(lambda reason: ov.on_cmd('toggle') if reason == QSystemTrayIcon.ActivationReason.Trigger else None)
    tray.show()
    tray.showMessage('Subtítulos en el escritorio', 'Activo. Coloca el rectángulo y haz doble clic para fijarlo. '
                     'Controles: icono rojo de la bandeja (junto al reloj, quizá dentro de la flecha ^).',
                     tray_icon(), 6000)
    sys.exit(app.exec())


if __name__ == '__main__':
    try:
        main()
    except Exception:  # pythonw no muestra errores: se guardan en un archivo
        import traceback
        Path(__file__).with_name('error.txt').write_text(traceback.format_exc(), 'utf-8')
        raise
