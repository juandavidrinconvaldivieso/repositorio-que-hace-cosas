"""
Generador de habitaciones interconectadas por andamios (Blender 4.x)

Uso:  Blender > pestaña Scripting > Abrir este archivo > Run Script (Alt+P)
      Cada vez que lo ejecutes borra el laberinto anterior y genera uno nuevo.
      Los materiales LAB_* se conservan entre ejecuciones, así que lo que
      texturices a mano no se pierde al regenerar.

Ligero: todas las piezas iguales comparten la MISMA malla (duplicados enlazados),
así que 40 habitaciones pesan casi lo mismo que una.

Fácil de texturizar: solo hay 5 materiales (LAB_Andamio, LAB_Escalon, LAB_Piso,
LAB_Pared, LAB_Techo) y todas las mallas tienen UVs proyectadas en caja a escala
real (1 repetición de textura = ESCALA_UV metros), así que una textura repetible
se ve igual de tamaño en todas las piezas sin desenvolver nada.
"""
import bpy
import bmesh
import math
import os
import random
from mathutils import Matrix, Vector

# ============================ CONFIGURACIÓN ============================
RUTA_ANDAMIO = r"D:\DATOS\Downloads\andamio Base.glb"
SEMILLA = None             # pon un número (ej. 42) para repetir el mismo laberinto

GRID_X, GRID_Y = 7, 7      # celdas en planta
NIVELES = 4                # pisos posibles
NUM_HABITACIONES = 30

TAM_HABITACION = 10.0      # lado de la habitación (m)
ALTO_PARED = 4.0
ALTO_NIVEL = 5.5           # desnivel que sube cada escalera
GROSOR = 0.2               # grosor de pisos/paredes/techo
ALTO_PUERTA = 2.6
CON_TECHO = True

PROB_ESCALERA = 0.35       # probabilidad de que una conexión nueva sea escalera
PROB_BUCLE = 0.25          # conexiones extra entre vecinas (más interconexión)
PROB_SIN_SALIDA = 0.18     # por cada pared libre: andamio que no lleva a nada

ESCALA_UV = 2.0            # metros que ocupa una repetición de la textura
# Ruta a una imagen para cada material (vacío = dejar el material como esté)
TEXTURAS = {
    "Andamio": r"",
    "Escalon": r"",
    "Piso": r"",
    "Pared": r"",
    "Techo": r"",
}
# =======================================================================

COLECCION = "Laberinto"
PREF = "LAB_"
COLORES = {
    "Andamio": (0.33, 0.35, 0.38, 1.0),
    "Escalon": (0.28, 0.22, 0.16, 1.0),
    "Piso": (0.45, 0.42, 0.38, 1.0),
    "Pared": (0.72, 0.70, 0.65, 1.0),
    "Techo": (0.55, 0.55, 0.55, 1.0),
}
DIRS = [(0, 1), (1, 0), (0, -1), (-1, 0)]
ROT = {(0, 1): 0.0, (1, 0): -math.pi / 2, (0, -1): math.pi, (-1, 0): math.pi / 2}


