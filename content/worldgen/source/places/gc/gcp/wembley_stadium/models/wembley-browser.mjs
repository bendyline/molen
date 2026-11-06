/** Source-authored Wembley browser geometry; the detailed component master is preserved. */
import {
  beam,
  cross,
  loft,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { curve, face } from '../../../../../../../../packages/worldgen/scripts/stadium-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const outerPlan = [
  [-54.70776, -142.93134],
  [-71.91332, -133.79984],
  [-85.49628, -125.41194],
  [-97.41365, -116.36109],
  [-108.31321, -105.5365],
  [-118.75246, -93.78624],
  [-124.32022, -87.35024],
  [-127.98324, -81.28568],
  [-135.34937, -67.67616],
  [-138.362, -61.55354],
  [-142.96616, -46.16383],
  [-147.20762, -29.65957],
  [-149.20939, -14.26024],
  [-149.46415, 4.11779],
  [-147.03309, 24.27574],
  [-143.19675, 40.62059],
  [-138.5192, 55.95553],
  [-133.5723, 65.82565],
  [-128.25366, 76.2426],
  [-121.73442, 83.91439],
  [-113.61134, 92.10417],
  [-103.507, 101.69277],
  [-92.05344, 109.52749],
  [-80.90257, 116.86016],
  [-68.72375, 121.34682],
  [-54.42922, 124.56112],
  [-38.99965, 127.79074],
  [-20.12685, 130.12025],
  [-0.25634, 130.29384],
  [21.63225, 129.39507],
  [46.26669, 125.26703],
  [64.70826, 120.67083],
  [73.07494, 117.25081],
  [81.44451, 113.05156],
  [96.09563, 102.17403],
  [111.55106, 87.15835],
  [116.85508, 80.92175],
  [121.44424, 75.21684],
  [126.33465, 66.65211],
  [130.70123, 57.49545],
  [136.71693, 38.47078],
  [140.09814, 24.37899],
  [142.46827, 8.56914],
  [144.14757, -9.46967],
  [143.21844, -25.88171],
  [139.9884, -45.21883],
  [136.17192, -61.31871],
  [129.38698, -75.75974],
  [120.75959, -89.82909],
  [110.26365, -102.07969],
  [100.3152, -112.64734],
  [87.78381, -122.8683],
  [74.87316, -131.59897],
  [62.15673, -138.57006],
  [52.73186, -142.8573],
  [33.02742, -148.64082],
  [22.73819, -151.27259],
  [5.48348, -153.19537],
  [-1.47891, -153.32128],
  [-9.9103, -152.9962],
  [-26.0856, -151.08558],
  [-34.35709, -149.07897],
  [-46.80656, -145.8744],
  [-54.70776, -142.93134],
];
export const openingPlan = [
  [-64.79048, -44.07167],
  [-55.99353, -42.18013],
  [-53.28878, -43.6507],
  [-45.47475, -45.48088],
  [-32.8243, -46.88132],
  [-18.92357, -47.60921],
  [-6.66605, -47.56394],
  [6.69887, -47.51457],
  [19.50317, -47.46727],
  [32.4573, -46.76263],
  [45.43658, -45.36771],
  [54.0001, -43.98911],
  [59.01674, -41.7553],
  [65.39156, -43.70212],
  [69.59937, -39.85716],
  [66.57587, -32.66591],
  [68.07365, -27.79569],
  [68.97573, -20.92389],
  [69.85243, -7.18374],
  [69.4314, 5.61654],
  [68.6442, 18.23735],
  [67.57131, 27.62881],
  [65.70945, 33.25474],
  [67.77506, 38.04914],
  [65.84405, 39.91219],
  [61.26078, 38.40357],
  [58.74109, 40.36463],
  [53.63158, 42.66121],
  [44.59929, 44.52029],
  [31.37409, 45.99653],
  [18.85048, 46.78517],
  [6.34779, 47.52936],
  [-7.39017, 47.28937],
  [-20.26146, 46.6407],
  [-33.20003, 45.46857],
  [-46.28135, 43.5946],
  [-54.15254, 42.16289],
  [-61.738, 38.32772],
  [-65.54714, 40.85175],
  [-67.87591, 37.97109],
  [-64.81934, 34.94333],
  [-66.37145, 31.66479],
  [-67.65063, 27.57461],
  [-68.92169, 19.41014],
  [-69.60465, 3.81165],
  [-69.37531, -9.55707],
  [-68.77493, -20.31952],
  [-68.10149, -28.37662],
  [-66.68378, -33.68135],
  [-68.69948, -40.7465],
  [-64.79048, -44.07167],
];

