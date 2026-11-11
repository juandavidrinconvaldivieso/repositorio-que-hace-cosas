"""Versión web de Wind OS Messenger: la misma interfaz servida por HTTP para navegadores y teléfonos.

Cada navegador tiene su propia sesión (cookie) con su propia cuenta conectada en este PC. La interfaz
llama a /api (las mismas funciones que la app de escritorio) y recibe los eventos por /events (SSE).
"""
import json
import os
import re
import secrets
import shutil
import socket
import threading
import time
from collections import deque

import bottle

W = None                 # módulo windos (se pasa al arrancar para no importarlo dos veces)
SESSIONS = {}            # sid -> Session
LOCK = threading.RLock()
ROOT = None              # carpeta donde viven las sesiones web
PUBLIC_FILES = {"main.html", "aero.css", "common.js", "retro.js", "bots.js", "media.js", "calls.js", "forums.js",
                "home.js", "auth.js", "app.js", "webshim.js", "skins.css", "wm.js", "player.js", "shorts.js", "mobile.css", "i18n.js"}
# Lo que solo tiene sentido en la ventana de escritorio (en la web lo resuelve el navegador)
DESKTOP_ONLY = {"pick_files", "save_att", "open_att", "copy", "shake", "toast", "minimize", "toggle_maximize",
                "focus", "quit", "open_url", "web_start", "web_info", "update_now", "web_tunnel", "web_stop_tunnel"}
MAX_SESSIONS = 40
GUEST_IDLE = 20 * 60     # una visita sin cuenta se borra a los 20 min sin uso
USER_IDLE = 3 * 3600     # una cuenta sin la página abierta se desconecta a las 3 h
_attempts = {}           # ip -> [tiempos] de intentos de entrar (contra fuerza bruta)


class Session:
    def __init__(self, sid, folder):
        self.sid, self.folder = sid, folder
        self.events = deque(maxlen=500)
        self.cond = threading.Condition()
        self.last = time.time()
        self.listeners = 0
        self.core = self.api = None
        self.build()

    def sink(self, ev):
        with self.cond:
            self.events.append(ev)
            self.cond.notify_all()

    def build(self):
        self.core = W.Core(folder=self.folder, files_url="/files/", sink=self.sink)
        self.api = W.Api(self.core, restart_cb=self.rebuild)

    def rebuild(self):
        """Tras iniciar o cerrar sesión: se vuelve a cargar la cuenta y la página se recarga sola."""
        old = self.core
        old.stop()
        self.build()
        self.sink({"t": "reload"})

    @property
    def has_account(self):
        return bool(self.core and self.core.store.d.get("account"))

    def close(self, delete=False):
        if self.core:
            self.core.stop()
        self.core = self.api = None
        if delete:
            shutil.rmtree(self.folder, ignore_errors=True)


def _index_path():
    return os.path.join(ROOT, "sesiones.json")


def _save_index():
    with LOCK:
        data = {sid: os.path.basename(s.folder) for sid, s in SESSIONS.items() if s.has_account or s.core is None}
        try:
            with open(_index_path(), encoding="utf-8") as f:
                old = json.load(f)
        except (OSError, ValueError):
            old = {}
        old.update(data)
        old = {k: v for k, v in old.items() if os.path.exists(os.path.join(ROOT, v, "datos.json"))}
        with open(_index_path(), "w", encoding="utf-8") as f:
            json.dump(old, f)


def _known_folder(sid):
    try:
        with open(_index_path(), encoding="utf-8") as f:
            name = json.load(f).get(sid)
    except (OSError, ValueError):
        return None
    path = os.path.join(ROOT, name) if name else None
    return path if path and os.path.exists(os.path.join(path, "datos.json")) else None


def get_session(create=False):
    sid = bottle.request.get_cookie("wsid")
    with LOCK:
        s = SESSIONS.get(sid) if sid else None
        if s and s.core is None:          # se había desconectado por inactividad: se reanuda
            s.build()
        if not s and sid and re.fullmatch(r"[a-f0-9]{48}", sid):
            folder = _known_folder(sid)   # sesión recordada de otro día
            if folder:
                s = SESSIONS[sid] = Session(sid, folder)
        if not s and create:
            if sum(1 for x in SESSIONS.values() if x.core) >= MAX_SESSIONS:
                bottle.abort(503, "Demasiadas sesiones abiertas en este servidor. Inténtalo más tarde.")
            sid = secrets.token_hex(24)
            s = SESSIONS[sid] = Session(sid, os.path.join(ROOT, sid[:16]))
            bottle.response.set_cookie("wsid", sid, max_age=400 * 86400, httponly=True, samesite="lax", path="/")
        if s:
            s.last = time.time()
        return s


