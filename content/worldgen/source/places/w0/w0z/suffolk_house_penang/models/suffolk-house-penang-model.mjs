import { readFileSync } from 'node:fs';
import {
  abox,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.95 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const white = rgb('e5dfcf');
const light = rgb('ede6d6');
const stone = rgb('c7baa5');
const soffit = rgb('cabcaa');
const floor = rgb('b2a68d');
const roof = rgb('a86b50');
const shutter = rgb('6e6a59');
const timber = rgb('655744');
const glasses = rgb('454b48');
const ground = 0.28;
const spring = 2.53;
const galleryFloor = 4.15;
const ceiling = 8.37;
const halfX = 12.4815;
const halfZ = 12.6724;

function box(out, material, x0, x1, z0, z1, y0, y1, color, bottom = false) {
  abox(out, material, [x0, y0, z0], [x1, y1, z1], color, { bottom });
}

function cornice(out, f, y, level) {
  fbox(out, 'stone', f, -0.14, f.length + 0.14, y - 0.2, y - 0.06, -0.23, 0.24, stone, {
    bottom: true,
  });
  if (level >= 1)
    fbox(out, 'plaster', f, -0.18, f.length + 0.18, y - 0.05, y + 0.11, -0.28, 0.35, light, {
      bottom: true,
    });
}

function arch(out, f, u, half, thickness, level) {
  const arc = roundArch(half, [3, 5, 8, 12][level]);
  const top = galleryFloor - 0.22;
  if (level >= 1) {
    for (const sign of [-1, 1]) {
      const x = u + sign * half;
      const jamb = [
        f.P(x, ground, 0),
        f.P(x, ground, -thickness),
        f.P(x, spring, -thickness),
        f.P(x, spring, 0),
      ];
      quad4(out, 'stone', ...(sign > 0 ? jamb.reverse() : jamb), soffit);
    }
  }
  for (let i = 1; i < arc.length; i++) {
    const [u0, y0] = arc[i - 1],
      [u1, y1] = arc[i];
    const a = u + u0,
      b = u + u1;
    for (const d of level === 0 ? [0] : [0, -thickness]) {
      const face = [f.P(a, spring + y0, d), f.P(b, spring + y1, d), f.P(b, top, d), f.P(a, top, d)];
      quad4(out, 'plaster', ...(d === 0 ? face : face.reverse()), white);
    }
    if (level >= 1)
      quad4(
        out,
        'stone',
        f.P(b, spring + y1),
        f.P(a, spring + y0),
        f.P(a, spring + y0, -thickness),
        f.P(b, spring + y1, -thickness),
        soffit,
      );
    if (level >= 2) {
      const outerA = u + u0 * 1.16,
        outerB = u + u1 * 1.16;
      quad4(
        out,
        'stone',
        f.P(a, spring + y0, 0.018),
        f.P(b, spring + y1, 0.018),
        f.P(outerB, spring + y1 * 1.16, 0.018),
        f.P(outerA, spring + y0 * 1.16, 0.018),
        light,
      );
    }
  }
}

function arcade(out, f, bays, level) {
  const width = f.length / bays;
  const half = width * (level === 0 ? 0.31 : 0.327);
  const thick = 0.48;
  let cursor = 0;
  for (let i = 0; i < bays; i++) {
    const middle = width * (i + 0.5);
    if (level === 0) {
      quad4(
        out,
        'plaster',
        f.P(cursor, ground),
        f.P(middle - half, ground),
        f.P(middle - half, galleryFloor - 0.16),
        f.P(cursor, galleryFloor - 0.16),
        white,
      );
    } else {
      fbox(out, 'plaster', f, cursor, middle - half, ground, galleryFloor - 0.16, -thick, 0, white);
    }
    arch(out, f, middle, half, thick, level);
    cursor = middle + half;
  }
  fbox(out, 'plaster', f, cursor, f.length, ground, galleryFloor - 0.16, -thick, 0, white);
  cornice(out, f, galleryFloor, level);
}

function column(out, f, u, level) {
  const depth = -0.29;
  if (level <= 1) {
    fbox(
      out,
      'plaster',
      f,
      u - 0.13,
      u + 0.13,
      galleryFloor,
      ceiling - 0.09,
      depth - 0.13,
      depth + 0.13,
      white,
    );
    return;
  }
  const p = f.P(u, 0, depth);
  const radius = 0.135;
  const waist = radius * 0.87;
  const lo = galleryFloor + 0.158;
  const hi = ceiling - 0.29;
  fbox(out, 'stone', f, u - 0.185, u + 0.185, galleryFloor, lo, depth - 0.18, depth + 0.18, light);
  lathe(
    out,
    'plaster',
    [p[0], p[2]],
    [
      [lo, radius, radius],
      [lo + 0.28, radius, radius],
      [hi - 0.1, waist, waist],
      [hi, radius, radius],
    ],
    level === 2 ? 6 : 12,
    light,
    { capTop: false },
  );
  fbox(
    out,
    'stone',
    f,
    u - 0.197,
    u + 0.197,
    hi,
    ceiling - 0.08,
    depth - 0.18,
    depth + 0.18,
    light,
  );
}

function gallery(out, f, bays, level) {
  const step = f.length / bays;
  for (let i = 0; i <= bays; i++) {
    const u = i * step;
    if (i === 0 || i === bays) {
      fbox(
        out,
        'plaster',
        f,
        u - 0.095,
        u + 0.095,
        galleryFloor,
        ceiling - 0.08,
        -0.47,
        0.035,
        white,
      );
    } else if (level === 0) {
      quad4(
        out,
        'plaster',
        f.P(u - 0.16, galleryFloor, -0.23),
        f.P(u + 0.16, galleryFloor, -0.23),
        f.P(u + 0.16, ceiling - 0.08, -0.23),
        f.P(u - 0.16, ceiling - 0.08, -0.23),
        white,
      );
    } else {
      column(out, f, u - 0.185, level);
      column(out, f, u + 0.185, level);
    }
  }
  if (level >= 1) {
    for (const y of [galleryFloor + 0.36, galleryFloor + 0.79])
      fbox(out, 'wood', f, 0.14, f.length - 0.14, y, y + 0.045, -0.39, -0.3, timber);
  }
  if (level === 3) {
    for (let i = 0; i < bays; i++) {
      for (const fpart of [0.2, 0.42, 0.64, 0.82]) {
        const u = step * (i + fpart);
        fbox(
          out,
          'wood',
          f,
          u - 0.014,
          u + 0.014,
          galleryFloor + 0.24,
          galleryFloor + 0.83,
          -0.38,
          -0.31,
          timber,
        );
      }
    }
  }
  cornice(out, f, ceiling, level);
}

function parapet(out, f, level) {
  const y = ceiling + 0.24;
  if (level === 0) {
    fbox(out, 'plaster', f, 0, f.length, y, y + 0.43, -0.33, 0.075, white);
    return;
  }
  for (const [height, depth] of [
    [y, 0.1],
    [y + 0.57, 0.15],
  ])
    fbox(out, 'stone', f, 0, f.length, height, height + 0.13, -0.29, depth, light);
  const n = level === 1 ? 11 : 19;
  for (let i = 0; i <= n; i++) {
    const u = (i * f.length) / n;
    fbox(out, 'plaster', f, u - 0.1, u + 0.1, y + 0.11, y + 0.59, -0.27, 0.08, white);
    if (level === 3)
      fbox(out, 'stone', f, u - 0.13, u + 0.13, y + 0.12, y + 0.21, -0.3, 0.1, stone);
  }
}

function innerWalls(out, level) {
  const x = 8.69,
    z = 8.92;
  box(out, 'plaster', -x, x, -z, z, ground, ceiling + 0.21, white);
  if (level === 0) return;
  const ring = outwardRing([
    [-x, -z],
    [-x, z],
    [x, z],
    [x, -z],
  ]);
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const bays = i % 2 === 0 ? 5 : 7;
    for (let j = 0; j < bays; j++) {
      for (const y of [ground + 0.14, galleryFloor + 0.25]) {
        const u = (f.length * (j + 0.5)) / bays;
        opening(out, f, u, y, 1.22, 2.45, {
          glassSlot: 'dark',
          frameSlot: 'wood',
          glass: glasses,
          frame: timber,
          frameWidth: level >= 2 ? 0.09 : 0,
          frameDepth: 0.13,
          sill: level >= 2,
          mullions: level === 3 ? 1 : 0,
          transoms: level === 3 ? 2 : 0,
        });
        if (level === 3 && (j % 2 === 0 || y > 4)) {
          for (const sign of [-1, 1]) {
            const leaf = u + sign * 0.87;
            fbox(
              out,
              'wood',
              f,
              leaf - 0.21,
              leaf + 0.21,
              y + 0.16,
              y + 2.33,
              0.008,
              0.11,
              shutter,
            );
          }
        }
      }
    }
  }
}

