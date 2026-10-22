/** Whole Khaju bridge-dam: real flow vaults, open upper galleries and unequal royal facades. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/tj/tju/khaju_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('b89977'),
    stone: rgb('a8a28e'),
    trim: rgb('d4c3a3'),
    tile: rgb('427d88'),
    dark: rgb('696f5c'),
  },
  surfaces = {
    brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
    stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
    trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
    tile: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.7, metallic: 0 },
    dark: { slot: 'trim', localRef: ref, roughness: 0.98, metallic: 0 },
  };
function T(o, s, q, n) {
  q = q.map((p) => p.map(Math.fround));
  let nn = normalFor(...q);
  if (n && nn.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  nn = normalFor(...q);
  if (Math.hypot(...nn) > 0)
    o.addTriangle(
      s,
      ref,
      q,
      nn,
      q.map((p) => [p[0] + p[2], p[1]]),
      C[s],
    );
}
function Q(o, s, p, n) {
  T(o, s, p.slice(0, 3), n);
  T(o, s, [p[0], p[2], p[3]], n);
}
function B(o, s, x, y, z, w, h, l) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], C[s]);
}

function prism(o, s, p, y0, y1) {
  const area = p.reduce(
      (v, a, i) => v + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ),
    sg = Math.sign(area);
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    for (const [y, n] of [
      [y0, -1],
      [y1, 1],
    ])
      T(
        o,
        s,
        ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
        [0, n, 0],
      );
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
      [sg * (b[1] - a[1]), 0, sg * (a[0] - b[0])],
    );
  }
}
// Two circular arcs meet in a Persian pointed crown. The low LOD retains the same openings.
function curve(x, w, spring, crown, d) {
  const n = [2, 2, 6, 14][d],
    r = w / 2,
    h = crown - spring,
    c = (h * h - r * r) / (2 * r),
    R = r + c;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = -r + (w * i) / n,
      dx = Math.abs(t),
      y =
        spring +
        (h < r
          ? h * Math.pow(1 - dx / r, 0.64)
          : Math.sqrt(Math.max(0, R * R - (dx + c) * (dx + c))));
    return [x + t, y];
  });
}
/** Continuous row, no opaque rectangle behind the arch holes. z may be sloped in plan. */
function row(o, s, a, b, count, width, y, spring, crown, top, z, depth, d, side = 1) {
  const step = (b - a) / count,
    zAt = (x) => (typeof z === 'function' ? z(x) : z);
  const faces = d === 0 ? [side] : [-1, 1];
  function panel(x0, x1, lo, hi) {
    if (x1 <= x0) return;
    for (const sg of faces)
      Q(
        o,
        s,
        [
          [x0, lo, zAt(x0) + (sg * depth) / 2],
          [x1, lo, zAt(x1) + (sg * depth) / 2],
          [x1, hi, zAt(x1) + (sg * depth) / 2],
          [x0, hi, zAt(x0) + (sg * depth) / 2],
        ],
        [0, 0, sg],
      );
    if (d > 0) {
      for (const x of [x0, x1])
        Q(
          o,
          s,
          [
            [x, lo, zAt(x) - depth / 2],
            [x, hi, zAt(x) - depth / 2],
            [x, hi, zAt(x) + depth / 2],
            [x, lo, zAt(x) + depth / 2],
          ],
          [x === x0 ? -1 : 1, 0, 0],
        );
    }
  }
  let end = a;
  for (let j = 0; j < count; j++) {
    const x = a + (j + 0.5) * step,
      c = curve(x, width, spring, crown, d),
      left = x - width / 2,
      right = x + width / 2;
    panel(end, left, y, top);
    end = right;
    if (d === 0) {
      const polygon = [...c, [right, top], [left, top]],
        ix = earcut(polygon.flat());
      for (const sg of faces)
        for (let k = 0; k < ix.length; k += 3)
          T(
            o,
            s,
            ix
              .slice(k, k + 3)
              .map((j) => [polygon[j][0], polygon[j][1], zAt(polygon[j][0]) + (sg * depth) / 2]),
            [0, 0, sg],
          );
    }
    for (let k = 1; k < c.length; k++) {
      const A = c[k - 1],
        D = c[k];
      if (d > 0)
        for (const sg of faces)
          Q(
            o,
            s,
            [
              [A[0], A[1], zAt(A[0]) + (sg * depth) / 2],
              [D[0], D[1], zAt(D[0]) + (sg * depth) / 2],
              [D[0], top, zAt(D[0]) + (sg * depth) / 2],
              [A[0], top, zAt(A[0]) + (sg * depth) / 2],
            ],
            [0, 0, sg],
          );
      if (d > 0)
        Q(
          o,
          s,
          [
            [A[0], A[1], zAt(A[0]) - depth / 2],
            [D[0], D[1], zAt(D[0]) - depth / 2],
            [D[0], D[1], zAt(D[0]) + depth / 2],
            [A[0], A[1], zAt(A[0]) + depth / 2],
          ],
          [D[1] - A[1], A[0] - D[0], 0],
        );
      if (d >= 2)
        for (const sg of depth > 2 ? [-1, 1] : [side]) {
          const zz = (v) => zAt(v) + sg * (depth / 2 + 0.016),
            t = d === 2 ? 0.12 : 0.16;
          Q(
            o,
            'trim',
            [
              [A[0], A[1], zz(A[0])],
              [D[0], D[1], zz(D[0])],
              [D[0], D[1] + t, zz(D[0])],
              [A[0], A[1] + t, zz(A[0])],
            ],
            [0, 0, sg],
          );
        }
    }
  }
  panel(end, b, y, top);
}
function limits(x) {
  const z = [];
  for (let i = 0; i < plan.outline.length; i++) {
    const a = plan.outline[i],
      b = plan.outline[(i + 1) % plan.outline.length];
    if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
      z.push(a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
  }
  return [Math.min(...z), Math.max(...z)];
}
const lower = { a: -62.8, b: 68.3, count: 23, width: 4.35 },
  wings = [
    [-55.5, -3.9, 18],
    [16.9, 66.9, 18],
  ],
  face = (x, side) => (side < 0 ? -5.1 - (x / 75) * 0.65 : 5.7 - (x / 75) * 0.7);
function build(o, _f, d = 3) {
  // Exact native22vertex intrinsic foundation/weir platform, not a river or site parcel.
  if (d > 0) prism(o, 'stone', plan.outline, -6.15, -5.87);
  row(
    o,
    'brick',
    lower.a,
    lower.b,
    lower.count,
    lower.width,
    -5.87,
    -3.45,
    -0.65,
    -0.22,
    -0.65,
    9.4,
    d,
    1,
  );
  if (d === 0)
    row(
      o,
      'brick',
      lower.a,
      lower.b,
      lower.count,
      lower.width,
      -5.87,
      -3.45,
      -0.65,
      -0.22,
      -0.65,
      9.4,
      d,
      -1,
    );
  for (let i = 0; i <= lower.count; i++) {
    const x = lower.a + ((lower.b - lower.a) * i) / lower.count,
      w = 0.95,
      [lo, hi] = limits(x);
    if (d > 0) {
      prism(
        o,
        'stone',
        [
          [x - w / 2, -4.9],
          [x, -Math.min(6.8, -lo)],
          [x + w / 2, -4.9],
          [x + w / 2, 4.05],
          [x, Math.min(7.4, hi)],
          [x - w / 2, 4.05],
        ],
        -5.87,
        -3.3,
      );
      // Actual downstream stepped pier/apron ends, separated by open water passages.
      for (let k = 0; k < [0, 0, 3, 7][d]; k++)
        B(o, 'stone', x, -5.8 + k * 0.32, -5.05 - k * 0.18, 1.15, 0.32, 0.72);
    }
  }
  // Thin structural deck follows native plan projections; the voids below remain open.
  if (d > 0) prism(o, 'stone', plan.outline, -0.22, 0);
  else {
    const ix = earcut(plan.outline.flat());
    for (let k = 0; k < ix.length; k += 3)
      T(
        o,
        'stone',
        ix.slice(k, k + 3).map((j) => [plan.outline[j][0], 0, plan.outline[j][1]]),
        [0, 1, 0],
      );
  }
  for (const [a, b, count] of wings) {
    for (const sg of [-1, 1]) {
      row(o, 'brick', a, b, count, 2.13, 0, 2.4, 4.65, 5.18, (x) => face(x, sg), 0.56, d, sg);
      if (d > 0) {
        B(o, 'trim', (a + b) / 2, 5.18, face((a + b) / 2, sg), b - a, 0.18, 0.8);
        B(o, 'brick', (a + b) / 2, 5.44, face((a + b) / 2, sg), b - a, 0.52, 0.48);
      }
      if (d >= 2)
        for (let i = 0; i < count; i++) {
          const x = a + ((i + 0.5) * (b - a)) / count,
            z = face(x, sg) + sg * 0.31;
          // Low open stone balustrades: the main arcade remains a real passage.
          B(o, 'stone', x, 0.16, z, 2.05, 0.14, 0.22);
          B(o, 'trim', x, 0.82, z, 2.05, 0.12, 0.22);
          for (let j = 0; j < (d === 2 ? 2 : 4); j++)
            B(o, 'stone', x - 0.75 + j * (d === 2 ? 1.5 : 0.5), 0.3, z, 0.08, 0.52, 0.12);
          if (d === 3)
            for (let k = 0; k < 7; k++)
              B(o, 'dark', x + (k - 3) * 0.22, -0.48, z, 0.055, 0.12, 0.02);
        }
    }
    prism(
      o,
      'brick',
      [
        [a, face(a, -1) - 0.3],
        [b, face(b, -1) - 0.3],
        [b, face(b, 1) + 0.3],
        [a, face(a, 1) + 0.3],
      ],
      5.18,
      5.43,
    );
    if (d >= 2)
      for (let i = 0; i <= count; i++) {
        const x = a + (i * (b - a)) / count;
        // Overhead transverse vault/rib suggestion does not close the longitudinal corridor.
        beam(o, 'trim', [x, 4.94, -4.6], [x, 4.94, 5.1], 0.12, 0.16, C.trim);
      }
  }
  // Royal pavilion: two large arches on west face, three on east, tiny flank openings.
  for (const sg of [-1, 1]) {
    const idx = sg > 0 ? [17, 18] : [6, 5],
      A = plan.outline[idx[0]],
      D = plan.outline[idx[1]],
      a = Math.min(A[0], D[0]),
      b = Math.max(A[0], D[0]),
      z = (A[1] + D[1]) / 2,
      n = sg > 0 ? 2 : 3;
    row(
      o,
      'brick',
      a,
      b,
      n,
      sg > 0 ? 3.32 : 2.0,
      -5.87,
      -3.45,
      -0.65,
      -0.22,
      z,
      0.68,
      Math.min(d, 1),
      sg,
    );
    row(o, 'brick', a, b, n, sg > 0 ? 3.32 : 2.0, 0, 3.4, 6.48, 7.34, z, 0.68, d, sg);
    if (d > 0)
      for (const x of [a + 0.18, b - 0.18]) B(o, 'trim', x, 0, z + sg * 0.37, 0.19, 7.36, 0.12);
    if (d >= 2)
      for (let j = 0; j < n; j++) {
        const x = a + ((j + 0.5) * (b - a)) / n,
          w = sg > 0 ? 3.2 : 1.9;
        B(o, 'trim', x, 0.86, z + sg * 0.4, w, 0.13, 0.2);
        for (let k = 0; k < (d > 1 ? 7 : 3); k++)
          B(
            o,
            'stone',
            x - w * 0.43 + (k * w * 0.86) / (d > 1 ? 6 : 2),
            0.13,
            z + sg * 0.4,
            0.09,
            0.73,
            0.12,
          );
      }
    // Slanted pavilion shoulders use the original ground-plan vertices.
    for (const ids of sg > 0
      ? [
          [16, 17],
          [18, 19],
        ]
      : [
          [4, 5],
          [6, 7],
        ]) {
      const a = plan.outline[ids[0]],
        b = plan.outline[ids[1]],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = (b[1] - a[1]) / length,
        nz = -(b[0] - a[0]) / length,
        local = {
          addTriangle(s, r, q, n, uv, c) {
            const P = (v) => [
                a[0] + ((b[0] - a[0]) * v[0]) / length + nx * v[2],
                v[1],
                a[1] + ((b[1] - a[1]) * v[0]) / length + nz * v[2],
              ],
              N = [
                ((b[0] - a[0]) * n[0]) / length + nx * n[2],
                n[1],
                ((b[1] - a[1]) * n[0]) / length + nz * n[2],
              ];
            o.addTriangle(s, r, [q[0], q[2], q[1]].map(P), N, [uv[0], uv[2], uv[1]], c);
          },
        };
      row(
        local,
        'brick',
        0,
        length,
        1,
        length - 0.8,
        -5.87,
        -3.45,
        -0.65,
        -0.22,
        0,
        0.5,
        Math.min(d, 1),
        1,
      );
      row(local, 'brick', 0, length, 1, 1.45, 0, 3.6, 6.35, 7.34, 0, 0.5, d, 1);
    }
  }
  const pavilion = plan.outline.slice(4, 8).concat(plan.outline.slice(16, 20));
  prism(o, 'brick', pavilion, 7.34, 7.6);
  // Main upper walkway continues through the pavilion and both end gatehouses.
  for (const [a, b] of [
    [-69.0, -55.5],
    [66.9, 73.5],
  ]) {
    const c = (a + b) / 2,
      [lo, hi] = limits(c),
      length = hi - lo;
    const local = {
      addTriangle(s, r, q, n, uv, col) {
        o.addTriangle(
          s,
          r,
          [q[0], q[2], q[1]].map((v) => [c + v[2], v[1], (lo + hi) / 2 + v[0]]),
          [n[2], n[1], n[0]],
          [uv[0], uv[2], uv[1]],
          col,
        );
      },
    };
    for (const xx of [a + 0.28, b - 0.28])
      row(
        local,
        'brick',
        -length / 2,
        length / 2,
        3,
        Math.min(2.4, length / 4),
        0,
        2.6,
        4.9,
        5.95,
        xx - c,
        0.52,
        d,
        xx === a + 0.28 ? -1 : 1,
      );
    for (const sg of [-1, 1])
      row(
        o,
        'brick',
        a,
        b,
        2,
        Math.min(2.3, (b - a) / 3),
        -5.87,
        -3.45,
        -0.65,
        -0.22,
        sg < 0 ? lo + 0.26 : hi - 0.26,
        0.52,
        Math.min(d, 1),
        sg,
      );
    for (const sg of [-1, 1])
      row(
        o,
        'brick',
        a,
        b,
        2,
        Math.min(2.3, (b - a) / 3),
        0,
        2.7,
        4.95,
        5.95,
        sg < 0 ? lo + 0.26 : hi - 0.26,
        0.52,
        d,
        sg,
      );
    B(o, 'brick', c, 5.95, (lo + hi) / 2, b - a, 0.3, length);
    if (d > 0) for (const z of [lo + 0.15, hi - 0.15]) B(o, 'trim', c, 5.85, z, b - a, 0.17, 0.3);
  }
  if (d >= 2) {
    // Sparse original geometric tile accents, not unlicensed image textures or lit-orange walls.
    for (const sg of [-1, 1])
      for (const [a, b, count] of wings)
        for (let i = 0; i <= count; i++) {
          const x = a + (i * (b - a)) / count,
            z = face(x, sg) + sg * 0.3;
          B(o, 'tile', x, 3.2, z, 0.12, 1.25, 0.022);
          if (d === 3)
            for (let k = 0; k < 5; k++) B(o, 'trim', x, -1.0 - k * 0.45, z, 0.75, 0.024, 0.035);
        }
  }
}
export const khajuSkyline = (o, f) => build(o, f, 0);
export const khajuDistrict = (o, f) => build(o, f, 1);
export const khajuStreet = (o, f) => build(o, f, 2);
export const khajuCloseup = (o, f) => build(o, f, 3);
export const khajuModel = {
  id: 'khaju_bridge',
  key: 'khaju_bridge',
  cell: 'tj/tju',
  recipe: 'structure-khaju-bridge.mjs',
  title: 'Khaju Bridge',
  category: 'bridge-dam',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: plan.authoringDirection,
  build,
  surfaces,
  camera: [100, 45, 135],
  lookAt: [3, 0.5, 0],
  portableGroundY: -6.25,
  mediumFiContext: {
    scale: 1.1,
    groundY: -6.25,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'whole-two-tier-bridge-and-two-arch-royal-face',
      position: [4, 12, 150],
      lookAt: [3, 0.6, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'opposite-three-arch-royal-face-and-flow-vaults',
      position: [8, 10, -72],
      lookAt: [6, 0.7, -2],
    },
    {
      name: 'open-longitudinal-gallery-through-north-gatehouse',
      position: [-82, 2.4, -0.6],
      lookAt: [28, 2.4, -0.6],
    },
    {
      name: 'lower-flow-vaults-cutwaters-and-intrinsic-steps',
      position: [37, -2.1, -21],
      lookAt: [29, -2, -1],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundCutout: {
    outline: plan.outline,
    basis:
      'Clip coarse ground overlap only inside the exact original native bridge outline, so river DEM returns do not bury flow-vaults and pier toes. Independent height samples stay unchanged; no wider river or bank parcel opening. Compatible host water/ground contact remains unverified.',
  },
  groundContactBasis:
    plan.geometryBasis +
    ' Independent360mfield frozen before geometry; modelY0 fixed north-bank approach, not riverbed/water datum.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-khaju-bridge.mjs',
    level: 'skyline',
    export: 'khajuSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'khajuDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'khajuStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'khajuCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete original medium-fi exterior. Native22vertex bridge-dam outline and fixed native crossing alignment retained. Main lower flow-vaults, pointed upper arcades, true5.7m-ish longitudinal corridor, opposite two/three-arch royal facades, flank openings, square endpavilions, low open balustrades and intrinsic stone weir/steps.23principal lower flowvaults plus smaller projecting pavilion/enddivisions and36wing upper bays perface are photographic subdivisions; primary counts18/26use incompatible definitions and are not certified exact chamber census.',
    'Two inspected exact originals: already published Qualla2009Gire3pich2005ownPD-self with special thanks to HosseinMajidi, and2023Ali.Alirezaei666ownCC0. Both are twilight/floodlit: their geometry informs the model but orange emission/reflections are not baked into daylight brick/stone/plaster. No photograph textures, generated bitmaps or downloaded mesh.',
    'Heights/sections estimated from photographs: walkway0, pierbase-6.15, lowercrown-.65, wingroof5.43, pavilionroof7.6m. Exact submerged weir/sluice machinery, hidden chamber partitions, tile patterns/brick census and current fine repairs are bounded. Skyline uses single-sided thin arcade faces while retaining actual holes and full bay layout.',
    'River, riverbed/banks/landscape, citybuildings, flags, people and lights excluded. Only intrinsic native-outline foundation/platform and structural deck belong to GLB; no site floor. Raw360m129x129field/16641values/oneTerrariumtile unchanged. Only exact bridge-footprint ground overlap is clipped in the viewer so coarse river DEM does not bury the lower arches. Source datum1566.8751m at original north-bank point, compatible host water/ground contact remains unverified geographic preview/replaceFootprint=false.',
  ],
};
