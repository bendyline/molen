/** Late operating Lyttelton Gaol, around 1903. A factual exterior reconstruction. */
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

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const ground = read('terrain-grid');
const { courts, entrance, floorToCeiling, perimeter, earlierRangeStoreys, eastRangeStoreys } =
  plan.section;
const [exercise, work, narrow, small] = courts;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  rubble: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.87, metallic: 0.09 },
  siding: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.9, metallic: 0.07 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
};
const palette = Object.fromEntries(
  Object.entries({
    concrete: 'a9a194',
    rubble: '786c63',
    trim: 'd1c3a7',
    roof: '697374',
    siding: 'b3aca0',
    wood: '665b4d',
    dark: '4a4b43',
    iron: '5b625c',
    paved: '9d9788',
  }).map(([key, value]) => [key, rgb(value)]),
);
const B = (out, slot, x, y, z, w, h, d, tone = palette[slot]) =>
  box(out, slot, x, y, z, w, h, d, tone);
const extent = ({ x, z, width, depth }) => [x, x + width, z, z + depth];

function groundAt(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters;
  const v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = ground.heightsMeters[j],
    b = ground.heightsMeters[j + 1];
  const top = a[i] + (a[i + 1] - a[i]) * (u - i);
  const bottom = b[i] + (b[i + 1] - b[i]) * (u - i);
  return top + (bottom - top) * (v - j) - ground.modelDatumElevationMeters;
}
function Q(out, slot, points, direction, color = palette[slot]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}
function slab(out, slot, [x0, x1, z0, z1], y, top, color = palette[slot]) {
  B(out, slot, (x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, top - y, z1 - z0, color);
}
function foundation(out, rect, top) {
  const [x0, x1, z0, z1] = rect;
  const low = Math.min(
    top - 0.75,
    ...[x0, x1].flatMap((x) => [z0, z1].map((z) => groundAt(x, z) - 0.65)),
  );
  slab(out, 'rubble', rect, low, top);
}
function gable(out, bounds, eaves, rise, axis, wall, lod, tone = palette.roof) {
  const [x0, x1, z0, z1] = bounds;
  const [a, b, start, end] = axis === 'z' ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  const p = (across, y, along) => (axis === 'z' ? [across, y, along] : [along, y, across]);
  const mid = (a + b) / 2;
  const top = eaves + rise;
  const lip = 0.23;
  for (const side of [a - lip, b + lip])
    Q(
      out,
      'roof',
      [
        p(side, eaves, start - lip),
        p(side, eaves, end + lip),
        p(mid, top, end + lip),
        p(mid, top, start - lip),
      ],
      [0, 1, 0],
      tone,
    );
  for (const [coord, sign] of [
    [start, -1],
    [end, 1],
  ]) {
    const direction = axis === 'z' ? [0, 0, sign] : [sign, 0, 0];
    Q(out, wall, [p(a, eaves, coord), p(b, eaves, coord), p(mid, top, coord)], direction);
    if (lod)
      for (const side of [a - lip, b + lip]) {
        const r = coord + sign * (lip + 0.025);
        beam(out, 'wood', p(side, eaves, r), p(mid, top, r), 0.115, 0.12, palette.iron);
      }
  }
}
function faceOf(axis, coordinate, sign) {
  return {
    at: (u, y, d = 0) =>
      axis === 'z' ? [u, y, coordinate + sign * d] : [coordinate + sign * d, y, u],
    normal: axis === 'z' ? [0, 0, sign] : [sign, 0, 0],
  };
}
function panel(out, slot, side, x0, x1, y0, y1, offset, color = palette[slot]) {
  Q(
    out,
    slot,
    [
      side.at(x0, y0, offset),
      side.at(x1, y0, offset),
      side.at(x1, y1, offset),
      side.at(x0, y1, offset),
    ],
    side.normal,
    color,
  );
}
function window(out, side, u, y, w, h, lod, pointed) {
  const left = u - w / 2,
    right = u + w / 2;
  panel(out, 'trim', side, left - 0.095, right + 0.095, y - 0.095, y + h + 0.09, 0.022);
  const head = pointed ? y + h - 0.31 : y + h;
  panel(out, 'wood', side, left, right, y, head, 0.047, palette.dark);
  if (pointed)
    Q(
      out,
      'wood',
      [side.at(left, head, 0.047), side.at(right, head, 0.047), side.at(u, y + h, 0.047)],
      side.normal,
      palette.dark,
    );
  if (lod >= 2) {
    panel(out, 'trim', side, left - 0.16, right + 0.16, y - 0.12, y - 0.045, 0.077);
    panel(out, 'wood', side, u - 0.027, u + 0.027, y, head, 0.072, palette.iron);
    panel(out, 'wood', side, left, right, y + h * 0.52, y + h * 0.52 + 0.047, 0.074, palette.iron);
  }
  if (lod === 3 && pointed) {
    for (const x of [left - 0.04, right + 0.04])
      panel(out, 'trim', side, x - 0.028, x + 0.028, y - 0.06, head + 0.035, 0.062);
  }
}
function range(out, rect, base, stories, spacing, axis, rise, lod, wall = 'concrete') {
  foundation(out, rect, base);
  const eaves = base + stories * spacing + 0.31;
  slab(out, wall, rect, base, eaves);
  gable(out, rect, eaves, rise, axis, wall, lod);
  return eaves;
}
function cellWindows(out, side, start, end, base, stories, pitch, spacing, lod) {
  if (!lod) return;
  const count = Math.max(2, Math.round((end - start) / pitch));
  const step = (end - start) / count;
  for (let i = 0; i < count; i += lod === 1 ? 2 : 1) {
    const u = start + (i + 0.5) * step;
    for (let floor = 0; floor < stories; floor++)
      window(out, side, u, base + floor * spacing + 1.18, 0.6, 1.08, lod, false);
  }
}
function residence(out, rect, base, wall, gableCenter, lod) {
  const [x0, x1, z0, z1] = rect;
  const spacing = 3.02;
  const eaves = range(out, rect, base, 2, spacing, 'x', 2.8, lod, wall);
  const width = 3.95,
    reach = 3.7;
  const projection = [gableCenter - width / 2, gableCenter + width / 2, z1 - reach, z1 + 0.4];
  slab(out, wall, projection, base, eaves);
  gable(out, projection, eaves, 3.21, 'z', wall, lod);
  const front = faceOf('z', z1, 1);
  for (const y of [base + 0.52, base + spacing]) {
    B(out, 'trim', (x0 + x1) / 2, y, z1 + 0.03, x1 - x0, 0.19, 0.17);
  }
  const principal = faceOf('z', projection[3], 1);
  for (const y of [base + 1.05, base + 4.05]) {
    for (const x of [x0 + 1.72, x1 - 1.69]) window(out, front, x, y, 0.86, 1.68, lod, true);
    window(out, principal, gableCenter, y + 0.12, 1.46, 1.6, lod, true);
  }
  if (lod) window(out, principal, gableCenter, eaves + 0.46, 0.76, 1.06, lod, true);
  for (const x of [x0 + 2.12, x1 - 2.0]) {
    B(out, 'rubble', x, eaves + 1.36, z0 + 1.65, 0.73, 2.68, 0.79);
    if (lod) B(out, 'trim', x, eaves + 3.86, z0 + 1.65, 0.88, 0.19, 0.91);
  }
}
function gate(out, lod) {
  const { center: x, frontZ, backZ, floor, openingWidth, spring, apex } = entrance;
  const half = openingWidth / 2,
    outer = 3.08;
  const springY = floor + spring,
    apexY = floor + apex,
    top = floor + 6.18;
  for (const z of [frontZ, backZ]) {
    const front = z === frontZ,
      sign = front ? 1 : -1;
    const s = faceOf('z', z, sign);
    panel(out, 'concrete', s, x - outer, x - half, floor, top, 0);
    panel(out, 'concrete', s, x + half, x + outer, floor, top, 0);
    for (const dir of [-1, 1]) {
      const n = [0, 0, sign];
      const points = [
        s.at(x + dir * half, springY),
        s.at(x, apexY),
        s.at(x, top),
        s.at(x + dir * half, top),
      ];
      Q(out, 'concrete', points, n);
      Q(
        out,
        'trim',
        [
          s.at(x + dir * half, springY, 0.042),
          s.at(x, apexY, 0.042),
          s.at(x, apexY + 0.28, 0.042),
          s.at(x + dir * (half + 0.23), springY + 0.1, 0.042),
        ],
        n,
      );
      const [a, b] = [x + dir * half, x + dir * (half + 0.23)].sort((a, b) => a - b);
      panel(out, 'trim', s, a, b, floor, springY + 0.1, 0.042);
    }
  }
  for (const sign of [-1, 1]) {
    const jamb = x + sign * half,
      outside = x + sign * outer;
    Q(
      out,
      'concrete',
      [
        [jamb, floor, backZ],
        [jamb, floor, frontZ],
        [jamb, springY, frontZ],
        [jamb, springY, backZ],
      ],
      [-sign, 0, 0],
    );
    Q(
      out,
      'concrete',
      [
        [outside, floor, backZ],
        [outside, floor, frontZ],
        [outside, top, frontZ],
        [outside, top, backZ],
      ],
      [sign, 0, 0],
    );
    Q(
      out,
      'trim',
      [
        [jamb, springY, backZ],
        [jamb, springY, frontZ],
        [x, apexY, frontZ],
        [x, apexY, backZ],
      ],
      [0, -1, 0],
    );
    B(out, 'trim', x + sign * (outer - 0.29), floor, frontZ + 0.12, 0.55, 6.39, 0.76);
  }
  foundation(out, [x - outer, x + outer, backZ, frontZ + 0.05], floor);
  gable(out, [x - outer, x + outer, backZ, frontZ], top, 1.7, 'z', 'concrete', lod);
  const approach = frontZ + 1.54;
  const roadGrade = groundAt(x, approach);
  if (lod) stairs(out, x, 3.85, frontZ, approach, roadGrade, floor, lod);
  else slab(out, 'trim', [x - 1.925, x + 1.925, frontZ, approach], roadGrade - 0.28, floor - 0.24);
  if (lod) window(out, faceOf('z', frontZ, 1), x, apexY + 0.3, 0.68, 0.86, lod, true);
}
function wall(out, a, b, height, lod) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const count = Math.ceil(length / (lod === 0 ? 20 : 5.5));
  const normal = [dz / length, 0, -dx / length];
  const p = (i, offset, top) => {
    const x = a[0] + (dx * i) / count,
      z = a[1] + (dz * i) / count,
      y = groundAt(x, z);
    return [x + normal[0] * offset, y + (top ? height : -0.56), z + normal[2] * offset];
  };
  for (let i = 0; i < count; i++) {
    for (const s of [-1, 1])
      Q(
        out,
        'concrete',
        [
          p(i, s * 0.34, false),
          p(i + 1, s * 0.34, false),
          p(i + 1, s * 0.34, true),
          p(i, s * 0.34, true),
        ],
        normal.map((v) => s * v),
      );
    Q(
      out,
      'trim',
      [p(i, -0.37, true), p(i + 1, -0.37, true), p(i + 1, 0.37, true), p(i, 0.37, true)],
      [0, 1, 0],
    );
  }
}
function stairs(out, x, width, highZ, lowZ, low, high, lod) {
  const n = lod === 0 ? 6 : Math.ceil((high - low) / 0.185);
  const tread = (lowZ - highZ) / n;
  for (let i = 0; i < n; i++) {
    const z0 = lowZ - (i + 1) * tread,
      z1 = lowZ - i * tread;
    const y = low + ((high - low) * (i + 1)) / n;
    const bottom = Math.min(y - 0.32, groundAt(x, z0) - 0.25);
    slab(out, 'trim', [x - width / 2, x + width / 2, z0, z1], bottom, y, palette.paved);
  }
}
function terraces(out, lod) {
  for (const c of courts) {
    foundation(out, extent(c), c.floor - 0.09);
    slab(out, 'concrete', extent(c), c.floor - 0.09, c.floor, palette.paved);
  }
  stairs(out, -10, 4.1, 27.84, 32.2, entrance.floor, exercise.floor, lod);
  stairs(out, -6.35, 4.15, -5.84, 4.15, exercise.floor, work.floor, lod);
  if (lod) {
    for (const [x0, x1, z0, z1, y] of [
      [-20.54, -19.75, 4.2, 27.75, exercise.floor],
      [2.12, 2.91, 4.2, 27.75, exercise.floor],
      [-20.79, -20.02, -28.95, -5.85, work.floor],
    ]) {
      slab(out, 'trim', [x0, x1, z0, z1], y, y + 0.055, palette.trim);
    }
  }
  const earlier = floorToCeiling.earlierCells + 0.26,
    newer = floorToCeiling.eastCells + 0.25;
  const northern = [-26.06, -20.55, 4.1, 27.84],
    southern = [2.92, 7.12, 4.1, 27.84];
  foundation(out, northern, exercise.floor);
  const eaves = exercise.floor + earlierRangeStoreys * earlier + 0.31;
  slab(out, 'concrete', northern, exercise.floor, eaves);
  for (let i = 0; i < 3; i++) {
    const depth = (northern[3] - northern[2]) / 3;
    gable(
      out,
      [northern[0], northern[1], northern[2] + i * depth, northern[2] + (i + 1) * depth],
      eaves,
      2.04,
      'x',
      'concrete',
      lod,
    );
  }
  range(out, southern, exercise.floor, eastRangeStoreys, newer, 'z', 1.62, lod);
  cellWindows(
    out,
    faceOf('x', northern[1], 1),
    4.1,
    27.84,
    exercise.floor,
    earlierRangeStoreys,
    1.85,
    earlier,
    lod,
  );
  cellWindows(
    out,
    faceOf('x', southern[0], -1),
    4.1,
    27.84,
    exercise.floor,
    eastRangeStoreys,
    1.74,
    newer,
    lod,
  );
  const wings = [
    {
      box: [-26.02, -20.8, -29, -5.85],
      base: work.floor,
      levels: earlierRangeStoreys,
      face: 'x',
      direction: 1,
      axis: 'z',
    },
    {
      box: [0.54, 3.33, -28.9, -5.85],
      base: work.floor,
      levels: earlierRangeStoreys,
      face: 'x',
      direction: -1,
      axis: 'z',
    },
    {
      box: [-26.0, 3.3, -37.8, -29.0],
      base: work.floor + 0.18,
      levels: earlierRangeStoreys,
      face: 'z',
      direction: 1,
      axis: 'x',
    },
    {
      box: [-20.8, -8.44, -5.82, 4.1],
      base: exercise.floor,
      levels: earlierRangeStoreys,
      face: 'z',
      direction: 1,
      axis: 'x',
    },
    {
      box: [-4.25, 7.05, -5.82, 4.1],
      base: exercise.floor,
      levels: earlierRangeStoreys,
      face: 'z',
      direction: 1,
      axis: 'x',
    },
    {
      box: [-43.65, -33.74, -34.75, -27.7],
      base: small.floor,
      levels: 1,
      face: 'z',
      direction: 1,
      axis: 'x',
    },
    {
      box: [-42.0, -26.12, -15.2, -11.14],
      base: small.floor - 0.46,
      levels: 1,
      face: 'z',
      direction: -1,
      axis: 'x',
    },
    {
      box: [3.35, 7.04, -36.84, -25.31],
      base: narrow.floor,
      levels: 1,
      face: 'z',
      direction: 1,
      axis: 'z',
    },
  ];
  for (const { box: bounds, base, levels, face, direction, axis } of wings) {
    range(out, bounds, base, levels, earlier, axis, axis === 'z' ? 1.47 : 2.25, lod);
    const [x0, x1, z0, z1] = bounds;
    if (face === 'x')
      cellWindows(
        out,
        faceOf('x', direction > 0 ? x1 : x0, direction),
        z0,
        z1,
        base,
        levels,
        1.86,
        earlier,
        lod,
      );
    else
      cellWindows(
        out,
        faceOf('z', direction > 0 ? z1 : z0, direction),
        x0,
        x1,
        base,
        levels,
        2.18,
        earlier,
        lod,
      );
  }
  if (lod) {
    const landing = exercise.floor + earlier - 0.19;
    B(out, 'trim', northern[1] + 0.53, landing, 16.0, 1.04, 0.25, 23.1);
    B(out, 'wood', northern[1] + 1.02, landing + 0.83, 16.0, 0.076, 0.09, 23.1, palette.iron);
    const count = lod >= 2 ? 14 : 6;
    for (let i = 0; i < count; i++)
      B(
        out,
        'wood',
        northern[1] + 1.02,
        landing + 0.24,
        4.5 + (i * 22.9) / (count - 1),
        0.075,
        0.65,
        0.075,
        palette.iron,
      );
  }
}
function build(out, _frame, lod = 3) {
  terraces(out, lod);
  residence(out, [-25.75, -13.08, 28.55, 39.53], entrance.floor, 'siding', -19.62, lod);
  residence(out, [-6.92, 5.75, 28.35, 39.5], entrance.floor, 'concrete', 0.36, lod);
  gate(out, lod);
  for (let i = 0; i < perimeter.length - 1; i++)
    wall(out, perimeter[i], perimeter[i + 1], i < 2 ? 3.1 : 2.78, lod);
  wall(out, perimeter[0], [-25.65, 39.6], 3.1, lod);
  wall(out, perimeter.at(-1), [5.74, 39.54], 2.75, lod);
}
export const gaolSkyline = (out) => build(out, undefined, 0);
export const gaolDistrict = (out) => build(out, undefined, 1);
export const gaolStreet = (out) => build(out, undefined, 2);
export const gaolCloseup = (out) => build(out, undefined, 3);

const recipe = 'gaol-model.mjs';
const camera = [83, 65, 91],
  lookAt = [-13, 9, 0];
export const gaolModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The terraced concrete Lyttelton Gaol, Oxford Street Gothic entrance and cell ranges around open yards.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'stone_basalt',
    'stone_sandstone_raw',
    'metal_corrugated',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'oxford-street-gate-and-residences', position: [-3, 11, 79], lookAt: [-10, 7, 37] },
    { name: 'terraced-yards-and-cell-wings', position: [51, 41, 23], lookAt: [-12, 8, -7] },
    {
      name: 'upper-retaining-wall-and-work-yard',
      position: [-61, 47, -65],
      lookAt: [-16, 11, -12],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-lyttelton-gaol-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'gaolSkyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'gaolDistrict', 0.24],
        ['street', 'gaolStreet', 0.1],
        ['closeup', 'gaolCloseup', 0.038],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Christchurch City Council and OpenStreetMap supply the cited geographic controls. No source imagery is used.',
};
