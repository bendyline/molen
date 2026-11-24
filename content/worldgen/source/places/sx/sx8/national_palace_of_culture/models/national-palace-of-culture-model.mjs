import fs from 'node:fs';
import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const [envelope, upper, rearWest, rearEast, shoulderEast, shoulderWest, service] = frame.features;
const tint = {
  light: rgb('c0b6a3'),
  pier: rgb('c8bdac'),
  base: rgb('8a8379'),
  stone: rgb('a3988a'),
  trim: rgb('554b41'),
  shadow: rgb('303433'),
  roof: rgb('4f514c'),
  balcony: rgb('706257'),
  glass: [rgb('485455'), rgb('465152'), rgb('535958'), rgb('554e48'), rgb('454946')],
};
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_panel', roughness: 0.92 },
  pier: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.11 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.31, metallic: 0.08 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.09 },
};

const hall = outwardRing([0, 4, 5, 6, 9, 10, 12, 13, 16, 17].map((i) => upper.points[i]));
const frontEdge = (a, b) => Math.min(a[1], b[1]) > 56;
const plazaEdge = (a, b) => Math.max(a[1], b[1]) > 55;
const podiumHeight = 4.5;
const rimHeight = 31.1;

function inset(ring, scale, center = [-3.6, 13.7]) {
  return ring.map(([x, z]) => [
    center[0] + (x - center[0]) * scale,
    center[1] + (z - center[1]) * scale,
  ]);
}

function volume(out, slot, ring, bottom, top, color, cap = {}) {
  extrude(out, slot, ring, bottom, top, color, { top: false });
  if (cap.top === false) return;
  const indices = triangulate(ring.flat());
  const point = (i) => [ring[i][0], top, ring[i][1]];
  for (let i = 0; i < indices.length; i += 3) {
    tri(
      out,
      cap.topSlot ?? slot,
      point(indices[i]),
      point(indices[i + 2]),
      point(indices[i + 1]),
      cap.topColor ?? color,
    );
  }
}

function shell(out, outer, profiles, sideTint, topTint) {
  const rings = profiles.map(([y, scale]) => inset(outer, scale).map(([x, z]) => [x, y, z]));
  loft(out, 'roof', rings, sideTint, { cap: false });
  const top = rings.at(-1).map(([x, , z]) => [x, z]);
  volume(out, 'roof', top, profiles.at(-1)[0] - 0.08, profiles.at(-1)[0], topTint);
}

function block(out, slot, lo, hi, color) {
  abox(out, slot, lo, hi, color, { bottom: false });
}

function glazed(out, f, x0, x1, y0, y1, d, color) {
  quad4(out, 'glass', f.P(x0, y0, d), f.P(x1, y0, d), f.P(x1, y1, d), f.P(x0, y1, d), color);
}

function forFaces(ring, fn) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    fn(wallFace(a, b), a, b, i);
  }
}

function podium(out, level) {
  if (level === 0) {
    volume(out, 'base', envelope.points, -1.15, podiumHeight, tint.base);
  } else {
    volume(out, 'base', envelope.points, -1.15, 1.65, tint.base, { top: false });
    volume(out, 'wall', envelope.points, 1.65, podiumHeight - 0.19, tint.stone, { top: false });
    volume(out, 'pier', envelope.points, podiumHeight - 0.19, podiumHeight, tint.light);
  }
  const steps = level === 0 ? 2 : 6;
  for (let i = 0; i < steps; i++) {
    const y = 0.16 + (i * 0.68) / steps;
    const z = 80.54 - (i * 3.9) / steps;
    block(out, 'base', [-22.25, -0.27, z - 1.2], [16.32, y, z + 0.63], tint.light);
  }
  if (level > 1) {
    const f = wallFace([-23.3, 76.62], [17.4, 76.62]);
    for (let i = 0; i <= 18; i++) {
      const u = (i * f.length) / 18;
      fbox(out, 'trim', f, u - 0.041, u + 0.041, 0.26, 1.69, 0.05, 0.13, tint.trim);
    }
  }
}

