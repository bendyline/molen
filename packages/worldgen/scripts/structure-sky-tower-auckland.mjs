/** Whole Auckland Sky Tower: open raked base, shaft, layered pods and complete antenna. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/rc/rck/sky_tower_auckland/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  concrete: rgb('b6bdb3'),
  trim: rgb('c1ccc5'),
  steel: rgb('8faba8'),
  glass: rgb('395b5c'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.1 },
  steel: { slot: 'roof', graph: 'metal_stainless_beadblasted', roughness: 0.82, metallic: 0.4 },
  glass: { slot: 'window', localRef: ref, roughness: 0.48, metallic: 0.08 },
};
const N = (d) => [8, 20, 48, 80][d],
  R = (r, y, a) => [r * Math.cos(a), y, r * Math.sin(a)],
  radius = (id) => {
    const r = plan.nativeNamedLevels.find((x) => x.id === id).outline;
    return r.reduce((s, p) => s + Math.hypot(...p), 0) / r.length;
  },
  bar = radius(329588157),
  orbit = radius(697464068),
  sky = radius(1173272340),
  outer = Math.max(...plan.outline.map((p) => Math.hypot(...p)));
function T(o, s, p, n) {
  p = p.map((p) => p.map(Math.fround));
  const nn = normalFor(...p);
  if (nn.every((v) => v === 0)) return;
  if (n && nn.reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, [p[0], p[1], p[2]], n);
  T(o, s, [p[0], p[2], p[3]], n);
}
function disk(o, s, y, r, n, up = true) {
  for (let i = 0; i < n; i++)
    T(
      o,
      s,
      [[0, y, 0], R(r, y, (i * 2 * Math.PI) / n), R(r, y, ((i + 1) * 2 * Math.PI) / n)],
      [0, up ? 1 : -1, 0],
    );
}
function profile(o, path, d, cap = true, n = N(d)) {
  for (let j = 1; j < path.length; j++) {
    const a = path[j - 1],
      b = path[j],
      s = b[2];
    for (let i = 0; i < n; i++) {
      const t = (i * 2 * Math.PI) / n,
        u = ((i + 1) * 2 * Math.PI) / n;
      Q(
        o,
        s,
        [R(a[1], a[0], t), R(a[1], a[0], u), R(b[1], b[0], u), R(b[1], b[0], t)],
        [Math.cos((t + u) / 2), a[1] - b[1], Math.sin((t + u) / 2)],
      );
    }
  }
  if (cap) {
    disk(o, path[0][2], path[0][0], path[0][1], n, false);
    disk(o, path.at(-1)[2], path.at(-1)[0], path.at(-1)[1], n);
  }
}
function rod(o, s, a, b, r, d) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(axis, Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(axis, u),
    n = [4, 8, 12, 16][d],
    ring = (p) =>
      Array.from({ length: n }, (_, i) =>
        p.map(
          (q, k) =>
            q +
            r * (u[k] * Math.cos((i * 2 * Math.PI) / n) + v[k] * Math.sin((i * 2 * Math.PI) / n)),
        ),
      );
  loft(o, s, [ring(a), ring(b)], C[s]);
}
function narrow(o, s, a, b, w, d) {
  if (d > 1) beam(o, s, a, b, w, w, C[s]);
  else {
    const v = normalize(b.map((v, i) => v - a[i])),
      u = normalize(cross(v, [0, 0, 1]));
    const p = [
      a.map((v, i) => v - (u[i] * w) / 2),
      b.map((v, i) => v - (u[i] * w) / 2),
      b.map((v, i) => v + (u[i] * w) / 2),
      a.map((v, i) => v + (u[i] * w) / 2),
    ];
    Q(o, s, p);
    Q(o, s, [...p].reverse());
  }
}
function shaft(o, d) {
  const n = N(d),
    ys = [0, 3, 10, 35, 70, 105, 145],
    slits = new Set([0, Math.round(n / 3), Math.round((n * 2) / 3)]);
  for (let j = 1; j < ys.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n,
        y0 = ys[j - 1],
        y1 = ys[j],
        hole = d > 1 && ((y0 >= 10 && slits.has(i)) || (y1 === 3 && (i === 0 || i === n - 1))),
        r = hole ? 5.84 : 6,
        p = [R(r, y0, a), R(r, y0, b), R(r, y1, b), R(r, y1, a)],
        normal = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
      Q(o, hole ? 'glass' : 'concrete', p, normal);
      if (hole) {
        const q = [R(6, y0, a), R(6, y0, b), R(6, y1, b), R(6, y1, a)];
        for (let k = 0; k < 4; k++) Q(o, 'concrete', [q[k], q[(k + 1) % 4], p[(k + 1) % 4], p[k]]);
        for (const t of [a, b]) narrow(o, 'trim', R(5.95, y0, t), R(5.95, y1, t), 0.07, d);
        narrow(o, 'trim', R(5.96, y1, a), R(5.96, y1, b), 0.12, d);
      }
    }
  disk(o, 'concrete', 0, 6, n, false);
  disk(o, 'concrete', 145, 6, n);
  if (d < 2)
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 + 0.03,
        b = a + 0.12;
      Q(
        o,
        'glass',
        [R(6.02, 10, a), R(6.02, 10, b), R(6.02, 145, b), R(6.02, 145, a)],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4,
      A = R(14, 0, a),
      B = R(5.9, 22, a);
    rod(o, 'concrete', A, B, 1, d);
    if (d > 1) {
      rod(o, 'concrete', [A[0], -0.05, A[2]], [A[0], 0.35, A[2]], 1.25, d);
    }
  }
  profile(
    o,
    [
      [21, 6, 'concrete'],
      [21, 6.9, 'concrete'],
      [23.5, 6.9, 'concrete'],
      [24.1, 6, 'concrete'],
    ],
    d,
    false,
  );
}
// Named native glass-band extents are fixed. Intermediate shoulders/ledges are photo estimates.
const head = [
  [145, 6, 'concrete'],
  [155, 7.5, 'concrete'],
  [159, 8.8, 'concrete'],
  [160, 8.8, 'trim'],
  [176, 10.5, 'glass'],
  [178.8, bar, 'concrete'],
  [179, bar, 'trim'],
  [183, bar, 'glass'],
  [184, 14.2, 'trim'],
  [185.5, 15.5, 'concrete'],
  [187, orbit, 'glass'],
  [194, orbit, 'glass'],
  [194.2, outer, 'steel'],
  [195.0, outer, 'trim'],
  [196.1, 16.1, 'steel'],
  [198, 12, 'trim'],
  [200, 8.5, 'concrete'],
  [219, 5.7, 'concrete'],
  [220, sky, 'trim'],
  [224, sky, 'glass'],
  [224.2, 9.0, 'steel'],
  [225.2, 9.0, 'trim'],
  [226, 6, 'steel'],
  [236, 3.1, 'concrete'],
  [238, 2.2, 'trim'],
];
function ringCourse(o, r, y, d) {
  const n = N(d);
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      p = [R(r - 0.08, y, a), R(r + 0.08, y, a), R(r + 0.08, y, b), R(r - 0.08, y, b)];
    Q(o, 'steel', p, [0, 1, 0]);
    Q(o, 'steel', [...p].reverse(), [0, -1, 0]);
  }
}
function podDetail(o, d) {
  const n = N(d),
    bands = [
      [160, 176, 8.8, 10.5],
      [179, 183, bar, bar],
      [185.5, 194, 15.5, orbit],
      [220, 224, sky, sky],
    ];
  if (d)
    for (const [y0, y1, r0, r1] of bands)
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n;
        narrow(o, 'trim', R(r0 + 0.025, y0, a), R(r1 + 0.025, y1, a), d > 1 ? 0.11 : 0.15, d);
      }
  ringCourse(o, outer, 196.0, d);
  if (d) {
    ringCourse(o, outer, 195.05, d);
    for (let i = 0; i < n; i++)
      narrow(
        o,
        'steel',
        R(outer, 195.05, (i * 2 * Math.PI) / n),
        R(outer, 196.0, (i * 2 * Math.PI) / n),
        0.07,
        d,
      );
  }
  if (d > 1) {
    for (const [y, r] of [
      [159, 8.9],
      [176, 10.6],
      [183, bar + 0.12],
      [186, 16.3],
      [190, orbit + 0.12],
      [194, orbit + 0.12],
      [200, 8.6],
      [208, 6.9],
      [215, 6.25],
      [220, sky + 0.12],
      [224, sky + 0.12],
    ])
      ringCourse(o, r, y, d);
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      rod(o, 'trim', R(9, 178, a), R(16.3, 189, a), 0.12, d);
      rod(o, 'trim', R(8.5, 201, a), R(15, 197, a), 0.1, d);
    }
    // Eight prominent precast fins strengthen the flare without filling the long shaft.
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        da = 0.032,
        p = [R(6.05, 132, a - da), R(6.05, 132, a + da), R(9.0, 160, a + da), R(9.0, 160, a - da)];
      Q(o, 'concrete', p, [Math.cos(a), 0, Math.sin(a)]);
      Q(o, 'concrete', [...p].reverse());
    }
  }
}
function mast(o, d) {
  const p = [
    [238, 2.2, 'steel'],
    [265, 1.6, 'steel'],
    [265, 1.35, 'steel'],
    [284, 1.35, 'steel'],
    [284, 1.0, 'steel'],
    [301, 0.7, 'steel'],
    [301, 0.4, 'steel'],
    [316, 0.26, 'steel'],
    [328, 0.12, 'steel'],
  ];
  profile(o, p, d, true, d ? Math.max(8, N(d) / 2) : 6);
  for (const [y, r] of [
    [254, 2.4],
    [280, 2.0],
    [302, 1.2],
  ])
    profile(
      o,
      [
        [y - 0.22, r * 0.7, 'steel'],
        [y - 0.22, r, 'steel'],
        [y + 0.22, r, 'steel'],
        [y + 0.3, r * 0.7, 'steel'],
      ],
      d,
      false,
      d ? Math.max(8, N(d) / 2) : 6,
    );
  if (d > 1)
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      rod(o, 'steel', R(2.1, 238, a), R(1.6, 265, a), 0.07, d);
      for (let y = 240; y < 264; y += d > 2 ? 2 : 4)
        narrow(
          o,
          'steel',
          R(2.1 - ((y - 238) * 0.5) / 27, y, a),
          R(2.1 - ((y + 2 - 238) * 0.5) / 27, y + 2, a + Math.PI / 2),
          0.035,
          d,
        );
    }
  if (d > 2)
    for (let y = 265; y < 315; y += 5)
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2,
          r = y < 284 ? 1.4 : y < 301 ? 1 : 0.5;
        rod(o, 'steel', R(r, y, a), R(r + 0.65, y, a), 0.04, d);
      }
}
function build(o, _f, d = 3) {
  shaft(o, d);
  profile(o, head, d, false);
  podDetail(o, d);
  mast(o, d);
}
export const skyTowerAucklandSkyline = (o, f) => build(o, f, 0);
export const skyTowerAucklandDistrict = (o, f) => build(o, f, 1);
export const skyTowerAucklandStreet = (o, f) => build(o, f, 2);
export const skyTowerAucklandModel = {
  id: 'sky_tower_auckland',
  key: 'sky_tower_auckland',
  recipe: 'structure-sky-tower-auckland.mjs',
  cell: 'rc/rck',
  title: 'Sky Tower (Auckland)',
  category: 'tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole328mAuckland Sky Tower:12mconcrete shaft/eight open raked base legs and collar, recessed lift slots, precast flare fins, layered bluegreen-glazed main pod with aluminium rings/mullions/radial supports and open outer ledge, separate small220mSkydeck and complete stepped telecommunications antenna. Exact published2023creatorCC0original, native whole envelope/named upper bands and primary engineer/architect/operator text. Intermediate sections and hidden base interfaces estimated; no neighboring SkyCity buildings/site slab.',
  camera: [360, 220, 450],
  lookAt: [0, 157, 0],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 1.5, groundY: -0.16 },
  qaCameras: [
    {
      name: 'whole-shaft-eight-raked-legs-separated-pods-and-complete-tip',
      position: [275, 175, 380],
      lookAt: [0, 158, 0],
    },
    {
      name: 'main-glazed-pod-radial-members-and-open-exterior-ledge',
      position: [44, 200, 56],
      lookAt: [0, 184, 0],
    },
    {
      name: 'separate-skydeck-upper-taper-and-stepped-telecommunications-mast',
      position: [60, 269, 85],
      lookAt: [0, 269, 0],
    },
    {
      name: 'eight-open-raked-base-legs-collar-and-recessed-entry',
      position: [29, 12, 35],
      lookAt: [0, 12, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent192mterrain frozen before geometry at fixed eastern approach[26,0]; provider26.6608m/full relative[-4.1585,5.6263]m. Exact current plaza/core/leg-foot/host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-sky-tower-auckland.mjs',
    level: 'skyline',
    export: 'skyTowerAucklandSkyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: {
      district: { export: 'skyTowerAucklandDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'skyTowerAucklandStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Exact already-published5152x3864AugustDominus2023QuallaCC0original inspected/native SHA17f8f098af469e946cd7940f56468736007f16582matched to pinned own-work/selfCC0release. Full31source families inventoried without conflict. All other attribution/interior/panorama images unused. Primary professional engineer/architect/operator facts used as text only; no new photo/diagram/copied pixels/generated bitmap.',
    'Original named tower relation9692605/Q722125/62point whole maximum outline and original named SkyBar179–183m/Orbit187–194m/Skydeck220–224mrings retained in source controls. Whole outer envelope is not a40mwide ground shaft or site pad. Native Skydeck32point mean anchors toweraxis; heading0. Twelve-metre shaft/eight raked base legs and328mheight are primary-text controlled. Intermediate shoulders, ledges, leg/fin dimensions, main glass subdivisions, shaft/entry slit bearings, antenna sections and hidden current ground interfaces are bounded photo/engineering estimates. Temporary lighting/signage/neighbors/whole plaza/interiors absent.',
    'Independent192m129x129at1.5m terrain from16641samples/one original Terrarium tile, frozen before geometry. Fixed eastern approach[26,0]; provider26.6608m/whole relative[-4.1585,5.6263]m. Raw tile/grid/PNG unchanged without clipping/fitting/flattening.3.8229moutput pixel spacing oversamples coarser urban composite DEM, possibly roofs/vegetation; exact base/core/leg foot/plaza/host contact unverified. Geographic preview, replaceFootprint=false.',
  ],
};
