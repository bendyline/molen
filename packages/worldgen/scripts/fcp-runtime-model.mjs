/** First Canadian Place: independent browser levels; the instanced source recipe is preserved. */
import { normalFor } from './authored-structure-mesh.mjs';
import { firstCanadianPlaceStudy } from './first-canadian-place-model.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const X = 28.956,
  Z = 27.432,
  A = 24.384,
  B = 22.86;
const interval = 3.8608,
  officeBase = 287.1 - 69 * interval;
const crownBase = 287.1 - 2 * interval + 1.75,
  parapet = 289.9;
const white = [0.8, 0.81, 0.78],
  silver = [0.61, 0.64, 0.64];
const vision = [0.24, 0.255, 0.24],
  bronze = [0.31, 0.28, 0.23],
  granite = [0.48, 0.49, 0.46];
const plan = [
  [-A, -Z],
  [-A, -B],
  [-X, -B],
  [-X, B],
  [-A, B],
  [-A, Z],
  [A, Z],
  [A, B],
  [X, B],
  [X, -B],
  [A, -B],
  [A, -Z],
];
const face = (out, slot, p, color) =>
  p.length === 3
    ? out.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        normalFor(...p),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      )
    : quad(out, slot, p, normalFor(...p), color);
function edge(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  const vector = ([x, y, z]) => [ux * x - uz * z, y, uz * x + ux * z],
    point = (p) => {
      const q = vector(p);
      return [q[0] + a[0], q[1], q[2] + a[1]];
    };
  return {
    length,
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}
function panel(o, x0, x1, y0, y1, slot, color, depth = 0) {
  if (y1 - y0 < 0.001) return;
  face(
    o,
    slot,
    [
      [x0, y0, depth],
      [x1, y0, depth],
      [x1, y1, depth],
      [x0, y1, depth],
    ],
    color,
  );
}
function plate(out, y0, y1, slot = 'concrete', color = granite) {
  box(out, slot, [-X, y0, -B], [X, y1, B], color);
  box(out, slot, [-A, y0, -Z], [A, y1, -B], color);
  box(out, slot, [-A, y0, B], [A, y1, Z], color);
}
function remap(out, accept = () => true) {
  const mapped = (s) => (['fcp_vision', 'bronze_glass', 'recess'].includes(s) ? 'glass' : s);
  return {
    addQuad: (s, r, p, n, u, c) => {
      if (accept(p)) out.addQuad(mapped(s), r, p, n, u, c);
    },
    addTriangle: (s, r, p, n, u, c) => {
      if (accept(p)) out.addTriangle(mapped(s), r, p, n, u, c);
    },
    addConvexPolygon: (s, r, p, n, u, c) => {
      if (accept(p)) out.addConvexPolygon(mapped(s), r, p, n, u, c);
    },
  };
}
function lobby(out, level) {
  plate(out, 0, 0.13, 'stone');
  plate(out, 7.0104, 7.2, 'concrete', white);
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]),
      corner = o.length < 10,
      n = corner ? 2 : Math.round(o.length / 3.048),
      w = o.length / n;
    panel(
      o,
      0,
      o.length,
      0.13,
      7.0104,
      corner ? 'glass' : 'clear_glass',
      corner ? bronze : [0.67, 0.71, 0.67],
      corner ? -0.04 : -3.25,
    );
    if (!corner && level !== 'skyline')
      for (let j = 0; j < n; j += level === 'district' ? 4 : 1) {
        box(o, 'frit', [j * w, 0.35, -0.68], [j * w + 0.42, 7.01, 0.02], white);
        if (level === 'street') {
          box(o, 'stone', [j * w, 0.13, -0.72], [j * w + 0.44, 0.35, 0.05], granite);
          tube(
            o,
            'stainless',
            [j * w + 1.3, 0.13, 0.75],
            [j * w + 1.3, 1.05, 0.75],
            0.072,
            silver,
            6,
          );
        }
      }
    if (!corner && level === 'street') {
      const mid = (Math.floor(n / 2) + 0.5) * w;
      for (const x of [mid - 1.06, mid, mid + 1.06])
        box(o, 'stainless', [x - 0.035, 0.14, -3.21], [x + 0.035, 2.77, -3.15], silver);
      box(o, 'stainless', [mid - 1.1, 2.77, -3.21], [mid + 1.1, 2.83, -3.15], silver);
    }
    for (let row = 0; row < 2; row++) {
      const y = 7.2 + (row * (officeBase - 7.2)) / 2,
        h = (officeBase - 7.2) / 2;
      panel(o, 0, o.length, y, y + h * 0.65, 'glass', corner ? bronze : vision, -0.07);
      panel(
        o,
        0,
        o.length,
        y + h * 0.65,
        y + h,
        corner ? 'glass' : 'frit',
        corner ? bronze : white,
      );
    }
  }
  if (level === 'street') {
    box(out, 'stone', [-X + 3.4, 0.13, -B + 0.1], [X - 3.4, 0.2, B - 0.1], granite);
    for (const z of [-9, 6]) box(out, 'marble', [-11, 0.2, z], [11, 7, z + 3], [0.8, 0.79, 0.74]);
  }
}
function bands(out, level) {
  const stride = level === 'skyline' ? 5 : 1;
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]),
      corner = o.length < 10;
    if (level === 'skyline' && corner) {
      const fraction = 1.75 / interval,
        tint = vision.map((v, i) => v * fraction + bronze[i] * (1 - fraction));
      panel(o, 0, o.length, officeBase, parapet, 'glass', tint, -0.04);
      continue;
    }
    for (let row = 0; row < 70; row += stride) {
      const y = officeBase + row * interval,
        hi = Math.min(y + stride * interval, corner ? parapet : crownBase),
        split = Math.min(hi, y + stride * 1.75);
      panel(o, 0, o.length, y, split, 'glass', vision, -0.085);
      panel(o, 0, o.length, split, hi, corner ? 'glass' : 'frit', corner ? bronze : white);
    }
    if (!corner) {
      panel(o, 0, o.length, crownBase, parapet, 'frit', white);
      // At distant scales the red roundel is the readable part of the BMO identity panel.
      if (level !== 'street') roundel(o, 17.1, crownBase + 4.45, level === 'skyline' ? 6 : 12);
    }
    panel(o, 0, o.length, parapet - 0.035, parapet, 'stainless', silver, 0.025);
  }
}
function roundel(o, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    const p = [
      [x, y, 0.16],
      [x + 2.55 * Math.cos(a), y + 2.55 * Math.sin(a), 0.16],
      [x + 2.55 * Math.cos(b), y + 2.55 * Math.sin(b), 0.16],
    ];
    o.addTriangle(
      'metal',
      'palette:#ffffff',
      p,
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      [0.73, 0.025, 0.035],
    );
  }
  panel(o, x - 1.65, x + 1.65, y - 0.9, y - 0.15, 'metal', white, 0.17);
  face(
    o,
    'metal',
    [
      [x - 1.65, y - 0.12, 0.17],
      [x - 0.83, y + 1.24, 0.17],
      [x, y - 0.12, 0.17],
    ],
    white,
  );
  face(
    o,
    'metal',
    [
      [x, y - 0.12, 0.17],
      [x + 0.83, y + 1.24, 0.17],
      [x + 1.65, y - 0.12, 0.17],
    ],
    white,
  );
}
function mast(out, x, z, height, whiteTop, level) {
  const bottom = parapet - 0.12,
    cap = whiteTop ? height - 15.8 : height - 0.6;
  if (level !== 'street') {
    // Consolidated mast envelopes replace sub-pixel latticework at distant scales.
    box(out, 'stainless', [x - 0.82, bottom, z - 0.82], [x + 0.82, cap, z + 0.82], silver);
  } else {
    const points = [
        [-0.82, -0.82],
        [0.82, -0.82],
        [0.82, 0.82],
        [-0.82, 0.82],
      ],
      p = (a, y) => [x + a[0], y, z + a[1]],
      stages = Math.ceil((cap - bottom) / 12);
    for (const a of points) tube(out, 'stainless', p(a, bottom), p(a, cap), 0.052, silver, 4);
    for (let i = 0; i < stages; i++)
      for (let k = 0; k < 4; k++) {
        const lo = bottom + (i * (cap - bottom)) / stages,
          hi = bottom + ((i + 1) * (cap - bottom)) / stages;
        tube(out, 'stainless', p(points[k], lo), p(points[(k + 1) % 4], hi), 0.025, silver, 3);
      }
    if (!whiteTop)
      for (let y = cap - 19; y < cap - 1; y += 4.7)
        for (const sign of [-1, 1])
          box(
            out,
            'metal',
            [x + sign * 1.18 - 0.19, y, z - 0.5],
            [x + sign * 1.18 + 0.19, y + 1.8, z + 0.5],
            [0.48, 0.48, 0.43],
          );
  }
  tube(
    out,
    whiteTop ? 'metal' : 'stainless',
    [x, cap, z],
    [x, height, z],
    whiteTop ? 0.43 : 0.025,
    whiteTop ? white : silver,
    level === 'street' ? 8 : 6,
  );
}
function roof(out, level) {
  plate(out, parapet - 0.22, parapet - 0.13, 'glass', [0.47, 0.46, 0.41]);
  box(out, 'concrete', [-16, parapet - 0.13, -13], [16, 297.88, 13], white);
  box(out, 'metal', [-16.1, 297.88, -13.1], [16.1, 298.1, 13.1], silver);
  if (level === 'street')
    for (const [a, b] of [
      [
        [-16, -13],
        [-16, 13],
      ],
      [
        [-16, 13],
        [16, 13],
      ],
      [
        [16, 13],
        [16, -13],
      ],
      [
        [16, -13],
        [-16, -13],
      ],
    ]) {
      const o = edge(out, a, b);
      for (let x = 2; x < o.length - 2; x += 6) {
        panel(o, x, x + 2.4, 293.6, 296, 'glass', [0.11, 0.115, 0.105], 0.004);
        for (let y = 293.65; y < 295.95; y += 0.55)
          panel(o, x, x + 2.4, y, y + 0.075, 'stainless', silver, 0.055);
      }
    }
  mast(out, -7, -19, 355, false, level);
  mast(out, -7, 19, 351, true, level);
  tube(out, 'stainless', [7, parapet, 0], [7, 331.5, 0], 0.16, silver, level === 'street' ? 8 : 6);
}
const means = {
  frit: [0.8445316067536404, 0.8486575984558448, 0.8486575984558448],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  stainless: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
  stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
  marble: [0.9160827848592121, 0.9160827848592121, 0.9160827848592121],
};
function bake(out) {
  const color = (s, c) => c.map((v, i) => v * (means[s]?.[i] ?? 1));
  return {
    addQuad: (s, _r, p, n, u, c) => out.addQuad('wall', 'palette:#ffffff', p, n, u, color(s, c)),
    addTriangle: (s, _r, p, n, u, c) =>
      out.addTriangle('wall', 'palette:#ffffff', p, n, u, color(s, c)),
    addConvexPolygon: (s, _r, p, n, u, c) =>
      out.addConvexPolygon('wall', 'palette:#ffffff', p, n, u, color(s, c)),
  };
}
export function buildFcpSkyline(out) {
  const o = bake(out);
  lobby(o, 'skyline');
  bands(o, 'skyline');
  roof(o, 'skyline');
}
export function buildFcpDistrict(out) {
  lobby(out, 'district');
  bands(out, 'district');
  roof(out, 'district');
}
export function buildFcpStreet(out) {
  firstCanadianPlaceStudy.build(
    remap(out, (p) => p.every((q) => q[1] >= 7.15 && q[1] <= parapet + 0.0001)),
  );
  // The original transitional bands start at 7.2 m; the independent lobby ends there.
  // Avoid adding the transitional panels a second time.
  const lower = remap(out, (p) => p.every((q) => q[1] <= 7.2 + 0.0001));
  lobby(lower, 'street');
  roof(out, 'street');
}
export function buildFcpCloseup(out) {
  firstCanadianPlaceStudy.build(remap(out));
}
