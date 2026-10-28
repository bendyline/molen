/** Constantine palace: native envelope, original measured courts and photograph-directed arcades. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, beamPath, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sn/snk/ahmed_bey_palace/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  tau = 2 * Math.PI;
const C = {
    wall: rgb('d7d3c6'),
    stone: rgb('dfddd2'),
    roof: rgb('8c8978'),
    wood: rgb('594e3b'),
    tile: rgb('99a9a5'),
    accent: rgb('455650'),
  },
  blue = rgb('386078'),
  ochre = rgb('b2935b'),
  cream = rgb('d6cbb1'),
  green = rgb('677968');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_marble', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  tile: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.78, metallic: 0 },
  accent: { slot: 'trim', localRef: ref, roughness: 0.86, metallic: 0.02 },
};
function tri(o, s, p, h, col = C[s]) {
  if (h && normalFor(...p).reduce((a, x, i) => a + x * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
const rect = (c, size, offset = 0) => [
  [c[0] - size[0] / 2 - offset, c[1] - size[1] / 2 - offset],
  [c[0] + size[0] / 2 + offset, c[1] - size[1] / 2 - offset],
  [c[0] + size[0] / 2 + offset, c[1] + size[1] / 2 + offset],
  [c[0] - size[0] / 2 - offset, c[1] + size[1] / 2 + offset],
];
function triangulate(outer, holes = []) {
  const all = [outer, ...holes],
    p = all.flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0),
    );
  return { p, ix: earcut(p.flat(), starts) };
}
function cap(o, s, outer, holes, y, up = true, col = C[s]) {
  const { p, ix } = triangulate(outer, holes);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function walls(o, s, p, y0, y1, inside = false, col = C[s]) {
  const area = p.reduce(
      (a, q, i) => a + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1],
      0,
    ),
    sign = (area > 0 ? 1 : -1) * (inside ? -1 : 1);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
}
function prism(o, s, p, y0, y1, col = C[s]) {
  walls(o, s, p, y0, y1, false, col);
  cap(o, s, p, [], y0, false, col);
  cap(o, s, p, [], y1, true, col);
}
function face(a, b, inside = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = inside ? [-t[1], t[0]] : [t[1], -t[0]];
  return {
    len,
    n: [n[0], 0, n[1]],
    P: (u, y, dep = 0) => [a[0] + u * t[0] + dep * n[0], y, a[1] + u * t[1] + dep * n[1]],
  };
}
function faceAt(o, s, f, u, y, w, h, dep = 0, col = C[s]) {
  Q(
    o,
    s,
    [
      f.P(u - w / 2, y, dep),
      f.P(u + w / 2, y, dep),
      f.P(u + w / 2, y + h, dep),
      f.P(u - w / 2, y + h, dep),
    ],
    f.n,
    col,
  );
}
function B(o, s, f, u0, y0, u1, y1, dep, w, h = w, col = C[s]) {
  beam(o, s, f.P(u0, y0, dep), f.P(u1, y1, dep), w, h, col);
}
function ringFloor(o, c, y, d) {
  const inner = c.outline,
    outer = rect(c.center, c.size, c.galleryWidth);
  cap(o, 'stone', outer, [inner], y);
  if (d > 0) {
    cap(o, 'stone', outer, [inner], y - 0.2, false);
    walls(o, 'stone', inner, y - 0.2, y, true);
  }
}
function distance(p, a, b) {
  const x = b[0] - a[0],
    z = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * z) / (x * x + z * z)));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * z);
}
function roof(o, d) {
  const holes = plan.courts.map((c) => c.outline),
    rings = [plan.outline, ...holes],
    { p, ix } = triangulate(plan.outline, holes),
    level = [0, 1, 2, 3][d];
  const height = (q) => {
    let dist = Infinity;
    for (const r of rings)
      for (let i = 0; i < r.length; i++)
        dist = Math.min(dist, distance(q, r[i], r[(i + 1) % r.length]));
    return plan.estimatedLevels.roofEaveY + Math.min(1.8, dist * 0.46);
  };
  function triangle(a, b, c, n) {
    if (n) {
      const ab = a.map((x, i) => (x + b[i]) / 2),
        bc = b.map((x, i) => (x + c[i]) / 2),
        ca = c.map((x, i) => (x + a[i]) / 2);
      for (const t of [
        [a, ab, ca],
        [ab, b, bc],
        [ca, bc, c],
        [ab, bc, ca],
      ])
        triangle(...t, n - 1);
      return;
    }
    tri(
      o,
      'roof',
      [a, b, c].map((q) => [q[0], height(q), q[1]]),
      [0, 1, 0],
    );
  }
  for (let i = 0; i < ix.length; i += 3) triangle(...ix.slice(i, i + 3).map((j) => p[j]), level);
  // Ridge/eave height is derived from distance to actual exterior/court edges, not a roof over the whole site.
}
function body(o, d) {
  const holes = [
    plan.sharedGardenGalleryCavity,
    rect(plan.courts[2].center, plan.courts[2].size, plan.courts[2].galleryWidth),
  ];
  walls(o, 'wall', plan.outline, -0.4, 11.4);
  for (const h of holes) walls(o, 'wall', h, 3.6, 11.4, true);
  cap(o, 'wall', plan.outline, holes, -0.4, false);
  for (const c of plan.courts) {
    ringFloor(o, c, 3.8, d);
    ringFloor(o, c, 7.6, d);
    // Opaque gallery ceiling and cornice join the real open arcade to its roof.
    cap(o, 'wall', rect(c.center, c.size, c.galleryWidth), [c.outline], 11.32, false);
    if (d > 0) {
      walls(o, 'wall', c.outline, 7.3, 7.6, true);
      walls(o, 'wall', c.outline, 11.1, 11.4, true);
    }
    // Intrinsic enclosed court decks/cistern covers; no surrounding natural ground or plaza slab.
    const floor = c.id === 'paved-court' ? 3.56 : 2.65;
    prism(o, 'stone', c.outline, 2.45, floor, c.id === 'paved-court' ? C.stone : cream);
  }
  for (let i = 0; i < plan.outline.length; i++) {
    const a = plan.outline[i],
      b = plan.outline[(i + 1) % plan.outline.length],
      f = face(a, b, true);
    if (d > 0) {
      B(o, 'stone', f, 0, 0.35, f.len, 0.35, 0.03, 0.13, 0.17, C.stone);
      B(o, 'wall', f, 0, 11.18, f.len, 11.18, 0.035, 0.19, 0.22);
    }
    if (d >= 2) B(o, 'wall', f, 0, 7.3, f.len, 7.3, 0.025, 0.09, 0.1);
    const n = d === 0 ? Math.max(1, Math.floor(f.len / 15)) : Math.floor(f.len / 7);
    for (let j = 0; j < n; j++) {
      const u = (f.len * (j + 0.55)) / (n + 0.1);
      if (f.len < 5 || (i === 5 && Math.abs(u - 19.5) < 2.5)) continue;
      for (const y of d === 0 ? [8.3] : [4.6, 8.4])
        window(o, f, u, y, 0.72 + (j % 2) * 0.23, 1.22 + (j % 3) * 0.14, d);
    }
  }
  if (d >= 2)
    for (const [x, z, h] of [
      [-32, -16, 1.2],
      [-8, -15, 1.5],
      [15, -16, 1.0],
      [31, 19, 1.4],
    ]) {
      const p = rect([x, z], [0.38, 0.48]);
      prism(o, 'wall', p, 12.0, 13.2 + h);
      if (d === 3) prism(o, 'roof', rect([x, z], [0.49, 0.6]), 13.15 + h, 13.28 + h);
    }
  roof(o, d);
}
function window(o, f, u, y, w, h, d, back = 0) {
  faceAt(o, 'accent', f, u, y, w, h, 0.015 + back);
  if (d === 0) return;
  for (const x of [u - w / 2 - 0.045, u + w / 2 + 0.045])
    faceAt(o, 'stone', f, x, y - 0.07, 0.085, h + 0.14, 0.045 + back);
  for (const yy of [y - 0.045, y + h + 0.045])
    faceAt(o, 'stone', f, u, yy, w + 0.2, 0.1, 0.045 + back);
  if (d === 3) {
    for (let j = 1; j < 3; j++)
      B(
        o,
        'wood',
        f,
        u - w / 2,
        y + (h * j) / 3,
        u + w / 2,
        y + (h * j) / 3,
        0.055 + back,
        0.022,
        0.035,
      );
    for (const x of [u - w * 0.22, u + w * 0.22])
      B(o, 'wood', f, x, y, x, y + h, 0.055 + back, 0.022, 0.035);
  }
}
function column(o, p, y, d, style) {
  const n = [3, 3, 4, 8][d],
    r = 0.13;
  if (d < 3) {
    loft(
      o,
      'stone',
      [
        radialRing(y, r, r, n, [p[0], p[1]]),
        radialRing(y + 2.35, r * 0.9, r * 0.9, n, [p[0], p[1]]),
      ],
      C.stone,
    );
    return;
  }
  const ys = [0, 0.12, 0.65, 1.3, 2.17, 2.35];
  const rings = ys.map((dy) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * tau) / n + (style % 3 === 1 && dy > 0.12 && dy < 2.18 ? dy * 1.75 : 0),
        rr =
          r *
          (dy < 0.13 || dy > 2.17 ? 1.42 : 1) *
          (style % 3 === 1 && dy > 0.12 && dy < 2.18 ? 1 + 0.12 * Math.cos(6 * a) : 1);
      return [p[0] + Math.cos(a) * rr, y + dy, p[1] + Math.sin(a) * rr];
    }),
  );
  loft(o, 'stone', rings, C.stone);
  if (d === 3) {
    const q = rect(p, [0.4, 0.4]);
    prism(o, 'stone', q, y - 0.1, y + 0.04);
    prism(o, 'stone', q, y + 2.31, y + 2.41);
  }
}
function archBand(o, f, u0, u1, y, d) {
  const span = u1 - u0,
    half = (span - 0.22) / 2,
    high = Math.min(1.08, half * 1.02),
    spring = y + 2.35,
    top = y + 3.5,
    n = [2, 2, 2, 6][d],
    cx = (u0 + u1) / 2;
  // Pointed paired curves stay below the lintel even when distant bays merge.
  const path = Array.from({ length: n + 1 }, (_, j) => {
    const x = -half + (2 * half * j) / n;
    return [cx + x, spring + high * Math.sqrt(Math.max(0, 1 - Math.abs(x / half)))];
  });
  for (let j = 1; j < path.length; j++) {
    const [a, ay] = path[j - 1],
      [b, by] = path[j];
    for (const dep of [-0.32, 0.04])
      Q(
        o,
        'wall',
        [f.P(a, ay, dep), f.P(b, by, dep), f.P(b, top, dep), f.P(a, top, dep)],
        dep > 0 ? f.n : f.n.map((x) => -x),
      );
    if (d >= 2)
      Q(
        o,
        'wall',
        [f.P(a, ay, -0.32), f.P(b, by, -0.32), f.P(b, by, 0.04), f.P(a, ay, 0.04)],
        [0, -1, 0],
      );
  }
  if (d >= 2) {
    // Actual timber ties cross the open arch, leaving the lower opening clear.
    B(o, 'wood', f, u0, y + 2.12, u1, y + 2.12, -0.07, 0.055, 0.065);
    if (d === 3)
      for (let j = 1; j < path.length; j++) {
        const a = path[j - 1],
          b = path[j];
        Q(
          o,
          'accent',
          [
            f.P(a[0], a[1], 0.052),
            f.P(b[0], b[1], 0.052),
            f.P(b[0], b[1] + 0.04, 0.052),
            f.P(a[0], a[1] + 0.04, 0.052),
          ],
          f.n,
          cream,
        );
      }
  }
}
function ornament(o, f, u, y, dep, d) {
  faceAt(o, 'tile', f, u, y, 0.58, 1.3, dep);
  if (d === 3) {
    for (const dy of [0.16, 0.5, 0.84, 1.18])
      for (const dx of [-0.15, 0.15]) {
        const pts = [
          [u + dx, y + dy + 0.105],
          [u + dx + 0.1, y + dy],
          [u + dx, y + dy - 0.105],
          [u + dx - 0.1, y + dy],
        ].map((p) => f.P(p[0], p[1], dep + 0.006));
        Q(o, 'accent', pts, f.n, (Math.round(dy * 100) + Math.round(dx * 100)) % 2 ? blue : ochre);
      }
  }
}
function court(o, c, d) {
  const p = c.outline;
  for (let i = 0; i < 4; i++) {
    const f = face(p[i], p[(i + 1) % 4], true),
      original = c.bays[i % 2],
      count = d === 0 ? 1 : d === 1 ? Math.ceil(original / 3) : original,
      bay = f.len / count;
    for (const y of [3.8, 7.6]) {
      const columns = d === 0 ? [0, f.len] : Array.from({ length: count }, (_, j) => j * bay);
      for (let j = 0; j < columns.length; j++)
        column(
          o,
          [...f.P(columns[j], 0, 0)].filter((_, k) => k !== 1),
          y,
          d,
          i + j,
        );
      for (let j = 0; j < count; j++) archBand(o, f, j * bay, (j + 1) * bay, y, d);
      if (d > 0) B(o, 'wall', f, 0, y + 3.48, f.len, y + 3.48, -0.1, 0.15, 0.23);
      if (d >= 2) {
        // Original framed cedar/grille bays sit behind the open colonnade, never in its opening plane.
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) * bay,
            dep = -c.galleryWidth + 0.03;
          if (j % 3 === 1) {
            faceAt(o, 'wood', f, u, y + 0.08, 1.08, 2.05, dep);
            if (d === 3)
              for (const dx of [-0.6, 0.6])
                B(o, 'stone', f, u + dx, y + 0.03, u + dx, y + 2.25, dep + 0.065, 0.1, 0.13);
            if (d === 3)
              B(o, 'stone', f, u - 0.66, y + 2.25, u + 0.66, y + 2.25, dep + 0.08, 0.15, 0.19);
            if (d === 3)
              for (const yy of [0.38, 0.85, 1.32, 1.79])
                for (const dx of [-0.27, 0.27])
                  faceAt(o, 'accent', f, u + dx, y + yy, 0.38, 0.34, dep + 0.015, ochre);
          } else window(o, f, u, y + 0.75, 0.85, 1.28, d, dep);
          for (const dx of [-bay * 0.34, bay * 0.34])
            ornament(o, f, u + dx, y + 0.2, dep + 0.005, d);
          // Painted frieze is an original unlettered geometric interpretation; no copied scene/photo texture.
          faceAt(o, 'accent', f, u, y + 2.58, bay * 0.83, 0.54, dep + 0.012, cream);
          if (d === 3)
            for (const dx of [-0.22, 0.22]) {
              const h = 0.4,
                w = 0.22,
                points = [
                  [u + dx - w, y + 2.62],
                  [u + dx, y + 2.62 + h],
                  [u + dx + w, y + 2.62],
                ].map((p) => f.P(p[0], p[1], dep + 0.02));
              tri(o, 'accent', points, f.n, j % 2 ? blue : green);
            }
          if (d === 3)
            beam(
              o,
              'wood',
              f.P(u, y + 3.28, -0.25),
              f.P(u, y + 3.28, -c.galleryWidth),
              0.055,
              0.075,
              C.wood,
            );
        }
      }
    }
    // The upper-gallery wood balustrade is open; no solid painted rail panel.
    if (d > 0) {
      for (const yy of [7.77, 8.57]) B(o, 'wood', f, 0, yy, f.len, yy, 0.04, 0.065, 0.075);
      const n = d === 1 ? count : count * (d === 2 ? 1 : 3);
      for (let j = 0; j <= n; j++) {
        const u = (f.len * j) / n;
        B(o, 'wood', f, u, 7.78, u, 8.56, 0.04, 0.035, 0.04);
      }
    }
  }
  // Corner masonry strengthens the galleries just as the original account describes.
  if (d >= 2) for (const q of p) prism(o, 'wall', rect(q, [0.42, 0.42]), 3.6, 11.3);
}
function fountain(o, c, d) {
  const [x, z] = c.center,
    y = c.id === 'paved-court' ? 3.56 : 2.65,
    n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : 16;
  if (c.id === 'large-garden') {
    const outer = rect([x, z], [3.6, 3.6]),
      inner = rect([x, z], [2.92, 2.92]);
    cap(o, 'stone', outer, [inner], y + 0.55);
    walls(o, 'stone', outer, y, y + 0.55);
    walls(o, 'stone', inner, y + 0.14, y + 0.55, true);
    cap(o, 'stone', inner, [], y + 0.14);
    loft(
      o,
      'stone',
      [radialRing(y + 0.14, 0.18, 0.18, n, [x, z]), radialRing(y + 1.1, 0.1, 0.1, n, [x, z])],
      C.stone,
    );
  } else {
    const prof = [
      [y, 0.62],
      [y + 0.12, 0.62],
      [y + 0.21, 0.32],
      [y + 0.83, 0.2],
      [y + 0.97, 0.62],
      [y + 1.1, 0.7],
      [y + 1.17, 0.58],
    ];
    loft(
      o,
      'stone',
      prof.map(([yy, r]) => radialRing(yy, r, r, n, [x, z])),
      C.stone,
    );
    if (d >= 2)
      loft(
        o,
        'stone',
        [radialRing(y + 1.1, 0.51, 0.51, n, [x, z]), radialRing(y + 1.17, 0.58, 0.58, n, [x, z])],
        C.stone,
        { cap: false },
      );
  }
  if (d >= 2)
    for (let j = 0; j < 5; j++) {
      const w = c.size[0] * 0.12,
        xx = x - c.size[0] * 0.33 + j * c.size[0] * 0.165;
      // Low engineered bed edging only; garden vegetation/soil is deliberately outside the structure asset.
      beam(
        o,
        'stone',
        [xx - w / 2, y + 0.08, z - c.size[1] * 0.3],
        [xx + w / 2, y + 0.08, z - c.size[1] * 0.3],
        0.1,
        0.16,
        C.stone,
      );
    }
}
function kiosque(o, d) {
  const k = plan.estimatedKiosque,
    [x, z] = k.center;
  // Central pavilion links the measured gardens; narrow triple rows remain open passages below it.
  if (d === 0) return;
  const rows = d === 1 ? 2 : 3,
    n = d === 1 ? 2 : 5;
  for (let r = 0; r < rows; r++)
    for (let j = 0; j < n; j++) {
      const xx = x - 1.5 + r * 1.5,
        zz = z - 6.4 + (j * 12.8) / (n - 1);
      column(o, [xx, zz], 3.8, d, j + r);
    }
  if (d >= 2) {
    const p = rect(k.center, k.size);
    prism(o, 'stone', p, 7.4, 7.6);
    prism(o, 'stone', p, 3.6, 3.8);
    walls(o, 'wall', p, 7.6, 11.4);
    cap(o, 'roof', p, [], 11.42);
    for (const s of [-1, 1]) {
      const f =
        s > 0
          ? face([x + k.size[0] / 2, z - 7.5], [x + k.size[0] / 2, z + 7.5])
          : face([x - k.size[0] / 2, z + 7.5], [x - k.size[0] / 2, z - 7.5]);
      for (const u of [2.5, 7.5, 12.5]) window(o, f, u, 8.0, 0.85, 1.9, d);
    }
  }
}
function entrance(o, d) {
  const f = face([-43.6, 16.98], [0.33, 16.98], true),
    u = 19.6,
    y = 0.2;
  faceAt(o, 'wood', f, u, y, 1.72, 2.72, 0.035);
  if (d === 0) return;
  for (const dx of [-0.99, 0.99]) B(o, 'stone', f, u + dx, y, u + dx, y + 2.88, 0.1, 0.2, 0.26);
  const m = d === 1 ? 4 : d === 2 ? 8 : 14,
    pts = Array.from({ length: m + 1 }, (_, j) => {
      const a = (j * Math.PI) / m;
      return f.P(u + 1.03 * Math.cos(a), y + 2.68 + 0.72 * Math.sin(a), 0.13);
    });
  beamPath(o, 'stone', pts, 0.19, 0.24, C.stone);
  B(o, 'stone', f, u - 1.34, y + 3.54, u + 1.34, y + 3.54, 0.15, 0.19, 0.34);
  const top = [
    f.P(u - 1.08, y + 3.63, 0.11),
    f.P(u, y + 4.25, 0.11),
    f.P(u + 1.08, y + 3.63, 0.11),
  ];
  tri(o, 'stone', top, f.n);
  if (d >= 2) {
    sphere(o, 'stone', f.P(u, y + 3.87, 0.17), [0.27, 0.31, 0.08], C.stone, d === 3 ? 12 : 8, 5);
    for (const dx of [-0.46, 0.46])
      for (const yy of [0.42, 0.98, 1.54, 2.1])
        faceAt(o, 'accent', f, u + dx, y + yy, 0.6, 0.42, 0.06, ochre);
    B(o, 'wood', f, u, y, u, y + 2.67, 0.08, 0.06, 0.06);
  }
}
function build(o, _frame, d = 3) {
  body(o, d);
  for (const c of plan.courts) {
    court(o, c, d);
    fountain(o, c, d);
  }
  kiosque(o, d);
  entrance(o, d);
}
export const ahmedBeySkyline = (o, f) => build(o, f, 0),
  ahmedBeyDistrict = (o, f) => build(o, f, 1),
  ahmedBeyStreet = (o, f) => build(o, f, 2);
export const ahmedBeyPalaceModel = {
  id: 'ahmed_bey_palace',
  key: 'ahmed_bey_palace',
  recipe: 'structure-ahmed-bey-palace.mjs',
  cell: 'sn/snk',
  title: 'Ahmed Bey Palace',
  category: 'palace',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete intrinsic Constantine palace within original named irregular boundary, three genuinely open measured principal courts/raised marble galleries/two levels of pointed arcades/straight-octagonal-spiral shafts/wood ties/balustrades and centralKiosque, original blue-cream-ochre tilebands/representativeunletteredmuralpanels/cedardoor-grillebays; graycurvedtilehiproofsurfaces/plainhighouterwalls/modestcurvedmarblegate and marblebasins. Courtyard sizes/baycounts text-measured, registration/grade/roofsections explicitlyestimated. No adjacentmosque/siteplaza/naturalground/trees/exhibits/people or copiedphototexture.',
  camera: [105, 78, 120],
  lookAt: [0, 6, 0],
  portableGroundY: -0.58,
  mediumFiContext: { scale: 1.2, groundY: -0.58 },
  qaCameras: [
    {
      name: 'whole-native-envelope-three-open-courts-and-roof-ranges',
      position: [-76, 97, 103],
      lookAt: [-1, 6, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'pointed-arcades-spiral-marble-shafts-tile-and-cedar',
      position: [-24, 8.8, 3],
      lookAt: [-32, 7, -9],
    },
    {
      name: 'plain-high-palace-front-and-curved-marble-entrance',
      position: [-30, 7.5, 43],
      lookAt: [-24, 5.3, 16.9],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Southwest approach[-24,19.5]fixed before independent rawterrain; interiorplateau/gardenfloor/storeys/footings and exact hostattachment remain approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ahmed-bey-palace.mjs',
    level: 'skyline',
    export: 'ahmedBeySkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'ahmedBeyDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'ahmedBeyStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Two native published Qualla originals only: ND217gallery photograph verified to pinned Commons nativeSHA1and primary RijksmuseumRP-F-F01088-AF/200344370namedcreatorÉtienneNeurdein/publisherJ.Kühn/1880-90date/explicitPublicdomain; Waran18creatorCC0native2023photo used only for blue/cream/ochrearchitectural tile color. Costumes/mannequins/exhibits/people/furnishings not modeled. Unknown engravedcourtyard/blogCC0/otherlicensedphotos not used. No external image, generatedbitmap or copiedphotographictexture.',
    'Original1867Feraud text-only measurements checked on native PDF/title and printedpp65/74/87:20x18m/8by7orangegallery,20x25m/10longfacearcades and12mpavedcourt; twolevels,2.5mmaxshafts,varied15-25cmdiameters,raisedsurface,centralKiosque/triplecolonnade/plainhighwalls/graycurvedtile. Courtyard centres/shortface repeats/roofplanes/pavilion footprint and room census inside the unchanged native boundary are inferred, not an archaeological or present-day measured survey. Historical5609m²site description includes a broader scope than native3771m²boundary; no unrelated parcels added.',
    'Complete exposed intrinsic forms include realcourt/arcadeopenings, variedstraight/octagonal/spiralmarblecolumns,balustrades/woodties/beams,cedar/grillebays,tilewainscot/originalunletteredmuralinterpretations and two gardenbasins/smallcourtvasque. Representative exterior repeats; 260historic/266storytotalcolumncensus includes rooms/dependencies and is not claimed exact. Hidden interiors/ceilings in rooms/exhibits, natural vegetation/soil/plaza/mosque/neighbors excluded.',
    'Estimated interiorgalleryplateau3.8m/upper7.6m,roofeave11.4m/hiprises13.2m and lowfoundation-.4mare not surveyed elevations. Intrinsic enclosedcisterncover/courtdecks remain1.15mbelowgallery; they are construction inside the palace, not a surrounding terrain slab. Bookrecords raisedgalleries/cisterns and roughly15mfrontprofile; exact concealedsections,currentconservation/groundcontact remain unverified.',
    'Independent180mcurrentTerrariumfield frozenbeforegeometry, not flattened/fitted. Nativeanchor is actualpalaceenvelopecentre; originalstorypoint lies on the externalapproach. Fixedsouthwestentrancedatum remainsapproximate; flatstageY-.58showsstructure ratherthan certifying hillsidefit. Arches/columns/balustrades/roofdetail simplifywithdistance while allthreecourtvoids persist.',
  ],
};
