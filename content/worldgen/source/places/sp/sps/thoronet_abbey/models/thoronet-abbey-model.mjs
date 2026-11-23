import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const parts = JSON.parse(
  fs.readFileSync(new URL('../native-map/thoronet-building-parts.json', import.meta.url)),
).features;
const { foundation, floor } = plan.dimensions;
const churchFootprint = frame.geometry.outline;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95 },
  dressed: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.96 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.77 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.88 },
};
const ashlar = rgb('a39177');
const dressed = rgb('ae9e82');
const base = rgb('8f7f69');
const tile = rgb('8f6757');
const stoneRoof = rgb('8a8577');
const shadow = rgb('4f483c');
const oak = rgb('77614f');
const gallery = [
  [-29.61, -13.16],
  [-32.75, -36.57],
  [-10.58, -39.21],
  [-10.34, -13.15],
];
const grade = (z) => 0.82 + z * 0.072;
const south = (x, z) => facade([x, z], [1, 0]);
const west = (x, z) => facade([x, z], [0, 1]);

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function aperture(out, F, u, y, w, h, lod, door = false) {
  opening(out, F, u, y, w, h, {
    glassSlot: door ? 'timber' : 'dark',
    frameSlot: 'dressed',
    head: 'round',
    glass: door ? oak : shadow,
    frame: dressed,
    d: 0.034,
    sill: lod > 2 && !door,
    frameWidth: lod === 3 ? 0.12 : 0,
    frameDepth: 0.16,
  });
}
function monoRoof(out, F, width, eave, ridge, depth) {
  quad4(
    out,
    'roof',
    F.P(-width / 2, eave, 0.22),
    F.P(width / 2, eave, 0.22),
    F.P(width / 2, ridge, -depth),
    F.P(-width / 2, ridge, -depth),
    tile,
  );
}
function apsidalEnd(out, lod) {
  const ring = outwardRing(churchFootprint.slice(6, 15));
  const low = 8.16,
    top = [7.51, 12.72, -0.68];
  extrude(out, 'wall', ring, floor, low, ashlar, { top: false });
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      F = wallFace(a, b);
    tri(out, 'roof', F.P(-0.07, low, 0.13), F.P(F.length + 0.07, low, 0.13), top, tile);
    if (F.normal[0] > 0.29 && i % 2 === 0) aperture(out, F, F.length / 2, 3.71, 0.51, 2.95, lod);
  }
}
function bellTower(out, lod) {
  const x = 1.55,
    z = -0.63,
    w = 4.74,
    lo = 13.71,
    top = 22.28,
    peak = 31.18;
  const ring = [
    [x - w / 2, z + w / 2],
    [x + w / 2, z + w / 2],
    [x + w / 2, z - w / 2],
    [x - w / 2, z - w / 2],
  ];
  extrude(out, 'wall', ring, lo, top, ashlar, { top: false });
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      F = wallFace(a, b);
    if (lod > 0) fbox(out, 'dressed', F, 0, w, top - 0.32, top, 0.006, 0.18, dressed);
    aperture(out, F, w / 2, top - 5.19, 1.49, 3.89, lod);
    tri(out, 'dressed', [a[0], top, a[1]], [b[0], top, b[1]], [x, peak, z], stoneRoof);
  }
  beam(out, 'dressed', [x, peak - 0.05, z], [x, peak + 1.1, z], 0.079, 0.082, stoneRoof);
  if (lod > 1)
    beam(
      out,
      'dressed',
      [x - 0.33, peak + 0.77, z],
      [x + 0.33, peak + 0.77, z],
      0.075,
      0.066,
      stoneRoof,
    );
}
function church(out, lod) {
  extrude(out, 'stone', churchFootprint, foundation, floor, base, { top: false });
  block(out, 'wall', -32.05, 7.67, -5.67, 5.93, floor, 14.36, ashlar);
  gableRoof(out, 'roof', [-31.98, -0.1], [7.71, -0.1], 11.51, 14.36, 16.72, tile, {
    overhang: 0.27,
    endSlot: 'wall',
    endColor: ashlar,
  });
  for (const side of [-1, 1]) {
    const ends = side < 0 ? [-9.11, -5.64] : [5.88, 9.27];
    block(out, 'wall', -32.03, -4.52, ...ends, floor, 8.71, ashlar);
    const F = side > 0 ? south(-18.24, 9.27) : facade([-18.24, -9.11], [-1, 0]);
    monoRoof(out, F, 27.67, 8.71, 10.24, 3.66);
    if (side > 0) {
      aperture(out, F, -4.34, 0.84, 1.92, 3.56, lod, true);
      if (lod > 0) aperture(out, F, 5.74, 3.32, 0.71, 1.98, lod);
    }
  }
  block(out, 'wall', -8.09, 7.82, -15.28, -5.48, floor, 9.54, ashlar);
  gableRoof(out, 'roof', [-8.17, -10.4], [7.82, -10.4], 9.8, 9.54, 12.09, tile, {
    overhang: 0.19,
    endSlot: 'wall',
    endColor: ashlar,
  });
  block(out, 'wall', -4.78, 7.66, 5.72, 14.37, floor, 9.49, ashlar);
  gableRoof(out, 'roof', [-4.82, 10.06], [7.71, 10.06], 8.62, 9.49, 12.29, tile, {
    overhang: 0.19,
    endSlot: 'wall',
    endColor: ashlar,
  });
  const F = west(-32.05, -0.1);
  aperture(out, F, 0, 0.89, 2.37, 4.09, lod, true);
  aperture(out, F, 0, 10.92, 1.66, 2.86, lod);
  if (lod > 0) for (const u of [-3.18, 3.18]) aperture(out, F, u, 5.13, 0.63, 2.04, lod);
  apsidalEnd(out, lod);
  bellTower(out, lod);
}

