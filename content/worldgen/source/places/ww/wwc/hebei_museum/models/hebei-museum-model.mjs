import fs from 'node:fs';
import { createRequire } from 'node:module';
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

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const d = plan.dimensions;
const outer = outwardRing(frame.geometry.outline);
const courts = frame.geometry.holes.map(outwardRing);
const finish = rgb('beb2a0');
const pilaster = rgb('c7baa7');
const fascia = rgb('bbae9a');
const frameTone = rgb('777268');
const curtain = rgb('56666d');
const northWindow = rgb('555357');
const roof = rgb('868783');
const linkRoof = rgb('727e81');
const ground = rgb('a39a8b');
const shadow = rgb('6d685f');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.12 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51 },
};

const plinth = 1.38;
const northDatum = -21;
const southDatum = 31;
const mappedNorthFront = -95;
const mappedSouthFront = 96.647;

// Clip the mapped outer perimeter at the two links between the documented wings.
function clipAt(ring, z, sign) {
  const inside = (p) => sign * (p[1] - z) >= 0;
  const clipped = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const hasA = inside(a);
    const hasB = inside(b);
    if (hasA) clipped.push(a);
    if (hasA !== hasB) {
      const fraction = (z - a[1]) / (b[1] - a[1]);
      clipped.push([a[0] + (b[0] - a[0]) * fraction, z]);
    }
  }
  return clipped;
}

const north = clipAt(outer, northDatum, -1);
const south = clipAt(outer, southDatum, 1);
const link = clipAt(clipAt(outer, northDatum, 1), southDatum, -1);

function panel(out, slot, F, a, b, bottom, top, tone, depth = 0) {
  if (b - a < 0.02 || top - bottom < 0.02) return;
  quad4(
    out,
    slot,
    F.P(a, bottom, depth),
    F.P(b, bottom, depth),
    F.P(b, top, depth),
    F.P(a, top, depth),
    tone,
  );
}

function glazing(out, F, a, b, bottom, top, level, depth, tone = curtain) {
  panel(out, 'glass', F, a, b, bottom, top, tone, depth);
  if (level < 2) return;
  const count = Math.max(2, Math.ceil((b - a) / 1.63));
  const floors = Math.max(2, Math.ceil((top - bottom) / 2.45));
  for (let i = 0; i <= count; i++) {
    const x = a + ((b - a) * i) / count;
    panel(out, 'metal', F, x - 0.056, x + 0.056, bottom, top, frameTone, depth + 0.04);
  }
  for (let i = 0; i <= floors; i++) {
    const y = bottom + ((top - bottom) * i) / floors;
    panel(out, 'metal', F, a, b, y - 0.065, y + 0.065, frameTone, depth + 0.048);
  }
}

function ordinaryWalls(out, ring, roofY, level, facadePredicate, isCourt = false) {
  const points = isCourt ? outwardRing(ring).reverse() : outwardRing(ring);
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (facadePredicate(a, b)) continue;
    const F = wallFace(a, b);
    panel(out, 'wall', F, 0, F.length, plinth, roofY, finish);
    if (F.length < 7 || level === 0) continue;
    const bays = Math.max(1, Math.round(F.length / (isCourt ? 5.4 : 7.7)));
    const width = F.length / bays;
    for (let j = 0; j < bays; j++) {
      const u = j * width;
      if (level >= 2 || !isCourt) {
        panel(
          out,
          'wall',
          F,
          u + 0.22,
          u + width - 0.22,
          plinth + 0.85,
          roofY - 2.15,
          pilaster,
          0.038,
        );
      }
      if (isCourt || (level >= 2 && j % 3 === 1)) {
        for (let y = plinth + 1.6; y < roofY - 3.3; y += 5.2) {
          glazing(out, F, u + 0.24 * width, u + 0.77 * width, y, y + 2.3, 1, 0.062, northWindow);
        }
      }
    }
    panel(out, 'wall', F, 0, F.length, roofY - 1.45, roofY - 1.09, fascia, 0.063);
  }
}

const northFront = (a, b) => a[1] < mappedNorthFront + 1.55 && b[1] < mappedNorthFront + 1.55;
const southFront = (a, b) => a[1] > mappedSouthFront - 0.02 && b[1] > mappedSouthFront - 0.02;
const seam = (z) => (a, b) => a[1] === z && b[1] === z;

function roofCap(out, perimeter, holes, y, tone) {
  const vertices = [...perimeter];
  const holeStarts = [];
  for (const hole of holes) {
    holeStarts.push(vertices.length);
    vertices.push(...hole);
  }
  const indices = earcut(vertices.flat(), holeStarts);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => vertices[j]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const point = ([x, z]) => [x, y, z];
    if (Math.abs(area) < 0.0001) continue;
    tri(out, 'roof', point(a), point(area < 0 ? b : c), point(area < 0 ? c : b), tone);
  }
}

