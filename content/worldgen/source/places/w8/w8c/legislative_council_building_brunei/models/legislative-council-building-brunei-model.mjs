import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  palette,
  panel,
  pairs,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  cream: 'c8bd9f',
  trim: 'e0d5b9',
  sill: 'a9a087',
  band: 'b1a085',
  roof: '9f9278',
  blue: '56839f',
  pale: '6c96a9',
  deep: '467387',
  glass: '465e64',
  green: '5e7165',
  stone: '827b65',
  drive: '77786e',
  door: '6c604e',
  bronze: 'a99167',
});
const surfaces = {
  walls: surface('wall', 'plaster_lime', 0.93),
  trim: surface('trim', 'stone_limestone', 0.91),
  base: surface('foundation', 'stone_ashlar', 0.94),
  roof: surface('roof', 'metal_standing_seam', 0.84, 0.18),
  window: surface('window', 'window_grid', 0.71),
  decoration: surface('trim', 'metal_bronze_cast', 0.86, 0.22),
};
const footprint = d.outline;
const housing = [...footprint.slice(0, 28), ...footprint.slice(37)];
const chamberCenter = [-2.1, -5.5];
const floors = [1.62, 5.92, 10.32, 14.72];

function layer(out, outline, bottom, top, role, color) {
  shell(out, outline, typeof bottom === 'function' ? bottom : () => bottom, top, {
    wall: role,
    color,
  });
}

function archLight(out, w, x, base, spring, height, width, lod) {
  const n = lod === 1 ? 4 : lod === 2 ? 6 : 8;
  const curve = Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI - (i * Math.PI) / n;
    return [x + width * 0.5 * Math.cos(a), spring + height * Math.sin(a)];
  });
  face(
    out,
    'window',
    [[x - width * 0.5, base], ...curve, [x + width * 0.5, base]].map(([u, y]) => w.p(u, y, 0.064)),
    w.normal,
    colors.glass,
  );
  if (lod < 2) return;
  beamPath(
    out,
    'trim',
    curve.map(([u, y]) => w.p(u, y, 0.095)),
    0.092,
    0.105,
    colors.trim,
  );
  panel(
    out,
    'trim',
    w,
    x - width * 0.52,
    x + width * 0.52,
    base - 0.05,
    base + 0.032,
    0.098,
    colors.sill,
  );
  if (lod === 3)
    panel(
      out,
      'trim',
      w,
      x - 0.031,
      x + 0.031,
      base + 0.01,
      spring + 0.85 * height,
      0.095,
      colors.sill,
    );
}

function councilWings(out, lod) {
  layer(
    out,
    housing,
    (p) => Math.min(grade(p) - 0.64, d.mainBase - 0.42),
    3.06,
    'base',
    colors.stone,
  );
  layer(out, housing, 3.06, d.wingRoof, 'walls', colors.cream);
  layer(out, housing, d.wingRoof - 0.26, d.wingRoof + 0.04, 'roof', colors.roof);
  if (lod === 0) return;
  const sign = areaSign(housing);
  for (const [[a, b], index] of pairs(closed(housing)).map((e, i) => [e, i])) {
    const w = edge(a, b, sign);
    if (w.length < 3) continue;
    const count = Math.max(1, Math.round(w.length / [0, 7, 5.1, 4.08][lod]));
    for (const y of [5.27, 9.77, 14.17, 18.75])
      panel(out, 'trim', w, 0, w.length, y, y + 0.17, 0.036, colors.band);
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * w.length) / count;
      const t = x + (w.length / count) * 0.44;
      if (lod > 1 && t < w.length - 0.17)
        trimBlock(out, 'trim', w, t - 0.17, t + 0.17, 6, 18.71, 0.006, 0.14, colors.trim);
      for (const [k, y] of floors.entries()) {
        const p = w.p(x, y - 0.73);
        if (grade([p[0], p[2]]) > y + 0.3) continue;
        const width = lod === 1 ? 1.96 : 1.59;
        if (k === 3 && w.normal[2] > 0.67) archLight(out, w, x, y, y + 1.81, 0.59, width, lod);
        else
          opening(
            out,
            w,
            x - width * 0.5,
            x + width * 0.5,
            y,
            y + 2.25,
            'trim',
            index % 5 === 0 ? colors.green : colors.glass,
            'window',
            colors.sill,
            lod - 1,
            0.059,
          );
      }
    }
  }
}

