"""Nada.exe — una aplicación que no hace nada, con marco estilo Windows 7 Aero."""
import os
import sys
import threading
import time

import webview


def resource(name):
    # Dentro del .exe de PyInstaller los archivos están en sys._MEIPASS
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, name)


class Api:
    def __init__(self):
        self.window = None
        self.maximized = False

    def minimize(self):
        self.window.minimize()

    def toggle_maximize(self):
        if self.maximized:
            self.window.restore()
        else:
            self.window.maximize()
        self.maximized = not self.maximized

    def close(self):
        self.window.destroy()

    def fake_crash(self):
        # La ventana "se cierra"... y vuelve sola.
        def revive():
            self.window.hide()
            time.sleep(1.5)
            self.window.show()
            self.window.evaluate_js("window.recovered()")

        threading.Thread(target=revive, daemon=True).start()


if __name__ == "__main__":
    api = Api()
    api.window = webview.create_window(
        "Nada.exe",
        url=resource("nada.html"),
        js_api=api,
        width=600,
        height=560,
        frameless=True,
        easy_drag=False,
        background_color="#3fa6ef",
    )
    webview.start()
