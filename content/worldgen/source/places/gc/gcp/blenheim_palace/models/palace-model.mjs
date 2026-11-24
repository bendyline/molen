import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95 },
  dress: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.94 },
  paving: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.99 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78 },
  metal: { slot: 'trim', graph: 'metal_copper', roughness: 0.82 },
};

const stone = rgb('c4b18a'),
  rubbed = rgb('cdbc99'),
  edge = rgb('d0bf9a');
const warm = rgb('b3a181'),
  shade = rgb('686259'),
  glass = rgb('67808f'),
  roof = rgb('646b6f');
const gold = rgb('b69a59'),
  ticking = rgb('48494b');
const angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const at = (x, y, z) => [c * x - s * z, y, s * x + c * z];
const box = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const shellFloor = -14;
const mappedParts = new Map(site.parts.map((part) => [part.id, part]));

function ringCCW(p) {
  const area = p.reduce((n, [x, z], i) => {
    const [u, v] = p[(i + 1) % p.length];
    return n + x * v - z * u;
  }, 0);
  return area < 0 ? p : p.toReversed();
}

function face(out, slot, points, color, normal) {
  let p = points.map((q) => at(...q).map(Math.fround));
  if (normal && normalFor(...p).reduce((v, n, i) => v + n * normal[i], 0) < 0) p = p.toReversed();
  for (let i = 1; i + 1 < p.length; i++) {
    const q = [p[0], p[i], p[i + 1]],
      n = normalFor(...q);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', q, n, [], color);
  }
}

function cap(out, slot, ring, holes, h, color, down = false) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'trim',
      'palette:#ffffff',
      ring,
      holes,
      h,
      [0, down ? -1 : 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Invalid Blenheim Palace outline');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => indices[i + j] * 3);
    face(
      out,
      slot,
      p.map((k) => positions.slice(k, k + 3)),
      color,
    );
  }
}

function prism(out, slot, [ring, ...holes], floor, top, color, capSlot = slot, underside = false) {
  const low = typeof floor === 'function' ? floor : () => floor;
  for (const r of [ringCCW(ring), ...holes.map((h) => ringCCW(h).toReversed())]) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      const [x, z] = a,
        [u, v] = b;
      face(
        out,
        slot,
        [
          [x, low(a), z],
          [u, low(b), v],
          [u, top, v],
          [x, top, z],
        ],
        color,
      );
    }
  }
  cap(out, capSlot, ring, holes, () => top, capSlot === 'roof' ? roof : color);
  if (underside) cap(out, slot, ring, holes, low, color, true);
}

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  prism(out, slot, [box(x0, x1, z0, z1)], y0, y1, color);
}

function leadHip(out, [x0, x1, z0, z1], y, h) {
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const eaves = box(x0, x1, z0, z1).map(([u, v]) => [u, y, v]);
  const ridge = box(
    x + (x0 - x) * 0.72,
    x + (x1 - x) * 0.72,
    z + (z0 - z) * 0.2,
    z + (z1 - z) * 0.2,
  ).map(([u, v]) => [u, y + h, v]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, 'roof', [eaves[i], eaves[j], ridge[j], ridge[i]], roof, [0, 1, 0]);
  }
  face(out, 'roof', ridge, roof, [0, 1, 0]);
}

function column(out, x, z, y, h, r, detail, ornate = false) {
  const sections =
    detail === 0
      ? [
          [0, 1],
          [1, 0.86],
        ]
      : detail === 1
        ? [
            [0, 1.25],
            [0.08, 1],
            [0.9, 0.85],
            [1, 1.29],
          ]
        : [
            [0, 1.35],
            [0.04, 1.35],
            [0.075, 1.15],
            [0.12, 1],
            [0.81, 0.83],
            [0.89, 0.87],
            [0.935, 1.12],
            [0.97, 1.26],
            [1, 1.28],
          ];
  const n = detail <= 1 ? 6 : detail === 2 ? 10 : 14;
  loft(
    out,
    'dress',
    sections.map(([f, w]) => radialRing(y + h * f, r * w, r * w, n, [x, z]).map((p) => at(...p))),
    ornate ? edge : rubbed,
    { cap: false },
  );
}

function archShell(out, p, detail) {
  for (const ring of p.rings) prism(out, 'paving', ring, shellFloor, p.ground, stone);
  if (detail === 0) {
    for (const ring of p.rings)
      prism(out, 'wall', ring, p.ground + p.height, 13.65, stone, 'roof', true);
    return;
  }
  const spring = p.height - p.width * 0.49;
  const ceiling = ([, z]) =>
    p.ground +
    spring +
    p.width * 0.49 * Math.sqrt(Math.max(0, 1 - ((z - p.centerZ) / (p.width / 2)) ** 2));
  for (const ring of p.arches[detail === 1 ? 0 : 1])
    prism(out, 'wall', ring, ceiling, 13.65, stone, 'roof', true);
}

