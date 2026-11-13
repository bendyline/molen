/** Mohatta Palace's restored sandstone exterior and rooftop pavilions in Clifton. */
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

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const frame = read('map-frame');
const controls = read('native-map/palace-controls');
const { body: b, turret: t, pavilion: p } = plan;
const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  sandstone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91, metallic: 0 },
  dome: { slot: 'roof', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  plinth: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65, metallic: 0.09 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'cdbb96',
    light: 'd5c5a5',
    shade: 'b6a581',
    pink: 'c29e8c',
    rose: 'ba9584',
    paleRose: 'd2b49f',
    foundation: 'a98e7e',
    dome: 'cfb5a5',
    domeShade: 'c0a292',
    dark: '48463f',
    pane: '58656a',
    blueGlass: '48636e',
    wood: '895b43',
    woodDark: '664b3c',
    tile: '628492',
    tileLight: 'bac9c5',
    tileRust: 'ad845f',
    step: 'c2b8a4',
  }).map(([name, color]) => [name, rgb(color)]),
);
const lerp = (a, b, t0) => a + (b - a) * t0;
const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const normDot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = lerp(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const b = lerp(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return lerp(a, b, v - j) - terrain.modelDatumElevationMeters;
}

function section(a, other) {
  const dx = other[0] - a[0],
    dz = other[1] - a[1],
    length = Math.hypot(dx, dz);
  const axis = [dx / length, dz / length],
    normal = [-axis[1], 0, axis[0]];
  const middle = a.map((x, i) => (x + other[i]) / 2);
  return {
    length,
    normal,
    p: (u, y, d = 0) => [
      middle[0] + axis[0] * u + normal[0] * d,
      y,
      middle[1] + axis[1] * u + normal[2] * d,
    ],
  };
}

function direct(out, slot, points, normal, tint) {
  const p = normDot(normalFor(...points), normal) > 0 ? points : points.toReversed();
  if (p.length === 4) face(out, slot, p, tint);
  else triangle(out, slot, p, tint);
}

function fill(out, s, slot, ring, tint, depth = 0, holes = []) {
  const coordinates = [...ring];
  const starts = holes.map((h) => {
    const start = coordinates.length;
    coordinates.push(...h);
    return start;
  });
  const indices = earcut(coordinates.flat(), starts);
  for (let i = 0; i < indices.length; i += 3)
    direct(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => s.p(...coordinates[j], depth)),
      s.normal,
      tint,
    );
}

function arched(w, n) {
  const r = w.width / 2;
  const crown = Array.from({ length: n + 1 }, (_, i) => {
    const a = i / n;
    return [
      w.x + r * (1 - 2 * a),
      w.spring + (w.top - w.spring) * (1 - Math.pow(Math.abs(2 * a - 1), w.pointed ? 1.65 : 2.2)),
    ];
  });
  return [[w.x - r, w.low], [w.x + r, w.low], ...crown];
}

function edgeTrim(out, s, w, ring, lod) {
  const reach = w.width < 1.1 ? 0.12 : 0.18;
  const larger = arched(
    {
      ...w,
      width: w.width + reach * 2,
      low: w.low - reach,
      spring: w.spring + 0.025,
      top: w.top + reach,
    },
    ring.length - 3,
  );
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    direct(
      out,
      'sandstone',
      [ring[i], ring[j], larger[j], larger[i]].map((p) => s.p(...p, 0.032)),
      s.normal,
      lod > 1 && i % 3 === 0 ? c.paleRose : c.pink,
    );
  }
}

