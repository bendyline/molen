/** Biloxi's surviving cast-iron tower, from local public-domain Coast Guard photographs/drawing. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const white = rgb('c8c8bd'),
  edge = rgb('b8b9ad'),
  dark = rgb('343e3e'),
  glass = rgb('617776');
const surfaces = {
  iron: { slot: 'wall', graph: 'metal_painted', roughness: 0.85, metallic: 0.12 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.18 },
  base: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.33, metallic: 0.08 },
};
const radius = (y) => 2.08 - (y - 0.2) * 0.068;
function tower(out, _frame, d = 3) {
  const n = [12, 24, 40, 64][d];
  loft(out, 'base', [radialRing(-0.15, 2.25, 2.25, n), radialRing(0.18, 2.25, 2.25, n)], edge);
  loft(out, 'iron', [radialRing(0.18, 2.18, 2.18, n), radialRing(0.36, 2.08, 2.08, n)], white);
  // Real recessed opening in the front cylinder, rather than a dark rectangle on a solid wall.
  const holes = [
    { y0: 0.36, y1: 2.8, half: d < 2 ? 1 : 2 },
    { y0: 11.1, y1: 12.35, half: 1 },
  ];
  const bands = [...new Set([0.36, 2.8, 5.1, 7.7, 10.3, 11.1, 12.35, 13.8, 14.1])].sort(
    (a, b) => a - b,
  );
  for (let j = 0; j < bands.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const y0 = bands[j],
        y1 = bands[j + 1],
        a = ((i - n / 2) * Math.PI * 2) / n,
        b = a + (Math.PI * 2) / n;
      const front = Math.abs((a + b) / 2) < (d < 2 ? (Math.PI * 2) / n : (Math.PI * 4) / n);
      const hole = holes.find(
        (h) =>
          y0 >= h.y0 - 1e-6 &&
          y1 <= h.y1 + 1e-6 &&
          front &&
          Math.abs((a + b) / 2) < (h.half * Math.PI * 2) / n,
      );
      const p = (angle, y, depth = 0) => [
        (radius(y) + depth) * Math.sin(angle),
        y,
        (radius(y) + depth) * Math.cos(angle),
      ];
      const panel = [p(a, y0), p(b, y0), p(b, y1), p(a, y1)];
      if (!hole) quad(out, 'iron', panel, normalFor(...panel), white);
      else {
        const inset = panel.map((p, k) => [
          (radius(p[1]) - 0.2) * Math.sin(k === 0 || k === 3 ? a : b),
          p[1],
          (radius(p[1]) - 0.2) * Math.cos(k === 0 || k === 3 ? a : b),
        ]);
        quad(
          out,
          hole === holes[0] ? 'trim' : 'glass',
          inset,
          normalFor(...inset),
          hole === holes[0] ? dark : glass,
        );
        for (let k = 0; k < 4; k++) {
          const q = [panel[k], inset[k], inset[(k + 1) % 4], panel[(k + 1) % 4]];
          quad(out, 'trim', q, normalFor(...q), edge);
        }
      }
    }
  if (d > 0)
    for (const y of [2.8, 5.1, 7.7, 10.3, 13.8])
      loft(
        out,
        'iron',
        [
          radialRing(y - 0.025, radius(y) + 0.025, radius(y) + 0.025, n),
          radialRing(y + 0.025, radius(y) + 0.025, radius(y) + 0.025, n),
        ],
        edge,
      );
  if (d > 1) {
    B(out, 'trim', 0, 0.5, 1.925, 0.045, 2.1, 0.045, edge);
    B(out, 'trim', 0, 11.72, radius(11.72) - 0.15, 0.48, 0.035, 0.04, edge);
  }
  loft(
    out,
    'iron',
    [
      radialRing(13.85, 1.22, 1.22, n),
      radialRing(14.15, 1.86, 1.86, n),
      radialRing(14.3, 1.86, 1.86, n),
    ],
    white,
  );
  if (d > 0)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        out,
        'trim',
        [1.19 * Math.sin(a), 13.3, 1.19 * Math.cos(a)],
        [1.8 * Math.sin(a), 14.15, 1.8 * Math.cos(a)],
        0.09,
        0.11,
        edge,
      );
    }
  const railN = [8, 16, 32, 48][d];
  for (let i = 0; i < railN; i++) {
    const a = (i * Math.PI * 2) / railN,
      b = ((i + 1) * Math.PI * 2) / railN;
    beam(
      out,
      'trim',
      [1.78 * Math.sin(a), 14.28, 1.78 * Math.cos(a)],
      [1.78 * Math.sin(a), 15.27, 1.78 * Math.cos(a)],
      d < 2 ? 0.045 : 0.035,
      0.035,
      dark,
    );
    for (const y of d === 0 ? [15.27] : [14.4, 15.27])
      beam(
        out,
        'trim',
        [1.78 * Math.sin(a), y, 1.78 * Math.cos(a)],
        [1.78 * Math.sin(b), y, 1.78 * Math.cos(b)],
        0.045,
        0.045,
        dark,
      );
  }
  loft(out, 'iron', [radialRing(14.28, 1.13, 1.13, 12), radialRing(14.9, 1.13, 1.13, 12)], white);
  loft(out, 'glass', [radialRing(14.9, 1.12, 1.12, 12), radialRing(17.1, 1.12, 1.12, 12)], glass);
  for (let i = 0; i < (d === 0 ? 6 : 12); i++) {
    const a = (i * Math.PI * 2) / (d === 0 ? 6 : 12);
    beam(
      out,
      'trim',
      [1.135 * Math.sin(a), 14.85, 1.135 * Math.cos(a)],
      [1.135 * Math.sin(a), 17.18, 1.135 * Math.cos(a)],
      0.055,
      0.055,
      white,
    );
  }
  for (const y of d === 0 ? [14.9, 17.1] : [14.9, 16, 17.1])
    loft(
      out,
      'trim',
      [radialRing(y - 0.03, 1.16, 1.16, 12), radialRing(y + 0.03, 1.16, 1.16, 12)],
      white,
    );
  // Shallow rounded cap and ventilator/finial, preserved at each useful distance.
  const roofProfile =
    d < 2
      ? [
          [17.12, 1.29],
          [17.35, 1.28],
          [18.05, 0.64],
          [18.22, 0.2],
        ]
      : [
          [17.12, 1.29],
          [17.32, 1.29],
          [17.58, 1.19],
          [17.86, 0.94],
          [18.08, 0.57],
          [18.22, 0.2],
        ];
  loft(
    out,
    'iron',
    roofProfile.map(([y, r]) => radialRing(y, r, r, n)),
    white,
  );
  loft(
    out,
    'trim',
    [
      [18.2, 0.18],
      [18.55, 0.14],
      [18.65, 0.18],
      [18.72, 0.05],
      [19.5, 0.018],
    ].map(([y, r]) => radialRing(y, r, r, d < 2 ? 6 : 10)),
    dark,
  );
  if (d > 0) {
    B(out, 'trim', 0, 19.14, 0, 0.9, 0.045, 0.035, dark);
    beam(out, 'trim', [-0.45, 19.14, 0], [-0.23, 19.25, 0], 0.035, 0.035, dark);
    beam(out, 'trim', [-0.45, 19.14, 0], [-0.23, 19.03, 0], 0.035, 0.035, dark);
  }
}
export const biloxiLighthouseSkyline = (out, frame) => tower(out, frame, 0);
export const biloxiLighthouseDistrict = (out, frame) => tower(out, frame, 1);
export const biloxiLighthouseStreet = (out, frame) => tower(out, frame, 2);
export const biloxiLighthouseModel = {
  id: 'biloxi_lighthouse',
  key: 'biloxi_lighthouse',
  recipe: 'structure-biloxi-lighthouse.mjs',
  cell: 'dj/dj2',
  title: 'Biloxi Lighthouse',
  category: 'lighthouse',
  build: tower,
  surfaces,
  brief:
    'Surviving white tapered cast-iron lighthouse with horizontal panel seams, recessed base door and narrow upper light, flared projecting catwalk, black open iron rails/brackets, twelve-sided glazed lantern, pale rounded metal roof, ventilator and weathervane. Tower and own footing only; demolished keeper house, median roads, site fencing, visitors center and temporary maintenance works excluded.',
  camera: [25, 16, 31],
  lookAt: [0, 9.5, 0],
  qaCameras: [
    { name: 'door-and-iron-seams', position: [6, 5, 11], lookAt: [0, 5, 0] },
    { name: 'gallery-and-lantern', position: [7, 17, 9], lookAt: [0, 16.4, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Native named tower polygon fixes centroid; unmodified viewer Terrarium ground uses dry median reference3.5m east of shaft. Geographic preview and approximate footing, not a surveyed contact.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-biloxi-lighthouse.mjs',
    level: 'skyline',
    export: 'biloxiLighthouseSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'biloxiLighthouseDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'biloxiLighthouseStreet', errorMeters: 0.06, surfaces },
    },
  },
  limitations: [
    'Approximate19.5m overall height and photographic proportions; source heights vary with measurement convention. USCG historic tower photos/drawing control surviving iron silhouette, not every restored fitting. Hidden openings, pane count, doorway facing and weathervane are medium-fi interpretations.',
    'Native quantized footprint supplies location, not a survey. Coastal host terrain is approximate; no terrain fitting or neighborhood reconstruction. Demolished keeper house, roads, fence and temporary restoration works excluded.',
    'Original geometry; public-domain Coast Guard references remain in Qualla and are not used as textures.',
  ],
};
