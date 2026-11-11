"""
Andamios liminales (Blender 4.2 - 5.1) - sin habitaciones.

Recorridos aleatorios de tu andamio: cada tramo sale desde donde terminó el
anterior, con un largo al azar, y gira, sube o baja por escaleras. No hay una
rejilla global; aun así todo encaja (nada se atraviesa ni se pega). Lo que no
conecta con nada queda cerrado con barandas y tapas. Niebla densa estilo PS1.

USO
  1. Blender > Scripting > abrir este archivo > Run Script (Alt+P).
  2. En la vista 3D pulsa N > pestaña "Liminal".
  3. Ajusta lo que quieras y pulsa "Generar" (o "Generar nuevo" para otra semilla).
     La niebla y la luz se actualizan al momento, sin regenerar.
  Para que el panel aparezca solo al abrir el .blend: en el editor de texto,
  menú Text > marca "Register".
  Para exportar (.glb/.fbx): selecciona los objetos LIM_* y aplica el
  modificador "Instancias" (Ctrl+A > Visual Geometry to Mesh).

Ligero aunque sea enorme: cada tipo de pieza es UN solo objeto que reparte
copias con Geometry Nodes (instancias), en vez de miles de objetos.
"""
import bpy
import bmesh
import math
import os
import random
from collections import defaultdict
from bpy.props import (BoolProperty, EnumProperty, FloatProperty,
                       FloatVectorProperty, IntProperty, PointerProperty,
                       StringProperty)
from mathutils import Matrix, Vector

COLECCION = "Liminal"
PREF = "LIM_"
COLORES = {
    "Andamio": (0.80, 0.77, 0.66, 1.0),
    "Escalon": (0.62, 0.58, 0.48, 1.0),
    "Plataforma": (0.74, 0.71, 0.60, 1.0),
    "Pilar": (0.70, 0.68, 0.62, 1.0),
}
DIRS = [(0, 1), (1, 0), (0, -1), (-1, 0)]
ROT = {(0, 1): 0.0, (1, 0): -math.pi / 2, (0, -1): math.pi, (-1, 0): math.pi / 2}
HOLGURA = 0.5  # espacio libre mínimo (m) entre lo alto de una pared y el piso de arriba


# ============================== AJUSTES (panel) ==============================
def _upd_niebla(self, context):
    actualizar_niebla(self, context.scene)


def _upd_luz(self, context):
    mundo(self, context.scene)


def _upd_pixelado(self, context):
    pixelado(self, context.scene)


def _upd_poligonal(self, context):
    grupo_instancias(self)
    actualizar_niebla(self, context.scene)


class LIM_Ajustes(bpy.types.PropertyGroup):
    # --- general ---
    ruta_andamio: StringProperty(
        name="Andamio base", subtype='FILE_PATH',
        default=r"D:\DATOS\Downloads\andamio Base.glb",
        description="Modelo .glb del andamio. Si no existe se usa uno igual hecho por código")
    semilla: IntProperty(
        name="Semilla", default=1, min=0,
        description="Mismo número = mismo resultado. 'Generar nuevo' elige otra")
    # --- tamaño ---
    forma: EnumProperty(
        name="Forma", default='CIRCULO',
        items=[('CIRCULO', "Círculo", "Área redonda"),
               ('CUADRADO', "Cuadrado", "Área cuadrada"),
               ('ANILLO', "Anillo", "Redonda con un hueco vacío en el centro")])
    extension: FloatProperty(
        name="Radio", default=160.0, min=20.0, max=3000.0, unit='LENGTH',
        description="Tamaño del área desde el centro")
    niveles: IntProperty(
        name="Pisos", default=18, min=1, max=300,
        description="Cuántas alturas distintas hay")
    pisos_sueltos: IntProperty(
        name="Pisos sueltos", default=0, min=0, max=300,
        description="Pisos sin ninguna escalera hacia arriba ni hacia abajo: existen, "
                    "pero no se puede llegar a ellos desde el resto")
    alto_nivel: FloatProperty(
        name="Altura por piso", default=4.0, min=1.0, max=30.0, unit='LENGTH',
        description="Desnivel que sube cada escalera. Si es menor que la altura del "
                    "andamio + holgura se sube solo para que nada choque")
    # --- recorridos ---
    recorridos_por_piso: IntProperty(
        name="Densidad", default=8, min=1, max=500,
        description="Recorridos aleatorios por piso (para un radio de 160 m; "
                    "se escala solo con el área)")
    pasos: IntProperty(
        name="Tramos por recorrido", default=40, min=1, max=1000,
        description="Cuántos andamios seguidos puede poner cada recorrido")
    tramo_min: FloatProperty(name="Largo mínimo", default=4.0, min=2.0, max=500.0,
                             unit='LENGTH')
    tramo_max: FloatProperty(name="Largo máximo", default=24.0, min=2.0, max=500.0,
                             unit='LENGTH')
    prob_recto: FloatProperty(
        name="Seguir recto", default=0.55, min=0.0, max=1.0, subtype='FACTOR',
        description="Alto = pasillos largos; bajo = muchos giros")
    prob_escalera: FloatProperty(
        name="Escaleras", default=0.28, min=0.0, max=1.0, subtype='FACTOR',
        description="Probabilidad de que un tramo suba o baje un piso")
    prob_rama: FloatProperty(
        name="Ramificar", default=0.65, min=0.0, max=1.0, subtype='FACTOR',
        description="Alto = todo más conectado; bajo = más grupos aislados")
    separacion: IntProperty(
        name="Separación", default=1, min=1, max=6,
        description="Espacio libre (en anchos de andamio) entre piezas que no se conectan")
    # --- detalles ---
    prob_corte: FloatProperty(
        name="Sin salida", default=0.05, min=0.0, max=1.0, subtype='FACTOR',
        description="Probabilidad por tramo de que el andamio no lleve a nada")
    sueltas_por_piso: IntProperty(
        name="Sueltas por piso", default=3, min=0, max=500,
        description="Andamios flotando sin conectar a nada")
    prob_pilar: FloatProperty(name="Pilares", default=0.15, min=0.0, max=1.0,
                              subtype='FACTOR')
    profundidad_pilar: FloatProperty(
        name="Bajan hasta", default=40.0, min=0.0, max=1000.0, unit='LENGTH',
        description="Metros que bajan los pilares por debajo del piso 0")
    con_barandas: BoolProperty(name="Barandas", default=True,
                               description="Cerrar los lados de plataforma sin conexión")
    con_tapas: BoolProperty(name="Tapas", default=True,
                            description="Cerrar los extremos de andamio sin salida")
    # --- niebla ---
    con_niebla: BoolProperty(name="Niebla", default=True, update=_upd_niebla)
    niebla_inicio: FloatProperty(name="Empieza", default=3.0, min=0.0, unit='LENGTH',
                                 update=_upd_niebla)
    niebla_fin: FloatProperty(name="Todo niebla", default=55.0, min=0.1, unit='LENGTH',
                              update=_upd_niebla)
    niebla_escalones: IntProperty(
        name="Bandas", default=0, min=0, max=32, update=_upd_niebla,
        description="0 = degradado suave; 3-8 = saltos de tono")
    niebla_poligonal: BoolProperty(
        name="Poligonal", default=False, update=_upd_poligonal,
        description="Un tono plano por triángulo (más pesado: realiza las instancias)")
    color_niebla: FloatVectorProperty(
        name="Color", subtype='COLOR', size=4, min=0.0, max=1.0,
        default=(0.72, 0.73, 0.72, 1.0), update=_upd_niebla)
    # --- luz y render ---
    luz_sol: FloatProperty(name="Sol", default=1.6, min=0.0, max=20.0, update=_upd_luz)
    luz_ambiente: FloatProperty(name="Ambiente", default=0.35, min=0.0, max=5.0,
                                update=_upd_luz)
    pixelado: BoolProperty(name="Pixelado", default=False, update=_upd_pixelado)
    tam_pixel: IntProperty(name="Tamaño píxel", default=4, min=1, max=64,
                           update=_upd_pixelado)
    niveles_color: IntProperty(name="Colores", default=24, min=0, max=256,
                               update=_upd_pixelado)
    con_camara: BoolProperty(name="Crear cámara", default=True)
    # --- texturas ---
    escala_uv: FloatProperty(name="Metros por repetición", default=2.0, min=0.01,
                             unit='LENGTH')
    tex_andamio: StringProperty(name="Andamio", subtype='FILE_PATH')
    tex_escalon: StringProperty(name="Escalón", subtype='FILE_PATH')
    tex_plataforma: StringProperty(name="Plataforma", subtype='FILE_PATH')
    tex_pilar: StringProperty(name="Pilar", subtype='FILE_PATH')
    # --- solo lectura ---
    resumen: StringProperty(default="")


