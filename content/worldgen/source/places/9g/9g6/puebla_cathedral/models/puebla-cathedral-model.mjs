import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  roundArch,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { parts } = read('native-map/puebla-cathedral-shape-controls');

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95 },
  mortar: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  glaze: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.69 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.8 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const stone = rgb('716d62');
const darkStone = rgb('636158');
const ash = rgb('9a9383');
const lime = rgb('d4c9b6');
const burgundy = rgb('794e47');
const terra = rgb('a49583');
const door = rgb('3d372f');
const dark = rgb('343a38');
const copper = rgb('645638');
const green = rgb('73856a');
const golden = rgb('b5a36a');
const towerTile = rgb('796d54');
const naveCentre = 0.85;

function box(out, slot, x, z, rx, rz, bottom, top, color) {
  abox(out, slot, [x - rx, bottom, z - rz], [x + rx, top, z + rz], color, { bottom: false });
}

function flatRoof(out, ring, y, color) {
  const podium = new MeshBufferBuilder();
  if (
    !podium.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Cannot close the cathedral roof');
  const roof = podium.finalize();
  for (let i = 0; i < roof.indices.length; i += 3) {
    const position = (j) => Array.from(roof.positions.subarray(j * 3, j * 3 + 3));
    tri(out, 'roof', ...Array.from(roof.indices.subarray(i, i + 3), position), color);
  }
}

function vault(out, x, z0, z1, radius, y, rise, level, transverse = false) {
  const point = (a, z) =>
    transverse
      ? [z, y + rise * Math.sin(a), x - radius * Math.cos(a)]
      : [x + radius * Math.cos(a), y + rise * Math.sin(a), z];
  const segments = [3, 7, 12, 20][level];
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * i) / segments;
    const b = (Math.PI * (i + 1)) / segments;
    const a0 = point(a, z0);
    const b0 = point(b, z0);
    const b1 = point(b, z1);
    const a1 = point(a, z1);
    quad4(out, 'roof', a0, b0, b1, a1, terra);
    const ground = ([px, , pz]) => [px, y - 0.03, pz];
    if (i === 0) {
      tri(out, 'mortar', a1, b1, ground(b1), burgundy);
      tri(out, 'mortar', b0, a0, ground(b0), burgundy);
    } else if (i === segments - 1) {
      tri(out, 'mortar', a1, b1, ground(a1), burgundy);
      tri(out, 'mortar', b0, a0, ground(a0), burgundy);
    } else {
      quad4(out, 'mortar', a1, b1, ground(b1), ground(a1), burgundy);
      quad4(out, 'mortar', b0, a0, ground(a0), ground(b0), burgundy);
    }
  }
}

function octagon(x, z, radius) {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = Math.PI / 8 + (i * Math.PI) / 4;
    return [x + radius * Math.cos(angle), z + radius * Math.sin(angle)];
  });
}

function cross(out, x, z, bottom, height) {
  box(out, 'bronze', x, z, 0.105, 0.1, bottom, bottom + height, dark);
  box(
    out,
    'bronze',
    x,
    z,
    height * 0.31,
    0.105,
    bottom + height * 0.58,
    bottom + height * 0.68,
    dark,
  );
}

function lantern(out, x, z, base, radius, height, level) {
  const ring = octagon(x, z, radius);
  lathe(
    out,
    'trim',
    [x, z],
    [
      [base, radius * 1.09, radius * 1.09],
      ...(level > 0 ? [[base + 0.3, radius, radius]] : []),
      [base + height * 0.72, radius, radius],
      ...(level > 0 ? [[base + height * 0.82, radius * 1.18, radius * 1.18]] : []),
      [base + height, 0.2, 0.2],
    ],
    8,
    lime,
    { rotation: Math.PI / 8 },
  );
  if (level >= 2) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 7) % 8];
      const F = facade([(ax + bx) / 2, (az + bz) / 2], [bx - ax, bz - az]);
      opening(out, F, 0, base + 0.46, radius * 0.37, height * 0.43, {
        head: 'round',
        glassSlot: 'shadow',
        glass: dark,
        frameWidth: 0,
        sill: false,
      });
    }
  }
  cross(out, x, z, base + height, height * 0.65);
}