function aperture(out, s, w, ring, lod) {
  const depth = w.door ? -0.66 : -0.19;
  if (lod > 0) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        q = ring[(i + 1) % ring.length];
      const target = s.p(w.x, (w.low + w.top) / 2, depth);
      const mid = s.p((a[0] + q[0]) / 2, (a[1] + q[1]) / 2, depth);
      direct(
        out,
        'sandstone',
        [s.p(...a), s.p(...q), s.p(...q, depth), s.p(...a, depth)],
        target.map((v, i) => v - mid[i]),
        c.rose,
      );
    }
  }
  edgeTrim(out, s, w, ring, lod);
  fill(out, s, 'detail', ring, w.blue ? c.blueGlass : c.pane, depth - 0.014);
  if (w.door) {
    const r = w.width / 2;
    const wing = r * 0.63;
    const panelRanges = w.open
      ? [
          [w.x - r + 0.07, w.x - r + wing],
          [w.x + r - wing, w.x + r - 0.07],
        ]
      : [[w.x - r + 0.04, w.x + r - 0.04]];
    for (const [a, q] of panelRanges) {
      fill(out, s, 'timber', rect(a, w.low + 0.03, q, w.spring - 0.14), c.wood, depth + 0.036);
      if (lod >= 2)
        for (let i = 1; i <= 6; i++) {
          const y = w.low + 0.35 + (i * (w.spring - w.low - 0.62)) / 8;
          fill(out, s, 'timber', rect(a + 0.06, y, q - 0.06, y + 0.032), c.woodDark, depth + 0.051);
        }
    }
  } else if (lod >= 2) {
    const r = w.width / 2;
    const crossY = lerp(w.low, w.spring, 0.61);
    fill(
      out,
      s,
      'timber',
      rect(w.x - 0.029, w.low + 0.04, w.x + 0.029, w.top - 0.13),
      c.woodDark,
      depth + 0.019,
    );
    fill(
      out,
      s,
      'timber',
      rect(w.x - r + 0.04, crossY, w.x + r - 0.04, crossY + 0.045),
      c.woodDark,
      depth + 0.019,
    );
    if (lod === 3) {
      for (const x of [w.x - r * 0.48, w.x + r * 0.48])
        fill(
          out,
          s,
          'timber',
          rect(x - 0.014, w.low + 0.04, x + 0.014, w.spring + 0.13),
          c.wood,
          depth + 0.025,
        );
    }
  }
}

function exterior(out, s, windows, low, high, lod, tint = c.wall) {
  const n = [3, 5, 6, 13][lod],
    half = s.length / 2;
  if (lod < 2) {
    fill(out, s, 'limestone', rect(-half, low, half, high), tint);
    for (const window of windows) {
      if (lod === 0 && window.width < 1.8) continue;
      const ring = arched(window, lod === 0 ? 2 : 3);
      fill(out, s, 'detail', ring, window.blue ? c.blueGlass : c.pane, 0.045);
      if (lod === 1 && window.width > 1.6) edgeTrim(out, s, window, ring, lod);
    }
    return;
  }
  const holes = windows.map((w) => arched(w, n));
  fill(out, s, 'limestone', rect(-half, low, half, high), tint, 0, holes);
  for (const [i, w] of windows.entries()) aperture(out, s, w, holes[i], lod);
}

function trimRun(out, s, y, depth, tint, from = -s.length / 2, to = s.length / 2) {
  direct(
    out,
    'sandstone',
    rect(from, y - 0.16, to, y).map((p) => s.p(...p, depth)),
    s.normal,
    tint,
  );
  const a = s.p(from, y),
    q = s.p(to, y),
    b0 = s.p(to, y, depth),
    b1 = s.p(from, y, depth);
  direct(out, 'sandstone', [a, q, b0, b1], [0, 1, 0], tint);
}

