/** Pont de Tolbiac: five unequal masonry vaults and pierced stone balustrades. */

import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { ShapeGeometry } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0028_pont_de_tolbiac', 'map-frame.json')),
);
const letteringFont = new FontLoader().parse(
  JSON.parse(
    readFileSync(
      new URL(
        '../../fonts/gentilis_regular.typeface.json',
        import.meta.resolve('three/addons/loaders/FontLoader.js'),
      ),
    ),
  ),
);
const stone = [0.68, 0.65, 0.56],
  mortar = [0.43, 0.425, 0.37],
  trim = [0.82, 0.8, 0.72],
  iron = [0.075, 0.09, 0.087];
const piers = [
  [-55.6, 1.7],
  [-19.7, 2.2],
  [19.7, 2.2],
  [55.6, 1.7],
];
const arches = [
  { c: -71.8, rx: 14.5, rise: 7.09 },
  { c: -37.7, rx: 16, rise: 7.76 },
  { c: 0, rx: 17.5, rise: 8.18 },
  { c: 37.7, rx: 16, rise: 7.76 },
  { c: 71.8, rx: 14.5, rise: 7.09 },
];
const spring = -1.0,
  bodyEnd = 86.3,
  deckStart = -101.9,
  deckEnd = 96.6,
  railStart = -89,
  railEnd = 91;
