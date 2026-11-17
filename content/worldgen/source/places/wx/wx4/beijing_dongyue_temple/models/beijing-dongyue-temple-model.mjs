/** Timber halls, courtyards and detached glazed paifang of Beijing Dongyue Temple. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { dongyueEntranceTower, dongyueHipRoof } from './entrance-towers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const terrain = read('terrain-grid.json');
const { towers } = read('entrance-tower-controls.json');
const arch = read('archway-controls.json');
const { ranges, minorEaves, minorRise, gatePassage } = plan.section;
const surfaces = {
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.06 },
  recess: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    red: '9f3f31',
    vermilion: 'ae4835',
    dark: '49342b',
    sill: 'aaa196',
    stone: '898a80',
    green: '47694e',
    blue: '436274',
    teal: '2d6767',
    gold: 'b29150',
    haunch: 'aa814b',
    ochre: 'bf994e',
    paving: 'a9a498',
  }).map(([key, value]) => [key, rgb(value)]),
);
const mix = (a, b, t) => a + t * (b - a);

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[b][a], h[b][a + 1], u - a), mix(h[b + 1][a], h[b + 1][a + 1], u - a), v - b) -
    terrain.modelDatumElevationMeters
  );
}

const point = (p, y) => [p[0], y, p[1]];
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
const outward = (ring) => (area(ring) > 0 ? ring : [...ring].reverse());
const forEdges = (ring, each) =>
  ring.forEach((a, i) => {
    each(a, ring[(i + 1) % ring.length]);
  });
const at = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

function roofCap(ring) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      color.green,
    )
  )
    throw Error('Temple footprint could not be triangulated');
  const { indices, positions } = mesh.finalize();
  return Array.from({ length: indices.length / 3 }, (_, i) =>
    Array.from(indices.slice(i * 3, i * 3 + 3), (j) => [positions[3 * j], positions[3 * j + 2]]),
  ).filter((p) => Math.abs(area(p)) > 1e-5);
}

const measured = new Map(map.features.map(({ id, points }) => [id.split('/')[1], points]));
const halls = ranges.map((range) => ({ ...range, ring: measured.get(range.way) }));
const claimed = new Set([
  ...ranges.map(({ way }) => way),
  ...towers.map(({ id }) => id.split('/')[1]),
]);
for (const [way, points] of measured) {
  if (claimed.has(way)) continue;
  const [a, b, c] = points;
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const depth = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const center = at(a, c, 0.5);
  halls.push({
    ring: points,
    eaves: minorEaves,
    rise: minorRise,
    roofs: [
      {
        x: center[0],
        z: center[1],
        width: width + 1.23,
        depth: depth + 1.23,
        angle: -Math.atan2(b[1] - a[1], b[0] - a[0]),
      },
    ],
  });
}
for (const hall of halls) {
  hall.ring = outward(hall.ring);
  hall.cap = roofCap(hall.ring);
  hall.floor = hall.ring.map(ground).sort((a, b) => a - b)[Math.floor(hall.ring.length / 2)] + 0.4;
}

function hip(out, { width, depth, eave, rise, gable }, detailed, tint = color.green) {
  if (detailed >= 0) {
    const longitudinal = depth > width;
    const frame = longitudinal ? transform(out, Math.PI / 2) : out;
    dongyueHipRoof(
      frame,
      {
        width: longitudinal ? depth : width,
        depth: longitudinal ? width : depth,
        eave,
        rise,
      },
      detailed,
    );
    return;
  }
  const x = width / 2,
    z = depth / 2;
  const corners = [
    [-x, eave + 0.19, -z],
    [-x, eave + 0.19, z],
    [x, eave + 0.19, z],
    [x, eave + 0.19, -z],
  ];
  const ridge =
    depth > width
      ? [
          [0, eave + rise, -z + x * 0.68],
          [0, eave + rise, z - x * 0.68],
        ]
      : [
          [-x + z * 0.68, eave + rise, 0],
          [x - z * 0.68, eave + rise, 0],
        ];
  const [a, b, c, d] = corners,
    [p, q] = ridge;
  if (depth > width) {
    face(out, 'roof', [a, b, q, p], tint);
    triangle(out, 'roof', [b, c, q], tint);
    face(out, 'roof', [c, d, p, q], tint);
    triangle(out, 'roof', [d, a, p], tint);
  } else {
    triangle(out, 'roof', [a, b, p], tint);
    face(out, 'roof', [b, c, q, p], tint);
    triangle(out, 'roof', [c, d, q], tint);
    face(out, 'roof', [d, a, p, q], tint);
  }
}

function edgeWall(out, a, b, floorAt, eaves, hasGap, lod) {
  const splits = hasGap
    ? gatePassage
        .map((x) => (x - a[0]) / (b[0] - a[0]))
        .filter((t) => t > 0 && t < 1)
        .sort((u, v) => u - v)
    : [];
  const cut = [a, ...splits.map((t) => at(a, b, t)), b];
  for (let i = 1; i < cut.length; i++) {
    const p = cut[i - 1],
      q = cut[i];
    const x = (p[0] + q[0]) / 2;
    const pass = hasGap && x >= gatePassage[0] && x <= gatePassage[1];
    const low = (v) => Math.min(ground(v) - 0.68, floorAt(v) - 0.13);
    if (!pass && lod > 0)
      face(
        out,
        'stone',
        [point(q, low(q)), point(p, low(p)), point(p, floorAt(p)), point(q, floorAt(q))],
        color.stone,
      );
    const base = (v) => (pass ? floorAt(v) + 3.75 : lod > 0 ? floorAt(v) : low(v));
    face(
      out,
      'wall',
      [
        point(q, base(q)),
        point(p, base(p)),
        point(p, floorAt(p) + eaves),
        point(q, floorAt(q) + eaves),
      ],
      color.red,
    );
  }
}

function bayLine(out, a, b, floor, eave, lod, gap) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 5.5) return;
  const edge = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
  const n = Math.max(2, Math.round(length / 3.35));
  box(edge, 'trim', [0, eave - 0.49, -0.12], [length, eave - 0.22, 0.21], color.teal);
  for (let i = 0; i <= n; i++) {
    const x = 0.23 + ((length - 0.46) * i) / n;
    const worldX = mix(a[0], b[0], x / length);
    if (gap && worldX > gatePassage[0] - 0.43 && worldX < gatePassage[1] + 0.43) continue;
    box(
      edge,
      'timber',
      [x - 0.16, floor + 0.12, -0.46],
      [x + 0.16, eave - 0.37, 0.09],
      color.vermilion,
    );
    if (lod > 1)
      box(
        edge,
        'stone',
        [x - 0.23, floor + 0.02, -0.52],
        [x + 0.23, floor + 0.16, 0.09],
        color.sill,
      );
    if (lod > 2)
      box(edge, 'trim', [x - 0.32, eave - 0.73, -0.57], [x + 0.32, eave - 0.47, 0.19], color.blue);
    if (i === n) continue;
    const center = ((i + 0.5) * length) / n;
    const cx = mix(a[0], b[0], center / length);
    if (gap && cx > gatePassage[0] - 0.7 && cx < gatePassage[1] + 0.7) continue;
    const span = Math.min(length / n - 0.44, 2.21);
    const lo = center - span / 2,
      hi = center + span / 2;
    const bottom = floor + 0.67,
      top = eave - 0.83;
    face(
      edge,
      'recess',
      [
        [lo, bottom, -0.065],
        [hi, bottom, -0.065],
        [hi, top, -0.065],
        [lo, top, -0.065],
      ].reverse(),
      color.dark,
    );
    if (lod > 1) {
      const struts = lod === 3 ? 4 : 2;
      for (let k = 1; k <= struts; k++) {
        const s = mix(lo, hi, k / (struts + 1));
        face(
          edge,
          'timber',
          [
            [s - 0.034, bottom, -0.075],
            [s + 0.034, bottom, -0.075],
            [s + 0.034, top, -0.075],
            [s - 0.034, top, -0.075],
          ].reverse(),
          color.vermilion,
        );
      }
      const y = mix(bottom, top, 0.57);
      face(
        edge,
        'timber',
        [
          [lo, y - 0.054, -0.078],
          [hi, y - 0.054, -0.078],
          [hi, y + 0.054, -0.078],
          [lo, y + 0.054, -0.078],
        ].reverse(),
        color.vermilion,
      );
    }
  }
}

function courtSide(a, b, style) {
  if (!style) return false;
  if (style === 'gate') return Math.abs(b[0] - a[0]) > 6 || a[0] * b[0] > 0;
  if (style === 'south') return (a[1] + b[1]) / 2 > -77 && Math.abs(a[0] - b[0]) > 8;
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2;
  return Math.abs(x) < 39 || z < -89;
}

function floorAt(hall, [, z]) {
  const profile = hall.floorProfile;
  if (!profile) return hall.floor;
  const after = profile.findIndex(([v]) => v > z);
  if (after < 0) return profile.at(-1)[1];
  if (after === 0) return profile[0][1];
  const [a, floorA] = profile[after - 1],
    [b, floorB] = profile[after];
  return mix(floorA, floorB, (z - a) / (b - a));
}

function buildHall(out, hall, lod) {
  const { ring, roofs, portico } = hall;
  const floor = (p) => floorAt(hall, p);
  const eave = (p) => floor(p) + hall.eaves;
  forEdges(ring, (a, b) => {
    const x1 = Math.min(a[0], b[0]),
      x2 = Math.max(a[0], b[0]);
    const gap =
      portico === 'gate' && x1 < gatePassage[1] && x2 > gatePassage[0] && Math.abs(a[1] - b[1]) < 1;
    edgeWall(out, a, b, floor, hall.eaves, gap, lod);
    const mid = at(a, b, 0.5);
    if ((lod > 1 || (lod === 1 && portico === 'south')) && courtSide(a, b, portico))
      bayLine(out, a, b, floor(mid), eave(mid), lod, gap);
  });
  for (const f of hall.cap)
    triangle(
      out,
      'roof',
      f.map((p) => point(p, eave(p))),
      color.green,
    );
  for (const roof of roofs) {
    const { x, z, width, depth } = roof;
    const center = [x, z];
    const y = floor(center) + (roof.eave ?? hall.eaves + 0.12);
    const rise = roof.rise ?? hall.rise;
    const building = transform(out, roof.angle ?? 0, [x, 0, z]);
    if (roof.eave && y > eave(center) + 0.65) {
      const w = width / 2 - 0.93,
        d = depth / 2 - 0.97;
      box(building, 'wall', [-w, eave(center) - 0.47, -d], [w, y - 0.08, d], color.red);
      if (lod > 0)
        box(
          building,
          'trim',
          [-w - 0.13, y - 0.49, -d - 0.13],
          [w + 0.13, y - 0.26, d + 0.13],
          color.teal,
        );
    }
    const detail = lod === 0 ? -1 : roof.eave ? lod - 1 : lod - 2;
    hip(building, { width, depth, eave: y, rise, gable: roof.gable }, detail);
  }
}

function archway(out, lod) {
  const [x, z] = arch.center;
  const floor = ground(arch.center) - 0.14;
  const frame = transform(out, 0, [x, floor, z]);
  const outer = arch.widthMeters / 2;
  const h = arch.riseMeters;
  const depth = arch.depthMeters;
  const columns = [-8.42, -3.25, 3.25, 8.42];
  for (const [i, c] of columns.entries()) {
    const inner = i === 1 || i === 2;
    const top = h * (inner ? 0.82 : 0.65);
    const base = Math.min(-0.65, ground([x + c, z]) - floor - 0.63);
    box(frame, 'stone', [c - 0.7, base, -0.75], [c + 0.7, 0.78, 0.75], color.sill);
    box(frame, 'wall', [c - 0.42, 0.78, -0.55], [c + 0.42, top + 0.46, 0.55], color.ochre);
    if (lod > 0)
      box(frame, 'trim', [c - 0.64, top - 0.68, -0.76], [c + 0.64, top - 0.47, 0.76], color.gold);
    hip(
      transform(frame, 0, [c, 0, 0]),
      {
        width: inner ? 2.83 : (outer - c * Math.sign(c)) * 2,
        depth: 2.83,
        eave: top + 0.45,
        rise: 1.16,
      },
      lod - 2,
    );
  }
  for (const [a, b] of [
    [-8.42, -3.25],
    [-3.25, 3.25],
    [3.25, 8.42],
  ]) {
    const middle = (a + b) / 2;
    const center = middle === 0;
    const y = h * (center ? 0.84 : 0.63);
    box(frame, 'wall', [a, y - 1.44, -0.71], [b, y + 0.06, 0.71], color.haunch);
    if (lod > 0) box(frame, 'trim', [a, y - 0.29, -0.83], [b, y - 0.11, 0.83], color.teal);
    if (lod > 1)
      box(
        frame,
        'trim',
        [middle - 0.77, y - 1.06, -0.82],
        [middle + 0.77, y - 0.45, 0.82],
        color.gold,
      );
    hip(
      transform(frame, 0, [middle, 0, 0]),
      {
        width: b - a + 1.53,
        depth: center ? depth : depth * 0.8,
        eave: y,
        rise: center ? h - y - 0.18 : 1.38,
      },
      center ? lod - 1 : lod - 2,
    );
  }
}

function steppedApproach(out, x, z, width, top, count) {
  const low = Math.min(top - 0.12, ground([x, z + count * 0.46]) - 0.1);
  for (let i = 0; i < count; i++)
    box(
      out,
      'stone',
      [x - width / 2, low, z],
      [x + width / 2, mix(top, low, i / count), z + (i + 1) * 0.52],
      color.sill,
    );
}

function courtyards(out, lod) {
  const [a, b] = gatePassage;
  const gateFloor = halls[1].floor;
  box(out, 'stone', [a, gateFloor - 0.34, 66.8], [b, gateFloor + 0.02, 82.8], color.sill);
  if (lod < 1) return;
  steppedApproach(out, -5.27, 82.1, 17.0, gateFloor + 0.07, 5);
  steppedApproach(out, -3.72, 10.4, 16.1, floorAt(halls[0], [-3.72, 10.4]) + 0.04, 4);
  if (lod < 2) return;
  const pave = (left, right, near, far, offset, tint) => {
    const corners = [
      [left, near],
      [left, far],
      [right, far],
      [right, near],
    ];
    face(
      out,
      'stone',
      corners.map((p) => point(p, ground(p) + offset)),
      tint,
    );
  };
  for (let z = 13; z < 67; z += 3) {
    for (let x = -32; x < 27; x += 5) pave(x, x + 5.01, z, z + 3.01, 0.086, color.stone);
    pave(-5.32, -0.3, z, z + 3.01, 0.15, color.paving);
  }
  for (let i = 0; i < 7; i++)
    for (const sign of [-1, 1]) {
      const x = -3 + sign * (10.2 + (i % 2) * 4.35),
        z = 15.6 + Math.floor(i / 2) * 5.4;
      const y = ground([x, z]);
      const width = 0.62 + (i % 3) * 0.14;
      const h = 1.48 + (i % 3) * 0.29;
      box(out, 'stone', [x - 0.56, y - 0.15, z - 0.36], [x + 0.56, y + 0.35, z + 0.36], color.sill);
      box(
        out,
        'stone',
        [x - width / 2, y + 0.33, z - 0.16],
        [x + width / 2, y + h, z + 0.16],
        color.stone,
      );
      if (lod > 2)
        box(
          out,
          'stone',
          [x - width * 0.57, y + h - 0.11, z - 0.19],
          [x + width * 0.57, y + h + 0.13, z + 0.19],
          color.sill,
        );
    }
}

function skylineTower(out, { width, depth, floor, stonePodium }) {
  const half = width / 2,
    far = depth / 2;
  box(out, 'stone', [-half, floor - 0.6, -far], [half, floor + 0.48, far], color.stone);
  if (stonePodium) {
    box(out, 'stone', [-half, floor + 0.48, -far], [half, floor + 5.5, far], color.stone);
  } else {
    for (const x of [-half + 0.25, half - 0.25])
      for (const z of [-far + 0.25, far - 0.25])
        box(
          out,
          'timber',
          [x - 0.15, floor + 0.45, z - 0.15],
          [x + 0.15, floor + 5.51, z + 0.15],
          color.red,
        );
  }
  box(
    out,
    'wall',
    [-half * 0.68, floor + 5.3, -far * 0.68],
    [half * 0.68, floor + 9.03, far * 0.68],
    color.red,
  );
  const tint = stonePodium ? color.green : color.haunch;
  hip(out, { width: width + 1.85, depth: depth + 1.77, eave: floor + 5.55, rise: 2.11 }, -1, tint);
  hip(
    out,
    { width: width * 0.68 + 1.82, depth: depth * 0.68 + 1.58, eave: floor + 9.03, rise: 2.27 },
    -1,
    tint,
  );
}

function build(out, lod) {
  for (const hall of halls) buildHall(out, hall, lod);
  for (const tower of towers)
    (lod === 0 ? skylineTower : dongyueEntranceTower)(
      transform(out, 0, [tower.center[0], 0, tower.center[1]]),
      tower,
      lod,
    );
  archway(out, lod);
  courtyards(out, lod);
}

export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);
const camera = [109, 119, 238];
const lookAt = [-2, 3, 27];
const recipe = 'beijing-dongyue-temple-model.mjs';
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: templeCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Dongyue Temple in Beijing in 2023, with linked central halls, green tiled courtyard galleries, the distinct bell and drum towers, and the glazed paifang across Chaoyangmenwai Avenue.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-42, 49, 71],
  mediumFiContext: {
    scale: 1,
    groundY: -1.6,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'tile_ceramic',
    'wood_plain',
    'stone_ashlar',
    'plaster_lime',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'main-gate-and-southern-range', position: [20, 15, 120], lookAt: [-5, 5, 73] },
    { name: 'daizong-courtyard-and-stele', position: [0, 7.5, 48], lookAt: [-4, 5.9, 4] },
    { name: 'bell-and-drum-towers', position: [-7, 9.3, 64], lookAt: [-4.3, 5, 39] },
    { name: 'north-halls-and-galleries', position: [66, 35, -117], lookAt: [-3, 4, -64] },
    { name: 'glazed-ming-paifang', position: [7, 12, 191], lookAt: [-6, 5.25, 156] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'templeSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'templeDistrict', 0.27],
        ['street', 'templeStreet', 0.12],
        ['closeup', 'templeCloseup', 0.04],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Used photographs are the six exact Qualla originals released CC0 by EditQ. Native OpenStreetMap geometry under ODbL 1.0.',
};