function mainBody(out, lod) {
  const X = b.halfWidth,
    Z = b.halfDepth;
  const front = section([-X, Z], [X, Z]),
    back = section([X, -Z], [-X, -Z]);
  const left = section([-X, -Z], [-X, Z]),
    right = section([X, Z], [X, -Z]);
  const footing = Math.min(
    -1.45,
    ...[
      [-X, -Z],
      [-X, Z],
      [X, -Z],
      [X, Z],
    ].map(([x, z]) => grade(x, z) - 0.55),
  );
  box(out, 'plinth', [-X - 0.15, footing, -Z - 0.15], [X + 0.15, b.plinth, Z + 0.15], c.foundation);
  box(
    out,
    'sandstone',
    [-X - 0.18, b.plinth - 0.08, -Z - 0.18],
    [X + 0.18, b.plinth + 0.1, Z + 0.18],
    c.pink,
  );
  box(out, 'dome', [-X - 0.27, b.eaves, -Z - 0.27], [X + 0.27, b.roof, Z + 0.27], c.paleRose);

  const frontWindows = [];
  for (const x of [-10.6, -9.56, -8.52, 8.52, 9.56, 10.6]) {
    frontWindows.push({ x, width: 0.76, low: 2.02, spring: 4.02, top: 4.51, pointed: true });
    frontWindows.push({ x, width: 0.76, low: 6.57, spring: 8.57, top: 9.08, pointed: true });
  }
  for (const x of [-6.32, 6.32]) {
    frontWindows.push({ x, width: 1.92, low: 1.96, spring: 4.34, top: 5.02, pointed: true });
    frontWindows.push({ x, width: 1.88, low: 6.47, spring: 8.93, top: 9.55, pointed: true });
  }
  for (const x of [-3.39, 0, 3.39]) {
    frontWindows.push({
      x,
      width: 2.32,
      low: b.plinth + 0.24,
      spring: 4.56,
      top: 5.27,
      door: true,
      open: x === 0,
    });
    frontWindows.push({ x, width: 1.88, low: 6.42, spring: 8.94, top: 9.6, pointed: true });
  }
  const generic = (centers) =>
    centers.flatMap((x) => [
      { x, width: 1.4, low: 2.24, spring: 4.14, top: 4.7, pointed: true },
      { x, width: 1.56, low: 6.44, spring: 8.8, top: 9.39, pointed: true },
    ]);
  exterior(out, front, frontWindows, b.plinth, b.eaves, lod, c.light);
  exterior(out, back, generic([-10.4, -5.1, 0, 5.1, 10.4]), b.plinth, b.eaves, lod, c.wall);
  exterior(out, left, generic([-5.3, 0, 5.3]), b.plinth, b.eaves, lod, c.shade);
  exterior(out, right, generic([-5.3, 0, 5.3]), b.plinth, b.eaves, lod, c.wall);
  for (const s of [front, back, left, right]) {
    trimRun(out, s, 5.93, 0.26, c.pink);
    trimRun(out, s, 10.83, 0.34, c.rose);
    trimRun(out, s, 11.0, 0.44, c.paleRose);
    const half = s.length / 2;
    fill(out, s, 'sandstone', rect(-half, 11.35, half, 11.61), c.pink, 0.15);
    const n = Math.ceil(s.length / (lod < 2 ? 3.5 : 1.67));
    for (let i = 0; i <= n; i++) {
      const x = lerp(-half + 0.1, half - 0.1, i / n);
      fill(out, s, 'sandstone', rect(x - 0.064, 11.55, x + 0.064, 12.02), c.pink, 0.2);
    }
    trimRun(out, s, 12.04, 0.2, c.paleRose);
    if (lod >= 2) {
      for (let i = 0; i < n * 2; i++) {
        const x = lerp(-half + 0.42, half - 0.42, (i + 0.5) / (n * 2));
        fill(out, s, 'sandstone', rect(x - 0.083, 10.57, x + 0.083, 10.81), c.pink, 0.11);
      }
    }
  }
  for (const x of [-5.12, 5.12]) {
    box(out, 'sandstone', [x - 0.16, b.plinth, Z], [x + 0.16, 5.64, Z + 0.16], c.rose);
    box(out, 'sandstone', [x - 0.16, 6.05, Z], [x + 0.16, 10.67, Z + 0.16], c.paleRose);
  }
  entrance(out, front, lod);
}

function entrance(out, s, lod) {
  const stepCount = lod === 0 ? 3 : 7;
  const ground = Math.min(0.42, grade(0, b.halfDepth + 2.4));
  for (let i = 0; i < stepCount; i++) {
    const top = lerp(b.plinth + 0.26, ground + 0.17, i / stepCount);
    const z = b.halfDepth + 0.22 + i * (2.15 / stepCount);
    box(
      out,
      'plinth',
      [-4.65 - i * 0.044, Math.min(ground - 0.31, top - 0.25), z - 0.37],
      [4.65 + i * 0.044, top, z + 0.13],
      c.step,
    );
  }
  if (lod < 2) return;
  for (const u of [-4.75, -1.69, 1.69, 4.75]) {
    fill(out, s, 'detail', rect(u - 0.105, 1.48, u + 0.105, 4.79), c.tile, 0.041);
    for (let row = 0; row < 7; row++) {
      const y = 1.73 + row * 0.41;
      fill(
        out,
        s,
        'detail',
        [
          [u, y + 0.105],
          [u + 0.072, y],
          [u, y - 0.105],
          [u - 0.072, y],
        ],
        c.tileLight,
        -0.042,
      );
    }
  }
  for (const u of [-3.39, 0, 3.39]) {
    fill(out, s, 'detail', rect(u - 0.84, 4.55, u + 0.84, 4.79), c.tile, -0.31);
    for (let i = 0; i < 9; i++) {
      const x = u - 0.7 + i * 0.175;
      fill(
        out,
        s,
        'detail',
        [
          [x, 4.76],
          [x + 0.06, 4.67],
          [x, 4.58],
          [x - 0.06, 4.67],
        ],
        i % 3 ? c.tileLight : c.tileRust,
        -0.3,
      );
    }
  }
}

