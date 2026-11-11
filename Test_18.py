import sys
import ctypes
from ctypes import wintypes
import numpy as np
import pygame
from pygame.locals import *
from OpenGL.GL import *
from OpenGL.GL.shaders import compileProgram, compileShader

# --- CONSTANTES DE LA API DE WINDOWS ---
GWL_EXSTYLE = -20
GWLP_WNDPROC = -4
WS_EX_LAYERED = 0x00080000
WS_EX_TOOLWINDOW = 0x00000080
WS_EX_APPWINDOW = 0x00040000
LWA_COLORKEY = 0x00000001
HWND_TOPMOST = -1
SWP_NOSIZE = 0x0001

WM_SYSCOMMAND = 0x0112
SC_MOVE = 0xF010
SC_MINIMIZE = 0xF020
HTCAPTION = 0x0002

VK_ESCAPE = 0x1B

user32 = ctypes.windll.user32

def tecla_presionada(vk_code):
    return user32.GetAsyncKeyState(vk_code) & 0x8000 != 0

# --- SUBCLASE DE VENTANA: intercepta mensajes de Windows antes que la ventana ---
WNDPROCTYPE = ctypes.WINFUNCTYPE(ctypes.c_long, wintypes.HWND, ctypes.c_uint,
                                  wintypes.WPARAM, wintypes.LPARAM)

wndproc_original = None
wndproc_nuevo_ref = None  # hay que mantener esta referencia viva, si no Python la recolecta

def wnd_proc_personalizado(hwnd, msg, wparam, lparam):
    # Filtramos especificamente el comando de minimizar (usado por "Mostrar
    # escritorio" / Win+D) y lo ignoramos; todo lo demas sigue funcionando normal
    if msg == WM_SYSCOMMAND and (wparam & 0xFFF0) == SC_MINIMIZE:
        return 0
    return user32.CallWindowProcW(wndproc_original, hwnd, msg, wparam, lparam)

# --- SHADERS GLSL ---

VERTEX_SHADER = """
#version 330 core
in vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
"""

FRAGMENT_SHADER = """
#version 330 core
out vec4 FragColor;

uniform vec2 u_resolution;
uniform float u_time;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.x *= u_resolution.x / u_resolution.y;

    vec2 centro = vec2(0.5, 0.5);
    float expansion = smoothstep(0.0, 3.0, u_time);

    vec2 p1 = centro + expansion * vec2(0.45 * cos(u_time * 0.4), 0.45 * sin(u_time * 0.4));
    vec2 p2 = centro + expansion * vec2(0.5 * cos(u_time * 0.3 + 1.0), 0.5 * sin(u_time * 0.3 + 1.0));
    vec2 p3 = centro + expansion * vec2(0.4 * cos(u_time * 0.25 + 2.2), 0.4 * sin(u_time * 0.25 + 2.2));
    vec2 p4 = centro + expansion * vec2(0.55 * cos(u_time * 0.35 + 3.4), 0.55 * sin(u_time * 0.35 + 3.4));
    vec2 p5 = centro + expansion * vec2(0.48 * cos(u_time * 0.22 + 0.5), 0.48 * sin(u_time * 0.22 + 0.5));
    vec2 p6 = centro + expansion * vec2(0.42 * cos(u_time * 0.4 + 4.1), 0.42 * sin(u_time * 0.4 + 4.1));
    vec2 p7 = centro + expansion * vec2(0.5 * cos(u_time * 0.28 + 5.3), 0.5 * sin(u_time * 0.28 + 5.3));
    vec2 p8 = centro + expansion * vec2(0.38 * cos(u_time * 0.33 + 1.8), 0.38 * sin(u_time * 0.33 + 1.8));

    float d = 0.0;
    d += 0.01 / distance(uv, p1);
    d += 0.015 / distance(uv, p2);
    d += 0.0125 / distance(uv, p3);
    d += 0.0175 / distance(uv, p4);
    d += 0.014 / distance(uv, p5);
    d += 0.011 / distance(uv, p6);
    d += 0.015 / distance(uv, p7);
    d += 0.012 / distance(uv, p8);

    vec3 backgroundColor = vec3(0.0, 0.0, 0.0);
    vec3 lavaColor = vec3(0.0, 1.0, 0.2);

    float edge = smoothstep(0.48, 0.52, d);
    vec3 finalColor = mix(backgroundColor, lavaColor, edge);
    finalColor += lavaColor * smoothstep(0.3, 0.6, d) * 0.3;

    FragColor = vec4(finalColor, 1.0);
}
"""

