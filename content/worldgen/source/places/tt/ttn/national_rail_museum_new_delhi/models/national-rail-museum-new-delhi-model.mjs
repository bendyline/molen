/** The fixed buildings and rail infrastructure at New Delhi's National Rail Museum. */
import { readFileSync } from 'node:fs';
import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { railYardCanopy } from './rail-yard-canopies.mjs';
import { buildRailLine, buildTurntable } from './rail-yard-tracks.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrain = read('terrain-grid.json');
const { canopies } = read('canopy-controls.json');
const section = plan.section;
const feature = new Map(frame.features.map((f) => [f.id, f]));
const nativeRing = feature.get(section.turntable.ring).points.slice(0, -1);
const turntable = feature.get(section.turntable.point).points[0];
const canopySidings = new Set(canopies.map((r) => r.siding));

const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  canopy: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.77, metallic: 0.16 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.1 },
  ballast: { slot: 'trim', graph: 'gravel', roughness: 0.96, metallic: 0 },
  steel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.69, metallic: 0.05 },
};
const color = Object.fromEntries(
  Object.entries({
    brick: 'ad785f',
    red: '94624e',
    lightBrick: 'ad846a',
    concrete: 'b9aa94',
    buff: 'cabea8',
    coping: 'ad9c86',
    roof: '9a9587',
    roofTrim: '8d8474',
    cafe: 'bba793',
    shade: '494c46',
    window: '616761',
    inside: '3e4039',
    green: '586257',
    stone: 'a58d73',
    panel: '746659',
  }).map(([k, v]) => [k, rgb(v)]),
);

const mix = (a, b, t) => a + (b - a) * t;
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    return sum + x * zz - xx * z;
  }, 0);
const outward = (ring) => (area(ring) < 0 ? ring : [...ring].reverse());
const center = (ring) =>
  ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function layer(ring, y, scale = 1) {
  const [x, z] = center(ring);
  return ring.map(([a, b]) => [mix(x, a, scale), y, mix(z, b, scale)]);
}
function slab(out, slot, ring, y, tint) {
  const c = center(ring);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length];
    triangle(
      out,
      slot,
      [
        [p[0], y, p[1]],
        [q[0], y, q[1]],
        [c[0], y, c[1]],
      ],
      tint,
    );
  }
}
function rect(out, slot, x0, x1, y0, y1, z, tint) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}
function jamb(out, x, y, w, h, lod, door = false) {
  rect(
    out,
    'stone',
    x - w / 2 - 0.09,
    x + w / 2 + 0.09,
    y - 0.1,
    y + h + 0.13,
    0.025,
    color.concrete,
  );
  rect(out, 'steel', x - w / 2, x + w / 2, y, y + h, 0.044, door ? color.inside : color.window);
  if (lod > 1) {
    const n = door ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const at = x + w * ((i + 1) / (n + 1) - 0.5);
      rect(out, 'metal', at - 0.033, at + 0.033, y, y + h, 0.054, color.shade);
    }
    const rail = y + h * (door ? 0.77 : 0.49);
    rect(out, 'metal', x - w / 2, x + w / 2, rail - 0.032, rail + 0.032, 0.054, color.shade);
  }
}

function edgeFrame(out, p, q) {
  return transform(out, -Math.atan2(q[1] - p[1], q[0] - p[0]), [p[0], 0, p[1]]);
}
function facade(out, ring, floor, eave, lod, { frontal = -1, main = false, cafe = false } = {}) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const edge = edgeFrame(out, a, b),
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    face(
      edge,
      'stone',
      [
        [0, ground(a) - 0.52, 0],
        [length, ground(b) - 0.52, 0],
        [length, floor + 0.03, 0],
        [0, floor + 0.03, 0],
      ],
      color.stone,
    );
    rect(
      edge,
      cafe ? 'stone' : 'brick',
      0,
      length,
      floor,
      eave,
      0,
      cafe ? color.cafe : main ? color.brick : color.lightBrick,
    );
    if (lod === 0) continue;
    rect(edge, 'stone', 0, length, eave - 0.32, eave, 0.028, color.coping);
    if (i === frontal) {
      entry(out, edge, length, floor, eave, lod, main);
      continue;
    }
    if (length < 1.7) continue;
    const count = main ? 3 : cafe ? 1 : Math.max(1, Math.round(length / 5.25));
    for (let j = 0; j < count; j++) {
      const x = length * ((j + 0.5) / count);
      const width = Math.min((length / count) * 0.62, main ? 2.06 : cafe ? 1.84 : 1.16);
      jamb(edge, x, floor + (main ? 2.56 : 1.02), width, main ? 1.51 : cafe ? 2 : 1.06, lod);
      if (lod > 1 && main && j < count - 1) {
        const pier = length * ((j + 1) / count);
        box(
          edge,
          'brick',
          [pier - 0.145, floor + 0.07, -0.1],
          [pier + 0.145, eave, 0.17],
          color.red,
        );
      }
    }
  }
}

