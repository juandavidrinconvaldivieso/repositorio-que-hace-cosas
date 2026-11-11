"""Actualizaciones automáticas de Wind OS Messenger.

El desarrollador publica en el servidor un «manifiesto» (versión, tamaño, SHA-256, notas) firmado con su
clave Ed25519, y el nuevo .exe troceado. La app comprueba la firma con la clave pública que lleva dentro,
descarga los trozos, verifica el SHA-256 y, al cerrarse (o al pulsar «Reiniciar ahora»), se sustituye a sí
misma. Nadie sin la clave privada puede publicar una actualización: una falsa simplemente se ignora.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time

from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

VERSION = "2.5.1"
# Clave pública del desarrollador (la privada está solo en su PC: ver publicar_actualizacion.py)
UPDATE_PK = "2d1bb919fc43db7cf30a63e0bebbb9198205e46fae57386e20f74d24196b0231"
PREFIX = "windosmsgr/v1/update"
UPD_CHUNK = 128 * 1024
MAX_UPDATE = 80 * 1024 * 1024


def channel():
    if "--canal" in sys.argv[:-1]:
        return re.sub(r"[^a-z0-9]", "", sys.argv[sys.argv.index("--canal") + 1].lower()) or "estable"
    return "estable"


def t_manifest(ch=None): return f"{PREFIX}/{ch or channel()}/manifest"
def t_bin(ver, i, ch=None): return f"{PREFIX}/{ch or channel()}/bin/{ver}/{i}"


def vtuple(v):
    try:
        return tuple(int(x) for x in str(v).split("."))[:4]
    except ValueError:
        return (0,)


def canon(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def check_manifest(raw):
    """Devuelve el manifiesto si la firma del desarrollador es válida; si no, None."""
    try:
        m = json.loads(raw)
        body = {k: v for k, v in m.items() if k != "sig"}
        VerifyKey(bytes.fromhex(UPDATE_PK)).verify(canon(body), bytes.fromhex(m["sig"]))
    except (ValueError, KeyError, TypeError, BadSignatureError):
        return None
    if not (re.fullmatch(r"\d+(\.\d+){1,3}", str(m.get("version"))) and isinstance(m.get("size"), int)
            and 0 < m["size"] <= MAX_UPDATE and m.get("n") == -(-m["size"] // UPD_CHUNK)
            and re.fullmatch(r"[0-9a-f]{64}", str(m.get("sha256")))):
        return None
    return m


def exe_path():
    return sys.executable if getattr(sys, "frozen", False) else None


def update_dir():
    path = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "WindOSMessenger", "actualizacion")
    os.makedirs(path, exist_ok=True)
    return path


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def pending():
    """Actualización ya descargada y verificada que aún no se ha instalado (o None)."""
    try:
        with open(os.path.join(update_dir(), "pendiente.json"), encoding="utf-8") as f:
            m = check_manifest(f.read())
    except OSError:
        return None
    path = os.path.join(update_dir(), f"WindOS-{m['version']}.exe") if m else None
    if not m or vtuple(m["version"]) <= vtuple(VERSION) or not os.path.exists(path) or sha256_file(path) != m["sha256"]:
        return None
    return m, path


def install(restart_after=False):
    """Sustituye el .exe en marcha por el nuevo. Windows deja renombrar un .exe abierto (no borrarlo)."""
    p, exe = pending(), exe_path()
    if not p or not exe:
        return False
    m, new = p
    old = exe + ".old"
    try:
        if os.path.exists(old):
            os.remove(old)
        os.replace(exe, old)
        try:
            shutil.copyfile(new, exe)
        except OSError:
            os.replace(old, exe)  # algo falló: dejamos la versión que había
            raise
    except OSError:
        return False
    for f in os.listdir(update_dir()):
        try:
            os.remove(os.path.join(update_dir(), f))
        except OSError:
            pass
    if restart_after:
        relaunch([exe] + sys.argv[1:])
    return True


def relaunch(cmd):
    """Abre de nuevo el programa. Con PyInstaller hay que pedir un entorno limpio: si no, el proceso nuevo
    cree ser hijo del viejo y busca sus archivos temporales, que ya no existen, y no llega a abrirse."""
    env = {k: v for k, v in os.environ.items() if not k.startswith(("_MEI", "_PYI"))}
    env["PYINSTALLER_RESET_ENVIRONMENT"] = "1"
    subprocess.Popen(cmd, close_fds=True, env=env, creationflags=0x00000008 | 0x00000200)  # DETACHED + NEW_GROUP


def cleanup_old():
    """Al arrancar: borra el .exe viejo que quedó de la última actualización."""
    exe = exe_path()
    if exe and os.path.exists(exe + ".old"):
        try:
            os.remove(exe + ".old")
        except OSError:
            pass


def startup():
    """Si hay una actualización descargada de la sesión anterior, se instala antes de abrir la ventana."""
    cleanup_old()
    if pending() and install(restart_after=True):
        os._exit(0)


class Updater:
    """Escucha el manifiesto en el servidor y descarga la versión nueva en segundo plano."""

    def __init__(self, core):
        self.core = core
        self.state = {"version": VERSION, "status": "ok"}   # ok | downloading | ready | dev
        self.manifest = None
        self.chunks = {}
        self.lock = threading.Lock()
        p = pending()
        if p:
            self.manifest = p[0]
            self.state = {"version": VERSION, "status": "ready", "new": p[0]["version"], "notes": p[0].get("notes", "")}

    def topics(self):
        return [(t_manifest(), 1)]

    def on_message(self, topic, payload):
        if topic == t_manifest():
            self._manifest_in(payload)
            return True
        m = self.manifest
        if m and topic.startswith(t_bin(m["version"], "")):
            self._chunk_in(topic.rsplit("/", 1)[1], payload)
            return True
        return False

    def _emit(self):
        self.core.emit({"t": "update", **self.state})

    def _manifest_in(self, raw):
        m = check_manifest(raw) if raw else None
        if not m or vtuple(m["version"]) <= vtuple(VERSION):
            return
        if self.state["status"] in ("ready", "downloading") and self.manifest and self.manifest["version"] == m["version"]:
            return
        if not exe_path():  # ejecutando desde el código fuente: solo se avisa
            self.state = {"version": VERSION, "status": "dev", "new": m["version"], "notes": m.get("notes", "")}
            self._emit()
            return
        with self.lock:
            if self.manifest and self.state["status"] == "downloading":
                self.core.client.unsubscribe(t_bin(self.manifest["version"], "+"))
            self.manifest, self.chunks = m, {}
            self.state = {"version": VERSION, "status": "downloading", "new": m["version"], "p": 0, "notes": m.get("notes", "")}
        self._emit()
        self.core.client.subscribe(t_bin(m["version"], "+"), qos=1)
        threading.Timer(240, self._retry, args=(m["version"],)).start()

    def _retry(self, ver):
        """Si en 4 minutos no llegó todo, se vuelve a pedir (el servidor reenvía lo que tiene guardado)."""
        if self.state["status"] == "downloading" and self.manifest and self.manifest["version"] == ver and self.core.connected:
            self.core.client.unsubscribe(t_bin(ver, "+"))
            time.sleep(2)
            self.core.client.subscribe(t_bin(ver, "+"), qos=1)
            threading.Timer(600, self._retry, args=(ver,)).start()

    def _chunk_in(self, idx, payload):
        m = self.manifest
        if not idx.isdigit() or int(idx) >= m["n"] or not payload:
            return
        with self.lock:
            if self.state["status"] != "downloading":
                return
            self.chunks[int(idx)] = payload
            have = len(self.chunks)
            if have < m["n"]:
                p = round(have / m["n"], 2)
                if p - self.state.get("p", 0) >= .05:
                    self.state["p"] = p
                    self._emit()
                return
            data = b"".join(self.chunks[i] for i in range(m["n"]))
            self.chunks = {}
            self.core.client.unsubscribe(t_bin(m["version"], "+"))
            if len(data) != m["size"] or hashlib.sha256(data).hexdigest() != m["sha256"]:
                self.state = {"version": VERSION, "status": "ok"}   # trozos corruptos: se reintentará
                self.manifest = None
                return
            path = os.path.join(update_dir(), f"WindOS-{m['version']}.exe")
            with open(path, "wb") as f:
                f.write(data)
            with open(os.path.join(update_dir(), "pendiente.json"), "w", encoding="utf-8") as f:
                json.dump(m, f)
            self.state = {"version": VERSION, "status": "ready", "new": m["version"], "notes": m.get("notes", "")}
        self._emit()
