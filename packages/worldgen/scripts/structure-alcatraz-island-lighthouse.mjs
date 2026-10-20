/** Alcatraz1909 tower: square base, recessed octagonal shaft and cylindrical helical lantern. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff';
const concrete = rgb('b8b7ad'),
  inset = rgb('aaa99f'),
  trim = rgb('bdbcb1'),
  stain = rgb('9a9a90'),
  iron = rgb('343c3b'),
  frame = rgb('626761'),
  glass = rgb('71817b'),
  dark = rgb('424b46'),
  roof = rgb('b0b4aa');
const Y = 0.55,
  baseHalf = 2.0955,
  shaftBottom = Y + 6.6,
  shaftTop = Y + 22,
  watchTop = Y + 24.5;
const shaftR = (y) => 1.91 - ((y - shaftBottom) * 0.4) / (shaftTop - shaftBottom);
const openings = [
  { stage: 'base', angle: Math.PI / 2, y0: Y + 3.1, y1: Y + 5.05, width: 0.72, kind: 'sash' },
  { stage: 'base', angle: Math.PI / 2, y0: Y + 5.68, y1: Y + 6.18, width: 0.79, kind: 'sash' },
  {
    stage: 'base',
    angle: -Math.PI / 2,
    y0: Y + 3.55,
    y1: Y + 4.9,
    width: 0.65,
    kind: 'estimated-sash',
  },
  { stage: 'base', angle: Math.PI, y0: Y + 0.45, y1: Y + 2.89, width: 0.61, kind: 'door' },
  {
    stage: 'base',
    angle: 0,
    y0: Y + 0.1,
    y1: Y + 2.54,
    width: 0.61,
    kind: 'estimated-closed-door',
  },
  ...[0, 1, 2, 3].map((i) => ({
    stage: 'shaft',
    angle: (i * Math.PI) / 2,
    y0: Y + [17.8, 15.5, 9.8, 12.4][i],
    y1: Y + [18.8, 16.75, 10.85, 13.55][i],
    width: 0.47,
    kind: i < 2 ? 'sash' : 'estimated-sash',
  })),
  ...[0, 1, 2, 3].map((i) => ({
    stage: 'watch',
    angle: (i * Math.PI) / 2,
    y0: Y + 22.55,
    y1: Y + 24.02,
    width: 0.67,
    kind: 'sash',
  })),
];
function facade(out, angle, r) {
  const n = [Math.sin(angle), Math.cos(angle)],
    t = [Math.cos(angle), -Math.sin(angle)];
  const point = (u, y, depth = 0) => [
    n[0] * (r(y) + depth) + t[0] * u,
    y,
    n[1] * (r(y) + depth) + t[1] * u,
  ];
  const panel = (u0, u1, y0, y1, depth, color, slot = 'wall') => {
    if (y1 - y0 < 1e-7 || u1 - u0 < 1e-7) return;
    const p = [
      point(u0, y0, depth),
      point(u1, y0, depth),
      point(u1, y1, depth),
      point(u0, y1, depth),
    ];
    quad(out, slot, p, normalFor(...p), color);
  };
  const tapered = (half0, half1, y0, y1, depth, color) => {
    const p = [
      point(-half0, y0, depth),
      point(half0, y0, depth),
      point(half1, y1, depth),
      point(-half1, y1, depth),
    ];
    quad(out, 'wall', p, normalFor(...p), color);
  };
  return { point, panel, tapered, n, t };
}
function window(out, f, h, d, frontDepth = -0.04) {
  const depth = 0.25,
    w = h.width / 2,
    p = f.point;
  // Wall is physically absent in front of the sash, with four concrete reveal surfaces.
  for (const [a, b] of [
    [
      [-w, h.y0],
      [w, h.y0],
    ],
    [
      [w, h.y0],
      [w, h.y1],
    ],
    [
      [w, h.y1],
      [-w, h.y1],
    ],
    [
      [-w, h.y1],
      [-w, h.y0],
    ],
  ]) {
    const q = [
      p(a[0], a[1], frontDepth),
      p(b[0], b[1], frontDepth),
      p(b[0], b[1], -depth),
      p(a[0], a[1], -depth),
    ];
    quad(out, 'wall', q, normalFor(...q), inset);
  }
  const isDoor = h.kind.includes('door');
  f.panel(-w, w, h.y0, h.y1, -depth, isDoor ? dark : glass, isDoor ? 'iron' : 'glass');
  if (d === 0) return;
  const bar = (a, b, wid = 0.035, col = frame) =>
    beam(out, 'iron', p(...a, -depth + 0.025), p(...b, -depth + 0.025), wid, 0.045, col);
  for (const x of [-w + 0.025, w - 0.025]) bar([x, h.y0], [x, h.y1], 0.055);
  for (const y of [h.y0 + 0.025, h.y1 - 0.025]) bar([-w, y], [w, y], 0.055);
  if (isDoor) {
    if (d > 1) for (const y of [h.y0 + 0.4, h.y1 - 0.3]) bar([-w, y], [w, y], 0.025);
  } else {
    bar([0, h.y0], [0, h.y1], 0.035);
    const rows = d === 1 ? 2 : d === 2 ? 4 : 6;
    for (let i = 1; i < rows; i++)
      bar([-w, h.y0 + ((h.y1 - h.y0) * i) / rows], [w, h.y0 + ((h.y1 - h.y0) * i) / rows], 0.025);
  }
}
function wall(out, d, stage, angle, y0, y1, r, half) {
  const f = facade(out, angle, r),
    holes = openings.filter(
      (h) =>
        h.stage === stage &&
        Math.abs(Math.atan2(Math.sin(h.angle - angle), Math.cos(h.angle - angle))) < 1e-6,
    );
  const panelDepth = d === 0 ? 0 : -0.035,
    rim = d === 0 ? 0 : stage === 'base' ? 0.18 : 0.135;
  const cuts = [
    y0,
    y1,
    ...holes.flatMap((h) => [h.y0, h.y1]),
    ...(rim ? [y0 + 0.24, y1 - 0.22] : []),
  ].sort((a, b) => a - b);
  for (let j = 0; j < cuts.length - 1; j++) {
    const lo = cuts[j],
      hi = cuts[j + 1];
    if (hi - lo < 1e-7) continue;
    const mid = (lo + hi) / 2,
      h = holes.find((h) => mid > h.y0 && mid < h.y1),
      inner = mid > y0 + 0.24 && mid < y1 - 0.22;
    const hw0 = half(lo),
      hw1 = half(hi),
      ph0 = hw0 - rim,
      ph1 = hw1 - rim;
    if (!inner || !rim) {
      if (!h) f.tapered(hw0, hw1, lo, hi, 0, concrete);
      else {
        f.panel(-hw0, -h.width / 2, lo, hi, 0, concrete);
        f.panel(h.width / 2, hw0, lo, hi, 0, concrete);
      }
    } else {
      const left = [f.point(-hw0, lo), f.point(-ph0, lo), f.point(-ph1, hi), f.point(-hw1, hi)],
        right = [f.point(ph0, lo), f.point(hw0, lo), f.point(hw1, hi), f.point(ph1, hi)];
      quad(out, 'wall', left, normalFor(...left), concrete);
      quad(out, 'wall', right, normalFor(...right), concrete);
      if (!h) f.tapered(ph0, ph1, lo, hi, panelDepth, inset);
      else {
        for (const sign of [-1, 1]) {
          const p = [
            f.point(sign < 0 ? -ph0 : h.width / 2, lo, panelDepth),
            f.point(sign < 0 ? -h.width / 2 : ph0, lo, panelDepth),
            f.point(sign < 0 ? -h.width / 2 : ph1, hi, panelDepth),
            f.point(sign < 0 ? -ph1 : h.width / 2, hi, panelDepth),
          ];
          quad(out, 'wall', p, normalFor(...p), inset);
        }
      }
      if (d > 0) {
        for (const sign of [-1, 1]) {
          const q = [
            f.point(sign * ph0, lo),
            f.point(sign * ph0, lo, panelDepth),
            f.point(sign * ph1, hi, panelDepth),
            f.point(sign * ph1, hi),
          ];
          const face = sign > 0 ? [...q].reverse() : q;
          quad(out, 'wall', face, normalFor(...face), stain);
        }
      }
    }
  }
  if (d > 0)
    for (const y of [y0 + 0.24, y1 - 0.22]) {
      const h = half(y) - rim,
        p = [f.point(-h, y), f.point(h, y), f.point(h, y, panelDepth), f.point(-h, y, panelDepth)];
      if (panelDepth) {
        const face = y > (y0 + y1) / 2 ? [...p].reverse() : p;
        quad(out, 'wall', face, normalFor(...face), stain);
      }
    }
  for (const h of holes) window(out, f, h, d, d ? panelDepth : 0);
}
function octagon(out, profile, color = trim, slot = 'wall') {
  loft(
    out,
    slot,
    profile.map(([y, a]) =>
      radialRing(y, a / Math.cos(Math.PI / 8), a / Math.cos(Math.PI / 8), 8, [0, 0], Math.PI / 8),
    ),
    color,
  );
}
function rail(out, d) {
  const rr = 1.95,
    y0 = watchTop + 0.12,
    y1 = watchTop + 1.03;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4,
      b = a + Math.PI / 4,
      pa = [Math.sin(a) * rr, y0, Math.cos(a) * rr],
      pb = [Math.sin(b) * rr, y0, Math.cos(b) * rr];
    beam(out, 'iron', pa, [pa[0], y1, pa[2]], 0.045, 0.045, iron);
    for (const dy of d === 0 ? [0.85] : [0.12, 0.48, 0.88])
      beam(out, 'iron', [pa[0], y0 + dy, pa[2]], [pb[0], y0 + dy, pb[2]], 0.035, 0.035, iron);
  }
}
function lantern(out, d) {
  const n = d === 0 ? 8 : d === 1 ? 24 : d === 2 ? 40 : 64,
    glass0 = Y + 25.1,
    glass1 = Y + 26.0017,
    r = 1.161034;
  octagon(out, [
    [watchTop - 0.15, 1.79],
    [watchTop, 1.97],
    [watchTop + 0.13, 1.97],
  ]);
  loft(out, 'roof', [radialRing(watchTop + 0.13, r, r, n), radialRing(glass0, r, r, n)], roof);
  loft(out, 'glass', [radialRing(glass0, r, r, n), radialRing(glass1, r, r, n)], glass, {
    cap: false,
  });
  for (const y of [glass0, glass1])
    loft(
      out,
      'iron',
      [
        radialRing(y - 0.035, r + 0.035, r + 0.035, n),
        radialRing(y + 0.035, r + 0.035, r + 0.035, n),
      ],
      iron,
    );
  if (d > 0) {
    const count = d === 1 ? 8 : 12,
      segments = d === 1 ? 2 : d === 2 ? 4 : 6;
    for (let i = 0; i < count; i++)
      for (const sign of [-1, 1])
        for (let j = 0; j < segments; j++) {
          const point = (t) => {
            const a = (i * Math.PI * 2) / count + (sign * t * Math.PI * 2) / count;
            return [
              (r + 0.016) * Math.sin(a),
              glass0 + (glass1 - glass0) * t,
              (r + 0.016) * Math.cos(a),
            ];
          };
          beam(out, 'iron', point(j / segments), point((j + 1) / segments), 0.025, 0.025, iron);
        }
  }
  // Shallow conical iron roof; contemporary beacon sits above the former ventilator.
  loft(
    out,
    'roof',
    [
      radialRing(glass1, 1.29, 1.29, n),
      radialRing(Y + 26.09, 1.35, 1.35, n),
      radialRing(Y + 26.65, 0.31, 0.31, n),
      radialRing(Y + 26.78, 0.23, 0.23, n),
    ],
    roof,
  );
  loft(
    out,
    'iron',
    [radialRing(Y + 26.76, 0.17, 0.17, n), radialRing(Y + 27.04, 0.17, 0.17, n)],
    iron,
  );
  loft(
    out,
    'glass',
    [
      radialRing(Y + 27.03, 0.19, 0.19, n),
      radialRing(Y + 27.33, 0.18, 0.18, n),
      radialRing(Y + 27.48915, 0.06, 0.06, n),
    ],
    rgb('c4c9ba'),
  );
  if (d > 0) {
    // Restricted upper service ladder/cage only; no full-height imaginary external ladder.
    const angle = -Math.PI / 2,
      f = facade(out, angle, () => 1.82),
      point = f.point;
    for (const x of [-0.28, 0.28])
      beam(out, 'iron', point(x, Y + 23.5), point(x, Y + 26.68), 0.045, 0.045, iron);
    const steps = d === 1 ? 7 : 13;
    for (let j = 0; j <= steps; j++) {
      const y = Y + 23.5 + (3.18 * j) / steps;
      beam(out, 'iron', point(-0.28, y), point(0.28, y), 0.025, 0.035, iron);
    }
    for (const y of [Y + 24.75, Y + 25.5, Y + 26.25]) {
      const segments = d === 1 ? 5 : 10;
      for (let j = 0; j < segments; j++) {
        const p = (t) => point(0.4 * Math.cos(t), y, 0.39 * Math.sin(t));
        beam(
          out,
          'iron',
          p((j * Math.PI) / segments),
          p(((j + 1) * Math.PI) / segments),
          0.025,
          0.025,
          iron,
        );
      }
    }
    for (const t of [0, Math.PI / 2, Math.PI])
      beam(
        out,
        'iron',
        point(0.4 * Math.cos(t), Y + 24.75, 0.39 * Math.sin(t)),
        point(0.4 * Math.cos(t), Y + 26.65, 0.39 * Math.sin(t)),
        0.025,
        0.025,
        iron,
      );
  }
}
export function alcatrazIslandLighthouse(out, _frame, d = 3) {
  B(out, 'wall', 0, -1.5, 0, 4.4, 2.12, 4.4, inset);
  for (let i = 0; i < 4; i++)
    wall(
      out,
      d,
      'base',
      (i * Math.PI) / 2,
      Y,
      shaftBottom,
      () => baseHalf,
      () => baseHalf,
    );
  // The own three entry treads face the prison approach; no surrounding plaza/podium.
  for (let i = 0; i < 3; i++)
    B(
      out,
      'wall',
      0,
      0.04 + i * 0.16,
      -2.17 - (3 - i) * 0.16,
      1.16,
      0.2 + i * 0.16,
      (3 - i) * 0.32,
      concrete,
    );
  for (const [y, w, h] of [
    [Y + 5.2, 4.23, 0.07],
    [shaftBottom - 0.16, 4.36, 0.16],
    [shaftBottom, 4.42, 0.12],
  ])
    B(out, 'wall', 0, y, 0, w, h, w, trim);
  for (let i = 0; i < 8; i++)
    wall(
      out,
      d,
      'shaft',
      (i * Math.PI) / 4,
      shaftBottom + 0.12,
      shaftTop,
      shaftR,
      (y) => shaftR(y) * Math.tan(Math.PI / 8),
    );
  octagon(out, [
    [shaftTop - 0.12, 1.53],
    [shaftTop + 0.02, 1.7],
    [shaftTop + 0.16, 1.7],
    [shaftTop + 0.23, 1.62],
  ]);
  for (let i = 0; i < 8; i++)
    wall(
      out,
      d,
      'watch',
      (i * Math.PI) / 4,
      shaftTop + 0.23,
      watchTop - 0.12,
      () => 1.62,
      () => 1.62 * Math.tan(Math.PI / 8),
    );
  if (d > 0)
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4,
        f = facade(out, a, () => 1.72);
      beam(
        out,
        'wall',
        f.point(0, watchTop - 0.72),
        f.point(0, watchTop - 0.06, 0.18),
        0.13,
        0.2,
        trim,
      );
    }
  rail(out, d);
  lantern(out, d);
  if (d > 1) {
    // Subtle broken stains on recess borders; no masonry grid or painted shadows.
    for (let i = 0; i < 8; i++) {
      const f = facade(out, (i * Math.PI) / 4, shaftR);
      for (let j = 0; j < (d === 2 ? 3 : 7); j++) {
        const y = shaftBottom + 0.4 + j * 1.73,
          hw = shaftR(y) * Math.tan(Math.PI / 8),
          u = (i % 2 ? -0.8 : 0.8) * hw;
        f.panel(u - 0.02, u + 0.02, y, y + 0.32 + (j % 3) * 0.18, 0.006, stain);
      }
    }
  }
}
export function alcatrazIslandLighthouseSkyline(out) {
  alcatrazIslandLighthouse(out, undefined, 0);
}
export function alcatrazIslandLighthouseDistrict(out) {
  alcatrazIslandLighthouse(out, undefined, 1);
}
export function alcatrazIslandLighthouseStreet(out) {
  alcatrazIslandLighthouse(out, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.15 },
  iron: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.15 },
  glass: { slot: 'window', localRef: ref, roughness: 0.34, metallic: 0.08 },
};
export const alcatrazIslandLighthouseModel = {
  id: 'alcatraz_island_lighthouse',
  key: 'alcatraz_island_lighthouse',
  recipe: 'structure-alcatraz-island-lighthouse.mjs',
  cell: '9q/9q8',
  title: 'Alcatraz Island Lighthouse',
  brief:
    '1909 natural-gray concrete lighthouse with tall square sash/door base, tapering octagonal long recessed-panel shaft, small gridded windows, octagonal watchroom with alternating sash/blind panels, corbelled gallery and open triple iron rail, cylindrical helical-glazed lantern, shallow conical roof/current beacon and short caged service ladder. Narrow own footing and three entrance treads only; separate prison/cistern and ruined residences excluded.',
  camera: [18, 19, -26],
  lookAt: [0, 14, 0],
  qaCameras: [
    { name: 'whole-tower', position: [18, 16, -30], lookAt: [0, 14, 0] },
    { name: 'square-base-and-door', position: [9, 5, -12], lookAt: [0, 3.7, 0] },
    { name: 'shaft-recess-and-sash', position: [9, 18, 9], lookAt: [0, 16.4, 0] },
    { name: 'watchroom-and-lantern', position: [7, 27, 9], lookAt: [0, 25, 0] },
    { name: 'gallery-and-ladder', position: [-8, 28, -7], lookAt: [0, 25.2, 0] },
  ],
  mediumFiContext: { scale: 0.8 },
  build: alcatrazIslandLighthouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Own native tower centroid/frame; original USGS2023 one-metre raster independently resampled before geometry at6.955m external dry footway reference41.1495m. Original heights unchanged. Narrow4.4m square foundation below the actual4.191m wall width; no terrace, island ground or separate structure reconstructed. Physical foundation/terrain contact and current geographic review required.',
  groundCutout: {
    basis:
      'Own4.4m square physical lighthouse footing enclosing the retained native octagon; wall width4.191m follows historic dimension/photos. No adjacent plaza/ruin/terrain removed. Original USGS heights unchanged.',
    outline: [
      [-2.2, -2.2],
      [-2.2, 2.2],
      [2.2, 2.2],
      [2.2, -2.2],
    ],
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-alcatraz-island-lighthouse.mjs',
    level: 'skyline',
    export: 'alcatrazIslandLighthouseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'alcatrazIslandLighthouseDistrict', errorMeters: 0.08, surfaces },
      street: { export: 'alcatrazIslandLighthouseStreet', errorMeters: 0.035, surfaces },
    },
  },
  limitations: [
    'Historic1910 inventory controls4.191m square base,3.2512m parapet width,2.322068m circular lantern glass diameter and.9017m glazed height. Full current base-to-beacon envelope approximately27.49m follows historic90ft2.25in ventilator height and dated photos. USCG84ft/NPS95ft disagree; endpoints/epochs unresolved. This is an approximate photographic exterior, not a measured current survey.',
    'Five actual full local originals/40 thumbnails inspected. Sparse unseen rear shaft/base openings and door bearing are conservative interpretations. Eleven historic varied windows/two doors do not establish their exact present positions. Fine concrete damage and ironwork are generalized; no original photo pixels used as textures.',
    'Independent original USGS ground remains unchanged. One-metre source/sampling cannot certify hidden foundations or current paving classification. Default coarse Earth terrain compatibility and whole-island scenery are not certified. Separate prison, residences/ruins, cistern, fences and lamps excluded.',
  ],
};
