/** Bryant–Denny Stadium, November 2008, before the south upper deck. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const load = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = load('plan-controls');
const stadiumEnvelope = load('map-frame').geometry.polygons[0];
const {
  fieldY,
  fieldRing,
  foundationBottom,
  lowerBowl,
  sidelineDeck,
  northDeck,
  northFront,
  boards,
} = plan.section;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.13 },
  canopy: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.82, metallic: 0.12 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.33, metallic: 0.15 },
  field: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.98, metallic: 0 },
};
const palette = Object.fromEntries(
  Object.entries({
    concrete: 'b5b6ae',
    seat: '969b96',
    riser: 'a7aba4',
    fascia: 'cbc9be',
    brick: '906552',
    metal: '747c79',
    canopy: '7e8380',
    glass: '54727e',
    screen: '273032',
    crimson: '86303d',
    shade: '6c7470',
    field: '557a47',
    strip: '5d834e',
    chalk: 'e3e2cf',
  }).map(([key, value]) => [key, rgb(value)]),
);
const B = (out, slot, x, y, z, w, h, d, color = palette[slot]) =>
  box(out, slot, x, y, z, w, h, d, color);

function Q(out, slot, points, direction, color = palette[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  quad(out, slot, points, normal, color);
}
function level(out, slot, corners, y, color = palette[slot]) {
  Q(
    out,
    slot,
    corners.map(([x, z]) => [x, y, z]),
    [0, 1, 0],
    color,
  );
}
function band(out, slot, a, b, direction, color = palette[slot], closed = false) {
  const n = closed ? a.length : a.length - 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % a.length;
    const p = [a[i], a[j], b[j], b[i]];
    const toward = typeof direction === 'function' ? direction(p) : direction;
    Q(out, slot, p, toward, color);
  }
}
const outside = (points) => {
  const [x, , z] = points.reduce((a, b) => a.map((v, i) => v + b[i]), [0, 0, 0]);
  return [x, 0, z];
};
const inside = (points) => outside(points).map((v) => -v);
const blend = (a, b, t) => a + (b - a) * t;

function field(out, lod) {
  B(
    out,
    'concrete',
    0,
    foundationBottom,
    0,
    66,
    fieldY - foundationBottom - 0.012,
    128,
    palette.fascia,
  );
  level(out, 'field', fieldRing, fieldY);
  const x = 24.384;
  const z = 54.864;
  const mark = (cx, cz, w, d) =>
    level(
      out,
      'field',
      [
        [cx - w / 2, cz - d / 2],
        [cx + w / 2, cz - d / 2],
        [cx + w / 2, cz + d / 2],
        [cx - w / 2, cz + d / 2],
      ],
      fieldY + 0.021,
      palette.chalk,
    );
  for (const sign of [-1, 1]) {
    const inner = sign * 45.72,
      end = sign * z;
    level(
      out,
      'field',
      [
        [-x, inner],
        [x, inner],
        [x, end],
        [-x, end],
      ],
      fieldY + 0.013,
      palette.crimson,
    );
    mark(0, end, 2 * x - 0.15, 0.15);
    mark(sign * x, 0, 0.15, 2 * z);
    if (!lod) continue;
    beam(
      out,
      'metal',
      [0, fieldY, sign * 55.2],
      [0, fieldY + 3.1, sign * 55.2],
      0.13,
      0.13,
      palette.fascia,
    );
    B(out, 'metal', 0, fieldY + 3.03, sign * 55.2, 5.68, 0.13, 0.13, palette.fascia);
    for (const dx of [-2.82, 2.82])
      B(out, 'metal', dx, fieldY + 3.08, sign * 55.2, 0.11, 4.8, 0.11, palette.fascia);
  }
  for (let i = -5; i <= 5; i++) {
    const yard = i * 9.144;
    mark(0, yard, 2 * x - 0.15, 0.12);
    if (lod > 1 && i < 5)
      level(
        out,
        'field',
        [
          [-x, yard + 0.1],
          [x, yard + 0.1],
          [x, yard + 4.57],
          [-x, yard + 4.57],
        ],
        fieldY + 0.005,
        palette.strip,
      );
  }
  if (lod > 1)
    for (let i = -24; i <= 24; i++)
      for (const dx of [-8.23, 8.23]) mark(dx, i * 1.8288, 0.31, 0.09);
}
function roundedBowl(radius, y, segments, straights) {
  const [x, z] = lowerBowl.cornerCenters;
  const centers = [
    [x, z],
    [-x, z],
    [-x, -z],
    [x, -z],
  ];
  const corner = (i, t) => {
    const a = ((i + t) * Math.PI) / 2;
    return [centers[i][0] + Math.cos(a) * radius, y, centers[i][1] + Math.sin(a) * radius];
  };
  const points = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j <= segments; j++) points.push(corner(i, j / segments));
    const end = corner(i, 1),
      next = corner((i + 1) % 4, 0);
    for (let j = 1; j < straights; j++)
      points.push(end.map((v, k) => blend(v, next[k], j / straights)));
  }
  return points;
}
function seats(out, profile, rows, lod, normal, closed = false) {
  if (!lod) {
    band(out, 'concrete', profile(0, 0), profile(1, 1), [0, 1, 0], palette.seat, closed);
    return;
  }
  for (let i = 0; i < rows; i++) {
    const t = i / rows,
      u = (i + 1) / rows;
    const a = profile(t, t),
      b = profile(u, t);
    band(out, 'concrete', a, b, [0, 1, 0], i % 5 === 0 ? palette.riser : palette.seat, closed);
    band(out, 'concrete', b, profile(u, u), normal, palette.riser, closed);
  }
}
function lowerStand(out, lod) {
  const segments = [3, 3, 5, 7][lod],
    straights = [1, 2, 3, 5][lod];
  const ring = (r, y) => roundedBowl(r, y, segments, straights);
  const { innerRadius, outerRadius, lowerY, upperY, originalRows } = lowerBowl;
  const profile = (r, h) => ring(blend(innerRadius, outerRadius, r), blend(lowerY, upperY, h));
  seats(out, profile, [1, 8, 20, originalRows][lod], lod, inside, true);
  band(
    out,
    'concrete',
    ring(outerRadius, foundationBottom),
    profile(1, 1),
    outside,
    palette.concrete,
    true,
  );
  band(out, 'metal', profile(0, 0), ring(innerRadius, fieldY), inside, palette.crimson, true);
  if (lod)
    band(
      out,
      'metal',
      profile(1, 1),
      ring(outerRadius, upperY + 0.75),
      inside,
      palette.fascia,
      true,
    );
}
function sideDecks(out, lod) {
  const d = sidelineDeck;
  for (const sign of [-1, 1]) {
    const line = (t, h) => {
      const y = blend(d.baseY, d.upperY, h),
        x = sign * blend(d.innerX, d.outerX, t);
      const span = d.halfSpan + 4 * t;
      return [
        [x, y, -span],
        [x, y, span],
      ];
    };
    seats(out, line, [1, 8, 18, d.originalRows][lod], lod, [-sign, 0, 0]);
    band(
      out,
      'concrete',
      line(1, 1).map(([x, , z]) => [x, 20.5, z]),
      line(1, 1),
      [sign, 0, 0],
      palette.concrete,
    );
    for (const z of [-d.halfSpan, d.halfSpan])
      B(out, 'concrete', sign * 94, 15.4, z, 19.0, 4.1, 4.8, palette.fascia);
    B(out, 'concrete', sign * 83, 15.0, 0, 22.0, 2.0, 2 * d.halfSpan, palette.fascia);
    B(out, 'glass', sign * 73, 17.1, 0, 0.55, 1.64, 2 * d.halfSpan - 2);
    B(out, 'metal', sign * 72.66, 19.3, 0, 0.6, 0.82, 2 * d.halfSpan, palette.crimson);
    const concourses = lod >= 2 ? [6.4, 11.6, 16.8, 23.5, 30.3] : [11.6, 23.5];
    for (const y of concourses) {
      Q(
        out,
        'concrete',
        [
          [sign * 106.5, y, -73],
          [sign * 106.5, y, 73],
          [sign * 106.5, y - 0.72, 73],
          [sign * 106.5, y - 0.72, -73],
        ],
        [sign, 0, 0],
        palette.fascia,
      );
      Q(
        out,
        'concrete',
        [
          [sign * 106.5, y, -73],
          [sign * 106.5, y, 73],
          [sign * 84.5, y, 73],
          [sign * 84.5, y, -73],
        ],
        [0, 1, 0],
        palette.concrete,
      );
    }
    const outer = sign * d.canopyOuterX,
      inner = sign * d.canopyInnerX,
      y = d.canopyHeight;
    Q(
      out,
      'canopy',
      [
        [outer, y, -76],
        [inner, y - 1.6, -76],
        [inner, y - 1.6, 76],
        [outer, y, 76],
      ],
      [0, 1, 0],
    );
    Q(
      out,
      'metal',
      [
        [outer, y - 0.16, -76],
        [inner, y - 1.76, -76],
        [inner, y - 1.76, 76],
        [outer, y - 0.16, 76],
      ],
      [0, -1, 0],
    );
    B(out, 'metal', inner, y - 1.86, 0, 0.48, 0.61, 152, palette.fascia);
    const count = [4, 9, 13, 17][lod];
    for (let i = 0; i < count; i++) {
      const z = blend(-72, 72, i / (count - 1));
      B(out, 'concrete', sign * 106, foundationBottom, z, 1.36, 44.5, 2.1);
      if (lod) {
        beam(
          out,
          'concrete',
          [sign * 76, 19.2, z],
          [sign * 105, 39.7, z],
          0.91,
          1.04,
          palette.fascia,
        );
        beam(out, 'metal', [outer, y - 0.24, z], [inner, y - 1.85, z], 0.34, 0.43, palette.metal);
      }
    }
    if (lod > 1)
      for (let z = -68; z <= 68; z += 4.25)
        B(out, 'metal', sign * 72.61, 17.1, z, 0.13, 1.65, 0.16, palette.shade);
  }
}
function scoreboards(out, lod) {
  function panel(x, z, y, w, h, facing) {
    B(out, 'metal', x, y, z, w, h, 1.1, palette.crimson);
    B(out, 'glass', x, y + 0.62, z + facing * 0.59, w - 1.55, h - 1.19, 0.12, palette.screen);
    if (lod)
      for (const dx of [-0.37 * w, 0.37 * w])
        B(out, 'metal', x + dx, y - 3.0, z, 1.05, 3.0, 1.12, palette.shade);
    if (lod > 1) B(out, 'metal', x, y + h + 0.18, z, w * 0.65, 0.21, 0.21, palette.fascia);
  }
  for (const sign of [-1, 1]) panel(sign * boards.northPairX, boards.northZ, 17.1, 14.4, 6.7, -1);
  panel(0, boards.southZ, boards.southTop - 8.0, 25, 8.0, 1);
  for (const sign of [-1, 1])
    B(out, 'concrete', sign * 8.4, foundationBottom, boards.southZ, 1.9, 18.7, 1.75);
}
function rampTower(out, x, z, lod) {
  const radius = northFront.stairRadius;
  const n = [6, 12, 14, 18][lod];
  const turns = [3, 5, 5, 6][lod];
  const columns = lod ? 8 : 3;
  const rise = 22.3 / (turns - 1);
  for (let turn = 0; turn < turns; turn++) {
    const y = 1.2 + turn * rise;
    for (let i = 0; i < n; i++) {
      const point = (j, r, h) => {
        const a = (2 * Math.PI * j) / n;
        return [x + Math.cos(a) * r, y + h + (j / n) * 2.1, z + Math.sin(a) * r];
      };
      const a = point(i, radius, 0),
        b = point(i + 1, radius, 0);
      Q(
        out,
        'concrete',
        [a, b, point(i + 1, radius - 4.2, 0), point(i, radius - 4.2, 0)],
        [0, 1, 0],
      );
      Q(
        out,
        'concrete',
        [a, b, point(i + 1, radius, -0.52), point(i, radius, -0.52)],
        [a[0] + b[0] - 2 * x, 0, a[2] + b[2] - 2 * z],
        palette.fascia,
      );
    }
  }
  for (let i = 0; i < columns; i++) {
    const a = (2 * Math.PI * i) / columns;
    B(
      out,
      'concrete',
      x + Math.cos(a) * (radius - 0.64),
      foundationBottom,
      z + Math.sin(a) * (radius - 0.64),
      1.16,
      25.7,
      1.16,
    );
  }
}
function northStand(out, lod) {
  const d = northDeck,
    f = northFront;
  const slices = [8, 12, 18, 24][lod];
  const profile = (t, h) =>
    Array.from({ length: slices + 1 }, (_, i) => {
      const q = (i / slices) * 2 - 1;
      const x = q * blend(d.halfSpan - 6, d.halfSpan, t);
      const z = blend(d.frontZ, d.backZ, t) - d.cornerSweep * q * q;
      return [x, blend(d.baseY, d.upperY, h), z];
    });
  seats(out, profile, [1, 7, 17, d.originalRows][lod], lod, [0, 0, -1]);
  const rim = profile(1, 1);
  const backUnderside = rim.map(([x, y, z]) => [x, y - 1.2, z - 0.21]);
  const frontUnderside = profile(0, 0).map(([x, y, z]) => [x, y - 1.2, z]);
  band(out, 'concrete', backUnderside, rim, [0, 0, 1], palette.concrete);
  band(out, 'concrete', backUnderside, frontUnderside, [0, -1, 0], palette.shade);
  if (lod)
    for (let i = 1; i < slices; i += lod < 3 ? 2 : 1) {
      beam(out, 'concrete', frontUnderside[i], backUnderside[i], 0.88, 1.07, palette.fascia);
    }
  band(
    out,
    'metal',
    rim,
    rim.map(([x, y, z]) => [x, y + 0.78, z]),
    [0, 0, 1],
    palette.fascia,
  );
  const frontWidth = f.width;
  B(out, 'brick', 0, foundationBottom, f.z - 10, frontWidth, 28.3, 17.3);
  B(
    out,
    'concrete',
    0,
    foundationBottom,
    f.z + 0.27,
    f.glazingWidth + 6.2,
    13.2,
    1.58,
    palette.fascia,
  );
  B(out, 'glass', 0, 2.2, f.z + 1.11, f.glazingWidth - 1.9, 7.8, 0.32);
  B(out, 'brick', 0, 13.0, f.z - 0.62, f.glazingWidth + 8.7, 11.1, 1.74);
  B(out, 'glass', 0, 14.8, f.z + 0.32, f.glazingWidth + 7.9, 8.1, 0.31);
  for (const x of f.brickPierOffsets) {
    B(out, 'brick', x, foundationBottom, f.z, 3.8, 29.3, 7.2);
    B(out, 'concrete', x, 26.7, f.z + 0.04, 4.18, 2.8, 7.41, palette.fascia);
    if (lod)
      for (const y of [3.0, 7.5, 12, 16.5, 21.0])
        B(out, 'concrete', x, y, f.z + 0.1, 4.01, 0.42, 7.31, palette.fascia);
  }
  for (const sign of [-1, 1]) {
    rampTower(out, sign * 64, f.z - 19, lod);
    if (lod)
      for (let i = 0; i < 5; i++) {
        const y = i * 4.45 + 1.07;
        B(out, 'concrete', sign * 51.5, y, f.z - 6.2, 9.6, 0.53, 11.6, palette.fascia);
      }
  }
  for (let i = 0; i < (lod ? 4 : 2); i++)
    B(
      out,
      'concrete',
      0,
      foundationBottom,
      f.z + 3.2 + i * 0.72,
      f.glazingWidth + 4.1,
      2.54 - i * 0.52,
      2.8,
      palette.fascia,
    );
  if (lod) {
    for (const y of [18.0, 21.7, 25.4]) {
      const low = profile(0, 0).map(([x, , z]) => [x, y, z + 1.07]);
      const high = low.map(([x, , z]) => [x, y + 1.64, z]);
      band(out, 'glass', low, high, [0, 0, -1]);
      band(
        out,
        'concrete',
        high,
        high.map(([x, y, z]) => [x, y + 0.54, z - 0.2]),
        [0, 0, -1],
        palette.fascia,
      );
    }
    for (let i = 0; i < 13; i++) {
      const x = blend(-59, 59, i / 12);
      const z = d.backZ - d.cornerSweep * Math.pow(x / d.halfSpan, 2);
      const y = d.upperY + 0.75;
      B(out, 'metal', x, y, z - 0.24, 0.095, 2.85, 0.095, palette.fascia);
      if (lod > 1) {
        const a = [x, y + 2.1, z - 0.24],
          b = [x + 1.45, y + 2.32, z - 0.24];
        Q(
          out,
          'metal',
          [a, b, [b[0], b[1] + 0.74, b[2]], [a[0], a[1] + 0.74, a[2]]],
          [0, 0, 1],
          palette.crimson,
        );
      }
    }
  }
  if (lod > 1)
    for (let i = -8; i <= 8; i++) {
      const x = i * 1.95;
      B(out, 'metal', x, 2.2, f.z + 1.29, 0.13, 7.8, 0.14, palette.shade);
      B(out, 'metal', x, 14.8, f.z + 0.54, 0.12, 8.1, 0.13, palette.shade);
    }
}
function build(out, _frame, lod = 3) {
  field(out, lod);
  lowerStand(out, lod);
  sideDecks(out, lod);
  northStand(out, lod);
  scoreboards(out, lod);
}
export const stadiumSkyline = (out) => build(out, undefined, 0);
export const stadiumDistrict = (out) => build(out, undefined, 1);
export const stadiumStreet = (out) => build(out, undefined, 2);
export const stadiumCloseup = (out) => build(out, undefined, 3);

const recipe = 'stadium-model.mjs';
const camera = [207, 119, 208],
  lookAt = [0, 13, 0];
export const stadiumModel = {
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
    'The 2008 Bryant–Denny Stadium, with its north upper stand, covered sideline decks and lower south bowl.',
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
    outline: stadiumEnvelope,
    minimumCoverage: 0.95,
    basis:
      'Suppress only the named modern stadium building footprint when the 2008 stand layout is active.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'brick_flemish', 'metal_painted', 'metal_corrugated'],
  qaCameras: [
    { name: 'north-entrance-and-ramp-towers', position: [37, 20, 207], lookAt: [0, 19, 118] },
    { name: 'field-and-north-upper-stand', position: [-36, 36, -79], lookAt: [9, 15, 48] },
    { name: 'lower-south-end-and-sideline-decks', position: [176, 96, -186], lookAt: [0, 12, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-bryant-denny-stadium-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'stadiumSkyline',
    errorMeters: 0.78,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'stadiumDistrict', 0.35],
        ['street', 'stadiumStreet', 0.17],
        ['closeup', 'stadiumCloseup', 0.063],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap contributors supply mapped controls under ODbL. The cited reference originals are public domain.',
};