def _janitor():
    while True:
        time.sleep(60)
        now = time.time()
        with LOCK:
            for sid, s in list(SESSIONS.items()):
                idle = now - s.last
                if s.listeners:
                    continue
                if not s.has_account and idle > GUEST_IDLE:
                    s.close(delete=True)
                    SESSIONS.pop(sid)
                elif s.core and idle > USER_IDLE:
                    s.close()
            _save_index()


app = bottle.Bottle()


@app.route("/")
def index():
    with open(W.resource("main.html"), encoding="utf-8") as f:
        html = f.read()
    html = html.replace("<head>", '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
                        '\n<meta name="theme-color" content="#2a8ae0">', 1)
    html = html.replace('<script src="retro.js"></script>', '<script src="webshim.js"></script>\n<script src="retro.js"></script>', 1)
    bottle.response.set_header("Cache-Control", "no-store")
    return html


@app.route("/<name>")
def static(name):
    if name not in PUBLIC_FILES:
        bottle.abort(404)
    resp = bottle.static_file(name, root=os.path.dirname(W.resource("main.html")))
    resp.set_header("Cache-Control", "no-cache")
    return resp


@app.post("/api")
def api_call():
    try:
        body = json.loads(bottle.request.body.read(5 * 1024 * 1024) or b"{}")
    except ValueError:
        bottle.abort(400)
    method, args = str(body.get("m") or ""), body.get("a") or []
    if method.startswith("_") or method in DESKTOP_ONLY or not isinstance(args, list):
        bottle.abort(403)
    s = get_session(create=(method == "init"))
    if not s:
        bottle.response.status = 401
        return {"error": "Sesión caducada: recarga la página."}
    if method in ("login", "register"):
        ip = bottle.request.environ.get("HTTP_X_FORWARDED_FOR", bottle.request.remote_addr or "").split(",")[0]
        tries = [t for t in _attempts.get(ip, []) if time.time() - t < 60]
        if len(tries) >= 8:
            return {"ok": False, "msg": "Demasiados intentos. Espera un minuto."}
        _attempts[ip] = tries + [time.time()]
    fn = getattr(s.api, method, None)
    if not callable(fn):
        bottle.abort(404)
    try:
        result = fn(*args)
    except Exception as e:
        bottle.response.status = 500
        return {"error": f"{type(e).__name__}: {e}"}
    if method in ("register",):
        _save_index()
    bottle.response.content_type = "application/json"
    return json.dumps({"r": result})


@app.route("/events")
def events():
    s = get_session()
    if not s:
        bottle.abort(401)
    bottle.response.content_type = "text/event-stream"
    bottle.response.set_header("Cache-Control", "no-cache")
    bottle.response.set_header("X-Accel-Buffering", "no")

    def stream():
        s.listeners += 1
        try:
            yield "retry: 2000\n\n"
            while True:
                with s.cond:
                    if not s.events:
                        s.cond.wait(15)
                    batch = list(s.events)
                    s.events.clear()
                s.last = time.time()
                if not batch:
                    yield ": ping\n\n"
                for ev in batch:
                    yield f"data: {json.dumps(ev)}\n\n"
        finally:
            s.listeners -= 1
    return stream()


@app.post("/upload")
def upload():
    s = get_session()
    if not s:
        bottle.abort(401)
    voice = bottle.request.forms.get("voice") == "1"
    out = []
    for f in bottle.request.files.getall("f")[:10]:
        data = f.file.read(W.MAX_FILE + 1)
        if len(data) > W.MAX_FILE:
            out.append({"error": f"«{f.raw_filename}» pesa más de {W.MAX_FILE // 1048576} MB."})
            continue
        out.append(s.core.prepare(data, f.raw_filename or "archivo", f.content_type or None, voice))
    return json.dumps({"r": out})


