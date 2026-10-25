/** Whole Handa heritage brewery group; native outer controls, original bounded sections. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/xn/xn1/handa_red_brick_building/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  P = p.outline.slice(0, -1),
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('995b48'),
    wood: rgb('382b24'),
    stone: rgb('bcb9a7'),
    roof: rgb('666b68'),
    glass: rgb('354340'),
    metal: rgb('a3aaa5'),
  },
  surfaces = {
    brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97, metallic: 0 },
    wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
    stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.85, metallic: 0.12 },
    glass: { slot: 'window', localRef: ref, roughness: 0.64, metallic: 0.04 },
    metal: { slot: 'trim', localRef: ref, roughness: 0.78, metallic: 0.2 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  unit = (v) => v.map((q) => q / Math.hypot(...v)),
  rect = (x0, x1, y0, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, R, height, up = true) {
  const I = earcut(R.flat());
  for (let i = 0; i < I.length; i += 3)
    T(
      o,
      k,
      I.slice(i, i + 3).map((j) => [
        R[j][0],
        typeof height === 'function' ? height(...R[j]) : height,
        R[j][1],
      ]),
      [0, up ? 1 : -1, 0],
    );
}
function faces(R) {
  R = R.filter((q, i) => Math.hypot(...sub(q, R[(i + R.length - 1) % R.length])) > 1e-7);
  if (
    R.reduce(
      (a, q, i) => a + q[0] * R[(i + 1) % R.length][1] - R[(i + 1) % R.length][0] * q[1],
      0,
    ) < 0
  )
    R = R.toReversed();
  return R.map((a, i) => {
    const b = R[(i + 1) % R.length],
      len = Math.hypot(...sub(b, a)),
      u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
      n = [u[2], 0, -u[0]];
    return {
      len,
      u,
      n,
      a,
      b,
      point: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[2] * x + n[2] * z],
    };
  });
}
function prism(o, k, R, y0, y1) {
  for (const f of faces(R))
    Q(o, k, [f.point(0, y0), f.point(f.len, y0), f.point(f.len, y1), f.point(0, y1)], f.n);
  flat(o, k, R, y0, false);
  flat(o, k, R, y1);
}
function box(o, k, x, y, z, w, h, l) {
  prism(
    o,
    k,
    [
      [x - w / 2, z - l / 2],
      [x + w / 2, z - l / 2],
      [x + w / 2, z + l / 2],
      [x - w / 2, z + l / 2],
    ],
    y,
    y + h,
  );
}
function beam(o, k, a, b, w, depth = w) {
  if (Math.hypot(...sub(b, a)) < 1e-6) return;
  const u = unit(sub(b, a)),
    v = unit(cross(u, Math.abs(u[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    n = unit(cross(u, v)),
    at = (c, s, t) => c.map((q, i) => q + (v[i] * s * w) / 2 + (n[i] * t * depth) / 2),
    r = (c) => [at(c, -1, -1), at(c, 1, -1), at(c, 1, 1), at(c, -1, 1)],
    R = r(a),
    S = r(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, k, [R[i], R[j], S[j], S[i]], sub(at(a, i === 0 || i === 3 ? -1 : 1, i < 2 ? -1 : 1), a));
  }
  Q(
    o,
    k,
    R,
    u.map((q) => -q),
  );
  Q(o, k, S, u);
}
function clip(R, axis, v, greater) {
  const out = [];
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      da = (a[axis] - v) * (greater ? 1 : -1),
      db = (b[axis] - v) * (greater ? 1 : -1);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = (v - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((q, k) => q + (b[k] - q) * t));
    }
  }
  let clean = out.filter(
    (q, i) => Math.hypot(...sub(q, out[(i + out.length - 1) % out.length])) > 1e-7,
  );
  for (let pass = 0; pass < out.length; pass++) {
    const old = clean;
    clean = old.filter((q, i) => {
      const a = old[(i + old.length - 1) % old.length],
        b = old[(i + 1) % old.length];
      return Math.abs((q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0])) > 1e-8;
    });
    if (clean.length === old.length) break;
  }
  return clean;
}
function inside(q, R = P) {
  let yes = false;
  for (let i = 0, j = R.length - 1; i < R.length; j = i++)
    if (
      R[i][1] > q[1] !== R[j][1] > q[1] &&
      q[0] < ((R[j][0] - R[i][0]) * (q[1] - R[i][1])) / (R[j][1] - R[i][1]) + R[i][0]
    )
      yes = !yes;
  return yes;
}
function face(o, k, f, R, z = 0, holes = []) {
  const all = [R, ...holes].flat(),
    starts = holes.map((_, i) => R.length + holes.slice(0, i).reduce((s, h) => s + h.length, 0)),
    I = earcut(all.flat(), starts);
  for (let i = 0; i < I.length; i += 3)
    T(
      o,
      k,
      I.slice(i, i + 3).map((j) => f.point(...all[j], z)),
      f.n,
    );
}
function arch(x, y, w, h, N) {
  const r = w / 2,
    cy = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: N + 1 }, (_, i) => [
      x + r * Math.cos((i * Math.PI) / N),
      cy + r * Math.sin((i * Math.PI) / N),
    ]),
  ];
}
function ring(o, k, f, R, z, w) {
  const cx = R.reduce((s, q) => s + q[0], 0) / R.length,
    cy = R.reduce((s, q) => s + q[1], 0) / R.length,
    outer = R.map((q) => [q[0] + Math.sign(q[0] - cx) * w, q[1] + Math.sign(q[1] - cy) * w]);
  face(o, k, f, outer, z, [R]);
}
function opening(o, f, R, d, { blind = false, timber = false } = {}) {
  const depth = d ? A.windowRecess : 0,
    back = d ? -depth : 0.016;
  face(o, blind ? 'brick' : 'glass', f, R, back);
  if (d)
    for (let i = 0; i < R.length; i++) {
      const j = (i + 1) % R.length,
        a = R[i],
        b = R[j],
        n = [f.u[0] * (a[1] - b[1]), b[0] - a[0], f.u[2] * (a[1] - b[1])];
      Q(
        o,
        'brick',
        [f.point(...a), f.point(...b), f.point(...b, -depth), f.point(...a, -depth)],
        n,
      );
    }
  if (d > 1) {
    ring(o, timber ? 'wood' : 'brick', f, R, 0.018, timber ? 0.09 : 0.14);
    if (!blind) {
      const x0 = Math.min(...R.map((q) => q[0])),
        x1 = Math.max(...R.map((q) => q[0])),
        y0 = Math.min(...R.map((q) => q[1])),
        y1 = Math.max(...R.map((q) => q[1])),
        x = (x0 + x1) / 2;
      for (const yy of [y0 + (y1 - y0) * 0.33, y0 + (y1 - y0) * 0.66])
        beam(o, timber ? 'wood' : 'metal', f.point(x0, yy, -0.13), f.point(x1, yy, -0.13), 0.045);
      beam(
        o,
        timber ? 'wood' : 'metal',
        f.point(x, y0, -0.13),
        f.point(x, y1 - 0.08, -0.13),
        0.045,
      );
    }
    if (!timber) {
      const x = (R[0][0] + R[1][0]) / 2,
        y = Math.max(...R.map((q) => q[1]));
      face(
        o,
        'stone',
        f,
        [
          [x - 0.095, y + 0.08],
          [x + 0.095, y + 0.08],
          [x + 0.14, y + 0.4],
          [x - 0.14, y + 0.4],
        ],
        0.03,
      );
      const y0 = R[0][1];
      face(o, 'stone', f, rect(R[0][0] - 0.15, R[1][0] + 0.15, y0 - 0.12, y0), 0.055);
    }
  }
}
function parts() {
  const north = clip(P, 1, A.northBandEnd, false),
    mid = clip(clip(P, 1, A.northBandEnd, true), 1, A.middleBandEnd, false),
    south = clip(P, 1, A.middleBandEnd, true),
    part = (id, R, eaves, ridge, timber = false) => ({ id, R, eaves, ridge, timber });
  return [
    part('west-gable', clip(north, 0, A.westGableEnd, false), A.westEaves, A.westRidge),
    part(
      'broad-central-gable',
      clip(clip(north, 0, A.westGableEnd, true), 0, A.mainTowerStart, false),
      A.centralEaves,
      A.centralRidge,
    ),
    part(
      'high-main-gable',
      clip(north, 0, A.mainTowerStart, true),
      A.mainTowerEaves,
      A.mainTowerRidge,
    ),
    part('low-attached-shop', clip(mid, 0, A.westGableEnd, false), 3.7, 4.25),
    part(
      'flat-storage',
      clip(clip(mid, 0, A.westGableEnd, true), 0, A.mainTowerStart, false),
      A.storageTop,
      A.storageTop,
    ),
    part('main-middle', clip(mid, 0, A.mainTowerStart, true), A.southBrickEaves, A.southBrickRidge),
    part(
      'half-timbered-wing',
      clip(south, 0, A.halfTimberEnd, false),
      A.timberEaves,
      A.timberRidge,
      true,
    ),
    part(
      'southern-brick-wing',
      clip(south, 0, A.halfTimberEnd, true),
      A.southBrickEaves,
      A.southBrickRidge,
    ),
  ];
}
export function handaParts() {
  return parts();
}
function building(o, b, d) {
  const xs = b.R.map((q) => q[0]),
    lo = Math.min(...xs),
    hi = Math.max(...xs),
    mid = (lo + hi) / 2,
    height = (x) => b.eaves + (b.ridge - b.eaves) * (1 - Math.abs(x - mid) / ((hi - lo) / 2));
  const Fs = faces(b.R);
  for (const f of Fs) {
    const yy = [height(f.a[0]), height(f.b[0])],
      isGable =
        Math.abs(f.u[0]) > 0.95 &&
        b.ridge > b.eaves &&
        mid > Math.min(f.a[0], f.b[0]) + 0.01 &&
        mid < Math.max(f.a[0], f.b[0]) - 0.01,
      top = isGable
        ? [
            [f.len, yy[1]],
            [(f.len * (mid - f.a[0])) / (f.b[0] - f.a[0]), b.ridge],
            [0, yy[0]],
          ]
        : [
            [f.len, yy[1]],
            [0, yy[0]],
          ],
      R = [[0, 0], [f.len, 0], ...top],
      hs = [],
      details = [],
      external = !inside([f.point(f.len / 2, 1, 0.05)[0], f.point(f.len / 2, 1, 0.05)[2]]),
      towerFront = b.id === 'high-main-gable' && f.n[2] > 0.9 && !external,
      outside = external || towerFront;
    if (outside) {
      const N = towerFront
          ? 3
          : Math.max(
              1,
              Math.floor(f.len / (b.timber ? A.timberBayPitch : d === 0 ? 8 : d === 1 ? 9 : 5.7)),
            ),
        rows = towerFront
          ? [15.1]
          : b.timber
            ? [0.75, 4.15]
            : b.eaves > 17
              ? [0.8, 5.2, 10, 15.1]
              : b.eaves > 11
                ? [0.8, 8.5]
                : [0.8, 5.8];
      for (const y of rows)
        for (let i = 0; i < N; i++) {
          if (b.timber && i % 2 === 1) continue;
          // The rear's broad central and western masses have high blind panels and few low windows.
          if (f.n[2] < -0.9 && !b.timber && y > 3 && b.id !== 'high-main-gable') continue;
          const x = (f.len * (i + 0.5)) / N,
            door = b.timber && y < 1 && i % 4 === 0,
            yBase = door ? 0.06 : y,
            w = towerFront ? 1.4 : b.timber ? (door ? 1.4 : 1.0) : A.windowWidth,
            h = towerFront ? 2.2 : b.timber ? (door ? 2.65 : 1.6) : A.windowHeight;
          if (x - w / 2 < 0.4 || x + w / 2 > f.len - 0.4 || y + h > b.eaves - 0.55) continue;
          const blind = !b.timber && b.id === 'high-main-gable' && i % 3 === 1 && y > 6,
            H = b.timber
              ? rect(x - w / 2, x + w / 2, yBase, yBase + h)
              : arch(x, y, w, h, [3, 4, 8, 12][d]);
          hs.push(H);
          details.push({ H, blind, timber: b.timber });
        }
    }
    face(o, 'brick', f, R, 0, d ? hs : []);
    for (const h of details) opening(o, f, h.H, d, h);
    if (b.timber && outside && d === 0) {
      for (const y of [0.22, 3.4, 6.63])
        face(o, 'wood', f, rect(0, f.len, y - 0.085, y + 0.085), 0.09);
      const N = Math.max(1, Math.round(f.len / A.timberBayPitch));
      for (let i = 0; i <= N; i++)
        face(
          o,
          'wood',
          f,
          rect(
            Math.max(0, (i * f.len) / N - 0.085),
            Math.min(f.len, (i * f.len) / N + 0.085),
            0,
            6.8,
          ),
          0.1,
        );
    }
    if (b.timber && outside && d > 0) {
      const N = Math.max(1, Math.round(f.len / A.timberBayPitch)),
        pitch = f.len / N;
      for (const y of [0.22, 3.4, 6.63])
        beam(o, 'wood', f.point(0, y, 0.09), f.point(f.len, y, 0.09), A.frameWidth, 0.22);
      for (let i = 0; i <= N; i++)
        beam(
          o,
          'wood',
          f.point(i * pitch, 0, 0.09),
          f.point(i * pitch, 6.8, 0.09),
          A.frameWidth,
          0.22,
        );
      for (let i = 0; i < N; i++)
        if (i % 2 === 1 || d === 0)
          for (const [y0, y1] of [
            [0.4, 3.3],
            [3.55, 6.6],
          ]) {
            beam(
              o,
              'wood',
              f.point(i * pitch + 0.1, y0, 0.11),
              f.point((i + 1) * pitch - 0.1, y1, 0.11),
              A.frameWidth,
              0.2,
            );
            if (d > 0)
              beam(
                o,
                'wood',
                f.point(i * pitch + 0.1, y1, 0.11),
                f.point((i + 1) * pitch - 0.1, y0, 0.11),
                A.frameWidth,
                0.2,
              );
          }
      if (isGable)
        for (const q of top)
          beam(o, 'wood', f.point(0, yy[0], 0.08), f.point(...q, 0.08), 0.15, 0.18);
    }
    if (!b.timber && outside && d > 0) {
      for (const x of [0, f.len]) {
        const h = height(f.point(x, 0)[0]);
        box(
          o,
          'brick',
          ...(() => {
            const q = f.point(x, 0, 0.06);
            return [q[0], 0, q[2], 0.25, h, 0.25];
          })(),
        );
      }
      for (const y of [b.eaves - 0.25, ...(b.eaves > 17 ? [5, 10, 14.8] : [])])
        if (y < b.eaves)
          beam(o, 'stone', f.point(0, y, 0.035), f.point(f.len, y, 0.035), 0.13, 0.09);
      if (f.n[2] < -0.9 && b.id !== 'high-main-gable' && d > 1) {
        const N = Math.max(1, Math.round(f.len / 5.5));
        for (let i = 1; i < N; i++)
          beam(
            o,
            'brick',
            f.point((i * f.len) / N, 0, 0.055),
            f.point((i * f.len) / N, b.eaves - 0.55, 0.055),
            0.22,
            0.12,
          );
      }
      if (isGable) {
        const c = (f.len * (mid - f.a[0])) / (f.b[0] - f.a[0]);
        for (const [a, q] of [
          [
            [0, yy[0]],
            [c, b.ridge],
          ],
          [
            [c, b.ridge],
            [f.len, yy[1]],
          ],
        ])
          beam(o, 'stone', f.point(...a, 0.04), f.point(...q, 0.04), 0.19, 0.26);
        if (d > 1) {
          const center = f.len / 2,
            y = b.eaves + (b.ridge - b.eaves) * 0.34,
            rad = 0.45,
            N = d === 3 ? 24 : 12,
            R = Array.from({ length: N }, (_, i) => [
              center + rad * Math.cos((i * 2 * Math.PI) / N),
              y + rad * Math.sin((i * 2 * Math.PI) / N),
            ]);
          face(o, 'glass', f, R, 0.018);
          ring(o, 'brick', f, R, 0.04, 0.14);
          for (const [dx, dy] of [
            [0, 0.63],
            [0.63, 0],
            [0, -0.63],
            [-0.63, 0],
          ])
            face(
              o,
              'stone',
              f,
              rect(center + dx - 0.09, center + dx + 0.09, y + dy - 0.09, y + dy + 0.09),
              0.055,
            );
        }
        if (d === 3 && b.id === 'high-main-gable')
          for (let i = 0; i < 15; i++) {
            const x = (f.len * (i + 0.5)) / 15,
              y = height(f.point(x, 0)[0]) - 0.55;
            face(o, 'brick', f, rect(x - 0.13, x + 0.13, y - 0.25, y + 0.04), 0.16);
          }
      }
    }
  }
  flat(o, 'brick', b.R, 0, false);
  for (const side of [false, true]) {
    const R = clip(b.R, 0, mid, side);
    if (R.length > 2) flat(o, 'roof', R, height);
  }
  if (d > 1)
    for (const f of Fs) {
      const a = f.point(0, height(f.a[0]), 0.04),
        z = f.point(f.len, height(f.b[0]), 0.04);
      if (Math.abs(f.u[2]) > 0.9) beam(o, 'metal', a, z, 0.13, 0.16);
    }
}
function build(o, _f, d = 3) {
  for (const b of parts()) building(o, b, d);
  if (d > 0) {
    // Discrete low roof plant vocabulary visible behind the timber frontage.
    for (const x of [-9, -3]) {
      box(o, 'metal', x, A.storageTop, 0, 2.4, 1.25, 2);
      if (d > 1)
        for (let i = 0; i < 4; i++)
          box(o, 'roof', x, A.storageTop + 0.2 + i * 0.23, 1.02, 2.15, 0.07, 0.055);
    }
    for (const x of [-10, -2]) box(o, 'metal', x, A.storageTop, 1.2, 0.14, 1.8, 0.14);
    beam(o, 'metal', [-10, A.storageTop + 1.8, 1.2], [-2, A.storageTop + 1.8, 1.2], 0.16);
  }
}
export const handaSkyline = (o, f) => build(o, f, 0);
export const handaDistrict = (o, f) => build(o, f, 1);
export const handaStreet = (o, f) => build(o, f, 2);
export const handaCloseup = (o, f) => build(o, f, 3);
export const handaRedBrickModel = {
  id: 'handa_red_brick_building',
  key: 'handa_red_brick_building',
  cell: 'xn/xn1',
  recipe: 'structure-handa-red-brick-building.mjs',
  title: 'Handa Red Brick Building',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-112, 57, 116],
  lookAt: [0, 7, 0],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 2.8, groundY: -0.16 },
  qaCameras: [
    {
      name: 'whole-native-heritage-group-and-connected-roofs',
      position: [-99, 57, 112],
      lookAt: [0, 7, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'whole-north-brick-gable-group-and-blind-panels',
      position: [20, 23, -100],
      lookAt: [-3, 9, -20],
    },
    {
      name: 'half-timbered-long-frontage-and-window-recesses',
      position: [-34, 9, 27],
      lookAt: [-4, 4, 18],
    },
    {
      name: 'high-main-gable-arches-keystones-and-corbelled-coping',
      position: [42, 23, -52],
      lookAt: [13, 16, -29],
    },
    {
      name: 'whole-connected-group-roof-subdivisions-and-storage',
      position: [79, 58, 74],
      lookAt: [0, 8, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-handa-red-brick-building.mjs',
    level: 'skyline',
    export: 'handaSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'handaDistrict', errorMeters: 0.55, surfaces },
      street: { export: 'handaStreet', errorMeters: 0.16, surfaces },
      closeup: { export: 'handaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole surviving connected heritagegroup retained: all12 nativeoutercontrols, mainredbrick gabledmasses/flatstorage/half-timbered wing, darkwoodXbraces/two windowranks, arched and blindbrickpanels, small circularvents/palekeystones/copings/bands and bounded roofplant. Separate2022replicaadvertisingtower/demolishedfactorywings/museuminteriors/display/people/neighbors/landscape/signage excluded.',
    'Three exactpublishedQualla Own/selfCC0 exteriororiginals individuallyinspected/nativeSHA1matched. Hero/otherinteriorreferences unselected; no protected or questionable pixels/sourcebody/media/metadata repair, no supplementalphotos or phototextures. Componentboundaries/roofbearings/heights/hiddenwalls/windowcensus/plantlayout are original bounded mediumfi estimates rather than a surveyed brewery plan.',
    'Independent400m129x129 field/16641samples/one originalrawtile frozen before allfloor/section/geometry choices. Flat referencefloor0 relative9m provider datum unsurveyed. Originalgrid/PNG/rawtile immutable; precisefooting/threshold/gradecontact unresolved, geographicpreview/replaceFootprintfalse. No fittedground or modeled siteplate.',
  ],
};
