/** Summit keep ensemble of Matsuyama Castle in Ehime, January 2009. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  S = plan.section,
  grid = read('terrain-grid');
const named = Object.fromEntries(read('map-frame').features.map((f) => [f.role, f.points]));
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  timber: { slot: 'wall', graph: 'wood_shou_sugi_ban', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92, metallic: 0 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    plaster: 'ded8c1',
    rim: 'ece4cb',
    shadowWhite: 'c3baa2',
    wood: '46423a',
    outerTimber: '5a5043',
    window: '282c29',
    slate: '5c6468',
    edge: '4a5357',
    tileHighlight: '777e7c',
    stone: 'ac9c84',
    mortar: '857963',
    lightStone: 'b8ac92',
    darkStone: '9a8d76',
    court: 'bdb29a',
  }).map(([key, col]) => [key, rgb(col)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, k) => mix(v, b[k], t));
const at = ([x, z], y) => [x, y, z];
const up = [0, 1, 0];
function ds(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function clockwise(ring) {
  const a = ring.reduce((v, p, i) => {
    const b = ring[(i + 1) % ring.length];
    return v + p[0] * b[1] - p[1] * b[0];
  }, 0);
  return a > 0 ? ring : ring.toReversed();
}
const outAt = (a, b) => [(b[1] - a[1]) / ds(a, b), 0, (a[0] - b[0]) / ds(a, b)];
function draw(out, slot, p, dir, color) {
  const normal = normalFor(...p);
  if (!normal.some(Boolean)) return;
  const set = normal.reduce((v, n, k) => v + n * dir[k], 0) > 0 ? p : p.toReversed();
  (p.length === 3 ? triangle : face)(out, slot, set, color);
}
function fill(out, slot, points, transform, dir, color) {
  const tris = earcut(points.flat());
  for (let i = 0; i < tris.length; i += 3)
    draw(
      out,
      slot,
      tris.slice(i, i + 3).map((j) => transform(...points[j])),
      dir,
      color,
    );
}
function ground([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = grid.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function rect([x, z], w, d) {
  return [
    [x - w, z - d],
    [x + w, z - d],
    [x + w, z + d],
    [x - w, z + d],
  ];
}
const center = (ring) =>
  [0, 1].map((k) => (Math.min(...ring.map((p) => p[k])) + Math.max(...ring.map((p) => p[k]))) / 2);
function footprint(ring) {
  const c = center(ring);
  return [c, ...[0, 1].map((k) => Math.max(...ring.map((p) => Math.abs(p[k] - c[k]))))];
}
function platform(out, outline, top, lod, deckColor = tone.court) {
  const r = clockwise(outline),
    c = center(r),
    toe = r.map(([x, z]) => {
      const d = Math.hypot(x - c[0], z - c[1]),
        ext = Math.max(1, Math.min(2.5, (top - ground([x, z])) * 0.42));
      return [x + ((x - c[0]) * ext) / d, z + ((z - c[1]) * ext) / d];
    });
  fill(out, 'granite', r, (x, z) => [x, top, z], up, deckColor);
  for (let j = 0; j < r.length; j++) {
    const k = (j + 1) % r.length,
      a = r[j],
      b = r[k],
      u = toe[j],
      v = toe[k],
      n = outAt(a, b);
    const floors = [ground(u) - 0.26, ground(v) - 0.26];
    const p = (s, h) => {
      const pos = lerp(lerp(u, v, s), lerp(a, b, s), Math.pow(h, 0.82));
      return [pos[0], mix(mix(...floors, s), top, h), pos[1]];
    };
    if (lod < 2) {
      draw(out, 'granite', [p(0, 0), p(1, 0), p(1, 1), p(0, 1)], n, tone.stone);
      continue;
    }
    const length = ds(a, b),
      rows = lod === 3 ? 6 : 4;
    const columns = Math.max(1, Math.ceil(length / (lod === 3 ? 2.1 : 3.4)));
    const strip = (h0, h1, tint) =>
      draw(out, 'granite', [p(0, h0), p(1, h0), p(1, h1), p(0, h1)], n, tint);
    for (let row = 0; row < rows; row++) {
      const lower = row / rows,
        upper = (row + 1) / rows;
      const mortarHeight = Math.min(0.032 / Math.max(1, top - Math.min(...floors)), 0.031 / rows);
      strip(lower, lower + mortarHeight, tone.mortar);
      const breaks = [0];
      for (let column = 1; column <= columns; column++) {
        const t = (column - (row % 2 ? 0.42 : 0)) / columns;
        if (t < 0.994) breaks.push(t);
      }
      breaks.push(1);
      const joint = Math.min(0.045 / length, 0.09 / columns);
      const panel = (left, right, color) =>
        draw(
          out,
          'granite',
          [
            p(left, lower + mortarHeight),
            p(right, lower + mortarHeight),
            p(right, upper),
            p(left, upper),
          ],
          n,
          color,
        );
      for (let i = 1; i < breaks.length; i++) {
        const left = breaks[i - 1],
          right = breaks[i];
        if (i !== 1) panel(left - joint / 2, left + joint / 2, tone.mortar);
        panel(
          left + (i === 1 ? 0 : joint / 2),
          right - (i === breaks.length - 1 ? 0 : joint / 2),
          [tone.stone, tone.lightStone, tone.darkStone, tone.stone][(j * 13 + row * 7 + i) % 4],
        );
      }
    }
  }
}
function wall(out, ring, base, roofY, woodFraction, windowCount, lod, black = false) {
  const r = clockwise(ring);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = ds(a, b),
      n = outAt(a, b),
      frac = black ? 1 : woodFraction;
    const p = (t, y, d = 0) => {
      const q = lerp(a, b, t);
      return [q[0] + n[0] * d, y, q[1] + n[2] * d];
    };
    const pane = (slot, l, r, b, h, d, t) =>
      draw(out, slot, [p(l, b, d), p(r, b, d), p(r, h, d), p(l, h, d)], n, t);
    const middle = mix(base, roofY, frac);
    if (middle > base + 0.01) pane('timber', 0, 1, base, middle, 0, tone.wood);
    if (middle < roofY - 0.01) pane('plaster', 0, 1, middle, roofY, 0, tone.plaster);
    if (!windowCount || len < 2.25 || (lod === 0 && len < 4.2)) continue;
    const count = Math.min(windowCount, Math.max(1, Math.floor(len / (lod === 0 ? 6.2 : 2.08))));
    const wb = mix(base, roofY, black ? 0.48 : 0.55),
      wt = mix(base, roofY, 0.81);
    for (let j = 0; j < count; j++) {
      const c = (j + 1) / (count + 1),
        w = Math.min(0.54 / len, 0.27 / (count + 1));
      if (lod > 0)
        pane(
          'timber',
          c - w - 0.045 / len,
          c + w + 0.045 / len,
          wb - 0.1,
          wt + 0.07,
          0.027,
          tone.outerTimber,
        );
      pane('dark', c - w, c + w, wb, wt, 0.039, tone.window);
      if (lod >= 2)
        for (const d of [-1, 0, 1]) {
          const v = c + w * d * 0.49,
            k = 0.025 / len;
          pane('timber', v - k, v + k, wb, wt, 0.052, tone.outerTimber);
        }
      if (lod >= 3)
        pane(
          'timber',
          c - w,
          c + w,
          mix(wb, wt, 0.55),
          mix(wb, wt, 0.55) + 0.045,
          0.053,
          tone.outerTimber,
        );
    }
    if (lod >= 2 && middle > base + 0.4) {
      const count = Math.floor(len / (lod === 2 ? 1.2 : 0.58));
      for (let j = 1; j < count; j++) {
        const t = j / count,
          w = 0.025 / len;
        const y = black ? wb - 0.15 : middle - 0.09;
        if (y > base + 0.25) pane('timber', t - w, t + w, base + 0.13, y, 0.031, tone.outerTimber);
      }
    }
  }
}
function roof(out, c, wx, dz, eave, rise, lod, ridgeEast = false, gable = true) {
  const levels = lod === 0 ? [0, 1] : lod === 1 ? [0, 0.42, 1] : [0, 0.21, 0.52, 0.78, 1];
  const ring = (t) => {
    const w = mix(wx, ridgeEast ? wx * 0.63 : 0.084, t),
      d = mix(dz, ridgeEast ? 0.084 : dz * 0.63, t);
    return rect(c, w, d).map(([x, z]) => [
      x,
      eave + rise * Math.pow(t, 1.39) + (lod > 0 ? 0.36 * Math.pow(1 - t, 3) : 0.18 * (1 - t)),
      z,
    ]);
  };
  const rings = levels.map(ring);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i],
      b = rings[i + 1];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      draw(out, 'roof', [a[j], a[k], b[k], b[j]], up, j % 2 ? tone.slate : tone.tileHighlight);
    }
  }
  const lip = rings[0],
    inner = rect(c, Math.max(wx - 0.68, wx * 0.62), Math.max(dz - 0.68, dz * 0.62));
  for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4,
      n = outAt([lip[j][0], lip[j][2]], [lip[k][0], lip[k][2]]);
    const shift = (p, y) => [p[0], p[1] + y, p[2]];
    draw(out, 'roof', [shift(lip[j], -0.2), shift(lip[k], -0.2), lip[k], lip[j]], n, tone.edge);
    draw(
      out,
      'plaster',
      [
        shift(lip[j], -0.2),
        shift(lip[k], -0.2),
        at(inner[k], eave - 0.33),
        at(inner[j], eave - 0.33),
      ],
      [0, -1, 0],
      tone.rim,
    );
  }
  const r = rings.at(-1);
  draw(out, 'roof', r, up, tone.edge);
  if (lod >= 1) {
    const p = (x, z, h) => [c[0] + x, eave + rise + h, c[1] + z];
    const a = ridgeEast ? p(-wx * 0.67, 0, 0.11) : p(0, -dz * 0.67, 0.11);
    const b = ridgeEast ? p(wx * 0.67, 0, 0.11) : p(0, dz * 0.67, 0.11);
    const q = ridgeEast ? [0, 0, 0.175] : [0.175, 0, 0];
    const s = (v, f, h = 0) => v.map((k, i) => k + q[i] * f + (i === 1 ? h : 0));
    draw(out, 'roof', [s(a, -1), s(b, -1), s(b, 0, 0.21), s(a, 0, 0.21)], up, tone.edge);
    draw(out, 'roof', [s(a, 0, 0.21), s(b, 0, 0.21), s(b, 1), s(a, 1)], up, tone.slate);
    for (const [x, z] of ridgeEast
      ? [
          [-wx * 0.65, 0],
          [wx * 0.65, 0],
        ]
      : [
          [0, -dz * 0.65],
          [0, dz * 0.65],
        ]) {
      for (const sign of [-1, 1])
        draw(
          out,
          'roof',
          [p(x - 0.23, z + sign * 0.19, 0.1), p(x + 0.23, z + sign * 0.19, 0.1), p(x, z, 0.65)],
          sign > 0 ? [0, 0, 1] : [0, 0, -1],
          tone.edge,
        );
    }
  }
  if (!gable) return;
  // Wide plaster gables with curled tile verge on the outward face.
  const sides = ridgeEast ? [-1, 1] : [1, -1];
  for (const side of sides) {
    const r = rise * 0.91,
      w = (ridgeEast ? dz : wx) * 0.71;
    const n = ridgeEast ? [side, 0, 0] : [0, 0, side];
    const p = (u, y, depth = 0) =>
      ridgeEast
        ? [c[0] + side * (wx * 0.81 - depth), y, c[1] + u]
        : [c[0] + u, y, c[1] + side * (dz * 0.81 - depth)];
    const stepN = lod >= 2 ? 8 : 2,
      ys = eave + 0.01;
    const curve = Array.from({ length: stepN + 1 }, (_, j) => {
      const u = mix(-1, 1, j / stepN);
      return [u * w, ys + r * Math.pow(1 - Math.abs(u), 1.23) + 0.26 * u * u];
    });
    fill(out, 'plaster', [[-w, ys], ...curve, [w, ys]], p, n, tone.plaster);
    for (let j = 0; j < curve.length - 1; j++) {
      const a = curve[j],
        b = curve[j + 1],
        x = j < stepN / 2 ? -0.12 : 0.12;
      draw(
        out,
        'roof',
        [
          p(a[0] + x, a[1] + 0.07, -0.24),
          p(b[0] + x, b[1] + 0.07, -0.24),
          p(...b, 1.25),
          p(...a, 1.25),
        ],
        up,
        tone.edge,
      );
    }
  }
}
function keep(out, ring, base, stories, lod, options = {}) {
  let h = base;
  const [c, w, d] = footprint(ring),
    { ridgeEast = false, black = false } = options;
  for (let level = 0; level < stories.length; level++) {
    const [storey, scaleW, scaleD, rise, windows] = stories[level],
      roofY = h + storey;
    const [wx, dz] = [w * scaleW, d * scaleD],
      topTier = level === stories.length - 1;
    const floor = level === 0 ? ring : rect(c, wx, dz);
    wall(out, floor, h, roofY + 0.06, level === 0 ? 0.62 : 0.37, windows, lod, black);
    roof(
      out,
      c,
      wx + 0.68,
      dz + 0.69,
      roofY,
      rise,
      lod,
      ridgeEast,
      topTier || (options.lowerGable && level === 0),
    );
    h = roofY + Math.min(0.7, rise * 0.4);
  }
}
const connectorStreets = [
  {
    ring: [
      [-30, -8],
      [-25, -8],
      [-24, 12],
      [-29, 12],
    ],
    ridgeEast: false,
  },
  {
    ring: [
      [-22, -17],
      [-4, -17],
      [-4, -12],
      [-22, -12],
    ],
    ridgeEast: true,
  },
  {
    ring: [
      [-2, 5],
      [8, 5],
      [8, 12],
      [-2, 12],
    ],
    ridgeEast: false,
  },
];
function build(out, lod) {
  const base = S.mainPlatformTop;
  platform(out, S.foundationTop, base, lod);
  platform(out, rect([28.3, -18], 4.1, 4.1), S.tenjinPlatformTop, lod, tone.stone);
  const [one, two, three] = S.mainStoreyHeights;
  keep(
    out,
    named['main-keep'],
    base,
    [
      [one, 1, 1, 2.25, 4],
      [two, 0.73, 0.76, 2.08, 3],
      [three, 0.51, 0.54, 2.05, 2],
    ],
    lod,
    { lowerGable: true },
  );
  keep(
    out,
    named['small-keep'],
    base,
    [
      [3.42, 1, 1, 1.68, 4],
      [2.92, 0.72, 0.84, 1.83, 3],
    ],
    lod,
    { ridgeEast: true, lowerGable: true },
  );
  keep(
    out,
    named['north-corner-turret'],
    base,
    [
      [3.02, 1, 1, 1.51, 3],
      [2.24, 0.76, 0.75, 1.48, 2],
    ],
    lod,
  );
  keep(out, named['south-corner-turret'], base, [[3.48, 1, 1, 1.8, 2]], lod, { black: true });
  keep(out, named['tammon-gallery'], base, [[2.58, 1, 1, 1.15, 3]], lod, {
    ridgeEast: true,
    black: true,
  });
  keep(out, named['tenjin-turret'], S.tenjinPlatformTop, [[3.35, 1, 1, 1.62, 2]], lod, {
    ridgeEast: true,
  });
  for (const { ring, ridgeEast } of connectorStreets)
    keep(out, ring, base, [[2.52, 1, 1, 1.02, 2]], lod, { ridgeEast, black: true });
}
export const castleSkyline = (out) => build(out, 0);
export const castleDistrict = (out) => build(out, 1);
export const castleStreet = (out) => build(out, 2);
export const castleCloseup = (out) => build(out, 3);
const recipe = 'matsuyama-castle-iyo-model.mjs',
  camera = [54, 33, 91],
  lookAt = [-3, 7, -1];
export const castleModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  category: 'landmark',
  quality: 'medium-fi-exterior',
  build: castleCloseup,
  surfaces,
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Matsuyama Castle in Ehime, including its tiered main and small keeps, adjoining turrets and wooden galleries over a battered stone platform.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-17, 28, 31],
  portableGroundY: -6,
  mediumFiContext: {
    scale: 0.91,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: S.foundationTop,
    minimumCoverage: 0.86,
    basis: 'Reconstructed stone platform containing mapped upper keep buildings.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'wood_shou_sugi_ban', 'tile_ceramic', 'stone_granite'],
  qaCameras: [
    { name: 'bailey-stone-wall-and-keeps', position: [38, 9, 53], lookAt: [-5, 7, -1] },
    { name: 'linked-keeps-and-courtyard', position: [-15, 36, 26], lookAt: [-7, 7, -3] },
    { name: 'roof-tiers-and-tenjin-turret', position: [56, 24, -46], lookAt: [9, 8, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `upper-castle-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'castleSkyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'castleDistrict', 0.34],
        ['street', 'castleStreet', 0.17],
        ['closeup', 'castleCloseup', 0.064],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped footprints are ODbL. The two referenced photographs are own work released into the public domain by Urashimataro.',
};
