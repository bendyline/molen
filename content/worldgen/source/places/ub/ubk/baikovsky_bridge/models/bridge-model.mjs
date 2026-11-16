import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/signature-tower-expansion-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { design } = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const {
  barrelHalfWidth: radius,
  barrelHalfLength: halfLength,
  barrelSpringY: spring,
  floorY,
  apronEndZ,
  grade,
} = design;

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick' },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered' },
  pavers: { slot: 'foundation', graph: 'stone_granite' },
  roadway: { slot: 'foundation', graph: 'gravel' },
  iron: { slot: 'trim', graph: 'metal_painted' },
  lamp: { slot: 'trim', localRef: 'palette:#e0bc82', name: 'Amber lamp panes' },
};

const brick = [0.51, 0.31, 0.23];
const lining = [0.42, 0.27, 0.2];
const ashlar = [0.63, 0.55, 0.44];
const coping = [0.72, 0.65, 0.51];
const pavers = [0.53, 0.5, 0.43];
const roadway = [0.62, 0.51, 0.37];
const iron = [0.28, 0.31, 0.27];

function bracket(knots, value) {
  const next = knots.findIndex((knot) => knot > value);
  const i = next <= 0 ? (next === 0 ? 0 : knots.length - 2) : next - 1;
  const fraction = (value - knots[i]) / (knots[i + 1] - knots[i]);
  return [i, Math.min(1, Math.max(0, fraction))];
}

export function bridgeRoadHeight(x, z) {
  const [i, u] = bracket(grade.xs, x);
  const [j, v] = bracket(grade.zs, z);
  const p = grade.relativeMeters;
  const sample =
    (1 - u) * ((1 - v) * p[i][j] + v * p[i][j + 1]) +
    u * ((1 - v) * p[i + 1][j] + v * p[i + 1][j + 1]);
  // Cover today's paving within the historical mask. Lower the edge onto its current approaches.
  const overlay = 0.085 + Math.min(1, (12 - Math.abs(x)) / 2.8) * 0.22;
  return sample + overlay;
}

function deck(out, detail) {
  const edges = [...new Set([...grade.zs, -18.2, -17.92, 17.92, 18.2])].toSorted((a, b) => a - b);
  const top = (x, z, sidewalk) => [x, bridgeRoadHeight(x, z) + (sidewalk ? 0.128 : 0), z];
  for (let i = 1; i < grade.xs.length; i++) {
    const a = grade.xs[i - 1],
      b = grade.xs[i];
    for (let j = 1; j < edges.length; j++) {
      const left = edges[j - 1],
        right = edges[j],
        sidewalk = Math.abs((left + right) * 0.5) >= 17.92;
      face(
        out,
        sidewalk ? 'pavers' : 'roadway',
        [
          top(a, right, sidewalk),
          top(b, right, sidewalk),
          top(b, left, sidewalk),
          top(a, left, sidewalk),
        ],
        sidewalk ? pavers : roadway,
      );
    }
    for (const side of [-1, 1]) {
      const z = side * 17.92,
        curb = [top(a, z, false), top(b, z, false), top(b, z, true), top(a, z, true)];
      face(out, 'stone', side > 0 ? curb.toReversed() : curb, coping);
    }
  }
  for (const x of [-12, 12]) {
    for (let j = 1; j < edges.length; j++) {
      const a = edges[j - 1],
        b = edges[j],
        walk = Math.abs((a + b) * 0.5) >= 17.92;
      const p = top(x, a, walk),
        q = top(x, b, walk);
      const lip = 0.28 + (walk ? 0.128 : 0);
      const edge = [p, q, [x, q[1] - lip, b], [x, p[1] - lip, a]];
      face(
        out,
        walk ? 'pavers' : 'roadway',
        x < 0 ? edge.toReversed() : edge,
        walk ? pavers : roadway,
      );
    }
  }
  if (detail < 2) return;
  for (let x = -10.5; x < 11; x += detail === 2 ? 1.25 : 0.63)
    for (const side of [-1, 1]) {
      const z0 = side * 18.23 - 0.23,
        z1 = z0 + 0.46,
        x1 = x + (detail === 2 ? 1.17 : 0.55);
      const p = (x, z) => [x, bridgeRoadHeight(x, z) + 0.137, z];
      face(out, 'stone', [p(x, z1), p(x1, z1), p(x1, z0), p(x, z0)], coping);
    }
}

function archPoint(theta, width, z) {
  return [width * Math.cos(theta), spring + width * Math.sin(theta), z];
}

