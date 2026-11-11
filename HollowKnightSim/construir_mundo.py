# Genera mundo.json, enemigos.png y mapa.png a partir de la carpeta sprites/.
# La forma de cada sala sale de la pieza real del mapa: gris = interior, contorno blanco = pared.
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ni

HERE = Path(__file__).parent
MAPS = HERE / "sprites" / "Maps"
ENEM = HERE / "sprites" / "Enemies & Corpses"
S, PAD = 0.7, 5  # casillas por píxel del mapa y margen sólido alrededor de la sala

REGION = {"Town": "town", "Crossroads": "cross", "Fungus1": "green", "Fungus2": "fungal", "Ruins1": "city"}
BENCH = {"Town", "Crossroads_05", "Fungus1_25", "Fungus2_07", "Ruins1_09"}
POOL = {
    "town": [],
    "cross": ["crawlid", "tiktik", "vengefly", "husk", "gruzzer", "crawlid", "husk", "aspid"],
    "green": ["mosscreep", "mossfly", "aspid", "mosscreep"],
    "fungal": ["fungling", "husk", "fungling", "vengefly"],
    "city": ["husk", "vengefly", "husk", "aspid"],
}
FLYERS = {"vengefly", "gruzzer", "aspid", "mossfly"}
# Enlaces: (sala, lado, índice de esa puerta en ese lado) <-> (sala, lado, índice). None = puerta manual.
LINKS = [
    ("Town", "B", 0, "Crossroads_01", "T", 0),
    ("Crossroads_01", "L", 0, "Crossroads_02", "R", 0),
    ("Crossroads_01", "R", 0, "Crossroads_13", "L", 0),
    ("Crossroads_02", "L", 0, "Crossroads_05", "R", 0),
    ("Crossroads_05", "L", 0, "Crossroads_08", "R", 1),
    ("Crossroads_08", "L", 1, "Crossroads_16", "R", 0),
    ("Crossroads_08", "L", 0, "Fungus1_17", "R", 0),
    ("Crossroads_13", "R", 0, "Crossroads_33", "L", 0),
    ("Crossroads_33", "R", 0, "Crossroads_19", "L", 1),
    ("Crossroads_19", "R", 0, "Crossroads_12", "L", 0),
    ("Crossroads_12", "R", 0, "Crossroads_10", "L", 0),
    ("Crossroads_10", "R", 0, "Ruins1_06", "L", 0),
    ("Ruins1_06", "R", 0, "Ruins1_30", "L", 0),
    ("Ruins1_30", "R", 0, "Ruins1_09", "L", 0),
    ("Fungus1_17", "L", 0, "Fungus1_25", "R", 0),
    ("Fungus1_25", "L", 0, "Fungus1_12", "R", 0),
    ("Fungus1_12", "L", 0, "Fungus1_29", "R", 0),
    ("Crossroads_16", "B", 0, "Fungus2_19", "T", 0),
    ("Fungus2_19", "L", 0, "Fungus2_17", "R", 0),
    ("Fungus2_17", "L", 0, "Fungus2_07", "R", 0),
]
TOWN_WELL_X = 0.5  # Bocasucia no tiene puerta dibujada hacia abajo: el pozo se abre en su centro

# Enemigos: atlas, rotación, puntos dentro de cada fotograma, altura final en px, hacia dónde mira
ENEMIES = {
    "crawlid": ("Crawlid - atlas0 #0070052", 0, [(407, 387), (282, 470), (392, 303)], 30, 1),
    "tiktik": ("Tiktik - atlas0 #038014", 90, [(125, 94), (136, 282)], 30, -1),
    "vengefly": ("Vengefly - atlas0 #0070061", 0, [(225, 449), (350, 449), (188, 245)], 44, -1),
    "gruzzer": ("Gruzzer - atlas0 #041013", 0, [(141, 298), (136, 387), (57, 470)], 42, -1),
    "husk": ("Wandering Husk - atlas0 #038017", 90, [(63, 532), (203, 532), (334, 543)], 54, 1),
    "aspid": ("Aspid Hunter - atlas0 #0330032", 0, [(140, 439), (167, 554), (178, 652), (42, 748)], 40, -1),
    "mosscreep": ("Mosscreep - atlas0 #129007", 0, [(55, 970), (180, 970), (299, 970), (415, 970)], 34, -1),
    "mossfly": ("Mossfly - atlas0 #20106", 0, [(62, 325), (194, 325), (339, 325)], 40, -1),
    "fungling": ("Fungling - atlas0 #16609", 0, [(69, 955), (208, 955), (346, 955)], 34, -1),
}


