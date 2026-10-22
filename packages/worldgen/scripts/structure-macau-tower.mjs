/** Macau Tower: native axis/projected pod, published principal levels, original exterior geometry. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/we/web/macau_tower/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  colors = {
    concrete: rgb('c7c5b8'),
    joint: rgb('a7a89f'),
    steel: rgb('b7bdba'),
    glass: rgb('527c89'),
    dark: rgb('414e53'),
    red: rgb('a45c52'),
  };
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  joint: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.28 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.28, metallic: 0.12 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.85, metallic: 0.12 },
  red: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.28 },
};
function tri(o, s, ps, target) {
  const p = ps.map((p) => p.map(Math.fround)),
    n = normalFor(...p);
  if (Math.hypot(...n) < 0.5) return;
  if (target && n.reduce((a, v, i) => a + v * target[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[1]]),
    colors[s],
  );
}
function Q(o, s, p, target) {
  tri(o, s, [p[0], p[1], p[2]], target);
  tri(o, s, [p[0], p[2], p[3]], target);
}
function cap(o, s, rings, y, up = true) {
  const p = rings.flat(),
    starts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((a, r) => a + r.length, 0)),
    ix = earcut(p.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function circle(r, n, c = [0, 0]) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-i / n) * Math.PI * 2;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
}
function shell(o, s, a, b, y0, y1) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      center = [(a[i][0] + a[j][0]) / 2, 0, (a[i][1] + a[j][1]) / 2];
    Q(
      o,
      s,
      [
        [...a[i].slice(0, 1), y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ],
      center,
    );
  }
}
function prism(o, s, p, y0, y1) {
  shell(o, s, p, p, y0, y1);
  cap(o, s, [p], y0, false);
  cap(o, s, [p], y1);
}
function round(o, s, profile, n, c = [0, 0], caps = true) {
  for (let j = 1; j < profile.length; j++)
    shell(
      o,
      s,
      circle(profile[j - 1][1], n, c),
      circle(profile[j][1], n, c),
      profile[j - 1][0],
      profile[j][0],
    );
  if (caps) {
    cap(o, s, [circle(profile[0][1], n, c)], profile[0][0], false);
    cap(o, s, [circle(profile.at(-1)[1], n, c)], profile.at(-1)[0]);
  }
}
function annulus(o, s, r0, r1, y, h, n) {
  const outer = circle(r1, n),
    inner = circle(r0, n);
  shell(o, s, outer, outer, y, y + h);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [
        [inner[i][0], y, inner[i][1]],
        [inner[i][0], y + h, inner[i][1]],
        [inner[j][0], y + h, inner[j][1]],
        [inner[j][0], y, inner[j][1]],
      ],
      [-inner[i][0], 0, -inner[i][1]],
    );
  }
  cap(o, s, [outer, inner], y, false);
  cap(o, s, [outer, inner], y + h);
}
const center = (points) =>
  points.reduce((a, p) => a.map((v, i) => v + p[i] / points.length), [0, 0]);
function radial(a, r, y) {
  return [r * Math.cos(a), y, r * Math.sin(a)];
}
function B(o, s, a, b, w, h = w) {
  beam(o, s, a, b, w, h, colors[s]);
}
function shaft(o, d, n) {
  round(
    o,
    'concrete',
    [
      [-0.4, 8],
      [74, 7.7],
      [160, 7.25],
      [205, 7],
    ],
    n,
  );
  for (const leg of plan.baseLegs) {
    const c = center(leg.outline),
      a = Math.atan2(c[1], c[0]);
    prism(o, 'concrete', leg.outline, -0.4, 0.45);
    B(
      o,
      'concrete',
      radial(a, Math.hypot(...c), 0.1),
      radial(a, 7.6, 74),
      d === 0 ? 1.6 : 1.25,
      2.1,
    );
  }
  // A narrow service/elevator strip remains an opaque blue-gray recess, with no interior.
  const a = -0.38,
    w = d < 2 ? 0.115 : 0.09;
  for (const [y0, y1] of [
    [0.4, 74],
    [74, 160],
    [160, 205],
  ]) {
    const r0 = 8 - y0 / 205,
      r1 = 8 - y1 / 205;
    Q(
      o,
      'glass',
      [
        radial(a - w, r0 + 0.055, y0),
        radial(a + w, r0 + 0.055, y0),
        radial(a + w, r1 + 0.055, y1),
        radial(a - w, r1 + 0.055, y1),
      ],
      [Math.cos(a), 0, Math.sin(a)],
    );
  }
  if (d > 1) {
    for (let y = 4; y < 203; y += d === 3 ? 3.8 : 15.2) {
      const r = 8 - y / 205;
      round(
        o,
        'joint',
        [
          [y, r + 0.012],
          [y + 0.045, r + 0.012],
        ],
        n,
        [0, 0],
        false,
      );
    }
    if (d === 3)
      for (let y = 12; y < 193; y += 22)
        for (let j = 0; j < 12; j++) {
          const a = (j / 12) * Math.PI * 2,
            r = 8 - y / 205 + 0.02,
            c = radial(a, r, y);
          const t = [-Math.sin(a), 0, Math.cos(a)],
            v = [0, 0.07, 0];
          Q(
            o,
            'joint',
            [
              c.map((x, i) => x - t[i] * 0.09 - v[i]),
              c.map((x, i) => x + t[i] * 0.09 - v[i]),
              c.map((x, i) => x + t[i] * 0.09 + v[i]),
              c.map((x, i) => x - t[i] * 0.09 + v[i]),
            ],
            [Math.cos(a), 0, Math.sin(a)],
          );
        }
  }
}
function pod(o, d, n) {
  const underside =
    d === 0
      ? [
          [205, 7],
          [221.5, 19.8],
        ]
      : [
          [205, 7],
          [207, 9],
          [208.2, 9.3],
          [208.3, 10.4],
          [211.5, 11.3],
          [212, 12.6],
          [215.7, 13.3],
          [216.2, 15.5],
          [219.5, 16.7],
          [221.5, 19.8],
        ];
  round(o, 'steel', underside, n);
  round(
    o,
    'glass',
    [
      [221.5, 19.8],
      [227.4, 20.9],
      [232.4, 21.8],
    ],
    n,
  );
  for (const [y, r, h] of [
    [221.3, 19.9, 0.3],
    [227.3, 20.95, 0.32],
    [232.2, 21.85, 0.35],
  ]) {
    if (d === 0 && y < 232) continue;
    round(
      o,
      'steel',
      [
        [y, r],
        [y + h, r + 0.03],
      ],
      n,
    );
  }
  for (let j = 0; j < 8; j++) {
    const a = (j * Math.PI) / 4 + 0.12;
    B(o, 'steel', radial(a, 7.4, 195.5), radial(a, 19.6, 221.6), d === 0 ? 0.9 : 0.82, 1.2);
    if (d > 0)
      for (let k = 0; k < 4; k++) {
        const y = 207 + k * 3.5,
          r = 9.2 + k * 2.5;
        B(o, 'steel', radial(a, 7.2, y), radial(a, r, y), 0.27, 0.4);
      }
  }
  const outer =
      d === 3 ? plan.native.find((p) => p.id === 'way/848199020').outline : circle(22.5, n),
    inner = circle(20.7, outer.length);
  shell(o, 'steel', outer, outer, 232.65, 233);
  cap(o, 'steel', [outer, inner], 233);
  cap(o, 'steel', [outer, inner], 232.65, false);
  annulus(o, 'steel', 21.8, 22.5, 236.9, 0.55, n);
  // The outer roof rim is open between its supports above the SkyWalk floor.
  const count = [8, 20, 40, 80][d];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    if (d) B(o, 'steel', radial(a, 21.85, 232.8), radial(a, 22.15, 237.1), 0.18, 0.22);
    if (d > 1) {
      B(o, 'steel', radial(a, 22.3, 233), radial(a, 22.3, 234.1), 0.055, 0.055);
      const b = ((i + 1) / count) * Math.PI * 2;
      B(o, 'steel', radial(a, 22.3, 234.1), radial(b, 22.3, 234.1), 0.065, 0.065);
    }
  }
  round(
    o,
    'steel',
    [
      [237.35, 22.5],
      [242.2, 10],
      [244.5, 7],
      [248, 4.5],
    ],
    n,
  );
  if (d > 0) {
    const windows = [0, 20, 40, 80][d];
    for (let i = 0; i < windows; i++) {
      const a = (i / windows) * Math.PI * 2;
      B(o, 'steel', radial(a, 19.84, 221.5), radial(a, 21.84, 232.4), d === 1 ? 0.18 : 0.1, 0.11);
    }
    if (d === 3)
      for (let j = 0; j < 40; j++) {
        const a = (j / 40) * Math.PI * 2;
        B(o, 'joint', radial(a, 10.6, 208.3), radial(a, 19.7, 221.2), 0.045, 0.05);
        B(o, 'steel', radial(a, 22.3, 237.2), radial(a, 7.0, 244.5), 0.08, 0.1);
      }
  }
  const platform = plan.native.find((p) => p.id === 'way/848284268').outline;
  prism(o, 'steel', platform, 232.65, 233);
  const pc = center(platform);
  if (d) {
    for (let i = 0; i < platform.length; i++) {
      const p = platform[i],
        q = platform[(i + 1) % platform.length];
      B(o, 'steel', [p[0], 233, p[1]], [p[0], 234.2, p[1]], 0.07, 0.07);
      B(o, 'steel', [p[0], 234.2, p[1]], [q[0], 234.2, q[1]], 0.07, 0.07);
    }
    B(o, 'steel', [pc[0] * 0.88, 234, pc[1] * 0.88], [pc[0], 238, pc[1]], 0.16, 0.18);
    B(o, 'steel', [pc[0], 238, pc[1]], [pc[0] * 1.08, 238, pc[1] * 1.08], 0.18, 0.18);
  }
}
function mast(o, d, n) {
  const count = Math.min(n, [12, 16, 24, 32][d]);
  round(
    o,
    'steel',
    [
      [248, 4.5],
      [254, 4.1],
      [270, 3.2],
      [280, 2.8],
      [300, 2.0],
      [318, 1.0],
      [338, 0.2],
    ],
    count,
  );
  if (d > 0) {
    for (const [y, r] of [
      [270, 3.3],
      [280, 2.9],
      [300, 2.1],
      [318, 1.1],
    ]) {
      round(
        o,
        'steel',
        [
          [y - 0.28, r + 0.55],
          [y, r + 0.55],
        ],
        count,
      );
      if (d > 1) {
        annulus(o, 'steel', r + 0.3, r + 0.4, y, 0.8, count);
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * Math.PI * 2;
          B(o, 'steel', radial(a, r + 0.38, y), radial(a, r + 0.38, y + 0.9), 0.04, 0.04);
        }
      }
    }
    round(
      o,
      'red',
      [
        [289, 2.51],
        [291, 2.44],
      ],
      count,
    );
    round(
      o,
      'red',
      [
        [320, 0.94],
        [323, 0.8],
      ],
      count,
    );
  }
  if (d > 1) {
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2;
      B(o, 'steel', radial(a, 4.55, 249), radial(a, 3.25, 270), 0.16, 0.16);
      for (let y = 250; y < 269; y += d === 3 ? 2 : 4)
        B(
          o,
          'steel',
          radial(a, 4.5 - (y - 249) * 0.062, y),
          radial(a + Math.PI / 2, 4.5 - (y - 249) * 0.062, y + 1.7),
          0.08,
          0.08,
        );
    }
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      round(
        o,
        'steel',
        [
          [276, 0.15],
          [282, 0.15],
        ],
        6,
        [4 * Math.cos(a), 4 * Math.sin(a)],
      );
      B(o, 'steel', radial(a, 2.9, 277), radial(a, 4, 277), 0.08, 0.08);
    }
    // Representative fixed ladder and safety hoop, not every individual antenna attachment.
    for (let y = 251; y < 298; y += d === 3 ? 1 : 4) {
      const r = 4.4 - (y - 251) * 0.045;
      B(o, 'dark', [-0.3, y, -r], [0.3, y, -r], 0.05, 0.05);
    }
    B(o, 'steel', [-0.35, 250, -4.6], [-0.35, 300, -2.3], 0.055, 0.055);
    B(o, 'steel', [0.35, 250, -4.6], [0.35, 300, -2.3], 0.055, 0.055);
  }
}
function build(o, _f, d = 3) {
  const n = [12, 24, 48, 96][d];
  shaft(o, d, n);
  pod(o, d, n);
  mast(o, d, n);
}
export const macauSkyline = (o, f) => build(o, f, 0);
export const macauDistrict = (o, f) => build(o, f, 1);
export const macauStreet = (o, f) => build(o, f, 2);
export const macauTowerModel = {
  id: 'macau_tower',
  key: 'macau_tower',
  recipe: 'structure-macau-tower.mjs',
  cell: 'we/web',
  title: 'Macau Tower',
  category: 'observation-tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    '338mMacau Tower exterior: tapered16→14mconcrete shaft, eight native-positioned raking base legs and service strip, stepped silver underside/radial pod braces, blue observation/restaurant glazing with160representative panes, open SkyWalk/rim and native projecting bungy platform, conical silver crown and stepped90mcommunication mast. Native overhead pod polygons are preserved as overhead shapes; no whole plaza or related convention buildings.',
  camera: [370, 230, 430],
  lookAt: [0, 168, 0],
  portableGroundY: -0.22,
  mediumFiContext: { scale: 5 },
  qaCameras: [
    {
      name: 'stepped-observation-pod-eight-braces-and-open-skywalk',
      position: [51, 223, 58],
      lookAt: [0, 221, 0],
    },
    { name: 'base-raking-legs-and-service-strip', position: [77, 45, 88], lookAt: [0, 38, 0] },
    {
      name: 'crown-stepped-mast-and-climb-fixtures',
      position: [90, 310, 100],
      lookAt: [0, 293, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: plan.geometryBasis,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-macau-tower.mjs',
    level: 'skyline',
    export: 'macauSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'macauDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'macauStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Published Qualla edited2003pod photograph is bound to original photographer and editor native firstPD-selfreleases; exact supplemental2007PD-selfand2026CC0originals establish full shaft/pod/mast silhouette. No other-licensed images, photo textures, visitor likenesses, logos, signs, artworks or underlying unrelated hotel/pool construction reproduced.',
    'Primary public operator/federation levels control height:338mtip,223mobservation,228mrestaurant,233moutdoor,90mmast and16/14mshaft diameters. Pod profiles/crown transitions, eight upper braces, shaft strip phase, window/panel repeat, raking-leg sections and tiny antenna attachments are medium-fi estimates. Near160representative panes simplify at distance; nativeoverhead pod/SkyWalk and bungy outlines are not extruded as ground parcels.',
    'Native relation21176879fixes identity/axis and original projected pod rings. Eight base-leg placements use quantized native basemap part outlines with74mheight; actual footing/steel sections/connection details approximate. Related Convention and Entertainment Centre, whole plaza/roads/water/landscaping, temporary attractions and interior room/exhibition geometry are outside this tower-only scope.',
    'Fixed dry southern approach[0,26]/Y0 precedes terrain acquisition. Raw source terrain retained without flattening/fitting; isolated review groundY-.22does not certify exact host contact, threshold levels or foundation depth. No full-site slab, artificial reclamation terrain or foundation lifted to match vegetation/building returns.',
  ],
};
