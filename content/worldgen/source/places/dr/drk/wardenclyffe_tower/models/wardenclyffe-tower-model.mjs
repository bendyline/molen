import { readFileSync } from 'node:fs';
import {
  extrude,
  outwardRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  cross,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const foundation = outwardRing(frame.geometry.outline);
const timber = rgb('92735a');
const darkWood = rgb('75614f');
const litWood = rgb('a58562');
const ribs = rgb('777063');
const rim = rgb('8f826c');
const concrete = rgb('a39a85');
const dimensions = plan.dimensions;
const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97 },
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.94, doubleSided: true },
  platform: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, doubleSided: true },
  frame: {
    slot: 'roof',
    graph: 'metal_painted',
    roughness: 0.9,
    metallic: 0.12,
    doubleSided: true,
  },
};
const topHeight = dimensions.timberHeightM;
const topScale = 0.325;

function spar(out, slot, a, b, width, depth, color, thin = false) {
  if (!thin) {
    beam(out, slot, a, b, width, depth, color);
    return;
  }
  const direction = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(direction, Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const perpendicular = normalize(cross(direction, across));
  for (const [normal, thickness] of [
    [across, width],
    [perpendicular, depth],
  ]) {
    const delta = normal.map((v) => (v * thickness) / 2);
    const edge = (p, sign) => p.map((v, i) => v + sign * delta[i]);
    const points = [edge(a, -1), edge(a, 1), edge(b, 1), edge(b, -1)];
    const outward = cross(normal, direction);
    face(out, slot, points, outward, color);
  }
}

function nativeRing(y) {
  const fraction = Math.max(0, (y - 0.29) / (topHeight - 0.29));
  const ratio = 0.985 + (topScale - 0.985) * fraction;
  return foundation.map(([x, z]) => [x * ratio, y, z * ratio]);
}

function pedestal(out, lod) {
  const inner = foundation.map(([x, z]) => [x * 0.925, z * 0.925]);
  if (lod === 0) {
    extrude(out, 'stone', foundation, -0.36, 0.25, concrete, { holes: [inner], top: false });
  } else {
    extrude(out, 'stone', foundation, -0.36, 0.3, concrete, { holes: [inner], top: false });
    for (let i = 0; i < foundation.length; i++) {
      const k = (i + 1) % foundation.length;
      const at = ([x, z]) => [x, 0.3, z];
      face(
        out,
        'stone',
        [at(foundation[i]), at(foundation[k]), at(inner[k]), at(inner[i])],
        [0, 1, 0],
        concrete,
      );
    }
  }
}

function timberFrame(out, lod) {
  const heights =
    lod === 0
      ? [0.4, 12.9, 23.8, 35.4, topHeight]
      : [0.4, 5.19, 10.21, 15.48, 20.88, 26.08, 31.24, 36.27, 41.44, topHeight];
  const tracks = heights.map(nativeRing);
  for (let i = 0; i < 8; i++) {
    const k = (i + 1) % 8;
    spar(
      out,
      'timber',
      tracks[0][i],
      tracks.at(-1)[i],
      0.71,
      0.58,
      i % 3 === 0 ? litWood : timber,
      lod === 0,
    );
    for (let j = 0; j < tracks.length; j++) {
      const tier = tracks[j];
      const thickness = 0.45 - (j / (tracks.length - 1)) * 0.22;
      spar(out, 'timber', tier[i], tier[k], thickness, thickness, darkWood, lod === 0);
    }
    for (let j = 0; j < tracks.length - 1; j++) {
      const lo = tracks[j],
        hi = tracks[j + 1];
      const width = lod === 0 ? 0.21 : 0.26;
      spar(out, 'timber', lo[i], hi[k], width, 0.17, timber, lod < 2);
      if (lod > 0 || j % 2 === 0) spar(out, 'timber', lo[k], hi[i], width, 0.17, litWood, lod < 2);
      if (lod < 2) continue;
      const mid = (a, b, t) => a.map((v, h) => v + (b[h] - v) * t);
      const lr = mid(lo[i], lo[k], 0.5),
        hr = mid(hi[i], hi[k], 0.5);
      spar(out, 'timber', lr, hr, 0.31, 0.22, darkWood);
      if (lod === 3) {
        const half = (a, b, y) => mid(a, b, y);
        spar(out, 'timber', lo[i], half(lr, hr, 0.5), 0.14, 0.13, litWood);
        spar(out, 'timber', lo[k], half(lr, hr, 0.5), 0.14, 0.13, litWood);
      }
    }
  }
}

function innerStaging(out, lod) {
  if (lod === 0) return;
  const heights = [0.29, 6.1, 12.55, 18.9, 25.2, 31.6, 38, 44.3, 46.9];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const sections = heights.map((y) => {
    const r = 1.52 - (0.49 * y) / 46.9;
    return corners.map(([x, z]) => [x * r, y, z * r]);
  });
  for (let i = 0; i < corners.length; i++) {
    const k = (i + 1) % corners.length;
    spar(out, 'timber', sections[0][i], sections.at(-1)[i], 0.34, 0.34, darkWood);
    for (let j = 0; j < sections.length - 1; j++) {
      spar(out, 'timber', sections[j][i], sections[j][k], 0.22, 0.21, litWood, lod === 1);
      spar(out, 'timber', sections[j][i], sections[j + 1][k], 0.19, 0.14, timber, lod === 1);
      if (lod >= 2) spar(out, 'timber', sections[j][k], sections[j + 1][i], 0.17, 0.13, darkWood);
    }
  }
}

function cupola(out, lod) {
  const n = [12, 16, 24, 32][lod],
    radius = dimensions.crownDiameterM / 2;
  const full = [
    [0.64, 42.18],
    [0.84, 43.45],
    [0.97, 45.02],
    [1.0, 46.88],
    [0.99, 48.41],
    [0.93, 50.43],
    [0.79, 52.78],
    [0.56, 55.23],
    [0.28, 56.57],
    [0.044, 56.9976],
  ];
  const profiles =
    lod === 0
      ? [full[0], full[2], full[4], full[6], full[9]]
      : lod === 1
        ? [full[0], full[1], full[3], full[5], full[6], full[8], full[9]]
        : full;
  const polar = (r, y, i) => {
    const a = (2 * Math.PI * i) / n - 0.075;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  const rings = profiles.map(([r, y]) =>
    Array.from({ length: n }, (_, i) => polar(r * radius, y, i)),
  );
  for (let j = 0; j < rings.length; j++) {
    const r = rings[j];
    const belt = j === 0 || j === rings.length - 1 || Math.abs(r[0][1] - 46.88) < 2;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      if (belt || (lod >= 2 && j % 2 === 0))
        spar(
          out,
          'frame',
          r[i],
          r[k],
          belt ? 0.21 : 0.135,
          belt ? 0.22 : 0.13,
          j % 2 ? rim : ribs,
          lod < 2,
        );
      if (j === rings.length - 1) continue;
      const tint = (i + j) % 5 === 0 ? rim : ribs;
      spar(out, 'frame', r[i], rings[j + 1][i], j < 4 ? 0.235 : 0.17, 0.181, tint, lod < 2);
    }
  }
  const platform = Array.from({ length: lod > 1 ? 24 : 12 }, (_, i) => {
    const a = (2 * Math.PI * i) / (lod > 1 ? 24 : 12);
    return [6.8 * Math.cos(a), 44.05, 6.8 * Math.sin(a)];
  });
  face(out, 'platform', platform, [0, 1, 0], darkWood);
  const neck = nativeRing(43.63);
  for (let i = 0; i < neck.length; i++) {
    const a = (2 * Math.PI * i) / neck.length + Math.PI / 9;
    spar(
      out,
      'timber',
      neck[i],
      [6.8 * Math.cos(a), 44.02, 6.8 * Math.sin(a)],
      0.27,
      0.23,
      litWood,
      lod === 0,
    );
  }
}

function build(out, lod) {
  pedestal(out, lod);
  timberFrame(out, lod);
  innerStaging(out, lod);
  cupola(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'wardenclyffe-tower-model.mjs';
const camera = [83, 37, 88],
  lookAt = [0, 24, 0];
const viewingDate = '1904-06-04';
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'tower',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: viewingDate,
    validFrom: viewingDate,
    validUntil: '1905-01-01',
  },
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The exposed octagonal timber frame and unfinished ribbed crown of Wardenclyffe Tower as published in 1904.',
  camera,
  lookAt,
  sunDirection: [-27, 56, 73],
  mediumFiContext: {
    scale: 1.34,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'wood_plain', 'metal_painted'],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'wardenclyffe-octagonal-timber-tower', position: camera, lookAt },
    { name: 'open-cupola-and-radial-crown-braces', position: [37, 53, 39], lookAt: [0, 48, 0] },
    {
      name: 'surviving-foundation-and-octagonal-leg-frames',
      position: [33, 8, -34],
      lookAt: [0, 8, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'wardenclyffe-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.051, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original historical model from the public-domain 1904 Scientific American Supplement and the mapped foundation with independent USGS terrain.',
};
