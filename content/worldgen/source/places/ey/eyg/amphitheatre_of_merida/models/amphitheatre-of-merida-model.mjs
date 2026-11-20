import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  cap,
  face,
  floorSampler,
  mix,
  palette,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const floor = d.floorY;
const colors = palette({
  granite: 'a6a397',
  block: 'b0aa9c',
  rubble: '9e998b',
  crown: 'a29d8d',
  damp: '94927d',
  soil: 'aba08a',
  pit: '9e927a',
  dust: 'bdb19c',
  dark: '655c4e',
  repair: 'a46b54',
  railing: '5e6763',
  flint: 'b4ad98',
});
const surfaces = {
  podium: surface('wall', 'stone_ashlar', 0.92),
  stone: surface('trim', 'stone_granite', 0.93),
  ruin: surface('wall', 'stone_limestone_weathered', 0.96),
  sand: surface('foundation', 'gravel', 0.98),
  accent: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.93 },
};
const center = [-2.2, 0.13];
const fullTurn = 2 * Math.PI;
const blend = (a, b, t) => a.map((p, i) => mix(p, b[i], t));
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const inward = ([x, z]) => [center[0] - x, 0, center[1] - z];
const outward = ([x, z]) => [x - center[0], 0, z - center[1]];
const parts = (points) => points.map((p, i) => [p, points[(i + 1) % points.length]]);
const scalar = (i, seed) => ((i * seed + 23) % 47) / 46;
const gateZ = (sign) => (sign === 1 ? 2.6 : -3.15);

function radial(outline, a) {
  const direction = [Math.cos(a), Math.sin(a)];
  let distance = Infinity;
  for (const [p, q] of parts(outline)) {
    const from = [p[0] - center[0], p[1] - center[1]];
    const segment = [q[0] - p[0], q[1] - p[1]];
    const denominator = cross(direction, segment);
    if (Math.abs(denominator) < 1e-8) continue;
    const weight = cross(from, direction) / denominator;
    const step = cross(from, segment) / denominator;
    if (step > 0 && weight >= 0 && weight <= 1) distance = Math.min(distance, step);
  }
  return direction.map((p, i) => center[i] + p * distance);
}

function horizontal(out, slot, a, b, c, e, y, yy, color) {
  face(out, slot, [at(a, y), at(b, y), at(c, yy), at(e, yy)], up, color);
}

function wall(out, slot, a, b, lowA, lowB, highA, highB, normal, color) {
  face(out, slot, [at(a, lowA), at(b, lowB), at(b, highB), at(a, highA)], normal, color);
}

function drawArena(out, level) {
  const vertices = [...d.arenaOutline, ...d.pit];
  const indices = earcut(vertices.flat(), [d.arenaOutline.length]);
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((index) => at(vertices[index], floor));
    face(out, 'sand', points, up, i % 8 === 3 ? colors.dust : colors.soil);
  }
  const bottom = floor - d.pitDepth;
  cap(out, 'sand', d.pit, bottom, colors.pit);
  for (const [[a, b], i] of parts(d.pit).map((edge, i) => [edge, i])) {
    const midpoint = blend(a, b, 0.5);
    wall(
      out,
      i % 3 === 0 ? 'podium' : 'ruin',
      a,
      b,
      bottom,
      bottom,
      floor,
      floor,
      inward(midpoint),
      i % 3 === 1 ? colors.rubble : colors.dark,
    );
  }
  const podiumOuter = (p) => blend(p, center, -0.045);
  for (const [a, b] of parts(d.arenaOutline)) {
    const [x, z] = blend(a, b, 0.5);
    if (Math.abs(x) > 29 && Math.abs(z - gateZ(Math.sign(x))) < 2.59) continue;
    const high = floor + 1.38;
    wall(
      out,
      'podium',
      a,
      b,
      floor - 0.25,
      floor - 0.25,
      high,
      high,
      inward([x, z]),
      colors.granite,
    );
    if (level > 0) {
      horizontal(out, 'stone', a, b, podiumOuter(b), podiumOuter(a), high, high, colors.block);
      wall(
        out,
        'stone',
        a,
        b,
        high - 0.16,
        high - 0.16,
        high + 0.01,
        high + 0.01,
        inward([x, z]),
        colors.block,
      );
    }
  }
  if (level > 1) {
    for (const [a, b] of [
      [
        [13.8, -3],
        [19.5, -3],
      ],
      [
        [-20.9, 3.6],
        [-15.8, 3.6],
      ],
      [
        [-10, -7.8],
        [-4.2, -7.8],
      ],
    ]) {
      for (const p of [a, blend(a, b, 0.5), b])
        beam(out, 'accent', at(p, floor), at(p, floor + 0.8), 0.065, 0.075, colors.railing);
      beam(out, 'accent', at(a, floor + 0.77), at(b, floor + 0.77), 0.055, 0.075, colors.railing);
    }
  }
}