function arcadeSpandrel(out, F, u, y, half, top, depth, lod) {
  const points = roundArch(half, [3, 5, 8, 10][lod]);
  for (let i = 0; i < points.length - 1; i++) {
    const [a, ya] = points[i],
      [b, yb] = points[i + 1];
    const p = F.P(u + a, y + ya, 0),
      q = F.P(u + b, y + yb, 0);
    quad4(out, 'wall', p, q, F.P(u + b, top, 0), F.P(u + a, top, 0), ashlar);
    quad4(out, 'dressed', q, p, F.P(u + a, y + ya, -depth), F.P(u + b, y + yb, -depth), dressed);
  }
}
function cloister(out, lod) {
  const depth = 3.36;
  for (let i = 0; i < gallery.length; i++) {
    const a = gallery[i],
      b = gallery[(i + 1) % gallery.length],
      F = wallFace(a, b);
    const bays = Math.max(4, Math.round(F.length / 4.91)),
      span = F.length / bays;
    const y = grade((a[1] + b[1]) / 2);
    const eave = y + 5.47;
    fbox(out, 'stone', F, -0.31, F.length + 0.29, foundation, y + 0.86, -depth, 0.27, base);
    fbox(out, 'wall', F, -0.23, F.length + 0.21, y + 0.84, y + 4.13, -depth, -depth + 0.55, ashlar);
    const facing = facade(F.origin, F.along);
    quad4(
      out,
      'roof',
      facing.P(-0.29, eave, 0.31),
      facing.P(F.length + 0.29, eave, 0.31),
      facing.P(F.length + 0.29, eave + 0.76, -depth - 0.12),
      facing.P(-0.29, eave + 0.76, -depth - 0.12),
      tile,
    );
    fbox(out, 'dressed', F, 0, F.length, eave - 0.36, eave, 0, 0.14, dressed);
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + 0.5) * span;
      fbox(
        out,
        'wall',
        F,
        bay * span - 0.27,
        bay * span + 0.27,
        y + 0.82,
        eave - 0.28,
        -0.63,
        0,
        ashlar,
      );
      if (lod < 2) {
        const half = Math.min(1.4, span * 0.37);
        arcadeSpandrel(out, F, u, y + 2.49, half, eave - 0.29, 0.31, lod);
        continue;
      }
      const half = Math.min(0.79, span * 0.18);
      const offset = half + 0.092;
      for (const side of [-1, 1]) {
        arcadeSpandrel(out, F, u + side * offset, y + 2.45, half, y + 4.18, 0.55, lod);
        const outer = u + side * (offset + half);
        const end = u + side * (span / 2 - 0.22);
        fbox(
          out,
          'wall',
          F,
          Math.min(outer, end),
          Math.max(outer, end),
          y + 0.83,
          y + 4.17,
          -0.59,
          0,
          ashlar,
        );
      }
      fbox(out, 'dressed', F, u - 0.108, u + 0.108, y + 0.77, y + 2.56, -0.44, 0.051, dressed);
      fbox(out, 'dressed', F, u - 0.17, u + 0.17, y + 2.43, y + 2.58, -0.5, 0.083, dressed);
      const r = 0.21,
        v = y + 4.42;
      fbox(out, 'wall', F, bay * span, u - r, y + 4.155, eave - 0.31, -0.53, 0, ashlar);
      fbox(out, 'wall', F, u + r, (bay + 1) * span, y + 4.155, eave - 0.31, -0.53, 0, ashlar);
      const p = (alpha) => [u + Math.cos(alpha) * r, v + Math.sin(alpha) * r];
      for (const [sign, limit] of [
        [1, eave - 0.32],
        [-1, y + 4.154],
      ])
        for (let j = 0; j < 5; j++) {
          const [px, py] = p(sign * Math.PI * (1 - j / 5)),
            [qx, qy] = p(sign * Math.PI * (1 - (j + 1) / 5));
          const a = F.P(px, py),
            b = F.P(qx, qy),
            c = F.P(qx, limit),
            d = F.P(px, limit);
          if (sign > 0) quad4(out, 'dressed', a, b, c, d, dressed);
          else quad4(out, 'dressed', b, a, d, c, dressed);
        }
    }
    fbox(out, 'wall', F, F.length - 0.25, F.length + 0.25, y + 0.82, eave, -0.63, 0, ashlar);
  }
}

