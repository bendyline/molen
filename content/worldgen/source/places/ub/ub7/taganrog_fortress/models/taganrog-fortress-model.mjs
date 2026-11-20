import fs from 'node:fs';
import {
  beam,
  normalize,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const section = plan.section;
const material = (slot, graph, roughness) => ({ slot, graph, roughness, metallic: 0 });
const surfaces = {
  soil: material('wall', 'earth_rammed', 0.95),
  path: material('foundation', 'gravel', 0.99),
  timber: material('trim', 'wood_plain', 0.88),
  siding: material('wall', 'wood_weatherboard', 0.89),
  roof: material('roof', 'shingle_cedar', 0.93),
  stone: material('wall', 'stone_drywall', 0.96),
};
const palette = {
  turf: rgb('969a70'),
  grass: rgb('afb186'),
  bank: rgb('b1a58a'),
  ditch: rgb('958981'),
  track: rgb('c6b69b'),
  pile: rgb('66594d'),
  planks: rgb('9a8066'),
  house: rgb('ae9d81'),
  roof: rgb('796d5c'),
  warmRoof: rgb('867360'),
  stone: rgb('97978e'),
  coping: rgb('b2ada3'),
};
const levels = [
  { spacing: 130, blocks: 8, fenceSpacing: 0, houseDetails: false },
  { spacing: 54, blocks: 15, fenceSpacing: 0, houseDetails: false },
  { spacing: 36, blocks: 15, fenceSpacing: 10, houseDetails: true },
  { spacing: 28, blocks: 15, fenceSpacing: 5.5, houseDetails: true },
];

function height([x, z]) {
  const f = (x - field.origin[0]) / field.stepMeters;
  const g = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(f);
  const j = Math.floor(g);
  if (i < 0 || j < 0 || i >= field.size[0] - 1 || j >= field.size[1] - 1) {
    throw new Error('Taganrog feature outside original ground sample');
  }
  const row = (k) =>
    field.heightsMeters[k][i] * (1 - f + i) + field.heightsMeters[k][i + 1] * (f - i);
  return row(j) * (1 - g + j) + row(j + 1) * (g - j) - field.modelDatumElevationMeters;
}

function triangle(out, slot, points, color, positiveY = false) {
  let normal = normalFor(...points);
  if (positiveY && normal[1] < 0) {
    points = [points[0], points[2], points[1]];
    normal = normalFor(...points);
  }
  out.addTriangle(
    slot,
    'palette:#ffffff',
    points,
    normal,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    color,
  );
}

function surface(out, slot, points, color, positiveY = false) {
  if (points.length === 3) {
    triangle(out, slot, points, color, positiveY);
    return;
  }
  triangle(out, slot, points.slice(0, 3), color, positiveY);
  triangle(out, slot, [points[0], points[2], points[3]], color, positiveY);
}

function resample(path, step) {
  const points = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let j = 1; j <= count; j++) {
      points.push(a.map((v, k) => v + ((b[k] - v) * j) / count));
    }
  }
  return points;
}

// The first point on the profile is at the town side. The last is the toe of the glacis.
const sectionProfile = [
  [-25, 0.3, 'bank'],
  [-17, 2.6, 'grass'],
  [-7, 7.4, 'turf'],
  [1, 7.4, 'turf'],
  [7, 5.5, 'bank'],
  [15, 1.25, 'ditch'],
  [23, 1.1, 'ditch'],
  [29, 1.1, 'track'],
  [34, 3.15, 'turf'],
  [44, 3.25, 'grass'],
  [63, 0.35, 'grass'],
];

function miter(path, i) {
  const a = path[Math.max(i - 1, 0)],
    p = path[i],
    b = path[Math.min(i + 1, path.length - 1)];
  const av = normalize([p[1] - a[1], a[0] - p[0]]);
  const bv = normalize([b[1] - p[1], p[0] - b[0]]);
  const average = normalize([av[0] + bv[0], av[1] + bv[1]]);
  const normal = i === 0 ? bv : av;
  return average.map((v) => v / Math.max(0.56, normal[0] * average[0] + normal[1] * average[1]));
}

