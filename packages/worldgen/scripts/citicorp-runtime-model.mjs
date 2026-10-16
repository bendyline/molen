/** Reviewed Citigroup browser levels; original detailed recipe remains unchanged. */

import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  mappedCap,
  mappedSolid,
  partPlan as originalPartPlan,
  partsEvidence,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0198_citigroup_center', 'map-frame.json')),
);
function render(out, m) {
  const detail = out.detail;
  function partPlan(m, p) {
    const plan = originalPartPlan(m, p);
    return plan.filter((v, i) => {
      const a = plan[(i + plan.length - 1) % plan.length],
        b = plan[(i + 1) % plan.length],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return (
        l < 0.001 ||
        Math.abs((v[0] - a[0]) * (b[1] - a[1]) - (v[1] - a[1]) * (b[0] - a[0])) / l > 0.025
      );
    });
  }

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
  function stripe(out, slot, a, b, width, color, n = [0, 0, 0]) {
    const d = b.map((x, i) => x - a[i]),
      len = Math.hypot(...d);
    if (len < 0.0001) return;
    const v = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]].map(
      (x) => (x * width) / (2 * len),
    );
    const pt = (p, k) => p.map((x, i) => x + v[i] * k + n[i] * 0.018);
    face(out, slot, [pt(a, -1), pt(b, -1), pt(b, 1), pt(a, 1)], color);
  }
  function grid(out, q, color, pitch, vertical, width, trim, slot) {
    if (!(detail.rowStep > 1 && q[0][1] > 43.5 && q[2][1] <= 242)) face(out, 'glass', q, color);
    if (!detail.frames) return;
    const du = q[1].map((x, i) => x - q[0][i]),
      dv = q[3].map((x, i) => x - q[0][i]);
    const cross = [
        du[1] * dv[2] - du[2] * dv[1],
        du[2] * dv[0] - du[0] * dv[2],
        du[0] * dv[1] - du[1] * dv[0],
      ],
      l = Math.hypot(...cross),
      n = cross.map((x) => x / l);
    const nu = Math.max(1, Math.round(Math.hypot(...du) / (pitch * detail.moduleStep))),
      nv = Math.max(1, Math.ceil(Math.hypot(...dv) / vertical));
    for (let i = 0; i <= nu; i++) {
      const t = i / nu;
      stripe(
        out,
        slot,
        q[0].map((x, k) => x + du[k] * t),
        q[3].map((x, k) => x + (q[2][k] - q[3][k]) * t),
        width,
        trim,
        n,
      );
    }
    for (let j = 0; j <= nv; j++) {
      const t = j / nv;
      stripe(
        out,
        slot,
        q[0].map((x, k) => x + dv[k] * t),
        q[1].map((x, k) => x + (q[2][k] - q[1][k]) * t),
        width,
        trim,
        n,
      );
    }
  }
  function guardrail(out, points, height, color, closed = false) {
    for (let i = 0; i < points.length - 1 + (closed ? 1 : 0); i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if (detail.flatGuards) {
        const q = [
          a,
          b,
          b.map((x, k) => x + (k === 1 ? height : 0)),
          a.map((x, k) => x + (k === 1 ? height : 0)),
        ];
        face(out, 'metal', q, color);
        face(out, 'metal', q.toReversed(), color);
        continue;
      }
      beam(
        out,
        'metal',
        a.map((x, k) => x + (k === 1 ? height : 0)),
        b.map((x, k) => x + (k === 1 ? height : 0)),
        0.05,
        0.06,
        color,
      );
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(...b.map((x, k) => x - a[k])) / detail.guardPitch),
      );
      for (let j = 0; j <= steps; j++) {
        const p = a.map((x, k) => x + ((b[k] - x) * j) / steps);
        beam(
          out,
          'metal',
          p,
          p.map((x, k) => x + (k === 1 ? height : 0)),
          0.04,
          0.05,
          color,
        );
      }
    }
  }
  function skin(out, p, y0, y1, slot, color, pitch = 1.5, vertical = 3) {
    for (const [a, b] of edges(p)) {
      const q = [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ];
      if (slot === 'glass' && y0 === 43.5) {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (const v of q) {
          v[0] += ((b[1] - a[1]) * 0.025) / length;
          v[2] -= ((b[0] - a[0]) * 0.025) / length;
        }
      }
      face(out, slot, q, color);
      if (!detail.panelSeams) continue;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [-(b[1] - a[1]) / length, 0, (b[0] - a[0]) / length],
        nx = Math.ceil(length / (pitch * detail.moduleStep)),
        ny = Math.ceil((y1 - y0) / vertical);
      for (let i = 1; i < nx; i++) {
        const x = a[0] + ((b[0] - a[0]) * i) / nx,
          z = a[1] + ((b[1] - a[1]) * i) / nx;
        stripe(out, 'metal', [x, y0, z], [x, y1, z], 0.014, joint, n);
      }
      for (let i = 1; i < ny; i++) {
        const y = y0 + ((y1 - y0) * i) / ny;
        stripe(out, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.014, joint, n);
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
    // Break at both slope ends so the profile and level end strips stay exact.
    for (const [a, b] of edges(p)) {
      const cuts = [0, 1];
      if (Math.abs(b[1] - a[1]) > 0.001)
        for (const z of [highZ, lowZ]) {
          const f = (z - a[1]) / (b[1] - a[1]);
          if (f > 0 && f < 1) cuts.push(f);
        }
      cuts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const q = [cuts[i], cuts[i + 1]].map((f) => [
          a[0] + (b[0] - a[0]) * f,
          a[1] + (b[1] - a[1]) * f,
        ]);
        if (q.every((v) => h(...v) <= t.roof + 0.001)) continue;
        const north = Math.abs(a[1] - t.z0) < 0.001 && Math.abs(b[1] - t.z0) < 0.001;
        if (north) {
          const z = t.z0 + 0.45,
            x0 = t.x0 + 1.5,
            x1 = t.x1 - 1.5;
          face(
            out,
            'metal',
            [
              [x0, t.roof, z],
              [x1, t.roof, z],
              [x1, t.top, z],
              [x0, t.top, z],
            ].toReversed(),
            silver,
          );
          for (const [x, sign] of [
            [t.x0, 1],
            [t.x1, -1],
          ])
            mappedSolid(out, 'metal', rect(x, t.z0, x + sign * 1.5, z), t.roof, t.top, silver);
          mappedCap(out, 'metal', rect(x0, t.z0, x1, z), t.roof, silver);
          continue;
        }
        const vertices = [
          [q[0][0], t.roof, q[0][1]],
          [q[1][0], t.roof, q[1][1]],
          [q[1][0], h(...q[1]), q[1][1]],
          [q[0][0], h(...q[0]), q[0][1]],
        ];
        const clean = vertices.filter(
          (p, i) => !i || Math.hypot(...p.map((x, k) => x - vertices[i - 1][k])) > 0.0001,
        );
        if (clean.length === 4 && Math.hypot(...clean[3].map((x, k) => x - clean[0][k])) < 0.0001)
          clean.pop();
        if (clean.length === 3) tri(out, 'metal', clean, silver);
        else face(out, 'metal', clean, silver);
      }
    }
    for (const [z0, z1] of [
      [t.z0, highZ],
      [highZ, lowZ],
      [lowZ, t.z1],
    ]) {
      const plan = rect(t.x0, z0, t.x1, z1);
      slopedCap(out, plan, h, 'metal', silver);
      if (detail.panelSeams)
        for (let x = t.x0 + 1.5; x < t.x1; x += 1.5)
          stripe(
            out,
            'metal',
            [x, h(x, z0), z0],
            [x, h(x, z1), z1],
            0.014,
            joint,
            z0 === highZ ? [0, Math.SQRT1_2, Math.SQRT1_2] : [0, 1, 0],
          );
    }
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
      if (detail.frames)
        for (let dy = 0.14; dy < 1.2; dy += detail.louverPitch)
          stripe(
            out,
            'metal',
            [t.x1 + 0.03, y + dy, z1],
            [t.x1 + 0.03, y + dy, z0],
            0.07,
            silver,
            [1, 0, 0],
          );
    }
    for (const x of [-46, -34, -22, -10]) {
      if (detail.skyline) {
        const q = [
          [x - 0.035, t.top, -17],
          [x + 0.035, t.top, -17],
          [x + 0.035, t.top + 1.7, -17],
          [x - 0.035, t.top + 1.7, -17],
        ];
        face(out, 'metal', q, silver);
        face(out, 'metal', q.toReversed(), silver);
      } else {
        tube(out, 'metal', [x, t.top, -17], [x, t.top + 1.7, -17], 0.035, silver, 8);
        box(out, 'metal', [x - 0.22, t.top, -17.4], [x + 0.22, t.top + 0.4, -16.6], joint);
      }
    }
  }
  function shaft(out, m, parts) {
    const t = tower,
      p = rect(t.x0, t.z0, t.x1, t.z1),
      pitch = (t.roof - 43.5) / 50;
    skin(out, p, t.base, 43.5, 'metal', silver, 1.5, 4.25);
    if (detail.rowStep > 1) skin(out, p, 43.5, t.roof, 'glass', glass);
    for (const [a, b] of edges(p))
      for (let row = 0; row < 50; row += detail.rowStep) {
        const y = 43.5 + row * pitch;
        face(
          out,
          'metal',
          [
            [a[0], y, a[1]],
            [b[0], y, b[1]],
            [b[0], y + 1.85, b[1]],
            [a[0], y + 1.85, a[1]],
          ],
          silver,
        );
        if (detail.frames) {
          const split = y + 1.85;
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
    mappedCap(out, 'metal', p, t.base, [0.38, 0.4, 0.4], [], true);
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
        true,
      );
      // Parallel narrow garden terraces at the west end remain distinct from the tall office block.
      if (detail.plants && [258744601, 258744602, 258744603, 258744608].includes(id)) {
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
    if (detail.entry)
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
          nx = id === 258744604 && a[0] < -69 && b[0] < -69 ? Math.ceil(length / 1.4) : 1;
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
            if (detail.entry)
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
        }
        if (!detail.skyline)
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
            const n = detail.frames
              ? Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / (1.25 * detail.moduleStep))
              : 1;
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
    }
    const skylight = partPlan(
      m,
      parts.find((q) => q.id === 258744598),
    );
    const sy = (x, z) => 15.5 + 1.5 * Math.max(0, Math.min(1, (x + z + 82.76) / 4.56));
    slopedCap(out, skylight, sy, 'glass', glass);
    if (!detail.skyline)
      for (const [a, b] of edges(skylight))
        beam(out, 'metal', [a[0], sy(...a), a[1]], [b[0], sy(...b), b[1]], 0.07, 0.08, silver);
    if (detail.frames)
      for (let i = 1; i < 16; i += detail.moduleStep) {
        const a = [
            -52.032 + ((-67.949 + 52.032) * i) / 16,
            -30.804 + ((-14.729 + 30.804) * i) / 16,
          ],
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
    beam(
      out,
      'metal',
      [-70.55, 5.4, -25.35],
      [-70.55, 5.4, -22.65],
      0.16,
      0.22,
      [0.24, 0.18, 0.12],
    );
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
      const southern = Math.abs(a[1] - 30.5) < 0.01 && Math.abs(b[1] - 30.5) < 0.01;
      const B = southern ? [-48.1, 30.5] : b;
      face(
        out,
        'stone',
        [
          [a[0], floor, a[1]],
          [a[0], 0, a[1]],
          [B[0], 0, B[1]],
          [B[0], floor, B[1]],
        ],
        [0.34, 0.35, 0.32],
      );
      beam(out, 'stone', [a[0], 0.09, a[1]], [B[0], 0.09, B[1]], 0.4, 0.3, granite);
    }
    // Current plaza food-hall frontage: opaque exterior glazing, no invented interior.
    if (!detail.skyline)
      grid(
        out,
        [
          [-34.08, floor + 0.06, 19],
          [-34.08, floor + 0.06, 1],
          [-34.08, -0.65, 1],
          [-34.08, -0.65, 19],
        ],
        glass,
        1.48,
        3.9,
        0.07,
        silver,
        'metal',
      );
    // Broad53rd-Street descent. Each tread has a closed riser and joined handrails.
    const n = detail.stairSteps,
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
    if (detail.furniture)
      for (const x of [-47.8, -41, -34.2]) {
        tube(out, 'stainless', [x, floor + 1, z0], [x, 1, z0 + run], 0.034, silver, 8);
        for (let i = 0; i <= n; i += 4) {
          const z = z0 + (run * i) / n,
            y = floor + (-floor * i) / n;
          tube(out, 'stainless', [x, y, z], [x, y + 1, z], 0.029, silver, 8);
        }
      }
    // A second landing and flight connects the church lobby to the lower north portion.
    for (let i = 0; i < (detail.skyline ? 2 : 8); i++)
      box(
        out,
        'stone',
        [-65, floor - 0.1, -2 + i * (detail.skyline ? 1.6 : 0.4)],
        [
          -53,
          floor + 0.145 * (8 - i * (detail.skyline ? 4 : 1)),
          -1.6 + i * (detail.skyline ? 1.6 : 0.4),
        ],
        granite,
      );
    if (detail.furniture)
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
        for (let k = 0; k < detail.treeClusters; k++) {
          const a = k * 2.399;
          const end = [x + 1.3 * Math.cos(a), 1 + (k % 3) * 0.48, z + 1.3 * Math.sin(a)];
          tube(out, 'metal', [x, -0.9, z], end, 0.037, [0.26, 0.19, 0.11], 7);
          sphere(
            out,
            'foliage',
            end,
            [1.5, 0.65, 1.2],
            [0.23, 0.31, 0.12],
            detail.plantSides,
            detail.plantRows,
          );
        }
      }
    if (detail.furniture)
      for (const [x, z] of [
        [-66, 5],
        [-66, 15],
        [-54, 3],
        [-50, 10],
        [-58, 24],
      ])
        bench(out, x, z);
    if (detail.furniture)
      for (const [x, z] of [
        [-58, 8],
        [-59, 15],
        [-53, 22],
      ]) {
        loft(
          out,
          'wood',
          [
            radialRing(floor + 0.77, 0.7, 0.7, detail.tableSides).map((p) => [
              p[0] + x,
              p[1],
              p[2] + z,
            ]),
            radialRing(floor + 0.84, 0.7, 0.7, detail.tableSides).map((p) => [
              p[0] + x,
              p[1],
              p[2] + z,
            ]),
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
    if (detail.furniture)
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
  function buildNative(out, m) {
    const parts = partsEvidence('n0198_citigroup_center');
    shaft(out, m, parts);
    market(out, m, parts);
    church(out, m, parts);
    sunkenPlaza(out);
  }

  buildNative(out, m);
}
const settings = {
  skyline: {
    skyline: true,
    flatGuards: true,
    rowStep: 10,
    frames: false,
    moduleStep: 8,
    panelSeams: false,
    louverPitch: 0.54,
    guardPitch: 12,
    plants: false,
    entry: false,
    furniture: false,
    stairSteps: 4,
  },
  district: {
    flatGuards: true,
    rowStep: 4,
    frames: true,
    moduleStep: 8,
    panelSeams: false,
    louverPitch: 0.54,
    guardPitch: 8,
    plants: false,
    entry: true,
    furniture: false,
    stairSteps: 8,
  },
  street: {
    rowStep: 1,
    frames: true,
    moduleStep: 4,
    panelSeams: false,
    louverPitch: 0.36,
    guardPitch: 6,
    plants: true,
    entry: true,
    furniture: true,
    stairSteps: 23,
    treeClusters: 3,
    plantSides: 6,
    plantRows: 3,
    tableSides: 12,
  },
  closeup: {
    rowStep: 1,
    frames: true,
    moduleStep: 1,
    panelSeams: true,
    louverPitch: 0.18,
    guardPitch: 1.5,
    plants: true,
    entry: true,
    furniture: true,
    stairSteps: 23,
    treeClusters: 7,
    plantSides: 12,
    plantRows: 8,
    tableSides: 36,
  },
};
function build(out, name) {
  const metal = [0.81896, 0.822889, 0.822889],
    stone = [0.701109, 0.701109, 0.701109],
    means = { metal, stainless: metal, stone, wood: stone, foliage: stone };
  const target = {
    detail: settings[name],
    ...Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (slot, r, p, n, uv, c) => {
          if (name === 'skyline') out[k]('silhouette', 'palette:#ffffff', p, n, uv, c);
          else out[k](slot, r, p, n, uv, means[slot] ? c.map((v, i) => v / means[slot][i]) : c);
        },
      ]),
    ),
  };
  render(target, frame);
}
export const buildCiticorpReviewedMaster = (out) => build(out, 'closeup');
export const buildCiticorpSkyline = (out) => build(out, 'skyline');
export const buildCiticorpDistrict = (out) => build(out, 'district');
export const buildCiticorpStreet = (out) => build(out, 'street');
export const buildCiticorpCloseup = (out) => build(out, 'closeup');