function wing(out, ring, holes, roofY, facadePredicate, level) {
  const cut = seam(ring === north ? northDatum : southDatum);
  const points = outwardRing(ring);
  roofCap(out, ring, holes, roofY, roof);
  ordinaryWalls(out, ring, roofY, level, (a, b) => facadePredicate(a, b) || cut(a, b));
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!cut(a, b)) continue;
    const F = wallFace(a, b);
    panel(out, 'wall', F, 0, F.length, d.linkHeightEstimateM, roofY, finish);
  }
  for (const court of holes) ordinaryWalls(out, court, roofY, level, () => false, true);
}

function stairs(out, F, center, width, level, rise, depth, base) {
  const steps = level >= 2 ? 9 : 4;
  for (let i = 0; i < steps; i++) {
    fbox(
      out,
      'stone',
      F,
      center - width / 2,
      center + width / 2,
      base,
      base + (rise * (i + 1)) / steps,
      depth * (1 - (i + 1) / steps),
      depth * (1 - i / steps),
      ground,
    );
  }
}

function northernFront(out, level) {
  const planFront = [...north].filter((a) => a[1] < mappedNorthFront + 1.55);
  const main = planFront.filter((a) => a[1] < -98);
  const mainFace = wallFace(
    main.reduce((a, b) => (a[0] > b[0] ? a : b)),
    main.reduce((a, b) => (a[0] < b[0] ? a : b)),
  );
  const eaves = d.northEaveEstimateM;
  const crown = d.northPorticoEstimateM;
  const width = mainFace.length;
  fbox(out, 'wall', mainFace, 0, width, crown - 4.35, crown - 0.4, -5.8, 0.42, fascia, {
    bottom: true,
  });
  fbox(out, 'wall', mainFace, -0.55, width + 0.55, crown - 0.57, crown, -6.0, 0.96, pilaster);
  fbox(out, 'stone', mainFace, 0, width, plinth - 0.5, plinth, -5.7, 0.25, ground);
  glazing(out, mainFace, 2.15, width - 2.15, plinth + 0.15, crown - 4.25, level, -5.4, northWindow);
  for (const a of [0, width - 2.2]) {
    fbox(out, 'wall', mainFace, a, a + 2.2, plinth, crown - 4.05, -5.65, 0.12, finish);
  }
  if (level >= 1) {
    panel(out, 'wall', mainFace, 2.2, width - 2.2, 7.65, 10.2, finish, -5.31);
    panel(out, 'wall', mainFace, 2.2, width - 2.2, 14.0, 15.2, finish, -5.31);
    for (const y of [crown - 2.2, crown - 0.73]) {
      fbox(out, 'wall', mainFace, -0.26, width + 0.26, y, y + 0.19, -5.88, 0.64, pilaster);
    }
  }
  const count = level ? 8 : 6;
  for (let j = 0; j < count; j++) {
    const u = 3.72 + (j * (width - 7.44)) / (count - 1);
    fbox(out, 'wall', mainFace, u - 0.61, u + 0.61, plinth, crown - 3.95, -1.02, 0.18, pilaster);
    if (level >= 2) {
      for (const [bottom, top] of [
        [plinth, plinth + 0.36],
        [crown - 4.86, crown - 4.0],
      ]) {
        fbox(out, 'wall', mainFace, u - 0.79, u + 0.79, bottom, top, -1.09, 0.24, fascia);
      }
    }
  }
  stairs(out, mainFace, width * 0.5, width - 2.7, level, plinth + 0.23, 5.1, -0.23);

  for (let i = 0; i < north.length; i++) {
    const a = north[i];
    const b = north[(i + 1) % north.length];
    if (!northFront(a, b) || a[1] < -98 || b[1] < -98) continue;
    const F = wallFace(a, b);
    if (F.length < 10) continue;
    fbox(out, 'wall', F, 0, F.length, eaves - 2.48, eaves, -2.55, 0.33, fascia, { bottom: true });
    glazing(out, F, 0, F.length, plinth, eaves - 2.42, level, -2.26, northWindow);
    const bays = level ? 9 : 6;
    for (let j = 0; j <= bays; j++) {
      const u = (F.length * j) / bays;
      fbox(out, 'wall', F, u - 0.43, u + 0.43, plinth, eaves - 2.1, -2.48, 0.2, pilaster);
      if (level >= 1 && j < bays) {
        const next = u + F.length / bays - 0.47;
        panel(out, 'wall', F, u + 0.46, next, 6.78, 9.46, finish, -2.17);
        panel(out, 'wall', F, u + 0.46, next, 13.62, 15.35, finish, -2.17);
      }
    }
  }
}