function glazedCap(out, x, z, base, radius, rise, level, isCrossing) {
  const sides = [8, 12, 24, 32][level];
  const rows = [3, 5, 7, 10][level];
  const tip = 1.42;
  const surfacePoint = (angle, step, bias = 0) => {
    const theta = (step / rows) * tip;
    const r = radius * Math.cos(theta) + bias;
    return [x + r * Math.cos(angle), base + rise * Math.sin(theta), z + r * Math.sin(angle)];
  };
  for (let row = 0; row < rows; row++) {
    for (let side = 0; side < sides; side++) {
      const a = (side * Math.PI * 2) / sides;
      const b = ((side + 1) * Math.PI * 2) / sides;
      const rib = (side * 8) % sides === 0;
      const shade = isCrossing ? (rib ? green : golden) : rib && level < 2 ? golden : towerTile;
      quad4(
        out,
        'glaze',
        surfacePoint(a, row),
        surfacePoint(a, row + 1),
        surfacePoint(b, row + 1),
        surfacePoint(b, row),
        shade,
      );
      if (!rib || level < 2) continue;
      const width = isCrossing ? 0.02 : 0.055;
      quad4(
        out,
        'glaze',
        surfacePoint(a - width, row, 0.026),
        surfacePoint(a - width, row + 1, 0.026),
        surfacePoint(a + width, row + 1, 0.026),
        surfacePoint(a + width, row, 0.026),
        golden,
      );
    }
  }
  const rim = radius * Math.cos(tip);
  lathe(
    out,
    'trim',
    [x, z],
    [
      [base - 0.18, radius * 1.01, radius * 1.01],
      [base + 0.18, radius * 1.01, radius * 1.01],
    ],
    sides,
    isCrossing ? lime : ash,
    { capTop: false },
  );
  lathe(
    out,
    'trim',
    [x, z],
    [
      [base + rise * Math.sin(tip) - 0.08, rim, rim],
      [base + rise, rim, rim],
    ],
    8,
    ash,
  );
}

function arcadedStage(out, x, z, r, y, height, level) {
  const depth = -0.72;
  const corners = [
    [x - r, z + r],
    [x + r, z + r],
    [x + r, z - r],
    [x - r, z - r],
  ];
  const bottom = y + height * 0.12;
  const spring = y + height * 0.67;
  const top = y + height;
  const openingRadius = r * 0.287;
  const centres = [-r * 0.46, r * 0.46];
  for (let i = 0; i < corners.length; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % 4];
    const F = facade([(ax + bx) / 2, (az + bz) / 2], [bx - ax, bz - az]);
    fbox(out, 'stone', F, -r, r, y, bottom, depth, 0, darkStone);
    let joint = -r;
    for (const center of centres) {
      fbox(out, 'stone', F, joint, center - openingRadius, bottom, top, depth, 0, stone);
      const arc = roundArch(openingRadius, [3, 3, 8, 12][level]);
      for (let j = 1; j < arc.length; j++) {
        const [au, ay] = arc[j - 1];
        const [bu, by] = arc[j];
        const a = center + au;
        const b = center + bu;
        quad4(
          out,
          'stone',
          F.P(a, spring + ay),
          F.P(b, spring + by),
          F.P(b, top),
          F.P(a, top),
          stone,
        );
        if (level >= 2) {
          quad4(
            out,
            'stone',
            F.P(b, spring + by, depth),
            F.P(a, spring + ay, depth),
            F.P(a, spring + ay),
            F.P(b, spring + by),
            darkStone,
          );
          const band = 0.2;
          quad4(
            out,
            'trim',
            F.P(a, spring + ay, 0.06),
            F.P(b, spring + by, 0.06),
            F.P(b + (bu / openingRadius) * band, spring + by + (by / openingRadius) * band, 0.06),
            F.P(a + (au / openingRadius) * band, spring + ay + (ay / openingRadius) * band, 0.06),
            ash,
          );
        }
      }
      if (level >= 2) {
        for (const side of [-1, 1]) {
          const offset = center + side * (openingRadius + 0.13);
          fbox(out, 'trim', F, offset - 0.105, offset + 0.105, bottom, spring, 0.01, 0.18, ash);
        }
        fbox(
          out,
          'trim',
          F,
          center - openingRadius,
          center + openingRadius,
          bottom + 0.2,
          bottom + 0.32,
          -0.12,
          0.09,
          ash,
        );
        if (level === 3) {
          for (let baluster = -3; baluster <= 3; baluster++) {
            const u = center + baluster * openingRadius * 0.235;
            fbox(
              out,
              'trim',
              F,
              u - 0.034,
              u + 0.034,
              bottom + 0.29,
              bottom + 0.94,
              -0.12,
              0.05,
              ash,
            );
          }
          fbox(
            out,
            'trim',
            F,
            center - openingRadius,
            center + openingRadius,
            bottom + 0.94,
            bottom + 1.06,
            -0.15,
            0.08,
            ash,
          );
        }
      }
      joint = center + openingRadius;
    }
    fbox(out, 'stone', F, joint, r, bottom, top, depth, 0, stone);
    if (level >= 2) {
      for (const u of [-r + 0.37, 0, r - 0.37])
        fbox(out, 'trim', F, u - 0.22, u + 0.22, y + 0.12, top - 0.08, 0.01, 0.33, darkStone);
    }
  }
}