# ----------------------------- utilidades -----------------------------
def limpiar():
    col = bpy.data.collections.get(COLECCION)
    if col:
        for o in list(col.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for c in list(col.children_recursive):
            bpy.data.collections.remove(c)
        bpy.data.collections.remove(col)
    for m in list(bpy.data.meshes):
        if m.name.startswith(PREF) and m.users == 0:
            bpy.data.meshes.remove(m)


def material(nombre):
    m = bpy.data.materials.get(PREF + nombre)
    if m is None:
        m = bpy.data.materials.new(PREF + nombre)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = COLORES[nombre]
        m.diffuse_color = COLORES[nombre]
        if nombre == "Andamio":
            bsdf.inputs["Metallic"].default_value = 0.8
            bsdf.inputs["Roughness"].default_value = 0.45
    ruta = TEXTURAS.get(nombre)
    if ruta and os.path.isfile(ruta):
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        img = nt.nodes.get("LAB_Textura")
        if img is None:
            tc = nt.nodes.new("ShaderNodeTexCoord")
            mp = nt.nodes.new("ShaderNodeMapping")
            img = nt.nodes.new("ShaderNodeTexImage")
            img.name = "LAB_Textura"
            tc.location, mp.location, img.location = (-800, 300), (-600, 300), (-350, 300)
            nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
            nt.links.new(mp.outputs["Vector"], img.inputs["Vector"])
            nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
        img.image = bpy.data.images.load(ruta, check_existing=True)
    return m


def caja(bm, x0, x1, y0, y1, z0, z1, mat=0):
    v = [bm.verts.new(c) for c in (
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in idx]).material_index = mat


def uv_caja(bm):
    """Proyección en caja a escala del mundo: misma densidad de textura en todo."""
    bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        eje = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co
            if eje == 0:
                u, v = c.y * (1 if n.x > 0 else -1), c.z
            elif eje == 1:
                u, v = c.x * (-1 if n.y > 0 else 1), c.z
            else:
                u, v = c.x, c.y
            l[uv].uv = (u / ESCALA_UV, v / ESCALA_UV)


def bm_a_malla(bm, nombre, mats):
    uv_caja(bm)
    me = bpy.data.meshes.new(PREF + nombre)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    return me


# ------------------------------ piezas ------------------------------
def cargar_andamio():
    """Devuelve (bmesh normalizado, largo, ancho, medio_ancho_interior).
    Normalizado: largo sobre +Y desde y=0, centrado en X, piso superior en z=0."""
    verts, caras = [], []
    if os.path.isfile(RUTA_ANDAMIO):
        objs_antes, mallas_antes = set(bpy.data.objects), set(bpy.data.meshes)
        mats_antes = set(bpy.data.materials)
        bpy.ops.import_scene.gltf(filepath=RUTA_ANDAMIO)
        nuevos = [o for o in bpy.data.objects if o not in objs_antes]
        for o in nuevos:
            if o.type == 'MESH':
                off, mw = len(verts), o.matrix_world
                verts += [mw @ v.co for v in o.data.vertices]
                caras += [[off + i for i in p.vertices] for p in o.data.polygons]
        for o in nuevos:
            bpy.data.objects.remove(o, do_unlink=True)
        for m in set(bpy.data.meshes) - mallas_antes:
            if m.users == 0:
                bpy.data.meshes.remove(m)
        for m in set(bpy.data.materials) - mats_antes:
            if m.users == 0:
                bpy.data.materials.remove(m)
    bm = bmesh.new()
    if verts:
        bv = [bm.verts.new(v) for v in verts]
        for c in caras:
            try:
                bm.faces.new([bv[i] for i in c])
            except ValueError:
                pass
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    else:
        print("No se encontró el andamio base, uso uno procedural igual.")
        caja(bm, -1.0, -0.8, 0, 11, -0.2, 1.8)
        caja(bm, 0.8, 1.0, 0, 11, -0.2, 1.8)
        caja(bm, -0.8, 0.8, 0, 11, -0.2, 0.0)

    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    if max(xs) - min(xs) > max(ys) - min(ys):
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                         matrix=Matrix.Rotation(math.pi / 2, 3, 'Z'))
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    cx = (min(xs) + max(xs)) / 2
    ancho = max(xs) - min(xs)
    eps = ancho * 1e-3
    interiores = [v.co.z for v in bm.verts if min(xs) + eps < v.co.x < max(xs) - eps]
    piso = min(interiores) if interiores else min(zs)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(-cx, -min(ys), -piso))
    largo = max(ys) - min(ys)
    altos = [abs(v.co.x) for v in bm.verts if v.co.z > 0.05]
    interior = min(altos) if altos and min(altos) > 0.01 else ancho * 0.4
    for f in bm.faces:
        f.material_index = 0
    return bm, largo, ancho, interior


def malla_escalera(base, largo, interior, mats):
    """El andamio inclinado (sube ALTO_NIVEL a lo largo de su largo) + peldaños."""
    bm = base.copy()
    for v in bm.verts:
        v.co.z += v.co.y / largo * ALTO_NIVEL
    n = math.ceil(ALTO_NIVEL / 0.2)  # contrahuella <= grosor del piso: no atraviesa
    sube, huella = ALTO_NIVEL / n, largo / n
    for i in range(n):
        caja(bm, -interior, interior, i * huella, (i + 1) * huella,
             i * sube, (i + 1) * sube, mat=1)
    return bm_a_malla(bm, "Andamio_Escalera", mats)


