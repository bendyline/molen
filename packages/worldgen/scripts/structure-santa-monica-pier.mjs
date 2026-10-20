/** Santa Monica's combined pier, native mapped plan and inspected surviving exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, cleanRing, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, slot, p, n, col) {
  if (normalFor(...p).reduce((v, a, i) => v + a * n[i], 0) < 0) p = [...p].reverse();
  rawQuad(o, slot, p, n, col);
}

const frame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9q/9q5/santa_monica_pier/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  tau = 2 * Math.PI,
  ref = 'palette:#ffffff',
  deck = 3;
const wood = rgb('9b8668'),
  darkwood = rgb('675c47'),
  teal = rgb('58847f'),
  cream = rgb('e3d5b6'),
  peach = rgb('d9ae80'),
  blue = rgb('30455a'),
  roofgrey = rgb('858c8c'),
  white = rgb('e7e7d9'),
  yellow = rgb('e7c444'),
  glass = rgb('627c83');
const ring = frame.authoredComponents.pierOutline;
function transform(o, a, x = 0, z = 0) {
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
function poly(o, slot, ps, y0, y1, col) {
  const p = ps.map((v) => v.slice());
  if (
    p.reduce(
      (a, v, i) => a + v[0] * p[(i + 1) % p.length][1] - v[1] * p[(i + 1) % p.length][0],
      0,
    ) < 0
  )
    p.reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  const ids = earcut(p.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const ps = ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
      if (normalFor(...ps)[1] * n[1] < 0) ps.reverse();
      o.addTriangle(
        slot,
        ref,
        ps,
        n,
        ps.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function roof(o, ps, col = roofgrey) {
  if (normalFor(...ps)[1] < 0) ps = [...ps].reverse();
  const n = normalFor(...ps);
  if (ps.length === 3)
    o.addTriangle(
      'roof',
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      col,
    );
  else quad(o, 'roof', ps, n, col);
}
function strip(o, slot, a, b, w, col, n = [0, 0, 1]) {
  const v = b.map((p, i) => p - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    l = Math.hypot(...q);
  if (l < 1e-8) return;
  const u = q.map((v) => (v * w) / l / 2),
    ps = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, slot, ps, normalFor(...ps), col);
  if (slot === 'metal' || slot === 'wood') {
    const back = [...ps].reverse();
    quad(o, slot, back, normalFor(...back), col);
  }
}
function rod(o, d, slot, a, b, w, col, n) {
  if (d > 1) beam(o, slot, a, b, w, w, col);
  else strip(o, slot, a, b, w, col, n);
}
function inside([x, z]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    if (
      ring[i][1] > z !== ring[j][1] > z &&
      x < ((ring[j][0] - ring[i][0]) * (z - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]
    )
      c = !c;
  return c;
}
function intersections(x) {
  const zs = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (a[0] > x === b[0] > x) continue;
    zs.push(a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
  }
  return zs.sort((a, b) => a - b);
}
function pillar(o, d, x, z, top = 2.55) {
  const y = -10;
  if (d < 2) {
    strip(o, 'wood', [x, y, z], [x, top, z], 0.38, darkwood);
    if (d) strip(o, 'wood', [x, y, z], [x, top, z], 0.38, darkwood, [1, 0, 0]);
  } else
    loft(
      o,
      'wood',
      [radialRing(y, 0.24, 0.24, 4, [x, z]), radialRing(top, 0.24, 0.24, 4, [x, z])],
      darkwood,
    );
}
function pier(o, d) {
  for (const ps of frame.authoredComponents.mainDeckRings)
    poly(
      o,
      'wood',
      d === 0
        ? cleanRing(
            ps.filter(
              (p, i) => i === 0 || Math.hypot(p[0] - ps[i - 1][0], p[1] - ps[i - 1][1]) > 3,
            ),
          )
        : ps,
      2.62,
      3,
      wood,
    );
  const stations = [];
  for (let x = -310; x < 176; x += 5.6) {
    const zz = intersections(x);
    for (let i = 0; i + 1 < zz.length; i += 2) {
      const a = zz[i] + 0.5,
        b = zz[i + 1] - 0.5;
      if (b <= a) continue;
      const zs =
        d < 3
          ? [a, b]
          : Array.from(
              { length: Math.max(2, Math.ceil((b - a) / 8)) },
              (_, j) => a + (j * (b - a)) / (Math.max(2, Math.ceil((b - a) / 8)) - 1),
            );
      stations.push([x, a, b]);
      if (d === 0 && (stations.length % 3 || x < -150)) continue;
      for (const z of zs) pillar(o, d, x, z);
      if (d) beam(o, 'wood', [x, 2.4, a - 0.4], [x, 2.4, b + 0.4], 0.4, 0.5, darkwood);
      if (d > 1)
        for (let j = 0; j < zs.length - 1; j += d === 3 ? Math.max(1, zs.length - 2) : 1)
          for (const s of [-1, 1])
            beam(
              o,
              'wood',
              [x, -3.0, s < 0 ? zs[j] : zs[j + 1]],
              [x, 1.8, s < 0 ? zs[j + 1] : zs[j]],
              0.17,
              0.22,
              darkwood,
            );
    }
  }
  if (d > 0)
    for (let i = 0; i < stations.length - 1; i++) {
      const [x, a, b] = stations[i],
        [xx, aa, bb] = stations[i + 1];
      if (Math.abs(a - aa) < 3)
        for (const s of [-1, 1])
          rod(o, d, 'wood', [x, -3, s > 0 ? b : a], [xx, 1.8, s > 0 ? bb : aa], 0.19, darkwood);
    }
  for (const [rr, height] of [
    ...frame.authoredComponents.mainDeckRings.map((r) => [r, 3]),
    ...frame.authoredComponents.lowerDeckRings.map((r) => [r, 1.4]),
  ]) {
    for (let i = 0; i < rr.length; i++) {
      const a = rr[i],
        b = rr[(i + 1) % rr.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.7 || (height < 2 && Math.abs(a[0] - 176) < 0.1 && Math.abs(b[0] - 176) < 0.1))
        continue;
      const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (d > 0) {
        beam(
          o,
          'wood',
          [...a.slice(0, 1), height - 0.65, a[1]],
          [b[0], height - 0.65, b[1]],
          0.35,
          0.55,
          darkwood,
        );
        const n = Math.max(1, Math.ceil(L / 2.7));
        for (let j = 0; j < n; j++) {
          const p = at(j / n);
          rod(o, d, 'metal', [p[0], height, p[1]], [p[0], height + 1.15, p[1]], 0.065, teal);
        }
        for (const y of [height + 0.12, height + 0.46, height + 0.8, height + 1.15])
          rod(o, 1, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.05, teal);
      } else strip(o, 'metal', [a[0], height + 0.65, a[1]], [b[0], height + 0.65, b[1]], 0.1, teal);
    }
  }
  // Fixed transverse plank seams are geometry; shared material provides finer grain.
  if (d > 1)
    for (let x = -309; x < 173; x += d === 3 ? 0.8 : 2.4) {
      const zs = intersections(x);
      for (let i = 0; i + 1 < zs.length; i += 2)
        quad(
          o,
          'wood',
          [
            [x, 3.004, zs[i]],
            [x + 0.012, 3.004, zs[i]],
            [x + 0.012, 3.004, zs[i + 1]],
            [x, 3.004, zs[i + 1]],
          ],
          [0, 1, 0],
          darkwood,
        );
    }
  // Lower seaward fishing landing sits outside the principal platform edge.
  for (const ps of frame.authoredComponents.lowerDeckRings) poly(o, 'wood', ps, 1.05, 1.4, wood);
  for (const z of [-9, 1, 11, 21]) if (inside([181, z])) pillar(o, d, 181, z, 1.05);
  stairs(o, d, 173, 7, 0, 4, 8, 3, 1.4);
}
function stairs(o, d, x, z, a, w, L, hi, lo) {
  const q = transform(o, a, x, z),
    n = d < 2 ? 3 : 12;
  for (let i = 0; i < n; i++)
    B(q, 'concrete', (L * (i + 0.5)) / n, lo, 0, L / n, hi - lo - ((hi - lo) * i) / n, w, cream);
  if (d)
    for (const s of [-1, 1]) {
      beam(q, 'metal', [0, hi + 1, (s * w) / 2], [L, lo + 1, (s * w) / 2], 0.065, 0.065, teal);
      for (const t of [0, 0.5, 1])
        beam(
          q,
          'metal',
          [t * L, hi * (1 - t) + lo * t, (s * w) / 2],
          [t * L, hi * (1 - t) + lo * t + 1, (s * w) / 2],
          0.065,
          0.065,
          teal,
        );
    }
}
function arch(width, height, n, pointed = false) {
  const w = width / 2;
  if (pointed)
    return [
      [-w, 0],
      [w, 0],
      [w, height * 0.52],
      ...Array.from({ length: n }, (_, i) => {
        const t = (i + 1) / n;
        return [w * (1 - t), height * (0.52 + 0.48 * Math.sin((t * Math.PI) / 2))];
      }),
      ...Array.from({ length: n }, (_, i) => {
        const t = (i + 1) / n;
        return [-w * t, height * (0.52 + 0.48 * Math.cos((t * Math.PI) / 2))];
      }),
    ];
  const r = w,
    base = height - r;
  return [
    [-w, 0],
    [w, 0],
    [w, base],
    ...Array.from({ length: n }, (_, i) => {
      const a = ((i + 1) / n) * Math.PI;
      return [r * Math.cos(a), base + r * Math.sin(a)];
    }),
  ];
}
function face(o, d, w, h, openings, col = peach) {
  const holes = openings.map(({ x, y, w, h, pointed }) =>
      arch(w, h, d > 1 ? 8 : 4, pointed).map(([u, v]) => [x + u, y + v]),
    ),
    pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h], ...holes.flat()],
    starts = holes.map((_, i) => 4 + holes.slice(0, i).reduce((a, p) => a + p.length, 0)),
    ids = earcut(pts.flat(), starts);
  for (let i = 0; i < ids.length; i += 3) {
    const ps = ids.slice(i, i + 3).map((j) => [pts[j][0], deck + pts[j][1], 0]);
    if (normalFor(...ps)[2] < 0) ps.reverse();
    o.addTriangle(
      'stucco',
      ref,
      ps,
      [0, 0, 1],
      ps.map((p) => [p[0], p[1]]),
      col,
    );
  }
  for (let k = 0; k < holes.length; k++) {
    const hole = holes[k],
      op = openings[k],
      z = d > 0 ? -0.18 : -0.04,
      ps = hole.map(([x, y]) => [x, deck + y, z]);
    o.addConvexPolygon('glass', ref, ps, [0, 0, 1], (p) => [p[0], p[1]], glass);
    if (d > 1) {
      for (let i = 0; i < hole.length; i++) {
        const a = hole[i],
          b = hole[(i + 1) % hole.length];
        quad(
          o,
          'stucco',
          [
            [a[0], deck + a[1], 0],
            [b[0], deck + b[1], 0],
            [b[0], deck + b[1], z],
            [a[0], deck + a[1], z],
          ],
          normalFor([a[0], deck + a[1], 0], [b[0], deck + b[1], 0], [b[0], deck + b[1], z]),
          cream,
        );
        rod(
          o,
          1,
          'paint',
          [a[0], deck + a[1], 0.025],
          [b[0], deck + b[1], 0.025],
          0.1,
          blue,
          [0, 0, 1],
        );
      }
      rod(
        o,
        1,
        'paint',
        [op.x, deck + op.y, z + 0.02],
        [op.x, deck + op.y + op.h - 0.1, z + 0.02],
        0.045,
        blue,
      );
      const y = op.y + op.h * 0.62;
      rod(
        o,
        1,
        'paint',
        [op.x - op.w / 2, deck + y, z + 0.025],
        [op.x + op.w / 2, deck + y, z + 0.025],
        0.05,
        blue,
      );
      if (d === 3 && !op.pointed && op.h > 3)
        for (const t of [-0.6, -0.3, 0.3, 0.6])
          rod(
            o,
            1,
            'paint',
            [op.x, deck + op.y + op.h - op.w / 2, z + 0.03],
            [op.x + t * op.w * 0.7, deck + op.y + op.h - 0.2, z + 0.03],
            0.025,
            blue,
          );
    }
  }
}
const carousel = { x: -277.6, z: -43.3, w: 27.0, depth: 27.2 };
function hippodrome(o, d) {
  const { x, z, w, depth } = carousel,
    q = transform(o, 0, x, z);
  B(q, 'concrete', 0, -1.2, 0, w, 4.2, depth, cream);
  B(q, 'wood', 0, 3, 0, w, 0.12, depth, wood);
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const s = transform(q, a, (Math.sin(a) * depth) / 2, (Math.cos(a) * depth) / 2),
      ops = [];
    if (d > 0)
      for (let i = 0; i < 7; i++) {
        const u = -9.3 + i * 3.1;
        ops.push({ x: u, y: 0.2, w: 2.45, h: 4.8 });
        for (const t of [-0.66, 0.66]) ops.push({ x: u + t, y: 6.1, w: 1.12, h: 2.05 });
      }
    face(s, d, w, 8.9, ops);
    B(s, 'paint', 0, 11.65, 0.08, w, 0.28, 0.42, blue);
    B(s, 'paint', 0, deck + 5.35, 0.08, w, 0.22, 0.44, blue);
  }
  // Three retained corner towers, not the original four with crenellations.
  for (const [cx, cz] of [
    [-12.5, 12.5],
    [12.5, 12.5],
    [12.5, -12.5],
  ]) {
    const n = 8,
      r = 2.8;
    for (let i = 0; i < n; i++) {
      const a = (-i * tau) / n,
        ang = a + Math.PI / n,
        b = a - tau / n,
        p1 = [cx + r * Math.cos(a), cz + r * Math.sin(a)],
        p2 = [cx + r * Math.cos(b), cz + r * Math.sin(b)],
        mid = p1.map((v, j) => (v + p2[j]) / 2),
        L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
        theta = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      const f = transform(d === 3 ? hiddenTowerFaces(q) : q, -theta, mid[0], mid[1]),
        ops =
          d > 0
            ? [
                { x: 0, y: 0.2, w: 1.8, h: 4.8 },
                { x: 0, y: 6.1, w: 1.8, h: 2.1 },
                { x: 0, y: 9.1, w: 1.85, h: 3.1, pointed: true },
              ]
            : [];
      face(f, d, L, 12.8, ops);
      void ang;
    }
    loft(
      q,
      'paint',
      [radialRing(15.6, 3, 3, 8, [cx, cz]), radialRing(15.85, 3, 3, 8, [cx, cz])],
      blue,
    );
    loft(
      q,
      'roof',
      [radialRing(15.85, 3, 3, 8, [cx, cz]), radialRing(16.25, 0.12, 0.12, 8, [cx, cz])],
      roofgrey,
    );
  }
  const square = [
      [-13.6, -13.6],
      [13.6, -13.6],
      [13.6, 13.6],
      [-13.6, 13.6],
    ],
    circle = Array.from({ length: 32 }, (_, i) => [
      13.6 * Math.cos((i * tau) / 32),
      13.6 * Math.sin((i * tau) / 32),
    ]),
    pts = [...square, ...circle],
    idx = earcut(pts.flat(), [4]);
  for (let i = 0; i < idx.length; i += 3)
    roof(
      q,
      idx.slice(i, i + 3).map((j) => [pts[j][0], 11.9, pts[j][1]]),
    );
  const n = d === 0 ? 16 : 32,
    profiles = [
      [11.9, 13.6],
      [12.5, 10.9],
      [13.7, 8.4],
      [15.4, 6.2],
      [17.4, 4.55],
      [18.4, 3.8],
    ],
    rs = (d < 2 ? [profiles[0], profiles[2], profiles[4], profiles[5]] : profiles).map(([y, r]) =>
      radialRing(y, r, r, n),
    );
  loft(q, 'roof', rs, roofgrey, { cap: false });
  loft(q, 'paint', [radialRing(18.35, 3.9, 3.9, 12), radialRing(20.9, 3.9, 3.9, 12)], blue);
  if (d > 0)
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) * tau) / 12,
        s = transform(q, a, Math.sin(a) * 3.82, Math.cos(a) * 3.82);
      quad(
        s,
        'glass',
        [
          [-0.52, 18.65, 0.02],
          [0.52, 18.65, 0.02],
          [0.52, 20.55, 0.02],
          [-0.52, 20.55, 0.02],
        ],
        [0, 0, 1],
        rgb('26373c'),
      );
      if (d > 1)
        for (let y = 18.8; y < 20.55; y += 0.2) B(s, 'paint', 0, y, 0.06, 1.05, 0.06, 0.08, blue);
    }
  loft(q, 'roof', [radialRing(20.9, 4.1, 4.1, 12), radialRing(21.35, 0.12, 0.12, 12)], roofgrey);
  if (d > 1)
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n;
      for (let j = 0; j < profiles.length - 1; j++) {
        const A = profiles[j],
          D = profiles[j + 1];
        strip(
          q,
          'paint',
          [Math.cos(a) * A[1], A[0] + 0.035, Math.sin(a) * A[1]],
          [Math.cos(a) * D[1], D[0] + 0.035, Math.sin(a) * D[1]],
          0.04,
          blue,
          [Math.sin(a), 0, -Math.cos(a)],
        );
      }
    }
}
function hip(o, x, z, w, dep, y, rise, col = roofgrey, well = 0) {
  const q = transform(o, 0, x, z),
    outer = [
      [-w / 2, y, -dep / 2],
      [w / 2, y, -dep / 2],
      [w / 2, y, dep / 2],
      [-w / 2, y, dep / 2],
    ],
    inner = well
      ? [
          [-well / 2, y + rise, -well / 2],
          [well / 2, y + rise, -well / 2],
          [well / 2, y + rise, well / 2],
          [-well / 2, y + rise, well / 2],
        ]
      : [
          [-w * 0.18, y + rise, 0],
          [w * 0.18, y + rise, 0],
          [w * 0.18, y + rise, 0],
          [-w * 0.18, y + rise, 0],
        ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (Math.hypot(...inner[i].map((v, k) => v - inner[j][k])) < 0.01)
      roof(q, [outer[i], outer[j], inner[i]], col);
    else roof(q, [outer[i], outer[j], inner[j], inner[i]], col);
  }
}
function buildings(o, d) {
  const skipped = new Set(['35184708978468', '35185114461346', '35185114132965']);
  const colors = ['dbccb0', 'd6e0d8', 'b9cad1', '698ba4', '55949c', 'cabba0'];
  for (const f of frame.features.slice(1)) {
    const id = f.id.split('/')[1],
      ps = f.rings[0],
      xs = ps.map((p) => p[0]),
      zs = ps.map((p) => p[1]),
      x = (Math.min(...xs) + Math.max(...xs)) / 2,
      z = (Math.min(...zs) + Math.max(...zs)) / 2,
      w = Math.max(...xs) - Math.min(...xs),
      dep = Math.max(...zs) - Math.min(...zs);
    if (skipped.has(id) || w * dep < (d === 0 ? 120 : 23)) continue;
    if (x > 100) continue;
    const col = rgb(colors[Number(id) % colors.length]),
      height = x < -210 ? 5.5 : x < -160 ? 5 : 4.1;
    poly(
      o,
      'stucco',
      d < 2
        ? [
            [x - w / 2, z - dep / 2],
            [x + w / 2, z - dep / 2],
            [x + w / 2, z + dep / 2],
            [x - w / 2, z + dep / 2],
          ]
        : ps,
      deck,
      deck + height,
      col,
    );
    if (x < -210 || (x < -90 && x > -135))
      hip(o, x, z, w + 0.5, dep + 0.5, deck + height, 2.8, white);
    else B(o, 'roof', x, deck + height, z, w + 0.3, 0.18, dep + 0.3, white);
    if (d > 0)
      for (const side of [-1, 1]) {
        const q = transform(o, side > 0 ? 0 : Math.PI, x, z + (side * dep) / 2);
        for (let u = -w / 2 + 1.5; u < w / 2 - 1; u += 3.5) {
          quad(
            q,
            'glass',
            [
              [u - 0.85, 3.6, 0.025],
              [u + 0.85, 3.6, 0.025],
              [u + 0.85, 6.05, 0.025],
              [u - 0.85, 6.05, 0.025],
            ],
            [0, 0, 1],
            glass,
          );
          if (d > 1)
            for (const y of [3.55, 6.06]) B(q, 'paint', u, y, 0.06, 1.85, 0.07, 0.09, cream);
        }
      }
    if (d > 0 && x > -100)
      for (let xx = x - w * 0.3; xx < x + w * 0.35; xx += 3)
        B(o, 'paint', xx, deck + height + 0.2, z, 2.6, 0.08, dep * 0.65, blue);
  }
  // Restaurant and harbor office at broad head: roof well remains genuinely open.
  const a = frame.features.find((f) => f.id.endsWith('35998')).rings[0],
    b = frame.features.find((f) => f.id.endsWith('35996')).rings[0];
  poly(o, 'stucco', a, 3, 9, cream);
  hip(o, 147, 0, 22, 25, 9, 2.8, yellow, 6);
  for (const t of [-1, 1]) {
    B(o, 'stucco', 147, 9, t * 2.65, 5.5, 3, 0.2, cream);
    B(o, 'stucco', 147 + t * 2.65, 9, 0, 0.2, 3, 5.1, cream);
  } // raised roof monitor walls are cut around the central well below.
  if (d > 0) {
    for (const side of [-1, 1]) {
      const q = transform(o, side > 0 ? 0 : Math.PI, 147, side * 12.1);
      for (let u = -9; u < 10; u += 2)
        quad(
          q,
          'glass',
          [
            [u - 0.7, 6.4, 0.02],
            [u + 0.7, 6.4, 0.02],
            [u + 0.7, 8.8, 0.02],
            [u - 0.7, 8.8, 0.02],
          ],
          [0, 0, 1],
          glass,
        );
    }
    stairs(o, d, 155, 5, 0, 5, 10, 7, 3);
  }
  poly(o, 'stucco', b, 3, 7.4, white);
  B(o, 'stucco', 148, 7.4, -21, 12, 3.5, 9, white);
  B(o, 'roof', 148, 10.9, -21, 13, 0.2, 10, white);
  for (const y of [5.3, 8.5])
    quad(
      o,
      'glass',
      [
        [141, y, -26.1],
        [155, y, -26.1],
        [155, y + 1, -26.1],
        [141, y + 1, -26.1],
      ],
      [0, 0, -1],
      glass,
    );
  if (d > 0) {
    beam(o, 'metal', [148, 11, -21], [148, 23, -21], 0.12, 0.12, white);
    beam(o, 'metal', [141, 18, -21], [155, 18, -21], 0.08, 0.08, white);
    stairs(o, d, 156, -25, 0, 4, 13, 6.5, 3);
  }
}
const wheelCenter = frame.authoredComponents.wheel,
  wheelAngle = Math.PI / 4;
function wheel(o, d) {
  const q = transform(o, wheelAngle, ...wheelCenter),
    radius = 11.8,
    cy = deck + 13.0,
    n = d < 2 ? 40 : 80,
    side = d === 0 ? [0] : [-1.15, 1.15];
  for (const z of side) {
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n;
      rod(
        q,
        d,
        'metal',
        [Math.cos(a) * radius, cy + Math.sin(a) * radius, z],
        [Math.cos(b) * radius, cy + Math.sin(b) * radius, z],
        d > 1 ? 0.13 : 0.16,
        white,
      );
    }
    for (let i = 0; i < 20; i++) {
      const a = (i * tau) / 20;
      rod(
        q,
        d,
        'metal',
        [0, cy, z],
        [Math.cos(a) * radius, cy + Math.sin(a) * radius, z],
        0.09,
        white,
      );
      if (d > 1)
        rod(
          q,
          d,
          'metal',
          [Math.cos(a) * radius, cy + Math.sin(a) * radius, z],
          [Math.cos(a + tau / 20) * radius, cy + Math.sin(a + tau / 20) * radius, -z],
          0.065,
          white,
        );
    }
  }
  for (const z of [-2.1, 2.1])
    for (const x of [-6, 6])
      rod(q, d, 'metal', [x, deck, z], [0, cy, z > 0 ? 1.4 : -1.4], 0.42, white);
  if (d > 0) beam(q, 'metal', [0, cy, -2.3], [0, cy, 2.3], 0.55, 0.55, white);
  for (let i = 0; i < 20; i++) {
    const a = (i * tau) / 20,
      x = Math.cos(a) * radius,
      y = cy + Math.sin(a) * radius,
      col = i % 2 ? rgb('d5b52f') : rgb('bd433e');
    if (d === 0) {
      quad(
        q,
        'paint',
        [
          [x - 0.7, y - 1.25, 0],
          [x + 0.7, y - 1.25, 0],
          [x + 0.7, y - 0.25, 0],
          [x - 0.7, y - 0.25, 0],
        ],
        [0, 0, 1],
        col,
      );
      quad(
        q,
        'paint',
        [
          [x - 0.7, y - 0.25, 0],
          [x + 0.7, y - 0.25, 0],
          [x + 0.7, y - 1.25, 0],
          [x - 0.7, y - 1.25, 0],
        ],
        [0, 0, -1],
        col,
      );
      continue;
    }
    const rr = d === 3 ? 8 : 6;
    loft(
      q,
      'paint',
      [
        radialRing(y - 1.65, 0.65, 0.65, rr, [x, 0]),
        radialRing(y - 1.15, 1.05, 0.95, rr, [x, 0]),
        radialRing(y - 0.65, 1.05, 0.95, rr, [x, 0]),
      ],
      col,
    );
    loft(
      q,
      'paint',
      [radialRing(y + 0.45, 1.15, 1.05, rr, [x, 0]), radialRing(y + 0.56, 1.15, 1.05, rr, [x, 0])],
      blue,
    );
    for (const s of [-1, 1])
      for (const t of [-1, 1])
        rod(
          q,
          d,
          'metal',
          [x + s * 0.75, y - 0.65, t * 0.7],
          [x + s * 0.75, y + 0.45, t * 0.7],
          0.04,
          white,
        );
  }
  B(q, 'concrete', 0, deck, 0, 13, 0.22, 7, cream);
}
function coaster(o, d) {
  const nodes = []; // compact twin helices and high landward camelback from aerial/photo control
  const add = (x, y, z) => nodes.push([x, y + deck, z]);
  for (let i = 0; i <= 32; i++) {
    const a = (i * tau) / 32;
    add(-20 + 15 * Math.cos(a), 4 + (6 * i) / 32, -83 + 13 * Math.sin(a));
  }
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    add(-5 - 105 * t, 10 + 6 * Math.sin(t * Math.PI), -83);
  }
  for (let i = 1; i <= 48; i++) {
    const a = (i * tau) / 24;
    add(-110 + 13 * Math.cos(a), 10 - (4 * i) / 48, -83 + 13 * Math.sin(a));
  }
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    add(-97 + 92 * t, 6 - 2 * t, -83);
  }
  const stride = d === 0 ? 4 : d === 1 ? 2 : 1,
    ps = nodes.filter((_, i) => i % stride === 0);
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i],
      b = ps[i + 1];
    rod(o, d, 'paint', a, b, 0.28, yellow, [0, 1, 0]);
    if (d > 1) {
      const vx = b[0] - a[0],
        vz = b[2] - a[2],
        len = Math.hypot(vx, vz),
        u = [(-vz / len) * 0.6, 0, (vx / len) * 0.6];
      for (const s of [-1, 1])
        beam(
          o,
          'paint',
          a.map((v, j) => v + u[j] * s + (j === 1 ? 0.35 : 0)),
          b.map((v, j) => v + u[j] * s + (j === 1 ? 0.35 : 0)),
          0.07,
          0.07,
          yellow,
        );
      if (i % 2 === 0)
        beam(
          o,
          'paint',
          a.map((v, j) => v - u[j] + (j === 1 ? 0.35 : 0)),
          a.map((v, j) => v + u[j] + (j === 1 ? 0.35 : 0)),
          0.06,
          0.09,
          yellow,
        );
    }
  }
  if (d > 0)
    for (let i = 0; i < nodes.length; i += d === 1 ? 8 : 4) {
      const p = nodes[i],
        c = [white, white, white, teal, rgb('876999')][Math.floor(i / 4) % 5];
      rod(o, d, 'metal', [p[0], deck, p[2]], p, 0.3, c);
    }
}
function lamps(o, d) {
  if (d === 3) {
    physicalLamps(o);
    return;
  }
  if (d === 0) return;
  for (let x = -287; x < 170; x += d === 1 ? 42 : 14)
    for (const z of d === 1 ? [-10] : [-10, -20]) {
      if (!inside([x, z]) || (d === 1 && x < -200)) continue;
      B(o, 'metal', x, deck, z, 0.1, 4.9, 0.1, blue);
      const a = [];
      for (let i = 0; i <= 10; i++) {
        const t = (i / 10) * Math.PI;
        a.push([x + 1.4 + 1.4 * Math.cos(t), deck + 4.9 + 1.4 * Math.sin(t), z]);
      }
      for (let i = 0; i < a.length - 1; i++) rod(o, 1, 'metal', a[i], a[i + 1], 0.065, blue);
      loft(
        o,
        'paint',
        [
          radialRing(deck + 4.2, 0.22, 0.22, 4, [x + 2.8, z]),
          radialRing(deck + 4.7, 0.38, 0.38, 4, [x + 2.8, z]),
          radialRing(deck + 4.9, 0.16, 0.16, 4, [x + 2.8, z]),
        ],
        cream,
      );
    }
}

/** Closed triangular-section tube; the meter-UV loft follows a planar bend. */
function lampTube(o, path, radius, color, cap = true, endCapOnly = false) {
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy);
    return Array.from({ length: 3 }, (_, j) => {
      const angle = (j * tau) / 3;
      return [
        p[0] - (dy / length) * radius * Math.cos(angle),
        p[1] + (dx / length) * radius * Math.cos(angle),
        p[2] + radius * Math.sin(angle),
      ];
    });
  });
  loft(o, 'lampMetal', rings, color, { cap });
  if (endCapOnly) {
    const end = rings.at(-1);
    const a = end[0],
      u = end[1].map((v, i) => v - a[i]),
      length = Math.hypot(...u),
      n = normalFor(...end),
      v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    o.addConvexPolygon(
      'lampMetal',
      ref,
      end,
      n,
      (p) => [
        p.reduce((s, p, i) => s + ((p - a[i]) * u[i]) / length, 0),
        p.reduce((s, p, i) => s + ((p - a[i]) * v[i]) / length, 0),
      ],
      color,
    );
  }
}
function physicalLamps(o) {
  const color = rgb('37443f');
  for (let x = -287; x < 170; x += 14)
    for (const z of [-10, -20]) {
      if (!inside([x, z]) || (x === 147 && (z === -10 || z === -20))) continue;
      const q = transform(o, 0, x, z),
        profiles = [
          [deck - 0.02, 0.22],
          [deck + 0.28, 0.22],
          [deck + 0.42, 0.065],
          [deck + 4.9, 0.065],
        ],
        rings = profiles.map(([y, r]) => radialRing(y, r, r, 4));
      // The lower open edge is embedded in the retained timber deck, not exposed to the viewer.
      loft(q, 'lampMetal', rings, color, { cap: false });
      q.addConvexPolygon('lampMetal', ref, rings.at(-1), [0, 1, 0], (p) => [p[0], p[2]], color);
      const arch = Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI - (i * Math.PI) / 6;
        return [1.4 + 1.4 * Math.cos(a), deck + 4.9 + 1.4 * Math.sin(a) - (i === 0 ? 0.02 : 0), 0];
      });
      lampTube(q, arch, 0.0325, color, false);
      lampTube(
        q,
        [
          [0, deck + 4.65, 0],
          [0.65, deck + 5.05, 0],
          [1, deck + 4.7, 0],
          [0.72, deck + 4.45, 0],
        ],
        0.025,
        color,
        false,
        true,
      );
      const rim = radialRing(deck + 4.65, 0.3, 0.3, 6, [2.8, 0]),
        bottom = [2.8, deck + 4.2, 0],
        top = [2.8, deck + 4.98, 0];
      for (let i = 0; i < 6; i++)
        for (const [slot, point, col] of [
          ['lampGlass', bottom, white],
          ['lampMetal', top, color],
        ]) {
          let p = [point, rim[i], rim[(i + 1) % 6]],
            n = normalFor(...p),
            center = [2.8, deck + 4.65, 0],
            mid = p[0].map((_, k) => p.reduce((v, p) => v + p[k], 0) / 3);
          if (n.reduce((v, a, k) => v + a * (mid[k] - center[k]), 0) < 0) {
            p.reverse();
            n = normalFor(...p);
          }
          const a = p[1].map((v, k) => v - p[0][k]),
            b = p[2].map((v, k) => v - p[0][k]),
            length = Math.hypot(...a),
            u = b.reduce((v, b, k) => v + b * a[k], 0) / length,
            v = Math.sqrt(Math.max(0, b.reduce((v, b) => v + b * b, 0) - u * u));
          q.addTriangle(
            slot,
            ref,
            p,
            n,
            [
              [0, 0],
              [length, 0],
              [u, v],
            ],
            col,
          );
        }
    }
}
function build(o, d) {
  pier(o, d);
  buildings(o, d);
  hippodrome(o, d);
  wheel(o, d);
  coaster(o, d);
  lamps(o, d);
}
export const santaMonicaPier = (o) => build(o, 3);
export function santaMonicaPierSkyline(o, d = 0) {
  const top = (ps, y, col, slot = 'wood') => {
    const ids = earcut(ps.flat());
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [ps[j][0], y, ps[j][1]]);
      if (normalFor(...p)[1] < 0) p.reverse();
      o.addTriangle(
        slot,
        ref,
        p,
        [0, 1, 0],
        p.map((p) => [p[0], p[2]]),
        col,
      );
    }
  };
  for (const ps of frame.authoredComponents.mainDeckRings) {
    const pp = cleanRing(ps);
    top(pp, deck, wood);
  }
  for (let x = -130; x < 174; x += 17) {
    const zz = intersections(x);
    for (let i = 0; i + 1 < zz.length; i += 2)
      for (const z of [zz[i] + 0.5, zz[i + 1] - 0.5])
        strip(o, 'wood', [x, -10, z], [x, 2.7, z], 0.48, darkwood);
  }
  if (d) hippodrome(o, 1);
  else {
    B(o, 'stucco', carousel.x, deck, carousel.z, 27, 8.9, 27.2, peach);
    for (const [x, z] of [
      [-12.5, 12.5],
      [12.5, 12.5],
      [12.5, -12.5],
    ]) {
      B(o, 'stucco', carousel.x + x, deck, carousel.z + z, 4.5, 12.8, 4.5, peach);
      hip(o, carousel.x + x, carousel.z + z, 4.7, 4.7, 15.8, 0.4, roofgrey);
    }
    const q = transform(o, 0, carousel.x, carousel.z);
    loft(
      q,
      'roof',
      [
        [11.9, 13.6],
        [14.4, 7.6],
        [18.4, 3.8],
      ].map(([y, r]) => radialRing(y, r, r, 12)),
      roofgrey,
      { cap: false },
    );
    loft(q, 'paint', [radialRing(18.4, 3.9, 3.9, 8), radialRing(21.2, 3.9, 3.9, 8)], blue);
    top(
      [
        [-13.6, -13.6],
        [13.6, -13.6],
        [13.6, 13.6],
        [-13.6, 13.6],
      ].map(([x, z]) => [x + carousel.x, z + carousel.z]),
      11.9,
      roofgrey,
      'roof',
    );
  }
  for (const [x, z, w, h, dep, col] of [
    [-238, -43, 38, 5.5, 28, white],
    [-181, -3, 18, 5, 14, white],
    [-170, -44, 23, 5, 28, white],
    [-104, -43, 23, 4.5, 32, white],
    [-51, -37, 25, 4, 19, cream],
    [-51, -56, 20, 4, 14, white],
    [-9, -43, 24, 4.5, 25, teal],
    [147, 0, 22, 6, 25, cream],
    [148, -21, 15, 7.5, 12, white],
  ]) {
    B(o, 'stucco', x, deck, z, w, h, dep, col);
    hip(o, x, z, w, dep, deck + h, 2, x > 100 ? yellow : white);
  }
  wheel(o, 0);
  coaster(o, 0);
}
export const santaMonicaPierStreet = (o) => build(o, 1),
  santaMonicaPierDistrict = (o) => santaMonicaPierSkyline(o, 1);
