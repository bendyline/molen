import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const dimensions = plan.dimensions;
const terraceTop = 3.28;
const colors = {
  dryStone: rgb('817e6c'),
  steps: rgb('97958b'),
  slate: rgb('5b6862'),
  copper: rgb('818b78'),
  white: rgb('dedbd0'),
  panel: rgb('9d8264'),
  wood: rgb('745e48'),
  dark: rgb('403e34'),
  glass: rgb('3f4a45'),
  railing: rgb('535751'),
};
const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.92 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.86 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.86 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.83 },
};

const rectangle = (w, d, x = 0, z = 0) => [
  [x - w / 2, z - d / 2],
  [x - w / 2, z + d / 2],
  [x + w / 2, z + d / 2],
  [x + w / 2, z - d / 2],
];
const as3d = ([x, z], y) => [x, y, z];
function walls(out, slot, corners, bottom, top, tone) {
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length];
    quad4(out, slot, as3d(a, bottom), as3d(b, bottom), as3d(b, top), as3d(a, top), tone);
  }
}
function panel(out, slot, f, a, b, v, y, offset, color) {
  quad4(
    out,
    slot,
    f.P(a, v, offset),
    f.P(b, v, offset),
    f.P(b, y, offset),
    f.P(a, y, offset),
    color,
  );
}

function platform(out, level) {
  const original = frame.features[1].points;
  const west = Math.min(...original.map((p) => p[0]));
  const north = Math.min(...original.map((p) => p[1]));
  const sections = [
    [terraceTop - dimensions.stoneOutsideHeightM, 26.5, 26.2],
    [-0.12, 26.2, 25.9],
    [1.74, 24.1, 24.4],
    [terraceTop, 22.2, 22.5],
  ];
  const shapes = sections.map(([y, w, d]) =>
    rectangle(w, d, west + 13.25, north + 13.15).map((p) => as3d(p, y)),
  );
  loft(out, 'stone', shapes, colors.dryStone, { cap: false });
  quad4(out, 'stone', ...shapes.at(-1), colors.steps);
  const [outside, inside] = dimensions.stairXZ;
  const run = Math.hypot(outside[0] - inside[0], outside[1] - inside[1]);
  const along = [(outside[0] - inside[0]) / run, (outside[1] - inside[1]) / run];
  const across = [along[1], -along[0]];
  const stair = wallFace(
    [inside[0] - across[0] * 2.73, inside[1] - across[1] * 2.73],
    [inside[0] + across[0] * 2.73, inside[1] + across[1] * 2.73],
  );
  const steps = [5, 10, 19, 19][level];
  for (let i = 0; i < steps; i++) {
    const top = terraceTop - ((i + 1) * terraceTop) / steps;
    fbox(
      out,
      'stone',
      stair,
      0,
      stair.length,
      -0.34,
      top,
      (i * run) / steps,
      ((i + 1) * run) / steps,
      colors.steps,
    );
  }
  if (level >= 1) {
    for (const u of [0.07, stair.length - 0.07]) {
      beam(
        out,
        'detail',
        stair.P(u, terraceTop + 0.86, 0),
        stair.P(u, 0.83, run),
        0.056,
        0.046,
        colors.railing,
      );
      for (let i = 0; i <= steps; i += level >= 2 ? 1 : 2) {
        const y = terraceTop - (i * terraceTop) / steps;
        const v = (i * run) / steps;
        beam(
          out,
          'detail',
          stair.P(u, y - 0.035, v),
          stair.P(u, y + 0.86, v),
          0.037,
          0.037,
          colors.railing,
        );
      }
    }
  }
}

function eavesRing(width, depth, y, cornerLift) {
  const x = width / 2,
    z = depth / 2;
  return [
    [-x, y + cornerLift, -z],
    [-x, y, 0],
    [-x, y + cornerLift, z],
    [0, y, z],
    [x, y + cornerLift, z],
    [x, y, 0],
    [x, y + cornerLift, -z],
    [0, y, -z],
  ];
}

function slopedCanopy(out, width, depth, eave, rise, level, roof) {
  const outline = eavesRing(width, depth, eave, 0.24);
  const profile = [
    outline,
    eavesRing(width * 0.89, depth * 0.87, eave + rise * 0.13, 0.12),
    eavesRing(width * 0.72, depth * 0.68, eave + rise * 0.38, 0.07),
    eavesRing(width * 0.49, depth * 0.44, eave + rise * 0.64, 0.035),
    eavesRing(width * 0.24, depth * 0.21, eave + rise * 0.89, 0),
  ];
  loft(out, 'copper', profile, roof, { cap: false });
  const flat = profile.at(-1);
  quad4(out, 'copper', flat[0], flat[2], flat[4], flat[6], roof);
  const fascia = outline.map(([x, y, z]) => [x, y - 0.17, z]);
  const underside = eavesRing(width * 0.6, depth * 0.6, eave - 0.2, 0.036);
  loft(out, 'timber', [fascia, outline], colors.wood, { cap: false });
  for (let i = 0; i < fascia.length; i++) {
    const j = (i + 1) % fascia.length;
    quad4(out, 'timber', fascia[j], fascia[i], underside[i], underside[j], colors.wood);
    if (level < 2) continue;
    const n = level === 2 ? 4 : 7;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.45) / n;
      const lerp = (v, w) => v.map((q, idx) => q + (w[idx] - q) * t);
      const p = lerp(fascia[i], fascia[j]),
        q = lerp(underside[i], underside[j]);
      p[1] -= 0.055;
      q[1] -= 0.071;
      beam(out, 'timber', p, q, 0.13, 0.12, colors.wood);
    }
  }
}