const road = (x) => 8.62 - 0.017 * (Math.sqrt(x * x + 16) - 4);
const rand = (n) => {
  const t = Math.sin(n * 16.7 + 51.32) * 17624.83;
  return t - Math.floor(t);
};
const tint = (n, c = stone) => c.map((v) => v + (rand(n) - 0.5) * 0.075);
const sample = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
function poly(out, slot, points, color) {
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    points,
    normalFor(...points),
    (p) => [p[0], p[1]],
    color,
  );
}
function extrusion(out, xy, z0, z1, color = stone, slot = 'rawlimestone') {
  xy = xy.filter(
    (p, i, all) =>
      Math.hypot(
        p[0] - all[(i + all.length - 1) % all.length][0],
        p[1] - all[(i + all.length - 1) % all.length][1],
      ) > 1e-5,
  );
  for (let i = xy.length - 1; i >= 0 && xy.length >= 3; i--) {
    const a = xy[(i + xy.length - 1) % xy.length],
      b = xy[i],
      c = xy[(i + 1) % xy.length];
    if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-7)
      xy.splice(i, 1);
  }
  if (xy.length < 3) return;
  const area = xy.reduce(
    (s, p, i) => s + p[0] * xy[(i + 1) % xy.length][1] - p[1] * xy[(i + 1) % xy.length][0],
    0,
  );
  if (Math.abs(area) < 1e-7) return;
  if (area < 0) xy.reverse();
  const a = xy.map(([x, y]) => [x, y, z0]),
    b = xy.map(([x, y]) => [x, y, z1]);
  poly(out, slot, a.toReversed(), color);
  poly(out, slot, b, color);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      p = [a[i], a[j], b[j], b[i]];
    quad(out, slot, p, normalFor(...p), color);
  }
}
function clip(poly, signed) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = signed(a),
      db = signed(b);
    if (da >= 0) result.push(a);
    if (da < 0 !== db < 0) result.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return result;
}
function arc(a, t, off = 0) {
  const nx = Math.cos(t) / a.rx,
    ny = Math.sin(t) / a.rise,
    d = Math.hypot(nx, ny);
  return [
    a.c + a.rx * Math.cos(t) + (off * nx) / d,
    spring + a.rise * Math.sin(t) + (off * ny) / d,
  ];
}
function archY(a, x) {
  return spring + a.rise * Math.sqrt(Math.max(0, 1 - ((x - a.c) / a.rx) ** 2));
}
function lower(x) {
  const a = arches.find((a) => Math.abs(x - a.c) <= a.rx);
  return a ? archY(a, x) + 0.99 : spring;
}
function facingBlock(out, x0, x1, y0, y1, side, seed) {
  if (x1 - x0 < 0.025 || y1 - y0 < 0.025) return;
  let p = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  const yl = lower(x0 + 0.00001),
    yr = lower(x1 - 0.00001);
  p = clip(p, (q) => q[1] - yl - ((yr - yl) * (q[0] - x0)) / (x1 - x0));
  extrusion(out, p, side < 0 ? -10.03 : 9.98, side < 0 ? -9.98 : 10.03, tint(seed));
}
function vaults(out) {
  for (const [j, a] of arches.entries()) {
    loft(
      out,
      'rawlimestone',
      sample(144, (t) => {
        const x = a.c - a.rx * Math.cos(t * Math.PI),
          innerY = spring + a.rise * Math.sin(t * Math.PI);
        return [
          [x, road(x) - 0.28, -10],
          [x, road(x) - 0.28, 10],
          [x, innerY, 10],
          [x, innerY, -10],
        ];
      }),
      mortar,
    );
    const n = 144;
    for (let i = 0; i < n; i++) {
      const t0 = (Math.PI * (i + 0.017)) / n,
        t1 = (Math.PI * (i + 0.983)) / n;
      for (const side of [-1, 1])
        extrusion(
          out,
          [arc(a, t0), arc(a, t1), arc(a, t1, 0.98), arc(a, t0, 0.98)],
          side < 0 ? -10.075 : 10.02,
          side < 0 ? -10.02 : 10.075,
          tint(i + j * 149),
        );
      for (let k = 0; k < 34; k++) {
        const z = -10 + (k * 20) / 34;
        extrusion(
          out,
          [arc(a, t0, -0.012), arc(a, t1, -0.012), arc(a, t1, 0.01), arc(a, t0, 0.01)],
          z + 0.008,
          z + 20 / 34 - 0.008,
          tint(j * 13 + i * 53 + k, [0.46, 0.445, 0.385]),
          'weatheredlimestone',
        );
      }
    }
  }
  for (const [cx, r] of piers)
    box(out, 'rawlimestone', [cx - r, -1.1, -10], [cx + r, road(cx) - 0.25, 10], mortar);
  for (const side of [-1, 1])
    for (let row = 0; row < 25; row++) {
      const y0 = spring + row * 0.39 + 0.008,
        y1 = y0 + 0.375;
      for (let x = -bodyEnd - (row % 2) * 0.46; x < bodyEnd; x += 0.92) {
        const l = Math.max(-bodyEnd, x + 0.006),
          r = Math.min(bodyEnd, x + 0.906);
        if (l >= r || y0 > Math.min(road(l), road(r)) - 0.29) continue;
        const breaks = [
          l,
          r,
          ...arches.flatMap((a) => [a.c - a.rx, a.c + a.rx]).filter((v) => v > l && v < r),
        ].sort((a, b) => a - b);
        for (let i = 1; i < breaks.length; i++)
          facingBlock(
            out,
            breaks[i - 1],
            breaks[i],
            y0,
            Math.min(y1, road(r) - 0.29),
            side,
            x + row * 31,
          );
      }
    }
}
function capsule(cx, y, r, half = 9.8, n = 96) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, y, Math.sin(a) * r + (Math.sin(a) >= 0 ? half : -half)];
  });
}
function cutwaters(out) {
  for (const [cx, r] of piers) {
    loft(out, 'rawlimestone', [capsule(cx, -1.1, r + 0.22), capsule(cx, 1.78, r + 0.12)], mortar);
    for (let row = 0; row < 7; row++) {
      const y0 = -1.1 + row * 0.42 + 0.008,
        y1 = y0 + 0.403;
      const ring0 = capsule(cx, y0, r + 0.24 - (0.12 * (y0 + 1.1)) / 3),
        ring1 = capsule(cx, y1, r + 0.24 - (0.12 * (y1 + 1.1)) / 3);
      for (let k = 0; k < ring0.length; k++) {
        const p = [
          ring0[k],
          ring0[(k + 1) % ring0.length],
          ring1[(k + 1) % ring0.length],
          ring1[k],
        ];
        quad(
          out,
          'weatheredlimestone',
          p,
          normalFor(...p),
          tint(row * 8 + k, cx < 0 ? [0.47, 0.465, 0.395] : [0.52, 0.5, 0.42]),
        );
      }
    }
    loft(
      out,
      'rawlimestone',
      [
        capsule(cx, 1.8, r + 0.3),
        capsule(cx, 2.02, r + 0.3),
        capsule(cx, 2.26, r + 0.1),
        capsule(cx, 2.52, r - 0.14),
      ],
      stone,
    );
    for (const side of [-1, 1]) {
      const z = side * 10.18,
        y = road(cx);
      for (let row = 0; row < 14; row++) {
        const bottom = 2.22 + row * 0.42;
        if (bottom >= y - 0.25) break;
        box(
          out,
          'rawlimestone',
          [cx - 0.48, bottom, z - 0.15],
          [cx + 0.48, Math.min(bottom + 0.411, y - 0.25), z + 0.15],
          tint(cx + row),
        );
      }
      box(
        out,
        'rawlimestone',
        [cx - 0.57, y - 0.5, z - 0.18],
        [cx + 0.57, y - 0.27, z + 0.18],
        trim,
      );
      box(
        out,
        'rawlimestone',
        [cx - 0.48, y + 0.03, z - 0.13],
        [cx + 0.48, y + 1.36, z + 0.13],
        trim,
      );
      box(
        out,
        'rawlimestone',
        [cx - 0.56, y + 1.36, z - 0.22],
        [cx + 0.56, y + 1.48, z + 0.22],
        trim,
      );
    }
  }
}
function capsuleHole(cx, cy, r, straight, n = 32) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r + (Math.sin(a) >= 0 ? straight : -straight)];
  });
}
function piercedPanel(out, x0, x1, z) {
  const y = road((x0 + x1) / 2) + 0.24,
    outer = [
      [x0, y],
      [x1, y],
      [x1, y + 1.06],
      [x0, y + 1.06],
    ],
    holes = [];
  const n = Math.max(1, Math.round((x1 - x0) / 0.375)),
    step = (x1 - x0) / n;
  for (let i = 0; i < n; i++)
    holes.push(capsuleHole(x0 + (i + 0.5) * step, y + 0.535, 0.103, 0.274));
  const rings = [outer, ...holes],
    pts = rings.flat(),
    offsets = holes.map((_, i) => 4 + i * 32),
    ids = earcut(pts.flat(), offsets, 2);
  for (const dz of [-0.2, 0.2])
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids.slice(i, i + 3).map((k) => [pts[k][0], pts[k][1], z + dz]);
      if (dz < 0) p = p.reverse();
      out.addTriangle(
        'rawlimestone',
        'palette:#ffffff',
        p,
        normalFor(...p),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        trim,
      );
    }
  for (const ring of [outer, ...holes.map((h) => h.toReversed())])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        p = [
          [a[0], a[1], z - 0.2],
          [b[0], b[1], z - 0.2],
          [b[0], b[1], z + 0.2],
          [a[0], a[1], z + 0.2],
        ];
      quad(out, 'rawlimestone', p, normalFor(...p), stone);
    }
  // Carved bevel on both faces around every genuinely open slot.
  for (const h of holes)
    for (const dz of [-0.211, 0.211])
      for (let i = 0; i < h.length; i++) {
        const c = [
            h.reduce((s, p) => s + p[0], 0) / h.length,
            h.reduce((s, p) => s + p[1], 0) / h.length,
          ],
          a = h[i],
          b = h[(i + 1) % h.length];
        const grow = (p) => [c[0] + (p[0] - c[0]) * 1.18, c[1] + (p[1] - c[1]) * 1.04, z + dz];
        const p = [[a[0], a[1], z + dz * 0.94], [b[0], b[1], z + dz * 0.94], grow(b), grow(a)];
        quad(out, 'rawlimestone', p, normalFor(...p), trim);
      }
}
function borders(out) {
  for (const side of [-1, 1]) {
    for (let x = railStart; x < railEnd; x += 0.56) {
      const xx = Math.min(railEnd, x + 0.55),
        y = road(x);
      box(
        out,
        'rawlimestone',
        [x, y - 0.59, side * 10.12 - 0.17],
        [xx, y - 0.35, side * 10.12 + 0.17],
        stone,
      );
    }
    for (const [dy, width, height] of [
      [-0.25, 0.72, 0.14],
      [-0.08, 0.83, 0.15],
      [0.15, 0.62, 0.15],
      [1.31, 0.57, 0.1],
    ])
      loft(
        out,
        'rawlimestone',
        sample(380, (t) => {
          const x = railStart + (railEnd - railStart) * t,
            y = road(x) + dy,
            z = side * 10.05;
          return [
            [x, y + height, z - width / 2],
            [x, y + height, z + width / 2],
            [x, y, z + width / 2],
            [x, y, z - width / 2],
          ];
        }),
        trim,
      );
    const n = 48,
      step = (railEnd - railStart) / n;
    for (let i = 0; i < n; i++) {
      const a = railStart + i * step + 0.22,
        b = railStart + (i + 1) * step - 0.22;
      if (i === 0)
        box(
          out,
          'rawlimestone',
          [a, road(a) + 0.24, side * 10.05 - 0.2],
          [b, road(b) + 1.3, side * 10.05 + 0.2],
          trim,
        );
      else piercedPanel(out, a, b, side * 10.05);
    }
    for (let i = 0; i <= n; i++) {
      const x = railStart + i * step,
        y = road(x);
      box(
        out,
        'rawlimestone',
        [x - 0.22, y + 0.2, side * 10.05 - 0.25],
        [x + 0.22, y + 1.35, side * 10.05 + 0.25],
        trim,
      );
      box(
        out,
        'rawlimestone',
        [x - 0.26, y + 1.35, side * 10.05 - 0.3],
        [x + 0.26, y + 1.46, side * 10.05 + 0.3],
        trim,
      );
    }
  }
}
const curve = (a, b, c, d) =>
  sample(40, (t) =>
    a.map(
      (v, k) =>
        v * (1 - t) ** 3 + 3 * b[k] * t * (1 - t) ** 2 + 3 * c[k] * t * t * (1 - t) + d[k] * t ** 3,
    ),
  );