function tunnel(out, detail) {
  const steps = [10, 18, 26, 36, 48][detail];
  const depth = detail >= 3 ? 8 : detail === 2 ? 4 : 1;
  const inside = (theta, z) => archPoint(theta, radius, z);
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * i) / steps,
      b = (Math.PI * (i + 1)) / steps;
    for (let n = 0; n < depth; n++) {
      const front = halfLength * ((2 * n) / depth - 1),
        back = halfLength * ((2 * (n + 1)) / depth - 1);
      face(
        out,
        'brick',
        [inside(a, front), inside(a, back), inside(b, back), inside(b, front)],
        lining,
      );
    }
  }
  for (const side of [-1, 1]) {
    const x = side * radius;
    const wall = [
      [x, floorY, halfLength],
      [x, spring, halfLength],
      [x, spring, -halfLength],
      [x, floorY, -halfLength],
    ];
    face(out, 'brick', side < 0 ? wall.toReversed() : wall, lining);
  }
  face(
    out,
    'pavers',
    [
      [-radius, floorY, halfLength],
      [radius, floorY, halfLength],
      [radius, floorY, -halfLength],
      [-radius, floorY, -halfLength],
    ],
    pavers,
  );
  if (detail >= 2) {
    box(out, 'stone', [-radius, floorY, -halfLength], [-1.76, floorY + 0.22, halfLength], ashlar);
    box(out, 'stone', [1.76, floorY, -halfLength], [radius, floorY + 0.22, halfLength], ashlar);
  }
}

function portal(out, side, detail) {
  const z = side * halfLength,
    front = z + side * 0.12;
  const archThickness = 0.47;
  const ringRadius = radius + archThickness;
  const springEnd = (x) => bridgeRoadHeight(x, z) + 0.128;
  const planar = (slot, points, color) =>
    face(out, slot, side > 0 ? points : points.toReversed(), color);
  const steps = [10, 18, 26, 36, 48][detail];
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * i) / steps,
      b = (Math.PI * (i + 1)) / steps;
    const innerA = archPoint(a, radius, front),
      innerB = archPoint(b, radius, front);
    const ringA = archPoint(a, ringRadius, front),
      ringB = archPoint(b, ringRadius, front);
    planar('stone', [innerA, ringA, ringB, innerB], detail > 1 && i % 5 === 2 ? coping : ashlar);
    const returnFace = [insideFace(innerB, z), insideFace(innerA, z), innerA, innerB];
    face(out, 'stone', side > 0 ? returnFace : returnFace.toReversed(), ashlar);
    planar(
      'brick',
      [
        [ringB[0], ringB[1], z],
        [ringA[0], ringA[1], z],
        [ringA[0], springEnd(ringA[0]), z],
        [ringB[0], springEnd(ringB[0]), z],
      ],
      brick,
    );
    if (detail >= 3) {
      const c = (Math.PI * (i + 0.5)) / steps;
      const h = 0.012;
      const k0 = archPoint(c, ringRadius - 0.025, front + side * h);
      const k1 = archPoint(c, ringRadius - 0.128, front + side * h);
      beam(out, 'stone', k0, k1, 0.016, 0.013, ashlar);
    }
  }
  for (const sign of [-1, 1]) {
    const a = sign > 0 ? radius : -8.45,
      b = sign > 0 ? 8.45 : -radius;
    const floor = floorY - 0.13;
    planar(
      'brick',
      [
        [a, floor, z],
        [b, floor, z],
        [b, springEnd(b), z],
        [a, springEnd(a), z],
      ],
      brick,
    );
    const pier = sign * 3.07;
    const lowZ = Math.min(z - side * 0.24, z + side * 0.42),
      highZ = Math.max(z - side * 0.24, z + side * 0.42);
    box(
      out,
      'stone',
      [pier - 0.28, floor, lowZ],
      [pier + 0.28, springEnd(pier) - 0.17, highZ],
      ashlar,
    );
    if (detail === 0) continue;
    box(
      out,
      'stone',
      [pier - 0.39, floorY + 0.13, lowZ - 0.1],
      [pier + 0.39, floorY + 0.42, highZ + 0.1],
      coping,
    );
    box(
      out,
      'stone',
      [pier - 0.41, springEnd(pier) - 0.44, lowZ - 0.1],
      [pier + 0.41, springEnd(pier) - 0.22, highZ + 0.1],
      coping,
    );
  }
  const peak = spring + ringRadius;
  if (detail > 1) {
    const a = [-0.17, peak - 0.25, z + side * 0.14],
      b = [0.17, peak + 0.09, z + side * 0.23];
    box(
      out,
      'stone',
      [a[0], a[1], Math.min(a[2], b[2])],
      [b[0], b[1], Math.max(a[2], b[2])],
      coping,
    );
  }
}

function insideFace([x, y], z) {
  return [x, y, z];
}