def recorridos_totales(a):
    return max(1, round(a.recorridos_por_piso * a.niveles * (a.extension / 160.0) ** 2))


# ----------------------------- utilidades -----------------------------
def limpiar():
    col = bpy.data.collections.get(COLECCION)
    if col:
        for o in list(col.all_objects):
            datos = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if isinstance(datos, (bpy.types.Camera, bpy.types.Light)) and datos.users == 0:
                if isinstance(datos, bpy.types.Camera):
                    bpy.data.cameras.remove(datos)
                else:
                    bpy.data.lights.remove(datos)
        for c in list(col.children_recursive):
            bpy.data.collections.remove(c)
        bpy.data.collections.remove(col)
    for m in list(bpy.data.meshes):
        if m.name.startswith(PREF) and m.users == 0:
            bpy.data.meshes.remove(m)


def material(nombre, a):
    m = bpy.data.materials.get(PREF + nombre)
    if m is None:
        m = bpy.data.materials.new(PREF + nombre)
        if m.node_tree is None:  # en Blender 5.x ya vienen con nodos
            m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = COLORES[nombre]
        bsdf.inputs["Roughness"].default_value = 0.7
        m.diffuse_color = COLORES[nombre]
    ruta = bpy.path.abspath(getattr(a, "tex_" + nombre.lower()))
    if ruta and os.path.isfile(ruta):
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        img = nt.nodes.get("LIM_Textura")
        if img is None:
            tc = nt.nodes.new("ShaderNodeTexCoord")
            mp = nt.nodes.new("ShaderNodeMapping")
            img = nt.nodes.new("ShaderNodeTexImage")
            img.name = "LIM_Textura"
            tc.location, mp.location, img.location = (-800, 300), (-600, 300), (-350, 300)
            nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
            nt.links.new(mp.outputs["Vector"], img.inputs["Vector"])
            nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
        img.image = bpy.data.images.load(ruta, check_existing=True)
    agregar_niebla(m, a)
    return m


def caja(bm, x0, x1, y0, y1, z0, z1, mat=0):
    v = [bm.verts.new(c) for c in (
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in idx]).material_index = mat


def uv_caja(bm, escala):
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
            l[uv].uv = (u / escala, v / escala)


