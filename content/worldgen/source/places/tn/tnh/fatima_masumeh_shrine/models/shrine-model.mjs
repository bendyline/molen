/** The central courts and gilded mausoleum at Qom, March 2009. */
import fs from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [builtOutline, courtOutline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const { core, atiq, goldenIwan, mirrorIwan, eastGate, foundationBottom } = plan.section;

const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  tile: { slot: 'trim', graph: 'tile_glazed', roughness: 0.53, metallic: 0 },
  mosaic: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.63, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_marble', roughness: 0.83, metallic: 0 },
  gold: { slot: 'roof', localRef: 'palette:#fffef1', roughness: 0.4, metallic: 0.66 },
  dark: { slot: 'trim', localRef: 'palette:#fdfefe', roughness: 0.77, metallic: 0 },
  pennant: {
    slot: 'trim',
    localRef: 'palette:#f0fff3',
    roughness: 0.96,
    metallic: 0,
    doubleSided: true,
  },
};
const colors = Object.fromEntries(
  Object.entries({
    brick: 'b99c72',
    tile: '417e87',
    mosaic: '567f7c',
    stone: 'b8ae97',
    gold: 'e4b849',
    dark: '4e4b3f',
    pennant: '417047',
    cobalt: '2f5574',
    cream: 'd1bd8a',
    paleGold: 'efc666',
    darkGold: '91702f',
    turquoise: '6eaaa5',
    copper: '7d9282',
  }).map(([key, value]) => [key, rgb(value)]),
);

