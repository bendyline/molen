/** Marina Bay's ArtScience Museum, modeled as ten individually curved gallery petals. */
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
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline, pavilion] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const surfaces = {
  shell: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.04 },
  skin: { slot: 'wall', graph: 'metal_painted', roughness: 0.83, metallic: 0.04 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.17 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.16 },
  pond: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.39, metallic: 0.13 },
};
const colors = {
  white: rgb('dedbd1'),
  underside: rgb('cbc7bb'),
  rim: rgb('ece9e1'),
  side: rgb('d4d0c5'),
  metal: rgb('656b69'),
  cross: rgb('c2c0b4'),
  inner: rgb('a9a699'),
  glass: rgb('70928d'),
  shadow: rgb('506765'),
  stone: rgb('a7a599'),
  pool: rgb('697b72'),
  canopy: rgb('b7b9ae'),
};
const center = [-0.8, -0.45];
const { oculusRadius, outerRimPairs, petalHeights } = plan.section;
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const p3 = ([x, z], y) => [x, y, z];
const petals = outerRimPairs.map(([a, b], i) => {
  const rim = [outline[a], outline[b]],
    tip = between(...rim, 0.5);
  const diff = tip.map((v, j) => v - center[j]),
    r = Math.hypot(...diff),
    direction = diff.map((v) => v / r);
  return { rim, tip, direction, height: petalHeights[i] };
});
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function sideFace(out, slot, points, normal, color) {
  const [a, b, c, d] = points;
  for (const tri of [
    [a, b, c],
    [a, c, d],
  ]) {
    triangle(out, slot, dot(normalFor(...tri), normal) > 0 ? tri : tri.toReversed(), color);
  }
}

function petalSection(data) {
  const { rim, tip, direction, height } = data;
  const across = [-direction[1], direction[0]];
  const edges = rim.toSorted((a, b) => dot(a, across) - dot(b, across));
  const radial = (scale) => center.map((v, i) => v + direction[i] * scale);
  const sideWidth = Math.min(Math.hypot(...rim[0].map((v, i) => v - rim[1][i])) / 2, 11.7);
  const top = (t, u) => {
    const w0 = oculusRadius * 0.29,
      w = sideWidth * Math.sin(Math.PI * t * 0.61);
    const start = radial(oculusRadius),
      end = between(...edges, u);
    const centerPoint = between(start, tip, t);
    const taper = w0 * (1 - t) + w + 2.2 * Math.sin(Math.PI * t);
    const spread = centerPoint.map((v, i) => v + (u * 2 - 1) * across[i] * taper);
    const xyz = between(spread, between(start, end, t), Math.pow(t, 4));
    const bend = 0.12 * t + 0.21 * t * t + 0.67 * Math.pow(t, 3.1);
    const topHeight =
      mix(17.2, height, bend) + 1.35 * Math.sin(Math.PI * t) * (1 - (u * 2 - 1) * (u * 2 - 1));
    return p3(xyz, topHeight);
  };
  const bottom = (t, u) => {
    const start = radial(oculusRadius + 0.45),
      end = between(...edges, u);
    const belly = 0.68 * t + 0.32 * t * t;
    const projected = between(start, end, belly);
    const slimmer = 1.8 * Math.sin(Math.PI * t) * (1 - Math.abs(u * 2 - 1));
    const rootWidth = (oculusRadius * 0.27 * (1 - t) + 2.7 * Math.sin(Math.PI * t)) * (2 * u - 1);
    const xy = projected.map((v, i) => v + direction[i] * slimmer + across[i] * rootWidth);
    const rise = 0.22 * t * t + 0.78 * Math.pow(t, 3.6);
    const deep = height < 40 ? 4.9 : 3.9;
    return p3(
      xy,
      mix(11.9, height - deep, rise) - 1.9 * Math.sin(Math.PI * t) * (1 - Math.abs(u * 2 - 1)),
    );
  };
  return { top, bottom, direction, across, height };
}
const sections = petals.map(petalSection);

