import fs from 'node:fs';
import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = outwardRing(frame.geometry.outline);
const { foundation, belt, eave, attic, ridge } = plan.dimensions;
const sandstone = rgb('d0c5aa');
const cream = rgb('decfb0');
const warmShade = rgb('bcad91');
const ashlar = rgb('aaa6a1');
const lightStone = rgb('c3bbb2');
const darkStone = rgb('96938c');
const roof = rgb('817d71');
const glass = rgb('474842');
const wood = rgb('6d5845');
const sourceSurfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.53 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
};
const frontage = facade([0, 12.06], [1, 0]);
const section = { left: -18.9, right: 17.66, centralLeft: -9.55, centralRight: 6.94 };
const centerSpan = section.centralRight - section.centralLeft;
const entries = 4;
const pier = (i) => section.centralLeft + (i / entries) * centerSpan;

function cap(out, ring, y, slot, color) {
  const faces = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < faces.length; i += 3)
    tri(out, slot, p(faces[i]), p(faces[i + 2]), p(faces[i + 1]), color);
}

function mainBlock(out) {
  extrude(out, 'base', outline, foundation, belt, ashlar, { top: false });
  extrude(out, 'wall', outline, belt, eave, sandstone, { top: false });
  cap(out, outline, eave, 'roof', roof);
  const start = -17.62;
  const end = 18.66;
  for (const [a, b, height] of [
    [-10.54, 3.18, ridge - 0.31],
    [3.11, 10.71, ridge - 0.72],
  ]) {
    const middle = (a + b) / 2;
    const base = eave - 0.21;
    quad4(
      out,
      'roof',
      [start, base, a],
      [start, height, middle],
      [end, height, middle],
      [end, base, a],
      roof,
    );
    quad4(
      out,
      'roof',
      [start, height, middle],
      [start, base, b],
      [end, base, b],
      [end, height, middle],
      roof,
    );
    tri(out, 'wall', [start, base, a], [start, base, b], [start, height, middle], warmShade);
    tri(out, 'wall', [end, base, b], [end, base, a], [end, height, middle], sandstone);
  }
  abox(out, 'roof', [-6.95, eave - 0.1, -6.11], [4.42, ridge + 0.36, 4.21], roof, {
    bottom: false,
  });
}

function window(out, face, u, y, width, height, lod, opts = {}) {
  opening(out, face, u, y, width, height, {
    glassSlot: opts.entry ? 'timber' : 'glass',
    frameSlot: 'trim',
    glass: opts.entry ? wood : glass,
    frame: cream,
    head: opts.arch ? 'round' : 'flat',
    frameWidth: lod > 1 ? 0.1 : 0,
    sill: lod > 1 && !opts.entry,
    d: 0.039,
    mullions: lod > 0 ? (opts.mullions ?? 1) : 0,
    transoms: lod > 1 ? 1 : 0,
  });
}

function faceBox(out, slot, a, b, y0, y1, d0, d1, color) {
  fbox(out, slot, frontage, a, b, y0, y1, d0, d1, color);
}

function arch(out, u, r, spring, lod) {
  const n = [4, 6, 9, 13][lod];
  const point = (i, lip) => {
    const angle = (i * Math.PI) / n;
    return [u - (r + lip) * Math.cos(angle), spring + (r + lip) * Math.sin(angle)];
  };
  for (let i = 0; i < n; i++) {
    const a = point(i, 0),
      b = point(i + 1, 0);
    const c = point(i + 1, 0.27),
      d = point(i, 0.27);
    quad4(
      out,
      'trim',
      frontage.P(...a, 0.25),
      frontage.P(...b, 0.25),
      frontage.P(...c, 0.25),
      frontage.P(...d, 0.25),
      cream,
    );
    if (lod > 0)
      quad4(
        out,
        'trim',
        frontage.P(...a, 0.25),
        frontage.P(...a, 0.047),
        frontage.P(...b, 0.047),
        frontage.P(...b, 0.25),
        warmShade,
      );
  }
}

