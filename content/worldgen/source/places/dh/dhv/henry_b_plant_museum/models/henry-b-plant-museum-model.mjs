import fs from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { parts } = JSON.parse(
  fs.readFileSync(new URL('../native-map/henry-plant-building-parts.json', import.meta.url)),
);
const outline = frame.geometry.outline;
const byId = new Map(parts.map((p) => [p.id, p]));
const { foundation, floor, longWingEave, longWingRidge, centreEave } = plan.dimensions;

const brick = rgb('945f50');
const brickShadow = rgb('7c5650');
const cream = rgb('d3cab3');
const trim = rgb('c5baa2');
const stone = rgb('9e9689');
const sash = rgb('d4c7ae');
const glass = rgb('606963');
const roof = rgb('7d8586');
const silver = rgb('b4b8b8');
const gilded = rgb('b39b67');
const bronze = rgb('8c7752');
const surfaces = {
  wall: { slot: 'wall', graph: 'brick', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.93 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.63, metallic: 0.22 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49 },
};

function volume(out, slot, ring, y0, y1, color, surface, surfaceColor) {
  extrude(out, slot, ring, y0, y1, color, { top: false });
  const triangles = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y1, ring[i][1]];
  for (let i = 0; i < triangles.length; i += 3)
    tri(out, surface, p(triangles[i]), p(triangles[i + 2]), p(triangles[i + 1]), surfaceColor);
}

const silhouetteOutline = [
  2, 4, 7, 10, 13, 15, 18, 19, 24, 32, 39, 41, 47, 56, 61, 62, 65, 69, 70, 72, 74, 76, 78, 81, 84,
  86, 90, 94, 100, 108, 112, 119, 128, 131, 132, 133, 135, 138, 142,
].map((i) => outline[i]);

// The curved public rooms and verandas are lower than the main hotel ranges.
const upperOutline = [
  [-10.9, 29.12],
  [-10.9, -29.18],
  [-1.7, -29.9],
  [-1.96, -61.04],
  [-6.95, -61.39],
  [-7.1, -75.79],
  [19.34, -75.84],
  [19.54, -61.2],
  [14.9, -60.97],
  [17.64, -29.12],
  [19.11, -27.94],
  [19.21, 26.77],
  [17.76, 27.2],
  [17.14, 60.48],
  [21.98, 60.91],
  [22.41, 75.61],
  [-4.38, 76.12],
  [-4.65, 60.44],
  [1.31, 60.12],
  [1.18, 37.12],
  [-4.48, 36.91],
  [-4.55, 29.52],
];
const lowerEave = 8.22;

function mass(out, lod) {
  const base = lod < 2 ? silhouetteOutline : outline;
  extrude(out, 'base', base, foundation, floor, stone, { top: false });
  volume(out, 'wall', base, floor - 0.019, lowerEave, brick, 'roof', roof);
  volume(out, 'wall', upperOutline, lowerEave - 0.04, longWingEave, brick, 'roof', roof);
  const core = byId.get('1110635642').ring;
  volume(out, 'wall', core, longWingEave - 0.22, centreEave, brickShadow, 'roof', roof);
  for (const [z0, z1] of [
    [-75.6, -25.9],
    [27.12, 75.21],
  ]) {
    gableRoof(
      out,
      'roof',
      [9.28, z0],
      [9.28, z1],
      14.87,
      longWingEave - 0.09,
      longWingRidge,
      roof,
      { overhang: 0.21, endSlot: 'wall', endColor: brickShadow },
    );
  }
  gableRoof(out, 'roof', [8.88, -24.75], [9.02, 24.02], 13.45, centreEave - 0.06, 21.94, roof, {
    overhang: 0.36,
    endSlot: 'trim',
    endColor: trim,
  });
  if (lod === 0) return;
  for (const [cx, z, wide] of [
    [9.33, 65.7, 18.4],
    [6.26, -65.75, 19.7],
  ]) {
    const wingEnd = facade([cx, z], [1, 0]);
    fbox(out, 'trim', wingEnd, -wide / 2, wide / 2, 15.95, 16.27, -8.26, 8.26, trim);
  }
}

const minarets = parts.filter((p) => /^111063563[1-6]$/.test(p.id));
const domeParts = parts.filter((p) => p.record.tags['roof:shape'] === 'dome');
const firstHeight = [
  [0, 0.98],
  [0.05, 1.08],
  [0.2, 1.11],
  [0.44, 0.93],
  [0.62, 0.73],
  [0.79, 0.55],
  [0.91, 0.33],
  [1.0, 0.25],
];
const upperHeight = [
  [0, 0.52],
  [0.18, 0.84],
  [0.34, 0.92],
  [0.51, 0.72],
  [0.69, 0.46],
  [0.84, 0.27],
  [1, 0.12],
];
function profile(out, slot, p, y0, span, width, shape, lod, color) {
  const reduced = lod === 0 ? shape.filter((_, i) => i % 2 === 0 || i === shape.length - 1) : shape;
  const count = [6, 10, 10, 24][lod];
  lathe(
    out,
    slot,
    p,
    reduced.map(([y, r]) => [y0 + y * span, width * r, width * r]),
    count,
    color,
  );
}

