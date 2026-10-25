/** Andersonville's two surviving interpretive stockades, not a conjectural complete prison. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/dj/djs/andersonville_prison/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  C = {
    wood: rgb('929084'),
    end: rgb('a09885'),
    pale: rgb('aba393'),
    dark: rgb('605d52'),
    metal: rgb('3c4140'),
  },
  surfaces = {
    wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.99, metallic: 0 },
    end: { slot: 'trim', graph: 'wood_plain', roughness: 0.99, metallic: 0 },
    pale: { slot: 'door', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
    dark: { slot: 'roof', graph: 'wood_plain', roughness: 0.98, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.16 },
  },
  mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  vary = (s, i) => C[s].map((v) => v * (0.91 + (((i * 37 + 17) % 31) / 30) * 0.16));
export function andersonvilleGround(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(127, Math.floor(u))),
    j = Math.max(0, Math.min(127, Math.floor(v))),
    a = u - i,
    b = v - j,
    h = g.heightsMeters;
  return (
    (h[j][i] * (1 - a) + h[j][i + 1] * a) * (1 - b) +
    (h[j + 1][i] * (1 - a) + h[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function box(o, s, x, y, z, w, h, l, u = [1, 0], col = C[s]) {
  const v = [-u[1], u[0]],
    P = (a, b, c) => [x + u[0] * a + v[0] * c, y + b, z + u[1] * a + v[1] * c],
    A = [P(-w / 2, 0, -l / 2), P(w / 2, 0, -l / 2), P(w / 2, 0, l / 2), P(-w / 2, 0, l / 2)],
    B = A.map((a) => [a[0], a[1] + h, a[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
function rod(o, s, a, b, w, col = C[s]) {
  const axis = b.map((v, k) => v - a[k]),
    len = Math.hypot(...axis),
    n = axis.map((v) => v / len),
    u0 = cross(n, Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    v = cross(n, u),
    R = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + ((u[k] * i + v[k] * j) * w) / 2)),
    A = R(a),
    B = R(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [A[i], A[j], B[j], B[i]],
      A[i].map((v, k) => v - a[k]),
      col,
    );
  }
  Q(
    o,
    s,
    [...A].reverse(),
    n.map((v) => -v),
    col,
  );
  Q(o, s, B, n, col);
}
function log(o, a, lo, hi, r, n, col) {
  const A = Array.from({ length: n }, (_, j) => [
      a[0] + Math.cos((j * 2 * Math.PI) / n) * r,
      lo,
      a[1] + Math.sin((j * 2 * Math.PI) / n) * r,
    ]),
    B = A.map((v) => [v[0], hi, v[2]]);
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    Q(o, 'wood', [A[j], A[k], B[k], B[j]], [A[j][0] - a[0], 0, A[j][2] - a[1]], col);
    T(o, 'end', [[a[0], hi, a[1]], B[j], B[k]], [0, 1, 0]);
    T(o, 'wood', [[a[0], lo, a[1]], A[k], A[j]], [0, -1, 0], col);
  }
}
function segment(o, a, b, d, opening = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]],
    mid = mix(a, b, typeof opening === 'number' ? opening : 0.5),
    threshold = andersonvilleGround(...mid),
    pitch = d === 0 ? 6 : d === 1 ? 1.65 : p.parameters.logPitch,
    N = Math.ceil(len / pitch);
  for (let j = 0; j < N; j++) {
    const t = (j + 0.5) / N,
      q = mix(a, b, t),
      base = andersonvilleGround(...q) - 0.11,
      crown =
        andersonvilleGround(...q) +
        p.parameters.wallHeight +
        (d > 1 ? (((j * 19) % 13) - 6) * 0.035 : 0),
      door = opening && Math.abs((t - (typeof opening === 'number' ? opening : 0.5)) * len) < 1.47,
      lo = door ? threshold + p.parameters.gateHeight : base;
    if (d === 0)
      box(o, 'wood', q[0], lo, q[1], len / N + 0.025, crown - lo, 0.29, u, vary('wood', j));
    else
      log(
        o,
        q,
        lo,
        crown,
        d === 1 ? (len / N) * 0.505 : p.parameters.logRadius,
        d === 3 ? 8 : 4,
        vary('wood', j),
      );
    if (d === 3)
      for (const side of [-1, 1]) {
        const cc = (((j * 11) % 17) - 8) * 0.002,
          y0 = lo + 0.14 + ((j * 7) % 9) * 0.12,
          y1 = Math.min(crown - 0.11, y0 + 1.2 + (j % 4) * 0.7),
          P = (x, y) => [
            q[0] + u[0] * x + n[0] * side * 0.153,
            y,
            q[1] + u[1] * x + n[1] * side * 0.153,
          ];
        if (y1 > y0)
          Q(
            o,
            'dark',
            [P(cc - 0.005, y0), P(cc + 0.005, y0), P(cc + 0.01, y1), P(cc - 0.002, y1)],
            [n[0] * side, 0, n[1] * side],
            vary('dark', j),
          );
      }
  }
  const k = d === 0 ? 1 : Math.ceil(len / 3);
  for (let i = 0; i < k; i++)
    for (const side of d === 0 ? [1] : [-1, 1]) {
      const A = mix(a, b, i / k),
        B = mix(a, b, (i + 1) / k);
      rod(
        o,
        'dark',
        [A[0] + n[0] * side * 0.19, andersonvilleGround(...A) + 3.33, A[1] + n[1] * side * 0.19],
        [B[0] + n[0] * side * 0.19, andersonvilleGround(...B) + 3.33, B[1] + n[1] * side * 0.19],
        0.11,
      );
    }
  if (opening) gate(o, mid, u, d);
}
function gate(o, c, u, d) {
  const n = [-u[1], u[0]],
    base = andersonvilleGround(...c),
    h = p.parameters.gateHeight,
    P = (x, y, z = 0) => [c[0] + u[0] * x + n[0] * z, base + y, c[1] + u[1] * x + n[1] * z];
  box(o, 'pale', c[0], base, c[1], 2.83, h, 0.13, u);
  for (const x of [-1.52, 1.52]) rod(o, 'wood', P(x, -0.1), P(x, h + 0.17), 0.2);
  rod(o, 'wood', P(-1.62, h + 0.1), P(1.62, h + 0.1), 0.2);
  for (const side of [-1, 1]) {
    if (d > 1)
      for (let leaf = 0; leaf < 2; leaf++) {
        const x0 = leaf === 0 ? -1.4 : 0.015,
          x1 = leaf === 0 ? -0.015 : 1.4,
          sg = leaf === 0 ? 1 : -1;
        for (let a = -h; a < 1.4; a += 0.19) {
          let A = [a, 0],
            B = [a + h, h];
          const low = Math.max(0, x0 - (leaf === 0 ? -1.4 : 0.015) - a),
            high = Math.min(h, x1 - (leaf === 0 ? -1.4 : 0.015) - a);
          if (high - low < 0.01) continue;
          A = [(leaf === 0 ? -1.4 : 0.015) + a + low, low];
          B = [(leaf === 0 ? -1.4 : 0.015) + a + high, high];
          if (sg < 0) {
            A[0] = x0 + x1 - A[0];
            B[0] = x0 + x1 - B[0];
          }
          rod(
            o,
            'pale',
            P(A[0], A[1], side * 0.075),
            P(B[0], B[1], side * 0.075),
            0.035,
            vary('pale', Math.floor((a + h) * 20)),
          );
        }
      }
    for (const yy of [0.23, h - 0.24])
      for (const leaf of [-1, 1])
        rod(
          o,
          'metal',
          P(leaf * 0.12, yy, side * 0.1),
          P(leaf * 1.38, yy, side * 0.1),
          d === 0 ? 0.045 : 0.065,
        );
    if (d > 0) {
      for (const x of [-0.02, 0.02])
        rod(o, 'dark', P(x, 0, side * 0.09), P(x, h, side * 0.09), 0.025);
      for (const x of [-0.15, 0.15])
        box(o, 'metal', ...P(x, 1.1, side * 0.14), 0.06, 0.2, 0.055, u);
    }
    if (d > 1) {
      const x = 0.64,
        y = 0.09,
        w = 0.72,
        wh = 1.4;
      for (const xx of [x - w / 2, x + w / 2])
        rod(o, 'dark', P(xx, y, side * 0.11), P(xx, y + wh, side * 0.11), 0.055);
      for (const yy of [y, y + wh])
        rod(o, 'dark', P(x - w / 2, yy, side * 0.11), P(x + w / 2, yy, side * 0.11), 0.055);
      for (const yy of [y + 0.18, y + wh - 0.18])
        rod(o, 'metal', P(x - w / 2, yy, side * 0.14), P(x + 0.12, yy, side * 0.14), 0.045);
    }
  }
}
function sentry(o, a, b, t, out, d) {
  const c = mix(a, b, t),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1] * out, u[0] * out],
    base = andersonvilleGround(...c),
    floor = base + 3.84,
    P = (x, y, z) => [c[0] + u[0] * x + n[0] * z, y, c[1] + u[1] * x + n[1] * z];
  box(o, 'dark', ...P(0, floor, 0.77), 1.95, 0.16, 1.85, u);
  for (const x of [-0.87, 0.87]) {
    const toe = P(x, 0, 1.52);
    toe[1] = andersonvilleGround(toe[0], toe[2]) - 0.11;
    rod(o, 'wood', toe, P(x, base + 6.02, 1.52), 0.16);
    rod(o, 'wood', P(x, floor, 0.04), P(x, base + 5.86, 0.04), 0.15);
  }
  if (d > 0) {
    for (const y of [floor + 0.5, floor + 1.0]) {
      rod(o, 'pale', P(-0.9, y, 1.5), P(0.9, y, 1.5), 0.07);
      for (const x of [-0.87, 0.87]) rod(o, 'pale', P(x, y, 0.04), P(x, y, 1.5), 0.07);
    }
    for (const x of [-0.87, 0.87])
      rod(o, 'dark', P(x, floor - 0.08, 0.08), P(x, base + 2.5, 1.5), 0.12);
  }
  const divisions = d > 1 ? 8 : 1;
  for (let j = 0; j < divisions; j++) {
    const x = -1.12 + ((j + 0.5) * 2.24) / divisions,
      zz = 0.77,
      cc = P(x, base + 6.04, zz);
    box(o, 'dark', ...cc, 2.24 / divisions + 0.015, 0.09, 2.19, u, vary('dark', j));
  }
  if (d > 1)
    for (const z of [-0.24, 1.88])
      rod(o, 'end', P(-1.13, base + 6.07, z), P(1.13, base + 6.07, z), 0.055);
}
function deadline(o, d) {
  const a = p.corner[0],
    b = p.corner[1],
    c = p.corner[2],
    U = (a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    },
    u = U(a, b),
    v = U(b, c),
    n = [u[1], -u[0]],
    m = [v[1], -v[0]],
    q = [b[0] + n[0] * 6.096 + m[0] * 6.096, b[1] + n[1] * 6.096 + m[1] * 6.096],
    A = [q[0] - u[0] * 22, q[1] - u[1] * 22],
    B = [q[0] + v[0] * 22, q[1] + v[1] * 22];
  for (const [a, b] of [
    [A, q],
    [q, B],
  ]) {
    const N = d === 0 ? 1 : 8;
    for (let j = 0; j <= N; j++) {
      const c = mix(a, b, j / N),
        y = andersonvilleGround(...c);
      rod(o, 'wood', [c[0], y - 0.09, c[1]], [c[0], y + 0.88, c[1]], 0.09);
    }
    for (let j = 0; j < N; j++) {
      const c = mix(a, b, j / N),
        e = mix(a, b, (j + 1) / N);
      rod(
        o,
        'wood',
        [c[0], andersonvilleGround(...c) + 0.77, c[1]],
        [e[0], andersonvilleGround(...e) + 0.77, e[1]],
        0.08,
      );
    }
  }
}
function build(o, _f, d = 3) {
  const [a, b, c, e] = p.pocket;
  segment(o, ...p.main, d, p.parameters.innerGateFraction);
  segment(o, a, b, d);
  segment(o, b, c, d, true);
  segment(o, c, e, d);
  segment(o, p.corner[0], p.corner[1], d);
  segment(o, p.corner[1], p.corner[2], d);
  sentry(o, a, b, 0.3, -1, d);
  sentry(o, c, e, 0.7, -1, d);
  sentry(o, p.corner[0], p.corner[1], 0.52, 1, d);
  deadline(o, d);
}
export const andersonvillePrisonSkyline = (o, f) => build(o, f, 0),
  andersonvillePrisonDistrict = (o, f) => build(o, f, 1),
  andersonvillePrisonStreet = (o, f) => build(o, f, 2),
  andersonvillePrisonCloseup = (o, f) => build(o, f, 3);
export const andersonvillePrisonModel = {
  id: 'andersonville_prison',
  key: 'andersonville_prison',
  cell: 'dj/djs',
  recipe: 'structure-andersonville-prison.mjs',
  title: 'Andersonville Prison',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-245, 220, 360],
  lookAt: [0, 4, 0],
  mediumFiContext: { scale: 3.4 },
  qaCameras: [
    {
      name: 'both-reconstructed-stockades-and-their-actual-separation',
      position: [-245, 220, 360],
      lookAt: [0, 4, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'northgate-projecting-sallyport-two-gates-and-sentry-platforms',
      position: [-188, 24, 105],
      lookAt: [-153, 3.3, 69],
    },
    {
      name: 'sallyport-diagonal-double-doors-wicket-and-timber-wall-above',
      position: [-161, 3, 68],
      lookAt: [-151, 1.8, 70],
    },
    {
      name: 'northeast-real-corner-and-short-deadline-rail',
      position: [119, 23, -33],
      lookAt: [152, 14, -64],
    },
    {
      name: 'rounded-weathered-logs-open-sentry-platform-and-support-posts',
      position: [179, 18, -39],
      lookAt: [159, 16.5, -51],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' All timber toes follow bilinear samples from independently frozen512m field; source-relative preview only, actual host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-andersonville-prison.mjs',
    level: 'skyline',
    export: 'andersonvillePrisonSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: {
      district: { export: 'andersonvillePrisonDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'andersonvillePrisonStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'andersonvillePrisonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Both current reconstructed stockades included; deliberately no full1864standingpalisade or prison interior. Gates are closed physical double leaves with shallow diagonal plank relief/iron straps and closed wicket, not operable doors. Three roofed sentry platforms follow clearphoto evidence; hidden structural joinery/log census and short deadline extent approximate. Rounded timber profiles, uneven crowns and grain are modeled geometry with shared wood material; no photograph texture or generated bitmap.',
    'Two exactpublishedDsdugan2017ownCC0Quallaoverviews and three supplemental Dsdugan2020/2021/2024 ownCC0closeoriginals individuallyinspected/nativeSHA1bound. No uncertain, Panoramio/attribution-only or historicalcamp photo used. ExactassetNPS2018map explicitlygovernmentPD; map registration/census are visitorcartography, not survey. Source/media/category/articlebody/imagerypolicy unchanged.',
    'Independent512m129square4m16641samplefield and two originalTerrariumtiles frozen beforegeometry; modeldatum109.6561m/provider-relative. Timber toes bilinearly follow that unchangedfield; no fitting/flattening/reacquisition/ground slab. Composite DEM does not certify archaeological microrelief or exact thresholds. Ordinary geographic preview/replacementdisabled; actualhostcontact unverified.',
    'Separate nationalPOWmuseum/cemetery/monuments/ProvidenceSpringwellhouse/StarFort/earthenbatteries/wholepark whiteboundaryposts and natural landscape excluded. Asset represents the prison’s two reconstructed architectural fragments today, not the entire26.5acre historic enclosure or a complete1864reconstruction.',
  ],
};