def find_doors(a):
    """Devuelve puertas {lado: [(k, ini, fin)]} donde el gris toca directamente lo transparente."""
    A, G = a[..., 3] > 100, (a[..., 3] > 100) & (a[..., 0] < 130)
    P = np.pad(A, 1)
    expo = {"L": G & ~P[1:-1, :-2], "R": G & ~P[1:-1, 2:], "T": G & ~P[:-2, 1:-1], "B": G & ~P[2:, 1:-1]}
    out = {}
    for s, E in expo.items():
        vert = s in "LR"
        found = []
        idx = np.argwhere(E)
        keys = idx[:, 1] if vert else idx[:, 0]
        for k in np.unique(keys):
            v = sorted((idx[keys == k, 0] if vert else idx[keys == k, 1]).tolist())
            st = pr = v[0]
            for x in v[1:] + [10**6]:
                if x > pr + 1:
                    if pr - st + 1 >= 7:
                        found.append((int(k), st, pr))
                    st = x
                pr = x
        out[s] = sorted(found, key=lambda d: d[1])
    return out


def interior(a):
    """Interior = lo no alcanzable desde fuera atravesando transparente y contorno blanco."""
    A = a[..., 3] > 100
    white = A & (a[..., 0] >= 130)
    passable = np.pad(~A | white, 1, constant_values=True)
    lab, _ = ni.label(passable)
    outside = lab == lab[0, 0]
    return ~outside[1:-1, 1:-1]


def to_grid(mask):
    h, w = mask.shape
    W, H = int(w * S) + 1, int(h * S) + 1
    g = np.ones((H + 2 * PAD, W + 2 * PAD), np.uint8)
    for r in range(H):
        for c in range(W):
            y0, y1 = int(r / S), max(int(r / S) + 1, int((r + 1) / S))
            x0, x1 = int(c / S), max(int(c / S) + 1, int((c + 1) / S))
            block = mask[y0:y1, x0:x1]
            if block.size and block.mean() > 0.5:
                g[r + PAD, c + PAD] = 0
    return g


def carve(room, s, k, a, b):
    g = room["grid"]
    H, W = g.shape
    K = int(k * S) + PAD
    A, B = int(np.ceil(a * S)) + PAD, int(b * S) + PAD
    if B - A < 2:
        B = A + 2
    # Sin escalón al cruzar: el túnel baja hasta el suelo interior si este queda un poco más abajo
    if s in "LR":
        inner = K + 2 if s == "L" else K - 2
        for _ in range(3):
            if B + 1 < H and g[B + 1, inner] == 0:
                B += 1
    if s == "L":
        g[A:B + 1, :K + 2] = 0
    elif s == "R":
        g[A:B + 1, K - 1:] = 0
    elif s == "T":
        g[:K + 2, A:B + 1] = 0
    else:
        g[K - 1:, A:B + 1] = 0
    return {"s": s, "k": K, "a": A, "b": B}


def rle(g):
    out, flat = [], g.flatten().tolist()
    v, n = flat[0], 0
    for x in flat:
        if x == v:
            n += 1
        else:
            out.append(f"{v}{n:x}.")
            v, n = x, 1
    out.append(f"{v}{n:x}.")
    return "".join(out)


