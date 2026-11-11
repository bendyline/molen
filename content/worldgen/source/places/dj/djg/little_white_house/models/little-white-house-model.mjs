/** Roosevelt's Warm Springs cottage, four-column porch and curved sun deck. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  column,
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.9, metallic: 0 },
  paint: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  shingles: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.95, metallic: 0 },
  awning: { slot: 'roof', graph: 'fabric_canvas', roughness: 0.96, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48, metallic: 0.12 },
};
const color = Object.fromEntries(
  Object.entries({
    clapboard: 'e1dac8',
    white: 'e4ddcb',
    warmWhite: 'd3cbbb',
    window: '555b55',
    shutter: '414844',
    slat: '59605a',
    roof: '9b8c77',
    cap: '7b7062',
    chimney: 'b9aea1',
    porch: '986e59',
    foundation: '928679',
    deck: 'ae9777',
    awning: '4d675b',
    pole: '676459',
  }).map(([name, value]) => [name, rgb(value)]),
);
const up = [0, 1, 0];
const rect = (a, b, c, d) => [
  [a, c],
  [b, c],
  [b, d],
  [a, d],
];
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const area = (r) =>
  r.reduce((sum, [x, z], i) => {
    const [u, v] = r[(i + 1) % r.length];
    return sum + x * v - z * u;
  }, 0);
const { floor, eave, ridge, porchRoof, porchFace } = plan;

function directed(out, material, vertices, normal, tint) {
  const winding = normalFor(...vertices).reduce((sum, v, i) => sum + v * normal[i], 0);
  const points = winding >= 0 ? vertices : vertices.toReversed();
  if (points.length === 3) triangle(out, material, points, tint);
  else face(out, material, points, tint);
}

function panel(out, material, outer, project, normal, tint, holes = []) {
  const points = [...outer];
  const offsets = holes.map((r) => {
    const n = points.length;
    points.push(...r);
    return n;
  });
  const idx = earcut(points.flat(), offsets);
  for (let i = 0; i < idx.length; i += 3)
    directed(
      out,
      material,
      idx.slice(i, i + 3).map((j) => project(...points[j])),
      normal,
      tint,
    );
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const r = terrain.heightsMeters[j],
    n = terrain.heightsMeters[j + 1];
  return (
    (1 - b) * ((1 - a) * r[i] + a * r[i + 1]) +
    b * ((1 - a) * n[i] + a * n[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function section(a, b, side) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [(side * dz) / length, 0, (-side * dx) / length];
  const p = (u, y, shift = 0) => [
    a[0] + (u * dx) / length + normal[0] * shift,
    y,
    a[1] + (u * dz) / length + normal[2] * shift,
  ];
  return { p, normal, length };
}

function window(out, s, w, lod) {
  const { p, normal } = s,
    { u, low, high, width, shutters, door } = w;
  const a = u - width / 2,
    b = u + width / 2,
    inset = lod >= 2 ? -0.135 : 0.016;
  const pane = rect(a, b, low, high);
  const lay = (slot, shape, depth, tint) =>
    directed(
      out,
      slot,
      shape.map(([x, y]) => p(x, y, depth)),
      normal,
      tint,
    );
  lay('glazing', pane, inset, color.window);
  if (lod >= 2) {
    const middle = p(u, (low + high) / 2);
    for (let i = 0; i < pane.length; i++) {
      const q = pane[i],
        r = pane[(i + 1) % pane.length],
        mid = p(...mix(q, r, 0.5));
      directed(
        out,
        'paint',
        [p(...q), p(...r), p(...r, inset), p(...q, inset)],
        middle.map((v, k) => v - mid[k]),
        color.warmWhite,
      );
    }
  }
  if (lod) {
    const d = lod >= 2 ? inset + 0.033 : 0.033;
    const gridX = door ? [0.19, 0.5, 0.81] : [0.5];
    const gridY = door ? [0.28, 0.45, 0.62, 0.79, 0.91] : [0.24, 0.5, 0.76];
    for (const t of gridX)
      lay('paint', rect(a + width * t - 0.025, a + width * t + 0.025, low, high), d, color.white);
    for (const t of gridY) {
      const y = low + (high - low) * t;
      lay('paint', rect(a, b, y - 0.022, y + 0.022), d, color.white);
    }
    for (const x of [a, b])
      lay('paint', rect(x - 0.05, x + 0.05, low - 0.05, high + 0.05), 0.034, color.white);
    for (const y of [low, high])
      lay('paint', rect(a - 0.05, b + 0.05, y - 0.05, y + 0.05), 0.034, color.white);
  }
  if (shutters) {
    for (const [left, right] of [
      [a - 0.5, a - 0.09],
      [b + 0.09, b + 0.5],
    ]) {
      lay('paint', rect(left, right, low - 0.04, high + 0.04), 0.052, color.shutter);
      if (lod >= 2) {
        const n = lod === 3 ? 22 : 12;
        for (let i = 1; i < n; i++) {
          const y = low + ((high - low) * i) / n;
          lay('paint', rect(left + 0.032, right - 0.032, y, y + 0.018), 0.06, color.slat);
        }
      }
    }
  }
}

function wall(out, s, windows, lod) {
  const { p, normal, length: L } = s;
  const holes = windows.map((w) => rect(w.u - w.width / 2, w.u + w.width / 2, w.low, w.high));
  panel(
    out,
    'siding',
    rect(0, L, floor, eave),
    (x, y) => p(x, y),
    normal,
    color.clapboard,
    lod >= 2 ? holes : [],
  );
  const count = lod ? Math.ceil(L / 2.9) : 1;
  for (let i = 0; i < count; i++) {
    const a = (L * i) / count,
      b = (L * (i + 1)) / count;
    const foot = (x) => {
      const [u, , z] = p(x, 0);
      return p(x, Math.min(floor - 0.15, grade(u, z) - 0.22));
    };
    directed(out, 'stone', [foot(a), foot(b), p(b, floor), p(a, floor)], normal, color.foundation);
  }
  if (lod) {
    beam(out, 'paint', p(0, eave - 0.08, 0.036), p(L, eave - 0.08, 0.036), 0.14, 0.13, color.white);
    if (L > 1)
      for (const x of [0.065, L - 0.065])
        directed(
          out,
          'paint',
          rect(x - 0.064, x + 0.064, floor, eave - 0.13).map((q) => p(...q, 0.028)),
          normal,
          color.white,
        );
  }
  for (const w of windows) window(out, s, w, lod);
}

function cottage(out, lod) {
  const body = [6, 7, 13, 15, 16, 17, 4, 5].map((i) => outline[i]);
  const side = Math.sign(area(body));
  for (const [i, a] of body.entries()) {
    const s = section(a, body[(i + 1) % body.length], side),
      L = s.length;
    const sash = (u, shutters = false) => ({ u, low: 0.13, high: 2.57, width: 0.96, shutters });
    let windows = [];
    if (i === 1) {
      windows = [
        ...plan.eastWindows.map((x) => sash(L / 2 + x, true)),
        { u: L / 2, low: floor + 0.07, high: 2.62, width: 1.52, door: true },
      ];
    } else if (lod && (i === 0 || i === 2)) {
      windows = [sash(L * 0.29), sash(L * 0.73)];
    } else if (lod && i === 5) {
      windows = [
        sash(L * 0.21),
        { u: L * 0.51, low: floor + 0.08, high: 2.48, width: 1.55, door: true },
        sash(L * 0.8),
      ];
    } else if (lod >= 2 && L > 3.4) {
      windows = [sash(L * 0.5)];
    }
    wall(out, s, windows, lod);
  }
}

function gabledRoof(out, x0, x1, z0, z1, peakZ, base, peak, lod) {
  const a = [x0, base, z0],
    b = [x1, base, z0],
    c = [x1, base, z1],
    d = [x0, base, z1];
  const r = [x0, peak, peakZ],
    s = [x1, peak, peakZ];
  directed(out, 'shingles', [a, b, s, r], up, color.roof);
  directed(out, 'shingles', [d, r, s, c], up, color.roof);
  directed(out, 'siding', [a, d, r], [-1, 0, 0], color.clapboard);
  directed(out, 'siding', [b, c, s], [1, 0, 0], color.clapboard);
  if (lod) {
    beam(out, 'paint', a, b, 0.12, 0.13, color.cap);
    beam(out, 'paint', d, c, 0.12, 0.13, color.cap);
    beam(out, 'shingles', r, s, 0.15, 0.13, color.cap);
  }
}

function roofs(out, lod) {
  gabledRoof(out, -9.0, 8.92, -1.77, 7.02, 2.66, eave, ridge, lod);
  const z = -5.87,
    x0 = -3.94,
    x1 = 4.06,
    y = 4.32;
  const rear = [x0, eave, z],
    right = [x1, eave, z],
    peak = [0.1, y, z],
    inner = [0.1, y, 0.58];
  directed(out, 'siding', [rear, right, peak], [0, 0, -1], color.clapboard);
  directed(out, 'shingles', [rear, peak, inner, [x0, eave, 0.58]], up, color.roof);
  directed(out, 'shingles', [right, [x1, eave, 0.58], inner, peak], up, color.roof);
  directed(
    out,
    'shingles',
    [
      [3.82, eave, -2.89],
      [8.66, eave, -2.99],
      [8.72, eave + 0.09, -1.73],
      [3.86, eave + 0.09, -1.73],
    ],
    up,
    color.roof,
  );
  const { x, z: cz, top } = plan.chimney;
  box(out, 'stone', [x - 0.34, 4.11, cz - 0.3], [x + 0.34, top, cz + 0.3], color.chimney);
  box(
    out,
    'stone',
    [x - 0.41, top - 0.05, cz - 0.37],
    [x + 0.41, top + 0.08, cz + 0.37],
    color.cap,
  );
  if (lod) box(out, 'stone', [-4.58, 5.19, 2.48], [-4.41, 5.56, 2.64], color.chimney);
}

function porch(out, lod) {
  const left = -3.65,
    right = 3.61,
    front = porchFace + 0.17,
    back = 6.71;
  const stoneBase = Math.min(grade(0, front) - 0.19, floor - 0.2);
  box(out, 'brick', [left, stoneBase, back], [right, floor, front], color.porch);
  const top = eave - 0.17;
  for (const x of [-3.41, -1.13, 1.18, 3.38])
    column(out, 'paint', x, 8.72, floor, top, 0.132, color.white, [6, 8, 10, 14][lod]);
  box(out, 'paint', [left, top, back], [right, eave, front], color.white);
  const a = [left - 0.14, eave, front],
    b = [right + 0.14, eave, front],
    ridgeFront = [-0.03, porchRoof, front];
  const ridgeBack = [-0.03, porchRoof - 0.03, 2.66];
  directed(out, 'siding', [a, b, ridgeFront], [0, 0, 1], color.clapboard);
  directed(out, 'shingles', [a, ridgeFront, ridgeBack, [a[0], eave, 2.66]], up, color.roof);
  directed(out, 'shingles', [b, [b[0], eave, 2.66], ridgeBack, ridgeFront], up, color.roof);
  if (lod) {
    beam(out, 'paint', a, ridgeFront, 0.135, 0.15, color.white);
    beam(out, 'paint', b, ridgeFront, 0.135, 0.15, color.white);
    beam(out, 'paint', a, b, 0.14, 0.18, color.white);
    beam(
      out,
      'paint',
      [-0.03, eave - 0.2, 8.26],
      [-0.03, eave - 0.54, 8.26],
      0.035,
      0.035,
      color.pole,
    );
    box(out, 'glazing', [-0.12, eave - 0.73, 8.18], [0.06, eave - 0.52, 8.34], color.awning);
  }
}

const deckArc = [4, 3, 2, 1, 0, 20, 19, 18, 17].map((i) => outline[i]);
function deck(out, lod) {
  const side = Math.sign(area(deckArc));
  panel(out, 'stone', deckArc, (x, z) => [x, floor - 0.01, z], up, color.deck);
  for (const [i, a] of deckArc.entries()) {
    const b = deckArc[(i + 1) % deckArc.length];
    const s = section(a, b, side),
      { p, normal, length: L } = s;
    directed(
      out,
      'stone',
      [p(0, floor - 0.25), p(L, floor - 0.25), p(L, floor), p(0, floor)],
      normal,
      color.deck,
    );
    if (i === deckArc.length - 1) continue;
    const low = floor + 0.11,
      high = floor + 0.87;
    const openings = [];
    if (lod >= 2) {
      const count = Math.max(2, Math.round(L / 0.22));
      for (let j = 0; j < count; j++) {
        const u = (L * (j + 0.5)) / count;
        openings.push([
          [u - 0.033, low + 0.12],
          [u + 0.033, low + 0.12],
          [u + 0.013, low + 0.34],
          [u + 0.035, high - 0.1],
          [u - 0.035, high - 0.1],
          [u - 0.013, low + 0.34],
        ]);
      }
    }
    for (const [depth, sign] of [
      [0.025, 1],
      [-0.026, -1],
    ])
      panel(
        out,
        'paint',
        rect(0, L, low, high),
        (u, y) => p(u, y, depth),
        normal.map((n) => n * sign),
        color.white,
        openings,
      );
    beam(out, 'paint', p(0, high), p(L, high), 0.084, 0.09, color.white);
    if (lod) {
      const [x, z] = a;
      box(
        out,
        'paint',
        [x - 0.06, floor, z - 0.06],
        [x + 0.06, high + 0.015, z + 0.06],
        color.white,
      );
    }
  }
  for (const [x, z] of [
    [-2.65, -6.93],
    [0, -8.25],
    [2.65, -6.93],
  ]) {
    const g = grade(x, z);
    box(
      out,
      'stone',
      [x - 0.26, g - 0.24, z - 0.28],
      [x + 0.26, floor - 0.22, z + 0.28],
      color.foundation,
    );
  }
  const rear = -7.19,
    house = -5.56,
    x0 = -2.83,
    x1 = 2.95,
    low = 2.14,
    high = 2.66;
  directed(
    out,
    'awning',
    [
      [x0, low, rear],
      [x1, low, rear],
      [x1, high, house],
      [x0, high, house],
    ],
    up,
    color.awning,
  );
  directed(
    out,
    'awning',
    [
      [x0, low - 0.018, rear],
      [x1, low - 0.018, rear],
      [x1, high - 0.018, house],
      [x0, high - 0.018, house],
    ],
    [0, -1, 0],
    color.awning,
  );
  for (const x of [x0 + 0.08, -0.92, 0.98, x1 - 0.08])
    beam(out, 'paint', [x, floor, rear + 0.07], [x, low, rear + 0.07], 0.042, 0.042, color.pole);
  if (lod) {
    const n = lod >= 2 ? 28 : 14;
    for (let i = 0; i < n; i++) {
      const a = x0 + ((x1 - x0) * i) / n,
        b = x0 + ((x1 - x0) * (i + 1)) / n,
        m = (a + b) / 2;
      for (const normal of [
        [0, 0, -1],
        [0, 0, 1],
      ]) {
        directed(
          out,
          'awning',
          [
            [a, low, rear],
            [m, low, rear],
            [m, low - 0.15, rear],
            [a, low - 0.07, rear],
          ],
          normal,
          color.awning,
        );
        directed(
          out,
          'awning',
          [
            [m, low, rear],
            [b, low, rear],
            [b, low - 0.07, rear],
            [m, low - 0.15, rear],
          ],
          normal,
          color.awning,
        );
      }
    }
  }
}

function build(out, lod) {
  cottage(out, lod);
  roofs(out, lod);
  porch(out, lod);
  deck(out, lod);
}
export const houseSkyline = (out) => build(out, 0);
export const houseDistrict = (out) => build(out, 1);
export const houseStreet = (out) => build(out, 2);
export const houseCloseup = (out) => build(out, 3);
const recipe = 'little-white-house-model.mjs',
  camera = [19, 10, 31],
  lookAt = [0, 1.8, 1.2];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'houseDistrict', 0.3],
    ['street', 'houseStreet', 0.105],
    ['closeup', 'houseCloseup', 0.025],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: houseCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Pale clapboard cottage with a four-column portico, shuttered sashes, a shingle roof and a curved rear sun deck.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [13, 16, 20],
  mediumFiContext: {
    scale: 2.14,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis:
      'The named cottage and its attached exterior perimeter from OpenStreetMap way 324614887.',
  },
  embeddedCanonicalGraphs: [
    'wood_painted_lap',
    'wood_plain',
    'shingle_cedar',
    'stone_limestone_raw',
    'brick',
    'fabric_canvas',
  ],
  qaCameras: [
    { name: 'east-porch-and-shuttered-windows', position: [0, 4.0, 29], lookAt: [0, 2.46, 6.7] },
    { name: 'sun-deck-and-awning', position: [-13, 5.9, -20], lookAt: [-0.45, 1.01, -5.6] },
    { name: 'gable-and-slope-foundations', position: [22, 8.7, -8.8], lookAt: [1.7, 0.55, 0.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-little-white-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.59,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped outline is ODbL. The two exact Qualla photographs are CC0.',
};
