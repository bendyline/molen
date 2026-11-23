import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.98 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.93 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.74 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.84 },
};
const granite = rgb('b1a38a'),
  ashlar = rgb('bfb298'),
  roofStone = rgb('898579'),
  clay = rgb('a46149');
const bronze = rgb('615a45'),
  shade = rgb('434945'),
  oak = rgb('405247'),
  ivory = rgb('ddd8be');
const lower = -3.6;
const getPart = (id) => site.parts.find((p) => p.id === id);
const area = (r) =>
  r.reduce((s, [x, z], i) => s + x * r[(i + 1) % r.length][1] - z * r[(i + 1) % r.length][0], 0);
const clockwise = (r) => (area(r) < 0 ? r : r.toReversed());
const bounds = (r) =>
  [0, 1].flatMap((i) => [Math.min(...r.map((p) => p[i])), Math.max(...r.map((p) => p[i]))]);
const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const flat = (h) => () => h;
const point = ([x, z], y) => [x, y, z];
const up = [0, 1, 0];
const triangleUvs = [
  [0, 0],
  [1, 0],
  [1, 1],
];

function face(out, slot, raw, tint, direction) {
  const ordered =
    direction && normalFor(...raw).reduce((sum, v, i) => sum + v * direction[i], 0) < 0
      ? raw.toReversed()
      : raw;
  for (let i = 1; i < ordered.length - 1; i++) {
    const tri = [ordered[0], ordered[i], ordered[i + 1]];
    const n = normalFor(...tri);
    if (Math.hypot(...n) > 0.98) out.addTriangle(slot, '', tri, n, triangleUvs, tint);
  }
}

function cap(out, slot, ring, height, tint) {
  if (!out.addCap(slot, 'palette:#ffffff', ring, [], height, up, (p) => p, tint))
    throw Error('Invalid Santiago roof polygon');
}

function sides(out, slot, raw, low, high, tint) {
  const ring = clockwise(raw);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      out,
      slot,
      [point(a, low(a)), point(b, low(b)), point(b, high(b)), point(a, high(a))],
      tint,
    );
  }
}

function mass(out, ring, low, high, tint = granite, slot = 'stone') {
  const r = cleanRing(ring);
  sides(out, slot, r, flat(low), flat(high), tint);
  cap(out, slot, r, flat(high), tint);
}

function body(out, p, detail) {
  const { id, height, base, roof, rise, axis, roofs, cover } = p;
  const r = cleanRing(p.ring),
    [x, X, z, Z] = bounds(r);
  const lo = base || lower;
  const peak = height + (id === 793961333 ? 0.08 : 0);
  if (!roof) return mass(out, r, lo, peak);
  const slot = cover === 'tile' ? 'tile' : 'stone',
    tint = cover === 'tile' ? clay : roofStone;
  if (roof === 'gabled') {
    const a = axis ? z : x,
      b = axis ? Z : X,
      mid = (a + b) / 2;
    const grade = (q) => peak - rise * Math.abs((q[axis] - mid) / (b - mid));
    const wall = r.flatMap((u, i) => {
      const v = r[(i + 1) % r.length];
      if ((u[axis] - mid) * (v[axis] - mid) >= 0) return [u];
      const t = (mid - u[axis]) / (v[axis] - u[axis]);
      return [u, [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t]];
    });
    if (base < height - rise) sides(out, 'stone', wall, flat(lo), grade, granite);
    for (const ring of roofs) cap(out, slot, cleanRing(ring), grade, tint);
    return;
  }
  if (roof === 'skillion') {
    const grade = ([q]) => peak - (rise * (X - q)) / (X - x);
    sides(out, 'stone', r, flat(lo), grade, granite);
    return cap(out, slot, r, grade, tint);
  }
  const low = peak - rise,
    apex = [(X + x) / 2, peak, (Z + z) / 2];
  sides(out, 'stone', r, flat(lo), flat(low), granite);
  // The mapped hipped chapel roofs use a short ridge with a small inset from each gable end.
  if (roof === 'hipped' && detail && r.length === 4) {
    const rings = [
      [low, 1],
      [peak, 0.07],
    ].map(([y, t]) =>
      clockwise(r).map(([u, v]) => [
        apex[0] + (u - apex[0]) * (axis ? 0.55 : t),
        y,
        apex[2] + (v - apex[2]) * (axis ? t : 0.55),
      ]),
    );
    return loft(out, slot, rings, tint);
  }
  for (let i = 0; i < r.length; i++)
    face(out, slot, [point(r[i], low), point(r[(i + 1) % r.length], low), apex], tint, up);
}

