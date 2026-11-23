import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { parts } = JSON.parse(
  fs.readFileSync(new URL('../native-map/cincy-art-building-parts.json', import.meta.url)),
);
const { outline, holes } = frame.geometry;
const limestone = rgb('b9b3a5');
const ashlar = rgb('aca798');
const trim = rgb('c6bdb0');
const shadow = rgb('766e61');
const slate = rgb('7d817f');
const bronze = rgb('7c7971');
const glass = rgb('4e5b62');
const copper = rgb('7eaaa4');
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97 },
  slate: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.81 },
  glass: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.63 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.83 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73 },
};
const mainPortico = '1454675350';
const streetBase = outline.map(([x, z], i) => ([45, 46, 47].includes(i) ? [x, -54.44] : [x, z]));
const skylineParts = new Set([
  '1454679655',
  '1454677563',
  '1454677561',
  '1454675351',
  '1454674695',
  '1454682945',
  '1454689350',
  '1454684290',
  '1454684291',
  '1454676033',
]);
const outerFaces = (ring) => {
  const r = outwardRing(ring);
  return r.map((a, i) => wallFace(a, r[(i + 1) % r.length]));
};

function roofDeck(out, ring, y, slot, color, court = []) {
  const geometry = [...ring, ...court.flat()];
  const starts = court.map((_hole, i) => ring.length + court.slice(0, i).flat().length);
  const indices = earcut(geometry.flat(), starts, 2);
  const point = (i) => [geometry[i][0], y, geometry[i][1]];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3);
    tri(out, slot, point(a), point(c), point(b), color);
  }
}

function skinnedPart(out, part, lod) {
  const id = part.way.id;
  const footprint = part.local;
  const levels = Number(part.levels);
  const wallTop = 1.58 + Math.min(levels, 5) * 4.03 + Math.max(0, levels - 5) * 2.23;
  const area = Math.abs(
    footprint.reduce((area, [x, z], i) => {
      const [nx, nz] = footprint[(i + 1) % footprint.length];
      return area + x * nz - nx * z;
    }, 0) / 2,
  );
  if (area < 2.5 || wallTop <= 5.2) return;
  const shape = part.tags['roof:shape'] ?? 'flat';
  const tint = part.tags['roof:colour'] === '#b1c7c7' ? copper : slate;
  const roofSlot = tint === copper ? 'copper' : 'slate';
  const rise = Number(part.tags['roof:height'] ?? 2.05);
  const endWall = id === '1454689350' ? plan.dimensions.domeEave : wallTop;
  extrude(out, 'wall', footprint, 5.18, endWall, limestone, { top: false });
  if (shape === 'flat') {
    roofDeck(out, footprint, endWall, roofSlot, tint);
  } else if (shape === 'pyramidal' || shape === 'hipped') {
    const center = footprint.reduce(
      ([x, z], [px, pz]) => [x + px / footprint.length, z + pz / footprint.length],
      [0, 0],
    );
    const inset = shape === 'pyramidal' ? 0.035 : 0.52;
    const upper = footprint.map(([x, z]) => [
      center[0] + (x - center[0]) * inset,
      center[1] + (z - center[1]) * inset,
    ]);
    loft(
      out,
      roofSlot,
      [
        outwardRing(footprint).map(([x, z]) => [x, endWall, z]),
        outwardRing(upper).map(([x, z]) => [x, endWall + rise, z]),
      ],
      tint,
      { cap: false },
    );
    roofDeck(out, upper, endWall + rise, roofSlot, tint);
  } else {
    const x0 = Math.min(...footprint.map(([x]) => x));
    const x1 = Math.max(...footprint.map(([x]) => x));
    const z0 = Math.min(...footprint.map(([, z]) => z));
    const z1 = Math.max(...footprint.map(([, z]) => z));
    if (shape === 'gable' || shape === 'gabled') {
      const alongX = x1 - x0 > z1 - z0 !== (part.tags['roof:orientation'] === 'across');
      const x = (x0 + x1) / 2;
      const z = (z0 + z1) / 2;
      const a = alongX ? [x0, z] : [x, z0];
      const b = alongX ? [x1, z] : [x, z1];
      gableRoof(out, roofSlot, a, b, alongX ? z1 - z0 : x1 - x0, endWall, endWall + rise, tint, {
        overhang: 0.17,
        endSlot: 'wall',
        endColor: limestone,
      });
    } else {
      roofDeck(out, footprint, endWall, roofSlot, tint);
    }
  }
  if (lod < 1) return;
  for (const face of outerFaces(footprint)) {
    const isStreet = face.origin[1] < -40 || face.origin[0] < -52;
    if (face.length < (isStreet ? 6.5 : 11) || endWall < 9 || (lod === 1 && !isStreet)) continue;
    const count = Math.floor(face.length / (isStreet ? 4.8 : 6.9));
    const bay = face.length / count;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * bay;
      if (isStreet && face.origin[0] > -13 && face.origin[0] < 5 && face.origin[1] < -47) continue;
      const y = isStreet ? 6.98 : 7.01;
      opening(out, face, u, y, isStreet ? 1.62 : 1.2, 2.55, {
        glassSlot: 'glass',
        frameSlot: 'metal',
        glass,
        frame: bronze,
        d: 0.025,
        frameWidth: lod === 3 ? 0.072 : 0,
        frameDepth: 0.08,
        mullions: lod === 3 ? 1 : 0,
        sill: false,
      });
    }
    if (lod > 1 && isStreet)
      fbox(
        out,
        'trim',
        face,
        0.03,
        face.length - 0.03,
        endWall - 0.82,
        endWall + 0.08,
        -0.01,
        0.25,
        trim,
      );
  }
}