# ------------------------------ niebla ------------------------------
def grupo_niebla(a):
    """Grupo de shader compartido por todos los materiales: devuelve cuánta niebla
    hay (0-1) según la distancia a quien mira (cámara activa o viewport)."""
    ng = bpy.data.node_groups.get(PREF + "NieblaRetro")
    if ng is None:
        ng = bpy.data.node_groups.new(PREF + "NieblaRetro", 'ShaderNodeTree')
        ng.interface.new_socket("Niebla", in_out='OUTPUT', socket_type='NodeSocketFloat')
    N, L = ng.nodes, ng.links
    N.clear()  # se reconstruye con los ajustes actuales
    camd = N.new("ShaderNodeCameraData")
    camd.location = (-800, -250)
    if a.niebla_poligonal:
        # posición del ojo = punto + dirección hacia la cámara * distancia; se
        # compara con el centro del triángulo (atributo 'centro' de Geometry Nodes)
        centro = N.new("ShaderNodeAttribute")
        centro.attribute_type = 'GEOMETRY'
        centro.attribute_name = "centro"
        geo = N.new("ShaderNodeNewGeometry")
        hacia_ojo = N.new("ShaderNodeVectorMath")
        hacia_ojo.operation = 'SCALE'
        ojo = N.new("ShaderNodeVectorMath")
        ojo.operation = 'ADD'
        dist = N.new("ShaderNodeVectorMath")
        dist.operation = 'DISTANCE'
        for nodo, x, y in ((geo, -800, 0), (centro, -400, 250), (hacia_ojo, -550, -100),
                           (ojo, -400, 0), (dist, -200, 100)):
            nodo.location = (x, y)
        L.new(geo.outputs["Incoming"], hacia_ojo.inputs[0])
        L.new(camd.outputs["View Distance"], hacia_ojo.inputs["Scale"])
        L.new(hacia_ojo.outputs["Vector"], ojo.inputs[0])
        L.new(geo.outputs["Position"], ojo.inputs[1])
        L.new(centro.outputs["Vector"], dist.inputs[0])
        L.new(ojo.outputs["Vector"], dist.inputs[1])
        distancia = dist.outputs["Value"]
    else:
        distancia = camd.outputs["View Distance"]
    rango = N.new("ShaderNodeMapRange")
    rango.clamp = True
    rango.inputs["From Min"].default_value = a.niebla_inicio
    rango.inputs["From Max"].default_value = max(a.niebla_fin, a.niebla_inicio + 0.01)
    rango.inputs["To Max"].default_value = 1.001
    escalon = N.new("ShaderNodeMath")
    escalon.operation = 'SNAP'
    escalon.inputs[1].default_value = 1.0 / a.niebla_escalones if a.niebla_escalones else 1e-4
    activa = N.new("ShaderNodeMath")
    activa.operation = 'MINIMUM'
    activa.inputs[1].default_value = 1.0 if a.con_niebla else 0.0
    sal = N.new("NodeGroupOutput")
    for nodo, x in ((rango, 0), (escalon, 200), (activa, 400), (sal, 600)):
        nodo.location = (x, 100)
    L.new(distancia, rango.inputs["Value"])
    L.new(rango.outputs["Result"], escalon.inputs[0])
    L.new(escalon.outputs["Value"], activa.inputs[0])
    L.new(activa.outputs["Value"], sal.inputs[0])
    return ng


def agregar_niebla(m, a):
    """Mezcla el sombreado final del material con el color de la niebla.
    No toca el resto del material, así que puedes texturizarlo como quieras."""
    nt = m.node_tree
    salida = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    mezcla = nt.nodes.get("LIM_Niebla_Mezcla")
    if mezcla is None:
        enlace = salida.inputs["Surface"].links[0] if salida.inputs["Surface"].links else None
        emi = nt.nodes.new("ShaderNodeEmission")
        emi.name = "LIM_Niebla_Color"
        mezcla = nt.nodes.new("ShaderNodeMixShader")
        mezcla.name = "LIM_Niebla_Mezcla"
        x, y = salida.location
        salida.location = (x + 250, y)
        mezcla.location = (x, y)
        emi.location = (x - 250, y - 200)
        if enlace:
            nt.links.new(enlace.from_socket, mezcla.inputs[1])
        nt.links.new(emi.outputs["Emission"], mezcla.inputs[2])
        nt.links.new(mezcla.outputs["Shader"], salida.inputs["Surface"])
    viejo = nt.nodes.get("LIM_Niebla_Attr")  # versión anterior
    if viejo:
        nt.nodes.remove(viejo)
    fac = nt.nodes.get("LIM_Niebla_Fac")
    if fac is None:
        fac = nt.nodes.new("ShaderNodeGroup")
        fac.name = "LIM_Niebla_Fac"
        fac.location = (mezcla.location.x - 250, mezcla.location.y + 250)
    fac.node_tree = grupo_niebla(a)
    nt.links.new(fac.outputs[0], mezcla.inputs["Fac"])
    nt.nodes["LIM_Niebla_Color"].inputs["Color"].default_value = a.color_niebla
    nt.nodes["LIM_Niebla_Color"].inputs["Strength"].default_value = 1.0


def actualizar_niebla(a, sc):
    """Aplica los ajustes de niebla al momento, sin regenerar."""
    grupo_niebla(a)
    for m in bpy.data.materials:
        if m.name.startswith(PREF) and m.node_tree and "LIM_Niebla_Color" in m.node_tree.nodes:
            m.node_tree.nodes["LIM_Niebla_Color"].inputs["Color"].default_value = a.color_niebla
    mundo(a, sc)


# ------------------------------ piezas ------------------------------
def cargar_andamio(a):
    """Devuelve (bmesh normalizado, largo, ancho, medio_ancho_interior, grosor_piso).
    Normalizado: largo sobre +Y desde y=0, centrado en X, piso superior en z=0."""
    verts, caras = [], []
    ruta = bpy.path.abspath(a.ruta_andamio)
    if ruta and os.path.isfile(ruta):
        objs_antes, mallas_antes = set(bpy.data.objects), set(bpy.data.meshes)
        mats_antes = set(bpy.data.materials)
        bpy.ops.import_scene.gltf(filepath=ruta)
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
    grosor = max(piso - min(zs), 0.05)
    altos = [abs(v.co.x) for v in bm.verts if v.co.z > 0.05]
    interior = min(altos) if altos and min(altos) > 0.01 else ancho * 0.4
    for f in bm.faces:
        f.material_index = 0
    return bm, largo, ancho, interior, grosor