function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [-dz / length, 0, dx / length];
  return {
    length,
    normal,
    at: (u, y, d = 0) => [
      a[0] + (dx * u) / length + d * normal[0],
      y,
      a[1] + (dz * u) / length + d * normal[2],
    ],
  };
}
const edges = (ring) => clockwise(ring).map((a, i, r) => edge(a, r[(i + 1) % r.length]));

function strip(out, e, slot, tint, x, X, y, Y, d = 0) {
  face(out, slot, [e.at(x, y, d), e.at(X, y, d), e.at(X, Y, d), e.at(x, Y, d)], tint, e.normal);
}

function arch(
  out,
  e,
  center,
  width,
  sill,
  spring,
  crown,
  detail,
  { top, door = false, depth = 0.07 } = {},
) {
  const half = width / 2,
    a = center - half,
    b = center + half;
  const n = [2, 4, 8, 12][detail];
  const arc = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [
      a + t * width,
      spring + (crown - spring) * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))),
    ];
  });
  if (top === undefined)
    strip(out, e, door ? 'wood' : 'dark', door ? oak : shade, a, b, sill, spring, depth);
  for (let i = 0; i < n; i++) {
    const [x, y] = arc[i],
      [X, Y] = arc[i + 1];
    if (top === undefined)
      face(
        out,
        door ? 'wood' : 'dark',
        [e.at(x, spring, depth), e.at(X, spring, depth), e.at(X, Y, depth), e.at(x, y, depth)],
        door ? oak : shade,
        e.normal,
      );
    else {
      face(out, 'stone', [e.at(x, y), e.at(X, Y), e.at(X, top), e.at(x, top)], granite, e.normal);
      face(
        out,
        'stone',
        [e.at(x, y), e.at(X, Y), e.at(X, Y, -0.55), e.at(x, y, -0.55)],
        roofStone,
        [0, -1, 0],
      );
    }
    if (detail >= 2) {
      const v = 0.15 + (width > 2 ? 0.11 : 0),
        q = x + ((x - center) * v) / half,
        Q = X + ((X - center) * v) / half;
      face(
        out,
        'trim',
        [
          e.at(x, y, depth + 0.105),
          e.at(X, Y, depth + 0.105),
          e.at(Q, Y + v, depth + 0.105),
          e.at(q, y + v, depth + 0.105),
        ],
        ashlar,
        e.normal,
      );
    }
  }
  if (detail < 2) return;
  const jamb = 0.16;
  strip(out, e, 'trim', ashlar, a - jamb, a, sill, spring, depth + 0.11);
  strip(out, e, 'trim', ashlar, b, b + jamb, sill, spring, depth + 0.11);
  if (top === undefined && !door && width > 1.45) {
    for (const u of [-0.28, 0, 0.28])
      strip(
        out,
        e,
        'metal',
        bronze,
        center + u * width - 0.035,
        center + u * width + 0.035,
        sill,
        crown - Math.abs(u) * (crown - spring),
        depth + 0.018,
      );
    strip(
      out,
      e,
      'metal',
      bronze,
      a,
      b,
      sill + (spring - sill) * 0.47,
      sill + (spring - sill) * 0.47 + 0.055,
      depth + 0.021,
    );
  }
}

function turret(out, x, z, y, r, h, detail, profile) {
  const count = detail === 0 ? 4 : detail === 1 ? 8 : 12;
  const rings = profile.map(([v, w]) =>
    radialRing(y + v * h, r * w, r * w, count, [x, z], Math.PI / 4),
  );
  loft(out, 'trim', rings, ashlar);
}
const finialProfile = [
  [0, 1],
  [0.15, 1],
  [0.26, 0.64],
  [0.75, 0.21],
  [0.82, 0.36],
  [0.92, 0.31],
  [1, 0.07],
];