function naturalTier(a) {
  if (a > 0.39 && a < 1.22) return 0.94;
  if (a > 1.83 && a < 2.74) return 0.78;
  if (a > 3.68 && a < 4.37) return 0.51;
  if (a > 4.78 && a < 5.73) return 1;
  return 0.68;
}

function drawSeating(out, level) {
  const n = [24, 40, 64, 88][level];
  const ring = Array.from({ length: n + 1 }, (_, i) => {
    const a = (fullTurn * (i % n)) / n;
    return { outer: radial(d.outline, a), inner: radial(d.arenaOutline, a), a };
  });
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[i + 1];
    const azimuth = (fullTurn * (i + 0.5)) / n;
    if (Math.abs(Math.sin(azimuth)) < 0.13) continue;
    const peakA = Math.max(floor + 3.5, grade(a.outer) + 0.56) + (scalar(i % n, 13) - 0.5) * 0.74;
    const peakB =
      Math.max(floor + 3.5, grade(b.outer) + 0.56) + (scalar((i + 1) % n, 13) - 0.5) * 0.74;
    const t = naturalTier(azimuth);
    const span = t > 0.7 ? 0.54 : 0.36;
    const cavea = (p, s) => blend(p.inner, p.outer, s);
    const y = (peak, r) => mix(floor + 1.45, peak, r);
    const height = (peak) => y(peak, t * 0.95);
    const steps = [1, 4, 7, 11][level];
    for (let row = 0; row < steps; row++) {
      const lo = row / steps,
        hi = (row + 1) / steps;
      const [f, g] = [cavea(a, lo * span), cavea(b, lo * span)];
      const [p, q] = [cavea(a, hi * span), cavea(b, hi * span)];
      const first = y(height(peakA), lo),
        second = y(height(peakB), lo);
      const topA = y(height(peakA), hi),
        topB = y(height(peakB), hi);
      const tint =
        t < 0.7
          ? i % 3
            ? colors.damp
            : colors.rubble
          : row % 3 === 2
            ? colors.granite
            : colors.block;
      const slot = t < 0.7 ? 'ruin' : 'stone';
      if (level === 0 || t < 0.7)
        face(out, slot, [at(f, first), at(g, second), at(q, topB), at(p, topA)], up, tint);
      else {
        face(out, slot, [at(f, topA), at(g, topB), at(q, topB), at(p, topA)], up, tint);
        wall(
          out,
          'podium',
          f,
          g,
          first,
          second,
          topA,
          topB,
          inward(f),
          row % 4 ? colors.granite : colors.rubble,
        );
      }
    }
    const brokenA = cavea(a, span + 0.1 + 0.03 * scalar(i % n, 9));
    const brokenB = cavea(b, span + 0.1 + 0.03 * scalar((i + 1) % n, 9));
    face(
      out,
      'ruin',
      [
        at(cavea(a, span), height(peakA)),
        at(cavea(b, span), height(peakB)),
        at(brokenB, peakB + 0.13),
        at(brokenA, peakA + 0.13),
      ],
      up,
      t < 0.7 && i % 7 < 4 ? colors.damp : colors.rubble,
    );
    const topA = peakA + (scalar(i % n, 29) - 0.55) * 1.16;
    const topB = peakB + (scalar((i + 1) % n, 29) - 0.55) * 1.16;
    face(
      out,
      'ruin',
      [at(brokenA, peakA + 0.13), at(brokenB, peakB + 0.13), at(b.outer, topB), at(a.outer, topA)],
      up,
      t < 0.7 && i % 9 < 6 ? colors.damp : colors.crown,
    );
    wall(
      out,
      'ruin',
      a.outer,
      b.outer,
      Math.min(floor - 0.42, grade(a.outer) - 0.38),
      Math.min(floor - 0.42, grade(b.outer) - 0.38),
      topA,
      topB,
      outward(a.outer),
      colors.rubble,
    );
    if (level > 1 && i % 4 === 1) {
      const forward = blend(brokenA, a.outer, 0.75),
        rear = blend(brokenB, b.outer, 0.81);
      wall(
        out,
        'accent',
        forward,
        rear,
        peakA + 0.105,
        peakB + 0.1,
        peakA + 0.34,
        peakB + 0.44,
        inward(forward),
        colors.repair,
      );
    }
    if (level === 3 && i % 3 !== 2) {
      const site = blend(blend(brokenA, a.outer, 0.4), blend(brokenB, b.outer, 0.44), 0.55);
      const base = (peakA + peakB) * 0.5 + 0.11;
      const dx = 0.42 + 0.61 * scalar(i, 23),
        dz = 0.28 + 0.55 * scalar(i, 19);
      beam(
        out,
        'ruin',
        [site[0] - dx, base, site[1] - dz],
        [site[0] + dx, base + 0.11, site[1] + dz],
        dz * 1.1,
        0.25 + scalar(i, 17) * 0.45,
        colors.flint,
      );
    }
  }
}

