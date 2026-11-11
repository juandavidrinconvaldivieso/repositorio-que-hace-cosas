"""Voice Changer: micro real -> efectos -> CABLE Input (VB-Cable) -> "CABLE Output" como micro en cualquier app."""
import json
import os
import tkinter as tk
import webbrowser
from collections import deque
from tkinter import messagebox, simpledialog, ttk

import numpy as np
import sounddevice as sd
from scipy.signal import butter, sosfilt

SR = 48000
BLOCK = 480  # 10 ms
AJUSTES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ajustes.json")
URL_CABLE = "https://vb-audio.com/Cable/"
STEAM = "STEAM STREAMING MICROPHONE"

DEFECTO = dict(pitch=0.0, formant=1.0, gate=-50.0, highpass=20.0, lowpass=20000.0, robot=0.0, robot_hz=70.0,
               drive=0.0, crush=16.0, echo=0.0, echo_t=0.3, reverb=0.0, volume=1.0)

PRESETS = {
    "Normal": {},
    "Mujer": dict(pitch=5, formant=1.15),
    "Hombre grave": dict(pitch=-4, formant=0.88),
    "Niño": dict(pitch=7, formant=1.25),
    "Ardilla": dict(pitch=12, formant=1.6),
    "Gigante": dict(pitch=-9, formant=0.65, reverb=0.15),
    "Demonio": dict(pitch=-7, formant=0.7, drive=0.35, reverb=0.3),
    "Robot": dict(robot=1.0, robot_hz=70),
    "Alien": dict(pitch=3, robot=0.6, robot_hz=400, reverb=0.2),
    "Radio": dict(highpass=500, lowpass=3500, drive=0.25),
    "Teléfono": dict(highpass=400, lowpass=2800, crush=9),
    "8-bit": dict(pitch=2, crush=5),
    "Cueva": dict(echo=0.4, echo_t=0.35, reverb=0.5),
    "Fantasma": dict(pitch=2, formant=1.1, reverb=0.7, echo=0.3, lowpass=4500),
}

SLIDERS = [  # clave, etiqueta, mín, máx
    ("pitch", "Tono (semitonos)", -12, 12),
    ("formant", "Timbre (grave - agudo)", 0.5, 2.0),
    ("robot", "Robot (mezcla)", 0, 1),
    ("robot_hz", "Robot (Hz)", 20, 800),
    ("drive", "Distorsión", 0, 1),
    ("crush", "Bits (16 = limpio)", 3, 16),
    ("echo", "Eco", 0, 0.9),
    ("echo_t", "Eco (segundos)", 0.05, 1.0),
    ("reverb", "Reverb", 0, 1),
    ("highpass", "Corte de graves (Hz)", 20, 1500),
    ("lowpass", "Corte de agudos (Hz)", 1000, 20000),
    ("gate", "Puerta de ruido (dB)", -80, -20),
    ("volume", "Volumen", 0, 2),
]


class PitchShifter:
    """Dos cabezales de lectura sobre una línea de retardo, en fundido cruzado."""
    L = 2048

    def __init__(self):
        self.buf = np.zeros(1 << 13)
        self.mask = len(self.buf) - 1
        self.w = 0
        self.ph = 0.0

    def _head(self, ph, n):
        pos = self.w + np.arange(n) - ph * self.L
        i = np.floor(pos).astype(np.int64)
        f = pos - i
        return (self.buf[i & self.mask] * (1 - f) + self.buf[(i + 1) & self.mask] * f) * np.sin(np.pi * ph) ** 2

    def process(self, x, ratio):
        n = len(x)
        self.buf[(self.w + np.arange(n)) & self.mask] = x
        if ratio != 1.0:
            ph = (self.ph + (1 - ratio) / self.L * np.arange(1, n + 1)) % 1.0
            y = self._head(ph, n) + self._head((ph + 0.5) % 1.0, n)
            self.ph = ph[-1]
        else:
            y = x
        self.w = (self.w + n) & self.mask
        return y