def malla_pared(largo, ancho_puerta, puerta, mats):
    bm = bmesh.new()
    h, a = ALTO_PARED, ancho_puerta / 2
    if puerta:
        caja(bm, -largo / 2, -a, -GROSOR, 0, 0, h)
        caja(bm, a, largo / 2, -GROSOR, 0, 0, h)
        caja(bm, -a, a, -GROSOR, 0, ALTO_PUERTA, h)
    else:
        caja(bm, -largo / 2, largo / 2, -GROSOR, 0, 0, h)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    nombre = "Pared_%s_%s" % ("Larga" if largo >= TAM_HABITACION else "Corta",
                              "Puerta" if puerta else "Lisa")
    return bm_a_malla(bm, nombre, mats)


def malla_losa(nombre, z0, mats):
    bm = bmesh.new()
    r = TAM_HABITACION / 2
    caja(bm, -r, r, -r, r, z0, z0 + GROSOR)
    return bm_a_malla(bm, nombre, mats)


# ----------------------------- generación -----------------------------
def hueco(c, d):
    """Clave del espacio entre dos celdas vecinas (donde va el andamio)."""
    x, y = c[0], c[1]
    if d[0]:
        return ('x', min(x, x + d[0]), y)
    return ('y', x, min(y, y + d[1]))


