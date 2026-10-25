/** Whole surviving low palace/gate ruins; no rebuilt ancient roof or neighboring Shush Castle. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/tj/tjd/palace_of_darius_in_susa/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  G = p.parameters.gateFloorY,
  c = Math.cos(p.workingHeading),
  s = Math.sin(p.workingHeading),
  ref = 'palette:#ffffff',
  local = (q) => [c * q[0] + s * q[1], -s * q[0] + c * q[1]],
  world = (q) => [c * q[0] - s * q[2], q[1], s * q[0] + c * q[2]],
  P = p.outline.slice(0, -1).map(local),
  gate = p.gateOutline.slice(0, -1).map(local),
  C = {
    adobe: rgb('b29571'),
    brick: rgb('a17f5c'),
    stone: rgb('bdb9a4'),
    mud: rgb('a18e6e'),
    fracture: rgb('a6a38e'),
  },
  surfaces = {
    adobe: { slot: 'wall', graph: 'earth_adobe', roughness: 1, metallic: 0 },
    brick: { slot: 'foundation', graph: 'brick_longformat', roughness: 1, metallic: 0 },
    stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
    mud: { slot: 'foundation', graph: 'earth_rammed', roughness: 1, metallic: 0 },
    fracture: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((t, v, i) => t + v * b[i], 0);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = world(n);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    k,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, R, y, { holes = [], up = true, col = C[k] } = {}) {
  const points = R.concat(...holes),
    starts = [];
  let index = R.length;
  for (const hole of holes) {
    starts.push(index);
    index += hole.length;
  }
  const ids = earcut(points.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      k,
      ids.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  area = (R) =>
    R.reduce((a, q, i) => a + q[0] * R[(i + 1) % R.length][1] - R[(i + 1) % R.length][0] * q[1], 0),
  inside = (q, R = P) => {
    let yes = false;
    for (let i = 0, j = R.length - 1; i < R.length; j = i++) {
      const a = R[i],
        b = R[j];
      if (
        a[1] > q[1] !== b[1] > q[1] &&
        q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        yes = !yes;
    }
    return yes;
  };
function wall(o, a, b, w, f, h, d, { boundary = false, inward = 1, seed = 0, deep = false } = {}) {
  const len = Math.hypot(...sub(b, a));
  if (len < 0.05) return;
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    N = [n[0], 0, n[1]],
    point = (t, y, q) => [a[0] + u[0] * t + n[0] * q, y, a[1] + u[1] * t + n[1] * q],
    q0 = boundary ? 0 : -w / 2,
    q1 = boundary ? -inward * w : w / 2,
    parts = d < 2 ? 1 : Math.max(1, Math.ceil(len / [0, 1, 15, 7][d]));
  for (let i = 0; i < parts; i++) {
    const x0 = (len * i) / parts,
      x1 = (len * (i + 1)) / parts,
      H0 = h * (d < 2 ? 1 : 0.91 + 0.09 * Math.sin(seed + x0 * 0.44)),
      H1 = h * (d < 2 ? 1 : 0.91 + 0.09 * Math.sin(seed + x1 * 0.44)),
      top = [
        point(x0, f + H0, q0),
        point(x1, f + H1, q0),
        point(x1, f + H1, q1),
        point(x0, f + H0, q1),
      ],
      normalSign = q1 > q0 ? 1 : -1;
    Q(
      o,
      'brick',
      [point(x0, f, q0), point(x1, f, q0), point(x1, f + H1, q0), point(x0, f + H0, q0)],
      N.map((v) => -v * normalSign),
    );
    Q(
      o,
      'brick',
      [point(x1, f, q1), point(x0, f, q1), point(x0, f + H0, q1), point(x1, f + H1, q1)],
      N.map((v) => v * normalSign),
    );
    Q(o, 'adobe', top, [0, 1, 0]);
    if (d) {
      Q(
        o,
        'brick',
        [point(x0, f, q0), point(x0, f + H0, q0), point(x0, f + H0, q1), point(x0, f, q1)],
        [-u[0], 0, -u[1]],
      );
      Q(
        o,
        'brick',
        [point(x1, f, q1), point(x1, f + H1, q1), point(x1, f + H1, q0), point(x1, f, q0)],
        [u[0], 0, u[1]],
      );
      Q(
        o,
        'mud',
        [point(x0, f, q0), point(x0, f, q1), point(x1, f, q1), point(x1, f, q0)],
        [0, -1, 0],
      );
    }
    if (d >= 2 && i % 2 === 0) {
      const xx = (x0 + x1) / 2,
        ww = Math.min(1.8, (x1 - x0) * 0.22),
        yy = f + Math.min(h * 0.45, 0.35),
        oo = normalSign * 0.016;
      Q(
        o,
        'adobe',
        [
          point(xx - ww, yy - 0.12, q0 - oo),
          point(xx + ww, yy - 0.12, q0 - oo),
          point(xx + ww, yy + 0.12, q0 - oo),
          point(xx - ww, yy + 0.12, q0 - oo),
        ],
        N.map((v) => -v * normalSign),
        rgb('ab8f6c'),
      );
    }
    if (deep && d >= 2)
      for (let j = 1; j < 6; j++) {
        const yy = f + (h * j) / 6,
          oo = normalSign * 0.024;
        Q(
          o,
          'fracture',
          [
            point(x0, yy - 0.018, q0 - oo),
            point(x1, yy - 0.018, q0 - oo),
            point(x1, yy + 0.018, q0 - oo),
            point(x0, yy + 0.018, q0 - oo),
          ],
          N.map((v) => -v * normalSign),
          rgb('8e795b'),
        );
      }
  }
}
function boundary(o, R, f, d, { height = A.outerBandHeight, width = A.outerBandWidth } = {}) {
  const sign = area(R) > 0 ? 1 : -1;
  for (let i = 0; i < R.length; i++)
    wall(o, R[i], R[(i + 1) % R.length], width, f, height, d, {
      boundary: true,
      inward: sign,
      seed: i * 0.7,
    });
}
function courtyard(o, q, d, index) {
  const { x, z, width, depth } = q,
    x0 = x - width / 2,
    x1 = x + width / 2,
    z0 = z - depth / 2,
    z1 = z + depth / 2,
    gap = 3.0,
    w = A.foundationWallWidth,
    h = A.lowWallHeight * (1 + index * 0.12),
    R = rect(x0, z0, x1, z1),
    hole =
      index === 1 ? rect(A.excavation.x0, A.excavation.z0, A.excavation.x1, A.excavation.z1) : null;
  flat(o, 'mud', R, F + 0.015, { holes: hole ? [hole] : [] });
  for (const zz of [z0, z1]) {
    wall(o, [x0, zz], [x - gap / 2, zz], w, F, h, d, { seed: index + zz });
    wall(o, [x + gap / 2, zz], [x1, zz], w, F, h, d, { seed: index + zz });
  }
  for (const xx of [x0, x1]) wall(o, [xx, z0], [xx, z1], w, F, h, d, { seed: xx + index });
}
function apartments(o, d) {
  const walls = [],
    W = (a, b, seed) => walls.push({ a, b, seed }),
    doorLine = (x0, x1, z, centers) => {
      let x = x0;
      for (const center of centers) {
        W([x, z], [center - 1.5, z], z);
        x = center + 1.5;
      }
      W([x, z], [x1, z], z);
    };
  for (const z of [-14, 2]) doorLine(-106, 24, z, [-79, -43, -7]);
  for (let i = 0; i < 8; i++) {
    if (!d && i % 3 !== 0) continue;
    const x = -105 + i * 18;
    W([x, -14], [x, 2], i);
  }
  for (const z of [65, 86]) doorLine(-131, 70, z, [-105, -49, 7, 51]);
  for (let i = 0; i < 11; i++) {
    if (!d && i % 3 !== 0) continue;
    const x = -130 + i * 19.5;
    W([x, 65], [x, 86], i);
  }
  for (const x of [-107, -96]) W([x, 4], [x, 57], x);
  for (const z of [6, 23, 40, 57]) {
    if (!d && z !== 6 && z !== 57) continue;
    W([-107, z], [-96, z], z);
  }
  for (const [x0, x1] of [
    [-56, -40],
    [4, 21],
  ]) {
    for (const x of [x0, x1]) W([x, 3], [x, 52], x);
    if (d) for (const z of [4, 27, 51]) W([x0, z], [x1, z], z);
  }
  for (const x of [62, 86]) W([x, -14], [x, 54], x);
  for (const z of [-14, 4, 22, 40, 54]) {
    if (!d && z !== -14 && z !== 54) continue;
    W([62, z], [86, z], z);
  }
  let i = 0;
  for (const { a, b, seed } of walls)
    wall(o, a, b, A.foundationWallWidth, F, 0.56 + 0.28 * ((i++ % 5) / 4), d, { seed });
}
function profile(o, x, z, layers, d, { bell = false, seed = 0 } = {}) {
  const N = [6, 8, 24, 48][d],
    rings = layers.map(([y, r], j) =>
      Array.from({ length: N }, (_, i) => {
        const az = (i * 2 * Math.PI) / N,
          flute = d >= 2 && j > 1 ? (bell ? 0.035 : 0.025) * Math.cos(az * 12) : 0,
          R = Math.max(0.1, r + flute),
          top =
            j === layers.length - 1
              ? (0.08 * Math.sin(az * 3 + seed) + 0.05 * Math.sin(az * 5 + seed)) * (d ? 1 : 0)
              : 0;
        return [x + R * Math.cos(az), y + top, z + R * Math.sin(az)];
      }),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N,
        n = [Math.cos(((i + 0.5) * 2 * Math.PI) / N), 0, Math.sin(((i + 0.5) * 2 * Math.PI) / N)];
      Q(o, 'stone', [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]], n);
    }
  for (const [R, sg] of [
    [rings[0], -1],
    [rings.at(-1), 1],
  ]) {
    const center = [x, R.reduce((s, q) => s + q[1], 0) / R.length, z];
    for (let i = 0; i < N; i++)
      T(
        o,
        sg === 1 ? 'fracture' : 'stone',
        [center, R[i], R[(i + 1) % N]],
        [0, sg, 0],
        sg === 1 ? rgb('b4b09b') : C.stone,
      );
  }
}
function block(o, R, y0, y1, d, col = C.stone) {
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      n = [
        (a[0] + b[0]) / 2 - R.reduce((s, p) => s + p[0], 0) / R.length,
        0,
        (a[1] + b[1]) / 2 - R.reduce((s, p) => s + p[1], 0) / R.length,
      ];
    Q(
      o,
      'stone',
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
  flat(o, 'stone', R, y1, { col });
  if (d) flat(o, 'stone', R, y0, { up: false, col });
}
function columns(o, d) {
  const S = A.hall.centralBaseSize;
  for (let i = 0; i < A.hall.centralBases.length; i++) {
    const q = A.hall.centralBases[i],
      h = 0.22 + (i % 5) * 0.13,
      R = rect(q.x - S / 2, q.z - S / 2, q.x + S / 2, q.z + S / 2);
    block(o, R, F - 0.035, F + h, d);
    if (d)
      profile(
        o,
        q.x,
        q.z,
        [
          [F + h, 0.84],
          [F + h + 0.09, 0.84],
          [F + h + 0.16, 0.72],
          [F + h + 0.23 + (i % 3) * 0.13, 0.7],
        ],
        d,
        { seed: i },
      );
  }
  for (let i = 0; i < A.hall.bellRemnants.length; i++) {
    const q = A.hall.bellRemnants[i],
      H = q.height;
    if (d === 0) {
      profile(
        o,
        q.x,
        q.z,
        [
          [F, 0.98],
          [F + H, 0.63],
        ],
        d,
        { bell: true, seed: i },
      );
      continue;
    }
    const layers =
      H < 1.3
        ? [
            [F, 1.16],
            [F + H * 0.18, 1.16],
            [F + H * 0.88, 0.88],
            [F + H, 0.78],
          ]
        : [
            [F, 1.2],
            [F + 0.18, 1.2],
            [F + 0.9, 1.02],
            [F + 1.12, 0.95],
            [F + 1.2, 1.07],
            [F + 1.32, 1.02],
            [F + 1.45, 0.72],
            [F + H, 0.68],
          ];
    profile(o, q.x, q.z, layers, d, { bell: true, seed: i });
  }
}
function excavation(o, d) {
  const e = A.excavation,
    R = rect(e.x0, e.z0, e.x1, e.z1),
    base = F - e.depth;
  flat(o, 'mud', R, base + 0.015);
  for (let i = 0; i < 4; i++)
    wall(o, R[i], R[(i + 1) % 4], e.liningWidth, base, e.depth + 0.05, d, {
      boundary: true,
      inward: area(R) > 0 ? -1 : 1,
      seed: i,
      deep: true,
    });
}
function gateFoundation(o, d) {
  flat(o, 'adobe', gate, G + 0.025);
  boundary(o, gate, G, d, { height: 0.28, width: 1.9 });
  const cx = gate.reduce((a, q) => a + q[0], 0) / gate.length,
    cz = gate.reduce((a, q) => a + q[1], 0) / gate.length;
  for (const x of [cx - 7, cx + 7]) {
    wall(o, [x, cz - 13], [x, cz - 2.5], 1.7, G, 0.35, d);
    wall(o, [x, cz + 2.5], [x, cz + 13], 1.7, G, 0.35, d);
  }
  if (d)
    for (const x of [cx - 7, cx + 7])
      for (const z of [cz - 9, cz + 9])
        block(o, rect(x - 0.9, z - 0.9, x + 0.9, z + 0.9), G + 0.1, G + 0.32, d, rgb('b2ac94'));
}
function fragments(o, d) {
  if (!d) return;
  const N = [0, 8, 30, 68][d];
  for (let i = 0; i < N; i++) {
    const a = i * 2.399963229728653,
      x = -5 + Math.cos(a) * (9 + (i % 5) * 7),
      z = -77 + Math.sin(a) * (7 + (i % 4) * 9);
    if (!inside([x, z])) continue;
    const r = 0.25 + (i % 4) * 0.15,
      n = d === 3 ? 8 : 5,
      R = Array.from({ length: n }, (_, j) => {
        const b = (j * 2 * Math.PI) / n,
          v = r * (0.85 + 0.12 * Math.sin(j * 3 + i));
        return [x + Math.cos(b) * v, z + Math.sin(b) * v];
      });
    block(o, R, F - 0.01, F + 0.2 + (i % 3) * 0.15, d, rgb(i % 2 ? 'b3b09d' : 'c3bfaa'));
  }
}
function build(o, _f, d = 3) {
  boundary(o, P, F, d);
  for (let i = 0; i < p.nativeWallLines.length; i++) {
    const w = p.nativeWallLines[i].points.map(local);
    for (let j = 1; j < w.length; j++)
      wall(o, w[j - 1], w[j], A.foundationWallWidth, F, A.mappedWallHeight, d, { seed: i });
  }
  for (let i = 0; i < A.courtyards.length; i++) courtyard(o, A.courtyards[i], d, i);
  apartments(o, d);
  const h = A.hall,
    R = rect(h.center[0] - 29, h.center[1] - 29, h.center[0] + 29, h.center[1] + 29);
  flat(o, 'mud', R, F + 0.01);
  for (const zz of [-47, -19]) {
    wall(o, [-54, zz], [-9, zz], 2.2, F, 0.45, d);
    wall(o, [-1, zz], [26, zz], 2.2, F, 0.45, d);
  }
  columns(o, d);
  excavation(o, d);
  gateFoundation(o, d);
  fragments(o, d);
}
export const dariusSusaSkyline = (o, f) => build(o, f, 0);
export const dariusSusaDistrict = (o, f) => build(o, f, 1);
export const dariusSusaStreet = (o, f) => build(o, f, 2);
export const dariusSusaCloseup = (o, f) => build(o, f, 3);
export const palaceOfDariusInSusaModel = {
  id: 'palace_of_darius_in_susa',
  key: 'palace_of_darius_in_susa',
  cell: 'tj/tjd',
  recipe: 'structure-palace-of-darius-in-susa.mjs',
  title: 'Palace of Darius in Susa',
  category: 'ruins',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [355, 245, 445],
  lookAt: [-15, 3, -5],
  portableGroundY: 2.94,
  mediumFiContext: { scale: 5.5, groundY: 2.94 },
  qaCameras: [
    {
      name: 'whole-low-palace-foundations-apadana-and-intrinsic-gate',
      position: [335, 260, 420],
      lookAt: [0, 2, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'open-private-apartment-room-and-courtyard-foundations',
      position: world([-65, 42, 70]),
      lookAt: world([-55, 3, 27]),
    },
    {
      name: 'low-square-bases-on-historical-apadana-column-grid',
      position: world([17, 18, -40]),
      lookAt: world([-5, 3.4, -76]),
    },
    {
      name: 'northern-bell-base-and-broken-fluted-shafts',
      position: world([5, 11, -101]),
      lookAt: world([-5, 4.7, -119]),
    },
    {
      name: 'intrinsic-darius-gate-low-foundation-pavement',
      position: world([200, 27, 94]),
      lookAt: world([169, -1.7, 59]),
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-palace-of-darius-in-susa.mjs',
    level: 'skyline',
    export: 'dariusSusaSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'dariusSusaDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'dariusSusaStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'dariusSusaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole low roofless palace/gate ruin model: all16 palace/four gate native boundary controls and allfour original historic wall lines, low broad mud-brick room foundations/three open courtyard groupings, exposed intrinsic excavation lining, low square stone remnants/bell bases/two taller broken northern shafts. Native archaeological boundaries are overall extents, not proof that every perimeter wall survives. Unmapped room partitions/door gaps/surviving stone census and erosion are bounded original estimates from the clear ruin family; no claim of a complete measured current excavation plan.',
    'Six exact published Qualla Pentocelo April2007 Own/PD-self original exteriors/column/foundation views individually inspected/nativeSHA1matched. Museum friezes/reconstruction display/unknown artifact views excluded. Original1857 library text/NOT_IN_COPYRIGHT and exact native text hash supplies factual6x6 organization/8.3058m axis pitch/2.4384m square pedestals, three original12-column porticoes; no book image/modern protected drawing used.21 low central remnants andsix portico bell remnants are bounded surviving-family estimates, not72 restored intact columns or a certified present census.',
    'The ruins have no intact hypostyle roof, tall palace facade or complete ancient bull capitals at this site. Northern short fluted shafts/bell remnants stay broken/low. Later ShushCastle, SusaMuseum, widerRoyalCity/Acropolis/tepe, vegetation/roads/landscape/people/signs/ropes and private museum interiors are absent. Only constructed courtyard/gate floor patches and foundation masonry, no whole-site terrain plate.',
    'Independent1000m129x129field/16641samples/four rawTerrariumtiles frozen before all floor/section/geometry decisions and unchanged. Mainfloor+3m/gatefloor−2m relative to fixed84.5893mSWdatum are unsurveyed separate architectural references. The flat portable/context fixture near mainfloor can hide the lowergate/deep excavation; transparent-background whole turntables and additional model-only detail show all geometry. Exact native mound/floor/threshold/excavation contact remains unresolved; geographicpreview/replaceFootprintfalse, no artificial tepe or source terrain changes.',
  ],
};
