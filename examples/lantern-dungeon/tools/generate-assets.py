"""Reproducible Lantern Vault GLBs. Python >=3.10 + Pillow (requirements.txt).
Geometry is authored in meters, +Y up, creatures face -Z. No modeling service.
Flat-shaded beveled meshes, UVs, embedded PBR textures and rigid-node animation.
"""

from pathlib import Path
import argparse, math, json, struct, hashlib, io
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "asset-src"
TAU = math.tau
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--check", action="store_true", help="Compare generated outputs without writing."
)
parser.add_argument(
    "--out-dir", help="Write a review export beneath the example, preserving the editing masters."
)
args = parser.parse_args()
OUTPUT = (ROOT / args.out_dir).resolve() if args.out_dir else SRC
PENDING = {}


def write_output(path, data):
    # Defer writes until every existing output has passed the preservation check.
    PENDING[OUTPUT / path.relative_to(SRC)] = data


def finish_outputs():
    catalog_path = OUTPUT / "catalog.json"
    previous = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.exists() else {}
    hashes = {}
    for asset in previous.get("assets", []):
        hashes[OUTPUT / Path(asset["source"]).relative_to("asset-src")] = asset["sourceSha256"]
    for texture in previous.get("textures", []):
        hashes[OUTPUT / Path(texture["source"]).relative_to("asset-src")] = texture["sha256"]
    errors = []
    for path, data in PENDING.items():
        current = path.read_bytes() if path.exists() else None
        if args.check:
            if current != data:
                errors.append(f"Stale generated output: {path}")
        elif current is not None and current != data and path != catalog_path:
            if hashlib.sha256(current).hexdigest() != hashes.get(path):
                errors.append(f"Preserving hand-edited or untracked master: {path}")
    if errors:
        raise SystemExit(
            "\n".join(errors)
            + "\nNo files changed. Use --out-dir .tmp/generated-art to review a separate export."
        )
    if not args.check:
        for path, data in PENDING.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)


def format_catalog(value, indent=0):
    """Match the repo JSON style: object rows and compact scalar arrays."""
    prefix = " " * indent
    child = " " * (indent + 2)
    if isinstance(value, dict):
        rows = [
            child + json.dumps(k) + ": " + format_catalog(v, indent + 2) for k, v in value.items()
        ]
        return "{\n" + ",\n".join(rows) + "\n" + prefix + "}" if rows else "{}"
    if isinstance(value, list):
        if all(not isinstance(v, (dict, list)) for v in value):
            return json.dumps(value)
        return (
            "[\n"
            + ",\n".join(child + format_catalog(v, indent + 2) for v in value)
            + "\n"
            + prefix
            + "]"
        )
    return json.dumps(value)


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def mul(a, s):
    return tuple(x * s for x in a)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def unit(a):
    return mul(a, 1 / (math.sqrt(sum(x * x for x in a)) or 1))


def png(im):
    out = io.BytesIO()
    im.save(out, format="PNG", optimize=True)
    return out.getvalue()


