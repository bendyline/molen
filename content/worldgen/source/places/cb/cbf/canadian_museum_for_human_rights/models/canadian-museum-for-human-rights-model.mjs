/** Mapped limestone galleries, layered glass Cloud, and Tower of Hope in Winnipeg. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const grid = read('terrain-grid');
const frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const parts = new Map(
  frame.features.map((part) => [Number(part.id.split('/').at(-1)), part.points]),
);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.93, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.31, metallic: 0.18 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.58, metallic: 0.38 },
};
const c = Object.fromEntries(
  Object.entries({
    limestone: 'bfb39a',
    paleStone: 'cfc0a0',
    stoneShade: 'a79980',
    base: 'a59a83',
    roof: 'aea38c',
    grass: '8b8c6a',
    shadow: '44565a',
    glassBlue: '83a2ae',
    glassSilver: '9bb4bb',
    deepBlue: '63838f',
    towerBlue: '5e879d',
    towerPale: '7e96a3',
    trim: '596b70',
    seam: '667e85',
    fascia: '5f7072',
    frame: '96a5a4',
    towerDark: '687a7d',
  }).map(([name, color]) => [name, rgb(color)]),
);

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((value, i) => lerp(value, b[i], t));
const clamp = (value) => Math.min(1, Math.max(0, value));
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const point = ([x, z], y) => [x, y, z];
const signedArea = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
const clockwise = (ring) => (signedArea(ring) < 0 ? ring : ring.toReversed());
const center = (ring) =>
  [0, 1].map((axis) => ring.reduce((total, p) => total + p[axis], 0) / ring.length);
const edgeLength = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));

function grade(x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters;
  const v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const lower = lerp(grid.heightsMeters[j][i], grid.heightsMeters[j][i + 1], u - i);
  const upper = lerp(grid.heightsMeters[j + 1][i], grid.heightsMeters[j + 1][i + 1], u - i);
  return lerp(lower, upper, v - j) - grid.modelDatumElevationMeters;
}

function top(out, slot, ring, heights, tint) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3).map((index) => point(ring[index], heights[index]));
    if (normalFor(...p)[1] < 0) p.reverse();
    triangle(out, slot, p, tint);
  }
}

function volume(out, ring, low, high, wall, tint, roof, roofTint) {
  const ordered = clockwise(ring);
  const lower = ordered.map((p) => low(...p));
  const upper = ordered.map((p) => high(...p));
  for (let i = 0; i < ordered.length; i++) {
    const k = (i + 1) % ordered.length;
    const a = ordered[i];
    const b = ordered[k];
    face(
      out,
      wall,
      [point(a, lower[i]), point(b, lower[k]), point(b, upper[k]), point(a, upper[i])],
      tint,
    );
  }
  top(out, roof, ordered, upper, roofTint);
}

function horizontalPanel(out, a, b, y0, y1, offset, tint, divisions = 1) {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(dx, dz);
  const p = (u, y) => [
    lerp(a[0], b[0], u) + (dz * offset) / length,
    y,
    lerp(a[1], b[1], u) - (dx * offset) / length,
  ];
  for (let i = 0; i < divisions; i++) {
    const x0 = i / divisions + 0.012 / divisions;
    const x1 = (i + 1) / divisions - 0.012 / divisions;
    face(out, 'glass', [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)], tint);
  }
}

function foundation(out, lod) {
  const body = outline.map((p) => mix(p, [0, -12], 0.008));
  volume(
    out,
    body,
    (x, z) => grade(x, z) - 0.63,
    () => 3.4,
    'base',
    c.base,
    'roof',
    c.roof,
  );
  for (const root of plan.roots) {
    const ring = parts.get(root.id);
    const delta = [root.inner[0] - root.tip[0], root.inner[1] - root.tip[1]];
    const run = delta[0] * delta[0] + delta[1] * delta[1];
    const y = (x, z) => {
      const t = clamp(((x - root.tip[0]) * delta[0] + (z - root.tip[1]) * delta[1]) / run);
      return lerp(2.65, root.height, t);
    };
    volume(out, ring, () => 0.12, y, 'stone', c.limestone, 'roof', c[root.roof]);
  }
  const entrance = clockwise(parts.get(1383041214));
  volume(
    out,
    entrance,
    () => 0.18,
    () => 14.9,
    'glass',
    c.shadow,
    'roof',
    c.roof,
  );
  const roof = parts.get(250706846);
  volume(
    out,
    roof,
    () => 3.32,
    () => 5.1,
    'stone',
    c.stoneShade,
    'roof',
    c.roof,
  );
  if (lod > 0) {
    for (let i = 0; i < entrance.length; i++) {
      const a = entrance[i],
        b = entrance[(i + 1) % entrance.length];
      if (edgeLength(a, b) > 3)
        horizontalPanel(out, a, b, 3.7, 11.1, 0.12, c.deepBlue, Math.ceil(edgeLength(a, b) / 2.4));
    }
  }
}

function galleries(out, lod) {
  for (const section of plan.galleryParts) {
    const ring = clockwise(parts.get(section.id));
    const high = section.glazing
      ? (x, z) => section.height - 0.14 * (z + 39)
      : () => section.height;
    const wall = section.glazing ? 'glass' : 'stone';
    const tint = section.glazing ? c.shadow : c[section.surface];
    volume(out, ring, () => 2.8, high, wall, tint, 'roof', c.roof);
    if (lod === 0 || section.glazing) continue;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const length = edgeLength(a, b);
      const north = b[0] - a[0] > 0;
      if (!north || length < 7) continue;
      if (section.id === 308812815 || section.id === 1381564357 || section.id === 308812811) {
        const inset = Math.min(0.19, 1.18 / length);
        const scale = lod === 1 ? 7 : 2.65;
        const y = section.height - (section.height > 50 ? 5.8 : 8.6);
        horizontalPanel(
          out,
          mix(a, b, inset),
          mix(a, b, 1 - inset),
          y,
          y + 1.36,
          0.052,
          c.shadow,
          Math.ceil(length / scale),
        );
      }
    }
  }
}

function spline(a, b, c0, d, t) {
  return b.map(
    (n, i) =>
      0.5 *
      (2 * n +
        (-a[i] + c0[i]) * t +
        (2 * a[i] - 5 * n + 4 * c0[i] - d[i]) * t * t +
        (-a[i] + 3 * n - 3 * c0[i] + d[i]) * t * t * t),
  );
}

function perimeter(count) {
  const controls = clockwise(plan.cloudGuide.map((i) => parts.get(131229326)[i]));
  const n = controls.length;
  const fine = controls.flatMap((b, i) =>
    Array.from({ length: 10 }, (_, j) =>
      spline(controls[(i + n - 1) % n], b, controls[(i + 1) % n], controls[(i + 2) % n], j / 10),
    ),
  );
  fine.push(fine[0]);
  const distance = [0];
  for (let i = 1; i < fine.length; i++)
    distance.push(distance.at(-1) + edgeLength(fine[i], fine[i - 1]));
  let j = 1;
  return Array.from({ length: count }, (_, i) => {
    const wanted = (distance.at(-1) * i) / count;
    while (distance[j] < wanted) j++;
    return mix(fine[j - 1], fine[j], (wanted - distance[j - 1]) / (distance[j] - distance[j - 1]));
  });
}

function panelPoint(corners, u, v) {
  const [a, b, c0, d] = corners;
  return mix(mix(a, b, u), mix(d, c0, u), v);
}

function panels(out, lower, upper, lod, tint, glass = false, closed = true) {
  const count = closed ? lower.length : lower.length - 1;
  for (let i = 0; i < count; i++) {
    const k = (i + 1) % lower.length;
    const corners = [lower[i], lower[k], upper[k], upper[i]];
    if (!glass || lod < 2) {
      face(out, glass ? 'glass' : 'metal', corners, tint);
      continue;
    }
    const panelTint = mix(tint, c.glassSilver, 0.08 + ((i * 29) % 23) / 175);
    const us = 0.025;
    const vs = 0.019;
    const p = (u, v) => panelPoint(corners, u, v);
    face(out, 'glass', [p(0, 0), p(1 - us, 0), p(1 - us, 1 - vs), p(0, 1 - vs)], panelTint);
    face(out, 'metal', [p(1 - us, 0), p(1, 0), p(1, 1 - vs), p(1 - us, 1 - vs)], c.seam);
    face(out, 'metal', [p(0, 1 - vs), p(1, 1 - vs), p(1, 1), p(0, 1)], c.seam);
  }
}

function cloud(out, lod) {
  const sample = perimeter([16, 28, 46, 62][lod]);
  const stem = [17, -9];
  const bands = [
    { from: 13, to: 29, lower: 0.82, belly: 0.96, lip: 0.98, tint: c.deepBlue },
    { from: 29, to: 43, lower: 0.94, belly: 1.02, lip: 1.0, tint: c.glassBlue },
    { from: 43, to: 55, lower: 0.97, belly: 0.95, lip: 0.76, tint: c.glassSilver },
  ];
  const section = (band, index, t) => {
    const scale =
      t < 0.64
        ? lerp(band.lower, band.belly, smooth(t / 0.64))
        : lerp(band.belly, band.lip, smooth((t - 0.64) / 0.36));
    return sample.map(([x, z]) => {
      const direction = clamp((x + 22) / 90);
      const south = clamp((z + 24) / 50);
      const notch = Math.max(0, 1 - Math.abs(direction - 0.55) * 5.3);
      const belt =
        index === 0
          ? (1 - t) * (-5 * south) + t * (5 * notch * south - 3 * direction)
          : index === 1
            ? lerp(5 * notch * south - 3 * direction, 5 * notch * south - 4.7 * direction, t)
            : lerp(5 * notch * south - 4.7 * direction, 2.0 * Math.sin(direction * Math.PI), t);
      const shiftX = index === 2 ? 2.2 * t : -1.2 * t * (1 - direction);
      return [
        lerp(stem[0], x, scale) + shiftX,
        lerp(band.from, band.to, t) + belt,
        lerp(stem[1], z, scale) + 1.9 * t * south,
      ];
    });
  };
  const lower = section(bands[0], 0, 0);
  const support = lower.map(([x, _y, z]) => [lerp(stem[0], x, 0.91), 2.93, lerp(stem[1], z, 0.91)]);
  panels(out, support, lower, lod, c.shadow, true);
  let prior = null;
  for (const [i, band] of bands.entries()) {
    const rows = [2, 3, 5, 7][lod];
    let prev = section(band, i, 0);
    if (prior) {
      const tuck = prev.map(([x, y, z]) => [x, y - 0.48, z]);
      panels(out, prior, tuck, lod, c.fascia);
      panels(out, tuck, prev, lod, c.fascia);
    }
    for (let j = 1; j <= rows; j++) {
      const next = section(band, i, j / rows);
      panels(out, prev, next, lod, band.tint, true);
      prev = next;
    }
    prior = prev;
  }
  const upper = prior.map(([x, y, z]) => [lerp(27, x, 0.65), y + 0.2, lerp(-10, z, 0.62)]);
  panels(out, prior, upper, lod, c.glassSilver, true);
  top(
    out,
    'glass',
    upper.map(([x, _y, z]) => [x, z]),
    upper.map((p) => p[1]),
    c.glassSilver,
  );
}

function foldedWing(out, lod) {
  // The outer wing rises from the southwest and turns sharply into the main glass shell.
  const controls = [
    [-22, 1, 28, 43],
    [-16, 12, 25, 47],
    [-5, 21, 23, 50],
    [8, 26.5, 21, 50.2],
    [21.5, 27.6, 23.8, 47],
    [30.5, 24.8, 32.2, 43.5],
    [38, 17.1, 35.3, 40.1],
  ];
  const steps = [1, 2, 3, 5][lod];
  const path = controls
    .slice(0, -1)
    .flatMap((p, i) =>
      Array.from({ length: steps }, (_, j) =>
        spline(
          controls[Math.max(0, i - 1)],
          p,
          controls[i + 1],
          controls[Math.min(controls.length - 1, i + 2)],
          j / steps,
        ),
      ),
    );
  path.push(controls.at(-1));
  const crossSection = (t) =>
    path.map(([x, z, low, high], i) => {
      const u = i / (path.length - 1);
      const bulge = Math.sin(t * Math.PI) * Math.sin(u * Math.PI);
      return [x + t * 0.4, lerp(low, high, t), z + bulge * 1.6 - t * 3.9];
    });
  const low = crossSection(0);
  const lowReturn = low.map(([x, y, z]) => [lerp(x, 18, 0.11), y - 0.7, z - 1.6]);
  panels(out, lowReturn, low, lod, c.fascia, false, false);
  let previous = low;
  const rows = [2, 3, 5, 7][lod];
  for (let row = 1; row <= rows; row++) {
    const next = crossSection(row / rows);
    panels(out, previous, next, lod, c.glassBlue, true, false);
    previous = next;
  }
  const highReturn = previous.map(([x, y, z]) => [lerp(x, 16, 0.13), y + 0.4, z - 2.2]);
  panels(out, previous, highReturn, lod, c.glassSilver, true, false);
  for (const i of [0, path.length - 1]) {
    const end = [lowReturn[i], low[i], previous[i], highReturn[i]];
    face(out, 'glass', i === 0 ? end : end.toReversed(), c.deepBlue);
  }
}

function tower(out, lod) {
  const polygon = clockwise(parts.get(306556703));
  const origin = center(polygon);
  const ring = (height, scale, lean = 0) =>
    polygon.map(([x, z]) => [
      lerp(origin[0], x, scale) + lean,
      height,
      lerp(origin[1], z, scale) - lean * 0.45,
    ]);
  const levels = [
    { y: 47, s: 1.2, tint: c.towerBlue },
    { y: 60, s: 1.0, tint: c.towerBlue },
    { y: 73.5, s: 0.84, tint: c.towerBlue },
    { y: 83.0, s: 0.67, tint: c.towerPale },
    { y: 91, s: 0.48, tint: c.towerPale },
    { y: plan.towerHeight, s: 0.34, tint: c.towerPale },
  ];
  const rings = levels.map(({ y, s }, i) =>
    ring(y, i > 2 && lod > 0 ? s * 0.76 : s, (y - 47) * 0.023),
  );
  for (let i = 1; i < rings.length; i++) {
    const intervals = lod < 2 ? 1 : i < 3 ? 4 : 3;
    for (let j = 0; j < intervals; j++) {
      const a = rings[i - 1].map((p, k) => mix(p, rings[i][k], j / intervals));
      const b = rings[i - 1].map((p, k) => mix(p, rings[i][k], (j + 1) / intervals));
      panels(out, a, b, lod, levels[i].tint, true);
    }
  }
  const cap = rings.at(-1);
  top(
    out,
    'metal',
    cap.map(([x, _y, z]) => [x, z]),
    cap.map((p) => p[1]),
    c.frame,
  );
  if (lod === 0) return;
  const spire = levels.slice(2).map(({ y, s }) => ring(y, s, (y - 47) * 0.023));
  for (let i = 0; i < polygon.length; i++) {
    const upright = spire.map((r) => r[i]);
    beamPath(out, 'metal', upright, 0.29, 0.26, c.frame);
  }
  for (const r of spire.slice(1)) beamPath(out, 'metal', r, 0.23, 0.21, c.frame, true);
  if (lod < 2) return;
  for (let row = 0; row < spire.length - 1; row++) {
    const lower = spire[row],
      upper = spire[row + 1];
    for (let j = 0; j < lower.length; j++) {
      const k = (j + 1) % lower.length;
      const a = lower[j],
        b = lower[k],
        a2 = upper[j],
        b2 = upper[k];
      const m0 = mix(a, b, 0.5),
        m1 = mix(a2, b2, 0.5);
      const midpoint = mix(m0, m1, 0.48);
      beam(out, 'metal', m0, m1, 0.115, 0.11, c.frame);
      beam(out, 'metal', a, midpoint, 0.1, 0.095, c.frame);
      beam(out, 'metal', midpoint, b2, 0.1, 0.095, c.frame);
      if (lod === 3) beam(out, 'metal', mix(a, a2, 0.5), mix(b, b2, 0.5), 0.105, 0.1, c.frame);
    }
  }
}

function build(out, lod) {
  foundation(out, lod);
  galleries(out, lod);
  cloud(out, lod);
  foldedWing(out, lod);
  tower(out, lod);
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'canadian-museum-for-human-rights-model.mjs';
const camera = [128, 83, 173];
const lookAt = [1, 38, 1];

export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: [
    'heritage-tower-detail-mesh.mjs',
    'polygon-triangulation.mjs',
    'joined-path.mjs',
  ],
  surfaces,
  build: museumCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Winnipeg’s Canadian Museum for Human Rights, with angular limestone roots, the layered glass Cloud and the 100-metre Tower of Hope.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-28, 41, -31],
  mediumFiContext: {
    scale: 2.45,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Named museum way 131229325 and its mapped parts.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_raw',
    'stone_limestone',
    'stone_limestone_weathered',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'limestone-galleries-from-provencher',
      position: [-13, 33, -156],
      lookAt: [17, 40, -22],
    },
    { name: 'layered-cloud-from-the-forks', position: [110, 36, 116], lookAt: [17, 37, -2] },
    { name: 'sloping-roots-and-entry', position: [-103, 28, 123], lookAt: [-3, 23, 7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 1.18,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.55],
        ['street', 'museumStreet', 0.23],
        ['closeup', 'museumCloseup', 0.075],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap outlines are ODbL. Both verified Qualla photographs are CC0.',
};
