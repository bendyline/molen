import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  shaft: 'bfc4be',
  lip: 'bcc0ba',
  shaftDark: 'b1b7af',
  concrete: 'a1998a',
  red: '994f4b',
  white: 'cecdc1',
  lowerRed: '8d4944',
  lowerWhite: 'bfbeb1',
  plate: 'd4d1c5',
  letters: '252e32',
  rod: '646a64',
  seam: 'b8b8b1',
  door: '9c9c92',
});
const surfaces = {
  steel: surface('wall', 'metal_painted', 0.82, 0.19),
  trim: surface('trim', 'metal_painted', 0.71, 0.25),
  concrete: surface('foundation', 'stone_ashlar', 0.92),
  paint: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.86 },
  doors: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.84 },
};
const turn = Math.PI * 2;
const cylinder = (radius, y, angle) => [radius * Math.sin(angle), y, radius * Math.cos(angle)];

function band(out, slot, rings, sides, tint) {
  for (const [[y0, r0], [y1, r1]] of pairs(rings)) {
    for (let i = 0; i < sides; i++) {
      const a = (i * turn) / sides;
      const b = ((i + 1) * turn) / sides;
      const middle = (a + b) / 2;
      face(
        out,
        slot,
        [cylinder(r0, y0, a), cylinder(r0, y0, b), cylinder(r1, y1, b), cylinder(r1, y1, a)],
        [Math.sin(middle), 0, Math.cos(middle)],
        tint(i, y0),
      );
    }
  }
}

function column(out, level) {
  const shaft = d.shaftRadius;
  const foundation = Array.from({ length: 16 }, (_, i) =>
    grade(cylinder(shaft, 0, (i * turn) / 16).filter((_, k) => k !== 1)),
  );
  const low = Math.min(...foundation) - 0.3;
  const baseRing = (r, y) => radialRing(y, r, r, level === 0 ? 20 : 36);
  loft(
    out,
    'concrete',
    [baseRing(8.49, low - 0.2), baseRing(8.49, 0.17), baseRing(8.32, 0.52)],
    colors.concrete,
  );
  const columns = [24, 48, 144, 288][level];
  const corrugation = [0, 0.045, 0.14, 0.16][level];
  for (let i = 0; i < columns; i++) {
    const sa = (i * turn) / columns,
      sb = ((i + 1) * turn) / columns;
    const x0 = shaft + (i % 4 === 1 || i % 4 === 2 ? corrugation : 0);
    const x1 = shaft + ((i + 1) % 4 === 1 || (i + 1) % 4 === 2 ? corrugation : 0);
    face(
      out,
      'steel',
      [
        cylinder(x0, low, sa),
        cylinder(x1, low, sb),
        cylinder(x1, d.shaftTop, sb),
        cylinder(x0, d.shaftTop, sa),
      ],
      [Math.sin((sa + sb) / 2), 0, Math.cos((sa + sb) / 2)],
      level >= 2 && i % 4 === 3 ? colors.shaftDark : colors.shaft,
    );
  }
  band(
    out,
    'trim',
    [
      [d.shaftTop - 0.77, shaft + 0.13],
      [d.shaftTop - 0.32, shaft + 0.3],
      [d.shaftTop, shaft + 0.12],
    ],
    level === 0 ? 24 : 48,
    () => colors.lip,
  );
  if (level >= 1) {
    const a = -0.39;
    const da = 0.096;
    const site = cylinder(shaft, 0, a);
    const y = grade([site[0], site[2]]);
    const normal = [Math.sin(a), 0, Math.cos(a)];
    face(
      out,
      'doors',
      [
        cylinder(shaft + 0.19, y + 0.08, a - da),
        cylinder(shaft + 0.19, y + 0.08, a + da),
        cylinder(shaft + 0.19, y + 2.69, a + da),
        cylinder(shaft + 0.19, y + 2.69, a - da),
      ],
      normal,
      colors.door,
    );
    if (level >= 2) {
      const le = cylinder(shaft + 0.23, y + 1.23, a + da * 0.52);
      const ri = cylinder(shaft + 0.23, y + 1.23, a + da * 0.87);
      beam(out, 'trim', le, ri, 0.047, 0.054, colors.rod);
    }
  }
}