function petal(out, section, lod) {
  const { top, bottom, direction, across, height } = section;
  const rows = [3, 7, 11, 15][lod],
    cols = [2, 3, 5, 8][lod];
  for (let i = 0; i < rows; i++) {
    const t0 = i / rows,
      t1 = (i + 1) / rows;
    for (let j = 0; j < cols; j++) {
      const u0 = j / cols,
        u1 = (j + 1) / cols;
      const topSkin = [top(t0, u0), top(t1, u0), top(t1, u1), top(t0, u1)];
      const bottomSkin = [bottom(t0, u0), bottom(t1, u0), bottom(t1, u1), bottom(t0, u1)];
      sideFace(out, 'shell', topSkin, [0, 1, 0], colors.white);
      sideFace(out, 'skin', bottomSkin, [0, -1, 0], colors.underside);
    }
    for (const k of [0, 1]) {
      const n = across.map((v) => v * (k === 0 ? -1 : 1));
      sideFace(
        out,
        'skin',
        [top(t0, k), top(t1, k), bottom(t1, k), bottom(t0, k)],
        [n[0], 0, n[1]],
        colors.side,
      );
    }
  }
  const n = [direction[0], 0, direction[1]];
  for (let j = 0; j < cols; j++) {
    const u0 = j / cols,
      u1 = (j + 1) / cols;
    const a = top(1, u0),
      b = top(1, u1),
      c = bottom(1, u1),
      d = bottom(1, u0);
    if (height >= 44) {
      sideFace(out, 'skin', [a, b, c, d], n, colors.white);
      continue;
    }
    const tint = height > 37 ? colors.shadow : colors.glass;
    const glaze = [
      between(a, d, 0.15),
      between(b, c, 0.15),
      between(b, c, 0.87),
      between(a, d, 0.87),
    ];
    const near = (p) => p.map((v, i) => v + n[i] * 0.027);
    sideFace(out, 'skin', [a, b, glaze[1], glaze[0]], n, colors.rim);
    sideFace(out, 'glass', glaze, n, tint);
    sideFace(out, 'skin', [glaze[3], glaze[2], c, d], n, colors.rim);
    if (lod > 1 && j > 0) {
      const stripWidth = 0.026 * cols;
      const e = near(glaze[0]),
        f = near(glaze[3]);
      sideFace(
        out,
        'steel',
        [
          e,
          near(between(glaze[0], glaze[1], stripWidth)),
          near(between(glaze[3], glaze[2], stripWidth)),
          f,
        ],
        n,
        colors.metal,
      );
    }
  }
}

function connectShells(out, lod) {
  const rows = [3, 7, 11, 15][lod];
  const join = Math.round(rows * 0.65);
  for (let i = 0; i < sections.length; i++) {
    const a = sections[i],
      b = sections[(i + 1) % sections.length];
    for (let j = 0; j < join; j++) {
      const t0 = j / rows,
        t1 = (j + 1) / rows;
      const seam = (curve) => [a[curve](t0, 1), a[curve](t1, 1), b[curve](t1, 0), b[curve](t0, 0)];
      sideFace(out, 'shell', seam('top'), [0, 1, 0], colors.white);
      sideFace(out, 'skin', seam('bottom'), [0, -1, 0], colors.underside);
    }
    const t = join / rows;
    const points = [a.top(t, 1), b.top(t, 0), b.bottom(t, 0), a.bottom(t, 1)];
    sideFace(
      out,
      'skin',
      points,
      [a.direction[0] + b.direction[0], 0, a.direction[1] + b.direction[1]],
      colors.side,
    );
  }
}

