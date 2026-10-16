/** Budgeted Two Prudential Plaza browser models. Original instanced recipe stays unchanged. */

import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { twoPrudentialPlazaStudy } from './two-prudential-plaza-model.mjs';

const X = 28.0845,
  Z = 20.4255,
  W = Z / 7,
  baseY = 9.75,
  floorH = 3.875,
  tip = 303.3,
  spire = 24.384,
  apex = tip - spire,
  roofSlope = 1.4;
const granite = [0.7, 0.68, 0.65],
  darkStone = [0.31, 0.32, 0.32],
  blue = [0.2, 0.36, 0.46],
  silver = [0.61, 0.65, 0.67],
  metal = [0.25, 0.28, 0.29];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
function transformed(out, translation, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const vector = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  const point = (p) => vector(p).map((v, i) => v + translation[i]);
  return {
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

/** Clip authoring polygons while retaining outward normals and metric material coordinates. */
function clipped(out, planes) {
  function polygon(slot, ref, points, normal, _uv, color) {
    for (const [nx, ny, nz, d] of planes) {
      const input = points;
      points = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i],
          b = input[(i + 1) % input.length];
        const da = nx * a[0] + ny * a[1] + nz * a[2] - d,
          db = nx * b[0] + ny * b[1] + nz * b[2] - d;
        if (da <= 0) points.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0))
          points.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
      }
      if (points.length < 3) return;
    }
    for (let i = 1; i + 1 < points.length; i++) {
      const p = [points[0], points[i], points[i + 1]],
        a = p[1].map((v, k) => v - p[0][k]),
        b = p[2].map((v, k) => v - p[0][k]);
      const area = Math.hypot(
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      );
      if (area < 0.000001) continue;
      out.addTriangle(
        slot,
        ref,
        p,
        normal,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  }
  return { addQuad: polygon, addTriangle: polygon, addConvexPolygon: polygon };
}
const pyramidPlanes = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
].map(([x, z]) => [x * roofSlope, 1, z * roofSlope, apex]);
const crownPlanes = [
  [1, 0, 0, 18.8],
  [-1, 0, 0, 18.8],
  [0, 0, 1, Z],
  [0, 0, -1, Z],
];

/** Two approximate east entrance drums; their inventory/offsets are not a surveyed plan. */
function entrance(o, sides = 16) {
  for (const x of [-7, -3.4]) {
    const z = -Z + 0.35,
      r = 1.32,
      y0 = 0.28,
      y1 = 3.08;
    // Curved fixed glass occupies side sectors; north/south gaps remain open for passage.
    for (let i = 0; i < sides; i++) {
      const t = ((i + 0.5) * 2 * Math.PI) / sides;
      if (Math.abs(Math.sin(t)) > 0.72) continue;
      const a = (i * 2 * Math.PI) / sides,
        b = ((i + 1) * 2 * Math.PI) / sides;
      face(
        o,
        'clear_glass',
        [
          [x + r * Math.cos(a), y0, z + r * Math.sin(a)],
          [x + r * Math.cos(b), y0, z + r * Math.sin(b)],
          [x + r * Math.cos(b), y1, z + r * Math.sin(b)],
          [x + r * Math.cos(a), y1, z + r * Math.sin(a)],
        ],
        blue,
      );
      beam(
        o,
        'stainless',
        [x + r * Math.cos(a), y0, z + r * Math.sin(a)],
        [x + r * Math.cos(a), y1, z + r * Math.sin(a)],
        0.045,
        0.045,
        silver,
      );
    }
    tube(o, 'stainless', [x, y0, z], [x, y1, z], 0.055, silver, sides);
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + (j * Math.PI) / 2,
        e = [x + 1.22 * Math.cos(a), z + 1.22 * Math.sin(a)];
      face(
        o,
        'clear_glass',
        [
          [x, 0.36, z],
          [e[0], 0.36, e[1]],
          [e[0], 3, e[1]],
          [x, 3, z],
        ],
        blue,
      );
      beam(o, 'stainless', [e[0], 0.36, e[1]], [e[0], 3, e[1]], 0.04, 0.04, silver);
    }
    tube(o, 'stainless', [x, 3.05, z], [x, 3.17, z], 1.37, silver, sides);
  }
}

/** Original exterior geometry, except the documented entry correction and whole lobby piers. */
export function buildPrudentialCloseup(out) {
  const filter = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    filter[method] = (s, r, p, n, u, c) => {
      const min = p.reduce(
          (a, v) => a.map((k, i) => Math.min(k, v[i])),
          [Infinity, Infinity, Infinity],
        ),
        max = p.reduce(
          (a, v) => a.map((k, i) => Math.max(k, v[i])),
          [-Infinity, -Infinity, -Infinity],
        );
      const oldDoor =
        max[1] <= 3.13 &&
        min[0] >= -7.81 &&
        max[0] <= -2.59 &&
        min[2] >= -Z - 0.09 &&
        max[2] <= -Z + 0.12;
      const pier =
        s === 'cladding' && max[1] < 9.4 && max[0] - min[0] < 0.35 && max[2] - min[2] < 0.35;
      if (!oldDoor && !pier) out[method](s === 'recess' ? 'concrete' : s, r, p, n, u, c);
    };
  twoPrudentialPlazaStudy.build(filter);
  lobbyPiers(out);
  entrance(out);
}
function lobbyPiers(o) {
  const p = planAt(0);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.01) continue;
    const side = transformed(o, [...a.slice(0, 1), 0, a[1]], -Math.atan2(b[1] - a[1], b[0] - a[0]));
    const count = Math.max(1, Math.round(len / (2 * W)));
    for (let j = 0; j <= count; j++) {
      const x = Math.max(0.18, Math.min(len - 0.18, (j * len) / count));
      box(side, 'cladding', [x - 0.17, 0.28, -0.18], [x + 0.17, 9.38, 0.045], granite);
    }
  }
}

