/** Shun Hing Square: preserved twin-cylinder identity with complete apartment/shopping complex. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'shun_hing_square',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  source: {
    cylinder: 32,
    mast: 12,
    floors: 69,
    dx: 1.6,
    dy: 4.4,
    tolerance: 0.12,
    crownFrames: 12,
    detail: true,
  },
  closeup: {
    cylinder: 32,
    mast: 12,
    floors: 69,
    dx: 1.6,
    dy: 4.4,
    tolerance: 0.12,
    crownFrames: 12,
    detail: true,
  },
  street: {
    cylinder: 24,
    mast: 8,
    floors: 69,
    dx: 6.4,
    dy: 13.2,
    tolerance: 0.2,
    crownFrames: 8,
    detail: false,
  },
  district: {
    cylinder: 12,
    mast: 6,
    floors: 17,
    dx: 17.2,
    dy: 35.2,
    tolerance: 0.6,
    crownFrames: 0,
    detail: false,
  },
  skyline: {
    cylinder: 8,
    mast: 4,
    floors: 7,
    dx: 0,
    dy: 0,
    tolerance: 1,
    crownFrames: 0,
    detail: false,
  },
};
let active;
const part = (_key, id) => map.elements.find((p) => p.id === id);
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.02);
}
function grid(out, p, tint, _dx, _dy, _width, trim) {
  face(out, 'glass', p, tint);
  const c = active;
  if (!c.dx) return;
  const n = normalFor(...p.slice(0, 3)),
    len = Math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
    nx = Math.max(1, Math.ceil(len / c.dx));
  for (let j = 0; j <= nx; j++) {
    const a = Math.max(0, j / nx - 0.035 / len),
      b = Math.min(1, j / nx + 0.035 / len);
    face(
      out,
      'metal',
      [lerp(p[0], p[1], a), lerp(p[0], p[1], b), lerp(p[3], p[2], b), lerp(p[3], p[2], a)].map(
        (p) => shift(p, n, 0.04),
      ),
      trim,
    );
  }
  for (let y = p[0][1] + c.dy; y < Math.min(p[2][1], p[3][1]); y += c.dy) {
    const a = lerp(p[0], p[3], (y - p[0][1]) / (p[3][1] - p[0][1])),
      b = lerp(p[1], p[2], (y - p[1][1]) / (p[2][1] - p[1][1]));
    face(
      out,
      'metal',
      [
        [a[0], y - 0.08, a[2]],
        [b[0], y - 0.08, b[2]],
        [b[0], y + 0.08, b[2]],
        [a[0], y + 0.08, a[2]],
      ].map((p) => shift(p, n, 0.04)),
      trim,
    );
  }
}
function curtain(out, plan, lo, hi, { tint, trim, slot = 'metal' }) {
  const c = active;
  for (const { a, b, len, n } of edges(plan)) {
    const at = (u, y) => [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u];
    face(out, 'glass', [at(0, lo), at(1, lo), at(1, hi), at(0, hi)], tint);
    if (c.dy)
      for (let y = lo + c.dy; y < hi - 0.1; y += c.dy)
        face(
          out,
          slot,
          [at(0, y - 0.1), at(1, y - 0.1), at(1, y + 0.1), at(0, y + 0.1)].map((p) =>
            shift(p, n, 0.04),
          ),
          trim,
        );
    if (c.dx) {
      const nx = Math.max(1, Math.ceil(len / c.dx));
      for (let j = 0; j <= nx; j++) {
        const u = Math.max(0, j / nx - 0.035 / len),
          v = Math.min(1, j / nx + 0.035 / len);
        face(
          out,
          slot,
          [at(u, lo), at(v, lo), at(v, hi), at(u, hi)].map((p) => shift(p, n, 0.05)),
          trim,
        );
      }
    }
  }
}
function bandPlan(out, plan, y, h, depth, color, slot) {
  for (const { a, b, n } of edges(plan))
    face(
      out,
      slot,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ].map((p) => shift(p, n, depth)),
      color,
    );
}
function annex(out, c) {
  const parts = map.elements,
    plan = (id) =>
      cleanPlan(
        partPlan(
          map,
          parts.find((p) => p.id === id),
        ),
        c.tolerance,
      ),
    floor = (n) => (n <= 5 ? n * 4.4 : 22 + (n - 5) * 3.4);
  const base = plan(773700361);
  mappedSolid(out, 'stone', base, 0, 0.25, [0.49, 0.45, 0.38]);
  const mass = (p, lo, hi, white = true) => {
    mappedSolid(out, 'cladding', p, lo, hi, [0.78, 0.77, 0.7]);
    for (const { a, b, n, len } of edges(p)) {
      if (len < 3 && !c.dx) continue;
      const fstep = c.dx ? Math.max(3.4, c.dy) : 34;
      for (let y = lo + 1.4; y < hi - 1; y += fstep) {
        const top = Math.min(y + (white ? Math.min(fstep * 0.4, 1.5) : fstep * 0.65), hi - 0.5),
          at = (u, h) => shift([a[0] + (b[0] - a[0]) * u, h, a[1] + (b[1] - a[1]) * u], n, 0.035);
        face(
          out,
          'glass',
          [at(0.05, y), at(0.95, y), at(0.95, top), at(0.05, top)],
          [0.15, 0.3, 0.3],
        );
      }
    }
  };
  mass(base, 0.25, 22);
  for (const id of [773700360, 773700362, 773700363]) {
    const p = parts.find((p) => p.id === id);
    mass(
      plan(id),
      Math.max(22, floor(+p.tags['building:min_level'])),
      floor(+p.tags['building:levels']),
    );
  }
  // Photographs show a tall west wing; the mapped nine-level way describes its lower enclosure.
  const lower = plan(773700360),
    west = [];
  for (let i = 0; i < lower.length; i++) {
    const a = lower[i],
      b = lower[(i + 1) % lower.length];
    if (a[1] >= 148) west.push(a);
    if (a[1] < 148 !== b[1] < 148) west.push(lerp(a, b, (148 - a[1]) / (b[1] - a[1])));
  }
  mass(west, 35.6, 117.2);
  const core = plan(1207071443);
  mappedSolid(out, 'cladding', core, 35.6, 59.4, [0.7, 0.69, 0.62]);
  for (const id of [781166574, 781166575])
    mappedSolid(out, 'metal', plan(id), 32.2, 35.6, [0.88, 0.55, 0.07]);
  const spine = plan(781166576),
    theta = (71 * Math.PI) / 180,
    E = Math.sin(theta),
    S = -Math.cos(theta),
    dir = [
      E * Math.cos(map.heading) - S * Math.sin(map.heading),
      E * Math.sin(map.heading) + S * Math.cos(map.heading),
    ],
    proj = spine.map((q) => q[0] * dir[0] + q[1] * dir[1]),
    max = Math.max(...proj),
    roof = (q) => 124 + (max - q[0] * dir[0] - q[1] * dir[1]) * Math.tan((8 * Math.PI) / 180);
  for (const { a, b } of edges(spine))
    face(
      out,
      'metal',
      [
        [a[0], 117.2, a[1]],
        [b[0], 117.2, b[1]],
        [b[0], roof(b), b[1]],
        [a[0], roof(a), a[1]],
      ],
      [0.68, 0.11, 0.075],
    );
  const top = spine.map((q) => [q[0], roof(q), q[1]]).toReversed();
  for (let i = 1; i < top.length - 1; i++)
    tri(out, 'metal', [top[0], top[i], top[i + 1]], [0.68, 0.11, 0.075]);
  // Reconstructed rounded glass end, with the distinct join below its upper tube.
  const center = [-2, 177],
    r = 4.8,
    end = radialRing(0, r, r, c.cylinder, center).map((p) => [p[0], p[2]]);
  mappedSolid(out, 'stone', end, 0, 0.25, [0.49, 0.45, 0.38]);
  for (const [lo, hi] of [
    [0.25, 56],
    [59.4, 117.2],
  ]) {
    curtain(out, end, lo, hi, { tint: [0.12, 0.35, 0.36], trim: [0.57, 0.64, 0.6] });
    mappedCap(out, 'metal', end, lo, [0.21, 0.25, 0.24], [], true);
    mappedCap(out, 'metal', end, hi, [0.21, 0.25, 0.24]);
  }
  loft(
    out,
    'glass',
    [radialRing(56, 4.1, 4.1, c.cylinder, center), radialRing(59.4, 4.1, 4.1, c.cylinder, center)],
    [0.1, 0.24, 0.24],
  );
  const water = [
    [-14, 126],
    [-14, 145],
    [-7.5, 145],
    [-7.5, 126],
  ];
  mappedCap(out, 'glass', water, 35.64, [0.08, 0.37, 0.55]);
}
function cleanPlan(plan, tolerance = 0.12) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function build(out, level) {
  const m = map,
    c = settings[level];
  active = c;
  const key = 'shun_hing_square',
    body = [
      [-23.88, -19.44],
      [-23.88, 19.44],
      [23.52, 19.44],
      [23.52, -19.44],
    ],
    whole = localOutline(m),
    white = [0.76, 0.79, 0.73],
    green = [0.16, 0.39, 0.38];
  mappedSolid(out, 'stone', whole, 0, 0.25, [0.52, 0.47, 0.39]);
  const podium = partPlan(m, part(key, 1145586647));
  curtain(out, podium, 0.25, 22, {
    dx: 3.2,
    dy: 4.3,
    tint: [0.23, 0.34, 0.33],
    frame: 0.42,
    trim: [0.7, 0.66, 0.57],
    slot: 'cladding',
  });
  mappedCap(out, 'stone', podium, 22, [0.68, 0.65, 0.56]);
  // Rectangular main volume has curved side cutouts for the two glass cylinders.
  for (const { a, b, len, n } of edges(body)) {
    for (let f = 0; f < c.floors; f++) {
      const lo = 0.25 + ((302 - 0.25) * f) / c.floors,
        hi = 0.25 + ((302 - 0.25) * (f + 1)) / c.floors;
      grid(
        out,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi - (1.4 * 69) / c.floors, b[1]],
          [a[0], hi - (1.4 * 69) / c.floors, a[1]],
        ],
        green,
        1.5,
        4.5,
        0.045,
        [0.62, 0.68, 0.64],
      );
      face(
        out,
        'metal',
        [
          [a[0], hi - (1.4 * 69) / c.floors, a[1]],
          [b[0], hi - (1.4 * 69) / c.floors, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ].map((p) => shift(p, n, 0.035)),
        white,
      );
    }
    if (len > 35) {
      // An inset vertical green center panel interrupts the upper horizontal bands.
      const aa = lerp(a, b, 0.41),
        bb = lerp(a, b, 0.59);
      grid(
        out,
        [
          [aa[0], 220, aa[1]],
          [bb[0], 220, bb[1]],
          [bb[0], 301.9, bb[1]],
          [aa[0], 301.9, aa[1]],
        ].map((p) => shift(p, n, 0.13)),
        [0.16, 0.38, 0.37],
        1.5,
        3.8,
        0.04,
        [0.48, 0.6, 0.56],
      );
      for (let j = 1; c.dx && j < 8; j++) {
        const q = lerp(a, b, j / 8);
        beam(
          out,
          'metal',
          shift([q[0], 0.25, q[1]], n, 0.075),
          shift([q[0], 301.9, q[1]], n, 0.075),
          0.12,
          0.15,
          [0.56, 0.55, 0.45],
        );
      }
    }
  }
  mappedCap(out, 'metal', body, 302, [0.58, 0.65, 0.62]);
  // Reconstructed stone base and the photographed triangular glass portal on the east side.
  for (const { a, b, n } of edges(body))
    face(
      out,
      'cladding',
      [
        [a[0], 0.25, a[1]],
        [b[0], 0.25, b[1]],
        [b[0], 22, b[1]],
        [a[0], 22, a[1]],
      ].map((p) => shift(p, n, 0.12)),
      [0.52, 0.47, 0.39],
    );
  tri(
    out,
    'glass',
    [
      [7, 0.25, -19.6],
      [-7, 0.25, -19.6],
      [0, 21.8, -19.6],
    ],
    [0.065, 0.13, 0.13],
  );
  for (const x of [-7, 7])
    beam(out, 'cladding', [x, 0.25, -19.72], [0, 21.8, -19.72], 0.6, 0.65, [0.57, 0.53, 0.45]);
  for (const id of [188388373, 188388378]) {
    const mp = partPlan(m, part(key, id)),
      center = mp.reduce((s, p) => [s[0] + p[0] / mp.length, s[1] + p[1] / mp.length], [0, 0]),
      radius = 12.06;
    const cyl = radialRing(0, radius, radius, c.cylinder, center).map((p) => [p[0], p[2]]);
    curtain(out, cyl, 0.25, 313, {
      dx: 1.6,
      dy: 4.4,
      tint: [0.13, 0.37, 0.38],
      frame: 0.052,
      trim: [0.58, 0.66, 0.63],
    });
    const profile = [
      [313, 12.06],
      [315, 12.06],
      [318, 11.7],
      [320, 10.5],
      [321.5, 8.6],
      [322.2, 6.55],
      [329.3, 6.55],
      [331, 6.1],
      [332.5, 4.8],
      [333.5, 2.7],
      [334, 0.68],
    ];
    const crownProfile =
      level === 'skyline' ? profile.filter((_, i) => [0, 2, 5, 6, 9, 10].includes(i)) : profile;
    loft(
      out,
      'glass',
      crownProfile.map(([y, r]) => radialRing(y, r, r, c.cylinder, center)),
      [0.15, 0.4, 0.4],
    );
    for (const [y, r] of profile.filter((_, i) => c.dx || [0, 6].includes(i)).slice(0, -1))
      bandPlan(
        out,
        radialRing(y, r, r, c.cylinder, center).map((p) => [p[0], p[2]]),
        y,
        0.15,
        0.11,
        [0.65, 0.72, 0.69],
        'metal',
      );
    for (let a = 0; a < c.crownFrames; a++) {
      const theta = (a * Math.PI * 2) / c.crownFrames;
      for (let i = 1; i < profile.length; i++) {
        const [y0, r0] = profile[i - 1],
          [y1, r1] = profile[i];
        tube(
          out,
          'metal',
          [center[0] + Math.cos(theta) * r0, y0, center[1] + Math.sin(theta) * r0],
          [center[0] + Math.cos(theta) * r1, y1, center[1] + Math.sin(theta) * r1],
          0.048,
          [0.56, 0.66, 0.65],
          6,
        );
      }
    }
    loft(
      out,
      'metal',
      [
        [333.8, 0.68],
        [359, 0.45],
        [375, 0.22],
        [384, 0.035],
      ].map(([y, r]) => radialRing(y, r, r, c.mast, center)),
      [0.76, 0.78, 0.75],
    );
    for (const y of c.dx ? [340, 350, 360, 370, 380] : [])
      bandPlan(
        out,
        radialRing(y, 0.72, 0.72, c.mast, center).map((p) => [p[0], p[2]]),
        y,
        0.085,
        0.12,
        white,
        'metal',
      );
  }
  const roofBlock = [
    [-9, -8],
    [-9, 8],
    [9, 8],
    [9, -8],
  ];
  mappedSolid(out, 'metal', roofBlock, 302, 307, [0.52, 0.6, 0.56]);
  for (const z of c.detail ? [-7.8, 7.8] : [])
    for (let y = 302.5; y < 306.8; y += 0.4)
      beam(out, 'metal', [-8.5, y, z], [8.5, y, z], 0.13, 0.16, [0.34, 0.42, 0.38]);
  annex(out, c);
}
export function buildShunHingReviewedMaster(out) {
  build(out, 'source');
}
export function buildShunHingCloseup(out) {
  build(out, 'closeup');
}
export function buildShunHingStreet(out) {
  build(out, 'street');
}
export function buildShunHingDistrict(out) {
  build(out, 'district');
}
export function buildShunHingSkyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = { stone: 'stone_granite', cladding: 'concrete_plain', metal: 'metal_painted' }[
          component
        ],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  build(wrapped, 'skyline');
}