function drumFront(out, lod) {
  const chamber = rect(-20.13, 27.4, 17.21, -32.8);
  layer(out, chamber, d.wingRoof - 0.06, 23.3, 'walls', colors.cream);
  layer(out, rect(-20.45, 27.72, 17.55, -33.15), 23.01, 23.47, 'trim', colors.trim);
  const n = [14, 22, 29, 29][lod];
  const drumBase = 23.23;
  const r = 15.65;
  ring(
    out,
    'walls',
    chamberCenter,
    [
      [drumBase, r + 0.13],
      [d.domeSpring - 0.32, r],
      [d.domeSpring, r + 0.12],
    ],
    n,
    colors.cream,
  );
  const radii =
    lod === 0
      ? [
          [0, 1],
          [0.55, 0.877],
          [0.86, 0.56],
          [1, 0.018],
        ]
      : [
          [0, 1],
          [0.12, 0.995],
          [0.27, 0.967],
          [0.42, 0.907],
          [0.55, 0.831],
          [0.69, 0.704],
          [0.81, 0.57],
          [0.9, 0.421],
          [0.96, 0.27],
          [1, 0.021],
        ];
  const sides = [18, 24, 40, 52][lod];
  ring(
    out,
    'roof',
    chamberCenter,
    radii.map(([t, q]) => [mix(d.domeSpring, d.domeApex, t), (r + 0.11) * q]),
    sides,
    colors.blue,
  );
  if (lod === 0) return;
  const openings = lod === 1 ? 15 : d.domeOpenings;
  for (let i = 0; i < openings; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / openings,
      c = Math.cos(a),
      s = Math.sin(a);
    const q = r + 0.056;
    const w = {
      normal: [c, 0, s],
      p: (u, y, o = 0) => [
        chamberCenter[0] + (q + o) * c - u * s,
        y,
        chamberCenter[1] + (q + o) * s + u * c,
      ],
    };
    archLight(out, w, 0, drumBase + 0.7, d.domeSpring - 1.63, 0.76, 1.33, lod);
    if (lod > 1)
      trimBlock(
        out,
        'trim',
        w,
        1.1,
        1.29,
        drumBase + 0.63,
        d.domeSpring - 0.28,
        0.002,
        0.14,
        colors.trim,
      );
  }
  if (lod > 1) {
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI) / 10;
      const p = radii
        .slice(0, -1)
        .map(([t, q]) => [
          chamberCenter[0] + (r + 0.17) * q * Math.cos(a),
          mix(d.domeSpring, d.domeApex, t) + 0.023,
          chamberCenter[1] + (r + 0.17) * q * Math.sin(a),
        ]);
      if (lod === 3) beamPath(out, 'roof', p, 0.054, 0.05, colors.pale);
    }
    ring(
      out,
      'decoration',
      chamberCenter,
      [
        [d.domeApex - 0.09, 0.35],
        [d.domeApex + 0.16, 0.37],
        [d.domeApex + 0.55, 0.138],
        [d.domeApex + 1.22, 0.044],
      ],
      8,
      colors.bronze,
    );
  }
  const front = plane(27.4, 1);
  for (const x of [-15.7, -11.2, -6.7, -2.22, 2.24, 6.72, 11.2, 15.53])
    archLight(out, front, x, d.wingRoof + 0.24, d.wingRoof + 2.78, 0.76, 1.99, lod);
}