function crescent(out, [x, z], y, radius, lod) {
  if (lod === 0) return;
  const c = [x, y + radius * 0.65, z];
  const samples = lod === 3 ? 13 : 8;
  const arc = Array.from({ length: samples }, (_, i) => {
    const t = (1.08 + (i * 0.86) / (samples - 1)) * Math.PI;
    return [x + Math.cos(t) * radius, c[1] + Math.sin(t) * radius, z];
  });
  beamPath(
    out,
    'metal',
    arc,
    Math.max(0.054, radius * 0.16),
    Math.max(0.05, radius * 0.13),
    gilded,
  );
}

const cupolas = [
  [2.5, -53.7],
  [14.35, -45.5],
  [4.15, 42.6],
  [16.1, 48.0],
];
const domes = [
  ...domeParts.map((p) => [p.center, lowerEave - 0.04, 4.11, 4.48]),
  [[13.7, -0.35], centreEave + 0.16, 4.28, 5.35],
];

function towerSilhouette(out) {
  for (const p of minarets) {
    const top = Number(p.record.tags.height);
    const r =
      Math.max(...p.ring.map(([x, z]) => Math.hypot(x - p.center[0], z - p.center[1]))) * 0.82;
    lathe(
      out,
      'wall',
      p.center,
      [
        [floor - 0.02, r * 0.9, r * 0.9],
        [top - 8.53, r, r],
      ],
      4,
      brick,
    );
    lathe(
      out,
      'roof',
      p.center,
      [
        [top - 8.56, r, r],
        [top - 7.78, r * 1.1, r * 1.1],
        [top - 5.51, r * 0.36, r * 0.36],
        [top - 4.14, r * 0.38, r * 0.38],
        [top - 3.24, r * 0.44, r * 0.44],
        [top, 0, 0],
      ],
      4,
      silver,
    );
  }
  for (const [i, p] of cupolas.entries()) {
    const y = 21.2 + (i % 2) * 1.05;
    lathe(
      out,
      'roof',
      p,
      [
        [17.52, 1.22, 1.22],
        [y - 1.41, 1.33, 1.33],
        [y, 0, 0],
      ],
      4,
      silver,
    );
  }
  for (const [p, y, r, h] of domes) {
    lathe(
      out,
      'roof',
      p,
      [
        [y, r, r],
        [y + h * 0.63, r * 0.86, r * 0.86],
        [y + h, r * 0.29, r * 0.29],
        [y + h + 1.92, r * 0.31, r * 0.31],
        [y + h + 3, 0, 0],
      ],
      6,
      silver,
    );
  }
}

function towers(out, lod) {
  if (lod < 2) {
    towerSilhouette(out);
    if (lod === 1)
      for (const p of minarets)
        crescent(out, p.center, Number(p.record.tags.height) - 0.25, 0.325, lod);
    return;
  }
  for (const p of minarets) {
    const [x, z] = p.center;
    const radius = Math.max(...p.ring.map(([a, b]) => Math.hypot(a - x, b - z))) * 0.82;
    const top = Number(p.record.tags.height);
    const base = floor - 0.02;
    const metalStart = top - 8.64;
    const shaft =
      lod === 0
        ? [
            [base, radius * 0.86],
            [metalStart, radius],
          ]
        : [
            [base, radius * 0.92],
            [metalStart - 0.64, radius * 0.92],
            [metalStart - 0.41, radius],
            [metalStart, radius],
          ];
    profile(out, 'wall', p.center, 0, 1, 1, shaft, lod, brick);
    profile(out, 'roof', p.center, metalStart - 0.04, 3.86, radius, firstHeight, lod, silver);
    profile(
      out,
      'trim',
      p.center,
      top - 4.87,
      1.19,
      radius,
      [
        [0, 0.29],
        [0.17, 0.3],
        [0.85, 0.3],
        [1, 0.37],
      ],
      lod,
      cream,
    );
    profile(out, 'roof', p.center, top - 3.76, 2.46, radius * 0.54, upperHeight, lod, silver);
    lathe(
      out,
      'metal',
      p.center,
      [
        [top - 1.4, 0.18, 0.18],
        [top - 0.78, 0.115, 0.115],
        [top - 0.41, 0.088, 0.088],
        [top - 0.09, 0, 0],
      ],
      lod === 0 ? 1 : 8,
      bronze,
    );
    crescent(out, p.center, top - 0.27, 0.37, lod);
    if (lod < 2) continue;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const f = facade(
        [x + Math.cos(a) * radius * 0.925, z + Math.sin(a) * radius * 0.925],
        [Math.sin(a), -Math.cos(a)],
      );
      opening(out, f, 0, metalStart - 1.53, 0.91, 1.0, {
        head: 'round',
        glassSlot: 'glass',
        frameSlot: 'trim',
        glass: glass,
        frame: trim,
        frameWidth: 0.09,
        frameDepth: 0.11,
        sill: false,
      });
    }
  }
  for (const [i, cupola] of cupolas.entries()) {
    const height = 21.2 + (i % 2) * 1.05;
    const size = 1.69 + i * 0.095;
    profile(
      out,
      'trim',
      cupola,
      longWingRidge - 0.48,
      1.26,
      size,
      [
        [0, 0.8],
        [1, 0.7],
      ],
      lod,
      cream,
    );
    profile(
      out,
      'roof',
      cupola,
      longWingRidge + 0.67,
      height - longWingRidge - 0.96,
      size,
      upperHeight,
      lod,
      silver,
    );
    crescent(out, cupola, height - 0.26, 0.24, lod);
  }
  for (const [p, y, width, height] of domes) {
    profile(
      out,
      'roof',
      p,
      y,
      height,
      width,
      [
        [0, 1],
        [0.13, 1.01],
        [0.61, 0.91],
        [0.9, 0.6],
        [1, 0.28],
      ],
      lod,
      silver,
    );
    profile(
      out,
      'trim',
      p,
      y + height - 0.02,
      1.01,
      width,
      [
        [0, 0.3],
        [1, 0.3],
      ],
      lod,
      cream,
    );
    profile(out, 'roof', p, y + height + 0.96, 2.0, width * 0.53, upperHeight, lod, silver);
    crescent(out, p, y + height + 2.97, 0.28, lod);
  }
}

