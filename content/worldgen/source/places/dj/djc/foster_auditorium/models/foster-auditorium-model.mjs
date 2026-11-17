/** Restored Foster Auditorium at the University of Alabama in November 2010. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const q = plan.section;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  plinth: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.17 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.12 },
};
const tint = Object.fromEntries(
  Object.entries({
    brick: 'a06656',
    warmBrick: 'ac7260',
    oldBrick: '886451',
    stone: 'c6bfb1',
    bright: 'd7ceba',
    shadow: 'a29b8d',
    plinth: 'bfb6a7',
    roof: '777975',
    roofLight: '8a8a80',
    frame: 'd5cebf',
    glass: '525c62',
    upperGlass: '62737d',
    dark: '414747',
    metal: '454541',
    bronze: '796851',
    ivory: 'd6cdbd',
    letter: '4c4b47',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const north = outline[15][1],
  facade = outline[12][1] + 0.005;
const xLeft = outline[16][0],
  xRight = outline[15][0],
  center = (xLeft + xRight) / 2;
const front = (u, y, d = 0) => [u, y, facade + d];
const portico = (u, y, d = 0) => [u, y, north + d];

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function panel(out, slot, p, normal, color) {
  const n = normalFor(...p);
  const xy = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? p : p.toReversed();
  if (xy.length === 4) face(out, slot, xy, color);
  else triangle(out, slot, xy, color);
}

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const u = dx / length,
    v = dz / length,
    normal = [v, 0, -u];
  return {
    length,
    normal,
    point: (x, y, d = 0) => [a[0] + x * u + d * v, y, a[1] + x * v - d * u],
  };
}

function flat(out, slot, point, poly, d, color) {
  const order = earcut(poly.flat());
  const normal = normalFor(point(0, 0, d), point(1, 0, d), point(0, 1, d));
  for (let i = 0; i < order.length; i += 3)
    panel(
      out,
      slot,
      order.slice(i, i + 3).map((j) => point(...poly[j], d)),
      normal,
      color,
    );
}

function trim(out, slot, point, poly, d, color, depth = 0) {
  flat(out, slot, point, poly, d, color);
  if (depth === 0) return;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    face(
      out,
      slot,
      [point(...a, d), point(...a, d - depth), point(...b, d - depth), point(...b, d)],
      color,
    );
  }
}

function cap(out, ring, height, color) {
  const order = earcut(ring.flat());
  for (let i = 0; i < order.length; i += 3)
    panel(
      out,
      'roof',
      order.slice(i, i + 3).map((j) => [ring[j][0], height(...ring[j]), ring[j][1]]),
      [0, 1, 0],
      color,
    );
}

function mass(out, ring, eave, plinth, sideColor) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      s = section(a, b),
      p = s.point;
    const lowA = grade(...a) - 0.26,
      lowB = grade(...b) - 0.26;
    panel(
      out,
      'plinth',
      [p(0, lowA), p(s.length, lowB), p(s.length, plinth), p(0, plinth)],
      s.normal,
      tint.plinth,
    );
    panel(
      out,
      'brick',
      [p(0, plinth), p(s.length, plinth), p(s.length, eave), p(0, eave)],
      s.normal,
      sideColor,
    );
  }
}

function sash(out, p, x, y, w, h, lod, door = false) {
  const a = x - w / 2,
    b = x + w / 2,
    d = door ? 0.049 : 0.034;
  if (lod === 0) {
    trim(out, 'glass', p, rect(a, y, b, y + h), d + 0.014, door ? tint.dark : tint.upperGlass);
    return;
  }
  trim(out, 'stone', p, rect(a - 0.085, y - 0.07, b + 0.085, y + h + 0.082), d, tint.frame);
  trim(
    out,
    'glass',
    p,
    rect(a + 0.035, y + 0.035, b - 0.035, y + h - 0.034),
    d + 0.014,
    door ? tint.dark : tint.upperGlass,
  );
  trim(
    out,
    'stone',
    p,
    rect(x - 0.021, y + 0.035, x + 0.021, y + h - 0.034),
    d + 0.026,
    tint.frame,
  );
  trim(
    out,
    'stone',
    p,
    rect(a + 0.035, y + h * 0.53, b - 0.035, y + h * 0.53 + 0.043),
    d + 0.026,
    tint.frame,
  );
  if (lod >= 1) {
    for (const z of [0.29, 0.76])
      trim(
        out,
        'stone',
        p,
        rect(a + 0.035, y + h * z, b - 0.035, y + h * z + 0.028),
        d + 0.026,
        tint.frame,
      );
    if (w > 0.64)
      for (const u of [x - w * 0.24, x + w * 0.24])
        trim(
          out,
          'stone',
          p,
          rect(u - 0.013, y + 0.034, u + 0.013, y + h - 0.034),
          d + 0.028,
          tint.frame,
        );
  }
  if (door && lod >= 2) {
    trim(out, 'stone', p, rect(a + 0.038, y + 0.04, b - 0.038, y + 0.4), d + 0.033, tint.ivory);
    trim(out, 'metal', p, rect(x + 0.078, y + 0.76, x + 0.147, y + 0.798), d + 0.041, tint.bronze);
  }
}

function fanlight(out, x, y, w, lod) {
  const n = [4, 8, 12, 16][lod],
    rad = w / 2;
  const curve = (r) =>
    Array.from({ length: n + 1 }, (_, i) => [
      x + r * Math.cos((i * Math.PI) / n),
      y + r * Math.sin((i * Math.PI) / n),
    ]);
  const arc = curve(rad),
    rim = curve(rad + 0.122);
  flat(out, 'glass', front, arc, 0.076, tint.glass);
  if (lod === 0) return;
  for (let i = 0; i < n; i++)
    panel(
      out,
      'brick',
      [
        front(...arc[i], 0.092),
        front(...arc[i + 1], 0.092),
        front(...rim[i + 1], 0.105),
        front(...rim[i], 0.105),
      ],
      [0, 0, 1],
      i % 3 === 0 ? tint.warmBrick : tint.oldBrick,
    );
  trim(
    out,
    'stone',
    front,
    rect(x - 0.1, y + rad + 0.052, x + 0.1, y + rad + 0.235),
    0.116,
    tint.bright,
  );
  if (lod >= 1)
    for (const a of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
      const dx = 0.018 * Math.sin(a),
        dy = 0.018 * Math.cos(a),
        u = rad * Math.cos(a),
        v = rad * Math.sin(a);
      flat(
        out,
        'stone',
        front,
        [
          [x - dx, y],
          [x + dx, y],
          [x + u + dx, y + v - dy],
          [x + u - dx, y + v + dy],
        ],
        0.1,
        tint.frame,
      );
    }
}

function colonnade(out, lod) {
  const west = xLeft - 0.22,
    east = xRight + 0.22,
    z = north - 0.54;
  const doorways = [
    [center - 4.65, 1.71],
    [center, 1.7],
    [center + 4.65, 1.71],
  ];
  const base = Math.min(grade(west, north), grade(center, north), grade(east, north)) - 0.25;
  const floorField = (x) => Math.max(0.085, grade(x, north) + 0.075);
  let innerEdge = west;
  for (const [x, w] of doorways) {
    const left = x - w / 2 - 0.18,
      right = x + w / 2 + 0.18;
    const floor = floorField(x),
      lintel = floor + 2.73;
    box(
      out,
      'plinth',
      [innerEdge, base, north - 0.43],
      [left, q.plinth, north + 0.11],
      tint.plinth,
    );
    box(out, 'plinth', [left, lintel, north - 0.43], [right, q.plinth, north + 0.11], tint.plinth);
    if (lod > 0)
      box(out, 'stone', [left, base, north - 0.43], [right, floor, north + 0.2], tint.stone);
    const p = (u, y, d = 0) => [u, y, north - 0.29 + d];
    const backingTop = lintel - 0.015;
    if (lod > 0) trim(out, 'stone', p, rect(left, floor, right, backingTop), 0, tint.shadow);
    sash(out, p, x, floor + 0.019, w, 2.55, lod, true);
    innerEdge = right;
  }
  box(out, 'plinth', [innerEdge, base, north - 0.43], [east, q.plinth, north + 0.11], tint.plinth);
  box(
    out,
    'stone',
    [west - 0.07, q.plinth - 0.11, facade - 0.04],
    [east + 0.07, q.plinth + 0.16, north + 0.18],
    tint.shadow,
  );
  box(
    out,
    'stone',
    [west - 0.1, q.plinth + 0.12, north - 0.15],
    [east + 0.1, q.plinth + 0.22, north + 0.23],
    tint.bright,
  );
  const sides = [5, 12, 16, 22][lod];
  const stations = Array.from({ length: q.porticoColumns }, (_, i) =>
    mix(xLeft + 0.63, xRight - 0.63, i / (q.porticoColumns - 1)),
  );
  for (const x of stations) {
    const base = q.columnFoot,
      top = q.columnTop;
    const profile =
      lod === 0
        ? [
            [base, 0.6],
            [base + 0.23, 0.39],
            [top - 0.19, 0.32],
            [top, 0.56],
          ]
        : [
            [base, 0.58],
            [base + 0.1, 0.58],
            [base + 0.16, 0.48],
            [base + 0.25, 0.46],
            [base + 0.34, 0.42],
            [top - 0.54, 0.336],
            [top - 0.32, 0.37],
            [top - 0.2, 0.45],
            [top - 0.09, 0.49],
            [top, 0.52],
          ];
    loft(
      out,
      'stone',
      profile.map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
      tint.stone,
      { cap: lod > 0 },
    );
    box(
      out,
      'stone',
      [x - 0.63, top - 0.028, z - 0.49],
      [x + 0.63, top + 0.12, z + 0.46],
      tint.bright,
    );
    if (lod >= 1)
      for (const sign of [-1, 1]) {
        const ring = Array.from({ length: lod >= 2 ? 12 : 8 }, (_, i) => {
          const a = (i * 2 * Math.PI) / (lod >= 2 ? 12 : 8);
          return [x + sign * 0.47 + 0.166 * Math.cos(a), top - 0.11 + 0.147 * Math.sin(a)];
        });
        const p = (u, y, d = 0) => [u, y, z + 0.443 + d];
        trim(out, 'stone', p, ring, 0.034, tint.bright, lod >= 2 ? 0.076 : 0);
      }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i] + 0.48,
      b = stations[i + 1] - 0.48;
    const railing = (u, y, d = 0) => [u, y, north - 0.007 + d];
    trim(out, 'metal', railing, rect(a, q.plinth + 0.2, b, q.plinth + 0.238), 0.055, tint.metal);
    trim(out, 'metal', railing, rect(a, q.plinth + 0.94, b, q.plinth + 0.984), 0.055, tint.metal);
    if (lod >= 1) {
      const count = lod === 1 ? 6 : 12;
      for (let j = 0; j < count; j++) {
        const x = mix(a, b, j / (count - 1));
        trim(
          out,
          'metal',
          railing,
          rect(x - 0.015, q.plinth + 0.232, x + 0.015, q.plinth + 0.947),
          0.06,
          tint.metal,
        );
      }
    }
  }
  const top = q.entablatureTop;
  box(
    out,
    'stone',
    [west - 0.16, q.columnTop + 0.09, facade - 0.09],
    [east + 0.16, top, north + 0.13],
    tint.stone,
  );
  for (const [y, d, t] of [
    [12.12, 0.19, 0.085],
    [12.72, 0.24, 0.096],
    [12.95, 0.32, 0.092],
  ]) {
    box(out, 'stone', [west - 0.22, y, facade - 0.1], [east + 0.22, y + t, north + d], tint.bright);
  }
  const peak = q.pedimentPeak,
    pedimentWidth = east - west + 0.54;
  const lo = center - pedimentWidth / 2,
    hi = center + pedimentWidth / 2;
  const slope = [
    [lo, top],
    [hi, top],
    [center, peak],
  ];
  trim(out, 'stone', portico, slope, 0.19, tint.stone, 0.24);
  for (const [a, b] of [
    [lo, center],
    [center, hi],
  ]) {
    const ya = a === lo ? top : peak,
      yb = b === hi ? top : peak;
    trim(
      out,
      'stone',
      portico,
      [
        [a, ya],
        [b, yb],
        [b, yb + 0.13],
        [a, ya + 0.13],
      ],
      0.3,
      tint.bright,
      0.1,
    );
    panel(
      out,
      'roof',
      [
        [a, ya + 0.13, north + 0.3],
        [b, yb + 0.13, north + 0.3],
        [b, yb + 0.13, facade - 0.03],
        [a, ya + 0.13, facade - 0.03],
      ],
      [0, 1, 0],
      tint.roof,
    );
  }
  if (lod >= 1) {
    const dentils = lod === 1 ? 24 : 48;
    for (let i = 0; i < dentils; i++) {
      const x = mix(lo + 0.12, hi - 0.15, i / (dentils - 1));
      const y = top + (peak - top) * (1 - Math.abs(x - center) / (pedimentWidth / 2));
      trim(
        out,
        'stone',
        portico,
        rect(x - 0.047, y - 0.135, x + 0.047, y - 0.015),
        0.276,
        tint.bright,
        lod >= 2 ? 0.04 : 0,
      );
    }
    inscription(out, lod);
  }
}

const glyphs = {
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.23, 0.42],
      [0.77, 0.42],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0.25],
      [0.19, 0],
      [0.81, 0],
      [1, 0.25],
      [1, 1],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.64, 1],
      [1, 0.71],
      [1, 0.27],
      [0.63, 0],
      [0, 0],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0.2, 0],
      [0.8, 0],
    ],
    [
      [0.2, 1],
      [0.8, 1],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  O: [
    [
      [0.18, 0],
      [0, 0.23],
      [0, 0.77],
      [0.18, 1],
      [0.82, 1],
      [1, 0.77],
      [1, 0.23],
      [0.82, 0],
      [0.18, 0],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.74, 1],
      [1, 0.82],
      [1, 0.61],
      [0.74, 0.47],
      [0, 0.47],
    ],
    [
      [0.47, 0.47],
      [1, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.5, 0.41],
      [1, 1],
      [1, 0],
    ],
  ],
};
function inscription(out, lod) {
  const word = 'AUDITORIUM',
    advance = 1.14,
    w = 0.45,
    h = 0.57,
    y = 12.21;
  for (const [i, ch] of [...word].entries())
    for (const path of glyphs[ch])
      for (let j = 1; j < path.length; j++) {
        const [a, b] = path[j - 1],
          [c, d] = path[j],
          x = center + (i - (word.length - 1) / 2) * advance - w / 2;
        const u = (c - a) * w,
          v = (d - b) * h,
          r = (lod === 1 ? 0.022 : 0.026) / Math.hypot(u, v),
          ox = -v * r,
          oy = u * r;
        const shape = [
          [x + a * w + ox, y + b * h + oy],
          [x + c * w + ox, y + d * h + oy],
          [x + c * w - ox, y + d * h - oy],
          [x + a * w - ox, y + b * h - oy],
        ];
        panel(
          out,
          'metal',
          shape.map((p) => portico(...p, 0.146)),
          [0, 0, 1],
          tint.letter,
        );
      }
}

function facadeBays(out, lod) {
  const wings = [-17.75, -14.75, -11.74, 11.0, 14.07, 17.11];
  const middle = [-6.34, -3.36, -0.41, 2.58, 5.52];
  for (const x of [...wings, ...middle]) {
    sash(out, front, x, 8.78, 1.14, 1.96, lod);
    if (lod > 0)
      trim(out, 'stone', front, rect(x - 0.51, 7.67, x + 0.51, 8.15), 0.079, tint.shadow);
    sash(out, front, x, 3.46, 1.22, 2.18, lod, true);
    fanlight(out, x, 5.69, 1.22, lod);
  }
  for (const x of wings) sash(out, front, x, 0.57, 1.02, 1.9, lod);
  for (const x of [xLeft - 0.44, xRight + 0.43, -19.81, 18.51]) {
    const tall = lod === 0 ? 0 : 10;
    for (let i = 0; i < tall; i++) {
      const y = 3.3 + i * (8.66 / tall),
        w = i % 2 === 0 ? 0.46 : 0.28;
      trim(out, 'stone', front, rect(x - w / 2, y, x + w / 2, y + 0.41), 0.091, tint.stone);
    }
  }
  for (const [left, right] of [
    [-20.17, xLeft - 0.28],
    [xRight + 0.28, 18.9],
  ]) {
    trim(out, 'stone', front, rect(left, 11.64, right, 12.18), 0.18, tint.stone, 0.12);
    trim(out, 'stone', front, rect(left, 12.16, right, 12.29), 0.27, tint.bright, 0.16);
    trim(
      out,
      'stone',
      front,
      rect(left, q.plinth - 0.095, right, q.plinth + 0.13),
      0.167,
      tint.bright,
      0.07,
    );
  }
  for (const [a, b] of [
    [outline[9], outline[10]],
    [outline[21], outline[22]],
  ]) {
    const s = section(a, b),
      p = (x, y, d = 0) => s.point(s.length - x, y, d);
    const mid = s.length / 2;
    sash(out, p, mid, 3.72, 1.1, 1.6, lod);
    sash(out, p, mid, 6.8, 1.0, 1.9, lod);
    trim(out, 'stone', p, rect(0, 10.42, s.length, 10.8), 0.17, tint.bright, 0.1);
    trim(
      out,
      'stone',
      p,
      [
        [mid - 0.75, 5.4],
        [mid + 0.75, 5.4],
        [mid, 5.78],
      ],
      0.11,
      tint.bright,
      0.095,
    );
  }
}

function building(out, lod) {
  // The front ring ends at the lobby wall. The projecting portico is built separately.
  const lobby = [...outline.slice(3, 13), outline[19], ...outline.slice(20, 29)];
  const arena = [outline[1], outline[3], outline[28], outline[29]];
  const back = [...outline.slice(29), outline[0], outline[1]];
  mass(out, lobby, q.lobbyEaves, q.plinth, tint.brick);
  cap(out, lobby, () => q.lobbyEaves, tint.roof);
  const upper = [
    [-9.96, 35.49],
    [-9.96, 26.17],
    [9.77, 26.18],
    [9.77, 35.5],
  ];
  for (let i = 0; i < upper.length; i++) {
    const s = section(upper[i], upper[(i + 1) % upper.length]),
      p = (u, y, d = 0) => s.point(s.length - u, y, d);
    trim(
      out,
      'brick',
      p,
      rect(0, q.lobbyEaves - 0.018, s.length, q.lobbyParapet),
      0,
      tint.warmBrick,
    );
    trim(
      out,
      'stone',
      p,
      rect(0, q.lobbyParapet - 0.11, s.length, q.lobbyParapet + 0.03),
      0.083,
      tint.stone,
      0.1,
    );
  }
  cap(out, upper, () => q.lobbyParapet - 0.1, tint.roof);
  mass(out, arena, q.arenaEaves, 2.1, tint.brick);
  const [a, b, c, d] = arena;
  const frontRidge = [(c[0] + b[0]) / 2, (c[1] + b[1]) / 2];
  const rearRidge = [(d[0] + a[0]) / 2, (d[1] + a[1]) / 2];
  const axis = frontRidge[0];
  const rise = (x) =>
    q.arenaRidge - ((q.arenaRidge - q.arenaEaves) * Math.abs(x - axis)) / ((b[0] - c[0]) / 2);
  cap(out, [a, b, frontRidge, rearRidge], (x) => rise(x), tint.roof);
  cap(out, [rearRidge, frontRidge, c, d], (x) => rise(x), tint.roofLight);
  for (const [left, right, mid, normal] of [
    [c, b, frontRidge, [0, 0, 1]],
    [a, d, rearRidge, [0, 0, -1]],
  ]) {
    panel(
      out,
      'brick',
      [
        [left[0], q.arenaEaves, left[1]],
        [right[0], q.arenaEaves, right[1]],
        [mid[0], q.arenaRidge, mid[1]],
      ],
      normal,
      tint.oldBrick,
    );
  }
  mass(out, back, q.annexRoof, 1.0, tint.oldBrick);
  cap(out, back, () => q.annexRoof, tint.roof);
  const sideWindows = [
    [outline[1], outline[3]],
    [outline[28], outline[29]],
    [outline[41], outline[45]],
  ];
  for (const [start, end] of lod === 0 ? [] : sideWindows) {
    const s = section(start, end),
      p = (x, y, d = 0) => s.point(s.length - x, y, d);
    for (let i = 0; i < 5; i++) {
      const x = ((i + 0.55) * s.length) / 5.1;
      sash(out, p, x, 6.52, 1.66, 2.7, lod);
      if (lod >= 1) sash(out, p, x, 2.52, 1.19, 1.7, lod - 1);
      if (lod >= 2) trim(out, 'stone', p, rect(x - 1.05, 9.24, x + 1.05, 9.35), 0.071, tint.shadow);
    }
  }
  facadeBays(out, lod);
  colonnade(out, lod);
}
export const fosterSkyline = (out) => building(out, 0);
export const fosterDistrict = (out) => building(out, 1);
export const fosterStreet = (out) => building(out, 2);
export const fosterCloseup = (out) => building(out, 3);
const recipe = 'foster-auditorium-model.mjs';
const camera = [44, 27, 89],
  lookAt = [-0.8, 8.8, 5.0];
export const fosterModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: fosterCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The University of Alabama auditorium after its 2010 renovation, with six Ionic columns, a lettered limestone pediment and a brick arena behind its historic entry.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-25, 40, 45],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.93,
    basis: 'Named mapped auditorium and attached service rooms at 801 Sixth Avenue.',
  },
  embeddedCanonicalGraphs: [
    'brick',
    'stone_limestone',
    'stone_ashlar',
    'metal_standing_seam',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'malone-hood-plaza-and-ionic-portico',
      position: [19, 6.4, 66],
      lookAt: [-1.0, 7.8, 36.5],
    },
    { name: 'schoolhouse-doors-and-fanlights', position: [-6, 3.2, 53], lookAt: [-0.5, 5.4, 37.6] },
    { name: 'arena-roof-and-south-rooms', position: [57, 35, -59], lookAt: [0, 7.1, -11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-auditorium-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'fosterSkyline',
    errorMeters: 0.94,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'fosterDistrict', 0.42],
        ['street', 'fosterStreet', 0.142],
        ['closeup', 'fosterCloseup', 0.058],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The map outline is ODbL. The four exact Qualla photographs were released by their authors into the public domain.',
};