function tank(out, level) {
  const sides = [16, 32, 64, 96][level];
  const stride = sides / d.stripeCount;
  const profile =
    level === 0
      ? d.rings.filter((_, i) => [0, 2, 3, 6, 8, 9].includes(i))
      : level === 1
        ? d.rings.filter((_, i) => i !== 1 && i !== 7)
        : d.rings;
  band(out, 'paint', profile, sides, (i, y) => {
    const red = Math.floor(i / stride) % 2 === 0;
    return y < d.rings[2][0]
      ? red
        ? colors.lowerRed
        : colors.lowerWhite
      : red
        ? colors.red
        : colors.white;
  });
  const crown = d.rings.at(-1)[0];
  loft(
    out,
    'trim',
    [radialRing(crown - 0.13, 0.12, 0.12, 8), radialRing(crown + 0.17, 0.11, 0.11, 8)],
    colors.rod,
  );
  if (level >= 1) {
    const vent = (y, r) => radialRing(y, r, r, level === 1 ? 8 : 14, [4.25, 0.92]);
    loft(
      out,
      'trim',
      [vent(41.08, 0.35), vent(41.58, 0.35), vent(41.62, 0.64), vent(41.91, 0.61)],
      colors.rod,
    );
    beam(
      out,
      'trim',
      [-0.56, crown - 0.15, -0.39],
      [-0.56, d.peakReturn, -0.39],
      0.085,
      0.07,
      colors.rod,
    );
    if (level >= 2) {
      beam(out, 'trim', [0.07, crown + 0.06, 0], [0.07, crown + 0.41, 0], 0.05, 0.05, colors.rod);
      beam(
        out,
        'trim',
        [-0.57, crown + 0.19, -0.39],
        [0.09, crown + 0.31, 0],
        0.033,
        0.037,
        colors.seam,
      );
    }
  }
}

const glyph = {
  F: [
    [0, 0, 0, 1, 0.63, 1],
    [0, 0.55, 0.52, 0.55],
  ],
  L: [[0, 1, 0, 0, 0.65, 0]],
  O: [[0.12, 0, 0, 0.15, 0, 0.84, 0.12, 1, 0.55, 1, 0.67, 0.84, 0.67, 0.15, 0.55, 0, 0.12, 0]],
  R: [
    [0, 0, 0, 1, 0.49, 1, 0.64, 0.85, 0.64, 0.68, 0.49, 0.53, 0, 0.53],
    [0.3, 0.53, 0.67, 0],
  ],
  E: [
    [0.65, 1, 0, 1, 0, 0, 0.65, 0],
    [0, 0.52, 0.52, 0.52],
  ],
  N: [[0, 0, 0, 1, 0.66, 0, 0.66, 1]],
  C: [[0.65, 0.95, 0.52, 1, 0.14, 1, 0, 0.81, 0, 0.19, 0.15, 0, 0.52, 0, 0.65, 0.08]],
  Y: [
    [0, 1, 0.32, 0.53, 0.64, 1],
    [0.32, 0.53, 0.32, 0],
  ],
  A: [
    [0, 0, 0.29, 1, 0.39, 1, 0.69, 0],
    [0.12, 0.38, 0.55, 0.38],
  ],
  "'": [[0.19, 1, 0.14, 0.76]],
};

