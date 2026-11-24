import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const survey = read('native-map/wan-chai-market-native-survey');
const datum = read('terrain-grid').modelDatumElevationMeters;
const colors = {
  render: rgb('dddcd2'),
  concrete: rgb('b6b6ab'),
  soffit: rgb('adaea3'),
  darkEdge: rgb('3c4448'),
  trim: rgb('646c6c'),
  glazing: rgb('4a5959'),
  lowerGlass: rgb('3d4b4b'),
  plinth: rgb('8e9187'),
  tower: rgb('c0beb6'),
  towerLight: rgb('d7d5cb'),
  towerGlass: rgb('71807e'),
};
const surfaces = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92 },
  footing: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.82 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.91 },
};

function cap(out, slot, outline, y, color) {
  const points = outwardRing(outline);
  const indices = earcut(points.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]);
    tri(out, slot, a, c, b, color);
  }
}

function panel(out, slot, F, u0, u1, y0, y1, d, color) {
  quad4(out, slot, F.P(u0, y0, d), F.P(u1, y0, d), F.P(u1, y1, d), F.P(u0, y1, d), color);
}

function closedVolume(out, slot, ring, y0, y1, color) {
  const p = outwardRing(ring);
  for (let i = 0; i < p.length; i++) {
    const F = wallFace(p[i], p[(i + 1) % p.length]);
    panel(out, slot, F, 0, F.length, y0, y1, 0, color);
  }
  cap(out, 'roof', p, y1, color);
}

function inset(ring, ratio, center) {
  return ring.map(([x, z]) => [
    center[0] + (x - center[0]) * ratio,
    center[1] + (z - center[1]) * ratio,
  ]);
}

function sample(ring, levels, level) {
  return levels[level].map((i) => ring[i]);
}

function frontage(out, level) {
  const full = survey.localPodium;
  const indices = [
    [0, 9, 11, 13, 16, 19, 21, 23, 25, 28, 31, 35, 36, 37],
    [0, 3, 6, 9, 11, 12, 13, 14, 16, 18, 20, 22, 23, 24, 25, 27, 29, 31, 33, 35, 36, 37],
    full.map((_, i) => i),
    full.map((_, i) => i),
  ][level];
  const ground = full.map(([x, z]) => [-3.65 + (x > 15 && z < 10 ? 0.06 : 0)]);
  const wallTop = plan.dimensions.historicWallHeightM;
  const y0 = 4.62;
  for (let i = 0; i < indices.length; i++) {
    const j = indices[i],
      k = indices[(i + 1) % indices.length];
    const p = full[j],
      q = full[k];
    const F = wallFace(p, q);
    const center = (j + k) / 2;
    const historic = center >= 8.9 && center <= 31.2 && i !== indices.length - 1;
    const curve = center >= 13 && center <= 22.4;
    const low = ground[j][0];
    const base = historic ? 0.45 : 1.14;
    panel(out, 'footing', F, 0, F.length, low, base, 0, colors.plinth);
    panel(
      out,
      'render',
      F,
      0,
      F.length,
      base,
      wallTop,
      0,
      historic ? colors.render : colors.concrete,
    );
    if (!historic) {
      if (level > 0) {
        for (const h of [4.0, 8.15, 11.5]) {
          panel(out, 'glass', F, 0.02, F.length - 0.02, h, h + 1.95, 0.016, colors.glazing);
        }
      }
      continue;
    }
    const door = curve && center >= 15.0 && center <= 21.1;
    panel(
      out,
      'glass',
      F,
      0.013,
      F.length - 0.013,
      door ? 0.47 : 1.43,
      4.13,
      0.024,
      colors.lowerGlass,
    );
    const finLevels = curve ? [7.0, 9.28, 11.64] : [7.92, 11.64];
    for (const h of finLevels) {
      const high = h - 0.18;
      const bottom = curve ? h - 1.83 : h === 7.92 ? 4.96 : h - 2.26;
      panel(out, 'glass', F, 0.008, F.length - 0.008, bottom, high, 0.023, colors.glazing);
      if (level < 2) continue;
      const sections = Math.max(1, Math.round(F.length / (curve ? 0.95 : 0.73)));
      for (let j = 0; j < sections; j++) {
        const u = (F.length * (j + 0.22)) / sections;
        fbox(out, 'trim', F, u, u + 0.064, bottom, high, 0.021, 0.075, colors.trim);
      }
    }
    if (level > 1) {
      for (let u = 0.23; u < F.length; u += 1.27) {
        fbox(out, 'trim', F, u, u + 0.052, door ? 0.48 : 1.43, 4.13, 0.029, 0.075, colors.trim);
      }
    }
    if (level === 3 && curve) {
      const [x, z] = p;
      if ([16, 20].includes(j)) {
        lathe(
          out,
          'trim',
          [x + F.normal[0] * 0.61, z + F.normal[1] * 0.61],
          [
            [0.13, 0.44, 0.44],
            [4.37, 0.44, 0.44],
          ],
          12,
          colors.darkEdge,
        );
      }
    }
  }
  cap(
    out,
    'roof',
    indices.map((i) => full[i]),
    wallTop,
    colors.soffit,
  );
  fins(out, level, y0);
}

