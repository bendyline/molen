/** Cape Lookout: cardinal diamond daymark on the actual tower, with native entrance steps. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dq/dq1/cape_lookout_lighthouse/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    white: rgb('e8e4d8'),
    black: rgb('383d41'),
    metal: rgb('42494c'),
    glass: rgb('788e95'),
    frame: rgb('d1cdbf'),
  };
const surfaces = {
  white: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  black: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.25 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.3, metallic: 0.08 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.05 },
};
function tri(o, s, p, h, col = C[s]) {
  if (h && normalFor(...p).reduce((a, v, i) => a + v * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  const n = normalFor(...p),
    a = n.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, p, n, p.map(uv), col);
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function circle(o, s, y0, y1, r0, r1, n) {
  loft(o, s, [radialRing(y0, r0, r0, n), radialRing(y1, r1, r1, n)], C[s]);
}
const outline = plan.outline,
  R = outline.reduce((s, p) => s + Math.hypot(...p), 0) / outline.length,
  topScale = plan.nominalTopRadius / R,
  scale = (y) => 1 + ((topScale - 1) * Math.max(0, y)) / 40.5;
function radial(theta) {
  const v = [Math.cos(theta), Math.sin(theta)];
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      e = [b[0] - a[0], b[1] - a[1]],
      det = e[0] * v[1] - e[1] * v[0];
    if (Math.abs(det) < 1e-10) continue;
    const t = -(a[0] * v[1] - a[1] * v[0]) / det;
    if (t < 0 || t > 1) continue;
    const r = (a[0] + e[0] * t) * v[0] + (a[1] + e[1] * t) * v[1];
    if (r > 0) best = Math.min(best, r);
  }
  if (!Number.isFinite(best)) throw Error('Native circle ray missing');
  return best;
}
function clip(poly, axis, bound, side) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      fa = (a[axis] - bound) * side,
      fb = (b[axis] - bound) * side;
    if (fa >= -1e-10) out.push(a);
    if ((fa > 1e-10 && fb < -1e-10) || (fa < -1e-10 && fb > 1e-10)) {
      const t = fa / (fa - fb);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}
function body(o, d) {
  const n = [16, 24, 32, 48][d],
    angles = Array.from({ length: n + 1 }, (_, j) => -Math.PI + (2 * Math.PI * j) / n);
  if (d > 0)
    for (const p of outline) {
      const a = Math.atan2(p[1], p[0]);
      if (!angles.some((x) => Math.abs(x - a) < 1e-6)) angles.push(a);
    }
  angles.sort((a, b) => a - b);
  for (let i = 1; i < angles.length; i++) {
    const a = angles[i - 1],
      b = angles[i],
      ra = radial(a),
      rb = radial(b),
      aa = [Math.cos(a) * ra, Math.sin(a) * ra],
      bb = [Math.cos(b) * rb, Math.sin(b) * rb],
      mid = (a + b) / 2,
      normal = [Math.cos(mid), 0, Math.sin(mid)],
      P = (t, y, offset = 0) => {
        const q = (t - a) / (b - a),
          p = aa.map((v, k) => v + (bb[k] - v) * q);
        return [p[0] * scale(y) + offset * Math.cos(t), y, p[1] * scale(y) + offset * Math.sin(t)];
      };
    Q(o, 'white', [P(a, -0.4), P(b, -0.4), P(b, 40.5), P(a, 40.5)], normal);
    // Clip original rhombi in angle/height space; never stamp a photographic texture.
    for (const theta of [-Math.PI / 2, Math.PI / 2])
      for (const y of [5, 17, 29, 41]) {
        let p = [
          [theta - Math.PI / 2, y],
          [theta, y - 6],
          [theta + Math.PI / 2, y],
          [theta, y + 6],
        ];
        p = clip(p, 0, a, 1);
        p = clip(p, 0, b, -1);
        p = clip(p, 1, 0, 1);
        p = clip(p, 1, 40.5, -1);
        if (p.length < 3) continue;
        const points = p.map((q) => P(q[0], q[1], 0.008));
        for (let j = 1; j < points.length - 1; j++) {
          const ps = [points[0], points[j], points[j + 1]];
          if (
            Math.hypot(...normalFor(...ps)) &&
            Math.hypot(...ps[1].map((v, k) => v - ps[0][k])) > 1e-7
          )
            tri(o, 'black', ps, normal);
        }
      }
  }
  circle(o, 'white', 40.5, 42.2, 2.0193, 2.0193, [8, 16, 24, 32][d]);
  circle(o, 'white', -0.4, 0, R, R, [16, 24, 32, 48][d]);
}
function face(theta, y0) {
  const n = [Math.cos(theta), 0, Math.sin(theta)],
    t = [-Math.sin(theta), 0, Math.cos(theta)];
  return {
    n,
    P: (u, y, dep = 0) => {
      const r = y > 40.5 ? 2.0193 : radial(theta) * scale(y);
      return [n[0] * (r + dep) + t[0] * u, y0 + y, n[2] * (r + dep) + t[2] * u];
    },
  };
}
function panel(o, s, f, u, y, w, h, dep = 0.04) {
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
  );
}
function window(o, theta, y, w, h, d, door = false) {
  const f = face(theta, 0);
  panel(o, 'glass', f, 0, y, w, h, 0.045);
  if (d === 0) return;
  for (const x of [-w / 2 - 0.06, w / 2 + 0.06])
    panel(o, 'frame', f, x, y - 0.09, 0.12, h + 0.18, 0.09);
  for (const z of [y - 0.07, y + h + 0.07]) panel(o, 'frame', f, 0, z, w + 0.24, 0.14, 0.09);
  if (d > 1) {
    panel(o, 'frame', f, 0, y, 0.075, h, 0.12);
    if (!door) panel(o, 'frame', f, 0, y + h / 2, w, 0.075, 0.12);
  }
}
function openings(o, d) {
  if (d === 0) return;
  for (let j = 0; j < 5; j++) {
    window(o, -Math.PI * 0.25, 6 + j * 7.1, 0.56, 0.95, d);
    window(o, Math.PI * 0.75, 9 + j * 7.1, 0.56, 0.95, d);
  }
  const door = plan.stair.at(-1),
    theta = Math.atan2(door[1], door[0]);
  window(o, theta, 2.2, 1.05, 2.05, d, true);
  window(o, theta + Math.PI, 0.15, 0.95, 1.8, d, true);
  window(o, theta, 40.75, 0.48, 0.65, d);
}
function rail(o, y, r, n, d) {
  const h = 1.1;
  for (const yy of [y + 0.48, y + h]) {
    const p = radialRing(yy, r, r, n);
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      if (d < 2)
        Q(
          o,
          'metal',
          [
            [p[j][0], yy - 0.07, p[j][2]],
            [p[k][0], yy - 0.07, p[k][2]],
            [p[k][0], yy + 0.07, p[k][2]],
            [p[j][0], yy + 0.07, p[j][2]],
          ],
          [p[j][0] + p[k][0], 0, p[j][2] + p[k][2]],
        );
      else beam(o, 'metal', p[j], p[k], 0.075, 0.075, C.metal);
    }
  }
  if (d > 0)
    for (let j = 0; j < n; j++) {
      const t = (j * Math.PI * 2) / n;
      beam(
        o,
        'metal',
        [r * Math.cos(t), y, r * Math.sin(t)],
        [r * Math.cos(t), y + h, r * Math.sin(t)],
        0.08,
        0.08,
        C.metal,
      );
    }
}
function lantern(o, d) {
  const n = [8, 12, 16, 24][d];
  circle(o, 'metal', 42.2, 42.8, 2.02, 2.88, n);
  circle(o, 'metal', 42.8, 43.05, 2.88, 2.88, n);
  circle(o, 'metal', 43.05, 44.1, 2.06, 2.06, n);
  rail(o, 43.05, 2.85, n, d);
  circle(o, 'metal', 44.1, 44.3, 2.55, 2.55, n);
  rail(o, 44.3, 2.5, n, d);
  circle(o, 'glass', 44.3, 47.7, 1.88, 1.88, n);
  for (let j = 0; j < n; j++) {
    const t = (j * Math.PI * 2) / n;
    if (d > 0)
      beam(
        o,
        'metal',
        [1.9 * Math.cos(t), 44.3, 1.9 * Math.sin(t)],
        [1.9 * Math.cos(t), 47.7, 1.9 * Math.sin(t)],
        0.11,
        0.11,
        C.metal,
      );
  }
  if (d > 1) {
    circle(o, 'metal', 45.85, 45.95, 1.92, 1.92, n);
    const f = face(0, 0);
    panel(o, 'frame', f, 0, 43.25, 0.48, 0.56, 0.08);
  }
  circle(o, 'metal', 47.7, 47.95, 2.13, 2.13, n);
  circle(o, 'metal', 47.95, 48.8, 2.13, 0.45, n);
  circle(o, 'metal', 48.8, 49.12, 0.21, 0.21, n);
  circle(o, 'metal', 49.12, 49.6844, 0.21, 0.035, n);
}
function stairs(o, d) {
  const [a, b, c] = plan.stair,
    h = plan.levels.entranceLanding,
    v = [b[0] - a[0], b[1] - a[1]],
    len = Math.hypot(...v),
    t = v.map((x) => x / len),
    side = [-t[1], t[0]],
    width = 1.2,
    N = d === 0 ? 6 : 11,
    P = (u, y, w = 0) => [a[0] + t[0] * u + side[0] * w, y, a[1] + t[1] * u + side[1] * w];
  for (let j = 0; j < N; j++) {
    const u0 = (len * j) / N,
      u1 = (len * (j + 1)) / N,
      y = (h * (j + 1)) / N;
    Q(
      o,
      'frame',
      [P(u0, y, -width / 2), P(u1, y, -width / 2), P(u1, y, width / 2), P(u0, y, width / 2)],
      [0, 1, 0],
    );
    Q(
      o,
      'frame',
      [
        P(u0, (h * j) / N, -width / 2),
        P(u0, (h * j) / N, width / 2),
        P(u0, y, width / 2),
        P(u0, y, -width / 2),
      ],
      [-t[0], 0, -t[1]],
    );
  }
  for (const s of [-1, 1]) {
    beam(
      o,
      'frame',
      P(0, 0.08, (s * width) / 2),
      P(len, h - 0.04, (s * width) / 2),
      0.14,
      0.16,
      C.frame,
    );
    if (d > 0) {
      beam(
        o,
        'frame',
        P(0, 0.95, (s * width) / 2),
        P(len, h + 0.95, (s * width) / 2),
        0.1,
        0.1,
        C.frame,
      );
      for (let j = 0; j <= 4; j++)
        beam(
          o,
          'frame',
          P((len * j) / 4, (h * j) / 4, (s * width) / 2),
          P((len * j) / 4, (h * j) / 4 + 0.95, (s * width) / 2),
          0.09,
          0.09,
          C.frame,
        );
    }
  }
  const end = c.map((v) => v * (1 - 0.25 / Math.hypot(...c))),
    w = [c[0] - b[0], c[1] - b[1]],
    l = Math.hypot(...w),
    n = [-w[1] / l, w[0] / l],
    q = (p, s) => [p[0] + (n[0] * s * width) / 2, h, p[1] + (n[1] * s * width) / 2];
  Q(o, 'frame', [q(b, -1), q(end, -1), q(end, 1), q(b, 1)], [0, 1, 0]);
  for (const s of [-1, 1]) {
    const u = q(b, s),
      v = q(c, s);
    beam(o, 'frame', [u[0], 0, u[2]], u, 0.14, 0.14, C.frame);
    if (d > 0) {
      beam(
        o,
        'frame',
        u.map((v, i) => v + (i === 1 ? 0.95 : 0)),
        v.map((v, i) => v + (i === 1 ? 0.95 : 0)),
        0.1,
        0.1,
        C.frame,
      );
      beam(
        o,
        'frame',
        u,
        u.map((v, i) => v + (i === 1 ? 0.95 : 0)),
        0.1,
        0.1,
        C.frame,
      );
    }
  }
}
function build(o, _f, d = 3) {
  body(o, d);
  openings(o, d);
  lantern(o, d);
  stairs(o, d);
}
export const capeLookoutSkyline = (o, f) => build(o, f, 0),
  capeLookoutDistrict = (o, f) => build(o, f, 1),
  capeLookoutStreet = (o, f) => build(o, f, 2);
export const capeLookoutLighthouseModel = {
  id: 'cape_lookout_lighthouse',
  key: 'cape_lookout_lighthouse',
  recipe: 'structure-cape-lookout-lighthouse.mjs',
  cell: 'dq/dq1',
  title: 'Cape Lookout Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete49.6844m1859Cape Lookout tower at its actual native location: mapped tapered round masonry, original black/white diamond daymark in true cardinal alignment, white neck/flared dark galleries/watch stage/open rails, glazed lantern/dark roof/vent/finial, shallow divided windows/doors and native northeast entrance steps/open landing. Exact public-domain NPSstaff original first inspected through Qualla then byte-matched to primary federal release. Separate houses/1812ruin/site/boardwalk/temporary restoration works excluded. Minor sections/paint phase/windows/rails and coastal contact approximate.',
  camera: [47, 31, 66],
  lookAt: [0, 23, 0],
  portableGroundY: -0.52,
  mediumFiContext: { scale: 1.7, groundY: -0.52 },
  qaCameras: [
    {
      name: 'cardinal-diamonds-and-surviving-conical-tower',
      position: [33, 26, 43],
      lookAt: [0, 24, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'northeast-native-steps-landing-and-small-masonry-openings',
      position: [14, 7, -20],
      lookAt: [0, 5, -1],
    },
    {
      name: 'white-neck-flared-galleries-open-rails-and-glazed-lantern',
      position: [13, 46, 17],
      lookAt: [0, 44.6, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed native entrance stair bottom before independent160mrawterrain; coastal grade/footings approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cape-lookout-lighthouse.mjs',
    level: 'skyline',
    export: 'capeLookoutSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'capeLookoutDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'capeLookoutStreet', errorMeters: 0.16, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Qualla first: exact published3072x2048NPSstaff image inspected; pinned primary NPGallery record explicitly credits National Park Service staff and public domain. Selected primary original is byte-identical to Qualla image, avoiding missing category provenance in generated Qualla metadata. Both shareSHA256b81ab7aa34a69d8275e20f4c92e2284ec5c5c75562bae94ec23137c67e86750c. No additional architectural photo, generatedbitmap or copied photographic texture.',
    'Official NPS163ftabove-ground/49.6844moverall height and4.0386mtop diameter govern vertical scale. Original approximate8.5mnative base circle retained; published8.7122mbase diameter differs slightly. Native15.7mheight is explicitly inconsistent and excluded; seamark51.5mhas a different measurement datum. Minor profile/roof/gallery levels are independent estimates from inspected photograph rather than a measured restoration survey.',
    'Black diamond centers face true north/south and white centers east/west. Rhombi are original clipped vertex-color geometry retained in all four LODs, with photograph-informed approximate12mpitch/vertical phase. No camera-facing rotation or copied daymark photograph. Small window distribution/white watch-room aperture/door sizes and rail/pane census are representative; concealed interiors and optical apparatus are excluded.',
    'Surviving permanent tower only; NPSarchive metadata2004does not establish camera date. Native current northeast stair/landing controls approach geometry. Detached keeper house/visitor center/1812tower ruins, grounds/wholeboardwalk/vegetation/beach, and temporary2025-2026conservation/scaffolding/site works excluded. No proposed1859attached house reconstructed. Closed blue-grey glazing approximates panes; lighthouse emits no simulated navigational signal.',
    'Independent160mrawTerrariumfield frozen before geometry at actual native entrance stair bottom. Original source grid/tiles/PNGpreserved without flattening/fitting. Sandy coastal threshold/footings and host contact approximate; no model terrain/platform. Flatstage is illustrative rather than surveyed grade.',
  ],
};
