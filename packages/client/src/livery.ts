import type {
  LiveryData,
  LiveryGraphic,
  LiveryPaint,
  LiverySlot,
  LiveryVariant,
  LiveryZone,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export interface LiveryVisual {
  readonly warnings: readonly string[];
  /** Restore originals and release only the resources owned by this livery. */
  dispose(): void;
}

type Ring = readonly (readonly [number, number])[];

/**
 * Paint one flat-colored shape (outer ring plus holes, even-odd) into an RGBA buffer region,
 * anti-aliased: four sample rows a pixel, exact horizontal span coverage, straight alpha.
 * `rect` is the destination [x, y, width, height] inside a buffer `stride` pixels wide; the
 * shape's 0..1 coordinates fill the rect with Y up (row 0 at the bottom).
 */
function paintShape(
  bytes: Uint8Array,
  stride: number,
  rect: readonly [number, number, number, number],
  color: string,
  rings: readonly Ring[],
): void {
  const [rx, ry, w, h] = rect;
  const edges: number[] = [];
  let top = -Infinity,
    bottom = Infinity,
    left = Infinity,
    right = -Infinity;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i] as readonly [number, number],
        b = ring[(i + 1) % ring.length] as readonly [number, number];
      const x0 = a[0] * w,
        y0 = a[1] * h,
        x1 = b[0] * w,
        y1 = b[1] * h;
      left = Math.min(left, x0);
      right = Math.max(right, x0);
      bottom = Math.min(bottom, y0);
      top = Math.max(top, y0);
      if (y0 !== y1) edges.push(x0, y0, x1, y1);
    }
  if (!edges.length) return;
  const c0 = Math.max(0, Math.floor(left)),
    c1 = Math.min(w, Math.ceil(right) + 1),
    r0 = Math.max(0, Math.floor(bottom)),
    r1 = Math.min(h, Math.ceil(top) + 1),
    cw = c1 - c0;
  if (cw <= 0 || r1 <= r0) return;
  const SAMPLES = 4,
    weight = 1 / SAMPLES,
    coverage = new Float32Array(cw),
    crossings: number[] = [];
  const hex = Number.parseInt(color.slice(1), 16),
    red = (hex >> 16) & 255,
    green = (hex >> 8) & 255,
    blue = hex & 255;
  for (let row = r0; row < r1; row++) {
    coverage.fill(0);
    for (let s = 0; s < SAMPLES; s++) {
      const y = row + (s + 0.5) * weight;
      crossings.length = 0;
      for (let e = 0; e < edges.length; e += 4) {
        const x0 = edges[e] as number,
          y0 = edges[e + 1] as number,
          x1 = edges[e + 2] as number,
          y1 = edges[e + 3] as number;
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y))
          crossings.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
      crossings.sort((a, b) => a - b);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const a = Math.max(c0, crossings[k] as number) - c0,
          b = Math.min(c1, crossings[k + 1] as number) - c0;
        if (b <= a) continue;
        const ia = Math.floor(a),
          ib = Math.floor(b);
        if (ia === ib) {
          coverage[ia] = (coverage[ia] as number) + (b - a) * weight;
          continue;
        }
        coverage[ia] = (coverage[ia] as number) + (ia + 1 - a) * weight;
        for (let i = ia + 1; i < ib; i++) coverage[i] = (coverage[i] as number) + weight;
        if (ib < cw) coverage[ib] = (coverage[ib] as number) + (b - ib) * weight;
      }
    }
    for (let i = 0; i < cw; i++) {
      const a = Math.min(1, coverage[i] as number);
      if (a <= 0) continue;
      const o = ((ry + row) * stride + rx + c0 + i) * 4,
        dstA = (bytes[o + 3] as number) / 255,
        outA = a + dstA * (1 - a);
      const mix = (src: number, dst: number): number =>
        Math.round((src * a + dst * dstA * (1 - a)) / outA);
      bytes[o] = mix(red, bytes[o] as number);
      bytes[o + 1] = mix(green, bytes[o + 1] as number);
      bytes[o + 2] = mix(blue, bytes[o + 2] as number);
      bytes[o + 3] = Math.round(outA * 255);
    }
  }
}

/** Spread edge colors into transparent texels so mipmaps do not fringe artwork with black. */
function dilate(bytes: Uint8Array, width: number, height: number, passes = 3): void {
  for (let pass = 0; pass < passes; pass++) {
    const source = bytes.slice();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        if ((source[o + 3] as number) > 0 || (source[o] as number) > 0) continue;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = (ny * width + nx) * 4;
          if ((source[q + 3] as number) === 0 && (source[q] as number) === 0) continue;
          r += source[q] as number;
          g += source[q + 1] as number;
          b += source[q + 2] as number;
          n++;
        }
        if (!n) continue;
        // Alpha stays 0; a nonzero color marks the texel as filled for the next pass.
        bytes[o] = Math.max(1, Math.round(r / n));
        bytes[o + 1] = Math.round(g / n);
        bytes[o + 2] = Math.round(b / n);
      }
  }
}