function pillar(out, e, u, y, h, r, detail) {
  const [x, , z] = e.at(u, y, 0.2);
  if (detail <= 1) return box(out, 'trim', [x - r, y, z - r], [x + r, y + h, z + r], ashlar);
  turret(out, x, z, y, r, h, 1, [
    [0, 1],
    [0.065, 1],
    [0.085, 0.69],
    [0.92, 0.61],
    [0.96, 1],
    [1, 1],
  ]);
}

function arcade(out, p, detail, openings) {
  if (!detail) return mass(out, p.ring, p.base, p.height - 0.008);
  const top = p.height - 0.004;
  for (const e of edges(cleanRing(p.ring))) {
    const w = e.length / (openings * 1.85);
    const y = p.base + 1.1,
      spring = p.base + (top - p.base) * 0.58,
      crown = top - 1.05;
    strip(out, e, 'stone', granite, 0, e.length, p.base, y);
    for (let j = 0; j < openings; j++) {
      const u = ((j + 0.5) * e.length) / openings;
      strip(out, e, 'stone', granite, (j * e.length) / openings, u - w / 2 - 0.0001, y, top);
      strip(out, e, 'stone', granite, u + w / 2 + 0.0001, ((j + 1) * e.length) / openings, y, top);
      arch(out, e, u, w, y, spring, crown, detail, { top, depth: 0 });
      for (const [x, sign] of [
        [u - w / 2, -1],
        [u + w / 2, 1],
      ]) {
        face(
          out,
          'stone',
          [e.at(x, y), e.at(x, spring), e.at(x, spring, -0.55), e.at(x, y, -0.55)],
          roofStone,
          e.at(x + sign, y).map((v, i) => e.at(x, y)[i] - v),
        );
      }
      if (detail >= 2)
        pillar(
          out,
          e,
          (j * e.length) / openings + 0.39,
          p.base + 0.15,
          top - p.base - 0.58,
          0.28,
          1,
        );
    }
  }
  cap(out, 'trim', p.ring, flat(top), ashlar);
}

function cross(out, x, y, z, detail, height) {
  if (!detail) return;
  const r = detail >= 2 ? 0.062 : 0.09;
  box(out, 'metal', [x - r, y, z - r], [x + r, y + height, z + r], bronze);
  box(
    out,
    'metal',
    [x - r, y + height * 0.66 - r, z - height * 0.34],
    [x + r, y + height * 0.66 + r, z + height * 0.34],
    bronze,
  );
}

function crown(out, p, detail, height, style) {
  const [x, X, z, Z] = bounds(p.ring),
    cx = (x + X) / 2,
    cz = (z + Z) / 2;
  const r = Math.min(X - x, Z - z) * 0.67;
  const profile =
    style === 'clock'
      ? [
          [0, 1],
          [0.08, 1],
          [0.37, 0.88],
          [0.49, 0.57],
          [0.6, 0.27],
          [0.74, 0.25],
          [0.84, 0.2],
          [0.94, 0.11],
          [1, 0.065],
        ]
      : [
          [0, 1],
          [0.07, 1],
          [0.25, 0.87],
          [0.4, 0.79],
          [0.5, 0.47],
          [0.58, 0.43],
          [0.68, 0.29],
          [0.8, 0.24],
          [0.9, 0.1],
          [0.95, 0.21],
          [1, 0.09],
        ];
  const levels = detail ? profile : profile.filter((_, i) => i % 2 === 0);
  turret(out, cx, cz, p.base, r, height - p.base, detail, levels);
  cross(out, cx, height, cz, detail, style === 'clock' ? 1.9 : 2.25);
  if (detail < 2) return;
  const lanternAt = p.base + (height - p.base) * (style === 'clock' ? 0.65 : 0.31);
  const trim = r * (style === 'clock' ? 0.32 : 0.77);
  for (const e of edges(rect(cx - trim, cx + trim, cz - trim, cz + trim)))
    arch(out, e, e.length / 2, trim * 0.53, lanternAt, lanternAt + 1.18, lanternAt + 1.6, detail);
}

