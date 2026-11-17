/** Late nineteenth-century exterior and vaulted stonework of Santo Domingo Cathedral. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  column,
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildHistoricNorthPortal } from './north-portal.mjs';
import { buildWestFront } from './west-front.mjs';

const read = (filename) => JSON.parse(readFileSync(new URL('../' + filename, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const terrain = read('terrain-grid.json');
const north = read('north-portal-controls.json');
const { floor, chapelEaves, outerRoofRise, nave, westFront, eastApse } = plan.section;
const mix = (a, b, t) => a + (b - a) * t;
const between = ([a, b], [c, d], t) => [mix(a, c, t), mix(b, d, t)];
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    return sum + x * zz - xx * z;
  }, 0);
const outward = (ring) => (area(ring) < 0 ? ring : [...ring].reverse());
const envelope = outward(map.features[0].points);
const walls = map.features.filter((f) => f.role === 'exterior-yard-enclosure').map((f) => f.points);
const apse = outward(eastApse);
const surveys = Object.freeze({
  aisleSpan: nave.width + 2 * nave.aisleWidth,
  mainHalf: nave.width / 2,
});
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  dress: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.08 },
  shadow: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    stone: 'b39e80',
    warm: 'c2ab8a',
    pale: 'cfb796',
    band: 'a39478',
    shade: '9b896d',
    roof: '987862',
    roofDarker: '895f51',
    window: '594b3e',
    glass: '686b60',
    vault: 'c3ae8b',
    rib: 'd6bc99',
    iron: '5e5143',
    wood: '6d5741',
    bare: 'a9a08d',
    base: 'ab9d81',
  }).map(([key, value]) => [key, rgb(value)]),
);

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[b][a], h[b][a + 1], u - a), mix(h[b + 1][a], h[b + 1][a + 1], u - a), v - b) -
    terrain.modelDatumElevationMeters
  );
}
function planarTriangles(outer, holes = []) {
  const raw = new MeshBufferBuilder();
  if (
    !raw.addCap(
      'roof',
      'palette:#ffffff',
      outer,
      holes,
      () => 0,
      [0, 1, 0],
      (p) => p,
      tint.roof,
    )
  )
    throw Error('Cathedral plan could not be triangulated');
  const mesh = raw.finalize();
  return Array.from(mesh.indices, (i) => [mesh.positions[i * 3], mesh.positions[i * 3 + 2]]);
}
function polygonCap(out, slot, points, height, color) {
  for (let i = 0; i < points.length; i += 3) {
    const ring = points.slice(i, i + 3);
    if (Math.abs(area(ring)) > 1e-5)
      triangle(
        out,
        slot,
        ring.map((p) => [p[0], height(p), p[1]]),
        color,
      );
  }
}
const coreCut = outward([
  [nave.west + 0.55, nave.axisZ - surveys.mainHalf + 0.24],
  [nave.east + 1.45, nave.axisZ - surveys.mainHalf + 0.24],
  [nave.east + 1.45, nave.axisZ + surveys.mainHalf - 0.24],
  [nave.west + 0.55, nave.axisZ + surveys.mainHalf - 0.24],
]);
const chapelsRoof = planarTriangles(envelope, [coreCut]);
const floorPlan = planarTriangles(envelope);
const rect = (out, slot, a, b, y0, y1, z, tone) =>
  face(
    out,
    slot,
    [
      [a, y0, z],
      [b, y0, z],
      [b, y1, z],
      [a, y1, z],
    ],
    tone,
  );
const edgeTransform = (out, a, b) =>
  transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);

function windowHead(out, x, y, half, rise, depth, color, count, pointed) {
  for (let i = 0; i < count; i++) {
    const at = (u) => {
      const arc = Math.cos(u * Math.PI);
      const h = pointed
        ? Math.sqrt(Math.max(0, 4 - Math.pow(1 + Math.abs(arc), 2))) / Math.sqrt(3)
        : Math.sin(u * Math.PI);
      return [x - half * arc, y + rise * h, depth];
    };
    triangle(out, 'shadow', [[x, y, depth], at((i + 1) / count), at(i / count)], color);
  }
}
function gothicWindow(out, x, y, w, h, lod, pointed = true) {
  const half = w / 2,
    rise = h * 0.34,
    spring = y + h - rise;
  rect(out, 'dress', x - half - 0.13, x + half + 0.13, y - 0.14, spring, 0.036, tint.pale);
  rect(out, 'shadow', x - half, x + half, y, spring + 0.005, 0.049, tint.window);
  windowHead(out, x, spring, half + 0.15, rise + 0.14, 0.036, tint.pale, 12, pointed);
  windowHead(out, x, spring, half, rise, 0.049, tint.window, 12, pointed);
  if (lod > 1) {
    rect(
      out,
      'shadow',
      x - half * 0.82,
      x + half * 0.82,
      y + 0.11,
      spring - 0.04,
      0.057,
      tint.glass,
    );
    rect(
      out,
      'iron',
      x - 0.037,
      x + 0.037,
      y + 0.11,
      spring + rise * (pointed ? 0.78 : 0.56),
      0.069,
      tint.iron,
    );
  }
}
function buttress(out, edgeX, floorY, top, depth, lod) {
  const base = 0.84,
    width = base / 2;
  box(out, 'stone', [edgeX - width, floorY, -0.21], [edgeX + width, top - 0.45, depth], tint.stone);
  if (lod > 1)
    box(
      out,
      'dress',
      [edgeX - width - 0.09, top - 0.68, -0.23],
      [edgeX + width + 0.09, top - 0.41, depth + 0.084],
      tint.pale,
    );
}

function boundaryWall(out, a, b, lod, { windowBays = 0, wasPorch = false } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.06) return;
  const facade = edgeTransform(out, a, b);
  const y = chapelEaves;
  const level0 = Math.min(floor - 0.05, ground(a) - 0.36),
    level1 = Math.min(floor - 0.05, ground(b) - 0.36);
  face(
    facade,
    'stone',
    [
      [0, level0, 0],
      [len, level1, 0],
      [len, floor + 0.67, 0],
      [0, floor + 0.67, 0],
    ],
    tint.base,
  );
  rect(facade, 'stone', 0, len, floor + 0.67, y, 0, tint.stone);
  if (lod === 0) return;
  rect(facade, 'dress', 0, len, y - 0.28, y + 0.01, 0.047, tint.band);
  if (windowBays === 0) return;
  for (let i = 0; i < windowBays; i++) {
    const w = ((i + 0.5) * len) / windowBays;
    gothicWindow(facade, w, wasPorch ? 5.63 : 5.28, 1.07, 2.82, lod);
    if (i !== 0 && lod > 1)
      buttress(facade, (i * len) / windowBays, Math.min(level0, level1), 7.67, 0.51, lod);
  }
}

function mappedEnvelope(out, lod) {
  for (let i = 0; i < envelope.length; i++) {
    const a = envelope[i],
      b = envelope[(i + 1) % envelope.length];
    const [x, z] = a,
      [xx, zz] = b;
    if (x < -27 && xx < -27 && Math.min(z, zz) < -15) {
      // The west front occupies this entire short edge. Preserve its exact ground skirt.
      const edge = edgeTransform(out, a, b);
      const length = Math.hypot(xx - x, zz - z);
      face(
        edge,
        'stone',
        [
          [0, ground(a) - 0.31, 0],
          [length, ground(b) - 0.31, 0],
          [length, floor - 0.04, 0],
          [0, floor - 0.04, 0],
        ],
        tint.base,
      );
      continue;
    }
    if (z < -16 && zz < -16) {
      const left = (north.center[0] - north.northPorchWidth / 2 - x) / (xx - x);
      const right = (north.center[0] + north.northPorchWidth / 2 - x) / (xx - x);
      const start = Math.min(left, right),
        end = Math.max(left, right);
      boundaryWall(out, a, between(a, b, start), lod, { windowBays: 2, wasPorch: true });
      boundaryWall(out, between(a, b, end), b, lod, { windowBays: 4, wasPorch: true });
      continue;
    }
    const length = Math.hypot(xx - x, zz - z);
    boundaryWall(out, a, b, lod, { windowBays: length > 28 ? 7 : length > 11 ? 2 : 0 });
  }
  polygonCap(out, 'dress', floorPlan, () => floor - 0.033, tint.bare);
}

function chapelRoof(out, lod) {
  const span = surveys.aisleSpan / 2;
  const pitch = ([x, z]) => {
    const dz = Math.abs(z - nave.axisZ);
    const p = Math.min(1, Math.max(0, (span + 7 - dz) / 11));
    const e = Math.min(1, Math.max(0, (x - nave.west + 2) / 8), Math.max(0, (30 - x) / 6));
    return chapelEaves + outerRoofRise * p * e;
  };
  const subdivide = (a, b, c, n) => {
    if (n === 0) {
      triangle(
        out,
        'roof',
        [a, b, c].map((p) => [p[0], pitch(p), p[1]]),
        tint.roof,
      );
      return;
    }
    for (const tri of [
      [a, between(a, b, 0.5), between(a, c, 0.5)],
      [between(a, b, 0.5), b, between(b, c, 0.5)],
      [between(a, c, 0.5), between(b, c, 0.5), c],
      [between(a, b, 0.5), between(b, c, 0.5), between(a, c, 0.5)],
    ])
      subdivide(...tri, n - 1);
  };
  for (let i = 0; i < chapelsRoof.length; i += 3) {
    const tri = chapelsRoof.slice(i, i + 3);
    if (Math.abs(area(tri)) > 1e-5) subdivide(...tri, lod > 0 ? 1 : 0);
  }
}

function upperNave(out, lod) {
  const { west, east, axisZ, eaves, ridge } = nave;
  const h = surveys.mainHalf;
  for (const sign of [-1, 1]) {
    const z = axisZ + sign * h;
    const a = sign === 1 ? [west, z] : [east, z],
      b = sign === 1 ? [east, z] : [west, z];
    const edge = edgeTransform(out, a, b),
      len = east - west;
    rect(edge, 'stone', 0, len, chapelEaves - 0.25, eaves, 0, tint.stone);
    if (lod > 0) {
      rect(edge, 'dress', 0, len, eaves - 0.23, eaves + 0.07, 0.055, tint.warm);
      for (let i = 0; i < nave.bays; i++)
        gothicWindow(edge, (len * (i + 0.5)) / nave.bays, 11.47, 0.86, 2.62, lod);
    }
    const p = [
      [west - 0.2, eaves, z + sign * 0.26],
      [east + 0.21, eaves, z + sign * 0.26],
      [east + 0.18, ridge, axisZ],
      [west - 0.22, ridge, axisZ],
    ];
    face(out, 'roof', sign === 1 ? p : [...p].reverse(), sign === 1 ? tint.roof : tint.roofDarker);
  }
  triangle(
    out,
    'dress',
    [
      [west, eaves, axisZ - h],
      [west, eaves, axisZ + h],
      [west, ridge, axisZ],
    ],
    tint.pale,
  );
  triangle(
    out,
    'dress',
    [
      [east, eaves, axisZ + h],
      [east, eaves, axisZ - h],
      [east, ridge, axisZ],
    ],
    tint.warm,
  );
  if (lod > 1)
    box(
      out,
      'roof',
      [west - 0.19, ridge - 0.05, axisZ - 0.09],
      [east + 0.17, ridge + 0.11, axisZ + 0.09],
      tint.roofDarker,
    );
}
function apseRoof(out, lod) {
  const [a, b] = [22.73, 0.62];
  const ring = (y, scale) => apse.map(([x, z]) => [mix(a, x, scale), y, mix(b, z, scale)]);
  loft(out, 'stone', [ring(chapelEaves - 0.1, 1), ring(13.15, 1)], tint.warm, { cap: false });
  loft(out, 'roof', [ring(13.15, 1.024), ring(15.58, 0.13)], tint.roofDarker);
  if (lod > 0)
    for (let i = 0; i < apse.length; i++) {
      const p = apse[i],
        q = apse[(i + 1) % apse.length],
        length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (p[0] < 20 || q[0] < 20 || length < 1.6) continue;
      const edge = edgeTransform(out, p, q);
      gothicWindow(edge, length / 2, 10.75, Math.min(1.19, length * 0.55), 1.95, lod);
    }
}

function vaults(out, lod) {
  const { west, east, axisZ, spring, keystone, bays } = nave;
  const len = (east - west) / bays;
  const height = (u) => Math.sqrt(Math.max(0, 4 - Math.pow(1 + Math.abs(u), 2))) / Math.sqrt(3);
  for (const { z, half, sill, head } of [
    { z: axisZ, half: surveys.mainHalf, sill: spring, head: keystone },
    {
      z: axisZ - surveys.mainHalf - nave.aisleWidth / 2,
      half: nave.aisleWidth / 2,
      sill: 7.12,
      head: 10.26,
    },
    {
      z: axisZ + surveys.mainHalf + nave.aisleWidth / 2,
      half: nave.aisleWidth / 2,
      sill: 7.12,
      head: 10.26,
    },
  ]) {
    for (let bay = 0; bay < bays; bay++) {
      const x = west + bay * len;
      const p = (u, v) => [
        x + (u + 1) * 0.5 * len,
        floor + sill + (head - sill) * Math.max(height(u), height(v)),
        z + v * half,
      ];
      const grid = lod === 3 ? 6 : 4;
      for (let i = 0; i < grid; i++)
        for (let j = 0; j < grid; j++) {
          const u = (i / grid) * 2 - 1,
            v = (j / grid) * 2 - 1,
            d = 2 / grid;
          face(out, 'stone', [p(u, v), p(u + d, v), p(u + d, v + d), p(u, v + d)], tint.vault);
        }
      for (const sign of [-1, 1]) {
        const line = Array.from({ length: lod === 3 ? 13 : 7 }, (_, i) => {
          const t = i / (lod === 3 ? 6 : 3) - 1;
          const [xx, y, zz] = p(t, sign * t);
          return [xx, y - 0.06, zz];
        });
        beamPath(out, 'dress', line, 0.13, 0.13, tint.rib);
      }
      const arch = Array.from({ length: 9 }, (_, i) => {
        const t = i / 4 - 1;
        const [xx, y, zz] = p(-1, t);
        return [xx, y - 0.075, zz];
      });
      beamPath(out, 'dress', arch, 0.17, 0.15, tint.rib);
    }
  }
  for (let i = 0; i <= bays; i++)
    for (const sign of [-1, 1])
      column(
        out,
        'dress',
        west + i * len,
        axisZ + sign * surveys.mainHalf,
        floor,
        floor + spring,
        0.43,
        tint.warm,
        lod === 3 ? 12 : 8,
      );
}

function enclosure(out, lod) {
  for (const line of walls)
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const edge = edgeTransform(out, a, b);
      const count = Math.max(1, Math.ceil(len / 9.2));
      for (let k = 0; k < count; k++) {
        const t = k / count,
          u = (k + 1) / count,
          y = ground(between(a, b, (t + u) / 2));
        box(edge, 'stone', [len * t, y - 0.55, -0.49], [len * u, y + 1.85, 0.42], tint.stone);
        if (lod > 1)
          box(edge, 'dress', [len * t, y + 1.79, -0.57], [len * u, y + 2.0, 0.49], tint.band);
      }
    }
}

function chapelInteriors(out, lod) {
  const west = nave.west - 0.27;
  const east = nave.east + 4.12;
  const half = surveys.aisleSpan / 2;
  const vaulted = floor + 10.51;
  const westWall = transform(out, Math.PI / 2, [west, 0, nave.axisZ]);
  rect(westWall, 'stone', -half, half, floor, floor + 14.88, 0, tint.vault);
  const eastWall = transform(out, -Math.PI / 2, [east, 0, nave.axisZ]);
  rect(eastWall, 'stone', -half, half, floor, floor + 14.68, 0, tint.vault);
  for (const side of [-1, 1]) {
    const z = nave.axisZ + side * half;
    const origin = side > 0 ? east : west;
    const interior = transform(out, side > 0 ? Math.PI : 0, [origin, 0, z]);
    const length = east - west;
    rect(interior, 'stone', 0, length, floor, vaulted, 0, tint.vault);
    rect(interior, 'dress', 0, length, floor + 0.06, floor + 0.38, 0.029, tint.band);
    for (let i = 0; i < nave.bays; i++) {
      const x = ((i + 0.5) * length) / nave.bays;
      gothicWindow(interior, x, floor + 1.83, 2.78, 5.08, lod);
      if (i > 0) buttress(interior, (i * length) / nave.bays, floor, floor + 7.7, 0.24, lod);
    }
    const innerClerestory = transform(out, side > 0 ? Math.PI : 0, [
      origin,
      0,
      nave.axisZ + side * (surveys.mainHalf - 0.025),
    ]);
    rect(innerClerestory, 'stone', 0, length, floor + 9.86, nave.eaves + 0.03, 0, tint.vault);
    for (let i = 0; i < nave.bays; i++)
      gothicWindow(innerClerestory, ((i + 0.5) * length) / nave.bays, 11.55, 0.72, 2.05, lod);
  }
  for (const side of [-1, 1]) gothicWindow(eastWall, side * 2.68, floor + 3.49, 1.33, 4.9, lod);
  gothicWindow(eastWall, 0, floor + 5.84, 1.58, 5.21, lod);
}
function build(out, lod) {
  mappedEnvelope(out, lod);
  chapelRoof(out, lod);
  upperNave(out, lod);
  apseRoof(out, lod);
  buildHistoricNorthPortal(
    transform(out, Math.PI, [north.center[0], 0, north.center[1]]),
    north,
    lod,
  );
  buildWestFront(
    transform(out, -Math.PI / 2, [westFront.x, 0, westFront.z]),
    westFront,
    floor,
    chapelEaves,
    lod,
  );
  enclosure(out, lod);
  if (lod > 1) {
    chapelInteriors(out, lod);
    vaults(out, lod);
  }
}

export const cathedralSkyline = (out) => build(out, 0);
export const cathedralDistrict = (out) => build(out, 1);
export const cathedralStreet = (out) => build(out, 2);
export const cathedralCloseup = (out) => build(out, 3);
const camera = [-102, 53, -92],
  lookAt = [-4, 7, 5];
const recipe = 'cathedral-of-santo-domingo-model.mjs';
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: cathedralCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Cathedral of Santo Domingo in 1899, with its three Gothic naves and ribbed vaults, limestone chapel elevations, Renaissance west front, and historic north clock and bell stage.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-38, 47, -49],
  mediumFiContext: {
    scale: 1,
    groundY: -1.28,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_limestone_raw',
    'tile_ceramic',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'parque-colon-and-the-historic-clock', position: [16, 13, -53], lookAt: [7, 9, -12] },
    { name: 'west-front-and-paired-doors', position: [-48, 6.6, -4.8], lookAt: [-26.5, 7.9, -2.4] },
    { name: 'gothic-nave-ribbed-vaults', position: [-21.4, 4.4, 0.4], lookAt: [6, 10, 0.83] },
    { name: 'apse-and-chapel-buttresses', position: [65, 26, 16], lookAt: [16.2, 9.1, 3.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.49,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'cathedralDistrict', 0.23],
        ['street', 'cathedralStreet', 0.099],
        ['closeup', 'cathedralCloseup', 0.039],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. The exact Qualla 1899 photograph and original March 1915 publication are public domain. Native OpenStreetMap geometry under ODbL 1.0.',
};