function tower(out, ring, level) {
  const x = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
  const z = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  const r = Math.max(...ring.map((p) => Math.abs(p[0] - x)));
  extrude(out, 'stone', ring, -4.6, 30.8, darkStone, { top: false });
  box(out, 'trim', x, z, r + 0.28, r + 0.51, 28.86, 30.5, stone);
  box(out, 'trim', x, z, r + 0.42, r + 0.59, 30.48, 31.14, ash);
  for (const stage of [31.1, 43.05]) {
    if (level === 0) box(out, 'stone', x, z, r - 0.27, r - 0.27, stage, stage + 10.85, stone);
    else arcadedStage(out, x, z, r - 0.27, stage, 10.7, level);
    box(out, 'trim', x, z, r + 0.1, r + 0.1, stage + 10.62, stage + 12.02, darkStone);
  }
  box(out, 'trim', x, z, r + 0.7, r + 0.7, 53.91, 55.11, ash);
  box(out, 'trim', x, z, r + 0.9, r + 0.9, 55.1, 55.65, darkStone);
  if (level >= 1) {
    for (const dx of [-1, 1]) {
      for (const dz of [-1, 1]) {
        const pinX = x + dx * (r + 0.3);
        const pinZ = z + dz * (r + 0.3);
        lathe(
          out,
          'trim',
          [pinX, pinZ],
          [
            [55.63, 0.44, 0.44],
            [56.9, 0.31, 0.31],
            [57.8, 0, 0],
          ],
          6,
          darkStone,
        );
      }
    }
    if (level >= 2) {
      const F = facade([x, Math.max(...ring.map((p) => p[1]))], [1, 0]);
      for (const y of [9.1, 18.9, 24.9]) {
        opening(out, F, 0, y, 0.72, 1.45, {
          head: 'round',
          frameSlot: 'trim',
          glassSlot: 'shadow',
          glass: dark,
          frame: stone,
          frameWidth: 0.1,
          frameDepth: 0.17,
          sill: false,
          d: 0.06,
        });
      }
    }
  }
  glazedCap(out, x, z, 55.58, r - 0.7, 7.7, level, false);
  lantern(out, x, z, 63.18, 0.97, 3.18, level);
  if (level >= 2) {
    const bell = [
      [31.5, 1.1, 1.1],
      [31.8, 0.77, 0.77],
      [34.2, 0.5, 0.5],
      [34.65, 0.2, 0.2],
    ];
    lathe(out, 'bronze', [x - r * 0.24, z + r * 0.09], bell, level === 3 ? 16 : 8, copper, {
      capBottom: true,
    });
  }
}

