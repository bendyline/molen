/** Hautefort's limestone residence, domed towers and drawbridge entrance. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  raw: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0.12 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.8, metallic: 0.25 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51, metallic: 0.12 },
};
const c = Object.fromEntries(
  Object.entries({
    limestone: 'bcab92',
    light: 'cbbca4',
    joint: 'ab9d89',
    plinth: '958979',
    roof: '595b5c',
    seam: '6d6e6c',
    green: '6e8373',
    oxidized: '7e9381',
    glass: '535752',
    frame: 'a89d87',
    bright: 'd4d0bd',
    shadow: '45443b',
    wood: '69533e',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const up = [0, 1, 0],
  white = 'palette:#ffffff',
  front = [0, 0, 1];
const p3 = ([x, z], y) => [x, y, z];

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
}

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

const foot = (p) => Math.min(s.floor - 0.3, ground(p) - 0.27);

function plane(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const tangent = [dx / length, dz / length],
    normal = [tangent[1], 0, -tangent[0]];
  const at = (u, y, offset = 0) => [
    a[0] + u * tangent[0] + offset * normal[0],
    y,
    a[1] + u * tangent[1] + offset * normal[2],
  ];
  return { a, b, length, normal, at };
}

function planar(out, slot, ring, holes, to3d, normal, tint) {
  const xy = [...ring, ...holes.flat()];
  let next = ring.length;
  const indices = earcut(
    xy.flat(),
    holes.map((hole) => {
      const offset = next;
      next += hole.length;
      return offset;
    }),
  );
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => xy[index]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-8) continue;
    face(out, slot, [a, b, c].map(to3d), normal, tint);
  }
}

function elevation(out, wall, top, rows, columns, lod) {
  const { a, b, length, at, normal } = wall;
  face(
    out,
    'raw',
    [at(0, foot(a)), at(length, foot(b)), at(length, s.floor), at(0, s.floor)],
    normal,
    c.plinth,
  );
  const ring = [
    [0, s.floor],
    [length, s.floor],
    [length, top],
    [0, top],
  ];
  const openings = [];
  if (lod && columns) {
    for (let i = 0; i < columns; i++) {
      const u = (length * (i + 0.5)) / columns;
      for (const [y, h, w] of rows) {
        const width = Math.min(w, (length / columns) * 0.57);
        openings.push([
          [u - width / 2, y],
          [u + width / 2, y],
          [u + width / 2, y + h],
          [u - width / 2, y + h],
        ]);
      }
    }
  }
  planar(out, 'stone', ring, lod >= 2 ? openings : [], ([u, y]) => at(u, y), normal, c.limestone);
  for (const window of openings) {
    const [[u, y], [v], [, h]] = window;
    if (lod === 1) {
      planar(out, 'glass', window, [], ([u, y]) => at(u, y, 0.018), normal, c.glass);
      continue;
    }
    const depth = -0.28;
    planar(out, 'glass', window, [], ([u, y]) => at(u, y, depth), normal, c.glass);
    for (let i = 0; i < window.length; i++) {
      const [a, y] = window[i],
        [b, h] = window[(i + 1) % window.length];
      const points = [at(a, y), at(b, h), at(b, h, depth), at(a, y, depth)];
      face(out, 'raw', points, normalFor(...points), c.joint);
    }
    if (lod === 2) {
      face(
        out,
        'stone',
        [
          at(u - 0.08, y - 0.09, 0.049),
          at(v + 0.08, y - 0.09, 0.049),
          at(v + 0.08, y + 0.045, 0.049),
          at(u - 0.08, y + 0.045, 0.049),
        ],
        normal,
        c.light,
      );
      continue;
    }
    beam(
      out,
      'stone',
      at(u - 0.1, y - 0.035, 0.052),
      at(v + 0.1, y - 0.035, 0.052),
      0.11,
      0.18,
      c.light,
    );
    beam(
      out,
      'stone',
      at(u - 0.07, h + 0.061, 0.032),
      at(v + 0.07, h + 0.061, 0.032),
      0.083,
      0.15,
      c.light,
    );
    beam(
      out,
      'stone',
      at((u + v) / 2, y, depth + 0.04),
      at((u + v) / 2, h, depth + 0.04),
      0.061,
      0.067,
      c.bright,
    );
    beam(
      out,
      'stone',
      at(u, y + (h - y) * 0.61, depth + 0.04),
      at(v, y + (h - y) * 0.61, depth + 0.04),
      0.061,
      0.067,
      c.bright,
    );
  }
}

function cornice(out, wall, top, lod, detail) {
  const { at, length, normal } = wall;
  const y = top - 0.4;
  face(
    out,
    'stone',
    [at(0, y, 0.09), at(length, y, 0.09), at(length, top + 0.06, 0.16), at(0, top + 0.06, 0.16)],
    normal,
    c.light,
  );
  if (lod < 2 || !detail) return;
  const n = Math.max(2, Math.floor(length / 0.57));
  for (let i = 0; i < n; i++) {
    const u = (length * (i + 0.5)) / n;
    const a = at(u - 0.092, y - 0.3, 0.093),
      b = at(u + 0.092, y - 0.3, 0.093);
    const d = at(u - 0.092, y + 0.055, 0.19),
      e = at(u + 0.092, y + 0.055, 0.19);
    face(out, 'stone', [a, b, e, d], normal, c.joint);
  }
}

function hipped(out, [x, u, z, v], eave, rise, lod) {
  const a = [x - 0.12, eave, z - 0.12],
    b = [u + 0.12, eave, z - 0.12];
  const d = [u + 0.12, eave, v + 0.12],
    e = [x - 0.12, eave, v + 0.12];
  const width = u - x,
    depth = v - z;
  const [r, t] =
    width > depth
      ? [
          [x + depth * 0.43, eave + rise, (z + v) / 2],
          [u - depth * 0.43, eave + rise, (z + v) / 2],
        ]
      : [
          [(x + u) / 2, eave + rise, z + width * 0.43],
          [(x + u) / 2, eave + rise, v - width * 0.43],
        ];
  const faces =
    width > depth
      ? [
          [a, b, t, r],
          [b, d, t],
          [d, e, r, t],
          [e, a, r],
        ]
      : [
          [a, b, r],
          [b, d, t, r],
          [d, e, t],
          [e, a, r, t],
        ];
  for (const points of faces) face(out, 'roof', points, up, c.roof);
  if (!lod) return;
  beam(out, 'roof', r, t, 0.12, 0.13, c.seam);
  for (const [xx, zz] of [
    [r[0] + 0.51, r[2] + 0.32],
    [t[0] - 0.5, t[2] - 0.35],
  ]) {
    const y = eave + rise - 1.73;
    box(out, 'raw', xx, y, zz, 0.72, 1.97, 0.67, c.limestone);
    box(out, 'stone', xx, y + 1.89, zz, 0.86, 0.16, 0.78, c.light);
  }
}

function range(out, bounds, eave, rise, lod, roof = true) {
  const [x, u, z, v] = bounds;
  const ring = [
    [x, z],
    [u, z],
    [u, v],
    [x, v],
  ];
  const levels = eave > 15.6 ? 4 : 3;
  const rows = Array.from({ length: levels }, (_, i) => {
    const y = 1.3 + (i * (eave - 3.1)) / levels;
    return [y, i === 0 ? 1.0 : i === levels - 1 ? 1.45 : 2.15, i === 0 ? 0.63 : 1.15];
  });
  for (let i = 0; i < ring.length; i++) {
    const wall = plane(ring[i], ring[(i + 1) % ring.length]);
    const n = i === 1 || i === 2 ? Math.round(wall.length / 4.3) : Math.round(wall.length / 5.4);
    elevation(out, wall, eave, lod === 1 ? rows.filter((_, j) => j > 0) : rows, n, lod);
    cornice(out, wall, eave, lod, i === 1 || i === 2);
  }
  if (roof) hipped(out, bounds, eave, rise, lod);
  else
    face(
      out,
      'roof',
      ring.map((point) => p3(point, eave - 0.025)),
      up,
      c.roof,
    );
}

function roundProfile(out, slot, center, sides, rings, tint) {
  loft(
    out,
    slot,
    rings.map(([y, r]) => radialRing(y, r, r, sides, center)),
    tint,
  );
}

function dome(out, { center, radius, eave, domeTop, lanternTop }, lod) {
  if (!lod) {
    const neck = radius * 0.23,
      base = domeTop + (lanternTop - domeTop) * 0.54;
    roundProfile(
      out,
      'roof',
      center,
      8,
      [
        [eave, radius],
        [eave + (domeTop - eave) * 0.7, radius * 0.76],
        [domeTop, neck],
      ],
      c.roof,
    );
    for (const [x, , z] of radialRing(0, neck * 0.91, neck * 0.91, 4, center)) {
      box(
        out,
        'copper',
        x,
        domeTop - 0.025,
        z,
        neck * 0.16,
        base - domeTop + 0.1,
        neck * 0.16,
        c.green,
      );
    }
    roundProfile(
      out,
      'roof',
      center,
      6,
      [
        [base, neck * 1.1],
        [lanternTop - 0.62, neck * 0.45],
        [lanternTop - 0.24, neck * 0.1],
      ],
      c.roof,
    );
    return;
  }
  const n = [8, 12, 22, 32][lod],
    steps = [2, 5, 7, 9][lod];
  const collar = (domeTop - eave) * 0.17;
  const neck = radius * 0.23;
  const rings = Array.from({ length: steps + 1 }, (_, i) => {
    const t = ((Math.PI / 2) * i) / steps;
    return [eave + (domeTop - eave) * Math.sin(t), neck + (radius - neck) * Math.cos(t)];
  });
  roundProfile(out, 'roof', center, n, rings, c.roof);
  if (lod >= 2) {
    for (let i = 0; i < n; i += 3) {
      const t = (2 * Math.PI * i) / n;
      beamPath(
        out,
        'roof',
        rings.map(([y, r]) => [
          center[0] + (r + 0.014) * Math.cos(t),
          y + 0.016,
          center[1] + (r + 0.014) * Math.sin(t),
        ]),
        0.029,
        0.037,
        c.seam,
      );
    }
  }
  const capBase = domeTop + (lanternTop - domeTop) * 0.56;
  roundProfile(
    out,
    'roof',
    center,
    n,
    [
      [domeTop - 0.12, neck * 1.12],
      [domeTop + 0.31, neck * 1.13],
    ],
    c.roof,
  );
  const posts = 8,
    postRing = radialRing(0, neck, neck, posts, center);
  for (let i = 0; i < posts; i++) {
    const [x, , z] = postRing[i],
      [u, , v] = postRing[(i + 1) % posts];
    beam(
      out,
      'copper',
      [x, domeTop + 0.28, z],
      [x, capBase - 0.11, z],
      neck * 0.15,
      neck * 0.17,
      c.oxidized,
    );
    if (lod >= 2) {
      beamPath(
        out,
        'copper',
        [
          [x, capBase - 0.64, z],
          [(x + u) / 2, capBase - 0.25, (z + v) / 2],
          [u, capBase - 0.64, v],
        ],
        0.075,
        0.093,
        c.green,
      );
    }
  }
  const cap = lanternTop - 0.68;
  roundProfile(
    out,
    'copper',
    center,
    n,
    [
      [capBase - 0.27, neck * 1.1],
      [capBase + 0.09, neck * 1.13],
    ],
    c.green,
  );
  roundProfile(
    out,
    'roof',
    center,
    n,
    [
      [capBase - 0.03, neck * 1.13],
      [capBase + collar * 0.43, neck * 0.96],
      [cap - 0.21, neck * 0.57],
      [cap, neck * 0.09],
    ],
    c.roof,
  );
  roundProfile(
    out,
    'copper',
    center,
    Math.max(6, posts),
    [
      [cap - 0.05, 0.115],
      [cap + 0.22, 0.071],
      [cap + 0.31, 0.14],
      [lanternTop, 0.033],
    ],
    c.green,
  );
}

function tower(out, control, lod) {
  const { center, radius, eave } = control;
  const n = [9, 13, 19, 26][lod];
  const points = radialRing(0, radius, radius, n, center)
    .map(([x, , z]) => [x, z])
    .reverse();
  for (let i = 0; i < n; i++) {
    const wall = plane(points[i], points[(i + 1) % n]);
    const exposed = wall.normal[2] > 0.55 || wall.normal[0] > 0.65;
    const windows = exposed && i % 4 === 0 ? 1 : 0;
    elevation(
      out,
      wall,
      eave,
      [
        [3.15, 1.58, 0.9],
        [7.87, 1.72, 1.04],
      ],
      windows,
      lod,
    );
    cornice(out, wall, eave, lod, true);
  }
  if (lod)
    roundProfile(
      out,
      'stone',
      center,
      n,
      [
        [eave - 0.53, radius * 1.017],
        [eave - 0.22, radius * 1.032],
        [eave + 0.04, radius * 1.03],
      ],
      c.light,
    );
  dome(out, { ...control, radius: radius * 1.027 }, lod);
}

function gate(out, lod) {
  const { x, front: z, back, bridgeEnd, width, spring, top, eave } = s.gate;
  const lo = -14.61,
    hi = 6.34,
    y = s.floor;
  const n = [6, 9, 13, 18][lod];
  const arc = Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n;
    return [x - (width / 2) * Math.cos(t), spring + (top - spring) * Math.sin(t)];
  });
  const route = [[x - width / 2, y], ...arc, [x + width / 2, y]];
  const wall = [[lo, y], ...route, [hi, y], [hi, eave], [lo, eave]];
  const above = [
    [x - 0.84, 6.4],
    [x + 0.84, 6.4],
    [x + 0.84, 8.33],
    [x - 0.84, 8.33],
  ];
  planar(out, 'stone', wall, lod ? [above] : [], ([x, y]) => [x, y, z], front, c.limestone);
  planar(out, 'stone', wall, [], ([x, y]) => [x, y, back], [0, 0, -1], c.limestone);
  if (lod) planar(out, 'glass', above, [], ([x, y]) => [x, y, z - 0.24], front, c.glass);
  for (let i = 1; i < route.length; i++) {
    const [a, y] = route[i - 1],
      [b, h] = route[i];
    const points = [
      [a, y, z],
      [b, h, z],
      [b, h, back],
      [a, y, back],
    ];
    face(out, 'raw', points, [h - y, a - b, 0], c.shadow);
  }
  const doorZ = z - 2.35;
  planar(out, 'wood', route, [], ([u, h]) => [u, h, doorZ], front, c.shadow);
  if (lod) box(out, 'wood', x - 0.13, y, doorZ + 0.035, 0.09, spring - y + 0.34, 0.13, c.wood);
  for (const [u, sign] of [
    [lo, -1],
    [hi, 1],
  ]) {
    face(
      out,
      'raw',
      [
        [u, y, back],
        [u, y, z],
        [u, eave, z],
        [u, eave, back],
      ],
      [sign, 0, 0],
      c.limestone,
    );
  }
  box(out, 'raw', (lo + hi) / 2, eave - 0.13, (back + z) / 2, hi - lo, 0.16, z - back, c.joint);
  box(out, 'stone', (lo + hi) / 2, eave - 0.29, z - 0.055, hi - lo + 0.13, 0.34, 0.56, c.light);
  const teeth = [4, 12, 15, 17][lod];
  for (let i = 0; i < teeth; i++) {
    box(
      out,
      'stone',
      lo + ((hi - lo) * (i + 0.5)) / teeth,
      eave,
      z - 0.08,
      ((hi - lo) / teeth) * 0.58,
      0.69,
      0.58,
      c.limestone,
    );
  }
  for (const side of [-1, 1]) {
    const center = [x + side * 3.57, z - 0.06],
      n = [6, 8, 12, 16][lod];
    const rings = lod
      ? [
          [3.57, 0.27],
          [3.86, 0.54],
          [4.32, 0.95],
          [4.75, 1.12],
          [9.63, 1.12],
          [10.36, 1.22],
        ]
      : [
          [3.9, 0.46],
          [4.75, 1.12],
          [10.36, 1.22],
        ];
    roundProfile(out, 'stone', center, n, rings, c.limestone);
  }
  const bridgeZ = (z + bridgeEnd) / 2,
    bridgeLength = bridgeEnd - z;
  box(out, 'wood', x, y - 0.18, bridgeZ, width + 0.73, 0.18, bridgeLength, c.wood);
  face(
    out,
    'stone',
    [
      [x - width / 2, y, back],
      [x + width / 2, y, back],
      [x + width / 2, y, z],
      [x - width / 2, y, z],
    ],
    up,
    c.joint,
  );
  if (!lod) return;
  const surround = [
    [x - width / 2 - 0.13, y, z + 0.032],
    ...arc.map(([u, h]) => [x + (u - x) * 1.082, h + 0.12, z + 0.032]),
    [x + width / 2 + 0.13, y, z + 0.032],
  ];
  beamPath(out, 'stone', surround, 0.2, 0.26, c.light);
  for (const side of [-1, 1]) {
    const u = x + side * (width / 2 + 0.29);
    box(out, 'stone', u, y, (bridgeZ + bridgeEnd) / 2, 0.23, 0.54, bridgeLength / 2, c.joint);
    beam(out, 'wood', [x + side * 1.34, 6.68, z + 0.02], [u, 0.93, z + 5.27], 0.13, 0.15, c.wood);
  }
  if (lod >= 2) {
    beam(out, 'stone', [x, 6.4, z - 0.17], [x, 8.33, z - 0.17], 0.07, 0.07, c.bright);
    beam(
      out,
      'stone',
      [x - 0.84, 7.46, z - 0.16],
      [x + 0.84, 7.46, z - 0.16],
      0.07,
      0.07,
      c.bright,
    );
  }
}

function balustrade(out, lod) {
  const [a, b] = s.courtBalustrade;
  const base = Math.min(foot(a), foot(b));
  face(out, 'raw', [p3(a, base), p3(b, base), p3(b, s.floor), p3(a, s.floor)], [1, 0, 0], c.plinth);
  beam(out, 'stone', p3(a, s.floor + 0.88), p3(b, s.floor + 0.88), 0.24, 0.27, c.light);
  if (!lod) return;
  const count = [0, 15, 39, 66][lod];
  for (let i = 0; i <= count; i++) {
    const f = i / count,
      center = a.map((u, j) => u + f * (b[j] - u));
    const large = i % (lod === 3 ? 8 : 5) === 0;
    if (large || lod < 2) {
      box(
        out,
        'stone',
        center[0],
        s.floor,
        center[1],
        large ? 0.45 : 0.18,
        0.84,
        large ? 0.43 : 0.18,
        c.light,
      );
      continue;
    }
    roundProfile(
      out,
      'stone',
      center,
      lod === 3 ? 6 : 4,
      [
        [s.floor, 0.13],
        [s.floor + 0.18, 0.094],
        [s.floor + 0.31, 0.14],
        [s.floor + 0.52, 0.105],
        [s.floor + 0.69, 0.08],
        [s.floor + 0.82, 0.135],
      ],
      c.light,
    );
  }
}

function build(out, lod) {
  for (const block of s.ranges) range(out, block.bounds, block.eave, block.rise, lod);
  for (const control of s.pavilionDomes) {
    range(out, control.bounds, control.eave, 0, lod, false);
    dome(out, control, lod);
  }
  for (const control of s.towers) tower(out, control, lod);
  gate(out, lod);
  balustrade(out, lod);
}

export const chateauSkyline = (out) => build(out, 0);
export const chateauDistrict = (out) => build(out, 1);
export const chateauStreet = (out) => build(out, 2);
export const chateauCloseup = (out) => build(out, 3);

const recipe = 'hautefort-chateau-model.mjs';
const camera = [65, 40, 118],
  lookAt = [-9.0, 9.0, 4.0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'chateauDistrict', 0.36],
    ['street', 'chateauStreet', 0.14],
    ['closeup', 'chateauCloseup', 0.041],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const chateauModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: chateauCloseup,
  category: 'castle',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The limestone Château de Hautefort with its steep slate pavilions, domed round towers, copper lanterns, drawbridge gate and open court.',
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
    outline,
    minimumCoverage: 0.92,
    basis: 'Named native château outline from OpenStreetMap way 61677832.',
  },
  mediumFiContext: {
    scale: 0.79,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_limestone_raw',
    'slate',
    'metal_copper',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'drawbridge-bretagne-tower-and-pavilion',
      position: [-9.2, 6.7, 100],
      lookAt: [-13.5, 11.0, 24.5],
    },
    {
      name: 'open-court-balustrade-and-two-round-towers',
      position: [73, 36, 24],
      lookAt: [-8.8, 9.6, -2.9],
    },
    {
      name: 'rear-pavilions-and-slate-roofline',
      position: [-76, 43, -78],
      lookAt: [-12.0, 9.0, -2.8],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-hautefort-chateau-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'chateauSkyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and four exact first-party CC0 Qualla photos.',
};
