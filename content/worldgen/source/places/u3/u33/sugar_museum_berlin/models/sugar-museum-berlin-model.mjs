import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  masonry: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.94 },
  cutStone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.78 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
const plaster = rgb('b3a383');
const stone = rgb('835e4a');
const cap = rgb('aa8469');
const tile = rgb('69473b');
const darkerTile = rgb('604239');
const copper = rgb('74a79a');
const tintedCopper = rgb('537a70');
const pale = rgb('d4c9ad');
const amber = rgb('685242');
const glass = rgb('474c43');
const dark = rgb('41352d');
const center = -15.27;

function box(out, material, x0, x1, z0, z1, low, high, color) {
  abox(out, material, [x0, low, z0], [x1, high, z1], color, { bottom: false });
}

function window(out, edge, u, y, w, h, level, transom = 1) {
  opening(out, edge, u, y, w, h, {
    glassSlot: 'glass',
    glass,
    frameSlot: 'timber',
    frame: pale,
    frameWidth: level >= 2 ? 0.1 : 0.06,
    frameDepth: 0.055,
    sill: level >= 2,
    d: 0.026,
    mullions: level >= 2 ? (w > 1.55 ? 2 : 1) : 0,
    transoms: level >= 2 ? transom : 0,
    mullionColor: pale,
  });
}

function peakedWings(out, rectangle, mids, ridge, levels, color) {
  const [l, r, back, front] = rectangle;
  const [lMid, rMid, backMid, frontMid] = mids;
  const [lTop, rTop, ridgeZ] = ridge;
  const [y, middle, high] = levels;
  const rings = [
    [
      [l, y, front],
      [r, y, front],
      [r, y, back],
      [l, y, back],
    ],
    [
      [lMid, middle, frontMid],
      [rMid, middle, frontMid],
      [rMid, middle, backMid],
      [lMid, middle, backMid],
    ],
  ];
  const [bottom, knee] = rings;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(out, 'tile', bottom[i], bottom[j], knee[j], knee[i], color);
    const a = [...bottom[i]];
    const b = [...bottom[j]];
    a[1] -= 0.27;
    b[1] -= 0.27;
    quad4(out, 'cutStone', a, b, bottom[j], bottom[i], cap);
  }
  const a = [lTop, high, ridgeZ];
  const b = [rTop, high, ridgeZ];
  quad4(out, 'tile', knee[0], knee[1], b, a, color);
  tri(out, 'tile', knee[1], knee[2], b, darkerTile);
  quad4(out, 'tile', knee[2], knee[3], a, b, color);
  tri(out, 'tile', knee[3], knee[0], a, darkerTile);
  box(
    out,
    'tile',
    lTop - 0.08,
    rTop + 0.08,
    ridgeZ - 0.095,
    ridgeZ + 0.095,
    high - 0.025,
    high + 0.09,
    darkerTile,
  );
}

function archedPanel(out, edge, u, start, spring, top, half, depth, color, level) {
  const steps = level >= 2 ? 14 : 8;
  const at = (i, rise, r) => {
    const a = (i * Math.PI) / steps;
    return [u - r * Math.cos(a), spring + rise * Math.sin(a)];
  };
  const clear = [
    edge.P(u - half, start, depth),
    edge.P(u + half, start, depth),
    edge.P(u + half, spring, depth),
    edge.P(u - half, spring, depth),
  ];
  const kind = color === glass ? 'glass' : 'timber';
  quad4(out, kind, ...clear, color);
  for (let i = 0; i < steps; i++) {
    const [l, y] = at(i, top - spring, half),
      [r, h] = at(i + 1, top - spring, half);
    tri(out, kind, edge.P(u, spring, depth), edge.P(r, h, depth), edge.P(l, y, depth), color);
    if (level === 0) continue;
    const [L, Y] = at(i, top - spring + 0.13, half + 0.13),
      [R, H] = at(i + 1, top - spring + 0.13, half + 0.13);
    quad4(
      out,
      'cutStone',
      edge.P(l, y, depth + 0.015),
      edge.P(r, h, depth + 0.015),
      edge.P(R, H, depth + 0.015),
      edge.P(L, Y, depth + 0.015),
      cap,
    );
  }
  if (level === 0) return;
  for (const sign of [-1, 1]) {
    const a = u + sign * half;
    fbox(
      out,
      'cutStone',
      edge,
      a - 0.11,
      a + 0.11,
      start,
      spring,
      depth + 0.004,
      depth + 0.12,
      cap,
    );
  }
}

