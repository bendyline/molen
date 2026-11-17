/** Holy Trinity Cathedral in Addis Ababa, with an open seven-arched west portico. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const field = read('map-frame.json');
const west = plan.dimensions.westFace;
const poly = field.geometry.outline;
const pal = 'palette:#ffffff';
const front = [0, 0, 1];
const up = [0, 1, 0];
const c = Object.fromEntries(
  Object.entries({
    ashlar: 'ada293',
    limestone: 'b6ab9a',
    course: 'a69887',
    trim: 'c5b8a5',
    cream: 'cbbda8',
    plinth: '969089',
    carved: 'b0a38e',
    earth: 'b0a49a',
    roof: '6f6b68',
    cap: '716d66',
    dome: '88796d',
    metal: '655e50',
    gilt: 'ae9668',
    door: '5e544d',
    glass: '657477',
    dark: '535653',
    apse: 'b5a796',
    sky: '8c8984',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.11 },
  metal: { slot: 'trim', graph: 'metal_copper', roughness: 0.8, metallic: 0.14 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.52, metallic: 0.04 },
  shade: { slot: 'window', localRef: pal, roughness: 0.89, metallic: 0 },
};
const width = west.widthMeters;
const floor = 1.09;
const vRear = -west.porticoDepthEstimateMeters;
const corniceY = west.upperCorniceHeightEstimateMeters;
const ent = west.entablatureHeightEstimateMeters;
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const pos = ([u, v], y) => [u, y, v];
const norm = ([x, z]) => {
  const r = Math.hypot(x, z);
  return [x / r, z / r];
};
const tau = 2 * Math.PI;

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const lo = terrain.heightsMeters[j],
    hi = terrain.heightsMeters[j + 1];
  return (
    (lo[i] * (1 - a) + lo[i + 1] * a) * (1 - b) +
    (hi[i] * (1 - a) + hi[i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function frame([x, z], direction) {
  const [nx, nz] = norm(direction);
  return {
    point: (u, y, v) => [x + nz * u + nx * v, y, z - nx * u + nz * v],
    normal: ([u, y, v]) => [nz * u + nx * v, y, -nx * u + nz * v],
    local: ([a, b]) => [(a - x) * nz - (b - z) * nx, (a - x) * nx + (b - z) * nz],
  };
}

function oriented(out, axes) {
  return {
    addQuad(slot, mat, p, n, uv, color) {
      out.addQuad(
        slot,
        mat,
        p.map((v) => axes.point(...v)),
        axes.normal(n),
        uv,
        color,
      );
    },
    addTriangle(slot, mat, p, n, uv, color) {
      out.addTriangle(
        slot,
        mat,
        p.map((v) => axes.point(...v)),
        axes.normal(n),
        uv,
        color,
      );
    },
    addConvexPolygon(slot, mat, p, n, uv, color) {
      out.addConvexPolygon(
        slot,
        mat,
        p.map((v) => axes.point(...v)),
        axes.normal(n),
        uv,
        color,
      );
    },
  };
}

function face(out, slot, points, desired, color) {
  const n = normalFor(...points);
  const sign = n.reduce((s, v, i) => s + v * desired[i], 0) < 0 ? -1 : 1;
  out.addConvexPolygon(
    slot,
    pal,
    points,
    n.map((v) => v * sign),
    ([x, y, z]) => [x - z, y],
    color,
  );
}

function panel(out, slot, u, y, v, w, h, color) {
  quad(
    out,
    slot,
    [
      [u, y, v],
      [u + w, y, v],
      [u + w, y + h, v],
      [u, y + h, v],
    ],
    front,
    color,
  );
}

function shellCap(out, ring, y, slot, color) {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      slot,
      pal,
      ring,
      [],
      () => y,
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Cathedral roof polygon is invalid');
  const cap = temp.finalize();
  for (let i = 0; i < cap.indices.length; i += 3) {
    const p = Array.from(cap.indices.slice(i, i + 3), (j) =>
      Array.from(cap.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, p, up, color);
  }
}

const axes = frame(west.center, west.outward);
const localOutline = poly.map((p) => axes.local(p));
function grade(u, v) {
  const [x, , z] = axes.point(u, 0, v);
  return ground(x, z);
}

function archedPanel(out, u, y, v, half, spring, rise, count, slot, color) {
  panel(out, slot, u - half, y, v, 2 * half, spring - y, color);
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count,
      b = ((i + 1) * Math.PI) / count;
    face(
      out,
      slot,
      [
        [u, spring, v],
        [u + half * Math.cos(a), spring + rise * Math.sin(a), v],
        [u + half * Math.cos(b), spring + rise * Math.sin(b), v],
      ],
      front,
      color,
    );
  }
}

function insetWindow(out, u, y, v, w, h, lod) {
  const n = [3, 5, 9, 14][lod];
  const r = w / 2;
  archedPanel(out, u, y - 0.055, v, r + 0.12, y + h * 0.73, h * 0.27 + 0.1, n, 'trim', c.trim);
  archedPanel(out, u, y, v + 0.021, r, y + h * 0.73, h * 0.27, n, 'glass', c.glass);
  if (lod > 1) {
    panel(out, 'metal', u - 0.025, y + 0.05, v + 0.037, 0.05, h - 0.15, c.metal);
    panel(out, 'metal', u - r, y + h * 0.51, v + 0.039, w, 0.06, c.metal);
  }
}

function mainStair(out, lod) {
  const n = [2, 5, 8, 10][lod];
  const side = west.widthMeters / 2 + 0.58;
  for (let i = 0; i < n; i++) {
    const u = i / n,
      v = (i + 1) / n;
    const far = 2.5 + 3.95 * v + 0.24 * Math.max(0, i - (n - 4));
    const near = i === 0 ? -0.25 : 2.5 + 3.95 * u + 0.24 * Math.max(0, i - 1 - (n - 4));
    const low =
      Math.min(...[-side, 0, side].flatMap((w) => [grade(w, near), grade(w, far)])) - 0.75;
    box(
      out,
      'base',
      [-side - 0.08 * i, low, near],
      [side + 0.08 * i, floor - 1.17 * u, far],
      c.earth,
    );
  }
  const low =
    Math.min(
      grade(-side, vRear),
      grade(0, vRear),
      grade(side, vRear),
      grade(-side, 0),
      grade(side, 0),
    ) - 0.66;
  box(out, 'base', [-side + 0.55, low, vRear], [side - 0.53, floor + 0.01, 0.2], c.plinth);
}

function archOpening(out, mid, span, main, lod) {
  const r = span / 2;
  const spring = main ? 4.57 : 4.32;
  const rise = main ? 2.91 : 1.22;
  const count = [3, 7, 11, 16][lod];
  const v = 0.15;
  const inner = (a, z) => [mid + r * Math.cos(a), spring + rise * Math.sin(a), z];
  const outer = (a, z) => [mid + (r + 0.2) * Math.cos(a), spring + (rise + 0.22) * Math.sin(a), z];
  const depth = main ? 1.45 : 1.19;
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count,
      b = ((i + 1) * Math.PI) / count;
    const aa = inner(a, v),
      bb = inner(b, v);
    const A = lod ? outer(a, v + 0.13) : aa,
      B = lod ? outer(b, v + 0.13) : bb;
    face(
      out,
      'stone',
      [A, B, [B[0], ent + 0.07, v + 0.04], [A[0], ent + 0.07, v + 0.04]],
      front,
      c.limestone,
    );
    if (lod > 0) face(out, 'trim', [aa, A, B, bb], front, i % 5 === 2 ? c.carved : c.trim);
    if (lod > 0)
      face(
        out,
        'stone',
        [bb, aa, inner(a, -depth), inner(b, -depth)],
        [mid - (aa[0] + bb[0]) / 2, -1, 0],
        c.ashlar,
      );
  }
  if (lod > 0)
    for (const sign of [-1, 1]) {
      const x = mid + r * sign;
      face(
        out,
        'stone',
        [
          [x, floor, v],
          [x, spring, v],
          [x, spring, -depth],
          [x, floor, -depth],
        ],
        [-sign, 0, 0],
        c.ashlar,
      );
    }
  if (lod > 1) {
    for (const sign of [-1, 1]) {
      const x = mid + sign * (r + 0.11);
      panel(out, 'trim', x - 0.092, spring - 0.12, v + 0.141, 0.184, 0.17, c.cream);
    }
  }
}

function westPortico(out, lod) {
  const bays = plan.dimensions.photographControlledBays;
  mainStair(out, lod);
  let left = -width / 2;
  for (const [type, x, span] of bays) {
    const edge = x - span / 2;
    if (edge - left > 0.06)
      box(out, 'stone', [left, floor, vRear * 0.21], [edge, ent + 0.07, 0.22], c.limestone);
    archOpening(out, x, span, type === 'main-arch', lod);
    left = x + span / 2;
  }
  box(out, 'stone', [left, floor, vRear * 0.21], [width / 2, ent + 0.07, 0.22], c.limestone);
  box(out, 'stone', [-width / 2, ent, -1.44], [width / 2, corniceY, -0.048], c.limestone);
  box(out, 'stone', [-width / 2, corniceY - 0.63, -7.1], [width / 2, corniceY, 0.13], c.limestone);
  for (const [u, sign] of [
    [-width / 2, -1],
    [width / 2, 1],
  ]) {
    const start = -0.03;
    const end = vRear;
    face(
      out,
      'stone',
      [
        [u, floor, start],
        [u, floor, end],
        [u, corniceY, end],
        [u, corniceY, start],
      ],
      [sign, 0, 0],
      c.limestone,
    );
  }
  for (const [y, h, v] of [
    [7.92, 0.37, 0.41],
    [12.51, 0.37, 0.43],
  ]) {
    box(out, 'trim', [-width / 2 - 0.13, y, -0.45], [width / 2 + 0.13, y + h, v], c.trim);
  }
  const count = lod === 0 ? 3 : 12;
  for (let i = 0; i <= count; i++) {
    const u = -width / 2 + 0.25 + (i * (width - 0.5)) / count;
    box(out, 'trim', [u - 0.14, ent + 0.12, -0.09], [u + 0.14, corniceY - 0.37, 0.26], c.carved);
    if (lod > 1)
      box(out, 'trim', [u - 0.26, ent + 0.26, -0.12], [u + 0.26, ent + 0.55, 0.32], c.trim);
  }
  if (lod > 0) {
    for (let i = 1; i < bays.length; i++) {
      const [, a, w] = bays[i - 1],
        [, b, j] = bays[i];
      const mid = (a + w / 2 + b - j / 2) / 2;
      box(out, 'trim', [mid - 0.27, floor - 0.03, -0.02], [mid + 0.27, floor + 0.24, 0.43], c.trim);
      box(out, 'trim', [mid - 0.18, floor + 0.18, 0.2], [mid + 0.18, 5.18, 0.4], c.carved);
      box(out, 'trim', [mid - 0.23, 5.03, 0.17], [mid + 0.23, 5.33, 0.44], c.trim);
    }
  }
  for (const [u, w] of [
    [-8.5, 1.82],
    [0, 3.14],
    [8.5, 1.82],
  ]) {
    archedPanel(
      out,
      u,
      floor,
      vRear + 0.11,
      w / 2,
      3.49,
      w * 0.35,
      [4, 7, 11, 16][lod],
      'wood',
      c.door,
    );
    if (lod > 1) panel(out, 'metal', u - 0.035, floor + 0.09, vRear + 0.129, 0.07, 2.6, c.metal);
  }
}

function contour(out, u, z, base, points, depth, lod) {
  for (let i = 1; i < points.length; i++) {
    const [a, ya] = points[i - 1],
      [b, yb] = points[i];
    face(
      out,
      'stone',
      [
        [u + a, base, z],
        [u + b, base, z],
        [u + b, yb, z],
        [u + a, ya, z],
      ],
      front,
      c.limestone,
    );
    face(
      out,
      'trim',
      [
        [u + a, ya, z],
        [u + b, yb, z],
        [u + b, yb, z - depth],
        [u + a, ya, z - depth],
      ],
      up,
      c.trim,
    );
    if (lod > 0) {
      face(
        out,
        'trim',
        [
          [u + a, ya - 0.14, z + 0.084],
          [u + b, yb - 0.14, z + 0.084],
          [u + b, yb + 0.05, z + 0.084],
          [u + a, ya + 0.05, z + 0.084],
        ],
        front,
        c.trim,
      );
    }
  }
}

function cross(out, u, y, v, size, lod, baroque = false) {
  const stem = 0.075 * size;
  box(out, 'metal', [u - stem, y, v - stem], [u + stem, y + size, v + stem], c.gilt);
  box(
    out,
    'metal',
    [u - 0.35 * size, y + 0.64 * size, v - stem],
    [u + 0.35 * size, y + 0.64 * size + 2 * stem, v + stem],
    c.gilt,
  );
  if (lod < 2 || !baroque) return;
  const p = (angle) => [
    u + size * 0.3 * Math.cos(angle),
    y + size * (0.72 + 0.3 * Math.sin(angle)),
    v,
  ];
  for (let i = 0; i < 8; i++)
    beam(out, 'metal', p((tau * i) / 8), p((tau * (i + 1)) / 8), stem * 0.76, stem * 0.7, c.gilt);
}

function finial(out, u, v, y, h, lod) {
  box(
    out,
    'trim',
    [u - h * 0.18, y - 0.04, v - h * 0.18],
    [u + h * 0.18, y + h * 0.26, v + h * 0.18],
    c.trim,
  );
  loft(
    out,
    'trim',
    [
      [0.23, 0.12],
      [0.51, 0.17],
      [0.72, 0.14],
      [0.97, 0.021],
    ].map(([dy, r]) => radialRing(y + h * dy, r * h, r * h, lod > 1 ? 8 : 5, [u, v])),
    c.carved,
  );
}

function tower(out, u, v, lod) {
  const s = [5, 10, 16, 24][lod];
  box(out, 'stone', [u - 1.66, 11.8, v - 1.59], [u + 1.66, 15.02, v + 1.59], c.ashlar);
  box(out, 'trim', [u - 1.83, 14.76, v - 1.78], [u + 1.83, 15.12, v + 1.78], c.trim);
  const profile = [
    [15.08, 1.65],
    [15.6, 1.76],
    [16.05, 1.71],
    [16.52, 1.38],
    [17.04, 1.07],
    [17.59, 0.68],
    [18.13, 0.28],
    [18.39, 0.1],
  ];
  const groups =
    lod === 0 ? profile.filter((_, i) => i % 2 === 0 || i === profile.length - 1) : profile;
  loft(
    out,
    'roof',
    groups.map(([y, r]) => radialRing(y, r, r, s, [u, v], Math.PI / 8)),
    c.cap,
  );
  cross(out, u, 18.39, v, 1.2, lod, true);
  if (lod > 0) {
    for (const normal of [
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const side = oriented(out, frame([u, v], normal));
      insetWindow(side, 0, 12.13, 1.74, 1.25, 2.02, lod);
    }
  }
}

function rooftopStatue(out, u, v, y, lod) {
  box(out, 'trim', [u - 0.31, y, v - 0.28], [u + 0.31, y + 0.22, v + 0.28], c.trim);
  const levels = [
    [0.22, 0.22, 0.16],
    [0.84, 0.215, 0.15],
    [1.1, 0.17, 0.135],
    [1.19, 0.115, 0.111],
    [1.36, 0.126, 0.12],
    [1.51, 0.05, 0.05],
  ];
  loft(
    out,
    'trim',
    levels.map(([dy, x, z]) => radialRing(y + dy, x, z, lod === 3 ? 8 : 5, [u, v])),
    c.carved,
  );
  if (lod > 1) {
    beam(out, 'trim', [u - 0.16, y + 1.07, v], [u - 0.36, y + 0.7, v + 0.09], 0.13, 0.14, c.carved);
    beam(
      out,
      'trim',
      [u + 0.16, y + 1.06, v],
      [u + 0.29, y + 0.77, v + 0.13],
      0.13,
      0.14,
      c.carved,
    );
  }
}

function facadeCrests(out, lod) {
  tower(out, -9.87, -1.69, lod);
  tower(out, 9.87, -1.69, lod);
  const main = [
    [-4.12, 12.97],
    [-3.45, 13.11],
    [-2.94, 13.92],
    [-2.38, 14.51],
    [-1.64, 14.64],
    [-1.42, 15.99],
    [-0.7, 16.53],
    [0, 16.7],
    [0.7, 16.53],
    [1.42, 15.99],
    [1.64, 14.64],
    [2.38, 14.51],
    [2.94, 13.92],
    [3.45, 13.11],
    [4.12, 12.97],
  ];
  contour(
    out,
    0,
    0.38,
    12.75,
    lod ? main : main.filter((_, i) => i % 2 === 0 || i === 7),
    2.29,
    lod,
  );
  cross(out, 0, 16.52, 0.35, 0.76, lod);
  const side = [
    [-2.64, 12.83],
    [-1.9, 13.12],
    [-1.31, 13.89],
    [-0.7, 14.23],
    [0, 15.23],
    [0.7, 14.23],
    [1.31, 13.89],
    [1.9, 13.12],
    [2.64, 12.83],
  ];
  for (const u of [-8.24, 8.24]) {
    contour(out, u, 0.33, 12.78, lod ? side : side.filter((_, i) => i % 2 === 0), 1.24, lod);
    cross(out, u, 15.12, 0.3, 0.61, lod);
  }
  const finials =
    lod === 0
      ? [-12.92, -4.37, 4.37, 12.92]
      : [-12.92, -11.27, -5.91, -4.37, -2.45, 2.45, 4.37, 5.91, 11.27, 12.92];
  for (const u of finials) {
    if (lod === 0) box(out, 'trim', [u - 0.16, 12.68, -0.16], [u + 0.16, 13.64, 0.16], c.trim);
    else finial(out, u, -0.02, 12.71, Math.abs(u) < 6 ? 1.35 : 1.12, lod);
  }
  if (lod > 0) for (const u of [-12.82, 12.82]) rooftopStatue(out, u, -0.95, 13.05, lod);
  if (lod > 0) {
    archedPanel(out, 0, 13.79, 0.475, 0.38, 15.42, 0.41, lod === 1 ? 5 : 10, 'trim', c.trim);
    archedPanel(out, 0, 14.03, 0.51, 0.26, 15.37, 0.28, lod === 1 ? 5 : 10, 'shade', c.dark);
    for (const u of [-8.23, 8.23]) {
      const vertices = Array.from({ length: lod === 1 ? 8 : 16 }, (_, i) => {
        const a = (tau * i) / (lod === 1 ? 8 : 16);
        return [u + 0.36 * Math.cos(a), 14.07 + 0.45 * Math.sin(a), 0.436];
      });
      face(out, 'shade', vertices, front, c.dark);
    }
  }
}

function body(out, lod) {
  // The western seven metres are the open portico. The remaining ring follows the mapped nave and sanctuary.
  const trunk = [[-width / 2, vRear], ...localOutline.slice(1, -1), [width / 2, vRear]];
  const sign = -Math.sign(
    trunk.reduce((sum, [u, v], i) => {
      const [a, b] = trunk[(i + 1) % trunk.length];
      return sum + u * b - v * a;
    }, 0),
  );
  const top = 12.19;
  for (let i = 0; i < trunk.length; i++) {
    const a = trunk[i],
      b = trunk[(i + 1) % trunk.length];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (span < 0.07) continue;
    const normal = [sign * (a[1] - b[1]), sign * (b[0] - a[0])];
    const side = frame(blend(a, b, 0.5), normal);
    const wallN = side.normal(front);
    const bottomA = Math.min(floor - 0.46, grade(...a) - 0.54);
    const bottomB = Math.min(floor - 0.46, grade(...b) - 0.54);
    face(
      out,
      'base',
      [pos(a, bottomA), pos(b, bottomB), pos(b, 1.35), pos(a, 1.35)],
      wallN,
      c.plinth,
    );
    face(out, 'stone', [pos(a, 1.35), pos(b, 1.35), pos(b, top), pos(a, top)], wallN, c.limestone);
    const local = oriented(out, side);
    if (lod > 0) {
      for (const [y, h] of [
        [1.36, 0.18],
        [5.24, 0.15],
        [10.91, 0.18],
        [11.96, 0.26],
      ]) {
        if (lod === 1) panel(local, 'trim', -span / 2 + 0.03, y, 0.2, span - 0.06, h, c.trim);
        else
          box(local, 'trim', [-span / 2 + 0.03, y, -0.05], [span / 2 - 0.03, y + h, 0.2], c.trim);
      }
    }
    if (lod === 0 || i === trunk.length - 1 || span < 3.0) continue;
    const count = Math.max(1, Math.round(span / (lod === 0 ? 9.6 : 5.55)));
    const step = span / count;
    for (let j = 0; j < count; j++) {
      const u = step * (j + 0.5 - count / 2);
      insetWindow(local, u, 3.08, 0.035, Math.min(1.9, step * 0.46), 4.27, lod);
      if (lod > 0) insetWindow(local, u, 8.47, 0.043, Math.min(1.06, step * 0.39), 1.71, lod);
      if (lod > 1 && span > 9) {
        const x = u - step / 2 + 0.25;
        box(local, 'stone', [x - 0.18, 1.15, -0.1], [x + 0.18, 11.97, 0.32], c.ashlar);
        box(local, 'trim', [x - 0.24, 9.78, -0.08], [x + 0.24, 9.97, 0.34], c.trim);
      }
    }
  }
  shellCap(out, trunk, top, 'roof', c.roof);
}

function roofRidge(out, u0, u1, v0, v1, eaves, h) {
  const u = (u0 + u1) / 2;
  for (const side of [u0, u1])
    face(
      out,
      'roof',
      [
        [side, eaves, v0],
        [side, eaves, v1],
        [u, eaves + h, v1],
        [u, eaves + h, v0],
      ],
      up,
      c.roof,
    );
  for (const v of [v0, v1])
    face(
      out,
      'stone',
      [
        [u0, eaves, v],
        [u1, eaves, v],
        [u, eaves + h, v],
      ],
      [0, 0, v === v0 ? 1 : -1],
      c.limestone,
    );
}

function mainDome(out, lod) {
  const u = 0,
    v = -32.1;
  const sides = [8, 20, 30, 44][lod];
  roofRidge(out, -8.35, 8.35, -7.12, -44.2, 12.16, 4.35);
  roofRidge(out, -5.56, 5.56, -45.65, -54.29, 12.14, 2.53);
  box(out, 'stone', [-6.56, 12.13, v - 6.5], [6.56, 17.1, v + 6.5], c.ashlar);
  loft(
    out,
    'stone',
    [
      [16.91, 5.91],
      [17.41, 6.04],
      [20.08, 5.99],
      [20.48, 6.11],
    ].map(([y, r]) => radialRing(y, r, r, sides, [u, v])),
    c.limestone,
  );
  if (lod > 0)
    for (let i = 0; i < 12; i++) {
      const a = (tau * i) / 12;
      const side = oriented(
        out,
        frame([u + 5.92 * Math.cos(a), v + 5.92 * Math.sin(a)], [Math.cos(a), Math.sin(a)]),
      );
      insetWindow(side, 0, 17.75, 0.049, 0.97, 1.92, lod);
    }
  const profile = [
    [20.48, 6.02],
    [21.02, 5.98],
    [21.91, 5.79],
    [23.02, 5.23],
    [24.04, 4.46],
    [24.91, 3.52],
    [25.69, 2.4],
    [26.23, 1.26],
    [26.42, 0.76],
  ];
  const chosen = lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile;
  loft(
    out,
    'metal',
    chosen.map(([h, r]) => radialRing(h, r, r, sides, [u, v])),
    c.dome,
  );
  loft(
    out,
    'stone',
    [
      [26.4, 0.74],
      [26.94, 0.78],
      [27.83, 0.7],
    ].map(([h, r]) => radialRing(h, r, r, lod === 0 ? 8 : 14, [u, v])),
    c.carved,
  );
  loft(
    out,
    'metal',
    [
      [27.81, 0.88],
      [28.31, 0.61],
      [28.69, 0.15],
    ].map(([h, r]) => radialRing(h, r, r, lod === 0 ? 8 : 14, [u, v])),
    c.cap,
  );
  cross(out, u, 28.67, v, 1.48, lod, true);
}

function draw(out, lod) {
  const local = oriented(out, axes);
  body(local, lod);
  mainDome(local, lod);
  westPortico(local, lod);
  facadeCrests(local, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-79, 35, 58];
const lookAt = [-12, 10, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: slug + '-model.mjs',
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Holy Trinity Cathedral in Addis Ababa with its open western arcade, wide steps, twin bulbous turrets, prominent dome, and the east sanctuary.',
  camera,
  lookAt,
  sunDirection: [-100, 131, 78],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.31,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'seven-arched-west-front', position: [-75, 8.4, -2.2], lookAt: [-30, 10.7, -0.17] },
    { name: 'stone-piers-and-west-approach', position: [-54, 4.9, 19.4], lookAt: [-33.2, 6.8, 0] },
    { name: 'central-dome-and-east-sanctuary', position: [53, 19, 43], lookAt: [0, 12, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.39,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.07, surfaces },
      street: { export: 'street', errorMeters: 0.39, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independently modeled from a mapped building footprint, CC0 Dutch National Archives photographs and the unchanged Terrarium elevation field.',
};