export const wembleyBrowserSurfaces = {
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.62 },
  seam: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.72, metallic: 0.3 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.27, metallic: 0.12 },
  plastic: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.8 },
  turf: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1 },
};
const T = 2 * Math.PI,
  white = [0.88, 0.9, 0.87],
  concrete = [0.65, 0.67, 0.64],
  red = [0.63, 0.035, 0.035],
  gray = [0.48, 0.54, 0.57],
  glass = [0.14, 0.23, 0.3];
const native = (p, y) => [p[0], y, p[1]],
  radial = (a) => [Math.sin(a), 0, Math.cos(a)];
export function wembleyBoundary(poly, a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let nearest = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
  }
  if (!Number.isFinite(nearest)) throw Error('Wembley plan ray missed');
  return [dx * nearest, dz * nearest];
}
function rounded(a, hx, hz, r) {
  const x = Math.sin(a),
    z = Math.cos(a),
    ax = Math.abs(x),
    az = Math.abs(z);
  let t = Math.min(hx / (ax || 1e-12), hz / (az || 1e-12));
  if (t * ax > hx - r && t * az > hz - r) {
    const cx = hx - r,
      cz = hz - r,
      d = ax * cx + az * cz;
    t = d + Math.sqrt(Math.max(0, d * d - cx * cx - cz * cz + r * r));
  }
  return [x * t, z * t];
}
export const wembleyArchCenter = (t) => [
  -157.5 * Math.cos(t),
  3 + 126.6 * Math.sin(t),
  -50 - 126.6 * Math.sin(t) * Math.tan((22 * Math.PI) / 180),
];
export function wembleyArchPoint(t, a) {
  const tilt = (22 * Math.PI) / 180,
    B = [0, Math.sin(tilt), Math.cos(tilt)],
    C = wembleyArchCenter(t),
    axis = normalize([
      157.5 * Math.sin(t),
      126.6 * Math.cos(t),
      -126.6 * Math.cos(t) * Math.tan(tilt),
    ]),
    N = normalize(cross(axis, B)),
    r = Math.min(3.5, 0.19 + Math.sin(t) * 25);
  return C.map((v, k) => v + r * (Math.cos(a) * N[k] + Math.sin(a) * B[k]));
}
function arch(o, S) {
  if (S.solidArch) {
    const rings = Array.from({ length: S.arch + 1 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => wembleyArchPoint((Math.PI * i) / S.arch, (T * j) / 6)),
    );
    loft(o, 'metal', rings, white);
  } else {
    for (let chord = 0; chord < S.chords; chord++)
      curve(
        o,
        Array.from({ length: S.arch + 1 }, (_, i) =>
          wembleyArchPoint((Math.PI * i) / S.arch, (T * chord) / S.chords),
        ),
        S.chordRadius,
        white,
        'metal',
        S.chordSides,
      );
    for (let j = 1; j < S.rings; j++) {
      const t = (Math.PI * j) / S.rings,
        u = (Math.PI * (j + 1)) / S.rings;
      for (let k = 0; k < S.chords; k++) {
        const a = (T * k) / S.chords,
          b = (T * (k + 1)) / S.chords;
        beam(o, 'metal', wembleyArchPoint(t, a), wembleyArchPoint(t, b), 0.3, 0.3, white);
        if (S.web && j < S.rings - 1)
          beam(
            o,
            'metal',
            wembleyArchPoint(t, a),
            wembleyArchPoint(u, j % 2 ? b : (T * (k - 1)) / S.chords),
            0.2,
            0.2,
            white,
          );
      }
    }
  }
  for (const x of [-157.5, 157.5]) {
    box(o, 'concrete', [x - 3.2, 0, -53.2], [x + 3.2, 1.7, -46.8], concrete);
    if (S.detail) box(o, 'metal', [x - 1.3, 1.7, -51.2], [x + 1.3, 3.3, -48.8], gray);
  }
  if (S.cables)
    for (let j = 0; j < S.cables; j++) {
      const t = Math.PI * (0.1 + (0.8 * j) / (S.cables - 1)),
        p = wembleyArchCenter(t),
        x = p[0];
      for (const d of [-15.5, 15.5]) {
        const xx = Math.max(-141, Math.min(141, x + d));
        beam(
          o,
          'metal',
          p,
          [xx, 53, -47 - 10 * (xx / 141) ** 2],
          S.cableWidth,
          S.cableWidth,
          white,
        );
      }
      if (S.backstays)
        beam(
          o,
          'metal',
          p,
          [x * 0.97, 49.3, -126 * Math.sqrt(Math.max(0, 1 - (x / 160) ** 2))],
          S.cableWidth,
          S.cableWidth,
          white,
        );
    }
}
function roofPoint(a, t) {
  const p = wembleyBoundary(openingPlan, a),
    q = wembleyBoundary(outerPlan, a);
  return [p[0] * (1 - t) + q[0] * t, 51.6 - 2.2 * t + Math.sin(a) * 0.4, p[1] * (1 - t) + q[1] * t];
}
function roof(o, S) {
  for (let i = 0; i < S.n; i++) {
    const a = (T * i) / S.n,
      b = (T * (i + 1)) / S.n;
    for (let j = 0; j < S.radial; j++) {
      const t = j / S.radial,
        u = (j + 1) / S.radial,
        ps = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)];
      face(o, 'seam', ps, [0.72, 0.75, 0.75], [0, 1, 0]);
      if (S.under)
        face(
          o,
          'metal',
          ps.map((p) => [p[0], p[1] - 0.35, p[2]]),
          white,
          [0, -1, 0],
        );
    }
    if (S.detail && i % S.roofRhythm === 0) {
      const p = roofPoint(a, 0),
        q = roofPoint(a, 1);
      beam(o, 'metal', [p[0], p[1] - 0.8, p[2]], [q[0], q[1] - 0.8, q[2]], 0.6, 0.65, white);
      if (S.roofWeb) {
        const m = roofPoint(a, 0.48);
        beam(o, 'metal', [p[0], p[1] - 0.8, p[2]], [m[0], m[1] - 4.8, m[2]], 0.45, 0.45, white);
        beam(o, 'metal', [m[0], m[1] - 4.8, m[2]], [q[0], q[1] - 0.8, q[2]], 0.45, 0.45, white);
      }
    }
    if (S.rim) {
      const p = roofPoint(a, 0),
        q = roofPoint(b, 0);
      face(
        o,
        'metal',
        [[p[0], p[1] - 1.2, p[2]], [q[0], q[1] - 1.2, q[2]], q, p],
        white,
        radial(a).map((v) => -v),
      );
    }
  }
  // Seven panel divisions stay on the existing fixed-roof annulus;the central aperture is clear.
  if (S.panels)
    for (let i = 0; i < 7; i++) {
      const a = (T * (i + 0.4)) / 7,
        p = roofPoint(a, 0.08),
        q = roofPoint(a, 0.98);
      beam(o, 'metal', [p[0], p[1] + 0.08, p[2]], [q[0], q[1] + 0.08, q[2]], 0.25, 0.2, gray);
    }
}
function perimeterTruss(o, S) {
  for (let i = 0; i < S.n; i++) {
    const a = (T * i) / S.n,
      b = (T * (i + 1)) / S.n,
      p = wembleyBoundary(outerPlan, a).map((v) => v * 0.985),
      q = wembleyBoundary(outerPlan, b).map((v) => v * 0.985),
      ay = 49.3 + Math.sin(a) * 0.4,
      by = 49.3 + Math.sin(b) * 0.4;
    if (S.solidArch) {
      face(
        o,
        'metal',
        [native(p, 43.2), native(q, 43.2), native(q, by), native(p, ay)],
        white,
        radial(a),
      );
      continue;
    }
    face(
      o,
      'metal',
      [native(p, 43.2), native(q, 43.2), native(q, 43.65), native(p, 43.65)],
      white,
      radial(a),
    );
    face(
      o,
      'metal',
      [native(p, ay - 0.45), native(q, by - 0.45), native(q, by), native(p, ay)],
      white,
      radial(a),
    );
    if (i % (S.chords === 6 ? 2 : S.n === 60 ? 4 : 2) === 0)
      beam(o, 'metal', native(p, 43.35), native(q, by - 0.15), 0.45, 0.45, white);
  }
}
const tiers = [
  { hx: 60, hz: 42, r: 12, rows: 31, run: 0.81, rise: 0.37, y: 1.2 },
  { hx: 86, hz: 68, r: 28, rows: 16, run: 0.8, rise: 0.45, y: 15.3 },
  { hx: 102, hz: 84, r: 40, rows: 34, run: 0.78, rise: 0.53, y: 26 },
];
function bowl(o, S) {
  for (const [k, t] of tiers.entries()) {
    const groups = S.steps[k];
    for (let row = 0; row < groups; row++) {
      const r = (row * t.rows) / groups,
        next = ((row + 1) * t.rows) / groups,
        y = t.y + r * t.rise,
        oy = t.y + next * t.rise,
        point = (a, rr, h) => {
          const p = rounded(a, t.hx + rr * t.run, t.hz + rr * t.run, t.r + rr * t.run * 0.67),
            inner = Math.hypot(...rounded(a, t.hx, t.hz, t.r)),
            full = Math.hypot(
              ...rounded(
                a,
                t.hx + t.rows * t.run,
                t.hz + t.rows * t.run,
                t.r + t.rows * t.run * 0.67,
              ),
            ),
            limit = Math.min(full, Math.hypot(...wembleyBoundary(outerPlan, a)) * 0.935),
            length = Math.hypot(...p),
            fit = inner + ((length - inner) * (limit - inner)) / (full - inner);
          return native(
            p.map((v) => (v * fit) / length),
            h,
          );
        };
      for (let i = 0; i < S.n; i++) {
        const a = (T * i) / S.n,
          b = (T * (i + 1)) / S.n;
        face(
          o,
          'plastic',
          [
            point(a, r, y + 0.2),
            point(b, r, y + 0.2),
            point(b, next, S.sloped ? oy + 0.2 : y + 0.2),
            point(a, next, S.sloped ? oy + 0.2 : y + 0.2),
          ],
          red,
          [0, 1, 0],
        );
        if (!S.sloped)
          face(
            o,
            'concrete',
            [
              point(a, r, y - (t.rows / groups) * t.rise),
              point(b, r, y - (t.rows / groups) * t.rise),
              point(b, r, y + 0.2),
              point(a, r, y + 0.2),
            ],
            concrete,
            radial(a).map((v) => -v),
          );
      }
    }
    if (S.detail)
      for (let i = 0; i < S.n; i++) {
        const a = (T * i) / S.n,
          b = (T * (i + 1)) / S.n,
          p = rounded(a, t.hx, t.hz, t.r),
          q = rounded(b, t.hx, t.hz, t.r);
        face(
          o,
          'metal',
          [
            native(p, t.y - 0.65),
            native(q, t.y - 0.65),
            native(q, t.y + 0.18),
            native(p, t.y + 0.18),
          ],
          gray,
          radial(a).map((v) => -v),
        );
      }
  }
  if (S.royal) {
    box(o, 'concrete', [-18, 12.5, -77], [18, 15.1, -67], concrete);
    box(o, 'plastic', [-16.8, 15.2, -76], [16.8, 15.55, -68], [0.32, 0.02, 0.03]);
    box(o, 'metal', [-18.2, 15.6, -67.4], [18.2, 16.25, -66.9], white);
  }
  if (S.screens)
    for (const sign of [-1, 1]) {
      box(o, 'metal', [sign * 107 - 0.4, 33, -10], [sign * 107 + 0.4, 42, 10], gray);
      box(
        o,
        'glass',
        [sign * 107 - sign * 0.5 - 0.03, 33.3, -9.7],
        [sign * 107 - sign * 0.5 + 0.03, 41.7, 9.7],
        [0.025, 0.035, 0.045],
      );
    }
}
function envelope(o, S) {
  for (let i = 0; i < S.n; i++) {
    const a = (T * i) / S.n,
      b = (T * (i + 1)) / S.n,
      p = wembleyBoundary(outerPlan, a).map((v) => v * 0.968),
      q = wembleyBoundary(outerPlan, b).map((v) => v * 0.968);
    face(
      o,
      'concrete',
      [native(p, 0), native(q, 0), native(q, 10.8), native(p, 10.8)],
      concrete,
      radial(a),
    );
    face(
      o,
      'glass',
      [native(p, 10.8), native(q, 10.8), native(q, 43.2), native(p, 43.2)],
      glass,
      radial(a),
    );
    for (let j = 0; j < S.facadeBands; j++) {
      const y = 10.8 + (j * 32.4) / S.facadeBands;
      face(
        o,
        'metal',
        [native(p, y), native(q, y), native(q, y + 0.65), native(p, y + 0.65)],
        white,
        radial(a),
      );
    }
    if (S.piers && i % S.piers === 0)
      beam(o, 'concrete', native(p, 0), native(p, 42.8), 0.7, 0.8, concrete);
    if (S.mullions) beam(o, 'metal', native(p, 10.8), native(p, 43.1), 0.18, 0.18, white);
    const lo = wembleyBoundary(outerPlan, a).map((v) => v * 0.94),
      lq = wembleyBoundary(outerPlan, b).map((v) => v * 0.94),
      u = wembleyBoundary(outerPlan, a).map((v) => v * 1.025),
      v = wembleyBoundary(outerPlan, b).map((v) => v * 1.025);
    face(
      o,
      'concrete',
      [native(lo, 0.025), native(lq, 0.025), native(v, 0.025), native(u, 0.025)],
      concrete,
      [0, 1, 0],
    );
  }
  box(o, 'concrete', [-38, 0, -153.5], [38, 10.2, -140], concrete);
  box(o, 'glass', [-36.8, 10.3, -153.7], [36.8, 27.6, -151.4], [0.12, 0.25, 0.39]);
  box(o, 'metal', [-39, 28, -155.7], [39, 28.65, -141], gray);
  if (S.entranceFrames) {
    for (let x = -36; x <= 36; x += S.entranceFrames)
      box(o, 'metal', [x - 0.12, 10.25, -153.92], [x + 0.12, 27.7, -153.68], white);
    for (const y of [10.3, 18.8, 27.7])
      box(o, 'metal', [-37, y, -154.1], [37, y + 0.22, -153.6], white);
  }
  if (S.entrySteps)
    for (let i = 0; i < S.entrySteps; i++) {
      const t = i / S.entrySteps,
        u = (i + 1) / S.entrySteps;
      box(o, 'concrete', [-36, t * 9.6, -171.5 + t * 16], [36, u * 9.6, -171.5 + u * 16], concrete);
    }
}
function pitch(o, S) {
  face(
    o,
    'turf',
    [
      [-60, 0.01, -42],
      [60, 0.01, -42],
      [60, 0.01, 42],
      [-60, 0.01, 42],
    ],
    [0.15, 0.29, 0.1],
    [0, 1, 0],
  );
  face(
    o,
    'turf',
    [
      [-52.5, 0.02, -34],
      [52.5, 0.02, -34],
      [52.5, 0.02, 34],
      [-52.5, 0.02, 34],
    ],
    [0.19, 0.335, 0.086],
    [0, 1, 0],
  );
  if (!S.markings) return;
  const line = (ps) => {
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = (-(b[1] - a[1]) * 0.08) / L,
        nz = ((b[0] - a[0]) * 0.08) / L;
      face(
        o,
        'plastic',
        [
          [a[0] + nx, 0.032, a[1] + nz],
          [b[0] + nx, 0.032, b[1] + nz],
          [b[0] - nx, 0.032, b[1] - nz],
          [a[0] - nx, 0.032, a[1] - nz],
        ],
        white,
        [0, 1, 0],
      );
    }
  };
  line([
    [-52.5, -34],
    [52.5, -34],
    [52.5, 34],
    [-52.5, 34],
    [-52.5, -34],
  ]);
  line([
    [0, -34],
    [0, 34],
  ]);
  line(
    Array.from({ length: S.circle + 1 }, (_, i) => [
      9.15 * Math.sin((T * i) / S.circle),
      9.15 * Math.cos((T * i) / S.circle),
    ]),
  );
  for (const sign of [-1, 1]) {
    line([
      [52.5 * sign, -20.16],
      [36 * sign, -20.16],
      [36 * sign, 20.16],
      [52.5 * sign, 20.16],
    ]);
    if (S.goals) {
      for (const z of [-3.66, 3.66])
        beam(o, 'metal', [52.5 * sign, 0, z], [52.5 * sign, 2.44, z], 0.12, 0.12, white);
      beam(o, 'metal', [52.5 * sign, 2.44, -3.66], [52.5 * sign, 2.44, 3.66], 0.12, 0.12, white);
    }
  }
}
export function buildWembleyBrowser(o, level = 'skyline') {
  const S = {
    skyline: {
      n: 24,
      arch: 20,
      solidArch: true,
      radial: 1,
      facadeBands: 1,
      steps: [1, 1, 1],
      sloped: true,
    },
    district: {
      n: 40,
      arch: 16,
      chords: 6,
      chordSides: 4,
      chordRadius: 0.34,
      rings: 8,
      web: true,
      cables: 4,
      cableWidth: 0.5,
      radial: 2,
      facadeBands: 3,
      steps: [1, 1, 1],
      sloped: true,
      detail: true,
      roofRhythm: 8,
      markings: true,
      circle: 12,
      entranceFrames: 18,
      entrySteps: 4,
    },
    street: {
      n: 60,
      arch: 24,
      chords: 12,
      chordSides: 6,
      chordRadius: 0.2285,
      rings: 12,
      web: true,
      cables: 8,
      cableWidth: 0.25,
      backstays: true,
      radial: 3,
      under: true,
      rim: true,
      facadeBands: 6,
      piers: 4,
      steps: [8, 5, 9],
      detail: true,
      roofRhythm: 4,
      markings: true,
      circle: 24,
      entranceFrames: 9,
      entrySteps: 10,
      royal: true,
      screens: true,
      goals: true,
      panels: true,
    },
    closeup: {
      n: 88,
      arch: 64,
      chords: 12,
      chordSides: 8,
      chordRadius: 0.2285,
      rings: 43,
      web: true,
      cables: 12,
      cableWidth: 0.16,
      backstays: true,
      radial: 6,
      under: true,
      rim: true,
      facadeBands: 6,
      piers: 4,
      mullions: true,
      steps: [31, 16, 34],
      detail: true,
      roofRhythm: 2,
      roofWeb: true,
      markings: true,
      circle: 40,
      entranceFrames: 4.5,
      entrySteps: 40,
      royal: true,
      screens: true,
      goals: true,
      panels: true,
    },
  }[level];
  if (!S) throw Error(level);
  pitch(o, S);
  bowl(o, S);
  envelope(o, S);
  roof(o, S);
  perimeterTruss(o, S);
  arch(o, S);
}
export const buildWembleySkyline = (o) => buildWembleyBrowser(o, 'skyline');
export const buildWembleyDistrict = (o) => buildWembleyBrowser(o, 'district');
export const buildWembleyStreet = (o) => buildWembleyBrowser(o, 'street');
export const buildWembleyCloseup = (o) => buildWembleyBrowser(o, 'closeup');