function paintPoint(u, y, radiusOffset, sides) {
  const angle = u / d.tankRadius;
  const segment = (angle * sides) / turn;
  const i = Math.floor(segment);
  const a = cylinder(d.tankRadius + radiusOffset, y, (i * turn) / sides);
  const b = cylinder(d.tankRadius + radiusOffset, y, ((i + 1) * turn) / sides);
  return [mix(a[0], b[0], segment - i), y, mix(a[2], b[2], segment - i)];
}
function inkQuad(out, azimuthSides, points, offset, color) {
  const angle = points.reduce((sum, p) => sum + p[0] / points.length, 0) / d.tankRadius;
  face(
    out,
    'paint',
    points.map(([x, y]) => paintPoint(x, y, offset, azimuthSides)),
    [Math.sin(angle), 0, Math.cos(angle)],
    color,
  );
}

function lettering(out, level) {
  const sides = [16, 32, 64, 96][level];
  const signLeft = -6.45,
    signRight = 6.45;
  const bottom = 33.12,
    top = 37.54;
  const interval = (d.tankRadius * turn) / sides;
  const edges = [signLeft];
  for (let i = Math.ceil(signLeft / interval); i * interval < signRight; i++)
    edges.push(i * interval);
  edges.push(signRight);
  for (const [a, b] of pairs(edges)) {
    inkQuad(
      out,
      sides,
      [
        [a, bottom],
        [b, bottom],
        [b, top],
        [a, top],
      ],
      0.019,
      colors.plate,
    );
  }
  if (level === 0) return;
  for (const [word, left, y, width, height] of [
    ['FLORENCE', -5.97, 35.4, 11.96, 1.69],
    ["Y'ALL", -3.03, 33.43, 6.05, 1.61],
  ]) {
    const spacing = width / word.length;
    for (let i = 0; i < word.length; i++) {
      for (const stroke of glyph[word[i]]) {
        const points = [];
        for (let k = 0; k < stroke.length; k += 2) {
          points.push([
            left + (i + stroke[k]) * spacing + spacing * 0.09,
            y + height * stroke[k + 1],
          ]);
        }
        for (const [[x0, y0], [x1, y1]] of pairs(points)) {
          const len = Math.hypot(x1 - x0, y1 - y0);
          const step = Math.ceil(len / 0.3);
          const amount = 0.106;
          const dx = (amount * (y1 - y0)) / len,
            dy = (amount * (x0 - x1)) / len;
          for (let k = 0; k < step; k++) {
            const a = k / step,
              b = (k + 1) / step;
            const ax = mix(x0, x1, a),
              ay = mix(y0, y1, a),
              bx = mix(x0, x1, b),
              by = mix(y0, y1, b);
            inkQuad(
              out,
              sides,
              [
                [ax + dx, ay + dy],
                [bx + dx, by + dy],
                [bx - dx, by - dy],
                [ax - dx, ay - dy],
              ],
              0.038,
              colors.letters,
            );
          }
        }
      }
    }
  }
}

function build(out, level) {
  column(out, level);
  tank(out, level);
  lettering(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'florence-y-all-water-tower-model.mjs';
const camera = [44, 23, 69],
  lookAt = [0, 20, 0];
const errors = { district: 0.43, street: 0.15, closeup: 0.06 };
export const florenceWaterTowerAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'tower',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Named tower center and the original state lidar ground. The state surface raster fixes the 42-metre crown.',
  brief:
    'Florence Y’all Water Tower, with its white ribbed column and flared tank in red and white, and two-line interstate-facing lettering.',
  camera,
  lookAt,
  sunDirection: [-85, 110, 150],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'The native circular footprint of the named raised tank.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'stone_ashlar'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'highway-facing-lettering', position: [0, 9, 61], lookAt: [0, 27, 0] },
    { name: 'striped-roof-and-hardware', position: [-20, 49, 33], lookAt: [0, 35, 0] },
    { name: 'ribbed-shaft-and-base', position: [17, 3.1, 36], lookAt: [0, 10, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'florence-water-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors, ODbL 1.0. Kentucky Division of Geographic Information, KyFromAbove Phase 2 elevation.',
};