def add_platforms(room):
    """Plataformas en los espacios altos, lejos de las puertas, como repisas para subir."""
    g, H, W = room["grid"], *room["grid"].shape
    doors = room["doors"]
    def near(c, r):
        for d in doors:
            dc, dr = (d["k"], (d["a"] + d["b"]) / 2) if d["s"] in "LR" else ((d["a"] + d["b"]) / 2, d["k"])
            if abs(c - dc) < 8 and abs(r - dr) < 7:
                return True
        return False
    for r in range(H - PAD - 5, PAD + 3, -5):
        offset = (r // 5) % 2 * 7
        for c in range(PAD + 2 + offset, W - PAD - 6, 13):
            box = g[r - 4:r + 4, c - 1:c + 5]
            if box.size and not box.any() and g[r + 1:r + 5, c:c + 4].sum() == 0 and not near(c, r):
                g[r, c:c + 4] = 1


def floor_runs(g):
    H, W = g.shape
    runs = []
    for r in range(1, H - 1):
        c = 0
        while c < W:
            ok = g[r, c] == 0 and g[r - 1, c] == 0 and g[r + 1, c] == 1
            if ok:
                st = c
                while c < W and g[r, c] == 0 and g[r - 1, c] == 0 and g[r + 1, c] == 1:
                    c += 1
                if c - st >= 8:
                    runs.append((r, st, c - 1))
            else:
                c += 1
    return runs


def place(room, idx):
    g, reg = room["grid"], room["region"]
    runs = floor_runs(g)
    doors = room["doors"]
    def clear(c, r):
        return all(abs(c - (d["k"] if d["s"] in "LR" else (d["a"] + d["b"]) / 2)) > 7
                   or abs(r - ((d["a"] + d["b"]) / 2 if d["s"] in "LR" else d["k"])) > 7 for d in doors)
    big = sorted(runs, key=lambda x: x[0] - x[2] + x[1])
    room["bench"] = None
    if room["name"] in BENCH and big:
        r, a, b = big[0]
        room["bench"] = [(a + b) // 2, r]
    # Pinchos en una sala de cada dos, en el centro de un tramo largo
    if reg != "town" and idx % 2 == 0:
        for r, a, b in big:
            mid = (a + b) // 2
            if b - a >= 18 and clear(mid, r) and not (room["bench"] and abs(room["bench"][0] - mid) < 10 and room["bench"][1] == r):
                g[r, mid - 2:mid + 3] = 2
                break
    room["enemies"] = []
    pool = POOL[reg]
    n = idx * 3
    if pool:
        for r, a, b in big:
            for c in range(a + 6, b - 4, 19):
                if not clear(c, r) or g[r, c] == 2 or (room["bench"] and abs(room["bench"][0] - c) < 8 and room["bench"][1] == r):
                    continue
                t = pool[n % len(pool)]
                n += 1
                air = t in FLYERS
                rr = r - 4 if air and g[r - 4, c] == 0 else r
                room["enemies"].append([t, c, rr])


def check(room):
    """Comprueba que todas las puertas se comunican entre sí con salto, doble salto y pared."""
    g, H, W = room["grid"], *room["grid"].shape
    free = lambda c, r: 0 <= c < W and 1 <= r < H and g[r, c] != 1 and g[r - 1, c] != 1
    def spot(d):
        if d["s"] == "L":
            return d["k"] + 1, d["b"]
        if d["s"] == "R":
            return d["k"] - 1, d["b"]
        if d["s"] == "T":
            return (d["a"] + d["b"]) // 2, d["k"] + 1
        return (d["a"] + d["b"]) // 2, d["k"] - 1
    start = spot(room["doors"][0])
    seen, dq = {start}, deque([start])
    while dq:
        c, r = dq.popleft()
        anchor = (r + 1 < H and g[r + 1, c] == 1) or (c > 0 and g[r, c - 1] == 1) or (c + 1 < W and g[r, c + 1] == 1)
        moves = [(-1, 1), (0, 1), (1, 1), (-1, 0), (1, 0)]
        if anchor:
            moves += [(dx, -dy) for dy in range(1, 6) for dx in range(-3, 4)]
        for dx, dy in moves:
            nc, nr = c + dx, r + dy
            if (nc, nr) in seen or not free(nc, nr):
                continue
            n = max(abs(dx), abs(dy))
            if all(free(c + dx * i // n, r + dy * i // n) for i in range(1, n)):
                seen.add((nc, nr))
                dq.append((nc, nr))
    return [d for d in room["doors"][1:] if spot(d) not in seen]


# --- Salas ---
names = []
for l in LINKS:
    for n in (l[0], l[3]):
        if n not in names:
            names.append(n)
rooms = {}
for n in names:
    a = np.array(Image.open(MAPS / f"{n}.png").convert("RGBA")).astype(int)
    rooms[n] = {"name": n, "region": REGION[n.split("_")[0]], "px": a, "raw": find_doors(a),
                "grid": to_grid(interior(a)), "doors": []}

used = {}
def door_of(room, side, i):
    key = (room["name"], side, i)
    if key in used:
        return used[key]
    if room["name"] == "Town" and side == "B":
        h, w = room["px"].shape[:2]
        g = room["grid"]
        x = int(w * TOWN_WELL_X)
        c = int(x * S) + PAD
        floor = next(r for r in range(PAD, g.shape[0]) if g[r, c] == 0 and g[r + 1, c] == 1) + 1
        raw = ((floor - PAD) / S, x - 3, x + 3)
    else:
        raw = room["raw"][side][i]
    d = carve(room, side, *raw)
    d["raw"] = raw
    room["doors"].append(d)
    used[key] = d
    return d

order = {n: i for i, n in enumerate(names)}
for an, sa, ia, bn, sb, ib in LINKS:
    da, db = door_of(rooms[an], sa, ia), door_of(rooms[bn], sb, ib)
    da["to"], db["to"] = order[bn], order[an]
    da["td"], db["td"] = sb + str(ib), sa + str(ia)
    da["id"], db["id"] = sa + str(ia), sb + str(ib)

# Posición en el mapa: cada sala se coloca para que sus puertas coincidan
pos = {"Town": (0, 0)}
pending = deque(["Town"])
while pending:
    n = pending.popleft()
    for an, sa, ia, bn, sb, ib in LINKS:
        for x, sx, ix, y, sy, iy in ((an, sa, ia, bn, sb, ib), (bn, sb, ib, an, sa, ia)):
            if x == n and y not in pos:
                ra, rb = used[(x, sx, ix)]["raw"], used[(y, sy, iy)]["raw"]
                midA, midB = (ra[1] + ra[2]) / 2, (rb[1] + rb[2]) / 2
                px, py = pos[x]
                if sx in "LR":
                    pos[y] = (px + ra[0] - rb[0] + (-1 if sx == "L" else 1), py + midA - midB)
                else:
                    pos[y] = (px + midA - midB, py + ra[0] - rb[0] + (-1 if sx == "T" else 1))
                pending.append(y)

problems = 0
for i, n in enumerate(names):
    r = rooms[n]
    add_platforms(r)
    place(r, i)
    bad = check(r)
    if bad:
        problems += 1
        print("  PUERTA INALCANZABLE", n, [d["id"] for d in bad])

# --- Atlas del mapa ---
sheet_w = 1400
x = y = rowh = 0
placed = []
for n in names:
    im = Image.open(MAPS / f"{n}.png").convert("RGBA")
    if x + im.width > sheet_w:
        x, y, rowh = 0, y + rowh + 2, 0
    placed.append((n, im, x, y))
    rooms[n]["atlas"] = [x, y, im.width, im.height]
    x += im.width + 2
    rowh = max(rowh, im.height)
mapa = Image.new("RGBA", (sheet_w, y + rowh))
for n, im, ax, ay in placed:
    mapa.paste(im, (ax, ay))
mapa.save(HERE / "mapa.png", optimize=True)

# --- Atlas de enemigos (a doble resolución para que se vean nítidos) ---
frames, out, x = {}, [], 0
for key, (atlas, rot, pts, height, face) in ENEMIES.items():
    im = Image.open(ENEM / f"{atlas}.png").convert("RGBA")
    a = np.array(im)[..., 3] > 30
    # En el Husk los fotogramas casi se tocan: dilatar la máscara uniría dos sprites
    lab, _ = ni.label(a if key == "husk" else ni.binary_dilation(a, iterations=1))
    objs = ni.find_objects(lab)
    near = ni.distance_transform_edt(lab == 0, return_indices=True)[1]
    fr = []
    for px, py in pts:
        k = lab[py, px] or lab[near[0][py, px], near[1][py, px]]
        s = objs[k - 1]
        f = im.crop((s[1].start, s[0].start, s[1].stop, s[0].stop)).rotate(rot, expand=True)
        z = height * 2 / f.height
        f = f.resize((max(1, int(f.width * z)), height * 2), Image.LANCZOS)
        out.append((f, x))
        fr.append([x, 0, f.width, f.height])
        x += f.width + 2
    frames[key] = {"f": fr, "face": face}
atlas = Image.new("RGBA", (x, max(f.height for f, _ in out)))
for f, fx in out:
    atlas.paste(f, (fx, 0))
atlas.save(HERE / "enemigos.png", optimize=True)

# --- Datos ---
world = {"rooms": [], "enemies": frames}
for n in names:
    r = rooms[n]
    h, w = r["grid"].shape
    world["rooms"].append({
        "n": n, "reg": r["region"], "w": w, "h": h, "g": rle(r["grid"]), "bench": r["bench"], "en": r["enemies"],
        "doors": [{k: d[k] for k in ("s", "k", "a", "b", "to", "td", "id")} for d in r["doors"]],
        "map": [round(pos[n][0]), round(pos[n][1])] + r["atlas"],
    })
(HERE / "mundo.json").write_text(json.dumps(world, separators=(",", ":")), encoding="utf-8")
print(len(names), "salas,", sum(len(r["enemies"]) for r in rooms.values()), "enemigos,", problems, "salas con problemas")
print("tamaños:", " ".join(f"{n.replace('Crossroads_', 'C').replace('Fungus', 'F').replace('Ruins1_', 'R')}:{rooms[n]['grid'].shape[1]}x{rooms[n]['grid'].shape[0]}" for n in names))
xs = [pos[n][0] for n in names]
print("mapa x", min(xs), max(xs), "y", min(pos[n][1] for n in names), max(pos[n][1] for n in names))
print("json KB", (HERE / "mundo.json").stat().st_size // 1024, "enemigos KB", (HERE / "enemigos.png").stat().st_size // 1024, "mapa KB", (HERE / "mapa.png").stat().st_size // 1024)
