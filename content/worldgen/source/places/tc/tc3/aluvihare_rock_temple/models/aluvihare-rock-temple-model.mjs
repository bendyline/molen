/** The 1896 Aluvihare cleft and cave shelter in Henry William Cave's photograph. */
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const { passage, verandaFront, verandaBack, porchDepth, porchColumns, shrine, rockCrestandCave } =
  plan.section;

const palette = Object.fromEntries(
  Object.entries({
    stone: '999286',
    lightStone: 'bbb0a0',
    riser: '81776a',
    grit: 'a49880',
    dryGrit: 'ad9d83',
    rock: '7a786c',
    lithic: '827e71',
    darkRock: '726f64',
    plaster: 'd3c9ac',
    shade: 'b8ad94',
    darkness: '443c33',
    beam: '6b553f',
    clay: '8f6950',
    tileShadow: '785744',
    crest: 'a07557',
    leaf: '66734a',
    leafDark: '576442',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  rock: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  opening: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
  leaf: {
    slot: 'trim',
    localRef: 'palette:#fefefe',
    roughness: 0.97,
    metallic: 0,
    doubleSided: true,
  },
};

function pathEdges(z) {
  const outline = frame.geometry.outline;
  const points = [];
  for (let i = 0; i < outline.length; i++) {
    const [x0, z0] = outline[i],
      [x1, z1] = outline[(i + 1) % outline.length];
    if ((z0 <= z && z1 > z) || (z1 <= z && z0 > z))
      points.push(x0 + ((x1 - x0) * (z - z0)) / (z1 - z0));
  }
  if (points.length < 2) throw Error('Missing cleft edge at ' + z);
  return [Math.min(...points), Math.max(...points)];
}

function floorAt(z) {
  for (let i = 1; i < passage.length; i++) {
    const [za, ya] = passage[i - 1],
      [zb, yb] = passage[i];
    if (z >= zb) return ya + ((yb - ya) * (za - z)) / (za - zb);
  }
  return passage.at(-1)[1];
}

function outward(points) {
  return ShapeUtils.area(points.map((p) => new Vector2(...p))) > 0 ? [...points].reverse() : points;
}

function roofFan(out, contour, slot, tint, peak) {
  // Use an exact ground-projected triangulation. The summit heights remain sculpted.
  const flat = contour.map(([x, , z]) => new Vector2(x, z));
  for (const indices of ShapeUtils.triangulateShape(flat, [])) {
    const p = indices.map((i) => contour[i]);
    const a = p[0],
      b = p[1],
      c = p[2];
    const upward = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (Math.abs(upward) < 0.00001) continue;
    const top = upward > 0 ? p : p.reverse();
    if (peak === undefined) {
      triangle(out, slot, top, tint);
    } else {
      const center = [a, b, c].reduce((s, v) => s.map((n, i) => n + v[i] / 3), [0, 0, 0]);
      center[1] += peak;
      for (let i = 0; i < 3; i++) triangle(out, slot, [top[i], top[(i + 1) % 3], center], tint);
    }
  }
}

function rock(out, record, lod) {
  const source = frame.features[record.feature].points;
  const sameOrder = outward(source) === source;
  const order = sameOrder ? source.map((_, i) => i) : source.map((_, i) => source.length - 1 - i);
  const center = source.reduce((sum, p) => sum.map((v, i) => v + p[i] / source.length), [0, 0]);
  const profile = [
    [0, 1],
    [0.13, 1.02],
    [0.28, 0.98],
    [0.4, 0.965],
    [0.54, 0.92],
    [0.68, 0.86],
    [0.81, 0.71],
    [0.9, 0.6],
    [1, 0.36],
  ];
  const indices = [
    [0, 2, 5, 8],
    [0, 1, 3, 5, 7, 8],
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  ][lod];
  const segments = [1, 1, 2, 3][lod];
  const span = record.summit - record.foundation;
  const isVeranda = record.feature === 1;
  const colors = [palette.rock, palette.rock, palette.darkRock, palette.lithic, palette.rock];
  const rings = indices.map((layer) => {
    const [h, radius] = profile[layer];
    return order.flatMap((index, i) => {
      const next = order[(i + 1) % order.length];
      const a = source[index],
        b = source[next];
      const fixed = record.cliff.includes(index) && record.cliff.includes(next);
      return Array.from({ length: segments }, (_, j) => {
        const t = j / segments,
          k = i * segments + j;
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        const n = h === 0 ? 0 : Math.sin(k * 1.77 + record.feature * 1.58 + layer * 0.36);
        const side = fixed ? 0.43 : 1;
        const jitter = (layer === 0 ? 0 : Math.sin(k * 2.56 + record.feature)) * span * 0.039;
        let overhang = 0;
        if (isVeranda && fixed) {
          // The gneiss face retreats at the masonry opening, then hangs over the tile roof.
          overhang =
            layer === 0 ? 0 : layer < 3 ? -3.5 : layer === 3 ? 0.23 : layer === 4 ? 0.89 : 0.52;
        }
        return [
          center[0] + (x - center[0]) * radius + record.lean[0] * h + overhang + n * 0.87 * side,
          record.foundation + h * span + jitter * 0.55 + n * 0.45,
          center[1] + (z - center[1]) * radius + record.lean[1] * h + n * 0.55 * side,
        ];
      });
    });
  });
  for (let r = 1; r < rings.length; r++) {
    const lower = rings[r - 1],
      upper = rings[r];
    for (let i = 0; i < lower.length; i++) {
      const j = (i + 1) % lower.length;
      const tint = lod < 2 ? palette.rock : colors[(i + record.feature) % colors.length];
      triangle(out, 'rock', [lower[i], lower[j], upper[j]], tint);
      triangle(out, 'rock', [lower[i], upper[j], upper[i]], tint);
      if (lod === 3 && r > 1 && r < rings.length - 1 && (i + record.feature) % 4 === 0) {
        const p = upper[i],
          q = upper[j];
        const start = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
        const end = [
          p[0] * 0.17 + q[0] * 0.83,
          p[1] * 0.17 + q[1] * 0.83,
          p[2] * 0.17 + q[2] * 0.83,
        ];
        // Only the near outcrops show intermittent discolored gneiss seams.
        if (record.feature < 4 && Math.hypot(end[0] - start[0], end[2] - start[2]) > 0.15) {
          const d = [0, -0.14, 0];
          triangle(out, 'rock', [start, end, start.map((n, k) => n + d[k])], palette.darkRock);
        }
      }
    }
  }
  roofFan(out, rings.at(-1), 'rock', palette.rock, lod < 2 ? undefined : 0.54);
}

function strip(out, p0, p1, q0, q1, slot, tint) {
  face(out, slot, [p0, q0, q1, p1], tint);
}

function stoneFlight(
  out,
  zFront,
  zBack,
  lo,
  hi,
  leftFront,
  rightFront,
  leftBack,
  rightBack,
  count,
  lod,
) {
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count;
    const za = zFront + (zBack - zFront) * a,
      zb = zFront + (zBack - zFront) * b;
    const la = leftFront + (leftBack - leftFront) * a,
      lb = leftFront + (leftBack - leftFront) * b;
    const ra = rightFront + (rightBack - rightFront) * a,
      rb = rightFront + (rightBack - rightFront) * b;
    const y0 = lo + (hi - lo) * a,
      y1 = lo + (hi - lo) * b;
    strip(out, [lb, y1, zb], [rb, y1, zb], [la, y1, za], [ra, y1, za], 'stone', palette.lightStone);
    face(
      out,
      'stone',
      [
        [la, y0, za],
        [ra, y0, za],
        [ra, y1, za],
        [la, y1, za],
      ],
      palette.riser,
    );
    if (lod > 1 && i % 2 === 0) {
      const center = (la + ra) / 2 + Math.sin(i * 1.74) * 0.41;
      face(
        out,
        'stone',
        [
          [center - 0.02, y0 + 0.025, za + 0.012],
          [center + 0.02, y0 + 0.025, za + 0.012],
          [center + 0.025, y1 - 0.027, za + 0.012],
          [center - 0.017, y1 - 0.027, za + 0.012],
        ],
        palette.grit,
      );
    }
  }
}

function cleftFloor(out, lod) {
  for (let i = 1; i < passage.length; i++) {
    const [za, ya] = passage[i - 1],
      [zb, yb] = passage[i];
    const [la, ra] = pathEdges(za),
      [lb, rb] = pathEdges(zb);
    if ((i === 5 || i === 7) && lod) {
      stoneFlight(out, za, zb, ya, yb, la, ra, lb, rb, i === 5 ? 7 : 5, lod);
    } else {
      strip(
        out,
        [lb, yb, zb],
        [rb, yb, zb],
        [la, ya, za],
        [ra, ya, za],
        i > 3 ? 'stone' : 'ground',
        i > 3 ? palette.lightStone : palette.dryGrit,
      );
    }
    for (const side of [0, 1]) {
      const a = side === 0 ? la : ra,
        b = side === 0 ? lb : rb;
      const edge = [
        [a, ya - 1.8, za],
        [b, yb - 1.8, zb],
        [b, yb, zb],
        [a, ya, za],
      ];
      face(out, 'stone', side === 1 ? edge : edge.reverse(), palette.riser);
    }
    if (i === 5) {
      const x = lb + 0.59;
      box(
        out,
        'stone',
        [x - 0.46, ya - 0.55, zb + 0.08],
        [x + 0.22, yb + 0.35, za - 0.32],
        palette.stone,
      );
      const right = rb - 0.21;
      box(
        out,
        'stone',
        [right - 0.25, ya - 0.55, zb + 0.03],
        [right + 0.2, yb + 0.27, za - 0.3],
        palette.stone,
      );
    }
  }
  stoneFlight(out, 9.8, 1.8, -2.17, 0.07, -1.78, 1.48, -1.64, 2.63, lod === 0 ? 1 : 10, lod);
  strip(
    out,
    [-1.65, 0.12, -1],
    [2.87, 0.12, -1],
    [-1.64, 0.07, 1.8],
    [2.63, 0.07, 1.8],
    'ground',
    palette.dryGrit,
  );
  for (const [side, xb, xt] of [
    [-1, -1.78, -1.64],
    [1, 1.48, 2.63],
  ]) {
    const points = [
      [xb, -3.17, 9.8],
      [xt, -0.9, 1.8],
      [xt, 0.38, 1.8],
      [xb, -1.9, 9.8],
    ];
    face(out, 'stone', side < 0 ? points : points.reverse(), palette.riser);
  }
}

function porchColumn(out, x, y, z, lod) {
  if (lod === 0) {
    box(out, 'plaster', [x - 0.13, y, z - 0.13], [x + 0.13, y + 2.18, z + 0.13], palette.plaster);
    return;
  }
  const n = [0, 5, 7, 9][lod];
  loft(
    out,
    'plaster',
    [
      [y, 0.158],
      [y + 0.14, 0.158],
      [y + 0.2, 0.131],
      [y + 2.03, 0.117],
      [y + 2.09, 0.156],
      [y + 2.2, 0.16],
    ].map(([height, r]) => radialRing(height, r, r, n, [x, z])),
    palette.plaster,
    { cap: false },
  );
  box(out, 'stone', [x - 0.2, y - 0.09, z - 0.2], [x + 0.2, y + 0.09, z + 0.2], palette.stone);
}

function veranda(out, lod) {
  const wallX = (z) => pathEdges(z)[0] - 0.1;
  const bladeX = (z) => wallX(z) - porchDepth;
  const frontX = (z) => wallX(z) + 1.02;
  const porchRail = (z) => frontX(z) - 0.26;
  const base = (z) => floorAt(z) + 0.1;
  const low = (z) => base(z) + 2.19;
  const high = (z) => base(z) + 3.11;
  const stops = [verandaFront, ...porchColumns, verandaBack];
  for (let i = 1; i < stops.length; i++) {
    const za = stops[i - 1],
      zb = stops[i],
      yA = base(za),
      yB = base(zb);
    strip(
      out,
      [bladeX(zb), yB, zb],
      [frontX(zb) + 0.14, yB, zb],
      [bladeX(za), yA, za],
      [frontX(za) + 0.14, yA, za],
      'stone',
      palette.stone,
    );
    strip(
      out,
      [bladeX(zb), high(zb), zb],
      [frontX(zb), low(zb) + 0.16, zb],
      [bladeX(za), high(za), za],
      [frontX(za), low(za) + 0.16, za],
      'clay',
      palette.clay,
    );
    const eave = [
      [frontX(za), low(za) + 0.16, za],
      [frontX(zb), low(zb) + 0.16, zb],
      [frontX(zb), low(zb) - 0.02, zb],
      [frontX(za), low(za) - 0.02, za],
    ];
    face(out, 'clay', eave.reverse(), palette.tileShadow);
    const cave = [
      [wallX(za) - 0.47, yA, za],
      [wallX(zb) - 0.56, yB, zb],
      [wallX(zb) - 0.56, yB + 2.43, zb],
      [wallX(za) - 0.47, yA + 2.43, za],
    ];
    face(out, 'opening', cave, palette.darkness);
    if (lod > 1) {
      for (const t of [0.11, 0.29, 0.46, 0.65, 0.83]) {
        const tz = za + (zb - za) * t;
        beam(
          out,
          'clay',
          [bladeX(tz), high(tz) + 0.023, tz],
          [frontX(tz) + 0.032, low(tz) + 0.183, tz],
          lod > 2 ? 0.046 : 0.029,
          lod > 2 ? 0.059 : 0.031,
          palette.crest,
        );
      }
      beam(
        out,
        'timber',
        [porchRail(za), low(za) - 0.076, za],
        [porchRail(zb), low(zb) - 0.076, zb],
        0.15,
        0.13,
        palette.beam,
      );
    }
    if (lod > 0 && (i === 2 || i === 5 || i === 7)) {
      const h = (ya, yb) => [ya, yb].map((v) => v + 2.14);
      const z1 = za + (zb - za) * 0.32,
        z2 = z1 - 0.47;
      const x1 = wallX(z1) - 0.35,
        x2 = wallX(z2) - 0.35;
      const [u, v] = h(base(z1), base(z2));
      face(
        out,
        'plaster',
        [
          [x1, base(z1), z1],
          [x2, base(z2), z2],
          [x2, v, z2],
          [x1, u, z1],
        ],
        palette.shade,
      );
    }
  }
  for (const z of porchColumns) porchColumn(out, porchRail(z), base(z), z, lod);
  if (lod)
    for (const z of [verandaFront, verandaBack]) {
      const edge = [
        [bladeX(z), base(z), z],
        [wallX(z) - 0.06, base(z), z],
        [wallX(z) - 0.06, low(z) + 0.31, z],
        [bladeX(z), high(z) - 0.02, z],
      ];
      face(out, 'plaster', z === verandaFront ? edge : edge.reverse(), palette.shade);
    }
}

function window(out, x, ground, z, w, h) {
  face(
    out,
    'opening',
    [
      [x - w / 2, ground, z],
      [x + w / 2, ground, z],
      [x + w / 2, ground + h, z],
      [x - w / 2, ground + h, z],
    ],
    palette.darkness,
  );
}

function upperShrine(out, lod) {
  const [left, right, rear, front, y, eave] = shrine;
  box(out, 'plaster', [left, y - 0.56, rear], [right, eave, front], palette.plaster);
  window(out, (left + right) / 2 + 0.19, y + 0.15, front + 0.012, 0.98, 1.86);
  if (lod) window(out, (left + right) / 2 - 1.13, y + 1.21, front + 0.013, 0.49, 0.69);
  const edge = [
    [left - 0.31, eave, front + 0.25],
    [right + 0.31, eave, front + 0.25],
    [right + 0.31, eave, rear - 0.28],
    [left - 0.31, eave, rear - 0.28],
  ];
  const ridge = [
    [left + 0.48, eave + 0.85, front - 0.73],
    [right - 0.55, eave + 0.85, front - 0.73],
    [right - 0.55, eave + 0.85, rear + 0.66],
    [left + 0.48, eave + 0.85, rear + 0.66],
  ];
  loft(out, 'clay', [edge, ridge], palette.clay);
  if (lod > 1) {
    for (let i = 0; i < 13; i++) {
      const t = (i + 0.5) / 13;
      beam(
        out,
        'clay',
        [edge[0][0] + (edge[1][0] - edge[0][0]) * t, eave + 0.012, edge[0][2]],
        [ridge[0][0] + (ridge[1][0] - ridge[0][0]) * t, eave + 0.87, ridge[0][2]],
        0.06,
        0.06,
        palette.crest,
      );
    }
  }
}

function palmSilhouettes(out, lod) {
  const palms = [
    [-5.41, -42.7, 6.55, 12.1, 0.12],
    [-4.46, -47.3, 8.02, 13.95, -0.24],
    [0.24, -35.9, 5.05, 12.5, 0.63],
  ];
  for (const [x, z, base, height, lean] of palms) {
    const top = [x + lean, base + height, z - 0.42];
    if (lod > 1) {
      const knot = [x + lean * 0.31, base + height * 0.54, z - 0.12];
      tube(out, 'timber', [x, base, z], knot, 0.142, palette.beam, 7);
      tube(out, 'timber', knot, top, 0.106, palette.riser, 7);
    } else {
      tube(out, 'timber', [x, base, z], top, 0.123, palette.riser, 5);
    }
    const count = [4, 5, 6, 8][lod];
    for (let i = 0; i < count; i++) {
      const theta = (i * Math.PI * 2) / count + lean;
      const c = Math.cos(theta),
        s = Math.sin(theta),
        length = 1.85 + (i % 3) * 0.31;
      const middle = [top[0] + c * length * 0.53, top[1] + 0.62, top[2] + s * length * 0.53];
      const tip = [top[0] + c * length, top[1] - 0.32 - (i % 2) * 0.31, top[2] + s * length];
      const width = 0.26 + (i % 2) * 0.055;
      const left = [middle[0] - s * width, middle[1] - 0.04, middle[2] + c * width];
      const right = [middle[0] + s * width, middle[1] - 0.04, middle[2] - c * width];
      triangle(out, 'leaf', [top, left, middle], palette.leaf);
      triangle(out, 'leaf', [top, middle, right], palette.leafDark);
      triangle(out, 'leaf', [middle, left, tip], palette.leaf);
      triangle(out, 'leaf', [middle, tip, right], palette.leafDark);
    }
  }
}

function build(out, lod) {
  for (const record of rockCrestandCave) rock(out, record, lod);
  cleftFloor(out, lod);
  veranda(out, lod);
  upperShrine(out, lod);
  palmSilhouettes(out, lod);
}

export const aluvihareSkyline = (out) => build(out, 0);
export const aluvihareDistrict = (out) => build(out, 1);
export const aluvihareStreet = (out) => build(out, 2);
export const aluvihareCloseup = (out) => build(out, 3);
const recipe = 'aluvihare-rock-temple-model.mjs';
const camera = [7.5, 31, 63],
  lookAt = [0, 9, -24];
const gapOutline = [
  [-1.55, 9.75],
  [1.46, 9.75],
  [2.56, 1.56],
  [3.25, -0.3],
  ...frame.geometry.outline.slice(1, 11).reverse(),
  [-0.88, 0.54],
];
export const aluvihareModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  category: 'landmark',
  build: aluvihareCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  brief:
    'Aluvihare Rock Temple at Matale in 1896, with the low tiled cave veranda and stone steps between its mapped rock walls.',
  camera,
  lookAt,
  sunDirection: [30, 58, 66],
  portableGroundY: -8.6,
  embeddedCanonicalGraphs: [
    'stone_basalt_raw',
    'stone_granite',
    'plaster_lime',
    'tile_ceramic',
    'wood_plain',
    'stone_sandstone_raw',
  ],
  groundCutout: {
    outline: gapOutline,
    basis:
      'Model-local outline of the mapped narrow cleft and photographed stone stair at its mouth. The independent surrounding relief remains intact.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'cave-view-from-the-cleft-mouth',
      position: [1.55, 2.89, 6.5],
      lookAt: [-1.18, 5.5, -19.3],
    },
    {
      name: 'upper-steps-and-tiled-veranda',
      position: [1.1, 5.16, -7.3],
      lookAt: [-2.1, 4.62, -24.4],
    },
    { name: 'mapped-rock-passage', position: [34, 57, 23], lookAt: [-2, 8, -25] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cleft-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'aluvihareSkyline',
    errorMeters: 1.33,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'aluvihareDistrict', 0.55],
        ['street', 'aluvihareStreet', 0.2],
        ['closeup', 'aluvihareCloseup', 0.071],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The Qualla photograph by Henry William Cave is in the public domain. OpenStreetMap cleft and rock control geometry under ODbL 1.0.',
};
