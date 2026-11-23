import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  edge,
  face,
  floorSampler,
  pairs,
  rect,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  beam,
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const grade = floorSampler(read('terrain-grid'));
const ground = frame.geometry.outline.slice(0, -1);
const gold = rgb('c5a675');
const goldWarm = rgb('bfa171');
const coarse = rgb('a5a396');
const trim = rgb('dfd9c9');
const base = rgb('c4c2b2');
const deep = rgb('6a9688');
const teal = rgb('63a69b');
const tail = rgb('58998b');
const ridge = rgb('d58c3e');
const brack = rgb('5c8277');
const under = rgb('84978b');
const window = rgb('718186');
const skylight = rgb('657d82');
const skylightLight = rgb('849b9d');
const slate = rgb('acaaa0');
const lawn = rgb('78835c');
const surfaces = {
  walls: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  plinth: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  crest: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.1 },
  planting: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98 },
};
const up = [0, 1, 0];
const deckY = 5.74;
function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function side(out, slot, F, left, right, y0, y1, d, color) {
  quad4(out, slot, F.P(left, y0, d), F.P(right, y0, d), F.P(right, y1, d), F.P(left, y1, d), color);
}
function shell(out, lod) {
  for (const [i, [a, b]] of pairs([...ground, ground[0]]).entries()) {
    const w = edge(a, b, -1);
    const line = [b[0] - a[0], b[1] - a[1]];
    const length = Math.hypot(...line);
    if (length < 0.06) continue;
    const F = facade(a, line);
    const aa = Math.min(deckY - 0.4, grade(a) - 0.75),
      bb = Math.min(deckY - 0.4, grade(b) - 0.75);
    face(
      out,
      'plinth',
      [F.P(0, aa), F.P(length, bb), F.P(length, deckY), F.P(0, deckY)],
      w.normal,
      base,
    );
    side(out, 'walls', F, 0, length, deckY, 11.47, 0, i % 5 === 0 ? goldWarm : gold);
    if (lod >= 1) {
      side(out, 'trim', F, 0, length, deckY - 0.14, deckY + 0.27, 0.04, trim);
      side(out, 'trim', F, 0, length, 10.68, 11.32, 0.035, trim);
      side(out, 'roof', F, 0, length, 11.32, 11.72, 0.073, deep);
      if (lod >= 2 && i !== 11)
        for (let u = 1.8; u < length - 1.02; u += 4.6)
          side(out, 'glass', F, u - 0.62, u + 0.62, 7.1, 9.38, 0.027, window);
    }
  }
  cap(out, 'roof', ground, 11.54, deep);
}
const roofs = [
  { x: 0, z: -25, w: 43.6, d: 26.3, eave: 19.21, peak: 25.22, flare: 1.02, high: true },
  { x: -31.4, z: -9.6, w: 26.9, d: 19.5, eave: 13.26, peak: 17.46, flare: 0.58 },
  { x: 31.4, z: -9.6, w: 26.9, d: 19.5, eave: 13.26, peak: 17.46, flare: 0.58 },
  { x: -54.9, z: -29.7, w: 21.8, d: 25.1, eave: 12.9, peak: 16.73, flare: 0.62 },
  { x: 54.6, z: -29.5, w: 21.8, d: 25.1, eave: 12.9, peak: 16.73, flare: 0.62 },
];
function ring(pavilion, rX, rZ, y, flare, resolution) {
  const sides = [
    [-rX, -rZ, rX, -rZ],
    [rX, -rZ, rX, rZ],
    [rX, rZ, -rX, rZ],
    [-rX, rZ, -rX, -rZ],
  ];
  return sides
    .flatMap(([x0, z0, x1, z1]) =>
      Array.from({ length: resolution }, (_, i) => {
        const t = i / resolution,
          edge = Math.pow(Math.abs(2 * t - 1), 6);
        return [pavilion.x + x0 + (x1 - x0) * t, y + flare * edge, pavilion.z + z0 + (z1 - z0) * t];
      }),
    )
    .reverse();
}
function pavilionWalls(out, p, lod) {
  const x0 = p.x - p.w * 0.455,
    x1 = p.x + p.w * 0.455,
    z0 = p.z - p.d * 0.438,
    z1 = p.z + p.d * 0.438;
  const y0 = p.high ? 11.49 : 10.93,
    y1 = p.eave - 0.18;
  block(out, 'walls', x0, x1, z0, z1, y0, y1, p.high ? base : gold);
  if (lod === 0) return;
  const F = facade([p.x, z1], [1, 0]);
  const n = p.high ? (lod >= 2 ? 10 : 7) : 3;
  const width = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = i * width - (x1 - x0) / 2;
    if (p.high) {
      side(out, 'glass', F, x + 0.19, x + width - 0.19, y0 + 2.14, y1 - 0.34, 0.029, window);
      if (lod >= 2) {
        const mid = x + width * 0.53;
        side(out, 'trim', F, mid - 0.08, mid + 0.08, y0 + 2.14, y1 - 0.34, 0.067, trim);
        side(out, 'trim', F, x + 0.2, x + width - 0.2, y0 + 3.49, y0 + 3.61, 0.066, trim);
      }
    } else if (i === 1) {
      side(out, 'trim', F, x + 0.71, x + width - 0.71, y0 - 0.12, y1 - 0.07, 0.049, trim);
    }
    fbox(out, 'trim', F, x - 0.11, x + 0.11, y0 + 0.1, y1, -0.015, 0.16, trim);
  }
  fbox(out, 'trim', F, -(x1 - x0) / 2, (x1 - x0) / 2, y0 + 0.45, y0 + 0.69, -0.016, 0.33, trim);
}
function palaceRoof(out, p, lod) {
  const w = p.w * 0.5,
    d = p.d * 0.5,
    res = lod === 0 && !p.high ? 1 : [2, 2, 8, 10][lod];
  const internal =
    lod <= 1
      ? [
          [1, 0],
          [0.63, 0.36],
          [0.29, 0.7],
          [0.035, 1],
        ]
      : [
          [1, 0],
          [0.86, 0.105],
          [0.68, 0.24],
          [0.51, 0.41],
          [0.34, 0.61],
          [0.18, 0.81],
          [0.032, 1],
        ];
  const rings = internal.map(([s, h]) =>
    ring(
      p,
      w * (0.63 + 0.37 * s),
      d * s,
      p.eave + (p.peak - p.eave) * h,
      p.flare * (1 - h) * 0.84,
      res,
    ),
  );
  loft(out, 'roof', rings, p.high ? teal : tail, { cap: false });
  cap(
    out,
    'roof',
    rings.at(-1).map(([x, , z]) => [x, z]),
    p.peak + 0.012,
    deep,
  );
  const eave = rings[0];
  if (lod >= 1) {
    beamPath(out, 'crest', eave, 0.19, 0.26, ridge, true);
    if (lod >= 2) {
      const skirt = ring(p, w - 0.43, d - 0.42, p.eave - 0.66, 0.13, res);
      loft(out, 'trim', [skirt, eave], under, { cap: false });
    }
    for (const z of [-1, 1]) {
      const F = facade([p.x, p.z + z * (d - 0.64)], [z, 0]);
      for (let u = -w + 0.84; u < w - 0.4; u += lod === 1 ? 5.3 : 1.39) {
        fbox(
          out,
          'trim',
          F,
          u - 0.17,
          u + 0.17,
          p.eave - 0.98,
          p.eave - 0.33,
          -0.22,
          0.4,
          lod >= 2 ? brack : trim,
        );
        if (lod >= 3)
          fbox(out, 'trim', F, u - 0.23, u + 0.23, p.eave - 0.68, p.eave - 0.5, 0.15, 0.56, trim);
      }
    }
    for (let i = 0; i < 4; i++) {
      const corner = (i * res + res - 1) % eave.length;
      if (lod === 1 && !p.high) continue;
      const line = rings.map((r) => [r[corner][0], r[corner][1] + 0.091, r[corner][2]]);
      beamPath(out, 'crest', line, 0.156, 0.19, ridge);
    }
  }
  const ridgeHalf = w * 0.635;
  beam(
    out,
    'crest',
    [p.x - ridgeHalf, p.peak + 0.09, p.z],
    [p.x + ridgeHalf, p.peak + 0.09, p.z],
    0.25,
    p.high ? 0.45 : 0.32,
    ridge,
  );
  for (const side of [-1, 1]) {
    const x = p.x + side * ridgeHalf;
    beam(
      out,
      'crest',
      [x, p.peak + 0.12, p.z],
      [x + side * 0.35, p.peak + (p.high ? 1.03 : 0.68), p.z],
      0.3,
      0.25,
      ridge,
    );
    if (lod >= 2)
      beam(
        out,
        'crest',
        [x - side * 0.53, p.peak + 0.15, p.z],
        [x, p.peak + 0.55, p.z],
        0.142,
        0.17,
        trim,
      );
  }
}
function rail(out, a, b, count, lod) {
  const near = [a[0], a[1] + 0.12, a[2]],
    far = [b[0], b[1] + 0.12, b[2]];
  beam(out, 'trim', near, far, 0.25, lod >= 1 ? 0.27 : 0.37, trim);
  beam(out, 'trim', [a[0], a[1] + 0.81, a[2]], [b[0], b[1] + 0.81, b[2]], 0.22, 0.196, trim);
  if (lod === 0) return;
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      x = a[0] + (b[0] - a[0]) * t,
      y = a[1] + (b[1] - a[1]) * t,
      z = a[2] + (b[2] - a[2]) * t;
    block(out, 'trim', x - 0.118, x + 0.118, z - 0.114, z + 0.114, y - 0.06, y + 1.05, trim);
    if (lod >= 2)
      block(out, 'trim', x - 0.155, x + 0.155, z - 0.155, z + 0.155, y + 0.96, y + 1.08, base);
  }
}
function terrace(out, lod) {
  const left = -63,
    right = 64,
    front = 24.6,
    center = -0.4;
  const paved = rect(left, front, right, -1.18);
  cap(out, 'plinth', paved, 0.135, slate);
  for (const [a, b] of pairs([...paved, paved[0]])) {
    const W = edge(a, b, -1);
    face(
      out,
      'plinth',
      [
        [...W.p(0, Math.min(grade(a) - 0.27, -0.17))],
        W.p(W.length, Math.min(grade(b) - 0.27, -0.17)),
        W.p(W.length, 0.15),
        W.p(0, 0.15),
      ],
      W.normal,
      coarse,
    );
  }
  block(out, 'plinth', -62.3, 62.7, -3.1, 2.15, 0.024, deckY, base);
  const F = facade([center, 2.17], [1, 0]);
  for (const [a, b] of [
    [-61, -48],
    [-44, -22],
    [22, 43],
    [47, 61],
  ]) {
    side(out, 'glass', F, a, b, 0.42, 4.2, 0.015, window);
    if (lod >= 1)
      for (let x = a + 1.11; x < b - 0.41; x += lod >= 2 ? 2.39 : 4.76)
        side(out, 'trim', F, x - 0.087, x + 0.087, 0.3, 4.26, 0.032, trim);
  }
  block(out, 'trim', -63, 63, -3.4, 3.02, deckY - 0.59, deckY + 0.015, trim);
  for (const x of [-16.95, 16.95]) {
    const stairs = [3, 9, 21, 28][lod],
      w = 5.4,
      z0 = 3.01,
      z1 = 17.1;
    for (let i = 0; i < stairs; i++) {
      const f = i / stairs,
        z = z0 + (z1 - z0) * f,
        y = deckY - (deckY - 0.22) * f;
      block(
        out,
        'plinth',
        x - w / 2,
        x + w / 2,
        z,
        z0 + ((z1 - z0) * (i + 1)) / stairs,
        0.23 - (i === stairs - 1 ? 0.1 : 0),
        y,
        base,
      );
    }
    for (const sign of [-1, 1]) {
      const X = x + sign * w * 0.52;
      rail(out, [X, deckY, 3.0], [X, 0.23, 17.15], [2, 5, 8, 9][lod], lod);
    }
  }
  for (const [x0, x1] of [
    [-62.6, -20.03],
    [-13.94, 13.94],
    [20.04, 62.6],
  ])
    rail(
      out,
      [x0, deckY, 2.56],
      [x1, deckY, 2.56],
      Math.ceil((x1 - x0) / (lod >= 2 ? 2.55 : 6)),
      lod,
    );
  const gl = [
    [-13.6, 0.51, 15.27],
    [13.6, 0.51, 15.27],
    [13.6, 5.18, 4.07],
    [-13.6, 5.18, 4.07],
  ];
  face(out, 'glass', gl, up, skylight);
  if (lod >= 1) {
    for (let x = -13.54; x <= 13.65; x += lod === 1 ? 4.5 : 2.26)
      beam(out, 'trim', [x, 0.56, 15.32], [x, 5.22, 4.09], 0.095, 0.11, trim);
    for (let i = 1; i < 5; i++) {
      const t = i / 5,
        y = 0.56 + 4.67 * t,
        z = 15.31 - 11.26 * t;
      beam(out, 'glass', [-13.6, y, z], [13.6, y, z], 0.14, 0.075, skylightLight);
    }
  }
  block(out, 'plinth', -14.55, 14.55, 15.23, 17.97, 0.09, 0.52, base);
  block(out, 'planting', -14.1, 14.1, 15.58, 17.61, 0.51, 0.583, lawn);
  if (lod >= 2) {
    for (let z = 19.0; z < 24.58; z += 0.76)
      quad4(
        out,
        'trim',
        [-62.6, 0.146, z + 0.025],
        [62.7, 0.146, z + 0.025],
        [62.7, 0.146, z],
        [-62.6, 0.146, z],
        coarse,
      );
  }
}
function build(out, lod) {
  shell(out, lod);
  for (const pavilion of roofs) {
    pavilionWalls(out, pavilion, lod);
    palaceRoof(out, pavilion, lod);
  }
  terrace(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'national-palace-museum-model.mjs';
const camera = [92, 50, 125],
  lookAt = [-2, 9.5, -24];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
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
    'Taipei’s National Palace Museum main building, with five green tile roof pavilions, yellow walls, white upper stairs, balustrades and inclined skylight.',
  camera,
  lookAt,
  sunDirection: [-41, 64, 54],
  mediumFiContext: {
    scale: 1.65,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).flatMap((s) => s.graph ?? []))],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'five-pavilion-roofline-and-upper-visitor-terrace', position: camera, lookAt },
    {
      name: 'white-stairs-skylight-and-golden-facade',
      position: [30, 11, 49],
      lookAt: [-5, 9.8, -8],
    },
    { name: 'curved-glazed-tiles-and-painted-eaves', position: [48, 26, 4], lookAt: [10, 16, -15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-palace-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.82,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.38, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.064, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original reconstruction from public-domain and CC0 photographs, native ODbL building geometry and the openly published Taiwan elevation derivative.',
};