class FormantShifter:
    """Desplaza la envolvente espectral (cepstrum) sin tocar el tono."""
    N = BLOCK * 4
    LIFTER = 80

    def __init__(self):
        self.win = np.sqrt(0.5 - 0.5 * np.cos(2 * np.pi * np.arange(self.N) / self.N))
        self.inp = np.zeros(self.N)
        self.out = np.zeros(self.N)
        self.k = np.arange(self.N // 2 + 1, dtype=float)

    def process(self, x, warp):
        n = len(x)
        self.inp = np.r_[self.inp[n:], x]
        if abs(warp - 1.0) < 0.01:
            self.out[:] = 0
            return x
        X = np.fft.rfft(self.inp * self.win)
        cep = np.fft.irfft(np.log(np.abs(X) + 1e-9))
        cep[self.LIFTER:-self.LIFTER] = 0
        env = np.fft.rfft(cep).real
        nueva = np.interp(self.k / warp, self.k, env)
        self.out += np.fft.irfft(X * np.exp(np.clip(nueva - env, -2.5, 2.5))) * self.win
        y = self.out[:n] * 0.5
        self.out = np.r_[self.out[n:], np.zeros(n)]
        return y


class Delay:
    """Retardo con realimentación; el retardo debe ser >= tamaño de bloque."""

    def __init__(self, size):
        self.buf = np.zeros(size)
        self.w = 0

    def process(self, x, d, fb):
        idx = (self.w + np.arange(len(x))) % len(self.buf)
        y = self.buf[(idx - d) % len(self.buf)]
        self.buf[idx] = x + y * fb
        self.w = (self.w + len(x)) % len(self.buf)
        return y


class Efectos:
    def __init__(self):
        self.p = dict(DEFECTO)
        self.activo = True
        self.nivel = 0.0
        self.pitch = PitchShifter()
        self.formant = FormantShifter()
        self.eco = Delay(SR * 2)
        self.combs = [(Delay(4096), d) for d in (1694, 1760, 1623, 1548)]
        self.fase = 0.0
        self.puerta = 0.0
        self.filtros = {}

    def _filtro(self, x, tipo, hz):
        cortado = (tipo == "high" and hz <= 21) or (tipo == "low" and hz >= 19900)
        if cortado:
            self.filtros.pop(tipo, None)
            return x
        f = self.filtros.get(tipo)
        if f is None or f[0] != hz:
            f = self.filtros[tipo] = [hz, butter(2, hz, tipo, fs=SR, output="sos"), np.zeros((1, 2))]
        y, f[2] = sosfilt(f[1], x, zi=f[2])
        return y

    def process(self, x):
        """Un bloque mono float64 -> un bloque mono float64."""
        p = self.p
        n = len(x)
        self.nivel = float(np.sqrt(np.mean(x * x)))
        if not self.activo:
            return x
        db = 20 * np.log10(self.nivel + 1e-9)
        destino = 1.0 if db > p["gate"] else self.puerta * 0.8
        x = x * np.linspace(self.puerta, destino, n)
        self.puerta = destino

        ratio = 2.0 ** (p["pitch"] / 12.0)
        x = self.pitch.process(x, ratio)
        # El pitch arrastra el timbre; se compensa para que "formant" sea el desplazamiento total
        x = self.formant.process(x, p["formant"] / ratio)
        x = self._filtro(x, "high", p["highpass"])
        x = self._filtro(x, "low", p["lowpass"])
        if p["drive"] > 0:
            g = 1 + p["drive"] * 19
            x = np.tanh(x * g) / np.tanh(g) ** 0.5 / g ** 0.3
        if p["crush"] < 15.5:
            h = int(2 ** ((16 - p["crush"]) / 3))
            q = 2 ** (p["crush"] - 1)
            x = np.round(np.repeat(x[::h], h)[:n] * q) / q
        if p["robot"] > 0:
            t = 2 * np.pi * p["robot_hz"] / SR
            mod = np.sin(self.fase + t * np.arange(n))
            self.fase = (self.fase + t * n) % (2 * np.pi)
            x = x * (1 - p["robot"]) + x * mod * p["robot"]
        if p["echo"] > 0:
            x = x + self.eco.process(x, max(int(p["echo_t"] * SR), n), p["echo"])
        if p["reverb"] > 0:
            wet = sum(c.process(x, d, 0.84) for c, d in self.combs) / 4
            x = x + wet * p["reverb"]
        return np.clip(x * p["volume"], -1, 1)


class Salida:
    """Una salida de audio alimentada por el micro; absorbe la deriva entre relojes."""

    def __init__(self, disp, wasapi):
        self.q = deque()
        self.lista = False
        info = sd.query_devices(disp)
        self.ch = min(2, info["max_output_channels"])
        # El bucle de Steam devuelve la señal unas 30 veces más alta (medido)
        self.gan = 1 / 30 if STEAM in info["name"].upper() else 1.0
        self.s = sd.OutputStream(device=disp, samplerate=SR, blocksize=BLOCK, channels=self.ch, dtype="float32",
                                 latency="low", extra_settings=wasapi, callback=self._cb)
        self.s.start()

    def _cb(self, out, frames, t, status):
        while len(self.q) > 6:
            self.q.popleft()
        if not self.lista and len(self.q) >= 2:
            self.lista = True
        if self.lista and self.q:
            out[:] = self.q.popleft()[:, None] * self.gan
        else:
            self.lista = False
            out.fill(0)

    def cerrar(self):
        self.s.stop()
        self.s.close()


class Motor:
    def __init__(self):
        self.fx = Efectos()
        self.entrada = None
        self.salida = None
        self.monitor = None
        self.error = None

    def _wasapi(self):
        return sd.WasapiSettings(auto_convert=True) if os.name == "nt" and es_wasapi() else None

    def _cb(self, ind, frames, t, status):
        try:
            y = self.fx.process(ind.mean(axis=1).astype(np.float64)).astype(np.float32)
            self.salida.q.append(y)
            m = self.monitor
            if m:
                m.q.append(y)
        except Exception as e:
            self.error = str(e)

    def arrancar(self, mic, sal):
        self.parar()
        self.error = None
        self.salida = Salida(sal, self._wasapi())
        ch = min(2, sd.query_devices(mic)["max_input_channels"])
        self.entrada = sd.InputStream(device=mic, samplerate=SR, blocksize=BLOCK, channels=ch, dtype="float32",
                                      latency="low", extra_settings=self._wasapi(), callback=self._cb)
        self.entrada.start()

    def poner_monitor(self, on):
        m, self.monitor = self.monitor, None
        if m:
            m.cerrar()
        if on and self.entrada:
            self.monitor = Salida(sd.query_hostapis(api_idx())["default_output_device"], self._wasapi())

    def parar(self):
        self.poner_monitor(False)
        if self.entrada:
            self.entrada.stop()
            self.entrada.close()
            self.entrada = None
        if self.salida:
            self.salida.cerrar()
            self.salida = None


def api_idx():
    for i, a in enumerate(sd.query_hostapis()):
        if "WASAPI" in a["name"]:
            return i
    return sd.default.hostapi


def es_wasapi():
    return "WASAPI" in sd.query_hostapis(api_idx())["name"]


def dispositivos(clave):
    return {d["name"]: d["index"] for d in sd.query_devices() if d["hostapi"] == api_idx() and d[clave] > 0}


class App(tk.Tk):
    FONDO, PANEL, TEXTO, ACENTO = "#16161d", "#23232e", "#e8e8f0", "#7c5cff"

    def __init__(self):
        super().__init__()
        self.title("Voice Changer")
        self.configure(bg=self.FONDO)
        self.motor = Motor()
        self.aj = self._leer()
        self.presets = {**PRESETS, **self.aj.get("presets", {})}
        self.vars = {}
        self.cargando = False
        self._estilo()
        self._ui()
        self.protocol("WM_DELETE_WINDOW", self._cerrar)
        self.aplicar(self.aj.get("preset", "Normal"))
        self._tick()

    def _leer(self):
        try:
            with open(AJUSTES, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def _guardar(self):
        self.aj.update(mic=self.mic.get(), sal=self.sal.get(), preset=self.actual.get())
        with open(AJUSTES, "w", encoding="utf-8") as f:
            json.dump(self.aj, f, ensure_ascii=False, indent=1)

    def _estilo(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        s.configure(".", background=self.FONDO, foreground=self.TEXTO, fieldbackground=self.PANEL)
        s.configure("TButton", background=self.PANEL, padding=6, borderwidth=0)
        s.map("TButton", background=[("active", self.ACENTO)])
        s.configure("On.TButton", background=self.ACENTO, padding=8, font=("Segoe UI", 10, "bold"))
        s.map("TCombobox", fieldbackground=[("readonly", self.PANEL)], foreground=[("readonly", self.TEXTO)])
        s.map("TCheckbutton", background=[("active", self.FONDO)])
        s.configure("Horizontal.TProgressbar", background=self.ACENTO, troughcolor=self.PANEL, borderwidth=0)

    def _ui(self):
        arriba = ttk.Frame(self, padding=10)
        arriba.pack(fill="x")
        mics = [n for n in dispositivos("max_input_channels") if "CABLE" not in n.upper() and STEAM not in n.upper()]
        sals = list(dispositivos("max_output_channels"))
        cable = next((n for n in sals if "CABLE INPUT" in n.upper()), None) or next((n for n in sals if STEAM in n.upper()), None)
        self.mic = tk.StringVar(value=self.aj.get("mic") if self.aj.get("mic") in mics else (mics[0] if mics else ""))
        self.sal = tk.StringVar(value=cable or self.aj.get("sal") or (sals[0] if sals else ""))
        for fila, (txt, var, vals) in enumerate((("Micrófono", self.mic, mics), ("Salida", self.sal, sals))):
            ttk.Label(arriba, text=txt).grid(row=fila, column=0, sticky="w", padx=(0, 8), pady=2)
            ttk.Combobox(arriba, textvariable=var, values=vals, state="readonly", width=52).grid(row=fila, column=1, columnspan=3, sticky="ew", pady=2)

        self.btn = ttk.Button(arriba, text="▶ Iniciar", style="On.TButton", command=self.alternar)
        self.btn.grid(row=2, column=0, pady=(8, 0), sticky="w")
        self.activo = tk.BooleanVar(value=True)
        ttk.Checkbutton(arriba, text="Efectos activos", variable=self.activo, command=self._activo).grid(row=2, column=1, sticky="w", pady=(8, 0))
        self.mon = tk.BooleanVar(value=False)
        ttk.Checkbutton(arriba, text="Escucharme (con cascos)", variable=self.mon, command=self._monitor).grid(row=2, column=2, sticky="w", pady=(8, 0))
        self.barra = ttk.Progressbar(arriba, maximum=1.0)
        self.barra.grid(row=3, column=0, columnspan=4, sticky="ew", pady=(8, 0))
        self.estado = tk.StringVar()
        ttk.Label(arriba, textvariable=self.estado, wraplength=520).grid(row=4, column=0, columnspan=4, sticky="w", pady=(6, 0))
        if not cable:
            self.estado.set("Falta el micro virtual: instala VB-Cable, reinicia el PC y vuelve a abrir la app.")
            ttk.Button(arriba, text="Descargar VB-Cable", command=lambda: webbrowser.open(URL_CABLE)).grid(row=2, column=3, pady=(8, 0), sticky="e")

        self.actual = tk.StringVar(value="Normal")
        self.caja = ttk.Frame(self, padding=(10, 0))
        self.caja.pack(fill="x")
        self._botones()

        cuerpo = ttk.Frame(self, padding=10)
        cuerpo.pack(fill="both", expand=True)
        cuerpo.columnconfigure(1, weight=1)
        for f, (k, txt, a, b) in enumerate(SLIDERS):
            var = tk.DoubleVar(value=DEFECTO[k])
            self.vars[k] = var
            ttk.Label(cuerpo, text=txt).grid(row=f, column=0, sticky="w", padx=(0, 8))
            ttk.Scale(cuerpo, from_=a, to=b, variable=var).grid(row=f, column=1, sticky="ew", pady=1)
            lbl = ttk.Label(cuerpo, width=7, anchor="e")
            lbl.grid(row=f, column=2)
            var.trace_add("write", lambda *_, v=var, l=lbl: self._cambio(v, l))
            self._cambio(var, lbl)
        pie = ttk.Frame(self, padding=(10, 0, 10, 10))
        pie.pack(fill="x")
        ttk.Button(pie, text="Guardar preset", command=self._guardar_preset).pack(side="left")
        ttk.Button(pie, text="Borrar preset", command=self._borrar_preset).pack(side="left", padx=6)

    def _botones(self):
        for w in self.caja.winfo_children():
            w.destroy()
        for i, nombre in enumerate(self.presets):
            ttk.Button(self.caja, text=nombre, command=lambda n=nombre: self.aplicar(n)).grid(row=i // 5, column=i % 5, sticky="ew", padx=2, pady=2)
        for c in range(5):
            self.caja.columnconfigure(c, weight=1, uniform="p")

    def _cambio(self, var, lbl):
        lbl.config(text=f"{var.get():.2f}")
        if not self.cargando and len(self.vars) == len(SLIDERS):
            self.motor.fx.p = {k: v.get() for k, v in self.vars.items()}

    def aplicar(self, nombre):
        if nombre not in self.presets:
            nombre = "Normal"
        self.actual.set(nombre)
        p = {**DEFECTO, **self.presets[nombre]}
        self.cargando = True
        for k, v in self.vars.items():
            v.set(p[k])
        self.cargando = False
        self.motor.fx.p = p
        self.title(f"Voice Changer - {nombre}")

    def _guardar_preset(self):
        n = simpledialog.askstring("Guardar preset", "Nombre:", parent=self)
        if n:
            p = {k: v.get() for k, v in self.vars.items()}
            self.presets[n] = p
            self.aj.setdefault("presets", {})[n] = p
            self.actual.set(n)
            self._guardar()
            self._botones()

    def _borrar_preset(self):
        n = self.actual.get()
        if n in self.aj.get("presets", {}):
            del self.aj["presets"][n]
            self.presets = {**PRESETS, **self.aj["presets"]}
            self._guardar()
            self._botones()
            self.aplicar("Normal" if n not in PRESETS else n)
        else:
            messagebox.showinfo("Borrar preset", "Solo se pueden borrar los presets que has guardado tú.")

    def _activo(self):
        self.motor.fx.activo = self.activo.get()

    def _monitor(self):
        try:
            self.motor.poner_monitor(self.mon.get())
        except Exception as e:
            self.mon.set(False)
            self.estado.set(f"No se pudo activar la escucha: {e}")

    def alternar(self):
        if self.motor.entrada:
            self.motor.parar()
            self.btn.config(text="▶ Iniciar")
            self.estado.set("Parado.")
            return
        try:
            self.motor.arrancar(dispositivos("max_input_channels")[self.mic.get()],
                                dispositivos("max_output_channels")[self.sal.get()])
            self._monitor()
            self.btn.config(text="■ Parar")
            if "CABLE" in self.sal.get().upper():
                self.estado.set('Funcionando. En tu app elige como micrófono: "CABLE Output".')
            elif STEAM in self.sal.get().upper():
                self.estado.set('Funcionando. En tu app elige como micrófono: "Steam Streaming Microphone".')
            else:
                self.estado.set("Funcionando, pero la salida no es un micro virtual: las apps no recibirán esta voz.")
            self._guardar()
        except Exception as e:
            self.motor.parar()
            self.estado.set(f"No se pudo iniciar: {e}")

    def _tick(self):
        self.barra["value"] = min(1.0, self.motor.fx.nivel * 4)
        if self.motor.error:
            self.estado.set(f"Error de audio: {self.motor.error}")
        self.after(80, self._tick)

    def _cerrar(self):
        self.motor.parar()
        self._guardar()
        self.destroy()


if __name__ == "__main__":
    App().mainloop()