function gable(out, extent, depth, faceZ, base, peak, level, arches) {
  const curve = [
    [-extent, base + 0.03],
    [-0.73 * extent, base + 0.2],
    [-0.49 * extent, base + 0.5],
    [-0.26 * extent, base + 1.14],
    [0, peak],
    [0.26 * extent, base + 1.14],
    [0.49 * extent, base + 0.5],
    [0.73 * extent, base + 0.2],
    [extent, base + 0.03],
  ];
  const innerZ = faceZ - depth;
  for (let i = 0; i < curve.length - 1; i++) {
    const [ax, ay] = curve[i],
      [bx, by] = curve[i + 1];
    const a = [ax, ay, faceZ + 0.19],
      b = [bx, by, faceZ + 0.19];
    quad4(out, 'copper', a, b, [bx, by + 0.23, innerZ], [ax, ay + 0.23, innerZ], colors.slate);
    quad4(
      out,
      'wall',
      [ax, base - 0.14, faceZ],
      [bx, base - 0.14, faceZ],
      [bx, by, faceZ],
      [ax, ay, faceZ],
      colors.white,
    );
    if (level >= 1) beam(out, 'timber', a, b, 0.14, 0.17, colors.wood);
  }
  if (level === 0) return;
  const f = wallFace([-extent, faceZ], [extent, faceZ]);
  for (const shift of arches ? [-0.98, 0, 0.98] : [-0.85, 0, 0.85]) {
    const x = extent + shift,
      w = 0.38;
    panel(out, 'detail', f, x - w, x + w, base + 0.06, base + 0.66, 0.029, colors.glass);
    const n = arches ? 8 : 1;
    for (let k = 0; k < n && arches; k++) {
      const a = (k * Math.PI) / n,
        b = ((k + 1) * Math.PI) / n;
      const pt = (angle, r, d) =>
        f.P(x + Math.cos(angle) * r, base + 0.66 + Math.sin(angle) * r, d);
      tri(
        out,
        'detail',
        f.P(x, base + 0.66, 0.031),
        pt(a, w, 0.031),
        pt(b, w, 0.031),
        colors.glass,
      );
      quad4(
        out,
        'timber',
        pt(a, w + 0.07, 0.045),
        pt(b, w + 0.07, 0.045),
        pt(b, w, 0.045),
        pt(a, w, 0.045),
        colors.wood,
      );
    }
    if (level >= 2) {
      panel(
        out,
        'timber',
        f,
        x - 0.039,
        x + 0.039,
        base + 0.13,
        base + (arches ? 0.96 : 0.65),
        0.06,
        colors.wood,
      );
      panel(
        out,
        'timber',
        f,
        x - w - 0.04,
        x + w + 0.04,
        base + 0.04,
        base + 0.125,
        0.057,
        colors.wood,
      );
    }
  }
}

function tier(out, width, base, lowerHeight, roofStart, level, entry) {
  const corners = rectangle(width, width);
  walls(out, 'timber', corners, base, base + lowerHeight, colors.panel);
  walls(out, 'wall', corners, base + lowerHeight, roofStart + 0.37, colors.white);
  if (level === 0) return;
  for (let i = 0; i < 4; i++) {
    const f = wallFace(corners[i], corners[(i + 1) % 4]);
    fbox(
      out,
      'timber',
      f,
      -0.04,
      f.length + 0.04,
      base + lowerHeight - 0.055,
      base + lowerHeight + 0.095,
      -0.07,
      0.12,
      colors.wood,
    );
    if (level >= 2) {
      const n = Math.round(f.length / (level === 3 ? 0.73 : 1.12));
      for (let j = 0; j <= n; j++) {
        const u = (j * f.length) / n;
        panel(out, 'timber', f, u - 0.038, u + 0.038, base, base + lowerHeight, 0.032, colors.wood);
      }
      for (let v = base + 0.38; v < base + lowerHeight; v += 0.43) {
        panel(out, 'timber', f, 0, f.length, v, v + 0.035, 0.038, colors.wood);
      }
    }
    if (entry && f.normal[1] > 0.9) {
      fbox(
        out,
        'timber',
        f,
        f.length - 2.61,
        f.length - 0.38,
        base + 0.01,
        base + 2.48,
        -0.06,
        0.16,
        colors.wood,
      );
      panel(
        out,
        'detail',
        f,
        f.length - 2.48,
        f.length - 0.51,
        base + 0.03,
        base + 2.33,
        0.171,
        colors.dark,
      );
    } else if (level >= 2) {
      for (const off of [-0.21, 0.21]) {
        const u = f.length * (0.5 + off);
        panel(out, 'detail', f, u - 0.49, u + 0.49, base + 0.94, base + 2.04, 0.07, colors.glass);
        for (const dx of [-0.25, 0, 0.25]) {
          panel(
            out,
            'timber',
            f,
            u + dx - 0.04,
            u + dx + 0.04,
            base + 0.94,
            base + 2.04,
            0.095,
            colors.wood,
          );
        }
      }
    }
  }
}