function clockFaces(out, part, detail) {
  if (!detail) return;
  for (const e of edges(cleanRing(part.ring))) {
    if (e.length < 4.3) continue;
    const u = e.length / 2,
      y = part.height - 2.05,
      r = 1.16,
      n = detail === 1 ? 10 : 20;
    for (const [radius, d, tint] of [
      [r + 0.21, 0.12, ashlar],
      [r, 0.19, ivory],
    ]) {
      const ring = Array.from({ length: n }, (_, i) =>
        e.at(
          u + Math.cos((i * 2 * Math.PI) / n) * radius,
          y + Math.sin((i * 2 * Math.PI) / n) * radius,
          d,
        ),
      );
      face(out, 'trim', ring, tint, e.normal);
    }
    for (const [a, b, w] of [
      [-0.55, 0.49, 0.11],
      [0.14, 0.8, 0.085],
    ])
      beam(out, 'metal', e.at(u, y, 0.235), e.at(u + a, y + b, 0.235), w, 0.07, bronze);
    if (detail >= 2)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          c = Math.cos(a),
          s = Math.sin(a);
        beam(
          out,
          'metal',
          e.at(u + c * 0.85, y + s * 0.85, 0.23),
          e.at(u + c * 0.99, y + s * 0.99, 0.23),
          0.057,
          0.041,
          bronze,
        );
      }
  }
}

function westFront(out, detail) {
  if (!detail) return;
  const e = edge([-50.47, -25.97], [-50.47, 12.58]);
  const front = e.length / 2;
  arch(out, e, front, 4.62, 4.8, 9.45, 11.64, detail, { door: true });
  arch(out, e, front, 4.92, 16.2, 21.05, 22.77, detail);
  arch(out, e, front, 5.87, 24.2, 28.76, 31.75, detail);
  for (const side of [-1, 1]) {
    const u = front + side * 6.66;
    arch(out, e, u, 1.88, 6.98, 10.64, 11.56, detail);
    arch(out, e, u, 2.25, 16.16, 19.9, 20.94, detail);
    pillar(out, e, front + side * 3.44, 4.45, 12.38, 0.53, detail);
    pillar(out, e, front + side * 3.79, 15.72, 15.2, 0.5, detail);
    pillar(out, e, front + side * 8.45, 5.2, 25.4, 0.52, detail);
    for (const stretch of [10.1, 15.3]) {
      const t = front + side * stretch;
      for (const y of [12.75, 23.4, 31.31])
        box(
          out,
          'trim',
          [-50.79, y, e.at(t, y)[2] - 1.5],
          [-49.79, y + 0.35, e.at(t, y)[2] + 1.5],
          ashlar,
        );
      if (detail > 1) pillar(out, e, t, 16, 21, 0.36, detail);
    }
  }
  for (const [y, w] of [
    [4.45, 20.77],
    [14.77, 24.0],
    [22.88, 21.42],
    [33.3, 18.8],
  ]) {
    const a = e.at(front - w / 2, y, 0.42),
      b = e.at(front + w / 2, y, -1.38);
    box(out, 'trim', a, [b[0], y + 0.29, b[2]], ashlar);
  }
  // A pair of stair flights leaves the lower entrance clear in the middle.
  const steps = detail === 1 ? 7 : 21;
  for (const side of [-1, 1]) {
    for (let i = 0; i < steps; i++) {
      const y = (i * 4.85) / steps,
        z = -6.65 + side * (5.7 + 0.206 * i);
      const length = 6.3 / steps;
      box(
        out,
        'trim',
        [-59.36 + i * length, -2.1, z - 1.57],
        [-59.34 + (i + 1) * length, y + 4.85 / steps, z + 1.57],
        ashlar,
      );
    }
    beam(
      out,
      'trim',
      [-59.58, 0.35, -6.65 + side * 4.11],
      [-52.92, 5.43, -6.65 + side * 8.65],
      0.25,
      0.37,
      granite,
    );
  }
  box(out, 'trim', [-53.42, 4.56, -17.1], [-50.32, 4.85, 3.9], ashlar);
}

