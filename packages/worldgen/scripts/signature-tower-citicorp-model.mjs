/** Citicorp Center: elevated mid-face supports, south roof, church and renovated plaza. */
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  commonLimit,
  face,
  grid,
  guardrail,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const silver = [0.68, 0.7, 0.7],
  joint = [0.28, 0.32, 0.33],
  glass = [0.19, 0.31, 0.35],
  granite = [0.43, 0.43, 0.4];
const rect = (a, b, c, d) => [
  [a, b],
  [a, d],
  [c, d],
  [c, b],
];
const tower = { x0: -54.51, x1: -5.37, z0: -18.74, z1: 30.92, base: 35, roof: 242, top: 278.892 };
const plaza = rect(-69.8, -2.05, -34, 30.5);
function edges(p) {
  return clockwise(p).map((a, i, r) => [a, r[(i + 1) % r.length]]);
}
function skin(out, p, y0, y1, slot, color, pitch = 1.5, vertical = 3) {
  for (const [a, b] of edges(p)) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.round(l / pitch)),
      m = Math.max(1, Math.ceil((y1 - y0) / vertical));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        const u = i / n,
          v = (i + 1) / n,
          lo = y0 + ((y1 - y0) * j) / m,
          hi = y0 + ((y1 - y0) * (j + 1)) / m;
        const pt = (t, y) => [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
        const q = [pt(u, lo), pt(v, lo), pt(v, hi), pt(u, hi)];
        face(out, slot, q, color);
        beam(out, 'metal', q[0], q[1], 0.012, 0.014, joint);
        beam(out, 'metal', q[0], q[3], 0.012, 0.014, joint);
      }
  }
}
function slopedCap(out, p, height, slot, color) {
  for (const ids of ShapeUtils.triangulateShape(
    p.map((v) => new Vector2(...v)),
    [],
  )) {
    let q = ids.map((i) => [p[i][0], height(...p[i]), p[i][1]]);
    const ay = q[1][2] - q[0][2],
      ax = q[1][0] - q[0][0],
      bx = q[2][0] - q[0][0],
      by = q[2][2] - q[0][2];
    if (ay * bx - ax * by < 0) q = q.toReversed();
    tri(out, slot, q, color);
  }
}
function roof(out) {
  const t = tower,
    highZ = -15.35,
    lowZ = highZ + t.top - t.roof;
  const h = (_x, z) => (z < highZ ? t.top : z > lowZ ? t.roof : t.top - (z - highZ));
  const p = rect(t.x0, t.z0, t.x1, t.z1);
  for (const [a, b] of edges(p)) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      cols = Math.ceil(length / 1.5);
    for (let i = 0; i < cols; i++) {
      const a0 = [a[0] + ((b[0] - a[0]) * i) / cols, a[1] + ((b[1] - a[1]) * i) / cols],
        b0 = [a[0] + ((b[0] - a[0]) * (i + 1)) / cols, a[1] + ((b[1] - a[1]) * (i + 1)) / cols];
      if (Math.max(h(...a0), h(...b0)) <= t.roof + 0.01) continue;
      let y = t.roof;
      while (y < Math.max(h(...a0), h(...b0)) - 0.01) {
        const ya = Math.min(y + 1.5, h(...a0)),
          yb = Math.min(y + 1.5, h(...b0));
        if (ya <= y && yb <= y) break;
        const q = [
          [a0[0], Math.min(y, h(...a0)), a0[1]],
          [b0[0], Math.min(y, h(...b0)), b0[1]],
          [b0[0], yb, b0[1]],
          [a0[0], ya, a0[1]],
        ];
        const northRecess =
          Math.abs(a0[1] - t.z0) < 0.001 && Math.abs(b0[1] - t.z0) < 0.001 && i > 0 && i < cols - 1;
        if (northRecess) {
          for (const v of q) v[2] += 0.45;
          if (i === 1)
            face(
              out,
              'metal',
              [
                [a0[0], y, t.z0],
                [a0[0], y, t.z0 + 0.45],
                [a0[0], ya, t.z0 + 0.45],
                [a0[0], ya, t.z0],
              ],
              silver,
            );
          if (i === cols - 2)
            face(
              out,
              'metal',
              [
                [b0[0], y, t.z0 + 0.45],
                [b0[0], y, t.z0],
                [b0[0], yb, t.z0],
                [b0[0], yb, t.z0 + 0.45],
              ],
              silver,
            );
          if (y === t.roof)
            face(
              out,
              'metal',
              [
                [a0[0], y, t.z0],
                [b0[0], y, t.z0],
                [b0[0], y, t.z0 + 0.45],
                [a0[0], y, t.z0 + 0.45],
              ],
              silver,
            );
        }
        const clean = q.filter(
          (v, k) => k === 0 || Math.hypot(...v.map((x, j) => x - q[k - 1][j])) > 0.0001,
        );
        if (clean.length > 2) {
          if (clean.length === 4 && Math.hypot(...clean[3].map((v, j) => v - clean[0][j])) < 0.0001)
            clean.pop();
          if (clean.length === 3) tri(out, 'metal', clean, silver);
          else face(out, 'metal', clean, silver);
          beam(out, 'metal', q[0], q[1], 0.018, 0.018, joint);
          if (Math.hypot(...q[3].map((v, k) => v - q[0][k])) > 0.001)
            beam(out, 'metal', q[0], q[3], 0.018, 0.018, joint);
        }
        y += 1.5;
      }
    }
  }
  // The shallow level strips at both ends are distinct from the 45-degree solar-profile slope.
  for (const [z0, z1] of [
    [t.z0, highZ],
    [highZ, lowZ],
    [lowZ, t.z1],
  ]) {
    const nx = 33,
      nz = Math.max(1, Math.ceil((z1 - z0) / 1.5));
    for (let x = 0; x < nx; x++)
      for (let z = 0; z < nz; z++) {
        const x0 = t.x0 + ((t.x1 - t.x0) * x) / nx,
          x1 = t.x0 + ((t.x1 - t.x0) * (x + 1)) / nx,
          a = z0 + ((z1 - z0) * z) / nz,
          b = z0 + ((z1 - z0) * (z + 1)) / nz;
        const q = [
          [x0, h(x0, a), a],
          [x0, h(x0, b), b],
          [x1, h(x1, b), b],
          [x1, h(x1, a), a],
        ];
        face(out, 'metal', q, silver);
        beam(out, 'metal', q[0], q[1], 0.014, 0.018, joint);
        beam(out, 'metal', q[0], q[3], 0.014, 0.018, joint);
      }
  }
  // East-side mechanical openings recorded by LPC; shallow dark louvers retain a closed enclosure.
  for (const [y, z0, z1] of [
    [249, -13, 7],
    [258, -13, -1.5],
  ]) {
    face(
      out,
      'recess',
      [
        [t.x1 + 0.02, y, z1],
        [t.x1 + 0.02, y, z0],
        [t.x1 + 0.02, y + 1.2, z0],
        [t.x1 + 0.02, y + 1.2, z1],
      ],
      joint,
    );
    for (let dy = 0.14; dy < 1.2; dy += 0.18)
      beam(out, 'metal', [t.x1 + 0.05, y + dy, z0], [t.x1 + 0.05, y + dy, z1], 0.1, 0.07, silver);
  }
  for (const x of [-46, -34, -22, -10]) {
    tube(out, 'metal', [x, t.top, -17], [x, t.top + 1.7, -17], 0.035, silver, 8);
    box(out, 'metal', [x - 0.22, t.top, -17.4], [x + 0.22, t.top + 0.4, -16.6], joint);
  }
}
function shaft(out, m, parts) {
  const t = tower,
    p = rect(t.x0, t.z0, t.x1, t.z1),
    pitch = (t.roof - 43.5) / 50;
  skin(out, p, t.base, 43.5, 'metal', silver, 1.5, 4.25);
  for (const [a, b] of edges(p)) {
    for (let row = 0; row < 50; row++) {
      const y = 43.5 + row * pitch,
        split = y + 1.85;
      grid(
        out,
        [
          [a[0], split, a[1]],
          [b[0], split, b[1]],
          [b[0], y + pitch, b[1]],
          [a[0], y + pitch, a[1]],
        ],
        glass,
        1.5,
        pitch,
        0.035,
        silver,
        'metal',
      );
    }
  }
  for (let row = 0; row < 50; row++) {
    const y = 43.5 + row * pitch;
    skin(out, p, y, y + 1.85, 'metal', silver, 1.5, 1.85);
  }
  mappedCap(out, 'metal', p, t.base, [0.38, 0.4, 0.4], [], true);
  for (let x = t.x0 + 1.5; x < t.x1; x += 1.5)
    beam(out, 'metal', [x, t.base - 0.012, t.z0], [x, t.base - 0.012, t.z1], 0.015, 0.015, joint);
  for (let z = t.z0 + 1.5; z < t.z1; z += 1.5)
    beam(out, 'metal', [t.x0, t.base - 0.012, z], [t.x1, t.base - 0.012, z], 0.015, 0.015, joint);
  for (const id of [258744594, 258744595, 258744596, 258744600]) {
    const q = partPlan(
        m,
        parts.find((v) => v.id === id),
      ),
      xs = q.map((v) => v[0]),
      zs = q.map((v) => v[1]),
      cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cz = (Math.min(...zs) + Math.max(...zs)) / 2,
      r = 7.3152 / 2;
    const footprint = rect(cx - r, cz - r, cx + r, cz + r);
    skin(out, footprint, id === 258744595 ? -3.81 : 0, t.base, 'metal', silver, 1.22, 3.81);
    mappedCap(out, 'metal', footprint, t.base, silver);
  }
  const core = partPlan(
    m,
    parts.find((v) => v.id === 258744612),
  );
  skin(out, core, 0, t.base, 'metal', silver, 1.5, 3.5);
  mappedCap(out, 'metal', core, t.base, silver);
  roof(out);
}
function curtain(out, p, height, ground = 0) {
  for (const [a, b] of edges(p))
    grid(
      out,
      [
        [a[0], ground + 0.06, a[1]],
        [b[0], ground + 0.06, b[1]],
        [b[0], height - 0.65, b[1]],
        [a[0], height - 0.65, a[1]],
      ],
      glass,
      1.48,
      3.9,
      0.12,
      silver,
      'metal',
    );
  mappedSolid(out, 'metal', p, height - 0.65, height, silver);
}
function market(out, m, parts) {
  for (const id of [258744591, 258744601, 258744602, 258744603, 258744608, 258744606]) {
    const item = parts.find((p) => p.id === id),
      p = partPlan(m, item),
      height = Number(item.tags.height);
    curtain(out, p, height);
    guardrail(
      out,
      p.map(([x, z]) => [x, height + 0.05, z]),
      1.05,
      silver,
    );
    // Parallel narrow garden terraces at the west end remain distinct from the tall office block.
    if ([258744601, 258744602, 258744603, 258744608].includes(id)) {
      const x = (Math.min(...p.map((v) => v[0])) + Math.max(...p.map((v) => v[0]))) / 2;
      for (let z = -26; z < 29; z += 5.5) {
        box(out, 'stone', [x - 0.6, height, -0.5 + z], [x + 0.6, height + 0.45, z + 2], granite);
        box(
          out,
          'foliage',
          [x - 0.53, height + 0.45, z - 0.4],
          [x + 0.53, height + 0.88, z + 1.9],
          [0.17, 0.26, 0.13],
        );
      }
    }
  }
  for (const id of [258744593, 258744597, 258744599]) {
    const p = partPlan(
        m,
        parts.find((q) => q.id === id),
      ),
      x0 = Math.min(...p.map((v) => v[0])),
      x1 = Math.max(...p.map((v) => v[0])),
      z0 = Math.min(...p.map((v) => v[1])),
      z1 = Math.max(...p.map((v) => v[1])),
      mid = (z0 + z1) / 2;
    for (const z of [z0, z1])
      grid(
        out,
        [
          [x0, 26, z],
          [x1, 26, z],
          [x1, 28, mid],
          [x0, 28, mid],
        ],
        glass,
        1.5,
        2,
        0.055,
        silver,
        'metal',
      );
    for (const [x, rev] of [
      [x0, true],
      [x1, false],
    ]) {
      const q = [
        [x, 26, z0],
        [x, 26, z1],
        [x, 28, mid],
      ];
      tri(out, 'glass', rev ? q.toReversed() : q, glass);
    }
  }
  // Small grounded shop portals on 53rd and54th Streets, each with an actual door and canopy.
  for (const z of [-30.98, 30.98])
    for (const x of [-1, 9, 19]) {
      box(out, 'metal', [x - 1.6, 0, z - 0.07], [x + 1.6, 3.1, z + 0.07], joint);
      const sign = Math.sign(z);
      face(
        out,
        'clear_glass',
        [
          [x - 1.5, 0, z + sign * 0.09],
          [x + 1.5, 0, z + sign * 0.09],
          [x + 1.5, 3, z + sign * 0.09],
          [x - 1.5, 3, z + sign * 0.09],
        ],
        glass,
      );
      tube(out, 'metal', [x, 0, z + sign * 0.12], [x, 3, z + sign * 0.12], 0.035, silver, 8);
      box(out, 'metal', [x - 1.9, 3.15, z - 0.8], [x + 1.9, 3.3, z + 0.8], silver);
    }
}
function church(out, m, parts) {
  for (const id of [258744604, 258744607]) {
    const p = partPlan(
        m,
        parts.find((q) => q.id === id),
      ),
      vals = p.map((v) => v[0] + v[1]),
      low = Math.min(...vals),
      high = Math.max(...vals),
      h = (x, z) =>
        id === 258744604
          ? 7.5 + (8 * (x + z - low)) / (high - low)
          : 17 - (8 * (x + z - low)) / (high - low);
    for (const [a, b] of edges(p)) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = Math.ceil(length / 1.4);
      for (let i = 0; i < nx; i++) {
        const A = [a[0] + ((b[0] - a[0]) * i) / nx, a[1] + ((b[1] - a[1]) * i) / nx],
          B = [a[0] + ((b[0] - a[0]) * (i + 1)) / nx, a[1] + ((b[1] - a[1]) * (i + 1)) / nx];
        const entrance = id === 258744604 && a[0] < -69 && b[0] < -69 && i >= 3 && i <= 5;
        face(
          out,
          'stone',
          [
            [A[0], entrance ? 3.4 : 0, A[1]],
            [B[0], entrance ? 3.4 : 0, B[1]],
            [B[0], h(...B), B[1]],
            [A[0], h(...A), A[1]],
          ],
          granite,
        );
        if (entrance) {
          grid(
            out,
            [
              [A[0] + 0.12, 0, A[1]],
              [B[0] + 0.12, 0, B[1]],
              [B[0] + 0.12, 3.4, B[1]],
              [A[0] + 0.12, 3.4, A[1]],
            ],
            [0.15, 0.22, 0.2],
            1.3,
            3.4,
            0.06,
            silver,
            'metal',
          );
          face(
            out,
            'stone',
            [
              [A[0], 3.4, A[1]],
              [A[0] + 0.12, 3.4, A[1]],
              [B[0] + 0.12, 3.4, B[1]],
              [B[0], 3.4, B[1]],
            ],
            granite,
          );
          if (i === 3)
            face(
              out,
              'stone',
              [
                [A[0], 0, A[1]],
                [A[0] + 0.12, 0, A[1]],
                [A[0] + 0.12, 3.4, A[1]],
                [A[0], 3.4, A[1]],
              ],
              granite,
            );
          if (i === 5)
            face(
              out,
              'stone',
              [
                [B[0] + 0.12, 0, B[1]],
                [B[0], 0, B[1]],
                [B[0], 3.4, B[1]],
                [B[0] + 0.12, 3.4, B[1]],
              ],
              granite,
            );
          tube(
            out,
            'metal',
            [(A[0] + B[0]) / 2 + 0.04, 0.8, (A[1] + B[1]) / 2],
            [(A[0] + B[0]) / 2 + 0.04, 1.5, (A[1] + B[1]) / 2],
            0.027,
            silver,
            8,
          );
        }
        for (let y = entrance ? 3.85 : 0.6; y < Math.min(h(...A), h(...B)); y += 0.65)
          beam(out, 'metal', [A[0], y, A[1]], [B[0], y, B[1]], 0.012, 0.014, [0.32, 0.32, 0.3]);
        beam(
          out,
          'metal',
          [A[0], entrance ? 3.4 : 0, A[1]],
          [A[0], h(...A), A[1]],
          0.012,
          0.014,
          [0.32, 0.32, 0.3],
        );
      }
      beam(
        out,
        'stone',
        [a[0], h(...a) + 0.06, a[1]],
        [b[0], h(...b) + 0.06, b[1]],
        0.25,
        0.22,
        [0.56, 0.55, 0.49],
      );
    }
    slopedCap(out, p, h, 'stone', granite);
    if (id === 258744604) {
      const center = p.reduce((s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length], [0, 0]);
      for (const [a, b] of edges(p))
        if (Math.abs(h(...a) - h(...b)) > 2) {
          const inset = (v) => {
              const dx = center[0] - v[0],
                dz = center[1] - v[1],
                len = Math.hypot(dx, dz);
              return [v[0] + (dx * 0.7) / len, v[1] + (dz * 0.7) / len];
            },
            aa = inset(a),
            bb = inset(b);
          const q = [a, b, bb, aa].map(([x, z]) => [x, h(x, z) + 0.035, z]);
          const area =
            (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]);
          face(out, 'glass', area < 0 ? q.toReversed() : q, glass);
          const n = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 1.25);
          for (let i = 0; i <= n; i++) {
            const v = i / n,
              x = a[0] + (b[0] - a[0]) * v,
              z = a[1] + (b[1] - a[1]) * v,
              xx = aa[0] + (bb[0] - aa[0]) * v,
              zz = aa[1] + (bb[1] - aa[1]) * v;
            beam(
              out,
              'metal',
              [x, h(x, z) + 0.07, z],
              [xx, h(xx, zz) + 0.07, zz],
              0.05,
              0.065,
              silver,
            );
          }
        }
    }
    for (let i = 1; i < 16; i++) {
      const z = -31 + i * 1.4,
        intersections = [];
      for (const [a, b] of edges(p))
        if ((a[1] <= z && b[1] > z) || (b[1] <= z && a[1] > z)) {
          const f = (z - a[1]) / (b[1] - a[1]);
          intersections.push(a[0] + (b[0] - a[0]) * f);
        }
      intersections.sort((a, b) => a - b);
      for (let j = 0; j + 1 < intersections.length; j += 2) {
        const a = intersections[j],
          b = intersections[j + 1];
        beam(out, 'metal', [a, h(a, z) + 0.012, z], [b, h(b, z) + 0.012, z], 0.012, 0.014, joint);
      }
    }
  }
  const skylight = partPlan(
    m,
    parts.find((q) => q.id === 258744598),
  );
  const sy = (x, z) => 15.5 + 1.5 * Math.max(0, Math.min(1, (x + z + 82.76) / 4.56));
  slopedCap(out, skylight, sy, 'glass', glass);
  for (const [a, b] of edges(skylight))
    beam(out, 'metal', [a[0], sy(...a), a[1]], [b[0], sy(...b), b[1]], 0.07, 0.08, silver);
  for (let i = 1; i < 16; i++) {
    const a = [-52.032 + ((-67.949 + 52.032) * i) / 16, -30.804 + ((-14.729 + 30.804) * i) / 16],
      b = [a[0] + 2.25, a[1] + 2.28];
    beam(out, 'metal', [a[0], sy(...a), a[1]], [b[0], sy(...b), b[1]], 0.055, 0.065, silver);
  }
  curtain(
    out,
    partPlan(
      m,
      parts.find((q) => q.id === 258744610),
    ),
    7,
  );
  const lobby = partPlan(
    m,
    parts.find((q) => q.id === 258744611),
  );
  curtain(out, lobby, 7);
  // Bronze abstract cross adjacent to the Lexington/54th-Street corner.
  beam(out, 'metal', [-70.55, 0, -24], [-70.55, 7.4, -24], 0.16, 0.22, [0.24, 0.18, 0.12]);
  beam(out, 'metal', [-70.55, 5.4, -25.35], [-70.55, 5.4, -22.65], 0.16, 0.22, [0.24, 0.18, 0.12]);
}
function bench(out, x, z, angle = 0) {
  const point = (u, y, v) => [
    x + u * Math.cos(angle) + v * Math.sin(angle),
    y,
    z - u * Math.sin(angle) + v * Math.cos(angle),
  ];
  for (let i = 0; i < 7; i++)
    beam(
      out,
      'wood',
      point(-1.5, -3.28, -0.3 + i * 0.1),
      point(1.5, -3.28, -0.3 + i * 0.1),
      0.075,
      0.075,
      [0.43, 0.27, 0.13],
    );
  for (const u of [-1.15, 1.15])
    beam(out, 'metal', point(u, -3.8, 0), point(u, -3.3, 0), 0.11, 0.14, silver);
}
function sunkenPlaza(out) {
  const floor = -3.81;
  mappedSolid(out, 'stone', plaza, floor - 0.2, floor, granite);
  for (const [a, b] of edges(plaza)) {
    face(
      out,
      'stone',
      [
        [a[0], floor, a[1]],
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], floor, b[1]],
      ],
      [0.34, 0.35, 0.32],
    );
    beam(out, 'stone', [a[0], 0.09, a[1]], [b[0], 0.09, b[1]], 0.4, 0.3, granite);
  }
  for (let x = -69; x < -34; x += 1.3)
    beam(
      out,
      'metal',
      [x, floor + 0.006, -2],
      [x, floor + 0.006, 30.4],
      0.008,
      0.012,
      [0.3, 0.31, 0.29],
    );
  for (let z = -1; z < 30; z += 1.3)
    beam(
      out,
      'metal',
      [-69.7, floor + 0.006, z],
      [-34.1, floor + 0.006, z],
      0.008,
      0.012,
      [0.3, 0.31, 0.29],
    );
  // Broad53rd-Street descent. Each tread has a closed riser and joined handrails.
  const n = 23,
    run = 10.4,
    z0 = 20.1;
  for (let i = 0; i < n; i++) {
    const y = floor + (i + 1) * (-floor / n);
    box(
      out,
      'stone',
      [-48, floor - 0.1, z0 + (run * i) / n],
      [-34.02, y, z0 + (run * (i + 1)) / n],
      granite,
    );
  }
  for (const x of [-47.8, -41, -34.2]) {
    tube(out, 'stainless', [x, floor + 1, z0], [x, 1, z0 + run], 0.034, silver, 8);
    for (let i = 0; i <= n; i += 4) {
      const z = z0 + (run * i) / n,
        y = floor + (-floor * i) / n;
      tube(out, 'stainless', [x, y, z], [x, y + 1, z], 0.029, silver, 8);
    }
  }
  // A second landing and flight connects the church lobby to the lower north portion.
  for (let i = 0; i < 8; i++)
    box(
      out,
      'stone',
      [-65, floor - 0.1, -2 + i * 0.4],
      [-53, floor + 0.145 * (8 - i), -1.6 + i * 0.4],
      granite,
    );
  for (const [x, z] of [
    [-62, 8],
    [-54, 11],
    [-62, 19],
    [-52, 17],
  ]) {
    box(
      out,
      'stone',
      [x - 1.1, floor, z - 1.1],
      [x + 1.1, floor + 0.3, z + 1.1],
      [0.38, 0.38, 0.34],
    );
    tube(out, 'metal', [x, floor + 0.3, z], [x, 1.4, z], 0.085, [0.26, 0.19, 0.11], 9);
    for (let k = 0; k < 7; k++) {
      const a = k * 2.399;
      const end = [x + 1.3 * Math.cos(a), 1 + (k % 3) * 0.48, z + 1.3 * Math.sin(a)];
      tube(out, 'metal', [x, -0.9, z], end, 0.037, [0.26, 0.19, 0.11], 7);
      sphere(out, 'foliage', end, [1.5, 0.65, 1.2], [0.23, 0.31, 0.12], 12, 8);
    }
  }
  for (const [x, z] of [
    [-66, 5],
    [-66, 15],
    [-54, 3],
    [-50, 10],
    [-58, 24],
  ])
    bench(out, x, z);
  for (const [x, z] of [
    [-58, 8],
    [-59, 15],
    [-53, 22],
  ]) {
    loft(
      out,
      'wood',
      [
        radialRing(floor + 0.77, 0.7, 0.7, 36).map((p) => [p[0] + x, p[1], p[2] + z]),
        radialRing(floor + 0.84, 0.7, 0.7, 36).map((p) => [p[0] + x, p[1], p[2] + z]),
      ],
      [0.5, 0.36, 0.2],
    );
    tube(out, 'metal', [x, floor, z], [x, floor + 0.8, z], 0.065, silver, 8);
    for (const a of [0, Math.PI]) {
      const cx = x + 1.2 * Math.cos(a),
        cz = z + 1.2 * Math.sin(a);
      box(
        out,
        'metal',
        [cx - 0.25, floor + 0.45, cz - 0.25],
        [cx + 0.25, floor + 0.51, cz + 0.25],
        silver,
      );
      for (const dx of [-0.2, 0.2])
        for (const dz of [-0.2, 0.2])
          tube(
            out,
            'metal',
            [cx + dx, floor, cz + dz],
            [cx + dx, floor + 0.45, cz + dz],
            0.02,
            silver,
            6,
          );
    }
  }
  for (const [x, z] of [
    [-67, 4],
    [-67, 24],
    [-49, 15],
  ]) {
    tube(out, 'metal', [x, floor, z], [x, 0.3, z], 0.055, joint, 8);
    loft(
      out,
      'glass',
      [
        radialRing(0.3, 0.1, 0.1, 12).map((p) => [p[0] + x, p[1], p[2] + z]),
        radialRing(0.8, 0.1, 0.1, 12).map((p) => [p[0] + x, p[1], p[2] + z]),
      ],
      [0.83, 0.82, 0.62],
    );
  }
  // Street balustrade is attached to the retaining wall; steps retain an open entry.
  guardrail(
    out,
    [
      [-69.8, 0.1, -2.05],
      [-69.8, 0.1, 30.5],
      [-48.1, 0.1, 30.5],
    ],
    1.05,
    silver,
  );
}
export function buildCiticorp(out, m) {
  const parts = partsEvidence('n0198_citigroup_center');
  shaft(out, m, parts);
  market(out, m, parts);
  church(out, m, parts);
  sunkenPlaza(out);
}
export const citicorpStudy = {
  id: 'N0198',
  key: 'citigroup_center',
  wikidataId: 'Q391243',
  title: 'Citigroup Center',
  height: 278.892,
  previewGround: false,
  build: buildCiticorp,
  brief:
    'Detailed original Citicorp/601 Lexington exterior with four face-centered supercolumns and octagonal core, silver ribbon shaft, south-facing45-degree roof, separately modeled Saint Peters Church, stepped market and current sunken plaza.',
  sourceFacts: {
    architect: 'Hugh Stubbins and Associates with Emery Roth and Sons',
    completed: 1977,
    heightFeet: 915,
    heightMeters: 278.892,
    supercolumns: 4,
    columnWidthMeters: 7.3152,
    roofSlopeDegrees: 45,
    renovation: 'Gensler plaza and six-story market repositioning; completed2021',
  },
  reconstruction: {
    tower:
      'Independent mapped upper envelope retained above35m open underside. Fifty photographed office ribbon rows above the deeper transfer fascia; module datums are original reconstruction, not a floor-number survey. Hidden structural V braces remain enclosed.',
    roof: '915ft architectural peak, south-facing45-degree plane and flat end strips; two east louver slots and north antenna details follow LPC descriptions.',
    base: 'Independent mid-face columns, octagonal core, diagonally divided granite church, stepped market terraces and skylights.2019 LPC plan and2023 architect photograph guide the southwest sunken plaza.',
  },
  refs: [
    'https://s-media.nyc.gov/agencies/lpc/lp/2582.pdf',
    'https://www.nyc.gov/assets/lpc/downloads/pdf/presentation-materials/20190716/601-Lexington-Avenue.pdf',
    'https://www.gensler.com/blog/office-to-everything-a-new-path-for-revitalizing-downtowns',
    'https://www.bxp.com/properties/601-lexington-avenue',
    'https://www.saintpeters.org/the-space',
    'https://www.openstreetmap.org/way/164105516',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X towardThird Avenue/east-southeast',
    shortAxis: '+Z toward53rd Street/south-southwest',
  },
  geographic: (m) => ({
    heading: m.heading,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the53rd-Street entry and supercolumn datum. The intended lower plaza at−3.81m follows the2019 LPC plan lower-plaza−12ft6in level; closed retaining walls and steps surround its terrain cutout.',
    groundCutout: {
      outline: plaza,
      basis:
        'Cut only the documented southwest sunken plaza, enclosed by the retaining walls and closed stair risers; surrounding streets and tower contact piers remain grounded.',
    },
    notes:
      'Exact-QID whole-complex anchor and separately mapped roof, columns, core, church and market parts retain their signed street frame. Native+Z points toward53rd Street, fixing the LPC south-facing roof; the church occupies the northwest corner and the plaza the southwest. The independent raised tower projection is never treated as a solid ground footprint.',
  }),
  limitations: [
    commonLimit,
    'Fine ribbon and aluminum panel spacing, mechanical-slot dimensions, church roof planes, entrance glazing and plaza furniture are reconstructed from primary drawings and completed photographs. The documented−12ft6in lower-plaza level is retained; detailed street gradient and second landing are approximated. Temporary tenant signage, hidden structural braces, interior fit-out and neighboring880ThirdAvenue are excluded.',
  ],
  camera: { position: [290, 190, 320], lookAt: [-12, 133, 0], fov: 42 },
  qaCameras: [
    { name: 'silver-ribbon-facade', position: [-101, 166, 70], lookAt: [-50, 155, 8] },
    { name: 'flush-window-detail', position: [-68, 126, 8], lookAt: [-54, 123, 6] },
    { name: 'south-sloping-roof', position: [54, 296, 84], lookAt: [-28, 259, 5] },
    { name: 'east-roof-slots', position: [35, 270, 2], lookAt: [-6, 258, 0] },
    { name: 'north-roof-strip', position: [-84, 300, -61], lookAt: [-30, 276, -15] },
    { name: 'open-midface-supports', position: [-107, 18, 78], lookAt: [-30, 25, 3] },
    { name: 'column-panel-close', position: [-66, 12, 17], lookAt: [-51, 16, 6] },
    { name: 'cantilever-soffit', position: [-60, 18, 26], lookAt: [-35, 34, 8] },
    { name: 'church-granite-wedges', position: [-94, 19, -47], lookAt: [-60, 8, -21] },
    { name: 'church-skylight', position: [-73, 24, -18], lookAt: [-59, 15, -22] },
    { name: 'stepped-market-gardens', position: [-31, 43, 69], lookAt: [0, 19, 3] },
    { name: 'market-skylights', position: [32, 46, 39], lookAt: [3, 27, 5] },
    { name: 'sunken-plaza-overview', position: [-92, 20, 45], lookAt: [-53, -1, 12] },
    { name: 'plaza-steps-and-benches', position: [-48, 3, 28], lookAt: [-61, -2, 10] },
    { name: 'far-midtown-profile', position: [310, 112, 360], lookAt: [-15, 137, 0] },
  ],
};
