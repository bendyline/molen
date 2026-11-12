/** Altria Theater and its North Laurel Street entrance, Richmond. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.73, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.77, metallic: 0.18 },
  tile: { slot: 'trim', graph: 'tile_glazed', roughness: 0.66, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.39, metallic: 0.06 },
};
const colors = {
  brick: rgb('ad8d68'),
  trim: rgb('e3cdaa'),
  roof: rgb('787d77'),
  copper: rgb('7fa89b'),
  tile: rgb('486373'),
  glass: rgb('40484b'),
};
const cream = rgb('ded2bb'),
  dark = rgb('282926'),
  amber = rgb('bc8b53');
const {
  nativeRing,
  foundationBottom,
  baseTop,
  frontDepth,
  wingRoof,
  courtFront,
  entrance,
  towers,
  pavilions,
} = plan;
const block = (o, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(o, k, [x0, y0, z0], [x1, y1, z1], color);

function face(o, k, points, expected, color = colors[k]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(o, k, points, n, color);
  else o.addConvexPolygon(k, 'palette:#ffffff', points, n, ([x, y]) => [x, y], color);
}
function prism(o, k, ring, low, high, color = colors[k], topMaterial = k) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - z * a;
  }, 0);
  const loop = area > 0 ? ring : [...ring].reverse();
  for (let i = 0; i < loop.length; i++) {
    const [x, z] = loop[i],
      [a, b] = loop[(i + 1) % loop.length];
    face(
      o,
      k,
      [
        [x, low, z],
        [a, low, b],
        [a, high, b],
        [x, high, z],
      ],
      [b - z, 0, x - a],
      color,
    );
  }
  for (const [y, ny] of [
    [low, -1],
    [high, 1],
  ]) {
    const material = ny > 0 ? topMaterial : k;
    const tint = material === k ? color : colors[material];
    const cap = new MeshBufferBuilder();
    if (
      !cap.addCap(
        material,
        'palette:#ffffff',
        loop,
        [],
        () => y,
        [0, ny, 0],
        (p) => p,
        tint,
      )
    ) {
      throw Error('Cannot triangulate Altria Theater footprint');
    }
    const mesh = cap.finalize();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const triangle = Array.from(mesh.indices.slice(i, i + 3), (index) =>
        Array.from(mesh.positions.slice(index * 3, index * 3 + 3)),
      );
      face(o, material, triangle, [0, ny, 0], tint);
    }
  }
}
function masonryRoof(o, ring, low, eave, roof, lod) {
  if (!lod) {
    prism(o, 'brick', ring, low, roof, colors.brick, 'roof');
    return;
  }
  prism(o, 'brick', ring, low, eave);
  prism(o, 'roof', ring, eave, roof);
}
function clip(ring, axis, value, below) {
  const inside = (p) => (below ? p[axis] <= value : p[axis] >= value);
  return ring.flatMap((p, i) => {
    const q = ring[(i + 1) % ring.length];
    const result = inside(p) ? [p] : [];
    if (inside(p) !== inside(q)) {
      const t = (value - p[axis]) / (q[axis] - p[axis]);
      result.push(p.map((v, j) => (j === axis ? value : v + t * (q[j] - v))));
    }
    return result;
  });
}
function frontAt(x) {
  const crossings = nativeRing.flatMap((p, i) => {
    const q = nativeRing[(i + 1) % nativeRing.length];
    return (p[0] <= x && q[0] > x) || (q[0] <= x && p[0] > x)
      ? [p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0])]
      : [];
  });
  return Math.min(...crossings);
}
function panel(o, k, x, y, z, w, h, depth = 0.065, color = colors[k]) {
  block(o, k, x - w / 2, y, z - depth, x + w / 2, y + h, z, color);
}
function flatPanel(o, k, x, y, z, w, h) {
  face(
    o,
    k,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, -1],
  );
}
function rectWindow(o, x, z, y, w, h, lod) {
  if (lod < 2) {
    if (lod) flatPanel(o, 'trim', x, y - 0.09, z - 0.098, w + 0.23, h + 0.18);
    flatPanel(o, 'glass', x, y, z - 0.12, w, h);
    return;
  }
  panel(o, 'trim', x, y - 0.09, z, w + 0.23, h + 0.18, 0.098);
  panel(o, 'glass', x, y, z - 0.103, w, h, 0.016);
  if (lod > 1) panel(o, 'trim', x, y + h * 0.49, z - 0.13, w, 0.072, 0.025);
}
function roundTop(o, k, x, y, z, w, h, lod, color = colors[k]) {
  const spring = y + h - w / 2;
  const steps = lod > 1 ? 8 : 4;
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (Math.PI * i) / steps;
    return [x + (Math.cos(t) * w) / 2, spring + (Math.sin(t) * w) / 2, z];
  });
  face(o, k, [[x - w / 2, y, z], [x + w / 2, y, z], ...arc], [0, 0, -1], color);
}
function pairedWindow(o, x, z, lod) {
  if (!lod) {
    flatPanel(o, 'glass', x, 4.35, z - 0.045, 1.65, 3.13);
    return;
  }
  roundTop(o, 'tile', x, 4.19, z - 0.054, 2.54, 3.61, lod);
  for (const dx of [-0.55, 0.55]) {
    roundTop(o, 'trim', x + dx, 4.27, z - 0.075, 1.13, 3.09, lod);
    roundTop(o, 'glass', x + dx, 4.44, z - 0.099, 0.82, 2.76, lod);
    panel(o, 'trim', x + dx, 5.8, z - 0.11, 0.83, 0.073, 0.035);
  }
  panel(o, 'trim', x, 4.11, z, 2.34, 0.17, 0.28);
}
function wing(o, sign, lod) {
  const z = frontAt(sign * 19) - 0.04;
  const width = 17.3,
    x = sign * 19;
  if (lod) {
    panel(o, 'trim', x, 16.02, z, width, 1.32, 0.32);
    panel(o, 'tile', x, 16.21, z - 0.34, width, 0.07, 0.025, amber);
    panel(o, 'tile', x, 16.99, z - 0.34, width, 0.07, 0.025, amber);
    panel(o, 'trim', x, 3.42, z, width, 0.35, 0.4);
  } else {
    flatPanel(o, 'trim', x, 16.02, z - 0.06, width, 1.32);
  }
  for (let i = 0; i < 5; i++) {
    const bx = sign * (13.9 + 2.48 * i),
      bz = frontAt(bx) - 0.046;
    pairedWindow(o, bx, bz, lod);
    if (lod) panel(o, 'trim', bx, 8.52, bz, 1.43, 6.63, 0.18);
    for (let level = 0; level < 4; level++) {
      const y = 8.87 + 1.55 * level;
      if (lod) rectWindow(o, bx, bz - 0.21, y, 0.98, 1.11, lod);
      else flatPanel(o, 'glass', bx, y, bz - 0.045, 1.05, 1.18);
    }
    if (lod > 1) {
      panel(o, 'trim', bx, 8.43, bz, 1.75, 0.12, 0.28);
      panel(o, 'glass', bx, 0.38, bz - 0.08, 0.99, 2.65, 0.1, dark);
    }
  }
}
function archProfile(half, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = -1 + (2 * i) / segments;
    return [t * half, rise * Math.pow(1 - Math.abs(t), 0.62)];
  });
}
function entranceBay(o, lod) {
  const { halfWidth: w, shoulder: s, apex, recess, top } = entrance;
  const front = courtFront,
    back = front + recess;
  const wall = 8.42;
  block(o, 'brick', -wall, baseTop, front, -w, s, back);
  block(o, 'brick', w, baseTop, front, wall, s, back);
  block(o, 'brick', -wall, baseTop, back, wall, top, frontDepth + 0.06);
  block(o, 'brick', -wall, s, front, -w, top, back);
  block(o, 'brick', w, s, front, wall, top, back);
  for (const sign of [-1, 1]) {
    const x = sign * w;
    face(
      o,
      'trim',
      [
        [x, baseTop, front],
        [x, baseTop, back],
        [x, s, back],
        [x, s, front],
      ],
      [-sign, 0, 0],
      cream,
    );
    panel(o, 'trim', sign * (w + 0.18), baseTop, front, 0.37, s - baseTop, 0.13);
    panel(o, 'tile', sign * (w + 0.48), baseTop, front - 0.06, 0.15, s - baseTop, 0.045, amber);
  }
  const shape = archProfile(w, apex - s, [8, 12, 20, 24][lod]);
  const rim = archProfile(w, apex - s + 0.62, [8, 12, 20, 24][lod]);
  for (let i = 0; i < shape.length - 1; i++) {
    const [x, y] = shape[i],
      [a, b] = shape[i + 1];
    const dy = rim[i][1],
      db = rim[i + 1][1];
    face(
      o,
      'trim',
      [
        [x, s + y, front],
        [a, s + b, front],
        [a, s + b, back],
        [x, s + y, back],
      ],
      [0, -1, 0],
      cream,
    );
    face(
      o,
      'brick',
      [
        [x, s + y, front],
        [a, s + b, front],
        [a, top, front],
        [x, top, front],
      ],
      [0, 0, -1],
    );
    const frameTop = apex + 0.79;
    if (lod)
      face(
        o,
        'tile',
        [
          [x, s + dy + 0.08, front - 0.043],
          [a, s + db + 0.08, front - 0.043],
          [a, frameTop, front - 0.043],
          [x, frameTop, front - 0.043],
        ],
        [0, 0, -1],
      );
    face(
      o,
      'trim',
      [
        [x, s + y + 0.025, front - 0.07],
        [a, s + b + 0.025, front - 0.07],
        [a, s + b + 0.27, front - 0.07],
        [x, s + y + 0.27, front - 0.07],
      ],
      [0, 0, -1],
    );
  }
  if (lod) panel(o, 'trim', 0, apex + 0.76, front, 2 * w + 0.43, 0.2, 0.12);
  panel(o, 'trim', 0, top - 0.6, front, 16.84, 0.62, 0.36);
  const count = lod > 1 ? 15 : 9;
  for (let i = 0; i < count; i++) {
    const x = -7.6 + (15.2 * i) / (count - 1);
    if (lod) block(o, 'trim', x - 0.23, top, front - 0.18, x + 0.23, top + 0.26, front + 0.45);
    face(
      o,
      'trim',
      [
        [x - 0.23, top + 0.26, front - 0.18],
        [x + 0.23, top + 0.26, front - 0.18],
        [x, top + 0.79, front - 0.03],
      ],
      [0, 0, -1],
    );
  }
  const backing = back - 0.075;
  face(
    o,
    'trim',
    [
      [-w, baseTop, backing],
      [w, baseTop, backing],
      ...[...shape].reverse().map(([x, y]) => [x, s + y, backing]),
    ],
    [0, 0, -1],
    cream,
  );
  for (let i = 0; i < 4; i++) {
    const y = 5.02 + i * 2.65;
    rectWindow(o, 0, back - 0.1, y, 3.7, 2.12, lod);
    if (lod) panel(o, 'trim', 0, y, back - 0.23, 0.12, 2.12, 0.028);
  }
  panel(o, 'glass', 0, 0.21, front - 0.04, 5.45, 3.51, 0.095, dark);
  if (lod) {
    for (const x of [-2.28, 0, 2.28]) panel(o, 'trim', x, 0.21, front - 0.16, 0.15, 2.92, 0.074);
  }
  block(o, 'roof', -5.27, 3.11, front - 3.35, 5.27, 3.99, front + 0.04, dark);
  panel(o, 'trim', 0, 3.07, front - 3.35, 10.62, 0.095, 0.062);
}
function ringStack(o, k, x, z, layers, sides) {
  loft(
    o,
    k,
    layers.map(([y, r, rz = r]) => radialRing(y, r, rz, sides, [x, z])),
    colors[k],
  );
}
function tower(o, x, lod) {
  const { front, halfWidth: w, top } = towers;
  const z = front + w + 0.08;
  block(o, 'trim', x - w, foundationBottom, front, x + w, baseTop, z + w, cream);
  block(o, 'brick', x - w, baseTop, front, x + w, top - 0.66, z + w);
  if (!lod) {
    block(o, 'trim', x - w - 0.44, top - 0.66, z - w - 0.44, x + w + 0.44, top, z + w + 0.44);
    ringStack(
      o,
      'tile',
      x,
      z,
      [
        [top, 1.16],
        [top + 2.7, 1.16],
      ],
      6,
    );
    ringStack(
      o,
      'copper',
      x,
      z,
      [
        [top + 2.7, 1.12],
        [top + 4.68, 0.99],
        [top + 5.46, 0.44],
        [towers.finial, 0.035],
      ],
      6,
    );
    return;
  }
  for (const [y, height, width] of [
    [top - 1.04, 0.24, w + 0.19],
    [top - 0.8, 0.56, w + 0.52],
    [top - 0.24, 0.24, w + 0.69],
  ]) {
    block(o, 'trim', x - width, y, z - width, x + width, y + height, z + width);
  }
  for (const y of [6, 9.3, 12.6, 16.4, 23.6]) rectWindow(o, x, front - 0.035, y, 0.44, 1.16, lod);
  if (lod > 1)
    for (const offset of [-1.62, -1.08, -0.54, 0, 0.54, 1.08, 1.62]) {
      block(
        o,
        'trim',
        x + offset - 0.12,
        top - 1.09,
        front - 0.45,
        x + offset + 0.12,
        top - 0.75,
        front + 0.05,
      );
    }
  const sides = [8, 12, 16, 20][lod];
  ringStack(
    o,
    'trim',
    x,
    z,
    [
      [top, 1.42],
      [top + 0.3, 1.35],
    ],
    sides,
  );
  ringStack(
    o,
    'tile',
    x,
    z,
    [
      [top + 0.3, 1.18],
      [top + 2.58, 1.18],
    ],
    sides,
  );
  ringStack(
    o,
    'trim',
    x,
    z,
    [
      [top + 2.58, 1.25],
      [top + 2.91, 1.46],
      [top + 3.12, 1.33],
    ],
    sides,
  );
  ringStack(
    o,
    'copper',
    x,
    z,
    [
      [top + 3.12, 0.98],
      [top + 4.55, 0.98],
      [top + 4.67, 1.14],
      [top + 4.97, 0.94],
      [top + 5.44, 0.57],
      [top + 5.74, 0.22],
      [towers.finial, 0.04],
    ],
    sides,
  );
  if (lod > 1)
    for (let i = 0; i < 8; i++) {
      const theta = (2 * Math.PI * i) / 8;
      const x0 = x + 0.94 * Math.cos(theta),
        z0 = z + 0.94 * Math.sin(theta);
      block(
        o,
        'roof',
        x0 - 0.105,
        top + 3.41,
        z0 - 0.105,
        x0 + 0.105,
        top + 4.37,
        z0 + 0.105,
        dark,
      );
    }
}
function pavilion(o, x, lod) {
  const { zCenter: z, width, depth, top, domeRadius: r, domeRise } = pavilions;
  const front = frontAt(x);
  const left = x - width / 2,
    right = x + width / 2;
  block(o, 'brick', left, wingRoof - 0.2, front, right, top - 0.56, z + depth / 2);
  block(
    o,
    'trim',
    left - 0.18,
    top - 0.61,
    front - 0.22,
    right + 0.18,
    top - 0.22,
    z + depth / 2 + 0.18,
  );
  if (!lod) {
    ringStack(
      o,
      'brick',
      x,
      z,
      [
        [top - 0.22, r * 1.09],
        [top + 0.82, r],
      ],
      6,
    );
    ringStack(
      o,
      'copper',
      x,
      z,
      [
        [top + 0.82, r],
        [top + 1.65, r * 0.89],
        [top + 2.43, r * 0.56],
        [top + domeRise + 1.46, 0.034],
      ],
      6,
    );
    return;
  }
  for (const dx of [-1.06, 1.06]) {
    for (const y of [5.22, 8.7, 11.63, 14.58, 17.67])
      rectWindow(o, x + dx, frontAt(x + dx) - 0.04, y, 1.26, 1.53, lod);
  }
  const sides = [8, 12, 18, 24][lod];
  ringStack(
    o,
    'brick',
    x,
    z,
    [
      [top - 0.3, r * 1.1],
      [top + 0.65, r * 1.1],
      [top + 0.82, r],
    ],
    sides,
  );
  const profile = [
    [top + 0.82, r],
    [top + 1.25, r * 0.96],
    [top + 1.84, r * 0.81],
    [top + 2.4, r * 0.55],
    [top + domeRise + 0.48, r * 0.21],
    [top + domeRise + 0.65, 0.17],
  ];
  ringStack(o, 'copper', x, z, profile, sides);
  ringStack(
    o,
    'copper',
    x,
    z,
    [
      [profile.at(-1)[0], 0.16],
      [top + domeRise + 1.24, 0.09],
      [top + domeRise + 1.46, 0.033],
    ],
    sides,
  );
}
function backBuilding(o, lod) {
  const back = clip(nativeRing, 1, frontDepth, false);
  masonryRoof(o, back, baseTop, 15.62, 15.95, lod);
  const hall = clip(clip(clip(back, 1, -22.2, false), 0, -24.2, false), 0, 22.7, true);
  const stageFront = 10.3,
    stageEdge = 8.1;
  masonryRoof(o, clip(hall, 1, stageFront, true), 15.95, 20.4, 20.72, lod);
  masonryRoof(
    o,
    clip(clip(hall, 1, stageFront, false), 0, stageEdge, false),
    15.95,
    20.4,
    20.72,
    lod,
  );
  const stage = clip(clip(back, 1, stageFront, false), 0, stageEdge, true);
  masonryRoof(o, stage, 15.95, 24.62, 24.95, lod);
  if (!lod) return;
  for (const x of [-17, -10.4, -3.8, 2.8, 9.4, 16]) {
    block(o, 'roof', x - 0.52, 20.72, -9.7, x + 0.52, 21.16, -6.4);
  }
  for (const z of [-24.4, -19.7, -15, -10.3, -5.6, 0.1]) {
    block(o, 'trim', -30.98, baseTop, z - 0.16, -30.06, 15.71, z + 0.16);
  }
}
export function buildHouse(o, _frame, lod = 3) {
  prism(o, 'trim', nativeRing, foundationBottom, baseTop, cream);
  const front = clip(nativeRing, 1, frontDepth, true);
  for (const [limit, low] of [
    [-8.4, true],
    [8.4, false],
  ]) {
    const wingRing = clip(front, 0, limit, low);
    masonryRoof(o, wingRing, baseTop, wingRoof, wingRoof + 0.24, lod);
    wing(o, low ? -1 : 1, lod);
  }
  backBuilding(o, lod);
  entranceBay(o, lod);
  for (const x of towers.xCenters) tower(o, x, lod);
  for (const x of pavilions.xCenters) pavilion(o, x, lod);
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [74, 45, -103],
  lookAt = [0, 11.6, -1];
const modelPath = 'content/worldgen/source/places/dq/dq8/altria_theater';
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Moorish Revival theater with twin brick towers, patinated copper lanterns, a recessed pointed arch, terracotta ornament and an extended auditorium roof behind North Laurel Street.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'stone_limestone',
    'metal_standing_seam',
    'metal_copper',
    'tile_glazed',
  ],
  qaCameras: [
    { name: 'laurel-street-and-twin-towers', position: [33, 12, -103], lookAt: [0, 15.1, -44.5] },
    { name: 'auditorium-and-rear-masses', position: [-71, 48, 79], lookAt: [-1, 11, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-theater-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.26,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.075, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.035, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic reconstruction under the repository license. The two published Qualla photographs by MonkeyBBGB have explicit CC0 dedications. Mapped outline attributed to OpenStreetMap contributors under ODbL.',
};