function dormer(out, x, faceZ, rearward, y, w, level) {
  const depth = 1.55;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const dz = rearward ? -1 : 1;
  const z0 = faceZ - dz * depth;
  box(
    out,
    'tile',
    x0,
    x1,
    Math.min(faceZ, z0),
    Math.max(faceZ, z0),
    y - 0.05,
    y + 1.14,
    darkerTile,
  );
  const F = facade([x, faceZ], [dz, 0]);
  window(out, F, 0, y + 0.12, w - 0.39, 0.82, level, 0);
  const zFront = faceZ + dz * 0.16;
  const [a, b] = [x0 - 0.16, x1 + 0.16];
  const zFar = z0 - dz * 0.15;
  if (rearward)
    quad4(
      out,
      'tile',
      [a, y + 1.54, zFar],
      [b, y + 1.54, zFar],
      [b, y + 1.07, zFront],
      [a, y + 1.07, zFront],
      tile,
    );
  else
    quad4(
      out,
      'tile',
      [a, y + 1.07, zFront],
      [b, y + 1.07, zFront],
      [b, y + 1.54, zFar],
      [a, y + 1.54, zFar],
      tile,
    );
}

function facadeBays(out, level) {
  const walls = outwardRing(frame.geometry.outline);
  for (const [index, p] of walls.entries()) {
    const F = wallFace(p, walls[(index + 1) % walls.length]);
    if (F.length < 3.65) continue;
    const street = F.normal[1] > 0.59;
    const count = Math.max(1, Math.round(F.length / (street ? 3.15 : 3.7)));
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * F.length) / count;
      const [x, , z] = F.P(u, 0);
      if (street && x > -18.6 && x < -11.1 && z > 5.3) continue;
      const w = street ? 1.86 : 1.58;
      for (const [y, h] of [
        [0.82, 2.15],
        [4.54, 3.48],
        [9.13, 3.56],
      ])
        window(out, F, u, y, w, h, level);
      if (level >= 2) {
        fbox(out, 'cutStone', F, u - w / 2 - 0.15, u + w / 2 + 0.15, 3.45, 3.6, 0.002, 0.17, cap);
        fbox(
          out,
          'cutStone',
          F,
          u - w / 2 - 0.12,
          u + w / 2 + 0.12,
          12.78,
          12.92,
          0.002,
          0.12,
          pale,
        );
      }
    }
  }
}

