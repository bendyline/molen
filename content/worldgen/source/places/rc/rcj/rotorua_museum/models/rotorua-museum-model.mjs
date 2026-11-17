/** Rotorua's former Bath House after the Centennial expansion, January 2016. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const {
  footprint,
  floorY,
  wingEavesY,
  wingRidgeY,
  frontTranseptEavesY,
  frontTranseptRidgeY,
  centerEavesY,
  centerRidgeY,
  centerSpireY,
  westProjectionCenters,
} = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.91, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.84, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.05 },
};
const tone = Object.fromEntries(
  Object.entries({
    plaster: 'dfc992',
    rear: 'd2be94',
    stone: '827773',
    trim: '51463c',
    shaded: '493d33',
    frame: '372e2a',
    terracotta: 'be7354',
    goldTile: 'c17a56',
    highTile: 'ba6e4c',
    glazing: '536768',
    transom: '7c8668',
    coloredGlass: 'a59779',
    awning: '4c443d',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const mix = (a, b, u) => a + (b - a) * u;
const skylineFootprint = footprint.filter(([x, z], i) => {
  const [ax, az] = footprint.at(i - 1);
  const [bx, bz] = footprint[(i + 1) % footprint.length];
  return (
    Math.abs((bx - ax) * (z - az) - (bz - az) * (x - ax)) > 0.12 * Math.hypot(bx - ax, bz - az)
  );
});

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const h = field.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function panel(out, material, x0, x1, y0, y1, z, color) {
  face(
    out,
    material,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}

function window(out, x, y, width, height, z, lod, transom = false) {
  const l = x - width / 2;
  const r = x + width / 2;
  const frame = lod === 0 ? 0.13 : 0.085;
  panel(out, 'timber', l - frame, r + frame, y - frame, y + height + frame, z, tone.frame);
  panel(out, 'metal', l, r, y, y + height, z + 0.008, tone.glazing);
  if (lod > 0) {
    const panes = Math.max(2, Math.round(width / (lod > 1 ? 0.46 : 1.12)));
    const railY = y + height * (transom ? 0.77 : 0.56);
    panel(out, 'timber', l, r, railY, railY + 0.06, z + 0.02, tone.frame);
    if (transom) panel(out, 'metal', l, r, railY + 0.065, y + height, z + 0.012, tone.transom);
    for (let i = 1; i < panes; i++) {
      const a = mix(l, r, i / panes);
      panel(out, 'timber', a - 0.035, a + 0.035, y, y + height, z + 0.02, tone.frame);
    }
  }
}

function strapping(out, x0, x1, y0, y1, z, lod, spacing = 0.94) {
  const count = Math.max(1, Math.round((x1 - x0) / spacing));
  const batten = lod === 0 ? 0.16 : 0.105;
  for (let i = 0; i <= count; i++) {
    const x = mix(x0 + batten, x1 - batten, i / count);
    panel(out, 'timber', x - batten, x + batten, y0, y1, z, tone.trim);
  }
}

function walls(out, lod) {
  const ring = lod === 0 ? skylineFootprint : footprint;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[(i + 1) % ring.length];
    const [x1, z1] = ring[i];
    const length = Math.hypot(x1 - x0, z1 - z0);
    const wall = transform(out, -Math.atan2(z1 - z0, x1 - x0), [x0, 0, z0]);
    face(
      wall,
      'foundation',
      [
        [0, ground(x0, z0) - 0.58, 0],
        [length, ground(x1, z1) - 0.58, 0],
        [length, floorY, 0],
        [0, floorY, 0],
      ],
      tone.stone,
    );
    panel(
      wall,
      'wall',
      0,
      length,
      floorY,
      wingEavesY + 0.03,
      0,
      z0 < -11 ? tone.rear : tone.plaster,
    );
    if (length < 0.8) continue;
    panel(wall, 'timber', 0, length, 3.28, 3.48, 0.027, tone.trim);
    panel(wall, 'timber', 0, length, 6.21, wingEavesY + 0.05, 0.032, tone.shaded);
    if (length < 2.75) continue;
    const front = z0 > 2.3 && z1 > 2.3 && x1 > x0;
    if (lod > 0 || front) {
      strapping(wall, 0, length, 3.45, 6.22, 0.021, lod, [2.6, 1.9, 1.12, 0.96][lod]);
      if (lod > 1) strapping(wall, 0, length, floorY, 3.29, 0.022, lod, 2.1);
    }
    if (length < 3.7 || (lod === 0 && !front)) continue;
    if (lod === 0) {
      const bays = Math.max(1, Math.round(length / 5.3));
      for (let j = 0; j < bays; j++) {
        const x = ((j + 0.5) * length) / bays;
        panel(wall, 'metal', x - 0.56, x + 0.56, 4.06, 5.85, 0.04, tone.glazing);
      }
      continue;
    }
    const bays = Math.max(1, Math.round(length / (front ? 2.75 : 3.65)));
    for (let j = 0; j < bays; j++) {
      const x = ((j + 0.5) * length) / bays;
      window(wall, x, 1.48, front ? 1.39 : 1.14, 1.58, 0.047, lod);
      window(wall, x, 4.11, front ? 1.47 : 1.22, 1.78, 0.05, lod, true);
    }
  }
}

// Gables facing local +Z. A rotated frame uses the same roof profile for the wing ridges.
function gabledRoof(out, x0, x1, z0, z1, eaves, ridge, lod, finish = tone.terracotta) {
  const x = (x0 + x1) / 2;
  const a = [x0, eaves, z0],
    b = [x0, eaves, z1];
  const c = [x1, eaves, z1],
    d = [x1, eaves, z0];
  const p = [x, ridge, z0],
    q = [x, ridge, z1];
  face(out, 'roof', [a, b, q, p], finish);
  face(out, 'roof', [p, q, c, d], tone.highTile);
  triangle(
    out,
    'wall',
    [
      [x0 + 0.25, eaves - 0.06, z1 - 0.2],
      [x1 - 0.25, eaves - 0.06, z1 - 0.2],
      [x, ridge - 0.23, z1 - 0.2],
    ],
    tone.plaster,
  );
  triangle(
    out,
    'wall',
    [
      [x1 - 0.25, eaves - 0.06, z0 + 0.2],
      [x0 + 0.25, eaves - 0.06, z0 + 0.2],
      [x, ridge - 0.23, z0 + 0.2],
    ],
    tone.rear,
  );
  if (lod > 1) {
    box(out, 'roof', [x - 0.09, ridge - 0.045, z0], [x + 0.09, ridge + 0.16, z1], tone.goldTile);
    const verge = (u, v) => beam(out, 'timber', u, v, 0.18, 0.12, tone.shaded);
    verge(b, q);
    verge(q, c);
    if (lod > 2) {
      verge(a, p);
      verge(p, d);
    }
  }
}

function wingRoof(out, x0, x1, z0, z1, eaves, ridge, lod) {
  gabledRoof(transform(out, -Math.PI / 2), z0, z1, -x1, -x0, eaves, ridge, lod);
}

function gableTimber(out, x, span, eaves, peak, z, lod) {
  const half = span * 0.5;
  panel(out, 'timber', x - half, x + half, eaves - 0.14, eaves + 0.12, z, tone.shaded);
  const rise = peak - eaves - 0.3;
  const studs = lod > 0 ? 7 : 3;
  for (let i = 1; i < studs; i++) {
    const ratio = (2 * i) / studs - 1;
    const a = x + ratio * half;
    panel(
      out,
      'timber',
      a - 0.08,
      a + 0.08,
      eaves,
      eaves + rise * (1 - Math.abs(ratio)),
      z,
      tone.trim,
    );
  }
  if (lod < 1) return;
  const brace = (a, b, width) =>
    beam(out, 'timber', [a[0], a[1], z + 0.025], [b[0], b[1], z + 0.025], width, 0.08, tone.shaded);
  brace([x, eaves + 0.2], [x - half * 0.44, eaves + rise * 0.49], 0.15);
  brace([x, eaves + 0.2], [x + half * 0.44, eaves + rise * 0.49], 0.15);
}

function lantern(out, x, z, base, height, radius, lod, principal = false) {
  const width = lod === 0 ? 5 : lod === 1 ? 6 : 8;
  const at = (y, r) =>
    radialRing(base + height * y, radius * r, radius * r, width, [x, z], Math.PI / 8);
  if (lod === 0 && !principal) {
    loft(out, 'timber', [at(0, 0.72), at(0.52, 0.72)], tone.trim, { cap: false });
    loft(out, 'roof', [at(0.52, 0.85), at(1, 0.07)], tone.terracotta, { cap: false });
    return;
  }
  loft(out, 'roof', [at(0, 1.06), at(0.28, 0.71)], tone.highTile, { cap: false });
  loft(out, 'timber', [at(0.27, 0.76), at(0.39, 0.76)], tone.shaded);
  const posts = lod === 0 ? 3 : lod === 1 ? 4 : 8;
  const w = radius * (lod > 1 ? 0.066 : 0.11);
  for (let i = 0; i < posts; i++) {
    const angle = (i / posts) * Math.PI * 2 + Math.PI / 8;
    const a = x + radius * 0.67 * Math.cos(angle);
    const b = z + radius * 0.67 * Math.sin(angle);
    if (lod < 2)
      panel(
        out,
        'timber',
        a - w,
        a + w,
        base + height * 0.37,
        base + height * 0.62,
        b,
        tone.shaded,
      );
    else
      box(
        out,
        'timber',
        [a - w, base + height * 0.37, b - w],
        [a + w, base + height * 0.62, b + w],
        tone.shaded,
      );
  }
  loft(out, 'roof', [at(0.61, 0.93), at(0.69, 0.61), at(0.96, 0.09)], tone.terracotta);
  if (lod > 0)
    box(
      out,
      'metal',
      [x - w, base + height * 0.94, z - w],
      [x + w, base + height, z + w],
      tone.shaded,
    );
  if (lod > 2) {
    loft(out, 'metal', [at(0.944, 0.11), at(0.961, 0.23), at(0.98, 0.1)], tone.shaded);
    loft(out, 'roof', [at(0.612, 0.951), at(0.637, 0.865)], tone.goldTile, { cap: false });
  }
}

function transept(out, x, lod) {
  const span = 8.85;
  const front = x > 0 ? 13.13 : 13.28;
  const eaves = frontTranseptEavesY;
  const ridge = frontTranseptRidgeY;
  gabledRoof(out, x - span / 2, x + span / 2, -8.6, front + 0.5, eaves, ridge, lod, tone.goldTile);
  panel(
    out,
    'wall',
    x - span / 2 + 0.25,
    x + span / 2 - 0.25,
    6.64,
    7.15,
    front + 0.09,
    tone.plaster,
  );
  gableTimber(out, x, span - 0.41, eaves, ridge, front + 0.32, lod);
  panel(out, 'timber', x - 2.7, x + 2.7, 6.48, 6.65, front + 0.14, tone.frame);
  window(out, x, 7.51, 2.45, 1.52, front + 0.33, lod, true);
  lantern(out, x, -2.2, ridge - 0.28, 3.2, 0.91, lod);
}

function dormer(out, x, lod) {
  const z = 3.35;
  const y = 7.32;
  gabledRoof(out, x - 1.44, x + 1.44, z - 4.4, z + 0.24, y + 1.29, 10.78, lod);
  panel(out, 'wall', x - 1.22, x + 1.22, y, y + 1.35, z + 0.03, tone.plaster);
  window(out, x, y + 0.13, 1.14, 0.98, z + 0.07, lod);
}

function center(out, lod) {
  const z = 7.39;
  box(
    out,
    'wall',
    [-8.36, wingEavesY - 0.13, -21.98],
    [8.36, centerEavesY + 0.04, z],
    tone.plaster,
  );
  gabledRoof(out, -8.83, 8.83, -22.36, 8.31, centerEavesY, centerRidgeY, lod);
  gableTimber(out, 0, 17.14, centerEavesY, centerRidgeY, 8.12, lod);
  const frontGable = 8.12;
  window(out, 0, 13.63, 3.38, 2.65, frontGable + 0.04, lod, false);
  panel(out, 'timber', -5.3, 5.3, 13.31, 13.52, frontGable + 0.03, tone.shaded);
  if (lod > 0) {
    const gableBand = (a, b, width) =>
      beam(out, 'timber', [a[0], a[1], 8.37], [b[0], b[1], 8.37], width, 0.12, tone.frame);
    for (const sign of [-1, 1]) gableBand([sign * 8.84, 12.07], [0, 20.79], 0.38);
    panel(out, 'timber', -8.68, 8.68, 11.94, 12.28, 8.19, tone.frame);
    if (lod > 1) {
      for (let x = -6.2; x <= 6.21; x += 1.04) {
        const direction = x < 0 ? -1 : 1;
        gableBand([x, 12.16], [x + direction * 0.57, 13.24], 0.115);
      }
      strapping(out, -2.92, 2.92, 16.36, 17.28, 8.19, lod, 0.44);
      panel(out, 'timber', -3.18, 3.18, 16.24, 16.43, 8.19, tone.frame);
      for (const sign of [-1, 1]) {
        gableBand([0, 16.44], [sign * 2.6, 17.9], 0.13);
        gableBand([0, 16.44], [sign * 1.23, 19.27], 0.12);
      }
    }
    strapping(out, -8.17, 8.17, 6.64, 11.95, z + 0.03, lod, 1.15);
    for (const x of [-5.65, 5.65]) {
      window(out, x, 5.5, 1.24, 4.98, z + 0.053, lod, true);
      if (lod > 1) {
        for (const y of [5.15, 10.65]) {
          for (const slope of [-1, 1]) {
            beam(
              out,
              'timber',
              [x - 1.27, y + slope * 0.31, z + 0.085],
              [x + 1.27, y - slope * 0.31, z + 0.085],
              0.085,
              0.06,
              tone.shaded,
            );
          }
        }
      }
    }
  }
  box(out, 'timber', [-4.14, 4.36, z - 0.13], [4.14, 11.79, 8.78], tone.trim);
  window(out, 0, 5.0, 7.59, 6.12, 8.79, lod, true);
  if (lod > 1)
    for (let i = 0; i < 15; i++) {
      const x = -3.5 + i * 0.5;
      panel(
        out,
        'metal',
        x - 0.13,
        x + 0.13,
        10.36,
        10.63,
        8.815,
        i % 2 ? tone.coloredGlass : tone.transom,
      );
    }
  box(out, 'metal', [-4.93, 3.93, z - 0.12], [4.93, 4.34, 10.3], tone.awning);
  for (const x of [-4.38, 4.38])
    box(out, 'timber', [x - 0.13, floorY, 9.83], [x + 0.13, 3.98, 10.09], tone.trim);
  window(out, 0, floorY + 0.06, 3.48, 2.85, 8.84, lod, true);
  const stairGround = Math.min(floorY - 0.22, ground(0, 12.15) + 0.05);
  const rise = Math.max(0.34, floorY - stairGround);
  const treads = lod === 0 ? 2 : 5;
  for (let i = 0; i < treads; i++) {
    const z0 = 8.72 + (3.46 * i) / treads;
    box(
      out,
      'foundation',
      [-2.21, stairGround - 0.44, z0],
      [2.21, floorY - (rise * i) / treads, z0 + 3.46 / treads],
      tone.stone,
    );
  }
  lantern(out, 0, 3.8, centerRidgeY - 0.37, centerSpireY - centerRidgeY + 0.37, 1.53, lod, true);
}

function build(out, lod) {
  walls(out, lod);
  for (const [left, right, back, front] of [
    [-43.54, -8.1, -23.84, 7.64],
    [8.1, 43.89, -24.07, 7.62],
    [-53.02, -40.25, -14.9, 3.36],
    [40.2, 53.0, -15.97, 3.78],
  ])
    wingRoof(out, left, right, back, front, wingEavesY + 0.1, wingRidgeY, lod);
  for (const x of westProjectionCenters) transept(out, x, lod);
  for (const x of [-19.6, -14.8, -10.3, 10.3, 14.8, 19.6]) dormer(out, x, lod);
  for (const x of [-47.93, -43.12, -21.44, 21.44, 43.12, 47.93]) {
    const z = Math.abs(x) > 44 ? -5.8 : -3.2;
    lantern(out, x, z, Math.abs(x) > 44 ? 11.27 : 9.74, 2.72, 0.68, lod);
  }
  center(out, lod);
}

export const rotoruaSkyline = (out) => build(out, 0);
export const rotoruaDistrict = (out) => build(out, 1);
export const rotoruaStreet = (out) => build(out, 2);
export const rotoruaCloseup = (out) => build(out, 3);
const recipe = 'rotorua-museum-model.mjs';
const camera = [-69, 36, 123];
const lookAt = [0, 9.1, -3];
export const rotoruaMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: rotoruaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former Rotorua Bath House after the Centennial extensions, with a broad west-facing half-timbered facade, glazed central entrance bay, paired north and south gables, and terracotta ridge lanterns.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [42, 58, 72],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'tile_ceramic',
    'metal_painted',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'west-front-and-centennial-wings', position: [0, 14, 128], lookAt: [0, 9, 0] },
    {
      name: 'central-multipane-bay-and-crown-lantern',
      position: [1, 15.7, 43],
      lookAt: [0, 14.7, 7.8],
    },
    { name: 'south-gables-and-ridge-lanterns', position: [49, 19, 44], lookAt: [29, 7.1, 4.2] },
    { name: 'rear-roof-junctions-and-extensions', position: [-69, 43, -104], lookAt: [1, 8.7, -7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'rotorua-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'rotoruaSkyline',
    errorMeters: 1.38,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'rotoruaDistrict', 0.36],
        ['street', 'rotoruaStreet', 0.11],
        ['closeup', 'rotoruaCloseup', 0.034],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Reference photos are photographer-dedicated public domain, and OpenStreetMap geometry is ODbL 1.0.',
};