function column(out, x, z, width, top, lod) {
  const y = grade([x, z]) - 0.16;
  if (lod === 0) {
    block(out, 'trim', x - width / 2, y, z - width / 2, width, top - y, width, colors.trim);
    return;
  }
  const n = lod === 1 ? 6 : lod === 2 ? 8 : 10;
  const r = 0.48 * width;
  ring(
    out,
    'trim',
    [x, z],
    [
      [y, r * 1.24],
      [y + 0.34, r * 1.24],
      [y + 0.58, r],
      [top - 0.79, r * 0.88],
      [top - 0.46, r * 0.91],
      [top - 0.25, r * 1.18],
      [top, r * 1.23],
    ],
    n,
    colors.trim,
  );
  if (lod < 2) return;
  const w = plane(z + r * 0.93, 1);
  for (const off of [-0.16, 0, 0.16])
    panel(
      out,
      'decoration',
      w,
      x + off - 0.018,
      x + off + 0.019,
      top - 1.28,
      top - 0.63,
      0.018,
      colors.bronze,
    );
}

function entrance(out, lod) {
  const y = d.porticoRoof;
  const entryTop = rect(-16.86, 62.81, 12.42, 43.034);
  const upper = rect(-12.595, 75.26, 8.1, 62.78);
  layer(out, entryTop, y - 1.21, y, 'walls', colors.cream);
  layer(out, entryTop, y - 0.29, y + 0.06, 'trim', colors.trim);
  layer(out, upper, y - 1.18, y - 0.26, 'walls', colors.cream);
  layer(out, upper, y - 0.89, y - 0.25, 'trim', colors.trim);
  const [short, long] = d.ceremonialColumnGroups;
  for (let i = 0; i < short; i++)
    column(out, mix(-11.33, 6.87, i / (short - 1)), 74.23, 0.92, y - 1.05, lod);
  for (let i = 0; i < long; i++)
    column(out, mix(-15.92, 11.42, i / (long - 1)), 50.25, 0.8, y - 1.13, lod);
  for (const x of [-15.95, 11.47]) column(out, x, 61.63, 1.02, y - 1.14, lod);
  const platform = rect(-15.78, 52.38, 11.48, 43.041);
  layer(out, platform, (p) => Math.min(grade(p) - 0.21, 5.36), 6.25, 'base', colors.stone);
  stairs(out, grade, 'base', -10.53, 6.31, 57.5, 52.29, 6.24, lod === 0 ? 3 : 7, colors.sill);
  const f = plane(43.068, 1);
  panel(out, 'trim', f, -14.6, 10.11, 6.24, 12.03, 0.076, colors.trim);
  for (const x of [-10.15, -6.17, -2.18, 1.8, 5.78]) {
    panel(out, 'window', f, x - 0.85, x + 0.85, 6.32, 10.28, 0.116, colors.door);
    if (lod > 1) panel(out, 'trim', f, x - 0.035, x + 0.035, 6.32, 10.24, 0.15, colors.trim);
  }
  if (lod > 0) {
    const crest = plane(75.272, 1);
    panel(out, 'trim', crest, -8.5, 4.01, y - 1.06, y - 0.81, 0.056, colors.band);
    if (lod > 1)
      for (let i = 0; i < 15; i++) {
        const x = -8.32 + i * 0.865;
        panel(
          out,
          'decoration',
          crest,
          x - 0.068,
          x + 0.068,
          y - 1.023,
          y - 0.852,
          0.081,
          colors.bronze,
        );
      }
  }
}

function build(out, lod) {
  councilWings(out, lod);
  drumFront(out, lod);
  entrance(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'legislative-council-building-brunei-model.mjs';
const camera = [156, 73, 188],
  lookAt = [-1, 12, 13];
export const councilBuildingModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'civic-institutional',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The named native 40-corner footprint and the covered public drive establish orientation. The portico columns and lower plinth reach the independent grade.',
  brief:
    'Four-storey Legislative Council Building overlooking Bandar Seri Begawan, with a domed central chamber, two wings and a ceremonial drive under the columned portico.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-54, 76, 66],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis:
      'The named civic building outline and attached ceremonial canopy define the replacement.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'porte-cochere-and-council-dome', position: [36, 20, 108], lookAt: [-2, 13, 49] },
    { name: 'two-wings-and-dome-from-approach', position: [104, 44, 149], lookAt: [-1, 13, 15] },
    { name: 'rear-wings-and-drum', position: [103, 57, -137], lookAt: [0, 13, -8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'council-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.5, surfaces },
      street: { export: 'street', errorMeters: 0.23, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.071, surfaces },
    },
  },
};