function towerFront(out, level) {
  const F = facade([center, 7.071], [1, 0]);
  const wx = 3.05;
  const base = 13.94;
  const peak = 19.52;
  const shoulder = 17.55;
  const scallop = [
    [-wx, shoulder],
    [-2.51, 18.11],
    [-1.69, 18.56],
    [-1.0, 19.11],
    [0, peak],
    [1.0, 19.11],
    [1.69, 18.56],
    [2.51, 18.11],
    [wx, shoulder],
  ];
  for (let i = 0; i + 1 < scallop.length; i++) {
    const [a, y] = scallop[i],
      [b, z] = scallop[i + 1];
    quad4(
      out,
      'plaster',
      F.P(a, base, 0.015),
      F.P(b, base, 0.015),
      F.P(b, z, 0.015),
      F.P(a, y, 0.015),
      plaster,
    );
    quad4(
      out,
      'cutStone',
      F.P(a, y - 0.17, 0.068),
      F.P(b, z - 0.17, 0.068),
      F.P(b, z + 0.04, 0.068),
      F.P(a, y + 0.04, 0.068),
      cap,
    );
  }
  box(out, 'plaster', center - wx, center + wx, 4.25, 7.057, base, shoulder - 0.02, plaster);
  lathe(
    out,
    'tile',
    [center, 3.02],
    [
      [17.25, 3.96, 3.95],
      [18.1, 3.93, 3.93],
      [19.3, 3.86, 3.78],
      [21.1, 3.36, 3.34],
      [22.1, 2.51, 2.5],
      [22.87, 1.92, 1.91],
    ],
    level < 2 ? 10 : 20,
    darkerTile,
  );
  lathe(
    out,
    'copper',
    [center, 3.02],
    [
      [22.68, 1.7, 1.7],
      [23.27, 1.66, 1.66],
      [23.5, 1.48, 1.48],
      [25.34, 1.44, 1.44],
      [25.55, 1.53, 1.53],
      [25.73, 1.38, 1.38],
      [26.38, 1.26, 1.26],
      [27.05, 0.98, 0.98],
      [27.57, 0.72, 0.72],
      [27.91, 0.45, 0.45],
      [28.48, 0.42, 0.42],
      [28.68, 0.24, 0.24],
      [29.05, 0.22, 0.22],
      [29.31, 0.11, 0.11],
      [29.63, 0.055, 0.055],
    ],
    level < 2 ? 10 : 20,
    copper,
    { capped: true },
  );
  if (level >= 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const [dx, dz] = [Math.cos(a), Math.sin(a)];
      const D = facade([center + dx * 1.42, 3.02 + dz * 1.42], [dz, -dx]);
      fbox(out, 'copper', D, -0.42, 0.42, 23.7, 25.2, -0.03, 0.13, tintedCopper);
      window(out, D, 0, 23.86, 0.48, 1.16, level, 0);
    }
    window(out, F, 0, 4.64, 3.29, 1.85, level, 0);
    window(out, F, 0, 8.18, 3.29, 3.31, level);
    archedPanel(out, F, 0, 12.66, 15.49, 17.32, 1.66, 0.053, glass, level);
    for (const x of [-0.96, 0, 0.96])
      fbox(out, 'timber', F, x - 0.045, x + 0.045, 12.72, 15.91, 0.06, 0.114, pale);
    fbox(out, 'timber', F, -1.65, 1.65, 15.4, 15.54, 0.056, 0.115, pale);
  }
  fbox(out, 'masonry', F, -2.7, 2.7, 0.02, 4.3, -0.11, 0.14, stone);
  fbox(out, 'cutStone', F, -2.33, 2.33, 3.79, 4.14, 0.073, 0.4, cap);
  for (const sign of [-1, 1]) {
    const a = sign * 1.73;
    fbox(out, 'cutStone', F, a - 0.26, a + 0.26, 0.3, 3.95, 0.1, 0.34, stone);
    fbox(out, 'cutStone', F, a - 0.36, a + 0.36, 0.33, 0.53, 0.1, 0.46, cap);
    fbox(out, 'cutStone', F, a - 0.36, a + 0.36, 3.66, 3.87, 0.1, 0.46, cap);
  }
  archedPanel(out, F, 0, 0.09, 1.85, 3.1, 1.18, 0.157, dark, level);
  if (level >= 2) {
    fbox(out, 'timber', F, -0.062, 0.062, 0.18, 2.95, 0.165, 0.19, amber);
    fbox(out, 'cutStone', F, -0.73, 0.73, 3.37, 3.69, 0.156, 0.34, cap);
    fbox(out, 'timber', F, -0.5, 0.5, 3.48, 3.57, 0.34, 0.36, dark);
  }
}

