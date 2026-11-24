import fs from 'node:fs';
import {
  abox,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  outer: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  inner: { slot: 'trim', graph: 'concrete_plain', roughness: 0.84 },
  edge: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92 },
  soil: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
};
const colors = {
  outer: rgb('c8a69e'),
  inner: rgb('bc988d'),
  joint: rgb('af8b80'),
  edge: rgb('ba9187'),
  soil: rgb('a48b70'),
};
const halfSpan = plan.dimensions.roofLengthM / 2;
const halfFoundation = plan.dimensions.foundationLengthM / 2;
const floorHalfWidth = plan.dimensions.foundationWidthM / 2;
const maxHeight = plan.dimensions.heightM;
const shellMinimum = plan.dimensions.minimumShellThicknessM;
const crossStart = -1.108;
const crossSweep = Math.PI - 2 * crossStart;
const angle = (t) => crossStart + crossSweep * t;
const smooth = (value) => value * value * (3 - 2 * value);

function shellPoint([u, v], inside) {
  const a = angle(v);
  const vertical = Math.sin(a);
  const side = Math.cos(a);
  const rise = Math.max(0, (vertical + 0.54) / 1.54);
  const sweep = smooth(rise);
  const edgeCurve = 0.29 * u * u * sweep;
  const span = halfFoundation + (halfSpan - halfFoundation) * sweep;
  const rotation = 0.11 * Math.sin(2 * Math.PI * v) * rise;
  const skin = inside ? shellMinimum + 0.033 * (1 - sweep) : 0;
  const room = 0.27 * u * u * sweep;
  const y = 1.766 + (maxHeight - 2.056 - skin) * vertical + edgeCurve;
  return [u * span + rotation, y, (2.05 + room - skin) * side];
}

function curvedQuad(out, slot, [a, b, c, d], color) {
  tri(out, slot, a, b, c, color);
  tri(out, slot, a, c, d, color);
}

function skinQuad(out, uv, outer, inner) {
  curvedQuad(
    out,
    'outer',
    uv.map((p) => shellPoint(p, false)),
    outer,
  );
  curvedQuad(
    out,
    'inner',
    uv.toReversed().map((p) => shellPoint(p, true)),
    inner,
  );
}

function reveal(out, a, b, color) {
  curvedQuad(
    out,
    'edge',
    [shellPoint(a, false), shellPoint(b, false), shellPoint(b, true), shellPoint(a, true)],
    color,
  );
}

function aperture(out, u0, u1, v0, v1, size, shift, outer, inner) {
  const u = (u0 + u1) / 2,
    v = (v0 + v1) / 2;
  const hu = (u1 - u0) * size,
    hv = (v1 - v0) * (size + shift * 0.045);
  const a = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const b = [
    [u - hu, v - hv * 0.37],
    [u + hu * 0.49, v - hv],
    [u + hu, v + hv * 0.37],
    [u - hu * 0.36, v + hv],
  ];
  for (let k = 0; k < a.length; k++) {
    const next = (k + 1) % a.length;
    skinQuad(out, [a[k], a[next], b[next], b[k]], outer, inner);
    reveal(out, b[k], b[next], colors.edge);
  }
}

function perforation(i, j, along, cross, level) {
  const u = Math.abs((2 * (i + 0.5)) / along - 1);
  const v = Math.abs((2 * (j + 0.5)) / cross - 1);
  const phase = (i + 2 * j) % 3;
  if (i === 0 || i === along - 1 || j === 0 || j === cross - 1) return 0;
  if (u > 0.61 && v < 0.66 && phase !== 1) {
    return [0.22, 0.25, 0.26, 0.27][level] + u * 0.09 - v * 0.07;
  }
  if (level > 1 && u > 0.29 && v < 0.72 && phase === 0 && j % 2 === 0) {
    return 0.18 + 0.07 * u;
  }
  if (level > 1 && v > 0.74 && u < 0.81 && phase === 2) return 0.11;
  return 0;
}

function build(out, level) {
  const [along, cross] = [
    [8, 9],
    [14, 15],
    [22, 23],
    [28, 27],
  ][level];
  for (let j = 0; j < cross; j++) {
    const v0 = j / cross,
      v1 = (j + 1) / cross;
    for (let i = 0; i < along; i++) {
      const u0 = (2 * i) / along - 1,
        u1 = (2 * (i + 1)) / along - 1;
      const outside = colors.outer,
        inside = colors.inner;
      const hole = perforation(i, j, along, cross, level);
      const corners = [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ];
      if (hole) {
        aperture(out, u0, u1, v0, v1, hole, ((i + j) % 3) - 1, outside, inside);
      } else {
        skinQuad(out, corners, outside, inside);
      }
      if (j === 0) reveal(out, corners[1], corners[0], colors.joint);
      if (i === along - 1) reveal(out, corners[2], corners[1], colors.edge);
      if (j === cross - 1) reveal(out, corners[3], corners[2], colors.joint);
      if (i === 0) reveal(out, corners[0], corners[3], colors.edge);
    }
  }
  // Local soil covers the prefabricated slab; its shallow visible edge follows the plinth.
  abox(
    out,
    'soil',
    [-halfFoundation, -0.19, -floorHalfWidth],
    [halfFoundation, 0.095, floorHalfWidth],
    colors.soil,
  );
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'carapace-pavilion-model.mjs';
const camera = [11.4, 5.3, 14.1],
  lookAt = [0, 1.8, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  category: 'pavilion',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief: 'Pink concrete shade pavilion with thin double-curved wings and diagrid perforations.',
  camera,
  lookAt,
  sunDirection: [-30, 54, 47],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'desert-shelter-and-original-terrain',
      position: [10.2, 3.7, 12.2],
      lookAt: [0, 1.7, 0],
    },
    { name: 'northern-opening-and-thin-shell', position: [8.8, 2.9, 4.1], lookAt: [-0.5, 1.85, 0] },
    {
      name: 'roof-perforations-and-cantilevers',
      position: [-5.2, 8.8, -9.2],
      lookAt: [0.7, 2.5, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'carapace-pavilion-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.37,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.095, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.026, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Native USGS terrain and the photographer’s CC0 images are public domain.',
};