function barrel(out, level, x, z, depth, sign, width, spring, crown, extra, through) {
  const n = [5, 8, 11, 15][level];
  const point = (i, delta, back) => {
    const angle = (Math.PI * i) / n;
    return [
      x + (back ? sign * depth : 0),
      spring + (crown + delta) * Math.sin(angle),
      z + (width + delta) * Math.cos(angle),
    ];
  };
  const normal = [-sign, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = point(i, 0, false),
      b = point(i + 1, 0, false);
    const c = point(i + 1, extra, false),
      d = point(i, extra, false);
    const tail = point(i, 0, true),
      toe = point(i + 1, 0, true);
    face(out, 'stone', [a, b, c, d], normal, i % 3 === 1 ? colors.granite : colors.block);
    face(out, 'ruin', [a, tail, toe, b], [0, -1, z - (a[2] + b[2]) / 2], colors.dark);
    if (level > 0) {
      face(out, 'ruin', [c, d, point(i, extra, true), point(i + 1, extra, true)], up, colors.crown);
      const copestone = spring + crown + extra + (through ? 0.28 : 0.16);
      const raised = (p) => [p[0], copestone + 0.085 * (p[2] - z), p[2]];
      face(out, 'ruin', [d, c, raised(c), raised(d)], normal, colors.rubble);
      face(
        out,
        'stone',
        [
          raised(d),
          raised(c),
          [c[0] + sign * 0.62, raised(c)[1], c[2]],
          [d[0] + sign * 0.62, raised(d)[1], d[2]],
        ],
        up,
        colors.block,
      );
    }
    if (!through)
      face(
        out,
        'ruin',
        [tail, toe, [toe[0], spring - 0.002, toe[2]], [tail[0], spring - 0.002, tail[2]]],
        normal,
        colors.dark,
      );
  }
  for (const side of [-1, 1]) {
    const inside = z + side * width,
      outside = inside + side * extra;
    face(
      out,
      'stone',
      [
        [x, floor, inside],
        [x, floor, outside],
        [x, spring, outside],
        [x, spring, inside],
      ],
      normal,
      colors.block,
    );
    wall(
      out,
      'ruin',
      [x, inside],
      [x + depth * sign, inside],
      floor,
      floor,
      spring,
      spring,
      [0, 0, -side],
      colors.rubble,
    );
  }
  if (!through)
    face(
      out,
      'ruin',
      [
        [x + sign * depth, floor, z - width],
        [x + sign * depth, floor, z + width],
        [x + sign * depth, spring, z + width],
        [x + sign * depth, spring, z - width],
      ],
      normal,
      colors.dark,
    );
}