function lathe(out, slot, profile, color, sides, center = [0, 0]) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center)),
    color,
    { cap: false },
  );
}
function face(out, slot, points, expected, color = colors[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}
function block(out, slot, [x0, x1, z0, z1], bottom, top, color = colors[slot]) {
  box(out, slot, (x0 + x1) / 2, bottom, (z0 + z1) / 2, x1 - x0, top - bottom, z1 - z0, color);
}
function groundAt(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - (v - j)) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    terrain.modelDatumElevationMeters
  );
}
function facade(center, [tx, tz]) {
  const normal = [-tz, 0, tx];
  return {
    normal,
    at: (u, y, d = 0) => [center[0] + tx * u - tz * d, y, center[1] + tz * u + tx * d],
  };
}
function strip(out, slot, f, x0, x1, bottom, top, depth, color = colors[slot]) {
  face(
    out,
    slot,
    [f.at(x0, bottom, depth), f.at(x1, bottom, depth), f.at(x1, top, depth), f.at(x0, top, depth)],
    f.normal,
    color,
  );
}
function jamb(out, slot, f, x0, x1, bottom, top, back, front = 0, color = colors[slot]) {
  strip(out, slot, f, x0, x1, bottom, top, front, color);
  const reverse = f.normal.map((v) => -v);
  face(
    out,
    slot,
    [f.at(x0, bottom, back), f.at(x1, bottom, back), f.at(x1, top, back), f.at(x0, top, back)],
    reverse,
    color,
  );
  face(
    out,
    slot,
    [f.at(x0, top, back), f.at(x1, top, back), f.at(x1, top, front), f.at(x0, top, front)],
    [0, 1, 0],
    color,
  );
  const along = [f.normal[2], 0, -f.normal[0]];
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ])
    face(
      out,
      slot,
      [f.at(x, bottom, back), f.at(x, bottom, front), f.at(x, top, front), f.at(x, top, back)],
      along.map((v) => sign * v),
      color,
    );
}
function archProfile(width, spring, crown, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [
      (t - 0.5) * width,
      spring + (crown - spring) * (0.46 * Math.sin(Math.PI * t) + 0.54 * (1 - Math.abs(t * 2 - 1))),
    ];
  });
}
function portalSteps(out, f, width, threshold) {
  const [x, , z] = f.at(0, 0, 2.2);
  const approach = groundAt(x, z);
  if (threshold <= approach + 0.14) return;
  const run = Math.min(2.2, Math.max(0.92, (threshold - approach) * 2.4));
  const stepCount = Math.max(2, Math.min(8, Math.ceil((threshold - approach) / 0.18)));
  jamb(out, 'stone', f, -width / 2, width / 2, approach - 0.35, threshold, -1.15, 0.2);
  for (let i = 0; i < stepCount; i++) {
    const rise = ((threshold - approach) * (stepCount - i)) / (stepCount + 1);
    jamb(
      out,
      'stone',
      f,
      -width / 2,
      width / 2,
      approach - 0.35,
      approach + rise,
      0.2 + (run * i) / stepCount,
      0.2 + (run * (i + 1)) / stepCount,
    );
  }
}
function portal(out, f, spec, lod, color) {
  const { openingWidth: width, wallWidth, threshold, spring, openingCrown: crown, parapet } = spec;
  const curve = archProfile(width, spring, crown, [4, 6, 10, 14][lod]);
  const back = -3.1;
  jamb(out, 'brick', f, -wallWidth / 2, -width / 2, foundationBottom, parapet, back);
  jamb(out, 'brick', f, width / 2, wallWidth / 2, foundationBottom, parapet, back);
  strip(out, 'dark', f, -width / 2, width / 2, threshold, parapet - 0.24, back - 0.065);
  strip(
    out,
    'mosaic',
    f,
    -wallWidth / 2,
    wallWidth / 2,
    parapet - 0.7,
    parapet,
    0.075,
    colors.cobalt,
  );
  face(
    out,
    'brick',
    [
      f.at(-width / 2, parapet, back),
      f.at(width / 2, parapet, back),
      f.at(width / 2, parapet),
      f.at(-width / 2, parapet),
    ],
    [0, 1, 0],
  );
  if (lod) portalSteps(out, f, width, threshold);
  const rim = 0.3;
  for (const sign of [-1, 1]) {
    const u = (sign * width) / 2;
    strip(
      out,
      'tile',
      f,
      Math.min(u, u + sign * rim),
      Math.max(u, u + sign * rim),
      threshold,
      spring + rim,
      0.065,
      color,
    );
  }
  for (let i = 1; i < curve.length; i++) {
    const [a, y] = curve[i - 1],
      [b, yy] = curve[i];
    face(out, 'brick', [f.at(a, y), f.at(b, yy), f.at(b, parapet), f.at(a, parapet)], f.normal);
    face(
      out,
      'stone',
      [f.at(a, y), f.at(b, yy), f.at(b, yy, back), f.at(a, y, back)],
      [0, -1, 0],
      colors.cream,
    );
    face(
      out,
      'tile',
      [f.at(a, y, 0.09), f.at(b, yy, 0.09), f.at(b, yy + rim, 0.09), f.at(a, y + rim, 0.09)],
      f.normal,
      color,
    );
    if (lod >= 2)
      face(
        out,
        'mosaic',
        [
          f.at(a, y, back + 0.53),
          f.at(b, yy, back + 0.53),
          f.at(b, yy, back + 0.81),
          f.at(a, y, back + 0.81),
        ],
        [0, -1, 0],
        colors.turquoise,
      );
  }
  if (lod) {
    for (const sign of [-1, 1]) {
      const x = sign * (wallWidth / 2 - 0.38);
      strip(out, 'tile', f, x - 0.24, x + 0.24, threshold + 0.25, parapet - 0.71, 0.1, color);
    }
    strip(
      out,
      'mosaic',
      f,
      -width / 2,
      width / 2,
      threshold + 1.8,
      threshold + 2.14,
      back + 0.025,
      colors.turquoise,
    );
  }
}
function dome(out, lod) {
  const {
    base,
    roof,
    bounds,
    transitionTop,
    drumRadius: r,
    bandBottom,
    bandTop,
    bulbBase,
    bulbCrest,
    finialTop,
  } = core;
  block(out, 'stone', bounds, foundationBottom, base);
  block(out, 'brick', bounds, base, roof);
  block(
    out,
    'tile',
    [bounds[0] - 0.26, bounds[1] + 0.26, bounds[2] - 0.26, bounds[3] + 0.26],
    roof - 0.46,
    roof,
    colors.cobalt,
  );
  lathe(
    out,
    'brick',
    [
      [roof - 0.11, 8.95],
      [transitionTop, 7.54],
    ],
    colors.brick,
    8,
  );
  const n = [10, 22, 36, 52][lod];
  lathe(
    out,
    'gold',
    [
      [transitionTop - 0.3, r],
      [bandBottom, r],
    ],
    colors.gold,
    n,
  );
  lathe(
    out,
    'mosaic',
    [
      [bandBottom, r + 0.035],
      [bandTop, r + 0.035],
    ],
    colors.darkGold,
    n,
  );
  lathe(
    out,
    'gold',
    [
      [bandTop, r + 0.07],
      [bulbBase, r + 0.11],
    ],
    colors.paleGold,
    n,
  );
  const profile = [
    [bulbBase, r + 0.11],
    [bulbBase + 0.52, r + 0.42],
    [bulbBase + 1.77, r + 0.38],
    [bulbBase + 3.15, r + 0.07],
    [bulbBase + 4.75, r - 0.83],
    [bulbBase + 6.36, r - 2.2],
    [bulbBase + 7.7, r - 3.98],
    [bulbCrest - 0.46, 0.74],
    [bulbCrest, 0.095],
  ];
  lathe(out, 'gold', lod ? profile : profile.filter((_, i) => i % 2 === 0), colors.gold, n);
  const finialBase = bulbCrest - 0.045;
  lathe(
    out,
    'gold',
    [
      [finialBase, 0.14],
      [finialBase + 0.37, 0.32],
      [finialBase + 0.76, 0.12],
      [finialBase + 1.66, 0.18],
      [finialBase + 1.95, 0.29],
      [finialBase + 2.32, 0.11],
      [finialTop, 0.045],
    ],
    colors.paleGold,
    lod ? 10 : 6,
  );
  face(
    out,
    'pennant',
    [
      [0.02, finialTop - 0.22, 0],
      [-1.4, finialTop - 0.35, 0.1],
      [-2.63, finialTop - 0.71, 0.16],
      [-2.76, finialTop - 1.23, 0.11],
    ],
    [0, 0, 1],
  );
  face(
    out,
    'pennant',
    [
      [0.02, finialTop - 0.22, 0],
      [-2.76, finialTop - 1.23, 0.11],
      [-1.46, finialTop - 1.15, -0.08],
      [0.02, finialTop - 0.95, 0],
    ],
    [0, 0, 1],
  );
  if (lod >= 2) {
    const h = (bandBottom + bandTop) / 2;
    for (let i = 0; i < 24; i++) {
      const theta = (i * Math.PI) / 12,
        pos = (a, y) => [(r + 0.093) * Math.cos(a), y, (r + 0.093) * Math.sin(a)];
      face(
        out,
        'tile',
        [pos(theta - 0.023, h), pos(theta, h + 0.25), pos(theta + 0.023, h), pos(theta, h - 0.25)],
        [Math.cos(theta), 0, Math.sin(theta)],
        colors.turquoise,
      );
    }
  }
}
function minaret(out, center, base, top, kind, lod) {
  const gilded = kind === 'gold',
    tall = kind === 'mirror';
  const n = [5, 10, 18, 24][lod],
    r = tall ? 1.64 : gilded ? 1.21 : 1.01;
  const h = top - base,
    y = (t) => base + t * h;
  const shaft =
    lod >= 2
      ? [
          [base, r * 1.07],
          [y(0.16), r],
          [y(0.68), r * 0.76],
          [y(0.76), r * 0.75],
        ]
      : [
          [base, r],
          [y(0.76), r * 0.75],
        ];
  lathe(out, 'mosaic', shaft, gilded ? colors.mosaic : colors.turquoise, n, center);
  lathe(
    out,
    'tile',
    [
      [y(0.76), r * 0.74],
      ...(lod ? [[y(0.81), r * 1.09]] : []),
      [y(0.83), r * (lod ? 1.15 : 0.93)],
    ],
    colors.cobalt,
    n,
    center,
  );
  const capSlot = gilded ? 'gold' : 'tile',
    capColor = gilded ? colors.paleGold : colors.copper;
  if (lod) {
    for (const [a, b, ratio] of [
      [0.832, 0.855, 0.96],
      [0.905, 0.924, 1.02],
    ])
      lathe(
        out,
        capSlot,
        [
          [y(a), r * ratio],
          [y(b), r * ratio],
        ],
        capColor,
        n,
        center,
      );
    const posts = [0, 5, 8, 10][lod],
      postWidth = gilded ? 0.12 : 0.145;
    for (let i = 0; i < posts; i++) {
      const a = (i * Math.PI * 2) / posts,
        x = center[0] + r * 0.86 * Math.cos(a),
        z = center[1] + r * 0.86 * Math.sin(a);
      box(out, capSlot, x, y(0.853), z, postWidth, h * 0.059, postWidth, capColor);
    }
  } else
    lathe(
      out,
      capSlot,
      [
        [y(0.83), r * 0.93],
        [y(0.924), r * 1.02],
      ],
      capColor,
      n,
      center,
    );
  const cap =
    lod >= 2
      ? [
          [y(0.924), r * 1.22],
          [y(0.94), r * 0.81],
          [y(0.962), r * 0.53],
          [y(0.982), r * 0.25],
          [top, r * 0.045],
        ]
      : [
          [y(0.924), r * 1.22],
          [y(0.963), r * 0.53],
          [top, r * 0.045],
        ];
  lathe(out, capSlot, cap, capColor, n, center);
  if (lod >= 2) {
    const [x, z] = center;
    tube(out, capSlot, [x, top - 0.04, z], [x, top + 0.43, z], 0.058, capColor, 6);
    for (const s of [0.23, 0.49, 0.69])
      lathe(
        out,
        'tile',
        [
          [y(s), r * (1.06 - 0.33 * s)],
          [y(s) + 0.22, r * (1.06 - 0.33 * s)],
        ],
        colors.cobalt,
        n,
        center,
      );
  }
}

