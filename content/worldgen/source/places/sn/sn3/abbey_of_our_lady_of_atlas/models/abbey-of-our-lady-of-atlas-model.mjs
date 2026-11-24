import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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

const packageRequire = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = packageRequire('earcut');
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');

const buff = rgb('af9870');
const finePlaster = rgb('c0af87');
const honey = rgb('a88b62');
const base = rgb('907d66');
const pale = rgb('c4b9a1');
const weather = rgb('998e78');
const brick = rgb('94664d');
const brickTrim = rgb('825b46');
const tile = rgb('a96c52');
const orangeTile = rgb('ad7558');
const gutter = rgb('545a55');
const gateIron = rgb('292c2b');
const gatePanel = rgb('373a37');
const bar = rgb('54483c');
const glass = rgb('403a30');
const blue = rgb('46687a');

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97 },
  masonry: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98 },
  sill: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  iron: { slot: 'door', graph: 'metal_painted', roughness: 0.82 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const t = u - i;
  const s = v - j;
  const h = terrain.heightsMeters;
  return (
    (1 - s) * ((1 - t) * h[j][i] + t * h[j][i + 1]) +
    s * ((1 - t) * h[j + 1][i] + t * h[j + 1][i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

// Retain the surveyed outline while dividing its roof into the stepped ranges.
function clip(ring, signedDistance) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const sa = signedDistance(...a);
    const sb = signedDistance(...b);
    if (sa >= 0) result.push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

function section(ring, x0, x1, z0, z1) {
  return clip(
    clip(
      clip(
        clip(ring, (x) => x - x0),
        (x) => x1 - x,
      ),
      (_, z) => z - z0,
    ),
    (_, z) => z1 - z,
  );
}

const main = frame.geometry.outline;
const attached = frame.features[1].points;
const ranges = [
  {
    ring: section(main, -13, -1, -14, 15),
    kind: 'parapet',
    floor: 1.4,
    eave: 8.3,
    rise: 0.65,
    tone: honey,
  },
  {
    ring: section(main, -1, 34.4, -14, 2.4),
    kind: 'church',
    floor: 4.0,
    eave: 12.6,
    rise: 2.35,
    tone: finePlaster,
  },
  {
    ring: section(main, -1, 9.3, 2.4, 15),
    kind: 'pavilion',
    floor: 3.35,
    eave: 10.0,
    rise: 2.35,
    tone: brick,
  },
  {
    ring: section(main, 9.3, 23.6, 2.4, 15),
    kind: 'walk',
    floor: 6.1,
    eave: 9.9,
    rise: 1.25,
    tone: buff,
  },
  {
    ring: section(main, 23.6, 34.4, 2.4, 15),
    kind: 'pavilion',
    floor: 8.9,
    eave: 14.2,
    rise: 2.08,
    tone: brick,
  },
  {
    ring: section(attached, -14.1, 2.4, -23.2, -13.1),
    kind: 'entrance',
    floor: 0.18,
    eave: plan.dimensions.entranceEavesM,
    rise: plan.dimensions.entranceGableM - plan.dimensions.entranceEavesM,
    tone: buff,
  },
  {
    ring: section(attached, 2.4, 17.1, -23.2, -13.1),
    kind: 'range',
    floor: 2.25,
    eave: 8.15,
    rise: 1.72,
    tone: finePlaster,
  },
  {
    ring: section(attached, 17.1, 32, -23.2, -13.1),
    kind: 'range',
    floor: 5.1,
    eave: 11.0,
    rise: 1.65,
    tone: honey,
  },
  {
    ring: section(attached, 9.9, 25.2, -39, -23.2),
    kind: 'service',
    floor: 3.65,
    eave: 9.3,
    rise: 1.72,
    tone: buff,
  },
];

function roofHeight(ring, kind, rise) {
  const [xs, zs] = [ring.map(([x]) => x), ring.map(([, z]) => z)];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const dz = (z1 - z0) / 2;
  const dx = Math.min((x1 - x0) / 2, dz);
  const slopes = [(x, z) => (z - z0) / dz, (x, z) => (z1 - z) / dz];
  if (kind === 'pavilion' || kind === 'service') {
    slopes.push(
      (x) => (x - x0) / dx,
      (x) => (x1 - x) / dx,
    );
  }
  return {
    facets: slopes.map((slope) => ({
      ring: slopes.reduce(
        (part, other) => (other === slope ? part : clip(part, (x, z) => other(x, z) - slope(x, z))),
        ring,
      ),
      height: (x, z) => rise * slope(x, z),
    })),
    height: (x, z) => Math.min(...slopes.map((slope) => slope(x, z))) * rise,
  };
}

function roof(out, range, level) {
  const { ring, eave, rise, kind, tone } = range;
  const roofProfile = roofHeight(ring, kind, rise);
  roofProfile.facets.forEach((facet, index) => {
    const points = facet.ring;
    const indices = earcut(points.flat());
    const color = kind === 'parapet' ? brickTrim : index % 2 ? orangeTile : tile;
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3).map((j) => {
        const [x, z] = points[j];
        return [x, eave + facet.height(x, z), z];
      });
      const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (Math.abs(up) < 1e-7) continue;
      if (up < 0) tri(out, 'roof', a, c, b, color);
      else tri(out, 'roof', a, b, c, color);
    }
  });

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const face = wallFace(a, b);
    if (face.length < 0.05) continue;
    const cuts = [0, face.length];
    const pa = roofProfile.height(...a);
    const pb = roofProfile.height(...b);
    if (
      Math.abs(pa - pb) < 1e-5 &&
      roofProfile.height((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) < pa + 1e-5
    ) {
      cuts.splice(1, 0, face.length / 2);
    } else {
      for (const facet of roofProfile.facets) {
        for (const [x, z] of facet.ring) {
          const u = (x - a[0]) * face.along[0] + (z - a[1]) * face.along[1];
          const alongWall = Math.abs((x - a[0]) * face.normal[0] + (z - a[1]) * face.normal[1]);
          if (alongWall < 1e-5 && u > 0.01 && u < face.length - 0.01) cuts.push(u);
        }
      }
    }
    cuts.sort((u, v) => u - v);
    for (let j = 1; j < cuts.length; j++) {
      const u = cuts[j - 1];
      const v = cuts[j];
      if (v - u < 0.005) continue;
      const [x, , z] = face.P(u, 0);
      const [xx, , zz] = face.P(v, 0);
      const h0 = eave + roofProfile.height(x, z);
      const h1 = eave + roofProfile.height(xx, zz);
      const wall = [face.P(u, eave - 0.02), face.P(v, eave - 0.02), face.P(v, h1), face.P(u, h0)];
      quad4(out, 'plaster', ...wall, tone);
      if (level > 0 && kind !== 'parapet') {
        beam(
          out,
          'roof',
          face.P(u, h0 + 0.025, 0.06),
          face.P(v, h1 + 0.025, 0.06),
          0.16,
          0.13,
          brickTrim,
        );
      }
    }
  }
}

function window(
  out,
  face,
  u,
  y,
  level,
  { width = 0.78, height = 1.24, arched = false, bars = false } = {},
) {
  if (level < 2) {
    const a = u - width / 2;
    const b = u + width / 2;
    quad4(
      out,
      'shadow',
      face.P(a, y, 0.027),
      face.P(b, y, 0.027),
      face.P(b, y + height, 0.027),
      face.P(a, y + height, 0.027),
      glass,
    );
    return;
  }
  opening(out, face, u, y, width, height, {
    head: arched ? 'round' : 'flat',
    frameSlot: 'sill',
    glassSlot: 'shadow',
    frame: bars ? weather : pale,
    glass,
    d: 0.026,
    frameWidth: 0.105,
    frameDepth: 0.07,
    mullions: level === 3 ? (bars ? 2 : 1) : 0,
    transoms: level === 3 ? (bars ? 2 : 1) : 0,
    mullionColor: bars ? bar : weather,
  });
}

function facadeDetails(out, face, range, level) {
  const { kind, eave, floor } = range;
  const [x, , z] = face.P(face.length / 2, 0);
  const western = face.normal[1] > 0.73 && z > 7;
  const eastern = face.normal[1] < -0.75 && z < -21.4 && (x < 9 || x > 25 || z < -32);
  const gable = kind === 'entrance' && face.normal[0] < -0.86 && x < -12;
  const end = Math.abs(face.normal[0]) > 0.94 && (x < -8 || x > 28);
  if ((!western && !eastern && !end) || face.length < 3) return;

  if (gable) {
    window(out, face, face.length * 0.54, eave - 2.06, level, {
      width: 0.86,
      height: 1.48,
      bars: true,
    });
    if (level > 1) {
      fbox(
        out,
        'iron',
        face,
        face.length * 0.86,
        face.length * 0.86 + 0.28,
        2.46,
        2.65,
        0.02,
        0.055,
        blue,
      );
      fbox(
        out,
        'iron',
        face,
        face.length * 0.12 - 0.18,
        face.length * 0.12 + 0.1,
        2.32,
        2.53,
        0.02,
        0.055,
        blue,
      );
    }
  } else {
    const bays = Math.max(1, Math.round(face.length / (kind === 'walk' ? 2.2 : 3.45)));
    for (let index = 0; index < bays; index++) {
      const u = (face.length * (index + 0.5)) / bays;
      const [px, , pz] = face.P(u, 0);
      const ground = grade(px, pz);
      const single = kind === 'walk' || kind === 'service';
      const arched = kind === 'walk' || kind === 'church';
      const width = kind === 'walk' ? 1.12 : 0.8;
      if (level > 0 && !single && floor + 0.75 > ground + 0.16)
        window(out, face, u, floor + 0.75, level, { width });
      if (level > 0 && eave - 2.25 > ground + 0.3)
        window(out, face, u, eave - 2.25, level, { width, height: arched ? 1.56 : 1.27, arched });
    }
  }

  if (kind === 'parapet' && (western || end)) {
    fbox(out, 'masonry', face, 0, face.length, eave - 0.1, eave + 0.42, -0.33, 0.07, honey);
    const teeth = Math.max(1, Math.round(face.length / 0.9));
    const gap = face.length / teeth;
    for (let i = 0; i < teeth; i++)
      fbox(
        out,
        'masonry',
        face,
        i * gap + gap * 0.18,
        i * gap + gap * 0.75,
        eave + 0.42,
        eave + 0.77,
        -0.32,
        0.06,
        brick,
      );
  }
  if (level < 2) return;

  if ((kind === 'pavilion' || kind === 'walk') && western)
    fbox(out, 'sill', face, 0, face.length, eave - 0.32, eave - 0.17, -0.047, 0.115, brickTrim);
  if (kind === 'entrance' && eastern)
    for (const u of [0.38, face.length - 0.6]) {
      const [px, , pz] = face.P(u, 0);
      beam(
        out,
        'iron',
        face.P(u, grade(px, pz) + 0.35, 0.12),
        face.P(u, eave, 0.12),
        0.115,
        0.115,
        gutter,
      );
    }
  if (level === 3) {
    for (let u = 0; u < face.length - 0.04; u += 0.7) {
      const v = Math.min(u + 0.7, face.length);
      const [ax, , az] = face.P(u, 0);
      const [bx, , bz] = face.P(v, 0);
      const a = grade(ax, az);
      const b = grade(bx, bz);
      if (a + 0.52 > range.eave || b + 0.52 > range.eave) continue;
      const roughEdge = 0.28 + 0.22 * Math.abs(Math.sin(u * 2.7 + x));
      const stain = gable ? pale : u % 2.1 < 0.9 ? base : weather;
      quad4(
        out,
        'plaster',
        face.P(u, a - 0.16, 0.017),
        face.P(v, b - 0.16, 0.017),
        face.P(v, b + roughEdge, 0.017),
        face.P(u, a + roughEdge, 0.017),
        stain,
      );
    }
  }
}

function rangeMesh(out, range, level) {
  const ring = outwardRing(range.ring);
  const low = Math.min(range.floor, ...ring.map(([x, z]) => grade(x, z))) - 1.04;
  extrude(out, 'plaster', ring, low, range.eave, range.tone, { top: false });
  roof(out, { ...range, ring }, level);
  for (let i = 0; i < ring.length; i++) {
    const face = wallFace(ring[i], ring[(i + 1) % ring.length]);
    facadeDetails(out, face, range, level);
  }
}

function gate(out, level) {
  const { gateWidthM: width, gateHeightM: height } = plan.dimensions;
  const x = -14.18;
  const z = -26.62;
  const face = facade([x, z], [0, 1]);
  for (const side of [-1, 1]) {
    const u = side * (width / 2 + 0.38);
    const [px, , pz] = face.P(u, 0);
    const h = grade(px, pz);
    const sides = [6, 8, 12, 18][level];
    const ring = (radius, y) =>
      Array.from({ length: sides }, (_, i) => {
        const angle = (-i * 2 * Math.PI) / sides;
        return [px + radius * Math.cos(angle), y, pz + radius * Math.sin(angle)];
      });
    loft(out, 'plaster', [ring(0.39, h - 0.48), ring(0.37, h + 2.51)], buff);
    loft(out, 'sill', [ring(0.427, h + 2.51), ring(0.427, h + 2.6), ring(0.335, h + 2.72)], pale);
    const other = side > 0 ? 4.18 : -7.6;
    const a = Math.min(other, u);
    const b = Math.max(other, u);
    fbox(out, 'plaster', face, a, b, h - 0.9, h + 2.15, -0.54, -0.05, honey);
    fbox(out, 'masonry', face, a, b, h + 2.12, h + 2.25, -0.58, -0.02, weather);
  }
  for (const side of [-1, 1]) {
    const a = side < 0 ? -width / 2 : 0.024;
    const b = side < 0 ? -0.024 : width / 2;
    fbox(out, 'iron', face, a, b, 0.14, height, -0.09, 0.025, gateIron);
    if (level > 0)
      for (const y of [0.18, 0.99, height - 0.06])
        fbox(out, 'iron', face, a + 0.03, b - 0.03, y, y + 0.045, 0.03, 0.077, gatePanel);
    if (level === 3)
      for (const u of [a + 0.075, b - 0.1])
        fbox(out, 'iron', face, u, u + 0.036, 0.2, height - 0.06, 0.03, 0.068, gatePanel);
  }
  if (level > 1) fbox(out, 'sill', face, 3.27, 3.82, 0.79, 1.29, -0.04, 0.018, pale);
}

function bellcote(out, level) {
  const f = facade([3.9, 10.27], [1, 0]);
  for (const u of [-0.55, 0.55])
    fbox(out, 'masonry', f, u - 0.15, u + 0.15, 11.16, 13.12, -0.42, 0.12, brick);
  fbox(out, 'masonry', f, -0.73, 0.73, 12.97, 13.27, -0.47, 0.16, brickTrim);
  const cap = f.P(0, 13.78, -0.16);
  for (const [u, d, v, e] of [
    [-0.77, 0.19, 0.77, 0.19],
    [0.77, 0.19, 0.77, -0.5],
    [0.77, -0.5, -0.77, -0.5],
    [-0.77, -0.5, -0.77, 0.19],
  ]) {
    tri(out, 'roof', f.P(u, 13.24, d), f.P(v, 13.24, e), cap, tile);
  }
  if (level > 1) {
    fbox(out, 'iron', f, -0.56, 0.57, 12.86, 12.93, -0.2, -0.12, bar);
    loft(
      out,
      'iron',
      [0.31, 0.22, 0.13].map((r, j) =>
        Array.from({ length: 10 }, (_, i) => {
          const a = (-2 * Math.PI * i) / 10;
          return [3.9 + r * Math.cos(a), 12.34 + j * 0.24, 10.1 + r * Math.sin(a)];
        }),
      ),
      bar,
    );
  }
}

function build(out, level) {
  for (const range of ranges) rangeMesh(out, range, level);
  gate(out, level);
  bellcote(out, level);
  if (level > 0) {
    const y = grade(-17.1, -26.6);
    abox(out, 'sill', [-16.05, y - 0.19, -28.88], [-14.19, y + 0.12, -24.36], weather);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'abbey-of-our-lady-of-atlas-model.mjs';
const camera = [-66, 24, 56];
const lookAt = [6, 5, -7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Abbey of Our Lady of Atlas',
  wikidataId: plan.wikidataId,
  category: 'monastery',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Tibhirine Abbey on the slope above Médéa, with an ochre farmhouse gable and round gate piers, connected monastery roofs and hipped garden pavilions.',
  camera,
  lookAt,
  sunDirection: [-49, 57, 32],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.8,
    basis: 'Mapped outline of the named abbey building.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_sandstone_raw',
    'stone_sandstone',
    'tile_ceramic',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'entrance-gate-and-ochre-gable', position: [-33, 3.1, -33], lookAt: [-12, 3.45, -20] },
    { name: 'masonry-and-garden-pavilions', position: [-38, 14, 51], lookAt: [11, 8, 7] },
    { name: 'roof-and-attached-range', position: [46, 30, -56], lookAt: [8, 7, -11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tibhirine-abbey-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.74,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