# --------------------------- instancias (GN) ---------------------------
def grupo_instancias(a):
    """Geometry Nodes: pone una copia de 'Pieza' en cada vértice con su giro y
    escala (y, para la niebla poligonal, guarda el centro de cada cara).
    Se reconstruye en el mismo grupo para no romper los modificadores."""
    ng = bpy.data.node_groups.get(PREF + "Instanciar")
    if ng is None:
        ng = bpy.data.node_groups.new(PREF + "Instanciar", 'GeometryNodeTree')
        ng.interface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
        ng.interface.new_socket("Pieza", in_out='INPUT', socket_type='NodeSocketObject')
        ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    N.clear()
    ent = N.new('NodeGroupInput')
    sal = N.new('NodeGroupOutput')
    info = N.new('GeometryNodeObjectInfo')
    info.inputs['As Instance'].default_value = True
    giro = N.new('GeometryNodeInputNamedAttribute')
    giro.data_type = 'FLOAT'
    giro.inputs['Name'].default_value = "giro"
    esc = N.new('GeometryNodeInputNamedAttribute')
    esc.data_type = 'FLOAT_VECTOR'
    esc.inputs['Name'].default_value = "escala"
    xyz = N.new('ShaderNodeCombineXYZ')
    inst = N.new('GeometryNodeInstanceOnPoints')
    for nodo, x, y in ((ent, -600, 0), (info, -350, -150), (giro, -600, -300),
                       (xyz, -350, -300), (esc, -350, -450), (inst, 0, 0), (sal, 700, 0)):
        nodo.location = (x, y)
    L.new(ent.outputs['Geometry'], inst.inputs['Points'])
    L.new(ent.outputs['Pieza'], info.inputs['Object'])
    L.new(info.outputs['Geometry'], inst.inputs['Instance'])
    L.new(giro.outputs['Attribute'], xyz.inputs['Z'])
    L.new(xyz.outputs['Vector'], inst.inputs['Rotation'])
    L.new(esc.outputs['Attribute'], inst.inputs['Scale'])
    if not a.niebla_poligonal:
        L.new(inst.outputs['Instances'], sal.inputs['Geometry'])
        return ng
    real = N.new('GeometryNodeRealizeInstances')
    guardar = N.new('GeometryNodeStoreNamedAttribute')
    guardar.data_type = 'FLOAT_VECTOR'
    guardar.domain = 'FACE'
    guardar.inputs['Name'].default_value = "centro"
    pos = N.new('GeometryNodeInputPosition')
    real.location, guardar.location, pos.location = (200, 0), (450, 0), (200, -250)
    L.new(inst.outputs['Instances'], real.inputs['Geometry'])
    L.new(real.outputs['Geometry'], guardar.inputs['Geometry'])
    L.new(pos.outputs['Position'], guardar.inputs['Value'])
    L.new(guardar.outputs['Geometry'], sal.inputs['Geometry'])
    return ng


def objeto_instancias(nombre, malla, puntos, col, col_base, ng):
    """puntos: lista de (posición, giro_z, escala_xyz)."""
    plantilla = bpy.data.objects.new(PREF + "Base_" + nombre, malla)
    col_base.objects.link(plantilla)
    me = bpy.data.meshes.new(PREF + "Puntos_" + nombre)
    me.vertices.add(len(puntos))
    me.vertices.foreach_set("co", [c for p, _, _ in puntos for c in p])
    me.attributes.new("giro", 'FLOAT', 'POINT').data.foreach_set(
        "value", [g for _, g, _ in puntos])
    me.attributes.new("escala", 'FLOAT_VECTOR', 'POINT').data.foreach_set(
        "vector", [c for _, _, e in puntos for c in e])
    obj = bpy.data.objects.new(PREF + nombre, me)
    col.objects.link(obj)
    mod = obj.modifiers.new("Instancias", 'NODES')
    mod.node_group = ng
    mod[ng.interface.items_tree["Pieza"].identifier] = plantilla
    return obj