function build(out, level) {
  const outline = frame.geometry.outline;
  extrude(out, 'masonry', outline, -1.12, 3.62, stone, { top: false });
  extrude(out, 'plaster', outline, 3.62, 14.02, plaster, { top: false });
  extrude(out, 'cutStone', outline, 3.47, 3.66, cap, { top: false });
  peakedWings(
    out,
    [-29.57, -11.14, -9.65, 6.53],
    [-27.18, -12.62, -6.23, 3.55],
    [-23.05, -17.64, -1.61],
    [13.91, 19.31, 23.42],
    tile,
  );
  peakedWings(
    out,
    [-12.31, 21.18, -6.05, 5.25],
    [-11.55, 20.82, -4.45, 3.47],
    [-10.4, 20.2, -1.72],
    [13.83, 16.96, 19.39],
    darkerTile,
  );
  peakedWings(
    out,
    [19.58, 31.22, -8.34, 5.82],
    [21.47, 29.13, -6.07, 3.5],
    [23.65, 26.31, -1.38],
    [13.77, 17.35, 20.42],
    tile,
  );
  lathe(
    out,
    'tile',
    [19.19, -5.97],
    [
      [13.75, 2.96, 2.98],
      [14.59, 2.57, 2.77],
      [16.95, 2.1, 2.42],
      [19.72, 0.14, 0.19],
    ],
    level < 2 ? 10 : 20,
    darkerTile,
  );
  towerFront(out, level);
  if (level === 0) return;
  facadeBays(out, level);
  dormer(out, -23.46, 4.8, false, 16.26, 4.65, level);
  for (const x of [-6.59, 0.32, 8.67, 15.35]) dormer(out, x, 3.65, false, 15.04, 2.34, level);
  dormer(out, 25.87, 4.88, false, 15.73, 3.82, level);
  if (level >= 2) {
    for (const [x, z, y] of [
      [-23.0, -2.26, 22.64],
      [-7.04, -3.69, 18.62],
      [5.25, -3.48, 18.64],
      [25.61, -2.62, 19.72],
    ]) {
      box(out, 'plaster', x - 0.24, x + 0.24, z - 0.28, z + 0.28, y - 0.46, y + 1.78, cap);
      box(out, 'cutStone', x - 0.32, x + 0.32, z - 0.35, z + 0.35, y + 1.6, y + 1.81, stone);
    }
  }
  if (level === 3) {
    const F = facade([0, 7.09], [1, 0]);
    for (const y of [0.46, 1.11, 1.77, 2.44, 3.1]) {
      for (const [lo, hi] of [
        [center - 2.66, center - 1.2],
        [center + 1.2, center + 2.66],
      ]) {
        fbox(out, 'cutStone', F, lo, hi, y, y + 0.039, 0.151, 0.177, cap);
      }
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'sugar-museum-berlin-model.mjs';
const camera = [-47, 26, 76];
const lookAt = [-5, 11.0, 0.5];
export const model = {
  key: plan.model,
  id: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The former Sugar Museum in Anton Adams’s sandstone and plaster institute at Amrumer Straße 32, with its projecting copper lantern and red mansards.',
  camera,
  lookAt,
  sunDirection: [-54, 67, 46],
  mediumFiContext: {
    scale: 1.02,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.88,
    basis:
      'Use the historic main building boundary from the named cadastral-derived OSM footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'amrumer-strasse', position: camera, lookAt },
    {
      name: 'red-sandstone-and-copper-lantern',
      position: [-19, 13.9, 27.4],
      lookAt: [-15.1, 13.7, 4.4],
    },
    { name: 'courtyard-curved-stair-projection', position: [38, 27, -38], lookAt: [10.7, 9, -4.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sugar-museum-berlin-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.62,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.102, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.039, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by the exact public-domain Qualla-published photograph by FA2010, the named cadastral-derived OpenStreetMap footprint, and open GDI Berlin numeric elevation data.',
};
