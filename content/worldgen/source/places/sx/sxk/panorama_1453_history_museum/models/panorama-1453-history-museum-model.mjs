/** Panorama 1453 History Museum, Istanbul, September 2024. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  S = plan.section,
  terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88, metallic: 0.05 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  steel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.7, metallic: 0.2 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.13 },
};
const palette = Object.fromEntries(
  Object.entries({
    sand: 'b1a692',
    concrete: '9f9987',
    slate: '6e746f',
    soot: '4b5553',
    wood: '85573c',
    warmWood: '986c4f',
    frame: '303538',
    shade: '334145',
    sky: '799aa5',
    skyB: '75949d',
    edge: '55717b',
    bright: 'b1bac1',
  }).map(([key, val]) => [key, rgb(val)]),
);
const up = [0, 1, 0],
  down = [0, -1, 0];
const point = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, t) => a.map((v) => v * t);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
function draw(out, slot, p, dir, color) {
  const n = normalFor(...p);
  (p.length === 3 ? triangle : face)(
    out,
    slot,
    n.reduce((sum, v, i) => sum + v * dir[i], 0) > 0 ? p : p.toReversed(),
    color,
  );
}
function height([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}
function frame(a, b, outside) {
  const u = scale(
    b.map((v, k) => v - a[k]),
    1 / distance(a, b),
  );
  const normal = [u[1], -u[0]];
  return {
    u,
    n: scale(normal, outside),
    dir: point(scale(normal, outside), 0),
    length: distance(a, b),
  };
}
function hall(out, lod) {
  const ring = [...outline.slice(3, 11), ...outline.slice(14, 22)];
  const unique = ring.filter((p, i) => i === 0 || distance(p, ring[i - 1]) > 0.02);
  const e = S.wallEave;
  for (let i = 0; i < unique.length; i++) {
    const a = unique[i],
      b = unique[(i + 1) % unique.length],
      f = frame(a, b, 1);
    draw(
      out,
      'stone',
      [point(a, height(a) - 0.35), point(b, height(b) - 0.35), point(b, e), point(a, e)],
      f.dir,
      i % 3 === 1 ? palette.concrete : palette.sand,
    );
    if (lod > 0)
      draw(
        out,
        'steel',
        [
          point(add(a, scale(f.n, 0.032)), e - 0.23),
          point(add(b, scale(f.n, 0.032)), e - 0.23),
          point(add(b, scale(f.n, 0.032)), e + 0.08),
          point(add(a, scale(f.n, 0.032)), e + 0.08),
        ],
        f.dir,
        palette.slate,
      );
  }
  const center = S.hallCenter;
  const levels =
    lod === 0 ? [0, 0.5, 1] : lod === 1 ? [0, 0.31, 0.65, 1] : [0, 0.21, 0.44, 0.67, 0.86, 1];
  for (let j = 1; j < levels.length; j++) {
    const low = levels[j - 1],
      high = levels[j];
    const sample = (xy, t) =>
      point(lerp(xy, center, t), e + (S.hallCrown - e) * Math.sin((t * Math.PI) / 2));
    for (let i = 0; i < unique.length; i++) {
      const a = unique[i],
        b = unique[(i + 1) % unique.length];
      const p = [sample(a, low), sample(b, low), sample(b, high)];
      if (high < 1) p.push(sample(a, high));
      draw(out, 'roof', p, up, i % 3 === 0 ? palette.slate : palette.soot);
    }
  }
}
function pavilion(out, lod, front, back, publicEntry) {
  const [A, B] = front.map((i) => outline[i]),
    [C, D] = back.map((i) => outline[i]);
  const f = frame(A, B, publicEntry ? -1 : 1);
  const bottom = publicEntry ? 0.16 : 0.38;
  const low = publicEntry ? S.pavilionLow : 5.9,
    high = publicEntry ? S.pavilionHigh : 5.05;
  const fy = (s) => mix(low, high, s) + 0.42 * Math.sin(Math.PI * s);
  const at = (s, t, depth = 0) => {
    const p = lerp(A, B, s),
      y = mix(bottom, fy(s), t);
    return point(add(p, scale(f.n, depth - 1.02 * t)), y);
  };
  const backEdge = [C, D];
  const backRoof = (s, depth = 0) => {
    const p = lerp(...backEdge, s);
    return point(add(p, scale(f.n, depth)), publicEntry ? 5.65 : 5.5);
  };
  const steps = [7, 7, 14, 18][lod],
    bays = lod >= 2 ? steps : 7;
  const roofLip = (s) => {
    const p = add(lerp(A, B, s), scale(f.n, 1.23));
    return point(p, fy(s) + 1.18);
  };
  const outsideRoof = (s) => add(roofLip(s), [0, 0.14, 0]);
  const rows = lod >= 2 ? 4 : lod === 1 ? 3 : 1;
  for (let i = 0; i < bays; i++) {
    const a = i / bays,
      b = (i + 1) / bays;
    for (let row = 0; row < rows; row++) {
      const l = row / rows,
        h = (row + 1) / rows;
      const tone =
        row === rows - 1 && rows > 1 ? palette.edge : i % 5 === 2 ? palette.skyB : palette.sky;
      draw(out, 'window', [at(a, l), at(b, l), at(b, h), at(a, h)], f.dir, tone);
    }
  }
  for (let i = 0; i < steps; i++) {
    const l = i / steps,
      r = (i + 1) / steps;
    draw(
      out,
      'roof',
      [
        outsideRoof(l),
        outsideRoof(r),
        add(backRoof(r), [0, 0.12, 0]),
        add(backRoof(l), [0, 0.12, 0]),
      ],
      up,
      palette.soot,
    );
    draw(
      out,
      'wood',
      [roofLip(l), roofLip(r), at(r, 1), at(l, 1)],
      down,
      i % 3 ? palette.wood : palette.warmWood,
    );
    draw(
      out,
      'steel',
      [roofLip(l), roofLip(r), outsideRoof(r), outsideRoof(l)],
      f.dir,
      palette.bright,
    );
    if (lod >= 1) {
      const gap = 0.037 / f.length;
      draw(
        out,
        'steel',
        [
          at(l - gap, 0, 0.035),
          at(l + gap, 0, 0.035),
          at(l + gap, 1, 0.035),
          at(l - gap, 1, 0.035),
        ],
        f.dir,
        palette.frame,
      );
      if (lod >= 2 && i % 3 === 0) {
        const r = Math.min(1, l + 2.5 / steps);
        draw(
          out,
          'wood',
          [
            at(l, 0.73, -0.012),
            at(l + 0.011, 0.73, -0.012),
            at(r, 0.955, -0.012),
            at(r - 0.012, 0.955, -0.012),
          ],
          f.dir,
          palette.warmWood,
        );
      }
    }
  }
  if (lod > 0)
    for (let j = 1; j < rows; j++) {
      const t = j / rows;
      for (let i = 0; i < steps; i++) {
        const a = i / steps,
          b = (i + 1) / steps;
        draw(
          out,
          'steel',
          [
            at(a, t - 0.006, 0.046),
            at(b, t - 0.006, 0.046),
            at(b, t + 0.006, 0.046),
            at(a, t + 0.006, 0.046),
          ],
          f.dir,
          palette.frame,
        );
      }
    }
  for (const side of [0, 1]) {
    const back = backRoof(side),
      x = [back[0], back[2]],
      front = at(side, 0),
      frontXZ = [front[0], front[2]],
      n = frame(frontXZ, x, side === 0 ? -1 : 1).dir;
    draw(
      out,
      'window',
      [front, point(x, height(x) - 0.16), back, roofLip(side)],
      n,
      lod ? palette.edge : palette.skyB,
    );
  }
  if (publicEntry) {
    const l = 0.39,
      r = 0.65,
      yLow = [0, 0, 0],
      yHigh = [0, 2.45, 0],
      frontDepth = 0.33;
    const left = at(l, 0, frontDepth),
      right = at(r, 0, frontDepth);
    const corners = [add(left, yLow), add(right, yLow), add(right, yHigh), add(left, yHigh)];
    draw(out, 'window', corners, f.dir, palette.shade);
    const top = [
      corners[3],
      corners[2],
      add(corners[2], scale(f.dir, 0.62)),
      add(corners[3], scale(f.dir, 0.62)),
    ];
    draw(out, 'steel', top, up, palette.frame);
    if (lod)
      for (const division of [0, 0.33, 0.5, 0.67, 1]) {
        const p = lerp(left, right, division),
          q = scale(point(f.u, 0), 0.026);
        draw(
          out,
          'steel',
          [
            add(add(p, q), scale(f.dir, 0.025)),
            add(add(p, scale(q, -1)), scale(f.dir, 0.025)),
            add(add(add(p, scale(q, -1)), yHigh), scale(f.dir, 0.025)),
            add(add(add(p, q), yHigh), scale(f.dir, 0.025)),
          ],
          f.dir,
          palette.bright,
        );
      }
  }
}
function build(out, lod) {
  hall(out, lod);
  pavilion(out, lod, S.entrance, S.entranceBack, true);
  const [a, , c, d, e] = S.rearPavilion;
  pavilion(out, lod, [a, c], [e, d], false);
  if (lod >= 2) {
    const n = lod === 2 ? 6 : 10;
    const rings = [-0.04, 0.22].map((y) =>
      Array.from({ length: n }, (_, i) => {
        const t = (-2 * Math.PI * i) / n;
        return [
          S.hallCenter[0] + 0.43 * Math.cos(t),
          S.hallCrown + y,
          S.hallCenter[1] + 0.43 * Math.sin(t),
        ];
      }),
    );
    loft(out, 'steel', rings, palette.frame);
  }
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const camera = [-87, 29, 66],
  lookAt = [-4, 5, 1],
  recipe = 'panorama-1453-history-museum-model.mjs';
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  build: museumCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Panorama 1453 History Museum, with a sloped glazed entrance and broad timber canopy set against the round exhibition hall.',
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
  portableGroundY: -0.6,
  mediumFiContext: {
    scale: 0.93,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'Named mapped perimeter, with the exhibition drum and entrance wings.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'metal_standing_seam', 'wood_plain'],
  qaCameras: [
    { name: 'sloped-glazing-and-timber-canopy', position: [-48, 7.5, 34], lookAt: [-26, 4.4, 20] },
    { name: 'round-exhibition-hall', position: [39, 32, 35], lookAt: [0, 4.4, 1] },
    { name: 'entry-canopy-and-circular-roof', position: [-45, 23, 44], lookAt: [-9, 5.1, 7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.63,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.28],
        ['street', 'museumStreet', 0.1],
        ['closeup', 'museumCloseup', 0.041],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped outline is ODbL. The published Qualla photo is CC0 own work by Yasze.',
};
