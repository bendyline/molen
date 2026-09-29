/** Cyclopean corbel bridge: individual irregular stones, without radial arch voussoirs. */

import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { kazarmaFace, polygonStone } from './kazarma-masonry.mjs';
import { quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0012_kazarma_mycenaean_bridge', 'map-frame.json')),
);
const stone = [0.655, 0.64, 0.57],
  fill = [0.43, 0.388, 0.303];
const rnd = (s) => {
  const x = Math.sin(s * 127.13 + 71.29) * 43758.5453;
  return x - Math.floor(x);
};
const roadHeight = (x) => 3.88 - Math.abs(x) * 0.043 + Math.sin(x * 0.8) * 0.035;
/** Irregular rounded polyhedra, with coherent relief across shared face borders. */
function rock(out, lo, hi, seed, slot = 'limestone', tint = stone, detail = 6) {
  const c = lo.map((v, i) => (v + hi[i]) / 2),
    half = lo.map((v, i) => (hi[i] - v) / 2),
    power = 2.5 + rnd(seed * 3) * 0.9;
  const vertex = (v) => {
    const d = Math.pow(
      v.reduce((s, u) => s + Math.pow(Math.abs(u), power), 0),
      1 / power,
    );
    const radial =
      0.94 +
      0.09 *
        Math.sin(v[0] * 3 + seed) *
        Math.cos(v[1] * 2 - seed) *
        Math.sin(v[2] * 3 + seed * 0.3);
    const p = v.map((u, i) => (u / d) * half[i] * radial),
      tilt = (rnd(seed * 7) - 0.5) * 0.25;
    return [
      c[0] + p[0] + p[1] * tilt,
      Math.max(lo[1] + 0.001, c[1] + p[1] - p[0] * tilt * 0.3),
      c[2] + p[2] + p[0] * (rnd(seed * 9) - 0.5) * 0.08,
    ];
  };
  for (let axis = 0; axis < 3; axis++)
    for (const side of [-1, 1])
      for (let i = 0; i < detail; i++)
        for (let j = 0; j < detail; j++) {
          const u = (axis + 1) % 3,
            v = (axis + 2) % 3,
            ps = [
              [i, j],
              [i + 1, j],
              [i + 1, j + 1],
              [i, j + 1],
            ].map(([a, b]) => {
              const q = [0, 0, 0];
              q[axis] = side;
              q[u] = -1 + (2 * a) / detail;
              q[v] = -1 + (2 * b) / detail;
              return vertex(q);
            });
          if (normalFor(...ps)[axis] * side < 0) ps.reverse();
          const center = ps[0].map((_, k) => ps.reduce((s, p) => s + p[k], 0) / 4);
          // Split the non-planar face into four triangles, preserving the surface relief.
          for (let k = 0; k < 4; k++) {
            const tri = [ps[k], ps[(k + 1) % 4], center];
            out.addTriangle(
              slot,
              'palette:#ffffff',
              tri,
              normalFor(...tri),
              [],
              tint.map((t) => t + (rnd(seed * 11) - 0.5) * 0.105),
            );
          }
        }
}
export function buildKazarma(out) {
  // Structural core stays behind stone faces; the water passage is truly open.
  for (const [a, b, y] of [
    [-11, -0.98, 0],
    [0.81, 11, 0],
    [-0.98, -0.86, 1.3],
    [0.64, 0.81, 1.1],
    [-0.86, -0.47, 1.65],
    [0.5, 0.64, 1.65],
    [-0.47, -0.2, 1.99],
    [0.28, 0.5, 1.91],
    [-0.2, 0.28, 2.19],
  ])
    for (let x = a; x < b; x += 0.3) {
      const end = Math.min(b, x + 0.3),
        top = roadHeight((x + end) / 2) - 0.025,
        lowWidth = 2.3 - y * 0.27,
        highWidth = 2.3 - top * 0.27;
      const p = [
        [x, y, -lowWidth],
        [end, y, -lowWidth],
        [end, y, lowWidth],
        [x, y, lowWidth],
        [x, top, -highWidth],
        [end, top, -highWidth],
        [end, top, highWidth],
        [x, top, highWidth],
      ];
      for (const indices of [
        [3, 2, 1, 0],
        [0, 1, 5, 4],
        [2, 3, 7, 6],
        [3, 0, 4, 7],
        [1, 2, 6, 5],
      ]) {
        const ps = indices.map((i) => p[i]);
        quad(out, 'aggregate', ps, normalFor(...ps), fill);
      }
    }
  kazarmaFace(out, -1);
  kazarmaFace(out, 1);
  // Deep jamb and corbel blocks follow the asymmetric silhouette of the face.
  // Their bedding continues across the passage; joints are recessed, not floating.
  let seed = 1501;
  for (let lane = 0; lane < 6; lane++) {
    for (const side of [-1, 1]) {
      const z = -1.8 + lane * 0.61;
      for (const [x0, x1, y0, y1] of [
        [-1.57, -0.88, 0, 0.84],
        [-1.53, -0.83, 0.84, 1.3],
        [-1.55, -0.47, 1.3, 1.7],
        [-1.47, -0.2, 1.7, 2.11],
        [0.66, 1.5, 0, 0.92],
        [0.68, 1.56, 0.92, 1.32],
        [0.51, 1.55, 1.32, 1.69],
        [0.27, 1.52, 1.69, 2.12],
        [-0.22, 0.29, 2.19, 2.61],
      ]) {
        polygonStone(
          out,
          [
            [x0, y0],
            [x1, y0 + 0.015],
            [x1 - 0.015, y1],
            [x0 + 0.02, y1 - 0.02],
          ],
          side,
          seed++,
          0.61,
          side * z - (2.79 - (y0 + y1) * 0.145),
        );
      }
    }
  }
  // Uneven earth/stone road surface joins the surviving top edges, without a modern rail.
  for (let i = 0; i < 110; i++) {
    const a = -11 + i * 0.2,
      b = a + 0.2,
      ya = roadHeight(a),
      yb = roadHeight(b);
    const ps = [
      [a, ya, -1.43],
      [a, ya, 1.43],
      [b, yb, 1.43],
      [b, yb, -1.43],
    ];
    quad(
      out,
      'aggregate',
      ps,
      normalFor(...ps),
      fill.map((v) => v + 0.11),
    );
    // Close the shallow road fill: a low viewing angle must not see through its
    // back face and leave the surface gravel apparently suspended in the air.
    const bottom = ps.map(([x, y, z]) => [x, y - 0.18, z]).toReversed();
    quad(out, 'aggregate', bottom, normalFor(...bottom), fill);
    for (const z of [-1.43, 1.43]) {
      const edge = [
        [a, ya - 0.18, z],
        [b, yb - 0.18, z],
        [b, yb, z],
        [a, ya, z],
      ];
      if (z < 0) edge.reverse();
      quad(out, 'aggregate', edge, normalFor(...edge), fill);
    }
  }
  for (let i = 0; i < 1600; i++) {
    const x = -10.93 + rnd(i * 5 + 21) * 21.86,
      z = -1.38 + rnd(i * 7 + 33) * 2.76,
      y = roadHeight(x),
      w = 0.018 + rnd(i + 41) * 0.065;
    rock(
      out,
      [x - w, y - 0.011, z - w * 0.64],
      [x + w, y + 0.011 + rnd(i * 13) * 0.031, z + w * 0.64],
      seed++,
      'limestone',
      stone.map((v) => v - 0.04),
      1,
    );
  }
  // Stream threshold: flat slabs separate the historic passage from bank scenery.
  for (let lane = 0; lane < 9; lane++)
    rock(
      out,
      [-0.79, 0, -2.69 + lane * 0.6],
      [0.72, 0.13, -2.1 + lane * 0.6],
      seed++,
      'limestone',
      stone.map((v) => v - 0.09),
      3,
    );
}
export const kazarmaStudy = {
  id: 'N0012',
  key: 'kazarma_mycenaean_bridge',
  title: 'Kazarma Mycenaean Bridge',
  wikidataId: 'Q254087',
  build: buildKazarma,
  surfaceOverrides: { limestone: 'weatheredlimestone' },
  normalSmoothing: { slots: ['wall'], angle: 55 },
  mapFrameDocument: 'map-frame.json',
  brief:
    'Surviving Cyclopean corbel bridge, reconstructed as individual irregular limestone boulders, projecting horizontal tunnel courses and closing stone, battered retaining wings, small dry-joint packing stones and an uneven gravel road surface.',
  refs: [
    'https://www.argolisculture.gr/el/lista-mnimeion/mykinaiki-gefyra-kazarmas/',
    'https://odysseus.culture.gr/h/2/gh251.jsp?obj_id=1710',
    'https://pergamos.lib.uoa.gr/uoa/dl/object/3417312/file.pdf',
    'https://commons.wikimedia.org/wiki/File:Arkadiko_bridge,_mycenaean,_Late_Heladic_age,_202418.jpg',
    'https://commons.wikimedia.org/wiki/File:Arkadiko_bridge,_mycenaean,_Late_Heladic_age,_202420.jpg',
    'https://commons.wikimedia.org/wiki/File:Kazarma_bridge_9267.jpg',
    'https://www.openstreetmap.org/way/306121794',
  ],
  sourceFacts: {
    construction:
      'Late Bronze Age, approximately thirteenth century BCE; Cyclopean dry-stone corbel construction',
    publishedDimensionsMeters: [22, 5.6, 4],
    mappedCentralCrossingMeters: 7.943,
    identity:
      'Kazarma/Arkadiko Q254087, distinguished from the other surviving Mycenaean bridges nearby',
  },
  reconstruction: {
    bodyLengthMeters: 22,
    baseWidthMeters: 5.6,
    roadWidthMeters: 2.86,
    mainOpeningMeters: 1.54,
    openingCrownMeters: 2.19,
    basis:
      'Authority photograph and independent 2020/2019 exterior photographs guide the central irregular opening, batter and low road edges. Major stone silhouettes are hand traced and reconstructed as chipped angular polyhedra; perspective and scale are interpreted. Individual back-face courses and buried wing extent are original reconstructions rather than scan data.',
  },
  nativeAxes: {
    x: 'north-northeast along mapped footway',
    y: 'up from passage threshold and lowest foundation',
    z: 'east-southeast along water passage',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/306121794'],
    source: 'https://www.openstreetmap.org/way/306121794',
    elevationMode: 'terrain-contact',
    notes:
      'Exact mapped bridge path fixes central crossing and signed travel axis. Full retaining wings reconstructed beyond the short mapped crossing; riverbed threshold Y0 requires local terrain agreement.',
  }),
  limitations: [
    'Original detailed exterior; individual boulder shapes, hidden tunnel joints and full retaining-wing extent are interpreted from photographs and published overall dimensions.',
    'No modern safety parapet, regular Roman voussoirs, embedded source photograph or surrounding landscape is invented.',
    'The 22 m published length includes retaining wings; do not stretch the 7.943 m mapped central bridge path to 22 m. Exact rocky-bank exposure and streambed height require local terrain review.',
  ],
  camera: { position: [13, 11, 22], lookAt: [0, 1.8, 0], fov: 44 },
  qaCameras: [
    { name: 'east-face', position: [0.5, 3.5, 12], lookAt: [0, 1.9, 0], fov: 50 },
    { name: 'west-face', position: [-1, 3.6, -12], lookAt: [0, 1.9, 0], fov: 50 },
    { name: 'corbelled-passage', position: [0, 1.1, 6.3], lookAt: [0, 1.4, -1.8], fov: 53 },
    { name: 'road-top', position: [7, 6.2, 5], lookAt: [0, 3.45, 0], fov: 50 },
    { name: 'packing-stones', position: [-2.1, 3.1, 5.7], lookAt: [-1.7, 2.5, 2.1], fov: 48 },
    { name: 'retaining-wings', position: [13, 6, 9], lookAt: [6, 1.6, 0], fov: 48 },
  ],
};
