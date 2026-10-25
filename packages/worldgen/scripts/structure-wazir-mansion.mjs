/** Whole native Wazir Mansion, true arched bays and open projecting L verandas. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/tk/tkr/wazir_mansion/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  P = p.outline.slice(0, -1),
  C = {
    wall: rgb('c1ac67'),
    stone: rgb('d5c99f'),
    red: rgb('955747'),
    rail: rgb('d8ceaa'),
    wood: rgb('866442'),
    glass: rgb('606a60'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.98, metallic: 0 },
    stone: { slot: 'trim', localRef: 'palette:#fffffc', roughness: 0.97, metallic: 0 },
    red: { slot: 'trim', graph: 'metal_painted', roughness: 0.92, metallic: 0.04 },
    rail: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.92, metallic: 0.04 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.96, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffd', roughness: 0.78, metallic: 0 },
  },
  sub = (a, b) => a.map((v, k) => v - b[k]),
  dot = (a, b) => a.reduce((t, v, k) => t + v * b[k], 0);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
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
function flat(o, k, R, y, up = true, col = C[k]) {
  const ix = earcut(R.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      k,
      ix.slice(i, i + 3).map((j) => [R[j][0], y, R[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, k, R, y0, y1, col = C[k]) {
  const area = R.reduce(
    (a, v, i) => a + v[0] * R[(i + 1) % R.length][1] - R[(i + 1) % R.length][0] * v[1],
    0,
  );
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    if (area < 0)
      n.forEach((v, j) => {
        n[j] = -v;
      });
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
      col,
    );
  }
  flat(o, k, R, y1, true, col);
  flat(o, k, R, y0, false, col);
}
function face(a, b) {
  const w = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / w),
    mid = a.map((v, i) => (v + b[i]) / 2),
    n = [u[1], 0, -u[0]];
  if (dot(n, [mid[0], 0, mid[1]]) < 0)
    n.forEach((v, i) => {
      n[i] = -v;
    });
  return {
    a,
    b,
    w,
    u,
    n,
    mid,
    point: (x, y, dep = 0) => [mid[0] + u[0] * x + n[0] * dep, y, mid[1] + u[1] * x + n[2] * dep],
  };
}
const faces = P.map((a, i) => face(a, P[(i + 1) % P.length]));
const O = P.map((v, i) => {
    const prev = (i + P.length - 1) % P.length,
      a = faces[prev],
      b = faces[i],
      da = prev <= 2 ? A.verandaDepth : 0,
      db = i <= 2 ? A.verandaDepth : 0,
      pa = [v[0] + a.n[0] * da, v[1] + a.n[2] * da],
      pb = [v[0] + b.n[0] * db, v[1] + b.n[2] * db],
      det = a.u[0] * b.u[1] - a.u[1] * b.u[0];
    if (Math.abs(det) < 0.02)
      return [v[0] + (a.n[0] * da + b.n[0] * db) / 2, v[1] + (a.n[2] * da + b.n[2] * db) / 2];
    const t = ((pb[0] - pa[0]) * b.u[1] - (pb[1] - pa[1]) * b.u[0]) / det;
    return [pa[0] + a.u[0] * t, pa[1] + a.u[1] * t];
  }),
  front = face(O[2], O[3]),
  side = face(O[0], O[2]);
function patch(o, k, f, a, b, lo, hi, dep = 0, col = C[k]) {
  Q(
    o,
    k,
    [
      f.point(a, typeof lo === 'function' ? lo(a) : lo, dep),
      f.point(b, typeof lo === 'function' ? lo(b) : lo, dep),
      f.point(b, typeof hi === 'function' ? hi(b) : hi, dep),
      f.point(a, typeof hi === 'function' ? hi(a) : hi, dep),
    ],
    f.n,
    col,
  );
}
function strip(o, k, f, a, b, y0, y1, inside, out, col = C[k]) {
  prism(
    o,
    k,
    [f.point(a, 0, inside), f.point(b, 0, inside), f.point(b, 0, out), f.point(a, 0, out)].map(
      (v) => [v[0], v[2]],
    ),
    y0,
    y1,
    col,
  );
}
function beam(o, k, a, b, width, col = C[k]) {
  const v = sub(b, a),
    L = Math.hypot(...v),
    u = v.map((x) => x / L),
    r = Math.abs(u[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0],
    n = cross(u, r),
    nl = Math.hypot(...n),
    e = n.map((x) => ((x / nl) * width) / 2),
    g = cross(u, e),
    c = [];
  for (const q of [a, b])
    for (const [s, t] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      c.push(q.map((v, i) => v + s * e[i] + t * g[i]));
  for (let j = 0; j < 4; j++) {
    const next = (j + 1) % 4;
    Q(o, k, [c[j], c[next], c[4 + next], c[4 + j]], cross(sub(c[next], c[j]), v), col);
  }
  Q(
    o,
    k,
    [c[0], c[3], c[2], c[1]],
    u.map((v) => -v),
    col,
  );
  Q(o, k, c.slice(4), u, col);
}
const arch = (h, x) => h.spring + Math.sqrt(Math.max(0, h.r * h.r - (x - h.x) * (x - h.x)));
function bays(f, i, l, d) {
  if (i > 2 || (i !== 2 && d === 0)) return [];
  const count = i === 2 ? 3 : 2,
    r = i === 2 ? (l === 0 ? 0.82 : 0.67) : 0.58;
  return Array.from({ length: count }, (_, j) => ({
    x: ((j - (count - 1) / 2) * f.w) / (count + 0.15),
    r,
    lo: F + l * A.floorRise + 0.14,
    spring: F + l * A.floorRise + (l === 0 ? 2.28 : 2.5),
    depth: A.wallRevealDepth,
  }));
}
function wall(o, f, i, d) {
  const N = [3, 4, 12, 20][d],
    top = F + A.roofTop;
  for (let l = 0; l < 3; l++) {
    const lo = F + l * A.floorRise,
      hi = l === 2 ? top : F + (l + 1) * A.floorRise,
      hs = bays(f, i, l, d),
      xs = [-f.w / 2, f.w / 2];
    for (const h of hs) for (let j = 0; j <= N; j++) xs.push(h.x - h.r + (2 * h.r * j) / N);
    xs.sort((a, b) => a - b);
    const xx = [...new Set(xs)];
    for (let j = 0; j < xx.length - 1; j++) {
      const a = xx[j],
        b = xx[j + 1],
        h = hs.find((h) => (a + b) / 2 > h.x - h.r - 1e-7 && (a + b) / 2 < h.x + h.r + 1e-7);
      if (!h) {
        patch(o, 'wall', f, a, b, lo, hi);
        continue;
      }
      patch(o, 'wall', f, a, b, lo, h.lo);
      patch(o, 'wall', f, a, b, (x) => arch(h, x), hi);
      patch(o, 'glass', f, a, b, h.lo, (x) => arch(h, x), -h.depth);
      Q(
        o,
        'wall',
        [
          f.point(a, arch(h, a)),
          f.point(b, arch(h, b)),
          f.point(b, arch(h, b), -h.depth),
          f.point(a, arch(h, a), -h.depth),
        ],
        [0, -1, 0],
      );
      Q(
        o,
        'wood',
        [
          f.point(a, h.lo),
          f.point(a, h.lo, -h.depth),
          f.point(b, h.lo, -h.depth),
          f.point(b, h.lo),
        ],
        [0, 1, 0],
      );
    }
    for (const h of hs) {
      for (const sg of [-1, 1]) {
        const x = h.x + sg * h.r;
        Q(
          o,
          'wood',
          [
            f.point(x, h.lo),
            f.point(x, h.lo, -h.depth),
            f.point(x, h.spring, -h.depth),
            f.point(x, h.spring),
          ],
          [-sg * f.u[0], 0, -sg * f.u[1]],
        );
        if (d > 1) strip(o, 'wood', f, x - 0.035, x + 0.035, h.lo, h.spring, -0.06, 0.045);
        else if (d === 1) patch(o, 'wood', f, x - 0.035, x + 0.035, h.lo, h.spring, 0.025);
      }
      if (d > 0) {
        for (let j = 0; j < N; j++) {
          const a = (Math.PI * j) / N,
            b = (Math.PI * (j + 1)) / N,
            pt = (t, r) => f.point(h.x + r * Math.cos(t), h.spring + r * Math.sin(t), 0.025);
          Q(
            o,
            'wood',
            [pt(a, h.r - 0.035), pt(b, h.r - 0.035), pt(b, h.r + 0.055), pt(a, h.r + 0.055)],
            f.n,
          );
        }
        if (d > 1) {
          strip(o, 'wood', f, h.x - 0.025, h.x + 0.025, h.lo, h.spring, -0.12, -0.05);
          for (const y of [h.lo + 0.45, h.spring - 0.28, h.spring])
            strip(o, 'wood', f, h.x - h.r + 0.04, h.x + h.r - 0.04, y, y + 0.07, -0.12, -0.05);
        } else {
          patch(o, 'wood', f, h.x - 0.025, h.x + 0.025, h.lo, h.spring, -0.05);
          patch(o, 'wood', f, h.x - h.r + 0.04, h.x + h.r - 0.04, h.spring, h.spring + 0.07, -0.05);
        }
        if (d > 1) {
          for (const sg of [-1, 1])
            strip(
              o,
              'wood',
              f,
              h.x + sg * h.r * 0.51 - 0.11,
              h.x + sg * h.r * 0.51 + 0.11,
              h.lo + 0.12,
              h.lo + 0.67,
              -0.265,
              -0.24,
            );
          for (let j = 0; j < N; j++) {
            const a = (Math.PI * j) / N,
              b = (Math.PI * (j + 1)) / N,
              pt = (t, r) => f.point(h.x + r * Math.cos(t), h.spring + r * Math.sin(t), 0.012);
            Q(
              o,
              'wall',
              [pt(a, h.r + 0.12), pt(b, h.r + 0.12), pt(b, h.r + 0.19), pt(a, h.r + 0.19)],
              f.n,
              rgb('cbbb7b'),
            );
          }
        }
      }
    }
  }
  if (d > 0)
    for (const y of [F + 0.22, F + 3.6, F + 7.66, F + 11.72])
      strip(o, 'wall', f, -f.w / 2, f.w / 2, y, y + 0.1, -0.03, 0.07, rgb('cbbb7b'));
}
function rails(o, f, y, d) {
  for (const h of [0.08, A.verandaRailHeight])
    strip(o, 'rail', f, -f.w / 2, f.w / 2, y + h, y + h + 0.055, -0.045, 0.035);
  const count = [0, 6, 24, 36][d];
  for (let j = 0; d > 0 && j <= count; j++) {
    const x = -f.w / 2 + (f.w * j) / count;
    strip(o, 'rail', f, x - 0.017, x + 0.017, y + 0.1, y + A.verandaRailHeight, -0.025, 0.02);
  }
  if (d > 1) {
    const n = d === 2 ? 6 : 10;
    for (let j = 0; j < n; j++) {
      const x = -f.w / 2 + (f.w * (j + 0.5)) / n,
        w = Math.min(0.24, (f.w / n) * 0.24),
        cy = y + 0.55;
      for (const [a, b] of [
        [
          [-w, 0],
          [0, 0.18],
        ],
        [
          [0, 0.18],
          [w, 0],
        ],
        [
          [w, 0],
          [0, -0.18],
        ],
        [
          [0, -0.18],
          [-w, 0],
        ],
      ])
        beam(
          o,
          'rail',
          f.point(x + a[0], cy + a[1], 0.025),
          f.point(x + b[0], cy + b[1], 0.025),
          0.023,
        );
    }
  }
}
function balconies(o, d) {
  for (const y of [F + A.floorRise, F + 2 * A.floorRise]) {
    prism(
      o,
      'red',
      [O[0], O[1], O[2], O[3], P[3], P[2], P[1], P[0]],
      y - A.verandaSlabThickness,
      y,
    );
    rails(o, front, y, d);
    rails(o, side, y, d);
    for (const [f, count] of [
      [front, 4],
      [side, 5],
    ])
      for (let j = 0; j <= count; j++) {
        if (f === side && j === count) continue;
        const x = -f.w / 2 + (f.w * j) / count,
          postTop = y > F + 1.5 * A.floorRise ? F + A.roofTop : y + A.floorRise;
        strip(
          o,
          'red',
          f,
          x - A.postWidth / 2,
          x + A.postWidth / 2,
          y - 0.22,
          postTop,
          -0.07,
          0.05,
        );
        if (d > 0) {
          beam(
            o,
            'red',
            f.point(x, y - 0.1, -A.verandaDepth + 0.12),
            f.point(x, y - 0.95, -A.verandaDepth + 0.12),
            0.12,
          );
          beam(
            o,
            'red',
            f.point(x, y - 0.12, -0.14),
            f.point(x, y - 0.95, -A.verandaDepth + 0.12),
            0.09,
          );
          if (d > 1) strip(o, 'red', f, x - 0.11, x + 0.11, postTop - 0.18, postTop, -0.1, 0.09);
        }
      }
  }
}
function lathe(o, k, q, y, profile, N) {
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const t0 = (2 * Math.PI * i) / N,
        t1 = (2 * Math.PI * (i + 1)) / N,
        a = profile[j],
        b = profile[j + 1],
        at = (v, t) => [q[0] + v[1] * Math.cos(t), y + v[0], q[1] + v[1] * Math.sin(t)];
      Q(
        o,
        k,
        [at(a, t0), at(a, t1), at(b, t1), at(b, t0)],
        [Math.cos((t0 + t1) / 2), 0, Math.sin((t0 + t1) / 2)],
      );
    }
  const ring = (v) =>
    Array.from({ length: N }, (_, i) => [
      q[0] + v[1] * Math.cos((2 * Math.PI * i) / N),
      q[1] + v[1] * Math.sin((2 * Math.PI * i) / N),
    ]);
  flat(o, k, ring(profile[0]), y + profile[0][0], false);
  flat(o, k, ring(profile.at(-1)), y + profile.at(-1)[0]);
}
function roof(o, d) {
  const y = F + A.roofTop;
  prism(o, 'stone', O, y, y + A.roofSlabThickness);
  const base = y + A.roofSlabThickness,
    fs = O.map((a, i) => face(a, O[(i + 1) % O.length]));
  for (const [i, f] of fs.entries()) {
    if (i === 1 || (d === 0 && i > 2)) continue;
    const sf = i === 0 ? side : f,
      visible = i <= 2,
      n = visible ? (i === 2 ? [5, 12, 23, 28][d] : [6, 16, 36, 44][d]) : [2, 4, 12, 16][d],
      posts = visible ? (i === 2 ? 3 : 4) : 2;
    for (const h of [0, A.roofBalustradeHeight - 0.08])
      strip(o, 'stone', sf, -sf.w / 2, sf.w / 2, base + h, base + h + 0.1, -0.15, 0.08);
    for (let j = 0; j < posts; j++) {
      const x = -sf.w / 2 + (sf.w * j) / posts;
      strip(
        o,
        'stone',
        sf,
        x - 0.14,
        x + 0.14,
        base,
        base + A.roofBalustradeHeight + 0.12,
        -0.2,
        0.13,
      );
      if (d > 1) {
        const q = sf.point(x, 0, -0.03);
        lathe(
          o,
          'stone',
          [q[0], q[2]],
          base + A.roofBalustradeHeight + 0.12,
          [
            [0, 0.1],
            [0.1, 0.16],
            [0.22, 0.12],
            [0.25, 0.025],
          ],
          [4, 4, 8, 10][d],
        );
      }
    }
    const profile =
      d === 0
        ? [
            [0.12, 0.04],
            [0.93, 0.04],
          ]
        : d === 1
          ? [
              [0.12, 0.07],
              [0.48, 0.045],
              [0.94, 0.04],
            ]
          : [
              [0.12, 0.08],
              [0.19, 0.085],
              [0.3, 0.11],
              [0.45, 0.075],
              [0.57, 0.045],
              [0.72, 0.063],
              [0.86, 0.045],
              [0.94, 0.07],
            ];
    for (let j = 0; j < n; j++) {
      const x = -sf.w / 2 + (sf.w * (j + 0.5)) / n;
      if (
        Array.from({ length: posts + 1 }, (_, k) => -sf.w / 2 + (sf.w * k) / posts).some(
          (v) => Math.abs(x - v) < 0.22,
        )
      )
        continue;
      const q = sf.point(x, 0, -0.035);
      lathe(o, 'stone', [q[0], q[2]], base, profile, [3, 3, 4, 8][d]);
    }
  }
}
function build(o, _frame, d = 3) {
  for (const [i, f] of faces.entries()) wall(o, f, i, d);
  flat(o, 'wall', P, F, false);
  balconies(o, d);
  roof(o, d);
}
export const wazirSkyline = (o, f) => build(o, f, 0),
  wazirDistrict = (o, f) => build(o, f, 1),
  wazirStreet = (o, f) => build(o, f, 2),
  wazirCloseup = (o, f) => build(o, f, 3);
const camera = (name, position, lookAt) => ({ name, position, lookAt });
export const wazirMansionModel = {
  id: 'wazir_mansion',
  key: 'wazir_mansion',
  cell: 'tk/tkr',
  recipe: 'structure-wazir-mansion.mjs',
  title: 'Wazir Mansion',
  category: 'building',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [27, 19, 36],
  lookAt: [0, 7, 0],
  portableGroundY: -0.05,
  mediumFiContext: { scale: 1, groundY: -0.05 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera('whole-museum-three-arched-bays-red-open-verandas', [27, 19, 36], [0, 7, 0]),
    camera('whole-east-return-and-native-long-body', [38, 14, 0], [0, 7, 0]),
    camera('front-three-storeys-and-open-balcony-soffits', [12, 9, 31], [2, 6, 8]),
    camera('ground-three-semicircular-reveals-timber-frames', [6, 3, 19], [2, 2, 7.7]),
    camera('open-veranda-posts-diagonal-brackets-cream-rails', [14, 6.7, 19], [3, 5, 8]),
    camera('upper-arches-roof-open-turned-balusters-finials', [12, 15, 19], [1, 11, 7]),
    camera('long-street-return-verandas-and-hidden-census', [22, 10, -11], [2, 7, -1]),
    camera('bounded-hidden-rear-and-party-wall', [-25, 16, -28], [0, 7, 0]),
    camera('whole-five-native-controls-flat-roof-and-l-projections', [0, 51, 0.01], [0, 0, 0]),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-wazir-mansion.mjs',
    level: 'skyline',
    export: 'wazirSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'wazirDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'wazirStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'wazirCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole named museumway692307507/Q7976938/allfive native controls. Fullthree-storey body/three front round-headed bays eachlevel/two openL verandas/slenderredposts/diagonalbrackets/cream original geometric rails/flat roof/open turnedbaluster parapet and ball finials. Western partywall/rear and hidden street-return opening census bounded estimates, no facade-only box/neighborhouse/private interiors.',
    'Qualla-first29families/0conflicts. SolePDlabelledFaizMahal depicts unrelatedKhairpurpalace excluded without pixels; exact24-fileWazir category yielded Miansari66 Own/self|cc-zero2016-12-12 whole4896x3672 original/nativeSHA1matched/terminalexact1file rights and individually inspected. Only clearCC0original used. No protected plans/pixels/signs/artwork/borrowed mesh/generatedbitmap/policy changes.',
    'After independent ground frozen: original bounded floor+.18/three4.05m storeys/roof12.35/slab.24/two1.55m projectingL verandas/.22m slabs/slenderposts/1m geometric creamrails/1.05m open roof balustrade. Skyline coarsens arches/roofbalusters, omits returnwindows/brackets/fineframing but preserves open verandas/nativebody/three-storey front. Hidden sections/census/current finish unsurveyed; temporary rooftop tarp/people/policebarriers/neighbors/signs/wires excluded.',
    'Independent400m129x12916641-value sourcefield/one rawtile/PNG frozen before floor/wall/roof/veranda choices unchanged. Public urban relief not construction-grade, possible building/canopy artifacts; exact source/host footing/threshold contact unresolved/replacementfalse. Flat appearance separate; no terrain fitting/flattening/reacquisition or whole-sitepad.',
  ],
};
