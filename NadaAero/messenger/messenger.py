"""Nada Messenger: un mensajero estilo 2009 para chatear con Nada (y Nadie)."""
import os
import random
import sys
import threading
import time

import webview


def resource(name):
    # Dentro del .exe de PyInstaller los archivos están en sys._MEIPASS
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, name)


ME = {"name": "Yo", "status": "online", "msg": ""}
chats = {}   # id de contacto -> ventana de conversación abierta
toasts = []  # notificaciones visibles


class WinApi:
    """API expuesta a cada ventana (los atributos con _ no se exponen a JS)."""

    def __init__(self, data=None):
        self._window = None
        self._maximized = False
        self._data = data or {}

    def get_data(self):
        return {**self._data, "me": ME}

    def set_me(self, me):
        ME.update(me)

    def minimize(self):
        self._window.minimize()

    def toggle_maximize(self):
        if self._maximized:
            self._window.restore()
        else:
            self._window.maximize()
        self._maximized = not self._maximized

    def close(self):
        self._window.destroy()

    def close_all(self):
        os._exit(0)

    def nudge(self):
        w = self._window
        x0, y0 = w.x, w.y
        # move() y x/y no usan exactamente el mismo origen: medimos el desfase para que no "camine"
        w.move(x0, y0)
        x, y = 2 * x0 - w.x, 2 * y0 - w.y
        for dx, dy in [(-12, 5), (12, -5), (-10, -7), (10, 7), (-8, 4), (8, -4), (-5, 2), (5, -2), (-2, 0)]:
            w.move(x + dx, y + dy)
            time.sleep(0.03)
        w.move(x, y)

    def open_chat(self, contact_id, name):
        if contact_id in chats:
            chats[contact_id].restore()
            chats[contact_id].show()
            return
        open_window(f"{name} - Conversación", "chat.html", {"contact": contact_id},
                    width=560, height=500, min_size=(420, 380), registry=(chats, contact_id))


def open_window(title, page, data, registry=None, **kwargs):
    api = WinApi(data)
    w = webview.create_window(title, url=resource(page), js_api=api, frameless=True,
                              easy_drag=False, background_color="#3fa6ef", **kwargs)
    api._window = w
    if isinstance(registry, tuple):
        store, key = registry
        store[key] = w
        w.events.closed += lambda: store.pop(key, None)
    elif registry is not None:
        registry.append(w)
        w.events.closed += lambda: w in registry and registry.remove(w)
    return w


def show_toast(contact_id):
    screen = webview.screens[0]
    open_window("Nada Messenger", "toast.html", {"contact": contact_id}, registry=toasts,
                width=270, height=118, x=screen.width - 285, y=screen.height - 175,
                on_top=True, focus=False, resizable=False)


def toast_loop():
    time.sleep(3)
    show_toast("nada")
    while True:
        time.sleep(random.uniform(60, 150))
        show_toast(random.choice(["nada", "nadie", "ninguno", "cero", "vacio"]))


if __name__ == "__main__":
    main = open_window("Nada Messenger", "main.html", {}, width=330, height=620, min_size=(280, 420))

    # Cerrar la lista de contactos cierra el programa entero (chats y notificaciones incluidos)
    main.events.closed += lambda: os._exit(0)
    webview.start(lambda: threading.Thread(target=toast_loop, daemon=True).start(), private_mode=False)
