/** Rumeli Hisarı: mapped sloping curtains, three stepped hollow towers and a distinct seaward forecourt. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/sx/sxk/n0293_rumeli_hisar/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  relief = read('relief-grid.json'),
  references = read('reference-metadata.json'),
  means = read('surface-means.json');
export const rumeliPalette = {
  wall: '#d8c8a8',
  brick: '#b78268',
  paving: '#b4afa3',
  grass: '#8aa065',
  tile: '#a5644b',
  timber: '#987b60',
};
export const rumeliSurfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(rumeliPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function face(o, points, color = 'wall', slot = 'rubble', target) {
  let p = points.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, k) => s + v * target[k], 0) < 0) p = [...p].reverse();
    break;
  }
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[2]]),
      colors[color],
    );
  }
}
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function simplify(p, eps) {
  if (p.length < 3) return p;
  const a = p[0],
    b = p.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = dx * dx + dz * dz;
  let max = 0,
    j = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const u = l ? Math.max(0, Math.min(1, ((p[i][0] - a[0]) * dx + (p[i][1] - a[1]) * dz) / l)) : 0,
      d = Math.hypot(p[i][0] - a[0] - dx * u, p[i][1] - a[1] - dz * u);
    if (d > max) {
      max = d;
      j = i;
    }
  }
  return max > eps
    ? [...simplify(p.slice(0, j + 1), eps).slice(0, -1), ...simplify(p.slice(j), eps)]
    : [a, b];
}
function clean(p, eps) {
  const q = Math.hypot(...p[0].map((v, k) => v - p.at(-1)[k])) < 0.002 ? p.slice(0, -1) : p;
  return eps ? simplify([...q, q[0]], eps).slice(0, -1) : q;
}
function cap(o, ring, y, color = 'wall', slot = 'rubble') {
  const ix = earcut(ring.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix
        .slice(i, i + 3)
        .map((k) => [ring[k][0], typeof y === 'function' ? y(ring[k]) : y, ring[k][1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
export function rumeliDemHeight(x, z) {
  const { xs, zs, elevationsMeters: h } = relief;
  const i = Math.max(0, Math.min(xs.length - 2, Math.floor((x - xs[0]) / 20))),
    j = Math.max(0, Math.min(zs.length - 2, Math.floor((z - zs[0]) / 20))),
    u = Math.max(0, Math.min(1, (x - xs[i]) / 20)),
    v = Math.max(0, Math.min(1, (z - zs[j]) / 20));
  return (
    (1 - u) * (1 - v) * h[j][i] +
    u * (1 - v) * h[j][i + 1] +
    (1 - u) * v * h[j + 1][i] +
    u * v * h[j + 1][i + 1] -
    relief.datumMeters
  );
}
function circle(c, r, n, phase = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
}
const towers = [...frame.controls.largeTowers, ...frame.controls.mappedBastions];
export const rumeliTowerBase = (tower) =>
  Math.max(...circle(tower.center, tower.radius + 1, 16).map((p) => rumeliDemHeight(...p))) + 0.15;
function field(x, z) {
  let y = rumeliDemHeight(x, z);
  for (const t of towers) {
    const dist = Math.hypot(x - t.center[0], z - t.center[1]),
      f = Math.max(0, Math.min(1, (t.radius + 3 - dist) / 2));
    if (f) y = y * (1 - f) + rumeliTowerBase(t) * f;
  }
  return y;
}
const meshes = new Map();
function terrainMesh(d) {
  if (meshes.has(d)) return meshes.get(d);
  const triangles = [],
    ring = clean(frame.geometry.outline, [2, 0.6, 0.2, 0.2][d]),
    indices = earcut(ring.flat(), null, 2),
    spacing = [85, 45, 22, 18][d];
  function emit(p) {
    const lengths = p.map((a, i) => Math.hypot(a[0] - p[(i + 1) % 3][0], a[1] - p[(i + 1) % 3][1])),
      longest = Math.max(...lengths);
    if (longest > spacing) {
      const i = lengths.indexOf(longest),
        a = p[i],
        b = p[(i + 1) % 3],
        c = p[(i + 2) % 3],
        m = a.map((v, k) => (v + b[k]) / 2);
      emit([a, m, c]);
      emit([m, b, c]);
      return;
    }
    triangles.push(p.map((a) => [a[0], field(...a), a[1]]));
  }
  for (let i = 0; i < indices.length; i += 3) emit(indices.slice(i, i + 3).map((k) => ring[k]));
  meshes.set(d, triangles);
  return triangles;
}
function bary(x, z, p) {
  const [a, b, c] = p,
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(den) < 1e-8) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den,
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
  return u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001
    ? u * a[1] + v * b[1] + (1 - u - v) * c[1]
    : null;
}
/** Wall vertices sample the actual rendered terrain triangles, rather than a second interpolation. */
export function rumeliGroundHeight(x, z, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  let y = null;
  for (const p of terrainMesh(d)) {
    const h = bary(x, z, p);
    if (h !== null) y = y === null ? h : Math.max(y, h);
  }
  return y ?? field(x, z);
}
const levelName = (d) => ['skyline', 'district', 'street', 'closeup'][d];
function prism(o, ring, base, top, color = 'wall', slot = 'rubble') {
  const sign = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      lo = (p) => (typeof base === 'function' ? base(p) : base),
      hi = (p) => (typeof top === 'function' ? top(p) : top);
    face(
      o,
      [
        [a[0], lo(a), a[1]],
        [b[0], lo(b), b[1]],
        [b[0], hi(b), b[1]],
        [a[0], hi(a), a[1]],
      ],
      color,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
  cap(o, ring, top, color, slot);
}
function wedge(o, c, r, inside, y0, y1, a, b, color = 'wall', slot = 'rubble') {
  const point = (r, y, t) => [c[0] + r * Math.cos(t), y, c[1] + r * Math.sin(t)],
    oa = point(r, y0, a),
    ob = point(r, y0, b),
    ia = point(inside, y0, a),
    ib = point(inside, y0, b),
    OA = point(r, y1, a),
    OB = point(r, y1, b),
    IA = point(inside, y1, a),
    IB = point(inside, y1, b);
  face(o, [oa, ob, OB, OA], color, slot, [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]);
  face(o, [ib, ia, IA, IB], color, slot, [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)]);
  face(o, [oa, OA, IA, ia], color, slot, [Math.sin(a), 0, -Math.cos(a)]);
  face(o, [ob, ib, IB, OB], color, slot, [-Math.sin(b), 0, Math.cos(b)]);
  face(o, [OA, OB, IB, IA], color, slot, [0, 1, 0]);
}
function annulus(o, c, r, inner, base, top, n, phase = 0, holes = []) {
  const outer = circle(c, r, n, phase),
    inside = circle(c, inner, n, phase),
    sink = clipBuilder(o, holes);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = outer[i],
      b = outer[j],
      ia = inside[i],
      ib = inside[j],
      m = phase + ((i + 0.5) * 2 * Math.PI) / n;
    face(
      sink,
      [
        [...a.slice(0, 1), base, a[1]],
        [b[0], base, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      'wall',
      'rubble',
      [Math.cos(m), 0, Math.sin(m)],
    );
    face(
      sink,
      [
        [ib[0], base, ib[1]],
        [ia[0], base, ia[1]],
        [ia[0], top, ia[1]],
        [ib[0], top, ib[1]],
      ],
      'wall',
      'rubble',
      [-Math.cos(m), 0, -Math.sin(m)],
    );
    face(
      sink,
      [
        [a[0], top, a[1]],
        [b[0], top, b[1]],
        [ib[0], top, ib[1]],
        [ia[0], top, ia[1]],
      ],
      'wall',
      'rubble',
      [0, 1, 0],
    );
    if (holes.length)
      openingReveals(
        o,
        [a, b, ib, ia],
        () => base,
        () => top,
        holes,
        colors.wall,
      );
  }
}
function clipBuilder(out, holes) {
  if (!holes.length) return out;
  return {
    addTriangle(slot, ref, p, n, uv, color) {
      const intersecting = holes.filter(
        (h) =>
          !h.planes.some((v) =>
            p.every((q) => q[0] * v[0] + q[1] * v[1] + q[2] * v[2] + v[3] < -1e-7),
          ),
      );
      openingBuilder(out, intersecting).addTriangle(slot, ref, p, n, uv, color);
    },
  };
}
function roundTower(o, t, d) {
  const large = Boolean(t.upperRadius),
    n = t.baseSides ?? (large ? [6, 8, 16, 24][d] : [6, 6, 12, 16][d]),
    upperN = [6, 8, 16, 24][d],
    base = rumeliTowerBase(t),
    height = t.height,
    upperR = t.upperRadius ?? t.radius,
    inner = large ? upperR - 2.4 : t.radius - t.thickness,
    phase = t.phase ?? 0,
    step = t.stepHeight ?? height - 1.3,
    ground = (p) => rumeliGroundHeight(...p, levelName(d));
  prism(o, circle(t.center, t.radius, n, phase), ground, base);
  if (!large && d === 0) {
    prism(o, circle(t.center, t.radius, 6, phase), base, base + height);
    return;
  }
  let holes = [];
  if (large && d >= 1) {
    const toward = [-15 - t.center[0], -t.center[1]],
      l = Math.hypot(...toward),
      normal = toward.map((v) => v / l),
      axis = [-normal[1], normal[0]],
      distance = (t.radius + inner) / 2;
    holes = [
      prepareOpening(
        {
          id: `${t.id}-door`,
          center: t.center.map((v, k) => v + normal[k] * distance),
          axis,
          width: 1.7,
          height: 3.5,
          spring: 2.5,
          shape: 'round',
          depth: t.radius - inner + 2,
        },
        base,
        d,
      ),
    ];
    if (d >= 2)
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < (d === 2 ? 4 : 6); i++) {
          const a = phase + (i * 2 * Math.PI) / (d === 2 ? 4 : 6),
            normal = [Math.cos(a), Math.sin(a)],
            r = (t.radius + inner) / 2;
          holes.push(
            prepareOpening(
              {
                id: `${t.id}-slit-${row}-${i}`,
                center: t.center.map((v, k) => v + normal[k] * r),
                axis: [-normal[1], normal[0]],
                width: 0.5,
                height: 1.3,
                bottom: 5 + row * 3.1,
                shape: 'rectangle',
                depth: t.radius - inner + 2,
              },
              base,
              d,
            ),
          );
        }
  }
  annulus(
    o,
    t.center,
    t.radius,
    inner,
    base,
    base + (large ? step : height - 1.3),
    n,
    phase,
    holes,
  );
  if (large) annulus(o, t.center, upperR, inner, base + step, base + height - 1.3, upperN, phase);
  const crownN = large ? upperN : n,
    crownY = base + height - 1.3;
  cap(o, circle(t.center, inner, crownN, phase), base + height - 4, 'paving', 'aggregate');
  if (d === 0 || (d === 1 && !large))
    annulus(o, t.center, upperR, inner, crownY, base + height, crownN, phase);
  else
    for (let i = 0; i < crownN; i++)
      wedge(
        o,
        t.center,
        upperR,
        inner,
        crownY,
        base + height,
        phase + (i * 2 * Math.PI) / crownN,
        phase + ((i + 0.57) * 2 * Math.PI) / crownN,
      );
  if (large && d >= 2) {
    for (let i = 0; i < upperN; i++)
      wedge(
        o,
        t.center,
        upperR + 0.02,
        upperR - 0.06,
        base + height - 6,
        base + height - 5.65,
        phase + (i * 2 * Math.PI) / upperN,
        phase + ((i + 1) * 2 * Math.PI) / upperN,
        'brick',
        'brick',
      );
    if (d >= 3)
      for (let i = 0; i < n; i++)
        wedge(
          o,
          t.center,
          t.radius + 0.02,
          t.radius - 0.06,
          base + step - 2,
          base + step - 1.65,
          phase + (i * 2 * Math.PI) / n,
          phase + ((i + 1) * 2 * Math.PI) / n,
          'brick',
          'brick',
        );
  }
  if (large && d >= 1)
    cap(o, circle(t.center, inner, n, phase), base + 0.05, 'paving', 'aggregate');
}
function circleVoid(t, d) {
  const n = t.baseSides ?? (t.upperRadius ? [6, 8, 16, 24][d] : [6, 6, 12, 16][d]),
    r = t.radius - 0.01,
    ring = circle(t.center, r, n, t.phase ?? 0),
    sign = Math.sign(area(ring));
  return {
    planes: ring.map((a, i) => {
      const b = ring[(i + 1) % n],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      return [-dz * sign, 0, dx * sign, (dz * a[0] - dx * a[1]) * sign];
    }),
  };
}
function wallCourse(o, points, width, height, d, gateControls) {
  const p = clean(points, [3, 0.4, 0.15, 0.1][d]),
    closed = Math.hypot(...points[0].map((v, k) => v - points.at(-1)[k])) < 0.01;
  if (closed) p.push(p[0]);
  const ground = (p) => rumeliGroundHeight(...p, levelName(d)),
    holes = gateControls
      .filter((h) => d >= h.minDetail)
      .map((h) => prepareOpening(h, ground(h.center), d)),
    voids = d === 0 ? [] : towers.map((t) => circleVoid(t, d)),
    sink = clipBuilder(o, [...voids, ...holes]);
  for (let k = 1; k < p.length; k++) {
    const a = p[k - 1],
      b = p[k],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      count = Math.max(1, Math.ceil(length / [45, 15, 5, 4][d]));
    if (length < 0.002) continue;
    for (let i = 0; i < count; i++) {
      const u = a.map((v, k) => v + ((b[k] - v) * i) / count),
        v = a.map((v, k) => v + ((b[k] - v) * (i + 1)) / count),
        nx = ((-dz / length) * width) / 2,
        nz = ((dx / length) * width) / 2,
        ring = [
          [u[0] + nx, u[1] + nz],
          [v[0] + nx, v[1] + nz],
          [v[0] - nx, v[1] - nz],
          [u[0] - nx, u[1] - nz],
        ],
        base = ground,
        top = (q) => base(q) + height;
      if (d === 0) {
        const [a, b, c, e] = ring;
        face(
          sink,
          [
            [a[0], base(a), a[1]],
            [b[0], base(b), b[1]],
            [b[0], top(b), b[1]],
            [a[0], top(a), a[1]],
          ],
          'wall',
          'rubble',
          [-dz, 0, dx],
        );
        face(
          sink,
          [
            [c[0], base(c), c[1]],
            [e[0], base(e), e[1]],
            [e[0], top(e), e[1]],
            [c[0], top(c), c[1]],
          ],
          'wall',
          'rubble',
          [dz, 0, -dx],
        );
        cap(sink, ring, top);
      } else prism(sink, ring, base, top);
      if (holes.length) openingReveals(o, ring, base, top, holes, colors.wall);
    }
    if (d >= 1) {
      const n = Math.max(1, Math.round(length / (d === 1 ? 12 : 3.2)));
      for (let i = 0; i < n; i++) {
        const center = a.map((v, k) => v + ((b[k] - v) * (i + 0.34)) / n);
        if (
          towers.some((t) => Math.hypot(...center.map((v, k) => v - t.center[k])) < t.radius + 0.1)
        )
          continue;
        const u = a.map((v, k) => v + ((b[k] - v) * (i + 0.1)) / n),
          v = a.map((v, k) => v + ((b[k] - v) * (i + 0.58)) / n),
          nx = ((-dz / length) * width) / 2,
          nz = ((dx / length) * width) / 2,
          ring = [
            [u[0] + nx, u[1] + nz],
            [v[0] + nx, v[1] + nz],
            [v[0] - nx, v[1] - nz],
            [u[0] - nx, u[1] - nz],
          ];
        prism(
          sink,
          ring,
          (q) => ground(q) + height,
          (q) => ground(q) + height + 1.25,
        );
      }
    }
  }
}
function squareTower(o, t, d) {
  const [w, l] = t.plan,
    c = t.center,
    ring = [
      [c[0] - w / 2, c[1] - l / 2],
      [c[0] + w / 2, c[1] - l / 2],
      [c[0] + w / 2, c[1] + l / 2],
      [c[0] - w / 2, c[1] + l / 2],
    ],
    base = Math.max(...ring.map((p) => rumeliGroundHeight(...p, levelName(d))));
  prism(o, ring, (p) => rumeliGroundHeight(...p, levelName(d)), base + t.height - 1.2);
  if (d <= 1) prism(o, ring, base + t.height - 1.2, base + t.height);
  else
    for (let i = 0; i < 4; i++) {
      const a = ring[i],
        b = ring[(i + 1) % 4],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        n = Math.max(1, Math.round(Math.hypot(dx, dz) / 2.4));
      for (let j = 0; j < n; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * j) / n),
          q = a.map((v, k) => v + ((b[k] - v) * (j + 0.55)) / n),
          normal = [(-dz / Math.hypot(dx, dz)) * 0.8, (dx / Math.hypot(dx, dz)) * 0.8];
        prism(
          o,
          [p, q, q.map((v, k) => v + normal[k]), p.map((v, k) => v + normal[k])],
          base + t.height - 1.2,
          base + t.height,
        );
      }
    }
}
function mosque(o, d) {
  const ring = clean(frame.geometry.mosque, 0),
    c = ring.reduce((s, p) => s.map((v, k) => v + p[k] / ring.length), [0, 0]),
    base = Math.max(...ring.map((p) => rumeliGroundHeight(...p, levelName(d)))),
    top = base + frame.controls.mosque.wallHeight;
  prism(o, ring, (p) => rumeliGroundHeight(...p, levelName(d)), top);
  const a = ring[0],
    b = ring[1],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    ridge = [-0.22, 0.22].map((t) => [
      c[0] + dx * t,
      top + frame.controls.mosque.roofRise,
      c[1] + dz * t,
    ]);
  face(o, [[a[0], top, a[1]], [b[0], top, b[1]], ridge[1], ridge[0]], 'tile', 'tile', [0, 1, 0]);
  face(
    o,
    [[ring[3][0], top, ring[3][1]], ridge[0], ridge[1], [ring[2][0], top, ring[2][1]]],
    'tile',
    'tile',
    [0, 1, 0],
  );
  face(o, [[a[0], top, a[1]], ridge[0], [ring[3][0], top, ring[3][1]]], 'tile', 'tile', [0, 1, 0]);
  face(o, [[b[0], top, b[1]], [ring[2][0], top, ring[2][1]], ridge[1]], 'tile', 'tile', [0, 1, 0]);
  if (d >= 1) {
    const stub = frame.controls.mosque.minaretStub,
      n = d === 1 ? 6 : 12,
      ring = circle(stub.center, stub.radius, n),
      h = rumeliGroundHeight(...stub.center, levelName(d));
    prism(o, ring, h, h + stub.height);
  }
  if (d >= 2)
    for (let j = 0; j < 4; j++) {
      const a = ring[j],
        b = ring[(j + 1) % 4],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        nx = (dz / len) * 0.015,
        nz = (-dx / len) * 0.015;
      for (let i = 1; i < 3; i++) {
        const t = i / 3,
          c = [a[0] + dx * t, a[1] + dz * t],
          ux = (dx / len) * 0.6,
          uz = (dz / len) * 0.6;
        face(
          o,
          [
            [c[0] - ux + nx, base + 1.2, c[1] - uz + nz],
            [c[0] + ux + nx, base + 1.2, c[1] + uz + nz],
            [c[0] + ux + nx, base + 3, c[1] + uz + nz],
            [c[0] - ux + nx, base + 3, c[1] - uz + nz],
          ],
          'timber',
          'rubble',
          [nx, 0, nz],
        );
      }
    }
  void l;
}
function paths(o, d) {
  if (d < 1) return;
  for (const route of frame.controls.paths)
    for (let k = 1; k < route.points.length; k++) {
      const a = route.points[k - 1],
        b = route.points[k],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        n = d === 1 ? 1 : Math.ceil(len / 2.4),
        nx = ((-dz / len) * route.width) / 2,
        nz = ((dx / len) * route.width) / 2;
      for (let i = 0; i < n; i++) {
        const p = a.map((v, k) => v + ((b[k] - v) * i) / n),
          q = a.map((v, k) => v + ((b[k] - v) * (i + 1)) / n),
          ring = [
            [p[0] + nx, p[1] + nz],
            [q[0] + nx, q[1] + nz],
            [q[0] - nx, q[1] - nz],
            [p[0] - nx, p[1] - nz],
          ],
          h = (v) => rumeliGroundHeight(...v, levelName(d));
        prism(o, ring, h, (v) => h(v) + 0.08, 'paving', 'aggregate');
      }
    }
}
export const rumeliParts = {
  terrain(o, d) {
    for (const p of terrainMesh(d)) face(o, p, 'grass', 'foliage', [0, 1, 0]);
  },
  curtains(o, d) {
    wallCourse(
      o,
      frame.geometry.courtyard,
      frame.controls.curtainWidth,
      frame.controls.curtainHeight,
      d,
      frame.controls.gates.filter((h) => h.id !== 'forecourt-sea-gate'),
    );
  },
  forecourt(o, d) {
    const f = frame.controls.forecourt;
    cap(o, f.points, (p) => rumeliGroundHeight(...p, levelName(d)) + 0.03, 'paving', 'aggregate');
    wallCourse(
      o,
      f.points,
      f.width,
      f.height,
      d,
      frame.controls.gates.filter((h) => ['forecourt-sea-gate', 'sea-gate'].includes(h.id)),
    );
  },
  largeTowers(o, d) {
    for (const t of frame.controls.largeTowers) roundTower(o, t, d);
  },
  bastions(o, d) {
    for (const t of frame.controls.mappedBastions) roundTower(o, t, d);
    for (const t of frame.controls.estimatedBastions) squareTower(o, t, d);
  },
  mosque,
  paths,
};
function build(o, d) {
  for (const part of Object.values(rumeliParts)) part(o, d);
}
export const buildRumeliRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildRumeliSkyline = (o) =>
  build(
    {
      addTriangle: (s, r, p, n, uv, c) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    0,
  );
export const rumeliStudy = {
  id: 'N0293',
  key: 'rumeli_hisar',
  title: 'Rumeli Hisarı',
  category: 'castle',
  wikidataId: 'Q90801',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildRumeliRuntime(o),
  brief:
    'Three stepped roofless towers over a sloping narrow enclosure: cylindrical Saruca and Zağanos,12-sided seaward Halil lower body, ten mapped minor bastions, estimated square forecourt defenses, real masonry gates, selected slits and a mapped mosque with tiled hip roof.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: rumeliPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 5,
    identityFeatures: [
      'Three stepped hollow roofless towers',
      'Twelve-sided seaward Halil lower tower and narrower circular crown',
      'Long terrain-following crenellated curtains, smaller bastions and open hillside court',
    ],
  },
  sourceFacts: {
    sarucaHeightMeters: 28,
    zaganosHeightMeters: 21,
    halilHeightMeters: 22,
    publishedTowerHeightsSource: references.publishedDimensions.source,
    halilLowerFacets: 12,
    mappedCircularBastions: 10,
    estimatedSquareBastions: 3,
    siteExtentPublishedMeters: [120, 250],
    terrainGridSpacingMeters: 20,
    surveyedVerticalDatum: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Own map-member traces and curve-derived tower centers/radii; museum component heights. Forecourt, polygonal lower Halil radius, masonry thickness and details are original photographic estimates.',
  refs: references.references.map((r) => r.url),
  sourceDocuments: [
    'map-frame.json',
    'relief-grid.json',
    'surface-means.json',
    'reference-metadata.json',
  ],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own mapped traces © OpenStreetMap contributors,ODbL-1.0. SRTM courtesy NASA/USGS via Mapzen. Reference photographs/scan models are not redistributed.',
  sourceNotice:
    'Four existing shared material graphs with metric UVs; no embedded/new images or imported third-party mesh. Cropped coarse terrain, original pads and exact East/South map frame are source controls,not proof of real host placement.',
  dataAttribution:
    '© OpenStreetMap contributors;Turkish Museums;Türkiye Tourism Promotion and Development Agency;Mapzen/NASA/USGS.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: rumeliDemHeight(0, 0),
    reviewStatus: 'Inactive draft;actual terrain,datum and exact current-state geometry pending',
  }),
  geographicNote:
    'Raw multipolygon roles appear reversed. Model retains open court and independently authored towers. Map identity is exact; forecourt interpretation and host terrain fit require review before activation.',
  limitations: references.limitations,
  importReason:
    'Preserve Rumeli-specific stepped tower silhouettes, open enclosure and shared surfaces. Four authored levels retain independent identity features.',
  mediumFiContext: { scale: '3.8', neighborStyle: 'molen.worldgen.catalog.anatolian_house' },
  camera: { position: [290, 195, 330], lookAt: [0, 35, 0], fov: 43 },
  qaCameras: [
    { name: 'bosphorus-halil-profile', position: [135, 55, 55], lookAt: [28, 26, 2] },
    { name: 'saruca-north-crown', position: [-110, 100, -175], lookAt: [-36, 65, -115] },
    { name: 'zaganos-south-gate', position: [-120, 85, 165], lookAt: [-52, 49, 105] },
    { name: 'hillside-open-court', position: [-150, 140, 5], lookAt: [0, 32, 0] },
    { name: 'own-wall-plan', position: [0, 470, 1], lookAt: [0, 25, 0] },
    { name: 'sea-gate-passage', position: [56, 17.97, 33], lookAt: [38.4, 17.97, 30.5] },
    { name: 'mosque-and-courtyard', position: [38, 70, 53], lookAt: [-8, 27, -1] },
  ],
};