function floorAt([x, z]) {
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
function support(out, lod) {
  const nodes = [8, 16, 22, 30][lod];
  const round = (r, y) => radialRing(y, r, r, nodes, center);
  loft(out, 'stone', [round(8.1, -6.1), round(8.1, 0.3), round(7.6, 1.4)], colors.inner);
  loft(out, 'glass', [round(6.25, 0.97), round(6.12, 11.86), round(6.34, 13.2)], colors.shadow, {
    cap: false,
  });
  loft(out, 'shell', [round(6.09, 15.55), round(6.2, 16.78), round(6.8, 17.24)], colors.rim, {
    cap: false,
  });
  const basal = radialRing(0, 7.2, 7.2, 10, center),
    crown = radialRing(13.5, 8.7, 8.7, 10, center);
  for (let i = 0; i < petals.length; i++) {
    const { direction } = petals[i],
      a = center.map((v, j) => v + direction[j] * 10.7);
    const b = center.map((v, j) => v + direction[j] * 15.2);
    const f = floorAt(a);
    beam(out, 'steel', p3(a, f - 0.48), p3(b, 12.5), 1.14, 1.05, colors.metal);
    if (lod) {
      for (const side of [-1, 1]) {
        const start = basal[(i + side + 10) % 10],
          end = crown[i];
        beam(
          out,
          'steel',
          [start[0], floorAt([start[0], start[2]]) - 0.36, start[2]],
          end,
          0.28,
          0.27,
          colors.cross,
        );
      }
    }
  }
}

function lobby(out, lod) {
  const winding = pavilion.reduce((sum, a, i) => {
    const b = pavilion[(i + 1) % pavilion.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
  const roof = (a) => p3(a, 4.28);
  const idx = earcut(pavilion.flat());
  for (let i = 0; i < idx.length; i += 3) {
    const p = idx.slice(i, i + 3).map((k) => roof(pavilion[k]));
    triangle(out, 'shell', normalFor(...p)[1] > 0 ? p : p.toReversed(), colors.canopy);
  }
  for (let i = 0; i < pavilion.length; i++) {
    const a = pavilion[i],
      b = pavilion[(i + 1) % pavilion.length],
      d = b.map((v, j) => v - a[j]),
      len = Math.hypot(...d);
    const normal = [(Math.sign(winding) * d[1]) / len, 0, (-Math.sign(winding) * d[0]) / len];
    const shallow = (a, b, h) => [
      p3(a, Math.min(floorAt(a) - 0.4, 0.8)),
      p3(b, Math.min(floorAt(b) - 0.4, 0.8)),
      p3(b, h),
      p3(a, h),
    ];
    sideFace(out, 'glass', shallow(a, b, 3.91), normal, colors.glass);
    sideFace(out, 'shell', [p3(a, 3.88), p3(b, 3.88), roof(b), roof(a)], normal, colors.canopy);
    if (lod) {
      const n = Math.ceil(len / 3);
      for (let k = 0; k < n; k++) {
        const p = between(a, b, k / n),
          base = floorAt(p) - 0.36;
        beam(out, 'steel', p3(p, Math.min(base, 0.82)), p3(p, 4.04), 0.105, 0.11, colors.metal);
      }
    }
  }
}

function foundation(out, lod) {
  const n = [12, 20, 30, 40][lod],
    ring = (y, rx, rz) => radialRing(y, rx, rz, n, center);
  const y = -4.75;
  loft(
    out,
    'stone',
    [ring(-6.88, 21, 24), ring(y, 21, 24), ring(y + 0.21, 21.12, 24.12)],
    colors.stone,
    { cap: false },
  );
  loft(out, 'pond', [ring(y + 0.1, 19.9, 22.8), ring(y + 0.21, 19.8, 22.7)], colors.pool);
}
function build(out, lod) {
  for (const section of sections) petal(out, section, lod);
  connectShells(out, lod);
  foundation(out, lod);
  support(out, lod);
  lobby(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const camera = [-128, 62, 87],
  lookAt = [0, 24, 0],
  recipe = 'artscience-museum-model.mjs';
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
    'structure-mesh.mjs',
  ],
  surfaces,
  category: 'landmark',
  build: museumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Singapore’s ArtScience Museum with ten white gallery petals, a central rainwater oculus and splayed steel supports above the waterfront.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-80, 112, 25],
  portableGroundY: -4.6,
  mediumFiContext: {
    scale: 1.03,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.87,
    basis: 'Mapped upper museum perimeter centered over the support structure.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'west-bay-ten-white-petals', position: [-121, 20, 24], lookAt: [0, 25, 0] },
    {
      name: 'splayed-columns-and-glazed-finger-ends',
      position: [-62, 11, 49],
      lookAt: [-3, 20, 0],
    },
    { name: 'oculus-and-asymmetrical-roof', position: [-7, 108, -45], lookAt: [0, 22, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `lotus-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.94,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.49],
        ['street', 'museumStreet', 0.18],
        ['closeup', 'museumCloseup', 0.079],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap data is ODbL. The exact Qualla view from Merlion Park is CC0 own work by 玄史生.',
};