// Directed along each bankward wing, fitted to the recorded cadastral outline.
const wings = [
  [...curve([-89, -10.05], [-96.3, -10.05], [-95.75, -14.9], [-95.77, -18.66]), [-100.53, -18.55]],
  [...curve([-89, 10.05], [-98.3, 9.4], [-97.2, 14.9], [-97.08, 18.12]), [-103.24, 17.73]],
  curve([91, -10.05], [94.1, -10.05], [95.6, -11.8], [96.93, -14.42]),
  curve([91, 10.05], [93.6, 10.05], [95.2, 11.9], [96.26, 13.98]),
];
function slab(out, ring, bottom, top, slot, color) {
  const ids = earcut(ring.flat(), null, 2);
  for (const [height, reverse] of [
    [bottom, false],
    [top, true],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      let points = ids.slice(i, i + 3).map((k) => [ring[k][0], height(ring[k][0]), ring[k][1]]);
      if (reverse) points = points.reverse();
      out.addTriangle(
        slot,
        'palette:#ffffff',
        points,
        normalFor(...points),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const points = [
      [a[0], bottom(a[0]), a[1]],
      [b[0], bottom(b[0]), b[1]],
      [b[0], top(b[0]), b[1]],
      [a[0], top(a[0]), a[1]],
    ];
    quad(out, slot, points, normalFor(...points), color);
  }
}
function alongWing(out, path) {
  let distance = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const y = road((a[0] + b[0]) / 2),
      n = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    // The curve is tessellated independently of the staggered ashlar joints.
    // Split each short curve segment at the actual block stations, including
    // the long straight wing ends, instead of showing unbroken course bands.
    for (let row = 0; row < 23; row++) {
      const lo = -1.1 + row * 0.39 + 0.009,
        hi = Math.min(lo + 0.37, y - 0.29);
      if (hi <= lo) break;
      const pitch = 0.92,
        offset = (row % 2) * pitch * 0.5;
      const first = Math.floor((distance + offset) / pitch),
        last = Math.floor((distance + length + offset) / pitch);
      for (let block = first; block <= last; block++) {
        const start = Math.max(distance, block * pitch - offset + 0.007),
          end = Math.min(distance + length, (block + 1) * pitch - offset - 0.007);
        if (end - start < 0.0001) continue;
        const point = (station) => {
          const t = (station - distance) / length;
          return [a[0] + (b[0] - a[0]) * t, (lo + hi) / 2, a[1] + (b[1] - a[1]) * t];
        };
        beam(
          out,
          'weatheredlimestone',
          point(start),
          point(end),
          0.07,
          hi - lo,
          tint(block + row * 37, [0.63, 0.61, 0.53]),
        );
      }
    }
    for (const [dy, width, depth] of [
      [-0.42, 0.35, 0.24],
      [-0.18, 0.72, 0.14],
      [-0.005, 0.83, 0.15],
      [0.225, 0.62, 0.15],
      [0.82, 0.42, 1.04],
      [1.36, 0.57, 0.1],
    ])
      beam(
        out,
        'rawlimestone',
        [a[0], road(a[0]) + dy, a[1]],
        [b[0], road(b[0]) + dy, b[1]],
        width,
        depth,
        trim,
      );
    if (Math.floor((distance + length) / 0.56) !== Math.floor(distance / 0.56)) {
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2;
      beam(
        out,
        'rawlimestone',
        [x - n[0] * 0.18, y - 0.49, z - n[1] * 0.18],
        [x + n[0] * 0.18, y - 0.49, z + n[1] * 0.18],
        0.23,
        0.24,
        stone,
      );
    }
    distance += length;
  }
  const [x, z] = path.at(-1),
    y = road(x);
  box(out, 'rawlimestone', [x - 0.42, -1.1, z - 0.42], [x + 0.42, y + 1.35, z + 0.42], stone);
  box(out, 'rawlimestone', [x - 0.51, y + 1.35, z - 0.51], [x + 0.51, y + 1.49, z + 0.51], trim);
  // The abutment drain shown in the quay-side close photograph.
  beam(
    out,
    'iron',
    [x + 0.47, 0.2, z + 0.46],
    [x + 0.47, y - 0.4, z + 0.46],
    0.105,
    0.105,
    [0.31, 0.33, 0.32],
  );
}
const deckOutline = [...wings[0].toReversed(), ...wings[2], ...wings[3].toReversed(), ...wings[1]];
function approach(out) {
  for (const side of [-1, 1]) {
    const ring = clip(deckOutline, (p) => side * p[0] - bodyEnd);
    slab(
      out,
      ring,
      () => -1.1,
      (x) => road(x) - 0.28,
      'rawlimestone',
      mortar,
    );
  }
  for (const path of wings) alongWing(out, path);
}
function deck(out) {
  loft(
    out,
    'road',
    sample(300, (t) => {
      const x = deckStart + (deckEnd - deckStart) * t,
        y = road(x);
      return [
        [x, y, -6],
        [x, y, 6],
        [x, y - 0.15, 6],
        [x, y - 0.15, -6],
      ];
    }),
    [0.25, 0.265, 0.26],
  );
  for (const side of [-1, 1]) {
    const sidewalk = clip(deckOutline, (p) => side * p[1] - 6),
      start = Math.min(...sidewalk.map((p) => p[0])),
      end = Math.max(...sidewalk.map((p) => p[0]));
    // An earcut fan across the complete outline linearly interpolates bank
    // elevations beneath the crowned center arch. Tessellate in native X
    // before applying the longitudinal profile to keep both slab faces above it.
    for (let x = start; x < end; x += 0.8) {
      let ring = clip(
        clip(sidewalk, (p) => p[0] - x),
        (p) => Math.min(x + 0.8, end) - p[0],
      );
      ring = ring.filter((p, i) => {
        const previous = ring[(i + ring.length - 1) % ring.length];
        return Math.hypot(p[0] - previous[0], p[1] - previous[1]) > 1e-5;
      });
      if (ring.length < 3) continue;
      slab(
        out,
        ring,
        (station) => road(station) - 0.25,
        (station) => road(station) + 0.16,
        'road',
        [0.41, 0.4, 0.36],
      );
    }
  }
  for (const side of [-1, 1])
    for (let x = deckStart; x < deckEnd; x += 1.1)
      box(
        out,
        'rawlimestone',
        [x, road(x) - 0.02, side * 6 - 0.12],
        [Math.min(x + 1.087, deckEnd), road(x) + 0.17, side * 6 + 0.12],
        trim,
      );
  for (let x = deckStart; x < deckEnd; x += 1.0)
    beam(
      out,
      'marking',
      [x, road(x) + 0.01, 0],
      [Math.min(x + 1, deckEnd), road(Math.min(x + 1, deckEnd)) + 0.01, 0],
      0.11,
      0.01,
      [0.85, 0.83, 0.69],
    );
  for (const z of [-4.5, 4.5])
    for (let x = deckStart + 2; x < deckEnd - 1; x += 5.2)
      beam(
        out,
        'marking',
        [x, road(x) + 0.013, z],
        [Math.min(x + 2.8, deckEnd), road(Math.min(x + 2.8, deckEnd)) + 0.013, z],
        0.35,
        0.008,
        [0.83, 0.83, 0.72],
      );
  for (const side of [-1, 1])
    for (let x = -90; x < 94; x += 12.2) {
      const z = side * 5.83,
        y = road(x) + 0.018;
      for (let j = 0; j < 9; j++)
        beam(
          out,
          'iron',
          [x - 0.28 + j * 0.065, y, z - 0.14],
          [x - 0.28 + j * 0.065, y, z + 0.14],
          0.025,
          0.015,
          iron,
        );
    }
}
function lamp(out, x, z) {
  const y = road(x) + 0.16;
  const levels = [
    [0, 0.29],
    [0.1, 0.29],
    [0.2, 0.24],
    [0.32, 0.21],
    [0.55, 0.19],
    [0.7, 0.14],
    [0.85, 0.13],
    [0.95, 0.11],
    [1.1, 0.14],
    [1.18, 0.14],
    [1.27, 0.095],
    [4.52, 0.07],
    [4.59, 0.105],
    [4.68, 0.09],
  ];
  loft(
    out,
    'iron',
    levels.map(([h, r]) => radialRing(y + h, r, r, 40, [x, z])),
    iron,
  );
  for (let j = 0; j < 16; j++) {
    const a = (j * Math.PI) / 8;
    beam(
      out,
      'iron',
      [x + 0.186 * Math.cos(a), y + 0.29, z + 0.186 * Math.sin(a)],
      [x + 0.122 * Math.cos(a), y + 0.79, z + 0.122 * Math.sin(a)],
      0.018,
      0.02,
      iron,
    );
  }
  loft(
    out,
    'glass',
    [
      [4.66, 0.08],
      [4.83, 0.18],
      [5.2, 0.24],
      [5.38, 0.26],
    ].map(([h, r]) => radialRing(y + h, r, r, 40, [x, z])),
    [0.88, 0.92, 0.89],
  );
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2;
    beam(
      out,
      'iron',
      [x + 0.08 * Math.cos(a), y + 4.66, z + 0.08 * Math.sin(a)],
      [x + 0.26 * Math.cos(a), y + 5.38, z + 0.26 * Math.sin(a)],
      0.019,
      0.022,
      iron,
    );
  }
  loft(
    out,
    'iron',
    [
      [5.37, 0.31],
      [5.45, 0.31],
      [5.54, 0.25],
      [5.63, 0.14],
      [5.75, 0.1],
      [5.79, 0.14],
      [5.87, 0.065],
    ].map(([h, r]) => radialRing(y + h, r, r, 40, [x, z])),
    iron,
  );
  sphere(out, 'iron', [x, y + 5.9, z], [0.073, 0.06, 0.073], iron, 24, 12);
}
function serifText(out, text, cx, y, z, width, height, facing = 1, color = [0.24, 0.18, 0.13]) {
  const geometry = new ShapeGeometry(letteringFont.generateShapes(text, 1), 10);
  geometry.computeBoundingBox();
  const b = geometry.boundingBox,
    points = geometry.attributes.position,
    ids = geometry.index;
  for (let i = 0; i < ids.count; i += 3) {
    const triangle = Array.from({ length: 3 }, (_, j) => {
      const k = ids.getX(i + j);
      return [
        cx + facing * ((points.getX(k) - b.min.x) / (b.max.x - b.min.x) - 0.5) * width,
        y + ((points.getY(k) - b.min.y) / (b.max.y - b.min.y)) * height,
        z,
      ];
    });
    // Font triangulation includes collinear curve fragments. Cull only subpixel
    // Float32 slivers, and preserve the visible front of every remaining glyph.
    const f = triangle.map((p) => [Math.fround(p[0]), Math.fround(p[1] + 1.1), Math.fround(p[2])]);
    const area =
      (f[1][0] - f[0][0]) * (f[2][1] - f[0][1]) - (f[1][1] - f[0][1]) * (f[2][0] - f[0][0]);
    if (Math.abs(area) < 1e-7) continue;
    const originalArea =
      (triangle[1][0] - triangle[0][0]) * (triangle[2][1] - triangle[0][1]) -
      (triangle[1][1] - triangle[0][1]) * (triangle[2][0] - triangle[0][0]);
    if (area * originalArea <= 0) continue;
    out.addTriangle(
      'marking',
      'palette:#ffffff',
      triangle,
      [0, 0, facing],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
  geometry.dispose();
}
function plaques(out) {
  const center = railStart + (railEnd - railStart) / 96,
    y = road(center);
  // Two renewed marble plates share a solid inner parapet panel at the left bank.
  for (const [index, lines] of [
    [
      'A LA MEMOIRE',
      'DES AVIATEURS FRANCAIS',
      'QUI CHOISIRENT ICI',
      'DANS LES EAUX DU FLEUVE',
      'UNE MORT CERTAINE',
      'POUR EPARGNER',
      'PARIS',
    ],
    [
      '3 OCTOBRE 1943',
      'LIEUTENANT PILOTE LAMY',
      'ADJUDANT      BALCAEN',
      'SERGENT     ROUSSARIE',
      'SERGENT      JOUNIAUX',
      'GROUPE DE BOMBARDEMENT F.A.F.L.',
      '"LORRAINE"',
    ],
  ].entries()) {
    const cx = center + (index - 0.5) * 1.5,
      z = -9.824;
    box(
      out,
      'rawlimestone',
      [cx - 0.69, y + 0.37, z - 0.03],
      [cx + 0.69, y + 0.99, z],
      [0.92, 0.9, 0.84],
    );
    for (const dx of [-0.645, 0.645])
      for (const dy of [0.413, 0.95])
        sphere(
          out,
          'bronze',
          [cx + dx, y + dy, z + 0.008],
          [0.016, 0.016, 0.009],
          [0.36, 0.31, 0.18],
          16,
          8,
        );
    for (const [i, line] of lines.entries())
      serifText(
        out,
        line,
        cx,
        y + 0.904 - i * 0.052,
        z + 0.002,
        Math.min(1.21, line.length * 0.037),
        0.04,
      );
    if (index === 1) {
      // Original geometric rendering of the winged Cross of Lorraine badge.
      const gold = [0.67, 0.54, 0.21];
      const star = Array.from({ length: 10 }, (_, i) => {
        const a = Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 0.015 : 0.035;
        return [cx + Math.cos(a) * r, y + 0.519 + Math.sin(a) * r, z + 0.008];
      });
      for (let j = 0; j < star.length; j++)
        poly(
          out,
          'bronze',
          [[cx, y + 0.519, z + 0.008], star[j], star[(j + 1) % star.length]],
          gold,
        );
      for (const s of [-1, 1])
        for (let row = 0; row < 6; row++)
          beam(
            out,
            'bronze',
            [cx + s * 0.035, y + 0.476 - row * 0.01, z + 0.004],
            [cx + s * (0.23 - row * 0.022), y + 0.476 - row * 0.01, z + 0.004],
            0.01,
            0.006,
            gold,
          );
      box(
        out,
        'iron',
        [cx - 0.035, y + 0.391, z + 0.002],
        [cx + 0.035, y + 0.47, z + 0.008],
        [0.12, 0.2, 0.32],
      );
      beam(out, 'bronze', [cx, y + 0.4, z + 0.01], [cx, y + 0.458, z + 0.01], 0.006, 0.004, gold);
      for (const [dy, w] of [
        [0.447, 0.03],
        [0.428, 0.041],
      ])
        beam(
          out,
          'bronze',
          [cx - w / 2, y + dy, z + 0.01],
          [cx + w / 2, y + dy, z + 0.01],
          0.006,
          0.004,
          gold,
        );
    } else {
      const ring = sample(40, (t) => [
        cx + Math.cos(t * Math.PI * 2) * 0.052,
        y + 0.437 + Math.sin(t * Math.PI * 2) * 0.052,
        z + 0.004,
      ]);
      for (let j = 1; j < ring.length; j++)
        beam(out, 'bronze', ring[j - 1], ring[j], 0.003, 0.003, [0.65, 0.54, 0.27]);
      poly(
        out,
        'bronze',
        [
          [cx - 0.015, y + 0.409, z + 0.008],
          [cx + 0.025, y + 0.431, z + 0.008],
          [cx - 0.015, y + 0.468, z + 0.008],
        ],
        [0.67, 0.54, 0.23],
      );
      beam(
        out,
        'bronze',
        [cx - 0.034, y + 0.414, z + 0.008],
        [cx + 0.037, y + 0.414, z + 0.008],
        0.007,
        0.004,
        [0.67, 0.54, 0.23],
      );
    }
  }
  const z = 9.837;
  serifText(out, 'PONT DE TOLBIAC', center, y + 0.76, z, 2.05, 0.16, -1, [0.69, 0.67, 0.6]);
  serifText(out, '1879 - 1882', center, y + 0.46, z, 1.3, 0.13, -1, [0.69, 0.67, 0.6]);
  for (const offset of [0, 0.034]) {
    const corners = [
      [center + 1.28 + offset, y + 0.35 - offset, Math.PI],
      [center + 1.28 + offset, y + 1.03 + offset, -Math.PI / 2],
      [center - 1.28 - offset, y + 1.03 + offset, 0],
      [center - 1.28 - offset, y + 0.35 - offset, Math.PI / 2],
    ];
    const ring = corners.flatMap(([x, yy, a]) =>
      sample(16, (t) => [
        x + (0.15 + offset) * Math.cos(a - (t * Math.PI) / 2),
        yy + (0.15 + offset) * Math.sin(a - (t * Math.PI) / 2),
        z,
      ]),
    );
    for (let i = 0; i < ring.length; i++)
      beam(out, 'rawlimestone', ring[i], ring[(i + 1) % ring.length], 0.022, 0.015, trim);
  }
}
export function buildTolbiac(out) {
  // The portable origin is the exposed footing base,1.1m below provisional normal water.
  const destination = out,
    shift = (p) => [p[0], p[1] + 1.1, p[2]];
  out = {
    addQuad: (slot, ref, p, n, uv, c) => destination.addQuad(slot, ref, p.map(shift), n, uv, c),
    addTriangle: (slot, ref, p, n, uv, c) =>
      destination.addTriangle(slot, ref, p.map(shift), n, uv, c),
    addConvexPolygon: (slot, ref, p, n, uv, c) =>
      destination.addConvexPolygon(slot, ref, p.map(shift), n, uv, c),
  };
  vaults(out);
  cutwaters(out);
  approach(out);
  deck(out);
  borders(out);
  plaques(out);
  for (const x of [-93, -74.4, -37.2, 0, 37.2, 74.4, 93])
    for (const side of [-1, 1]) lamp(out, x, side * 6.85);
}
function geographicProposal() {
  const radius = 6378137,
    factor = Math.cos((frame.anchor[1] * Math.PI) / 180);
  const centerX = ((frame.anchor[0] * Math.PI) / 180) * radius * factor;
  const centerZ = -radius * Math.asinh(Math.tan((frame.anchor[1] * Math.PI) / 180)) * factor;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const corners = [
    [-205, -115],
    [-205, 115],
    [205, -115],
    [205, 115],
  ].map(([x, z]) => [
    (((centerX + c * x + s * z) / factor / radius) * 180) / Math.PI,
    (Math.atan(Math.sinh(-(centerZ - s * x + c * z) / factor / radius)) * 180) / Math.PI,
  ]);
  return {
    anchor: frame.anchor,
    heading: frame.heading,
    elevationMode: 'sea-level',
    elevationMeters: 27.4,
    bounds: [
      Math.min(...corners.map((p) => p[0])),
      Math.min(...corners.map((p) => p[1])),
      Math.max(...corners.map((p) => p[0])),
      Math.max(...corners.map((p) => p[1])),
    ],
    replaceRoads: {
      length: deckEnd - deckStart,
      width: 20,
      outline: deckOutline,
      deckHeights: [road(deckStart) + 1.1, road(deckEnd) + 1.1],
    },
    notes:
      'Directed deck centerline from four mapped cutwaters; origin fitted to official IGN RGE ALTI upper road plateaus 35.4/35.6 m, cross-checked against BD TOPO 3D road axes. Model reference water 28.5 m differs from sampled RGE water 28.05 m; river level is not a fixed structural datum. The exact curved deck/wing polygon removes only covered, successfully loaded bridge-road fragments. Connector stations at native X +/-99.25 m approximate the asymmetric road ends -101.9/+96.6 m by 2.65 m, inside the full-width blending radius; the resulting native profile difference is below 5 cm. Endpoint heights retain the actual authored road elevations. Host terrain must use NGF-IGN69 or explicitly convert heights. Current terrain captures remain required.',
  };
}
export const tolbiacStudy = {
  id: 'N0028',
  key: 'pont_de_tolbiac',
  title: 'Pont de Tolbiac',
  wikidataId: 'Q2307670',
  mapFrameDocument: 'map-frame.json',
  letteringNotice:
    'Memorial and name lettering uses the installed Gentilis typeface by J. Victor Gaultney and Annie Olsen, copyright SIL International2003–2008, under SIL Open Font License1.1. See FONT-LICENSE.txt. No per-model bitmap lettering texture is loaded.',
  build: buildTolbiac,
  brief:
    'Five unequal limestone vaults, round cutwaters with low caps and narrow pilasters, ashlar spandrels, radial voussoirs and coursed soffits, dentil cornices and genuinely open capsule-slot stone balustrades.',
  refs: [
    'https://www.afgc.asso.fr/history-heritage/pont-de-tolbiac-a-paris/',
    'https://www.afgc.asso.fr/app/uploads/2023/06/HistoireAdminPontsParis_Prade-1982b.pdf',
    'https://upload.wikimedia.org/wikipedia/commons/d/de/Grandes_vo%C3%BBtes_%28IA_grandesvoutes56sejo%29.pdf',
    'https://commons.wikimedia.org/wiki/File:Pont_Tolbiac_-_Paris_XII_(FR75)_-_2026-06-06_-_1.jpg',
    'https://commons.wikimedia.org/wiki/File:Paris_Pont_de_Tolbiac_bridge_railing_downstream_close_up.jpg',
    'https://www.openstreetmap.org/way/183626421',
  ],
  sourceFacts: {
    publishedNominalLengthMeters: 168,
    clearSpansMeters: [29, 32, 35, 32, 29],
    deckUsefulWidthMeters: 20,
    roadWidthMeters: 12,
    sidewalkWidthMeters: 4,
    outerArchRiseMeters: 7.09,
    centerArchRiseMeters: 8.18,
    roadSlope: 0.017,
    openingYear: 1882,
  },
  reconstruction: {
    modeledClearVaultChainMeters: 172.6,
    modeledOverallLengthMeters: 200.17,
    pierThicknessMeters: [3.4, 4.4, 4.4, 3.4],
    waterRelativeSpringMeters: spring,
    intermediateRiseMeters: 7.76,
    notes:
      'Pier centers fitted to cadastral OSM cutwater outlines and independently checked aerial. Their spacing and published clear spans imply172.6m vault chain, differing from the commonly published168m. Curved wings extend to mapped bank connections. Published outer and center rises are from Séjourné volV printed84; intermediate rise interpolated. IGN ground and road-axis evidence set the modern elevation.',
  },
  nativeAxes: {
    x: 'northeast from left bank toward Bercy',
    y: 'up from footing base1.1m below provisional normal Seine water level',
    z: 'southeast/upstream face',
  },
  geographic: geographicProposal,
  limitations: [
    'Nominal168m length conflicts with the mapped pier spacing and published clear spans; retain both rather than hiding the discrepancy.',
    'Quay stairways outside the recorded bridge footprint are not part of this asset. Exact current street-sign positions and memorial panel dimensions are reconstructed from photographs, not surveyed.',
    'Current terrain-fit captures must approve the IGN-supported vertical placement; river surface height varies.',
  ],
  camera: { position: [130, 53, 135], lookAt: [0, 4, 0], fov: 45 },
  qaCameras: [
    { name: 'five-vaults-upstream', position: [0, 13, 230], lookAt: [0, 4, 0] },
    { name: 'five-vaults-downstream', position: [0, 13, -230], lookAt: [0, 4, 0] },
    { name: 'center-arch-voussoirs', position: [7, 3, 36], lookAt: [0, 5, 9] },
    { name: 'coursed-soffit', position: [0, 1, 6], lookAt: [3, 6.5, 0] },
    { name: 'cutwater-and-pilaster', position: [29, 6, 21], lookAt: [19.7, 4, 10] },
    { name: 'pier-cap-masonry', position: [59, 3, 18], lookAt: [55.6, 1.8, 10] },
    { name: 'capsule-balustrade', position: [4, 10.2, 15.4], lookAt: [0, 9.1, 10.05] },
    { name: 'dentil-cornice', position: [15, 7.4, 15], lookAt: [9, 8.1, 10] },
    { name: 'cast-lantern', position: [6, 15, 13], lookAt: [0, 13.4, 6.85] },
    { name: 'current-road', position: [60, 11, 4], lookAt: [-50, 8, 0] },
    { name: 'left-bank-approach', position: [-119, 12, 27], lookAt: [-91, 4, 0] },
    { name: 'memorial-plaques', position: [-87.125, 9.73, -6.6], lookAt: [-87.125, 9, -9.83] },
    { name: 'bridge-name-inscription', position: [-87.125, 9.8, 6.8], lookAt: [-87.125, 9, 9.84] },
    { name: 'curved-quay-wall', position: [-102, 4.4, 27], lookAt: [-95, 4, 13] },
    { name: 'deck-plan', position: [0, 270, 0.01], lookAt: [0, 3, 0] },
  ],
};
