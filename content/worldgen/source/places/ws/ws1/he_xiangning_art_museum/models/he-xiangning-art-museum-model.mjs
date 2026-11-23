import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { rings } = JSON.parse(
  fs.readFileSync(
    new URL('../native-map/he-xiangning-correct-building-rings.json', import.meta.url),
  ),
);
const { outline } = frame.geometry;
const { foundation, floor, eave, bayTop } = plan.dimensions;
const stone = rgb('cecfc6');
const panel = rgb('d9d9cf');
const foundationColor = rgb('9b9b90');
const roof = rgb('b3b5ab');
const glass = rgb('75928e');
const shade = rgb('5d6a64');
const aluminum = rgb('c3c8bf');
const seam = rgb('b8bbb0');
const surfaces = {
  panel: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.85 },
  foundation: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.93 },
  pane: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.57 },
  simple: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73 },
  rails: { slot: 'trim', graph: 'metal_painted', roughness: 0.72 },
};
function box(out, slot, x, y, z, w, h, d, color, bottom = false) {
  abox(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color, { bottom });
}
function capping(out, ring, y) {
  const tris = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < tris.length; i += 3)
    tri(out, 'roof', p(tris[i]), p(tris[i + 2]), p(tris[i + 1]), roof);
}
function glassPanel(out, F, u, y, w, h, lod, tint) {
  opening(out, F, u, y, w, h, {
    glassSlot: lod === 0 ? 'simple' : 'pane',
    frameSlot: 'rails',
    glass: tint,
    frame: aluminum,
    d: 0.038,
    frameWidth: lod > 1 ? 0.077 : 0,
    frameDepth: 0.112,
    sill: false,
    mullions: lod > 0 ? Math.max(1, Math.round(w / 1.34) - 1) : 0,
    transoms: lod > 0 ? Math.max(1, Math.round(h / 1.37) - 1) : 0,
  });
}
function envelope(out, lod) {
  for (const [idx, r] of rings.entries()) {
    const top = idx === 0 ? eave : eave - 1.18;
    extrude(out, 'foundation', r, foundation, floor, foundationColor, { top: false });
    extrude(out, 'panel', r, floor, top, stone, { top: false });
    capping(out, r, top);
    if (lod === 0) continue;
    const ends = outwardRing(r);
    for (let i = 0; i < ends.length; i++) {
      const F = wallFace(ends[i], ends[(i + 1) % ends.length]);
      if (F.length < 4.2) continue;
      fbox(out, 'trim', F, 0.07, F.length - 0.07, top - 0.18, top + 0.21, 0.009, 0.19, panel);
      const count = Math.ceil(F.length / 10);
      for (let j = 0; j < count; j++) {
        const span = F.length / count;
        const u = span * (j + 0.5);
        if (i === 0 && j % 2 === 1) continue;
        glassPanel(out, F, u, floor + 0.48, span * 0.59, 0.87, lod, shade);
      }
      if (lod < 2) continue;
      for (let y = floor + 1.48; y < top - 0.3; y += 1.35) {
        quad4(
          out,
          'trim',
          F.P(0.07, y, 0.014),
          F.P(F.length - 0.07, y, 0.014),
          F.P(F.length - 0.07, y + 0.017, 0.014),
          F.P(0.07, y + 0.017, 0.014),
          seam,
        );
      }
      if (lod === 3) {
        const cols = Math.floor(F.length / 2.84);
        for (let j = 1; j < cols; j++) {
          const u = (F.length * j) / cols;
          quad4(
            out,
            'trim',
            F.P(u, floor + 1.32, 0.017),
            F.P(u + 0.015, floor + 1.32, 0.017),
            F.P(u + 0.015, top - 0.24, 0.017),
            F.P(u, top - 0.24, 0.017),
            seam,
          );
        }
      }
    }
  }
}
function glazedBay(out, lod) {
  const x = 19.34;
  box(out, 'panel', x, 3.09, -13.74, 12.64, bayTop - 3.09, 6.32, panel);
  box(out, 'trim', x, bayTop - 0.25, -13.75, 13.06, 0.3, 6.71, stone);
  box(out, 'trim', x, 2.98, -14.15, 12.77, 0.26, 5.51, panel, true);
  const north = facade([x, -16.905], [-1, 0]);
  glassPanel(out, north, 0.07, 3.52, 10.59, 7.14, lod, glass);
  if (lod > 0) glassPanel(out, facade([25.667, -14.79], [0, -1]), 0, 3.6, 2.97, 6.99, lod, glass);
  const canopyX = 29.2;
  box(out, 'panel', canopyX, eave - 0.42, -11.74, 6.74, 1.79, 5.37, stone);
  box(out, 'trim', canopyX, bayTop - 0.19, -13.84, 9.52, 0.29, 6.18, panel, true);
  if (lod > 0)
    for (const px of [25.18, 32.98])
      box(out, 'trim', px, eave - 0.06, -16.15, 0.36, 2.43, 0.38, panel);
}
function entranceWalk(out, lod) {
  const center = -8.19;
  const wall = facade([center, -17.88], [-1, 0]);
  glassPanel(out, wall, 0, 3.14, 6.37, 3.62, lod, shade);
  box(out, 'trim', center, 6.71, -18.15, 8.32, 0.32, 2.12, panel, true);
  const start = [center, 3.26, -17.6],
    finish = [-21.06, 3.13, -29.94];
  const dx = finish[0] - start[0],
    dz = finish[2] - start[2];
  const len = Math.hypot(dx, dz);
  const axis = [dx / len, dz / len];
  const side = [axis[1], -axis[0]];
  const sidePos = (p, t, y = 0) => [p[0] + side[0] * t, p[1] + y, p[2] + side[1] * t];
  const width = 2.08;
  const stair = facade([finish[0], finish[2]], side);
  const stairRun = 9.2;
  const stairGrade = -2.92;
  const steps = lod === 0 ? 5 : 24;
  quad4(
    out,
    'foundation',
    sidePos(start, -width),
    sidePos(finish, -width),
    sidePos(finish, width),
    sidePos(start, width),
    roof,
  );
  for (let i = 0; i < steps; i++) {
    const y = finish[1] + ((stairGrade - finish[1]) * (i + 1)) / steps;
    fbox(
      out,
      'foundation',
      stair,
      -width,
      width,
      -3.35,
      y,
      (stairRun * i) / steps,
      (stairRun * (i + 1)) / steps,
      foundationColor,
    );
  }
  for (const k of [-width, width]) {
    const at = sidePos(start, k),
      end = sidePos(finish, k);
    const pads = lod === 0 ? [0.45] : [0.38, 0.76];
    beam(
      out,
      'foundation',
      sidePos(start, k, -0.26),
      sidePos(finish, k, -0.26),
      0.18,
      0.49,
      foundationColor,
    );
    if (lod > 0) {
      beam(
        out,
        'rails',
        stair.P(k, finish[1] + 1, 0),
        stair.P(k, stairGrade + 1, stairRun),
        0.05,
        0.05,
        aluminum,
      );
      for (const h of [0.32, 0.58, 1.04]) {
        beam(out, 'rails', sidePos(start, k, h), sidePos(finish, k, h), 0.043, 0.046, aluminum);
      }
      const count = lod === 3 ? 13 : 8;
      for (let j = 0; j <= count; j++) {
        const u = j / count;
        box(
          out,
          'rails',
          at[0] + (end[0] - at[0]) * u,
          start[1] - 0.14 * u,
          at[2] + (end[2] - at[2]) * u,
          0.052,
          1.08,
          0.052,
          aluminum,
        );
      }
    }
    for (const t of pads) {
      box(
        out,
        'foundation',
        at[0] + (end[0] - at[0]) * t,
        foundation,
        end[2] * t + at[2] * (1 - t),
        0.4,
        3.1 - foundation,
        0.45,
        foundationColor,
      );
    }
  }
}
function build(out, lod) {
  envelope(out, lod);
  glazedBay(out, lod);
  entranceWalk(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'he-xiangning-art-museum-model.mjs';
const camera = [69, 33, -71];
const lookAt = [-3, 5, -3];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The He Xiangning Art Museum at 9013 Shennan Boulevard, with pale paneled walls, projecting glazed gallery and elevated entrance walk.',
  camera,
  lookAt,
  sunDirection: [37, 61, -45],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    outlines: rings,
    minimumCoverage: 0.92,
    basis: 'Both mapped portions of the named He Xiangning Art Museum.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'paneled-museum-envelope', position: camera, lookAt },
    { name: 'overhanging-glazed-gallery', position: [43, 5, -39], lookAt: [20, 6, -13] },
    { name: 'elevated-entrance-walk', position: [-42, 12, -48], lookAt: [-12, 4, -17] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'he-xiangning-art-museum-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.43, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
