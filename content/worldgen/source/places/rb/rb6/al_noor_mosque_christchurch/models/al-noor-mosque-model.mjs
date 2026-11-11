/** The 2006 exterior of Al Noor Mosque in Riccarton, Christchurch. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
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
const frame = read('map-frame');
const terrain = read('terrain-grid');
const ring = frame.geometry.polygons[0];
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.17 },
  dome: { slot: 'roof', graph: 'metal_painted', roughness: 0.64, metallic: 0.26 },
  base: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.94, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64, metallic: 0.07 },
};
const colors = Object.fromEntries(
  Object.entries({
    cream: 'ddd8bf',
    body: 'd4d0b8',
    side: 'cfcbb5',
    warm: 'ded8bd',
    base: 'a9a99d',
    lip: '6c6962',
    roof: '777a77',
    roofDark: '626862',
    joint: 'b8b7aa',
    green: '33594a',
    greenLight: '426859',
    darkGlass: '293f38',
    glass: '3a5048',
    gold: 'b49b5c',
    goldLight: 'c3aa6c',
    goldDark: '9e854d',
    chalk: 'e0dfd2',
    dark: '424841',
    door: '58624e',
  }).map(([name, value]) => [name, rgb(value)]),
);
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const mix = (a, b, t) => a + (b - a) * t;

function grade(x, z) {
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

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2,
    normal = [-uz, 0, ux];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [x + u * ux + d * normal[0], y, z + u * uz + d * normal[2]],
  };
}

function oriented(out, slot, p, normal, color) {
  const n = normalFor(...p),
    points = n.reduce((v, x, i) => v + x * normal[i], 0) > 0 ? p : p.toReversed();
  if (points.length === 4) face(out, slot, points, color);
  else triangle(out, slot, points, color);
}

function fill(out, s, slot, outer, color, d = 0, holes = []) {
  const points = [...outer],
    starts = [];
  for (const hole of holes) {
    starts.push(points.length);
    points.push(...hole);
  }
  const mesh = earcut(points.flat(), starts);
  for (let i = 0; i < mesh.length; i += 3)
    oriented(
      out,
      slot,
      mesh.slice(i, i + 3).map((j) => s.p(...points[j], d)),
      s.normal,
      color,
    );
}

function trim(out, s, slot, a, b, d0, d1, color, full) {
  const [x0, y0] = a,
    [x1, y1] = b,
    points = rect(x0, y0, x1, y1);
  oriented(
    out,
    slot,
    points.map((p) => s.p(...p, d1)),
    s.normal,
    color,
  );
  if (!full) return;
  for (let i = 0; i < 4; i++) {
    const p = points[i],
      q = points[(i + 1) % 4];
    face(out, slot, [s.p(...p, d0), s.p(...q, d0), s.p(...q, d1), s.p(...p, d1)], color);
  }
}

function chevron(x, low, high, width) {
  const half = width / 2,
    y = high - low;
  return [
    [x, low],
    [x + half, low + y * 0.115],
    [x + half, high - y * 0.12],
    [x, high],
    [x - half, high - y * 0.12],
    [x - half, low + y * 0.115],
  ];
}

function framePath(out, s, inner, outer, d, color) {
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    oriented(
      out,
      'detail',
      [inner[i], inner[j], outer[j], outer[i]].map((p) => s.p(...p, d)),
      s.normal,
      color,
    );
  }
}

function windows(i, s, lod) {
  if (i === 0)
    return [
      { x: -5.59, width: 0.72, low: 0.79, top: 3.35 },
      { x: 5.52, width: 1.74, low: 0.84, top: 3.53 },
    ];
  if (i === 6)
    return [
      { x: 0.25, width: 2.67, low: 0.11, top: 3.67, entrance: true },
      { x: -3.86, width: 1.08, low: 1.17, top: 3.37 },
    ];
  if (s.length < 5.6 || lod === 0) return [];
  const count = Math.floor(s.length / 5.6);
  return Array.from({ length: count }, (_, j) => ({
    x: s.length * ((j + 0.5) / count - 0.5),
    width: Math.min(1.48, (s.length / count) * 0.41),
    low: 1.02,
    top: 3.46,
  }));
}

function wallPanel(out, s, w, lod) {
  const { x, width, low, top, entrance } = w;
  const outer = chevron(x, low - 0.1, top + 0.13, width + 0.23),
    inner = chevron(x, low, top, width);
  const d = lod >= 2 ? -0.12 : 0.027;
  if (!entrance)
    fill(
      out,
      s,
      'detail',
      rect(x - width / 2 - 0.16, low - 0.21, x + width / 2 + 0.16, top + 0.25),
      colors.green,
      0.018,
      [inner],
    );
  if (lod >= 2) {
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i],
        b = inner[(i + 1) % inner.length];
      face(out, 'concrete', [s.p(...a), s.p(...b), s.p(...b, d), s.p(...a, d)], colors.side);
    }
  }
  framePath(out, s, inner, outer, 0.047, colors.cream);
  fill(out, s, 'detail', inner, entrance ? colors.door : colors.darkGlass, d);
  if (lod === 0) return;
  const y = mix(low, top, 0.5),
    h = width / 2 - 0.022;
  if (!entrance) {
    for (const u of [-1, 1])
      beam(
        out,
        'detail',
        s.p(x + u * h, y + 0.17, 0.052),
        s.p(x, y - 0.035, 0.052),
        0.066,
        0.053,
        colors.greenLight,
      );
    if (lod >= 2) {
      const pane = chevron(x, mix(low, top, 0.54), top - 0.15, width - 0.18);
      fill(out, s, 'detail', pane, colors.glass, d + 0.007);
    }
  } else {
    trim(
      out,
      s,
      'detail',
      [x - 0.045, low + 0.04],
      [x + 0.045, top - 0.22],
      d,
      0.049,
      colors.dark,
      lod >= 2,
    );
    trim(out, s, 'detail', [x - h, y + 0.48], [x + h, y + 0.58], d, 0.048, colors.dark, lod >= 2);
    if (lod >= 2)
      for (const offset of [-0.19, 0.19])
        beam(
          out,
          'detail',
          s.p(x + offset, y - 0.38, 0.028),
          s.p(x + offset, y - 0.04, 0.028),
          0.038,
          0.057,
          colors.chalk,
        );
  }
}

function mainWalls(out, lod) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[(i + 1) % ring.length],
      b = ring[i],
      s = section(a, b),
      h = s.length / 2;
    const [ga, gb] = [grade(...a), grade(...b)],
      low = Math.min(ga, gb) - 0.2;
    const win = windows(i, s, lod);
    const holes = lod >= 2 ? win.map((w) => chevron(w.x, w.low, w.top, w.width)) : [];
    fill(
      out,
      s,
      'concrete',
      rect(-h, low, h, plan.eaves),
      i % 3 === 0 ? colors.cream : colors.body,
      0,
      holes,
    );
    const base = 0.19;
    fill(
      out,
      s,
      'base',
      [
        [-h, ga - 0.19],
        [h, gb - 0.19],
        [h, gb + base],
        [-h, ga + base],
      ],
      colors.base,
      0.021,
    );
    trim(
      out,
      s,
      'roof',
      [-h, plan.eaves - 0.085],
      [h, plan.eaves + 0.056],
      -0.03,
      0.14,
      colors.lip,
      lod > 0,
    );
    const count = Math.floor(s.length / 3.1);
    for (let j = 0; j <= count; j++) {
      const u = -h + 0.11 + (j * (s.length - 0.22)) / Math.max(1, count);
      if (
        win.some((w) => Math.abs(u - w.x) < w.width / 2 + 0.19) ||
        (i === 0 && Math.abs(u - 0.45) < 2.39)
      )
        continue;
      trim(
        out,
        s,
        'detail',
        [u - 0.028, low],
        [u + 0.028, plan.eaves - 0.085],
        0,
        0.027,
        colors.green,
      );
    }
    for (const w of win) wallPanel(out, s, w, lod);
    if (i === 6) {
      const [x, , z] = s.p(0.25, 0, 0.38);
      box(out, 'base', [x - 0.48, low, z - 1.39], [x + 0.41, 0.12, z + 1.39], colors.base);
    }
  }
}

function westProjection(out, lod) {
  const west = (ring[0][0] + ring[1][0]) / 2,
    z = 3.14,
    depth = 0.96,
    w = 4.67,
    yTop = 4.49;
  const low = Math.min(grade(west - depth, z - w / 2), grade(west - depth, z + w / 2)) - 0.16;
  box(out, 'concrete', [west - depth, low, z - w / 2], [west + 0.08, yTop, z + w / 2], colors.warm);
  box(
    out,
    'roof',
    [west - depth - 0.08, yTop - 0.08, z - w / 2 - 0.08],
    [west + 0.18, yTop + 0.045, z + w / 2 + 0.09],
    colors.lip,
  );
  const s = section([west - depth, z - w / 2], [west - depth, z + w / 2]);
  const profile = (dx, lo, high) => [
    [dx - 1.39, lo],
    [dx + 1.39, lo],
    [dx + 1.39, high - 0.58],
    [dx + 1.25, high - 0.34],
    [dx, high],
    [dx - 1.25, high - 0.34],
    [dx - 1.39, high - 0.58],
  ];
  const inner = profile(0, 0.36, 3.72).map(([x, y]) => [x * 0.94, mix(2.02, y, 0.94)]);
  framePath(out, s, inner, profile(0, 0.36, 3.72), 0.027, colors.green);
  for (const u of [-w / 2 + 0.15, w / 2 - 0.15]) {
    const sign = Math.sign(u);
    trim(out, s, 'detail', [u - 0.031, 0.14], [u + 0.031, yTop - 0.1], 0, 0.031, colors.green);
    if (lod > 0) {
      const panel = chevron(u - sign * 0.3, 0.45, 3.57, 0.27);
      fill(out, s, 'detail', panel, colors.green, 0.035);
      for (const y of [1.04, 2.98])
        fill(
          out,
          s,
          'detail',
          [
            [u - sign * 0.3 - 0.135, y],
            [u - sign * 0.3, y + 0.08],
            [u - sign * 0.3 + 0.135, y],
            [u - sign * 0.3 + 0.135, y + 0.065],
            [u - sign * 0.3, y + 0.145],
            [u - sign * 0.3 - 0.135, y + 0.065],
          ],
          colors.cream,
          0.039,
        );
    }
  }
  if (lod >= 2) {
    for (const u of [-1.65, 1.64])
      beam(out, 'roof', s.p(u, 0.12, 0.069), s.p(u, 4.44, 0.069), 0.057, 0.058, colors.roofDark);
    box(
      out,
      'detail',
      [west - depth - 0.116, 4.03, z - 0.17],
      [west - depth - 0.026, 4.16, z + 0.17],
      colors.dark,
    );
  }
}

function roofHall(out, lod) {
  const roofY = plan.eaves + 0.015,
    mesh = earcut(ring.flat());
  for (let i = 0; i < mesh.length; i += 3)
    oriented(
      out,
      'roof',
      mesh.slice(i, i + 3).map((j) => [ring[j][0], roofY, ring[j][1]]),
      [0, 1, 0],
      colors.roof,
    );
  const {
    center: [x, z],
    half: [w, d],
    shoulder,
    chamfer,
  } = plan.prayerHall;
  const lower = chamferedRectangle(x, roofY, z, w * 2, d * 2, chamfer);
  const upper = chamferedRectangle(x, shoulder, z, w * 1.68, d * 1.66, chamfer * 0.85);
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length,
      point = lower[i].map((v, k) => (v + lower[j][k]) / 2);
    const shade = i % 2 ? colors.cream : colors.roof;
    oriented(
      out,
      i % 2 ? 'concrete' : 'roof',
      [lower[i], lower[j], upper[j], upper[i]],
      [point[0] - x, 0.6, point[2] - z],
      shade,
    );
    if (lod > 0) {
      beam(out, 'roof', upper[i], upper[j], 0.071, 0.072, colors.lip);
      beam(out, 'roof', lower[i], upper[i], 0.045, 0.061, colors.roofDark);
    }
  }
  const cap = upper.map((p) => [p[0], p[2]]),
    tris = earcut(cap.flat());
  for (let i = 0; i < tris.length; i += 3)
    oriented(
      out,
      'roof',
      tris.slice(i, i + 3).map((j) => upper[j]),
      [0, 1, 0],
      colors.roof,
    );
}

function crescent(out, x, y, z, lod) {
  beam(out, 'detail', [x, y - 0.46, z], [x, y + 0.25, z], 0.048, 0.052, colors.goldDark);
  const count = [6, 8, 12, 16][lod],
    r = 0.26;
  for (const side of [-1, 1]) {
    const edge = (i, inside) => {
      const a = Math.PI * (1 + i / count),
        b = r - (inside ? 0.075 * Math.sin((Math.PI * i) / count) : 0);
      return [x + side * 0.013, y + 0.48 + b * Math.sin(a), z + b * Math.cos(a)];
    };
    for (let i = 0; i < count; i++) {
      const j = i + 1;
      const p =
        i === 0
          ? [edge(i, false), edge(j, false), edge(j, true)]
          : j === count
            ? [edge(i, false), edge(j, false), edge(i, true)]
            : [edge(i, false), edge(j, false), edge(j, true), edge(i, true)];
      oriented(out, 'detail', p, [side, 0, 0], colors.goldLight);
    }
  }
}

function domes(out, lod) {
  const { dome, minaret, prayerHall } = plan;
  const n = [16, 24, 38, 54][lod];
  const courses = [4, 9, 14, 21][lod];
  const shoulder = prayerHall.shoulder - 0.045;
  const shapes = Array.from({ length: courses + 1 }, (_, i) => {
    const angle = (i / courses) * (Math.PI / 2 - 0.019);
    const radius = dome.radius * Math.cos(angle);
    return radialRing(shoulder + dome.rise * Math.sin(angle), radius, radius, n, dome.center);
  });
  loft(out, 'dome', shapes, colors.gold);
  if (lod >= 2) {
    const spacing = lod === 2 ? 5 : 6;
    for (let i = 0; i < n; i += spacing)
      for (let j = 1; j < shapes.length; j++)
        beam(out, 'dome', shapes[j - 1][i], shapes[j][i], 0.038, 0.038, colors.goldLight);
  }
  const top = shoulder + dome.rise;
  crescent(out, dome.center[0], top + 0.45, dome.center[1], lod);
  const k = [8, 10, 14, 18][lod],
    m = minaret.radius;
  loft(
    out,
    'concrete',
    [
      [plan.eaves - 0.12, m],
      [minaret.shaftTop - 0.12, m * 0.94],
      [minaret.shaftTop, m * 1.12],
    ].map(([y, r]) => radialRing(y, r, r, k, minaret.center)),
    colors.chalk,
  );
  const hat = [
    [0, m * 1.11],
    [0.58, m * 1.09],
    [1.05, m * 0.93],
    [1.42, m * 0.55],
    [1.72, m * 0.075],
  ];
  loft(
    out,
    'dome',
    hat.map(([y, r]) => radialRing(minaret.shaftTop + y, r, r, k, minaret.center)),
    colors.gold,
  );
}

function build(out, lod) {
  mainWalls(out, lod);
  westProjection(out, lod);
  roofHall(out, lod);
  domes(out, lod);
}
export const mosqueSkyline = (out) => build(out, 0);
export const mosqueDistrict = (out) => build(out, 1);
export const mosqueStreet = (out) => build(out, 2);
export const mosqueCloseup = (out) => build(out, 3);
const recipe = 'al-noor-mosque-model.mjs';
const camera = [-42, 20, 36],
  lookAt = [-1.6, 5.1, 2.4];
export const mosqueModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: mosqueCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Riccarton’s 2006 Al Noor Mosque with its low cream envelope, deep-green trim, gold dome and white-shaft minaret.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-29, 42, 29],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    outlines: [ring],
    minimumCoverage: 0.92,
    basis: 'Earliest mapped footprint of the mosque on Deans Avenue.',
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'metal_standing_seam',
    'metal_painted',
    'concrete_panel',
  ],
  qaCameras: [
    {
      name: 'gold-dome-and-green-west-panels',
      position: [-38, 3.5, 7.9],
      lookAt: [-13.7, 5.8, 3.2],
    },
    { name: 'deans-avenue-approach', position: [34, 7.9, 16], lookAt: [8.8, 3.9, 0] },
    { name: 'dome-minaret-and-roof-shoulders', position: [-18, 24, -27], lookAt: [-4.2, 6.5, 1.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'mosqueSkyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'mosqueDistrict', 0.46],
        ['street', 'mosqueStreet', 0.15],
        ['closeup', 'mosqueCloseup', 0.054],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped footprint is ODbL. The Qualla photograph is a lossless crop of the creator’s public-domain original.',
};
