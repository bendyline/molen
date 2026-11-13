/** Circa-1890 exterior of the former Portuguese compound in Ouidah. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const perimeter = read('map-frame').geometry.polygons[0];
const grid = read('terrain-grid');
const {
  wallHeight,
  frontWallThickness,
  sideWallThickness,
  wallEmbed,
  gateEaves,
  gateRidge,
  chapelEaves,
  chapelRidge,
  chapelTop,
} = plan.section;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.92, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.74, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    plaster: 'd4c5ab',
    shadow: 'b6a487',
    wallCap: 'bcaa8d',
    stone: 'a7987f',
    roof: '976752',
    roofEdge: '7f5848',
    wood: '78634e',
    glass: '555449',
    light: 'e0d0b5',
  }).map(([name, value]) => [name, rgb(value)]),
);

function face(out, slot, p, outward, color = tone[slot]) {
  let n = normalFor(...p);
  if (n.reduce((sum, v, i) => sum + v * outward[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(out, slot, p, n, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      p,
      n,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}
const yPoint = ([x, z], y) => [x, y, z];
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
function ground([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters;
  const v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const h = (row) =>
    grid.heightsMeters[row][i] * (1 - (u - i)) + grid.heightsMeters[row][i + 1] * (u - i);
  return h(j) * (1 - (v - j)) + h(j + 1) * (v - j) - grid.modelDatumElevationMeters;
}

const [backLeft, backRight, frontLeft, frontRight] = plan.court.corners.map((i) => perimeter[i]);
const gateCenter = mix(frontLeft, frontRight, 0.5);
const mapPoint = (u, v) => mix(mix(backLeft, backRight, u), mix(frontLeft, frontRight, u), v);
function dimensions(key) {
  const [u0, u1, v0, v1] = plan.court.rectangles[key];
  const p = [mapPoint(u0, v0), mapPoint(u0, v1), mapPoint(u1, v1), mapPoint(u1, v0)];
  return p[0]
    .map((_, i) => [Math.min(...p.map((q) => q[i])), Math.max(...p.map((q) => q[i]))])
    .flat();
}

function enclosure(out, lod) {
  const normal = (a, b) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[1] - a[1]) / length, (a[0] - b[0]) / length];
  };
  const gateWidth = 3.1;
  const thickness = (i) => (i >= 24 && i <= 46 ? frontWallThickness : sideWallThickness);
  const inner = perimeter.map((p, i) => {
    const previous = perimeter[(i + perimeter.length - 1) % perimeter.length];
    const next = perimeter[(i + 1) % perimeter.length];
    const a = normal(previous, p),
      b = normal(p, next);
    const scale = thickness(i) / (1 + Math.max(-0.45, a[0] * b[0] + a[1] * b[1]));
    return [p[0] + (a[0] + b[0]) * scale, p[1] + (a[1] + b[1]) * scale];
  });
  for (const [i, p] of perimeter.entries()) {
    const j = (i + 1) % perimeter.length,
      q = perimeter[j],
      a = inner[i],
      b = inner[j];
    const offset = gateWidth / (2 * Math.hypot(q[0] - p[0], q[1] - p[1]));
    const ranges =
      i === 34
        ? [
            [0, 0.5 - offset],
            [0.5 + offset, 1],
          ]
        : [[0, 1]];
    for (const [start, end] of ranges) {
      const outer0 = mix(p, q, start),
        outer1 = mix(p, q, end);
      const inner0 = mix(a, b, start),
        inner1 = mix(a, b, end);
      const low0 = ground(outer0) - wallEmbed,
        low1 = ground(outer1) - wallEmbed;
      const high0 = low0 + wallHeight + wallEmbed,
        high1 = low1 + wallHeight + wallEmbed;
      const inward = normal(outer0, outer1),
        n = [inward[0], 0, inward[1]];
      face(
        out,
        'plaster',
        [yPoint(outer0, low0), yPoint(outer1, low1), yPoint(outer1, high1), yPoint(outer0, high0)],
        n.map((v) => -v),
      );
      face(
        out,
        'plaster',
        [yPoint(inner0, low0), yPoint(inner1, low1), yPoint(inner1, high1), yPoint(inner0, high0)],
        n,
        tone.shadow,
      );
      face(
        out,
        'trim',
        [
          yPoint(outer0, high0),
          yPoint(outer1, high1),
          yPoint(inner1, high1),
          yPoint(inner0, high0),
        ],
        [0, 1, 0],
        tone.wallCap,
      );
      if (lod >= 3)
        face(
          out,
          'trim',
          [
            yPoint(outer0, high0 - 0.13),
            yPoint(outer1, high1 - 0.13),
            [outer1[0] - n[0] * 0.035, high1, outer1[1] - n[2] * 0.035],
            [outer0[0] - n[0] * 0.035, high0, outer0[1] - n[2] * 0.035],
          ],
          n.map((v) => -v),
          tone.light,
        );
    }
  }
}
function block(out, slot, [x0, x1, z0, z1], bottom, top, color) {
  B(out, slot, (x0 + x1) / 2, bottom, (z0 + z1) / 2, x1 - x0, top - bottom, z1 - z0, color);
}
function localBounds([x0, x1, z0, z1], offset) {
  return [x0 - offset, x1 + offset, z0 - offset, z1 + offset];
}
function gable(out, [x0, x1, z0, z1], eaves, ridge, alongZ, color = tone.roof) {
  const xm = (x0 + x1) / 2,
    zm = (z0 + z1) / 2;
  const slopePoints = alongZ
    ? [
        [
          [x0, eaves, z0],
          [x0, eaves, z1],
          [xm, ridge, z1],
          [xm, ridge, z0],
        ],
        [
          [x1, eaves, z0],
          [x1, eaves, z1],
          [xm, ridge, z1],
          [xm, ridge, z0],
        ],
      ]
    : [
        [
          [x0, eaves, z0],
          [x1, eaves, z0],
          [x1, ridge, zm],
          [x0, ridge, zm],
        ],
        [
          [x0, eaves, z1],
          [x1, eaves, z1],
          [x1, ridge, zm],
          [x0, ridge, zm],
        ],
      ];
  for (const p of slopePoints) face(out, 'roof', p, [0, 1, 0], color);
  if (alongZ) {
    for (const [z, sign] of [
      [z0, -1],
      [z1, 1],
    ])
      face(
        out,
        'plaster',
        [
          [x0, eaves, z],
          [x1, eaves, z],
          [xm, ridge, z],
        ],
        [0, 0, sign],
        tone.shadow,
      );
  } else {
    for (const [x, sign] of [
      [x0, -1],
      [x1, 1],
    ])
      face(
        out,
        'plaster',
        [
          [x, eaves, z0],
          [x, eaves, z1],
          [x, ridge, zm],
        ],
        [sign, 0, 0],
        tone.shadow,
      );
  }
}
function frontOpening(out, x, z, y, w, h, lod, wood = false, sign = 1) {
  const panel = (slot, left, right, lo, hi, depth, color) =>
    face(
      out,
      slot,
      [
        [left, lo, z + sign * depth],
        [right, lo, z + sign * depth],
        [right, hi, z + sign * depth],
        [left, hi, z + sign * depth],
      ],
      [0, 0, sign],
      color,
    );
  panel('trim', x - w / 2 - 0.09, x + w / 2 + 0.09, y - 0.08, y + h + 0.13, 0.048, tone.light);
  panel(
    wood ? 'wood' : 'glass',
    x - w / 2,
    x + w / 2,
    y,
    y + h,
    0.071,
    wood ? tone.wood : tone.glass,
  );
  if (lod >= 2) panel('wood', x - 0.04, x + 0.04, y, y + h, 0.087, tone.wood);
}
function sideOpening(out, x, z, y, w, h, lod, sign) {
  const panel = (slot, half, lo, hi, depth, color) =>
    face(
      out,
      slot,
      [
        [x + sign * depth, lo, z - half],
        [x + sign * depth, lo, z + half],
        [x + sign * depth, hi, z + half],
        [x + sign * depth, hi, z - half],
      ],
      [sign, 0, 0],
      color,
    );
  panel('trim', w / 2 + 0.1, y - 0.1, y + h + 0.13, 0.042, tone.light);
  panel('glass', w / 2, y, y + h, 0.065, tone.glass);
  if (lod >= 2) panel('wood', 0.038, y, y + h, 0.081, tone.wood);
}

function gatehouse(out, lod) {
  const zFront = gateCenter[1] + 0.25,
    x = gateCenter[0];
  const measured = dimensions('gatehouse');
  const z0 = measured[2],
    x0 = x - 5.15,
    x1 = x + 5.15;
  const base = ground([x, zFront]) - 0.28;
  const doorTop = base + 2.95;
  for (const [a, b] of [
    [x0, x - 1.52],
    [x + 1.52, x1],
  ])
    block(out, 'plaster', [a, b, z0, zFront], base, doorTop, tone.plaster);
  block(out, 'plaster', [x0, x1, z0, zFront], doorTop, base + gateEaves, tone.plaster);
  gable(out, localBounds([x0, x1, z0, zFront], 0.43), base + gateEaves, base + gateRidge, false);
  for (const off of [-2.2, 2.2]) frontOpening(out, x + off, zFront, base + 3.42, 0.89, 1.21, lod);
  if (lod) {
    for (const off of [-2.2, 2.2])
      frontOpening(out, x + off, z0, base + 3.46, 0.81, 1.15, lod, false, -1);
    const roofZ = (z0 + zFront) / 2;
    for (const sign of [-1, 1])
      sideOpening(out, x + sign * 5.15, roofZ, base + 3.51, 0.83, 1.1, lod, sign);
    B(out, 'trim', x, doorTop - 0.16, zFront + 0.038, 3.24, 0.23, 0.24, tone.wallCap);
    for (const side of [-1, 1])
      B(
        out,
        'trim',
        x + side * 1.57,
        base + 0.14,
        zFront + 0.04,
        0.16,
        doorTop - base - 0.17,
        0.24,
        tone.stone,
      );
  }
}
function smallRange(out, key, height, rise, lod, windows = 0) {
  const [x0, x1, z0, z1] = dimensions(key);
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const grade = ground([x, z]),
    base = grade - 0.33,
    eaves = grade + height;
  block(out, 'plaster', [x0, x1, z0, z1], base, eaves, tone.plaster);
  gable(out, localBounds([x0, x1, z0, z1], 0.26), eaves, eaves + rise, true);
  if (lod) {
    frontOpening(out, x, z1, grade + 0.06, 0.91, 1.95, lod, true);
    const sign = x < 0 ? 1 : -1,
      sideX = sign > 0 ? x1 : x0;
    for (let i = 1; i <= windows; i++)
      sideOpening(
        out,
        sideX,
        z0 + ((z1 - z0) * i) / (windows + 1),
        grade + (height > 4 ? 2.72 : 1.03),
        0.85,
        1.12,
        lod,
        sign,
      );
  }
}
function chapel(out, lod) {
  const [x0, x1, z0, z1] = dimensions('chapel');
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const grade = ground([x, z]);
  block(out, 'plaster', [x0, x1, z0, z1 - 2.1], grade - 0.35, grade + chapelEaves, tone.plaster);
  gable(
    out,
    localBounds([x0, x1, z0, z1 - 2.1], 0.27),
    grade + chapelEaves,
    grade + chapelRidge,
    true,
  );
  const towerZ = z1 - 0.67,
    radius = 1.62;
  block(
    out,
    'plaster',
    [x - radius, x + radius, towerZ - radius, towerZ + radius],
    grade - 0.28,
    grade + 5.25,
    tone.light,
  );
  const crown = [x, grade + chapelTop, towerZ];
  const roofRadius = radius + 0.19;
  const base = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => [x + a * roofRadius, grade + 5.25, towerZ + b * roofRadius]);
  for (const [i, p] of base.entries())
    face(out, 'roof', [p, base[(i + 1) % base.length], crown], [0, 1, 0]);
  frontOpening(out, x, towerZ + radius, grade + 0.12, 1.13, 2.27, lod, true);
  if (lod) {
    frontOpening(out, x, towerZ + radius, grade + 3.66, 0.56, 1.08, lod);
    for (const sign of [-1, 1])
      for (const zAt of [z - 5.4, z + 0.45])
        sideOpening(out, sign < 0 ? x0 : x1, zAt, grade + 1.68, 0.82, 1.24, lod, sign);
  }
  if (lod >= 2) {
    beam(
      out,
      'wood',
      [x, grade + chapelTop - 0.04, towerZ],
      [x, grade + chapelTop + 0.74, towerZ],
      0.09,
      0.085,
      tone.wood,
    );
    beam(
      out,
      'wood',
      [x - 0.22, grade + chapelTop + 0.48, towerZ],
      [x + 0.22, grade + chapelTop + 0.48, towerZ],
      0.074,
      0.074,
      tone.wood,
    );
  }
}
function build(out, _frame, lod = 3) {
  enclosure(out, lod);
  gatehouse(out, lod);
  smallRange(out, 'westRange', 2.91, 1.68, lod, 5);
  smallRange(out, 'eastRange', 3.91, 1.57, lod, 5);
  smallRange(out, 'westAnnex', 2.39, 0.79, lod);
  smallRange(out, 'eastAnnex', 2.49, 0.87, lod, 1);
  smallRange(out, 'courtStore', 2.63, 0.86, lod);
  chapel(out, lod);
}
export const fortSkyline = (out) => build(out, undefined, 0);
export const fortDistrict = (out) => build(out, undefined, 1);
export const fortStreet = (out) => build(out, undefined, 2);
export const fortCloseup = (out) => build(out, undefined, 3);

const recipe = 'fort-model.mjs',
  camera = [-104, 67, 117],
  lookAt = [0, 4, 3];
export const fortModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The low pale enclosure, entrance house, chapel and tile-roofed buildings of the former Portuguese compound in Ouidah around 1890.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: perimeter,
    minimumCoverage: 0.97,
    basis:
      'The named enclosure defines the period compound. The dated view displays the archival building arrangement within it.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone_weathered', 'tile_flat', 'wood_plain'],
  qaCameras: [
    { name: 'front-enclosure-and-gatehouse', position: [29, 10, 104], lookAt: [3, 3, 32] },
    { name: 'interior-court-and-chapel', position: [22, 27, 53], lookAt: [1, 4, 1] },
    { name: 'archival-compound-plan', position: [4, 119, 36], lookAt: [0, 1, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-ouidah-fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'fortSkyline',
    errorMeters: 0.31,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'fortDistrict', 0.16],
        ['street', 'fortStreet', 0.064],
        ['closeup', 'fortCloseup', 0.022],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The two dated reference drawings are public-domain works. OpenStreetMap contributors supply the surviving enclosure under ODbL.',
};
