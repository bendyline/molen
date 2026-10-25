/** Whole Shihmen rockfill embankment and intrinsic six-gate spillway, from native paths and agency dimensions. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ws/wsq/shihmen_dam/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    rock: rgb('8c8879'),
    grass: rgb('849366'),
    concrete: rgb('a2a99b'),
    road: rgb('9ca496'),
    gate: rgb('85b5b3'),
    steel: rgb('62746b'),
  },
  surfaces = {
    rock: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.99, metallic: 0 },
    grass: { slot: 'foundation', localRef: 'palette:#feffff', roughness: 1, metallic: 0 },
    concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.98, metallic: 0 },
    road: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.98, metallic: 0 },
    gate: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.12 },
    steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.1 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  const N = normalFor(...q);
  if (N.every((v) => v === 0)) return;
  if (n && N.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
  const nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => (Math.abs(nn[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function B(o, s, x0, y0, z0, x1, y1, z1) {
  box(o, s, [x0, y0, z0], [x1, y1, z1], C[s]);
}
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  fract = (x) => x - Math.floor(x),
  noise = (i, j = 0) => fract(Math.sin(i * 127.1 + j * 311.7) * 43758.5453),
  chain = (r) => {
    const a = [0];
    for (let i = 1; i < r.length; i++)
      a.push(a.at(-1) + Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]));
    return a;
  },
  arc = chain(p.core),
  point = (t) => {
    const h = t * arc.at(-1);
    let i = 1;
    while (i < arc.length - 1 && arc[i] < h) i++;
    return mix(p.core[i - 1], p.core[i], (h - arc[i - 1]) / (arc[i] - arc[i - 1]));
  },
  taper = (t) => Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.8),
  body = (t, r, side) => {
    const [x, z] = point(t),
      v = taper(t),
      share = side > 0 ? 2.5 / 4.5 : 2 / 4.5;
    return [x, -133.1 * v * r, z + side * (5.95 + (520 - 11.9) * share * v * r)];
  };
function rock(o, P, r, h, i) {
  const col = C.rock.map((v) => v + (noise(i) - 0.5) * 0.12),
    n = 6;
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n,
      b = ((k + 1) * 2 * Math.PI) / n,
      A = [P[0] + r * Math.cos(a), P[1] + h * 0.2, P[2] + r * 0.8 * Math.sin(a)],
      D = [P[0] + r * Math.cos(b), P[1] + h * 0.2, P[2] + r * 0.8 * Math.sin(b)],
      up = [P[0] + r * 0.1, P[1] + h, P[2]],
      down = [P[0], P[1] - 0.15, P[2]];
    T(o, 'rock', [A, D, up], [(A[0] + D[0]) / 2 - P[0], 1, (A[2] + D[2]) / 2 - P[2]], col);
    T(o, 'rock', [D, A, down], [(A[0] + D[0]) / 2 - P[0], -1, (A[2] + D[2]) / 2 - P[2]], col);
  }
}
function facePoint(t, r, d) {
  const count = [8, 16, 48, 96][d],
    cross = [2, 7, 20, 32][d],
    i = Math.min(count - 1, Math.floor(t * count)),
    j = Math.min(cross - 1, Math.floor(r * cross)),
    u = t * count - i,
    v = r * cross - j,
    a = body(i / count, j / cross, 1),
    b = body((i + 1) / count, j / cross, 1),
    c = body((i + 1) / count, (j + 1) / cross, 1),
    e = body(i / count, (j + 1) / cross, 1);
  return a.map((q, k) =>
    u >= v ? q + (b[k] - q) * u + (c[k] - b[k]) * v : q + (c[k] - e[k]) * u + (e[k] - q) * v,
  );
}
function embankment(o, d) {
  const count = [8, 16, 48, 96][d],
    cross = [2, 7, 20, 32][d],
    ts = Array.from({ length: count + 1 }, (_, i) => i / count);
  for (const side of [-1, 1])
    for (let i = 1; i < ts.length; i++)
      for (let k = 1; k <= cross; k++) {
        const a = ts[i - 1],
          b = ts[i],
          r = (k - 1) / cross,
          s = k / cross,
          q = [body(a, r, side), body(b, r, side), body(b, s, side), body(a, s, side)],
          slot = side < 0 ? 'grass' : 'rock',
          v = (noise(i * 19, k) - 0.5) * 0.012,
          col = C[slot].map((x) => x + v);
        Q(o, slot, q, [0, 1, 0], col);
      }
  for (let i = 1; i < ts.length; i++) {
    const a = ts[i - 1],
      b = ts[i];
    Q(o, 'rock', [body(a, 1, -1), body(b, 1, -1), body(b, 1, 1), body(a, 1, 1)], [0, -1, 0]);
    Q(o, 'road', [body(a, 0, -1), body(b, 0, -1), body(b, 0, 1), body(a, 0, 1)], [0, 1, 0]);
  }
  const stones = [0, 25, 180, 1100][d];
  for (let i = 0; i < stones; i++) {
    const t = 0.06 + 0.88 * noise(i + 7, 2),
      r = 0.09 + 0.84 * noise(i + 7, 3),
      P = facePoint(t, r, d),
      size = 0.65 + noise(i, 9) * 1.05;
    rock(o, [P[0], P[1] + 0.03, P[2]], size, size * 0.65, i);
  }
  const patches = [0, 20, 120, 2000][d],
    sides = [0, 3, 5, 6][d];
  for (let i = 0; i < patches; i++) {
    const t = 0.04 + 0.92 * noise(i + 410, 2),
      r = 0.08 + 0.85 * noise(i + 410, 3),
      dt = 0.003 + 0.007 * noise(i, 13),
      dr = 0.003 + 0.009 * noise(i, 14),
      P = facePoint(t, r, d);
    P[1] += 0.045;
    const ring = Array.from({ length: sides }, (_, k) => {
      const a = (k * 2 * Math.PI) / sides,
        f = 0.65 + 0.35 * noise(i, k + 24),
        q = facePoint(t + dt * Math.cos(a) * f, r + dr * Math.sin(a) * f, d);
      q[1] += 0.045;
      return q;
    });
    for (let k = 0; k < sides; k++)
      T(
        o,
        'grass',
        [P, ring[k], ring[(k + 1) % sides]],
        [0, 1, 0],
        C.grass.map((v) => v + (noise(i, 17) - 0.5) * 0.025),
      );
  }
}
function pathNormals(path) {
  const ns = path.slice(1).map((b, i) => {
    const a = path[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  });
  return path.map((_, i) => {
    const a = ns[Math.max(0, i - 1)],
      b = ns[Math.min(ns.length - 1, i)],
      den = Math.max(0.1, 1 + a[0] * b[0] + a[1] * b[1]);
    return [(a[0] + b[0]) / den, (a[1] + b[1]) / den];
  });
}
function ribbon(o, s, path, width, y, depth = 0.35) {
  const ns = pathNormals(path),
    A = (i, side, h) => [
      path[i][0] + (ns[i][0] * side * width) / 2,
      h,
      path[i][1] + (ns[i][1] * side * width) / 2,
    ];
  for (let i = 1; i < path.length; i++) {
    Q(o, s, [A(i - 1, -1, y), A(i, -1, y), A(i, 1, y), A(i - 1, 1, y)], [0, 1, 0]);
    Q(
      o,
      s,
      [A(i - 1, -1, y - depth), A(i - 1, 1, y - depth), A(i, 1, y - depth), A(i, -1, y - depth)],
      [0, -1, 0],
    );
    for (const side of [-1, 1])
      Q(
        o,
        s,
        [A(i - 1, side, y - depth), A(i, side, y - depth), A(i, side, y), A(i - 1, side, y)],
        [(ns[i - 1][0] + ns[i][0]) * side, 0, (ns[i - 1][1] + ns[i][1]) * side],
      );
  }
}
const xzAt = (r, x) => {
    let i = 1;
    while (i < r.length - 1 && r[i][0] < x) i++;
    const a = r[i - 1],
      b = r[i];
    return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
  },
  bridgeLine = [...p.bridge].sort((a, b) => a[0] - b[0]),
  gateLine = [...p.spillway.slice(0, 5)].sort((a, b) => a[0] - b[0]),
  bridgeZ = (x) => xzAt(bridgeLine, x),
  gateZ = (x) => xzAt(gateLine, x) + 5,
  topZ = Math.max(...p.spillway.map((q) => q[1])),
  endZ = Math.min(...p.spillway.map((q) => q[1])),
  floor = (z) => {
    const t = Math.max(0, Math.min(1, (topZ - z) / (topZ - endZ)));
    return -17.1 - 94.9 * t * (1.35 - 0.35 * t);
  };
function clipped(r, z, above) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      A = above ? a[1] >= z : a[1] <= z,
      B = above ? b[1] >= z : b[1] <= z;
    if (A) out.push(a);
    if (A !== B) out.push(mix(a, b, (z - a[1]) / (b[1] - a[1])));
  }
  return out;
}
function cap(o, s, r, offset, up) {
  if (r.length < 3) return;
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], floor(r[k][1]) + offset, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function wall(o, a, b, y0, y1, w) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
    P = (q, y, s) => [q[0] + (n[0] * s * w) / 2, y, q[1] + (n[1] * s * w) / 2];
  Q(
    o,
    'concrete',
    [P(a, y0[0], -1), P(b, y0[1], -1), P(b, y1[1], -1), P(a, y1[0], -1)],
    [-n[0], 0, -n[1]],
  );
  Q(
    o,
    'concrete',
    [P(a, y0[0], 1), P(a, y1[0], 1), P(b, y1[1], 1), P(b, y0[1], 1)],
    [n[0], 0, n[1]],
  );
  Q(o, 'concrete', [P(a, y1[0], -1), P(b, y1[1], -1), P(b, y1[1], 1), P(a, y1[0], 1)], [0, 1, 0]);
}
function chute(o, d) {
  const zs = [
    ...new Set([
      topZ,
      endZ,
      ...p.spillway.map((q) => q[1]),
      ...Array.from(
        { length: [0, 8, 24, 48][d] },
        (_, i) => endZ + ((topZ - endZ) * (i + 1)) / ([0, 8, 24, 48][d] + 1),
      ),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < zs.length; i++) {
    const r = clipped(clipped(p.spillway, zs[i - 1], true), zs[i], false);
    cap(o, 'concrete', r, 0, true);
    if (d) cap(o, 'concrete', r, -0.85, false);
  }
  for (let i = 0; i < p.spillway.length; i++) {
    const a = p.spillway[i],
      b = p.spillway[(i + 1) % p.spillway.length];
    wall(o, a, b, [floor(a[1]) - 0.85, floor(b[1]) - 0.85], [floor(a[1]), floor(b[1])], 0.8);
    if ((i >= 4 && i <= 8) || (i >= 12 && i <= 16)) {
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / [100, 35, 15, 6][d]));
      for (let j = 0; j < n; j++) {
        const A = mix(a, b, j / n),
          B = mix(a, b, (j + 1) / n),
          height = (z) => 2.5 + 2.3 * Math.max(0, (z - endZ) / (topZ - endZ));
        wall(
          o,
          A,
          B,
          [floor(A[1]), floor(B[1])],
          [floor(A[1]) + height(A[1]), floor(B[1]) + height(B[1])],
          1.0,
        );
      }
    }
  }
  if (d > 1)
    for (let i = 1; i < 9; i++) {
      const z = topZ + ((endZ - topZ) * i) / 9,
        r = clipped(clipped(p.spillway, z - 0.028, true), z + 0.028, false);
      cap(o, 'road', r, 0.014, true);
    }
  // Six actual weir openings precede the original complete dry chute; no tall wall closes its outlet.
  const left = p.parameters.gateAxisX[0],
    pier = (100 - 6 * 14) / 7;
  for (let i = 0; i < 6; i++) {
    const x = left + pier + i * (14 + pier),
      z = gateZ(x + 7),
      n = [1, 4, 10, 20][d],
      angle = Math.asin(10.61 / 15),
      A = (t, side) => {
        const a = -angle + t * angle;
        return [
          x + side * 14,
          -17.1 + 15 * (Math.sin(a) + Math.sin(angle)),
          z + 15 * (Math.cos(a) - Math.cos(angle)),
        ];
      };
    for (let k = 0; k < n; k++) {
      const a = k / n,
        b = (k + 1) / n,
        q = [A(a, 0), A(a, 1), A(b, 1), A(b, 0)];
      Q(o, 'gate', q, [0, 0, 1]);
      if (d) Q(o, 'gate', q.map((q) => [q[0], q[1], q[2] - 0.17]).reverse(), [0, 0, -1]);
    }
    if (d)
      for (let j = 1; j <= 3; j++) {
        const q = A(j / 4, 0.05),
          r = A(j / 4, 0.95);
        beam(o, 'steel', [q[0], q[1], q[2] - 0.35], [r[0], r[1], r[2] - 0.35], 0.22, 0.25, C.steel);
      }
    if (d) {
      const bz = bridgeZ(x + 7);
      B(o, 'steel', x + 5.8, 1.2, bz - 0.75, x + 8.2, 2.0, bz + 0.75);
      for (const dx of [1.0, 13.0])
        beam(o, 'steel', [x + dx, -6.6, z + 4], [x + dx, -1, bz], 0.22, 0.22, C.steel);
    }
    // Gate sill apron reaches the original curved upstream chute boundary.
    const l = x,
      r = x + 14,
      zl = xzAt(gateLine, l),
      zr = xzAt(gateLine, r);
    Q(
      o,
      'concrete',
      [
        [l, -17.1, gateZ(l)],
        [r, -17.1, gateZ(r)],
        [r, floor(zr), zr],
        [l, floor(zl), zl],
      ],
      [0, 1, 0],
    );
  }
  for (let i = 0; i <= 6; i++) {
    const x = i === 6 ? left + 100 - pier / 2 : left + pier / 2 + i * (14 + pier),
      z = gateZ(x),
      bz = bridgeZ(x),
      w = d ? pier : 0.8;
    B(o, 'concrete', x - w / 2, -18.5, z - 1.8, x + w / 2, -0.65, bz + 2.0);
    if (d) {
      const a = [x, z],
        b = [x, z - 15];
      wall(o, a, b, [-17.1, floor(z - 15)], [-6.0, floor(z - 15) + 1.2], w);
    }
  }
}
function crossings(o, d) {
  ribbon(o, 'road', p.road, 11.9, 0.07, 0.4);
  ribbon(o, 'concrete', p.bridge, 7, 0, 0.85);
  const normals = pathNormals(p.bridge);
  for (let i = 1; i < p.bridge.length; i++) {
    const a = p.bridge[i - 1],
      b = p.bridge[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = normals[i - 1],
      m = normals[i];
    for (const side of [-1, 1]) {
      const P = (q, y, t = 0) => [
        q[0] + (n[0] + (m[0] - n[0]) * t) * side * 3.45,
        y,
        q[1] + (n[1] + (m[1] - n[1]) * t) * side * 3.45,
      ];
      if (d) {
        for (const y of [0.52, 1.1]) beam(o, 'gate', P(a, y), P(b, y, 1), 0.07, 0.07, C.gate);
        const count = Math.max(1, Math.round(len / [1, 14, 4, 2.5][d]));
        for (let k = 0; k < count; k++) {
          const q = mix(a, b, k / count);
          beam(o, 'gate', P(q, 0, k / count), P(q, 1.15, k / count), 0.08, 0.08, C.gate);
        }
      } else {
        const q = [P(a, 0.15), P(b, 0.15, 1), P(b, 1.1, 1), P(a, 1.1)];
        Q(o, 'gate', q);
        Q(o, 'gate', [...q].reverse());
      }
    }
  }
}
function build(o, _f, d = 3) {
  embankment(o, d);
  chute(o, d);
  crossings(o, d);
}
export const shihmenDamSkyline = (o, f) => build(o, f, 0),
  shihmenDamDistrict = (o, f) => build(o, f, 1),
  shihmenDamStreet = (o, f) => build(o, f, 2),
  shihmenDamCloseup = (o, f) => build(o, f, 3);
export const shihmenDamModel = {
  id: 'shihmen_dam',
  key: 'shihmen_dam',
  cell: 'ws/wsq',
  recipe: 'structure-shihmen-dam.mjs',
  title: 'Shihmen Dam, Taiwan',
  category: 'dam',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [560, 330, -670],
  lookAt: [-50, -45, -80],
  portableGroundY: -142,
  mediumFiContext: { scale: 1.15, groundY: -142 },
  qaCameras: [
    {
      name: 'whole-rockfill-embankment-crest-and-six-gate-spillway',
      position: [480, 300, -600],
      lookAt: [-45, -45, -80],
    },
    {
      name: 'six-radial-gates-piers-hoists-and-original-crossing',
      position: [245, 42, 30],
      lookAt: [175, -8, -70],
    },
    {
      name: 'complete-open-dry-chute-curved-walls-and-exit',
      position: [390, 140, -400],
      lookAt: [165, -55, -205],
    },
    {
      name: 'riprap-ground-cover-face-and-crest-profile',
      position: [-120, 6, 80],
      lookAt: [-155, -25, 40],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent1024m field frozen before geometry unchanged. Composite has implausible deep inland pits, not physical riverbed/foundation controls. Actual live-host bank, structural foundation and provider-to-official crest datum unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-shihmen-dam.mjs',
    level: 'skyline',
    export: 'shihmenDamSkyline',
    errorMeters: 4.0,
    surfaces,
    authoredLevels: {
      district: { export: 'shihmenDamDistrict', errorMeters: 2.0, surfaces },
      street: { export: 'shihmenDamStreet', errorMeters: 0.8, surfaces },
      closeup: { export: 'shihmenDamCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Two exact published2025丘崈ownCC0chute/riprap originals individually inspected/nativeSHA1matched/explicit creator grants bound; Qualla-first30families/zero conflicts and existing published policy pass. Not an inspected whole-embankment photo. Whole main body follows primary engineering dimensions and native crest interpretation with bounded original valley taper/slope/material pattern. Assumed-author Jiang image/museum models/agency images/diagrams unused. No photo textures/generated bitmap/downloaded mesh.',
    'Native interpreted main crest353.50m vs nominal360m retained without geography scaling; entire436.61m road including approaches and full19-node spillway crossing preserved.133.1m maximum depth and520m maximum base width with sin^0.8 valley taper are original engineering approximations, not a surveyed exposed section or natural-hill mesh. Riprap/green-cover distribution,1100 representative rocks and2000 small irregular ground-cover patches at close detail are bounded; no rectangular grass checkerboard. Mitered road/crossing joints preserve original path centers without cracks. Main crest11.9m width, six14x10.61m radial leaves/100m weir/relative gatebottom-17.1m follow primary dimensions; pier/hoist/bridge7m width and lower chute-112m floor/retaining walls/partition fins are estimates. Underground tunnels/independent powerhouse/downstream weir/visitor buildings/water/site floor omitted.',
    'Independent1024m129x129/16641values/four original Terrarium tiles frozen before geometry at fixed eastern crest-crossing junction. Provider datum245.9893m, whole absolute[-3793.6964,361.1883]m retained unchanged; implausible deep inland composite pits are not bathymetry/foundation controls. No fit/flatten/reacquire. Primary252.1m official crest and provider-relative datum not surveyed-compatible; model uses crest-relative engineering heights. Portable/shared/context stageY-142m separate. Native preview/replaceFootprint=false; live-host bank/foundation/threshold contact unverified.',
  ],
};