# Keep the original generation untouched. Runtime mip budget: 256-square maps.
# Derive data maps from periodic luminance differences; G=roughness, B=nonmetal.
base = (
    Image.open(SRC / "shared/textures/limestone-source.png")
    .convert("RGB")
    .resize((256, 256), Image.Resampling.LANCZOS)
)
height = base.convert("L").filter(ImageFilter.GaussianBlur(0.6))
px = height.load()
normal = Image.new("RGB", base.size)
rough = Image.new("RGB", base.size)
for y in range(256):
    for x in range(256):
        n = unit(
            (
                (px[(x - 1) % 256, y] - px[(x + 1) % 256, y]) * 0.018,
                (px[x, (y + 1) % 256] - px[x, (y - 1) % 256]) * 0.018,
                1,
            )
        )
        normal.putpixel((x, y), tuple(round((v * 0.5 + 0.5) * 255) for v in n))
        rough.putpixel((x, y), (255, min(250, 210 + px[x, y] // 8), 0))
TEXTURES = [png(base), png(normal), png(rough)]
for name, data in zip(
    ["limestone-basecolor", "limestone-normal", "limestone-metallic-roughness"], TEXTURES
):
    write_output(SRC / "shared/textures" / f"{name}.png", data)


def material(name, color, metal=0, rough=0.8, emit=None, texture=False):
    p = {"baseColorFactor": [*color, 1], "metallicFactor": metal, "roughnessFactor": rough}
    m = {"name": name, "pbrMetallicRoughness": p}
    if texture:
        p["baseColorTexture"] = {"index": 0}
        p["metallicRoughnessTexture"] = {"index": 2}
        m["normalTexture"] = {"index": 1, "scale": 0.4}
    if emit:
        m["emissiveFactor"] = emit
    return m


M = {
    "crevice": material("Stone fissure", (0.035, 0.046, 0.045), 0, 1),
    "stone": material("Limestone / carved", (0.76, 0.79, 0.73), texture=True),
    "darkstone": material("Limestone / slate", (0.4, 0.48, 0.5), texture=True),
    "moss": material("Limestone / lichen", (0.44, 0.57, 0.35), texture=True),
    "brass": material("Aged brass", (0.64, 0.39, 0.12), 0.72, 0.32),
    "iron": material("Forged iron", (0.13, 0.17, 0.2), 0.8, 0.4),
    "steel": material("Polished blade", (0.57, 0.69, 0.72), 0.85, 0.23),
    "bone": material("Old ivory", (0.8, 0.71, 0.48), 0, 0.75),
    "cloth": material("Funeral indigo", (0.13, 0.13, 0.28), 0, 0.91),
    "leather": material("Oxhide", (0.2, 0.08, 0.055), 0, 0.88),
    "wood": material("Oak heartwood", (0.31, 0.16, 0.075), 0, 0.82),
    "woodLight": material("Oak grain", (0.43, 0.25, 0.11), 0, 0.83),
    "teal": material("Soul glass", (0.05, 0.64, 0.51), 0.25, 0.25, (0.07, 0.8, 0.58)),
    "fire": material("Lantern amber", (0.95, 0.44, 0.035), 0, 0.38, (1, 0.46, 0.04)),
    "red": material("Garnet elixir", (0.5, 0.055, 0.095), 0.1, 0.25, (0.14, 0.01, 0.02)),
    "skin": material("Emberhide", (0.43, 0.14, 0.09), 0, 0.82),
    "fungus": material("Verdigris mushroom", (0.23, 0.48, 0.38), 0, 0.81),
    "gills": material("Mushroom gills", (0.61, 0.58, 0.38), 0, 0.9),
}


class Model:
    def __init__(self, name, category, description):
        self.name = name
        self.category = category
        self.description = description
        self.groups = {}
        self.group = "body"
        self.clips = []
        self.triangles = 0

    def face(self, pts, mat):
        # Convex polygons are triangulated as a fan. Degenerates are discarded.
        for i in range(1, len(pts) - 1):
            p = [pts[0], pts[i], pts[i + 1]]
            n = cross(sub(p[1], p[0]), sub(p[2], p[0]))
            if sum(x * x for x in n) < 1e-14:
                continue
            n = unit(n)
            dominant = max(range(3), key=lambda j: abs(n[j]))
            axes = [j for j in range(3) if j != dominant]
            g = self.groups.setdefault(self.group, {}).setdefault(mat, {"p": [], "n": [], "uv": []})
            for v in p:
                g["p"].extend(v)
                g["n"].extend(n)
                g["uv"].extend([v[axes[0]] * 0.65, v[axes[1]] * 0.65])
            self.triangles += 1

    def loft(self, rings, mat, cap=True):
        for a, b in zip(rings, rings[1:]):
            for i in range(len(a)):
                j = (i + 1) % len(a)
                self.face([a[i], b[i], b[j], a[j]], mat)
        if cap:
            self.face(rings[0], mat)
            self.face(list(reversed(rings[-1])), mat)

    def box(self, c, s, mat, b=0.025):
        # An octagonal perimeter with inset top/bottom creates real bevels.
        x, y, z = c
        w, h, d = [v / 2 for v in s]
        b = min(b, w * 0.4, h * 0.4, d * 0.4)

        def ring(w, d, Y):
            return [
                (x + X, Y, z + Z)
                for X, Z in [
                    (-w + b, -d),
                    (w - b, -d),
                    (w, -d + b),
                    (w, d - b),
                    (w - b, d),
                    (-w + b, d),
                    (-w, d - b),
                    (-w, -d + b),
                ]
            ]

        self.loft(
            [
                ring(w - b, d - b, y - h),
                ring(w, d, y - h + b),
                ring(w, d, y + h - b),
                ring(w - b, d - b, y + h),
            ],
            mat,
        )

    def ellipsoid(self, c, r, mat, n=12, k=8):
        rings = []
        for j in range(k + 1):
            ph = math.pi * j / k
            rings.append(
                [
                    (
                        c[0] + r[0] * math.sin(ph) * math.cos(TAU * i / n),
                        c[1] - r[1] * math.cos(ph),
                        c[2] + r[2] * math.sin(ph) * math.sin(TAU * i / n),
                    )
                    for i in range(n)
                ]
            )
        self.loft(rings, mat, False)

    def lathe(self, c, profile, mat, n=14):
        rings = [
            [
                (c[0] + r * math.cos(TAU * i / n), c[1] + y, c[2] + r * math.sin(TAU * i / n))
                for i in range(n)
            ]
            for y, r in profile
        ]
        self.loft(rings, mat)

    def rod(self, a, b, r, mat, r2=None, n=8):
        axis = unit(sub(b, a))
        u = unit(cross(axis, (0, 0, 1) if abs(axis[2]) < 0.9 else (0, 1, 0)))
        v = cross(u, axis)
        # XZ-style ring orientation: normals face out with loft's winding.
        rings = []
        for c, R in [(a, r), (b, r if r2 is None else r2)]:
            rings.append(
                [
                    add(
                        c, add(mul(u, math.cos(TAU * i / n) * R), mul(v, math.sin(TAU * i / n) * R))
                    )
                    for i in range(n)
                ]
            )
        self.loft(rings, mat)

    def curve(self, pts, r, mat):
        for a, b in zip(pts, pts[1:]):
            self.rod(a, b, r, mat, n=6)

    def torus(self, c, R, r, mat, axis="z", n=16):
        pts = []
        for i in range(n + 1):
            x, y = R * math.cos(TAU * i / n), R * math.sin(TAU * i / n)
            pts.append(add(c, (x, y, 0) if axis == "z" else (x, 0, y)))
        self.curve(pts, r, mat)

    def animate(self, group, path, values, duration=2, name="idle"):
        self.clips.append((name, group, path, values, duration))

    def write(self):
        blob = bytearray()
        g = {
            "asset": {"version": "2.0", "generator": "Lantern Vault editable mesh kit v1"},
            "scene": 0,
            "scenes": [{"nodes": []}],
            "nodes": [],
            "meshes": [],
            "materials": [],
            "accessors": [],
            "bufferViews": [],
            "buffers": [],
        }

        def chunk(data):
            while len(blob) % 4:
                blob.append(0)
            idx = len(g["bufferViews"])
            g["bufferViews"].append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)})
            blob.extend(data)
            return idx

        def acc(vals, kind):
            size = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[kind]
            idx = len(g["accessors"])
            a = {
                "bufferView": chunk(struct.pack("<" + "f" * len(vals), *vals)),
                "componentType": 5126,
                "count": len(vals) // size,
                "type": kind,
            }
            if kind in ["VEC3", "SCALAR"]:
                a["min"] = [min(vals[j::size]) for j in range(size)]
                a["max"] = [max(vals[j::size]) for j in range(size)]
            g["accessors"].append(a)
            return idx

        mats = list(dict.fromkeys(m for group in self.groups.values() for m in group))
        g["materials"] = [M[m] for m in mats]
        if any("normalTexture" in m for m in g["materials"]):
            g["images"] = [
                {"name": name, "bufferView": chunk(data), "mimeType": "image/png"}
                for name, data in zip(
                    ["limestone-basecolor", "limestone-normal", "limestone-metallic-roughness"],
                    TEXTURES,
                )
            ]
            g["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
            g["textures"] = [{"sampler": 0, "source": i} for i in range(3)]
        groups = list(self.groups)
        for group, prims in self.groups.items():
            mesh = {"name": f"{self.name}/{group}", "primitives": []}
            for mat, data in prims.items():
                mesh["primitives"].append(
                    {
                        "attributes": {
                            "POSITION": acc(data["p"], "VEC3"),
                            "NORMAL": acc(data["n"], "VEC3"),
                            "TEXCOORD_0": acc(data["uv"], "VEC2"),
                        },
                        "material": mats.index(mat),
                    }
                )
            idx = len(g["nodes"])
            g["nodes"].append({"name": group, "mesh": len(g["meshes"])})
            g["meshes"].append(mesh)
            g["scenes"][0]["nodes"].append(idx)
        animations = {}
        for name, group, path, values, duration in self.clips:
            if path == "rotation":
                values = [unit(v) for v in values]
            anim = animations.setdefault(name, {"name": name, "samplers": [], "channels": []})
            idx = len(anim["samplers"])
            anim["samplers"].append(
                {
                    "input": acc(
                        [i * duration / (len(values) - 1) for i in range(len(values))], "SCALAR"
                    ),
                    "output": acc(
                        [v for p in values for v in p], "VEC4" if path == "rotation" else "VEC3"
                    ),
                    "interpolation": "LINEAR",
                }
            )
            anim["channels"].append(
                {"sampler": idx, "target": {"node": groups.index(group), "path": path}}
            )
        if animations:
            g["animations"] = list(animations.values())
        g["buffers"] = [{"byteLength": len(blob)}]
        js = json.dumps(g, separators=(",", ":")).encode()
        js += b" " * ((-len(js)) % 4)
        blob.extend(b"\0" * ((-len(blob)) % 4))
        glb = (
            struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
            + struct.pack("<II", len(js), 0x4E4F534A)
            + js
            + struct.pack("<II", len(blob), 0x004E4942)
            + blob
        )
        path = SRC / self.category / self.name / "models" / "source.glb"
        write_output(path, glb)
        return {
            "id": f"lantern.{self.category}.{self.name.replace(chr(45), chr(95))}",
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "source": str(path.relative_to(ROOT)).replace("\\", "/"),
            "sourceSha256": hashlib.sha256(glb).hexdigest(),
            "sourceBytes": len(glb),
            "triangles": self.triangles,
            "materials": len(mats),
            "primitives": sum(len(p) for p in self.groups.values()),
            "textures": len(g.get("textures", [])),
            "clips": list(animations),
        }


ASSETS = []


def start(name, cat, desc):
    m = Model(name, cat, desc)
    ASSETS.append(m)
    return m


def skull(m, c, s=1):
    x, y, z = c
    m.ellipsoid(c, (0.22 * s, 0.26 * s, 0.19 * s), "bone")
    for dx in [-0.09, 0.09]:
        m.ellipsoid(
            (x + dx * s, y + 0.03 * s, z - 0.17 * s), (0.07 * s, 0.08 * s, 0.045 * s), "iron", 8, 6
        )
        m.ellipsoid(
            (x + dx * s, y + 0.04 * s, z - 0.205 * s),
            (0.027 * s, 0.032 * s, 0.014 * s),
            "teal",
            8,
            6,
        )
    m.box((x, y - 0.17 * s, z - 0.1 * s), (0.26 * s, 0.1 * s, 0.16 * s), "bone", 0.02 * s)
    for dx in [-0.085, -0.028, 0.028, 0.085]:
        m.box(
            (x + dx * s, y - 0.2 * s, z - 0.17 * s),
            (0.035 * s, 0.09 * s, 0.05 * s),
            "bone",
            0.007 * s,
        )


def wing(m, side, y, mat):
    # Thick convex membrane panels and raised finger bones, facing -Z.
    a = (side * 0.2, y, 0)
    b = (side * 0.68, y + 0.55, 0.08)
    c = (side * 1.12, y + 0.27, 0.13)
    d = (side * 0.66, y - 0.12, 0.03)
    for tri in [[a, b, d], [b, c, d]]:
        front = [add(p, (0, 0, -0.025)) for p in tri]
        back = [add(p, (0, 0, 0.025)) for p in tri]
        n = cross(sub(front[1], front[0]), sub(front[2], front[0]))
        if n[2] > 0:
            front.reverse()
            back.reverse()
        m.face(front, mat)
        m.face(list(reversed(back)), mat)
        for i in range(3):
            j = (i + 1) % 3
            m.face([front[i], front[j], back[j], back[i]], mat)
    m.curve([a, b, c], 0.027, "bone")
    m.rod(b, d, 0.018, "bone")
    m.rod(a, d, 0.021, "bone")


# Six creatures: reusable autonomous silhouettes; idle clips use rigid node tracks.
m = start(
    "ossuary-knight", "mob", "Armored skeleton with crowned skull, rib cage, sword and buckler."
)
for s in [-1, 1]:
    m.box((s * 0.16, 0.09, 0.01), (0.24, 0.18, 0.4), "iron")
    m.rod((s * 0.16, 0.2, 0), (s * 0.14, 0.8, 0), 0.06, "bone")
    m.ellipsoid((s * 0.15, 0.5, 0), (0.09, 0.1, 0.09), "brass")
    m.ellipsoid((s * 0.33, 1.3, 0), (0.19, 0.12, 0.23), "iron")
    m.rod((s * 0.35, 1.23, 0), (s * 0.43, 0.85, -0.13), 0.055, "bone")
m.box((0, 0.84, 0), (0.42, 0.17, 0.26), "leather")
m.rod((0, 0.9, 0.08), (0, 1.46, 0.08), 0.045, "bone")
for y in [1, 1.12, 1.24]:
    for s in [-1, 1]:
        m.curve(
            [
                (0, y, 0.08),
                (s * 0.23, y + 0.04, -0.01),
                (s * 0.19, y, -0.18),
                (s * 0.04, y - 0.04, -0.2),
            ],
            0.033,
            "bone",
        )
skull(m, (0, 1.66, -0.01))
m.torus((0, 1.8, 0), 0.205, 0.03, "brass", axis="y")
for x in [-0.15, 0, 0.15]:
    m.rod((x, 1.79, -0.12), (x, 1.97, -0.12), 0.035, "brass", 0.003)
m.rod((-0.45, 0.7, -0.2), (-0.45, 1.1, -0.2), 0.045, "leather")
m.box((-0.45, 1.03, -0.2), (0.36, 0.055, 0.1), "brass")
m.rod((-0.45, 1.1, -0.2), (-0.45, 1.76, -0.2), 0.06, "steel", 0.001, 4)
m.ellipsoid((0.43, 0.92, -0.23), (0.27, 0.33, 0.08), "iron")
m.torus((0.43, 0.92, -0.3), 0.24, 0.025, "brass")
m.ellipsoid((0.43, 0.92, -0.32), (0.07, 0.07, 0.05), "brass")
m.animate("body", "translation", [(0, 0, 0), (0, 0.035, 0), (0, 0, 0)], 2.2)

m = start(
    "veil-wraith", "mob", "Hooded spectral keeper with a torn indigo mantle and luminous face."
)
m.lathe((0, 0, 0), [(0.12, 0.12), (0.28, 0.42), (0.7, 0.35), (1.25, 0.3), (1.48, 0.2)], "cloth", 10)
for i in range(7):
    a = TAU * i / 7
    m.rod(
        (0.32 * math.cos(a), 0.6, 0.32 * math.sin(a)),
        (0.42 * math.cos(a), 0.03 + 0.07 * (i % 3), 0.42 * math.sin(a)),
        0.085,
        "cloth",
        0.003,
    )
m.ellipsoid((0, 1.63, 0), (0.31, 0.36, 0.25), "cloth")
m.ellipsoid((0, 1.64, -0.2), (0.21, 0.25, 0.045), "iron")
for x in [-0.075, 0.075]:
    m.ellipsoid((x, 1.68, -0.246), (0.035, 0.04, 0.02), "teal", 8, 6)
for s in [-1, 1]:
    m.rod((s * 0.25, 1.3, 0), (s * 0.62, 0.93, -0.18), 0.15, "cloth", 0.095)
    for j in range(3):
        m.rod(
            (s * 0.59, 0.92, -0.17 - j * 0.045),
            (s * 0.64, 0.77, -0.26 - j * 0.045),
            0.018,
            "bone",
            0.008,
        )
m.torus((0, 1.23, -0.26), 0.1, 0.019, "brass")
m.ellipsoid((0, 1.23, -0.28), (0.04, 0.07, 0.03), "teal")
m.animate("body", "translation", [(0, 0, 0), (0, 0.13, 0), (0, 0, 0)], 2.8)

m = start(
    "mossback", "mob", "Squat fungal guardian with a broad turquoise cap, gills, roots and spores."
)
m.ellipsoid((0, 0.72, 0), (0.43, 0.57, 0.32), "gills")
for s in [-1, 1]:
    m.ellipsoid((s * 0.23, 0.2, -0.04), (0.22, 0.22, 0.32), "moss")
    m.rod((s * 0.3, 0.95, 0), (s * 0.62, 0.5, -0.1), 0.15, "gills", 0.09)
m.lathe(
    (0, 0, 0), [(1.08, 0.12), (1.19, 0.63), (1.34, 0.7), (1.5, 0.48), (1.63, 0.08)], "fungus", 16
)
for i in range(16):
    a = TAU * i / 16
    m.rod(
        (0.17 * math.cos(a), 1.11, 0.17 * math.sin(a)),
        (0.59 * math.cos(a), 1.2, 0.59 * math.sin(a)),
        0.017,
        "gills",
    )
for x in [-0.14, 0.14]:
    m.ellipsoid((x, 0.97, -0.295), (0.042, 0.06, 0.023), "teal", 8, 6)
for x, z in [(-0.28, -0.23), (0.26, -0.19), (0.1, 0.29), (-0.19, 0.16)]:
    m.ellipsoid((x, 1.48, z), (0.08, 0.035, 0.08), "bone", 8, 6)
m.animate("body", "scale", [(1, 1, 1), (1.025, 0.98, 1.025), (1, 1, 1)], 2)

m = start(
    "vault-bat", "mob", "Wide-winged cave familiar with raised finger bones, ears and jade eyes."
)
m.ellipsoid((0, 0.52, 0), (0.18, 0.28, 0.16), "leather")
m.ellipsoid((0, 0.76, -0.04), (0.17, 0.17, 0.16), "leather")
for s in [-1, 1]:
    m.rod((s * 0.11, 0.83, 0), (s * 0.18, 1.1, 0.01), 0.085, "leather", 0.003)
    m.ellipsoid((s * 0.065, 0.78, -0.18), (0.032, 0.035, 0.015), "teal", 8, 6)
    m.group = "wing-left" if s < 0 else "wing-right"
    wing(m, s, 0.5, "cloth")
    m.animate(
        m.group,
        "rotation",
        [(0, 0, -s * 0.12, 0.9928), (0, 0, s * 0.24, 0.9708), (0, 0, -s * 0.12, 0.9928)],
        0.7,
    )
m.group = "body"
m.animate("body", "translation", [(0, 0, 0), (0, 0.05, 0), (0, 0, 0)], 0.7)

m = start("stone-gargoyle", "mob", "Horned carved gargoyle with folded bat wings and taloned feet.")
m.ellipsoid((0, 0.82, 0), (0.36, 0.53, 0.28), "darkstone")
m.ellipsoid((0, 1.35, -0.1), (0.25, 0.27, 0.24), "stone")
for s in [-1, 1]:
    m.box((s * 0.22, 0.12, -0.13), (0.27, 0.24, 0.46), "darkstone")
    m.rod((s * 0.21, 0.28, 0), (s * 0.23, 0.71, 0), 0.13, "darkstone")
    m.rod((s * 0.27, 1.06, 0), (s * 0.48, 0.57, -0.15), 0.12, "darkstone", 0.08)
    m.rod((s * 0.17, 1.51, -0.04), (s * 0.31, 1.83, 0.03), 0.075, "darkstone", 0.003)
    m.ellipsoid((s * 0.1, 1.41, -0.307), (0.042, 0.031, 0.016), "teal", 8, 6)
    wing(m, s, 0.93, "darkstone")
m.box((0, 1.22, -0.28), (0.24, 0.09, 0.13), "stone")
m.animate(
    "body",
    "rotation",
    [(0, -0.025, 0, 0.99969), (0, 0.025, 0, 0.99969), (0, -0.025, 0, 0.99969)],
    3,
)

m = start(
    "ember-imp", "mob", "Small red horned scavenger with long ears, curled tail and amber eyes."
)
m.ellipsoid((0, 0.62, 0), (0.23, 0.31, 0.2), "skin")
m.ellipsoid((0, 1.01, -0.04), (0.25, 0.24, 0.2), "skin")
for s in [-1, 1]:
    m.rod((s * 0.13, 0.42, 0), (s * 0.21, 0.1, -0.07), 0.075, "skin")
    m.box((s * 0.2, 0.07, -0.11), (0.18, 0.14, 0.26), "iron")
    m.rod((s * 0.18, 0.78, 0), (s * 0.4, 0.55, -0.12), 0.065, "skin")
    m.rod((s * 0.23, 1.06, 0), (s * 0.48, 1.2, 0.08), 0.09, "skin", 0.003)
    m.curve([(s * 0.15, 1.18, 0), (s * 0.19, 1.37, 0.02), (s * 0.11, 1.47, -0.01)], 0.039, "bone")
    m.ellipsoid((s * 0.09, 1.06, -0.224), (0.05, 0.038, 0.018), "fire", 8, 6)
m.curve([(0, 0.45, 0.15), (0.25, 0.35, 0.5), (0.47, 0.56, 0.55), (0.4, 0.77, 0.48)], 0.035, "skin")
m.box((0, 0.48, 0), (0.45, 0.12, 0.33), "leather")
m.box((0, 0.49, -0.19), (0.11, 0.1, 0.04), "brass")
m.animate("body", "translation", [(0, 0, 0), (0, 0.06, 0), (0, 0, 0)], 1.1)

# Eight architectural modules, designed on the vault's three-meter grid.
for name, mat, desc in [
    ("ashlar-wall", "stone", "Beveled dressed limestone masonry, three-meter block."),
    ("moss-wall", "moss", "Lichen-tinted damp masonry with projecting foundation stones."),
    ("rune-wall", "darkstone", "Slate masonry bearing a raised brass and soul-glass sigil."),
]:
    m = start(name, "architecture", desc)
    m.box((0, 1.65, 0), (2.97, 3.3, 2.97), "darkstone", 0.04)
    for side in range(4):
        for row in range(6):
            # Offset running bond. End stones finish exactly at the module edge.
            edges = [-1.5, -0.5, 0.5, 1.5] if row % 2 == 0 else [-1.5, -1, 0, 1, 1.5]
            for a, b in zip(edges, edges[1:]):
                x = (a + b) / 2
                y = 0.275 + row * 0.55
                z = 1.475
                c, s = (
                    ((x, y, z), (b - a - 0.025, 0.523, 0.12))
                    if side == 0
                    else (
                        ((x, y, -z), (b - a - 0.025, 0.523, 0.12))
                        if side == 1
                        else (
                            ((z, y, x), (0.12, 0.523, b - a - 0.025))
                            if side == 2
                            else ((-z, y, x), (0.12, 0.523, b - a - 0.025))
                        )
                    )
                )
                m.box(c, s, mat, 0.035)
    for y in [0.12, 3.16]:
        m.box((0, y, 0), (3.09, 0.22, 3.09), "darkstone", 0.035)
    if name == "rune-wall":
        for z in [-1.558, 1.558]:
            m.torus((0, 1.7, z), 0.38, 0.025, "brass")
            m.curve(
                [(-0.18, 1.52, z), (0, 2.05, z), (0.18, 1.52, z), (0, 1.72, z), (-0.18, 1.52, z)],
                0.026,
                "teal",
            )
for name, mat in [("flagstone-floor", "stone"), ("broken-floor", "darkstone")]:
    m = start(
        name,
        "architecture",
        "Three-meter walkable tile of individually beveled flagstones; origin at surface level.",
    )
    for x in range(3):
        for z in range(3):
            m.box((x - 1, -0.065, z - 1), (0.98, 0.13, 0.98), mat, 0.027)
    if name == "broken-floor":
        pts = [
            (-1.4, 0.001, -0.9),
            (-0.87, 0.001, -0.58),
            (-0.48, 0.001, -0.7),
            (0.16, 0.001, 0.17),
            (0.35, 0.001, 0.6),
            (1.2, 0.001, 1.3),
        ]
        for a, b in zip(pts, pts[1:]):
            v = mul(unit(cross(sub(b, a), (0, 1, 0))), 0.012)
            m.face([sub(a, v), add(a, v), add(b, v), sub(b, v)], "crevice")
m = start(
    "vaulted-ceiling",
    "architecture",
    "Three-meter coffered ceiling with crossing stone ribs; mount at wall-top height.",
)
m.box((0, 0.53, 0), (3, 0.16, 3), "darkstone")
for axis in range(2):
    pts = [
        (-1.5, 0.02, 0),
        (-1.15, 0.2, 0),
        (-0.65, 0.38, 0),
        (0, 0.44, 0),
        (0.65, 0.38, 0),
        (1.15, 0.2, 0),
        (1.5, 0.02, 0),
    ]
    if axis:
        pts = [(z, y, x) for x, y, z in pts]
    m.curve(pts, 0.09, "stone")
m.ellipsoid((0, 0.31, 0), (0.17, 0.11, 0.17), "brass")
m = start(
    "gothic-arch",
    "architecture",
    "Pointed vault doorway with flanking columns and individual voussoirs.",
)
for s in [-1, 1]:
    m.box((s * 1.65, 1.2, 0), (0.3, 2.4, 0.55), "stone")
    m.box((s * 1.65, 0.12, 0), (0.46, 0.24, 0.7), "darkstone")
    m.box((s * 1.65, 2.37, 0), (0.46, 0.2, 0.7), "brass")
    pts = [(s * 1.65, 2.42, 0), (s * 1.3, 2.73, 0), (s * 0.8, 3.05, 0), (0, 3.42, 0)]
    m.curve(pts, 0.17, "stone")
m.box((0, 3.28, 0), (0.28, 0.38, 0.48), "brass")
m = start(
    "carved-column",
    "architecture",
    "Fluted freestanding column with octagonal base and gilded capital.",
)
m.lathe(
    (0, 0, 0),
    [
        (0, 0.36),
        (0.17, 0.36),
        (0.25, 0.27),
        (0.36, 0.25),
        (2.57, 0.25),
        (2.65, 0.34),
        (2.82, 0.36),
        (2.95, 0.31),
    ],
    "stone",
    12,
)
for i in range(8):
    a = TAU * i / 8
    m.rod(
        (0.23 * math.cos(a), 0.42, 0.23 * math.sin(a)),
        (0.23 * math.cos(a), 2.5, 0.23 * math.sin(a)),
        0.033,
        "darkstone",
    )
for y in [0.28, 2.63, 2.87]:
    m.lathe((0, y, 0), [(0, 0.31), (0.06, 0.31)], "brass", 12)

# Fourteen props and items. Hanging gate uses its center pivot (matching the simulation).
m = start(
    "portcullis",
    "prop",
    "Forged iron sliding gate; center pivot, three meters high, with a brass lock.",
)
for x in [-1.32, -0.88, -0.44, 0, 0.44, 0.88, 1.32]:
    m.rod((x, -1.32, 0), (x, 1.45, 0), 0.045, "iron", n=6)
    m.rod((x, -1.32, 0), (x, -1.5, 0), 0.08, "iron", 0.001)
for y in [-0.8, 0.3, 1.24]:
    m.box((0, y, 0), (2.98, 0.12, 0.12), "iron")
for x in [-1.32, 0, 1.32]:
    for y in [-0.8, 0.3, 1.24]:
        m.ellipsoid((x, y, -0.1), (0.055, 0.055, 0.028), "brass", 8, 6)
m.box((0, 0, -0.12), (0.31, 0.43, 0.09), "brass")
m.rod((0, -0.06, -0.18), (0, 0.06, -0.18), 0.045, "iron", n=6)

m = start(
    "wall-torch",
    "prop",
    "Iron sconce, wrapped handle and faceted flame. Back at Z=0, flame projects toward -Z.",
)
m.box((0, 0.34, 0), (0.2, 0.68, 0.055), "iron")
m.rod((0, 0.18, -0.015), (0, 0.36, -0.28), 0.05, "iron")
m.rod((0, 0.15, -0.28), (0, 0.63, -0.36), 0.062, "wood")
m.lathe((0, 0.53, -0.35), [(0, 0.08), (0.13, 0.11)], "iron", 8)
m.ellipsoid((0, 0.77, -0.36), (0.1, 0.24, 0.09), "fire", 9, 7)
m.rod((0, 0.86, -0.36), (0.045, 1.1, -0.34), 0.073, "fire", 0.001)

m = start(
    "hanging-brazier",
    "prop",
    "Suspended brass fire bowl and three chain supports, origin at bowl underside.",
)
m.lathe((0, 0, 0), [(0, 0.14), (0.1, 0.28), (0.22, 0.4), (0.28, 0.4)], "iron", 12)
m.torus((0, 0.27, 0), 0.39, 0.035, "brass", axis="y")
for i in range(3):
    a = TAU * i / 3
    m.rod(
        (math.cos(a) * 0.35, 0.27, math.sin(a) * 0.35),
        (math.cos(a) * 0.09, 1.1, math.sin(a) * 0.09),
        0.016,
        "brass",
    )
for x, z in [(-0.16, 0.03), (0.14, 0.03), (0, -0.1)]:
    m.ellipsoid((x, 0.43, z), (0.1, 0.27, 0.1), "fire", 8, 6)
m.torus((0, 1.12, 0), 0.09, 0.021, "brass")

m = start(
    "reliquary-lantern",
    "item",
    "Hero lantern: octagonal brass cage, jade core, crown and carry ring.",
)
m.lathe((0, 0, 0), [(0, 0.22), (0.08, 0.25), (0.13, 0.19), (0.18, 0.18)], "brass", 8)
m.lathe((0, 0, 0), [(0.16, 0.13), (0.47, 0.13), (0.58, 0.07)], "teal", 8)
for i in range(8):
    a = TAU * i / 8
    m.rod(
        (0.185 * math.cos(a), 0.12, 0.185 * math.sin(a)),
        (0.185 * math.cos(a), 0.57, 0.185 * math.sin(a)),
        0.022,
        "brass",
    )
m.lathe((0, 0, 0), [(0.55, 0.22), (0.62, 0.24), (0.76, 0.07), (0.79, 0.05)], "brass", 8)
m.torus((0, 0.89, 0), 0.1, 0.025, "brass")

m = start("brass-key", "item", "Ornate vault key with a four-lobed bow and three shaped teeth.")
m.torus((0, 0.48, 0), 0.14, 0.035, "brass")
m.torus((0, 0.48, 0), 0.065, 0.019, "brass")
m.rod((0, 0.04, 0), (0, 0.36, 0), 0.035, "brass")
for y in [0.06, 0.13, 0.2]:
    m.box((0.07, y, 0), (0.14, 0.037, 0.05), "brass", 0.007)
m.ellipsoid((0, 0.48, -0.035), (0.035, 0.035, 0.02), "teal", 8, 6)

m = start(
    "healing-potion",
    "item",
    "Faceted garnet potion bottle with brass collar, stopper and ivory label.",
)
m.lathe((0, 0, 0), [(0, 0.12), (0.04, 0.16), (0.27, 0.17), (0.35, 0.065), (0.44, 0.065)], "red", 12)
m.lathe((0, 0, 0), [(0.37, 0.08), (0.43, 0.08)], "brass", 12)
m.lathe((0, 0, 0), [(0.42, 0.055), (0.5, 0.065)], "wood", 8)
m.box((0, 0.19, -0.166), (0.14, 0.15, 0.012), "bone", 0.007)
m.box((0, 0.19, -0.18), (0.03, 0.1, 0.01), "red", 0.002)
m.box((0, 0.19, -0.18), (0.09, 0.03, 0.01), "red", 0.002)

m = start(
    "longsword",
    "item",
    "Leaf-point steel longsword with a central ridge, swept guard and wrapped hilt; grip origin.",
)
m.rod((0, 0, 0), (0, 0.25, 0), 0.044, "leather")
m.ellipsoid((0, 0.01, 0), (0.073, 0.068, 0.05), "brass", 10, 6)
for y in [0.055, 0.095, 0.135, 0.175, 0.215]:
    m.torus((0, y, 0), 0.044, 0.007, "brass", axis="y", n=8)
m.curve(
    [(-0.25, 0.27, 0.025), (-0.15, 0.32, 0), (0, 0.28, 0), (0.15, 0.32, 0), (0.25, 0.27, 0.025)],
    0.035,
    "brass",
)
# Four faceted blade planes with a true diamond cross-section, tapered tip.
m.loft(
    [
        [(-0.072, 0.31, 0), (0, 0.31, -0.027), (0.072, 0.31, 0), (0, 0.31, 0.027)],
        [(-0.061, 1.04, 0), (0, 1.04, -0.021), (0.061, 1.04, 0), (0, 1.04, 0.021)],
        [(0, 1.24, 0)] * 4,
    ],
    "steel",
)
m.animate(
    "body",
    "rotation",
    [(0, 0, 0, 1), (0, 0, 0.5, 0.8660254), (0, 0, -0.25, 0.9682458), (0, 0, 0, 1)],
    0.38,
    "attack",
)

m = start(
    "round-shield",
    "item",
    "Oak-and-iron round shield with brass rim, center boss and radial rivets.",
)
m.ellipsoid((0, 0.42, 0), (0.42, 0.42, 0.08), "wood")
m.torus((0, 0.42, -0.055), 0.39, 0.033, "iron")
for i in range(10):
    a = TAU * i / 10
    m.ellipsoid(
        (0.36 * math.cos(a), 0.42 + 0.36 * math.sin(a), -0.084),
        (0.026, 0.026, 0.018),
        "brass",
        8,
        6,
    )
m.ellipsoid((0, 0.42, -0.095), (0.12, 0.12, 0.08), "iron")
m.rod((-0.2, 0.42, 0.07), (0.2, 0.42, 0.07), 0.03, "leather")

m = start(
    "treasure-chest", "prop", "Oak chest with an arched lid, iron straps, hinges and brass lock."
)
m.box((0, 0.3, 0), (1.1, 0.6, 0.7), "wood")
# Barrel-vault lid: shaped roof and end caps.
rings = []
for z in [-0.35, 0.35]:
    rings.append(
        [
            (0.55 * math.cos(math.pi * i / 12), 0.6 + 0.29 * math.sin(math.pi * i / 12), z)
            for i in range(13)
        ]
    )
for i in range(12):
    m.face([rings[0][i], rings[1][i], rings[1][i + 1], rings[0][i + 1]], "woodLight")
m.face(rings[0], "wood")
m.face(list(reversed(rings[1])), "wood")
for x in [-0.4, 0.4]:
    m.box((x, 0.3, -0.36), (0.08, 0.6, 0.055), "iron")
    m.box((x, 0.3, 0.36), (0.08, 0.6, 0.055), "iron")
for y in [0.09, 0.54]:
    m.box((0, y, -0.36), (1.1, 0.045, 0.045), "iron")
m.box((0, 0.52, -0.395), (0.17, 0.24, 0.06), "brass")
m.ellipsoid((0, 0.52, -0.44), (0.023, 0.034, 0.013), "iron", 8, 6)

m = start(
    "oak-barrel", "prop", "Staved barrel with a swollen profile, inset lid and four iron hoops."
)
m.lathe((0, 0, 0), [(0, 0.31), (0.1, 0.34), (0.48, 0.4), (0.82, 0.36), (0.94, 0.31)], "wood", 16)
for i in range(16):
    a = TAU * i / 16
    m.curve(
        [
            (math.cos(a) * r, y, math.sin(a) * r)
            for y, r in [(0, 0.314), (0.1, 0.344), (0.48, 0.404), (0.82, 0.364), (0.94, 0.314)]
        ],
        0.009,
        "woodLight",
    )
for y, r in [(0.08, 0.35), (0.28, 0.39), (0.68, 0.39), (0.87, 0.35)]:
    m.lathe((0, y, 0), [(0, r), (0.06, r)], "iron", 16)
m.lathe((0, 0.925, 0), [(0, 0.28), (0.018, 0.28)], "woodLight", 16)

m = start(
    "supply-crate",
    "prop",
    "Braced oak crate with individual planks, iron corner shoes and nail heads.",
)
for i in range(5):
    m.box((-0.32 + i * 0.16, 0.4, 0), (0.155, 0.77, 0.78), "wood" if i % 2 else "woodLight", 0.008)
for z in [-0.42, 0.42]:
    for y in [0.08, 0.72]:
        m.box((0, y, z), (0.9, 0.12, 0.09), "woodLight")
    m.rod((-0.36, 0.13, z), (0.36, 0.68, z), 0.062, "woodLight", n=4)
    for x in [-0.35, 0.35]:
        for y in [0.08, 0.72]:
            m.ellipsoid((x, y, z * 1.1), (0.027, 0.027, 0.015), "iron", 8, 6)

m = start(
    "funerary-urn",
    "prop",
    "Carved funerary vessel with a narrow foot, broad shoulders and brass rings.",
)
m.lathe(
    (0, 0, 0),
    [
        (0, 0.2),
        (0.08, 0.21),
        (0.13, 0.13),
        (0.26, 0.18),
        (0.52, 0.3),
        (0.7, 0.26),
        (0.78, 0.15),
        (0.83, 0.17),
    ],
    "darkstone",
    16,
)
for y, r in [(0.1, 0.16), (0.67, 0.29), (0.82, 0.19)]:
    m.lathe((0, y, 0), [(0, r), (0.04, r)], "brass", 16)
for s in [-1, 1]:
    m.torus((s * 0.27, 0.63, 0), 0.09, 0.022, "brass")

m = start(
    "bone-pile", "prop", "Scattered femurs and an intact glowing-eyed skull for dungeon dressing."
)
for i, (a, b) in enumerate(
    [
        ((-0.45, 0.07, -0.2), (0.35, 0.07, 0.26)),
        ((-0.3, 0.13, 0.28), (0.39, 0.13, -0.21)),
        ((-0.47, 0.18, 0.14), (0.1, 0.18, -0.24)),
    ]
):
    m.rod(a, b, 0.035, "bone")
    m.ellipsoid(a, (0.07, 0.055, 0.06), "bone", 8, 6)
    m.ellipsoid(b, (0.065, 0.055, 0.06), "bone", 8, 6)
skull(m, (0.14, 0.3, 0.1), 0.68)

m = start(
    "soul-crystals", "prop", "Cluster of six faceted jade crystals rooted in fractured slate."
)
m.ellipsoid((0, 0.1, 0), (0.5, 0.14, 0.38), "darkstone", 10, 5)
for x, z, h, r in [
    (-0.23, 0, 0.65, 0.12),
    (0, 0.03, 1.05, 0.15),
    (0.23, -0.07, 0.72, 0.11),
    (0.1, -0.22, 0.52, 0.1),
    (-0.12, 0.22, 0.42, 0.09),
    (0.31, 0.17, 0.36, 0.085),
]:
    m.lathe((x, 0, z), [(0.05, r * 0.8), (h * 0.76, r), (h, 0.001)], "teal", 6)

catalog = [m.write() for m in ASSETS]
assert len(catalog) == 28
for asset in catalog:
    directory = SRC / asset["category"] / asset["name"]
    write_output(
        directory / "metadata.json",
        (format_catalog(asset) + "\n").encode("utf-8"),
    )
    write_output(
        directory / "source.json",
        (
            format_catalog(
                {
                    "format": "molen/source-bundle@1",
                    "id": asset["id"],
                    "kind": asset["category"],
                    "title": asset["name"].replace("-", " ").title(),
                    "files": {
                        "definitions": ["metadata.json"],
                        "models": [
                            {
                                "path": "models/source.glb",
                                "assetId": asset["id"],
                                "output": "public/assets/"
                                + asset["id"].replace(".", "/")
                                + "/asset.json",
                                "pipeline": "import",
                                "sha256": "sha256:" + asset["sourceSha256"],
                            }
                        ],
                        "scripts": [],
                        "textures": [],
                        "sounds": [],
                        "documents": [],
                    },
                }
            )
            + "\n"
        ).encode("utf-8"),
    )
write_output(
    ROOT / "asset-src/catalog.json",
    (
        format_catalog(
            {
                "format": "lantern/source-catalog@1",
                "assets": catalog,
                "textures": [
                    {
                        "source": "asset-src/" + path.relative_to(OUTPUT).as_posix(),
                        "sha256": hashlib.sha256(data).hexdigest(),
                    }
                    for path, data in PENDING.items()
                    if path.suffix == ".png"
                ],
            }
        )
        + "\n"
    ).encode("utf-8"),
)
finish_outputs()
print(
    f'Generated {len(catalog)} GLBs, {sum(a["triangles"] for a in catalog):,} triangles, {sum(a["sourceBytes"] for a in catalog)/1048576:.2f} MiB source total.'
)
for a in catalog:
    print(f'{a["id"]}: {a["triangles"]} triangles; {a["sourceBytes"]:,} bytes')