function paintGraphic(
  bytes: Uint8Array,
  stride: number,
  rect: readonly [number, number, number, number],
  graphic: LiveryGraphic,
): void {
  for (const shape of graphic.shapes)
    paintShape(bytes, stride, rect, shape.color, [shape.points, ...(shape.holes ?? [])]);
}

function textureFrom(bytes: Uint8Array, width: number, height = width): THREE.DataTexture {
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Flat vector artwork, including outlined text; no browser fonts or image downloads. */
export function liveryGraphicTexture(graphic: LiveryGraphic, size = 256): THREE.DataTexture {
  const bytes = new Uint8Array(size * size * 4);
  paintGraphic(bytes, size, [0, 0, size, size], graphic);
  dilate(bytes, size, size);
  return textureFrom(bytes, size);
}

/** Tileable value noise on a period-`cells` lattice, smoothstep interpolated, in [0, 1). */
function tileNoise(seed: number, cells: number): (u: number, v: number) => number {
  const hash = (x: number, y: number): number => {
    let h = Math.imul((x & (cells - 1)) + 131 * (y & (cells - 1)), 374761393) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (u, v) => {
    const fx = u * cells,
      fy = v * cells,
      ix = Math.floor(fx),
      iy = Math.floor(fy);
    let a = fx - ix,
      b = fy - iy;
    a = a * a * (3 - 2 * a);
    b = b * b * (3 - 2 * b);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), a),
      THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), a),
      b,
    );
  };
}

/** One scalar field per texel, then colors by quantile so every color gets an equal share. */
function camouflagePixels(
  pattern: NonNullable<LiveryPaint['camouflage']>,
  size: number,
): Uint8Array {
  const field = new Float32Array(size * size);
  const style = pattern.style ?? 'blotch';
  if (style === 'splinter') {
    // Tileable Voronoi on a jittered 6 x 6 lattice: straight-edged, angular shards.
    const n = 6,
      sites: [number, number, number][] = [];
    const rand = tileNoise(pattern.seed ^ 0x9e3779b9, 64);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        sites.push([
          (i + 0.15 + 0.7 * rand((i * 7 + 1) / 64, (j * 5 + 3) / 64)) / n,
          (j + 0.15 + 0.7 * rand((i * 3 + 5) / 64, (j * 11 + 7) / 64)) / n,
          rand((i * 13 + 9) / 64, (j * 17 + 2) / 64),
        ]);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size,
          v = (y + 0.5) / size;
        let best = Infinity,
          value = 0;
        for (const [sx, sy, sv] of sites) {
          let dx = Math.abs(u - sx),
            dy = Math.abs(v - sy);
          dx = Math.min(dx, 1 - dx);
          dy = Math.min(dy, 1 - dy);
          // An anisotropic metric leans the cells into long splinters.
          const d = dx * dx * 0.45 + dy * dy * 1.6 + dx * dy * 0.9;
          if (d < best) {
            best = d;
            value = sv;
          }
        }
        field[y * size + x] = value;
      }
  } else {
    const low = tileNoise(pattern.seed, 4),
      mid = tileNoise(pattern.seed ^ 0x5bd1e995, 8),
      fine = tileNoise(pattern.seed ^ 0x27d4eb2f, 16),
      warpU = tileNoise(pattern.seed ^ 0x165667b1, 4),
      warpV = tileNoise(pattern.seed ^ 0x85ebca6b, 4);
    const grid = style === 'digital' ? Math.max(8, size / 24) : 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let u = (x + 0.5) / size,
          v = (y + 0.5) / size;
        if (grid) {
          u = (Math.floor(u * grid) + 0.5) / grid;
          v = (Math.floor(v * grid) + 0.5) / grid;
        }
        // Domain warp bends the patches into organic, irregular outlines.
        const wu = u + 0.12 * (warpU(u, v) - 0.5),
          wv = v + 0.12 * (warpV(u, v) - 0.5);
        const wrap = (t: number): number => t - Math.floor(t);
        field[y * size + x] =
          0.6 * low(wrap(wu), wrap(wv)) +
          0.3 * mid(wrap(wu), wrap(wv)) +
          0.1 * fine(wrap(wu), wrap(wv));
      }
  }
  const sorted = Float32Array.from(field).sort();
  const count = pattern.colors.length;
  const thresholds = Array.from(
    { length: count - 1 },
    (_, k) => sorted[Math.floor(((k + 1) * sorted.length) / count)] as number,
  );
  const colors = pattern.colors.map((c) => Number.parseInt(c.slice(1), 16));
  const bytes = new Uint8Array(size * size * 4);
  for (let i = 0; i < field.length; i++) {
    let k = 0;
    while (k < thresholds.length && (field[i] as number) >= (thresholds[k] as number)) k++;
    const hex = colors[k] as number;
    bytes[i * 4] = (hex >> 16) & 255;
    bytes[i * 4 + 1] = (hex >> 8) & 255;
    bytes[i * 4 + 2] = hex & 255;
    bytes[i * 4 + 3] = 255;
  }
  return bytes;
}