function pediment(out, x, z, y, width, height, depth) {
  const a = [x - width / 2, y, z],
    b = [x + width / 2, y, z],
    m = [x, y + height, z];
  const t = ([x, y, z]) => [x, y, z + depth];
  face(out, 'dress', [a, b, m], edge, at(0, 0, -Math.sign(depth)));
  face(out, 'dress', [t(a), t(m), t(b)], edge, at(0, 0, Math.sign(depth)));
  face(out, 'roof', [a, m, t(m), t(a)], roof, [0, 1, 0]);
  face(out, 'roof', [m, b, t(b), t(m)], roof, [0, 1, 0]);
}

function approach(out, detail) {
  const {
    bounds: [x0, x1, z0, z1],
    floor,
    backWall,
  } = site.portico;
  const count = detail === 0 ? 4 : detail === 1 ? 10 : 22;
  const depth = 5.78;
  for (let i = 0; i < count; i++) {
    const u = z0 + (depth * i) / count,
      v = z0 + (depth * (i + 1)) / count;
    block(
      out,
      'paving',
      x0,
      x1,
      u,
      v,
      -0.6,
      ((i + 1) * floor) / count,
      i % 3 === 0 ? rubbed : stone,
    );
  }
  block(out, 'paving', x0, x1, z0 + depth, z1, -0.62, floor, edge);
  block(out, 'wall', x0 - 0.14, x1 + 0.15, backWall + 0.06, backWall + 1.11, floor, 17.05, stone);
  block(out, 'dress', x0 - 0.16, x1 + 0.18, z0 + depth - 0.68, z1 + 0.2, 15.65, 17.16, edge);
  pediment(out, (x0 + x1) / 2, z0 + depth - 0.77, 17.15, x1 - x0 + 0.78, 2.85, 8.02);
  for (const x of [-8.42, -5.68, -2.71, 0.08, 3.15, 6.02]) {
    column(out, x, z0 + depth - 0.01, floor, 12.13, 0.64, detail, true);
  }
  if (detail >= 1)
    for (const x of [-5.3, -1.31, 2.7]) {
      face(
        out,
        'pane',
        [
          [x - 1.02, 4.3, backWall + 0.015],
          [x + 1.02, 4.3, backWall + 0.015],
          [x + 1.02, 12.48, backWall + 0.015],
          [x - 1.02, 12.48, backWall + 0.015],
        ],
        shade,
        at(0, 0, -1),
      );
    }
}

function planBounds(p) {
  return [0, 1].flatMap((a) => [Math.min(...p.map((r) => r[a])), Math.max(...p.map((r) => r[a]))]);
}

function pavilion(out, part, detail) {
  const [x0, x1, z0, z1] = planBounds(part.outline);
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2,
    r = Math.min(x1 - x0, z1 - z0) / 2;
  prism(out, 'wall', [part.outline], part.base - 0.02, part.height, stone);
  if (detail === 0) return;
  for (const y of [17.8, 21.96]) {
    block(
      out,
      'dress',
      x - r - 0.31,
      x + r + 0.31,
      z - r - 0.31,
      z + r + 0.31,
      y - 0.13,
      y + 0.32,
      edge,
    );
  }
  leadHip(out, [x - r + 0.1, x + r - 0.1, z - r + 0.1, z + r - 0.1], 22.2, 0.65);
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      const u = x + a * 3.82,
        v = z + b * 3.82;
      column(out, u, v, 22.12, 1.86, 0.34, detail === 2 ? 1 : detail);
      if (detail >= 2) sphere(out, 'dress', at(u, 24.05, v), [0.32, 0.44, 0.32], rubbed, 8, 4);
    }
  }
  if (detail >= 2)
    for (const offset of [-1, 1]) {
      pane(
        out,
        frame([x - r, z - r - 0.015], [x + r, z - r - 0.015]),
        r + 1.77 * offset,
        18.53,
        1.75,
        2.81,
        detail,
      );
      pane(
        out,
        frame([x + r, z + r + 0.015], [x - r, z + r + 0.015]),
        r + 1.77 * offset,
        18.53,
        1.75,
        2.81,
        detail,
      );
    }
}

