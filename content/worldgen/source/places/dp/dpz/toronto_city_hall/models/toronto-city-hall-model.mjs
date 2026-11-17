/** Toronto's two crescent office towers, low council chamber and plaza-side podium. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [podium, west, east, chamber] = read('map-frame').geometry.polygons;
const s = plan.section;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.89, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.18 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.39, metallic: 0.19 },
  planting: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
};
const tone = {
  stone: rgb('bdb7a9'),
  rib: rgb('cdc5b5'),
  window: rgb('3d4848'),
  podiumGlass: rgb('575a51'),
  frame: rgb('8b8577'),
  roof: rgb('dad4c4'),
  roofBack: rgb('9e9789'),
  parapet: rgb('b2ab99'),
  council: rgb('e5e3d5'),
  earth: rgb('77604d'),
  pavement: rgb('a5a191'),
  shadow: rgb('645d51'),
};
const point = ([x, z], y) => [x, y, z];
const lerp = (a, b, u) => a.map((v, i) => v * (1 - u) + b[i] * u);
const mean = (p) => p[0].map((_, i) => p.reduce((sum, q) => sum + q[i], 0) / p.length);
const move = (p, [x, z], h) => [p[0] + x * h, p[1] + z * h];

function top(out, slot, ring, y, color) {
  const corners = ring.map((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length],
      b = ring[(i + 1) % ring.length];
    const area = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    return Math.abs(area) > 0.00005;
  });
  const perimeter = ring.filter((_, i) => corners[i]);
  const ids = earcut(perimeter.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => point(perimeter[j], y));
    triangle(out, slot, normalFor(...p)[1] > 0 ? p : p.toReversed(), color);
  }
}
function winding(ring) {
  return Math.sign(
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
}

function facade(out, slot, a, b, base, high, order, tint) {
  const p = [point(a, base), point(a, high), point(b, high), point(b, base)];
  face(out, slot, order > 0 ? p : p.toReversed(), tint);
}
function resample(points, count) {
  const dist = [0];
  for (let i = 1; i < points.length; i++)
    dist.push(
      dist.at(-1) + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  return Array.from({ length: count + 1 }, (_, i) => {
    const d = (dist.at(-1) * i) / count;
    const j = dist.findIndex((n, k) => k > 0 && n >= d);
    return lerp(points[j - 1], points[j], (d - dist[j - 1]) / (dist[j] - dist[j - 1]));
  });
}

function builtTower(out, outline, height, floors, end, insideStart, insideEnd, lod) {
  // Break the mapped crescent into the ribbed back, blank returns and interior glass.
  const arches = [
    [outline.slice(0, end + 1), false, true],
    [outline.slice(end, insideStart + 1), false, false],
    [outline.slice(insideStart, insideEnd + 1), true, false],
    [[...outline.slice(insideEnd), outline[0]], false, false],
  ].map(([p, glass, outer]) => ({
    p: resample(p, glass || outer ? [8, 15, 23, 32][lod] : lod < 2 ? 2 : 4),
    glass,
    outer,
  }));
  const ring = arches.flatMap(({ p }) => p.slice(0, -1)),
    order = winding(ring);
  for (const { p, glass, outer } of arches) {
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      const n = [(order * dz) / len, (-order * dx) / len];
      facade(
        out,
        glass ? 'glass' : 'concrete',
        a,
        b,
        s.podiumRoof,
        height,
        order,
        glass ? tone.window : tone.stone,
      );
      if (glass) {
        const aa = move(a, n, 0.025),
          bb = move(b, n, 0.025);
        const stride = lod === 0 ? 5 : lod === 1 ? 2 : 1;
        for (let floor = stride; floor < floors; floor += stride) {
          const y = s.podiumRoof + ((height - s.podiumRoof - 1.2) * floor) / floors;
          facade(out, 'frame', aa, bb, y - 0.15, y + 0.17, order, tone.frame);
        }
        if (lod > 1) {
          for (const u of [0.25, 0.73]) {
            const width = Math.min(0.045, 0.047 / len);
            facade(
              out,
              'frame',
              lerp(aa, bb, u - width),
              lerp(aa, bb, u + width),
              s.podiumRoof + 0.1,
              height - 1.05,
              order,
              tone.frame,
            );
          }
        }
        facade(out, 'concrete', aa, bb, height - 1.12, height, order, tone.parapet);
      }
      if (outer && lod > 0) {
        const strips = lod === 1 ? 1 : lod === 2 ? 2 : 3;
        for (let k = 0; k < strips; k++) {
          const u = (k + 0.5) / strips,
            w = Math.min(0.095, 0.065 / len);
          const aa = move(lerp(a, b, u - w), n, 0.018),
            bb = move(lerp(a, b, u + w), n, 0.018);
          const crown = move(lerp(a, b, u), n, 0.23);
          facade(out, 'concrete', aa, crown, s.podiumRoof, height - 0.55, order, tone.rib);
          facade(out, 'concrete', crown, bb, s.podiumRoof, height - 0.55, order, tone.parapet);
        }
      }
    }
  }
  top(out, 'roof', ring, height, tone.roofBack);
  if (lod > 1) {
    const [x, z] = mean(ring);
    box(
      out,
      'roof',
      [x - 1.04, height - 0.02, z - 1.22],
      [x + 1.04, height + 0.33, z + 1.22],
      tone.frame,
    );
  }
}

function chamberShell(out, lod) {
  const center = mean(chamber);
  const count = [10, 16, 24, 32][lod];
  const samples = resample([...chamber, chamber[0]], count).slice(0, -1);
  const ring = (y, ratio) => samples.map((p) => point(lerp(center, p, ratio), y)).toReversed();
  // Preserve the mapped skew of the council chamber through the shallow elliptical shell.
  loft(
    out,
    'concrete',
    [ring(s.podiumRoof, 0.48), ring(10.2, 0.57), ring(14.02, 0.75)],
    tone.shadow,
  );
  loft(out, 'glass', [ring(13.73, 0.75), ring(17.38, 0.96), ring(s.chamberRim, 0.99)], tone.window);
  loft(
    out,
    'roof',
    [
      ring(s.chamberRim - 0.34, 0.93),
      ring(s.chamberRim + 0.12, 1.01),
      ring(s.chamberRim + 0.39, 0.99),
      ring(20.66, 0.83),
      ring(22.42, 0.58),
      ring(23.48, 0.3),
      ring(s.chamberCrown, 0.056),
    ],
    tone.council,
  );
  if (lod > 0) {
    const glazing = ring(16.5, 0.9).map(([x, , z]) => [x, z]);
    const order = winding(glazing);
    for (let i = 0; i < glazing.length; i++) {
      const p = glazing[i],
        q = glazing[(i + 1) % glazing.length],
        u = lerp(p, q, 0.47),
        v = lerp(p, q, 0.505);
      facade(out, 'frame', u, v, 16.04, 17.02, order, tone.frame);
    }
  }
}

function podiumAndRamp(out, lod) {
  const center = mean(podium),
    outline = podium.map((p) => lerp(center, p, 1.018));
  const order = winding(podium);
  top(out, 'roof', outline, s.podiumRoof, tone.roof);
  for (let i = 0; i < podium.length; i++) {
    const j = (i + 1) % podium.length,
      a = podium[i],
      b = podium[j];
    facade(
      out,
      'glass',
      lerp(a, center, 0.015),
      lerp(b, center, 0.015),
      -1.1,
      s.podiumRoof,
      order,
      tone.podiumGlass,
    );
    facade(
      out,
      'concrete',
      outline[i],
      outline[j],
      s.podiumRoof - 1.08,
      s.podiumRoof,
      order,
      tone.stone,
    );
    if (lod) {
      const count = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 6.8);
      for (let k = 0; k < count; k++) {
        const [x, z] = lerp(a, b, (k + 0.5) / count);
        box(
          out,
          'concrete',
          [x - 0.23, -1.3, z - 0.23],
          [x + 0.23, s.podiumRoof - 0.95, z + 0.23],
          tone.stone,
        );
      }
    }
  }
  if (lod) {
    for (const [x, z, sx, sz] of [
      [-31, -25, 11, 16],
      [29, -29, 11, 13],
      [-25, 41, 10, 6],
      [14, 43, 14, 4.4],
    ]) {
      const p = radialRing(s.podiumRoof + 0.029, sx, sz, 12, [x, z]);
      top(
        out,
        'planting',
        p.map(([x, , z]) => [x, z]),
        s.podiumRoof + 0.036,
        tone.earth,
      );
    }
  }
  const path = [
    [42, 49, 7.99],
    [50, 49, 7.62],
    [59, 52, 6.64],
    [67, 58, 5.35],
    [73, 65, 3.9],
    [77, 72, 2.54],
    [81, 81, 0.88],
    [82, 86, 0.06],
  ];
  const rails = path.map(([x, z, h], i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]),
      dx = (2.1 * (b[1] - a[1])) / d,
      dz = (-2.1 * (b[0] - a[0])) / d;
    return [
      [x + dx, h, z + dz],
      [x - dx, h, z - dz],
    ];
  });
  for (let i = 1; i < rails.length; i++) {
    const [a, b] = rails[i - 1],
      [d, c] = rails[i];
    const railsAt = (v, h) => [v[0], v[1] + h, v[2]];
    for (const t of [
      [a, b, c],
      [a, c, d],
    ])
      triangle(out, 'paving', normalFor(...t)[1] > 0 ? t : t.toReversed(), tone.pavement);
    for (const [l, r] of [
      [a, d],
      [c, b],
    ]) {
      face(out, 'concrete', [l, r, railsAt(r, -0.42), railsAt(l, -0.42)], tone.stone);
      if (lod) face(out, 'concrete', [l, railsAt(l, 0.62), railsAt(r, 0.62), r], tone.stone);
    }
    if (lod > 1 && i % 2 === 1 && a[1] > 1.2) {
      const [x, z, h] = path[i - 1];
      box(out, 'concrete', [x - 0.31, -1.3, z - 0.31], [x + 0.31, h - 0.32, z + 0.31], tone.stone);
    }
  }
}

function build(out, lod) {
  podiumAndRamp(out, lod);
  builtTower(out, west, s.westHeight, s.westFloors, 28, 34, 45, lod);
  builtTower(out, east, s.eastHeight, s.eastFloors, 19, 24, 42, lod);
  chamberShell(out, lod);
}
export const cityHallSkyline = (out) => build(out, 0);
export const cityHallDistrict = (out) => build(out, 1);
export const cityHallStreet = (out) => build(out, 2);
export const cityHallCloseup = (out) => build(out, 3);
const camera = [162, 126, 203],
  lookAt = [3, 33, 6],
  recipe = 'toronto-city-hall-model.mjs';
export const cityHallModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: [
    'heritage-tower-detail-mesh.mjs',
    'polygon-triangulation.mjs',
    'structure-mesh.mjs',
  ],
  surfaces,
  category: 'landmark',
  build: cityHallCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Two concrete and glass crescents rise over Toronto City Hall’s low circular council chamber, civic podium and ceremonial ramp.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-66, 97, 75],
  portableGroundY: -0.21,
  mediumFiContext: {
    scale: 1.14,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: podium,
    minimumCoverage: 0.9,
    basis: 'Named City Hall podium footprint enclosing the mapped tower and chamber parts.',
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'stone_limestone', 'metal_painted'],
  qaCameras: [
    { name: 'south-plaza-and-the-two-crescents', position: [48, 91, 176], lookAt: [0, 39, 3] },
    { name: 'chamber-podium-and-ceremonial-ramp', position: [79, 29, 104], lookAt: [5, 14, 27] },
    { name: 'ribbed-concrete-tower-backs', position: [-128, 91, -119], lookAt: [-6, 44, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `toronto-city-hall-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'cityHallSkyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'cityHallDistrict', 0.41],
        ['street', 'cityHallStreet', 0.15],
        ['closeup', 'cityHallCloseup', 0.059],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap data is ODbL. Daniel Lobo’s exact Qualla photograph is CC0, with a recorded native Flickr review.',
};