interface Shared<T> {
  value: T;
  refs: number;
  release(): void;
}
/** Instances of one model share their livery textures: per recipe object, reference counted. */
const camouflageCache = new WeakMap<object, Map<number, Shared<THREE.DataTexture>>>();
function sharedCamouflage(
  pattern: NonNullable<LiveryPaint['camouflage']>,
  channel: number,
): Shared<THREE.DataTexture> {
  let byChannel = camouflageCache.get(pattern);
  if (!byChannel) {
    byChannel = new Map();
    camouflageCache.set(pattern, byChannel);
  }
  let entry = byChannel.get(channel);
  if (!entry) {
    const size = 256,
      texture = textureFrom(camouflagePixels(pattern, size), size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.channel = channel;
    texture.repeat.setScalar(pattern.scale);
    const map = byChannel;
    const created: Shared<THREE.DataTexture> = {
      value: texture,
      refs: 0,
      release() {
        if (--created.refs > 0) return;
        texture.dispose();
        map.delete(channel);
      },
    };
    entry = created;
    byChannel.set(channel, entry);
  }
  entry.refs++;
  return entry;
}

interface Atlas {
  texture: THREE.DataTexture;
  material: THREE.MeshStandardMaterial;
  /** Atlas rectangle per marking, in texels: x, y, width, height, and the atlas size. */
  rects: [number, number, number, number][];
  width: number;
  height: number;
}
const atlasCache = new WeakMap<LiveryVariant, Map<string, Shared<Atlas>>>();
const PIXELS_PER_METRE = 300,
  MAX_RECT = 2048,
  MAX_ATLAS = 2048,
  PAD = 2;

/** Pack a variant's markings by their projectors' size in metres; identical art shares texels. */
function sharedAtlas(
  variant: LiveryVariant,
  graphics: readonly LiveryGraphic[],
  metres: readonly [number, number][],
): Shared<Atlas> {
  const key = metres.map(([w, h]) => `${w.toFixed(3)}x${h.toFixed(3)}`).join(',');
  let byKey = atlasCache.get(variant);
  if (!byKey) {
    byKey = new Map();
    atlasCache.set(variant, byKey);
  }
  const cached = byKey.get(key);
  if (cached) {
    cached.refs++;
    return cached;
  }
  let ppm = PIXELS_PER_METRE;
  let layout: { rects: [number, number, number, number][]; width: number; height: number };
  for (;;) {
    const sizes: [number, number][] = metres.map(([w, h]) => {
      const fit = Math.min(1, MAX_RECT / Math.max(w * ppm, h * ppm));
      return [Math.max(8, Math.round(w * ppm * fit)), Math.max(8, Math.round(h * ppm * fit))];
    });
    // One texel rectangle per distinct (art, size); shelf packing, tallest first.
    const idOf = (i: number): string => {
      const [w, h] = sizes[i] as [number, number];
      return `${graphics.indexOf(graphics[i] as LiveryGraphic)}:${w}x${h}`;
    };
    const unique = new Map<string, number>();
    for (let i = 0; i < sizes.length; i++) if (!unique.has(idOf(i))) unique.set(idOf(i), i);
    const order = [...unique.values()].sort(
      (a, b) => (sizes[b] as [number, number])[1] - (sizes[a] as [number, number])[1],
    );
    const padded = (i: number): [number, number] => {
      const [w, h] = sizes[i] as [number, number];
      return [w + 2 * PAD, h + 2 * PAD];
    };
    let width = 256;
    while (width < Math.max(...order.map((i) => padded(i)[0]))) width *= 2;
    const area = order.reduce((sum, i) => sum + padded(i)[0] * padded(i)[1], 0);
    while (width < MAX_ATLAS && width * width < area) width *= 2;
    const placed = new Map<number, [number, number, number, number]>();
    let x = 0,
      y = 0,
      shelf = 0;
    for (const i of order) {
      const [pw, ph] = padded(i);
      if (x + pw > width) {
        x = 0;
        y += shelf;
        shelf = 0;
      }
      const [w, h] = sizes[i] as [number, number];
      placed.set(i, [x + PAD, y + PAD, w, h]);
      x += pw;
      shelf = Math.max(shelf, ph);
    }
    const height = Math.max(4, Math.ceil((y + shelf) / 4) * 4);
    if (height <= MAX_ATLAS || ppm < 8) {
      layout = {
        width,
        height: Math.min(height, MAX_ATLAS),
        rects: sizes.map(
          (_, i) => placed.get(unique.get(idOf(i)) as number) as [number, number, number, number],
        ),
      };
      break;
    }
    ppm *= Math.sqrt(MAX_ATLAS / height) * 0.95;
  }
  const bytes = new Uint8Array(layout.width * layout.height * 4);
  const painted = new Set<string>();
  layout.rects.forEach((rect, i) => {
    const id = `${rect.join(',')}`;
    if (painted.has(id)) return;
    painted.add(id);
    paintGraphic(bytes, layout.width, rect, graphics[i] as LiveryGraphic);
  });
  dilate(bytes, layout.width, layout.height);
  const texture = textureFrom(bytes, layout.width, layout.height);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.name = `livery:${variant.id}`;
  const map = byKey;
  const entry: Shared<Atlas> = {
    value: { texture, material, ...layout },
    refs: 1,
    release() {
      if (--entry.refs > 0) return;
      texture.dispose();
      material.dispose();
      map.delete(key);
    },
  };
  byKey.set(key, entry);
  return entry;
}

const materialsOf = (mesh: THREE.Mesh): THREE.Material[] =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material];
// Remember bind-pose matrices across selections, even after a door/control surface has moved.
const restMatrices = new WeakMap<THREE.Object3D, Map<THREE.Mesh, THREE.Matrix4>>();