function roundMolding(out, x, z, y, r, h, edges, tint) {
  const layers = [
    [y, r * 0.94],
    [y + h * 0.25, r],
    [y + h * 0.71, r],
    [y + h, r * 0.89],
  ];
  loft(
    out,
    'sandstone',
    layers.map(([e, s]) => radialRing(e, s, s, edges, [x, z])),
    tint,
  );
}

function dome(out, x, z, base, height, r, lod) {
  const n = [6, 9, 18, 32][lod];
  const profile =
    lod === 0
      ? [
          [0, 0.86],
          [0.38, 1],
          [0.95, 0.16],
        ]
      : [
          [0, 0.8],
          [0.13, 0.93],
          [0.31, 1],
          [0.5, 0.9],
          [0.72, 0.65],
          [0.88, 0.38],
          [0.97, 0.11],
        ];
  const rings = profile.map(([h, f]) =>
    radialRing(base + h * height, r * f, r * f, n, [x, z]).map((q, i) => {
      if (lod < 2 || i % 2 === 0) return q;
      return [lerp(x, q[0], 0.974), q[1], lerp(z, q[2], 0.974)];
    }),
  );
  loft(out, 'dome', rings, c.dome);
  if (lod > 0) {
    loft(
      out,
      'sandstone',
      [
        radialRing(base + height * 0.94, r * 0.11, r * 0.11, 8, [x, z]),
        radialRing(base + height * 1.04, r * 0.064, r * 0.064, 8, [x, z]),
        radialRing(base + height * 1.18, r * 0.018, r * 0.018, 8, [x, z]),
      ],
      c.pink,
    );
  }
}

function turret(out, center, lod) {
  const [x, z] = center;
  const r = t.radius;
  const n = lod === 1 ? 9 : 12;
  const footing = Math.min(-0.58, grade(x, z) - 0.63);
  if (lod === 0) {
    const rings = [
      [footing, r],
      [t.lanternFloor - 0.4, r],
      [t.lanternFloor, r + 0.18],
    ];
    loft(
      out,
      'limestone',
      rings.map(([y, width]) => radialRing(y, width, width, 6, [x, z])),
      c.wall,
    );
    for (const [dx, dz] of [
      [r * 0.68, 0],
      [0, r * 0.68],
      [-r * 0.68, 0],
      [0, -r * 0.68],
    ]) {
      box(
        out,
        'sandstone',
        [x + dx - 0.18, t.lanternFloor, z + dz - 0.18],
        [x + dx + 0.18, t.lanternTop, z + dz + 0.18],
        c.pink,
      );
    }
    dome(out, x, z, t.lanternTop, (t.dome - t.lanternTop) * 0.95, r * 0.97, lod);
    return;
  }
  const ring = radialRing(0, r, r, n, [x, z], Math.PI / 12);
  const high = t.lanternFloor - 0.31;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [ring[i][0], ring[i][2]],
      q = [ring[j][0], ring[j][2]];
    const s = section(a, q);
    const w = Math.min(0.84, s.length * 0.59);
    const openings = [
      { x: 0, width: w, low: 2.41, spring: 4.33, top: 4.72 },
      { x: 0, width: w, low: 6.2, spring: 8.21, top: 8.66 },
    ];
    exterior(out, s, openings, footing, high, lod, i % 3 === 0 ? c.shade : c.wall);
  }
  roundMolding(out, x, z, 0.03, r + 0.12, 1.12, n, c.foundation);
  if (lod > 1) {
    roundMolding(out, x, z, 5.34, r + 0.26, 0.55, n, c.pink);
    roundMolding(out, x, z, 9.45, r + 0.22, 0.46, n, c.paleRose);
  }
  roundMolding(out, x, z, t.lanternFloor - 0.62, r + 0.29, 0.55, n, c.pink);
  const columns = 8;
  for (let i = 0; i < columns; i++) {
    const a = (2 * Math.PI * i) / columns;
    const cx = x + Math.cos(a) * r * 0.77,
      cz = z + Math.sin(a) * r * 0.77;
    const lo = t.lanternFloor - 0.12,
      hi = t.lanternTop;
    loft(
      out,
      'sandstone',
      [radialRing(lo, 0.21, 0.21, 5, [cx, cz]), radialRing(hi, 0.19, 0.19, 5, [cx, cz])],
      c.pink,
    );
  }
  if (lod >= 2) {
    const piers = radialRing(0, r * 0.77, r * 0.77, columns, [x, z]);
    for (let i = 0; i < columns; i++) {
      const a = piers[i];
      const b0 = piers[(i + 1) % columns];
      const s = section([a[0], a[2]], [b0[0], b0[2]]);
      const half = s.length / 2;
      const opening = arched(
        { x: 0, width: 2 * half - 0.18, low: 12.0, spring: 12.65, top: 13.52, pointed: true },
        lod === 2 ? 4 : 7,
      );
      const profile = [
        [-half, 12.65],
        ...opening.slice(2).toReversed(),
        [half, 12.65],
        [half, t.lanternTop],
        [-half, t.lanternTop],
      ];
      fill(out, s, 'sandstone', profile, c.paleRose, 0.05);
    }
  }
  roundMolding(out, x, z, t.lanternTop - 0.22, r + 0.18, 0.48, n, c.paleRose);
  dome(out, x, z, t.lanternTop + 0.27, (t.dome - t.lanternTop - 0.27) * 0.94, r * 0.86, lod);
}

