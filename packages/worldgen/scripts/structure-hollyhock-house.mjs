/** Hollyhock House: battered stucco masses, open garden court and east upper bridge. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  floor = 1.7;
const base = new URL(
  '../../../content/worldgen/source/places/9q/9q5/hollyhock_house/',
  import.meta.url,
);
const stucco = rgb('d4cbb4'),
  concrete = rgb('c4b698'),
  edge = rgb('dbd0b7'),
  shade = rgb('b1a488'),
  wood = rgb('655f49'),
  glass = rgb('55645e'),
  paving = rgb('b8aa8b'),
  roofing = rgb('b6b6aa');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function cap(o, r, y, s, c) {
  r = cleanRing(r);
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]);
    o.addTriangle(
      s,
      ref,
      p,
      [0, 1, 0],
      p.map((v) => [v[0], v[2]]),
      c,
    );
  }
}
function prism(o, r, lo, hi, s = 'wall', c = stucco) {
  r = cleanRing(r);
  if (
    r.reduce(
      (a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) > 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [a[1] - b[1], 0, b[0] - a[0]],
      c,
    );
  }
  cap(o, r, hi, s, c);
}
function rect(x, z, w, dep, y) {
  return [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ].map(([a, b]) => [x + (a * w) / 2, y, z + (b * dep) / 2]);
}
function battered(o, x, z, w, dep, lo, hi, d) {
  const inset = (hi - lo) * Math.tan(Math.PI / 18);
  if (!d) {
    loft(
      o,
      'wall',
      [rect(x, z, w, dep, lo), rect(x, z, w - 2 * inset, dep - 2 * inset, hi)],
      stucco,
    );
    return;
  }
  // Slope continues to a parapet above the flat roof. The upper mass is not a solid roof slab.
  const ry = hi - 0.85,
    ri = (ry - lo) * Math.tan(Math.PI / 18);
  loft(o, 'wall', [rect(x, z, w, dep, lo), rect(x, z, w - 2 * ri, dep - 2 * ri, ry)], stucco);
  B(o, 'roof', x, ry + 0.012, z, w - 2 * ri - 0.28, 0.04, dep - 2 * ri - 0.28, roofing);
  for (const [a, xx, zz, span] of [
    [0, x, z + dep / 2, w],
    [Math.PI, x, z - dep / 2, w],
    [Math.PI / 2, x + w / 2, z, dep],
    [-Math.PI / 2, x - w / 2, z, dep],
  ]) {
    const f = facing(o, a, xx, zz),
      p = [
        [-span / 2 + ri, ry, -ri],
        [span / 2 - ri, ry, -ri],
        [span / 2 - inset, hi, -inset],
        [-span / 2 + inset, hi, -inset],
      ];
    quad(f, 'wall', p, normalFor(...p), stucco);
    const back = p.map((v) => [v[0], v[1], v[2] - 0.2]);
    quad(f, 'wall', [...back].reverse(), [0, 0, -1], shade);
    quad(f, 'wall', [p[3], p[2], back[2], back[3]], [0, 1, 0], edge);
  }
}
function motif(o, x, y, h, d, short = false) {
  // Geometric stalk, paired leaves and stepped head; sculptural depth kept shallow.
  const z = 0.08,
    s = h / 1.12;
  face(o, 'stone', x, y, z, 0.105 * s, h, shade);
  if (d < 2) return;
  face(o, 'stone', x, y + 0.12 * s, z + 0.018, 0.07 * s, 0.92 * s, edge);
  const leaves = d === 2 ? 2 : short ? 3 : 6;
  for (let k = 0; k < leaves; k++) {
    const yy = y + (0.19 + k * (short ? 0.11 : 0.105)) * s,
      ww = (k < 3 ? 0.32 : 0.25) * s;
    face(o, 'stone', x, yy, z + 0.025, ww, 0.045 * s, edge);
    for (const sign of [-1, 1])
      face(
        o,
        'stone',
        x + sign * (ww / 2 - 0.025 * s),
        yy - 0.05 * s,
        z + 0.028,
        0.045 * s,
        0.09 * s,
        edge,
      );
  }
  if (d > 2) {
    for (const sign of [-1, 1]) {
      face(o, 'stone', x + sign * 0.09 * s, y + 0.73 * s, z + 0.025, 0.035 * s, 0.35 * s, edge);
      face(o, 'stone', x + sign * 0.12 * s, y + 0.84 * s, z + 0.026, 0.025 * s, 0.23 * s, edge);
    }
    const p = [
      [x - 0.055 * s, y, z],
      [x - 0.055 * s, y + h, z],
      [x - 0.055 * s, y + h, z + 0.04],
      [x - 0.055 * s, y, z + 0.04],
    ];
    quad(o, 'stone', p, [-1, 0, 0], shade);
  }
}
function frieze(o, w, y, d, { full = false, replaceWest = false } = {}) {
  B(o, 'stone', 0, y - 0.2, 0.06, w + 0.16, 0.22, 0.3, concrete);
  if (d > 2 && replaceWest) return;
  if (!d) return;
  const h = full ? 1.12 : 0.42,
    spacing = full ? 0.5 : 0.4,
    n = Math.max(1, Math.floor(w / spacing / (d === 2 ? 2 : 1)));
  if (d === 1) {
    face(o, 'stone', 0, y, 0.04, w, h, concrete);
    return;
  }
  for (let i = 0; i < n; i++) motif(o, -w / 2 + ((i + 0.5) * w) / n, y, h, d, !full);
}
function win(o, x, y, w, h, d, { bars = 1, lead = false } = {}) {
  if (!d) return;
  face(o, 'glass', x, y, 0.065, w, h, glass);
  if (d < 2) return;
  for (const xx of [x - w / 2, x + w / 2]) B(o, 'wood', xx, y, 0.11, 0.07, h, 0.09, wood);
  for (const yy of [y, y + h - 0.06]) B(o, 'wood', x, yy, 0.11, w, 0.06, 0.09, wood);
  for (let k = 1; k <= bars; k++)
    B(o, 'wood', x - w / 2 + (w * k) / (bars + 1), y, 0.115, 0.06, h, 0.1, wood);
  if (d > 2 && lead) {
    for (let k = 1; k < 6; k++) face(o, 'wood', x, y + (h * k) / 6, 0.18, w, 0.016, edge);
    for (const s of [-0.28, 0.28]) face(o, 'wood', x + s * w, y, 0.182, 0.016, h, wood);
  }
}
function windows(o, a, x, z, w, y, h, count, d, { lead = false } = {}) {
  const f = facing(o, a, x, z);
  for (let i = 0; i < count; i++)
    win(f, -w / 2 + ((i + 0.5) * w) / count, y, w / count - 0.18, h, d, { bars: 1, lead });
}
function mass(
  o,
  x,
  z,
  w,
  dep,
  hi,
  d,
  { lo = -2, belt = floor + 2.05, full = false, faces = [0, 1, 2, 3] } = {},
) {
  const lower =
    d > 2 && x === -13.4 && z === -0.25
      ? {
          addQuad: (s, r, p, n, u, col) =>
            p.every((v) => Math.abs(v[0] + 20.8) < 0.000001)
              ? undefined
              : o.addQuad(s, r, p, n, u, col),
        }
      : o;
  B(lower, 'wall', x, lo, z, w, belt - lo, dep, stucco);
  battered(o, x, z, w, dep, belt, hi, d);
  if (d) B(o, 'stone', x, floor - 0.25, z, w + 0.12, 0.18, dep + 0.12, concrete);
  const sides = [
    [0, x, z + dep / 2, w],
    [Math.PI, x, z - dep / 2, w],
    [Math.PI / 2, x + w / 2, z, dep],
    [-Math.PI / 2, x - w / 2, z, dep],
  ];
  for (const j of d ? faces : []) {
    const [a, xx, zz, span] = sides[j];
    frieze(facing(o, a, xx, zz), span, belt, d, {
      full,
      replaceWest: x === -13.4 && z === -0.25 && j === 3,
    });
  }
}
function wall(o, x, z, w, dep, top, d) {
  B(o, 'wall', x, -2, z, w, top + 2, dep, stucco);
  if (d) B(o, 'stone', x, top, z, w + 0.12, 0.15, dep + 0.12, concrete);
}
function steps(o, x, z, w, count, rise, run, y = 0) {
  for (let i = 0; i < count; i++)
    B(o, 'stone', x, y, z - i * run, w, (i + 1) * rise, run + 0.015, concrete);
}
function ring(o, x, z, r0, r1, lo, hi, n, _d, half = false) {
  const a0 = half === 'south' ? 0 : half ? -Math.PI / 2 : 0,
    extent = half ? Math.PI : Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (extent * i) / n,
      b = a0 + (extent * (i + 1)) / n;
    prism(
      o,
      [
        [x + r0 * Math.cos(a), z + r0 * Math.sin(a)],
        [x + r1 * Math.cos(a), z + r1 * Math.sin(a)],
        [x + r1 * Math.cos(b), z + r1 * Math.sin(b)],
        [x + r0 * Math.cos(b), z + r0 * Math.sin(b)],
      ],
      lo,
      hi,
      'stone',
      concrete,
    );
  }
}
function finial(o, x, z, y, d) {
  B(o, 'stone', x, y, z, 0.7, 0.65, 0.7, concrete);
  B(o, 'stone', x, y + 0.65, z, 0.43, 1.7, 0.43, concrete);
  if (d > 1) {
    for (let i = 0; i < 10; i++) B(o, 'stone', x, y + 0.72 + i * 0.12, z, 0.5, 0.045, 0.5, edge);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      motif(
        facing(o, a, x + 0.25 * Math.sin(a), z + 0.25 * Math.cos(a)),
        0,
        y + 0.05,
        0.6,
        d,
        true,
      );
  }
  if (d) B(o, 'roof', x, y + 0.66, z, 0.53, 0.035, 0.53, rgb('676354'));
}
/** Solid reliefs and five real west-window pockets, with surface-aligned meter UVs. */
function westConstruction(o) {
  const c = JSON.parse(fs.readFileSync(new URL('west-construction-controls.json', base))),
    f = facing(o, c.westFrame.angle, ...c.westFrame.origin),
    uv = (p, n) => {
      const axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
      return p.map((v) => v.filter((_, i) => i !== axis));
    },
    metric = {
      addQuad: (s, r, p, n, _u, col) => f.addQuad(s, r, p, n, uv(p, n), col),
      addConvexPolygon: (s, r, p, n, _u, col) => {
        const u = uv(p, n);
        return f.addConvexPolygon(s, r, p, n, (v) => u[p.indexOf(v)], col);
      },
    },
    Q = (s, p, n, col) => metric.addQuad(s, ref, p, n, null, col),
    front = (left, right, lo, hi) => {
      if (right - left < 0.0001 || hi - lo < 0.0001) return;
      Q(
        'reveal',
        [
          [left, lo, 0],
          [right, lo, 0],
          [right, hi, 0],
          [left, hi, 0],
        ],
        [0, 0, 1],
        stucco,
      );
    },
    w = c.wall,
    lo = w.openingBottom,
    hi = w.openingTop,
    holes = c.openings
      .map((v) => ({ ...v, left: v.x - v.width / 2, right: v.x + v.width / 2 }))
      .sort((a, b) => a.left - b.left),
    frameColor = rgb('8b7858');
  front(-w.width / 2, w.width / 2, w.bottom, lo);
  front(-w.width / 2, w.width / 2, hi, w.top);
  let cursor = -w.width / 2;
  for (const v of holes) {
    front(cursor, v.left, lo, hi);
    cursor = v.right;
    for (const x of [v.left, v.right])
      Q(
        'reveal',
        [
          [x, lo, 0],
          [x, lo, -w.recess],
          [x, hi, -w.recess],
          [x, hi, 0],
        ],
        [x === v.left ? 1 : -1, 0, 0],
        stucco,
      );
    for (const y of [lo, hi])
      Q(
        'reveal',
        [
          [v.left, y, 0],
          [v.right, y, 0],
          [v.right, y, -w.recess],
          [v.left, y, -w.recess],
        ],
        [0, y === lo ? 1 : -1, 0],
        stucco,
      );
    Q(
      'recessGlass',
      [
        [v.left, lo, -0.395],
        [v.right, lo, -0.395],
        [v.right, hi, -0.395],
        [v.left, hi, -0.395],
      ],
      [0, 0, 1],
      glass,
    );
    for (const x of [v.left + 0.035, v.right - 0.035])
      B(metric, 'recessWood', x, lo, -0.34, 0.07, hi - lo, 0.1, frameColor);
    for (const y of [lo, hi - 0.06])
      B(metric, 'recessWood', v.x, y, -0.34, v.width, 0.06, 0.1, frameColor);
    for (let i = 1; i <= v.bars; i++)
      B(
        metric,
        'recessWood',
        v.left + (v.width * i) / (v.bars + 1),
        lo,
        -0.34,
        0.055,
        hi - lo,
        0.1,
        frameColor,
      );
    if (v.leaded) {
      const rod = (a, b) =>
        beam(
          metric,
          'recessWood',
          [a[0], a[1], -0.375],
          [b[0], b[1], -0.375],
          0.025,
          0.012,
          frameColor,
        );
      for (let i = 1; i <= 6; i++) {
        const y = lo + ((hi - lo) * i) / 7;
        rod([v.left + 0.07, y], [v.right - 0.07, y]);
      }
      for (let i = 0; i < 4; i++) {
        const y = lo + 0.15 + i * 0.37;
        rod([v.left + 0.07, y], [v.right - 0.07, y + 0.22]);
      }
    }
  }
  front(cursor, w.width / 2, lo, hi);
  const solidMotif = (x, y, h, back, stemFront) => {
    const s = h / 1.12,
      box = (xx, yy, ww, hh, z, depth) =>
        B(metric, 'relief', x + xx * s, y + yy * s, z, ww * s, hh * s, depth, edge);
    // Deep narrow backing fins actually meet the receding battered wall.
    box(0, 0, 0.065, 1.12, (back + stemFront) / 2, stemFront - back);
    box(0, 0.035, 0.035, 1.04, stemFront + 0.018, 0.036);
    for (let i = 0; i < 6; i++) {
      const yy = 0.16 + i * 0.08,
        ww = i < 3 ? 0.32 : 0.27;
      box(0, yy, ww, 0.035, stemFront + 0.05, 0.065);
      for (const sign of [-1, 1]) {
        box(sign * (ww / 2 - 0.018), yy - 0.055, 0.036, 0.09, stemFront + 0.045, 0.055);
        box(sign * (ww / 2 - 0.047), yy - 0.055, 0.09, 0.025, stemFront + 0.045, 0.055);
      }
    }
    box(0, 0.61, 0.055, 0.51, stemFront + 0.045, 0.055);
    for (let i = 0; i < 12; i++)
      for (const sign of [-1, 1])
        box(sign * 0.039, 0.64 + i * 0.038, 0.025, 0.017, stemFront + 0.045, 0.055);
    for (const sign of [-1, 1]) {
      box(sign * 0.066, 0.015, 0.025, 0.125, stemFront + 0.04, 0.05);
      box(sign * 0.04, 0.015, 0.075, 0.025, stemFront + 0.04, 0.05);
    }
  };
  const fr = c.frieze;
  for (let i = 0; i < fr.count; i++)
    solidMotif(
      -fr.width / 2 + ((i + 0.5) * fr.width) / fr.count,
      fr.bottom,
      fr.height,
      fr.back,
      fr.front,
    );
  const p = c.piers;
  for (const x of p.centers) {
    B(metric, 'relief', x, p.bottom, p.centerZ, p.width, p.height, p.depth, edge);
    solidMotif(x, p.reliefBottom, p.reliefHeight, p.reliefBack, p.reliefFront);
  }
}
function hollyhock(o, _frame, d = 3) {
  // Plan controls: living projection west, music/study flanks, two low ranges around an open court.
  mass(o, -13.4, -0.25, 14.8, 7.1, 6.6, d, { full: true, faces: [0, 1, 3] });
  mass(o, -9.65, -9.4, 4.7, 7.0, 5.5, d, { faces: [1, 3] });
  mass(o, -9.65, 9.0, 4.7, 6.2, 5.5, d, { faces: [0, 3] });
  mass(o, -5.5, -8.5, 3.6, 8.8, 5.0, d, { faces: [1] });
  mass(o, -5.5, 7.6, 3.6, 8.5, 5.0, d, { faces: [0] });
  mass(o, -1.1, -10.2, 5.4, 5.3, 5.5, d, { faces: [1] });
  mass(o, 5.65, -9.35, 8.1, 3.8, 4.7, d, { faces: [1] });
  mass(o, 4.2, -6.35, 17.4, 2.6, 4.95, d, { faces: [0] });
  mass(o, 4.2, 8.55, 17.4, 4.1, 5.25, d, { faces: [0] });
  mass(o, -4.4, 13.0, 3.3, 3.9, 4.9, d, { faces: [0, 3] });
  // Roof loggia beside living room; lower glazing faces the courtyard, roof stays a usable terrace.
  B(o, 'wall', -3.35, -2, -0.2, 5.3, 6.25, 8.4, stucco);
  B(o, 'roof', -3.35, 4.265, -0.2, 4.9, 0.04, 8.0, roofing);
  if (d) {
    for (const z of [-4.25, 3.85]) wall(o, -3.35, z, 5.3, 0.25, 4.8, d);
    frieze(facing(o, Math.PI / 2, -0.68, -0.2), 7.8, floor + 2.05, d);
  }
  // Continuous upper east range bridges the 8.5 m open garden passage.
  for (const [z, dep] of [
    [-9.25, 9.0],
    [10.0, 12.0],
  ]) {
    B(o, 'wall', 14.75, -2, z, 4.9, 6.4, dep, stucco);
    if (d) B(o, 'stone', 14.75, floor - 0.25, z, 5.02, 0.18, dep + 0.12, concrete);
  }
  mass(o, 14.75, 1.125, 4.9, 29.75, 8.4, d, { lo: 4.4, belt: 4.65, full: true });
  if (d) {
    // Glazed eastern bay projects from the upper owner's bedroom, open nursery balcony below.
    B(o, 'wall', 17.8, 4.15, 10.4, 1.3, 0.55, 4.25, stucco);
    B(o, 'roof', 17.8, 7.55, 10.4, 1.8, 0.22, 4.75, wood);
    windows(o, Math.PI / 2, 18.46, 10.4, 4.18, 4.7, 2.8, 5, d, { lead: true });
    for (const [a, z] of [
      [0, 12.54],
      [Math.PI, 8.26],
    ])
      windows(o, a, 17.8, z, 1.25, 4.7, 2.8, 2, d, { lead: true });
    B(o, 'stone', 17.65, 1.5, 10.4, 1.7, 0.18, 4.75, concrete);
    wall(o, 18.4, 10.4, 0.3, 4.7, 2.4, d);
    windows(o, Math.PI / 2, 17.22, 10.6, 5.8, floor + 0.1, 2.55, 4, d);
    windows(o, Math.PI / 2, 17.22, -6.3, 1.35, floor + 0.5, 0.9, 1, d);
    windows(o, 0, 14.75, 16.03, 3.45, floor + 0.1, 2.5, 3, d, { lead: true });
    windows(o, Math.PI, 14.75, -13.77, 3.35, floor + 0.4, 2.3, 3, d);
    windows(o, -Math.PI / 2, 12.28, -8.9, 6.2, floor + 0.2, 2.45, 4, d);
    windows(o, -Math.PI / 2, 12.28, 9.9, 8.3, floor + 0.2, 2.45, 5, d);
  }
  // West living French doors with slender patterned piers; music/study are lower and recess behind it.
  if (d < 3) {
    const west = facing(o, -Math.PI / 2, -20.82, -0.25);
    win(west, 0, floor, 2.8, 2.05, d, { bars: 1 });
    for (const sign of [-1, 1]) {
      win(west, sign * 1.72, floor, 0.45, 2.05, d, { bars: 0 });
      win(west, sign * 2.66, floor, 0.66, 2.05, d, { bars: 0, lead: true });
    }
  }
  windows(o, -Math.PI / 2, -12.02, -9.4, 4.2, floor + 0.55, 1.4, 3, d);
  windows(o, -Math.PI / 2, -12.02, 9.0, 4.2, floor + 0.55, 1.4, 3, d);
  windows(o, Math.PI / 2, -0.68, -0.2, 7.5, floor + 0.05, 2.0, 6, d, { lead: true });
  windows(o, 0, 4.0, -5.03, 16.0, floor + 0.1, 1.85, 12, d);
  windows(o, 0, 4.2, 10.62, 16.0, floor + 0.15, 1.85, 10, d);
  windows(o, Math.PI, 5.5, -11.27, 7.0, floor + 0.6, 1.35, 5, d);
  windows(o, Math.PI, -1.1, -12.87, 4.3, floor + 0.1, 1.9, 4, d);
  windows(o, 0, -4.4, 14.97, 2.7, floor + 0.1, 1.9, 2, d);
  if (d > 1 && d < 3) {
    const f = facing(o, -Math.PI / 2, -20.85, -0.25);
    for (const xx of [-2.13, 2.13]) {
      B(f, 'stone', xx, floor, 0.1, 0.34, 2.05, 0.22, edge);
      motif(f, xx, floor + 0.5, 1.4, d);
    }
  }
  // South pergola frames the courtyard without covering the garden or the bridge opening.
  B(o, 'stone', 3.9, floor - 0.15, 5.2, 17.6, 0.16, 2.7, concrete);
  for (const x of [-4.7, 12.45]) B(o, 'wall', x, floor, 5.2, 0.35, 2.2, 2.7, stucco);
  for (const z of [3.85, 6.5]) B(o, 'wood', 3.9, floor + 2.3, z, 17.7, 0.22, 0.18, wood);
  if (d) {
    const count = d === 1 ? 12 : 30;
    for (let i = 0; i < count; i++)
      B(o, 'wood', -4.5 + (17.0 * i) / (count - 1), floor + 2.5, 5.2, 0.1, 0.16, 2.95, wood);
  }
  // Main garden floor is kept below the room floors, surrounded by an L-shaped loggia and planters.
  B(o, 'stone', 5.8, -1, 0.0, 12.6, 2.3, 8.5, paving);
  if (d) {
    for (const x of [-0.45, 11.85]) B(o, 'stone', x, 1.31, -0.25, 0.35, 0.12, 7.8, concrete);
    B(o, 'stone', 5.7, 1.31, -4.15, 12.1, 0.12, 0.35, concrete);
  }
  // Northern covered approach: restrained open upper slots between solid piers.
  B(o, 'stone', -6.6, -2, -23.4, 2.6, 3.7, 21.0, concrete);
  if (!d) {
    B(o, 'wall', -6.6, 1.7, -23.4, 2.6, 2.6, 21.0, stucco);
  } else {
    for (const x of [-7.8, -5.4]) {
      B(o, 'wall', x, 1.7, -23.4, 0.25, 1.28, 21, stucco);
      for (let i = 0; i < 12; i++) B(o, 'wall', x, 2.98, -33.6 + i * 1.86, 0.3, 0.95, 0.27, stucco);
    }
    B(o, 'roof', -6.6, 4.08, -23.4, 2.8, 0.18, 21.2, roofing);
    for (const x of [-7.92, -5.28]) B(o, 'stone', x, 4.26, -23.4, 0.18, 0.22, 21.2, concrete);
    for (let i = 0; i < 8; i++)
      B(o, 'stone', -6.6, 0, -36.2 + i * 0.3, 2.8, (i + 1) * 0.21, 0.32, concrete);
  }
  // Raised western lawns and low terrace retaining walls, broad end stairs and paired finials.
  for (const z of [-8.7, 8.0]) {
    B(o, 'stone', -14.7, -1, z, 5.1, 2.0, 8.0, paving);
    wall(o, -17.4, z, 0.36, 8.25, 1.7, d);
  }
  for (const z of [-12.9, 12.2]) {
    wall(o, -14.7, z, 5.7, 0.36, 1.7, d);
    const f = facing(o, z < 0 ? Math.PI : 0, -14.7, z + (z < 0 ? -0.2 : 0.2));
    steps(f, 0, 0.1, 4.2, 5, 0.23, 0.3, -0.15);
  }
  wall(o, -12.05, 20, 0.3, 15.4, 1.2, d);
  // West reflecting basin: rectangular perimeter and cross channels remain visible in the dry current form.
  B(o, 'stone', -25.1, -1, -0.25, 8.4, 1.15, 8.15, paving);
  if (d) {
    for (const x of [-29.3, -20.9]) wall(o, x, -0.25, 0.24, 8.2, 0.55, d);
    for (const z of [-4.3, 3.8]) wall(o, -25.1, z, 8.5, 0.24, 0.55, d);
    for (const x of [-28.2, -22.1]) B(o, 'stone', x, 0.2, -0.25, 0.18, 0.18, 7.5, concrete);
    for (const z of [-3.25, 2.75]) B(o, 'stone', -25.1, 0.2, z, 7.1, 0.18, 0.18, concrete);
    const f = facing(o, -Math.PI / 2, -21.0, -0.25);
    B(o, 'stone', -21.55, 0.4, -0.25, 1.45, 1.3, 6.3, concrete);
    wall(o, -22.25, -0.25, 0.3, 5.6, 2.0, d);
    for (const x of [-2.95, 2.95]) steps(f, x, 1.3, 1.1, 5, 0.24, 0.3, 0.5);
  }
  // East circular pool and semicircular outer terrace: no sculpture or vegetation copied.
  const seg = d === 0 ? 12 : d === 1 ? 16 : 32;
  prism(
    o,
    Array.from({ length: seg }, (_, i) => [
      17.2 + 4.5 * Math.cos((i * Math.PI * 2) / seg),
      -0.25 + 4.5 * Math.sin((i * Math.PI * 2) / seg),
    ]),
    -0.8,
    1.25,
    'stone',
    concrete,
  );
  if (d) {
    cap(
      o,
      Array.from({ length: seg }, (_, i) => [
        17.2 + 4.28 * Math.cos((i * Math.PI * 2) / seg),
        -0.25 + 4.28 * Math.sin((i * Math.PI * 2) / seg),
      ]),
      1.29,
      'pool',
      rgb('65ada3'),
    );
    ring(o, 17.2, -0.25, 4.28, 4.5, 1.27, 1.5, seg, d);
    for (let i = 0; i < 3; i++)
      ring(
        o,
        17.2,
        -0.25,
        5.0 + i * 0.43,
        5.43 + i * 0.43,
        -1,
        1.48 + i * 0.17,
        Math.ceil(seg / 2),
        d,
        true,
      );
  }
  // South garden and semicircular end, with a narrow east porch under the bedroom.
  B(o, 'stone', 4.3, -1, 15.3, 14.2, 2.4, 8.0, paving);
  const south = [
    [-1.0, 19.3],
    [0, 20.5],
    [0, 21.4],
    ...Array.from({ length: seg / 2 + 1 }, (_, i) => [
      4.3 + 5.1 * Math.cos(Math.PI - (i * Math.PI) / (seg / 2)),
      21.4 + 5.1 * Math.sin(Math.PI - (i * Math.PI) / (seg / 2)),
    ]),
    [9.4, 20.5],
    [10.6, 19.3],
  ];
  prism(o, south, -1, 1.4, 'stone', paving);
  for (const [x, z, w, dep] of [
    [-2.7, 17.1, 0.28, 4.4],
    [0.0, 19.2, 5.5, 0.28],
    [10.1, 18.2, 3.5, 0.28],
    [11.8, 15.3, 0.28, 6.1],
  ])
    wall(o, x, z, w, dep, 2.05, d);
  if (d) ring(o, 4.3, 21.4, 5.05, 5.32, -1, 1.8, Math.ceil(seg / 2), d, 'south');
  B(o, 'stone', 14.5, -1, 18.1, 2.65, 2.7, 4.3, concrete);
  steps(facing(o, 0, 14.5, 20.3), 0, 0, 2.65, 6, 0.24, 0.27, 0.25);
  // Roof access flights and the characteristic paired planter finials.
  if (d) {
    for (const z of [-4.45, 4.15]) {
      const f = facing(o, z < 0 ? Math.PI : 0, -4.8, z);
      steps(
        f,
        0,
        0,
        1.45,
        d === 1 ? 5 : 12,
        2.94 / (d === 1 ? 5 : 12),
        2.04 / (d === 1 ? 5 : 12),
        1.7,
      );
      for (const x of [-5.7, -3.85]) finial(o, x, z + (z < 0 ? 1.87 : -1.87), 4.55, d);
    }
    for (const [x, z] of [
      [-17.45, -4.4],
      [-17.45, 4.15],
    ])
      finial(o, x, z, 1.8, d);
  }
  if (d > 1) {
    B(o, 'wall', -12.7, 6.6, 2.6, 3.5, 0.85, 1.4, stucco);
    B(o, 'roof', -12.7, 7.46, 2.6, 3.15, 0.05, 1.05, roofing);
    for (const x of [-14, -11.4])
      face(facing(o, 0, x, 3.32), 'wood', 0, 6.8, 0.02, 0.9, 0.25, wood);
  }
  if (d > 2) westConstruction(o);
}
export function hollyhockSkyline(o) {
  hollyhock(o, undefined, 0);
}
export function hollyhockDistrict(o) {
  hollyhock(o, undefined, 1);
}
export function hollyhockStreet(o) {
  hollyhock(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.93, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  pool: { slot: 'window', roughness: 0.23, metallic: 0.12, localRef: 'palette:#feffff' },
  relief: { slot: 'trim', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  reveal: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  recessWood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  recessGlass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const hollyhockModel = {
  id: 'hollyhock_house',
  recipe: 'structure-hollyhock-house.mjs',
  key: 'hollyhock_house',
  cell: '9q/9q5',
  title: 'Hollyhock House',
  brief:
    'Low buff stucco courtyard house with ten-degree battered upper walls, flat terrace roofs, geometric hollyhock friezes, west living-room projection and reflecting basin, raised west lawns, north entrance gallery, east upper bridge and circular pool, south garden and paired stair finials.',
  camera: [-65, 46, 63],
  lookAt: [-3, 3, -3],
  qaCameras: [
    { name: 'front', position: [-70, 19, 44], lookAt: [-5, 3, 0] },
    { name: 'back', position: [65, 25, -45], lookAt: [2, 3, -2] },
    { name: 'west-reliefs', position: [-25.5, 4.65, 1.3], lookAt: [-20.8, 4.25, -0.25] },
    { name: 'west-windows', position: [-26, 2.9, -1.4], lookAt: [-20.8, 2.65, -0.25] },
  ],
  build: hollyhock,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Ground beside northern entrance gallery at local [-8,-18], model Y=0; main first floor Y=1.7. Independent USGS bare-earth datum.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hollyhock-house.mjs',
    level: 'skyline',
    export: 'hollyhockSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'hollyhockDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'hollyhockStreet', errorMeters: 0.05, surfaces },
    },
  },
  limitations: [
    'New close-only18solid west frieze reliefs/two decorated piers and five physical west-window recesses use two exact native Highsmith public-domain exteriors after a cleared Qualla-first search. Original three lower levels and geometry outside bounded western replacements retained. Relief count follows inspected native2013frieze; .40mrecess, rods/serrations/profiles and frame craft are medium-fi interpretations. Earlier attribution/private guide/satellite imagery excluded as current controls. Full fixed house/court/eastbridge/roof/northgallery/attached terraces/pools retained; wider review pending.',
    'Original medium-fi exterior from individually inspected Qualla photographs, HABS CA-356 description, official 2024 museum floor plan and aerial roof context. Dimensions, hidden joins and relief are interpretations, not surveyed measurements.',
    'Main house, north entrance gallery, attached terraces and basins included. Long northern pet pergola, other park buildings, interiors, vegetation, visitors, furniture, pool sculpture, temporary construction coverings and reference-photo pixels excluded.',
    'Independent USGS CA_LosAngeles_B23 ground preserved unmodified. Ground under buildings is source-interpolated; host terrain may differ. Preview placement retains footprint replacement disabled.',
    'The mapped 18.7 m height is rejected as incompatible with the documented one/two-storey house. Upper east range and bridge are authored at 8.4 m above entrance-garden datum.',
    'Hollyhock relief and art-glass patterns are simplified and progressively omitted at distant detail levels. No physical-device frame-rate measurement is claimed.',
  ],
};
