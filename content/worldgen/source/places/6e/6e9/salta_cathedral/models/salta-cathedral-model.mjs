/** Salta Cathedral's plaza elevation and cruciform church. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const {
  foundationBottom,
  threshold,
  front,
  portalCenters,
  frontArcade,
  towers,
  nave,
  crossing,
  choir,
  aisleLeft,
  aisleRight,
  transept,
} = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.76, metallic: 0.37 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.74, metallic: 0.04 },
};
const colors = Object.fromEntries(
  Object.entries({
    wall: 'cb929e',
    reveal: 'a8697b',
    stone: 'e9dcc0',
    shadow: 'c9b99d',
    base: '9d8d7e',
    roof: '9d7862',
    dome: '9b9f8c',
    pane: '506979',
    dark: '594a4a',
    door: '614632',
    gold: '987445',
    bronze: '574b3e',
    pale: 'd5d9cf',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';
const area = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}
function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [dz * sign, 0, -dx * sign];
  return {
    length,
    n,
    point: (u, y, p = 0) => [a[0] + u * dx + p * n[0], y, a[1] + u * dz + p * n[2]],
  };
}
function edges(ring) {
  const sign = Math.sign(area(ring));
  return ring.map((p, i) => edge(p, ring[(i + 1) % ring.length], sign));
}
function panel(out, slot, e, a, b, bottom, top, p, tint) {
  face(
    out,
    slot,
    [e.point(a, bottom, p), e.point(b, bottom, p), e.point(b, top, p), e.point(a, top, p)],
    e.n,
    tint,
  );
}
function walls(out, ring, bottom, top, slot = 'wall', tint = colors.wall) {
  for (const e of edges(ring)) panel(out, slot, e, 0, e.length, bottom, top, 0, tint);
}
const arch = (center, half, spring, top, count) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [center - half * Math.cos(t), spring + (top - spring) * Math.sin(t)];
  });
function archPanel(out, e, center, half, bottom, spring, top, p, tint, count) {
  panel(out, 'detail', e, center - half, center + half, bottom, spring, p, tint);
  const a = arch(center, half, spring, top, count);
  const hub = e.point(center, spring, p);
  for (let i = 1; i < a.length; i++)
    face(out, 'detail', [hub, e.point(...a[i - 1], p), e.point(...a[i], p)], e.n, tint);
}

const rectangle = ([a, b, c, d]) => [
  [a, c],
  [b, c],
  [b, d],
  [a, d],
];
const facadeEdge = (a, b, z) => edge([b, z], [a, z]);
function band(out, bounds, bottom, height, margin, tint = colors.stone) {
  const [a, b, c, d] = bounds;
  box(
    out,
    'stone',
    (a + b) / 2,
    bottom,
    (c + d) / 2,
    b - a + 2 * margin,
    height,
    d - c + 2 * margin,
    tint,
  );
}
function roofHip(out, bounds, eaves, ridge, slot = 'roof', tint = colors.roof) {
  const [a, b, c, d] = bounds,
    w = b - a,
    x = (a + b) / 2,
    inset = Math.min(w * 0.43, (d - c) * 0.39);
  const p = [a - 0.26, eaves, c - 0.28],
    q = [b + 0.26, eaves, c - 0.28],
    r = [b + 0.26, eaves, d + 0.28],
    s = [a - 0.26, eaves, d + 0.28];
  const u = [x, ridge, c + inset],
    v = [x, ridge, d - inset];
  for (const points of [
    [p, q, u],
    [s, r, v],
    [p, s, v, u],
    [q, r, v, u],
  ])
    face(out, slot, points, [0, 1, 0], tint);
}
function archedOpening(out, e, u, w, bottom, spring, head, top, lod, depth) {
  const left = u - w / 2,
    right = u + w / 2;
  const samples = arch(u, w / 2, spring, head, lod >= 2 ? 8 : 4);
  panel(out, 'wall', e, 0, left, bottom, top, 0, colors.wall);
  panel(out, 'wall', e, right, e.length, bottom, top, 0, colors.wall);
  for (let i = 1; i < samples.length; i++) {
    const [a, h] = samples[i - 1],
      [b, k] = samples[i];
    face(
      out,
      'wall',
      [e.point(a, h), e.point(b, k), e.point(b, top), e.point(a, top)],
      e.n,
      colors.wall,
    );
    if (lod)
      face(
        out,
        'stone',
        [e.point(a, h), e.point(b, k), e.point(b, k, -depth), e.point(a, h, -depth)],
        [0, -1, 0],
        colors.shadow,
      );
  }
  if (lod)
    for (const side of [-1, 1]) {
      const v = u + (side * w) / 2;
      const normal = e.point(u, 0).map((p, i) => p - e.point(v, 0)[i]);
      face(
        out,
        'wall',
        [
          e.point(v, bottom),
          e.point(v, spring),
          e.point(v, spring, -depth),
          e.point(v, bottom, -depth),
        ],
        normal,
        colors.reveal,
      );
      if (lod)
        panel(
          out,
          'stone',
          e,
          v + Math.min(0, side * 0.2),
          v + Math.max(0, side * 0.2),
          bottom,
          spring,
          0.037,
          colors.stone,
        );
    }
}
function archTrim(out, e, u, w, spring, head, lod, thickness = 0.22) {
  const count = lod >= 2 ? 8 : 4;
  const inner = arch(u, w / 2, spring, head, count),
    outer = arch(u, w / 2 + thickness, spring, head + thickness, count);
  for (let i = 1; i < inner.length; i++)
    face(
      out,
      'stone',
      [
        e.point(...inner[i - 1], 0.039),
        e.point(...inner[i], 0.039),
        e.point(...outer[i], 0.045),
        e.point(...outer[i - 1], 0.045),
      ],
      e.n,
      colors.stone,
    );
}
function profile(out, slot, x, z, bands, segments, tint) {
  const ring = ([y, r]) =>
    Array.from({ length: segments }, (_, i) => {
      const t = (2 * Math.PI * i) / segments;
      return [x + r * Math.cos(t), y, z + r * Math.sin(t)];
    });
  const rings = bands.map(ring);
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < segments; i++) {
      const k = (i + 1) % segments,
        a = rings[j - 1],
        b = rings[j];
      face(
        out,
        slot,
        [a[i], a[k], b[k], b[i]],
        [a[i][0] + a[k][0] - 2 * x, 0, a[i][2] + a[k][2] - 2 * z],
        tint,
      );
    }
  const end = rings.at(-1);
  for (let i = 0; i < segments; i++)
    face(out, slot, [[x, end[0][1], z], end[i], end[(i + 1) % segments]], [0, 1, 0], tint);
}
function sideWindows(out, bounds, y0, y1, lod, count) {
  const ring = rectangle(bounds);
  for (const i of [1, 3]) {
    const e = edges(ring)[i];
    for (let k = 0; k < count; k++) {
      const u = (e.length * (k + 0.5)) / count;
      const w = Math.min(1.38, (e.length / count) * 0.46);
      archPanel(out, e, u, w * 0.5, y0, y1 - 0.62, y1, 0.037, colors.dark, lod >= 2 ? 6 : 4);
      if (lod >= 2) archTrim(out, e, u, w, y1 - 0.62, y1, lod, 0.15);
    }
  }
}
function mass(out, bounds, eaves, ridge, lod, count = 0) {
  const ring = rectangle(bounds);
  walls(out, ring, foundationBottom, threshold, 'stone', colors.base);
  walls(out, ring, threshold, eaves);
  if (lod) band(out, bounds, eaves - 0.31, 0.31, 0.15, colors.shadow);
  roofHip(out, bounds, eaves, ridge);
  if (lod && count) sideWindows(out, bounds, eaves - 4.4, eaves - 1.21, lod, count);
}
function body(out, lod) {
  mass(out, [nave.left, nave.right, nave.back, nave.front], nave.eaves, nave.ridge, lod, 8);
  mass(out, aisleLeft, 10.8, 13.15, lod, 7);
  mass(out, aisleRight, 10.8, 13.15, lod, 7);
  mass(out, transept, 15.3, 18.45, lod, 2);
  mass(out, [choir.left, choir.right, choir.back, choir.front], choir.eaves, choir.ridge, lod, 3);
  for (const b of [
    [-15.5, -8.05, -42.7, -29.1],
    [10.7, 17.75, -46.1, -27.9],
  ])
    mass(out, b, 9.3, 11.34, lod, 2);
  const { x, z, radius, drumBase, drumTop, domeTop, lanternTop } = crossing;
  const n = lod === 0 ? 6 : lod === 1 ? 12 : lod === 2 ? 18 : 24;
  profile(
    out,
    'wall',
    x,
    z,
    [
      [drumBase, radius],
      [drumTop, radius],
    ],
    n,
    colors.wall,
  );
  if (lod) {
    profile(
      out,
      'stone',
      x,
      z,
      [
        [drumTop - 0.37, radius + 0.19],
        [drumTop + 0.05, radius + 0.16],
      ],
      n,
      colors.stone,
    );
    for (let i = 0; i < n; i += lod >= 2 ? 2 : 3) {
      const t = (2 * Math.PI * (i + 0.5)) / n,
        facet = radius * Math.cos(Math.PI / n),
        a = facet * Math.cos(t),
        b = facet * Math.sin(t);
      const e = edge(
        [x + a - 0.95 * Math.sin(t), z + b + 0.95 * Math.cos(t)],
        [x + a + 0.95 * Math.sin(t), z + b - 0.95 * Math.cos(t)],
        -1,
      );
      archPanel(
        out,
        e,
        0.95,
        0.53,
        drumBase + 1.77,
        drumTop - 1.47,
        drumTop - 0.87,
        0.038,
        colors.dark,
        4,
      );
    }
  }
  const rise = domeTop - drumTop;
  const dome =
    lod === 0
      ? [
          [0, 1],
          [0.54, 0.88],
          [0.88, 0.59],
          [1, 0.24],
        ]
      : [
          [0, 1],
          [0.2, 0.98],
          [0.45, 0.9],
          [0.68, 0.77],
          [0.86, 0.58],
          [0.96, 0.38],
          [1, 0.23],
        ];
  profile(
    out,
    'roof',
    x,
    z,
    dome.map(([y, r]) => [drumTop + y * rise, radius * r]),
    n,
    colors.dome,
  );
  profile(
    out,
    'stone',
    x,
    z,
    [
      [domeTop - 0.12, 1.66],
      [domeTop + 0.48, 1.51],
      [domeTop + 2.64, 1.05],
    ],
    lod >= 2 ? 12 : 6,
    colors.stone,
  );
  profile(
    out,
    'roof',
    x,
    z,
    [
      [domeTop + 2.52, 1.43],
      [domeTop + 3.15, 1.3],
      [domeTop + 3.98, 0.29],
    ],
    lod >= 2 ? 12 : 6,
    colors.dome,
  );
  cross(out, x, domeTop + 3.85, z, lanternTop - (domeTop + 3.85));
}
function cross(out, x, y, z, height) {
  beam(out, 'bronze', [x, y, z], [x, y + height, z], 0.13, 0.13, colors.bronze);
  beam(
    out,
    'bronze',
    [x - height * 0.32, y + height * 0.68, z],
    [x + height * 0.32, y + height * 0.68, z],
    0.12,
    0.12,
    colors.bronze,
  );
}

function arcade(out, lod) {
  const { left, right, back, archSill, spring, head, eaves } = frontArcade;
  const bounds = [left, right, back, front],
    bay = (right - left) / 3;
  const vista = facadeEdge(left, right, front),
    doors = facadeEdge(left, right, front - 1.7);
  for (const [i, x] of portalCenters.entries()) {
    const high = i === 1 ? 0.49 : 0,
      w = i === 1 ? 5.7 : 5.28;
    const e = facadeEdge(left + i * bay, left + (i + 1) * bay, front);
    archedOpening(
      out,
      e,
      left + (i + 1) * bay - x,
      w,
      archSill,
      spring + high,
      head + high,
      eaves,
      lod,
      1.7,
    );
    if (lod) archTrim(out, vista, right - x, w, spring + high, head + high, lod, 0.22);
    const u = right - x;
    panel(
      out,
      'wall',
      doors,
      u - w * 0.5,
      u + w * 0.5,
      archSill,
      head + high + 0.3,
      0,
      colors.reveal,
    );
    archPanel(
      out,
      doors,
      u,
      w * 0.39,
      archSill,
      spring - 0.93,
      head - 1.28 + high,
      0.039,
      colors.door,
      lod >= 2 ? 8 : 4,
    );
    if (lod) {
      for (const k of [-0.74, 0, 0.74])
        panel(
          out,
          'detail',
          doors,
          u + k - 0.045,
          u + k + 0.045,
          archSill + 0.3,
          head - 1.91 + high,
          0.06,
          colors.gold,
        );
      panel(out, 'detail', doors, u - w * 0.38, u + w * 0.38, 7.28, 7.4, 0.065, colors.gold);
    }
  }
  for (const x of [left + 0.1, left + bay, left + 2 * bay, right - 0.14]) {
    const n = lod >= 2 ? 10 : lod === 1 ? 8 : 4;
    profile(
      out,
      'stone',
      x,
      front + 0.28,
      lod
        ? [
            [threshold, 0.81],
            [threshold + 0.38, 0.77],
            [threshold + 0.6, 0.59],
            [13.65, 0.48],
            [14.04, 0.59],
          ]
        : [
            [threshold, 0.77],
            [threshold + 0.59, 0.57],
            [eaves - 0.48, 0.48],
          ],
      n,
      colors.stone,
    );
    if (lod) box(out, 'stone', x, 13.89, front + 0.28, 1.62, 0.68, 1.55, colors.stone);
    if (lod >= 2)
      for (const dx of [-0.43, 0, 0.43])
        box(out, 'stone', x + dx, 13.67, front + 0.85, 0.23, 0.29, 0.27, colors.shadow);
  }
  if (lod) band(out, bounds, eaves - 0.97, 0.49, 0.19, colors.shadow);
  band(out, bounds, eaves - 0.49, 0.47, 0.38);
  if (lod >= 2)
    for (let i = 0; i < 21; i++)
      box(
        out,
        'stone',
        left + 0.55 + ((right - left - 1.1) * i) / 20,
        eaves - 0.88,
        front + 0.25,
        0.32,
        0.27,
        0.2,
        colors.stone,
      );
  for (const n of lod ? [0, 1, 2, 3] : [0, 3]) {
    const y = threshold - n * 0.205,
      d = 0.59 + 0.45 * n;
    const base = -1.6;
    box(out, 'stone', 0.5, base, front + d / 2, 26.98 + 0.22 * n, y - base, d, colors.base);
  }
}
function blindArch(out, e, u, w, sill, head, lod) {
  archPanel(out, e, u, w / 2, sill, head - w * 0.42, head, 0.04, colors.reveal, lod >= 2 ? 8 : 4);
  if (lod) archTrim(out, e, u, w, head - w * 0.42, head, lod, 0.19);
}
function towerClock(out, e, u, y, lod) {
  const r = 1.04,
    n = lod >= 2 ? 20 : 8,
    p = (t, d) => e.point(u + r * Math.cos(t), y + r * Math.sin(t), d);
  const origin = e.point(u, y, 0.069);
  for (let i = 0; i < n; i++)
    face(
      out,
      'detail',
      [origin, p((2 * Math.PI * i) / n, 0.069), p((2 * Math.PI * (i + 1)) / n, 0.069)],
      e.n,
      colors.pale,
    );
  for (const [dx, dy] of [
    [0.18, 0.75],
    [-0.57, 0.18],
  ])
    beam(
      out,
      'detail',
      e.point(u, y, 0.092),
      e.point(u + dx, y + dy, 0.092),
      0.052,
      0.06,
      colors.dark,
    );
  if (lod >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12,
        sx = Math.cos(a),
        sy = Math.sin(a);
      beam(
        out,
        'detail',
        e.point(u + 0.8 * sx, y + 0.8 * sy, 0.088),
        e.point(u + 0.95 * sx, y + 0.95 * sy, 0.088),
        0.04,
        0.045,
        colors.dark,
      );
    }
}
function frontTowers(out, lod) {
  for (const [side, x] of towers.centers.entries()) {
    const { z, baseTop } = towers;
    const base = [x - 4.13, x + 4.13, z - 4.22, front + 0.03];
    const ring = rectangle(base),
      eList = edges(ring);
    walls(out, ring, foundationBottom, threshold, 'stone', colors.base);
    walls(out, ring, threshold, baseTop);
    blindArch(out, eList[2], eList[2].length * 0.5, 3.44, threshold + 0.12, 8.83, lod);
    if (lod) {
      const e = eList[2];
      for (const u of [0.35, e.length - 0.35])
        panel(out, 'stone', e, u - 0.18, u + 0.18, threshold, baseTop - 0.35, 0.09, colors.stone);
      panel(out, 'stone', e, 1.43, e.length - 1.43, 9.35, 12.51, 0.055, colors.shadow);
      panel(out, 'wall', e, 1.58, e.length - 1.58, 9.51, 12.35, 0.078, colors.wall);
    }
    if (side === 1) {
      archPanel(
        out,
        eList[1],
        4.96,
        1.24,
        threshold,
        4.83,
        6.1,
        0.074,
        colors.door,
        lod >= 2 ? 8 : 4,
      );
      if (lod) towerClock(out, eList[1], 4.86, 12.04, lod);
    }
    if (lod) band(out, base, baseTop - 0.7, 0.36, 0.23, colors.shadow);
    band(out, base, baseTop - 0.32, 0.34, 0.41);
    for (const { bottom, top, width, opening } of towers.stages) {
      const half = width / 2,
        bounds = [x - half, x + half, z - half, z + half];
      band(out, bounds, bottom, 0.66, 0.08, colors.shadow);
      for (const e of edges(rectangle(bounds))) {
        const u = e.length * 0.5,
          sill = bottom + 0.7,
          spring = top - 2.47,
          head = top - 0.81;
        archedOpening(out, e, u, opening, sill, spring, head, top, lod, 0.47);
        if (lod) {
          archTrim(out, e, u, opening, spring, head, lod, 0.19);
          for (const p of [0.37, e.length - 0.37])
            panel(out, 'stone', e, p - 0.18, p + 0.18, sill, top - 0.34, 0.074, colors.stone);
          const balusters = lod >= 2 ? 5 : 3;
          for (let i = 0; i < balusters; i++) {
            const p = u - opening / 2 + ((i + 0.5) * opening) / balusters;
            panel(out, 'stone', e, p - 0.086, p + 0.086, sill, sill + 0.79, 0.047, colors.stone);
          }
        }
      }
      const n = lod >= 2 ? 10 : 6;
      if (lod)
        profile(
          out,
          'bronze',
          x,
          z,
          [
            [bottom + 1.92, 0.83],
            [bottom + 2.19, 0.77],
            [bottom + 3.38, 0.39],
            [bottom + 3.57, 0.19],
          ],
          n,
          colors.bronze,
        );
      band(out, bounds, top - 0.25, 0.37, 0.29);
      if (lod) band(out, bounds, top + 0.12, 0.27, 0.15, colors.shadow);
    }
    const stageTop = towers.stages.at(-1).top,
      roofBase = stageTop + 0.31;
    const peak =
      lod === 0
        ? [
            [roofBase, 2.15],
            [roofBase + 2.38, 0.96],
            [towers.top - 1.03, 0.19],
          ]
        : [
            [roofBase, 2.42],
            [roofBase + 0.67, 2.19],
            [roofBase + 1.44, 1.33],
            [roofBase + 2.38, 0.96],
            [towers.top - 1.03, 0.19],
          ];
    profile(out, 'stone', x, z, peak, lod >= 2 ? 10 : 6, colors.stone);
    cross(out, x, towers.top - 1.08, z, 1.08);
    if (lod)
      for (const dx of [-2.62, 2.62])
        for (const dz of [-2.62, 2.62])
          profile(
            out,
            'stone',
            x + dx,
            z + dz,
            [
              [roofBase - 0.12, 0.28],
              [roofBase + 0.49, 0.24],
              [roofBase + 0.93, 0.085],
            ],
            6,
            colors.stone,
          );
  }
}
function pediment(out, lod) {
  const x = 0.55,
    z = front - 0.03,
    left = x - 4.42,
    right = x + 4.42;
  const fronton = facadeEdge(left, right, z);
  const y = frontArcade.eaves - 0.31;
  walls(out, rectangle([left, right, z - 4.13, z]), y - 0.05, y + 5.47);
  const gable = [
    [left, y + 5.22, z],
    [right, y + 5.22, z],
    [x, y + 8.34, z],
  ];
  face(out, 'stone', gable, [0, 0, 1], colors.stone);
  roofHip(out, [left - 0.12, right + 0.12, z - 4.13, z], y + 5.47, y + 7.72, 'roof', colors.roof);
  for (const u of [0.42, fronton.length - 0.42])
    panel(out, 'stone', fronton, u - 0.27, u + 0.27, y, y + 5.45, 0.073, colors.stone);
  const windowY = y + 2.97,
    count = lod >= 2 ? 32 : 12;
  const lobes = (r, d) =>
    Array.from({ length: count }, (_, i) => {
      const t = (2 * Math.PI * i) / count,
        a = r * (1 + 0.15 * Math.cos(4 * t));
      return [x + a * Math.cos(t), windowY + a * Math.sin(t), z + d];
    });
  for (const [r, d, tint, slot] of [
    [1.56, 0.065, colors.stone, 'stone'],
    [1.32, 0.088, colors.pane, 'detail'],
  ]) {
    const ring = lobes(r, d);
    for (let i = 0; i < count; i++)
      face(out, slot, [[x, windowY, z + d], ring[i], ring[(i + 1) % count]], [0, 0, 1], tint);
  }
  if (lod) {
    for (const p of gable.slice(0, 2)) beam(out, 'stone', p, gable[2], 0.34, 0.32, colors.stone);
    beam(out, 'stone', gable[0], gable[1], 0.26, 0.23, colors.stone);
    for (const start of [left - 8.22, right + 0.15]) {
      const width = 8.05;
      box(out, 'stone', start + width / 2, y + 0.22, z - 0.06, width, 0.23, 0.42, colors.stone);
      box(out, 'stone', start + width / 2, y + 1.11, z - 0.06, width, 0.17, 0.42, colors.stone);
      for (let i = 0; i < (lod >= 2 ? 12 : 6); i++) {
        const n = lod >= 2 ? 12 : 6;
        box(
          out,
          'stone',
          start + (width * (i + 0.5)) / n,
          y + 0.45,
          z - 0.06,
          0.16,
          0.66,
          0.18,
          colors.stone,
        );
      }
    }
  }
}
function buildLevel(out, lod) {
  body(out, lod);
  arcade(out, lod);
  frontTowers(out, lod);
  pediment(out, lod);
}
export const saltaSkyline = (out) => buildLevel(out, 0);
export const saltaDistrict = (out) => buildLevel(out, 1);
export const saltaStreet = (out) => buildLevel(out, 2);
export const saltaCloseup = (out) => buildLevel(out, 3);

const recipe = 'salta-cathedral-model.mjs',
  camera = [48, 29, 118],
  lookAt = [0, 16, 10];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'saltaDistrict', 0.28],
    ['street', 'saltaStreet', 0.1],
    ['closeup', 'saltaCloseup', 0.043],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const saltaCathedralModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: saltaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Salta Cathedral around 2008, with the plaza arcade, classical pink and cream front, open twin belfries, and a dome above the cruciform nave.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.89,
    basis: 'The named eight-vertex cathedral envelope in OpenStreetMap way 110346974.',
  },
  mediumFiContext: {
    scale: 0.83,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'tile_ceramic', 'metal_bronze_cast'],
  qaCameras: [
    { name: 'plaza-arcade-and-twin-belfries', position: [39, 12, 103], lookAt: [0, 17, 43] },
    { name: 'nave-transept-and-crossing-dome', position: [66, 49, -58], lookAt: [0, 13, -5] },
    { name: 'cream-columns-and-lobed-window', position: [12, 12, 78], lookAt: [1, 12, 45] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-salta-cathedral-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'saltaSkyline',
    errorMeters: 0.64,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap ODbL 1.0 footprint and exact Hugopujszo photographer-released public-domain photograph.',
};
