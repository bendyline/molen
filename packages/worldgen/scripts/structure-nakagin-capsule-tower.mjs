/** Nakagin Capsule Tower: dated whole exterior, original native lower plan and photo-estimated capsules. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/xn/xn7/nakagin_capsule_tower/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  P = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    shell: rgb('c2c5bf'),
    trim: rgb('626b6a'),
    glass: rgb('526366'),
    core: rgb('78523f'),
    base: rgb('a5a69b'),
  },
  surfaces = {
    shell: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.1 },
    trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.27 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.37, metallic: 0.08 },
    core: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0.12 },
    base: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  };
const area = (r) =>
    r.reduce((s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0),
  mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
function T(o, s, q, n, col = C[s]) {
  q = q.map((a) => a.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.6 ? [v[0], v[2]] : Math.abs(N[0]) > 0.6 ? [v[2], v[1]] : [v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], typeof y === 'function' ? y(r[k]) : y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, r, lo, hi, col = C[s]) {
  cap(o, s, r, lo, false, col);
  cap(o, s, r, hi, true, col);
  const sg = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], typeof hi === 'function' ? hi(b) : hi, b[1]],
        [a[0], typeof hi === 'function' ? hi(a) : hi, a[1]],
      ],
      [sg * (b[1] - a[1]), 0, sg * (a[0] - b[0])],
      col,
    );
  }
}
export function nakaginCapsules() {
  const modules = [];
  for (let t = 0; t < P.cores.length; t++) {
    const core = P.cores[t];
    let slot = 0;
    for (const n of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ])
      for (const offset of [-1.35, 1.35]) {
        if (((t === 0 && n[0] === 1) || (t === 1 && n[0] === -1)) && offset < 0) continue;
        const u = [n[1], -n[0]],
          shift = [0, 0.7, 1.35, 0.4, 1.1, 0.15, 0.85][slot],
          depth = P.moduleDepth + [0.12, -0.18, 0.28, 0, -0.13, 0.22, -0.05][slot];
        for (let row = 0; row < core.rows; row++) {
          const alternation = [0, 4, 6].includes(slot)
            ? (row + slot) % 4 === 1
              ? 0.2
              : 0
            : (row + slot) % 4 < 2
              ? -1.4
              : 0.22;
          modules.push({
            tower: t,
            slot,
            row,
            n,
            u,
            back: [
              core.center[0] + (n[0] * P.coreWidth) / 2 + u[0] * offset,
              core.center[1] + (n[1] * P.coreWidth) / 2 + u[1] * offset,
            ],
            y: P.podiumTop + row * P.tierRise + shift,
            depth: depth + alternation,
            width: P.moduleWidth - 0.08,
            height: P.moduleHeight,
          });
        }
        slot++;
      }
  }
  return modules;
}
function faceOutline(w, h, bevel) {
  return bevel
    ? [
        [-w / 2 + 0.09, 0],
        [w / 2 - 0.09, 0],
        [w / 2, 0.09],
        [w / 2, h - 0.09],
        [w / 2 - 0.09, h],
        [-w / 2 + 0.09, h],
        [-w / 2, h - 0.09],
        [-w / 2, 0.09],
      ]
    : [
        [-w / 2, 0],
        [w / 2, 0],
        [w / 2, h],
        [-w / 2, h],
      ];
}
function circleAngles(r, cy, n) {
  const aa = [
    ...Array.from({ length: n }, (_, i) => (i * Math.PI * 2) / n),
    ...r.map((a) => (Math.atan2(a[1] - cy, a[0]) + Math.PI * 2) % (Math.PI * 2)),
  ].sort((a, b) => a - b);
  return aa.filter((v, i) => !i || v - aa[i - 1] > 1e-6);
}
function edgePoint(r, cy, a) {
  const d = [Math.cos(a), Math.sin(a)],
    cr = (a, b) => a[0] * b[1] - a[1] * b[0];
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const q = [r[i][0], r[i][1] - cy],
      b = r[(i + 1) % r.length],
      e = [b[0] - r[i][0], b[1] - r[i][1]],
      den = cr(d, e);
    if (Math.abs(den) < 1e-9) continue;
    const t = cr(q, e) / den,
      u = cr(q, d) / den;
    if (t >= 0 && u >= -1e-8 && u <= 1 + 1e-8) best = Math.min(best, t);
  }
  if (!Number.isFinite(best)) throw Error('Uncovered capsule face');
  return [d[0] * best, cy + d[1] * best];
}
function capsule(o, m, d) {
  const { n, u, back, y, depth: L, width: w, height: h } = m,
    N = [n[0], 0, n[1]],
    V = (x, Y, z) => [back[0] + u[0] * x + n[0] * z, y + Y, back[1] + u[1] * x + n[1] * z],
    r = faceOutline(w, h, d > 2),
    cy = h * 0.51,
    tint = C.shell.map((v) => v * (0.96 + 0.018 * ((m.row * 3 + m.slot + m.tower) % 5)));
  // Every capsule is a separate volume. Near front surfaces are actually open around recessed glass.
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      'shell',
      [V(a[0], a[1], 0), V(b[0], b[1], 0), V(b[0], b[1], L), V(a[0], a[1], L)],
      null,
      tint,
    );
  }
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      'shell',
      ix.slice(i, i + 3).map((k) => V(...r[k], 0)),
      N.map((v) => -v),
      tint,
    );
  if (d < 2) {
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        'shell',
        ix.slice(i, i + 3).map((k) => V(...r[k], L)),
        N,
        tint,
      );
    for (const [s, R, z] of [
      ['trim', 0.7, L + 0.018],
      ['glass', 0.625, L + 0.037],
    ]) {
      const count = 6;
      for (let i = 1; i < count - 1; i++)
        T(
          o,
          s,
          [0, i, i + 1].map((k) =>
            V(
              Math.cos((k * Math.PI * 2) / count) * R,
              cy + Math.sin((k * Math.PI * 2) / count) * R,
              z,
            ),
          ),
          N,
        );
    }
    return;
  }
  const aa = circleAngles(r, cy, d > 2 ? 24 : 8),
    circle = (a, R, z) => V(Math.cos(a) * R, cy + Math.sin(a) * R, z),
    recess = d > 2 ? 0.16 : 0.13;
  for (let i = 0; i < aa.length; i++) {
    const a = aa[i],
      b = aa[(i + 1) % aa.length],
      A = edgePoint(r, cy, a),
      Bb = edgePoint(r, cy, b);
    Q(o, 'shell', [V(...A, L), V(...Bb, L), circle(b, 0.715, L), circle(a, 0.715, L)], N, tint);
    Q(
      o,
      'trim',
      [
        circle(a, 0.715, L + 0.003),
        circle(b, 0.715, L + 0.003),
        circle(b, 0.65, L + 0.016),
        circle(a, 0.65, L + 0.016),
      ],
      N,
    );
    Q(
      o,
      'trim',
      [
        circle(a, 0.65, L + 0.016),
        circle(b, 0.65, L + 0.016),
        circle(b, 0.65, L - recess),
        circle(a, 0.65, L - recess),
      ],
      null,
    );
    if (d > 2)
      Q(
        o,
        'trim',
        [
          circle(a, 0.65, L - recess),
          circle(b, 0.65, L - recess),
          circle(b, 0.615, L - recess - 0.025),
          circle(a, 0.615, L - recess - 0.025),
        ],
        N,
      );
  }
  for (let i = 1; i < aa.length - 1; i++)
    T(
      o,
      'glass',
      [0, i, i + 1].map((k) =>
        circle(aa[k], d > 2 ? 0.615 : 0.65, L - recess - (d > 2 ? 0.025 : 0)),
      ),
      N,
    );
  if (d > 2) {
    const side = m.slot % 2 ? 1 : -1,
      x = (side * w) / 2,
      front = L - 0.52,
      vent = (z, Y) => V(x, Y, z),
      out = [u[0] * side, 0, u[1] * side];
    Q(
      o,
      'trim',
      [
        vent(front - 0.48, h - 0.63),
        vent(front + 0.12, h - 0.63),
        vent(front + 0.12, h - 0.27),
        vent(front - 0.48, h - 0.27),
      ],
      out,
    );
    for (let j = 1; j < 4; j++) {
      const lo = vent(front - 0.46, h - 0.63 + j * 0.085),
        hi = vent(front + 0.1, h - 0.63 + j * 0.085);
      beam(o, 'trim', lo, hi, 0.025, 0.018, C.trim);
    }
    for (const sx of [-1, 1])
      for (const yy of [0.16, h - 0.16]) {
        const q = V(sx * (w / 2 - 0.16), yy, L + 0.007);
        B(o, 'trim', q[0], q[1] - 0.025, q[2], 0.045, 0.05, 0.045);
      }
  }
}
function skylineStacks(o) {
  for (let t = 0; t < 2; t++)
    for (let slot = 0; slot < 7; slot++) {
      const ms = nakaginCapsules().filter((m) => m.tower === t && m.slot === slot),
        a = ms[0],
        last = ms.at(-1),
        n = a.n,
        u = a.u,
        L = Math.max(...ms.map((m) => m.depth)),
        lo = a.y,
        hi = last.y + a.height,
        V = (x, y, z) => [a.back[0] + u[0] * x + n[0] * z, y, a.back[1] + u[1] * x + n[1] * z],
        w = a.width;
      const corners = [V(-w / 2, lo, 0), V(w / 2, hi, L)];
      box(
        o,
        'shell',
        [Math.min(...corners.map((q) => q[0])), lo, Math.min(...corners.map((q) => q[2]))],
        [Math.max(...corners.map((q) => q[0])), hi, Math.max(...corners.map((q) => q[2]))],
        C.shell,
      );
      for (let k = 0; k < 3; k++) {
        const y = lo + ((hi - lo) * (k + 0.5)) / 3,
          R = 0.64;
        Q(
          o,
          'glass',
          [V(0, y - R, L + 0.03), V(R, y, L + 0.03), V(0, y + R, L + 0.03), V(-R, y, L + 0.03)],
          [n[0], 0, n[1]],
        );
      }
      // A few original-depth projections preserve irregular jagged stacks without every far-distance joint.
      if (slot % 2 === 0) {
        const mid = ms[Math.floor(ms.length / 2)],
          q = [mid.back[0] + n[0] * (L + 0.1), mid.y, mid.back[1] + n[1] * (L + 0.1)];
        beam(
          o,
          'trim',
          [q[0] - (u[0] * w) / 2, q[1], q[2] - (u[1] * w) / 2],
          [q[0] + (u[0] * w) / 2, q[1], q[2] + (u[1] * w) / 2],
          0.07,
          0.06,
          C.trim,
        );
      }
    }
}
function cores(o, d) {
  for (const c of P.cores) {
    const [x, z] = c.center,
      w = P.coreWidth,
      r = [
        [x - w / 2, z - w / 2],
        [x + w / 2, z - w / 2],
        [x + w / 2, z + w / 2],
        [x - w / 2, z + w / 2],
      ],
      top = (q) => c.top - (2.7 * (q[0] - x + w / 2)) / w,
      clad = c.top - 10.2;
    prism(o, 'base', r, 0.02, clad);
    prism(o, 'core', r, clad, top);
    if (d) {
      const count = [0, 4, 16, 45][d];
      for (let i = 0; i < 4; i++) {
        const a = r[i],
          b = r[(i + 1) % 4],
          sg = Math.sign(area(r)),
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          normal = [(sg * (b[1] - a[1])) / len, (sg * (a[0] - b[0])) / len];
        for (let k = 1; k < count; k++) {
          const q = mix(a, b, k / count),
            A = [q[0] + normal[0] * 0.025, clad, q[1] + normal[1] * 0.025],
            Bb = [A[0], top(q), A[2]];
          beam(
            o,
            'core',
            A,
            Bb,
            d > 2 ? 0.028 : 0.05,
            0.028,
            C.core.map((v) => v * 0.83),
          );
        }
      }
    }
    if (d > 1) {
      for (const [dx, dz, h] of [
        [-0.8, -0.4, 1.4],
        [0.85, 0.35, 2],
      ]) {
        const q = [x + dx, z + dz],
          y = top(q);
        beam(o, 'trim', [q[0], y, q[1]], [q[0], y + h, q[1]], 0.045, 0.045, C.trim);
        beam(
          o,
          'trim',
          [q[0] - 0.55, y + h - 0.2, q[1]],
          [q[0] + 0.55, y + h - 0.2, q[1]],
          0.025,
          0.025,
          C.trim,
        );
      }
    }
  }
}
function podium(o, d) {
  const r = p.outline;
  prism(o, 'base', r, -0.15, P.podiumTop);
  const sg = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1.6) continue;
    const n = [(sg * (b[1] - a[1])) / len, 0, (sg * (a[0] - b[0])) / len],
      A = [a[0] + n[0] * 0.025, 3.7, a[1] + n[2] * 0.025],
      Bb = [b[0] + n[0] * 0.025, 3.7, b[1] + n[2] * 0.025];
    Q(o, 'glass', [A, Bb, [Bb[0], 5.5, Bb[2]], [A[0], 5.5, A[2]]], n);
    if (d) {
      const count = Math.max(1, Math.round(len / [1, 3.4, 1.4, 0.9][d]));
      for (let k = 0; k <= count; k++) {
        const q = mix(A, Bb, k / count);
        beam(o, 'trim', q, [q[0], 5.5, q[2]], 0.06, 0.06, C.trim);
      }
      beam(o, 'trim', [A[0], 5.6, A[2]], [Bb[0], 5.6, Bb[2]], 0.09, 0.09, C.trim);
    }
  }
  if (d) {
    const a = r[0],
      b = r[1],
      mid = mix(a, b, 0.5),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [(sg * (b[1] - a[1])) / len, 0, (sg * (a[0] - b[0])) / len],
      u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
      V = (x, y, z) => [mid[0] + u[0] * x + n[0] * z, y, mid[1] + u[2] * x + n[2] * z];
    Q(
      o,
      'glass',
      [V(-1.15, 0.1, 0.04), V(1.15, 0.1, 0.04), V(1.15, 2.8, 0.04), V(-1.15, 2.8, 0.04)],
      n,
    );
    for (const x of [-1.2, 0, 1.2])
      beam(o, 'trim', V(x, 0.08, 0.07), V(x, 2.85, 0.07), 0.07, 0.07, C.trim);
    Q(
      o,
      'base',
      [V(-1.45, 2.95, 0), V(1.45, 2.95, 0), V(1.45, 2.95, 1), V(-1.45, 2.95, 1)],
      [0, 1, 0],
    );
    Q(
      o,
      'base',
      [V(-1.45, 2.78, 0), V(1.45, 2.78, 0), V(1.45, 2.78, 1), V(-1.45, 2.78, 1)],
      [0, -1, 0],
    );
  }
}
function build(o, _f, d = 3) {
  podium(o, d);
  cores(o, d);
  if (d === 0) skylineStacks(o);
  else for (const m of nakaginCapsules()) capsule(o, m, d);
}
export const nakaginCapsuleTowerSkyline = (o, f) => build(o, f, 0),
  nakaginCapsuleTowerDistrict = (o, f) => build(o, f, 1),
  nakaginCapsuleTowerStreet = (o, f) => build(o, f, 2),
  nakaginCapsuleTowerCloseup = (o, f) => build(o, f, 3);
export const nakaginCapsuleTowerModel = {
  id: 'nakagin_capsule_tower',
  key: 'nakagin_capsule_tower',
  cell: 'xn/xn7',
  recipe: 'structure-nakagin-capsule-tower.mjs',
  title: 'Nakagin Capsule Tower',
  category: 'tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: p.appearance,
  brief: p.authoringDirection,
  camera: [47, 34, 65],
  lookAt: [0, 22, 0],
  portableGroundY: -0.17,
  mediumFiContext: { scale: 1, groundY: -0.17 },
  qaCameras: [
    {
      name: 'whole-two-unequal-cores-and-native-lower-building',
      position: [50, 35, 65],
      lookAt: [0, 22, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'capsule-cantilevers-real-round-recesses-and-undersides',
      position: [18, 22, 23],
      lookAt: [3, 23, 5],
    },
    { name: 'both-slanted-red-brown-service-tops', position: [-33, 52, -41], lookAt: [0, 37, 0] },
    {
      name: 'complete-native-podium-and-original-entrance',
      position: [19, 8, 28],
      lookAt: [0, 3, 2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m modern field before geometry;25.3673m street approach datum is not a2022historic-grade survey. True host contact remains unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-nakagin-capsule-tower.mjs',
    level: 'skyline',
    export: 'nakaginCapsuleTowerSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'nakaginCapsuleTowerDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'nakaginCapsuleTowerStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'nakaginCapsuleTowerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Historical-only representative late operational structural form2022-03-01, opt-in2022-01-01through2022-04-12; current world excluded.1978unobstructed whole composition and April23,2022structural photographs are distinguished; later images show demolition preparation, which is omitted. No exactMarch exposure/unchanged lower finish claim or contemporary replacement model.',
    'Whole original18-point low building retained. All-around two unequal cores/140near capsules/irregular projections and open cantilever undersides; lower podium/glazing/entry. Main44.6m/short39.2m service caps, core centres/width5.4m,11/9rows/7slots140modules, half-level offsets, upper overhangs beyond lower native footprint and all hidden unit assignments/fine rear/base details are bounded original photo proportions, not a surveyed apartment-number/engineering reconstruction. No verified54mwhole-height claim.',
    'MoMA restoredA1305bounds255x270x423cm guide only approximate capsule proportions; modeled exposed shell2.62mwide/2.55mhigh with original photo-estimated visible projection about2.5–4.6m; hidden attachment/room depths inside the service envelope are not modeled or surveyed, nominal2.7mpitch. Individual near circular openings/reveal/metal rim/recessed dark glass and fine chamfer/side vents/limited panel fittings are actual geometry. Far levels merge stacks, replace recessed apertures by round dark discs and coarsen counts. Exact panel/rivet/patina/vent/shutter census remains bounded.',
    'Qualla-first45families/zero conflicts; three exact published ownCC0 originals adopted with nativeSHA1/revisions/explicit named-author self-release bound: two DrivephotographerApril23,2022whole/core views and RenehaasNovember1978whole silhouette. Fourth samecreator9040x3648panorama inspected but unused because top cropped/base obscured. UnrelatedSonybuilding/other licensed sources/official museum pixels/architect drawings not adopted. No metadata/policy changes, generated bitmap/photo textures/downloaded mesh.',
    'Independent256m129x129modern field/all16641values/two raw Terrarium tiles frozen before geometry unchanged without fitting/flattening/reacquisition.25.3673m provider-relative street datum/0.5906..28.9318m absolute field may include urban structures/viaduct/vegetation interpolation; not historic2022grade or actual live-host contact. Historical native preview/replaceFootprint=false. No full site/natural terrain slab or adjoining viaduct/buildings/road/people/letters/logos/demolition works/interiors.',
  ],
};