function compactPlan(row) {
  const p = planAt(row);
  return p.filter((b, i) => {
    const a = p[(i + p.length - 1) % p.length],
      c = p[(i + 1) % p.length];
    return (
      Math.abs(Math.abs(b[1]) - 2 * W) < 1e-8 ||
      Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-8
    );
  });
}
function slab(o, row, y) {
  floorPlate(o, compactPlan(row), y);
}
function terraceCaps(o, row, trim = false) {
  for (let j = 0; j < 14; j++) {
    const before = endDepth(row - 1, j),
      after = endDepth(row, j);
    if (before === after) continue;
    const y = baseY + row * floorH,
      z = -Z + j * W;
    for (const sign of [-1, 1]) {
      const a = Math.min(sign * before, sign * after),
        b = Math.max(sign * before, sign * after);
      face(
        o,
        'stone',
        [
          [a, y - 0.02, z],
          [a, y - 0.02, z + W],
          [b, y - 0.02, z + W],
          [b, y - 0.02, z],
        ],
        darkStone,
      );
      if (trim)
        box(
          o,
          'stainless',
          [sign * before - 0.1, y - 0.01, z],
          [sign * before + 0.1, y + 0.2, z + W],
          silver,
        );
    }
  }
}

function roof(o, tiers, ribs) {
  const target = clipped(o, crownPlanes),
    y0 = 221;
  const ring = (r, y) => [
    [0, y, -r],
    [-r, y, 0],
    [0, y, r],
    [r, y, 0],
  ];
  for (let i = 0; i < tiers; i++) {
    const y = y0 + ((apex - y0) * i) / tiers,
      yn = y0 + ((apex - y0) * (i + 1)) / tiers;
    const p = ring((apex - y) / roofSlope, y),
      q = ring(Math.max(0.025, (apex - yn) / roofSlope), yn);
    for (let j = 0; j < 4; j++) {
      face(target, 'glass', [p[j], p[(j + 1) % 4], q[(j + 1) % 4], q[j]], blue);
      if (ribs)
        beam(
          target,
          'stainless',
          p[j].map((v, k) => v + (k === 1 ? 0.11 : 0)),
          p[(j + 1) % 4].map((v, k) => v + (k === 1 ? 0.11 : 0)),
          0.7,
          0.32,
          silver,
        );
    }
  }
  const p = ring(0.807, apex),
    q = ring(0.017, tip);
  for (let j = 0; j < 4; j++)
    face(o, 'stainless', [p[j], p[(j + 1) % 4], q[(j + 1) % 4], q[j]], silver);
}