const surfaces = {
  lampMetal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.12 },
  lampGlass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65, metallic: 0 },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.94, metallic: 0, doubleSided: true },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.8,
    metallic: 0.12,
    doubleSided: true,
  },
  paint: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.86,
    metallic: 0.06,
    doubleSided: true,
  },
  stucco: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.08 },
};
export const santaMonicaPierModel = {
  id: 'santa_monica_pier',
  key: 'santa_monica_pier',
  recipe: 'structure-santa-monica-pier.mjs',
  cell: '9q/9q5',
  title: 'Santa Monica Pier',
  brief:
    'Combined mapped timber pier and open pile frames/teal rails, broad shore platform and narrow municipal neck/wide head. Peach/blue Looff Hippodrome with seven arched bays, paired upper windows/three octagonal towers, swept tent roof and ventilated cupola. Static white Pacific Wheel with20 red/yellow open gondolas, yellow twin-helix West Coaster, integral roof masses and yellow-roof head restaurant/harbor office. No ride animation or city.',
  camera: [310, 215, 330],
  lookAt: [-65, 5, -37],
  qaCameras: [
    { name: 'front', position: [-327, 23, 4], lookAt: [-277, 10, -42] },
    { name: 'front-detail', position: [-286, 9, -13], lookAt: [-277, 8, -31] },
    { name: 'back', position: [-239, 21, -85], lookAt: [-277, 11, -45] },
    { name: 'roof-detail', position: [-254, 43, -7], lookAt: [-277, 17, -43] },
    { name: 'base-detail', position: [37, -2, 12], lookAt: [23, -0.4, -15] },
    { name: 'wheel-detail', position: [16, 20, -48], lookAt: [-21, 15, -81] },
    { name: 'head-detail', position: [207, 29, 43], lookAt: [147, 7, -5] },
    { name: 'park-detail', position: [-115, 34, -131], lookAt: [-64, 8, -70] },
    { name: 'lamp-detail', position: [166, 10, -5], lookAt: [162, 8, -10] },
    { name: 'lamp-base-detail', position: [164, 4.4, -7], lookAt: [161, 3.3, -10] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -10 },
  build: santaMonicaPier,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Four original Terrarium tiles unchanged; dry beach path reference[-298.77213,-92.35321] datum5.706m. Deck3m relative to dry grade, fixed pile bottom-10m. Sampled entire native outline below deck. Marine grade/tide/embedment and exact elevated shore approach remain estimates; bounded preview, no footprint replacement.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-santa-monica-pier.mjs',
    level: 'skyline',
    export: 'santaMonicaPierSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'santaMonicaPierDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'santaMonicaPierStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'Selected surviving2005–2025 exterior; current post2008 wheel and2021 stripped carousel roof control era. No original onion dome/crenellations/lost attractions, ride simulation, people/cars/boats, beach or surrounding city.',
    'Native map footprint/orientation retained. Pile stations, fine facades/hidden sides/roof profiles and coaster chainages/heights are original proportional estimates, not a scan or engineering model. Minor park kiosks and rides simplified into main roof masses.',
    'Independent coastal terrain remains unchanged.17m review grid/approximately4m source pixels are not surveyed marine levels. Dry reference5.706m and deck3m are bounded authoring pose; full pier bridge/raised road approach beyond own deck excluded.',
    'Operator85ft size used for approximately26m overall wheel; conflicting130ft marketing phrase not interpreted as wheel diameter or tall pedestal. Twenty gondolas and open truss frame modeled statically without LED pixel fixtures.',
    'No reference photograph pixels or generated bitmap textures embedded. Shared metric material graphs and native palette colors only; no interior carousel machinery.',
  ],
};
export { carousel, coaster, hippodrome, pier, wheel };

function hiddenTowerFaces(o) {
  const hidden = (slot, p) =>
    // Preserve trim visible through the recessed main-hall glazing.
    !(slot === 'paint' && p.some((v) => Math.max(Math.abs(v[0]), Math.abs(v[2])) > 13.4)) &&
    p.every(
      (v) => Math.abs(v[0]) < 13.48 && Math.abs(v[2]) < 13.48 && v[1] > 2.999 && v[1] < 11.901,
    );
  return {
    addTriangle: (s, r, p, n, u, c) => {
      if (!hidden(s, p)) o.addTriangle(s, r, p, n, u, c);
    },
    addQuad: (s, r, p, n, u, c) => {
      if (!hidden(s, p)) o.addQuad(s, r, p, n, u, c);
    },
    addConvexPolygon: (s, r, p, n, u, c) => {
      if (!hidden(s, p)) o.addConvexPolygon(s, r, p, n, u, c);
    },
  };
}
