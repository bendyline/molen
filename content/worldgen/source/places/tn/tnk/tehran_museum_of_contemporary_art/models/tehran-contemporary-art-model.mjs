/** Tehran Museum of Contemporary Art. Coordinates are metres in the native street frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const { baseY, roofTiers, court, foyerCenter, foyerHeight, galleryCatchers, hallCatchers } =
  plan.section;
const [entryX, entryZ] = frame.terrainContact.local;

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.91, metallic: 0 },
  cream: { slot: 'trim', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_boardformed', roughness: 0.93, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.45, metallic: 0.55 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56, metallic: 0.1 },
};
const palette = Object.fromEntries(
  Object.entries({
    sandstone: 'ba8b67',
    recess: '967657',
    pale: 'd9c9a9',
    shaded: 'b9aa8d',
    roof: 'a8a28e',
    copper: '777b65',
    seam: '696b58',
    glazing: '435053',
    glassLight: '677676',
    frame: '4c4840',
    court: 'ad9b82',
    paving: 'bbab90',
    water: '516965',
    dark: '363530',
  }).map(([key, value]) => [key, rgb(value)]),
);

const deckY = (x) => roofTiers.find(([edge]) => x <= edge)?.[1] ?? roofTiers.at(-1)[1];
const area = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);

function directed(ring, clockwise) {
  return area(ring) < 0 === clockwise ? ring : [...ring].reverse();
}

function simplify(points, tolerance) {
  const result = [...points];
  for (let i = result.length - 1; i >= 0; i--) {
    const a = result[(i + result.length - 1) % result.length],
      b = result[i],
      c = result[(i + 1) % result.length];
    const dx = c[0] - a[0],
      dz = c[1] - a[1];
    const span = Math.hypot(dx, dz);
    if (
      span < 0.01 ||
      (Math.hypot(b[0] - a[0], b[1] - a[1]) < 3.0 &&
        Math.abs(dx * (b[1] - a[1]) - dz * (b[0] - a[0])) / span < tolerance &&
        Math.abs(b[0] - entryX) > 0.02)
    )
      result.splice(i, 1);
  }
  return result;
}

function ringsToTriangles(outer, hole = []) {
  const points = [...outer, ...hole];
  const ids = earcut(points.flat(), hole.length ? [outer.length] : []);
  const result = [];
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => points[j]);
    result.push(directed(p, true));
  }
  return result;
}

function clipX(points, edge, keepSign) {
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const aIn = (a[0] - edge) * keepSign >= 0;
    const bIn = (b[0] - edge) * keepSign >= 0;
    if (aIn) output.push(a);
    if (aIn !== bIn) {
      const t = (edge - a[0]) / (b[0] - a[0]);
      output.push([edge, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return output;
}

function horizontal(out, slot, points, y, color) {
  for (let i = 1; i < points.length - 1; i++) {
    const ring = [points[0], points[i], points[i + 1]];
    if (Math.abs(area(ring)) > 0.00001)
      triangle(
        out,
        slot,
        ring.map(([x, z]) => [x, y, z]),
        color,
      );
  }
}

function crossSections(rings, x) {
  const hits = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [a, az] = ring[i],
        [b, bz] = ring[(i + 1) % ring.length];
      if (a > x === b > x) continue;
      hits.push(az + ((bz - az) * (x - a)) / (b - a));
    }
  }
  return hits.sort((a, b) => a - b);
}

function terraces(out, outer, hole, tiers, slot, tint, risers, riserColor) {
  const triangles = ringsToTriangles(outer, hole);
  for (let i = 0; i < tiers.length; i++) {
    const [edge, y] = tiers[i];
    for (const tri of triangles) {
      const clipped = clipX(i ? clipX(tri, tiers[i - 1][0], 1) : tri, edge, -1);
      horizontal(out, slot, clipped, y, tint);
    }
    if (i + 1 >= tiers.length) continue;
    const joins = crossSections(hole.length ? [outer, hole] : [outer], edge);
    const y2 = tiers[i + 1][1],
      low = Math.min(y, y2),
      high = Math.max(y, y2);
    for (let j = 0; j < joins.length; j += 2) {
      const a = joins[j],
        b = joins[j + 1];
      if (b - a < 0.0001) continue;
      const facing = y2 > y ? [a, b] : [b, a];
      face(
        out,
        risers,
        [
          [edge, low, facing[0]],
          [edge, low, facing[1]],
          [edge, high, facing[1]],
          [edge, high, facing[0]],
        ],
        riserColor,
      );
    }
  }
}

function side(out, slot, a, b, lo, hi, color) {
  if (hi - lo < 0.001 || Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.0001) return;
  face(
    out,
    slot,
    [
      [a[0], lo, a[1]],
      [b[0], lo, b[1]],
      [b[0], hi, b[1]],
      [a[0], hi, a[1]],
    ],
    color,
  );
}

function splitWall(out, a, b, lod, inside = false) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const parameters = [0, 1];
  const nearEntry =
    !inside &&
    Math.min(a[1], b[1]) > 26.7 &&
    Math.min(a[0], b[0]) < entryX + 2.9 &&
    Math.max(a[0], b[0]) > entryX - 2.9;
  if (dx !== 0) {
    const cuts = roofTiers.map(([x]) => x);
    if (nearEntry) cuts.push(entryX - 2.7, entryX + 2.7);
    for (const edge of cuts) {
      const t = (edge - a[0]) / dx;
      if (t > 0.00001 && t < 0.99999) parameters.push(t);
    }
  }
  parameters.sort((u, v) => u - v);
  for (let i = 1; i < parameters.length; i++) {
    const p = parameters[i - 1],
      q = parameters[i],
      a2 = [a[0] + dx * p, a[1] + dz * p],
      b2 = [a[0] + dx * q, a[1] + dz * q];
    const mid = (a2[0] + b2[0]) / 2,
      y = deckY(mid);
    const door = nearEntry && Math.abs(mid - entryX) < 2.7;
    const ground = inside ? -0.56 : baseY;
    if (!door) side(out, 'stone', a2, b2, ground, lod > 0 ? y - 0.58 : y, palette.sandstone);
    else {
      side(out, 'stone', a2, b2, ground, 0.44, palette.sandstone);
      side(out, 'stone', a2, b2, 3.52, lod > 0 ? y - 0.58 : y, palette.sandstone);
    }
    if (lod > 0) side(out, 'cream', a2, b2, y - 0.58, y, palette.pale);
    if (lod > 1)
      beam(
        out,
        'cream',
        [a2[0], y - 0.23, a2[1]],
        [b2[0], y - 0.23, b2[1]],
        0.17,
        0.24,
        palette.pale,
      );
  }
}

function enclosure(out, lod) {
  const outer = directed(
    simplify(frame.geometry.outline, lod === 0 ? 0.65 : lod === 1 ? 0.2 : 0.025),
    true,
  );
  const hole = directed(court, false);
  terraces(out, outer, hole, roofTiers, 'roof', palette.roof, 'cream', palette.pale);
  for (const ring of [outer, hole]) {
    for (let i = 0; i < ring.length; i++)
      splitWall(out, ring[i], ring[(i + 1) % ring.length], lod, ring === hole);
  }
}

function sculptureCourt(out, lod) {
  const floor = [
    [-19.5, 0.68],
    [-5.2, 0.41],
    [13, 0.04],
  ];
  terraces(out, directed(court, true), [], floor, 'roof', palette.court, 'stone', palette.recess);
  const left = -13.1,
    right = -7.0,
    low = -6.65,
    high = -1.8,
    y = 0.45;
  box(
    out,
    'cream',
    [left - 0.28, y, low - 0.28],
    [right + 0.28, y + 0.19, high + 0.28],
    palette.paving,
  );
  box(out, 'dark', [left, y + 0.195, low], [right, y + 0.234, high], palette.water);
  if (lod > 0) {
    for (let i = 0; i < 3; i++) {
      const x = -19.75 + i * 0.26;
      box(out, 'cream', [x, 0.39, -3.9], [x + 0.26, 0.67 - i * 0.09, 2.5], palette.shaded);
    }
    for (let i = 0; i < 3; i++) {
      const x = -5.42 + i * 0.28;
      box(out, 'cream', [x, 0.0, -4.5], [x + 0.28, 0.4 - i * 0.13, 1.9], palette.shaded);
    }
    for (const [x, z] of [
      [-28.5, -2.77],
      [2.85, -4.8],
    ]) {
      box(out, 'cream', [x - 0.56, 0.48, z - 0.53], [x + 0.56, 0.82, z + 0.53], palette.paving);
    }
  }
}

function entrance(out, lod) {
  const [x, z] = [entryX, entryZ];
  const rear = z - 0.7,
    front = z + 0.18;
  box(out, 'dark', [x - 2.78, 0.41, rear - 0.12], [x + 2.78, 3.54, rear], palette.glazing);
  box(out, 'cream', [x - 3.22, 3.54, rear - 0.28], [x + 3.22, 3.84, z + 0.97], palette.pale);
  for (const sign of [-1, 1]) {
    const v = x + sign * 2.74;
    box(out, 'cream', [v - 0.17, 0.42, rear - 0.18], [v + 0.17, 3.6, front], palette.shaded);
  }
  for (let i = 0; i < 4; i++) {
    box(
      out,
      'cream',
      [x - 3.6, -0.62, z - 0.76],
      [x + 3.6, 0.45 - i * 0.14, z + 0.17 + i * 0.46],
      i === 3 ? palette.court : palette.paving,
    );
  }
  if (lod > 0) {
    for (let i = 0; i < 7; i++) {
      const ax = x - 2.57 + i * 0.857;
      box(
        out,
        'iron',
        [ax - 0.042, 0.47, rear + 0.006],
        [ax + 0.042, 3.47, rear + 0.078],
        palette.frame,
      );
    }
    box(out, 'iron', [x - 2.52, 2.58, rear + 0.02], [x + 2.52, 2.65, rear + 0.11], palette.frame);
    if (lod > 1) {
      for (const sign of [-1, 1]) {
        const ax = x + sign * 0.25;
        box(
          out,
          'iron',
          [ax - 0.027, 1.24, rear + 0.1],
          [ax + 0.027, 1.5, rear + 0.18],
          palette.shaded,
        );
      }
    }
  }
}

function catcher(out, x, z, y, width, depth, rise, heading, lod) {
  const local = transform(out, heading, [x, y, z]);
  const half = width / 2,
    faceZ = depth * 0.18,
    sill = 0.39;
  const facets = [3, 6, 11, 18][lod];
  const profile = (i) => {
    const a = (i / facets) * (Math.PI / 2);
    return [sill + rise * Math.cos(a), faceZ - depth * Math.sin(a)];
  };
  const jamb = width * 0.16;
  const ceiling = rise + sill;
  if (lod === 0) {
    const rect = (slot, a, b, lo, hi, z, tint) =>
      face(
        local,
        slot,
        [
          [a, lo, z],
          [b, lo, z],
          [b, hi, z],
          [a, hi, z],
        ],
        tint,
      );
    rect('cream', -half, half, 0, sill, faceZ, palette.pale);
    rect('cream', -half, -half + jamb, sill, ceiling, faceZ, palette.pale);
    rect('cream', half - jamb, half, sill, ceiling, faceZ, palette.pale);
    rect('cream', -half + jamb, half - jamb, ceiling - 0.31, ceiling, faceZ, palette.pale);
    rect('dark', -half + jamb, half - jamb, sill, ceiling - 0.31, faceZ, palette.glazing);
  } else {
    box(local, 'cream', [-half, 0, faceZ - depth], [half, sill, faceZ + 0.11], palette.pale);
    for (const side of [-1, 1]) {
      const j = side * (half - jamb / 2);
      box(
        local,
        'cream',
        [j - jamb / 2, sill, faceZ - 0.37],
        [j + jamb / 2, ceiling, faceZ + 0.16],
        palette.pale,
      );
    }
    box(
      local,
      'cream',
      [-half, ceiling - 0.31, faceZ - 0.39],
      [half, ceiling, faceZ + 0.19],
      palette.pale,
    );
    box(
      local,
      'dark',
      [-half + jamb, sill, faceZ - 0.34],
      [half - jamb, ceiling - 0.32, faceZ - 0.265],
      palette.glazing,
    );
  }
  for (let i = 0; i < facets; i++) {
    const [p, a] = profile(i),
      [q, b] = profile(i + 1);
    face(
      local,
      'copper',
      [
        [-half, p, a],
        [half, p, a],
        [half, q, b],
        [-half, q, b],
      ],
      palette.copper,
    );
    triangle(
      local,
      'cream',
      [
        [-half, sill, faceZ],
        [-half, q, b],
        [-half, p, a],
      ],
      palette.pale,
    );
    triangle(
      local,
      'cream',
      [
        [half, sill, faceZ],
        [half, p, a],
        [half, q, b],
      ],
      palette.pale,
    );
    if (lod > 1 && i % 3 === 0)
      beam(
        local,
        'copper',
        [-half - 0.012, p + 0.024, a],
        [half + 0.012, p + 0.024, a],
        0.039,
        0.035,
        palette.seam,
      );
  }
  if (lod > 0) {
    const count = lod === 1 ? 1 : 3;
    for (let i = 1; i <= count; i++) {
      const sx = (width - 2 * jamb) * (i / (count + 1) - 0.5);
      box(
        local,
        'iron',
        [sx - 0.035, sill, faceZ - 0.265],
        [sx + 0.035, ceiling - 0.29, faceZ - 0.18],
        palette.frame,
      );
    }
  }
}

function foyer(out, lod) {
  const [x, z] = foyerCenter;
  const oct = (y, rx, rz) =>
    [
      [0.39, 1],
      [-0.49, 1],
      [-1, 0.48],
      [-1, -0.48],
      [-0.43, -1],
      [0.45, -1],
      [1, -0.45],
      [1, 0.44],
    ].map(([u, v]) => [x + u * rx, y, z + v * rz]);
  loft(
    out,
    'cream',
    [
      oct(5.38, 10.2, 8.9),
      oct(foyerHeight - 0.66, 10.12, 8.86),
      oct(foyerHeight - 0.55, 9.96, 8.69),
    ],
    palette.pale,
  );
  loft(
    out,
    'roof',
    [
      oct(foyerHeight - 0.56, 9.97, 8.72),
      oct(foyerHeight - 0.15, 8.68, 7.57),
      oct(foyerHeight + 0.42, 3.85, 3.04),
    ],
    palette.roof,
  );
  loft(
    out,
    'dark',
    [oct(foyerHeight + 0.41, 3.85, 3.04), oct(foyerHeight + 1.55, 3.36, 2.56)],
    palette.glassLight,
  );
  if (lod > 0) {
    const a = oct(foyerHeight + 0.44, 3.85, 3.04),
      b = oct(foyerHeight + 1.59, 3.36, 2.56);
    loft(out, 'cream', [b, oct(foyerHeight + 1.71, 3.42, 2.62)], palette.pale);
    for (let i = 0; i < a.length; i++) beam(out, 'iron', a[i], b[i], 0.08, 0.085, palette.frame);
  }
  for (const [dx, dz, angle] of hallCatchers)
    catcher(out, x + dx, z + dz, foyerHeight - 0.14, 4.34, 4.1, 3.01, angle, lod);
}

function build(out, lod) {
  enclosure(out, lod);
  sculptureCourt(out, lod);
  entrance(out, lod);
  for (const [x, z, width, depth] of galleryCatchers)
    catcher(out, x, z, deckY(x) - 0.04, width, depth, 2.4 + (x + 50) * 0.012, -2.4, lod);
  foyer(out, lod);
}
export const tehranSkyline = (out) => build(out, 0);
export const tehranDistrict = (out) => build(out, 1);
export const tehranStreet = (out) => build(out, 2);
export const tehranCloseup = (out) => build(out, 3);

const recipe = 'tehran-contemporary-art-model.mjs';
const camera = [67, 33, 116],
  lookAt = [-3, 3.5, 1];
export const tehranModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: tehranCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'reviewed-source-map-frame',
  progressLedger: 'qualla-003.PROGRESS.md',
  appearance: { kind: 'standing', representedDate: plan.representedDate },
  brief:
    'The Tehran Museum of Contemporary Art, with the hillside galleries descending around an open sculpture court, saffron stone and copper light catchers.',
  camera,
  lookAt,
  sunDirection: [35, 52, 42],
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'concrete_plain',
    'concrete_boardformed',
    'metal_copper',
    'metal_painted',
  ],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'kargar-entrance-and-foyer', position: [20, 5.45, 59], lookAt: [20.2, 5.2, 19] },
    { name: 'terraced-sculpture-court', position: [-8, 37, 41], lookAt: [-12, 1.85, -2] },
    { name: 'gallery-roof-and-light-catchers', position: [-58, 22, -63], lookAt: [-18, 5.5, -12] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'tehranSkyline',
    errorMeters: 0.62,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'tehranDistrict', 0.35],
        ['street', 'tehranStreet', 0.15],
        ['closeup', 'tehranCloseup', 0.06],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Written architectural facts and native OpenStreetMap building and entrance controls; OpenStreetMap is ODbL 1.0.',
};
