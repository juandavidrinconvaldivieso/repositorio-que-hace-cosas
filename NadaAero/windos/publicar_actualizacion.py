"""Publica una nueva versión de Wind OS Messenger: todas las copias instaladas se actualizan solas.

Uso (desde esta carpeta):
    python publicar_actualizacion.py 2.6.0 "Qué hay de nuevo"     compila, firma y publica la versión 2.6.0
    python publicar_actualizacion.py --solo-compilar                compila el .exe sin publicar nada
    python publicar_actualizacion.py --generar-clave                crea tu clave de firma (solo la primera vez)

Opciones: --canal prueba   publica en un canal de pruebas (las apps lo usan si se abren con --canal prueba)

Tu clave privada se guarda en %APPDATA%\\WindOSMessenger\\desarrollador\\clave_actualizaciones.key.
Haz una copia de seguridad: sin ella no podrás publicar más actualizaciones, y quien la tenga podría publicarlas.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time

import paho.mqtt.client as mqtt
from nacl.signing import SigningKey

import updater

HERE = os.path.dirname(os.path.abspath(__file__))
KEY_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "WindOSMessenger", "desarrollador")
KEY_FILE = os.path.join(KEY_DIR, "clave_actualizaciones.key")
EXE = os.path.join(HERE, "dist", "Wind OS Messenger.exe")
DATA = ["main.html", "toast.html", "aero.css", "skins.css", "mobile.css", "common.js", "retro.js", "bots.js", "player.js",
        "media.js", "calls.js", "forums.js", "home.js", "shorts.js", "auth.js", "wm.js", "app.js", "webshim.js", "i18n.js"]
BROKER = "broker.hivemq.com"


def generate_key():
    if os.path.exists(KEY_FILE):
        sys.exit(f"Ya tienes una clave en {KEY_FILE}. No la sustituyas: las apps instaladas solo aceptan esa.")
    os.makedirs(KEY_DIR, exist_ok=True)
    sk = SigningKey.generate()
    with open(KEY_FILE, "w") as f:
        f.write(sk.encode().hex())
    set_in_file("updater.py", r'UPDATE_PK = "[^"]*"', f'UPDATE_PK = "{sk.verify_key.encode().hex()}"')
    print(f"Clave creada en {KEY_FILE}\n¡Haz una copia de seguridad de ese archivo!")


def set_in_file(name, pattern, repl):
    path = os.path.join(HERE, name)
    with open(path, encoding="utf-8") as f:
        text = f.read()
    new, n = re.subn(pattern, repl, text, count=1)
    if n != 1:
        sys.exit(f"No encontré dónde cambiar {pattern} en {name}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)


def version_file(version):
    nums = (tuple(int(x) for x in version.split(".")) + (0, 0, 0, 0))[:4]
    path = os.path.join(HERE, "build", "version_info.txt")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"""VSVersionInfo(
  ffi=FixedFileInfo(filevers={nums}, prodvers={nums}, mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[StringFileInfo([StringTable('040A04B0', [
    StringStruct('CompanyName', 'Wind OS'),
    StringStruct('FileDescription', 'Wind OS Messenger'),
    StringStruct('FileVersion', '{version}'),
    StringStruct('InternalName', 'WindOSMessenger'),
    StringStruct('LegalCopyright', 'Wind OS'),
    StringStruct('OriginalFilename', 'Wind OS Messenger.exe'),
    StringStruct('ProductName', 'Wind OS Messenger'),
    StringStruct('ProductVersion', '{version}')])]),
    VarFileInfo([VarStruct('Translation', [1034, 1200])])])
""")
    return path


def build(version):
    cmd = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--onefile", "--windowed", "--name", "Wind OS Messenger",
           "--icon", "windos.ico", "--hidden-import", "websrv", "--hidden-import", "activity", "--version-file", version_file(version)]
    for f in DATA:
        cmd += ["--add-data", f"{f};."]
    cmd.append("windos.py")
    print("Compilando...", flush=True)
    r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:])
        sys.exit("La compilación falló.")
    print("Compilado:", EXE)


def publish(version, notes, ch):
    with open(KEY_FILE) as f:
        sk = SigningKey(bytes.fromhex(f.read().strip()))
    if sk.verify_key.encode().hex() != updater.UPDATE_PK:
        sys.exit("La clave de este PC no coincide con la que llevan las apps (UPDATE_PK en updater.py).")
    with open(EXE, "rb") as f:
        data = f.read()
    n = -(-len(data) // updater.UPD_CHUNK)
    m = {"version": version, "size": len(data), "n": n, "sha256": hashlib.sha256(data).hexdigest(),
         "notes": notes[:600], "ts": int(time.time())}
    m["sig"] = sk.sign(updater.canon(m)).signature.hex()

    cl = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    old = []
    cl.on_message = lambda c, u, msg: old.append(msg.payload)
    cl.connect(BROKER, 1883)
    cl.loop_start()
    cl.subscribe(updater.t_manifest(ch), 1)
    time.sleep(2.5)
    cl.unsubscribe(updater.t_manifest(ch))
    prev = updater.check_manifest(old[0]) if old and old[0] else None

    print(f"Subiendo {len(data) / 1048576:.1f} MB en {n} trozos...", flush=True)
    for i in range(n):
        cl.publish(updater.t_bin(version, i, ch), data[i * updater.UPD_CHUNK:(i + 1) * updater.UPD_CHUNK], qos=1, retain=True).wait_for_publish(30)
        if i % 10 == 0:
            print(f"  {i + 1}/{n}", flush=True)
    cl.publish(updater.t_manifest(ch), json.dumps(m), qos=1, retain=True).wait_for_publish(30)
    if prev and prev["version"] != version:  # liberamos los trozos de la versión anterior
        for i in range(prev["n"]):
            cl.publish(updater.t_bin(prev["version"], i, ch), b"", qos=1, retain=True)
    time.sleep(2)
    cl.loop_stop()
    print(f"¡Publicada la versión {version} en el canal «{ch}»! Las apps abiertas la descargarán en unos minutos.")


if __name__ == "__main__":
    args = sys.argv[1:]
    ch = "estable"
    if "--canal" in args:
        i = args.index("--canal")
        ch = re.sub(r"[^a-z0-9]", "", args[i + 1].lower())
        del args[i:i + 2]
    if args[:1] == ["--generar-clave"]:
        generate_key()
    elif args[:1] == ["--solo-compilar"]:
        build(updater.VERSION)
    elif args and re.fullmatch(r"\d+(\.\d+){1,3}", args[0]):
        version, notes = args[0], " ".join(args[1:])
        if not os.path.exists(KEY_FILE):
            sys.exit("Primero crea tu clave:  python publicar_actualizacion.py --generar-clave")
        if updater.vtuple(version) <= updater.vtuple(updater.VERSION) and "--repetir" not in args:
            sys.exit(f"La versión debe ser mayor que la actual ({updater.VERSION}).")
        set_in_file("updater.py", r'VERSION = "[^"]*"', f'VERSION = "{version}"')
        updater.VERSION = version
        build(version)
        publish(version, notes.replace("--repetir", "").strip(), ch)
    else:
        print(__doc__)