function clockTower(out, x, z, detail, clock) {
  block(out, 'wall', x - 4.2, x + 4.2, z - 4.06, z + 4.06, 13.64, 24.73, stone);
  block(out, 'dress', x - 4.65, x + 4.65, z - 4.5, z + 4.5, 24.63, 25.3, edge);
  pediment(out, x, z - 4.55, 25.3, 9.45, 2.65, 9.1);
  if (detail === 0) return;
  sphere(out, 'metal', at(x, 28.76, z), [0.63, 0.72, 0.63], gold, detail >= 2 ? 12 : 8, 5);
  if (!clock) return;
  for (const [a, b] of [
    [
      [x - 4.2, z - 4.058],
      [x + 4.2, z - 4.058],
    ],
    [
      [x + 4.2, z + 4.058],
      [x - 4.2, z + 4.058],
    ],
    [
      [x + 4.2, z - 4.06],
      [x + 4.2, z + 4.06],
    ],
    [
      [x - 4.2, z + 4.06],
      [x - 4.2, z - 4.06],
    ],
  ]) {
    const side = frame(a, b);
    const circle = (n, r, q) =>
      Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        return side.point(side.span / 2 + r * Math.cos(a), 22.22 + r * Math.sin(a), q);
      });
    face(out, 'dress', circle(16, 1.15, 0.09), edge, side.normal);
    face(out, 'pane', circle(16, 1.01, 0.12), ticking, side.normal);
    if (detail >= 2) {
      beam(
        out,
        'metal',
        at(...side.point(side.span / 2, 22.22, 0.17)),
        at(...side.point(side.span / 2 + 0.51, 22.43, 0.17)),
        0.055,
        0.047,
        gold,
      );
      beam(
        out,
        'metal',
        at(...side.point(side.span / 2, 22.22, 0.17)),
        at(...side.point(side.span / 2 - 0.22, 22.93, 0.17)),
        0.043,
        0.045,
        gold,
      );
    }
  }
}

function frame([x, z], [u, v]) {
  const span = Math.hypot(u - x, v - z),
    dx = (u - x) / span,
    dz = (v - z) / span;
  return {
    span,
    normal: at(dz, 0, -dx),
    point: (p, y, q) => [x + dx * p + dz * q, y, z + dz * p - dx * q],
  };
}

function pane(out, { point, normal }, u, y, w, h, detail) {
  const panel = (r, h0, h1, q) => [
    point(u - r, h0, q),
    point(u + r, h0, q),
    point(u + r, h1, q),
    point(u - r, h1, q),
  ];
  face(out, 'pane', panel(w * 0.5, y, y + h, 0.052), glass, normal);
  if (detail < 2) return;
  const sill = panel(w * 0.63, y - 0.18, y + 0.03, 0.17);
  face(out, 'dress', sill, edge, normal);
  face(out, 'dress', panel(w * 0.61, y + h, y + h + 0.21, 0.13), edge, normal);
  face(out, 'dress', panel(0.048, y + 0.04, y + h - 0.04, 0.091), rubbed, normal);
  if (detail === 3)
    beam(
      out,
      'dress',
      at(...point(u - w * 0.5, y + h * 0.58, 0.091)),
      at(...point(u + w * 0.5, y + h * 0.58, 0.091)),
      0.065,
      0.065,
      rubbed,
    );
}

function facades(out, input, detail, inner = false) {
  const ring = inner ? ringCCW(input) : ringCCW(input).toReversed();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      side = frame(a, b);
    if (side.span < 4.8) continue;
    const main = (a[1] + b[1]) / 2 > -42.8;
    const y = main ? 12.25 : 13.65;
    const bays = Math.max(1, Math.round(side.span / (detail === 1 ? 6.12 : 4.68)));
    for (let j = 0; j < bays; j++) {
      const u = (side.span * (j + 0.5)) / bays,
        [x, , z] = side.point(u, 0, 0);
      if (x >= -9.92 && x <= 7.43 && z >= -28 && z <= -15.23 && !inner) continue;
      const opening = site.passages.some((p) => {
        const xs = p.line.map((q) => q[0]);
        return (
          x > Math.min(...xs) - 0.72 &&
          x < Math.max(...xs) + 0.72 &&
          Math.abs(z - p.centerZ) < p.width * 0.5 + 0.82
        );
      });
      if (!opening) pane(out, side, u, 2.25, 1.38, main ? 5.11 : 4.28, detail);
      pane(out, side, u, main ? 8.92 : 8.14, 1.44, main ? 2.61 : 2.86, detail);
      if (detail >= 2 && !inner && main && j < bays - 1) {
        const p = side.point(u + (side.span * 0.43) / bays, 1.38, 0.2);
        beam(out, 'dress', at(...p), at(p[0], y - 0.39, p[2]), 0.36, 0.41, rubbed);
      }
    }
  }
}