function offsetPath(points, projection) {
  return points.map((p, i) => {
    const a = points[Math.max(i - 1, 0)],
      b = points[Math.min(i + 1, points.length - 1)];
    const F = wallFace(a, b);
    const t = i / (points.length - 1);
    const length = projection * (0.73 + 0.27 * Math.sin(Math.PI * t));
    return [p[0] + F.normal[0] * length, p[1] + F.normal[1] * length];
  });
}

function ledge(out, points, y, projection, depth, level) {
  const expanded = offsetPath(points, projection);
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1],
      q = points[i],
      a = expanded[i - 1],
      b = expanded[i];
    quad4(
      out,
      'concrete',
      [a[0], y, a[1]],
      [b[0], y, b[1]],
      [q[0], y, q[1]],
      [p[0], y, p[1]],
      colors.render,
    );
    quad4(
      out,
      'concrete',
      [p[0], y - depth, p[1]],
      [q[0], y - depth, q[1]],
      [b[0], y - depth, b[1]],
      [a[0], y - depth, a[1]],
      colors.soffit,
    );
    const F = wallFace(a, b);
    panel(out, 'trim', F, 0, F.length, y - depth, y + 0.002, 0, colors.darkEdge);
    if (level === 3) {
      panel(out, 'trim', F, 0, F.length, y - depth + 0.034, y - depth + 0.07, 0.033, colors.trim);
    }
  }
}