function southernFront(out, level) {
  const [a, b] = south.filter((p) => p[1] > mappedSouthFront - 0.02);
  const F = wallFace(a[0] < b[0] ? a : b, a[0] < b[0] ? b : a);
  const [eaves, portal] = [d.southEaveEstimateM, d.southPortalEstimateM];
  const center = F.length / 2;
  const half = 22.8;
  const left = center - half;
  const right = center + half;
  for (const [x0, x1] of [
    [0, left],
    [right, F.length],
  ]) {
    fbox(out, 'wall', F, x0, x1, eaves - 2.18, eaves, -4.5, 0.13, fascia, { bottom: true });
    glazing(out, F, x0, x1, plinth, eaves - 2.05, level, -4.34);
    const bays = level ? 10 : 6;
    for (let j = 0; j <= bays; j++) {
      const u = x0 + ((x1 - x0) * j) / bays;
      fbox(out, 'wall', F, u - 0.51, u + 0.51, plinth, eaves - 1.88, -4.42, 0.14, pilaster);
    }
  }
  fbox(out, 'wall', F, left, right, portal - 4.4, portal, -7.5, 0.9, pilaster, { bottom: true });
  for (const [x0, x1] of [
    [left - 0.42, left + 4.15],
    [right - 4.15, right + 0.42],
  ]) {
    fbox(out, 'wall', F, x0, x1, plinth, portal - 1.7, -7.5, 0.89, pilaster);
  }
  glazing(out, F, left + 4.2, right - 4.2, plinth, portal - 4.15, level, -7.18);
  for (const u of [center - 8.85, center - 6.82, center + 6.82, center + 8.85]) {
    fbox(out, 'wall', F, u - 0.36, u + 0.36, plinth, portal - 4.24, -4.53, -2.3, pilaster);
  }
  fbox(
    out,
    'wall',
    F,
    center - 6.15,
    center + 6.15,
    plinth + 4.65,
    plinth + 5.55,
    -6.7,
    -5.8,
    fascia,
  );
  for (const u of [center - 5.63, center + 5.63]) {
    fbox(out, 'wall', F, u - 0.52, u + 0.52, plinth, plinth + 5.45, -7.05, -5.79, fascia);
  }
  if (level >= 1) {
    panel(out, 'wall', F, left + 4.2, right - 4.2, portal - 6.02, portal - 4.51, fascia, -6.7);
    for (const [x0, x1] of [
      [left, center - 13],
      [center + 13, right],
    ]) {
      fbox(out, 'stone', F, x0, x1, -0.95, plinth + 0.27, 0, 4.7, ground);
    }
  }
  stairs(out, F, center, 25.5, level, plinth + 1.56, 5.7, -1.56);
}

function build(out, level) {
  extrude(out, 'stone', outer, -4.05, plinth, ground, { holes: courts, top: false });
  wing(
    out,
    north,
    courts.filter((p) => p[0][1] < 0),
    d.northEaveEstimateM,
    northFront,
    level,
  );
  wing(
    out,
    south,
    courts.filter((p) => p[0][1] > 0),
    d.southEaveEstimateM,
    southFront,
    level,
  );
  extrude(out, 'wall', link, plinth, d.linkHeightEstimateM, finish, { top: false });
  roofCap(out, link, [], d.linkHeightEstimateM, linkRoof);
  northernFront(out, level);
  southernFront(out, level);
  if (level) {
    const height = d.linkHeightEstimateM;
    abox(out, 'metal', [-12.8, height, -15], [11.1, height + 0.44, 26], shadow);
    abox(out, 'glass', [-11.8, height + 0.44, -14.3], [10.1, height + 0.88, 25.3], curtain);
    if (level >= 2) {
      for (let z = -13; z < 26; z += 2.15) {
        abox(out, 'metal', [-11.89, height + 0.84, z], [10.19, height + 0.94, z + 0.13], frameTone);
      }
      for (const [x, z, y] of [
        [-68, -33, d.northEaveEstimateM],
        [57, -31, d.northEaveEstimateM],
        [-62, 77, d.southEaveEstimateM],
        [61, 79, d.southEaveEstimateM],
      ]) {
        abox(out, 'roof', [x - 3.8, y, z - 2.6], [x + 4.9, y + 1.6, z + 2.65], roof);
        if (level === 3) {
          for (let u = x - 3.5; u < x + 4.8; u += 0.5) {
            abox(out, 'metal', [u, y + 0.28, z + 2.65], [u + 0.31, y + 1.33, z + 2.71], frameTone);
          }
        }
      }
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'hebei-museum-model.mjs';
const camera = [133, 94, -215];
const lookAt = [0, 11, -1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Hebei Museum',
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Shijiazhuang’s Hebei Museum, with its historic north colonnade, south portal, Sunshine Hall connection and four open courts.',
  camera,
  lookAt,
  sunDirection: [-100, 104, -110],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    holes: frame.geometry.holes,
    minimumCoverage: 0.91,
    basis: 'Named OpenStreetMap museum multipolygon with its four internal courts.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'concrete_plain',
    'stone_limestone_weathered',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-colonnade-and-forecourt', position: [52, 7, -191], lookAt: [0, 12, -90] },
    { name: 'southern-portal-and-gallery-piers', position: [-45, 6, 190], lookAt: [0, 12, 90] },
    { name: 'four-courtyards-and-link', position: [128, 160, 53], lookAt: [0, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hebei-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.73,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.32, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.044, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
