/** Foundry United Methodist Church at 16th and P Streets, March 2020. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const q = plan.section;
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.92, metallic: 0 },
  ashlar: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.9, metallic: 0 },
  steps: { slot: 'foundation', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.88, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.67, metallic: 0.08 },
};
const tint = Object.fromEntries(
  Object.entries({
    gray: '8b8a85',
    paleGray: '9a9992',
    shadow: '6c6b66',
    rubble: '858580',
    cream: 'c4b9a8',
    bright: 'd0c3ad',
    rim: 'a59c8e',
    mortar: '9c978b',
    slate: '62646b',
    slateLight: '797b80',
    wood: '684839',
    brown: '55382e',
    doorDark: '47392e',
    louver: '555957',
    louverLight: '777873',
    glass: '647988',
    blue: '81949e',
    glassLight: '98a4a6',
    glassRose: '87797b',
    rail: '494b47',
    bronze: '887452',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const frontZ = (outline[6][1] + outline[7][1]) / 2;
const front = (u, y, d = 0) => [u, y, frontZ + d];
const naveLeft = outline[7][0],
  naveRight = outline[6][0],
  naveMid = (naveLeft + naveRight) / 2;
const towerCenter = (outline[10][0] + outline[11][0]) / 2,
  towerFace = (outline[10][1] + outline[11][1]) / 2;

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}
function panel(out, slot, p, normal, color) {
  const n = normalFor(...p);
  const points = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? p : p.toReversed();
  if (points.length === 4) face(out, slot, points, color);
  else triangle(out, slot, points, color);
}
function cutFace(out, slot, point, shape, d, color, holes = []) {
  const vertices = [...shape],
    offsets = [];
  for (const hole of holes) {
    offsets.push(vertices.length);
    vertices.push(...hole);
  }
  const mesh = earcut(vertices.flat(), offsets);
  const normal = normalFor(point(0, 0, d), point(1, 0, d), point(0, 1, d));
  for (let i = 0; i < mesh.length; i += 3)
    panel(
      out,
      slot,
      mesh.slice(i, i + 3).map((j) => point(...vertices[j], d)),
      normal,
      color,
    );
}
function edging(out, slot, point, shape, depth, back, color) {
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i],
      b = shape[(i + 1) % shape.length];
    face(
      out,
      slot,
      [point(...a, depth), point(...b, depth), point(...b, back), point(...a, back)],
      color,
    );
  }
}
function pointOnArch(x, width, spring, rise, t) {
  const a = t * Math.PI,
    u = Math.cos(a);
  return [x + (u * width) / 2, spring + Math.pow(Math.sin(a), 1.36) * rise];
}
function arch(x, width, base, spring, rise, n) {
  const arc = Array.from({ length: n + 1 }, (_, i) =>
    pointOnArch(x, width, spring, rise, 1 - i / n),
  );
  return [[x - width / 2, base], ...arc, [x + width / 2, base]];
}
function surround(out, point, inner, outer, color, depth = 0.16) {
  const normal = normalFor(point(0, 0), point(1, 0), point(0, 1));
  for (let i = 0; i < inner.length - 1; i++)
    panel(
      out,
      'ashlar',
      [
        point(...inner[i], depth),
        point(...inner[i + 1], depth),
        point(...outer[i + 1], depth + 0.035),
        point(...outer[i], depth + 0.035),
      ],
      normal,
      color,
    );
}
function stroke(out, slot, point, a, b, width, d, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    r = width / (2 * Math.hypot(dx, dy));
  const u = -dy * r,
    v = dx * r;
  panel(
    out,
    slot,
    [
      point(a[0] + u, a[1] + v, d),
      point(b[0] + u, b[1] + v, d),
      point(b[0] - u, b[1] - v, d),
      point(a[0] - u, a[1] - v, d),
    ],
    normalFor(point(0, 0, d), point(1, 0, d), point(0, 1, d)),
    color,
  );
}
function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    c = dx / l,
    s = dz / l;
  return {
    length: l,
    normal: [s, 0, -c],
    point: (u, y, d = 0) => [a[0] + c * u + s * d, y, a[1] + s * u - c * d],
  };
}
function cap(out, slot, ring, y, color) {
  const mesh = earcut(ring.flat());
  for (let i = 0; i < mesh.length; i += 3)
    panel(
      out,
      slot,
      mesh
        .slice(i, i + 3)
        .map((j) => [ring[j][0], typeof y === 'function' ? y(...ring[j]) : y, ring[j][1]]),
      [0, 1, 0],
      color,
    );
}
function shell(out, ring, eaves, tone, { skip = -1, base = 1.29 } = {}) {
  for (let i = 0; i < ring.length; i++) {
    if (i === skip) continue;
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      s = section(a, b),
      p = s.point;
    panel(
      out,
      'steps',
      [p(0, grade(...a) - 0.22), p(s.length, grade(...b) - 0.22), p(s.length, base), p(0, base)],
      s.normal,
      tint.shadow,
    );
    panel(
      out,
      'rubble',
      [p(0, base), p(s.length, base), p(s.length, eaves), p(0, eaves)],
      s.normal,
      tone,
    );
  }
}

function portals(out, lod) {
  const sill = q.stairsTop,
    n = [5, 8, 12, 16][lod];
  const centers = [naveMid - 4.15, naveMid, naveMid + 4.15];
  const shapes = centers.map((x) =>
    arch(x, 2.33, sill - 0.03, q.doorSpring, q.doorPeak - q.doorSpring, n),
  );
  const stone = rect(naveLeft, 0.38, naveRight, 6.34);
  cutFace(out, 'rubble', front, stone, 0, tint.gray, shapes);
  for (const [i, opening] of shapes.entries()) {
    const x = centers[i];
    const x0 = x - 0.92,
      x1 = x + 0.92;
    const wide = arch(x, 2.77, sill - 0.07, q.doorSpring, q.doorPeak - q.doorSpring + 0.27, n);
    const inner = arch(x, 2.46, sill - 0.04, q.doorSpring, q.doorPeak - q.doorSpring + 0.088, n);
    surround(out, front, opening, wide, tint.cream, 0.13);
    if (lod >= 1) surround(out, front, inner, wide, tint.bright, 0.191);
    edging(out, 'ashlar', front, opening.toReversed(), 0.12, -0.44, tint.rim);
    cutFace(
      out,
      'ashlar',
      front,
      rect(x - 1.42, sill - 0.145, x + 1.42, q.doorPeak + 0.17),
      -0.45,
      tint.shadow,
    );
    cutFace(out, 'timber', front, rect(x0, sill, x1, 3.96), -0.4, tint.wood);
    const fan = arch(x, 1.83, 3.94, 4.2, 0.95, n);
    cutFace(out, 'detail', front, fan, -0.382, tint.doorDark);
    if (lod >= 1) {
      cutFace(out, 'detail', front, rect(x - 0.024, sill, x + 0.024, 4.46), -0.373, tint.doorDark);
      for (const d of [-1, 1]) {
        const a = x + d * 0.48;
        cutFace(
          out,
          'timber',
          front,
          rect(a - 0.31, sill + 0.18, a + 0.31, 3.63),
          -0.374,
          tint.brown,
        );
        if (lod >= 2)
          cutFace(
            out,
            'detail',
            front,
            rect(x + d * 0.14 - 0.022, 2.12, x + d * 0.14 + 0.022, 2.41),
            -0.355,
            tint.bronze,
          );
      }
    }
    const steps = lod === 0 ? 2 : 5,
      length = 2.28,
      w = 1.82;
    const low = Math.min(grade(x, frontZ + length), sill - 0.36);
    for (let j = 0; j < steps; j++) {
      const end = frontZ + (length * (steps - j)) / steps;
      box(
        out,
        'steps',
        [x - w, Math.min(low, grade(x, end)) - 0.24, frontZ - 0.04],
        [x + w, mix(low, sill, (j + 1) / steps), end],
        tint.cream,
      );
    }
    if (lod >= 1)
      for (const direction of [-1, 1]) {
        const u = x + direction * 1.67;
        const a = [u, sill + 0.84, frontZ + 0.15],
          b = [u, low + 0.87, frontZ + length - 0.1];
        beam(out, 'detail', a, b, 0.042, 0.046, tint.rail);
        for (let j = 0; j < (lod === 1 ? 2 : 6); j++) {
          const f = j / (lod === 1 ? 1 : 5),
            p = a.map((v, k) => mix(v, b[k], f));
          beam(out, 'detail', p, [p[0], p[1] - 0.82, p[2]], 0.031, 0.033, tint.rail);
        }
      }
  }
  const crown = [
    [naveLeft, 6.29],
    [naveMid - 2.18, 6.29],
    [naveMid, 7.15],
    [naveMid + 2.18, 6.29],
    [naveRight, 6.29],
    [naveRight, 6.65],
    [naveMid + 2.13, 6.66],
    [naveMid, 7.47],
    [naveMid - 2.1, 6.66],
    [naveLeft, 6.65],
  ];
  cutFace(out, 'ashlar', front, crown, 0.28, tint.rim);
  edging(out, 'ashlar', front, crown, 0.28, 0.025, tint.cream);
  if (lod >= 1)
    for (const x of [naveLeft + 0.26, naveMid - 2.1, naveMid, naveMid + 2.1, naveRight - 0.27]) {
      const y = x === naveMid ? 7.18 : 6.33;
      box(
        out,
        'ashlar',
        [x - 0.15, y - 0.22, frontZ + 0.12],
        [x + 0.15, y + 0.39, frontZ + 0.35],
        tint.cream,
      );
    }
  if (lod >= 2) {
    box(
      out,
      'ashlar',
      [naveMid - 0.065, 7.35, frontZ + 0.27],
      [naveMid + 0.065, 8.29, frontZ + 0.42],
      tint.cream,
    );
    box(
      out,
      'ashlar',
      [naveMid - 0.35, 7.87, frontZ + 0.27],
      [naveMid + 0.35, 8.0, frontZ + 0.42],
      tint.cream,
    );
  }
}

function tracery(out, lod) {
  const n = [7, 10, 16, 20][lod];
  const base = 7.02,
    spring = q.roseSpring,
    peak = q.rosePeak;
  const win = arch(naveMid, 7.44, base, spring, peak - spring, n);
  const outer = arch(naveMid, 8.22, base - 0.14, spring, peak - spring + 0.43, n);
  const gable = [
    [naveLeft, 6.35],
    [naveRight, 6.35],
    [naveRight, 14.85],
    [naveMid, q.upperGableRidge],
    [naveLeft, 14.85],
  ];
  cutFace(out, 'rubble', front, gable, 0, tint.gray, [win]);
  cutFace(
    out,
    'detail',
    front,
    rect(naveMid - 3.95, base - 0.12, naveMid + 3.95, peak + 0.18),
    -0.32,
    tint.glass,
  );
  edging(out, 'ashlar', front, win.toReversed(), 0.06, -0.33, tint.rim);
  surround(out, front, win, outer, tint.cream, 0.17);
  const offsets = [-2.47, 0, 2.47];
  for (const [i, x] of offsets.entries()) {
    const u = naveMid + x;
    const arched = arch(u, 2.26, base + 0.13, 10.14, 0.89, n);
    cutFace(out, 'detail', front, arched, -0.265, i === 1 ? tint.glassLight : tint.blue);
    const outerArc = arch(u, 2.4, base + 0.11, 10.14, 1.02, n);
    surround(out, front, arched, outerArc, tint.bright, -0.135);
    if (lod >= 1)
      for (const f of [0.31, 0.54])
        stroke(
          out,
          'ashlar',
          front,
          [u - 1.1, mix(base, 10.1, f)],
          [u + 1.1, mix(base, 10.1, f)],
          0.046,
          -0.19,
          tint.rim,
        );
    if (lod >= 2) {
      for (const t of [0.29, 0.5, 0.71]) {
        const a = pointOnArch(u, 2.25, 10.04, 0.86, t - 0.1),
          b = pointOnArch(u, 2.25, 10.04, 0.94, t),
          c = pointOnArch(u, 2.25, 10.04, 0.86, t + 0.1);
        stroke(out, 'ashlar', front, a, b, 0.075, -0.069, tint.cream);
        stroke(out, 'ashlar', front, b, c, 0.075, -0.069, tint.cream);
      }
    }
  }
  if (lod >= 1)
    for (const i of [-2, -1, 0, 1, 2]) {
      const x = naveMid + i * 1.1,
        y = 12.45 + 0.56 * (2 - Math.abs(i));
      const opening = arch(x, 0.93, 10.9, 11.51, y - 11.51, n);
      cutFace(out, 'detail', front, opening, -0.236, i % 2 === 0 ? tint.blue : tint.glassRose);
      surround(out, front, opening, arch(x, 1.07, 10.87, 11.52, y - 11.38, n), tint.cream, -0.14);
    }
  for (const [a, b] of [
    [
      [naveLeft, 14.38],
      [naveMid, q.upperGableRidge - 0.36],
    ],
    [
      [naveMid, q.upperGableRidge - 0.36],
      [naveRight, 14.38],
    ],
  ]) {
    stroke(out, 'ashlar', front, a, b, 0.22, 0.16, tint.rim);
    if (lod >= 1)
      stroke(
        out,
        'ashlar',
        front,
        [a[0], a[1] + 0.29],
        [b[0], b[1] + 0.29],
        0.115,
        0.16,
        tint.bright,
      );
  }
  const small = arch(naveMid, 0.76, 15.15, 16.63, 0.31, [4, 6, 8, 10][lod]);
  cutFace(out, 'detail', front, small, 0.045, tint.louver);
  surround(
    out,
    front,
    small,
    arch(naveMid, 0.98, 15.11, 16.63, 0.53, [4, 6, 8, 10][lod]),
    tint.cream,
    0.078,
  );
  for (const x of [naveLeft + 0.3, naveRight - 0.31]) {
    box(
      out,
      'rubble',
      [x - 0.6, 0.31, frontZ - 0.53],
      [x + 0.6, 8.45, frontZ + 0.45],
      tint.paleGray,
    );
    panel(
      out,
      'slate',
      [
        [x - 0.6, 8.45, frontZ + 0.45],
        [x + 0.6, 8.45, frontZ + 0.45],
        [x + 0.6, 9.62, frontZ - 0.51],
        [x - 0.6, 9.62, frontZ - 0.51],
      ],
      [0, 1, 0],
      tint.slate,
    );
    if (lod >= 1)
      for (let i = 0; i < 4; i++) {
        const f = i / 4;
        box(
          out,
          'ashlar',
          [x - 0.66, 8.48 + 1.17 * f, frontZ + 0.47 - 0.96 * f],
          [x + 0.66, 8.57 + 1.17 * f, frontZ + 0.55 - 0.96 * f],
          tint.cream,
        );
      }
  }
}

function pinnacle(out, x, z, lod) {
  const base = q.towerShaft,
    high = q.towerPinnacles;
  const rings = [
    [base, 0.47],
    [base + 0.45, 0.47],
    [base + 0.57, 0.33],
    [high - 0.23, 0.079],
    [high, 0.034],
  ];
  const selected = lod === 0 ? [rings[0], rings[2], rings[4]] : rings;
  loft(
    out,
    'ashlar',
    selected.map(([y, r]) => radialRing(y, r, r, 4, [x, z], Math.PI / 4)),
    tint.cream,
    { cap: lod > 0 },
  );
}
function tower(out, lod) {
  const half = 3.17,
    rear = towerFace - 6.35,
    centerZ = (rear + towerFace) / 2;
  const sides = [
    (u, y, d = 0) => [towerCenter + u, y, towerFace + d],
    (u, y, d = 0) => [towerCenter + half + d, y, centerZ - u],
    (u, y, d = 0) => [towerCenter - u, y, rear - d],
    (u, y, d = 0) => [towerCenter - half - d, y, centerZ + u],
  ];
  const base = Math.min(grade(towerCenter, towerFace), grade(towerCenter, rear)) - 0.26;
  const bell = arch(0, 2.21, q.bellBase, q.bellSpring, 1.6, [5, 8, 12, 16][lod]);
  const bellOuter = arch(0, 2.58, q.bellBase - 0.16, q.bellSpring, 1.87, [5, 8, 12, 16][lod]);
  for (const [i, p] of sides.entries()) {
    const width = i % 2 === 0 ? half : (towerFace - rear) / 2;
    cutFace(out, 'rubble', p, rect(-width, base, width, q.towerShaft), 0, tint.gray, [bell]);
    cutFace(
      out,
      'detail',
      p,
      rect(-1.3, q.bellBase - 0.15, 1.3, q.bellSpring + 1.82),
      -0.31,
      tint.louver,
    );
    edging(out, 'ashlar', p, bell.toReversed(), 0.054, -0.32, tint.rim);
    surround(out, p, bell, bellOuter, tint.cream, 0.14);
    if (lod >= 1)
      for (let j = 0; j < 20; j++) {
        const y = q.bellBase + 0.115 + j * 0.23;
        cutFace(out, 'detail', p, rect(-1.07, y, 1.07, y + 0.072), -0.278, tint.louverLight);
      }
    if (i === 0 && lod >= 1) {
      const cross = arch(0, 1.4, 6.62, 9.16, 0.85, [5, 7, 9, 12][lod]);
      cutFace(out, 'detail', p, cross, 0.061, tint.glass);
      surround(out, p, cross, arch(0, 1.64, 6.56, 9.16, 1.0, [5, 7, 9, 12][lod]), tint.cream, 0.1);
      cutFace(out, 'ashlar', p, rect(-1.33, 12.09, 1.33, 13.31), 0.048, tint.cream);
    }
  }
  for (const [y, d] of [
    [6.0, 0.12],
    [11.53, 0.145],
    [15.93, 0.16],
    [q.towerShaft - 0.36, 0.26],
  ])
    box(
      out,
      'ashlar',
      [towerCenter - half - d, y, rear - d],
      [towerCenter + half + d, y + 0.17, towerFace + d],
      tint.rim,
    );
  box(
    out,
    'slate',
    [towerCenter - half, q.towerShaft - 0.09, rear],
    [towerCenter + half, q.towerShaft - 0.01, towerFace],
    tint.slate,
  );
  for (const x of [towerCenter - half + 0.27, towerCenter + half - 0.27])
    for (const z of [rear + 0.27, towerFace - 0.27]) pinnacle(out, x, z, lod);
  for (const x of [towerCenter - half, towerCenter + half])
    box(
      out,
      'ashlar',
      [x - 0.15, q.towerShaft - 0.04, rear],
      [x + 0.15, q.towerShaft + 0.54, towerFace],
      tint.rim,
    );
  for (const z of [rear, towerFace])
    box(
      out,
      'ashlar',
      [towerCenter - half, q.towerShaft - 0.03, z - 0.17],
      [towerCenter + half, q.towerShaft + 0.54, z + 0.17],
      tint.rim,
    );
  if (lod >= 1)
    for (const [i, p] of sides.entries())
      for (const u of [-1.26, 0, 1.26]) {
        const y = q.towerShaft + 0.36,
          h = i % 2 === 0 ? 1.05 : 0.89;
        const peak = [
          [u - 0.23, y],
          [u + 0.23, y],
          [u + 0.19, y + 0.45],
          [u, y + h],
          [u - 0.19, y + 0.45],
        ];
        cutFace(out, 'ashlar', p, peak, 0.16, tint.cream);
        edging(out, 'ashlar', p, peak, 0.16, -0.13, tint.rim);
      }
}

function hall(out, lod) {
  const partition = [-7.42, -15.52];
  const body = [outline[1], ...outline.slice(2, 14), [outline[13][0], -2.09], outline[0]];
  // The front masonry immediately below the upper gable is authored with the portals.
  shell(out, body, q.naveEaves, tint.rubble, { skip: 5, base: 1.25 });
  const naveX = (outline[3][0] + outline[1][0]) / 2;
  const ridgeX = (naveX + naveMid) / 2;
  const roofRing = [
    [outline[1][0], -23.21],
    [outline[3][0], -23.21],
    [outline[4][0], 10.4],
    [outline[13][0], 10.4],
  ];
  const [a, b, c, d] = roofRing,
    f = [ridgeX, 10.4],
    r = [ridgeX, -23.21];
  for (const [p0, p1, p2, p3, color] of [
    [a, r, f, d, tint.slate],
    [r, b, c, f, tint.slateLight],
  ]) {
    panel(
      out,
      'slate',
      [
        [p0[0], p0 === r ? q.naveRidge : q.naveEaves, p0[1]],
        [p1[0], p1 === r ? q.naveRidge : q.naveEaves, p1[1]],
        [p2[0], p2 === f ? q.naveRidge : q.naveEaves, p2[1]],
        [p3[0], p3 === f ? q.naveRidge : q.naveEaves, p3[1]],
      ],
      [0, 1, 0],
      color,
    );
  }
  for (const [p0, p1, p2, n] of [
    [a, b, r, [0, 0, -1]],
    [d, c, f, [0, 0, 1]],
  ])
    panel(
      out,
      'rubble',
      [
        [p0[0], q.naveEaves, p0[1]],
        [p1[0], q.naveEaves, p1[1]],
        [p2[0], q.naveRidge, p2[1]],
      ],
      n,
      tint.gray,
    );
  for (const [x, normal] of [
    [naveLeft, [-1, 0, 0]],
    [naveRight, [1, 0, 0]],
  ])
    panel(
      out,
      'rubble',
      [
        [x, 6.34, 10.4],
        [x, 6.34, frontZ],
        [x, 14.85, frontZ],
        [x, 13.12, 10.4],
      ],
      normal,
      tint.gray,
    );
  for (const [x] of [
    [naveLeft, [-1, 0, 0]],
    [naveRight, [1, 0, 0]],
  ]) {
    panel(
      out,
      'slate',
      [
        [x, 14.85, frontZ],
        [naveMid, q.upperGableRidge, frontZ],
        [ridgeX, q.naveRidge, 8.44],
        [x, q.naveEaves, 8.44],
      ],
      [0, 1, 0],
      tint.slateLight,
    );
  }
  const annex = [outline[0], outline[13], ...outline.slice(14), partition];
  shell(out, annex, q.annexEaves, tint.paleGray, { base: 1.2 });
  cap(out, 'slate', annex, q.annexEaves, tint.slate);
  const smallRoof = [
      [-28.8, -2.5],
      [-10.8, -2.5],
      [-10.8, 9.95],
      [-28.8, 9.95],
    ],
    y = q.annexEaves;
  cap(
    out,
    'slate',
    [smallRoof[0], smallRoof[1], [-10.8, 3.72], [-28.8, 3.72]],
    (_x, z) => mix(y, q.annexRidge, (z + 2.5) / 6.22),
    tint.slateLight,
  );
  cap(
    out,
    'slate',
    [[-28.8, 3.72], [-10.8, 3.72], smallRoof[2], smallRoof[3]],
    (_x, z) => mix(q.annexRidge, y, (z - 3.72) / 6.23),
    tint.slate,
  );
  if (lod >= 1) {
    for (const [a, b] of [
      [outline[2], outline[3]],
      [outline[3], outline[4]],
      [outline[13], outline[15]],
      [outline[15], outline[16]],
    ]) {
      const s = section(a, b),
        p = (u, v, d = 0) => s.point(s.length - u, v, d);
      const lofted = a === outline[2] || a === outline[3];
      const y = lofted ? 5.16 : 3.67,
        h = lofted ? 5.75 : 3.95;
      for (let j = 0; j < 3; j++) {
        const x = ((j + 0.54) * s.length) / 3.14;
        const win = arch(x, 1.73, y, y + h - 0.79, 0.82, [5, 7, 9, 11][lod]);
        cutFace(out, 'detail', p, win, 0.045, tint.glass);
        surround(
          out,
          p,
          win,
          arch(x, 1.98, y - 0.09, y + h - 0.78, 0.98, [5, 7, 9, 11][lod]),
          tint.cream,
          0.079,
        );
        if (lod >= 2)
          cutFace(out, 'ashlar', p, rect(x - 0.03, y, x + 0.03, y + h - 0.3), 0.13, tint.rim);
      }
    }
  }
}
function build(out, lod) {
  hall(out, lod);
  portals(out, lod);
  tracery(out, lod);
  tower(out, lod);
}
export const foundrySkyline = (out) => build(out, 0);
export const foundryDistrict = (out) => build(out, 1);
export const foundryStreet = (out) => build(out, 2);
export const foundryCloseup = (out) => build(out, 3);
const recipe = 'foundry-united-methodist-church-model.mjs';
const camera = [-49, 29, 75],
  lookAt = [2, 11, -5];
export const foundryModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: foundryCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Foundry United Methodist Church at 16th and P Streets NW, with three recessed Gothic portals, a stone tracery window, square pinnacled belfry and connected corner annex.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-19, 35, 29],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Addressed mapped sanctuary and connected corner annex.',
  },
  embeddedCanonicalGraphs: [
    'stone_granite',
    'stone_limestone_weathered',
    'stone_ashlar',
    'slate',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'sixteenth-street-portals-and-tracery',
      position: [29, 5.6, 34],
      lookAt: [19, 10.6, 11.2],
    },
    { name: 'belfry-louvers-and-pinnacles', position: [-9.4, 17.4, 30], lookAt: [10.2, 21, 10.8] },
    {
      name: 'p-street-annex-and-sanctuary-roof',
      position: [-62, 36, -42],
      lookAt: [-4, 9.2, -1.2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-church-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'foundrySkyline',
    errorMeters: 0.97,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'foundryDistrict', 0.42],
        ['street', 'foundryStreet', 0.14],
        ['closeup', 'foundryCloseup', 0.056],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped footprint is ODbL. The exact Qualla exterior photo by Kurtkaiser is CC0.',
};