function fins(out, level, mainY) {
  const ring = survey.localPodium;
  const indices = [
    [12, 14, 17, 20, 22, 24],
    [12, 13, 14, 16, 17, 19, 21, 22, 23, 24],
    [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  ][level];
  const corner = indices.map((i) => ring[i]);
  const smallProjection = [1.5, 1.35, 1.25];
  ledge(out, corner, mainY, plan.dimensions.mainCanopyProjectionM, 0.47, level);
  for (const [i, y] of plan.dimensions.marketBalconyFinsM.slice(1).entries()) {
    ledge(out, corner, y, smallProjection[i], i === 2 ? 0.32 : 0.22, level);
  }
  for (const i of [
    [8, 9, 11, 12],
    [24, 25, 26, 27, 29, 31],
  ]) {
    const sides = i.map((j) => ring[j]);
    for (const h of [4.62, 7.92, 11.64]) {
      ledge(out, sides, h, h === 4.62 ? 1.36 : 0.99, h === 4.62 ? 0.37 : 0.22, level);
    }
  }
  if (level < 2) return;
  const top = plan.dimensions.historicWallHeightM;
  for (let i = 0; i < corner.length - 1; i++) {
    const p = corner[i],
      q = corner[i + 1];
    const F = wallFace(p, q);
    beam(
      out,
      'trim',
      F.P(0, top + 0.81, -0.13),
      F.P(F.length, top + 0.81, -0.13),
      0.055,
      0.067,
      colors.trim,
    );
    if (i % 2 === 0) {
      fbox(out, 'trim', F, 0, 0.049, top, top + 0.82, -0.17, -0.11, colors.trim);
    }
  }
}

function foundationAndPodium(out, level) {
  const solid = survey.localPodium;
  const ring = sample(
    solid,
    [
      [0, 9, 11, 13, 16, 19, 21, 23, 25, 28, 31, 35, 36, 37],
      [0, 3, 6, 9, 11, 12, 13, 14, 16, 18, 20, 22, 23, 24, 25, 27, 29, 31, 33, 35, 36, 37],
      solid.map((_, i) => i),
      solid.map((_, i) => i),
    ],
    level,
  );
  const y = plan.dimensions.historicWallHeightM;
  const podium = inset(ring, 0.84, [3.0, -5.4]);
  const upper = plan.dimensions.towerSurveyBaseHKPD - datum + 0.52;
  closedVolume(out, 'concrete', podium, y - 0.11, upper, colors.concrete);
  if (level === 0) return;
  for (let i = 0; i < podium.length; i++) {
    const F = wallFace(podium[i], podium[(i + 1) % podium.length]);
    if (F.length < 1.7) continue;
    for (const low of [y + 0.88, y + 3.7]) {
      panel(out, 'glass', F, 0.025, F.length - 0.025, low, low + 1.34, 0.025, colors.towerGlass);
      panel(out, 'trim', F, 0, F.length, low + 1.35, low + 1.52, 0.04, colors.towerLight);
    }
  }
}

function tower(out, level) {
  const full = survey.localTower;
  const ring = outwardRing(
    sample(
      full,
      [
        [0, 3, 4, 8, 14, 18, 22, 25, 31, 33, 34, 35, 37, 41, 46, 48, 49, 52, 57, 59],
        [
          0, 1, 3, 4, 7, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 31, 33, 34, 35, 37, 40, 43, 46, 48,
          49, 50, 52, 55, 57, 59,
        ],
        full.map((_, i) => i),
        full.map((_, i) => i),
      ],
      level,
    ),
  );
  const base = plan.dimensions.towerSurveyBaseHKPD - datum;
  const roof = plan.dimensions.towerSurveyTopHKPD - datum;
  const eave = roof - 2.15;
  closedVolume(out, 'concrete', ring, base - 0.25, eave, colors.tower);
  const roofPlan = outwardRing(inset(ring, 0.87, [-0.5, -0.75]));
  closedVolume(out, 'render', roofPlan, eave - 0.14, roof, colors.towerLight);
  const stories = plan.dimensions.towerSurveyStoreys;
  const spacing = (eave - (base + 1.44)) / stories;
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (F.length < 0.65) continue;
    const u = Math.min(0.18, F.length * 0.17);
    const exteriorColor = i % 3 === 0 ? colors.glazing : colors.towerGlass;
    if (level === 0) {
      if (F.length > 1.1)
        panel(out, 'glass', F, u, F.length - u, base + 4.55, eave - 2.17, 0.017, exteriorColor);
      continue;
    }
    if (level === 1) {
      panel(out, 'glass', F, u, F.length - u, base + 2.3, eave - 1.7, 0.018, exteriorColor);
      for (let j = 0; j < stories; j += 3) {
        const y = base + 1.55 + j * spacing;
        panel(out, 'trim', F, 0, F.length, y, y + 0.41, 0.047, colors.towerLight);
      }
      continue;
    }
    for (let j = 0; j < stories; j++) {
      const y = base + 1.44 + j * spacing;
      panel(out, 'glass', F, u, F.length - u, y + 0.44, y + spacing - 0.56, 0.02, exteriorColor);
      panel(out, 'trim', F, 0, F.length, y + 0.19, y + 0.44, 0.062, colors.towerLight);
      if (level === 3 && F.length >= 2.6) {
        panel(
          out,
          'trim',
          F,
          F.length * 0.53 - 0.03,
          F.length * 0.53 + 0.03,
          y + 0.44,
          y + spacing - 0.56,
          0.029,
          colors.trim,
        );
        if (i % 3 === 0)
          panel(out, 'trim', F, u, F.length - u, y + 0.91, y + 1.03, 0.076, colors.towerLight);
      }
    }
  }
}

function build(out, level) {
  frontage(out, level);
  foundationAndPodium(out, level);
  tower(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'old-wanchai-market-building-model.mjs';
const camera = [-163, 117, 178],
  lookAt = [0, 67, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Old Wan Chai Market Building',
  wikidataId: plan.wikidataId,
  category: 'historic-market',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1937 Streamline Moderne entrance of Old Wan Chai Market retained beneath the pale-grey One Wanchai tower.',
  camera,
  lookAt,
  sunDirection: [-45, 66, 76],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Current One Wanchai podium including the retained market corner.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'stone_granite'],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'retained-market-entrance', position: [-43, 7, 53], lookAt: [-11, 7.2, 16] },
    { name: 'queen-road-east-frontage', position: [24, 18, 52], lookAt: [-9, 10, 16] },
    { name: 'modern-tower-and-podium', position: [-139, 102, 119], lookAt: [0, 71, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'old-wanchai-market-building-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.71,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.28, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.04, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under repository license. Terrain and measured plan from the Hong Kong Lands Department under the Hong Kong Government open data terms.',
};