function crossing(out, level) {
  const x = 0.98;
  const z = 6.63;
  const radius = 8.1;
  const base = 28.1;
  const ring = octagon(x, z, radius);
  extrude(out, 'mortar', ring, 22.1, base, burgundy, { top: false });
  lathe(
    out,
    'trim',
    [x, z],
    [
      [22.17, 8.22, 8.22],
      [22.62, 8.22, 8.22],
    ],
    8,
    lime,
    { rotation: Math.PI / 8, capTop: false },
  );
  lathe(
    out,
    'trim',
    [x, z],
    [
      [27.7, 8.22, 8.22],
      [28.12, 8.22, 8.22],
    ],
    8,
    lime,
    { rotation: Math.PI / 8, capTop: false },
  );
  if (level >= 1) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 7) % 8];
      const F = facade([(ax + bx) / 2, (az + bz) / 2], [bx - ax, bz - az]);
      opening(out, F, 0, 23.05, 2.19, 4.12, {
        head: 'round',
        glassSlot: 'shadow',
        frameSlot: 'trim',
        glass: dark,
        frame: lime,
        frameWidth: level >= 2 ? 0.23 : 0.1,
        frameDepth: 0.22,
        sill: false,
      });
      for (const u of [-2.43, 2.43])
        fbox(out, 'trim', F, u - 0.18, u + 0.18, 22.75, 27.72, 0, 0.25, lime);
    }
  }
  glazedCap(out, x, z, base, radius, 10.6, level, true);
  lantern(out, x, z, 38.55, 1.2, 2.75, level);
}

function facadeArch(out, F, x, bottom, width, height, level, tone = ash) {
  opening(out, F, x, bottom, width, height, {
    head: 'round',
    glassSlot: 'shadow',
    frameSlot: 'trim',
    glass: door,
    frame: tone,
    frameWidth: level >= 1 ? 0.28 : 0,
    frameDepth: 0.55,
    sill: false,
    d: 0.05,
  });
}

function mainFront(out, level) {
  const F = facade([0, 55.75], [1, 0]);
  fbox(out, 'stone', F, -16.5, 18.09, -0.25, 24.65, -0.33, 0.33, darkStone);
  const arch = roundArch(7.6, [6, 8, 12, 18][level]);
  const profile = [
    [-6.8, 23.25],
    [8.4, 23.25],
    ...arch
      .slice()
      .reverse()
      .map(([u, y]) => [u + 0.8, 24.4 + y * 0.71]),
  ];
  fan(
    out,
    'stone',
    profile.map(([u, y]) => F.P(u, y, 0.4)),
    darkStone,
  );
  for (let i = 1; i < arch.length; i++) {
    const [ax, ay] = arch[i - 1];
    const [bx, by] = arch[i];
    quad4(
      out,
      'trim',
      F.P(ax + 0.8, 24.4 + ay * 0.71, 0.42),
      F.P(bx + 0.8, 24.4 + by * 0.71, 0.42),
      F.P(bx + 0.8, 24.91 + by * 0.71, 0.42),
      F.P(ax + 0.8, 24.91 + ay * 0.71, 0.42),
      stone,
    );
  }
  const portal = facade([0, 56.12], [1, 0]);
  for (const [x, width, y] of [
    [-10.5, 3.2, 9.2],
    [0.79, 4.35, 10.8],
    [12.05, 3.2, 9.2],
  ]) {
    facadeArch(out, portal, x, 2.45, width, y, level);
    if (level === 0) continue;
    for (const u of [x - width * 0.8, x + width * 0.8]) {
      fbox(out, 'trim', portal, u - 0.5, u + 0.5, 2.4, 4.48, 0.05, 0.65, stone);
      fbox(out, 'trim', portal, u - 0.36, u + 0.36, 4.46, 14.08, 0.05, 0.53, stone);
      fbox(out, 'trim', portal, u - 0.47, u + 0.47, 13.81, 14.34, 0.05, 0.66, ash);
    }
    fbox(out, 'trim', portal, x - 3.34, x + 3.34, 14.12, 14.65, 0.01, 0.66, stone);
    opening(out, portal, x, 17.35, 2.24, 3.04, {
      frameSlot: 'trim',
      glassSlot: 'shadow',
      frame: ash,
      glass: dark,
      frameWidth: 0.34,
      frameDepth: 0.38,
      sill: true,
      mullions: level >= 2 ? 2 : 0,
      transoms: level >= 2 ? 1 : 0,
      mullionColor: dark,
    });
    if (level === 3) {
      for (const u of [x - 2.09, x + 2.09])
        facadeArch(out, portal, u, 16.97, 0.58, 2.3, level, stone);
    }
  }
  const ornament = facade([0, 56.2], [1, 0]);
  opening(out, ornament, 0.8, 23.5, 2.3, 2.68, {
    frameSlot: 'trim',
    glassSlot: 'shadow',
    frame: ash,
    glass: dark,
    frameWidth: 0.3,
    sill: false,
  });
  if (level >= 2) {
    for (const x of [-15.3, -6.58, 8.28, 16.35])
      lathe(
        out,
        'trim',
        [x, 55.96],
        [
          [24.62, 0.42, 0.42],
          [25.46, 0.3, 0.3],
          [26.92, 0, 0],
        ],
        6,
        ash,
      );
  }
}