function column(out, x, z, y, top, radius, lod) {
  const sides = [6, 8, 12, 16][lod];
  const ring = (h, r) => radialRing(h, r, r, sides, [x, z]);
  if (lod === 0) {
    loft(out, 'trim', [ring(y, radius), ring(top, radius * 0.81)], trim, { cap: false });
    return;
  }
  loft(
    out,
    'trim',
    [
      ring(y, radius * 1.16),
      ring(y + 0.22, radius),
      ring(top - 0.49, radius * 0.78),
      ring(top, radius * 1.04),
    ],
    trim,
    { cap: false },
  );
}
function entrance(out, lod) {
  const middle = 21.47;
  const z = -57.7;
  const eave = plan.dimensions.entryEave;
  abox(out, 'wall', [12.57, 0.09, -53.83], [29.97, eave, -25.83], limestone);
  const F = facade([middle, -53.85], [-1, 0]);
  for (const u of [-4.28, 0, 4.28]) {
    opening(out, F, u, 1.32, 2.61, 5.3, {
      glassSlot: 'dark',
      frameSlot: 'trim',
      glass: shadow,
      frame: ashlar,
      frameWidth: lod > 1 ? 0.16 : 0,
      sill: false,
    });
  }
  for (let step = 0; step < (lod === 0 ? 1 : 5); step++) {
    abox(
      out,
      'base',
      [11.69 + step * 0.18, -0.13, z - 2.8 + step * 0.49],
      [31.13 - step * 0.18, 0.24 + step * 0.227, -53.56],
      ashlar,
    );
  }
  for (let i = 0; i < 6; i++) {
    const x = 13.76 + i * 3.05;
    column(out, x, z, 1.36, eave - 1.88, 0.61, lod);
  }
  abox(out, 'trim', [11.93, eave - 1.89, z - 0.8], [31.03, eave - 0.46, -53.52], trim, {
    bottom: true,
  });
  abox(out, 'trim', [11.69, eave - 0.47, z - 1.06], [31.27, eave + 0.09, -53.42], limestone);
  gableRoof(
    out,
    'copper',
    [middle, z - 1.06],
    [middle, -47.6],
    19.54,
    eave + 0.085,
    eave + 3.54,
    copper,
    { overhang: 0.08, endSlot: 'trim', endColor: trim },
  );
  const side = facade([-12.3, -49.92], [-1, 0]);
  for (const u of [-15.8, -12.73, -9.68, -6.63, -3.58, -0.52]) {
    if (lod > 0) column(out, -12.3 - u, -50.04, 6.09, 12.16, 0.39, lod);
  }
  fbox(out, 'trim', side, -17.86, 0.52, 5.87, 6.42, 0.02, 0.94, trim);
  fbox(out, 'trim', side, -17.86, 0.52, 12.13, 12.98, 0.01, 0.66, trim);
  if (lod < 2) return;
  for (const u of [-16, -12.78, -9.56, -6.34, -3.12, 0.1]) {
    opening(out, side, u, 2.31, 1.68, 2.89, {
      glassSlot: 'glass',
      frameSlot: 'metal',
      glass,
      frame: bronze,
      d: 0.12,
      frameWidth: 0.09,
      frameDepth: 0.15,
      sill: false,
      mullions: 1,
    });
  }
}

function build(out, lod) {
  const baseTop = lod === 0 ? plan.dimensions.foundation : 0.71;
  if (lod > 0)
    extrude(out, 'base', streetBase, plan.dimensions.foundation, baseTop, ashlar, {
      holes,
      top: false,
    });
  extrude(out, 'wall', streetBase, baseTop, 5.18, limestone, { holes, top: false });
  roofDeck(out, streetBase, 5.18, 'slate', slate, holes);
  for (const part of parts) {
    const id = part.way.id;
    if (id === mainPortico || (lod === 0 && !skylineParts.has(id))) continue;
    if (lod < 2 && Number(part.levels) < 2) continue;
    skinnedPart(out, part, lod);
  }
  entrance(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'cincinnati-art-museum-model.mjs';
const camera = [-85, 63, -135];
const lookAt = [2, 12, -8];
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
    'The Cincinnati Art Museum in Eden Park with its classical entrance, original stone galleries and connected courtyard wings.',
  camera,
  lookAt,
  sunDirection: [-42, 57, -88],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    holes,
    minimumCoverage: 0.92,
    basis: 'The mapped Cincinnati Art Museum exterior boundary and courtyard.',
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
    { name: 'eden-park-and-museum-wings', position: camera, lookAt },
    { name: 'classical-entrance-and-galleries', position: [61, 13, -96], lookAt: [8, 10, -47] },
    { name: 'historic-core-and-court', position: [114, 73, 103], lookAt: [1, 12, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cincinnati-art-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.59, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.067, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