function windows(out, lod) {
  if (lod === 0) return;
  const lower = outwardRing(outline);
  const upper = outwardRing(upperOutline);
  for (const [ring, levels, bands] of [
    [lower, [3.68, 6.11], [3.43, 6.01, 7.97]],
    [upper, [9.51, 12.58], [9.3, 12.39, 15.28]],
  ])
    for (const [i, a] of ring.entries()) {
      const f = wallFace(a, ring[(i + 1) % ring.length]);
      if (f.length < (lod === 1 ? 6.6 : lod === 2 && ring === lower ? 4.2 : 2.91)) continue;
      const extent = Math.max(1, Math.floor(f.length / (lod === 1 ? 5.05 : 3.13)));
      for (const y of lod < 3 ? (ring === lower ? [] : bands.slice(-1)) : bands)
        fbox(out, 'trim', f, 0.02, f.length - 0.02, y, y + 0.115, 0.01, 0.115, trim);
      for (let j = 0; j < extent; j++) {
        const u = ((j + 0.5) * f.length) / extent;
        for (const y of levels) {
          const width = 1.28;
          if (lod < 3) {
            quad4(
              out,
              'glass',
              f.P(u - width / 2, y, 0.029),
              f.P(u + width / 2, y, 0.029),
              f.P(u + width / 2, y + 1.69, 0.029),
              f.P(u - width / 2, y + 1.69, 0.029),
              glass,
            );
            if (lod === 2)
              quad4(
                out,
                'wood',
                f.P(u - 0.045, y, 0.037),
                f.P(u + 0.045, y, 0.037),
                f.P(u + 0.045, y + 1.67, 0.037),
                f.P(u - 0.045, y + 1.67, 0.037),
                sash,
              );
            continue;
          }
          opening(out, f, u, y, width, 1.91, {
            head: y < 4 ? 'round' : 'flat',
            glassSlot: 'glass',
            frameSlot: 'wood',
            glass,
            frame: sash,
            frameWidth: 0.09,
            frameDepth: 0.097,
            sill: true,
            mullions: lod === 3 ? 1 : 0,
          });
        }
      }
    }
}