function outerWalls(out, level) {
  const body = parts.cathedral;
  extrude(out, 'stone', body, -4.6, 12.4, stone, { top: false });
  flatRoof(out, body, 12.4, terra);
  extrude(out, 'mortar', parts.raisedNaveAndTransept, 12.37, 21.72, burgundy, { top: false });
  flatRoof(out, parts.raisedNaveAndTransept, 21.72, terra);
  vault(out, naveCentre, 14.15, 54.6, 7.47, 21.7, 2.85, level);
  vault(out, naveCentre, -40.8, -0.42, 7.19, 21.7, 2.9, level);
  vault(out, 6.59, -27.7, 31.06, 7.29, 21.69, 2.25, level, true);
  for (const x of [-14.0, 16.78]) {
    for (const [a, b] of [
      [-39.8, -1.11],
      [14.48, 42.6],
    ])
      vault(out, x, a, b, 4.97, 12.39, 2.55, level);
  }
  lathe(
    out,
    'glaze',
    [1.02, -31.0],
    [
      [24.3, 4.25, 4.25],
      [25.05, 4.12, 4.12],
      [27.15, 2.3, 2.3],
      [27.95, 0.32, 0.32],
    ],
    8,
    towerTile,
    { rotation: Math.PI / 8 },
  );
  box(out, 'stone', 0.88, -42.1, 14.3, 1.24, -4.5, 14.54, stone);
  if (level === 0) return;
  for (const side of [-1, 1]) {
    const F = facade([side < 0 ? -28.24 : 31.83, 0], [0, -side]);
    for (const z of [-34.8, -25.6, -15.7, 20.0, 28.2, 36.2]) {
      const u = z * -side;
      fbox(out, 'trim', F, u - 0.61, u + 0.61, 0.16, 12.42, -0.23, 0.85, darkStone);
      if (level >= 2) {
        const band = facade([side < 0 ? -8.22 : 10.02, 0], [0, -side]);
        const offset = z * -side + 2.6;
        opening(out, band, offset, 17.15, 1.4, 2.6, {
          head: 'round',
          frameSlot: 'trim',
          glassSlot: 'shadow',
          frame: lime,
          glass: dark,
          frameWidth: 0.19,
          sill: false,
          frameDepth: 0.3,
        });
      }
    }
    const edge = side < 0 ? -28.5 : 31.6;
    const gable = facade([edge, 6.59], [0, -side]);
    fbox(out, 'stone', gable, -5.57, 5.57, 0.24, 19.62, -0.21, 0.35, stone);
    facadeArch(out, gable, 0, 1.35, 3.22, 7.65, level);
    fbox(out, 'trim', gable, -6.4, 6.4, 11.35, 11.84, 0.02, 0.61, ash);
  }
}

function build(out, level) {
  outerWalls(out, level);
  tower(out, parts.southBelfry, level);
  tower(out, parts.northBelfry, level);
  crossing(out, level);
  mainFront(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'puebla-cathedral-model.mjs';
const camera = [-90, 87, 171];
const lookAt = [1, 26, 11];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Puebla Cathedral’s dark stone facade, paired two-stage bell towers, raised cross vault and glazed crossing dome.',
  camera,
  lookAt,
  sunDirection: [-53, 70, 79],
  mediumFiContext: {
    scale: 1.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.85,
    basis: 'The surveyed geographic footprint follows the full mapped cathedral perimeter.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'atrium-and-towers', position: camera, lookAt },
    { name: 'three-west-portals', position: [-14, 14, 109], lookAt: [0, 17, 53] },
    { name: 'glazed-crossing-and-nave', position: [-63, 57, 29], lookAt: [1, 22, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'puebla-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.034, surfaces },
    },
  },
};
