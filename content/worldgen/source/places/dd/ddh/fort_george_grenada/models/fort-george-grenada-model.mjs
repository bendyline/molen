import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (filename) =>
  JSON.parse(readFileSync(new URL(`../${filename}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/fort-george-grenada-shape-controls');
const terrain = read('terrain-grid');
const outer = outwardRing(shape.outerRetaining);
const inner = outwardRing(shape.mainEnclosure);
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
  limestone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  limewash: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.99 },
  turf: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98 },
  metal: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.87 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.82 },
  frame: { slot: 'trim', graph: 'wood_plain', roughness: 0.93 },
};
const rock = rgb('8e8d80');
const capstone = rgb('a49f8d');
const pale = rgb('c0b59b');
const worn = rgb('a69f8c');
const gravel = rgb('a59a7f');
const moss = rgb('706e51');
const field = rgb('848665');
const plaster = rgb('bfb7a0');
const charcoal = rgb('4c5045');
const roof = rgb('79584b');
const paradeHeight = 1.16;

function grade([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const upper = terrain.heightsMeters[j],
    lower = terrain.heightsMeters[j + 1];
  return (
    (1 - b) * ((1 - a) * upper[i] + a * upper[i + 1]) +
    b * ((1 - a) * lower[i] + a * lower[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function cover(out, slot, ring, height, color) {
  const mesh = new MeshBufferBuilder();
  const winding = outwardRing(ring);
  if (!mesh.addCap(slot, 'palette:#ffffff', winding, [], height, [0, 1, 0], (p) => p, color))
    throw Error('Fort surface is not triangulable');
  const { positions, indices } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const at = (k) => Array.from(positions.slice(indices[i + k] * 3, indices[i + k] * 3 + 3));
    tri(out, slot, at(0), at(1), at(2), color);
  }
}

function outerTerrace(p) {
  return Math.max(-4.4, Math.min(-0.65, grade(p) + 0.62));
}

function wall(out, edge, bottomA, bottomB, topA, topB, level) {
  const f = edge,
    length = f.length;
  const d = (h, fraction) => 0.18 + Math.max(0, h) * fraction;
  quad4(
    out,
    'rubble',
    f.P(0, bottomA, d(topA - bottomA, 0.083)),
    f.P(length, bottomB, d(topB - bottomB, 0.083)),
    f.P(length, topB, 0.02),
    f.P(0, topA, 0.02),
    rock,
  );
  quad4(
    out,
    'limestone',
    f.P(0, topA - 0.13, 0.19),
    f.P(length, topB - 0.13, 0.19),
    f.P(length, topB + 0.16, 0.19),
    f.P(0, topA + 0.16, 0.19),
    capstone,
  );
  quad4(
    out,
    'limestone',
    f.P(0, topA + 0.16, 0.19),
    f.P(length, topB + 0.16, 0.19),
    f.P(length, topB + 0.16, -0.12),
    f.P(0, topA + 0.16, -0.12),
    capstone,
  );
  if (level < 2) return;
  const at = (u, y) => f.P(u, (1 - u / length) * topA + (u / length) * topB - y, 0.045 + y * 0.088);
  for (const y of [0.69, 1.18, 1.74]) {
    if (Math.min(topA - bottomA, topB - bottomB) < y + 0.12) continue;
    quad4(
      out,
      'rubble',
      at(0, y + 0.025),
      at(length, y + 0.025),
      at(length, y - 0.025),
      at(0, y - 0.025),
      worn,
    );
  }
  if (level === 3) {
    for (let i = 1; i <= Math.floor(length / 2.1); i++) {
      const u = (i * length) / (Math.floor(length / 2.1) + 1);
      quad4(
        out,
        'rubble',
        at(u - 0.022, 0.33),
        at(u + 0.022, 0.33),
        at(u + 0.022, 0.12),
        at(u - 0.022, 0.12),
        moss,
      );
    }
  }
}

function ranges(out, level) {
  const mapped = shape.mappedBarrackRings;
  for (const [name, input] of Object.entries(mapped)) {
    const ring = outwardRing(input);
    const base = name === 'west' ? 0.79 : 1.05;
    const eaves = name === 'east' ? 6.54 : name === 'south' ? 5.7 : 5.83;
    extrude(out, 'rubble', ring, -1.8, base + 2.27, rock, { top: false });
    extrude(out, 'limewash', ring, base + 2.27, eaves, plaster, { top: false });
    const meanX = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
    const meanZ = ring.reduce((sum, [, z]) => sum + z, 0) / ring.length;
    const ridgeOffset = ([x, z]) =>
      name === 'south' ? z - meanZ - (x - meanX) * 0.35 : x - meanX + (z - meanZ) * 0.2;
    const height = (p) =>
      eaves +
      0.1 +
      Math.max(0, 1 - Math.abs(ridgeOffset(p)) / 5.8) * (name === 'east' ? 2.24 : 1.57);
    cover(out, 'metal', ring, height, roof);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length],
        f = wallFace(p, q);
      quad4(
        out,
        'limewash',
        f.P(0, eaves, 0),
        f.P(f.length, eaves, 0),
        f.P(f.length, height(q), 0),
        f.P(0, height(p), 0),
        plaster,
      );
      if (f.length < 3 || level === 0) continue;
      const count = Math.max(1, Math.round(f.length / 3.65));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * f.length) / count;
        const arch = name === 'east' && Math.abs(f.normal[0]) > 0.39;
        const w = Math.min(f.length * 0.35, 1.05);
        if (level === 1) {
          const left = u - w / 2;
          const right = u + w / 2;
          quad4(
            out,
            'shade',
            f.P(left, base + 0.25, 0.03),
            f.P(right, base + 0.25, 0.03),
            f.P(right, base + 2.0, 0.03),
            f.P(left, base + 2.0, 0.03),
            charcoal,
          );
          continue;
        }
        opening(out, f, u, base + 0.25, w, 1.78, {
          head: arch ? 'round' : 'flat',
          glassSlot: 'shade',
          frameSlot: 'limestone',
          glass: charcoal,
          frame: capstone,
          frameWidth: 0.115,
          frameDepth: 0.145,
          d: 0.035,
          mullions: 0,
          sill: false,
        });
        if (level >= 2)
          opening(out, f, u, base + 2.88, w, 1.08, {
            head: 'flat',
            glassSlot: 'shade',
            frameSlot: 'frame',
            glass: charcoal,
            frame: pale,
            frameWidth: 0.102,
            frameDepth: 0.09,
            d: 0.036,
            mullions: level === 3 ? 1 : 0,
          });
      }
      if (level >= 2)
        fbox(out, 'limestone', f, 0, f.length, base + 2.17, base + 2.24, 0, 0.1, capstone);
    }
  }
}

function stairs(out, level) {
  const f = wallFace([6.1, -28.1], [12.7, -23.1]);
  const count = level === 0 ? 4 : 10;
  for (let i = 0; i < count; i++)
    fbox(
      out,
      'limestone',
      f,
      0.72,
      f.length - 0.72,
      -2.32,
      -2.12 + (i * 3.37) / count,
      -0.88,
      4.98 - (i * 5.02) / count,
      capstone,
    );
  for (const u of [0.1, f.length - 0.65])
    fbox(out, 'rubble', f, u, u + 0.55, -2.45, 0.2, -0.86, 5.02, rock);
  if (level === 0) return;
  // Low gatehouse at the uphill stair approach.
  const base = -2.16,
    eave = 1.38;
  const gate = [
    [11.1, -33.3],
    [17.2, -36.5],
    [19.5, -32.1],
    [13.4, -28.8],
  ];
  extrude(out, 'rubble', gate, base, eave, rock, { top: false });
  cover(out, 'limestone', gate, () => eave, capstone);
  const face = wallFace(gate[3], gate[2]);
  opening(out, face, face.length * 0.5, base + 0.045, 2.3, 2.74, {
    head: 'round',
    glassSlot: 'shade',
    frameSlot: 'limestone',
    glass: charcoal,
    frame: pale,
    frameWidth: 0.22,
    frameDepth: 0.21,
    d: 0.044,
    mullions: 0,
    sill: false,
  });
}

function distanceToSegment([x, z], a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

function meetsParade(p, q) {
  const center = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const segments = shape.parade.map((a, i) => [a, shape.parade[(i + 1) % shape.parade.length]]);
  return [p, q, center(p, q)].some((sample) =>
    segments.some(([a, b]) => distanceToSegment(sample, a, b) < 2.4),
  );
}

function build(out, level) {
  cover(out, 'turf', outer, outerTerrace, field);
  for (let i = 0; i < outer.length; i++) {
    const p = outer[i],
      q = outer[(i + 1) % outer.length];
    wall(
      out,
      wallFace(p, q),
      Math.min(grade(p) - 1.3, outerTerrace(p) - 1.5),
      Math.min(grade(q) - 1.3, outerTerrace(q) - 1.5),
      outerTerrace(p),
      outerTerrace(q),
      level,
    );
  }
  extrude(out, 'rubble', inner, -4.46, paradeHeight, rock, { top: false });
  cover(out, 'gravel', inner, () => paradeHeight, gravel);
  cover(out, 'gravel', shape.parade, () => paradeHeight + 0.035, worn);
  for (let i = 0; i < inner.length; i++) {
    const p = inner[i],
      q = inner[(i + 1) % inner.length],
      f = wallFace(p, q);
    if (f.length < 0.24 || meetsParade(p, q)) continue;
    const crown = paradeHeight + (f.length < 5.5 ? 0.96 : 1.21);
    fbox(out, 'rubble', f, 0.1, f.length - 0.1, paradeHeight - 0.13, crown, -0.72, 0.11, rock);
    fbox(out, 'limestone', f, 0, f.length, crown, crown + 0.14, -0.82, 0.16, capstone);
    if (level >= 2 && f.length > 5.8) {
      for (let j = 1; j <= Math.floor(f.length / 3.9); j++) {
        const u = (j * f.length) / (Math.floor(f.length / 3.9) + 1);
        fbox(
          out,
          'limestone',
          f,
          u - 0.11,
          u + 0.11,
          paradeHeight + 0.08,
          crown - 0.17,
          0.01,
          0.138,
          worn,
        );
      }
    }
  }
  stairs(out, level);
  ranges(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-george-grenada-model.mjs';
const camera = [72, 69, 110],
  lookAt = [2, 0, -4];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The masonry headland fort overlooking the Carenage, with nested bastioned walls, a central parade, historic barracks and a lower approach.',
  camera,
  lookAt,
  sunDirection: [-41, 52, 30],
  mediumFiContext: {
    scale: 1.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: inner,
    basis:
      'The model supplies the masonry floor within the upper ring. The natural headland meets the lower curtain walls.',
  },
  buildingCutout: {
    outline: outer,
    outlines: [outer, ...Object.values(shape.mappedBarrackRings)],
    minimumCoverage: 0.75,
    basis:
      'Reserve the historic fort and its three registered barracks without reaching the separate hospital.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'historic-parade-and-barrack-ranges', position: [9, 52, 11], lookAt: [0, 1, 0] },
    { name: 'harbour-side-stone-ramparts', position: [40, 11, 50], lookAt: [2, -0.8, 19] },
    { name: 'north-court-and-approach', position: [27, 24, -59], lookAt: [10, 0, -24] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-george-grenada-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.05,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.74, surfaces },
      street: { export: 'street', errorMeters: 0.23, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.086, surfaces },
    },
  },
};