function renderRampart(out, lod) {
  const path = resample(section.main, lod.spacing);
  const stations = path.map(([x, z], i) => {
    const n = miter(path, i);
    return sectionProfile.map(([offset, h]) => {
      const p = [x + n[0] * offset, z + n[1] * offset];
      return [p[0], height(p) + h, p[1]];
    });
  });
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i],
      b = stations[i + 1];
    for (let j = 0; j < sectionProfile.length - 1; j++) {
      const tint = sectionProfile[j][2];
      surface(
        out,
        tint === 'track' || tint === 'ditch' ? 'path' : 'soil',
        [a[j], a[j + 1], b[j + 1], b[j]],
        palette[tint],
        true,
      );
    }
  }
  if (!lod.fenceSpacing) return;
  const fence = stations.map((row) => row[8]);
  for (let i = 0; i < fence.length - 1; i++) {
    const a = fence[i],
      b = fence[i + 1];
    beam(out, 'timber', [a[0], a[1] + 1, a[2]], [b[0], b[1] + 1, b[2]], 0.34, 0.28, palette.pile);
    for (const p of resample(
      [a, b].map(([x, , z]) => [x, z]),
      lod.fenceSpacing,
    ).slice(0, -1)) {
      const [x, z] = p,
        y = height(p) + 3.15;
      beam(out, 'timber', [x, y - 0.1, z], [x, y + 2, z], 0.27, 0.27, palette.pile);
    }
  }
}

function ravelin(out, points, h) {
  const center = [0, 1].map((k) => points.reduce((sum, a) => sum + a[k], 0) / points.length);
  const rings = [
    [1.05, 0.1],
    [0.87, h * 0.82],
    [0.73, h],
    [0.55, h],
    [0.47, h * 0.48],
  ];
  const layers = rings.map(([scale, add]) =>
    points.map((p) => {
      const at = p.map((v, i) => center[i] + (v - center[i]) * scale);
      return [at[0], height(at) + add, at[1]];
    }),
  );
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < points.length; j++) {
      const k = (j + 1) % points.length;
      surface(
        out,
        'soil',
        [layers[i - 1][j], layers[i - 1][k], layers[i][k], layers[i][j]],
        i === 1 ? palette.bank : palette.turf,
        true,
      );
    }
  }
  surface(out, 'soil', layers.at(-1), palette.grass, true);
}

function moles(out, lod) {
  const seaRelative = -field.modelDatumElevationMeters;
  for (const [index, path] of section.moles.entries()) {
    const points = resample(path, lod.spacing * 0.82);
    const half = index === 3 ? 4.8 : 6.3;
    const stations = points.map((point, i) => {
      const local = Math.max(seaRelative, height(point));
      const m = miter(points, i);
      return [
        [-half, -2.1],
        [-half * 0.74, 2.1],
        [half * 0.74, 2.1],
        [half, -2.1],
      ].map(([w, y]) => [point[0] + m[0] * w, local + y, point[1] + m[1] * w]);
    });
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1],
        b = stations[i];
      for (let j = 0; j < 3; j++) {
        surface(
          out,
          'stone',
          [a[j], a[j + 1], b[j + 1], b[j]],
          j === 1 ? palette.coping : palette.stone,
          true,
        );
      }
    }
    for (const cap of [stations[0], stations.at(-1)]) {
      quad(out, 'stone', cap, normalFor(...cap.slice(0, 3)), palette.stone);
    }
  }
}

function bridges(out, lod) {
  for (const [a, b] of section.bridges) {
    // The 1704 transverse plan records these decks over the ditch and the
    // raised covered way. Keep the inferred timber spans above that bank.
    const grade = Math.max(...resample([a, b], 8).map(height));
    const ay = grade + 4.1,
      by = grade + 4.15;
    const pa = [a[0], ay, a[1]],
      pb = [b[0], by, b[1]];
    beam(out, 'timber', pa, pb, 5.4, 0.85, palette.planks);
    if (!lod.houseDetails) continue;
    const n = normalize([b[1] - a[1], a[0] - b[0]]);
    for (const edge of [-2.3, 2.3]) {
      const p = [pa[0] + edge * n[0], ay + 1.15, pa[2] + edge * n[1]];
      const q = [pb[0] + edge * n[0], by + 1.15, pb[2] + edge * n[1]];
      beam(out, 'timber', p, q, 0.22, 0.24, palette.pile);
      const piers = resample(
        [
          [p[0], p[2]],
          [q[0], q[2]],
        ],
        4.8,
      );
      for (const [i, r] of piers.entries()) {
        const [x, z] = r;
        const deck = ay + ((by - ay) * i) / (piers.length - 1);
        const bottom = Math.min(height(r) - 0.2, deck - 0.35);
        beam(out, 'timber', [x, bottom, z], [x, deck + 1.15, z], 0.33, 0.33, palette.pile);
      }
    }
  }
}

