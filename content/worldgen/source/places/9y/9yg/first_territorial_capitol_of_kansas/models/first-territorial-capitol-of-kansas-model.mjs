import { readFileSync } from 'node:fs';
import {
  abox,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { mappedRing } = read('native-map/kansas-territorial-capitol-shape-controls');
const outline = outwardRing(mappedRing);
const eave = 6.6;
const ridge = 9.54;

const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  shakes: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.93 },
  trim: { slot: 'trim', localRef: 'palette:#c9c3aa', roughness: 0.87 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.9 },
  brick: { slot: 'trim', graph: 'brick_flemish', roughness: 0.91 },
  glass: { slot: 'window', localRef: 'palette:#344449', roughness: 0.42 },
};
const color = {
  limestone: rgb('a7a08a'),
  face: ['b8ac91', 'a09882', 'b2a48a', 'a79f8c', 'bcb299'].map(rgb),
  sill: rgb('b7ae97'),
  cornice: rgb('c4baa3'),
  sash: rgb('ddd6c0'),
  shakes: rgb('625c4d'),
  brown: rgb('61513c'),
  panel: rgb('75624a'),
  brick: rgb('76584c'),
  pane: rgb('465254'),
};

function asQuad(out, slot, face, left, right, bottom, top, depth, tint) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    tint,
  );
}

function openingsFor(face, end) {
  const apertures = [{ u: face.length / 2, y: 0.24, width: 1.31, height: 2.31, door: true }];
  if (end) return apertures;
  for (const fraction of [0.15, 0.34, 0.66, 0.85]) {
    apertures.push({ u: fraction * face.length, y: 1.36, width: 0.89, height: 1.46 });
  }
  for (const fraction of [0.15, 0.34, 0.5, 0.66, 0.85]) {
    apertures.push({ u: fraction * face.length, y: 4.79, width: 0.86, height: 1.12 });
  }
  return apertures;
}

function wall(out, face, apertures, level) {
  const corners = [-1.82, eave, ...apertures.flatMap(({ y, height }) => [y, y + height])];
  const bands = [...new Set(corners)].sort((a, b) => a - b);
  for (let i = 1; i < bands.length; i++) {
    const bottom = bands[i - 1];
    const top = bands[i];
    const gaps = apertures
      .filter(({ y, height }) => y < top && y + height > bottom)
      .sort((a, b) => a.u - b.u);
    let left = 0;
    for (const { u, width } of gaps) {
      asQuad(out, 'limestone', face, left, u - width / 2, bottom, top, 0, color.limestone);
      left = u + width / 2;
    }
    asQuad(out, 'limestone', face, left, face.length, bottom, top, 0, color.limestone);
  }
  if (level < 2) return;

  // The irregular ashlar courses stop at the jambs, leaving the shuttered openings readable.
  const courseHeight = level === 3 ? 0.34 : 0.63;
  const nominalWidth = level === 3 ? 0.66 : 1.13;
  for (let row = 0; row * courseHeight < eave; row++) {
    const bottom = -0.45 + row * courseHeight;
    const top = Math.min(eave - 0.12, bottom + courseHeight - 0.024);
    for (let column = -1; column * nominalWidth < face.length; column++) {
      const pitch = ((row * 13 + (column + 2) * 7) % 13) / 13;
      const left = Math.max(0.019, (column + (row % 2) * 0.46) * nominalWidth + pitch * 0.14);
      const right = Math.min(face.length - 0.019, left + nominalWidth * (0.69 + pitch * 0.15));
      const hitsOpening = apertures.some(
        ({ u, width, y, height }) =>
          left < u + width / 2 + 0.08 &&
          right > u - width / 2 - 0.08 &&
          bottom < y + height + 0.11 &&
          top > y - 0.13,
      );
      if (right - left < 0.08 || hitsOpening) continue;
      const tint = color.face[(row + (column + 2) * 3) % color.face.length];
      if (level === 3) {
        fbox(out, 'limestone', face, left, right, bottom, top, -0.009, 0.032 + pitch * 0.037, tint);
      } else {
        asQuad(out, 'limestone', face, left, right, bottom, top, 0.015, tint);
      }
    }
  }
}

