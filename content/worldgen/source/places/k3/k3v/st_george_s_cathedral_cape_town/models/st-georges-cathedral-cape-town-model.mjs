/** Anglican cathedral on Wale Street, Cape Town, in January 2006. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const q = plan.section;
const [u0, u1] = q.naveDirection.map((x) => x / Math.hypot(...q.naveDirection));
const at = (u, y, v) => [u0 * u + u1 * v, y, u1 * u - u0 * v];
const architectural = ([x, z]) => [u0 * x + u1 * z, u1 * x - u0 * z];
const north = [u1, 0, -u0];
const east = [u0, 0, u1];
const invert = (v) => v.map((x) => -x);
const up = [0, 1, 0];
const span = (x, a, b) => a + (b - a) * x;
const mix = (a, b, t) => a.map((x, i) => span(t, x, b[i]));
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.91, metallic: 0 },
  clay: { slot: 'roof', graph: 'tile_flat', roughness: 0.9, metallic: 0 },
  slate: { slot: 'foundation', graph: 'slate', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66, metallic: 0.03 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    stone: 'ae9d81',
    courtStone: '978a73',
    darkStone: '938574',
    light: 'c7bba5',
    rim: 'b6a78f',
    glass: '58666b',
    clear: '718082',
    shade: '455055',
    dark: '3b342c',
    wood: '594637',
    clay: '995c4c',
    clayShade: '845244',
    ridge: '815447',
    slate: '74706d',
    slateDark: '625c54',
  }).map(([name, color]) => [name, rgb(color)]),
);

function grade([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const h = terrain.heightsMeters;
  return (
    span(v - j, span(u - i, h[j][i], h[j][i + 1]), span(u - i, h[j + 1][i], h[j + 1][i + 1])) -
    terrain.modelDatumElevationMeters
  );
}

function panel(out, slot, points, desired, color) {
  const facing = normalFor(...points).reduce((sum, x, i) => sum + x * desired[i], 0);
  const ordered = facing > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, color);
  else triangle(out, slot, ordered, color);
}

function area(out, slot, point, ring, plane, normal, color, holes = []) {
  const points = [...ring];
  const offsets = [];
  for (const hole of holes) {
    offsets.push(points.length);
    points.push(...hole);
  }
  const indices = earcut(points.flat(), offsets);
  for (let i = 0; i < indices.length; i += 3) {
    panel(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => point(...points[j], plane)),
      normal,
      color,
    );
  }
}

function arch(center, width, sill, spring, crown, segments) {
  return [
    [center - width / 2, sill],
    ...Array.from({ length: segments + 1 }, (_, i) => {
      const angle = Math.PI * (1 - i / segments);
      return [
        center + (Math.cos(angle) * width) / 2,
        spring + Math.pow(Math.sin(angle), 1.22) * (crown - spring),
      ];
    }),
    [center + width / 2, sill],
  ];
}

function stroke(out, slot, point, a, b, width, depth, normal, color) {
  const x = b[0] - a[0],
    y = b[1] - a[1];
  const s = width / (2 * Math.hypot(x, y));
  const delta = [-y * s, x * s];
  panel(
    out,
    slot,
    [a, b, b, a].map(([u, v], i) => {
      const sign = i < 2 ? 1 : -1;
      return point(u + sign * delta[0], v + sign * delta[1], depth);
    }),
    normal,
    color,
  );
}

function rim(out, point, hole, width, d, normal) {
  for (let i = 0; i < hole.length - 1; i++) {
    const a = hole[i],
      b = hole[i + 1];
    stroke(out, 'trim', point, a, b, width, d, normal, i % 4 === 0 ? tint.light : tint.rim);
  }
}

function reveal(out, point, hole, depth, color) {
  const winding = hole.reduce((sum, [x, y], i) => {
    const next = hole[(i + 1) % hole.length];
    return sum + x * next[1] - y * next[0];
  }, 0);
  for (let i = 0; i < hole.length; i++) {
    const a = hole[i],
      b = hole[(i + 1) % hole.length];
    panel(
      out,
      'trim',
      [point(...a, 0), point(...b, 0), point(...b, -depth), point(...a, -depth)],
      normalFor(point(...b, 0), point(...a, 0), point(...a, -depth)).map(
        (x) => x * Math.sign(winding),
      ),
      color,
    );
  }
}

function tracery(out, point, center, depth, y0, y1, width, normal, lod) {
  const c = y1 - 0.3;
  const bars = lod === 0 ? [-0.26, 0, 0.26] : [-0.36, -0.18, 0, 0.18, 0.36];
  for (const r of bars) {
    const x = center + r * width;
    const end = c - ((c - y0) * 0.19 * Math.abs(r)) / 0.36;
    stroke(out, 'trim', point, [x, y0], [x, end], width * 0.036, depth, normal, tint.light);
  }
  if (lod < 1) return;
  for (const r of [-0.28, -0.09, 0.09, 0.28]) {
    const x = center + r * width,
      t = c - 0.5 - Math.abs(r) * 2.8;
    const diamond = [
      [x - width * 0.093, t],
      [x, t + width * 0.1],
      [x + width * 0.093, t],
      [x, t - width * 0.1],
    ];
    diamond.forEach((a, i) => {
      stroke(out, 'trim', point, a, diamond[(i + 1) % 4], width * 0.022, depth, normal, tint.rim);
    });
    if (lod >= 2)
      stroke(
        out,
        'glass',
        point,
        [x, y0 + 0.04],
        [x, t - width * 0.102],
        0.031,
        depth - 0.03,
        normal,
        tint.clear,
      );
  }
}

function prism(out, u, v, width, depth, base, top, slot, color) {
  const ring = [
    [u - width / 2, v - depth / 2],
    [u + width / 2, v - depth / 2],
    [u + width / 2, v + depth / 2],
    [u - width / 2, v + depth / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 4];
    panel(
      out,
      slot,
      [at(a[0], base, a[1]), at(b[0], base, b[1]), at(b[0], top, b[1]), at(a[0], top, a[1])],
      [invert(north), east, north, invert(east)][i],
      color,
    );
  }
  panel(
    out,
    slot,
    ring.map(([u, v]) => at(u, top, v)),
    up,
    color,
  );
}

function mappedAisles(out) {
  const ql = outline.map(architectural);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const a = outline[i],
      b = outline[j];
    const [u, v] = ql[i],
      [t, w] = ql[j];
    panel(
      out,
      'stone',
      [
        [...at(u, Math.min(-1.6, grade(a) - 0.97), v)],
        at(t, Math.min(-1.6, grade(b) - 0.97), w),
        at(t, q.aisleHeight, w),
        at(u, q.aisleHeight, v),
      ],
      [a[2] - b[2], 0, b[0] - a[0]],
      i % 5 === 0 ? tint.courtStone : tint.stone,
    );
  }
  area(out, 'slate', (u, v, y) => at(u, y, v), ql, q.aisleHeight, up, tint.slateDark);
}

function pitched(out, along, from, to, center, width, eave, ridge, { trim = true } = {}) {
  const side = width / 2;
  for (const s of [-1, 1]) {
    panel(
      out,
      'clay',
      [
        along(from, eave, center + s * side),
        along(to, eave, center + s * side),
        along(to, ridge, center),
        along(from, ridge, center),
      ],
      up,
      s > 0 ? tint.clay : tint.clayShade,
    );
    if (trim)
      panel(
        out,
        'clay',
        [
          along(from, ridge, center),
          along(to, ridge, center),
          along(to, ridge - 0.16, center + s * 0.24),
          along(from, ridge - 0.16, center + s * 0.24),
        ],
        up,
        tint.ridge,
      );
  }
}

function nave(out, lod) {
  for (const s of [-1, 1]) {
    const normal = s > 0 ? north : invert(north);
    const wall = (u, y, d) => at(u, y, s * (7.8 + d));
    for (const [a, b] of [
      [-31.5, -5.8],
      [13.7, 27.2],
    ]) {
      const shell = [
        [a, 5.2],
        [b, 5.2],
        [b, 20.0],
        [a, 20.0],
      ];
      const windowPositions = [-27.5, -20.5, -13.2, 16.5, 21.8].filter(
        (u) => u > a + 1.2 && u < b - 1.2,
      );
      const holes = windowPositions.map((x) => arch(x, 2.5, 10.25, 16.6, 18.75, lod < 2 ? 6 : 12));
      area(out, 'stone', wall, shell, 0, normal, tint.stone, lod === 0 ? [] : holes);
      holes.forEach((hole, i) => {
        if (lod === 0) {
          area(out, 'glass', wall, hole, 0.034, normal, tint.glass);
          return;
        }
        reveal(out, wall, hole, 0.44, tint.darkStone);
        area(out, 'glass', wall, hole, -0.44, normal, tint.glass);
        rim(out, wall, hole, 0.24, 0.055, normal);
        if (lod >= 1) tracery(out, wall, windowPositions[i], -0.38, 10.4, 17.75, 2.5, normal, lod);
      });
      for (const x of [-31, -24.3, -16.4, -8.9, 14.1, 19.05, 25.0].filter((u) => u >= a && u < b)) {
        prism(out, x, s * 8.7, 1.24, 2.0, 7.25, 14.0, 'stone', tint.stone);
        if (lod > 0) prism(out, x, s * 8.27, 0.95, 1.18, 13.8, 19.98, 'stone', tint.rim);
      }
    }
    const low = s > 0 ? 11.1 : 11.9;
    panel(
      out,
      'slate',
      [
        at(-23.8, 7.8, s * low),
        at(7.5, 7.8, s * low),
        at(7.5, 10.05, s * 7.55),
        at(-23.8, 10.05, s * 7.55),
      ],
      up,
      tint.slate,
    );
  }
  const westFace = (v, y, d) => at(-31.5 - d, y, v);
  area(
    out,
    'stone',
    westFace,
    [
      [-7.8, 5.2],
      [7.8, 5.2],
      [7.8, 20.0],
      [0, 27.7],
      [-7.8, 20.0],
    ],
    0,
    invert(east),
    tint.stone,
  );
  pitched(out, at, -32.0, 3.95, 0, 15.76, 19.96, 27.7, { trim: lod > 0 });
  pitched(out, at, 3.95, 28.6, 0, 15.76, 19.96, 27.7, { trim: lod > 0 });
}

function northFront(out, lod) {
  const [left, right] = q.northGable;
  const middle = (left + right) / 2;
  const plane = q.northWall;
  const gable = (u, y, d) => at(u, y, plane + d);
  const window = arch(middle, 9.55, 8.38, 18.3, 22.05, [8, 12, 16, 22][lod]);
  const round = Array.from({ length: lod === 0 ? 8 : 16 }, (_, i) => {
    const v = (i * 2 * Math.PI) / (lod === 0 ? 8 : 16);
    return [middle + 0.52 * Math.cos(v), 25.95 + 0.78 * Math.sin(v)];
  });
  const front = [
    [left, 4.65],
    [right, 4.65],
    [right, q.northEaves],
    [middle, q.northRidge],
    [left, q.northEaves],
  ];
  area(out, 'stone', gable, front, 0, north, tint.stone, [window, round]);
  reveal(out, gable, window, 1.06, tint.darkStone);
  area(out, 'glass', gable, window, -1.06, north, tint.glass);
  rim(out, gable, window, 0.59, 0.075, north);
  if (lod >= 1)
    rim(
      out,
      gable,
      arch(middle, 10.63, 8.4, 18.34, 22.57, [8, 12, 16, 22][lod]),
      0.14,
      0.088,
      north,
    );
  tracery(out, gable, middle, -0.94, 8.6, 21.03, 9.56, north, lod);
  reveal(out, gable, round, 0.41, tint.rim);
  area(out, 'glass', gable, round, -0.41, north, tint.shade);
  if (lod >= 1) {
    stroke(
      out,
      'trim',
      gable,
      [middle - 0.42, 25.95],
      [middle + 0.42, 25.95],
      0.14,
      -0.34,
      north,
      tint.light,
    );
    stroke(out, 'trim', gable, [middle, 25.28], [middle, 26.61], 0.12, -0.34, north, tint.light);
  }
  for (const [x, rise] of [
    [left + 0.78, 24.2],
    [right - 0.77, 24.0],
  ]) {
    prism(out, x, plane + 0.32, 1.9, 1.76, -0.8, 10.6, 'stone', tint.courtStone);
    prism(out, x, plane + 0.11, 1.61, 1.38, 9.98, 18.6, 'stone', tint.stone);
    prism(out, x, plane - 0.04, 1.44, 1.18, 18.12, rise, 'stone', tint.stone);
    prism(out, x, plane - 0.04, 1.68, 1.39, rise - 0.19, rise + 0.11, 'trim', tint.rim);
  }
  const base = [
    [left + 0.8, -1.2],
    [right - 0.8, -1.2],
    [right - 0.8, 4.7],
    [left + 0.8, 4.7],
  ];
  area(out, 'stone', gable, base, -0.035, north, tint.stone);
  porch(out, lod, middle);
}

function porch(out, lod, middle) {
  const v = 19.2;
  const point = (u, y, d) => at(u, y, v + d);
  const outer = [
    [middle - 5.85, 0.95],
    [middle + 5.85, 0.95],
    [middle + 5.85, 7.95],
    [middle - 5.85, 7.95],
  ];
  const holes = [-2.52, 2.52].map((x) => arch(middle + x, 3.88, 1.07, 4.8, 6.72, lod < 2 ? 8 : 14));
  area(out, 'stone', point, outer, 0, north, tint.stone, holes);
  for (const hole of holes) {
    reveal(out, point, hole, 1.82, tint.darkStone);
    area(out, 'timber', point, hole, -1.82, north, tint.wood);
    rim(out, point, hole, 0.45, 0.092, north);
  }
  for (const offset of [-5.53, 5.53]) {
    prism(out, middle + offset, v - 1.87, 0.67, 3.77, -0.7, 7.6, 'stone', tint.stone);
  }
  prism(out, middle, v - 1.1, 11.95, 2.52, 7.58, 7.95, 'trim', tint.rim);
  prism(out, middle, v - 1.06, 11.91, 2.47, 8.82, 9.06, 'trim', tint.light);
  prism(out, middle, v - 1.11, 11.8, 2.42, 7.95, 8.83, 'stone', tint.darkStone);
  if (lod >= 1) {
    for (let i = 0; i < 11; i++) {
      const center = middle - 5.15 + i * 1.03;
      const ring = [
        [center - 0.38, 8.38],
        [center, 8.78],
        [center + 0.38, 8.38],
        [center, 7.99],
      ];
      ring.forEach((a, j) => {
        stroke(out, 'trim', point, a, ring[(j + 1) % 4], 0.123, 0.142, north, tint.light);
      });
    }
  }
  const n = lod === 0 ? 2 : lod === 1 ? 3 : 6;
  for (let j = 0; j < n; j++) {
    prism(
      out,
      middle,
      v + 0.44 - j * 0.23,
      10.35 - j * 0.06,
      1.62,
      -0.31,
      0.12 + (1.03 * (j + 1)) / n,
      'trim',
      tint.rim,
    );
  }
}

function crossAndChancel(out, lod) {
  const [left, right] = q.northGable;
  const middle = (left + right) / 2;
  const along = (v, y, u) => at(u, y, v);
  for (const [u, s] of [
    [left, -1],
    [right, 1],
  ]) {
    const side = (v, y, d) => at(u + s * d, y, v);
    area(
      out,
      'stone',
      side,
      [
        [-14, 5.3],
        [q.northWall, 5.3],
        [q.northWall, q.northEaves],
        [-14, q.northEaves],
      ],
      0,
      s > 0 ? east : invert(east),
      tint.stone,
    );
  }
  const southFace = (u, y, d) => at(u, y, -14 - d);
  const southWindow = arch(middle, 7.06, 9.1, 17.8, 21.3, lod < 2 ? 8 : 14);
  area(
    out,
    'stone',
    southFace,
    [
      [left, 5.3],
      [right, 5.3],
      [right, q.northEaves],
      [middle, q.northRidge],
      [left, q.northEaves],
    ],
    0,
    invert(north),
    tint.stone,
    [southWindow],
  );
  area(out, 'glass', southFace, southWindow, -0.45, invert(north), tint.shade);
  reveal(out, southFace, southWindow, 0.45, tint.darkStone);
  rim(out, southFace, southWindow, 0.33, 0.085, invert(north));
  pitched(
    out,
    along,
    -14.3,
    q.northWall + 0.2,
    middle,
    right - left + 0.36,
    q.northEaves,
    q.northRidge,
  );
  const apsis = [
    [26.6, -7.8],
    [27, -5.3],
    [29.7, -5.13],
    [33.2, -3.86],
    [35.6, -0.6],
    [35.88, 2.35],
    [34.2, 5.55],
    [31.9, 7.57],
    [27, 7.77],
  ];
  apsis.forEach(([u, v], i) => {
    if (i === apsis.length - 1) return;
    const a = apsis[i],
      b = apsis[i + 1];
    const normal = at(b[1] - a[1], 0, a[0] - b[0]);
    const window = arch(0.5, 0.36, 9.2, 14.0, 15.95, lod < 2 ? 6 : 10);
    const wall = (t, y, d) => {
      const p = mix(a, b, t);
      const w = at(p[0], y, p[1]);
      const length = Math.hypot(normal[0], normal[2]);
      return w.map((value, j) => value + (d * normal[j]) / length);
    };
    area(
      out,
      'stone',
      wall,
      [
        [0, 6],
        [1, 6],
        [1, 18.5],
        [0, 18.5],
      ],
      0,
      normal,
      tint.stone,
      [window],
    );
    if (lod > 0) {
      reveal(out, wall, window, 0.24, tint.darkStone);
      area(out, 'glass', wall, window, -0.24, normal, tint.glass);
    }
    panel(out, 'clay', [at(u, 18.5, v), at(b[0], 18.5, b[1]), at(27, 26.6, 1.2)], up, tint.clay);
  });
}

function build(out, lod) {
  mappedAisles(out);
  nave(out, lod);
  crossAndChancel(out, lod);
  northFront(out, lod);
}
export const cathedralSkyline = (out) => build(out, 0);
export const cathedralDistrict = (out) => build(out, 1);
export const cathedralStreet = (out) => build(out, 2);
export const cathedralCloseup = (out) => build(out, 3);
const recipe = 'st-georges-cathedral-cape-town-model.mjs';
const camera = at(-36, 34, 66);
const lookAt = at(0, 11.2, 0);
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: cathedralCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'St. George’s Cathedral in Cape Town, with the stone Wale Street transept and paired porch, steep red roofs, pointed clerestory and rounded chancel end.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: -2.4,
  sunDirection: at(-13, 32, 43),
  mediumFiContext: {
    scale: 1.26,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'Mapped named cathedral church footprint.',
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'stone_limestone_weathered',
    'tile_flat',
    'slate',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'wale-street-transept-and-twin-porch',
      position: at(-11.1, 12.0, 56),
      lookAt: at(3.9, 13.3, 16.1),
    },
    {
      name: 'transept-tracery-and-stepped-buttresses',
      position: at(3.95, 16, 42),
      lookAt: at(3.95, 16, 16),
    },
    {
      name: 'rounded-chancel-and-crossing-roofs',
      position: at(61, 31, -27),
      lookAt: at(15.2, 13, 2),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `wale-street-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'cathedralDistrict', 0.48],
        ['street', 'cathedralStreet', 0.16],
        ['closeup', 'cathedralCloseup', 0.065],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The mapped outline is ODbL. The selected original photograph is public domain by Mike Hayes.',
};