function aprons(out, side, detail) {
  const n = [3, 4, 8, 12, 12][detail];
  const rim = design.apronEndGrades[side === -1 ? 0 : 1];
  const width = (u) => 4.75 + (6.8 - 4.75) * u;
  const zAt = (u) => side * (halfLength + (apronEndZ - halfLength) * u);
  const yAt = (u, s) => floorY + (rim[s > 0 ? 2 : 0] - floorY) * u * u;
  // Inclined threshold returns to the site grade at the outside of each cutout.
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n;
    const p = (u, s) => [s * width(u), yAt(u, s), zAt(u)];
    const middle = (u) => [0, floorY + (rim[1] - floorY) * u * u, zAt(u)];
    for (const sign of [-1, 1]) {
      const floor = [middle(a), p(a, sign), p(b, sign), middle(b)];
      face(out, 'pavers', side === sign ? floor.toReversed() : floor, pavers);
    }
  }
  for (const sign of [-1, 1]) {
    const wallTop = [],
      wallBottom = [];
    const startHeight = bridgeRoadHeight(sign * 4.75, side * halfLength) + 0.128;
    for (let i = 0; i <= n; i++) {
      const u = i / n,
        x = sign * width(u),
        z = zAt(u),
        ground = rim[sign > 0 ? 2 : 0];
      wallTop.push([x, ground + (startHeight - ground) * (1 - u) * (1 - u) + 0.09, z]);
      wallBottom.push([x, yAt(u, sign) - 0.08, z]);
    }
    for (let i = 1; i < wallTop.length; i++) {
      const wall = [wallBottom[i - 1], wallBottom[i], wallTop[i], wallTop[i - 1]];
      face(out, 'brick', sign === side ? wall : wall.toReversed(), brick);
    }
    beamPath(out, 'stone', wallTop, 0.3, 0.17, coping);
  }
}

function parapets(out, side, detail) {
  const z = side * (halfLength - 0.21);
  const posts = detail === 0 ? [-8.15, 0, 8.15] : [-8.15, -4.15, 0, 4.15, 8.15];
  const top = (x) => bridgeRoadHeight(x, z) + 0.128;
  for (const x of posts) {
    const y = top(x),
      w = x === 0 ? 0.36 : 0.27;
    box(
      out,
      'stone',
      [x - w, y - 0.022, z - 0.23],
      [x + w, y + (detail === 0 ? 0.94 : 0.83), z + 0.23],
      ashlar,
    );
    if (detail > 0)
      box(
        out,
        'stone',
        [x - w - 0.06, y + 0.83, z - 0.3],
        [x + w + 0.06, y + 0.96, z + 0.3],
        coping,
      );
    if (detail >= 3 && x === 0) {
      const q = z + side * 0.24;
      box(out, 'stone', [x - 0.22, y + 0.36, q - 0.035], [x + 0.22, y + 0.63, q + 0.035], pavers);
    }
  }
  for (const h of detail === 0 ? [0.71] : [0.25, 0.71])
    beamPath(
      out,
      'iron',
      posts.map((x) => [x, top(x) + h, z]),
      0.07,
      0.065,
      iron,
    );
  if (detail >= 1)
    for (let x = -7.77; x < 7.9; x += detail === 1 ? 1.12 : 0.43) {
      if (posts.some((post) => Math.abs(x - post) < 0.34)) continue;
      const y = top(x);
      box(out, 'iron', [x - 0.022, y + 0.24, z - 0.027], [x + 0.022, y + 0.74, z + 0.027], iron);
    }
}

function lanterns(out, detail) {
  for (const x of [-6.1, 6.1])
    for (const z of [-19.9, 19.9]) {
      const y = bridgeRoadHeight(x, z) + 0.128;
      if (detail === 0) {
        box(out, 'iron', [x - 0.055, y, z - 0.055], [x + 0.055, y + 2.64, z + 0.055], iron);
        box(out, 'iron', [x - 0.125, y + 2.62, z - 0.125], [x + 0.125, y + 2.95, z + 0.125], iron);
        continue;
      }
      const foot = radialRing(y, 0.15, 0.15, 8, [x, z]);
      loft(
        out,
        'iron',
        [
          foot,
          radialRing(y + 0.17, 0.116, 0.116, 8, [x, z]),
          radialRing(y + 2.64, 0.043, 0.043, 8, [x, z]),
        ],
        iron,
      );
      const a = 0.105,
        b = 0.155;
      const low = [
        [-a, -a],
        [a, -a],
        [a, a],
        [-a, a],
      ].map(([u, v]) => [x + u, y + 2.64, z + v]);
      const high = [
        [-b, -b],
        [b, -b],
        [b, b],
        [-b, b],
      ].map(([u, v]) => [x + u, y + 2.95, z + v]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        face(out, 'lamp', [low[j], low[i], high[i], high[j]], [0.69, 0.52, 0.32]);
        tri(out, 'iron', [high[j], high[i], [x, y + 3.08, z]], iron);
        if (detail >= 2) {
          beam(out, 'iron', low[i], high[i], 0.018, 0.018, iron);
          beam(out, 'iron', high[i], high[j], 0.024, 0.025, iron);
        }
      }
    }
}

function build(out, detail) {
  deck(out, detail);
  tunnel(out, detail);
  for (const side of [-1, 1]) {
    portal(out, side, detail);
    aprons(out, side, detail);
    parapets(out, side, detail);
  }
  lanterns(out, detail);
}

export const buildMaster = (out) => build(out, 4);
export const buildCloseup = (out) => build(out, 3);
export const buildStreet = (out) => build(out, 2);
export const buildDistrict = (out) => build(out, 1);
export const buildSkyline = (out) => build(out, 0);