function jackRoof(out, level) {
  const y0 = ceiling + 0.26,
    eave = 9.6,
    top = 12.35,
    x = 8.36,
    z = 8.41;
  box(out, 'plaster', -8.15, 8.15, -8.21, 8.21, y0, eave, white);
  box(out, 'stone', -x, x, -z, z, eave - 0.16, eave, stone, true);
  const a = [-x, eave, z],
    b = [x, eave, z],
    c = [x, eave, -z],
    d = [-x, eave, -z];
  const r = [-2.33, top, 0],
    s = [2.33, top, 0];
  quad4(out, 'tile', a, b, s, r, roof);
  quad4(out, 'tile', c, d, r, s, roof);
  tri(out, 'tile', a, r, d, roof);
  tri(out, 'tile', c, s, b, roof);
  if (level >= 2)
    box(out, 'tile', -2.33, 2.33, -0.087, 0.087, top - 0.045, top + 0.093, roof, true);
}

function build(out, level) {
  box(out, 'stone', -halfX - 0.1, halfX + 0.1, -halfZ - 0.11, halfZ + 0.11, -1.03, ground, floor);
  box(out, 'plaster', -halfX, halfX, -halfZ, halfZ, galleryFloor - 0.28, galleryFloor, white, true);
  box(
    out,
    'stone',
    -halfX - 0.015,
    halfX + 0.015,
    -halfZ - 0.015,
    halfZ + 0.015,
    ceiling - 0.15,
    ceiling + 0.3,
    light,
    true,
  );
  const poly = outwardRing(frame.geometry.outline);
  const bays = [7, 10, 12, 12][level];
  for (let i = 0; i < poly.length; i++) {
    const f = wallFace(poly[i], poly[(i + 1) % poly.length]);
    arcade(out, f, bays, level);
    gallery(out, f, bays, level);
    parapet(out, f, level);
  }
  innerWalls(out, level);
  jackRoof(out, level);
  for (const sign of [-1, 1]) {
    const edge = sign * halfZ,
      stepCount = level === 0 ? 1 : 3;
    for (let i = 0; i < stepCount; i++) {
      const reach = (0.91 - 0.19 * i) * sign;
      box(
        out,
        'stone',
        -1.7,
        1.7,
        Math.min(edge, edge + reach),
        Math.max(edge, edge + reach),
        -0.38,
        0.07 + i * 0.08,
        stone,
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'suffolk-house-penang-model.mjs';
const camera = [-36, 26, 45],
  lookAt = [0, 5.7, 0];
const riverCamera = [-23, 8.2, -37],
  riverLook = [0, 6.0, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Suffolk House in Penang with a limewashed wraparound ground arcade, paired upper columns, open terraces and a central clay-tiled jack roof.',
  camera,
  lookAt,
  sunDirection: [-50, 75, -55],
  mediumFiContext: {
    scale: 1.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis:
      'The named historic house perimeter fixes the extent of the four exterior gallery walls.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'river-front-arcade', position: riverCamera, lookAt: riverLook },
    { name: 'south-gallery-approach', position: [0, 5.2, 38], lookAt: [0, 6.1, 0] },
    { name: 'paired-columns-and-roof-terrace', position: [30, 17, -25], lookAt: [0, 7.1, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'suffolk-house-penang-' + reviewLod,
    position: riverCamera,
    lookAt: riverLook,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.075, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.022, surfaces },
    },
  },
};
