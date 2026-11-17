/** The lattice Eiffel Tower replica at the municipal park in Paris, Tennessee. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  S = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.1 },
  brick: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  paver: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    frame: '626e64',
    dark: '505b55',
    edge: '69766d',
    red: '865b4a',
    paver: 'b0a590',
    fence: '3c4640',
  }).map(([key, v]) => [key, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t,
  up = [0, 1, 0];
const c = Math.cos(S.axisAngle),
  s = Math.sin(S.axisAngle);
const at = (x, y, z) => [x * c - z * s, y, x * s + z * c];
const signs = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const square = (y, r) => signs.map(([a, b]) => at(a * r, y, b * r));
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
function surface(out, slot, p, n, color) {
  const w = normalFor(...p);
  (p.length === 3 ? triangle : face)(
    out,
    slot,
    w.reduce((sum, v, i) => sum + v * n[i], 0) > 0 ? p : p.toReversed(),
    color,
  );
}
function ringDeck(out, y, h, r) {
  loft(
    out,
    'steel',
    [
      square(y, r - 0.13).toReversed(),
      square(y + 0.12, r).toReversed(),
      square(y + h, r).toReversed(),
    ],
    tone.frame,
  );
  for (let j = 0; j < 4; j++) {
    const a = square(y + h, r + 0.05)[j],
      b = square(y + h, r + 0.05)[(j + 1) % 4];
    beam(out, 'steel', a, b, 0.095, 0.08, tone.dark);
  }
}
function base(out, lod) {
  const center = [0, S.platform, 0];
  const winding = Math.sign(
    outline.reduce((sum, [x, z], i) => {
      const [u, v] = outline[(i + 1) % outline.length];
      return sum + x * v - z * u;
    }, 0),
  );
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const nx = b[1] - a[1],
      nz = a[0] - b[0],
      l = Math.hypot(nx, nz);
    const n = [(winding * nx) / l, 0, (winding * nz) / l];
    surface(
      out,
      'brick',
      [
        [a[0], -0.36, a[1]],
        [b[0], -0.36, b[1]],
        [b[0], S.platform, b[1]],
        [a[0], S.platform, a[1]],
      ],
      n,
      tone.red,
    );
    surface(
      out,
      'paver',
      [[a[0], S.platform, a[1]], [b[0], S.platform, b[1]], center],
      up,
      tone.paver,
    );
  }
  if (lod >= 1) {
    const n = lod === 1 ? 21 : lod === 2 ? 43 : 65;
    const fenceRing = (y) => radialRing(y, 6.83, 6.83, n);
    const below = fenceRing(S.platform),
      high = fenceRing(S.platform + 1.12);
    for (let i = 0; i < n; i++) {
      if (i === 2 || i === 3) continue;
      if (lod >= 2)
        beam(
          out,
          'steel',
          below[i],
          high[i],
          i % 6 === 0 ? 0.065 : 0.033,
          i % 6 === 0 ? 0.065 : 0.033,
          tone.fence,
        );
      beam(out, 'steel', high[i], high[(i + 1) % n], 0.045, 0.045, tone.fence);
    }
  }
}
const lowerRadius = (t) => mix(4.55, 2.89, Math.pow(t, 0.77));
function strut(out, lod, a, b, width, depth, color) {
  if (lod > 0) {
    beam(out, 'steel', a, b, width, depth, color);
    return;
  }
  const unit = b.map((v, i) => v - a[i]);
  const cross = [-unit[2], 0, unit[0]],
    side = Math.hypot(...cross);
  const offset = side > 0.001 ? cross.map((v) => (v * width) / side) : [width, 0, 0];
  const shift = (p, sign) => p.map((v, i) => v + sign * offset[i]);
  const normal = normalFor(shift(a, -1), shift(a, 1), shift(b, 1));
  surface(out, 'steel', [shift(a, -1), shift(a, 1), shift(b, 1), shift(b, -1)], normal, color);
  surface(
    out,
    'steel',
    [shift(a, -1), shift(a, 1), shift(b, 1), shift(b, -1)],
    normal.map((v) => -v),
    color,
  );
}
function legs(out, lod) {
  const n = lod === 0 ? 3 : lod === 1 ? 4 : lod === 2 ? 7 : 8;
  const tSet = Array.from({ length: n + 1 }, (_, i) => i / n);
  for (const [sx, sz] of signs) {
    const points = (t) => {
      const p = lowerRadius(t),
        d = mix(0.68, 0.43, t),
        y = mix(S.platform, S.legTop, t);
      return [
        [p - d, p - d],
        [p + d, p - d],
        [p + d, p + d],
        [p - d, p + d],
      ].map(([x, z]) => at(sx * x, y, sz * z));
    };
    for (let k = 0; k < n; k++) {
      const a = points(tSet[k]),
        b = points(tSet[k + 1]);
      for (let j = 0; j < 4; j++) {
        const l = (j + 1) % 4;
        strut(out, lod, a[j], b[j], lod === 0 ? 0.091 : 0.086, 0.085, tone.frame);
        if (lod > 0 || j % 2 === 0) {
          strut(out, lod, a[j], b[l], 0.054, 0.051, tone.dark);
          if (lod >= 2) strut(out, lod, a[l], b[j], 0.044, 0.042, tone.edge);
        }
        if (lod >= 2 || k === n - 1) strut(out, lod, b[j], b[l], 0.046, 0.049, tone.frame);
      }
    }
  }
  const spans = lod === 0 ? 4 : lod === 1 ? 6 : 10;
  for (let side = 0; side < 4; side++) {
    const [q, r] = signs[side],
      [u, v] = signs[(side + 1) % 4];
    const p = (t) => {
      const x = mix(q, u, t),
        z = mix(r, v, t);
      return at(x * 4.1, S.platform + 0.55 + 3.43 * Math.sin(Math.PI * t), z * 3.97);
    };
    for (let j = 0; j < spans; j++) {
      const a = p(j / spans),
        b = p((j + 1) / spans);
      strut(out, lod, a, b, 0.061, 0.064, tone.frame);
    }
  }
}
function trunk(out, lo, hi, r0, r1, count, lod) {
  const row = (t) => square(mix(lo, hi, t), mix(r0, r1, Math.pow(t, 0.83)));
  for (let i = 0; i < count; i++) {
    const a = row(i / count),
      b = row((i + 1) / count);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      strut(out, lod, a[j], b[j], 0.071, 0.07, tone.frame);
      strut(out, lod, b[j], b[k], 0.055, 0.054, tone.edge);
      strut(out, lod, a[j], b[k], 0.04, 0.043, tone.dark);
      if (lod >= 1) strut(out, lod, a[k], b[j], 0.041, 0.039, tone.dark);
      if (lod >= 2)
        strut(out, lod, lerp(a[j], a[k], 0.5), lerp(b[j], b[k], 0.5), 0.032, 0.031, tone.frame);
    }
  }
}
function crown(out, lod) {
  const p = S.platform + S.towerHeight,
    n = lod === 0 ? 7 : lod === 3 ? 14 : 10;
  const ring = (y, r) => radialRing(y, r, r, n);
  loft(
    out,
    'steel',
    [
      [p - 1.43, 0.42],
      [p - 1.21, 0.62],
      [p - 0.89, 0.66],
      [p - 0.65, 0.63],
      [p - 0.58, 0.61],
    ].map(([y, r]) => ring(y, r)),
    tone.dark,
  );
  loft(
    out,
    'steel',
    [
      [p - 0.58, 0.61],
      [p - 0.36, 0.47],
      [p - 0.15, 0.25],
      [p - 0.11, 0.075],
    ].map(([y, r]) => ring(y, r)),
    tone.frame,
  );
  tube(out, 'steel', [0, p - 0.12, 0], [0, p, 0], 0.037, tone.edge, 6);
}
function build(out, lod) {
  base(out, lod);
  legs(out, lod);
  ringDeck(out, S.legTop - 0.15, 0.42, S.lowerDeckHalfWidth);
  trunk(
    out,
    S.legTop + 0.22,
    S.upperDeck - 0.14,
    2.58,
    1.23,
    lod === 0 ? 2 : lod === 1 ? 3 : 6,
    lod,
  );
  ringDeck(out, S.upperDeck - 0.13, 0.38, S.upperDeckHalfWidth);
  trunk(
    out,
    S.upperDeck + 0.2,
    S.platform + S.towerHeight - 1.43,
    1.22,
    0.3,
    lod === 0 ? 3 : lod === 1 ? 4 : lod === 2 ? 10 : 13,
    lod,
  );
  crown(out, lod);
}
export const towerSkyline = (out) => build(out, 0);
export const towerDistrict = (out) => build(out, 1);
export const towerStreet = (out) => build(out, 2);
export const towerCloseup = (out) => build(out, 3);
const camera = [-37, 17, 31],
  lookAt = [0, 8, 0],
  recipe = 'eiffel-tower-paris-tennessee-model.mjs';
export const towerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  build: towerCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Paris, Tennessee’s sixty-foot Eiffel Tower replica, with four flared open lattice legs, two decks and a domed platform over a circular brick base.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-25, 33, 34],
  portableGroundY: -0.3,
  mediumFiContext: {
    scale: 0.96,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'Named surveyed circular platform footprint.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'brick_flemish', 'stone_limestone'],
  qaCameras: [
    { name: 'flared-lattice-legs-and-brick-base', position: [-23, 5, 17], lookAt: [0, 4, 0] },
    { name: 'decks-and-domed-observation-cap', position: [22, 16, 16], lookAt: [0, 12, 0] },
    { name: 'park-tower-full-height', position: [5, 3, 29], lookAt: [0, 9, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `eiffel-tower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'towerSkyline',
    errorMeters: 0.63,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'towerDistrict', 0.29],
        ['street', 'towerStreet', 0.12],
        ['closeup', 'towerCloseup', 0.045],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The OpenStreetMap outline is ODbL. The Qualla photograph is CC0 own work by TheCatalyst31.',
};