def generar_grafo(rng):
    inicio = (GRID_X // 2, GRID_Y // 2, NIVELES // 2)
    habit = {inicio}
    puertas = {}        # celda -> set(direcciones con puerta)
    ocupado = set()     # (hueco, nivel) usados por andamios
    conexiones = []     # (tipo, celda_base, dir)  tipo: recto/escalera/roto
    sin_salida = []

    def dentro(c):
        return 0 <= c[0] < GRID_X and 0 <= c[1] < GRID_Y and 0 <= c[2] < NIVELES

    def slots(a, d, dz):
        z = a[2]
        return {(hueco(a, d), z), (hueco(a, d), z + dz)}

    def libre(a, d, dz):
        return d not in puertas.get(a, ()) and not (slots(a, d, dz) & ocupado)

    def unir(a, b, d, dz):
        ocupado.update(slots(a, d, dz))
        puertas.setdefault(a, set()).add(d)
        puertas.setdefault(b, set()).add((-d[0], -d[1]))
        if dz == 0:
            conexiones.append(("recto", a, d))
        elif dz > 0:
            conexiones.append(("escalera", a, d))
        else:
            conexiones.append(("escalera", b, (-d[0], -d[1])))

    # árbol creciente: garantiza que todas las habitaciones estén conectadas
    activos = [inicio]
    while activos and len(habit) < NUM_HABITACIONES:
        a = activos[-1] if rng.random() < 0.5 else rng.choice(activos)
        quiere_escalera = rng.random() < PROB_ESCALERA
        movs = [(d, dz) for d in DIRS for dz in (-1, 0, 1)]
        rng.shuffle(movs)
        movs.sort(key=lambda m: (m[1] != 0) != quiere_escalera)
        for d, dz in movs:
            b = (a[0] + d[0], a[1] + d[1], a[2] + dz)
            if dentro(b) and b not in habit and libre(a, d, dz):
                habit.add(b)
                activos.append(b)
                unir(a, b, d, dz)
                break
        else:
            activos.remove(a)

    # bucles: conexiones extra entre habitaciones ya existentes
    for a in sorted(habit):
        for d in DIRS:
            for dz in (0, 1):
                b = (a[0] + d[0], a[1] + d[1], a[2] + dz)
                if (b in habit and rng.random() < PROB_BUCLE and libre(a, d, dz)
                        and (-d[0], -d[1]) not in puertas.get(b, ())):
                    unir(a, b, d, dz)

    # andamios que no llevan a nada
    for a in sorted(habit):
        for d in DIRS:
            if d in puertas.get(a, ()) or rng.random() >= PROB_SIN_SALIDA:
                continue
            tipo = rng.choice(["recto", "roto", "sube", "baja"])
            dz = {"sube": 1, "baja": -1}.get(tipo, 0)
            destino = (a[0] + d[0], a[1] + d[1], a[2] + dz)
            if destino in habit or not libre(a, d, dz):
                continue
            ocupado.update(slots(a, d, dz))
            puertas.setdefault(a, set()).add(d)
            if tipo == "baja":
                sin_salida.append(("escalera", destino, (-d[0], -d[1])))
            elif tipo == "sube":
                sin_salida.append(("escalera", a, d))
            else:
                sin_salida.append((tipo, a, d))
    return inicio, habit, puertas, conexiones, sin_salida


def construir():
    rng = random.Random(SEMILLA)
    limpiar()
    raiz = bpy.data.collections.new(COLECCION)
    bpy.context.scene.collection.children.link(raiz)
    cols = {}
    for n in ("Habitaciones", "Andamios", "Escaleras", "Sin_Salida"):
        cols[n] = bpy.data.collections.new(PREF + n)
        raiz.children.link(cols[n])

    m = {k: material(k) for k in COLORES}
    base, largo, ancho, interior = cargar_andamio()

    roto = base.copy()
    for v in roto.verts:
        v.co.y *= 0.55
    mallas = {
        "escalera": malla_escalera(base.copy(), largo, interior, [m["Andamio"], m["Escalon"]]),
        "roto": bm_a_malla(roto, "Andamio_Roto", [m["Andamio"]]),
        "recto": bm_a_malla(base, "Andamio_Recto", [m["Andamio"]]),
    }
    corto = TAM_HABITACION - 2 * GROSOR
    paredes = {
        (True, False): malla_pared(TAM_HABITACION, ancho, False, [m["Pared"]]),
        (True, True): malla_pared(TAM_HABITACION, ancho, True, [m["Pared"]]),
        (False, False): malla_pared(corto, ancho, False, [m["Pared"]]),
        (False, True): malla_pared(corto, ancho, True, [m["Pared"]]),
    }
    piso = malla_losa("Piso", -GROSOR, [m["Piso"]])
    techo = malla_losa("Techo", ALTO_PARED, [m["Techo"]]) if CON_TECHO else None

    inicio, habit, puertas, conexiones, sin_salida = generar_grafo(rng)
    paso = TAM_HABITACION + largo

    def centro(c):
        return Vector(((c[0] - (GRID_X - 1) / 2) * paso,
                       (c[1] - (GRID_Y - 1) / 2) * paso,
                       c[2] * ALTO_NIVEL))

    def poner(me, nombre, pos, rot, col):
        o = bpy.data.objects.new(nombre, me)
        o.location = pos
        o.rotation_euler = (0, 0, rot)
        col.objects.link(o)
        return o

    for c in sorted(habit):
        nom = "Hab_%d_%d_%d%s" % (c + ("_INICIO" if c == inicio else "",))
        p = centro(c)
        poner(piso, nom + "_Piso", p, 0, cols["Habitaciones"])
        if techo:
            poner(techo, nom + "_Techo", p, 0, cols["Habitaciones"])
        for d in DIRS:
            larga = d[0] == 0
            me = paredes[(larga, d in puertas.get(c, ()))]
            pos = p + Vector((d[0], d[1], 0)) * (TAM_HABITACION / 2)
            poner(me, nom + "_Pared", pos, ROT[d], cols["Habitaciones"])

    for lista, col_recto in ((conexiones, "Andamios"), (sin_salida, "Sin_Salida")):
        for tipo, c, d in lista:
            pos = centro(c) + Vector((d[0], d[1], 0)) * (TAM_HABITACION / 2)
            col = cols["Escaleras"] if (tipo == "escalera" and lista is conexiones) else cols[col_recto]
            poner(mallas[tipo], "Andamio_" + tipo.capitalize(), pos, ROT[d], col)

    if not any(o.type == 'LIGHT' for o in bpy.context.scene.objects):
        sol = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", 'SUN'))
        sol.data.energy = 3.0
        sol.rotation_euler = (math.radians(50), 0, math.radians(30))
        raiz.objects.link(sol)

    print("Laberinto: %d habitaciones, %d conexiones (%d escaleras), %d sin salida" % (
        len(habit), len(conexiones),
        sum(1 for t, _, _ in conexiones if t == "escalera"), len(sin_salida)))


construir()