def main():
    global wndproc_original, wndproc_nuevo_ref

    pygame.init()

    screen_size = 300
    screen_width = screen_size
    screen_height = screen_size

    pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MAJOR_VERSION, 3)
    pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MINOR_VERSION, 3)
    pygame.display.gl_set_attribute(pygame.GL_CONTEXT_PROFILE_MASK, pygame.GL_CONTEXT_PROFILE_CORE)

    screen = pygame.display.set_mode((screen_width, screen_height), DOUBLEBUF | OPENGL | NOFRAME)
    pygame.display.set_caption("Lampara de Lava GLSL")
    clock = pygame.time.Clock()

    hwnd = pygame.display.get_wm_info()["window"]

    # --- TRANSPARENCIA POR COLOR-KEY + QUITAR ICONO DE LA BARRA DE TAREAS ---
    estilo_ex_actual = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
    nuevo_estilo_ex = (estilo_ex_actual | WS_EX_LAYERED | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW
    user32.SetWindowLongW(hwnd, GWL_EXSTYLE, nuevo_estilo_ex)
    user32.SetLayeredWindowAttributes(hwnd, 0x000000, 0, LWA_COLORKEY)

    # --- SIEMPRE VISIBLE POR ENCIMA ---
    user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOSIZE)

    # --- INSTALAR LA SUBCLASE DE VENTANA (bloquea SC_MINIMIZE) ---
    wndproc_nuevo_ref = WNDPROCTYPE(wnd_proc_personalizado)
    wndproc_original = user32.SetWindowLongPtrW(hwnd, GWLP_WNDPROC, wndproc_nuevo_ref)

    # --- COMPILACIÓN DEL SHADER ---
    try:
        shader = compileProgram(
            compileShader(VERTEX_SHADER, GL_VERTEX_SHADER),
            compileShader(FRAGMENT_SHADER, GL_FRAGMENT_SHADER)
        )
    except Exception as e:
        print(f"Error al compilar el shader: {e}")
        pygame.quit()
        sys.exit()

    vertices = [
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0
    ]

    vertex_data = np.array(vertices, dtype=np.float32)

    vao = glGenVertexArrays(1)
    glBindVertexArray(vao)

    vbo = glGenBuffers(1)
    glBindBuffer(GL_ARRAY_BUFFER, vbo)
    glBufferData(GL_ARRAY_BUFFER, vertex_data.nbytes, vertex_data, GL_STATIC_DRAW)

    position_loc = glGetAttribLocation(shader, "position")
    glEnableVertexAttribArray(position_loc)
    glVertexAttribPointer(position_loc, 2, GL_FLOAT, GL_FALSE, 0, None)

    u_resolution_loc = glGetUniformLocation(shader, "u_resolution")
    u_time_loc = glGetUniformLocation(shader, "u_time")

    # --- BUCLE PRINCIPAL ---
    running = True
    while running:
        for evento in pygame.event.get():
            if evento.type == pygame.QUIT:
                running = False
            elif evento.type == pygame.MOUSEBUTTONDOWN:
                if evento.button == 1:
                    user32.ReleaseCapture()
                    user32.SendMessageW(hwnd, WM_SYSCOMMAND, SC_MOVE | HTCAPTION, 0)

        if tecla_presionada(VK_ESCAPE):
            running = False

        glClearColor(0.0, 0.0, 0.0, 1.0)
        glClear(GL_COLOR_BUFFER_BIT)

        glUseProgram(shader)
        glUniform2f(u_resolution_loc, float(screen_width), float(screen_height))

        current_time = pygame.time.get_ticks() / 1000.0
        glUniform1f(u_time_loc, current_time)

        glBindVertexArray(vao)
        glDrawArrays(GL_TRIANGLES, 0, 6)

        pygame.display.flip()
        clock.tick(60)

    glDeleteBuffers(1, [vbo])
    glDeleteVertexArrays(1, [vao])
    glDeleteProgram(shader)
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()