/**
 * How far a marking stands off the skin, in model meters. A marking is cut from the skin's own
 * triangles and carried back into its mesh's frame, so its depth matches the skin's only to
 * rounding. Polygon offset hides that with an ordinary depth buffer. It does nothing under the
 * logarithmic depth buffer that viewers use on fixed-point depth hardware, because there the
 * shader writes the depth. There the two fought in speckles that crawled as the camera moved.
 * Two millimeters stays clear of a 24-bit logarithmic depth step out to about 2.5 km (a step is
 * about 8e-7 of the distance), and is too small to see.
 */
const MARKING_LIFT = 0.002;

/** Move a projected marking off the surface along its normals (model space, outward). */
function liftOffSurface(decal: THREE.BufferGeometry): void {
  const position = decal.getAttribute('position'),
    normal = decal.getAttribute('normal');
  for (let i = 0; i < position.count; i++)
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * MARKING_LIFT,
      position.getY(i) + normal.getY(i) * MARKING_LIFT,
      position.getZ(i) + normal.getZ(i) * MARKING_LIFT,
    );
}

/** Extract just a slot's triangles, including material arrays with geometry groups. */
function surfaceGeometry(mesh: THREE.Mesh, names: Set<string>): THREE.BufferGeometry {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const materials = materialsOf(mesh),
    groups = Array.isArray(mesh.material)
      ? source.groups
      : [{ start: 0, count: source.getAttribute('position').count, materialIndex: 0 }];
  const positions: number[] = [],
    normals: number[] = [];
  const p = source.getAttribute('position'),
    n = source.getAttribute('normal');
  for (const group of groups) {
    if (!names.has(materials[group.materialIndex ?? 0]?.name ?? '')) continue;
    for (let i = group.start; i < Math.min(p.count, group.start + group.count); i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) normals.push(n.getX(i), n.getY(i), n.getZ(i));
    }
  }
  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geometry.computeVertexNormals();
  return geometry;
}

type Bary = [number, number, number];
const dot = (w: Bary, f: Bary): number => w[0] * f[0] + w[1] * f[1] + w[2] * f[2];

/**
 * Split a mesh's slot triangles exactly along every zone plane and give each piece the color of
 * the last zone containing it. Planes live in the slot's bounds normalized to 0..1 per axis.
 * Pieces carry every vertex attribute, interpolated; other materials' triangles pass through.
 * Zone materials are appended, so existing material indices keep their meaning.
 */