function observationRail(out, level) {
  if (level === 0) return;
  const terrace = rectangle(8.4, 8.43);
  for (let i = 0; i < terrace.length; i++) {
    const f = wallFace(terrace[i], terrace[(i + 1) % terrace.length]);
    fbox(out, 'timber', f, 0, f.length, 14.41, 14.56, -0.57, 0.02, colors.wood);
    fbox(out, 'timber', f, 0, f.length, 15.25, 15.36, -0.052, 0.07, colors.wood);
    const count = level === 1 ? 5 : 11;
    for (let j = 0; j <= count; j++) {
      const u = (f.length * j) / count;
      fbox(out, 'timber', f, u - 0.056, u + 0.056, 14.54, 15.27, -0.052, 0.046, colors.wood);
    }
  }
}

function upperRidge(out, level) {
  const roofPeak = terraceTop + dimensions.heightAboveStoneM - dimensions.ridgeOrnamentHeightM;
  const face = -0.97,
    far = 0.97;
  quad4(
    out,
    'copper',
    [-3.15, roofPeak, 0],
    [3.15, roofPeak, 0],
    [3.15, roofPeak - 1.96, face],
    [-3.15, roofPeak - 1.96, face],
    colors.slate,
  );
  quad4(
    out,
    'copper',
    [3.15, roofPeak, 0],
    [-3.15, roofPeak, 0],
    [-3.15, roofPeak - 1.96, far],
    [3.15, roofPeak - 1.96, far],
    colors.slate,
  );
  for (const sign of [-1, 1]) {
    const x = sign * 3.08;
    const t = [x, roofPeak + 0.12, 0];
    const mid = [x + sign * 0.58, roofPeak + 0.76, 0];
    const tip = [x + sign * 0.37, roofPeak + dimensions.ridgeOrnamentHeightM, 0];
    beam(out, 'copper', t, mid, 0.31, 0.31, colors.copper);
    beam(out, 'copper', mid, tip, 0.23, 0.24, colors.copper);
    if (level >= 2)
      beam(out, 'copper', tip, [tip[0] - sign * 0.29, tip[1] - 0.35, 0], 0.17, 0.18, colors.copper);
  }
}

function build(out, level) {
  platform(out, level);
  const w = dimensions.buildingWidthM;
  tier(out, w, terraceTop, 2.44, 7.48, level, true);
  slopedCanopy(out, 17.92, 17.6, 7.49, 4.29, level, colors.slate);
  tier(out, 10.17, 9.16, 2.61, 12.69, level, false);
  gable(out, 4.61, 2.09, 7.05, 8.85, 11.47, level, false);
  slopedCanopy(out, 13.72, 13.62, 12.73, 4.02, level, colors.slate);
  tier(out, 7.28, 14.51, 1.38, 17.78, level, false);
  observationRail(out, level);
  gable(out, 3.54, 1.62, 5.34, 14.86, 17.1, level, true);
  slopedCanopy(out, 11.42, 10.7, 17.85, 4.28, level, colors.slate);
  upperRidge(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'takashima-castle-model.mjs';
const camera = [44, 26, 45];
const lookAt = [-1, 9.6, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Takashima Castle',
  wikidataId: plan.wikidataId,
  category: 'historic-castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The rebuilt three-tier Takashima keep with bowed copper eaves, timber bands, stone platform and public stair.',
  camera,
  lookAt,
  sunDirection: [-46, 73, 51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named mapped main keep over the stone platform.',
  },
  embeddedCanonicalGraphs: ['stone_drywall', 'plaster_lime', 'wood_plain', 'metal_copper'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'park-stairs-and-entry-gables', position: [8.8, 5.1, 34.5], lookAt: [2.6, 11.8, 2] },
    { name: 'keep-and-moat-platform', position: [-30, 7, -36], lookAt: [0, 9, 0] },
    { name: 'copper-eaves-and-observation-tier', position: [13, 24, 29], lookAt: [1, 17, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'takashima-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.035, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Mapped building data under ODbL and GSI open elevation data under published terms.',
};