# ----------------------------- generación -----------------------------
def generar(rng, a, celda, alto_nivel):
    """Trabaja en celdas del ancho del andamio (una plataforma = una celda).
    Cada tramo ocupa k celdas en línea recta entre dos plataformas.
    Todo lo que se pone queda marcado en 'ocup' por (i, j, piso), así nada
    se atraviesa ni se pega."""
    niveles = a.niveles
    sep = a.separacion
    kmin = max(2, round(a.tramo_min / celda))
    kmax = max(kmin, round(a.tramo_max / celda))
    kesc = max(kmin, math.ceil(alto_nivel / celda * 1.3))   # escaleras no muy empinadas
    kmax_esc = max(kmax, kesc)
    lim = max(4, int(a.extension / celda))
    hueco = lim * 0.45 if a.forma == 'ANILLO' else -1
    # pisos sueltos: elegidos con su propio azar para que el resto no cambie
    sueltos = set(random.Random(a.semilla * 7919 + 1).sample(
        range(niveles), min(a.pisos_sueltos, niveles)))
    ocup = set()                       # celdas (i, j, piso) ocupadas
    nodos = set()
    por_piso = defaultdict(list)       # plataformas de cada piso
    lados = set()                      # (nodo, dir) ya usados por un andamio
    piezas = []                        # (tipo, base, dir, k)

    def dentro(c):
        if not 0 <= c[2] < niveles:
            return False
        if a.forma == 'CUADRADO':
            return abs(c[0]) <= lim and abs(c[1]) <= lim
        r2 = c[0] ** 2 + c[1] ** 2
        return hueco ** 2 < r2 <= lim ** 2 if hueco > 0 else r2 <= lim ** 2

    def al_azar(piso):
        for _ in range(200):
            c = (rng.randint(-lim, lim), rng.randint(-lim, lim), piso)
            if dentro(c):
                return c
        return None

    def celdas(P, d, k, dz):
        """Celdas del tramo y las de sus costados (deben estar libres)."""
        lado = (d[1], d[0])
        cuerpo, costados = [], []
        for s in range(1, k + 1):
            x, y = P[0] + d[0] * s, P[1] + d[1] * s
            for z in {P[2], P[2] + dz}:     # la escalera ocupa los dos pisos
                cuerpo.append((x, y, z))
                for t in range(1, sep + 1):
                    costados += [(x + lado[0] * t, y + lado[1] * t, z),
                                 (x - lado[0] * t, y - lado[1] * t, z)]
        return cuerpo, costados

    def cabe_nodo(Q, excepto=None):
        """Una plataforma nueva necesita su celda y alrededor libres (salvo el
        andamio que llega a ella)."""
        if Q in ocup or not dentro(Q):
            return False
        for di in range(-sep, sep + 1):
            for dj in range(-sep, sep + 1):
                c = (Q[0] + di, Q[1] + dj, Q[2])
                if (di or dj) and c != excepto and c in ocup:
                    return False
        return True

    def agregar_nodo(c):
        nodos.add(c)
        por_piso[c[2]].append(c)
        ocup.add(c)

    def tramo(P, d, k, dz, cortar):
        """Intenta poner un andamio desde la plataforma P. Devuelve el nodo
        destino, 'corte' si quedó sin salida, o None si no cabe."""
        if (P, d) in lados:
            return None
        if dz and (P[2] in sueltos or P[2] + dz in sueltos):
            return None   # ninguna escalera entra ni sale de un piso suelto
        Q = (P[0] + d[0] * (k + 1), P[1] + d[1] * (k + 1), P[2] + dz)
        atras = (-d[0], -d[1])
        if not dentro(Q):
            return None
        cuerpo, costados = celdas(P, d, k, dz)
        if any(c in ocup for c in cuerpo) or any(c in ocup for c in costados):
            return None
        ultima = (Q[0] - d[0], Q[1] - d[1], Q[2])
        if cortar:
            if Q in ocup:          # la tapa no puede chocar con nada
                return None
        elif Q in nodos:
            if (Q, atras) in lados:
                return None
        elif not cabe_nodo(Q, ultima):
            return None
        ocup.update(cuerpo)
        lados.add((P, d))
        tipo = "escalera" if dz else "recto"
        if cortar and not dz and rng.random() < 0.5:
            tipo = "roto"
        if dz < 0:  # la escalera siempre se describe desde abajo
            piezas.append((tipo, Q, atras, k))
        else:
            piezas.append((tipo, P, d, k))
        if cortar:
            return "corte"
        if Q not in nodos:
            agregar_nodo(Q)
        lados.add((Q, atras))
        return Q

    def recorrido(piso):
        """Un caminante: empieza en el piso indicado (desde algo existente o en
        un punto libre) y va poniendo tramos."""
        if por_piso[piso] and rng.random() < a.prob_rama:
            P = rng.choice(por_piso[piso])
        else:
            P = None
            for _ in range(30):
                c = al_azar(piso)
                if c and cabe_nodo(c):
                    P = c
                    break
            if P is None:
                return
            agregar_nodo(P)
        d = rng.choice(DIRS)
        for _ in range(a.pasos):
            if rng.random() > a.prob_recto:
                d = rng.choice(((d[1], d[0]), (-d[1], -d[0])))   # gira 90°
            dz = rng.choice((-1, 1)) if rng.random() < a.prob_escalera else 0
            cortar = rng.random() < a.prob_corte
            res = None
            for intento in range(8):  # si no cabe, prueba otro largo / dirección
                dd = d if intento < 4 else rng.choice(DIRS)
                dzz = dz if intento < 3 else 0
                k = rng.randint(kesc, kmax_esc) if dzz else rng.randint(kmin, kmax)
                res = tramo(P, dd, k, dzz, cortar)
                if res:
                    d = dd
                    break
            if res is None or res == "corte":
                break
            P = res

    # los recorridos se reparten por igual entre todos los pisos
    total = recorridos_totales(a)
    for w in range(total):
        recorrido(w % niveles)
    # si algún piso quedó vacío (todo ocupado por escaleras, etc.) se reintenta
    for piso in range(niveles):
        for _ in range(20):
            if por_piso[piso]:
                break
            recorrido(piso)

    # piezas sueltas: flotan sin tocar nada (cerradas por los dos extremos)
    objetivo = a.sueltas_por_piso * niveles
    sueltas, intentos = 0, 0
    while sueltas < objetivo and intentos < objetivo * 40:
        intentos += 1
        P = al_azar(rng.randrange(niveles))
        if P is None:
            continue
        d = rng.choice(DIRS)
        dz = rng.choice((0, 0, 1)) if P[2] < niveles - 1 else 0
        k = rng.randint(kesc, kmax_esc) if dz else rng.randint(kmin, kmax)
        Q = (P[0] + d[0] * (k + 1), P[1] + d[1] * (k + 1), P[2] + dz)
        if not dentro(Q) or P in ocup or Q in ocup:
            continue
        cuerpo, costados = celdas(P, d, k, dz)
        if any(c in ocup for c in cuerpo + costados):
            continue
        ocup.update(cuerpo)
        piezas.append(("escalera" if dz else rng.choice(("recto", "roto")), P, d, k))
        sueltas += 1

    vacios = [p for p in range(niveles) if not por_piso[p]]
    return nodos, piezas, ocup, sueltas, vacios, sorted(sueltos)