function centralRoof(out, detail) {
  const hall = mappedParts.get(928433261);
  const [x0, x1, z0, z1] = planBounds(hall.outline);
  prism(out, 'wall', [hall.outline], 12.21, hall.height - 4, stone);
  pediment(out, (x0 + x1) / 2, z0, hall.height - 4, x1 - x0, 4, z1 - z0);
  if (detail === 0) {
    leadHip(out, [-47.5, -10.2, -27.1, 13.16], 12.23, 3.9);
    leadHip(out, [8.02, 45.8, -27.3, 12.97], 12.23, 3.9);
    return;
  }
  for (const id of [
    928433241, 928433260, 928433268, 928433269, 928433276, 928433277, 928433278, 928433279,
    928433280, 928433281, 928433282, 928433283, 928433284, 928433285,
  ]) {
    const p = mappedParts.get(id),
      rise = p.roof === 'hipped' ? Math.min(1.7, p.height - 12.28) : 0;
    const eave = p.height - rise;
    prism(out, 'wall', [p.outline], 12.21, eave, stone, rise === 0 ? 'roof' : 'wall');
    if (rise > 0) {
      const ring = ringCCW(p.outline),
        [a, b, c, d] = planBounds(ring);
      const x = (a + b) / 2,
        z = (c + d) / 2;
      const inset = ring.map(([u, v]) => [x + (u - x) * 0.43, z + (v - z) * 0.67]);
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        const pt = ([x, z], y) => [x, y, z];
        face(
          out,
          'roof',
          [pt(ring[i], eave), pt(ring[j], eave), pt(inset[j], p.height), pt(inset[i], p.height)],
          roof,
          [0, 1, 0],
        );
      }
      cap(out, 'roof', inset, [], () => p.height, roof);
    }
  }
}

function palace(out, detail) {
  for (const { top, rings } of site.shells)
    for (const ring of rings) prism(out, 'wall', ring, shellFloor, top, stone, 'roof');
  for (const p of site.passages) archShell(out, p, detail);
  for (const id of [928433270, 928433271]) {
    const { outline, height } = mappedParts.get(id);
    prism(out, 'wall', [outline], shellFloor, height, rubbed, 'roof');
    if (detail >= 2) facades(out, outline, detail);
  }
  approach(out, detail);

  centralRoof(out, detail);
  for (const id of [928433272, 928433273, 928433274, 928433275])
    pavilion(out, mappedParts.get(id), detail);
  for (const [x, z, clock] of [
    [59.46, -91.21, true],
    [-60.88, -90.94, false],
  ])
    clockTower(out, x, z, detail, clock);
  leadHip(out, [-112.24, -51.15, -121.62, -110.08], 13.63, 2.75);
  leadHip(out, [49.77, 129.44, -122.4, -107.84], 13.63, 2.95);
  leadHip(out, [51.05, 130.17, -74.17, -60.12], 13.63, 2.84);
  leadHip(out, [120.3, 129.71, -107.15, -77.31], 13.63, 2.41);
  if (detail === 0) return;
  facades(out, site.plan, detail);
  const east = site.courtyards[0].outline.map(([x, z]) => [c * x + s * z, c * z - s * x]);
  facades(out, east, detail, true);
  for (const [x, z] of [
    [-91, -122.34],
    [94, -123.02],
  ])
    pediment(out, x, z, 13.62, 19, 3.36, 7.6);
  for (const x of [-47.31, 43.81]) {
    block(out, 'dress', x - 0.67, x + 0.67, -69.2, -43.27, 10.92, 11.73, edge);
    const edgeX = x + Math.sign(x) * -0.59;
    for (let i = 0; i < 8; i++) column(out, edgeX, -44.8 - i * 3.01, 0.52, 10.41, 0.44, detail);
  }
  if (detail >= 2)
    for (const [x, z, w, n] of [
      [-1.2, -20.3, 17.94, 16],
      [-1.25, 18.77, 16.2, 14],
      [-86.6, -122.2, 47.9, 27],
      [95.2, -122.8, 69.2, 38],
    ]) {
      const y = z > -30 ? 17.16 : 13.74;
      block(out, 'dress', x - w / 2, x + w / 2, z - 0.21, z + 0.21, y + 0.78, y + 1.04, edge);
      for (let i = 0; i < n; i++)
        column(out, x + w * ((i + 0.5) / n - 0.5), z, y, 0.8, 0.139, detail === 2 ? 0 : 2);
    }
}

export const buildSkyline = (out) => palace(out, 0);
export const buildDistrict = (out) => palace(out, 1);
export const buildStreet = (out) => palace(out, 2);
export const buildCloseup = (out) => palace(out, 3);
export const buildMaster = buildCloseup;