@app.route("/files/<name>")
def files(name):
    s = get_session()
    if not s:
        bottle.abort(401)
    resp = bottle.static_file(os.path.basename(name), root=s.core.store.files)
    resp.set_header("Cache-Control", "private, max-age=31536000")
    return resp


@app.route("/download/<att>")
def download(att):
    s = get_session()
    a = s and s.core.store.d["atts"].get(att)
    if not a or not a.get("complete"):
        bottle.abort(404)
    return bottle.static_file(a["file"], root=s.core.store.files, download=a["name"])


def lan_ip():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as so:
        try:
            so.connect(("8.8.8.8", 80))
            return so.getsockname()[0]
        except OSError:
            return "127.0.0.1"


_server = None


def start(module, port=8765):
    """Arranca el servidor web (una vez) en segundo plano. Devuelve las direcciones para entrar."""
    global W, ROOT, _server
    W = module
    if not _server:
        ROOT = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "WindOSMessenger", "web")
        os.makedirs(ROOT, exist_ok=True)
        _server = W.make_server("0.0.0.0", port, app, server_class=W._ThreadingWSGI, handler_class=W._QuietHandler)
        threading.Thread(target=_server.serve_forever, daemon=True).start()
        threading.Thread(target=_janitor, daemon=True).start()
    p = _server.server_port
    return {"port": p, "local": f"http://localhost:{p}", "lan": f"http://{lan_ip()}:{p}"}


CLOUDFLARED_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
_tunnel = {"proc": None, "url": None}


def tunnel(port):
    """Abre un enlace público https (Cloudflare Quick Tunnel: gratis y sin cuenta) hacia la versión web.
    La primera vez descarga cloudflared.exe (~60 MB) en %APPDATA%\\WindOSMessenger\\bin."""
    import subprocess
    import urllib.request
    p = _tunnel["proc"]
    if p and p.poll() is None and _tunnel["url"]:
        return {"ok": True, "url": _tunnel["url"]}
    folder = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "WindOSMessenger", "bin")
    os.makedirs(folder, exist_ok=True)
    exe = os.path.join(folder, "cloudflared.exe")
    if not os.path.exists(exe):
        try:
            urllib.request.urlretrieve(CLOUDFLARED_URL, exe + ".part")
            os.replace(exe + ".part", exe)
        except OSError as e:
            return {"ok": False, "msg": f"No se pudo descargar cloudflared: {e}"}
    proc = subprocess.Popen([exe, "tunnel", "--no-autoupdate", "--url", f"http://localhost:{port}"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, encoding="utf-8",
                            errors="replace", creationflags=0x08000000)
    _tunnel["proc"], _tunnel["url"] = proc, None
    deadline = time.time() + 45
    while time.time() < deadline and proc.poll() is None:
        line = proc.stderr.readline()
        m = re.search(r"https://[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com", line)  # no confundir con api.trycloudflare.com
        if m:
            _tunnel["url"] = m.group(0)
            threading.Thread(target=lambda: [None for _ in proc.stderr], daemon=True).start()  # vaciar el registro
            return {"ok": True, "url": _tunnel["url"]}
    stop_tunnel()
    return {"ok": False, "msg": "No se pudo crear el enlace público. Revisa tu conexión a Internet e inténtalo otra vez."}


def stop_tunnel():
    p = _tunnel["proc"]
    if p and p.poll() is None:
        p.terminate()
    _tunnel["proc"] = _tunnel["url"] = None


def run(module, port):
    info = start(module, port)
    if "--publico" in module.sys.argv:  # windos.py --web 8765 --publico  -> también enlace https
        t = tunnel(info["port"])
        if module.sys.stdout:
            print("\n  ENLACE PARA COMPARTIR:", t.get("url") or t.get("msg"), flush=True)
    if module.sys.stdout:  # el .exe con ventana no tiene consola
        print(f"\n  Wind OS Messenger (versión web) en marcha\n"
          f"  · En este PC:            {info['local']}\n"
          f"  · En tu red (teléfono):  {info['lan']}\n"
          f"  · Para Internet: en VS Code abre la pestaña «Ports», «Forward a Port», escribe {info['port']}\n"
          f"    y pon la visibilidad en «Public». Comparte la dirección https que te da.\n"
          f"  Cierra esta ventana para apagarlo.\n", flush=True)
    while True:
        time.sleep(3600)