function splitZones(
  mesh: THREE.Mesh,
  names: ReadonlySet<string>,
  zones: readonly LiveryZone[],
  bounds: THREE.Box3,
  toRoot: THREE.Matrix4,
  zoneMaterial: (source: THREE.Material, zone: number) => THREE.Material,
): THREE.BufferGeometry {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const materials = [...materialsOf(mesh)];
  const groups = Array.isArray(mesh.material)
    ? source.groups.length
      ? source.groups
      : [{ start: 0, count: source.getAttribute('position').count, materialIndex: 0 }]
    : [{ start: 0, count: source.getAttribute('position').count, materialIndex: 0 }];
  const names2 = Object.keys(source.attributes);
  const attrs = names2.map((n) => source.getAttribute(n) as THREE.BufferAttribute);
  const min = bounds.min,
    extent = bounds.getSize(new THREE.Vector3());
  const span = (v: number): number => (Math.abs(v) < 1e-9 ? 1 : v);
  const planes = zones.flatMap((zone) =>
    zone.planes.map((plane) => ({
      n: [
        plane.normal[0] / span(extent.x),
        plane.normal[1] / span(extent.y),
        plane.normal[2] / span(extent.z),
      ] as const,
      d:
        plane.offset +
        (plane.normal[0] * min.x) / span(extent.x) +
        (plane.normal[1] * min.y) / span(extent.y) +
        (plane.normal[2] * min.z) / span(extent.z),
    })),
  );
  // Each zone's [first plane, plane count] in the flat plane list.
  const zoneRanges = zones.map(
    (zone, z) =>
      [zones.slice(0, z).reduce((s, zz) => s + zz.planes.length, 0), zone.planes.length] as const,
  );
  const extraIndex = new Map<string, number>();
  const output: { material: number; values: number[][] }[] = [];
  const p = source.getAttribute('position');
  const v = new THREE.Vector3();
  for (const group of groups) {
    const materialIndex = group.materialIndex ?? 0,
      material = materials[materialIndex] as THREE.Material;
    const end = Math.min(p.count, group.start + group.count);
    for (let i = group.start; i + 2 < end; i += 3) {
      const corner = (k: number): number[] =>
        attrs.flatMap((a) =>
          Array.from({ length: a.itemSize }, (_, c) => a.getComponent(i + k, c)),
        );
      const values: [number[], number[], number[]] = [corner(0), corner(1), corner(2)];
      if (!names.has(material.name)) {
        output.push({ material: materialIndex, values });
        continue;
      }
      const corners = [0, 1, 2].map((k) =>
        v
          .fromBufferAttribute(p, i + k)
          .applyMatrix4(toRoot)
          .clone(),
      );
      const [ra, rb, rc] = corners as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      const f: Bary[] = planes.map((plane) => {
        const at = (q: THREE.Vector3): number =>
          plane.n[0] * q.x + plane.n[1] * q.y + plane.n[2] * q.z - plane.d;
        return [at(ra), at(rb), at(rc)];
      });
      // Clip in barycentric weights: each plane function is linear in them.
      let pieces: Bary[][] = [
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
      ];
      for (const fk of f) {
        const next: Bary[][] = [];
        for (const piece of pieces) {
          const inside: Bary[] = [],
            outside: Bary[] = [];
          piece.forEach((a, j) => {
            const b = piece[(j + 1) % piece.length] as Bary;
            const fa = dot(a, fk),
              fb = dot(b, fk);
            (fa >= 0 ? inside : outside).push(a);
            if (fa >= 0 !== fb >= 0) {
              const t = fa / (fa - fb),
                cut: Bary = [
                  a[0] + (b[0] - a[0]) * t,
                  a[1] + (b[1] - a[1]) * t,
                  a[2] + (b[2] - a[2]) * t,
                ];
              inside.push(cut);
              outside.push(cut);
            }
          });
          if (inside.length >= 3) next.push(inside);
          if (outside.length >= 3) next.push(outside);
        }
        pieces = next;
      }
      for (const piece of pieces) {
        const sum = piece.reduce<Bary>(
          (s, w) => [s[0] + w[0], s[1] + w[1], s[2] + w[2]],
          [0, 0, 0],
        );
        const centre: Bary = [sum[0] / piece.length, sum[1] / piece.length, sum[2] / piece.length];
        let zone = -1;
        zoneRanges.forEach(([first, count], z) => {
          if (f.slice(first, first + count).every((fk) => dot(centre, fk) >= 0)) zone = z;
        });
        let index = materialIndex;
        if (zone >= 0) {
          const id = `${materialIndex}:${zone}`;
          let extra = extraIndex.get(id);
          if (extra === undefined) {
            extra = materials.length;
            materials.push(zoneMaterial(material, zone));
            extraIndex.set(id, extra);
          }
          index = extra;
        }
        const [v0, v1, v2] = values;
        const mix = (w: Bary): number[] =>
          v0.map((x, c) => w[0] * x + w[1] * (v1[c] ?? 0) + w[2] * (v2[c] ?? 0));
        const mixed = piece.map(mix);
        const first = mixed[0] as number[];
        for (let t = 1; t + 1 < mixed.length; t++)
          output.push({
            material: index,
            values: [first, mixed[t] as number[], mixed[t + 1] as number[]],
          });
      }
    }
  }
  output.sort((a, b) => a.material - b.material);
  const geometry = new THREE.BufferGeometry();
  let offset = 0;
  attrs.forEach((attribute, a) => {
    const size = attribute.itemSize,
      array = new Float32Array(output.length * 3 * size);
    let o = 0;
    for (const triangle of output)
      for (const corner of triangle.values)
        for (let c = 0; c < size; c++) array[o++] = corner[offset + c] as number;
    const result = new THREE.BufferAttribute(array, size);
    if (names2[a] === 'normal') {
      const n = new THREE.Vector3();
      for (let i = 0; i < result.count; i++) {
        n.fromBufferAttribute(result, i).normalize();
        result.setXYZ(i, n.x, n.y, n.z);
      }
    }
    geometry.setAttribute(names2[a] as string, result);
    offset += size;
  });
  let start = 0;
  output.forEach((triangle, i) => {
    const next = output[i + 1];
    if (next && next.material === triangle.material) return;
    geometry.addGroup(start * 3, (i + 1 - start) * 3, triangle.material);
    start = i + 1;
  });
  source.dispose();
  mesh.material = materials;
  return geometry;
}