function statueColumn(out, u, lod) {
  const top = 13.58;
  const bottom = 5.39;
  faceBox(out, 'trim', u - 0.52, u + 0.52, belt + 0.03, bottom + 0.23, 0.27, 1.14, cream);
  const prof = [
    [bottom + 0.19, 0.48],
    [bottom + 0.46, 0.36],
    [top - 0.7, 0.3],
    [top - 0.27, 0.47],
    [top - 0.11, 0.52],
  ];
  const facets = [5, 7, 10, 14][lod];
  const rings = prof.map(([y, radius]) =>
    Array.from({ length: facets }, (_, k) => {
      const a = (-2 * Math.PI * k) / facets;
      return [u + radius * Math.cos(a), y, 12.88 + radius * Math.sin(a)];
    }),
  );
  loft(out, 'trim', rings, sandstone, { cap: false });
  faceBox(out, 'trim', u - 0.63, u + 0.63, top - 0.22, top + 0.12, 0.23, 1.45, cream);
  if (lod > 1) {
    faceBox(out, 'trim', u - 0.64, u + 0.64, belt + 0.09, belt + 0.27, 0.28, 1.27, warmShade);
    faceBox(out, 'trim', u - 0.62, u + 0.62, top - 0.36, top - 0.22, 0.23, 1.39, warmShade);
  }
}

function pediment(out, u, y, half, lod) {
  const rise = 0.48;
  const at = (x, height) => frontage.P(u + x, y + height, 0.26);
  tri(out, 'trim', at(-half, 0), at(half, 0), at(0, rise), warmShade);
  faceBox(out, 'trim', u - half - 0.11, u + half + 0.11, y - 0.119, y + 0.032, 0.02, 0.31, cream);
  if (lod > 1) {
    for (const s of [-1, 1]) {
      const [low, high] = [at(s * (half + 0.06), 0.01), at(0, rise + 0.08)];
      const q = (p) => [p[0], p[1] + 0.095, p[2] + 0.07];
      if (s < 0) quad4(out, 'trim', low, high, q(high), q(low), cream);
      else quad4(out, 'trim', high, low, q(low), q(high), cream);
    }
  }
}

function sillRail(out, u, width, y, lod) {
  faceBox(out, 'trim', u - width / 2, u + width / 2, y, y + 0.13, 0.022, 0.36, cream);
  faceBox(out, 'trim', u - width / 2, u + width / 2, y + 0.48, y + 0.62, 0.022, 0.35, cream);
  if (lod === 1) return;
  const count = lod === 3 ? 9 : 6;
  for (let i = 0; i < count; i++) {
    const x = u - width / 2 + ((i + 0.5) * width) / count;
    faceBox(out, 'trim', x - 0.053, x + 0.053, y + 0.12, y + 0.51, 0.11, 0.29, cream);
  }
}