function lowerVolumes(out, level) {
  const wings = [
    { part: rearWest, top: 10.4 },
    { part: rearEast, top: 10.4 },
    { part: shoulderEast, top: 5.35 },
    { part: shoulderWest, top: 5.35 },
    { part: service, top: 12.7 },
  ];
  for (const { part, top } of wings) {
    const ring = outwardRing(part.points);
    if (level === 0) {
      volume(out, 'wall', ring, podiumHeight - 0.25, top, tint.light, {
        topSlot: 'roof',
        topColor: tint.roof,
      });
      continue;
    }
    volume(out, 'wall', ring, podiumHeight - 0.25, top - 0.32, tint.light, { top: false });
    volume(out, 'pier', ring, top - 0.32, top, tint.light, {
      topSlot: 'roof',
      topColor: tint.roof,
    });
    if (top < 6) continue;
    forFaces(ring, (f, a, b) => {
      if (f.length < 11 || Math.min(a[1], b[1]) > 3) return;
      const n = Math.round(f.length / 4.8);
      const bay = f.length / n;
      for (let i = 0; i < n; i++) {
        const x0 = (i + 0.16) * bay;
        glazed(out, f, x0, x0 + bay * 0.59, 6.05, top - 1.6, 0.03, tint.glass[i % 5]);
      }
    });
  }
}

function hallWall(out, level) {
  forFaces(hall, (f, a, b, face) => {
    const front = frontEdge(a, b);
    const plaza = plazaEdge(a, b);
    const divisions = Math.max(1, Math.round(f.length / (front ? 3.75 : 6.15)));
    const span = f.length / divisions;
    const bottom = podiumHeight + 0.04;
    const glassTop = rimHeight - 1.08;
    if (level === 0) {
      glazed(out, f, 0.14, f.length - 0.13, bottom + 0.3, glassTop, 0.085, tint.glass[0]);
    }
    for (let i = 0; i < divisions; i++) {
      const u = (i + 0.5) * span;
      const end = (i + 1) * span;
      const glaze = tint.glass[(i + face) % 5];
      if (level > 0) {
        const insetWidth = span * 0.45;
        glazed(out, f, u - insetWidth, u + insetWidth, bottom + 1.47, glassTop, 0.075, glaze);
        if (level > 1) {
          for (const y of [9.5, 14.1, 18.6, 23.1, 27.2]) {
            fbox(
              out,
              'trim',
              f,
              u - insetWidth,
              u + insetWidth,
              y,
              y + 0.13,
              0.073,
              0.31,
              tint.trim,
            );
          }
        }
        if (level > 2 && !front) {
          for (const x of [u - span * 0.16, u + span * 0.16]) {
            fbox(
              out,
              'trim',
              f,
              x - 0.055,
              x + 0.055,
              bottom + 1.47,
              glassTop,
              0.1,
              0.34,
              tint.trim,
            );
          }
        }
      }
      if (!front && (level > 0 ? plaza || i % 2 === 0 : plaza && i % 3 === 0)) {
        const halfPier = plaza ? 0.73 : 0.86;
        fbox(
          out,
          'pier',
          f,
          end - halfPier * 2,
          end - 0.02,
          bottom + 1.1,
          glassTop + 0.27,
          0.021,
          plaza ? 1.19 : 0.76,
          tint.pier,
        );
      }
    }
    fbox(out, 'pier', f, 0, f.length, bottom - 0.2, bottom + 1.18, 0, 1.06, tint.light);
    fbox(
      out,
      'trim',
      f,
      0,
      f.length,
      glassTop + 0.12,
      rimHeight + 0.22,
      0.05,
      plaza ? 1.73 : 0.89,
      tint.shadow,
    );
    if (front && f.length > 23) {
      glazed(out, f, 0.45, f.length - 0.45, 0.73, 3.91, 0.24, tint.glass[4]);
      fbox(out, 'trim', f, 0.21, f.length - 0.21, 3.92, 4.44, 0.1, 1.35, tint.balcony);
      fbox(out, 'pier', f, f.length * 0.32, f.length * 0.68, 19.9, 30.0, 0.16, 0.91, tint.light);
      fbox(out, 'pier', f, f.length * 0.1, f.length * 0.9, 9.85, 11.1, 0.14, 0.67, tint.light);
      for (const ratio of [0.18, 0.82]) {
        const u = f.length * ratio;
        fbox(out, 'trim', f, u - 0.28, u + 0.28, 7.2, 30.1, 0.19, 0.56, tint.trim);
      }
      if (level > 0) {
        for (let i = 0; i < 9; i++) {
          const u = ((i + 0.5) * f.length) / 9;
          glazed(out, f, u - 1.48, u + 1.48, 0.74, 3.85, 0.28, tint.glass[i % 5]);
          fbox(out, 'trim', f, u - 0.055, u + 0.055, 0.74, 3.92, 0.3, 0.36, tint.trim);
        }
      }
    }
  });
}

