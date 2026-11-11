from ursina import *

# 1. Configuración interna para evitar que el motor gráfico se congele al iniciar
from panda3d.core import load_prc_file_data
load_prc_file_data('', 'window-type window')
load_prc_file_data('', 'sync-video #f')        # Desactiva VSync por si bloquea el hilo principal
load_prc_file_data('', 'audio-library-name null') # Evita bloqueos de tarjeta de sonido si falla

app = Ursina()

window.color = color.rgb(150, 150, 20)
mouse.locked = False
mouse.visible = True

# Escenario y escritorio básicos
escenario = Entity(
    model='quad',
    color=color.rgb(60, 70, 90),
    scale=(4, 4),
    position=(0, 0, 6)
)

escritorio = Entity(
    model='quad',
    color=color.rgb(130, 80, 45),
    scale=(1.5, 1.5),
    position=(0, -0.7, 4.5)
)

camera.position = (0, 0, 0)
camera.fov = 75

def update():
    mx = clamp(mouse.x / 0.88, -1.0, 1.0)
    my = clamp(mouse.y / 0.50, -1.0, 1.0)

    camera.rotation_y = lerp(camera.rotation_y, mx * 30.0, time.dt * 7.0)
    camera.rotation_x = lerp(camera.rotation_x, -my * 8.0, time.dt * 7.0)
    camera.x = lerp(camera.x, mx * 0.5, time.dt * 7.0)

app.run()