def construir(a, sc):
    rng = random.Random(a.semilla)
    limpiar()
    raiz = bpy.data.collections.new(COLECCION)
    sc.collection.children.link(raiz)
    col_base = bpy.data.collections.new(PREF + "Piezas_Base")
    raiz.children.link(col_base)
    col_base.hide_viewport = True
    col_base.hide_render = True

    m = {k: material(k, a) for k in COLORES}
    base, largo, ancho, interior, grosor = cargar_andamio(a)
    alto_pared = max(v.co.z for v in base.verts)
    esp = max(ancho / 2 - interior, 0.05)  # grosor de las paredes del andamio
    # nada puede chocar con el piso de arriba: altura mínima por piso
    alto_nivel = max(a.alto_nivel, alto_pared + grosor + HOLGURA)

    mallas = {}

    def a_malla(bm, nombre, mats):
        uv_caja(bm, a.escala_uv)
        me = bpy.data.meshes.new(PREF + nombre)
        bm.to_mesh(me)
        bm.free()
        for mat in mats:
            me.materials.append(mat)
        return me

    def malla_tramo(tipo, k):
        """Malla del andamio con largo k celdas; se crea solo si se usa."""
        clave = "%s_%03d" % (tipo, k)
        if clave not in mallas:
            f = k * ancho / largo * (0.55 if tipo == "roto" else 1.0)
            bm = base.copy()
            for v in bm.verts:
                v.co.y *= f  # las UVs se recalculan después: no se deforman
            nombre = "Andamio_%s_%dm" % (tipo.capitalize(), round(k * ancho))
            if tipo == "escalera":
                l = largo * f
                for v in bm.verts:
                    v.co.z += v.co.y / l * alto_nivel
                n = math.ceil(alto_nivel / 0.2)  # contrahuella <= grosor del piso
                sube, huella = alto_nivel / n, l / n
                for i in range(n):
                    caja(bm, -interior, interior, i * huella, (i + 1) * huella,
                         i * sube, (i + 1) * sube, mat=1)
                mallas[clave] = a_malla(bm, nombre, [m["Andamio"], m["Escalon"]])
            else:
                mallas[clave] = a_malla(bm, nombre, [m["Andamio"]])
        return clave

    def malla_pilar(piso):
        clave = "pilar_%03d" % piso
        if clave not in mallas:
            bm = bmesh.new()
            lp = ancho * 0.15
            caja(bm, -lp, lp, -lp, lp, -(piso * alto_nivel + a.profundidad_pilar), -grosor)
            mallas[clave] = a_malla(bm, "Pilar_P%03d" % piso, [m["Pilar"]])
        return clave

    bm = bmesh.new()
    caja(bm, -ancho / 2, ancho / 2, -ancho / 2, ancho / 2, -grosor, 0)
    mallas["plataforma"] = a_malla(bm, "Plataforma", [m["Plataforma"]])
    bm = bmesh.new()  # tapa: cierra el extremo de un andamio sin salida
    caja(bm, -ancho / 2, ancho / 2, 0, esp, -grosor, alto_pared)
    mallas["tapa"] = a_malla(bm, "Tapa", [m["Andamio"]])
    bm = bmesh.new()  # baranda: lado de plataforma sin conexión ("molinete": sin solapes)
    caja(bm, -ancho / 2, ancho / 2 - esp, -esp, 0, 0, alto_pared)
    mallas["baranda"] = a_malla(bm, "Baranda", [m["Andamio"]])

    nodos, piezas, ocup, sueltas, vacios, sueltos = generar(rng, a, ancho, alto_nivel)
    uno = (1.0, 1.0, 1.0)

    def centro(c):
        return Vector((c[0] * ancho, c[1] * ancho, c[2] * alto_nivel))

    puntos = defaultdict(list)
    conectado = set()   # (nodo, dir): lados de plataforma a los que llega un andamio
    for tipo, c, d, k in piezas:
        sube = 1 if tipo == "escalera" else 0
        dv = Vector((d[0], d[1], 0))
        atras = (-d[0], -d[1])
        ini = centro(c) + dv * (ancho / 2)
        puntos[malla_tramo(tipo, k)].append((ini, ROT[d], uno))
        if c in nodos:
            conectado.add((c, d))
        elif a.con_tapas:
            puntos["tapa"].append((ini, ROT[d], uno))
        fin_nodo = (c[0] + d[0] * (k + 1), c[1] + d[1] * (k + 1), c[2] + sube)
        if tipo != "roto" and fin_nodo in nodos:
            conectado.add((fin_nodo, atras))
        elif a.con_tapas:
            recorrido = k * ancho * (0.55 if tipo == "roto" else 1.0)
            fin = ini + dv * recorrido + Vector((0, 0, sube * alto_nivel))
            puntos["tapa"].append((fin, ROT[atras], uno))
    base.free()

    for c in sorted(nodos):
        puntos["plataforma"].append((centro(c), 0.0, uno))
        if a.con_barandas:
            for d in DIRS:
                if (c, d) not in conectado:
                    pos = centro(c) + Vector((d[0], d[1], 0)) * (ancho / 2)
                    puntos["baranda"].append((pos, ROT[d], uno))
        # pilar solo si debajo no hay nada en ningún piso (no atraviesa nada)
        if rng.random() < a.prob_pilar and not any((c[0], c[1], z) in ocup
                                                     for z in range(c[2])):
            puntos[malla_pilar(c[2])].append((centro(c), 0.0, uno))

    if a.con_camara:
        camara(rng, nodos, piezas, ocup, centro, raiz, sc)
    ng = grupo_instancias(a)
    for k, lista in puntos.items():
        if lista:
            objeto_instancias(mallas[k].name[len(PREF):], mallas[k], lista, raiz, col_base, ng)

    ambiente(a, sc)

    total = sum(len(l) for l in puntos.values())
    a.resumen = "%d plataformas · %d andamios · %d escaleras · %d piezas en total" % (
        len(nodos), sum(1 for p in piezas if p[0] != "escalera"),
        sum(1 for p in piezas if p[0] == "escalera"), total)
    if sueltos:
        a.resumen += " · pisos sueltos: " + ", ".join(str(p) for p in sueltos)
    avisos = []
    if alto_nivel > a.alto_nivel + 1e-6:
        avisos.append("altura por piso subida a %.2f m para que nada choque" % alto_nivel)
    if vacios:
        avisos.append("%d pisos vacíos (sube Radio o Densidad)" % len(vacios))
    return a.resumen, avisos