function pavilion(out, lod) {
  const X = p.halfWidth,
    Z = p.halfDepth,
    Y = b.roof;
  const sides = [
    section([-X, Z], [X, Z]),
    section([X, Z], [X, -Z]),
    section([X, -Z], [-X, -Z]),
    section([-X, -Z], [-X, Z]),
  ];
  for (const [i, s] of sides.entries()) {
    const xs = i % 2 === 0 ? [-3.88, 0, 3.88] : [-2.26, 2.26];
    const windows = xs.map((x) => ({
      x,
      width: i % 2 === 0 ? 2.07 : 1.78,
      low: Y + 0.31,
      spring: 13.39,
      top: 14.43,
      blue: true,
    }));
    exterior(out, s, windows, Y, p.top, lod, c.wall);
    trimRun(out, s, p.top + 0.12, 0.34, c.pink);
  }
  box(out, 'dome', [-X - 0.25, p.top, -Z - 0.25], [X + 0.25, p.top + 0.28, Z + 0.25], c.paleRose);
  for (const x of [-4.65, 4.65])
    for (const z of [-2.88, 2.88])
      dome(out, x, z, p.top + 0.19, (p.minorDome - p.top - 0.19) * 0.88, 1.45, lod);
  dome(out, 0, -0.15, p.top + 0.36, (p.mainDome - p.top - 0.36) * 0.93, 2.45, lod);
}

function build(out, lod) {
  mainBody(out, lod);
  for (const { center } of controls.nativeTurrets) turret(out, center, lod);
  pavilion(out, lod);
}

export const palaceSkyline = (out) => build(out, 0);
export const palaceDistrict = (out) => build(out, 1);
export const palaceStreet = (out) => build(out, 2);
export const palaceCloseup = (out) => build(out, 3);
const recipe = 'mohatta-palace-model.mjs';
const camera = [-34, 24, 57],
  lookAt = [0, 8.4, 1.8];
export const palaceModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: palaceCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Clifton’s Mohatta Palace with two-tone sandstone, arched windows, four open corner chhatris and a five-domed roof pavilion.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-21, 35, 41],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    outlines: frame.geometry.polygons,
    minimumCoverage: 0.92,
    basis: 'Mapped body and four corner turret footprints in Clifton.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_raw',
    'stone_sandstone_raw',
    'stone_limestone',
    'stone_limestone_weathered',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'east-facade-and-corner-chhatris', position: [-8, 9.6, 50], lookAt: [0, 8.15, 9] },
    { name: 'steps-and-tiled-entrance', position: [-9, 4.9, 28], lookAt: [0, 4.6, 10] },
    { name: 'roof-pavilion-and-rear-corners', position: [-32, 26, -42], lookAt: [0, 9.9, -0.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'palaceDistrict', 0.51],
        ['street', 'palaceStreet', 0.16],
        ['closeup', 'palaceCloseup', 0.063],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped footprints are ODbL. Both exact Qualla photographs were released to the public domain.',
};
