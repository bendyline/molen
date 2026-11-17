/** Rockcliffe's delta-plan museum, visitor addition and separate reserve hangar. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildReserveHangar } from './reserve-hangar.mjs';

const read = (filename) => JSON.parse(readFileSync(new URL('../' + filename, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrain = read('terrain-grid.json');
const reserve = read('reserve-hangar-controls.json');
const section = plan.section;
const surfaces = {
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.87, metallic: 0.13 },
  metal: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.88, metallic: 0.09 },
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.95, metallic: 0 },
  paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.06 },
  glass: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.14 },
};
const tone = Object.fromEntries(
  Object.entries({
    pale: 'c2c8c6',
    gray: 'adb9bb',
    sill: 'cbd0cd',
    glass: '4f6971',
    darkGlass: '465a60',
    brightGlass: '617b82',
    trim: '8b9a9e',
    stone: 'aead9e',
    roof: 'ccd1cf',
    darkerRoof: 'aeb6b6',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((n, i) => mix(n, b[i], t));
const xyz = ([x, z], y) => [x, y, z];
const rings = new Map(frame.features.map(({ role, points }) => [role, points]));

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

const signedArea = (points) =>
  points.reduce((sum, [x, z], i) => {
    const [a, b] = points[(i + 1) % points.length];
    return sum + x * b - a * z;
  }, 0);
const outward = (points) => (signedArea(points) > 0 ? points : points.toReversed());

function topTriangles(ring) {
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
      tone.roof,
    )
  )
    throw Error('Museum outline could not be triangulated');
  const { indices, positions } = mesh.finalize();
  return Array.from({ length: indices.length / 3 }, (_, i) =>
    Array.from(indices.slice(i * 3, i * 3 + 3), (j) => [positions[3 * j], positions[3 * j + 2]]),
  ).filter((p) => Math.abs(signedArea(p)) > 0.00005);
}
const parts = [
  ['main-museum-and-visitor-addition', section.mainFloor, section.mainLowerEave],
  ['adjacent-attached-service-hangar', section.serviceFloor, section.serviceEave],
  ['mapped-auditorium-part', section.mainFloor, 7.95],
].map(([role, floor, eave]) => {
  const ring = outward(rings.get(role));
  return { role, ring, floor, eave, top: topTriangles(ring) };
});

function mappedLowWing(out, { role, ring, floor, eave, top }, lod) {
  const museum = role === 'main-museum-and-visitor-addition';
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const cut = (p) => Math.min(floor - 0.36, ground(p) - 0.83);
    const upper = floor + eave;
    face(
      out,
      'concrete',
      [xyz(b, cut(b)), xyz(a, cut(a)), xyz(a, floor + 0.22), xyz(b, floor + 0.22)],
      tone.stone,
    );
    face(
      out,
      museum ? 'concrete' : 'metal',
      [xyz(b, floor + 0.22), xyz(a, floor + 0.22), xyz(a, upper), xyz(b, upper)],
      tone.pale,
    );
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (lod === 0 || length < 2.8) continue;
    const side = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
    box(side, 'paint', [0.08, upper - 0.38, -0.22], [length - 0.08, upper - 0.19, 0.16], tone.sill);
    if (
      !museum &&
      role !== 'mapped-auditorium-part' &&
      length > 13 &&
      Math.min(a[1], b[1]) < -145
    ) {
      const middle = length / 2;
      box(
        side,
        'paint',
        [middle - 3.54, floor + 0.23, -0.11],
        [middle + 3.54, floor + 4.09, 0.01],
        tone.trim,
      );
      if (lod > 1)
        for (let j = 1; j < 6; j++) {
          const y = floor + j * 0.59;
          box(
            side,
            'metal',
            [middle - 3.39, y, -0.132],
            [middle + 3.39, y + 0.035, -0.108],
            tone.gray,
          );
        }
    }
  }
  for (const f of top)
    triangle(
      out,
      'roof',
      f.map((p) => xyz(p, floor + eave)),
      tone.darkerRoof,
    );
}

const delta = outward(section.deltaDeck);
const deck = topTriangles(delta);
const deltaBase = section.mainFloor + section.mainLowerEave - 0.2;
const heightAt = ([, z]) =>
  mix(
    section.deltaAirsideEave,
    section.deltaWestEave,
    Math.max(0, Math.min(1, (-z - 13.81) / 124)),
  );
const roofPoint = (p) => xyz(p, section.mainFloor + heightAt(p));

function deltaHall(out, lod) {
  for (let i = 0; i < delta.length; i++) {
    const a = delta[i],
      b = delta[(i + 1) % delta.length];
    if (Math.abs(a[1] - b[1]) < 0.1) continue;
    face(
      out,
      'metal',
      [xyz(b, deltaBase), xyz(a, deltaBase), roofPoint(a), roofPoint(b)],
      tone.gray,
    );
  }
  for (const f of deck) triangle(out, 'roof', f.map(roofPoint), tone.roof);
  const [a, b] = section.deltaDeck;
  const eave = section.mainFloor + section.deltaAirsideEave;
  const lower = deltaBase;
  const z = a[1];
  const limit = [a[0], b[0]];
  const panel = (slot, x1, x2, y1, y2, depth, tint) =>
    face(
      out,
      slot,
      [
        [x1, y1, z + depth],
        [x2, y1, z + depth],
        [x2, y2, z + depth],
        [x1, y2, z + depth],
      ],
      tint,
    );
  panel('metal', ...limit, lower, eave, 0, tone.pale);
  panel('paint', ...limit, eave - 0.23, eave + 0.055, 0.18, tone.sill);
  const sill = eave - 5.28;
  const width = (b[0] - a[0] - 5.7) / section.clerestoryBays;
  for (let i = 0; i < section.clerestoryBays; i++) {
    const x = a[0] + 2.85 + width * (i + 0.5);
    const bottom = width * 0.398,
      top = width * 0.236;
    const y0 = sill + 0.35,
      y1 = eave - 0.58;
    face(
      out,
      'glass',
      [
        [x - bottom, y0, z + 0.09],
        [x + bottom, y0, z + 0.09],
        [x + top, y1, z + 0.09],
        [x - top, y1, z + 0.09],
      ],
      i % 4 === 0 ? tone.brightGlass : tone.darkGlass,
    );
    if (lod < 2) continue;
    for (const y of [0.32, 0.65]) {
      const span = mix(bottom, top, y) - 0.1;
      const mid = mix(y0, y1, y);
      panel('paint', x - span, x + span, mid - 0.035, mid + 0.035, 0.114, tone.trim);
    }
    for (const f of [-0.41, 0, 0.41])
      face(
        out,
        'paint',
        [
          [x + f * bottom - 0.043, y0, z + 0.12],
          [x + f * bottom + 0.043, y0, z + 0.12],
          [x + f * top + 0.043, y1, z + 0.12],
          [x + f * top - 0.043, y1, z + 0.12],
        ],
        tone.trim,
      );
  }
  panel('paint', ...limit, sill - 0.05, sill + 0.14, 0.13, tone.sill);
  panel('glass', 12, 145, deltaBase + 0.23, deltaBase + 1.31, 0.105, tone.glass);
  face(
    out,
    'glass',
    [
      [-29, section.mainFloor + 0.7, z + 0.18],
      [75, section.mainFloor + 0.7, z + 0.18],
      [75, section.mainFloor + 2.38, z + 0.18],
      [-27, section.mainFloor + 2.38, z + 0.18],
    ],
    tone.darkGlass,
  );
  if (lod > 1)
    for (let x = -27; x < 145; x += 3.9) {
      if (x > 12)
        panel('paint', x - 0.055, x + 0.055, deltaBase + 0.21, deltaBase + 1.34, 0.14, tone.sill);
      if (x < 75)
        panel(
          'paint',
          x - 0.06,
          x + 0.06,
          section.mainFloor + 0.7,
          section.mainFloor + 2.39,
          0.22,
          tone.sill,
        );
    }
}

function entrance(out, lod) {
  const { center, width, canopyProjection, height } = section.entryElevation;
  const [x, z] = center;
  const floor = section.mainFloor;
  const w = width / 2;
  const front = transform(out, 0, [x, 0, z]);
  box(
    front,
    'concrete',
    [-w - 1.3, floor - 0.42, -canopyProjection - 0.93],
    [w + 1.3, floor + 0.02, 0.31],
    tone.stone,
  );
  box(front, 'glass', [-w, floor + 0.12, -0.21], [w, floor + height, 0.14], tone.glass);
  box(
    front,
    'roof',
    [-w - 0.38, floor + height, -canopyProjection],
    [w + 0.38, floor + height + 0.53, 1.52],
    tone.sill,
  );
  for (const p of [-w + 0.34, w - 0.34])
    box(
      front,
      'paint',
      [p - 0.15, floor + 0.01, -canopyProjection + 0.24],
      [p + 0.15, floor + height, -canopyProjection + 0.54],
      tone.trim,
    );
  if (lod > 0) {
    for (let i = 1; i < 11; i++) {
      const q = mix(-w, w, i / 11);
      box(
        front,
        'paint',
        [q - 0.045, floor + 0.21, -0.27],
        [q + 0.045, floor + height, -0.18],
        tone.sill,
      );
    }
    box(front, 'paint', [-w, floor + 2.86, -0.29], [w, floor + 2.97, -0.19], tone.trim);
  }
}

function build(out, lod) {
  for (const part of parts) mappedLowWing(out, part, lod);
  deltaHall(out, lod);
  entrance(out, lod);
  buildReserveHangar(
    out,
    {
      ring: rings.get('reserve-hangar'),
      floor: section.reserveFloor,
      ground,
      controls: reserve,
    },
    lod,
  );
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const camera = [218, 150, 247],
  lookAt = [10, 5, -39];
const recipe = 'canada-aviation-and-space-museum-model.mjs';
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: museumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Canada Aviation and Space Museum at Rockcliffe Airport in April 2024, with its delta exhibition hangar, low visitor and theater addition and separate curved-roof aircraft reserve hangar.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-57, 62, 88],
  mediumFiContext: {
    scale: 1,
    groundY: -1.43,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_standing_seam',
    'metal_corrugated',
    'concrete_panel',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'airside-delta-clerestory', position: [80, 24, 42], lookAt: [28, 8, -17] },
    { name: 'lobby-and-auditorium', position: [-97, 10, -155], lookAt: [-46, 3.6, -104] },
    { name: 'reserve-hangar-aircraft-doors', position: [-26, 20, 175], lookAt: [-53, 8, 82] },
    { name: 'reserve-hangar-raked-curtain-wall', position: [33, 13, 27], lookAt: [-56, 8, 52] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ottawa-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.49,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.22],
        ['street', 'museumStreet', 0.09],
        ['closeup', 'museumCloseup', 0.034],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Used Qualla photos are creator-released Public domain or CC0. Native OpenStreetMap geometry under ODbL 1.0.',
};