# ------------------------------ ambiente ------------------------------
def mundo(a, sc):
    """Cielo del color de la niebla + luz suave."""
    w = sc.world or bpy.data.worlds.new("Mundo")
    sc.world = w
    if w.node_tree is None:  # en Blender 5.x ya viene con nodos
        w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    # La cámara ve el cielo del color exacto de la niebla (horizonte invisible),
    # pero la luz que da el cielo es más tenue para que haya contraste.
    cielo = nt.nodes.new("ShaderNodeBackground")
    cielo.inputs["Color"].default_value = a.color_niebla
    cielo.inputs["Strength"].default_value = 1.0
    luz = nt.nodes.new("ShaderNodeBackground")
    luz.inputs["Color"].default_value = a.color_niebla
    luz.inputs["Strength"].default_value = a.luz_ambiente
    camino = nt.nodes.new("ShaderNodeLightPath")
    mezcla = nt.nodes.new("ShaderNodeMixShader")
    salida = nt.nodes.new("ShaderNodeOutputWorld")
    camino.location, luz.location, cielo.location = (-300, 250), (-300, 0), (-300, -150)
    mezcla.location, salida.location = (0, 0), (250, 0)
    nt.links.new(camino.outputs["Is Camera Ray"], mezcla.inputs["Fac"])
    nt.links.new(luz.outputs["Background"], mezcla.inputs[1])
    nt.links.new(cielo.outputs["Background"], mezcla.inputs[2])
    nt.links.new(mezcla.outputs["Shader"], salida.inputs["Surface"])
    sol = bpy.data.objects.get("Sol")
    if sol and sol.type == 'LIGHT':
        sol.data.energy = a.luz_sol


def ambiente(a, sc):
    for motor in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            sc.render.engine = motor
            break
        except TypeError:
            pass
    if not any(o.type == 'LIGHT' for o in sc.objects):
        sol = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", 'SUN'))
        sol.data.angle = math.radians(25)  # sombras suaves, luz "de nublado"
        sol.rotation_euler = (math.radians(35), 0, math.radians(40))
        bpy.data.collections[COLECCION].objects.link(sol)
    mundo(a, sc)
    # 'Standard' = colores planos y el cielo coincide exacto con la niebla
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    pixelado(a, sc)


def pixelado(a, sc):
    """Píxeles gordos + paleta reducida en el compositor (opcional)."""
    es_5 = hasattr(sc, "compositing_node_group")
    viejo = bpy.data.node_groups.get(PREF + "Retro")
    if not a.pixelado:
        sc.render.filter_size = 1.5
        if es_5:
            if viejo and sc.compositing_node_group == viejo:
                sc.compositing_node_group = None
            if viejo:
                bpy.data.node_groups.remove(viejo)
        elif sc.use_nodes and sc.node_tree and any(n.type == 'PIXELATE'
                                                   for n in sc.node_tree.nodes):
            sc.use_nodes = False
        return
    if es_5:  # Blender 5.x: el compositor es un grupo de nodos asignado a la escena
        if viejo:
            bpy.data.node_groups.remove(viejo)
        ct = bpy.data.node_groups.new(PREF + "Retro", 'CompositorNodeTree')
        ct.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
        final = ct.nodes.new("NodeGroupOutput")
        sc.compositing_node_group = ct
    else:     # Blender 4.x
        sc.use_nodes = True
        ct = sc.node_tree
        ct.nodes.clear()
        final = ct.nodes.new("CompositorNodeComposite")
    final.location = (900, 0)
    capas = ct.nodes.new("CompositorNodeRLayers")
    actual = capas.outputs["Image"]
    sc.render.filter_size = 0.0  # bordes duros, sin suavizado
    pix = ct.nodes.new("CompositorNodePixelate")
    pix.location = (400, 0)
    if "Size" in pix.inputs:            # Blender 5.x
        pix.inputs["Size"].default_value = a.tam_pixel
    elif hasattr(pix, "pixel_size"):    # Blender 4.1 - 4.5
        pix.pixel_size = a.tam_pixel
    ct.links.new(actual, pix.inputs[0])
    actual = pix.outputs[0]
    if a.niveles_color > 0:
        post = ct.nodes.new("CompositorNodePosterize")
        post.location = (650, -150)
        post.inputs["Steps"].default_value = a.niveles_color
        ct.links.new(actual, post.inputs["Image"])
        actual = post.outputs[0]
    ct.links.new(actual, final.inputs[0])


def camara(rng, nodos, piezas, ocup, centro, col, sc):
    """Cámara un poco sobre la baranda, al inicio de uno de los andamios más largos."""
    candidatos = sorted(((k, rng.random(), c, d) for t, c, d, k in piezas
                         if t == "recto" and c in nodos and (c[0], c[1], c[2] + 1) not in ocup),
                        reverse=True)
    if not candidatos:
        return None
    _, _, c, d = rng.choice(candidatos[:8])
    ojo = centro(c) + Vector((0, 0, 2.3)) - Vector((d[0], d[1], 0)) * 0.6
    cam = bpy.data.objects.new("Camara_Liminal", bpy.data.cameras.new("Camara_Liminal"))
    cam.data.lens = 24
    cam.data.clip_end = 5000
    cam.location = ojo
    objetivo = ojo + Vector((d[0], d[1], -0.12)) * 10
    cam.rotation_euler = (objetivo - ojo).to_track_quat('-Z', 'Y').to_euler()
    col.objects.link(cam)
    sc.camera = cam
    return cam


# ============================== operadores ==============================
class LIM_OT_generar(bpy.types.Operator):
    bl_idname = "liminal.generar"
    bl_label = "Generar"
    bl_description = "Genera la estructura con los ajustes actuales (borra la anterior)"
    bl_options = {'REGISTER', 'UNDO'}

    nueva_semilla: BoolProperty(default=False, options={'SKIP_SAVE'})

    def execute(self, context):
        a = context.scene.liminal
        if a.tramo_max < a.tramo_min:
            a.tramo_max = a.tramo_min
        if self.nueva_semilla:
            a.semilla = random.randint(0, 999999)
        resumen, avisos = construir(a, context.scene)
        self.report({'WARNING'} if avisos else {'INFO'},
                    resumen + ("  |  " + "; ".join(avisos) if avisos else ""))
        return {'FINISHED'}


class LIM_OT_borrar(bpy.types.Operator):
    bl_idname = "liminal.borrar"
    bl_label = "Borrar"
    bl_description = "Elimina la estructura generada (los materiales se conservan)"
    bl_options = {'REGISTER', 'UNDO'}

    def execute(self, context):
        limpiar()
        context.scene.liminal.resumen = ""
        return {'FINISHED'}