function veranda(out, f, u0, u1, bays, lod) {
  const projection = 2.42;
  const corniceTop = 5.43;
  fbox(out, 'base', f, u0 - 0.24, u1 + 0.24, 0.06, floor, -0.08, projection + 0.48, stone);
  fbox(
    out,
    'roof',
    f,
    u0 - 0.21,
    u1 + 0.21,
    corniceTop - 0.175,
    corniceTop + 0.035,
    -0.1,
    projection + 0.16,
    roof,
  );
  fbox(
    out,
    'wood',
    f,
    u0 - 0.23,
    u1 + 0.23,
    corniceTop - 0.58,
    corniceTop - 0.05,
    projection - 0.09,
    projection + 0.19,
    cream,
  );
  const width = (u1 - u0) / bays;
  for (let i = 0; i <= bays; i++) {
    const u = u0 + i * width;
    fbox(
      out,
      'wood',
      f,
      u - 0.135,
      u + 0.135,
      floor,
      corniceTop - 0.5,
      projection - 0.145,
      projection + 0.14,
      cream,
    );
    if (lod === 0) continue;
    for (const [y, w] of [
      [1.03, 0.19],
      [3.91, 0.16],
      [4.73, 0.22],
    ])
      fbox(out, 'trim', f, u - w, u + w, y, y + 0.165, projection - w, projection + w, trim);
    if (i === bays) continue;
    for (const [y, h] of [
      [1.17, 0.108],
      [1.94, 0.119],
    ])
      fbox(
        out,
        'wood',
        f,
        u + 0.14,
        u + width - 0.11,
        y,
        y + h,
        projection - 0.08,
        projection + 0.09,
        cream,
      );
    if (lod < 2) continue;
    const samples = lod === 3 ? 13 : 7;
    const arch = Array.from({ length: samples }, (_, i) => {
      const t = i / (samples - 1);
      return f.P(
        u + 0.16 + t * (width - 0.31),
        4.15 + 0.87 * Math.sin(t * Math.PI),
        projection + 0.023,
      );
    });
    beamPath(out, 'wood', arch, 0.108, 0.119, cream);
    for (let j = 1; j < 8; j++) {
      const v = u + (j * width) / 8;
      fbox(
        out,
        'wood',
        f,
        v - 0.036,
        v + 0.036,
        1.26,
        1.95,
        projection - 0.05,
        projection + 0.071,
        cream,
      );
    }
  }
}

function entries(out, lod) {
  const east = facade([24.24, -0.34], [0, -1]);
  const museum = facade([20.32, 54.37], [0, -1]);
  for (const [f, u0, u1, bays] of [
    [east, -9.24, 9.3, lod === 0 ? 1 : 8],
    [museum, -5.82, 6.71, lod === 0 ? 1 : 6],
  ]) {
    veranda(out, f, u0, u1, bays, lod);
    for (let i = 0; i < (lod === 0 ? 2 : 5); i++)
      fbox(
        out,
        'base',
        f,
        -3.83,
        3.83,
        -0.03,
        Math.min(floor, 0.18 + i * (lod === 0 ? 0.64 : 0.16)),
        2.35,
        3.75 - i * (lod === 0 ? 0.69 : 0.18),
        stone,
      );
  }
  if (lod === 0) return;
  for (const [x, z, width] of [
    [19.05, -43.65, 24.5],
    [20.24, 38.63, 18.56],
  ]) {
    const wing = facade([x, z], [0, -1]);
    veranda(
      out,
      wing,
      -width / 2,
      width / 2,
      Math.round(width / (lod === 1 ? 5.1 : 2.88)),
      lod === 3 ? 3 : lod - 1,
    );
  }
  const west = outwardRing(outline);
  for (const [i, a] of west.entries()) {
    const f = wallFace(a, west[(i + 1) % west.length]);
    if (f.normal[0] > -0.67 || a[0] > -13 || Math.abs(a[1]) > 30 || f.length < 1.36) continue;
    if (lod === 1 && f.length < 5.1) continue;
    const verandaLevel = lod === 2 && f.length < 4.8 ? 1 : lod;
    veranda(out, f, 0.12, f.length - 0.085, Math.max(1, Math.round(f.length / 3.25)), verandaLevel);
  }
  if (lod < 2) return;
  for (const f of [east, museum]) {
    opening(out, f, 0, floor, 2.42, 3.93, {
      head: 'round',
      rise: 1.05,
      glassSlot: 'glass',
      frameSlot: 'wood',
      glass: glass,
      frame: cream,
      frameWidth: 0.18,
      frameDepth: 0.175,
      mullions: 1,
      transoms: 1,
      sill: false,
    });
    fbox(out, 'trim', f, -2.83, 2.83, 5.54, 6.06, -0.07, 0.24, trim);
  }
}

function build(out, lod) {
  mass(out, lod);
  towers(out, lod);
  windows(out, lod);
  entries(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'henry-b-plant-museum-model.mjs';
const camera = [166, 39, 108];
const lookAt = [4, 10, -1];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Tampa’s former Tampa Bay Hotel with red brick, cream verandas, silver domes and six ornate minarets.',
  camera,
  lookAt,
  sunDirection: [55, 64, -23],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Mapped H. B. Plant Hall envelope, including the former hotel wings.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'plant-park-and-hotel-wings', position: camera, lookAt },
    { name: 'onion-domes-and-minarets', position: [-65, 19, 44], lookAt: [1, 16, 8] },
    { name: 'museum-veranda-and-arches', position: [53, 5.6, 70], lookAt: [18, 5.9, 55] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'henry-b-plant-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.97,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.41, surfaces },
      street: { export: 'street', errorMeters: 0.147, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.054, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
