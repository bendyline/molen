/** Ping An North Tower. Individual notched sections and open completed crown. */
import { beam, cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  mappedCap,
  panel,
  tri,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s);
const steel = [0.65, 0.68, 0.69],
  glass = [0.245, 0.305, 0.33];
const sections = [
  [0, 38.15, 20.6, 31.25, 31.2, 22.15],
  [63, 33.99, 18.55, 30.5, 28.7, 19.86],
  [120, 29.9, 16.5, 29.8, 26.1, 17.4],
  [407, 29.9, 16.5, 26.3, 26.1, 17.4],
  [467, 29.9, 16.5, 21.75, 26.1, 17.4],
  [557, 21.47, 12.33, 13.27, 13.27, 13.27],
];
const data = (y) => {
  for (let i = 1; i < sections.length; i++)
    if (y <= sections[i][0])
      return mix(
        sections[i - 1],
        sections[i],
        (y - sections[i - 1][0]) / (sections[i][0] - sections[i - 1][0]),
      );
  return sections.at(-1);
};
const rotate = ([x, y, z], q) => {
  for (let i = 0; i < q; i++) [x, z] = [z, -x];
  return [x, y, z];
};
function segment(y, q) {
  const [, r, w, c, d, e] = data(y);
  return [
    [-w, y, r],
    [w, y, r],
    [e, y, d],
    [c, y, c],
    [d, y, e],
    [r, y, w],
  ].map((p) => rotate(p, q));
}
function steelGrid(out, poly, dx = 1.5, dy = 4.7) {
  const cols = Math.max(1, Math.ceil(Math.hypot(...add(poly[1], poly[0], -1)) / dx)),
    rows = Math.max(1, Math.ceil((poly[3][1] - poly[0][1]) / dy));
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = mix(poly[0], poly[3], j / rows),
        b = mix(poly[1], poly[2], j / rows),
        c = mix(poly[1], poly[2], (j + 1) / rows),
        d = mix(poly[0], poly[3], (j + 1) / rows);
      const p = [
        mix(a, b, (i + 0.012) / cols),
        mix(a, b, (i + 1 - 0.012) / cols),
        mix(d, c, (i + 1 - 0.012) / cols),
        mix(d, c, (i + 0.012) / cols),
      ];
      face(out, 'stainless', p, steel);
      face(
        out,
        'recess',
        [mix(a, b, i / cols), p[0], p[3], mix(d, c, i / cols)],
        [0.11, 0.15, 0.17],
      );
      face(
        out,
        'recess',
        [p[1], mix(a, b, (i + 1) / cols), mix(d, c, (i + 1) / cols), p[2]],
        [0.11, 0.15, 0.17],
      );
    }
}
function cornerStrip(out, y0, y1, q, a0, a1, b0, b1, width = 1.3) {
  // A shallow strip follows each recessed corner face instead of spanning its
  // concave space with a disconnected straight cross-brace.
  const steps = Math.ceil((y1 - y0) / 4.7);
  for (let i = 0; i < steps; i++) {
    const t = i / steps,
      tt = (i + 1) / steps,
      y = y0 + (y1 - y0) * t,
      yy = y0 + (y1 - y0) * tt;
    const l = segment(y, q),
      h = segment(yy, q);
    const a = mix(l[a0], l[a1], t),
      b = mix(h[b0], h[b1], tt);
    if (Math.hypot(...add(b, a, -1)) > 0.05) {
      const edge = Math.min(a0, a1),
        n = normalFor(l[edge], l[edge + 1], h[edge + 1]),
        axis = normalize(add(b, a, -1)),
        side = normalize(cross(n, axis));
      const aa = add(a, n, 0.32),
        bb = add(b, n, 0.32),
        front = [
          add(aa, side, -width / 2),
          add(bb, side, -width / 2),
          add(bb, side, width / 2),
          add(aa, side, width / 2),
        ],
        rear = front.map((p) => add(p, n, -0.22));
      face(out, 'stainless', front, [0.62, 0.66, 0.68]);
      for (let k = 0; k < 4; k++)
        face(out, 'stainless', [front[k], rear[k], rear[(k + 1) % 4], front[(k + 1) % 4]], steel);
    }
  }
}
export function buildPingAn(out) {
  // Independently changing notches collapse into the upper octagon at467 m.
  const levels = [0, 13, 63, 120, 407, 467, 557];
  for (let stage = 1; stage < levels.length; stage++) {
    const low = levels[stage - 1],
      high = levels[stage],
      rows = Math.ceil((high - low) / 4.72);
    for (let j = 0; j < rows; j++) {
      const y = low + ((high - low) * j) / rows,
        yy = low + ((high - low) * (j + 1)) / rows;
      for (let q = 0; q < 4; q++) {
        const a = segment(y, q),
          b = segment(yy, q),
          vent = [73, 144, 220, 293, 364, 437, 510].some((v) => y >= v && y < v + 7);
        const p = [a[0], a[1], b[1], b[0]],
          bays = 10;
        // Fine curtain wall and physical pointed piers across every broad face.
        for (let i = 0; i < bays; i++) {
          const aa = mix(p[0], p[1], i / bays),
            bb = mix(p[0], p[1], (i + 1) / bays),
            cc = mix(p[3], p[2], (i + 1) / bays),
            dd = mix(p[3], p[2], i / bays);
          grid(
            out,
            [aa, bb, cc, dd],
            vent ? [0.11, 0.16, 0.18] : glass,
            1.55,
            2.36,
            0.055,
            [0.41, 0.48, 0.51],
            'stainless',
          );
          if (i > 0) {
            const n = normalFor(...p),
              u = normalize(add(bb, aa, -1));
            const left = add(aa, u, -0.2),
              right = add(aa, u, 0.2),
              apex = add(aa, n, 0.37),
              upperLeft = add(dd, u, -0.2),
              upperRight = add(dd, u, 0.2),
              upperApex = add(dd, n, 0.37);
            face(out, 'stainless', [left, apex, upperApex, upperLeft], [0.72, 0.74, 0.74]);
            face(out, 'stainless', [apex, right, upperRight, upperApex], [0.59, 0.64, 0.66]);
            tri(out, 'stainless', [upperLeft, upperApex, upperRight], [0.61, 0.66, 0.68]);
          }
        }
        for (const edge of [1, 4]) {
          const pp = [a[edge], a[edge + 1], b[edge + 1], b[edge]];
          if (Math.hypot(...add(b[edge + 1], b[edge], -1)) < 0.03) {
            tri(out, 'glass', [a[edge], a[edge + 1], b[edge]], [0.105, 0.155, 0.18]);
            continue;
          }
          if (y < 3) face(out, 'stone', pp, [0.24, 0.28, 0.3]);
          else steelGrid(out, pp, 0.95, 2.36);
        }
        for (const edge of [2, 3]) {
          if (
            Math.hypot(...add(a[edge + 1], a[edge], -1)) < 0.03 &&
            Math.hypot(...add(b[edge + 1], b[edge], -1)) < 0.03
          )
            continue;
          const pp = [a[edge], a[edge + 1], b[edge + 1], b[edge]];
          const width = Math.max(
            Math.hypot(...add(a[edge + 1], a[edge], -1)),
            Math.hypot(...add(b[edge + 1], b[edge], -1)),
          );
          if (Math.hypot(...add(b[edge + 1], b[edge], -1)) < 0.03) {
            tri(out, 'glass', [a[edge], a[edge + 1], b[edge]], [0.105, 0.155, 0.18]);
            continue;
          }
          if (width > 0.08)
            grid(out, pp, [0.105, 0.155, 0.18], 1.25, 2.36, 0.06, [0.35, 0.42, 0.46], 'stainless');
          if (y < 407)
            for (let k = 1; k < 5; k++) {
              const h = y + ((yy - y) * k) / 5,
                ring = segment(h, q);
              beam(out, 'stainless', ring[edge], ring[edge + 1], 0.12, 0.24, [0.44, 0.5, 0.53]);
            }
        }
      }
    }
  }
  for (let q = 0; q < 4; q++)
    for (const [lo, hi] of [
      [13, 156],
      [156, 313],
      [313, 467],
    ])
      for (const edge of [2, 3]) {
        cornerStrip(out, lo, hi, q, edge, edge + 1, edge, edge + 1, 0.9);
        cornerStrip(out, lo, hi, q, edge + 1, edge, edge + 1, edge, 0.9);
      }
  // Shallow glazed roof above the occupied top, with radial metal standing seams.
  const lower = [];
  for (let q = 0; q < 4; q++) {
    const p = segment(557, q);
    lower.push(...[p[0], p[1], p[2]].map((v) => [v[0], v[2]]));
  }
  const roofPlan = clockwise(lower),
    topPlan = roofPlan.map(([x, z]) => [x * 0.39, z * 0.39]);
  for (let i = 0; i < roofPlan.length; i++) {
    const k = (i + 1) % roofPlan.length,
      a = [roofPlan[i][0], 557, roofPlan[i][1]],
      b = [roofPlan[k][0], 557, roofPlan[k][1]],
      c = [topPlan[k][0], 568.2, topPlan[k][1]],
      d = [topPlan[i][0], 568.2, topPlan[i][1]];
    grid(out, [a, b, c, d], [0.21, 0.275, 0.305], 1.2, 2.2, 0.075, [0.64, 0.7, 0.72], 'stainless');
  }
  mappedCap(out, 'metal', topPlan, 568.2, [0.35, 0.42, 0.45]);
  // Four split stainless corner legs retain the large actual open apertures.
  // They terminate under the small 590–599.1 m glass pyramid, not a filled cone.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const a = [sx * 13.3, 557, sz * 13.3],
        b = [sx * 5.95, 590, sz * 5.95];
      const rings = [];
      for (let j = 0; j <= 14; j++) {
        const t = j / 14,
          c = mix(a, b, t),
          w = 2.1 - 0.9 * t;
        rings.push(
          [
            [-w, -w],
            [w, -w],
            [w, w],
            [-w, w],
          ].map(([x, z]) => [c[0] + x, c[1], c[2] + z]),
        );
      }
      // Vertical prism sections use outward winding checked against their center.
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < 4; i++) {
          let pp = [rings[j - 1][i], rings[j - 1][(i + 1) % 4], rings[j][(i + 1) % 4], rings[j][i]];
          const c = mix(a, b, (j - 0.5) / 14),
            n = normalFor(...pp);
          if (n.reduce((s, v, k) => s + v * (pp[0][k] - c[k]), 0) < 0) pp = pp.toReversed();
          steelGrid(out, pp, 0.85, 2.1);
        }
      mappedCap(out, 'stainless', clockwise(rings.at(-1).map((p) => [p[0], p[2]])), 590, steel);
    }
  const cap = [
    [-7.3, -7.3],
    [-7.3, 7.3],
    [7.3, 7.3],
    [7.3, -7.3],
  ];
  // Completed aerial shows a closed metal collar joining all four legs under
  // the glass cap. It covers the support ends and closes the pyramid soffit.
  for (let i = 0; i < 4; i++) {
    const a = cap[i],
      b = cap[(i + 1) % 4];
    steelGrid(
      out,
      [
        [a[0], 589.6, a[1]],
        [b[0], 589.6, b[1]],
        [b[0], 591, b[1]],
        [a[0], 591, a[1]],
      ],
      1.5,
      1.4,
    );
  }
  for (let i = 0; i < 4; i++) {
    const a = [cap[i][0], 591, cap[i][1]],
      b = [cap[(i + 1) % 4][0], 591, cap[(i + 1) % 4][1]],
      tip = [0, 599.1, 0];
    const rows = 8;
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < 8 - j; k++) {
        const aa = mix(mix(a, tip, j / rows), mix(b, tip, j / rows), k / (rows - j)),
          bb = mix(mix(a, tip, j / rows), mix(b, tip, j / rows), (k + 1) / (rows - j));
        if (j === rows - 1) {
          tri(out, 'glass', [aa, bb, tip], [0.28, 0.37, 0.42]);
          continue;
        }
        const d = mix(
          mix(a, tip, (j + 1) / rows),
          mix(b, tip, (j + 1) / rows),
          Math.min(k / (rows - j - 1), 1),
        );
        const c = mix(
          mix(a, tip, (j + 1) / rows),
          mix(b, tip, (j + 1) / rows),
          Math.min((k + 1) / (rows - j - 1), 1),
        );
        if (Math.hypot(...add(c, d, -1)) > 0.001)
          panel(out, [aa, bb, c, d], [0.28, 0.37, 0.42], 0.045, [0.55, 0.62, 0.65], 'stainless');
        else tri(out, 'glass', [aa, bb, c], [0.28, 0.37, 0.42]);
      }
    beam(out, 'stainless', a, tip, 0.17, 0.17, [0.67, 0.72, 0.73]);
  }
  mappedCap(out, 'stainless', cap, 589.6, [0.45, 0.51, 0.53], [], true);
  // The public Yitian Road entry is east-facing (+X), between splayed columns.
  const q = 1,
    at = (x, y, z) => rotate([x, y, z], q);
  for (const sign of [-1, 1]) {
    beam(
      out,
      'stainless',
      at(sign * 20, 2, 37.6),
      at(sign * 13, 16.6, 37),
      1.15,
      1.45,
      [0.67, 0.71, 0.72],
    );
    beam(
      out,
      'stainless',
      at(sign * 20, 2, 37.6),
      at(sign * 13, 6.7, 44.4),
      0.65,
      1.1,
      [0.68, 0.72, 0.73],
    );
  }
  // Folded canopy underside and closed sloped fascia, referenced to KPF entry photo.
  const back = [at(-17, 6.8, 36.9), at(17, 6.8, 36.9)],
    front = [at(-13, 6.55, 44.6), at(13, 6.55, 44.6)];
  face(out, 'stainless', [back[0], back[1], front[1], front[0]], [0.7, 0.74, 0.75]);
  face(
    out,
    'metal',
    [
      add(back[0], [0, -0.3, 0]),
      add(front[0], [0, -0.3, 0]),
      add(front[1], [0, -0.3, 0]),
      add(back[1], [0, -0.3, 0]),
    ],
    [0.41, 0.46, 0.49],
  );
  for (const [a, b] of [
    [back[0], front[0]],
    [front[0], front[1]],
    [front[1], back[1]],
  ])
    face(out, 'stainless', [a, b, add(b, [0, -0.3, 0]), add(a, [0, -0.3, 0])], steel);
  for (let i = 0; i < 12; i++)
    grid(
      out,
      [
        at(-18 + i * 3, 0, 38.19),
        at(-15 + i * 3, 0, 38.19),
        at(-15 + i * 3, 12.2, 37.8),
        at(-18 + i * 3, 12.2, 37.8),
      ],
      [0.2, 0.25, 0.27],
      1.5,
      3.05,
      0.07,
      [0.57, 0.62, 0.64],
      'stainless',
    );
  for (const x of [-8, 0, 8]) {
    for (let j = 0; j < 32; j++) {
      const a = (j * Math.PI) / 16,
        b = ((j + 1) * Math.PI) / 16,
        r = 1.7;
      grid(
        out,
        [
          at(x + r * Math.cos(a), 0, 39.1 + r * Math.sin(a)),
          at(x + r * Math.cos(b), 0, 39.1 + r * Math.sin(b)),
          at(x + r * Math.cos(b), 3.6, 39.1 + r * Math.sin(b)),
          at(x + r * Math.cos(a), 3.6, 39.1 + r * Math.sin(a)),
        ].toReversed(),
        [0.12, 0.18, 0.21],
        2,
        3.6,
        0.035,
        [0.42, 0.49, 0.52],
        'stainless',
      );
    }
    tube(out, 'stainless', at(x, 0.05, 39.1), at(x, 3.6, 39.1), 0.055, [0.65, 0.69, 0.7], 8);
  }
}
