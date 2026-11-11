"""Wind OS Messenger: mensajería estilo 2009 con códigos personales y cifrado de extremo a extremo.

Cada instalación genera un par de claves Curve25519. El código personal (WIND-XXXX-XXXX) es un
resumen de la clave pública, así que nadie puede suplantarlo. Todo viaja por un servidor MQTT
público, pero cifrado: chats con NaCl Box, archivos y foros con SecretBox, y las publicaciones de
los foros además firmadas (XEdDSA) con la misma clave del código de su autor.

Para probar con dos cuentas en la misma PC:  python windos.py --perfil otra
"""
import base64
import hashlib
import json
import math
import mimetypes
import os
import queue
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import unicodedata
import uuid
import webbrowser
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

import bottle
import paho.mqtt.client as mqtt
import webview
from nacl.public import Box, PrivateKey, PublicKey
from nacl.pwhash import argon2id
from nacl.secret import SecretBox
from nacl.utils import random as nacl_random

import updater
import xsign

APP = "Wind OS Messenger"
BROKER = "broker.hivemq.com"
TRANSPORTS = [("tcp", 1883), ("websockets", 8000)]
PREFIX = "windosmsgr/v1"
HISTORY_MAX = 500
B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
CHUNK = 128 * 1024
MAX_FILE = 20 * 1024 * 1024
MAX_CHUNKS = MAX_FILE // CHUNK + 1
ATT_KINDS = {"image", "gif", "audio", "voice", "video", "file"}
RISKY_EXT = {".exe", ".bat", ".cmd", ".com", ".scr", ".pif", ".msi", ".msp", ".ps1", ".vbs", ".vbe", ".js", ".jse",
             ".wsf", ".wsh", ".hta", ".lnk", ".reg", ".jar", ".cpl", ".dll", ".inf", ".url", ".appx", ".msix"}
ID_RE = re.compile(r"[a-f0-9]{16}")
FID_RE = re.compile(r"[A-Z2-7]{10}")
ICON_RE = re.compile(r"[a-z0-9]{1,20}")
STICKER_RE = re.compile(r"[a-z0-9_]{1,24}")


def resource(name):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, name)


def profile_name():
    name = "principal"
    if "--perfil" in sys.argv[:-1]:
        name = re.sub(r"[^\w-]", "", sys.argv[sys.argv.index("--perfil") + 1]) or name
    return name


def data_dir():
    path = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "WindOSMessenger", profile_name())
    os.makedirs(path, exist_ok=True)
    return path


b64 = lambda b: base64.b64encode(b).decode()
b64d = base64.b64decode
now_ms = lambda: int(time.time() * 1000)
canon = lambda obj: json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def code_for(pk):
    return base64.b32encode(hashlib.sha256(pk).digest()).decode()[:8]


def pretty(code):
    return f"WIND-{code[:4]}-{code[4:]}"


def normalize_code(text):
    t = re.sub(r"[\s-]", "", str(text).upper())
    if len(t) == 12 and t.startswith("WIND"):
        t = t[4:]
    return t if len(t) == 8 and all(c in B32 for c in t) else None


def pretty_fid(fid):
    return f"FORO-{fid[:5]}-{fid[5:]}"


def normalize_fid(text):
    t = re.sub(r"[\s-]", "", str(text).upper())
    if len(t) == 14 and t.startswith("FORO"):
        t = t[4:]
    return t if FID_RE.fullmatch(t) else None


