import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  rgb,
  ribbon,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { footing, floor, porch, nave, east, cross, towers } = plan.dimensions;
const brick = rgb('824d3c');
const granite = rgb('b5aa91');
const mortar = rgb('9c8e78');
const slate = rgb('535956');
const glass = rgb('526261');
const louver = rgb('4d4b45');
const gold = rgb('c3a368');
const gate = rgb('493d32');
const surfaces = {
  bricks: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  roofing: { slot: 'roof', graph: 'tile_flat', roughness: 0.87 },
  dress: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69 },
  portals: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.87 },
};
const block = (out, slot, x0, x1, z0, z1, y0, y1, color) =>
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
const westFace = (x, z) => facade([x, z], [0, 1]);
const roof = (out, a, b, width, low, high) =>
  gableRoof(out, 'roofing', a, b, width, low, high, slate, {
    overhang: 0.25,
    endSlot: 'bricks',
    endColor: brick,
  });
function pointed(out, F, u, y, w, h, lod, { mullions = 0, kind = 'window' } = {}) {
  opening(out, F, u, y, w, h, {
    head: 'pointed',
    glassSlot: kind === 'door' ? 'portals' : 'glazing',
    frameSlot: 'dress',
    glass: kind === 'door' ? gate : kind === 'louver' ? louver : glass,
    frame: granite,
    d: 0.045,
    frameDepth: 0.15,
    frameWidth: lod > 1 ? 0.105 : 0,
    sill: lod > 1 && kind === 'window',
    mullions: lod > 0 ? mullions : 0,
  });
}
function disc(out, slot, F, u, y, r, d, c, n) {
  const circle = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return F.P(u + r * Math.cos(a), y + r * Math.sin(a), d);
  });
  fan(out, slot, circle, c);
}
function circularWindow(out, F, y, r, lod) {
  const n = lod > 1 ? 18 : 10;
  disc(out, 'dress', F, 0, y, r, 0.096, granite, n);
  disc(out, 'glazing', F, 0, y, r * 0.82, 0.115, glass, n);
  if (lod > 1) {
    const p = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI * i) / 3;
      return F.P(r * 0.74 * Math.cos(a), y + r * 0.74 * Math.sin(a), 0.145);
    });
    for (let i = 0; i < 6; i++) beam(out, 'dress', p[i], p[(i + 2) % 6], 0.052, 0.04, granite);
  }
}
function buttress(out, F, u, bottom, h, lod) {
  fbox(out, 'bricks', F, u - 0.4, u + 0.4, bottom, h * 0.57, -0.08, 0.62, brick);
  fbox(out, 'bricks', F, u - 0.29, u + 0.29, h * 0.56, h, -0.08, 0.37, brick);
  if (lod > 0) {
    fbox(out, 'dress', F, u - 0.44, u + 0.44, h * 0.57, h * 0.57 + 0.16, 0, 0.63, mortar);
    fbox(out, 'dress', F, u - 0.34, u + 0.34, h - 0.05, h + 0.12, 0, 0.46, mortar);
  }
}
function crossFinial(out, x, y, z, size) {
  block(out, 'dress', x - 0.06, x + 0.06, z - 0.06, z + 0.06, y - size, y, gold);
  block(
    out,
    'dress',
    x - 0.07,
    x + 0.07,
    z - size * 0.36,
    z + size * 0.36,
    y - size * 0.55,
    y - size * 0.42,
    gold,
  );
}
function westPorch(out, lod) {
  const p = porch;
  block(out, 'bricks', p.west, p.east, p.north, p.south, floor, p.eave, brick);
  roof(out, [p.west, p.center], [p.east, p.center], 3.55, p.eave, p.ridge);
  const face = westFace(p.west, p.center);
  pointed(out, face, 0, 0.72, 2.22, 4.89, lod, { kind: 'door' });
  for (const sign of [-1, 1]) {
    const z = p.center + sign * 2.85;
    roof(out, [p.west, z], [p.east - 0.02, z], 2.2, p.eave, 7.36);
    if (lod > 0) pointed(out, face, sign * 2.85, 1.77, 1.14, 3.85, lod, { mullions: 1 });
  }
  if (lod > 0) {
    for (const u of [-1.92, 1.92]) buttress(out, face, u, 0.49, 5.65, lod);
    for (let i = 0; i < 3; i++)
      block(
        out,
        'dress',
        p.west - 0.91 + 0.27 * i,
        p.west + 0.05,
        p.center - 1.43,
        p.center + 1.43,
        -0.08,
        0.19 * (i + 1),
        mortar,
      );
  }
  if (lod > 1) {
    for (const radius of [1.31, 1.46]) {
      const posts = [-radius, radius];
      for (const u of posts)
        fbox(out, 'dress', face, u - 0.08, u + 0.08, 0.78, 3.42, -0.01, 0.18, granite);
    }
  }
}
function church(out, lod) {
  const r = frame.geometry.outline;
  extrude(out, 'dress', r, footing, floor, mortar, { top: false });
  ribbon(out, 'dress', r, floor - 0.12, floor + 0.09, mortar, {
    offset: 0.04,
    minLength: 0.62,
    inset: 0,
  });
  block(
    out,
    'bricks',
    nave.west,
    nave.east,
    nave.north,
    nave.south,
    floor - 0.02,
    nave.eave,
    brick,
  );
  roof(
    out,
    [nave.west, nave.center],
    [nave.east, nave.center],
    nave.south - nave.north,
    nave.eave,
    nave.ridge,
  );
  block(
    out,
    'bricks',
    east.west,
    east.east,
    east.north,
    east.south,
    floor - 0.02,
    east.eave,
    brick,
  );
  const ec = (east.north + east.south) / 2;
  roof(out, [east.west, ec], [east.east, ec], east.south - east.north, east.eave, east.ridge);
  westPorch(out, lod);
  const facadeFront = westFace(nave.west, nave.center);
  pointed(out, facadeFront, 0, 8.12, 3.55, 5.35, lod, { mullions: 2 });
  for (const u of [-0.96, 0, 0.96])
    pointed(out, facadeFront, u, 14.88, 0.64, u === 0 ? 3.1 : 2.39, lod);
  const eastFace = facade([nave.east, nave.center], [0, -1]);
  pointed(out, eastFace, 0, 9.72, 3.8, 7.41, lod, { mullions: 3 });
  crossFinial(out, nave.west + 0.1, nave.ridge + 0.78, nave.center, 0.86);
  for (const transept of cross) {
    const sign = Math.sign(transept.end);
    const edge = sign < 0 ? nave.north : nave.south;
    const ridge = 18.85;
    block(
      out,
      'bricks',
      transept.x - transept.span / 2,
      transept.x + transept.span / 2,
      Math.min(0, transept.end),
      Math.max(0, transept.end),
      floor,
      nave.eave - 0.15,
      brick,
    );
    roof(
      out,
      [transept.x, sign * 4.75],
      [transept.x, transept.end],
      transept.span,
      nave.eave - 0.15,
      ridge,
    );
    const F = facade([transept.x, transept.end], [sign, 0]);
    circularWindow(out, F, 11.01, 1.46, lod);
    if (lod > 0) {
      for (const u of [-1.26, 1.26]) pointed(out, F, u, 3.19, 1.72, 5.54, lod, { mullions: 1 });
      for (const u of [-transept.span / 2 + 0.41, transept.span / 2 - 0.41])
        buttress(out, F, u, floor, 11.71, lod);
      const ln = transept.x - transept.span / 2,
        rn = transept.x + transept.span / 2;
      for (const side of [ln, rn]) {
        const w = side === ln;
        pointed(
          out,
          facade([side, (edge + transept.end) / 2], [0, w ? 1 : -1]),
          0,
          3.78,
          1.57,
          7.31,
          lod,
          { mullions: 1 },
        );
      }
    }
  }
  if (lod > 0) {
    for (const sign of [-1, 1]) {
      const edge = sign < 0 ? nave.north : nave.south;
      const F = facade([0, edge], [sign, 0]);
      for (const x of [-16.15, -11.65, -7.0, -2.37, 9.17, 13.29]) {
        pointed(out, F, x * sign, 3.84, 2.08, 7.33, lod, { mullions: 2 });
        if (x < 13) buttress(out, F, (x + 2.16) * sign, floor, 11.6, lod);
        if (lod > 1) {
          const innerZ = nave.center + sign * 4.6,
            outerZ = innerZ + sign * 0.77;
          const y = 16.32;
          block(
            out,
            'bricks',
            x - 0.56,
            x + 0.56,
            Math.min(innerZ, outerZ),
            Math.max(innerZ, outerZ),
            y - 0.45,
            y + 0.88,
            brick,
          );
          roof(out, [x, innerZ], [x, outerZ], 1.17, y + 0.87, y + 1.56);
          pointed(out, facade([x, outerZ], [sign, 0]), 0, y, 0.53, 0.99, lod, { kind: 'louver' });
        }
      }
    }
  }
}
function clock(out, F, y, lod) {
  fbox(out, 'dress', F, -1.38, 1.38, y - 1.35, y + 1.36, 0.012, 0.12, mortar);
  fbox(out, 'glazing', F, -1.24, 1.24, y - 1.2, y + 1.21, 0.125, 0.138, rgb('35342d'));
  disc(out, 'glazing', F, 0, y, 1.045, 0.151, rgb('44453d'), lod > 1 ? 24 : 12);
  if (lod === 0) return;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const x = Math.sin(a),
      z = Math.cos(a);
    beam(
      out,
      'dress',
      F.P(x * 0.85, y + z * 0.85, 0.169),
      F.P(x * 1.0, y + z, 0.172),
      0.051,
      0.04,
      gold,
    );
    if (lod === 3 && i % 3 === 0)
      beam(
        out,
        'dress',
        F.P(x * 0.85 + 0.08, y + z * 0.85, 0.17),
        F.P(x + 0.08, y + z, 0.17),
        0.04,
        0.03,
        gold,
      );
  }
  for (const [x, z] of [
    [-0.52, 0.44],
    [0.56, 0.33],
  ])
    beam(out, 'dress', F.P(0, y, 0.18), F.P(x, y + z, 0.18), 0.055, 0.04, gold);
}
function tower(out, t, lod) {
  const half = t.width / 2;
  const x0 = t.x - half,
    x1 = t.x + half,
    z0 = t.z - half,
    z1 = t.z + half;
  block(out, 'bricks', x0, x1, z0, z1, floor, t.shoulder, brick);
  const levels = t.clock ? [5.76, 11.01, 15.38, 21.82] : [5.22, 9.64, 15.67];
  for (const y of levels) {
    const reach = y === levels.at(-1) ? 0.27 : 0.12;
    block(out, 'dress', x0 - reach, x1 + reach, z0 - reach, z1 + reach, y, y + 0.3, granite);
  }
  const front = westFace(x0, t.z);
  for (const [y, w, h] of [
    [1.17, 1.83, 3.55],
    [6.52, 0.86, 3.32],
    [t.clock ? 12.55 : 11.01, 0.82, 3.5],
  ]) {
    if (h === 3.55) pointed(out, front, 0, y, w, h, lod, { kind: 'door' });
    else for (const u of [-0.72, 0.72]) pointed(out, front, u, y, w, h, lod, { mullions: 1 });
  }
  const lateral = facade([t.x, t.clock ? z1 : z0], [t.clock ? 1 : -1, 0]);
  if (lod > 0) {
    for (const F of [front, lateral]) {
      for (const u of [-half + 0.26, half - 0.26])
        buttress(out, F, u, floor, t.shoulder - 0.83, lod);
    }
    for (const y of [2.96, 7.25, 12.24])
      pointed(out, lateral, 0, y, 1.39, 3.7, lod, { mullions: 1 });
  }
  if (t.clock) clock(out, front, 18.92, lod);
  const center = [t.x, t.z],
    radius = t.width * 0.57;
  const ring = (y, r) => radialRing(y, r, r, 8, center, Math.PI / 8);
  loft(
    out,
    'bricks',
    [ring(t.shoulder - 0.12, radius), ring(t.bellTop - 0.55, radius * 0.95)],
    brick,
    { cap: false },
  );
  loft(
    out,
    'dress',
    [
      ring(t.bellTop - 0.62, radius),
      ring(t.bellTop - 0.22, radius * 1.04),
      ring(t.bellTop + 0.03, radius * 0.95),
    ],
    granite,
    { cap: false },
  );
  loft(
    out,
    'roofing',
    [
      ring(t.bellTop - 0.01, radius * 0.95),
      ring(t.bellTop + 0.7, radius * 0.91),
      ring(t.tip - 1.07, 0.15),
    ],
    slate,
    { cap: false },
  );
  const faces = ring(0, radius * 0.99)
    .map(([x, , z]) => [x, z])
    .reverse();
  for (let i = 0; i < faces.length; i++) {
    const F = wallFace(faces[i], faces[(i + 1) % faces.length]);
    pointed(
      out,
      F,
      F.length / 2,
      t.shoulder + 0.74,
      Math.min(1.04, F.length * 0.56),
      t.bellTop - t.shoulder - 1.47,
      lod,
      { kind: 'louver', mullions: 1 },
    );
    if (lod > 1 && i % 2 === 0) {
      const middle = F.length / 2,
        v = t.bellTop + 0.25;
      for (const side of [-1, 1])
        beam(
          out,
          'dress',
          F.P(middle + side * 0.59, v, -0.16),
          F.P(middle, v + 1.57, -0.31),
          0.084,
          0.1,
          granite,
        );
    }
  }
  if (lod > 0) {
    for (const x of [x0 + 0.23, x1 - 0.23])
      for (const z of [z0 + 0.23, z1 - 0.23]) {
        loft(
          out,
          'dress',
          [
            radialRing(t.shoulder - 0.34, 0.39, 0.39, 4, [x, z], Math.PI / 4),
            radialRing(t.shoulder + 1.57, 0.31, 0.31, 4, [x, z], Math.PI / 4),
            radialRing(t.shoulder + 2.35, 0.07, 0.07, 4, [x, z], Math.PI / 4),
          ],
          granite,
          { cap: false },
        );
      }
  }
  crossFinial(out, t.x, t.tip, t.z, 1.22);
}
function build(out, lod) {
  church(out, lod);
  for (const t of towers) tower(out, t, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'belmont-abbey-north-carolina-model.mjs';
const camera = [-84, 39, 53];
const lookAt = [-5, 15, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Belmont Abbey’s cruciform brick basilica, with uneven octagonal spires, a clock on the southern tower, and a three-gabled west narthex.',
  camera,
  lookAt,
  sunDirection: [-24, 37, -12],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Only the individually mapped Abbey Basilica building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-spires-and-south-transept', position: camera, lookAt },
    { name: 'narthex-and-clock', position: [-68, 17, -1], lookAt: [-18, 18, 0] },
    { name: 'sacristy-crossing-and-nave', position: [69, 29, -49], lookAt: [7, 13, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'belmont-abbey-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.27,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.52, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
