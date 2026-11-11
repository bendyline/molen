/** The marble mausoleum, its copper screens, and the mapped Karachi podium. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const mausoleumSurfaces = {
  marble: { slot: 'wall', graph: 'stone_marble' },
  paving: { slot: 'foundation', graph: 'stone_granite' },
  podium: { slot: 'foundation', graph: 'stone_limestone_raw' },
  copper: { slot: 'trim', graph: 'metal_copper', metallic: 0.58, roughness: 0.63 },
  metal: { slot: 'trim', graph: 'metal_painted' },
};
const colorHex = {
  light: 'e8e3d2',
  ivory: 'e0d9c6',
  cream: 'd9d0ba',
  sand: 'd5cbb3',
  pearl: 'e4e2d6',
  shade: 'c5bca8',
  joint: 'bab29f',
  deck: 'd0cab8',
  paver: 'b6ae9b',
  frame: 'c7c0aa',
  concrete: 'c6bea7',
  stone: 'aa9a82',
  copper: '784731',
  copperLight: '986d45',
  brass: 'ba9a5f',
  recess: '47413a',
  screen: 'c5c3ad',
  glass: '627d79',
  cap: 'bfc3b8',
};
const C = Object.fromEntries(
  Object.entries(colorHex).map(([name, hex]) => [
    name,
    hex.match(/../g).map((h) => {
      const s = parseInt(h, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const REF = 'palette:#ffffff',
  TAU = 2 * Math.PI;
const TIER = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

function face(out, slot, tone, points, wanted) {
  const triangles =
    points.length === 3 ? [points] : [points.slice(0, 3), [points[0], points[2], points[3]]];
  for (let p of triangles) {
    let n = normalFor(...p);
    if (dot(n, wanted) < 0) {
      p = [p[0], p[2], p[1]];
      n = n.map((v) => -v);
    }
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) >
      1e-7
    )
      out.addTriangle(slot, REF, p, n, undefined, C[tone]);
  }
}
const up = [0, 1, 0];
const { walls, dome, terrace, apronY } = layout;
const rect = (x0, z0, x1, z1, y) => [
  [x0, y, z0],
  [x0, y, z1],
  [x1, y, z1],
  [x1, y, z0],
];
const square = (x, z, r, y) => rect(x - r, z - r, x + r, z + r, y);
function top(out, slot, tone, x0, z0, x1, z1, y) {
  face(out, slot, tone, rect(x0, z0, x1, z1, y), up);
}
function box(out, slot, tone, x0, z0, x1, z1, y0, y1) {
  loft(out, slot, [rect(x0, z0, x1, z1, y0), rect(x0, z0, x1, z1, y1)], C[tone]);
}

function apron(out, tier) {
  const boundary = tier
    ? layout.outerGround
    : layout.annex.map(([x, z]) => layout.outerGround.find((p) => p[0] === x && p[2] === z));
  const outer = boundary.map(([x, y, z]) => [x, y + 0.1, z]);
  const inner = rect(
    terrace.west - 2.9,
    terrace.north - 2.9,
    terrace.east + 2.9,
    terrace.south + 2.9,
    apronY,
  );
  const points = [...outer, ...inner];
  const triangles = earcut(
    points.flatMap(([x, , z]) => [x, z]),
    [outer.length],
  );
  for (let i = 0; i < triangles.length; i += 3) {
    const p = triangles.slice(i, i + 3).map((j) => points[j]);
    face(out, 'paving', 'concrete', p, up);
  }
  const [cx, cz] = layout.center;
  for (let i = 0; tier > 0 && i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    face(
      out,
      'podium',
      'stone',
      [a, b, [b[0], b[1] - 0.82, b[2]], [a[0], a[1] - 0.82, a[2]]],
      [(a[0] + b[0]) * 0.5 - cx, 0, (a[2] + b[2]) * 0.5 - cz],
    );
  }
  // The lower apron continues beneath the short inner retaining riser and its four flights.
  top(
    out,
    'paving',
    'concrete',
    terrace.west - 2.9,
    terrace.north - 2.9,
    terrace.east + 2.9,
    terrace.south + 2.9,
    apronY,
  );
}

function terracePlatform(out, tier) {
  apron(out, tier);
  const { west, east, north, south, top: y, bevel } = terrace;
  loft(
    out,
    'podium',
    [
      rect(west, north, east, south, apronY - 0.28),
      rect(west, north, east, south, y - 0.22),
      rect(west + bevel, north + bevel, east - bevel, south - bevel, y),
    ],
    C.stone,
    { cap: false },
  );
  top(out, 'paving', 'deck', west + bevel, north + bevel, east - bevel, south - bevel, y);
  for (const stair of layout.terraceStairs) {
    const { alongX, sign, edge, foot, cross, width } = stair;
    const point = (t, u, height) =>
      alongX
        ? [mix(foot, edge - sign * 0.29, t), height, cross + u]
        : [cross + u, height, mix(foot, edge - sign * 0.29, t)];
    const steps = tier ? 8 : 4;
    for (let i = 0; i < steps; i++) {
      const a = i / steps,
        b = (i + 1) / steps,
        h = mix(apronY, y, (i + 1) / steps),
        prev = mix(apronY, y, i / steps),
        l = -width * 0.5,
        r = width * 0.5;
      face(
        out,
        'paving',
        'deck',
        [point(a, l, h), point(a, r, h), point(b, r, h), point(b, l, h)],
        up,
      );
      face(
        out,
        'podium',
        'shade',
        [point(a, l, prev), point(a, r, prev), point(a, r, h), point(a, l, h)],
        alongX ? [sign, 0, 0] : [0, 0, sign],
      );
      for (const u of [l, r])
        face(
          out,
          'podium',
          'cream',
          [point(a, u, apronY - 0.05), point(b, u, apronY - 0.05), point(b, u, h), point(a, u, h)],
          alongX ? [0, 0, Math.sign(u)] : [Math.sign(u), 0, 0],
        );
    }
  }
  if (tier >= 2) {
    // A repeated inset border and rectilinear panel grid follow the visible terrace paving.
    for (const x of [west + 1.2, east - 1.2])
      top(out, 'paving', 'paver', x - 0.09, north + 1.2, x + 0.09, south - 1.2, y + 0.014);
    for (const z of [north + 1.2, south - 1.2])
      top(out, 'paving', 'paver', west + 1.2, z - 0.09, east - 1.2, z + 0.09, y + 0.014);
    const gap = tier >= 3 ? 6 : 9;
    for (let x = west + 3; x + gap < east - 2; x += gap)
      for (let z = north + 3; z + gap < south - 2; z += gap) {
        if (x + gap > -17 && z + gap > -17 && z < 18) continue;
        const x0 = x + 0.73,
          x1 = x + gap - 0.65,
          z0 = z + 0.76,
          z1 = z + gap - 0.69,
          t = 0.1,
          py = y + 0.012;
        top(out, 'paving', 'frame', x0, z0, x1, z0 + t, py);
        top(out, 'paving', 'frame', x0, z1 - t, x1, z1, py);
        top(out, 'paving', 'frame', x0, z0 + t, x0 + t, z1 - t, py);
        top(out, 'paving', 'frame', x1 - t, z0 + t, x1, z1 - t, py);
      }
  }
}

function marbleSurround(out, tier) {
  const [cx, cz] = walls.center;
  const count = tier === 0 ? 3 : 7;
  for (let i = 0; i < count; i++) {
    const r = mix(walls.halfWidth + 1.85, walls.halfWidth + 0.18, i / (count - 1));
    const low = mix(terrace.top, walls.base, i / count),
      high = mix(terrace.top, walls.base, (i + 1) / count);
    loft(
      out,
      'marble',
      [square(cx, cz, r, low), square(cx, cz, r, high)],
      C[i % 2 ? 'ivory' : 'pearl'],
      { cap: false },
    );
    const inside = mix(walls.halfWidth + 1.85, walls.halfWidth + 0.18, (i + 1) / (count - 1));
    const a = square(cx, cz, r, high),
      b = square(cx, cz, i === count - 1 ? walls.halfWidth - 0.06 : inside, high);
    for (let j = 0; j < 4; j++)
      face(out, 'marble', 'pearl', [a[j], a[(j + 1) % 4], b[(j + 1) % 4], b[j]], up);
  }
  top(
    out,
    'paving',
    'deck',
    cx - walls.halfWidth,
    cz - walls.halfWidth,
    cx + walls.halfWidth,
    cz + walls.halfWidth,
    walls.base - 0.02,
  );
}

const sides = [
  { normal: [0, 0, -1], tangent: [1, 0, 0] },
  { normal: [1, 0, 0], tangent: [0, 0, 1] },
  { normal: [0, 0, 1], tangent: [-1, 0, 0] },
  { normal: [-1, 0, 0], tangent: [0, 0, -1] },
];
function widthAt(y) {
  return mix(
    walls.halfWidth,
    walls.topHalfWidth,
    (y - walls.base) / (walls.cornerTop - walls.base),
  );
}
function archAt(y) {
  const t = Math.max(0, Math.min(1, (y - walls.base) / (walls.archTop - walls.base)));
  return walls.archHalfWidth * Math.pow(Math.max(0, 1 - Math.pow(t, 1.54)), 0.57);
}
function panelShade(col, row) {
  const hash = (Math.imul(col, 73856093) ^ Math.imul(row, 19349663)) >>> 0;
  return ['pearl', 'light', 'ivory', 'cream', 'light', 'sand'][hash % 6];
}
function wallPoint(side, u, y, depth = 0) {
  const [cx, cz] = walls.center,
    r = widthAt(y) - depth;
  return [
    cx + side.normal[0] * r + side.tangent[0] * u,
    y,
    cz + side.normal[2] * r + side.tangent[2] * u,
  ];
}
function facade(out, side, tier) {
  const profile = [walls.base, walls.archTop, walls.middleTop, walls.cornerTop];
  const counts =
    tier === 0 ? [7, 1, 1] : tier === 1 ? [13, 3, 2] : tier === 2 ? [21, 6, 3] : [26, 12, 5];
  const levels = profile
    .slice(1)
    .flatMap((b, i) =>
      Array.from({ length: counts[i] }, (_, j) => mix(profile[i], b, j / counts[i])),
    );
  levels.push(walls.cornerTop);
  for (let row = 1; row < levels.length; row++) {
    const a = levels[row - 1],
      b = levels[row],
      baseA = widthAt(a),
      baseB = widthAt(b);
    const aa = archAt(a),
      ab = archAt(b),
      upper = a >= walls.middleTop,
      opening = a < walls.archTop;
    const openA = upper ? baseA * 0.53 : aa,
      openB = upper ? baseB * 0.53 : ab;
    const spans =
      upper || opening
        ? [
            [-baseA, -openA, -baseB, -openB],
            [openA, baseA, openB, baseB],
          ]
        : [[-baseA, baseA, -baseB, baseB]];
    for (const [a0, a1, b0, b1] of spans) {
      face(
        out,
        'marble',
        'ivory',
        [
          wallPoint(side, a0, a),
          wallPoint(side, a1, a),
          wallPoint(side, b1, b),
          wallPoint(side, b0, b),
        ],
        side.normal,
      );
      if (tier < 2) continue;
      const desired = tier >= 3 ? 0.68 : 1.2,
        shift = (row % 2) * desired * 0.48;
      const first = Math.floor((Math.min(a0, b0) - shift) / desired),
        last = Math.ceil((Math.max(a1, b1) - shift) / desired);
      for (let col = first; col < last; col++) {
        const x0 = col * desired + shift + 0.009,
          x1 = x0 + desired - 0.018;
        const range = (left, right) => [
          Math.max(left, Math.min(right, x0)),
          Math.max(left, Math.min(right, x1)),
        ];
        const [u0, u1] = range(a0, a1),
          [v0, v1] = range(b0, b1);
        if (Math.max(u1 - u0, v1 - v0) < 0.038) continue;
        const depth = (col + row * 3) % 6 === 1 ? -0.027 : -0.015;
        face(
          out,
          'marble',
          panelShade(col, row),
          [
            wallPoint(side, u0, a + 0.011, depth),
            wallPoint(side, u1, a + 0.011, depth),
            wallPoint(side, v1, b - 0.011, depth),
            wallPoint(side, v0, b - 0.011, depth),
          ],
          side.normal,
        );
      }
    }
    if (!opening) continue;
    for (const sign of [-1, 1]) {
      const edgeA = wallPoint(side, sign * aa, a),
        edgeB = wallPoint(side, sign * ab, b);
      const backA = wallPoint(side, sign * aa, a, walls.reveal + 0.74),
        backB = wallPoint(side, sign * ab, b, walls.reveal + 0.74);
      const inward = side.tangent.map((v) => -sign * v);
      face(out, 'marble', 'shade', [edgeA, backA, backB, edgeB], inward);
      if (tier >= 1)
        face(
          out,
          'marble',
          'pearl',
          [
            wallPoint(side, sign * (aa + 0.15), a, -0.048),
            wallPoint(side, sign * (ab + 0.15), b, -0.048),
            wallPoint(side, sign * ab, b, -0.048),
            wallPoint(side, sign * aa, a, -0.048),
          ],
          side.normal,
        );
    }
  }
  const cap = (u, y, depth) => wallPoint(side, u, y, depth);
  for (const sign of [-1, 1]) {
    const a = sign * walls.topHalfWidth * 0.53,
      b = sign * walls.topHalfWidth;
    face(
      out,
      'marble',
      'light',
      [
        cap(a, walls.cornerTop, 0),
        cap(b, walls.cornerTop, 0),
        cap(b, walls.cornerTop, 0.63),
        cap(a, walls.cornerTop, 0.63),
      ],
      up,
    );
    const mid = widthAt(walls.middleTop) * 0.53;
    face(
      out,
      'marble',
      'shade',
      [
        cap(sign * mid, walls.middleTop, 0),
        cap(a, walls.cornerTop, 0),
        cap(a, walls.cornerTop, 0.63),
        cap(sign * mid, walls.middleTop, 0.63),
      ],
      side.tangent.map((v) => -sign * v),
    );
  }
  const middle = widthAt(walls.middleTop) * 0.53;
  face(
    out,
    'marble',
    'light',
    [
      cap(-middle, walls.middleTop, 0),
      cap(middle, walls.middleTop, 0),
      cap(middle, walls.middleTop, 0.63),
      cap(-middle, walls.middleTop, 0.63),
    ],
    up,
  );
  if (tier >= 2) {
    for (const sign of [-1, 1])
      beam(
        out,
        'marble',
        cap(sign * (walls.topHalfWidth - 0.05), walls.cornerTop + 0.045, 0.1),
        cap(sign * (walls.topHalfWidth * 0.53 + 0.05), walls.cornerTop + 0.045, 0.1),
        0.16,
        0.16,
        C.pearl,
      );
    beam(
      out,
      'marble',
      cap(-middle, walls.middleTop + 0.04, 0.1),
      cap(middle, walls.middleTop + 0.04, 0.1),
      0.16,
      0.15,
      C.pearl,
    );
  }
}

function gate(out, side, tier) {
  const y0 = walls.base + 0.026,
    y1 = walls.archTop - 0.06,
    setback = walls.reveal + 0.025;
  const point = (u, y, extra = 0) => wallPoint(side, u, y, setback + extra);
  const steps = tier ? [0, 0.15, 0.35, 0.55, 0.72, 0.84, 0.92, 0.97, 1] : [0, 0.35, 0.66, 0.87, 1];
  for (let i = 1; i < steps.length; i++) {
    const a = mix(y0, y1, steps[i - 1]),
      b = mix(y0, y1, steps[i]);
    face(
      out,
      'metal',
      'recess',
      [
        point(-archAt(a), a, 0.69),
        point(archAt(a), a, 0.69),
        point(archAt(b), b, 0.69),
        point(-archAt(b), b, 0.69),
      ],
      side.normal,
    );
  }
  if (!tier) return;
  for (const sign of [-1, 1])
    beamPath(
      out,
      'copper',
      steps.map((t) => {
        const y = mix(y0, y1, t);
        return point(sign * archAt(y), y);
      }),
      0.122,
      0.09,
      C.copperLight,
    );
  const spacing = tier === 1 ? 1.62 : tier === 2 ? 0.83 : 0.54;
  const topAt = (x) => {
    const h = Math.min(1, Math.abs(x) / walls.archHalfWidth);
    const t = Math.pow(1 - Math.pow(h, 1 / 0.57), 1 / 1.54);
    return Math.min(y1, mix(walls.base, walls.archTop, t));
  };
  for (
    let x = -Math.floor(walls.archHalfWidth / spacing) * spacing;
    x < walls.archHalfWidth - 0.09;
    x += spacing
  ) {
    const high = topAt(x) - 0.025;
    if (high > y0 + 0.17)
      beam(
        out,
        'copper',
        point(x, y0),
        point(x, high),
        Math.abs(x) < 0.025 ? 0.108 : 0.065,
        0.08,
        C.copperLight,
      );
  }
  for (let y = y0 + 0.37; y < y1 - 0.08; y += spacing * 0.88) {
    const w = archAt(y) - 0.08;
    if (w > 0.12) beam(out, 'copper', point(-w, y), point(w, y), 0.055, 0.055, C.copper);
  }
  if (tier >= 3) {
    const shift = spacing * 0.5;
    for (let y = y0 + 0.58; y + shift < y1 - 0.12; y += spacing)
      for (let x = -2.75; x < 2.84; x += spacing) {
        if (Math.abs(x) + shift > archAt(y + shift) - 0.11) continue;
        const diamond = [
          point(x - shift * 0.53, y, -0.04),
          point(x, y + shift * 0.76, -0.04),
          point(x + shift * 0.53, y, -0.04),
          point(x, y - shift * 0.76, -0.04),
        ];
        beamPath(out, 'copper', diamond, 0.038, 0.04, C.brass, true);
      }
  }
}

function roof(out, tier) {
  const { radius: r, drumBase: base, spring, height, finial } = dome;
  const [x, z] = walls.center,
    y = walls.middleTop - 0.15,
    half = widthAt(y) - 0.33;
  top(out, 'marble', 'cream', x - half, z - half, x + half, z + half, y);
  const n = [16, 28, 40, 64, 80][tier],
    rows = [5, 10, 14, 20, 24][tier];
  const polar = (a, y, radius = r) => [radius * Math.cos(a), y, radius * Math.sin(a)];
  const f = (i, j) => {
    const t = (Math.PI * 0.5 * i) / rows;
    return polar((TAU * j) / n, spring + height * Math.sin(t), r * Math.cos(t));
  };
  for (let j = 0; j < n; j++) {
    const a = (TAU * j) / n,
      b = (TAU * (j + 1)) / n,
      normal = polar((a + b) * 0.5, 0, 1);
    const drumTones = ['pearl', 'ivory', 'light', 'light', 'cream'];
    for (let row = 0; row < (tier >= 2 ? 7 : 1); row++) {
      const count = tier >= 2 ? 7 : 1,
        y0 = mix(base, spring, row / count),
        y1 = mix(base, spring, (row + 1) / count);
      face(
        out,
        'marble',
        drumTones[(j * 17 + row * 13) % drumTones.length],
        [polar(a, y0), polar(b, y0), polar(b, y1), polar(a, y1)],
        normal,
      );
    }
    for (let i = 0; i < rows; i++) {
      const tone =
        tier < 2
          ? 'light'
          : ['light', 'ivory', 'cream', 'pearl', 'light', 'sand', 'pearl'][(j * 17 + i * 13) % 7];
      const points =
        i === rows - 1
          ? [f(i, j), f(i, j + 1), [0, spring + height, 0]]
          : [f(i, j), f(i, j + 1), f(i + 1, j + 1), f(i + 1, j)];
      face(out, 'marble', tone, points, [normal[0], 0.4, normal[2]]);
    }
  }
  loft(
    out,
    'marble',
    [
      radialRing(spring - 0.12, r + 0.08, r + 0.08, n),
      radialRing(spring + 0.08, r + 0.08, r + 0.08, n),
    ],
    C.pearl,
    { cap: false },
  );
  if (tier >= 2) {
    for (let j = 0; j < 4; j++) {
      const a = (TAU * (j + 0.5)) / 4;
      const seam = Array.from({ length: rows }, (_, i) => {
        const t = (Math.PI * 0.5 * i) / rows;
        return polar(a, spring + height * Math.sin(t) + 0.04, r * Math.cos(t) + 0.028);
      });
      beamPath(out, 'marble', seam, 0.044, 0.04, C.shade);
    }
  }
  const topY = spring + height;
  loft(
    out,
    'metal',
    [
      radialRing(topY - 0.08, 0.37, 0.37, 8),
      radialRing(topY + 0.17, 0.26, 0.26, 8),
      radialRing(finial - 0.13, 0.055, 0.055, 8),
      radialRing(finial, 0.049, 0.049, 8),
    ],
    C.cap,
  );

  for (let side = 0; side < 4; side++)
    for (const index of [-1, 0, 1]) {
      const a = (TAU * side) / 4 + index * 0.179,
        bottom = 22.1,
        shoulder = 23.47,
        w = 0.68;
      // A curved drum window, with marble casing and a warm perforated screen.
      const p = (u, y, off = 0) => polar(a + u / r, y, r + off);
      const profile = [
        [-w, bottom],
        [-w, shoulder],
        ...Array.from({ length: tier >= 2 ? 9 : 5 }, (_, j) => {
          const theta = Math.PI * (1 - (j + 1) / (tier >= 2 ? 9 : 5));
          return [w * Math.cos(theta), shoulder + w * Math.sin(theta)];
        }),
        [w, bottom],
      ];
      const normal = polar(a, 0, 1),
        center = p(0, bottom + 0.67, 0.023);
      for (let i = 0; i < profile.length; i++)
        face(
          out,
          'copper',
          'recess',
          [center, p(...profile[i], 0.024), p(...profile[(i + 1) % profile.length], 0.024)],
          normal,
        );
      if (!tier) continue;
      if (tier === 1) {
        beam(
          out,
          'copper',
          p(0, bottom + 0.07, 0.052),
          p(0, shoulder + 0.52, 0.052),
          0.081,
          0.079,
          C.brass,
        );
        for (const y of [bottom + 0.48, bottom + 1.1])
          beam(out, 'copper', p(-0.53, y, 0.055), p(0.53, y, 0.055), 0.068, 0.058, C.brass);
        continue;
      }
      beamPath(
        out,
        'marble',
        profile.map((q) => p(...q, 0.09)),
        0.13,
        0.115,
        C.pearl,
        true,
      );
      for (const u of [-0.43, 0, 0.43])
        beam(
          out,
          'copper',
          p(u, bottom + 0.07, 0.052),
          p(u, shoulder + Math.sqrt(w * w - u * u) - 0.1, 0.052),
          0.058,
          0.064,
          C.brass,
        );
      for (const y of [bottom + 0.32, bottom + 0.74, bottom + 1.16, bottom + 1.49]) {
        const dx = y <= shoulder ? 0.56 : Math.sqrt(w * w - (y - shoulder) * (y - shoulder)) - 0.1;
        beam(out, 'copper', p(-dx, y, 0.055), p(dx, y, 0.055), 0.052, 0.058, C.brass);
      }
      if (tier >= 3)
        for (const y of [bottom + 0.56, bottom + 0.97, bottom + 1.38])
          for (const u of [-0.38, 0, 0.38])
            beamPath(
              out,
              'copper',
              [
                [u - 0.14, y],
                [u, y + 0.18],
                [u + 0.14, y],
                [u, y - 0.18],
              ].map((q) => p(...q, 0.07)),
              0.035,
              0.043,
              C.copperLight,
              true,
            );
    }
}

function eastAnnex(out, tier) {
  const x = terrace.east,
    z0 = -16.2,
    z1 = 34.8;
  loft(
    out,
    'podium',
    [layout.serviceBase, rect(x + 0.05, z0, x + 19.4, z1, apronY + 1.67)],
    C.concrete,
  );
  box(
    out,
    'marble',
    'pearl',
    x + 0.12,
    z0 - 0.19,
    x + 19.63,
    z1 + 0.2,
    apronY + 1.67,
    apronY + 1.84,
  );
  const strip = x + 19.43,
    count = tier >= 2 ? 25 : tier === 1 ? 12 : 4;
  for (let i = 0; i < count; i++) {
    const a = mix(z0, z1, i / count) + 0.04,
      b = mix(z0, z1, (i + 1) / count) - 0.04;
    face(
      out,
      'metal',
      i % 6 === 3 ? 'glass' : 'screen',
      [
        [strip, apronY + 0.13, a],
        [strip, apronY + 0.13, b],
        [strip, apronY + 1.58, b],
        [strip, apronY + 1.58, a],
      ],
      [1, 0, 0],
    );
    if (tier >= 2)
      for (const u of [0.23, 0.49, 0.75])
        beam(
          out,
          'metal',
          [strip + 0.03, apronY + 0.16, mix(a, b, u)],
          [strip + 0.03, apronY + 1.56, mix(a, b, u)],
          0.055,
          0.045,
          C.cap,
        );
  }
  box(out, 'metal', 'glass', x + 16.8, z1 - 2.9, x + 20.1, z1 + 0.25, apronY + 0.12, apronY + 4.18);
  box(
    out,
    'marble',
    'pearl',
    x + 16.69,
    z1 - 3.02,
    x + 20.22,
    z1 + 0.37,
    apronY + 4.18,
    apronY + 4.34,
  );
  if (tier >= 2)
    for (const z of [z1 - 2.87, z1 - 1.88, z1 - 0.81, z1 + 0.14])
      beam(
        out,
        'metal',
        [x + 20.13, apronY + 0.19, z],
        [x + 20.13, apronY + 4.16, z],
        0.076,
        0.087,
        C.cap,
      );
}

export function buildMausoleumLevel(out, level = 'master') {
  const tier = TIER[level];
  if (tier === undefined) throw Error(`Unknown Mazar-e-Quaid tier ${level}`);
  terracePlatform(out, tier);
  marbleSurround(out, tier);
  for (const side of sides) {
    facade(out, side, tier);
    gate(out, side, tier);
  }
  roof(out, tier);
  eastAnnex(out, tier);
}
export const buildMausoleumSkyline = (out) => buildMausoleumLevel(out, 'skyline');
export const buildMausoleumDistrict = (out) => buildMausoleumLevel(out, 'district');
export const buildMausoleumStreet = (out) => buildMausoleumLevel(out, 'street');
export const buildMausoleumCloseup = (out) => buildMausoleumLevel(out, 'closeup');