function entry(out, edge, length, floor, eave, lod, main) {
  const x = length / 2,
    w = main ? 6.7 : Math.min(length * 0.69, 2.35);
  jamb(edge, x, floor + 0.035, w * 0.69, main ? 3.52 : 2.31, lod, true);
  const roof = floor + (main ? 4.33 : 2.98);
  box(
    edge,
    'stone',
    [x - w / 2, roof - 0.25, -0.21],
    [x + w / 2, roof, main ? 3.12 : 1.42],
    color.buff,
  );
  if (lod < 2) return;
  for (const side of [-1, 1]) {
    const at = x + side * w * 0.44,
      z = main ? 2.76 : 1.11;
    box(
      edge,
      'stone',
      [at - 0.14, floor, z - 0.16],
      [at + 0.14, roof - 0.23, z + 0.16],
      color.concrete,
    );
  }
  const steps = main ? 4 : 2;
  for (let i = 0; i < steps; i++) {
    const depth = main ? 0.66 : 0.47;
    box(
      edge,
      'stone',
      [x - w / 2, floor - 1.3, i * depth],
      [x + w / 2, floor - i * 0.192, (i + 1) * depth],
      color.concrete,
    );
  }
  if (main)
    rect(
      edge,
      'steel',
      x - w * 0.39,
      x + w * 0.39,
      roof + 0.32,
      Math.min(eave - 0.48, roof + 1.02),
      0.065,
      color.panel,
    );
}

function gallery(out, lod) {
  const spec = section.gallery,
    native = feature.get(spec.id).points;
  const entryA = native[spec.entryEdge],
    entryB = native[spec.entryEdge + 1];
  const ring = outward(native);
  const frontal = ring.findIndex((p, i) => {
    const q = ring[(i + 1) % ring.length];
    return (p === entryA && q === entryB) || (p === entryB && q === entryA);
  });
  facade(out, ring, spec.floor, spec.eave, lod, { frontal, main: true });
  const rim = spec.eave + spec.parapet;
  loft(out, 'stone', [layer(ring, spec.eave, 1.012), layer(ring, rim, 1.012)], color.coping, {
    cap: false,
  });
  slab(out, 'stone', ring, rim - 0.026, color.roof);
  loft(
    out,
    'stone',
    [layer(ring, rim, 0.55), layer(ring, rim + 0.39, 0.55), layer(ring, rim + spec.roofRise, 0.32)],
    color.roofTrim,
  );
  if (lod > 1)
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length];
      const [x, z] = center(ring);
      const make = ([a, b], t, y) => [mix(x, a, t), y, mix(z, b, t)];
      face(
        out,
        'steel',
        [
          make(q, 0.551, rim + 0.06),
          make(p, 0.551, rim + 0.06),
          make(p, 0.551, rim + 0.32),
          make(q, 0.551, rim + 0.32),
        ],
        color.window,
      );
    }
}

function cafeteria(out, lod) {
  const spec = section.cafeteria,
    native = feature.get(spec.id).points,
    ring = outward(native);
  const edge = native[spec.entryEdge];
  facade(out, ring, spec.floor, spec.eave, lod, { frontal: ring.indexOf(edge), cafe: true });
  loft(
    out,
    'stone',
    [layer(ring, spec.eave, 1.039), layer(ring, spec.eave + 0.27, 1.039)],
    color.buff,
  );
  loft(
    out,
    'canopy',
    [layer(ring, spec.eave + 0.28, 1.02), layer(ring, spec.eave + spec.clerestoryRise, 0.28)],
    color.roof,
  );
}

function yardBuilding(out, ring, lod) {
  const levels = ring.map(ground).sort((a, b) => a - b);
  const floor = levels[Math.floor(levels.length / 2)] + 0.14;
  const eave = floor + 3.23;
  facade(out, ring, floor, eave, lod, { frontal: 0 });
  loft(out, 'canopy', [layer(ring, eave, 1.065), layer(ring, eave + 0.73, 0.41)], color.green);
}

function build(out, lod) {
  gallery(out, lod);
  cafeteria(out, lod);
  for (const item of frame.features) {
    if (item.role === 'mapped-service-building') yardBuilding(out, outward(item.points), lod);
    if (item.id === section.turntable.ring) continue;
    const isPreserved = item.role === 'museum-siding';
    if (isPreserved || item.role === 'visitor-train-track')
      buildRailLine(out, item.points, ground, lod, {
        gauge: isPreserved ? section.gaugeMeters.preserved : section.gaugeMeters.visitor,
        paved: canopySidings.has(item.id),
      });
  }
  buildTurntable(out, nativeRing, turntable, ground, lod);
  for (const canopy of canopies) railYardCanopy(out, canopy, ground, lod);
}

export const railMuseumSkyline = (out) => build(out, 0);
export const railMuseumDistrict = (out) => build(out, 1);
export const railMuseumStreet = (out) => build(out, 2);
export const railMuseumCloseup = (out) => build(out, 3);

const camera = [266, 213, -172];
const lookAt = [-9, 2, -4];
const recipe = 'national-rail-museum-new-delhi-model.mjs';
export const railMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: railMuseumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'National Rail Museum, New Delhi, with its octagonal Indoor Gallery, fixed rail yard, round turntable, curved steel display canopies and Rail Cafeteria.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [35, 39, 19],
  mediumFiContext: {
    scale: 1,
    groundY: -5.12,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'concrete_plain',
    'metal_corrugated',
    'metal_painted',
    'gravel',
  ],
  qaCameras: [
    { name: 'octagonal-indoor-gallery', position: [-65, 13, -103], lookAt: [-113, 4, -154] },
    {
      name: 'preserved-sidings-and-display-sheds',
      position: [-36, 7, -28],
      lookAt: [-10, 1.75, 10],
    },
    { name: 'turntable-bridge-and-track-fan', position: [112, 10, 124], lookAt: [83, -2, 106] },
    { name: 'rail-cafeteria', position: [-10, 7, -45], lookAt: [-39, 0.8, -60] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'rail-yard-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'railMuseumSkyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'railMuseumDistrict', 0.26],
        ['street', 'railMuseumStreet', 0.12],
        ['closeup', 'railMuseumCloseup', 0.049],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. Five exact October 2023 Qualla photographs by Historical Trains carry CC0 dedications. Native OpenStreetMap geometry under ODbL 1.0.',
};
