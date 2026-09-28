/** Pont de l'Archeveche: shallow limestone vaults and the current transparent parapets. */

import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0019_pont_de_l_archeveche', 'map-frame.json')),
);
const stone = [0.56, 0.505, 0.39],
  mortar = [0.38, 0.35, 0.285],
  iron = [0.035, 0.043, 0.042];
const rand = (s) => {
  const n = Math.sin(s * 17.523 + 35.6) * 54893.23;
  return n - Math.floor(n);
};
const tint = (s, base = stone) => base.map((v) => v + (rand(s) - 0.5) * 0.065);
const arches = [
  { c: -10.2, rx: 7.5, rise: 2 },
  { c: 8.15, rx: 8.55, rise: 2.4 },
  { c: 26.5, rx: 7.5, rise: 2 },
];
const spring = 4.4;
const southSpring = -17.7;
const deck = (x) => 7.55 + 0.26 * Math.exp(-(((x - 8) / 23) ** 2));
const limits = (x) => {
  // The mainland abutment widens toward the quay; do not stretch the vaults to its bounding box.
  const t = Math.max(0, Math.min(1, (southSpring - x) / (34.3 + southSpring)));
  return [-5.42 - t * 10.56, 5.62 + t * 11.09];
};
function geographicProposal() {
  const radius = 6378137,
    factor = Math.cos((frame.anchor[1] * Math.PI) / 180);
  const cx = ((frame.anchor[0] * Math.PI) / 180) * radius * factor;
  const cz = -radius * Math.asinh(Math.tan((frame.anchor[1] * Math.PI) / 180)) * factor;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const corners = [
    [-140, -90],
    [-140, 90],
    [140, -90],
    [140, 90],
  ].map(([x, z]) => [
    (((cx + c * x + s * z) / factor / radius) * 180) / Math.PI,
    (Math.atan(Math.sinh(-(cz - s * x + c * z) / factor / radius)) * 180) / Math.PI,
  ]);
  return {
    anchor: frame.anchor,
    heading: frame.heading,
    elevationMode: 'sea-level',
    elevationMeters: 26.96,
    bounds: [
      Math.min(...corners.map((p) => p[0])),
      Math.min(...corners.map((p) => p[1])),
      Math.max(...corners.map((p) => p[0])),
      Math.max(...corners.map((p) => p[1])),
    ],
    replaceRoads: {
      length: 68.55,
      width: 33.4,
      outline: [
        [-34.3, limits(-34.3)[0]],
        [-17.7, limits(-17.7)[0]],
        [34.25, limits(34.25)[0]],
        [34.25, limits(34.25)[1]],
        [-17.7, limits(-17.7)[1]],
        [-34.3, limits(-34.3)[1]],
      ],
      deckHeights: [deck(-34.3) + 0.02, deck(34.25) + 0.02],
    },
    featureIds: ['way/78329745'],
    source: frame.sourceUrl,
    notes:
      'Exact mapped bridge axis and flared mainland approach. Absolute origin 26.96 m uses the independently sampled IGN RGE ALTI water surface in NGF-IGN69; it is a placement reference, not a measured riverbed. Modeled island road end approximately 34.60 m agrees with the independent upper-bank plateau at native X 40–44 m (34.58–34.60 m); the closer X 33 m terrain ray is on the smoothed quay face. Mainland plateau differences up to 0.4 m are retained. Only loaded model-covered road fragments are replaced; the exact flared polygon and authored endpoint heights join the surrounding procedural approaches. Host terrain must use NGF-IGN69 or convert heights explicitly. Final terrain and road-context image review is required.',
  };
}
function polygon(out, slot, ps, color) {
  if (ps.length < 3) return;
  out.addConvexPolygon(slot, 'palette:#ffffff', ps, normalFor(...ps), (p) => [p[0], p[1]], color);
}
function prism(out, poly, z0, z1, color = stone, slot = 'rawlimestone') {
  poly = poly
    .map((p) => p.map(Math.fround))
    .filter(
      (p, i, all) =>
        Math.hypot(...p.map((v, k) => v - all[(i + all.length - 1) % all.length][k])) > 1e-5,
    );
  for (let i = poly.length - 1; i >= 0 && poly.length >= 3; i--) {
    const a = poly[(i + poly.length - 1) % poly.length],
      b = poly[i],
      c = poly[(i + 1) % poly.length];
    if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-6)
      poly.splice(i, 1);
  }
  if (poly.length < 3) return;
  const area = poly.reduce(
    (v, p, i) => v + p[0] * poly[(i + 1) % poly.length][1] - p[1] * poly[(i + 1) % poly.length][0],
    0,
  );
  if (Math.abs(area) < 1e-6) return;
  if (area < 0) poly.reverse();
  const a = poly.map(([x, y]) => [x, y, typeof z0 === 'function' ? z0(x) : z0]),
    b = poly.map(([x, y]) => [x, y, typeof z1 === 'function' ? z1(x) : z1]);
  polygon(out, slot, a.toReversed(), color);
  polygon(out, slot, b, color);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      q = [a[i], a[j], b[j], b[i]];
    quad(out, slot, q, normalFor(...q), color);
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
function archY(a, x) {
  const r = (a.rx ** 2 + a.rise ** 2) / (2 * a.rise);
  return spring + a.rise - r + Math.sqrt(Math.max(0, r ** 2 - (x - a.c) ** 2));
}
function lower(x, ring = false) {
  const a = arches.find((a) => Math.abs(x - a.c) <= a.rx);
  return a ? archY(a, x) + (ring ? 0.69 : 0) : spring;
}
function wall(out, poly, z0, z1, color, ring = false) {
  const x0 = Math.min(...poly.map((p) => p[0])),
    x1 = Math.max(...poly.map((p) => p[0]));
  const breaks = [
    ...new Set(
      [x0, x1, ...arches.flatMap((a) => [a.c - a.rx, a.c + a.rx])].filter(
        (x) => x >= x0 && x <= x1,
      ),
    ),
  ].sort((a, b) => a - b);
  for (let i = 1; i < breaks.length; i++) {
    const l = breaks[i - 1],
      r = breaks[i],
      y0 = lower(l + 1e-7, ring),
      y1 = lower(r - 1e-7, ring);
    let p = clip(
      clip(poly, (p) => p[0] - l),
      (p) => r - p[0],
    );
    p = clip(p, (p) => p[1] - y0 - ((y1 - y0) * (p[0] - l)) / (r - l));
    prism(out, p, z0, z1, color);
  }
}
function capsule(x, y, radius, half = 4.7, count = 48) {
  return Array.from({ length: count }, (_, i) => {
    const t = (-Math.PI * 2 * i) / count;
    return [x + Math.cos(t) * radius, y, Math.sin(t) * radius + (Math.sin(t) >= 0 ? half : -half)];
  });
}
function pier(out, x) {
  loft(out, 'rawlimestone', [capsule(x, 0, 1.27), capsule(x, 4.1, 1.15)], mortar);
  for (let row = 0; row < 12; row++) {
    const y0 = row * 0.34 + 0.009,
      y1 = Math.min(4.1, y0 + 0.32),
      r0 = 1.27 - (y0 * 0.12) / 4.1,
      r1 = 1.27 - (y1 * 0.12) / 4.1;
    const count = 48;
    const a = capsule(x, y0, r0 + 0.016, 4.7, count),
      b = capsule(x, y1, r1 + 0.016, 4.7, count);
    for (let j = 0; j < count; j++) {
      const k = (j + 1) % count,
        q = [a[j], a[k], b[k], b[j]];
      quad(
        out,
        'rawlimestone',
        q,
        normalFor(...q),
        tint(row * 71 + j + x, row < 3 ? [0.31, 0.3, 0.225] : stone),
      );
    }
  }
  loft(
    out,
    'rawlimestone',
    [capsule(x, 4.08, 1.29), capsule(x, 4.36, 1.32), capsule(x, 4.4, 1.15)],
    tint(x),
  );
  for (const side of [-1, 1]) {
    const ring = [];
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      ring.push([x + Math.cos(t) * 0.105, 2.95 + Math.sin(t) * 0.105, side * 5.925]);
    }
    for (let i = 1; i < ring.length; i++) tube(out, 'iron', ring[i - 1], ring[i], 0.018, iron, 8);
    box(
      out,
      'iron',
      [x - 0.055, 3.04, side * 5.92 - 0.024],
      [x + 0.055, 3.14, side * 5.92 + 0.024],
      iron,
    );
  }
}
function lathe(out, slot, x, z, y, profile, color, n = 64) {
  loft(
    out,
    slot,
    profile.map(([h, r]) =>
      Array.from({ length: n }, (_, i) => {
        const t = (-i / n) * Math.PI * 2;
        return [x + Math.cos(t) * r, y + h, z + Math.sin(t) * r];
      }),
    ),
    color,
  );
}
function lamp(out, x, z) {
  const y = deck(x) + 0.14;
  lathe(
    out,
    'iron',
    x,
    z,
    y,
    [
      [0, 0.24],
      [0.06, 0.24],
      [0.1, 0.2],
      [0.17, 0.2],
      [0.22, 0.16],
      [0.72, 0.15],
      [0.88, 0.12],
      [1.05, 0.095],
      [1.12, 0.1],
      [1.18, 0.075],
      [3.56, 0.055],
      [3.65, 0.09],
      [3.72, 0.065],
      [3.86, 0.11],
    ],
    iron,
  );
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2,
      dx = Math.cos(t),
      dz = Math.sin(t);
    tube(
      out,
      'iron',
      [x + dx * 0.12, y + 0.3, z + dz * 0.12],
      [x + dx * 0.075, y + 1.04, z + dz * 0.075],
      0.014,
      iron,
      8,
    );
  }
  lathe(
    out,
    'glass',
    x,
    z,
    y,
    [
      [3.94, 0.085],
      [4.0, 0.15],
      [4.24, 0.205],
      [4.58, 0.225],
    ],
    [0.8, 0.88, 0.88],
  );
  for (const side of [-1, 1]) {
    const path = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24;
      return [x + side * (0.1 + 0.24 * Math.sin((Math.PI * t) / 2)), y + 3.8 + 0.82 * t, z];
    });
    for (let i = 1; i < path.length; i++) tube(out, 'iron', path[i - 1], path[i], 0.028, iron, 10);
    sphere(out, 'iron', [x + side * 0.23, y + 3.99, z], [0.053, 0.045, 0.045], iron, 20, 12);
  }
  lathe(
    out,
    'iron',
    x,
    z,
    y,
    [
      [4.56, 0.3],
      [4.61, 0.34],
      [4.68, 0.34],
      [4.75, 0.28],
      [4.94, 0.19],
      [5.04, 0.14],
      [5.14, 0.14],
      [5.16, 0.19],
      [5.24, 0.14],
      [5.28, 0.045],
    ],
    iron,
  );
}
function rail(out, side) {
  const start = -33.8,
    end = 34.2,
    count = 42;
  for (let i = 0; i < count; i++) {
    const a = start + ((end - start) * i) / count,
      b = start + ((end - start) * (i + 1)) / count,
      z = (x) => limits(x)[side < 0 ? 0 : 1] + side * 0.04,
      pa = [a, deck(a) + 0.23, z(a)],
      pb = [b, deck(b) + 0.23, z(b)];
    for (const h of [0, 1.1])
      beam(out, 'iron', [a, pa[1] + h, pa[2]], [b, pb[1] + h, pb[2]], 0.06, 0.065, iron);
    beam(out, 'iron', pa, [a, pa[1] + 1.13, pa[2]], 0.07, 0.07, iron);
    beam(out, 'iron', [a, pa[1] + 0.06, pa[2]], [b, pb[1] + 1.06, pb[2]], 0.032, 0.035, iron);
    beam(out, 'iron', [a, pa[1] + 1.06, pa[2]], [b, pb[1] + 0.06, pb[2]], 0.032, 0.035, iron);
    const q = [
      [a + 0.05, pa[1] + 0.05, z(a + 0.05) + side * 0.035],
      [b - 0.05, pb[1] + 0.05, z(b - 0.05) + side * 0.035],
      [b - 0.05, pb[1] + 1.05, z(b - 0.05) + side * 0.035],
      [a + 0.05, pa[1] + 1.05, z(a + 0.05) + side * 0.035],
    ];
    quad(out, 'glass', q, normalFor(...q), [0.82, 0.9, 0.9]);
    quad(out, 'glass', q.toReversed(), normalFor(...q.toReversed()), [0.82, 0.9, 0.9]);
    for (const h of [0.08, 1.02])
      box(
        out,
        'iron',
        [a + 0.04, pa[1] + h - 0.018, pa[2] - 0.055],
        [a + 0.1, pa[1] + h + 0.018, pa[2] + 0.055],
        iron,
      );
  }
}
export function buildArchevecheBridge(out) {
  for (const x of [-1.55, 17.85]) pier(out, x);
  box(out, 'rawlimestone', [34.0, 0, -5.42], [34.48, deck(34.3), 5.62], mortar);
  for (let row = 0; row < 20; row++)
    for (let z = -5.42; z < 5.62; z += 0.86)
      box(
        out,
        'rawlimestone',
        [34.481, row * 0.38 + 0.01, z + 0.012],
        [34.5, Math.min(deck(34.3), row * 0.38 + 0.366), Math.min(5.62, z + 0.846)],
        tint(row + z * 17),
      );
  // Main shallow vaults; radial ashlar blocks meet an independent coursed spandrel.
  for (let x = southSpring; x < 34.1; x += 0.18)
    wall(
      out,
      [
        [x, spring],
        [Math.min(34.1, x + 0.18), spring],
        [Math.min(34.1, x + 0.18), deck(x + 0.18) - 0.18],
        [x, deck(x) - 0.18],
      ],
      -5.4,
      5.6,
      mortar,
    );
  for (const [j, a] of arches.entries()) {
    const r = (a.rx ** 2 + a.rise ** 2) / (2 * a.rise),
      centerY = spring + a.rise - r,
      angle = Math.asin(a.rx / r),
      n = 110;
    const p = (t, extra = 0) => [
      a.c + (r + extra) * Math.sin(t),
      centerY + (r + extra) * Math.cos(t),
    ];
    for (let i = 0; i < n; i++) {
      const t0 = -angle + (2 * angle * (i + 0.026)) / n,
        t1 = -angle + (2 * angle * (i + 0.974)) / n;
      for (const side of [-1, 1])
        prism(
          out,
          [p(t1), p(t0), p(t0, 0.68), p(t1, 0.68)],
          side < 0 ? -5.45 : 5.61,
          side < 0 ? -5.405 : 5.655,
          tint(i + j * 111),
        );
      for (let k = 0; k < 22; k++) {
        const z0 = -5.4 + k * 0.5;
        prism(
          out,
          [p(t1, -0.018), p(t0, -0.018), p(t0, 0.006), p(t1, 0.006)],
          z0 + 0.008,
          z0 + 0.488,
          tint(i * 13 + k + j, [0.39, 0.36, 0.29]),
        );
      }
    }
  }
  for (const side of [-1, 1])
    for (let row = 0; row < 9; row++)
      for (let x = southSpring - (row % 2) * 0.48; x < 34.1; x += 0.95) {
        const x0 = Math.max(southSpring, x + 0.007),
          x1 = Math.min(34.1, x + 0.936),
          y0 = spring + row * 0.39 + 0.008,
          y1 = spring + (row + 1) * 0.39 - 0.01;
        if (x1 <= x0 || y0 >= deck(x0) - 0.18) continue;
        wall(
          out,
          [
            [x0, y0],
            [x1, y0],
            [x1, Math.min(y1, deck(x1) - 0.18)],
            [x0, Math.min(y1, deck(x0) - 0.18)],
          ],
          side < 0 ? -5.46 : 5.61,
          side < 0 ? -5.41 : 5.66,
          tint(x + row * 23),
          true,
        );
      }
  for (let x = -34.3; x < southSpring; x += 0.32)
    prism(
      out,
      [
        [x, 0],
        [Math.min(southSpring, x + 0.32), 0],
        [Math.min(southSpring, x + 0.32), deck(x + 0.32) - 0.17],
        [x, deck(x) - 0.17],
      ],
      (s) => limits(s)[0],
      (s) => limits(s)[1],
      mortar,
    );
  for (const side of [-1, 1])
    for (let row = 0; row < 20; row++)
      for (let x = -34.3; x < southSpring; x += 0.88) {
        const x1 = Math.min(southSpring, x + 0.866),
          y0 = row * 0.38 + 0.009,
          y1 = Math.min(deck(x) - 0.17, y0 + 0.362);
        if (y1 <= y0) continue;
        prism(
          out,
          [
            [x + 0.008, y0],
            [x1, y0],
            [x1, y1],
            [x + 0.008, y1],
          ],
          (s) => limits(s)[side < 0 ? 0 : 1] - 0.018,
          (s) => limits(s)[side < 0 ? 0 : 1] + 0.018,
          tint(x * 31 + row),
        );
      }
  // Paving follows the slight crown; narrow pale stone stripe divides the two paved lanes.
  for (let x = -34.3; x < 34.25; x += 0.5) {
    const b = Math.min(34.25, x + 0.5);
    prism(
      out,
      [
        [x, deck(x) - 0.18],
        [b, deck(b) - 0.18],
        [b, deck(b)],
        [x, deck(x)],
      ],
      (s) => limits(s)[0],
      (s) => limits(s)[1],
      mortar,
    );
    for (const side of [-1, 1]) {
      prism(
        out,
        [
          [x, deck(x)],
          [b, deck(b)],
          [b, deck(b) + 0.15],
          [x, deck(x) + 0.15],
        ],
        side < 0 ? (s) => limits(s)[0] : 3.5,
        side < 0 ? -3.5 : (s) => limits(s)[1],
        [0.28, 0.26, 0.22],
        'road',
      );
      prism(
        out,
        [
          [x, deck(x) + 0.01],
          [b, deck(b) + 0.01],
          [b, deck(b) + 0.16],
          [x, deck(x) + 0.16],
        ],
        side < 0 ? -3.6 : 3.4,
        side < 0 ? -3.4 : 3.6,
        tint(x + side),
      );
      prism(
        out,
        [
          [x, deck(x) - 0.06],
          [b, deck(b) - 0.06],
          [b, deck(b) + 0.2],
          [x, deck(x) + 0.2],
        ],
        (s) => limits(s)[side < 0 ? 0 : 1] - 0.14,
        (s) => limits(s)[side < 0 ? 0 : 1] + 0.14,
        tint(x * 3),
      );
    }
  }
  // Curved granite sett courses follow the photographed fan paving, with a separate pale stripe.
  const laneEdges = [-3.35, -1.675, 0, 1.675, 3.35];
  for (let lane = 0; lane < 4; lane++) {
    const z0 = laneEdges[lane],
      z1 = laneEdges[lane + 1],
      center = (z0 + z1) / 2;
    for (let group = -25; group < 25; group++) {
      const base = group * 1.44 + (lane % 2) * 0.72;
      const boundary = (row, z) => {
        const s = z - center,
          r = 1.05 + row * 0.144;
        const low = Math.sqrt(1.05 ** 2 - s ** 2),
          high = Math.sqrt(2.49 ** 2 - s ** 2);
        return (
          base +
          0.28 * Math.cos(((s / 0.8375) * Math.PI) / 2) +
          (1.44 * (Math.sqrt(r ** 2 - s ** 2) - low)) / (high - low)
        );
      };
      for (let row = 0; row < 10; row++)
        for (let col = 0; col < 12; col++) {
          const za = z0 + ((z1 - z0) * col) / 12 + 0.004,
            zb = z0 + ((z1 - z0) * (col + 1)) / 12 - 0.004;
          const xa = Math.max(-34.25, boundary(row, za) + 0.004),
            xb = Math.max(-34.25, boundary(row, zb) + 0.004),
            xc = Math.min(34.25, boundary(row + 1, zb) - 0.004),
            xd = Math.min(34.25, boundary(row + 1, za) - 0.004);
          if (xd <= xa || xc <= xb) continue;
          const poly = [
            [xa, za],
            [xb, zb],
            [xc, zb],
            [xd, za],
          ];
          const color = tint(group * 337 + lane * 71 + row * 19 + col, [0.205, 0.186, 0.176]);
          loft(
            out,
            'paving',
            [-0.018, 0.012].map((h) => poly.map(([x, z]) => [x, deck(x) + h, z])),
            color,
          );
        }
    }
  }
  for (let x = -34.25; x < 34.25; x += 0.28) {
    const b = Math.min(34.25, x + 0.272);
    prism(
      out,
      [
        [x, deck(x) + 0.014],
        [b, deck(b) + 0.014],
        [b, deck(b) + 0.024],
        [x, deck(x) + 0.024],
      ],
      0.55,
      0.84,
      [0.65, 0.64, 0.57],
      'paving',
    );
  }
  rail(out, -1);
  rail(out, 1);
  for (const [x, z] of [
    [-1.8, 3.894],
    [18.151, 3.987],
  ])
    lamp(out, x, z);
  // Direction-specific river signs, attached to masonry below the parapet.
  for (const x of [-6.539, 7.963, 26.415]) {
    const y = deck(x) - 0.48;
    box(
      out,
      'marking',
      [x - 0.45, y - 0.44, 5.68],
      [x + 0.45, y + 0.44, 5.74],
      [0.68, 0.024, 0.026],
    );
    box(
      out,
      'marking',
      [x - 0.45, y - 0.145, 5.743],
      [x + 0.45, y + 0.145, 5.751],
      [0.91, 0.91, 0.86],
    );
  }
  const y = deck(8) - 0.5;
  box(out, 'marking', [7.52, y - 0.46, -5.75], [8.48, y + 0.46, -5.68], [0.017, 0.12, 0.37]);
  box(out, 'marking', [7.61, y + 0.04, -5.762], [8.39, y + 0.28, -5.755], [0.9, 0.9, 0.85]);
  box(out, 'marking', [7.88, y - 0.34, -5.762], [8.12, y + 0.08, -5.755], [0.9, 0.9, 0.85]);
}
export const archevecheStudy = {
  id: 'N0019',
  key: 'pont_de_l_archeveche',
  title: "Pont de l'Archeveche",
  wikidataId: 'Q2073308',
  build: buildArchevecheBridge,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Three shallow circular limestone vaults with radial ashlar and stone soffits, tapered rounded cutwaters and mooring rings, coursed flared mainland approach, crowned cobbled deck and stone curbs, post-2016 glazed crossed-iron parapets, mapped ornamental lanterns and direction-specific river signs.',
  refs: [
    'https://books.google.com/books?id=fnI5AAAAcAAJ&pg=PA174',
    'https://books.google.com/books?id=fnI5AAAAcAAJ&pg=PA175',
    'https://www.afgc.asso.fr/history-heritage/pont-de-larcheveche-a-paris/',
    'https://www.paris.fr/pages/a-la-decouverte-des-ponts-parisiens-les-plus-romantiques-18806',
    'https://commons.wikimedia.org/wiki/File:Pont_Archev%C3%AAch%C3%A9_-_Paris_IV_(FR75)_-_2021-06-05_-_1.jpg',
    'https://commons.wikimedia.org/wiki/File:Pont_de_l%27Archev%C3%AAch%C3%A9,_Paris_June_2019.jpg',
    'https://www.openstreetmap.org/way/78329745',
  ],
  sourceFacts: {
    constructionYear: 1828,
    engineeringOverallLengthMeters: 67.2,
    engineeringWidthMeters: 11,
    roadwayWidthMeters: 7,
    sidewalkWidthsMeters: [2, 2],
    clearArchesMeters: [15, 17.1, 15],
    archRiseMeters: [2, 2.4, 2],
    pierThicknessAtSpringMeters: 2.3,
    archivalCentralIntradosAboveHistoricalLowWaterMeters: 7.96,
    archivalAbutmentThicknessMeters: 9,
    archivalRoadwayWidthMeters: 7.2,
    archivalSidewalkWidthsMeters: [1.8, 1.8],
    currentRailings:
      'Transparent panels in crossed iron frames; city confirms removed love locks and glazing in January2026 article.',
  },
  reconstruction: {
    modeledSpringAboveFoundationMeters: spring,
    notes:
      'The 1864 Annales des Ponts et Chaussees pages174–175 were visually inspected: circular spans15/17.1/15m, rises2/2.4/2m and piers2.3m. The reported7.96m central intrados is above a historical low-water datum, not modern ordinary river level or riverbed. Arch stations use the mapped northern end; navigation signs retain independent mapped positions. Present deck width uses AFGC current7m carriageway and2m sidewalks.',
  },
  nativeAxes: {
    x: 'north-northeast to Ile de la Cite',
    y: 'up from lowest reconstructed pier foundation',
    z: 'east-southeast upstream',
  },
  geographic: geographicProposal,
  limitations: [
    'Current permanent bridge geometry; temporary street works and movable furnishings are omitted.',
    'Arch ring thickness, coursing and lantern member dimensions are original photo reconstruction, not a scan.',
    'The declared NGF-IGN69 origin and bank joins use independent IGN terrain and road evidence. Submerged foundation depth remains reconstructed; water elevation is not bathymetry.',
    'The separate public clock and island streetlight stand beyond this model footprint and are not duplicated within it.',
  ],
  camera: { position: [57, 30, 58], lookAt: [0, 4, 0], fov: 52 },
  qaCameras: [
    { name: 'upstream-three-arches', position: [7, 8, 68], lookAt: [7, 4.7, 0], fov: 57 },
    { name: 'downstream-vaults', position: [12, 8, -65], lookAt: [9, 4.5, 0], fov: 56 },
    { name: 'rounded-cutwater', position: [24, 4.1, 15], lookAt: [17.75, 2.8, 4.8], fov: 49 },
    { name: 'ashlar-and-soffit', position: [7, 1.7, 10], lookAt: [7, 6.4, 0], fov: 62 },
    { name: 'glazed-parapet', position: [9, 9.2, 1], lookAt: [4, 8.45, 5.7], fov: 58 },
    { name: 'ornamental-lantern', position: [22, 11.7, 9], lookAt: [18.15, 11.8, 3.99], fov: 49 },
    { name: 'cobbled-deck', position: [-24, 10, 0], lookAt: [15, 8.1, 0], fov: 64 },
    { name: 'flared-mainland', position: [-47, 15, 32], lookAt: [-24, 4.5, 0], fov: 58 },
  ],
};