function gateways(out, level) {
  for (const sign of [-1, 1]) {
    const x = sign === 1 ? 32.45 : -32.6;
    const z = gateZ(sign),
      width = d.stadiumGateWidth * 0.5;
    barrel(out, level, x, z, 11.7, sign, width, floor + 2.88, 1.55, 0.58, true);
    if (level > 0) {
      barrel(
        out,
        level,
        x - sign * 0.65,
        z - 5.7,
        3.8,
        sign,
        1.65,
        floor + 1.35,
        1.13,
        0.42,
        false,
      );
      barrel(
        out,
        level,
        x - sign * 1.35,
        z + 5.7,
        4.9,
        sign,
        1.75,
        floor + 1.14,
        0.98,
        0.46,
        false,
      );
    }
    if (level > 0) {
      for (const side of [-1, 1]) {
        for (const [lateral, reach, height] of [
          [3.0, 3.68, 3.38],
          [7.65, 10.2, 2.52],
        ]) {
          const a = [x + sign * 0.8, z + side * lateral];
          const b = [x + sign * 0.65, z + side * reach];
          const c = [x + sign * 4.7, z + side * (reach + 0.52)];
          const e = [x + sign * 4.65, z + side * lateral];
          wall(
            out,
            'ruin',
            a,
            b,
            floor - 0.1,
            floor - 0.1,
            floor + height,
            floor + height + 0.24,
            [-sign, 0, 0],
            colors.rubble,
          );
          horizontal(
            out,
            'ruin',
            a,
            b,
            c,
            e,
            floor + height + 0.12,
            floor + height + 0.42,
            colors.crown,
          );
        }
      }
    }
    const shortX = x + sign * 12,
      outer = x + sign * 29.1;
    const outerY = Math.max(floor + 0.06, grade([outer, z]) - 0.55);
    horizontal(
      out,
      'sand',
      [x, z - width],
      [x, z + width],
      [shortX, z + width],
      [shortX, z - width],
      floor,
      floor,
      colors.pit,
    );
    horizontal(
      out,
      'sand',
      [shortX, z - width],
      [shortX, z + width],
      [outer, z + width],
      [outer, z - width],
      floor,
      outerY,
      colors.soil,
    );
    for (const side of [-1, 1]) {
      const p = z + side * (width + 0.2);
      wall(
        out,
        'podium',
        [shortX, p],
        [outer, p],
        floor,
        outerY - 0.2,
        floor + 2.9,
        Math.max(outerY + 0.75, grade([outer, p]) + 0.28),
        [0, 0, -side],
        colors.rubble,
      );
    }
  }
}

function build(out, level) {
  drawArena(out, level);
  drawSeating(out, level);
  gateways(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'amphitheatre-of-merida-model.mjs';
const camera = [129, 114, 93],
  lookAt = [0, -1.8, 0];
const lods = { district: 0.81, street: 0.39, closeup: 0.14 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original local relief fixes the approach grades and partly buried outer ring. The lower excavated arena and pit are represented in the opening.',
  brief:
    'Excavated Roman amphitheatre at Mérida with weathered lower granite terraces, a sunken central pit and vaulted axial entrances.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-56, 81, 90],
  mediumFiContext: {
    scale: 1,
    groundY: -1.55,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.91,
    basis: 'The named ruin’s own mapped perimeter bounds nearby building replacement.',
  },
  groundCutout: {
    outline: d.outline.map((p) => blend(p, center, 0.12)),
    minHeight: floor - d.pitDepth - 0.43,
    basis:
      'Clearance is confined to the amphitheatre excavation so the preserved terrain outside remains visible.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_granite', 'stone_limestone_weathered', 'gravel'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'whole-ruin-and-elliptical-arena', position: [87, 81, 75], lookAt },
    {
      name: 'arena-pit-and-axial-vaults',
      position: [-30, floor + 5.7, -4],
      lookAt: [20, floor + 2.6, 0],
    },
    {
      name: 'lower-stone-seating',
      position: [6, floor + 9.5, 20.5],
      lookAt: [-17, floor + 1.75, -13],
    },
    { name: 'surviving-gate-and-outer-masonry', position: [74, 12, 32], lookAt: [36, -1.1, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'merida-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.72,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
};