function hallVolumes(out, level) {
  volume(out, 'wall', hall, podiumHeight - 0.01, rimHeight, tint.shadow, { top: false });
  hallWall(out, level);
  const ring = inset(hall, 0.986);
  shell(
    out,
    ring,
    [
      [30.9, 1.025],
      [32.1, 1.025],
      [36.5, 0.83],
      [37.1, 0.68],
    ],
    tint.roof,
    tint.shadow,
  );

  const core = [
    [-28.4, -5.4],
    [-28.9, 27.9],
    [-16.4, 39.9],
    [10.4, 40.4],
    [23.4, 26.9],
    [23.4, -4.6],
    [11.3, -19.8],
    [-15.2, -19.7],
  ];
  volume(out, 'wall', core, 36.2, 41.05, tint.base, { top: false });
  shell(
    out,
    core,
    [
      [40.8, 1.035],
      [41.5, 1.035],
      [45.3, 0.89],
    ],
    tint.roof,
    tint.roof,
  );
  const lip = plan.dimensions.upperBlockDocumentedHeightM;
  block(out, 'roof', [-11.1, 45.15, 0.55], [7.75, lip, 15.6], tint.trim);
  if (level < 2) return;
  for (const x of [-22.1, -16.0, 12.0, 17.3]) {
    block(out, 'roof', [x - 1.3, 40.07, 11.8], [x + 1.3, 41.8, 17.4], tint.base);
  }
}

function build(out, level) {
  podium(out, level);
  lowerVolumes(out, level);
  hallVolumes(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'national-palace-of-culture-model.mjs';
const camera = [178, 93, 204];
const lookAt = [-2.5, 15, 3];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'National Palace of Culture',
  wikidataId: plan.wikidataId,
  category: 'cultural-center',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Sofia’s National Palace of Culture with polygonal roofs, glazed entrance, pale pilasters, and a broad stone podium.',
  camera,
  lookAt,
  sunDirection: [26, 70, 54],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Native congress building envelope above the plaza.',
  },
  embeddedCanonicalGraphs: [
    'concrete_panel',
    'stone_limestone',
    'stone_ashlar',
    'metal_standing_seam',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'plaza-entrance-and-recessed-glazing',
      position: [-27, 13.5, 154],
      lookAt: [-3.2, 17.0, 69],
    },
    { name: 'roof-and-pilaster-rhythm', position: [123, 96, 109], lookAt: [2, 26.1, 26] },
    { name: 'rear-service-wing', position: [-147, 66, -126], lookAt: [-6, 19.1, -23] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-palace-of-culture-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.165, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.049, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. OpenStreetMap footprint under ODbL and open Mapzen elevation tiles with their published attribution.',
};