function finishWalls(out, detail) {
  if (detail < 2) return;
  const skip = new Set([
    637168822, 637168825, 793961280, 793961281, 793961288, 793961330, 793961334, 794277870,
    794277871, 794277872,
  ]);
  for (const p of site.parts) {
    if (skip.has(p.id) || p.base || p.height < 12 || p.height > 32) continue;
    for (const e of edges(cleanRing(p.ring))) {
      if (e.length < 6) continue;
      const count = Math.max(1, Math.floor(e.length / (detail === 2 ? 7.1 : 4.9)));
      const facadeTop = p.height - (p.rise ?? 0);
      for (let j = 0; j < count; j++) {
        const u = (e.length * (j + 0.5)) / count;
        arch(out, e, u, 1.07, facadeTop - 5.1, facadeTop - 2.68, facadeTop - 2.1, detail, {
          depth: 0.008,
        });
      }
    }
  }
  const east = edge([49.12, 10.83], [48.19, -37.2]);
  for (const u of [18.1, 25.4, 33.5]) {
    arch(out, east, u, 2.16, 7.92, 11.48, 12.43, detail, { door: true, depth: 0.09 });
    for (const d of [-1, 1]) pillar(out, east, u + d * 1.46, 8.05, 4.47, 0.29, 1);
  }
  const court = clockwise(site.cloister).toReversed();
  for (const [j, start] of court.entries()) {
    const e = edge(start, court[(j + 1) % court.length]);
    const bays = detail >= 3 ? 8 : 6;
    for (let i = 0; i < bays; i++) {
      const u = (e.length * (i + 0.5)) / bays;
      arch(out, e, u, 2.28, 3.46, 7.71, 8.82, detail, { depth: 0.096 });
    }
  }
}

function towerMarks(out, detail) {
  if (!detail) return;
  for (const id of [637168822, 637168825, 793961327, 794277866]) {
    const p = getPart(id),
      [x, X, z, Z] = bounds(p.ring),
      y = p.height - (id === 794277866 ? 8.0 : 0);
    const h = id === 793961327 ? 3.85 : 2.85;
    for (const [a, b] of [
      [x, z],
      [x, Z],
      [X, z],
      [X, Z],
    ])
      turret(
        out,
        a,
        b,
        y - 0.36,
        detail === 1 ? 0.42 : 0.65,
        h,
        detail === 1 ? 0 : 1,
        detail === 1
          ? [
              [0, 1],
              [0.31, 0.87],
              [1, 0.04],
            ]
          : finialProfile,
      );
  }
}

const angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const rotate = ([x, y, z]) => [
  Math.fround(c * x - s * z),
  Math.fround(y),
  Math.fround(s * x + c * z),
];
function build(out, detail) {
  const mesh = new MeshBufferBuilder();
  const regular = site.parts.filter(
    (p) => ![793961278, 793961279, 793961282, 793961283, 793961331, 793961332].includes(p.id),
  );
  for (const p of regular) {
    if (detail === 0 && p.height <= 12) continue;
    body(mesh, p, detail);
  }
  for (const id of [793961331, 793961332, 793961283])
    arcade(mesh, getPart(id), detail, id === 793961283 ? 1 : 2);
  for (const id of [793961278, 793961279, 793961282]) {
    const p = getPart(id);
    crown(mesh, p, detail, p.height, id === 793961282 ? 'clock' : 'bell');
  }
  clockFaces(mesh, getPart(793961327), detail);
  towerMarks(mesh, detail);
  westFront(mesh, detail);
  finishWalls(mesh, detail);
  const buffers = mesh.finalize();
  for (const { slot, start, count } of buffers.groups) {
    for (let i = start; i < start + count; i += 3) {
      const points = [0, 1, 2].map((k) => {
        const v = buffers.indices[i + k] * 3;
        return rotate(buffers.positions.slice(v, v + 3));
      });
      const n = normalFor(...points);
      if (Math.hypot(...n) < 0.98) continue;
      const v = buffers.indices[i] * 3;
      const tint = Array.from(buffers.colors.slice(v, v + 3), (value) => value / 255);
      out.addTriangle(slot, '', points, n, [], tint);
    }
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