function chapterAndCellar(out, lod) {
  for (const [id, cap] of [
    ['155707607', 9.25],
    ['155707606', 7.87],
    ['155707602', 5.53],
  ]) {
    const ring = outwardRing(parts.find((row) => row.way.id === id).localRing);
    extrude(out, 'stone', ring, foundation, -3.0, base, { top: false });
    extrude(out, 'wall', ring, -3.0, cap, ashlar, { top: false });
    const xs = ring.map((p) => p[0]),
      zs = ring.map((p) => p[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs);
    gableRoof(
      out,
      'roof',
      [(x0 + x1) / 2, z0],
      [(x0 + x1) / 2, z1],
      x1 - x0,
      cap,
      cap + (id === '155707606' ? 2.7 : 1.92),
      tile,
      { overhang: 0.17, endSlot: 'wall', endColor: ashlar },
    );
    if (lod > 0) {
      for (let i = 0; i < ring.length; i++) {
        const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
        if (F.length < 8) continue;
        for (let j = 0; j < Math.floor(F.length / 4.8); j++)
          aperture(out, F, 2.46 + j * 4.67, cap - 4.06, 0.76, 2.23, lod);
      }
    }
  }
}
function lavabo(out, lod) {
  const x = -21.59,
    z = -34.12,
    y = grade(z);
  const rad = (h, r) => radialRing(h, r, r, 6, [x, z], Math.PI / 6);
  loft(out, 'wall', [rad(y - 0.28, 2.35), rad(y + 3.28, 2.35)], ashlar);
  loft(out, 'roof', [rad(y + 3.27, 2.67), rad(y + 5.11, 0.14)], tile);
  if (lod > 0) aperture(out, south(x, z + 2.04), 0, y + 0.14, 1.62, 2.78, lod);
}
function build(out, lod) {
  church(out, lod);
  chapterAndCellar(out, lod);
  cloister(out, lod);
  lavabo(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'thoronet-abbey-model.mjs';
const camera = [-88, 34, 63];
const lookAt = [-14, 9.0, -13];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Thoronet Abbey in Provence, with its limestone church and stone spire, single-storey paired cloister arcade, and attached dormitory wing.',
  camera,
  lookAt,
  sunDirection: [-31, 48, 28],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The individually mapped abbey church footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'abbey-church-and-stone-spire', position: camera, lookAt },
    { name: 'west-nave-and-south-aisle', position: [-52, 9, 23], lookAt: [-19, 9.3, -1] },
    { name: 'cloister-paired-arches-and-dormitory', position: [-47, 38, -58], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'thoronet-abbey-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