function house(out, [x, z, w, d, angle], idx, detail) {
  const u = Math.cos(angle),
    v = Math.sin(angle);
  const grade = height([x, z]);
  const eave = 3.15 + (idx % 3) * 0.52;
  const ridge = eave + d * 0.28;
  const at = (a, y, b) => [x + u * a - v * b, grade + y, z + v * a + u * b];
  const ring = (Y) =>
    [
      [-w, -d],
      [-w, d],
      [w, d],
      [w, -d],
    ].map(([a, b]) => at(a / 2, Y, b / 2));
  const bottom = ring(-1.25),
    top = ring(eave);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    surface(out, 'siding', [bottom[i], bottom[j], top[j], top[i]], palette.house);
  }
  const e = 0.35,
    rw = w / 2 + e,
    rd = d / 2 + e;
  const ridgeA = at(-rw, ridge, 0),
    ridgeB = at(rw, ridge, 0);
  const roof = idx % 3 ? palette.roof : palette.warmRoof;
  for (const side of [-1, 1]) {
    surface(
      out,
      'roof',
      [at(-rw, eave, side * rd), at(rw, eave, side * rd), ridgeB, ridgeA],
      roof,
      true,
    );
    const end = (side * w) / 2;
    triangle(
      out,
      'siding',
      [at(end, eave, (side * d) / 2), at(end, eave, (-side * d) / 2), at(end, ridge - 0.05, 0)],
      palette.house,
    );
  }
  if (detail) {
    for (const f of [-0.31, 0, 0.31]) {
      const x = f * w,
        z = d / 2 + 0.025;
      const mid = f === 0 ? 0.23 : eave * 0.4;
      const hi = f === 0 ? 2.04 : mid + 0.78;
      surface(
        out,
        'timber',
        [at(x - 0.38, mid, z), at(x + 0.38, mid, z), at(x + 0.38, hi, z), at(x - 0.38, hi, z)],
        palette.pile,
      );
    }
  }
}

function build(out, level) {
  const lod = levels[level];
  renderRampart(out, lod);
  section.ravelins.forEach((shape) => ravelin(out, shape, 4.35));
  ravelin(
    out,
    [
      [-284.82, -218.55],
      [-261.55, -216.23],
      [-227.01, -156.51],
      [-273.65, -146.27],
      [-302.63, -184.58],
    ],
    4.35,
  );
  ravelin(
    out,
    [
      [25.38, -281.45],
      [65.8, -246.85],
      [64.23, -200.87],
      [-1.41, -201.75],
      [-2.82, -243.93],
    ],
    4.6,
  );
  moles(out, lod);
  bridges(out, lod);
  section.surveyBuildings.forEach((room, i) => house(out, room, i, lod.houseDetails));
  section.townBlocks.slice(0, lod.blocks).forEach(([x, z, w, d, angle], i) => {
    const count = level === 0 ? 1 : level === 1 ? 2 : 3;
    for (let j = 0; j < count; j++) {
      const offset = ((j + 0.5) / count - 0.5) * w;
      const size = w / count - 3;
      house(
        out,
        [
          x + Math.cos(angle) * offset,
          z + Math.sin(angle) * offset,
          size,
          d * (0.46 + 0.065 * (j % 2)),
          angle,
        ],
        i + j,
        lod.houseDetails,
      );
    }
  });
}

export const fortSkyline = (out) => build(out, 0);
export const fortDistrict = (out) => build(out, 1);
export const fortStreet = (out) => build(out, 2);
export const fortCloseup = (out) => build(out, 3);
const recipe = 'taganrog-fortress-model.mjs';
const lookAt = [4, -8, 75];
const camera = [503, 628, 820];
const terrain = {
  descriptor: 'terrain-review.terrain.json',
  heightmap: 'terrain-review.height.png',
};
export const fortModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  category: 'landmark',
  wikidataId: 'Q7675155',
  build: fortCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'Cape-top ground and modern water level come from the original elevation field. The historic above-ground silhouette is aligned to the third-bastion site.',
  brief:
    'The 1704 Taganrog Fortress as shown by its as-built survey, with earth fronts, four ravelins, low town buildings, timber bridges and stone harbor moles.',
  camera,
  lookAt,
  sunDirection: [-42, 70, -53],
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  mediumFiContext: { scale: 1, groundY: -0.15, terrain },
  qaCameras: [
    { name: 'four-fronts-and-ravelins', position: [1, 630, -714], lookAt: [-8, -4, -45] },
    { name: 'dry-ditch-and-covered-way', position: [147, 48, -377], lookAt: [88, 7, -203] },
    { name: 'landward-bridge', position: [-342, 39, -247], lookAt: [-335, 0, -207] },
    { name: 'harbor-moles-and-quays', position: [430, 331, 674], lookAt: [19, -36, 482] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'taganrog-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'fortSkyline',
    errorMeters: 4.2,
    surfaces,
    authoredLevels: {
      district: { export: 'fortDistrict', errorMeters: 2.2, surfaces },
      street: { export: 'fortStreet', errorMeters: 0.72, surfaces },
      closeup: { export: 'fortCloseup', errorMeters: 0.21, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The 1704 RGADA engineering sheet and Robert Lyall’s 1825 plate are public domain. OpenStreetMap controls are ODbL 1.0.',
};
