/** Whole TT8: ruined chapel/court and separate complete carved hypogeum. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  D = P.hypogeum,
  A = P.chapel,
  Y = P.floors;
export const surfaces = {
  earth: { slot: 'wall', graph: 'earth_adobe', roughness: 0.98, metallic: 0 },
  rock: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
};
const C = { earth: rgb('a99071'), rock: rgb('c9bda4'), plaster: rgb('ddc9a0') };
let space = 'chapel';
const sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0),
  clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const chapelPoint = ([x, y, z]) => {
  const c = Math.cos(P.chapelHeadingRadians),
    s = Math.sin(P.chapelHeadingRadians);
  return [
    P.componentPositions.chapel[0] + c * x + s * z,
    Y.chapel + y,
    P.componentPositions.chapel[1] - s * x + c * z,
  ];
};
export const tombPoint = ([x, y, z]) => [
  P.componentPositions.shaft[0] + x,
  Y.shaftRim + y,
  P.componentPositions.shaft[1] - z,
];
function point(q) {
  return (space === 'chapel' ? chapelPoint(q) : tombPoint(q)).map(Math.fround);
}
function vector([x, y, z]) {
  if (space === 'tomb') return [x, y, -z];
  const c = Math.cos(P.chapelHeadingRadians),
    s = Math.sin(P.chapelHeadingRadians);
  return [c * x + s * z, y, -s * x + c * z];
}
function T(o, k, q, v, col = C[k]) {
  q = q.map(point);
  const n = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...n) < 1e-9) return;
  if (v && dot(n, vector(v)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function Q(o, k, q, v, col) {
  T(o, k, q.slice(0, 3), v, col);
  T(o, k, [q[0], q[2], q[3]], v, col);
}
function box(o, k, x, y, z, w, h, d, col) {
  if (w < 1e-6 || h < 1e-6 || d < 1e-6) return;
  const a = x - w / 2,
    b = x + w / 2,
    c = y - h / 2,
    e = y + h / 2,
    f = z - d / 2,
    g = z + d / 2;
  Q(
    o,
    k,
    [
      [a, c, f],
      [a, e, f],
      [b, e, f],
      [b, c, f],
    ],
    [0, 0, -1],
    col,
  );
  Q(
    o,
    k,
    [
      [a, c, g],
      [b, c, g],
      [b, e, g],
      [a, e, g],
    ],
    [0, 0, 1],
    col,
  );
  Q(
    o,
    k,
    [
      [a, c, f],
      [a, c, g],
      [a, e, g],
      [a, e, f],
    ],
    [-1, 0, 0],
    col,
  );
  Q(
    o,
    k,
    [
      [b, c, f],
      [b, e, f],
      [b, e, g],
      [b, c, g],
    ],
    [1, 0, 0],
    col,
  );
  Q(
    o,
    k,
    [
      [a, e, f],
      [a, e, g],
      [b, e, g],
      [b, e, f],
    ],
    [0, 1, 0],
    col,
  );
  Q(
    o,
    k,
    [
      [a, c, f],
      [b, c, f],
      [b, c, g],
      [a, c, g],
    ],
    [0, -1, 0],
    col,
  );
}
const shade = (k, v) => C[k].map((c) => clamp(c * v, 0, 1));
export const partEvidence = [];
export const apertureEvidence = [];
function chapelBody(o, lod) {
  const sizes = [
      [1.35, 0.7, 1.1],
      [0.9, 0.45, 0.75],
      [0.62, 0.3, 0.54],
      [0.36, 0.15, 0.32],
    ][lod],
    [dx, dy, dz] = sizes,
    tan = Math.tan((A.batterDegrees * Math.PI) / 180),
    rows = Math.ceil(A.survivingMaxHeightEstimate / dy);
  let bricks = 0;
  if (lod === 0) {
    const h = 3,
      w = A.baseWidth / 2,
      d = A.baseDepth / 2,
      W = w - h / tan,
      E = d - h / tan;
    Q(
      o,
      'earth',
      [
        [-w, 0, -d],
        [-W, h, -E],
        [W, h, -E],
        [w, 0, -d],
      ],
      [0, 0, -1],
    );
    for (const side of [-1, 1])
      Q(
        o,
        'earth',
        [
          [side * w, 0, -d],
          [side * w, 0, d],
          [side * W, h, E],
          [side * W, h, -E],
        ],
        [side, 0, 0],
      );
    for (const side of [-1, 1]) {
      const H = side < 0 ? 2.6 : 1.9,
        ww = w - H / tan,
        dd = d - H / tan;
      Q(
        o,
        'earth',
        [
          [side * w, 0, d],
          [side * 0.98, 0, d],
          [side * 0.98, H, dd],
          [side * ww, H, dd],
        ],
        [0, 0, 1],
      );
    }
    Q(
      o,
      'earth',
      [
        [-W, h, -E],
        [-W, h, E],
        [W, h, E],
        [W, h, -E],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'earth',
      [
        [-w, 0, -d],
        [w, 0, -d],
        [w, 0, d],
        [-w, 0, d],
      ],
      [0, -1, 0],
    );
  } else
    for (let j = 0; j < rows; j++) {
      const y = (j + 0.5) * dy,
        w = A.baseWidth / 2 - y / tan,
        d = A.baseDepth / 2 - y / tan;
      for (let z = -d + dz / 2; z < d; z += dz)
        for (let x = -w + dx / 2 + ((j % 2) * dx) / 2; x < w; x += dx) {
          const ww = Math.min(dx, w - x + dx / 2),
            dd = Math.min(dz, d - z + dz / 2),
            xx = x + (ww - dx) / 2,
            zz = z + (dd - dz) / 2;
          const top = 3.02 + 0.28 * Math.sin(xx * 3.7 + zz * 2.1) + 0.16 * Math.cos(zz * 5.1);
          if (y - dy / 2 > top) continue;
          // Remove every stock intersecting the actual room void; plaster intrados is separate geometry.
          const overlapsX = xx + ww / 2 > -0.83 && xx - ww / 2 < 0.83,
            overlapsZ = zz + dd / 2 > -1.53 && zz - dd / 2 < 1.53;
          const nearX = Math.max(0, Math.abs(xx) - ww / 2),
            ceiling =
              A.vaultSpringEstimate +
              Math.sqrt(Math.max(0, A.vaultRiseEstimate * A.vaultRiseEstimate - nearX * nearX));
          if (overlapsX && overlapsZ && y - dy / 2 < ceiling + 0.17) continue;
          // Keep the real rear niche void clear of the surrounding brick stocks.
          if (
            xx + ww / 2 > -A.nicheWidthEstimate / 2 &&
            xx - ww / 2 < A.nicheWidthEstimate / 2 &&
            zz + dd / 2 > -1.53 - A.nicheDepthEstimate - 0.04 &&
            zz - dd / 2 < -1.47 &&
            y + dy / 2 > 0.87 - A.nicheHeightEstimate / 2 &&
            y - dy / 2 < 0.87 + A.nicheHeightEstimate / 2
          )
            continue;
          // Missing front pyramid face/lintel and the photographed break along the near left vault.
          if (zz + dd / 2 > 1.02 && Math.abs(xx) < 1.06 && y - dy / 2 < 2.55) continue;
          if (xx < 0.12 && xx > -0.95 && zz > 0.02 && y > 1.9) continue;
          if (zz > 1 && xx > 0.9 && y > 1.9 + 0.22 * Math.sin(xx * 5)) continue;
          if (top - y + dy / 2 < 0.04) continue;
          const jolt = lod >= 2 ? 0.012 * Math.sin(xx * 19 + zz * 11 + j * 3) : 0;
          box(
            o,
            'earth',
            xx + jolt,
            y - 0.02,
            zz,
            Math.max(0.02, ww - (lod === 3 ? 0.012 : 0)),
            Math.min(dy - 0.008, top - y + dy / 2),
            Math.max(0.02, dd - (lod === 3 ? 0.012 : 0)),
            shade('earth', 0.96 + 0.065 * Math.sin(xx * 7 + zz * 9 + j)),
          );
          bricks++;
        }
    }
  // A complete floor, inner barrel vault and real rear stele niche remain at every level.
  box(o, 'rock', 0, -0.1, 0, 1.65, 0.2, 3.05);
  box(o, 'plaster', -0.815, 0.67, 0, 0.08, 1.36, 3.0);
  box(o, 'plaster', 0.815, 0.67, 0, 0.08, 1.36, 3.0);
  const ny = 0.87,
    nw = A.nicheWidthEstimate,
    nh = A.nicheHeightEstimate;
  for (const [a, b] of [
    [-0.8, -nw / 2],
    [nw / 2, 0.8],
  ])
    box(o, 'plaster', (a + b) / 2, 1.0, -1.53, b - a, 2, 0.12);
  box(o, 'plaster', 0, (ny - nh / 2) / 2, -1.53, nw, ny - nh / 2, 0.12);
  box(o, 'plaster', 0, (ny + nh / 2 + 2.05) / 2, -1.53, nw, 2.05 - ny - nh / 2, 0.12);
  box(o, 'earth', 0, ny, -1.53 - A.nicheDepthEstimate, nw, nh, 0.08);
  box(o, 'earth', -nw / 2 - 0.025, ny, -1.62, 0.05, nh, 0.18);
  box(o, 'earth', nw / 2 + 0.025, ny, -1.62, 0.05, nh, 0.18);
  box(o, 'earth', 0, ny - nh / 2 - 0.02, -1.62, nw, 0.04, 0.18);
  box(o, 'earth', 0, ny + nh / 2 + 0.02, -1.62, nw, 0.04, 0.18);
  const n = [6, 10, 16, 24][lod],
    zs = [-1.5, -0.75, 0, 0.5, 0.96];
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n,
        pa = [-0.8 * Math.cos(a), A.vaultSpringEstimate + 0.8 * Math.sin(a)],
        pb = [-0.8 * Math.cos(b), A.vaultSpringEstimate + 0.8 * Math.sin(b)];
      if (j >= 2 && i < n / 2 - 1) continue;
      // Close the rear wall to the surviving vault, above the flat niche wall.
      if (j === 0 && Math.max(pa[1], pb[1]) > 2.0) {
        let ra = [...pa],
          rb = [...pb];
        if (ra[1] < 2) ra = [ra[0] + ((rb[0] - ra[0]) * (2 - ra[1])) / (rb[1] - ra[1]), 2];
        if (rb[1] < 2) rb = [rb[0] + ((ra[0] - rb[0]) * (2 - rb[1])) / (ra[1] - rb[1]), 2];
        for (const [z, v] of [
          [-1.47, 1],
          [-1.59, -1],
        ]) {
          Q(
            o,
            'plaster',
            [
              [ra[0], 2, z],
              [rb[0], 2, z],
              [rb[0], rb[1], z],
              [ra[0], ra[1], z],
            ],
            [0, 0, v],
          );
        }
        Q(
          o,
          'plaster',
          [
            [ra[0], ra[1], -1.47],
            [rb[0], rb[1], -1.47],
            [rb[0], rb[1], -1.59],
            [ra[0], ra[1], -1.59],
          ],
          [0, 1, 0],
        );
      }
      Q(
        o,
        'plaster',
        [
          [pa[0], pa[1], zs[j]],
          [pb[0], pb[1], zs[j]],
          [pb[0], pb[1], zs[j + 1]],
          [pa[0], pa[1], zs[j + 1]],
        ],
        [0, -1, 0],
      );
      Q(
        o,
        'earth',
        [
          [pa[0] - 0.02 * Math.cos(a), pa[1] + 0.18, zs[j]],
          [pa[0] - 0.02 * Math.cos(a), pa[1] + 0.18, zs[j + 1]],
          [pb[0] - 0.02 * Math.cos(b), pb[1] + 0.18, zs[j + 1]],
          [pb[0] - 0.02 * Math.cos(b), pb[1] + 0.18, zs[j]],
        ],
        [0, 1, 0],
      );
      for (const [z, dir] of [
        [zs[j], -1],
        [zs[j + 1], 1],
      ])
        Q(
          o,
          'earth',
          [
            [pa[0], pa[1], z],
            [pa[0], pa[1] + 0.18, z],
            [pb[0], pb[1] + 0.18, z],
            [pb[0], pb[1], z],
          ],
          [0, 0, dir],
        );
    }
  // Loose wall-top remnants and worn plaster patches are original bounded estimates.
  if (lod >= 2) {
    for (const side of [-1, 1])
      for (let z = -1.2; z < 1.2; z += 0.4)
        box(o, 'earth', side * 1.1, 2.3 + 0.12 * Math.sin(z * 7), z, 0.38, 0.21, 0.3);
    for (let j = 0; j < 6; j++)
      box(
        o,
        'plaster',
        -1.9 + j * 0.08,
        0.3 + j * 0.15,
        0.3 + j * 0.16,
        0.045,
        0.2,
        0.4,
        shade('plaster', 0.93),
      );
  }
  apertureEvidence.push({
    part: 'chapel-entry-and-broken-vault',
    localOpening: [0, 1.05, 1.1],
    niche: { width: nw, height: nh, depth: A.nicheDepthEstimate },
    bricks,
  });
}
function courtSystem(o, lod) {
  const ring = P.court.localOutline,
    step = [10000, 1.5, 0.8, 0.42][lod],
    h = P.court.retainingHeightEstimate;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (i === 0) continue;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      n = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n,
        x = a[0] + dx * t,
        z = a[1] + dz * t,
        hh = h + 0.14 * Math.sin(i * 4 + j * 2.3);
      // Closed masonry stocks; the bend and each terrace edge remain represented.
      const along = len / n,
        w = P.court.wallThicknessEstimate,
        ca = dx / len,
        sa = dz / len;
      const r = [
        [-along / 2, -w / 2],
        [along / 2, -w / 2],
        [along / 2, w / 2],
        [-along / 2, w / 2],
      ].map(([u, v]) => [x + ca * u - sa * v, z + sa * u + ca * v]);
      for (let k = 0; k < 4; k++) {
        const p = r[k],
          q = r[(k + 1) % 4];
        Q(
          o,
          'rock',
          [
            [p[0], -0.8, p[1]],
            [q[0], -0.8, q[1]],
            [q[0], hh, q[1]],
            [p[0], hh, p[1]],
          ],
          [p[0] - x, 0, p[1] - z],
        );
      }
      Q(
        o,
        'rock',
        r.map((p) => [p[0], hh, p[1]]),
        [0, 1, 0],
      );
      Q(
        o,
        'rock',
        r.map((p) => [p[0], -0.8, p[1]]),
        [0, -1, 0],
      );
    }
  }
  // The reported side pit retains its real open void and only two surviving brick linings.
  const [x, z] = P.court.pitLocal,
    [w, d] = P.court.pitSize,
    deep = P.court.pitDepth;
  box(o, 'rock', x, -deep - 0.08, z, w, 0.16, d);
  for (const side of [-1, 1])
    box(o, 'rock', x + side * (w / 2 + 0.12), -deep / 2, z, 0.24, deep, d + 0.2);
  for (const side of [-1, 1])
    box(o, 'rock', x, -deep / 2, z + side * (d / 2 + 0.12), w, 0.24 + deep, 0.24);
  box(
    o,
    'earth',
    x + w / 2 - 0.04,
    -deep + P.court.survivingLiningHeight / 2,
    z,
    0.08,
    P.court.survivingLiningHeight,
    d,
  );
  box(
    o,
    'earth',
    x,
    -deep + P.court.survivingLiningHeight / 2,
    z + d / 2 - 0.04,
    w,
    P.court.survivingLiningHeight,
    0.08,
  );
}
function passage(o, a, b, w, h, floor, lod) {
  const t = D.wallThicknessEstimate,
    n = lod >= 2 ? Math.max(1, Math.ceil((b - a) / 1.3)) : 1;
  box(o, 'rock', 0, floor - 0.12, (a + b) / 2, w, 0.24, b - a);
  for (const s of [-1, 1])
    for (let j = 0; j < n; j++) {
      const z = a + ((j + 0.5) * (b - a)) / n;
      box(o, 'rock', s * (w / 2 + t / 2), floor + h / 2, z, t, h, (b - a) / n);
    }
  box(o, 'rock', 0, floor + h + 0.12, (a + b) / 2, w + 2 * t, 0.24, b - a);
}
function portal(o, z, w, W, h, H, floor) {
  const t = 0.16;
  for (const [a, b] of [
    [-W / 2, -w / 2],
    [w / 2, W / 2],
  ])
    box(o, 'rock', (a + b) / 2, floor + H / 2, z, b - a, H, t);
  if (H > h) box(o, 'rock', 0, floor + (H + h) / 2, z, w, H - h, t);
}
function hypogeumSystem(o, lod) {
  const sf = -D.shaftDropEstimate,
    bottom = -11.7,
    t = D.wallThicknessEstimate;
  box(o, 'rock', 0, sf - 0.12, 0, 2, 0.24, 2);
  for (const s of [-1, 1]) box(o, 'rock', s * (1 + t / 2), sf / 2, 0, t, -sf, 2 + 2 * t);
  box(o, 'rock', 0, sf / 2, -1 - t / 2, 2, -sf, t);
  box(o, 'rock', 0, (sf + D.firstHeightEstimate) / 2, 1 + t / 2, 2, -sf - D.firstHeightEstimate, t);
  const start = 1,
    end = start + D.stairGoingEstimate,
    N = lod === 0 ? 1 : lod === 1 ? 12 : D.stairRisersEstimate;
  if (lod === 0)
    Q(
      o,
      'rock',
      [
        [-0.875, sf, start],
        [0.875, sf, start],
        [0.875, bottom, end],
        [-0.875, bottom, end],
      ],
      [0, 1, 0],
    );
  else
    for (let j = 0; j < N; j++) {
      const a = start + (D.stairGoingEstimate * j) / N,
        b = start + (D.stairGoingEstimate * (j + 1)) / N,
        y = sf - (D.stairDropEstimate * (j + 1)) / N,
        prev = sf - (D.stairDropEstimate * j) / N;
      Q(
        o,
        'rock',
        [
          [-0.875, y, a],
          [0.875, y, a],
          [0.875, y, b],
          [-0.875, y, b],
        ],
        [0, 1, 0],
      );
      Q(
        o,
        'rock',
        [
          [-0.875, prev, a],
          [-0.875, y, a],
          [0.875, y, a],
          [0.875, prev, a],
        ],
        [0, 0, -1],
      );
    }
  // Full stair cheeks and its continuous overburden shell; no floating tunnel planes.
  for (const s of [-1, 1]) {
    const x = s * 0.875,
      X = s * (0.875 + t);
    for (let j = 0; j < N; j++) {
      const za = start + (D.stairGoingEstimate * j) / N,
        zb = start + (D.stairGoingEstimate * (j + 1)) / N,
        ya = sf - (D.stairDropEstimate * j) / N,
        yb = sf - (D.stairDropEstimate * (j + 1)) / N;
      Q(
        o,
        'rock',
        [
          [x, yb, za],
          [x, ya + D.firstHeightEstimate, za],
          [x, yb + D.firstHeightEstimate, zb],
          [x, yb, zb],
        ],
        [-s, 0, 0],
      );
    }
    Q(
      o,
      'rock',
      [
        [X, sf - 0.4, start],
        [X, bottom - 0.4, end],
        [X, bottom + D.firstHeightEstimate + 0.25, end],
        [X, sf + D.firstHeightEstimate + 0.25, start],
      ],
      [s, 0, 0],
    );
    Q(
      o,
      'rock',
      [
        [x, sf + D.firstHeightEstimate, start],
        [X, sf + D.firstHeightEstimate + 0.25, start],
        [X, bottom + D.firstHeightEstimate + 0.25, end],
        [x, bottom + D.firstHeightEstimate, end],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'rock',
      [
        [x, sf - 0.4, start],
        [x, bottom - 0.4, end],
        [X, bottom - 0.4, end],
        [X, sf - 0.4, start],
      ],
      [0, -1, 0],
    );
  }
  Q(
    o,
    'rock',
    [
      [-1.2, sf - 0.4, start],
      [1.2, sf - 0.4, start],
      [1.2, bottom - 0.4, end],
      [-1.2, bottom - 0.4, end],
    ],
    [0, -1, 0],
  );
  Q(
    o,
    'rock',
    [
      [-1.2, sf + D.firstHeightEstimate, start],
      [-1.2, bottom + D.firstHeightEstimate, end],
      [1.2, bottom + D.firstHeightEstimate, end],
      [1.2, sf + D.firstHeightEstimate, start],
    ],
    [0, -1, 0],
  );
  Q(
    o,
    'rock',
    [
      [-1.2, sf + D.firstHeightEstimate + 0.25, start],
      [1.2, sf + D.firstHeightEstimate + 0.25, start],
      [1.2, bottom + D.firstHeightEstimate + 0.25, end],
      [-1.2, bottom + D.firstHeightEstimate + 0.25, end],
    ],
    [0, 1, 0],
  );
  const a = end,
    b = a + D.firstCorridorLengthEstimate,
    c = b + D.throatLengthEstimate,
    d = c + D.antechamberLengthEstimate,
    e = d + D.doorNeckLengthEstimate;
  passage(o, a, b, D.firstWidthEstimate, D.firstHeightEstimate, bottom, lod);
  passage(o, b, c, D.throatWidthEstimate, D.firstHeightEstimate, bottom, lod);
  portal(
    o,
    b,
    D.throatWidthEstimate,
    D.firstWidthEstimate,
    D.firstHeightEstimate,
    D.firstHeightEstimate,
    bottom,
  );
  passage(o, c, d, D.antechamberWidthEstimate, D.antechamberHeightEstimate, bottom, lod);
  portal(
    o,
    c,
    D.throatWidthEstimate,
    D.antechamberWidthEstimate,
    D.firstHeightEstimate,
    D.antechamberHeightEstimate,
    bottom,
  );
  passage(o, d, e, D.doorWidthEstimate, D.doorHeightEstimate, bottom, lod);
  portal(
    o,
    d,
    D.doorWidthEstimate,
    D.antechamberWidthEstimate,
    D.doorHeightEstimate,
    D.antechamberHeightEstimate,
    bottom,
  );
  const left = D.chamberCenterXEstimate - D.chamberLengthAcross / 2,
    right = D.chamberCenterXEstimate + D.chamberLengthAcross / 2,
    far = e + D.chamberDepth,
    sp = D.chamberSpringEstimate,
    rise = D.chamberArchRiseEstimate;
  box(o, 'plaster', (left + right) / 2, bottom - 0.1, (e + far) / 2, right - left, 0.2, far - e);
  // Front chamber wall has an actual door-sized opening, including its lintel reveal.
  for (const [u, v] of [
    [left, -D.doorWidthEstimate / 2],
    [D.doorWidthEstimate / 2, right],
  ])
    box(o, 'plaster', (u + v) / 2, bottom + sp / 2, e - 0.12, v - u, sp, 0.24);
  box(
    o,
    'plaster',
    0,
    bottom + (D.doorHeightEstimate + sp) / 2,
    e - 0.12,
    D.doorWidthEstimate,
    sp - D.doorHeightEstimate,
    0.24,
  );
  box(o, 'plaster', (left + right) / 2, bottom + sp / 2, far + 0.12, right - left, sp, 0.24);
  const n = [4, 10, 18, 28][lod],
    curve = (u) => bottom + sp + rise * Math.sqrt(Math.max(0, 1 - (2 * u - 1) * (2 * u - 1)));
  for (let j = 0; j < n; j++) {
    const za = e + ((far - e) * j) / n,
      zb = e + ((far - e) * (j + 1)) / n,
      ya = curve(j / n),
      yb = curve((j + 1) / n);
    Q(
      o,
      'plaster',
      [
        [left, ya, za],
        [right, ya, za],
        [right, yb, zb],
        [left, yb, zb],
      ],
      [0, -1, 0],
    );
    Q(
      o,
      'rock',
      [
        [left - 0.24, ya + 0.24, za],
        [left - 0.24, yb + 0.24, zb],
        [right + 0.24, yb + 0.24, zb],
        [right + 0.24, ya + 0.24, za],
      ],
      [0, 1, 0],
    );
    for (const [x, s] of [
      [left, -1],
      [right, 1],
    ]) {
      Q(
        o,
        'plaster',
        [
          [x, bottom, za],
          [x, ya, za],
          [x, yb, zb],
          [x, bottom, zb],
        ],
        [-s, 0, 0],
      );
      Q(
        o,
        'rock',
        [
          [x + s * 0.24, bottom - 0.12, za],
          [x + s * 0.24, bottom - 0.12, zb],
          [x + s * 0.24, yb + 0.24, zb],
          [x + s * 0.24, ya + 0.24, za],
        ],
        [s, 0, 0],
      );
      Q(
        o,
        'rock',
        [
          [x, ya, za],
          [x + s * 0.24, ya + 0.24, za],
          [x + s * 0.24, yb + 0.24, zb],
          [x, yb, zb],
        ],
        [0, 1, 0],
      );
    }
  }
  apertureEvidence.push({
    part: 'complete-carved-access-and-T-chamber',
    shaftDrop: D.shaftDropEstimate,
    stairRisers: N,
    fullDrop: 11.7,
    corridorLength: e - end,
    chamberBounds: [left, right, e, far],
    doorWidth: D.doorWidthEstimate,
    doorHeight: D.doorHeightEstimate,
  });
}
export function buildKha(target, _frame, lod = 3) {
  space = 'chapel';
  partEvidence.length = 0;
  apertureEvidence.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
    },
    part = (id, fn) => {
      const start = count;
      fn();
      partEvidence.push({ id, triangles: count - start });
    };
  part('whole-ruined-mudbrick-pyramid-chapel-broken-vault-and-niche', () => chapelBody(o, lod));
  part('whole-bent-courtyard-retaining-walls-and-side-pit', () => courtSystem(o, lod));
  space = 'tomb';
  part('whole-carved-shaft-stair-two-corridors-neck-and-vaulted-chamber', () =>
    hypogeumSystem(o, lod),
  );
}
export const khaSkyline = (o) => buildKha(o, null, 0),
  khaDistrict = (o) => buildKha(o, null, 1),
  khaStreet = (o) => buildKha(o, null, 2),
  khaCloseup = (o) => buildKha(o, null, 3);
const cp = (q) => chapelPoint(q),
  tp = (q) => tombPoint(q),
  look = [0, Y.chapel - 3, -3];
export const khaModel = {
  id: 'tomb_of_kha_and_merit',
  key: 'tomb_of_kha_and_merit',
  cell: 'ss/ssx',
  title: 'Tomb and Chapel of Kha and Merit (TT8)',
  wikidataId: 'Q744424',
  category: 'funerary-architecture',
  recipe: 'kha-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildKha,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief:
    'WholepairedTT8funeraryarchitecture: ruinedsteepmudbrickpyramidchapel/brokenbarrelvault/wornplaster/niche, bentterracecourtyard/sidepit, separatecompletecarvedshaft/steepstairs/twocorridors/neck/asymmetrictransversevaultedburialroom. MuseumCC0Qualla-firstoriginals andprimarymetrictext; no intactpyramid/hillmesh/laterKenychapel/museumobjects. Historicalcirca1924interpretation,30mapproximatesiteregistration andestimatedhiddenprofiles.',
  appearance: {
    kind: 'historical',
    representedDate: '1924-12-31',
    validFrom: '1906-01-01',
    validUntil: '1938-12-31',
    currentWorldEligible: false,
  },
  camera: [37, 24, 37],
  lookAt: look,
  portableGroundY: Y.tunnel - 1,
  mediumFiContext: {
    scale: 1.2,
    groundY: Y.tunnel - 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 1800,
  },
  embeddedCanonicalGraphs: ['earth_adobe', 'stone_limestone_raw', 'plaster_lime'],
  groundCutout: {
    outline: P.physicalOutlines.chapel,
    outlines: [P.physicalOutlines.chapel, P.physicalOutlines.accessOpening, P.physicalOutlines.pit],
    additionalOutlines: [P.physicalOutlines.accessOpening, P.physicalOutlines.pit],
    basis:
      'Physicalchapel/accesswell/sidepitopeningsonly. Originalfieldretainedoverclosedundergroundcorridors/chamberandinsidecourtyard. No broadflatplazapad or chamber-wideopenpit.',
  },
  qaCameras: [
    { name: 'chapel-front-broken-vault', position: cp([0.6, 3.2, 8]), lookAt: cp([0, 1.3, 0.2]) },
    {
      name: 'inside-chapel-vault-and-stele-niche',
      position: cp([0, 1.15, 1.3]),
      lookAt: cp([0, 1.35, -1.3]),
    },
    { name: 'rock-cut-shaft-and-entry', position: tp([0.1, 9, -0.2]), lookAt: tp([0, -3.5, 0.3]) },
    {
      name: 'through-two-corridors-and-door-neck',
      position: tp([0, -10.6, 10]),
      lookAt: tp([0, -10.6, 25.2]),
    },
    {
      name: 'inside-asymmetric-burial-vault',
      position: tp([1, -10.4, 27.6]),
      lookAt: tp([-3.3, -10.4, 27.4]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-tt8-' + reviewLod,
    position: [37, 24, 37],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/ss/ssx/tomb_of_kha_and_merit/models/kha-model.mjs',
    level: 'skyline',
    export: 'khaSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'khaDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'khaStreet', errorMeters: 0.35, surfaces },
      closeup: { export: 'khaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [P.geometryBasis, P.sectionBasis, ...P.limits],
};
