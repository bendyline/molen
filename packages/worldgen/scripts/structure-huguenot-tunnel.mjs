/** Operating eastern Huguenot portal and its native attached N1 approach bridge. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/k6/k6j/huguenot_tunnel/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  L = plan.bridgeLength;
const colors = {
  stone: rgb('938e79'),
  roof: rgb('807f6c'),
  concrete: rgb('b1b3a4'),
  metal: rgb('9fb9b1'),
  dark: rgb('2b3634'),
  road: rgb('5e6660'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.18 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  road: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
};
const B = (o, s, x0, y0, z0, x1, y1, z1, c = colors[s]) => box(o, s, [x0, y0, z0], [x1, y1, z1], c);
function tri(o, s, ps, target) {
  if (normalFor(...ps).reduce((v, n, i) => v + n * target[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  o.addTriangle(
    s,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[1]]),
    colors[s],
  );
}
function prism(o, ring, front, back, s = 'stone') {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3)
    for (const [z, n] of [
      [front, 1],
      [back, -1],
    ])
      tri(
        o,
        s,
        ix.slice(i, i + 3).map((j) => [...ring[j], z]),
        [0, 0, n],
      );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      ps = [
        [...a, front],
        [...a, back],
        [...b, back],
        [...b, front],
      ];
    quad(o, s, ps, normalFor(...ps), colors[s]);
  }
}
function wedge(o, x0, x1, z0, z1, frontH, backH) {
  B(o, 'stone', x0, -0.35, z0, x1, frontH, z1);
  const back = [
    [x0, frontH, z0],
    [x1, frontH, z0],
    [x1, backH, z0],
    [x0, backH, z0],
  ];
  quad(o, 'stone', back, [0, 0, -1], colors.stone);
  for (const [x, n] of [
    [x0, -1],
    [x1, 1],
  ])
    tri(
      o,
      'stone',
      [
        [x, frontH, z1],
        [x, frontH, z0],
        [x, backH, z0],
      ],
      [n, 0, 0],
    );
  const ps = [
    [x0, frontH + 0.05, z1],
    [x1, frontH + 0.05, z1],
    [x1, backH + 0.05, z0],
    [x0, backH + 0.05, z0],
  ];
  quad(o, 'roof', ps, normalFor(...ps), colors.roof);
}
const tileColors = ['a49b80', '8a9290', '9e9c8d', 'b3a584', '7f8275', '8f8978', 'a6aaa0'].map(rgb);
function cladding(o, x0, x1, y0, y1, z, d) {
  if (d < 2) return;
  const h = d === 2 ? 0.52 : 0.32,
    w = d === 2 ? 0.88 : 0.6;
  let row = 0;
  for (let y = y0; y < y1 - 0.02; y += h, row++) {
    for (let x = x0 - ((row % 2) * w) / 2; x < x1; x += w) {
      const left = Math.max(x0, x) + 0.015,
        right = Math.min(x1, x + w) - 0.015;
      if (right - left < 0.02) continue;
      const top = Math.min(y + h - 0.016, y1),
        ps = [
          [left, y, z],
          [right, y, z],
          [right, top, z],
          [left, top, z],
        ];
      let hash = Math.imul(row + 1, 374761393) ^ Math.imul(Math.round((x - x0) / w) + 2, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      const k = ((hash ^ (hash >>> 16)) >>> 0) % tileColors.length;
      quad(o, 'stone', ps, [0, 0, 1], tileColors[k]);
    }
  }
}
const glyphs = {
  H: ['101', '101', '111', '101', '101'],
  U: ['101', '101', '101', '101', '111'],
  G: ['111', '100', '101', '101', '111'],
  E: ['111', '100', '110', '100', '111'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  O: ['111', '101', '101', '101', '111'],
  T: ['111', '010', '010', '010', '010'],
  L: ['100', '100', '100', '100', '111'],
  '-': ['000', '000', '111', '000', '000'],
};
function inscription(o) {
  const text = 'HUGENOTE-TONNEL',
    u = 0.068,
    width = [...text].reduce((n, c) => n + glyphs[c][0].length + 1, 0) * u;
  let cursor = -width / 2;
  for (const ch of text) {
    const g = glyphs[ch];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < g[r].length; c++)
        if (g[r][c] === '1')
          B(
            o,
            'dark',
            cursor + c * u,
            6.83 + (4 - r) * u,
            0.635,
            cursor + (c + 0.78) * u,
            6.83 + (4.83 - r) * u,
            0.66,
          );
    cursor += (g[0].length + 1) * u;
  }
}
function portal(o, d) {
  wedge(o, -16.5, -5.9, -13, 0, 8.65, 12.5);
  wedge(o, 5.9, 16, -12.5, 0, 8.65, 11.4);
  // The road mouth is genuinely absent from the facade, with a short dark-lined recess.
  B(o, 'stone', -5.9, 6.1, -13, 5.9, 8.65, 0);
  B(o, 'dark', -5.9, 0, -17, -5.74, 6.1, 0);
  B(o, 'dark', 5.74, 0, -17, 5.9, 6.1, 0);
  B(o, 'dark', -5.74, 5.95, -17, 5.74, 6.1, 0);
  B(o, 'road', -5.75, -0.13, -17, 5.75, 0.015, 0);
  B(o, 'dark', -5.75, 0, -17, 5.75, 6.1, -16.93);
  // Stepped high stone cheek beside the pale vertical ventilation fins.
  prism(
    o,
    [
      [-4.25, 8.6],
      [-0.8, 8.6],
      [-0.8, 16.7],
      [-3.5, 16.7],
      [-4.25, 13.9],
    ],
    -2.8,
    -10.5,
  );
  B(o, 'dark', -0.8, 8.65, -4.1, 4.8, 13.5, -3.86);
  B(o, 'stone', -0.95, 13.45, -4.15, 4.95, 13.85, -2.75);
  B(o, 'metal', -0.85, 8.62, -2.97, 4.91, 8.83, -2.68);
  const fins = d === 0 ? 5 : 8;
  for (let i = 0; i < fins; i++) {
    const x = -0.63 + i * (5.2 / (fins - 1));
    B(o, 'metal', x - 0.075, 8.7, -3.85, x + 0.075, 13.48, -2.65);
    if (d > 1) beam(o, 'metal', [x, 13.47, -2.65], [x, 13.64, -3.7], 0.13, 0.12, colors.metal);
  }
  B(o, 'metal', -6.05, 6.1, -0.1, 6.05, 8.0, 0.6);
  if (d > 0) {
    for (let x = -5.8; x < 6; x += 0.48) B(o, 'metal', x, 6.14, 0.605, x + 0.035, 7.94, 0.65);
    for (const [x, w] of [
      [-8.4, 1.4],
      [8.1, 1.65],
      [11.4, 2.15],
    ]) {
      B(o, 'concrete', x - w / 2 - 0.13, -0.08, 0.02, x + w / 2 + 0.13, 2.95, 0.13);
      B(o, 'metal', x - w / 2, 0, 0.135, x + w / 2, 2.8, 0.17);
      if (d > 1) {
        B(o, 'dark', x + 0.25, 1.15, 0.18, x + 0.3, 1.33, 0.21);
        B(o, 'metal', x - 0.02, 0.05, 0.175, x + 0.02, 2.75, 0.2);
      }
    }
    B(o, 'metal', -16.6, 8.65, -0.15, -5.95, 8.77, 0.15);
    B(o, 'metal', 6, 8.65, -0.15, 16.1, 8.77, 0.15);
  }
  cladding(o, -16.5, -5.9, 3.1, 8.62, 0.015, d);
  cladding(o, 5.9, 16, 3.1, 8.62, 0.015, d);
  cladding(o, -16.5, -9.3, 0, 3.1, 0.015, d);
  cladding(o, -7.5, -5.9, 0, 3.1, 0.015, d);
  cladding(o, -3.48, -0.84, 8.67, 16.68, -2.785, d);
  cladding(o, -4.2, -3.5, 8.67, 13.85, -2.785, d);
  if (d > 1) inscription(o);
}
function bridge(o, d) {
  B(o, 'concrete', -6.15, -1.05, 0, 6.15, -0.08, L);
  B(o, 'road', -5.6, -0.08, 0, 5.6, 0.015, L);
  for (const s of [-1, 1]) {
    const x = s * 5.95;
    B(o, 'concrete', x - 0.2, 0, 0, x + 0.2, 0.45, L);
    B(o, 'concrete', x - 0.24, 1.05, 0, x + 0.24, 1.31, L);
    if (d === 0) B(o, 'concrete', x - 0.12, 0.45, 0, x + 0.12, 1.05, L);
    else
      for (let z = 0; z < L; z += 3.1)
        B(o, 'concrete', x - 0.17, 0.45, z, x + 0.17, 1.05, Math.min(z + 0.44, L));
  }
  // Paired battered supports are intrinsic to this short portal bridge; their feet are estimates.
  for (const z of [L * 0.19, L * 0.66]) {
    B(o, 'concrete', -5.4, -2.1, z - 0.8, 5.4, -1.05, z + 0.8);
    for (const s of [-1, 1])
      beam(o, 'concrete', [s * 1.25, -11.5, z - 4.5], [s * 3.8, -2, z], 1.35, 1.5, colors.concrete);
  }
  B(o, 'concrete', -6.3, -5.3, L - 1, 6.3, -0.1, L);
  if (d > 0) {
    for (const x of [-5.1, 5.1]) B(o, 'metal', x - 0.035, 0.025, 0, x + 0.035, 0.04, L);
    for (let z = 3; z < L - 2; z += 6) B(o, 'metal', -0.055, 0.025, z, 0.055, 0.04, z + 2.5);
  }
}
function build(o, _f, d = 3) {
  portal(o, d);
  bridge(o, d);
}
export const huguenotSkyline = (o, f) => build(o, f, 0);
export const huguenotDistrict = (o, f) => build(o, f, 1);
export const huguenotStreet = (o, f) => build(o, f, 2);
export const huguenotTunnelModel = {
  id: 'huguenot_tunnel',
  key: 'huguenot_tunnel',
  recipe: 'structure-huguenot-tunnel.mjs',
  cell: 'k6/k6j',
  title: 'Huguenot Tunnel — eastern portal',
  category: 'transport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Photo-guided operating eastern portal: asymmetric multicolor small-stone wings with sloping roofs, stepped high ventilation cheek and pale vertical fins, genuinely open rectangular road mouth with oxidized metal fascia/raised HUGENOTE-TONNEL lettering, small service doors and native65.98mconcrete approach bridge with slit parapets and angled supports. Native operating tunnel endpoint/bearing distinguish the separate unused NorthBore. Underground bore/mountain and other end excluded.',
  camera: [51, 28, 79],
  lookAt: [0, 4, 19],
  portableGroundY: -12.5,
  mediumFiContext: { scale: 2, groundY: -12.5 },
  qaCameras: [
    { name: 'stone-portal-and-ventilation-fins', position: [22, 14, 34], lookAt: [0, 8, -2] },
    { name: 'open-mouth-and-raised-fascia', position: [9, 6, 18], lookAt: [0, 5, -1] },
    { name: 'slit-parapets-and-angled-supports', position: [31, 2, 46], lookAt: [0, -3, 29] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed eastern native bridge abutment defines approximate deckY0 before terrain acquisition.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-huguenot-tunnel.mjs',
    level: 'skyline',
    export: 'huguenotSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'huguenotDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'huguenotStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Exact full3648x2736ZaianCC0Quallaoriginal controls the operating northeastern/eastern portal, not the separate unfinished NorthBore. Complete wing envelope, roughly32.5mwide facade/16.7mhigh ventilation cheek,11.5mroad mouth, roof pitch, fins and concealed rear/side sections are photographic medium-fi estimates; no measured architectural survey is claimed.',
    'The original native attached bridge centerline fixes65.984mspan/axis.12.3mdeck width, slab/parapet sections and two pairs of battered supports are photographic interpretations; exact support count/positions/feet and rock attachment remain approximate. Thin facade cladding colors are original deterministic geometry over shared ashlar, not sampled photo texture.',
    'Eastern portal/approach exterior only. Rectangular road mouth is physically open to a short17mdark-lined visual recess with closed far end; no traversable3.9kminterior, western portal, unused NorthBore, mountain mesh, tunnel-terrain cutting, toll plaza, vehicles, signs/cameras or detached roadside buildings. Existing surface terrain is preserved, so host-specific tunnel-mouth cutting is separate from this preview.',
    'A fixed eastern approach abutment defines approximate deckY0 before elevation sampling. Precise road gradient and underdeck support/ground contact remain host-dependent and unverified; no whole-mountain flattening/platform. Fine cladding patches, fascia lettering/seams, doors and open parapet slits simplify with distance.',
  ],
};