function front(out, lod) {
  const { left, right, centralLeft, centralRight } = section;
  for (const [lo, hi, d] of [
    [belt - 0.28, belt + 0.04, 0.55],
    [eave - 0.3, eave + 0.14, 0.57],
    [eave + 0.133, eave + 0.34, 0.68],
  ]) {
    faceBox(out, 'trim', left, right, lo, hi, -0.13, d, cream);
  }
  faceBox(out, 'wall', left, right, eave + 0.3, attic - 0.18, -0.16, 0.014, sandstone);
  faceBox(out, 'trim', left, right, attic - 0.18, attic, -0.18, 0.28, cream);
  faceBox(
    out,
    'trim',
    centralLeft - 0.23,
    centralRight + 0.23,
    13.31,
    13.74,
    0.13,
    1.48,
    sandstone,
  );
  faceBox(out, 'trim', centralLeft - 0.35, centralRight + 0.35, 13.73, 14.06, 0.13, 1.52, cream);
  faceBox(out, 'base', left, right, -0.9, 0.59, -0.16, 0.24, lightStone);
  for (let i = 0; i <= entries; i++) {
    const x = pier(i);
    faceBox(out, 'base', x - 0.62, x + 0.62, -0.43, belt - 0.05, -0.13, 0.78, ashlar);
    statueColumn(out, x, lod);
  }
  if (lod === 0) {
    for (let i = 0; i < entries; i++) {
      const u = (pier(i) + pier(i + 1)) / 2;
      window(out, frontage, u, 6.27, 2.45, 5.94, lod, { arch: true });
    }
    return;
  }
  for (let i = 0; i < entries; i++) {
    const u = (pier(i) + pier(i + 1)) / 2;
    window(out, frontage, u, 0.28, 1.49, 3.81, lod, { arch: true, entry: true });
    arch(out, u, 1.28, 10.93, lod);
    window(out, frontage, u, 6.26, 2.54, 5.94, lod, { arch: true, mullions: 2 });
    sillRail(out, u, 2.69, 5.64, lod);
  }
  const bays = [
    [left, centralLeft, 2],
    [centralRight, right, 3],
  ];
  for (const [a, b, count] of bays) {
    for (let j = 0; j < count; j++) {
      const u = a + ((b - a) * (j + 0.5)) / count;
      window(out, frontage, u, 0.7, 1.67, 3.32, lod, { entry: true });
      window(out, frontage, u, 6.37, 1.83, 4.52, lod);
      pediment(out, u, 11.15, 1.27, lod);
      sillRail(out, u, 1.91, 5.66, lod);
    }
  }
  if (lod < 2) return;
  for (let i = 0; i <= entries; i++) {
    const u = pier(i);
    for (let j = 0; j < 7; j++) {
      const y = j * 0.61 + 0.37;
      faceBox(out, 'base', u - 0.645, u + 0.645, y, y + 0.072, 0.04, 0.825, darkStone);
    }
    faceBox(out, 'trim', u - 0.85, u + 0.85, 13.91, 14.26, 0.23, 1.63, cream);
  }
  for (let i = 0; i <= 11; i++) {
    const x = left + ((right - left) * i) / 11;
    faceBox(
      out,
      'trim',
      x - 0.15,
      x + 0.15,
      eave + 0.26,
      attic + (i % 2 === 0 ? 0.26 : 0.02),
      -0.13,
      0.27,
      cream,
    );
  }
  for (let i = 1; i < 45; i++) {
    const x = left + ((right - left) * i) / 45;
    faceBox(out, 'trim', x - 0.073, x + 0.073, eave - 0.49, eave - 0.31, 0.03, 0.42, sandstone);
  }
}

function sides(out, lod) {
  if (lod === 0) return;
  for (let i = 0; i < outline.length; i++) {
    const face = wallFace(outline[i], outline[(i + 1) % outline.length]);
    if (face.length < 3 || (face.normal[1] > 0.7 && face.origin[1] > 11.7)) continue;
    const end = face.length;
    fbox(out, 'trim', face, 0.05, end - 0.05, belt - 0.21, belt + 0.06, -0.04, 0.2, cream);
    fbox(out, 'trim', face, 0.05, end - 0.05, eave - 0.25, eave + 0.12, -0.05, 0.23, cream);
    const count = Math.ceil(end / 4.2);
    for (let j = 0; j < count; j++) {
      const u = (end * (j + 0.5)) / count;
      window(out, face, u, 6.48, 1.18, 3.32, lod === 2 ? 1 : lod);
      if (lod > 1) window(out, face, u, 0.35, 1.13, 2.63, lod === 2 ? 1 : lod);
    }
  }
}

function build(out, lod) {
  mainBlock(out);
  front(out, lod);
  sides(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'national-theatre-of-greece-model.mjs';
const camera = [36, 15, 49];
const lookAt = [-1, 6.6, 9];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces: sourceSurfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Ernst Ziller’s National Theatre of Greece in Athens, with its pale arcaded main facade and rusticated base.',
  camera,
  lookAt,
  sunDirection: [36, 62, 65],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named native footprint of the Ziller theatre.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(sourceSurfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'ziller-street-frontage', position: camera, lookAt },
    { name: 'colonnade-and-rustication', position: [12, 3.7, 31.5], lookAt: [-2, 7.2, 12] },
    { name: 'parapet-and-arched-bays', position: [-11, 16, 28], lookAt: [0.5, 11, 12] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-theatre-of-greece-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.94,
    surfaces: sourceSurfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces: sourceSurfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces: sourceSurfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces: sourceSurfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