function arcade(out, a, b, top, depth, lod) {
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    f = facade(mid, [(b[0] - a[0]) / distance, (b[1] - a[1]) / distance]);
  const n = Math.max(1, Math.round(distance / 4.35)),
    stride = distance / n;
  const floor = Math.max(groundAt(...a), groundAt(...b), groundAt(...mid)) + 0.19;
  const spring = top - 2.0,
    crown = top - 0.7;
  strip(out, 'tile', f, -distance / 2, distance / 2, top - 0.48, top, 0.053, colors.cobalt);
  if (lod < 2) {
    jamb(out, 'brick', f, -distance / 2, distance / 2, foundationBottom, top, -depth);
    if (lod === 1) {
      for (let i = 0; i < n; i++) {
        const center = (i + 0.5) * stride - distance / 2;
        const half = stride * 0.39;
        const [x, , z] = f.at(center, 0);
        const base = Math.min(groundAt(x, z) - 0.11, spring - 0.35);
        strip(out, 'dark', f, center - half, center + half, base, spring, 0.032);
        face(
          out,
          'dark',
          [
            f.at(center - half, spring, 0.032),
            f.at(center + half, spring, 0.032),
            f.at(center, crown, 0.032),
          ],
          f.normal,
        );
      }
      return;
    }
    strip(
      out,
      'dark',
      f,
      -distance / 2 + 0.17,
      distance / 2 - 0.17,
      Math.min(floor, top - 1.34),
      top - 0.9,
      0.028,
    );
    return;
  }
  jamb(out, 'brick', f, -distance / 2, distance / 2, foundationBottom, top, -depth, -1.16);
  face(
    out,
    'brick',
    [
      f.at(-distance / 2, top, -1.16),
      f.at(distance / 2, top, -1.16),
      f.at(distance / 2, top),
      f.at(-distance / 2, top),
    ],
    [0, 1, 0],
  );
  const width = stride * 0.81,
    lip = (stride - width) / 2,
    back = -1.18;
  const curve = archProfile(width, spring, crown, lod === 2 ? 6 : 8);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * stride - distance / 2;
    const localFloor = Math.min(
      top - 2.37,
      groundAt(...f.at(u, 0).filter((_, j) => j !== 1)) - 0.14,
    );
    jamb(out, 'brick', f, u - width / 2 - lip, u - width / 2, foundationBottom, top, back);
    jamb(out, 'brick', f, u + width / 2, u + width / 2 + lip, foundationBottom, top, back);
    strip(out, 'dark', f, u - width / 2, u + width / 2, localFloor, crown, back + 0.038);
    for (let k = 1; k < curve.length; k++) {
      const [x, y] = curve[k - 1],
        [xx, yy] = curve[k];
      face(
        out,
        'brick',
        [f.at(u + x, y), f.at(u + xx, yy), f.at(u + xx, top), f.at(u + x, top)],
        f.normal,
      );
      face(
        out,
        'brick',
        [f.at(u + x, y), f.at(u + xx, yy), f.at(u + xx, yy, back), f.at(u + x, y, back)],
        [0, -1, 0],
      );
      face(
        out,
        'tile',
        [
          f.at(u + x, y, 0.047),
          f.at(u + xx, yy, 0.047),
          f.at(u + xx, yy + 0.12, 0.047),
          f.at(u + x, y + 0.12, 0.047),
        ],
        f.normal,
        colors.turquoise,
      );
    }
  }
}
function courts(out, lod) {
  const [west, east, north, south] = atiq.inner;
  const corner = [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
  for (const i of [0, 1, 3]) {
    const a = corner[i],
      b = corner[(i + 1) % corner.length];
    arcade(out, a, b, atiq.arcadeTop, i === 0 ? 6.7 : 6.2, lod);
  }
  for (const [a, b] of [
    [
      [west, south],
      [goldenIwan.center[0] - 8, south],
    ],
    [
      [goldenIwan.center[0] + 8, south],
      [east, south],
    ],
  ])
    arcade(out, b, a, atiq.arcadeTop, 4.2, lod);
  const westWall = courtOutline.slice(0, 2);
  const split = mirrorIwan.towerCenters.map(([x, z]) => [x, z]);
  for (const [a, b] of [
    [westWall[0], split[1]],
    [split[0], westWall[1]],
  ]) {
    const top = Math.max(groundAt(...a), groundAt(...b)) + 5.65;
    arcade(out, a, b, top, 8.4, lod);
  }
  // The remaining original Atabaki segments describe the open court's outer arcade.
  for (let i = 1; i < courtOutline.length; i++) {
    const a = courtOutline[i],
      b = courtOutline[(i + 1) % courtOutline.length];
    if (i === 7 || i === 8) continue; // The modeled entrance interrupts this stretch.
    const top = Math.max(groundAt(...a), groundAt(...b)) + 5.65;
    arcade(out, a, b, top, 3.45, lod);
  }
}
function build(out, _frame, lod = 3) {
  const [x0, x1, z0, z1] = core.bounds;
  block(out, 'brick', [-28.8, x0, z0, 29.1], foundationBottom, 10.12);
  block(out, 'brick', [x1, 24.45, z0, 25.3], foundationBottom, 10.66);
  block(out, 'brick', [x0, 20.9, z1, 31.8], foundationBottom, 9.4);
  courts(out, lod);
  dome(out, lod);
  for (const [spec, tangent, kind, color] of [
    [goldenIwan, [-1, 0], 'gold', colors.paleGold],
    [mirrorIwan, [0, -1], 'mirror', colors.turquoise],
    [eastGate, [0, 1], 'east', colors.cobalt],
  ]) {
    portal(out, facade(spec.center, tangent), spec, lod, color);
    for (const center of spec.towerCenters) {
      const [x, z] = center;
      const radius = kind === 'mirror' ? 1.86 : 1.35;
      const ground = groundAt(x, z) - 0.53;
      if (lod && kind !== 'gold')
        block(
          out,
          'brick',
          [x - radius, x + radius, z - radius, z + radius],
          ground,
          spec.towerBase + 0.09,
        );
      const shaftBase = !lod && kind !== 'gold' ? Math.min(ground, spec.towerBase) : spec.towerBase;
      minaret(out, center, shaftBase, spec.towerTop, kind, lod);
    }
  }
}
export const shrineSkyline = (out) => build(out, undefined, 0);
export const shrineDistrict = (out) => build(out, undefined, 1);
export const shrineStreet = (out) => build(out, undefined, 2);
export const shrineCloseup = (out) => build(out, undefined, 3);

const recipe = 'shrine-model.mjs';
const camera = [157, 82, 95],
  lookAt = [35, 9, -19];
export const shrineModel = {
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
    'The gilded mausoleum and two historic open courts at Qom, with three distinct pairs of minarets in 2009.',
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
    outline: builtOutline,
    minimumCoverage: 0.95,
    basis:
      'Use the mapped core building alone to identify the generic footprint for this dated preview.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'tile_glazed', 'tile_mosaic', 'stone_marble'],
  qaCameras: [
    { name: 'mirror-iwan-and-gilded-dome', position: [89, 26, -12], lookAt: [19, 17, -10] },
    { name: 'golden-iwan-from-atiq', position: [-5, 15, -70], lookAt: [0, 16, -15] },
    { name: 'two-courts-and-six-minarets', position: [105, 70, -107], lookAt: [30, 10, -23] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-shrine-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'shrineSkyline',
    errorMeters: 0.58,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'shrineDistrict', 0.24],
        ['street', 'shrineStreet', 0.1],
        ['closeup', 'shrineCloseup', 0.04],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Geographic controls from OpenStreetMap. Verified CC0 photographs by Mostafa Meraji and public-domain photography by Wayiran inform the 2009 exterior.',
};