function fitOpening(out, face, aperture, level) {
  const { u, y, width, height, door = false } = aperture;
  const left = u - width / 2;
  const right = u + width / 2;
  const top = y + height;
  const reveal = level === 0 ? -0.026 : -0.13;
  asQuad(
    out,
    door ? 'timber' : 'glass',
    face,
    left,
    right,
    y,
    top,
    reveal,
    door ? color.brown : color.pane,
  );
  if (!level) return;

  for (const x of [left, right]) {
    fbox(out, 'trim', face, x - 0.037, x + 0.047, y, top, reveal - 0.014, 0.035, color.sash);
  }
  fbox(out, 'timber', face, left - 0.1, right + 0.1, top, top + 0.115, -0.08, 0.044, color.brown);
  fbox(out, 'limestone', face, left - 0.14, right + 0.14, y - 0.13, y, reveal, 0.14, color.sill);
  if (door) {
    fbox(
      out,
      'trim',
      face,
      left,
      right,
      top - 0.39,
      top - 0.34,
      reveal,
      reveal + 0.055,
      color.sash,
    );
    asQuad(
      out,
      'glass',
      face,
      left + 0.045,
      right - 0.045,
      top - 0.335,
      top - 0.045,
      reveal + 0.01,
      color.pane,
    );
    if (level >= 2) {
      for (const x of [u - 0.31, u + 0.31]) {
        for (const bottom of [y + 0.14, y + 1.02]) {
          fbox(
            out,
            'timber',
            face,
            x - 0.21,
            x + 0.21,
            bottom,
            bottom + 0.6,
            reveal - 0.013,
            reveal + 0.024,
            color.panel,
          );
        }
      }
    }
    return;
  }

  for (const x of [left - 0.205, right + 0.205]) {
    fbox(out, 'trim', face, x - 0.17, x + 0.17, y + 0.018, top - 0.038, 0.022, 0.072, color.sash);
    if (level === 3) {
      for (const yRail of [y + 0.13, top - 0.19]) {
        fbox(
          out,
          'trim',
          face,
          x - 0.16,
          x + 0.16,
          yRail,
          yRail + 0.075,
          0.065,
          0.091,
          color.cornice,
        );
      }
    }
  }
  fbox(
    out,
    'trim',
    face,
    left,
    right,
    y + height * 0.52,
    y + height * 0.52 + 0.052,
    reveal,
    reveal + 0.055,
    color.sash,
  );
  if (level >= 2) {
    fbox(out, 'trim', face, u - 0.027, u + 0.027, y, top, reveal, reveal + 0.052, color.sash);
  }
  if (level === 3) {
    for (const fraction of [0.26, 0.75]) {
      const rail = y + height * fraction;
      fbox(out, 'trim', face, left, right, rail, rail + 0.028, reveal, reveal + 0.048, color.sash);
    }
  }
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const southGable = mid(mappedRing[0], mappedRing[3]);
const northGable = mid(mappedRing[1], mappedRing[2]);
const width = Math.hypot(mappedRing[3][0] - mappedRing[0][0], mappedRing[3][1] - mappedRing[0][1]);

function build(out, level) {
  for (const [i, point] of outline.entries()) {
    const face = wallFace(point, outline[(i + 1) % outline.length]);
    const end = face.length < 14;
    const apertures = openingsFor(face, end);
    wall(out, face, apertures, level);
    for (const aperture of apertures) fitOpening(out, face, aperture, level);
    if (!end) {
      fbox(
        out,
        'trim',
        face,
        0,
        face.length,
        eave - 0.14,
        eave + 0.025,
        -0.024,
        0.18,
        color.cornice,
      );
    }
  }
  gableRoof(out, 'shakes', southGable, northGable, width, eave, ridge, color.shakes, {
    overhang: 0.24,
    endSlot: 'limestone',
    endColor: color.limestone,
  });

  for (const [x, z] of [southGable, northGable]) {
    const center = z - Math.sign(z) * 0.22;
    abox(
      out,
      'brick',
      [x - 0.38, ridge - 0.26, center - 0.34],
      [x + 0.38, ridge + 0.52, center + 0.34],
      color.brick,
    );
    if (level > 0) {
      abox(
        out,
        'brick',
        [x - 0.44, ridge + 0.51, center - 0.4],
        [x + 0.44, ridge + 0.63, center + 0.4],
        color.brick,
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'first-territorial-capitol-of-kansas-model.mjs';
const camera = [-27, 15, 28];
const lookAt = [0, 4, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The restored First Territorial Capitol at Pawnee, with two storeys of limestone, shuttered sash windows, a gabled shake roof and two brick chimneys.',
  camera,
  lookAt,
  sunDirection: [-35, 54, 38],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.96,
    basis: 'OpenStreetMap way 654074791 outlines the four standing masonry walls.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'western-gable', position: [-2, 4, 24], lookAt: [0, 4, 4] },
    { name: 'northern-facade', position: [-20, 5.5, 4], lookAt: [-3, 3.9, 0] },
    { name: 'roof-and-chimneys', position: [-21, 17, -20], lookAt: [0, 6, 0] },
    { name: 'eastern-gable-and-side', position: [20, 8, -27], lookAt: [0, 4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'pawnee-capitol-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.49,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.22, surfaces },
      street: { export: 'street', errorMeters: 0.081, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.024, surfaces },
    },
  },
};