function facade(o, a, b, y, h, windowStep, kind) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.002) return;
  const n = Math.max(1, Math.round(len / W)),
    w = len / n;
  const side = transformed(o, [a[0], y, a[1]], -Math.atan2(b[1] - a[1], b[0] - a[0]));
  const panel = (slot, x0, x1, y0, y1, d, c) =>
    face(
      side,
      slot,
      [
        [x0, y0, d],
        [x1, y0, d],
        [x1, y1, d],
        [x0, y1, d],
      ],
      c,
    );
  if (kind === 'glazed') {
    panel('glass', 0, len, 0, h, -0.13, blue);
    return;
  }
  panel('cladding', 0, len, 0, h, 0, granite);
  for (let j = 0; j < n; j += windowStep) {
    const bays = Math.min(windowStep, n - j),
      span = bays * w,
      p = 0.4 * bays,
      rows = h / floorH;
    // Flat blue face in front of the unified wall: 0.14 m from the source reveal plane.
    panel('glass', j * w + p, j * w + span - p, 0.78 * rows, h - 0.47 * rows, 0.01, blue);
  }
}
function facadeKind(a, b) {
  const end = Math.abs(a[0] - b[0]) < 0.001,
    mid = (a[1] + b[1]) / 2;
  return (end && Math.abs(mid) < W * 2) || (!end && Math.abs(a[1]) < Z - 0.01) ? 'glazed' : 'stone';
}
function lobby(o, near) {
  const p = compactPlan(0);
  slab(o, 0, 0);
  slab(o, 0, 0.28);
  slab(o, 0, 9.4);
  box(o, 'stone', [-8, 0.28, -6], [8, 9.4, 6], darkStone);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      side = transformed(o, [a[0], 0, a[1]], -Math.atan2(b[1] - a[1], b[0] - a[0]));
    face(
      side,
      near ? 'clear_glass' : 'glass',
      [
        [0, 0.28, -0.13],
        [len, 0.28, -0.13],
        [len, 9.38, -0.13],
        [0, 9.38, -0.13],
      ],
      blue,
    );
    box(side, 'cladding', [0, 9.38, -0.22], [len, baseY, 0.08], granite);
    if (near) box(side, 'metal', [0, 4.68, -0.1], [len, 4.78, -0.06], metal);
  }
  lobbyPiers(o);
  if (near) entrance(o, 8);
}
export function buildPrudentialStreet(out) {
  const o = clipped(out, pyramidPlanes);
  lobby(o, true);
  for (let row = 0; row < 63; row++) {
    const p = planAt(row),
      y = baseY + row * floorH;
    for (let i = 0; i < p.length; i++)
      facade(o, p[i], p[(i + 1) % p.length], y, floorH, 1, facadeKind(p[i], p[(i + 1) % p.length]));
    if (row > 0) terraceCaps(o, row, true);
  }
  roof(out, 15, true);
}
export function buildPrudentialDistrict(out) {
  const o = clipped(out, pyramidPlanes);
  lobby(o, false);
  // Changes of plan always split a band, so no chevron setback is averaged away.
  const breaks = [0, 24, 26, 28, 30, 32, 34, 36, 40, 42, 44, 46, 48, 50, 52, 63];
  for (let k = 0; k < breaks.length - 1; k++) {
    const first = breaks[k],
      end = breaks[k + 1];
    for (let row = first; row < end; row += 3) {
      const p = compactPlan(row),
        h = Math.min(3, end - row) * floorH;
      for (let i = 0; i < p.length; i++)
        facade(
          o,
          p[i],
          p[(i + 1) % p.length],
          baseY + row * floorH,
          h,
          3,
          facadeKind(p[i], p[(i + 1) % p.length]),
        );
    }
    if (first > 0) terraceCaps(o, first);
  }
  roof(out, 15, true);
}
export function buildPrudentialSkyline(out) {
  const means = {
    cladding: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    stainless: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
  };
  const flat = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    flat[method] = (s, _r, p, n, u, c) =>
      out[method](
        'palette',
        'palette:#ffffff',
        p,
        n,
        u,
        c.map((v, i) => v * (means[s]?.[i] ?? 1)),
      );
  const o = clipped(flat, pyramidPlanes),
    breaks = [0, 24, 26, 28, 30, 32, 34, 36, 40, 42, 44, 46, 48, 50, 52, 63];
  slab(o, 0, 0);
  slab(o, 0, 0.28);
  const p0 = compactPlan(0);
  for (let i = 0; i < p0.length; i++)
    facade(o, p0[i], p0[(i + 1) % p0.length], 0.28, baseY - 0.28, 99, 'glazed');
  for (let k = 0; k < breaks.length - 1; k++) {
    const row = breaks[k],
      p = compactPlan(row),
      y = baseY + row * floorH,
      h = (breaks[k + 1] - row) * floorH;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        isGlass = facadeKind(a, b) === 'glazed';
      const color = isGlass
        ? blue
        : [
            0.7 * 0.507 + (0.2 * 0.493) / 0.7011092892788303,
            0.68 * 0.507 + (0.36 * 0.493) / 0.7011092892788303,
            0.65 * 0.507 + (0.46 * 0.493) / 0.7011092892788303,
          ];
      const side = transformed(o, [a[0], y, a[1]], -Math.atan2(b[1] - a[1], b[0] - a[0])),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      face(
        side,
        isGlass ? 'glass' : 'cladding',
        [
          [0, 0, 0],
          [len, 0, 0],
          [len, h, 0],
          [0, h, 0],
        ],
        color,
      );
    }
    if (row > 0) terraceCaps(o, row);
  }
  roof(flat, 1, false);
}

function endDepth(row, j) {
  const distance = Math.abs(j + 0.5 - 7),
    band = Math.floor(distance);
  const thresholds = [24 + 2 * (6 - band), 40 + 2 * (6 - band)];
  if (row < thresholds[0]) return X;
  if (row < thresholds[1]) return 23.15;
  return 18.8;
}

function planAt(row) {
  const plus = [];
  for (let j = 0; j < 14; j++) {
    const x = endDepth(row, j),
      z = -Z + j * W;
    plus.push([x, z], [x, z + W]);
  }
  // Clockwise X/Z boundary: west edge of each end bay faces outward without reflected meshes.
  const raw = [...plus, ...plus.toReversed().map(([x, z]) => [-x, z])].reverse();
  return raw.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]) > 0.001,
  );
}

function floorPlate(o, plan, y, slot = 'concrete') {
  // This orthogonal profile is star-shaped around the origin, including all its end recesses.
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    o.addTriangle(
      slot,
      'palette:#ffffff',
      [
        [0, y, 0],
        [a[0], y, a[1]],
        [b[0], y, b[1]],
      ],
      [0, 1, 0],
      [[0, 0], a, b],
      [0.43, 0.44, 0.43],
    );
  }
}