class LIM_OT_restablecer(bpy.types.Operator):
    bl_idname = "liminal.restablecer"
    bl_label = "Valores por defecto"
    bl_description = "Vuelve todos los ajustes a sus valores iniciales"

    def execute(self, context):
        a = context.scene.liminal
        for p in a.bl_rna.properties:
            if not p.is_readonly and p.identifier not in ("rna_type", "name", "ruta_andamio"):
                a.property_unset(p.identifier)
        actualizar_niebla(a, context.scene)
        return {'FINISHED'}


# ================================ panel ================================
class LIM_PT_base:
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = "Liminal"


class LIM_PT_principal(LIM_PT_base, bpy.types.Panel):
    bl_label = "Andamios liminales"

    def draw(self, context):
        a = context.scene.liminal
        col = self.layout.column(align=True)
        col.scale_y = 1.4
        col.operator("liminal.generar", text="Generar", icon='FILE_REFRESH')
        col.operator("liminal.generar", text="Generar nuevo",
                     icon='SHADERFX').nueva_semilla = True
        fila = self.layout.row(align=True)
        fila.prop(a, "semilla")
        fila.operator("liminal.borrar", text="", icon='TRASH')
        if a.resumen:
            self.layout.label(text=a.resumen, icon='INFO')
        self.layout.prop(a, "ruta_andamio")
        self.layout.operator("liminal.restablecer", icon='LOOP_BACK')


class LIM_PT_tamano(LIM_PT_base, bpy.types.Panel):
    bl_label = "Tamaño"
    bl_parent_id = "LIM_PT_principal"

    def draw(self, context):
        a = context.scene.liminal
        col = self.layout.column()
        col.prop(a, "forma")
        col.prop(a, "extension")
        col.prop(a, "niveles")
        col.prop(a, "pisos_sueltos")
        col.prop(a, "alto_nivel")
        col.label(text="Alto total: %.0f m · ancho: %.0f m" % (
            a.niveles * a.alto_nivel, a.extension * 2))


class LIM_PT_recorridos(LIM_PT_base, bpy.types.Panel):
    bl_label = "Recorridos"
    bl_parent_id = "LIM_PT_principal"

    def draw(self, context):
        a = context.scene.liminal
        col = self.layout.column()
        col.prop(a, "recorridos_por_piso")
        n = recorridos_totales(a)
        col.label(text="%d recorridos en total" % n,
                  icon='ERROR' if n > 20000 else 'NONE')
        col.prop(a, "pasos")
        fila = col.row(align=True)
        fila.prop(a, "tramo_min", text="Mín")
        fila.prop(a, "tramo_max", text="Máx")
        col.separator()
        col.prop(a, "prob_recto", slider=True)
        col.prop(a, "prob_escalera", slider=True)
        col.prop(a, "prob_rama", slider=True)
        col.prop(a, "separacion")


class LIM_PT_detalles(LIM_PT_base, bpy.types.Panel):
    bl_label = "Detalles"
    bl_parent_id = "LIM_PT_principal"
    bl_options = {'DEFAULT_CLOSED'}

    def draw(self, context):
        a = context.scene.liminal
        col = self.layout.column()
        col.prop(a, "prob_corte", slider=True)
        col.prop(a, "sueltas_por_piso")
        col.prop(a, "prob_pilar", slider=True)
        col.prop(a, "profundidad_pilar")
        fila = col.row()
        fila.prop(a, "con_barandas")
        fila.prop(a, "con_tapas")


class LIM_PT_niebla(LIM_PT_base, bpy.types.Panel):
    bl_label = "Niebla (en vivo)"
    bl_parent_id = "LIM_PT_principal"

    def draw_header(self, context):
        self.layout.prop(context.scene.liminal, "con_niebla", text="")

    def draw(self, context):
        a = context.scene.liminal
        col = self.layout.column()
        col.active = a.con_niebla
        col.prop(a, "color_niebla")
        fila = col.row(align=True)
        fila.prop(a, "niebla_inicio")
        fila.prop(a, "niebla_fin")
        col.prop(a, "niebla_escalones")
        col.prop(a, "niebla_poligonal")
        col.label(text="Se ve en Material Preview / Rendered y F12", icon='INFO')


class LIM_PT_render(LIM_PT_base, bpy.types.Panel):
    bl_label = "Luz y render (en vivo)"
    bl_parent_id = "LIM_PT_principal"
    bl_options = {'DEFAULT_CLOSED'}

    def draw(self, context):
        a = context.scene.liminal
        col = self.layout.column()
        fila = col.row(align=True)
        fila.prop(a, "luz_sol")
        fila.prop(a, "luz_ambiente")
        col.prop(a, "pixelado")
        sub = col.column(align=True)
        sub.active = a.pixelado
        sub.prop(a, "tam_pixel")
        sub.prop(a, "niveles_color")
        col.prop(a, "con_camara")


class LIM_PT_texturas(LIM_PT_base, bpy.types.Panel):
    bl_label = "Texturas"
    bl_parent_id = "LIM_PT_principal"
    bl_options = {'DEFAULT_CLOSED'}

    def draw(self, context):
        a = context.scene.liminal
        col = self.layout.column()
        col.prop(a, "escala_uv")
        for n in ("tex_andamio", "tex_escalon", "tex_plataforma", "tex_pilar"):
            col.prop(a, n)
        col.label(text="Se aplican al pulsar Generar", icon='INFO')


CLASES = (LIM_Ajustes, LIM_OT_generar, LIM_OT_borrar, LIM_OT_restablecer,
          LIM_PT_principal, LIM_PT_tamano, LIM_PT_recorridos, LIM_PT_detalles,
          LIM_PT_niebla, LIM_PT_render, LIM_PT_texturas)


def register():
    for cls in CLASES:  # si el script se vuelve a ejecutar, reemplaza lo anterior
        viejo = getattr(bpy.types, cls.__name__, None)
        if viejo:
            try:
                bpy.utils.unregister_class(viejo)
            except RuntimeError:
                pass
        bpy.utils.register_class(cls)
    bpy.types.Scene.liminal = PointerProperty(type=LIM_Ajustes)


def unregister():
    del bpy.types.Scene.liminal
    for cls in reversed(CLASES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