function projectPaint(
  mesh: THREE.Mesh,
  bounds: THREE.Box3,
  transform: THREE.Matrix4,
  names: readonly string[],
  channel: number,
): THREE.BufferGeometry {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const attribute = channel === 0 ? 'uv' : `uv${channel}`;
  const p = geometry.getAttribute('position'),
    uv = geometry.getAttribute(attribute)
      ? Float32Array.from(geometry.getAttribute(attribute).array)
      : new Float32Array(p.count * 2);
  const selected = new Uint8Array(p.count);
  if (!Array.isArray(mesh.material)) selected.fill(1);
  else
    for (const group of geometry.groups) {
      if (!names.includes(mesh.material[group.materialIndex ?? 0]?.name ?? '')) continue;
      selected.fill(1, group.start, Math.min(p.count, group.start + group.count));
    }
  const extent = bounds.getSize(new THREE.Vector3()),
    scale = Math.max(extent.x, extent.y, extent.z, 0.001);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    if (!selected[i]) continue;
    a.fromBufferAttribute(p, i).applyMatrix4(transform);
    b.fromBufferAttribute(p, i + 1).applyMatrix4(transform);
    c.fromBufferAttribute(p, i + 2).applyMatrix4(transform);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const axis =
      Math.abs(normal.y) >= Math.max(Math.abs(normal.x), Math.abs(normal.z))
        ? 'y'
        : Math.abs(normal.x) > Math.abs(normal.z)
          ? 'x'
          : 'z';
    for (const [j, point] of [a, b, c].entries()) {
      uv[(i + j) * 2] =
        ((axis === 'x' ? point.z : point.x) - (axis === 'x' ? bounds.min.z : bounds.min.x)) / scale;
      uv[(i + j) * 2 + 1] =
        ((axis === 'y' ? point.z : point.y) - (axis === 'y' ? bounds.min.z : bounds.min.y)) / scale;
    }
  }
  geometry.setAttribute(attribute, new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Apply to an instance, never a cache template. Does not mutate shared materials or geometry. */
export function applyLivery(model: THREE.Object3D, data: LiveryData): LiveryVisual {
  const variant = data.variants.find((v) => v.id === data.selected);
  if (!variant) throw new Error(`Unknown livery: ${data.selected}`);
  const warnings: string[] = [];
  const originals = new Map<
    THREE.Mesh,
    { material: THREE.Mesh['material']; geometry: THREE.BufferGeometry }
  >();
  const materials = new Set<THREE.Material>(),
    geometries = new Set<THREE.BufferGeometry>(),
    shared: Shared<unknown>[] = [];
  const decals: THREE.Mesh[] = [];
  const remember = (mesh: THREE.Mesh): void => {
    if (!originals.has(mesh))
      originals.set(mesh, { material: mesh.material, geometry: mesh.geometry });
  };
  // A slot can rewrite a mesh's geometry more than once (zones, then camouflage UVs); only the
  // authored geometry is kept for restoring, intermediate copies are released at once.
  const replaceGeometry = (mesh: THREE.Mesh, next: THREE.BufferGeometry): void => {
    const previous = mesh.geometry;
    mesh.geometry = next;
    geometries.add(next);
    if (previous !== originals.get(mesh)?.geometry && geometries.delete(previous))
      previous.dispose();
  };
  model.updateWorldMatrix(true, true);
  const rootInverse = model.matrixWorld.clone().invert();
  let rest = restMatrices.get(model);
  if (!rest) {
    rest = new Map();
    model.traverse((object) => {
      if (object instanceof THREE.Mesh)
        rest?.set(object, rootInverse.clone().multiply(object.matrixWorld));
    });
    restMatrices.set(model, rest);
  }
  const matrix = (mesh: THREE.Mesh): THREE.Matrix4 =>
    (rest?.get(mesh) ?? rootInverse.clone().multiply(mesh.matrixWorld)).clone();
  const slots = new Map<
    string,
    { meshes: THREE.Mesh[]; bounds: THREE.Box3; binding: LiverySlot }
  >();
  for (const [name, binding] of Object.entries(data.slots)) {
    const subtree = binding.node === undefined ? model : model.getObjectByName(binding.node);
    const meshes: THREE.Mesh[] = [],
      bounds = new THREE.Box3();
    const collect = (object: THREE.Object3D): void => {
      if (
        !(object instanceof THREE.Mesh) ||
        object.userData.liveryMarking ||
        meshes.includes(object) ||
        !materialsOf(object).some((m) => binding.materials.includes(m.name))
      )
        return;
      if ((object as THREE.SkinnedMesh).isSkinnedMesh || object.morphTargetInfluences?.length) {
        warnings.push(`Slot ${name}: deforming mesh ${object.name} is unsupported`);
        return;
      }
      meshes.push(object);
      const surface = surfaceGeometry(object, new Set(binding.materials));
      surface.applyMatrix4(matrix(object));
      surface.computeBoundingBox();
      if (surface.boundingBox) bounds.union(surface.boundingBox);
      surface.dispose();
    };
    subtree?.traverse(collect);
    // Articulation can move a cut skin into a hinge outside its original paint subtree.
    // Preserve that source association through glTF extras, including fully extracted skins.
    if (binding.node !== undefined)
      model.traverse((object) => {
        const sources = object.userData.liverySourceNodes;
        if (Array.isArray(sources) && sources.includes(binding.node)) collect(object);
      });
    if (!meshes.length || bounds.isEmpty()) warnings.push(`Slot ${name}: no matching surface`);
    slots.set(name, { meshes, bounds, binding });
  }
  const painted = new Map<THREE.Mesh, Set<number>>();
  const occupiedChannels = new Set<number>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of materialsOf(object))
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) occupiedChannels.add(value.channel);
  });
  const channel = [3, 2, 1, 0].find((candidate) => !occupiedChannels.has(candidate));
  for (const [name, paint] of Object.entries(variant.paints)) {
    const slot = slots.get(name);
    if (!slot || slot.bounds.isEmpty()) {
      warnings.push(`Paint ${name}: missing slot`);
      continue;
    }
    const clones = new Map<THREE.Material, THREE.Material>();
    const zoneClones = new Map<string, THREE.Material>();
    if (paint.camouflage && channel === undefined)
      warnings.push(`Paint ${name}: no unused UV channel for camouflage; using the base color`);
    const camouflage =
      paint.camouflage && channel !== undefined
        ? sharedCamouflage(paint.camouflage, channel)
        : undefined;
    if (camouflage) shared.push(camouflage);
    const texture = camouflage?.value;
    const zoneMaterial = (source: THREE.Material, zone: number): THREE.Material => {
      const id = `${source.uuid}:${zone}`;
      let clone = zoneClones.get(id);
      if (!clone) {
        const z = paint.zones?.[zone] as LiveryZone;
        clone = source.clone();
        materials.add(clone);
        if ('color' in clone) (clone as THREE.MeshStandardMaterial).color.set(z.color);
        if ('map' in clone) (clone as THREE.MeshStandardMaterial).map = null;
        if ('roughness' in clone && z.roughness !== undefined)
          (clone as THREE.MeshStandardMaterial).roughness = z.roughness;
        if ('metalness' in clone && z.metalness !== undefined)
          (clone as THREE.MeshStandardMaterial).metalness = z.metalness;
        clone.needsUpdate = true;
        zoneClones.set(id, clone);
      }
      return clone;
    };
    for (const mesh of slot.meshes) {
      remember(mesh);
      const used = painted.get(mesh) ?? new Set<number>();
      painted.set(mesh, used);
      const next = materialsOf(mesh).map((source, index) => {
        if (!slot.binding.materials.includes(source.name)) return source;
        if (used.has(index)) {
          warnings.push(`Paint ${name}: overlapping slot on ${mesh.name}`);
          return source;
        }
        used.add(index);
        let clone = clones.get(source);
        if (!clone) {
          clone = source.clone();
          clones.set(source, clone);
          materials.add(clone);
          if ('color' in clone) (clone as THREE.MeshStandardMaterial).color.set(paint.color);
          if ('roughness' in clone && paint.roughness !== undefined)
            (clone as THREE.MeshStandardMaterial).roughness = paint.roughness;
          if ('metalness' in clone && paint.metalness !== undefined)
            (clone as THREE.MeshStandardMaterial).metalness = paint.metalness;
          if ('map' in clone) (clone as THREE.MeshStandardMaterial).map = texture ?? null;
          // Some fleet models encode dark tires/trim in vertex colors on the paint material.
          // Preserve that mask while replacing the material's base tint.
          if (texture && 'color' in clone)
            (clone as THREE.MeshStandardMaterial).color.set('#ffffff');
          clone.needsUpdate = true;
        }
        return clone;
      });
      mesh.material = Array.isArray(mesh.material) ? next : (next[0] as THREE.Material);
      if (paint.zones?.length)
        replaceGeometry(
          mesh,
          splitZones(
            mesh,
            new Set(slot.binding.materials),
            paint.zones,
            slot.bounds,
            matrix(mesh),
            zoneMaterial,
          ),
        );
      if (texture)
        replaceGeometry(
          mesh,
          projectPaint(mesh, slot.bounds, matrix(mesh), slot.binding.materials, texture.channel),
        );
    }
  }
  // Markings: every projector of the variant shares one atlas texture and material; on each
  // mesh their decal pieces merge into one draw.
  const markings: {
    graphic: LiveryGraphic;
    flip: boolean;
    slot: NonNullable<ReturnType<typeof slots.get>>;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    size: THREE.Vector3;
    anchor: string;
  }[] = [];
  for (const marking of variant.markings ?? []) {
    const anchor = data.anchors?.[marking.anchor],
      slot = anchor && slots.get(anchor.slot);
    const graphic =
      typeof marking.graphic === 'string' ? data.graphics?.[marking.graphic] : marking.graphic;
    if (!graphic) {
      warnings.push(`Marking ${marking.anchor}: unknown graphic ${marking.graphic}`);
      continue;
    }
    if (!anchor || !slot || slot.bounds.isEmpty()) {
      warnings.push(`Marking ${marking.anchor}: missing surface`);
      continue;
    }
    const extent = slot.bounds.getSize(new THREE.Vector3());
    markings.push({
      graphic,
      flip: marking.flip === true,
      slot,
      anchor: marking.anchor,
      position: new THREE.Vector3(...anchor.position).multiply(extent).add(slot.bounds.min),
      size: new THREE.Vector3(...anchor.size).multiplyScalar(
        Math.max(extent.x, extent.y, extent.z),
      ),
      rotation: new THREE.Euler(...anchor.rotation),
    });
  }
  if (markings.length) {
    const atlas = sharedAtlas(
      variant,
      markings.map((m) => m.graphic),
      markings.map((m) => [m.size.x, m.size.y]),
    );
    shared.push(atlas);
    const pieces = new Map<THREE.Mesh, { anchor: string; geometry: THREE.BufferGeometry }[]>();
    markings.forEach((marking, index) => {
      const [rx, ry, rw, rh] = atlas.value.rects[index] as [number, number, number, number];
      const direction = new THREE.Vector3(0, 0, 1).applyEuler(marking.rotation);
      let count = 0;
      for (const mesh of marking.slot.meshes) {
        const surface = surfaceGeometry(mesh, new Set(marking.slot.binding.materials));
        const toRoot = matrix(mesh);
        surface.applyMatrix4(toRoot);
        const p = surface.getAttribute('position'),
          n = surface.getAttribute('normal'),
          indices: number[] = [];
        const doubleSided = materialsOf(mesh).some(
          (m) => marking.slot.binding.materials.includes(m.name) && m.side === THREE.DoubleSide,
        );
        for (let i = 0; i < p.count; i += 3) {
          const facing = new THREE.Vector3().fromBufferAttribute(n, i).dot(direction);
          if (facing > 0.05) indices.push(i, i + 1, i + 2);
          else if (doubleSided && facing < -0.05) {
            // Thin, two-sided shells may be wound inward. Orient the projected sticker outward.
            indices.push(i, i + 2, i + 1);
            for (let j = i; j < i + 3; j++) n.setXYZ(j, -n.getX(j), -n.getY(j), -n.getZ(j));
          }
        }
        surface.setIndex(indices);
        const decal = new DecalGeometry(
          new THREE.Mesh(surface),
          marking.position,
          marking.rotation,
          marking.size,
        );
        surface.dispose();
        if (!decal.getAttribute('position').count) {
          decal.dispose();
          continue;
        }
        liftOffSurface(decal);
        decal.applyMatrix4(toRoot.clone().invert());
        const uv = decal.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) {
          const u = marking.flip ? 1 - uv.getX(i) : uv.getX(i);
          uv.setXY(
            i,
            (rx + u * rw) / atlas.value.width,
            (ry + uv.getY(i) * rh) / atlas.value.height,
          );
        }
        const list = pieces.get(mesh) ?? [];
        list.push({ anchor: marking.anchor, geometry: decal.index ? decal.toNonIndexed() : decal });
        if (decal.index) decal.dispose();
        pieces.set(mesh, list);
        count++;
      }
      if (!count) warnings.push(`Marking ${marking.anchor}: projector misses its surface`);
    });
    for (const [mesh, list] of pieces) {
      const merged = new THREE.BufferGeometry();
      for (const attribute of ['position', 'normal', 'uv']) {
        const size = attribute === 'uv' ? 2 : 3;
        const total = list.reduce((s, { geometry: g }) => s + g.getAttribute(attribute).count, 0),
          array = new Float32Array(total * size);
        let o = 0;
        for (const { geometry: g } of list) {
          const a = g.getAttribute(attribute);
          for (let i = 0; i < a.count; i++)
            for (let c = 0; c < size; c++) array[o++] = a.getComponent(i, c);
        }
        merged.setAttribute(attribute, new THREE.BufferAttribute(array, size));
      }
      // Which vertices belong to which marking, for tools and tests that locate one marking.
      const ranges: { anchor: string; start: number; count: number }[] = [];
      let start = 0;
      for (const { anchor, geometry: g } of list) {
        const count = g.getAttribute('position').count;
        ranges.push({ anchor, start, count });
        start += count;
        g.dispose();
      }
      geometries.add(merged);
      const decal = new THREE.Mesh(merged, atlas.value.material);
      decal.name = 'livery:markings';
      decal.userData.liveryMarking = true;
      decal.userData.liveryMarkings = ranges;
      // Paint is never solid. The hull under it already collides, and the decal is added after a
      // host flags the model's own meshes as vehicle geometry: without this, a scan that skips
      // vehicles kept the markings, and a moving aircraft struck its own insignia left behind in
      // the collision tree and broke apart.
      decal.userData.walkIgnore = true;
      decal.receiveShadow = true;
      decal.renderOrder = 1;
      mesh.add(decal);
      decals.push(decal);
    }
  }
  let disposed = false;
  return {
    warnings,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const decal of decals) decal.removeFromParent();
      for (const [mesh, original] of originals) {
        mesh.material = original.material;
        mesh.geometry = original.geometry;
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const entry of shared) entry.release();
    },
  };
}