def norm_name(n):
    """'  ¡Club   Secreto! ' -> 'club secreto': sin mayúsculas, tildes, signos ni espacios de más."""
    n = unicodedata.normalize("NFKD", str(n)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", n)).strip()


# Los foros privados creados antes de esta fecha se eliminaron (v2.5.2); los nuevos usan otro espacio de nombres
PRIV_CUTOFF = 1792868000000
forum_key = lambda fid: hashlib.sha256(b"windos-forum:" + fid.encode()).digest()
name_hash = lambda n: hashlib.sha256(b"windos-fpriv2:" + norm_name(n).encode()).hexdigest()[:32]
name_key = lambda n: hashlib.sha256(b"windos-fname2:" + norm_name(n).encode()).digest()
old_private = lambda m: isinstance(m, dict) and bool(m.get("private")) and int(m.get("ts") or 0) < PRIV_CUTOFF


def t_key(code): return f"{PREFIX}/{code}/key"
def t_on(code): return f"{PREFIX}/{code}/on"
def t_in(code): return f"{PREFIX}/{code}/in"
def t_x(code, att, i): return f"{PREFIX}/{code}/x/{att}/{i}"
def t_fdir(fid): return f"{PREFIX}/fdir/{fid}"
def t_fpriv(h): return f"{PREFIX}/fpriv/{h}"
def t_fm(fid): return f"{PREFIX}/f/{fid}/m"
def t_ft(fid, tid): return f"{PREFIX}/f/{fid}/t/{tid}"
def t_fr(fid, tid, rid): return f"{PREFIX}/f/{fid}/r/{tid}/{rid}"
def t_fa(fid, att, i): return f"{PREFIX}/f/{fid}/a/{att}/{i}"
def t_acct(user): return f"{PREFIX}/acct/{hashlib.sha256(b'windos-acct:' + user.encode()).hexdigest()[:32]}"
def t_user(user): return f"{PREFIX}/user/{hashlib.sha256(b'windos-user:' + user.encode()).hexdigest()[:32]}"


USER_RE = re.compile(r"[a-z0-9_.]{3,20}")
def norm_user(u):
    """'  @Juan David Rincón ' -> 'juan_david_rincon' (igual que lo muestra la pantalla de entrada)."""
    u = unicodedata.normalize("NFKD", str(u or "").strip().lstrip("@")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9_.]", "", re.sub(r"[\s-]+", "_", u))).strip("_.")[:20]


def pass_key(user, password):
    """Clave derivada de la contraseña (Argon2id, lenta a propósito para frenar ataques de fuerza bruta)."""
    salt = hashlib.sha256(b"windos-salt:" + user.encode()).digest()[:argon2id.SALTBYTES]
    return argon2id.kdf(SecretBox.KEY_SIZE, password.encode(), salt,
                        opslimit=argon2id.OPSLIMIT_MODERATE, memlimit=argon2id.MEMLIMIT_MODERATE)


def t_pp(pid): return f"{PREFIX}/feed/p/{pid}"
def t_pa(att, i): return f"{PREFIX}/feed/a/{att}/{i}"
def t_pl(pid, code): return f"{PREFIX}/feed/l/{pid}/{code}"
def t_pc(pid, cid): return f"{PREFIX}/feed/c/{pid}/{cid}"


# ---------- Inicio (publicaciones públicas) ----------
FEED_KEY = hashlib.sha256(b"windos-feed-v1").digest()
FEED_MAX_AGE = 60 * 24 * 3600 * 1000
FEED_MAX_POSTS = 1500
POST_MAX_ATTS = 10
CATS = {"", "musica", "juegos", "arte", "foto", "humor", "tecno", "deporte", "cine", "natura", "comida", "viajes", "anime",
        "estudio", "otros"}
STOPWORDS = set("""que para como pero esta este esto estos estas porque cuando donde desde hasta sobre entre todo todos
todas tiene tienen hacer hace hice puede pueden mucho mucha muchos muchas otra otro otros otras ahora tambien también
alguien nadie nada algo siempre nunca aunque mientras queda quiero quieres vamos tengo tenemos estoy estamos están
estan sido había habia haber ellos ellas nosotros vosotros usted ustedes about there their would could should which
these those where when what your have with from this that será sera solo sólo muy más mas aquí aqui""".split())
WORD_RE = re.compile(r"[a-záéíóúñü]{5,20}")
TAG_RE = re.compile(r"#([\wáéíóúñü]{2,30})", re.IGNORECASE)


def post_terms(text, cat):
    """Términos de interés de una publicación: #etiquetas, categoría y palabras clave del texto."""
    text = str(text or "").lower()
    tags = {"t:" + t.lower() for t in TAG_RE.findall(text)}
    words = [w for w in WORD_RE.findall(TAG_RE.sub(" ", text)) if w not in STOPWORDS]
    kws = ["k:" + w for w in dict.fromkeys(words)][:6]
    return tags | set(kws) | ({"c:" + cat} if cat else set())


def name_terms(text):
    return {"k:" + w for w in WORD_RE.findall(str(text or "").lower()) if w not in STOPWORDS}


DEFAULT_PROFILE = {
    "name": "Yo", "status": "online", "msg": "", "about": "", "mood": "", "temp": None,
    "avatar": {"type": "icon", "id": "duck"},
}
IMG_RE = re.compile(r"data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+")
HEX_RE = re.compile(r"#[0-9a-fA-F]{6}")
TEMP_MAX_MS = 8 * 24 * 3600 * 1000


def clean_avatar(a, max_img=200_000):
    a = a if isinstance(a, dict) else {}
    src = str(a.get("src") or "")
    if a.get("type") == "img" and len(src) < max_img and IMG_RE.fullmatch(src):
        return {"type": "img", "src": src}
    aid = str(a.get("id") or "")
    return {"type": "icon", "id": aid if ICON_RE.fullmatch(aid) else "duck"}


def clean_profile(p):
    """Todo perfil (propio o ajeno) pasa por aquí: tipos, longitudes y avatar seguro."""
    p = p if isinstance(p, dict) else {}
    out = {k: str(p.get(k) or "")[:n] for k, n in (("name", 40), ("msg", 120), ("about", 500), ("status", 10))}
    out["name"] = out["name"].strip() or "Sin nombre"
    if out["status"] not in ("online", "busy", "away", "offline"):
        out["status"] = "online"
    mood = str(p.get("mood") or "")
    out["mood"] = mood if re.fullmatch(r"[a-z]{0,16}", mood) else ""

    # Mensaje temporal: solo si aún no ha caducado (y como mucho 8 días)
    t = p.get("temp") if isinstance(p.get("temp"), dict) else {}
    try:
        until = int(t.get("until") or 0)
    except (TypeError, ValueError):
        until = 0
    text = str(t.get("text") or "").strip()[:80]
    now = now_ms()
    out["temp"] = {"text": text, "until": min(until, now + TEMP_MAX_MS)} if text and until > now else None
    out["avatar"] = clean_avatar(p.get("avatar"))
    a = p.get("activity") if isinstance(p.get("activity"), dict) else {}
    app = str(a.get("app") or "").strip()[:40]
    out["activity"] = ({"app": app, "kind": a.get("kind") if a.get("kind") in ("play", "use", "listen", "watch") else "use",
                        "since": int(a.get("since") or 0) if str(a.get("since") or "0").isdigit() else 0} if app else None)
    return out


def clean_att(a):
    """Metadatos de un adjunto recibido de otra persona."""
    if not isinstance(a, dict):
        return None
    try:
        att = {"id": str(a["id"]), "name": os.path.basename(str(a["name"]))[:120] or "archivo",
               "mime": str(a.get("mime") or "application/octet-stream")[:80], "size": int(a["size"]),
               "n": int(a["n"]), "key": str(a["key"]), "kind": str(a.get("kind") or "file")}
        key_ok = len(b64d(att["key"])) == SecretBox.KEY_SIZE
    except (KeyError, TypeError, ValueError):
        return None
    if not (ID_RE.fullmatch(att["id"]) and key_ok and 0 < att["size"] <= MAX_FILE
            and att["n"] == -(-att["size"] // CHUNK) and att["kind"] in ATT_KINDS):
        return None
    return att


SCENES = {"colinas", "oceano", "nubes", "atardecer", "noche", "aurora", "liso"}
CHAT_BGS = {"blanco", "cielo", "cuaderno", "burbujas", "crema"}
SKINS = {"aero", "discord", "insta"}
DEFAULT_THEME = {"preset": "aero", "glass": "#9cc8f0", "alpha": 0.55, "scene": "colinas",
                 "accent": "#1e3287", "bubbles": True, "shine": True, "chat": "blanco"}


def clean_settings(s):
    s = s if isinstance(s, dict) else {}
    t = s.get("theme") if isinstance(s.get("theme"), dict) else {}
    th = dict(DEFAULT_THEME)
    for k in ("glass", "accent"):
        if HEX_RE.fullmatch(str(t.get(k, ""))):
            th[k] = t[k]
    try:
        th["alpha"] = min(0.95, max(0.2, float(t.get("alpha", th["alpha"]))))
    except (TypeError, ValueError):
        pass
    if t.get("scene") in SCENES:
        th["scene"] = t["scene"]
    if t.get("chat") in CHAT_BGS:
        th["chat"] = t["chat"]
    th["bubbles"] = bool(t.get("bubbles", True))
    th["shine"] = bool(t.get("shine", True))
    th["preset"] = re.sub(r"[^a-z]", "", str(t.get("preset") or th["preset"]))[:20] or "custom"
    th["skin"] = t.get("skin") if t.get("skin") in SKINS else "aero"
    turn = s.get("turn") if isinstance(s.get("turn"), dict) else {}
    turn = {"url": str(turn.get("url") or "").strip()[:200], "user": str(turn.get("user") or "")[:120],
            "pass": str(turn.get("pass") or "")[:200]}
    if turn["url"] and not re.fullmatch(r"turns?:[^\s]+", turn["url"]):
        turn["url"] = ""
    return {"theme": th, "sounds": bool(s.get("sounds", True)), "turn": turn, "lang": "en" if s.get("lang") == "en" else "es",
            "activity": bool(s.get("activity", True))}


def free_port(preferred):
    for port in (preferred, 0):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return s.getsockname()[1]
            except OSError:
                continue


class _ThreadingWSGI(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class _QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass


def start_file_server(folder):
    """Sirve los adjuntos descargados a la interfaz (con soporte de rangos para audio y vídeo)."""
    token = uuid.uuid4().hex
    app = bottle.Bottle()

    @app.route(f"/{token}/<name>")
    def serve(name):
        resp = bottle.static_file(os.path.basename(name), root=folder)
        resp.set_header("Cache-Control", "max-age=31536000")
        return resp

    srv = make_server("127.0.0.1", free_port(0), app, server_class=_ThreadingWSGI, handler_class=_QuietHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_port}/{token}/"


class Store:
    """Datos locales en %APPDATA%: claves, perfil, contactos, historial, adjuntos y foros."""

    def __init__(self, folder):
        self.path = os.path.join(folder, "datos.json")
        self.files = os.path.join(folder, "archivos")
        os.makedirs(self.files, exist_ok=True)
        try:
            with open(self.path, encoding="utf-8") as f:
                self.d = json.load(f)
        except (OSError, ValueError):
            self.d = {}
        d = self.d
        d.setdefault("sk", PrivateKey.generate().encode().hex())
        d["profile"] = clean_profile({**DEFAULT_PROFILE, **d.get("profile", {})})
        d["settings"] = clean_settings(d.get("settings"))
        d.setdefault("contacts", {})   # código -> {pk, profile, state, since, unread, outbox}
        d.setdefault("requests", {})   # código -> {pk, profile, ts}
        d.setdefault("history", {})    # código -> [mensajes]
        d.setdefault("atts", {})       # id -> {name, mime, size, kind, n, key, file, complete}
        d.setdefault("forums", {})     # fid -> {meta, posts{pid: firmado}, deleted[], read}
        for fid in [f for f, v in d["forums"].items() if old_private(v.get("meta"))]:
            del d["forums"][fid]       # los foros privados antiguos se eliminaron en la 2.5.2
        d.setdefault("feed", {"posts": {}, "likes": {}, "comments": {}, "deleted": []})
        # Gustos de esta persona: solo se guardan aquí, nunca se envían a nadie
        d.setdefault("taste", {"terms": {}, "authors": {}, "seen": {}})
        self.lock = threading.RLock()
        self._timer = None
        self.save()

    def save(self):
        with self.lock:
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.d, f, ensure_ascii=False)
            os.replace(tmp, self.path)

    def save_soon(self):
        """Agrupa muchas escrituras seguidas (por ejemplo al cargar un foro) en una sola."""
        with self.lock:
            if not self._timer:
                def run():
                    self._timer = None
                    self.save()
                self._timer = threading.Timer(1.0, run)
                self._timer.daemon = True
                self._timer.start()


class Core:
    """Una cuenta conectada. En escritorio hay una; en la versión web, una por cada navegador con sesión."""

    def __init__(self, folder=None, files_url=None, sink=None):
        self.store = Store(folder or data_dir())
        self.lock = threading.RLock()
        self.sk = PrivateKey(bytes.fromhex(self.store.d["sk"]))
        self.pk = self.sk.public_key.encode()
        self.code = code_for(self.pk)
        self.files_url = files_url or start_file_server(self.store.files)
        self.sink = sink          # web: función que recibe los eventos; escritorio: None (se usa la ventana)
        self.updater = updater.Updater(self) if sink is None else None   # solo la app de escritorio se actualiza
        self.alive = True
        self.window = None
        self.ready = False
        self.connected = False
        self.online = {}          # código -> bool (solo en memoria)
        self.waiters = {}         # tema -> (Event, [payload]) para lecturas puntuales
        self.rx = {}              # id de adjunto -> trozos recibidos
        self.directory = {}       # foros públicos conocidos
        self.found = {}           # foros encontrados por búsqueda (aún sin unirse)
        self.fseen = {}           # fid -> publicaciones vistas en el servidor en esta sesión
        self.feed_seen = set()    # publicaciones de Inicio vistas en el servidor en esta sesión
        self.toasts = []
        self.client = None
        self.events = queue.Queue()
        threading.Thread(target=self._emitter, daemon=True).start()
        threading.Thread(target=self._net_loop, daemon=True).start()
        threading.Thread(target=self._backup_loop, daemon=True).start()
        if sink is None:
            threading.Thread(target=self._activity_loop, daemon=True).start()

    # ---------- actividad: qué app está usando (se muestra en el perfil) ----------
    def broadcast_profile(self):
        p = self.store.d["profile"]
        for code, c in self.store.d["contacts"].items():
            if c["state"] == "friend" and self.online.get(code):
                self.send(code, {"t": "profile", "p": p})

    def _activity_loop(self):
        import activity
        last, streak = None, 0
        while self.alive:
            time.sleep(10)
            try:
                cur = activity.current() if self.store.d["settings"].get("activity", True) else None
            except Exception:
                cur = None
            key = cur and (cur["app"], cur["kind"])
            streak = streak + 1 if key == last else 0
            last = key
            p = self.store.d["profile"]
            old = p.get("activity")
            if streak != 1 or (old and key == (old["app"], old["kind"])) or (not old and not key):
                continue  # solo se publica cuando el cambio se mantiene 20 s
            with self.lock:
                p["activity"] = {**cur, "since": now_ms()} if cur else None
                self.store.save_soon()
            self.broadcast_profile()
            self.emit({"t": "me_profile", "p": p})

    # ---------- hacia la interfaz ----------
    def emit(self, ev):
        self.events.put(ev)

    def _emitter(self):
        while self.alive:
            try:
                ev = self.events.get(timeout=1)
            except queue.Empty:
                continue
            if self.sink:
                self.sink(ev)
                continue
            while not (self.ready and self.window) and self.alive:
                time.sleep(.2)
            try:
                self.window.evaluate_js(f"onEvent({json.dumps(ev)})")
            except Exception:
                pass

    def stop(self):
        """Desconecta esta cuenta (versión web: al cerrar o cambiar de sesión)."""
        self.alive = False
        try:
            if self.connected:
                self.client.publish(t_on(self.code), "0", qos=1, retain=True).wait_for_publish(2)
            self.client.disconnect()
            self.client.loop_stop()
        except Exception:
            pass
        self.store.save()

    def view(self, code):
        c = self.store.d["contacts"][code]
        return {"code": code, "pretty": pretty(code), "profile": c["profile"], "state": c["state"],
                "since": c.get("since"), "unread": c.get("unread", 0),
                "online": bool(self.online.get(code)) and c["state"] == "friend"}

    def request_view(self, code):
        r = self.store.d["requests"][code]
        return {"code": code, "pretty": pretty(code), "profile": r["profile"], "ts": r["ts"]}

    # ---------- cifrado y firmas ----------
    def seal(self, their_pk, obj):
        ct = Box(self.sk, PublicKey(their_pk)).encrypt(json.dumps(obj).encode())
        return json.dumps({"f": self.code, "k": b64(self.pk), "b": b64(ct)})

    def unseal(self, payload):
        env = json.loads(payload)
        pk = b64d(env["k"])
        if code_for(pk) != env["f"]:
            return None
        return env["f"], pk, json.loads(Box(self.sk, PublicKey(pk)).decrypt(b64d(env["b"])))

    def sign(self, obj):
        obj["sig"] = b64(xsign.sign(self.sk.encode(), canon({k: v for k, v in obj.items() if k != "sig"})))
        return obj

    @staticmethod
    def verify(obj, code, pk_b64):
        try:
            pk = b64d(pk_b64)
            return (code_for(pk) == code and
                    xsign.verify(pk, canon({k: v for k, v in obj.items() if k != "sig"}), b64d(obj["sig"])))
        except (KeyError, TypeError, ValueError):
            return False

    # ---------- red ----------
    def _net_loop(self):
        attempt = 0
        while self.alive:
            transport, port = TRANSPORTS[attempt % len(TRANSPORTS)]
            cl = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, transport=transport,
                             client_id=f"windos-{self.code}-{uuid.uuid4().hex[:6]}")
            if transport == "websockets":
                cl.ws_set_options(path="/mqtt")
            cl.will_set(t_on(self.code), "0", qos=1, retain=True)
            cl.on_connect, cl.on_disconnect, cl.on_message = self._on_connect, self._on_disconnect, self._on_message
            cl.reconnect_delay_set(2, 30)
            cl.max_queued_messages_set(0)
            self.client = cl
            try:
                cl.connect_async(BROKER, port, keepalive=30)
                cl.loop_start()
            except Exception:
                pass
            for _ in range(30):
                if self.connected:
                    return  # paho se encarga de reconectar a partir de aquí
                time.sleep(.5)
            cl.loop_stop()
            attempt += 1

    def _on_connect(self, client, userdata, flags, rc, props):
        if rc.is_failure:
            return
        self.connected = True
        client.subscribe([(t_in(self.code), 1), (f"{PREFIX}/{self.code}/x/+/+", 1), (f"{PREFIX}/fdir/+", 1),
                          (f"{PREFIX}/feed/p/+", 1), (f"{PREFIX}/feed/l/+/+", 1), (f"{PREFIX}/feed/c/+/+", 1)]
                         + (self.updater.topics() if self.updater else []))
        self.feed_seen = set()
        threading.Timer(12, self._feed_reseed).start()
        client.publish(t_key(self.code), b64(self.pk), qos=1, retain=True)
        self.publish_presence()
        self._backup_hash = None
        threading.Thread(target=self.publish_backup, daemon=True).start()
        with self.lock:
            for code in self.store.d["contacts"]:
                client.subscribe(t_on(code), qos=1)
            for fid in list(self.store.d["forums"]):
                self._forum_subscribe(fid)
        self.emit({"t": "conn", "ok": True})

    def _on_disconnect(self, client, userdata, flags, rc, props):
        self.connected = False
        with self.lock:
            changed = [c for c, on in self.online.items() if on]
            self.online = {}
            for code in changed:
                if code in self.store.d["contacts"]:
                    self.emit({"t": "contact", "c": self.view(code)})
        self.emit({"t": "conn", "ok": False})

    # ---------- cuenta: copia cifrada con la contraseña en el servidor ----------
    def backup_payload(self):
        d = self.store.d
        return {"v": 1, "sk": d["sk"], "profile": d["profile"], "settings": d["settings"],
                "contacts": {c: {k: v[k] for k in ("pk", "profile", "state", "since")} for c, v in d["contacts"].items()},
                "forums": {fid: f["meta"] for fid, f in d["forums"].items()}}

    def publish_backup(self, force=False):
        """Sube la copia de la cuenta si cambió (o si el servidor la perdió: se vuelve a subir en cada conexión)."""
        acct = self.store.d.get("account")
        if not acct or not self.connected:
            return
        with self.lock:
            raw = canon(self.backup_payload())
        h = hashlib.sha256(raw).hexdigest()
        if h == getattr(self, "_backup_hash", None) and not force:
            return
        box = SecretBox(b64d(acct["key"]))
        self.client.publish(t_acct(acct["user"]), json.dumps({"v": 1, "user": acct["user"], "b": b64(box.encrypt(raw))}),
                            qos=1, retain=True)
        rec = self.sign({"user": acct["user"], "code": self.code, "pk": b64(self.pk)})
        self.client.publish(t_user(acct["user"]), json.dumps(rec), qos=1, retain=True)
        self._backup_hash = h

    def _backup_loop(self):
        while self.alive:
            time.sleep(90)
            try:
                self.publish_backup()
            except Exception:
                pass

    def lookup_user(self, user):
        raw = self.fetch_retained(t_user(user), 5)
        try:
            rec = json.loads(raw) if raw else None
        except ValueError:
            return None
        if not isinstance(rec, dict) or rec.get("user") != user or not self.verify(rec, rec.get("code"), rec.get("pk")):
            return None
        return rec

    def publish_presence(self):
        if self.connected:
            invisible = self.store.d["profile"]["status"] == "offline"
            self.client.publish(t_on(self.code), "0" if invisible else "1", qos=1, retain=True)

    def _on_message(self, client, userdata, msg):
        try:
            w = self.waiters.get(msg.topic)
            if w and msg.payload:
                w[1].append(msg.payload)
                w[0].set()
            if self.updater and msg.topic.startswith(updater.PREFIX) and self.updater.on_message(msg.topic, msg.payload):
                return
            p = msg.topic.split("/")[2:]
            if p[0] == "fdir" and len(p) == 2:
                self._directory_in(p[1], msg.payload)
            elif p[0] == "f" and len(p) >= 3:
                self._forum_in(p[1:], msg.payload, msg.retain)
            elif p[0] == "feed" and len(p) >= 3:
                self._feed_in(p[1:], msg.payload, msg.retain)
            elif len(p) == 2 and p[1] == "on":
                self._presence(p[0], msg.payload == b"1")
            elif len(p) == 2 and p[1] == "in" and p[0] == self.code:
                self._incoming(msg.payload)
            elif len(p) == 4 and p[0] == self.code and p[1] == "x":
                self._chunk_in(p[2], p[3], msg.payload)
        except Exception:
            pass  # un mensaje raro nunca debe tumbar la conexión

    def fetch_retained(self, topic, timeout=5.0):
        """Lee una vez un mensaje retenido (claves, foros privados, metadatos)."""
        if not self.connected:
            return None
        ev, box = threading.Event(), []
        self.waiters[topic] = (ev, box)
        self.client.subscribe(topic, qos=1)
        ev.wait(timeout)
        self.client.unsubscribe(topic)
        self.waiters.pop(topic, None)
        return box[0] if box else None

    def send(self, code, obj, pk=None):
        if not self.connected:
            return False
        pk = pk or b64d(self.store.d["contacts"][code]["pk"])
        self.client.publish(t_in(code), self.seal(pk, obj), qos=1)
        return True

    # ---------- adjuntos ----------
    def att_view(self, att_id, meta=None):
        a = self.store.d["atts"].get(att_id) or meta
        if not a:
            return None
        done = bool(a.get("complete"))
        return {"id": att_id, "name": a["name"], "mime": a["mime"], "size": a["size"], "kind": a["kind"],
                "url": self.files_url + a["file"] if done else None, "status": "ready" if done else "remote"}

    def _register_att(self, meta):
        d = self.store.d["atts"]
        if meta["id"] not in d:
            ext = os.path.splitext(meta["name"])[1].lower()
            ext = ext if re.fullmatch(r"\.[a-z0-9]{1,6}", ext) else ""
            d[meta["id"]] = {**meta, "file": meta["id"] + ext, "complete": False}
        return d[meta["id"]]

    def prepare(self, data, name, mime=None, voice=False):
        if not data or len(data) > MAX_FILE:
            return None
        name = os.path.basename(name)[:120] or "archivo"
        mime = (mime or mimetypes.guess_type(name)[0] or "application/octet-stream")[:80]
        kind = ("voice" if voice else "gif" if mime == "image/gif" else "image" if mime.startswith("image/")
                else "audio" if mime.startswith("audio/") else "video" if mime.startswith("video/") else "file")
        meta = {"id": uuid.uuid4().hex[:16], "name": name, "mime": mime, "size": len(data),
                "n": -(-len(data) // CHUNK), "key": b64(nacl_random(SecretBox.KEY_SIZE)), "kind": kind}
        with self.lock:
            a = self._register_att(meta)
            with open(os.path.join(self.store.files, a["file"]), "wb") as f:
                f.write(data)
            a["complete"] = True
            self.store.save()
        return self.att_view(meta["id"])

    def att_wire(self, att_id):
        """Metadatos que viajan (cifrados) con el mensaje: incluye la clave del archivo."""
        a = self.store.d["atts"][att_id]
        return {k: a[k] for k in ("id", "name", "mime", "size", "n", "key", "kind")}

    def push_chunks(self, att_id, topic_for, retain=False):
        def run():
            a = self.store.d["atts"].get(att_id)
            if not a or not a.get("complete") or not self.connected:
                return
            box = SecretBox(b64d(a["key"]))
            with open(os.path.join(self.store.files, a["file"]), "rb") as f:
                for i in range(a["n"]):
                    self.client.publish(topic_for(i), bytes(box.encrypt(f.read(CHUNK))), qos=1, retain=retain)
        threading.Thread(target=run, daemon=True).start()

    def _chunk_in(self, att_id, idx, payload):
        if not ID_RE.fullmatch(att_id) or not idx.isdigit() or int(idx) >= MAX_CHUNKS or not payload:
            return
        with self.lock:
            now = time.time()
            for k in [k for k, r in self.rx.items() if now - r["ts"] > 900]:
                self.rx.pop(k)  # trozos huérfanos que nunca completaron
            r = self.rx.setdefault(att_id, {"chunks": {}, "ts": now})
            r["chunks"][int(idx)] = payload
            r["ts"] = now
        self._try_complete(att_id)

    def _try_complete(self, att_id):
        with self.lock:
            r, a = self.rx.get(att_id), self.store.d["atts"].get(att_id)
            if not r or not a:
                return
            if a.get("complete"):
                self.rx.pop(att_id, None)
                self._after_complete(att_id, r)
                return
            have = len(r["chunks"])
            if have < a["n"]:
                if have % 4 == 0:
                    self.emit({"t": "att_progress", "id": att_id, "p": have / a["n"]})
                return
            box = SecretBox(b64d(a["key"]))
            try:
                data = b"".join(box.decrypt(r["chunks"][i]) for i in range(a["n"]))
            except Exception:
                self.rx.pop(att_id, None)
                return
            if len(data) != a["size"]:
                return
            with open(os.path.join(self.store.files, a["file"]), "wb") as f:
                f.write(data)
            a["complete"] = True
            self.rx.pop(att_id, None)
            self.store.save_soon()
        self.emit({"t": "att_ready", "att": self.att_view(att_id)})
        self._after_complete(att_id, r)

    def _after_complete(self, att_id, r):
        if r.get("ack"):
            code, mid = r["ack"]
            if code in self.store.d["contacts"]:
                self.send(code, {"t": "ack", "id": mid})
        if r.get("unsub") and self.connected:
            self.client.unsubscribe(r["unsub"])

    # ---------- contactos y chats ----------
    def flush(self, code):
        c = self.store.d["contacts"][code]
        hist = self.store.d["history"].get(code, [])
        for m in c.get("outbox", []):
            if self.send(code, self.wire_msg(m)):
                if m.get("att"):
                    self.push_chunks(m["att"], lambda i, a=m["att"]: t_x(code, a, i))
                for h in hist:
                    if h.get("id") == m["id"] and h.get("status") == "pending":
                        h["status"] = "sent"
                        self.emit({"t": "msgstatus", "code": code, "id": m["id"], "status": "sent"})
        self.store.save()

    def wire_msg(self, m):
        out = {"t": "msg", "id": m["id"], "text": m["text"], "font": m.get("font", 0), "ts": m["ts"]}
        if m.get("sticker"):
            out["sticker"] = m["sticker"]
        if m.get("att") and m["att"] in self.store.d["atts"]:
            out["att"] = self.att_wire(m["att"])
        return out

    def _presence(self, code, on):
        with self.lock:
            c = self.store.d["contacts"].get(code)
            if not c:
                return
            was = bool(self.online.get(code))
            self.online[code] = on
            if on and not was:
                if c["state"] == "friend":
                    self.send(code, {"t": "profile", "p": self.store.d["profile"]})
                    self.flush(code)
                else:  # seguía pendiente: le recordamos la solicitud
                    self.send(code, {"t": "request", "p": self.store.d["profile"]})
            if on != was:
                self.emit({"t": "contact", "c": self.view(code), "came_online": on and not was})

    def msg_view(self, m):
        if m.get("att"):
            return {**m, "att": self.att_view(m["att"])}
        return m

    def _incoming(self, payload):
        res = self.unseal(payload)
        if not res:
            return
        frm, pk, obj = res
        t = obj.get("t")
        d = self.store.d
        with self.lock:
            c = d["contacts"].get(frm)
            if c and b64d(c["pk"]) != pk:
                return
            if t == "request":
                if c:  # solicitud mutua o reenviada: somos amigos
                    first = c["state"] != "friend"
                    c.update(state="friend", profile=clean_profile(obj.get("p")))
                    c["since"] = c.get("since") or now_ms()
                    self.send(frm, {"t": "accept", "p": d["profile"]})
                    self.store.save()
                    self.emit({"t": "contact", "c": self.view(frm), "accepted": first})
                    return
                is_new = frm not in d["requests"]
                d["requests"][frm] = {"pk": b64(pk), "profile": clean_profile(obj.get("p")), "ts": now_ms()}
                self.store.save()
                if is_new:
                    self.emit({"t": "request", "r": self.request_view(frm)})
                return
            if not c:
                return
            if t == "accept":
                first = c["state"] != "friend"
                c["state"] = "friend"
                c["since"] = c.get("since") or now_ms()
                c["profile"] = clean_profile(obj.get("p"))
                self.store.save()
                self.emit({"t": "contact", "c": self.view(frm), "accepted": first})
                self.flush(frm)
            elif t == "remove":
                self._drop(frm)
                self.emit({"t": "contact_removed", "code": frm})
            elif c["state"] != "friend":
                return
            elif t == "profile":
                c["profile"] = clean_profile(obj.get("p"))
                self.store.save()
                self.emit({"t": "contact", "c": self.view(frm)})
            elif t == "msg":
                self._msg_in(frm, c, obj)
            elif t == "ack":
                mid = obj.get("id")
                c["outbox"] = [m for m in c.get("outbox", []) if m["id"] != mid]
                for h in d["history"].get(frm, []):
                    if h.get("id") == mid:
                        h["status"] = "delivered"
                self.store.save()
                self.emit({"t": "msgstatus", "code": frm, "id": mid, "status": "delivered"})
            elif t == "nudge":
                m = {"id": uuid.uuid4().hex[:12], "from": "them", "kind": "nudge", "ts": now_ms()}
                d["history"].setdefault(frm, []).append(m)
                self.store.save()
                self.emit({"t": "nudge", "code": frm, "m": m})
            elif t == "typing":
                self.emit({"t": "typing", "code": frm})
            elif t == "rtc" and isinstance(obj.get("d"), dict) and len(json.dumps(obj["d"])) < 65536:
                self.emit({"t": "rtc", "code": frm, "d": obj["d"]})

    def _msg_in(self, frm, c, obj):
        d = self.store.d
        mid = str(obj.get("id"))[:40]
        att = clean_att(obj.get("att"))
        if att:
            a = self._register_att(att)
            if not a.get("complete"):
                r = self.rx.setdefault(att["id"], {"chunks": {}, "ts": time.time()})
                r["ack"] = (frm, mid)
        if not att or self.store.d["atts"][att["id"]].get("complete"):
            self.send(frm, {"t": "ack", "id": mid})
        hist = d["history"].setdefault(frm, [])
        if not any(h.get("id") == mid for h in hist[-300:]):
            sticker = str(obj.get("sticker") or "")
            m = {"id": mid, "from": "them", "kind": "msg", "text": str(obj.get("text", ""))[:4000],
                 "ts": now_ms(), "font": int(obj.get("font") or 0) % 6}
            if STICKER_RE.fullmatch(sticker):
                m["sticker"] = sticker
            if att:
                m["att"] = att["id"]
            hist.append(m)
            del hist[:-HISTORY_MAX]
            c["unread"] = c.get("unread", 0) + 1
            self.store.save()
            self.emit({"t": "msg", "code": frm, "m": self.msg_view(m), "c": self.view(frm)})
        if att:
            self._try_complete(att["id"])

    def _drop(self, code):
        self.store.d["contacts"].pop(code, None)
        self.store.d["history"].pop(code, None)
        self.online.pop(code, None)
        if self.connected:
            self.client.unsubscribe(t_on(code))
        self.store.save()

    # ---------- foros ----------
    def verify_meta(self, m, fid):
        if not isinstance(m, dict) or m.get("fid") != fid or not self.verify(m, m.get("owner"), m.get("owner_pk")):
            return None
        return {"fid": fid, "code": pretty_fid(fid), "name": str(m.get("name") or "")[:60] or "Foro",
                "desc": str(m.get("desc") or "")[:300], "icon": clean_avatar({"id": m.get("icon")})["id"],
                "private": bool(m.get("private")), "owner": m["owner"], "owner_name": str(m.get("owner_name") or "")[:40],
                "ts": int(m.get("ts") or 0)}

    def forum_summary(self, fid):
        f = self.store.d["forums"][fid]
        meta = self.verify_meta(f["meta"], fid)
        read = f.get("read", 0)
        posts = [p for pid, p in f["posts"].items() if pid not in f.get("deleted", [])]
        unread = sum(1 for p in posts if p.get("ts", 0) > read and p["author"]["code"] != self.code)
        last = max([p.get("ts", 0) for p in posts] + [meta["ts"]])
        return {**meta, "joined": True, "unread": unread, "threads": sum(1 for p in posts if p["kind"] == "t"), "last": last}

    def post_view(self, fid, p):
        a = p["author"]
        prof = clean_profile({"name": a.get("name"), "avatar": a.get("avatar")})
        att = clean_att(p.get("att"))
        owner = self.store.d["forums"].get(fid, {}).get("meta", {}).get("owner")
        sticker = str(p.get("sticker") or "")
        return {"id": p["id"], "fid": fid, "tid": p["tid"], "kind": p["kind"], "title": str(p.get("title") or "")[:120],
                "text": str(p.get("text") or "")[:5000], "sticker": sticker if STICKER_RE.fullmatch(sticker) else None,
                "ts": int(p.get("ts") or 0), "att": self.att_view(att["id"], att) if att else None,
                "author": {"code": a["code"], "pretty": pretty(a["code"]), "name": prof["name"], "avatar": prof["avatar"]},
                "mine": a["code"] == self.code, "can_del": a["code"] == self.code or owner == self.code}

    def _forum_subscribe(self, fid):
        if not self.connected:
            return
        self.fseen[fid] = set()
        self.client.subscribe([(t_fm(fid), 1), (f"{PREFIX}/f/{fid}/t/+", 1), (f"{PREFIX}/f/{fid}/r/+/+", 1)])
        threading.Timer(10, self._reseed, args=(fid,)).start()

    def _reseed(self, fid):
        """Si el servidor público perdió publicaciones, las volvemos a subir desde nuestra copia."""
        f = self.store.d["forums"].get(fid)
        if not f or not self.connected:
            return
        key, seen = forum_key(fid), self.fseen.get(fid, set())
        if "meta" not in seen:
            self._publish_meta(f["meta"])
        for pid, p in list(f["posts"].items()):
            if pid not in seen and pid not in f.get("deleted", []):
                topic = t_ft(fid, pid) if p["kind"] == "t" else t_fr(fid, p["tid"], pid)
                self.client.publish(topic, bytes(SecretBox(key).encrypt(canon(p))), qos=1, retain=True)

    def _publish_meta(self, meta):
        fid = meta["fid"]
        raw = canon(meta)
        self.client.publish(t_fm(fid), bytes(SecretBox(forum_key(fid)).encrypt(raw)), qos=1, retain=True)
        if meta.get("private"):
            self.client.publish(t_fpriv(name_hash(meta["name"])), bytes(SecretBox(name_key(meta["name"])).encrypt(raw)),
                                qos=1, retain=True)
        else:
            self.client.publish(t_fdir(fid), raw, qos=1, retain=True)

    def _directory_in(self, fid, payload):
        try:
            m = json.loads(payload) if payload else None
        except ValueError:
            return
        v = self.verify_meta(m, fid) if m else None
        if v and not v["private"] and not old_private(m):
            self.directory[fid] = m
            self.emit({"t": "fdir", "f": v})

    def _forum_in(self, p, payload, retained):
        fid, kind = p[0], p[1]
        f = self.store.d["forums"].get(fid)
        if not FID_RE.fullmatch(fid):
            return
        if kind == "a" and len(p) == 4:
            self._chunk_in(p[2], p[3], payload)
            return
        if not f or not payload:
            return  # un retenido borrado por cualquiera no borra nuestra copia
        try:
            obj = json.loads(SecretBox(forum_key(fid)).decrypt(payload))
        except Exception:
            return
        if kind == "m" and len(p) == 2:
            self.fseen.setdefault(fid, set()).add("meta")
            if self.verify_meta(obj, fid) and obj["owner"] == f["meta"]["owner"] and obj.get("ts", 0) >= f["meta"].get("ts", 0):
                f["meta"] = obj
                self.store.save_soon()
                self.emit({"t": "forum", "f": self.forum_summary(fid)})
            return
        if kind == "t" and len(p) == 3:
            tid = pid = p[2]
        elif kind == "r" and len(p) == 4:
            tid, pid = p[2], p[3]
        else:
            return
        if not (ID_RE.fullmatch(tid) and ID_RE.fullmatch(pid)):
            return
        self.fseen.setdefault(fid, set()).add(pid)
        with self.lock:
            if obj.get("del"):
                self._tombstone_in(fid, f, obj, pid)
                return
            a = obj.get("author") if isinstance(obj.get("author"), dict) else {}
            if (obj.get("id") != pid or obj.get("tid") != tid or obj.get("fid") != fid or obj.get("kind") != kind
                    or not self.verify(obj, a.get("code"), a.get("pk")) or pid in f.setdefault("deleted", [])):
                return
            is_new = pid not in f["posts"]
            f["posts"][pid] = obj
            self.store.save_soon()
        if is_new:
            self.emit({"t": "fpost", "fid": fid, "post": self.post_view(fid, obj), "fresh": not retained,
                       "f": self.forum_summary(fid)})

    def _tombstone_in(self, fid, f, obj, pid):
        by = obj.get("by") if isinstance(obj.get("by"), dict) else {}
        post = f["posts"].get(pid)
        allowed = {f["meta"]["owner"]} | ({post["author"]["code"]} if post else set())
        if obj.get("id") != pid or by.get("code") not in allowed and post is not None:
            return
        if not self.verify(obj, by.get("code"), by.get("pk")):
            return
        if pid not in f.setdefault("deleted", []):
            f["deleted"].append(pid)
        f["posts"].pop(pid, None)
        self.store.save_soon()
        self.emit({"t": "fdel", "fid": fid, "pid": pid, "f": self.forum_summary(fid)})

    # ---------- Inicio: publicaciones, me gusta y comentarios ----------
    def _verify_author(self, obj):
        a = obj.get("author") if isinstance(obj.get("author"), dict) else {}
        return self.verify(obj, a.get("code"), a.get("pk"))

    def fetch_remote_att(self, meta, topic):
        with self.lock:
            a = self._register_att(meta)
            if a.get("complete"):
                return self.att_view(meta["id"])
            r = self.rx.setdefault(meta["id"], {"chunks": {}, "ts": time.time()})
            r["unsub"] = topic
        self.client.subscribe(topic, qos=1)
        return self.att_view(meta["id"])

    def _feed_in(self, p, payload, retained):
        kind = p[0]
        if kind == "a" and len(p) == 3:
            self._chunk_in(p[1], p[2], payload)
            return
        if not payload or not ID_RE.fullmatch(p[1]):
            return
        try:
            obj = json.loads(SecretBox(FEED_KEY).decrypt(payload))
        except Exception:
            return
        feed, pid, is_new = self.store.d["feed"], p[1], False
        with self.lock:
            if kind == "p" and len(p) == 2:
                self.feed_seen.add(pid)
                post = feed["posts"].get(pid)
                if obj.get("del"):
                    by = obj.get("by") if isinstance(obj.get("by"), dict) else {}
                    if (obj.get("id") == pid and (post is None or by.get("code") == post["author"]["code"])
                            and self.verify(obj, by.get("code"), by.get("pk"))):
                        if pid not in feed["deleted"]:
                            feed["deleted"].append(pid)
                        feed["posts"].pop(pid, None)
                        self.store.save_soon()
                        self.emit({"t": "feed_del", "pid": pid})
                    return
                ts = obj.get("ts") if isinstance(obj.get("ts"), int) else 0
                if (obj.get("id") != pid or pid in feed["deleted"] or not self._verify_author(obj)
                        or not now_ms() - FEED_MAX_AGE < ts < now_ms() + 3600_000):
                    return
                is_new = pid not in feed["posts"]
                feed["posts"][pid] = obj
                self._feed_prune()
                self.store.save_soon()
            elif kind == "l" and len(p) == 3:
                code = p[2]
                if obj.get("pid") != pid or obj.get("code") != code or not self.verify(obj, code, obj.get("pk")):
                    return
                likes = feed["likes"].setdefault(pid, {})
                if likes.get(code, {}).get("ts", 0) > obj.get("ts", 0):
                    return
                likes[code] = obj
                self.feed_seen.add(("l", pid, code))
                self.store.save_soon()
                self.emit({"t": "feed_like", "pid": pid, "likes": sum(1 for v in likes.values() if v.get("on")),
                           "liked": bool(likes.get(self.code, {}).get("on"))})
                return
            elif kind == "c" and len(p) == 3:
                cid = p[2]
                if not ID_RE.fullmatch(cid):
                    return
                comments = feed["comments"].setdefault(pid, {})
                self.feed_seen.add(("c", pid, cid))
                if obj.get("del"):
                    by = obj.get("by") if isinstance(obj.get("by"), dict) else {}
                    c, post = comments.get(cid), feed["posts"].get(pid)
                    allowed = ({c["author"]["code"]} if c else set()) | ({post["author"]["code"]} if post else set())
                    if obj.get("id") == cid and by.get("code") in allowed and self.verify(obj, by.get("code"), by.get("pk")):
                        comments.pop(cid, None)
                        self.store.save_soon()
                        self.emit({"t": "feed_comment", "pid": pid, "removed": cid, "count": len(comments)})
                    return
                if obj.get("id") != cid or obj.get("pid") != pid or not self._verify_author(obj):
                    return
                new_c = cid not in comments
                comments[cid] = obj
                self.store.save_soon()
                if new_c:
                    self.emit({"t": "feed_comment", "pid": pid, "c": self.comment_view(pid, obj), "count": len(comments)})
                return
            else:
                return
        if is_new:
            self.emit({"t": "feed_post", "post": self.feed_view(obj), "fresh": not retained})

    def _feed_prune(self):
        feed, now = self.store.d["feed"], now_ms()
        posts = feed["posts"]
        for pid in [k for k, v in posts.items() if now - v["ts"] > FEED_MAX_AGE]:
            posts.pop(pid)
        if len(posts) > FEED_MAX_POSTS:
            for pid in sorted(posts, key=lambda k: posts[k]["ts"])[:len(posts) - FEED_MAX_POSTS]:
                if posts[pid]["author"]["code"] != self.code:
                    posts.pop(pid)

    def feed_view(self, p):
        a = p["author"]
        prof = clean_profile({"name": a.get("name"), "avatar": a.get("avatar")})
        feed = self.store.d["feed"]
        atts = [m for m in (clean_att(x) for x in (p.get("atts") or [])[:POST_MAX_ATTS]) if m]
        likes = feed["likes"].get(p["id"], {})
        return {"id": p["id"], "text": str(p.get("text") or "")[:3000], "cat": p.get("cat") if p.get("cat") in CATS else "",
                "ts": p["ts"], "atts": [self.att_view(m["id"], m) for m in atts],
                "short": bool(p.get("short")) and len(atts) == 1 and atts[0]["kind"] == "video",
                "author": {"code": a["code"], "pretty": pretty(a["code"]), "name": prof["name"], "avatar": prof["avatar"]},
                "mine": a["code"] == self.code,
                "contact": self.store.d["contacts"].get(a["code"], {}).get("state") == "friend",
                "likes": sum(1 for v in likes.values() if v.get("on")), "liked": bool(likes.get(self.code, {}).get("on")),
                "comments": len(feed["comments"].get(p["id"], {}))}

    def comment_view(self, pid, c):
        a = c["author"]
        prof = clean_profile({"name": a.get("name"), "avatar": a.get("avatar")})
        post = self.store.d["feed"]["posts"].get(pid)
        return {"id": c["id"], "pid": pid, "text": str(c.get("text") or "")[:1000], "ts": int(c.get("ts") or 0),
                "author": {"code": a["code"], "pretty": pretty(a["code"]), "name": prof["name"], "avatar": prof["avatar"]},
                "mine": a["code"] == self.code,
                "can_del": a["code"] == self.code or bool(post and post["author"]["code"] == self.code)}

    def _feed_reseed(self):
        """Lo que el servidor público haya perdido se vuelve a subir desde nuestra copia (todo va firmado)."""
        if not self.connected:
            return
        feed, box, n = self.store.d["feed"], SecretBox(FEED_KEY), 0
        for pid, p in list(feed["posts"].items()):
            if pid in self.feed_seen or now_ms() - p["ts"] > 30 * 24 * 3600 * 1000 or n >= 150:
                continue
            n += 1
            self.client.publish(t_pp(pid), bytes(box.encrypt(canon(p))), qos=1, retain=True)
            if p["author"]["code"] == self.code:
                for m in p.get("atts") or []:
                    if self.store.d["atts"].get(m.get("id"), {}).get("complete"):
                        self.push_chunks(m["id"], lambda i, a=m["id"]: t_pa(a, i), retain=True)
        for pid, cm in list(feed["comments"].items()):
            for cid, c in list(cm.items()):
                if c["author"]["code"] == self.code and ("c", pid, cid) not in self.feed_seen:
                    self.client.publish(t_pc(pid, cid), bytes(box.encrypt(canon(c))), qos=1, retain=True)
        for pid, likes in list(feed["likes"].items()):
            mine = likes.get(self.code)
            if mine and ("l", pid, self.code) not in self.feed_seen:
                self.client.publish(t_pl(pid, self.code), bytes(box.encrypt(canon(mine))), qos=1, retain=True)

    # ---------- gustos (solo locales) para ordenar Inicio y sugerir personas y foros ----------
    def taste(self, terms, author, w):
        t = self.store.d["taste"]
        for key in ("terms", "authors"):
            for k in t[key]:
                t[key][k] *= 0.995
        for term in terms:
            t["terms"][term] = t["terms"].get(term, 0) + (w if term[0] in "tc" else w * .5)
        if author and author != self.code:
            t["authors"][author] = t["authors"].get(author, 0) + w
        for key in ("terms", "authors"):
            if len(t[key]) > 500:
                t[key] = dict(sorted(t[key].items(), key=lambda kv: -kv[1])[:400])
        self.store.save_soon()

    def term_score(self, terms):
        tt = self.store.d["taste"]["terms"]
        return math.log1p(max(0, sum(tt.get(x, 0) for x in terms)))

    # ---------- ventanas ----------
    def shake(self):
        w = self.window
        x0, y0 = w.x, w.y
        w.move(x0, y0)  # move() y x/y no comparten origen exacto: medimos el desfase
        x, y = 2 * x0 - w.x, 2 * y0 - w.y
        for dx, dy in [(-12, 5), (12, -5), (-10, -7), (10, 7), (-8, 4), (8, -4), (-5, 2), (5, -2), (-2, 0)]:
            w.move(x + dx, y + dy)
            time.sleep(0.03)
        w.move(x, y)

    def toast(self, data):
        self.toasts = [t for t in self.toasts if t[1].is_set() is False]
        slot = len(self.toasts)
        screen = webview.screens[0]
        api = ToastApi(self, data)
        # Se crea oculta y se muestra cuando ya está pintada (antes se veía un rectángulo negro un instante)
        w = webview.create_window(APP, url=resource("toast.html"), js_api=api, frameless=True, easy_drag=False,
                                  width=290, height=128, x=screen.width - 305, y=screen.height - 185 - slot * 138,
                                  on_top=True, focus=False, resizable=False, hidden=True, background_color="#cfe6fb")
        api._window = w
        closed = threading.Event()
        w.events.closed += closed.set
        # Por si la página no llega a avisar: se muestra igualmente poco después de cargar
        w.events.loaded += lambda: threading.Timer(.6, lambda: closed.is_set() or api.shown()).start()
        self.toasts.append((w, closed))

    def quit(self):
        try:
            if self.connected:
                self.client.publish(t_on(self.code), "0", qos=1, retain=True).wait_for_publish(2)
                self.client.disconnect()
        except Exception:
            pass
        self.store.save()
        if "websrv" in sys.modules:
            sys.modules["websrv"].stop_tunnel()   # que el enlace público no se quede abierto
        updater.install()   # si hay una versión nueva descargada, se instala al cerrar
        os._exit(0)


class Api:
    """Lo que la interfaz puede pedirle a Python (los atributos con _ no se exponen a JS)."""

    def __init__(self, core, restart_cb=None):
        self._core = core
        self._maximized = False
        self._restart = restart_cb or restart

    # --- estado inicial
    def init(self):
        core = self._core
        d = core.store.d
        with core.lock:
            core.ready = True
            return {"web": bool(core.sink), "version": updater.VERSION,
                    "update": core.updater.state if core.updater else None, "me": {"code": core.code, "pretty": pretty(core.code), "profile": d["profile"],
                           "user": (d.get("account") or {}).get("user"),
                           "fresh": not (d["contacts"] or d["forums"] or d["history"] or d["feed"]["posts"])},
                    "settings": d["settings"], "connected": core.connected,
                    "contacts": {c: core.view(c) for c in d["contacts"]},
                    "requests": {c: core.request_view(c) for c in d["requests"]},
                    "forums": {fid: core.forum_summary(fid) for fid in d["forums"]},
                    "limits": {"max_file": MAX_FILE}}

    # --- cuenta (usuario y contraseña)
    def _wait_conn(self, secs=12):
        end = time.time() + secs
        while not self._core.connected and time.time() < end:
            time.sleep(.3)
        return self._core.connected

    @staticmethod
    def _check_new(user, password):
        if not USER_RE.fullmatch(user):
            return "El usuario debe tener al menos 3 letras o números."
        if len(password) < 8:
            return "La contraseña debe tener al menos 8 caracteres."
        return None

    def register(self, user, password):
        core = self._core
        user, password = norm_user(user), str(password or "")
        err = self._check_new(user, password)
        if err:
            return {"ok": False, "msg": err}
        if not self._wait_conn():
            return {"ok": False, "msg": "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."}
        if core.fetch_retained(t_acct(user), 2.5) or core.fetch_retained(t_user(user), 1.5):
            return {"ok": False, "msg": f"El usuario <b>{user}</b> ya existe. Elige otro."}
        key = pass_key(user, password)
        with core.lock:
            core.store.d["account"] = {"user": user, "key": b64(key)}
            if core.store.d["profile"]["name"] in ("Yo", "Sin nombre"):
                core.store.d["profile"]["name"] = user
            core.store.save()
        core.publish_backup(force=True)
        return {"ok": True, "user": user, "profile": core.store.d["profile"]}

    def login(self, user, password):
        core = self._core
        user, password = norm_user(user), str(password or "")
        if not USER_RE.fullmatch(user) or not password:
            return {"ok": False, "msg": "Escribe tu usuario y tu contraseña."}
        if not self._wait_conn():
            return {"ok": False, "msg": "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."}
        raw = core.fetch_retained(t_acct(user), 6)
        if not raw:
            return {"ok": False, "msg": f"No existe la cuenta <b>{user}</b>."}
        key = pass_key(user, password)
        try:
            data = json.loads(SecretBox(key).decrypt(b64d(json.loads(raw)["b"])))
            sk = bytes.fromhex(data["sk"])
            assert len(sk) == 32
        except Exception:
            return {"ok": False, "msg": "Contraseña incorrecta."}
        contacts = {}
        for c, v in (data.get("contacts") or {}).items():
            if normalize_code(c) == c and isinstance(v, dict):
                contacts[c] = {"pk": v["pk"], "profile": clean_profile(v.get("profile")), "state": v.get("state", "friend"),
                               "since": v.get("since"), "unread": 0, "outbox": []}
        forums = {fid: {"meta": m, "posts": {}, "deleted": [], "read": 0}
                  for fid, m in (data.get("forums") or {}).items() if core.verify_meta(m, fid) and not old_private(m)}
        new = {"sk": data["sk"], "profile": clean_profile(data.get("profile")), "settings": clean_settings(data.get("settings")),
               "contacts": contacts, "requests": {}, "history": {}, "atts": {}, "forums": forums,
               "feed": {"posts": {}, "likes": {}, "comments": {}, "deleted": []}, "taste": {"terms": {}, "authors": {}, "seen": {}},
               "account": {"user": user, "key": b64(key)}}
        if data["sk"] == core.store.d["sk"]:  # misma identidad: conservamos el historial local
            new = {**core.store.d, **{k: new[k] for k in ("profile", "settings", "account")}}
        with core.lock:
            core.store.d = new
            core.store.save()
        threading.Timer(.5, self._restart).start()
        return {"ok": True}

    def change_password(self, old, new):
        core = self._core
        acct = core.store.d.get("account")
        if not acct:
            return {"ok": False, "msg": "No has iniciado sesión."}
        if b64(pass_key(acct["user"], str(old or ""))) != acct["key"]:
            return {"ok": False, "msg": "La contraseña actual no es correcta."}
        err = self._check_new(acct["user"], str(new or ""))
        if err:
            return {"ok": False, "msg": err}
        with core.lock:
            acct["key"] = b64(pass_key(acct["user"], str(new)))
            core.store.save()
        core.publish_backup(force=True)
        return {"ok": True, "msg": "Contraseña cambiada."}

    def logout(self):
        """Borra los datos de esta PC (la cuenta sigue guardada en el servidor) y vuelve a la pantalla de entrada."""
        core = self._core
        if not core.store.d.get("account"):
            return {"ok": False, "msg": "Primero crea una cuenta: si no, perderías tu código y tus contactos."}
        if not core.connected:
            return {"ok": False, "msg": "Sin conexión no se puede asegurar que tu cuenta esté guardada. Inténtalo luego."}
        core.publish_backup(force=True)
        time.sleep(1.5)
        try:
            if core.connected:
                core.client.publish(t_on(core.code), "0", qos=1, retain=True).wait_for_publish(2)
        except Exception:
            pass
        os.remove(core.store.path)
        shutil.rmtree(core.store.files, ignore_errors=True)
        threading.Timer(.3, self._restart).start()
        return {"ok": True}

    # --- perfil y ajustes
    def set_profile(self, profile):
        core = self._core
        with core.lock:
            act = core.store.d["profile"].get("activity")  # la actividad la pone la app, no la interfaz
            p = core.store.d["profile"] = clean_profile({**profile, "activity": act})
            core.store.save()
            core.publish_presence()
            for code, c in core.store.d["contacts"].items():
                if c["state"] == "friend" and core.online.get(code):
                    core.send(code, {"t": "profile", "p": p})
        return p

    def set_settings(self, settings):
        s = clean_settings({**self._core.store.d["settings"], **(settings if isinstance(settings, dict) else {})})
        core = self._core
        with core.lock:
            core.store.d["settings"] = s
            if not s["activity"] and core.store.d["profile"].get("activity"):
                core.store.d["profile"]["activity"] = None   # se desactivó: se deja de mostrar ya
                core.broadcast_profile()
            core.store.save()
        return s

    # --- contactos
    def add_contact(self, text):
        core = self._core
        d = core.store.d
        code = normalize_code(text)
        if not code and USER_RE.fullmatch(norm_user(text)):
            if not core.connected:
                return {"ok": False, "msg": "No hay conexión con el servidor. Inténtalo en unos segundos."}
            rec = core.lookup_user(norm_user(text))
            if not rec:
                return {"ok": False, "msg": f"No existe ningún usuario llamado <b>{norm_user(text)}</b>."}
            code = rec["code"]
        if not code:
            return {"ok": False, "msg": "Escribe un nombre de usuario o un código WIND-XXXX-XXXX."}
        if code == core.code:
            return {"ok": False, "msg": "Ese es tu propio código. Agregarte a ti mismo sería... muy Nada Messenger."}
        if code in d["contacts"]:
            st = d["contacts"][code]["state"]
            return {"ok": False, "msg": "Ya le enviaste una solicitud. Falta que la acepte."
                    if st == "pending" else "Esa persona ya está en tu lista."}
        if code in d["requests"]:
            self.respond_request(code, True)
            return {"ok": True, "msg": "Esa persona ya te había enviado una solicitud. ¡Ahora son contactos!"}
        if not core.connected:
            return {"ok": False, "msg": "No hay conexión con el servidor. Inténtalo en unos segundos."}
        raw = core.fetch_retained(t_key(code), 6)
        try:
            pk = b64d(raw) if raw else b""
        except ValueError:
            pk = b""
        if not pk or code_for(pk) != code:
            return {"ok": False, "msg": "No se encontró a nadie con ese código.<br>"
                                        "Revisa que esté bien escrito y que esa persona haya abierto Wind OS Messenger al menos una vez."}
        with core.lock:
            d["contacts"][code] = {"pk": b64(pk), "state": "pending", "since": None, "unread": 0, "outbox": [],
                                   "profile": clean_profile({"name": pretty(code), "avatar": {"type": "icon", "id": "nada"}})}
            core.store.save()
            core.client.subscribe(t_on(code), qos=1)
            core.send(code, {"t": "request", "p": d["profile"]}, pk)
            core.emit({"t": "contact", "c": core.view(code)})
        return {"ok": True, "msg": f"Solicitud enviada a <b>{pretty(code)}</b>.<br>Aparecerá en tu lista en cuanto la acepte."}

    def respond_request(self, code, accept):
        core = self._core
        d = core.store.d
        with core.lock:
            r = d["requests"].pop(code, None)
            if not r:
                return None
            if accept:
                d["contacts"][code] = {"pk": r["pk"], "profile": r["profile"], "state": "friend",
                                       "since": now_ms(), "unread": 0, "outbox": []}
                if core.connected:
                    core.client.subscribe(t_on(code), qos=1)
                core.send(code, {"t": "accept", "p": d["profile"]})
            core.store.save()
            return core.view(code) if accept else None

    def remove_contact(self, code):
        core = self._core
        with core.lock:
            c = core.store.d["contacts"].get(code)
            if c and c["state"] == "friend":
                core.send(code, {"t": "remove"})
            core._drop(code)

    # --- conversación
    def get_history(self, code):
        core = self._core
        return [core.msg_view(m) for m in core.store.d["history"].get(code, [])]

    def mark_read(self, code):
        core = self._core
        with core.lock:
            c = core.store.d["contacts"].get(code)
            if c and c.get("unread"):
                c["unread"] = 0
                core.store.save()

    def send_message(self, code, text, font=0, att=None, sticker=None):
        core = self._core
        with core.lock:
            c = core.store.d["contacts"].get(code)
            att = att if att in core.store.d["atts"] else None
            sticker = sticker if sticker and STICKER_RE.fullmatch(str(sticker)) else None
            if not c or c["state"] != "friend" or not (str(text).strip() or att or sticker):
                return None
            out = {"id": uuid.uuid4().hex[:12], "text": str(text)[:4000], "font": int(font) % 6, "ts": now_ms()}
            if att:
                out["att"] = att
            if sticker:
                out["sticker"] = sticker
            m = {**out, "from": "me", "kind": "msg", "status": "pending"}
            hist = core.store.d["history"].setdefault(code, [])
            hist.append(m)
            del hist[:-HISTORY_MAX]
            c.setdefault("outbox", []).append(out)
            if core.online.get(code) and core.send(code, core.wire_msg(out)):
                m["status"] = "sent"
                if att:
                    core.push_chunks(att, lambda i: t_x(code, att, i))
            core.store.save()
            return core.msg_view(m)

    def send_nudge(self, code):
        core = self._core
        with core.lock:
            if not core.online.get(code) or not core.send(code, {"t": "nudge"}):
                return None
            m = {"id": uuid.uuid4().hex[:12], "from": "me", "kind": "nudge", "ts": now_ms()}
            core.store.d["history"].setdefault(code, []).append(m)
            core.store.save()
            return m

    def send_typing(self, code):
        if self._core.online.get(code):
            self._core.send(code, {"t": "typing"})

    # --- archivos adjuntos
    def pick_files(self, kind="any"):
        filters = {
            "image": ("Imágenes y GIF (*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp)",),
            "audio": ("Música y audio (*.mp3;*.wav;*.ogg;*.m4a;*.flac;*.aac;*.opus;*.wma)",),
            "video": ("Vídeos (*.mp4;*.webm;*.mov;*.mkv;*.avi)",),
            "media": ("Fotos y vídeos (*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp;*.mp4;*.webm;*.mov;*.mkv)",),
        }.get(kind, ()) + ("Todos los archivos (*.*)",)
        paths = self._core.window.create_file_dialog(webview.FileDialog.OPEN, allow_multiple=True, file_types=filters) or []
        out = []
        for p in paths[:10]:
            try:
                if os.path.getsize(p) > MAX_FILE:
                    out.append({"error": f"«{os.path.basename(p)}» pesa más de {MAX_FILE // 1048576} MB."})
                    continue
                with open(p, "rb") as f:
                    out.append(self._core.prepare(f.read(), os.path.basename(p)))
            except OSError:
                out.append({"error": f"No se pudo leer «{os.path.basename(p)}»."})
        return out

    def prepare_blob(self, data_b64, name, mime=None, voice=False):
        try:
            data = b64d(data_b64)
        except ValueError:
            return None
        if len(data) > MAX_FILE:
            return {"error": f"El archivo pesa más de {MAX_FILE // 1048576} MB."}
        return self._core.prepare(data, str(name), str(mime or "") or None, bool(voice))

    def save_att(self, att_id):
        core = self._core
        a = core.store.d["atts"].get(att_id)
        if not a or not a.get("complete"):
            return False
        dest = core.window.create_file_dialog(webview.FileDialog.SAVE, save_filename=a["name"])
        if not dest:
            return False
        dest = dest[0] if isinstance(dest, (list, tuple)) else dest
        shutil.copyfile(os.path.join(core.store.files, a["file"]), dest)
        return True

    def open_att(self, att_id):
        core = self._core
        a = core.store.d["atts"].get(att_id)
        if not a or not a.get("complete"):
            return "Ese archivo todavía no se ha descargado."
        if os.path.splitext(a["name"])[1].lower() in RISKY_EXT:
            return "Por seguridad, los programas y scripts no se abren directamente. Usa «Guardar» y revísalo antes."
        os.startfile(os.path.join(core.store.files, a["file"]))
        return ""

    # --- foros
    def forum_directory(self):
        core = self._core
        joined = core.store.d["forums"]
        return [{**v, "joined": fid in joined} for fid, m in core.directory.items() if (v := core.verify_meta(m, fid))]

    def forum_create(self, name, desc, icon, private):
        core = self._core
        name, desc = str(name).strip()[:60], str(desc).strip()[:300]
        if len(name) < 3:
            return {"ok": False, "msg": "El nombre del foro debe tener al menos 3 letras."}
        if not core.connected:
            return {"ok": False, "msg": "No hay conexión con el servidor. Inténtalo en unos segundos."}
        if private and core.fetch_retained(t_fpriv(name_hash(name)), 4):
            return {"ok": False, "msg": "Ya existe un foro privado con ese nombre. Elige otro."}
        fid = base64.b32encode(nacl_random(10)).decode()[:10]
        meta = core.sign({"fid": fid, "name": name, "desc": desc, "icon": clean_avatar({"id": icon})["id"],
                          "private": bool(private), "owner": core.code, "owner_pk": b64(core.pk),
                          "owner_name": core.store.d["profile"]["name"], "ts": now_ms()})
        with core.lock:
            core.store.d["forums"][fid] = {"meta": meta, "posts": {}, "deleted": [], "read": now_ms()}
            core.store.save()
            core._publish_meta(meta)
            core._forum_subscribe(fid)
        return {"ok": True, "forum": core.forum_summary(fid)}

    def forum_find(self, query):
        """Busca un foro por su código FORO-XXXXX-XXXXX o, si es privado, por su nombre exacto."""
        core = self._core
        q = str(query).strip()
        if not q:
            return {"ok": False}
        fid = normalize_fid(q)
        if fid:
            raw = core.fetch_retained(t_fm(fid), 5)
            try:
                m = json.loads(SecretBox(forum_key(fid)).decrypt(raw)) if raw else None
            except Exception:
                m = None
        else:
            raw = core.fetch_retained(t_fpriv(name_hash(q)), 5)
            try:
                m = json.loads(SecretBox(name_key(q)).decrypt(raw)) if raw else None
            except Exception:
                m = None
        v = core.verify_meta(m, m.get("fid")) if isinstance(m, dict) and not old_private(m) else None
        if not v:
            return {"ok": False}
        core.found[v["fid"]] = m
        return {"ok": True, "forum": {**v, "joined": v["fid"] in core.store.d["forums"]}}

    def forum_join(self, fid):
        core = self._core
        m = core.found.get(fid) or core.directory.get(fid)
        if not m or not core.verify_meta(m, fid):
            return None
        with core.lock:
            core.store.d["forums"].setdefault(fid, {"meta": m, "posts": {}, "deleted": [], "read": 0})
            core.store.save()
            core._forum_subscribe(fid)
            core.taste(name_terms(f"{m.get('name', '')} {m.get('desc', '')}"), None, 3)
            return core.forum_summary(fid)

    def forum_leave(self, fid):
        core = self._core
        with core.lock:
            if core.store.d["forums"].pop(fid, None) and core.connected:
                core.client.unsubscribe([t_fm(fid), f"{PREFIX}/f/{fid}/t/+", f"{PREFIX}/f/{fid}/r/+/+"])
            core.store.save()

    def forum_get(self, fid):
        core = self._core
        with core.lock:
            f = core.store.d["forums"].get(fid)
            if not f:
                return None
            f["read"] = now_ms()
            core.store.save_soon()
            posts = [core.post_view(fid, p) for pid, p in f["posts"].items() if pid not in f.get("deleted", [])]
            return {"forum": core.forum_summary(fid), "posts": posts}

    def forum_mark_read(self, fid):
        core = self._core
        with core.lock:
            f = core.store.d["forums"].get(fid)
            if not f:
                return None
            f["read"] = now_ms()
            core.store.save_soon()
            return core.forum_summary(fid)

    def forum_post(self, fid, tid, title, text, att=None, sticker=None):
        core = self._core
        f = core.store.d["forums"].get(fid)
        title, text = str(title or "").strip()[:120], str(text or "").strip()[:5000]
        att = att if att in core.store.d["atts"] else None
        sticker = sticker if sticker and STICKER_RE.fullmatch(str(sticker)) else None
        if not f or not core.connected:
            return {"error": "No hay conexión con el servidor."}
        if not tid and not title:
            return {"error": "El tema necesita un título."}
        if not (text or att or sticker or title):
            return {"error": "Escribe algo antes de publicar."}
        pid = uuid.uuid4().hex[:16]
        kind = "r" if tid else "t"
        tid = tid if tid else pid
        if kind == "r" and tid not in f["posts"]:
            return {"error": "Ese tema ya no existe."}
        prof = core.store.d["profile"]
        avatar = clean_avatar(prof["avatar"], max_img=40_000)
        post = {"id": pid, "fid": fid, "tid": tid, "kind": kind, "title": title if kind == "t" else "", "text": text,
                "ts": now_ms(), "author": {"code": core.code, "pk": b64(core.pk), "name": prof["name"], "avatar": avatar}}
        if sticker:
            post["sticker"] = sticker
        if att:
            post["att"] = core.att_wire(att)
        core.sign(post)
        topic = t_ft(fid, pid) if kind == "t" else t_fr(fid, tid, pid)
        with core.lock:
            f["posts"][pid] = post
            core.fseen.setdefault(fid, set()).add(pid)
            core.store.save()
        core.client.publish(topic, bytes(SecretBox(forum_key(fid)).encrypt(canon(post))), qos=1, retain=True)
        if att:
            core.push_chunks(att, lambda i: t_fa(fid, att, i), retain=True)
        core.taste(name_terms(f"{title} {text}"), None, 1.5)
        return {"post": core.post_view(fid, post), "f": core.forum_summary(fid)}

    def forum_delete(self, fid, pid):
        core = self._core
        f = core.store.d["forums"].get(fid)
        post = f and f["posts"].get(pid)
        if not post or not core.connected or (post["author"]["code"] != core.code and f["meta"]["owner"] != core.code):
            return False
        tomb = core.sign({"del": True, "id": pid, "ts": now_ms(), "by": {"code": core.code, "pk": b64(core.pk)}})
        topic = t_ft(fid, pid) if post["kind"] == "t" else t_fr(fid, post["tid"], pid)
        core.client.publish(topic, bytes(SecretBox(forum_key(fid)).encrypt(canon(tomb))), qos=1, retain=True)
        with core.lock:
            core._tombstone_in(fid, f, tomb, pid)
            if post["kind"] == "t":  # al borrar un tema se van también sus respuestas (para mí)
                for rid, p in list(f["posts"].items()):
                    if p["tid"] == pid:
                        f["posts"].pop(rid)
            core.store.save()
        return True

    def forum_fetch_att(self, fid, att_id):
        core = self._core
        f = core.store.d["forums"].get(fid)
        if not f or not core.connected:
            return None
        meta = next((m for p in f["posts"].values() if (m := clean_att(p.get("att"))) and m["id"] == att_id), None)
        return core.fetch_remote_att(meta, f"{PREFIX}/f/{fid}/a/{att_id}/+") if meta else None

    # --- Inicio
    def _author(self):
        prof = self._core.store.d["profile"]
        return {"code": self._core.code, "pk": b64(self._core.pk), "name": prof["name"],
                "avatar": clean_avatar(prof["avatar"], max_img=40_000)}

    def feed_post(self, text, cat="", atts=None, short=False):
        core = self._core
        text, cat = str(text or "").strip()[:3000], cat if cat in CATS else ""
        atts = [a for a in dict.fromkeys(atts or []) if a in core.store.d["atts"]][:POST_MAX_ATTS]
        # Un "corto" es una publicación con un único vídeo
        short = bool(short) and len(atts) == 1 and core.store.d["atts"][atts[0]]["kind"] == "video"
        if not (text or atts):
            return {"error": "Escribe algo o añade fotos o vídeos."}
        if not core.connected:
            return {"error": "No hay conexión con el servidor. Inténtalo en unos segundos."}
        if sum(core.store.d["atts"][a]["size"] for a in atts) > 3 * MAX_FILE:
            return {"error": f"Entre todos los archivos no pueden pasar de {3 * MAX_FILE // 1048576} MB."}
        post = {"id": uuid.uuid4().hex[:16], "text": text, "cat": cat, "ts": now_ms(), "author": self._author(),
                "atts": [core.att_wire(a) for a in atts]}
        if short:
            post["short"] = True
        core.sign(post)
        with core.lock:
            core.store.d["feed"]["posts"][post["id"]] = post
            core.feed_seen.add(post["id"])
            core.store.save()
        core.client.publish(t_pp(post["id"]), bytes(SecretBox(FEED_KEY).encrypt(canon(post))), qos=1, retain=True)
        for a in atts:
            core.push_chunks(a, lambda i, a=a: t_pa(a, i), retain=True)
        core.taste(post_terms(text, cat), None, 2)
        return core.feed_view(post)

    def feed_delete(self, pid):
        core = self._core
        feed = core.store.d["feed"]
        post = feed["posts"].get(pid)
        if not post or post["author"]["code"] != core.code or not core.connected:
            return False
        tomb = core.sign({"del": True, "id": pid, "ts": now_ms(), "by": {"code": core.code, "pk": b64(core.pk)}})
        core.client.publish(t_pp(pid), bytes(SecretBox(FEED_KEY).encrypt(canon(tomb))), qos=1, retain=True)
        for m in post.get("atts") or []:  # liberamos los trozos de los archivos en el servidor
            for i in range(int(m.get("n") or 0)):
                core.client.publish(t_pa(m["id"], i), b"", qos=1, retain=True)
        with core.lock:
            feed["posts"].pop(pid, None)
            feed["deleted"].append(pid)
            core.store.save()
        return True

    def feed_like(self, pid, on):
        core = self._core
        feed = core.store.d["feed"]
        post = feed["posts"].get(pid)
        if not post or not core.connected:
            return None
        obj = core.sign({"pid": pid, "code": core.code, "pk": b64(core.pk), "ts": now_ms(), "on": bool(on)})
        core.client.publish(t_pl(pid, core.code), bytes(SecretBox(FEED_KEY).encrypt(canon(obj))), qos=1, retain=True)
        with core.lock:
            feed["likes"].setdefault(pid, {})[core.code] = obj
            core.feed_seen.add(("l", pid, core.code))
        core.taste(post_terms(post.get("text"), post.get("cat", "")), post["author"]["code"], 4 if on else -3)
        return core.feed_view(post)

    def feed_comments(self, pid):
        core = self._core
        cm = core.store.d["feed"]["comments"].get(pid, {})
        return sorted((core.comment_view(pid, c) for c in cm.values()), key=lambda c: c["ts"])

    def feed_comment(self, pid, text):
        core = self._core
        feed = core.store.d["feed"]
        post, text = feed["posts"].get(pid), str(text or "").strip()[:1000]
        if not post or not text or not core.connected:
            return None
        c = core.sign({"id": uuid.uuid4().hex[:16], "pid": pid, "text": text, "ts": now_ms(), "author": self._author()})
        core.client.publish(t_pc(pid, c["id"]), bytes(SecretBox(FEED_KEY).encrypt(canon(c))), qos=1, retain=True)
        with core.lock:
            feed["comments"].setdefault(pid, {})[c["id"]] = c
            core.feed_seen.add(("c", pid, c["id"]))
            core.store.save_soon()
        core.taste(post_terms(post.get("text"), post.get("cat", "")), post["author"]["code"], 5)
        return core.comment_view(pid, c)

    def feed_comment_delete(self, pid, cid):
        core = self._core
        feed = core.store.d["feed"]
        c, post = feed["comments"].get(pid, {}).get(cid), feed["posts"].get(pid)
        if not c or not core.connected or core.code not in {c["author"]["code"], post and post["author"]["code"]}:
            return False
        tomb = core.sign({"del": True, "id": cid, "ts": now_ms(), "by": {"code": core.code, "pk": b64(core.pk)}})
        core.client.publish(t_pc(pid, cid), bytes(SecretBox(FEED_KEY).encrypt(canon(tomb))), qos=1, retain=True)
        with core.lock:
            feed["comments"][pid].pop(cid, None)
            core.store.save_soon()
        return True

    def feed_get(self, filt=""):
        """Publicaciones de Inicio. Sin filtro, ordenadas a medida (novedad + gustos + amigos + algo de azar)."""
        core = self._core
        d, now, filt = core.store.d, now_ms(), str(filt or "")
        feed, seen = d["feed"], d["taste"]["seen"]
        posts = [p for pid, p in feed["posts"].items() if pid not in feed["deleted"] and now - p["ts"] < FEED_MAX_AGE]
        if filt == "short":  # Cortos: también ordenados según los gustos de cada persona
            posts, filt = [p for p in posts if p.get("short")], ""
        if filt:
            if filt == "mine":
                posts = [p for p in posts if p["author"]["code"] == core.code]
            elif filt.startswith("c:"):
                posts = [p for p in posts if p.get("cat") == filt[2:]]
            elif filt.startswith("t:"):
                posts = [p for p in posts if "t:" + filt[2:].lower() in post_terms(p.get("text"), "")]
            elif filt.startswith("u:"):
                posts = [p for p in posts if p["author"]["code"] == filt[2:]]
            return [core.feed_view(p) for p in sorted(posts, key=lambda p: -p["ts"])[:100]]

        day = time.strftime("%Y%m%d")

        def score(p):
            age_h = (now - p["ts"]) / 3.6e6
            author = p["author"]["code"]
            likes = sum(1 for v in feed["likes"].get(p["id"], {}).values() if v.get("on"))
            pop = math.log1p(likes + 2 * len(feed["comments"].get(p["id"], {}))) * .35
            friend = .6 if d["contacts"].get(author, {}).get("state") == "friend" else 0
            affinity = core.term_score(post_terms(p.get("text"), p.get("cat", ""))) + \
                math.log1p(max(0, d["taste"]["authors"].get(author, 0))) * 1.5
            jitter = int(hashlib.sha256((p["id"] + day + core.code).encode()).hexdigest()[:4], 16) / 65535 * .25
            s = 0.5 ** (age_h / 36) * (1 + affinity + pop + friend + (.8 if age_h < 3 else 0)) + jitter
            if author == core.code:
                s *= 3 if age_h < 1 else .6
            return s * (.7 ** max(0, seen.get(p["id"], 0) - 1))

        pool, out, last = sorted(posts, key=score, reverse=True), [], []
        while pool and len(out) < 80:  # variedad: no más de dos seguidas de la misma persona
            i = next((i for i, p in enumerate(pool) if last[-2:].count(p["author"]["code"]) < 2), 0)
            out.append(pool.pop(i))
            last.append(out[-1]["author"]["code"])
        return [core.feed_view(p) for p in out]

    def feed_signal(self, pid, kind):
        core = self._core
        p = core.store.d["feed"]["posts"].get(pid)
        w = {"view": 1, "open": 2, "play": 2, "link": 2, "tag": 2, "profile": 1.5, "watch": 3}.get(kind)
        if not p or not w:
            return
        with core.lock:
            if kind == "view":
                seen = core.store.d["taste"]["seen"]
                seen[pid] = seen.get(pid, 0) + 1
                if len(seen) > 3000:
                    core.store.d["taste"]["seen"] = dict(list(seen.items())[-2000:])
            core.taste(post_terms(p.get("text"), p.get("cat", "")), p["author"]["code"], w)

    def feed_fetch_att(self, att_id):
        core = self._core
        if not core.connected:
            return None
        for p in core.store.d["feed"]["posts"].values():
            for m in p.get("atts") or []:
                if m.get("id") == att_id and (meta := clean_att(m)):
                    return core.fetch_remote_att(meta, f"{PREFIX}/feed/a/{att_id}/+")
        return None

    def home_recs(self):
        """Personas y foros sugeridos para la pantalla de Inicio."""
        core = self._core
        d, now = core.store.d, now_ms()
        taste = d["taste"]
        exclude = {core.code} | set(d["contacts"]) | set(d["requests"])
        cand = {}

        def add(a, ts, terms, forum=False):
            code = a.get("code") if isinstance(a, dict) else None
            if not code or code in exclude:
                return
            c = cand.setdefault(code, {"a": a, "ts": 0, "n": 0, "terms": set(), "forum": 0})
            if ts > c["ts"]:
                c["ts"], c["a"] = ts, a
            c["n"] += 1
            c["terms"] |= terms
            c["forum"] += forum

        for p in d["feed"]["posts"].values():
            add(p["author"], p["ts"], post_terms(p.get("text"), p.get("cat", "")))
        for cm in d["feed"]["comments"].values():
            for c in cm.values():
                add(c["author"], int(c.get("ts") or 0), set())
        for f in d["forums"].values():
            for p in f["posts"].values():
                add(p["author"], int(p.get("ts") or 0), name_terms(f"{p.get('title', '')} {p.get('text', '')}"), True)

        def pscore(code, c):
            return (math.log1p(max(0, taste["authors"].get(code, 0))) * 1.5 + core.term_score(c["terms"])
                    + .5 * min(c["forum"], 3) + .2 * math.log1p(c["n"]) + .4 * 0.5 ** ((now - c["ts"]) / 6.048e8))

        people = []
        for code, c in sorted(cand.items(), key=lambda kv: -pscore(*kv))[:6]:
            prof = clean_profile({"name": c["a"].get("name"), "avatar": c["a"].get("avatar")})
            people.append({"code": code, "pretty": pretty(code), "name": prof["name"], "avatar": prof["avatar"],
                           "ts": c["ts"], "n": c["n"]})
        day = time.strftime("%Y%m%d")
        forums = []
        for fid, m in core.directory.items():
            if fid in d["forums"] or not (v := core.verify_meta(m, fid)):
                continue
            jitter = int(hashlib.sha256((fid + day).encode()).hexdigest()[:4], 16) / 65535 * .4
            forums.append((core.term_score(name_terms(f"{v['name']} {v['desc']}")) + jitter + .2 * 0.5 ** ((now - v["ts"]) / 6.048e8), v))
        return {"people": people, "forums": [v for _, v in sorted(forums, key=lambda x: -x[0])[:5]]}

    def open_url(self, url):
        url = str(url)
        if re.fullmatch(r"https?://[^\s<>\"']{3,2000}", url):
            webbrowser.open(url)
            return True
        return False

    # --- llamadas: solo transportamos la señalización WebRTC (cifrada) entre contactos
    def call_signal(self, code, data):
        core = self._core
        c = core.store.d["contacts"].get(code)
        if not c or c["state"] != "friend" or not isinstance(data, dict):
            return False
        return core.send(code, {"t": "rtc", "d": data})

    # --- utilidades
    def copy(self, text):
        subprocess.run("clip", input=str(text).encode("utf-16-le"), creationflags=0x08000000)

    def shake(self):
        self._core.shake()

    def toast(self, data):
        self._core.toast(data)

    def minimize(self):
        self._core.window.minimize()

    def toggle_maximize(self):
        w = self._core.window
        w.restore() if self._maximized else w.maximize()
        self._maximized = not self._maximized

    def focus(self):
        self._core.window.restore()
        self._core.window.show()

    def quit(self):
        self._core.quit()

    def update_now(self):
        """Instala la versión descargada y vuelve a abrir la app."""
        core = self._core
        try:
            if core.connected:
                core.client.publish(t_on(core.code), "0", qos=1, retain=True).wait_for_publish(2)
        except Exception:
            pass
        core.store.save()
        if updater.install(restart_after=True):
            os._exit(0)
        return {"ok": False, "msg": "No se pudo instalar la actualización. ¿Está el programa en una carpeta protegida? "
                                    "Muévelo a Escritorio o Documentos y vuelve a intentarlo."}

    # --- versión web servida desde este PC
    def web_start(self, port=8765):
        import websrv
        try:
            return {"ok": True, **websrv.start(sys.modules[__name__], int(port))}
        except OSError as e:
            return {"ok": False, "msg": f"No se pudo abrir el puerto {port}: {e}"}

    def web_tunnel(self):
        """Enlace público https para compartir la versión web (arranca el servidor web si hace falta)."""
        import websrv
        info = self.web_start()
        if not info.get("ok"):
            return info
        return websrv.tunnel(info["port"])

    def web_stop_tunnel(self):
        import websrv
        websrv.stop_tunnel()
        return True

    def web_info(self):
        import websrv
        return websrv.start(sys.modules[__name__]) if websrv._server else None


def allow_media_permissions():
    """Concede micrófono y cámara a nuestra propia página: el aviso de permiso salía escondido y frenaba las llamadas."""
    try:
        from webview.platforms import edgechromium as ec
        from Microsoft.Web.WebView2.Core import CoreWebView2PermissionKind, CoreWebView2PermissionState
    except Exception:
        return
    original = ec.EdgeChrome.on_webview_ready

    def on_permission(sender, args):
        if args.PermissionKind in (CoreWebView2PermissionKind.Microphone, CoreWebView2PermissionKind.Camera) and \
                args.Uri.startswith("http://127.0.0.1"):
            args.State = CoreWebView2PermissionState.Allow

    def patched(self, sender, args):
        original(self, sender, args)
        try:
            sender.CoreWebView2.PermissionRequested += on_permission
        except Exception:
            pass
    ec.EdgeChrome.on_webview_ready = patched


def restart():
    """Vuelve a abrir el programa (tras iniciar o cerrar sesión)."""
    args = sys.argv[1:] if getattr(sys, "frozen", False) else [os.path.abspath(sys.argv[0])] + sys.argv[1:]
    updater.relaunch([sys.executable] + args)
    os._exit(0)


class ToastApi:
    def __init__(self, core, data):
        self._core, self._data, self._window, self._shown = core, data, None, False

    def get_data(self):
        return self._data

    def shown(self):
        if not self._shown:
            self._shown = True
            self._window.show()

    def close(self):
        self._window.destroy()

    def open(self):
        core = self._core
        core.window.restore()
        core.window.show()
        if self._data.get("code"):
            core.window.evaluate_js(f"selectContact({json.dumps(self._data['code'])})")
        self._window.destroy()


if __name__ == "__main__":
    if "--web" in sys.argv:  # solo el servidor web, sin ventana:  windos.py --web [puerto]
        import websrv
        i = sys.argv.index("--web")
        websrv.run(sys.modules[__name__], int(sys.argv[i + 1]) if len(sys.argv) > i + 1 and sys.argv[i + 1].isdigit() else 8765)
    updater.startup()   # instala una actualización pendiente antes de abrir nada
    allow_media_permissions()
    core = Core()
    core.window = webview.create_window(APP, url=resource("main.html"), js_api=Api(core), frameless=True,
                                        easy_drag=False, width=1100, height=720, min_size=(940, 600),
                                        background_color="#3fa6ef")
    core.window.events.closed += core.quit
    # Puerto fijo por perfil (así los permisos de micrófono se recuerdan) y distinto entre perfiles
    port = free_port(42100 + int(hashlib.sha256(profile_name().encode()).hexdigest()[:4], 16) % 800)
    webview.start(private_mode=False, http_port=port)
