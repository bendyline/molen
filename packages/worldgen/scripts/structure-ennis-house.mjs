/** Ennis House: articulated textile-block rooms, bridge, motor court and retaining terraces. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  moduleSize = 0.4064;
const buff = rgb('c7bda1'),
  light = rgb('d0c6ab'),
  joint = rgb('a59c85'),
  reliefShade = rgb('b3a88e'),
  glass = rgb('526362'),
  metal = rgb('716d58'),
  paving = rgb('b1a28d'),
  roof = rgb('aba99a');
const base = new URL(
  '../../../content/worldgen/source/places/9q/9q5/ennis_house/',
  import.meta.url,
);
function facing(o, a, x = 0, z = 0, y = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1] + y, r[2] + z];
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
function prism(o, r, lo, hi, s = 'wall', c = buff) {
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
      b = r[(i + 1) % r.length],
      n = [a[1] - b[1], 0, b[0] - a[0]];
    quad(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      n,
      c,
    );
  }
  cap(o, r, hi, s, c);
}
function motif(o, x, y, z, d) {
  // Restrained raised Greek-key-derived G; the photograph's fine cast texture stays material-scale.
  const p = [
      [-0.145, -0.145],
      [-0.145, 0.145],
      [0.145, 0.145],
      [0.145, -0.035],
      [-0.035, -0.035],
      [-0.035, 0.055],
      [0.055, 0.055],
    ],
    t = 0.034;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      nx = ((-dy / len) * t) / 2,
      ny = ((dx / len) * t) / 2,
      q = [
        [x + a[0] + nx, y + a[1] + ny, z + 0.055],
        [x + a[0] - nx, y + a[1] - ny, z + 0.055],
        [x + b[0] - nx, y + b[1] - ny, z + 0.055],
        [x + b[0] + nx, y + b[1] + ny, z + 0.055],
      ];
    quad(o, 'wall', q, [0, 0, 1], light);
    if (d > 2 && i === 1) {
      const side = [q[0], q[3], [q[3][0], q[3][1], z + 0.018], [q[0][0], q[0][1], z + 0.018]];
      quad(o, 'wall', side, normalFor(...side), reliefShade);
    }
  }
}
function textile(o, w, y, h, d, { pattern = 'bands', holes = [] } = {}) {
  if (d < 2) return;
  const rows = Math.floor(h / moduleSize),
    cols = Math.floor(w / moduleSize),
    left = (-cols * moduleSize) / 2;
  const hit = (x, yy, margin = 0) =>
    holes.some(
      (v) => Math.abs(x - v.x) < v.w / 2 + margin && yy > v.y - margin && yy < v.y + v.h + margin,
    );
  // Merge each joint across solid spans; do not tessellate every block into a box.
  const spans = (lo, hi, cuts) => {
    let out = [[lo, hi]];
    for (const [a, b] of cuts)
      out = out.flatMap(([l, r]) =>
        b <= l || a >= r
          ? [[l, r]]
          : [
              [l, Math.max(l, a)],
              [Math.min(r, b), r],
            ].filter(([x, y]) => y - x > 0.015),
      );
    return out;
  };
  const jointStep = d === 2 ? 3 : 1;
  for (let row = 0; row <= rows; row += jointStep) {
    const yy = y + row * moduleSize;
    if (yy > y + h - 0.015) continue;
    const cuts = holes
      .filter((v) => yy > v.y - 0.03 && yy < v.y + v.h + 0.03)
      .map((v) => [v.x - v.w / 2 - 0.03, v.x + v.w / 2 + 0.03]);
    for (const [l, r] of spans(left, -left, cuts))
      face(o, 'wall', (l + r) / 2, yy, 0.014, r - l, 0.012, joint);
  }
  for (let col = 0; col <= cols; col += jointStep) {
    const xx = left + col * moduleSize;
    const cuts = holes
      .filter((v) => Math.abs(xx - v.x) < v.w / 2 + 0.03)
      .map((v) => [v.y - 0.03, v.y + v.h + 0.03]);
    for (const [l, r] of spans(y, y + h, cuts)) face(o, 'wall', xx, l, 0.015, 0.012, r - l, joint);
  }
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x = left + (col + 0.5) * moduleSize,
        yy = y + (row + 0.5) * moduleSize;
      const patterned =
        pattern === 'all' ||
        (pattern === 'bands' && (row === rows - 1 || (row % 5 === 0 && yy > -3))) ||
        (pattern === 'border' && (row === rows - 1 || col === 0 || col === cols - 1));
      if (!patterned || hit(x, yy, moduleSize * 0.55)) continue;
      if (d === 2 && (col % 4 || row % 3)) continue;
      motif(o, x, yy, 0.015, pattern === 'all' ? d : 2);
    }
}
function win(o, x, y, w, h, d, { bars = 1, lead = false, door = false } = {}) {
  if (!d) return;
  face(o, door ? 'metal' : 'glass', x, y, 0.075, w, h, door ? rgb('494b40') : glass);
  if (d < 2) return;
  for (const xx of [x - w / 2, x + w / 2]) face(o, 'metal', xx, y, 0.1, 0.055, h, metal);
  for (const yy of [y, y + h - 0.045]) face(o, 'metal', x, yy, 0.1, w, 0.045, metal);
  for (let i = 1; i <= bars; i++)
    face(o, 'metal', x - w / 2 + (w * i) / (bars + 1), y, 0.106, 0.045, h, light);
  if (d > 2 && lead) {
    for (let i = 1; i < 8; i++) face(o, 'metal', x, y + (h * i) / 8, 0.11, w, 0.012, metal);
    for (const xx of [-0.3, 0, 0.3]) face(o, 'metal', x + xx * w, y, 0.115, 0.014, h, metal);
    for (let i = 0; i < 5; i++) {
      const yy = y + (h * (i + 0.4)) / 6;
      quad(
        o,
        'metal',
        [
          [x - w * 0.4, yy, 0.12],
          [x - w * 0.4, yy + 0.018, 0.12],
          [x + w * 0.4, yy + h * 0.13 + 0.018, 0.12],
          [x + w * 0.4, yy + h * 0.13, 0.12],
        ],
        [0, 0, 1],
        metal,
      );
    }
  }
}
function panel(o, w, y, h, d, opt = {}) {
  textile(o, w, y, h, d, opt);
  for (const v of opt.holes ?? []) win(o, v.x, v.y, v.w, v.h, d, v);
}
function room(
  o,
  x,
  z,
  w,
  dep,
  lo,
  hi,
  d,
  { south = [], north = [], east = [], west = [], pattern = 'bands' } = {},
) {
  B(o, 'wall', x, lo, z, w, hi - lo, dep, buff);
  B(o, 'roof', x, hi + 0.015, z, w - 0.18, 0.045, dep - 0.18, roof);
  if (d > 0) {
    for (const zz of [-1, 1])
      B(o, 'wall', x, hi - 0.12, z + zz * (dep / 2 - 0.08), w, 0.26, 0.16, light);
    for (const xx of [-1, 1])
      B(o, 'wall', x + xx * (w / 2 - 0.08), hi - 0.12, z, 0.16, 0.26, dep, light);
  }
  for (const [a, xx, zz, ww, holes] of [
    [0, x, z + dep / 2, w, south],
    [Math.PI, x, z - dep / 2, w, north],
    [Math.PI / 2, x + w / 2, z, dep, east],
    [-Math.PI / 2, x - w / 2, z, dep, west],
  ])
    panel(
      facing(o, a, xx, zz),
      ww,
      x > -5 ? Math.max(lo, 3.25) : lo,
      hi - (x > -5 ? Math.max(lo, 3.25) : lo),
      d,
      { holes, pattern },
    );
}
function wallRun(o, a, b, lo, hi, d, { pattern = 'border', thick = 0.5 } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    q = facing(o, Math.atan2(a[1] - b[1], b[0] - a[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  B(q, 'wall', 0, lo, 0, len, hi - lo, thick, buff);
  const innerPositive = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
  const pl = lo < -5 && innerPositive ? hi - 1.2 : lo,
    nl = lo < -5 && !innerPositive ? hi - 1.2 : lo;
  panel(facing(q, 0, 0, thick / 2 + 0.01), len, pl, hi - pl, d, { pattern });
  panel(facing(q, Math.PI, 0, -thick / 2 - 0.01), len, nl, hi - nl, d, { pattern });
  if (d) B(q, 'wall', 0, hi - 0.06, 0, len + 0.05, 0.12, thick + 0.09, light);
}
const h = (x, y, w, hh, bars = 1, lead = false) => ({ x, y, w, h: hh, bars, lead });
/** Closed iron sections and cut masonry openings from the original HABS gate sheet. */
function entryGates(o) {
  const c = JSON.parse(fs.readFileSync(new URL('gate-construction-controls.json', base))),
    uv = (p, n) => {
      const axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
      return p.map((v) => v.filter((_, i) => i !== axis));
    },
    metric = {
      addQuad: (s, r, p, n, _u, col) => o.addQuad(s, r, p, n, uv(p, n), col),
      addTriangle: (s, r, p, n, _u, col) => o.addTriangle(s, r, p, n, uv(p, n), col),
      addConvexPolygon: (s, r, p, n, _u, col) => {
        const u = uv(p, n);
        return o.addConvexPolygon(s, r, p, n, (v) => u[p.indexOf(v)], col);
      },
    },
    z = c.ironPlaneZ,
    rod = (a, b, width = c.barWidth) =>
      beam(metric, 'gateIron', [a[0], a[1], z], [b[0], b[1], z], c.ironDepth, width, metal),
    line = (p, width) => {
      for (let i = 1; i < p.length; i++) rod(p[i - 1], p[i], width);
    },
    rect = (x, y, w, ht, width = c.barWidth) =>
      line(
        [
          [x - w / 2, y],
          [x + w / 2, y],
          [x + w / 2, y + ht],
          [x - w / 2, y + ht],
          [x - w / 2, y],
        ],
        width,
      ),
    ironBox = (x, y, w, ht) => B(metric, 'gateIron', x, y, z, w, ht, c.ironDepth, metal),
    stone = (a, b, lo, hi) => {
      if (b - a > 0.001 && hi - lo > 0.001)
        B(metric, 'gateWall', (a + b) / 2, lo, 0, b - a, hi - lo, c.wallDepth, buff);
    },
    outer = c.outerWidth / 2,
    inner = outer - c.postWidth,
    service = c.service,
    sl = service.center - service.width / 2,
    sr = service.center + service.width / 2;
  // Join the retained outer bridge piers, while leaving two actual clear apertures.
  stone(-c.wallWidth / 2, sl, 0, c.wallHeight);
  stone(sr, -outer, 0, c.wallHeight);
  stone(sl, sr, 0, c.bottom);
  stone(sl, sr, c.bottom + service.height, c.wallHeight);
  stone(outer, c.wallWidth / 2, 0, c.wallHeight);
  stone(-outer, outer, c.portalHeight, c.wallHeight);
  // A repeated elongated rectangular loop, interpreted at medium-fi scale.
  const spindle = (x, lo, hi) => {
    rod([x, lo - 0.07], [x, hi + 0.07], 0.018);
    line(
      [
        [x - 0.04, lo],
        [x - 0.07, lo + 0.12],
        [x - 0.07, hi - 0.12],
        [x - 0.04, hi - 0.12],
        [x - 0.04, hi],
        [x + 0.04, hi],
        [x + 0.04, hi - 0.12],
        [x + 0.07, hi - 0.12],
        [x + 0.07, lo + 0.12],
        [x + 0.04, lo + 0.12],
        [x + 0.04, lo],
        [x - 0.04, lo],
      ],
      0.018,
    );
  };
  // Paired leaves are shown closed; the source drawing depicts one swung open.
  const leafWidth = inner - 0.01;
  for (const sign of [-1, 1]) {
    const center = sign * (leafWidth / 2 + 0.01),
      left = center - leafWidth / 2,
      right = center + leafWidth / 2,
      lo = c.bottom,
      hi = lo + c.leafHeight;
    rect(center, lo, leafWidth, c.leafHeight, 0.035);
    for (let i = 1; i <= 4; i++) spindle(left + (leafWidth * i) / 5, lo + 0.25, hi - 0.25);
    for (const y of [lo + 0.32, lo + 0.88, hi - 0.32]) rod([left, y], [right, y], 0.028);
    for (const scale of [1, 0.65])
      rect(center, lo + 0.68 + (1 - scale) * 0.17, 0.5 * scale, 0.38 * scale, 0.025);
    for (const x of [left + 0.08, right - 0.08])
      for (const y of [lo + 0.26, hi - 0.36]) ironBox(x, y, 0.13, 0.13);
    for (const y of [lo + 0.12, hi - 0.12])
      for (const sx of [-1, 1]) {
        const x = center + sx * (leafWidth / 2 - 0.15);
        line(
          [
            [x, y],
            [x - sx * 0.24, y],
            [x - sx * 0.24, y + 0.1],
            [x - sx * 0.09, y + 0.1],
            [x - sx * 0.09, y + 0.04],
          ],
          0.022,
        );
      }
  }
  // Tall fixed flank panels with simplified closed figure plates and curls.
  const figure = [
    [-0.12, 0.3],
    [0.02, 0.3],
    [0.01, 0.74],
    [0.1, 0.72],
    [0.13, 0.38],
    [0.23, 0.38],
    [0.18, 0.92],
    [0.11, 1.06],
    [0.15, 1.28],
    [0.21, 1.38],
    [0.18, 1.54],
    [0.09, 1.58],
    [0.1, 1.72],
    [0.07, 1.78],
    [-0.02, 1.8],
    [-0.08, 1.75],
    [-0.08, 1.66],
    [-0.02, 1.6],
    [-0.09, 1.51],
    [-0.18, 1.54],
    [-0.2, 1.43],
    [-0.12, 1.35],
    [-0.1, 1.09],
    [-0.15, 0.97],
    [-0.06, 0.89],
  ];
  const plate = (center, sign) => {
    const p = figure.map(([x, y]) => [center + sign * x, y * 1.05 + 0.18]),
      ids = earcut(p.flat()),
      at = (i, front) => [p[i][0], p[i][1], z + 0.06 + (front ? 1 : -1) * 0.0225];
    for (const front of [false, true])
      for (let i = 0; i < ids.length; i += 3) {
        const q = ids.slice(i, i + 3).map((k) => at(k, front));
        metric.addTriangle('gateIron', ref, q, [0, 0, front ? 1 : -1], null, metal);
      }
    let area = 0;
    for (let i = 0; i < p.length; i++)
      area += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length,
        q = [at(i, true), at(i, false), at(j, false), at(j, true)],
        dx = p[j][0] - p[i][0],
        dy = p[j][1] - p[i][1],
        n = area > 0 ? [dy, -dx, 0] : [-dy, dx, 0];
      metric.addQuad('gateIron', ref, q, n, null, metal);
    }
  };
  for (const sign of [-1, 1]) {
    const center = sign * (outer - c.postWidth / 2);
    rect(center, 0.02, c.postWidth - 0.04, c.portalHeight - 0.04, 0.03);
    for (const y of [0.12, c.portalHeight - 0.43]) ironBox(center, y, 0.37, 0.32);
    plate(center, -sign);
    for (const y of [0.87, 2.06]) {
      const points = Array.from({ length: 7 }, (_, i) => {
        const a = (i * Math.PI * 1.6) / 6;
        return [center - sign * (0.09 + 0.085 * Math.cos(a)), y + 0.085 * Math.sin(a)];
      });
      line(points, 0.018);
    }
  }
  // Stepped top ironwork bridges the portal without filling the open vehicle space.
  rod([-inner, c.portalHeight - 0.035], [inner, c.portalHeight - 0.035], 0.035);
  for (const sign of [-1, 1]) {
    const pts = [
      [-inner, 2.39],
      [-inner + 0.45, 2.39],
      [-inner + 0.45, 2.18],
      [-inner + 0.18, 2.18],
      [-inner + 0.18, 2.32],
      [-inner + 0.82, 2.32],
      [-inner + 0.82, 2.49],
      [-inner + 0.58, 2.49],
      [-inner + 0.58, 2.37],
      [-inner + 1.2, 2.37],
      [-inner + 1.2, 2.57],
      [-inner + 1.04, 2.57],
      [-inner + 1.04, 2.48],
    ];
    line(
      pts.map(([x, y]) => [sign * x, y]),
      0.025,
    );
  }
  // Separate pedestrian leaf inside its cut opening.
  rect(service.center, c.bottom, service.width - 0.08, service.height - 0.03, 0.03);
  for (const x of [service.center - 0.15, service.center + 0.15]) spindle(x, 0.35, 1.9);
  for (const y of [0.3, 1.08, 2.12]) rod([sl + 0.06, y], [sr - 0.06, y], 0.025);
  for (const scale of [1, 0.65])
    rect(service.center, 0.87 + (1 - scale) * 0.15, 0.55 * scale, 0.4 * scale, 0.022);
}
export function ennis(o, frame, d = 3) {
  if (!frame) frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  // Structural foundations and slabs only. The bare-earth review remains independent.
  prism(
    o,
    [
      [-33, -8.3],
      [-25, -8.3],
      [-25, -10],
      [-10, -10],
      [-4, -8],
      [-4, 12.8],
      [-32.7, 12.2],
    ],
    -10,
    0.14,
    'wall',
    paving,
  );
  prism(
    o,
    [
      [-5, -8],
      [28.5, -8.5],
      [30.5, -6.5],
      [31, -0.4],
      [37, -0.2],
      [37, 1],
      [40, 1],
      [40, 4],
      [37, 4],
      [37, 5.8],
      [34, 5.8],
      [34, 10.8],
      [4.5, 11.3],
      [4.7, 14.3],
      [-5.4, 14.6],
    ],
    -10,
    3.25,
    'wall',
    buff,
  );
  // Court parapets and strong horizontal retaining courses follow the visible south edge.
  wallRun(o, [-32.7, 12.15], [-5.4, 12.8], -10, 1.3, d);
  wallRun(o, [4.7, 11.1], [35.8, 10.65], -10, 4.38, d);
  wallRun(o, [35.8, 10.65], [35.8, 6.8], -10, 4.38, d);
  wallRun(o, [-32.8, -8.3], [-32.8, 12.15], -10, 1.3, d);
  if (d > 0) {
    for (const yy of [-6.5, -4.5, -2.5, -0.5]) {
      wallRun(o, [-32.78, 12.28], [-5.4, 12.93], yy, yy + 0.24, 0, { thick: 0.63 });
      wallRun(o, [4.7, 11.24], [35.8, 10.79], yy, yy + 0.24, 0, { thick: 0.63 });
    }
  }
  // Main upper-floor rooms, articulated as in the 1928 published plan.
  room(o, -6.4, 1.0, 7.2, 5.4, -0.4, 7.72, d, {
    north: [h(-1.6, 4.5, 0.95, 1), h(0.2, 4.5, 0.95, 1)],
    west: [h(-1.4, 1.1, 1.1, 1.7), h(1.4, 1.1, 1.1, 1.7)],
  });
  room(o, -6.4, 6.15, 7.2, 4.9, -0.4, 7.72, d, {
    south: [h(-1.65, 3.5, 1.85, 2.5), h(1.05, 3.5, 2.1, 2.5)],
    west: [h(-1.1, 3.5, 1.8, 2.55), h(1.3, 0.3, 1.15, 2.3, 0)],
  });
  room(o, 0.05, 7.5, 6.1, 9.0, 0, 8.94, d, {
    pattern: 'border',
    east: [h(-1.8, 3.5, 1.4, 2.6)],
    west: [h(1.7, 3.5, 1.8, 2.6)],
  });
  // Central high living-room block and its slightly lower adjoining bedroom/library.
  room(o, 8.2, 4.8, 10.2, 6.3, 0, 9.75, d, {
    south: [h(-2.9, 3.5, 1.7, 2.4), h(1.0, 3.5, 3.8, 2.7, 3, true)],
    north: [h(-2.6, 4.1, 1.3, 2.3), h(2.6, 4.1, 1.3, 2.3)],
  });
  room(o, 17.0, 4.8, 7.4, 6.3, 0, 8.56, d, {
    south: [h(0, 3.5, 3.65, 2.4, 3)],
    east: [h(-0.7, 3.5, 3.9, 2.4, 3)],
  });
  // Rear loggia/gallery links the rooms to the terminal master bedroom.
  room(o, 14.8, 0.15, 36.1, 3.1, 1.9, 6.45, d, {
    north: Array.from({ length: 24 }, (_, i) => h(-16.9 + i * 1.45, 3.55, 0.81, 2.1, 0)),
    south: Array.from({ length: 21 }, (_, i) => h(-15 + i * 1.45, 3.5, 0.81, 2.15, 0)),
  });
  room(o, 32.2, 2.85, 6.9, 6.0, 0.8, 7.58, d, {
    south: [h(0, 3.5, 2.8, 2.5, 2)],
    east: [h(0, 3.5, 2.6, 2.5, 2)],
    north: [h(-1.6, 4.3, 0.81, 1.6, 0), h(1.6, 4.3, 0.81, 1.6, 0)],
  });
  room(o, 29.5, -1.0, 2.4, 4.5, 2.1, 7.1, d, { east: [h(0, 4.5, 0.8, 1.3, 0)] });
  // Projecting dining window tower; stepped border and two narrow flank lights.
  const bay = facing(o, 0, 0.05, 12.04);
  B(bay, 'wall', 0, 0.1, 0.72, 3.25, 8.84, 1.45, buff);
  panel(facing(bay, 0, 0, 1.46), 3.25, 0.1, 8.84, d, {
    pattern: 'all',
    holes: [h(0, 3.55, 1.13, 3.55, 0, true)],
  });
  if (d) {
    for (const sign of [-1, 1]) {
      B(bay, 'wall', sign * 1.08, 3.15, 1.57, 0.38, 4.2, 0.36, light);
      win(facing(bay, 0, sign * 1.13, 1.78), 0, 3.55, 0.32, 2.25, d, { bars: 0 });
      B(bay, 'wall', sign * 0.68, 6.65, 1.66, 0.41, 0.44, 0.4, light);
    }
    B(bay, 'wall', 0, 7.08, 1.66, 1.8, 0.41, 0.4, light);
    B(bay, 'wall', 0, 3.17, 1.64, 1.8, 0.4, 0.41, light);
  }
  // Low west entrance and upper balcony facing the motor court.
  B(o, 'wall', -10.5, -0.2, 5.8, 0.9, 3.3, 5.2, buff);
  const entry = facing(o, -Math.PI / 2, -10.98, 5.8);
  win(entry, 0, 0.28, 1.65, 2.4, d, { door: true, bars: 1 });
  wallRun(o, [-11.15, 3.3], [-11.15, 8.4], 2.95, 4.28, d, { pattern: 'border', thick: 0.36 });
  // Linked garage/chauffeur wing, with street bridge above the open entrance.
  room(o, -30.45, 1.5, 4.2, 14.4, -0.4, 5.7, d, {
    east: [h(-4.6, 0.2, 2.8, 2.55, 0), h(-1.15, 0.2, 2.8, 2.55, 0), h(3.5, 1.0, 1.0, 1.65, 0)],
    south: [h(0, 1.0, 1.9, 1.4, 1)],
    west: [h(-4.5, 2.8, 0.8, 1.6, 0), h(-2.5, 2.8, 0.8, 1.6, 0), h(0.5, 2.8, 0.8, 1.6, 0)],
  });
  room(o, -30.4, 10.0, 4.25, 3.5, -0.4, 4.8, d, {
    east: [h(0, 1.1, 1.3, 1.6, 0)],
    south: [h(0, 1.1, 1.6, 1.4, 1)],
  });
  // Published USGS B23 returns locate the broad raised bridge deck, not bare earth.
  // The adjoining open court remains at the original datum. These are medium-fi
  // architectural levels; no source-ground samples or whole-house transform change.
  B(o, 'wall', -19.7, 3.85, -7.65, 19.5, 0.3, 4.9, buff);
  for (const x of [-28.7, -10.3]) B(o, 'wall', x, -0.4, -7.65, 0.8, 4.85, 4.9, buff);
  for (const z of [-10.1, -5.2]) {
    wallRun(o, [-29.45, z], [-9.95, z], 4.15, 4.45, d, { pattern: 'all', thick: 0.35 });
    wallRun(o, [-29.45, z], [-9.95, z], 4.75, 5.1, d, { pattern: 'all', thick: 0.35 });
    for (let x = -29; x < -9.8; x += 2.03) B(o, 'wall', x, 4.45, z, 0.81, 0.3, 0.35, buff);
  }
  // Solid entrance paving descends from the sloping street through the covered
  // passage to the motor court. Its footprint also bounds the host ground opening.
  const apron = [
    [-12, 1.65],
    [-10.25, 1.2],
    [-5.2, 0.6],
    [-2, 0.14],
  ];
  for (let i = 0; i < apron.length - 1; i++) {
    const [za, ya] = apron[i],
      [zb, yb] = apron[i + 1];
    const top = [
      [-24.2, ya, za],
      [-24.2, yb, zb],
      [-15.4, yb, zb],
      [-15.4, ya, za],
    ];
    quad(o, 'wall', top, normalFor(...top.slice(0, 3)), paving);
    for (const x of [-24.2, -15.4]) {
      const side = [
        [x, -1, za],
        [x, -1, zb],
        [x, yb, zb],
        [x, ya, za],
      ];
      if (x > -20) side.reverse();
      quad(o, 'wall', side, normalFor(...side.slice(0, 3)), buff);
    }
  }
  for (const [z, y] of [apron[0], apron.at(-1)]) {
    const end = [
      [-24.2, -1, z],
      [-15.4, -1, z],
      [-15.4, y, z],
      [-24.2, y, z],
    ];
    if (z < -10) end.reverse();
    quad(o, 'wall', end, normalFor(...end.slice(0, 3)), buff);
  }
  // Screen/gates under the bridge; no tree or vehicle geometry.
  if (d > 0) {
    const g = facing(o, Math.PI, -19.8, -10.25, 1.2);
    for (const x of [-4.5, 4.5]) B(g, 'wall', x, 0.0, 0, 0.8, 3.0, 0.65, buff);
    if (d > 1 && d < 3)
      for (let x = -4; x <= 4; x += 0.43) {
        face(g, 'metal', x, 0.08, 0.03, 0.035, 2.9, metal);
        if (d > 2)
          for (let y = 0.3; y < 2.8; y += 0.6) {
            face(g, 'metal', x, y, 0.04, 0.31, 0.035, metal);
            face(g, 'metal', x + 0.14, y, 0.04, 0.035, 0.27, metal);
          }
      }
    if (d < 3) for (const y of [0.1, 1.5, 2.9]) face(g, 'metal', 0, y, 0.05, 8, 0.045, metal);
    if (d > 2) entryGates(g);
  }
  // Curving northwest street-side return follows the mapped approach above the garage.
  const approach = [
    [-29, -8.4, 6.3],
    [-29, -20.1, 6.3],
    [-24.1, -20.1, 6.3],
    [-25, -15.5, 6.3],
    [-25, -13.7, 5.95],
    [-24.1, -11.8, 5.5],
    [-22, -10.1, 4.96],
  ];
  for (let i = 0; i < approach.length - 1; i++) {
    const a = approach[i],
      b = approach[i + 1],
      top = Math.max(a[2], b[2]);
    wallRun(o, a, b, top - 2.4, top, d === 3 ? 2 : d, { pattern: 'border', thick: 0.42 });
  }
  // Living-room high transom and stepped projecting window frame seen on the scenic elevation.
  if (d) {
    const living = facing(o, 0, 9.2, 7.97);
    win(living, 0, 6.47, 3.8, 0.62, d, { bars: 3, lead: true });
    for (const x of [-2.15, 2.15]) B(living, 'wall', x, 3.45, 0.1, 0.35, 3.9, 0.32, light);
    B(living, 'wall', 0, 7.1, 0.12, 4.65, 0.4, 0.38, light);
    for (const x of [-1.88, 1.88]) B(living, 'wall', x, 6.7, 0.13, 0.45, 0.4, 0.4, light);
  }
  // North pool terrace: modern pool footprint within the historic terrace, rim and still surface.
  B(o, 'wall', 14, 2.95, -4.85, 25, 0.3, 5.5, paving);
  if (d > 0) {
    B(o, 'wall', 15.1, 3.26, -4.95, 16.2, 0.1, 3.7, light);
    B(o, 'pool', 15.1, 3.365, -4.95, 15.6, 0.025, 3.1, rgb('538b91'));
  }
  wallRun(o, [-9.7, -9.65], [-1.7, -9.8], -0.4, 4.36, d);
  wallRun(o, [-1.7, -8.4], [28.4, -8.65], -2, 4.36, d);
  wallRun(o, [28.4, -8.65], [30.7, -6.0], -3, 4.36, d);
  wallRun(o, [30.7, -6.0], [31, -0.4], -3, 4.36, d);
  // Upper east terrace and southwest stepped apron are integral architecture.
  wallRun(o, [20.8, 8.0], [29.3, 8.0], 3.25, 4.42, d, { thick: 0.38 });
  for (const x of [-4.8, 4.15]) wallRun(o, [x, 11.4], [x, 14.3], -3.8, 3.7, d, { thick: 0.5 });
  if (d > 1) {
    for (let i = 0; i < 14; i++)
      B(o, 'wall', 0.05, -3.1 + i * 0.245, 14.65 - i * 0.14, 1.55, 0.245, 0.16, light);
    for (const yy of [7.72, 8.94, 9.75])
      B(
        o,
        'metal',
        yy === 7.72 ? -6.4 : yy === 8.94 ? 0.05 : 8.2,
        yy + 0.1,
        yy === 7.72 ? 1 : yy === 8.94 ? 7.5 : 4.8,
        yy === 9.75 ? 10.3 : 6.2,
        0.055,
        0.08,
        metal,
      );
    for (const [x, z, y] of [
      [3.8, 1.8, 9.75],
      [31.6, -0.2, 7.58],
      [-8.9, 3.4, 7.72],
    ]) {
      B(o, 'wall', x, y, z, 0.81, 0.81, 1.2, buff);
      B(o, 'roof', x, y + 0.82, z, 0.65, 0.04, 1.04, roof);
    }
  }
  if (d > 2) {
    for (let x = -28; x < -11.5; x += 1.2)
      quad(
        o,
        'wall',
        [
          [x, 0.151, -7.6],
          [x + 0.012, 0.151, -7.6],
          [x + 0.012, 0.151, 11.7],
          [x, 0.151, 11.7],
        ],
        [0, 1, 0],
        joint,
      );
    for (let z = -7; z < 12; z += 1.2)
      quad(
        o,
        'wall',
        [
          [-28.2, 0.152, z],
          [-11.3, 0.152, z],
          [-11.3, 0.152, z + 0.012],
          [-28.2, 0.152, z + 0.012],
        ],
        [0, 1, 0],
        joint,
      );
  }
}
export function ennisSkyline(o) {
  ennis(o, undefined, 0);
}
export function ennisDistrict(o) {
  ennis(o, undefined, 1);
}
export function ennisStreet(o) {
  ennis(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.92, metallic: 0 },
  metal: { ...landmarkSurfaces.metal, doubleSided: true },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  pool: { slot: 'window', roughness: 0.24, metallic: 0.14, localRef: 'palette:#feffff' },
  gateIron: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.4 },
  gateWall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
};
export const ennisModel = {
  id: 'ennis_house',
  recipe: 'structure-ennis-house.mjs',
  key: 'ennis_house',
  cell: '9q/9q5',
  title: 'Ennis House',
  brief:
    'Stepped buff textile-block house above massive retaining terraces, with projecting dining-window tower, high living-room block, rear loggia, eastern master room, western motor court, bridge and garage wing. Visible 16-inch block courses and restrained Greek-key relief.',
  camera: [78, 48, 88],
  lookAt: [2, 1, 0],
  qaCameras: [
    { name: 'front', position: [60, 23, 98], lookAt: [2, 3, 1] },
    { name: 'back', position: [-65, 25, -76], lookAt: [0, 3, -2] },
    { name: 'gate-ironwork', position: [-20.8, 3.0, -17.5], lookAt: [-19.8, 2.6, -10.25] },
    { name: 'service-gate', position: [-16.1, 2.65, -13.25], lookAt: [-16.55, 2.4, -10.25] },
  ],
  build: ennis,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Western motor-court paving at local [-18,2], model Y=0; original USGS datum independently corroborated by B23 ground returns. Raised bridge and sloping covered entrance are separate architectural levels.',
  portableGroundY: -10.2,
  mediumFiContext: {
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: [
      [-24.15, -11.95],
      [-15.45, -11.95],
      [-15.45, -2.05],
      [-24.15, -2.05],
    ],
    basis:
      'Only the authored sloping entrance paving beneath the bridge and its short street/court transitions. USGS B23 points show the bridge deck incorrectly represented as ground by the interpolated raster. Preserve every original height sample and the whole-house datum; the solid model floor replaces rendered ground triangles in this bounded passage. Approximate floor and registration, not a surveyed threshold.',
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ennis-house.mjs',
    level: 'skyline',
    export: 'ennisSkyline',
    errorMeters: 0.45,
    surfaces,
    authoredLevels: {
      district: { export: 'ennisDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'ennisStreet', errorMeters: 0.07, surfaces },
    },
  },
  limitations: [
    'Original government HABS CA-1942 west elevation and gate detail by Jean Davis,1969, establish the textile-block hierarchy and measured15ft10.75in portal. Gate figures, rods and relief are simplified. Current condition and unseen faces are approximate; earlier attribution/private/satellite imagery is excluded from the current review.',
    'The retained mapped full compound and HABS exterior are corroborated by public USGS B23 point measurements acquired2023-01-08 through2024-01-07. Court datum is unchanged; bridge depth/height and the raised sloping entrance are corrected as approximate architecture. This derived local registration conservatively allows2m horizontal uncertainty, without an independent epoch/datum correction; inferred under-bridge paving is not an observed navigable survey.',
    'House, linked garage/servant wing, bridge, court, terraces and pool basin included. Interiors, vegetation, neighboring houses, vehicles, temporary scaffolds, furniture and photo pixels excluded.',
    'Original USGS raster, review grid and source heights remain exact. A bounded rendered-ground opening exists only under the authored solid entrance paving; the original raster interpolates bridge returns across this covered passage. Isolated portable views use a flat floor below the foundations; medium-fi views retain the original ground and exercise the opening. Host datasets may differ; placement remains a preview with footprint replacement disabled.',
    '16-inch block course spacing is retained; ornate block relief and leaded-glass geometry are simplified at medium-fi and progressively omitted at distant detail levels.',
  ],
};
