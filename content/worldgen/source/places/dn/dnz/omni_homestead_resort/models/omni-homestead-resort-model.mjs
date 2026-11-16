/** The primary Homestead Resort hotel in Hot Springs, Virginia, 2021–22. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const design = plan.section;
const [mappedOutline] = read('map-frame').geometry.polygons;
const relief = read('terrain-grid');
const [alignmentStart, alignmentEnd] = design.alignmentEdge.map((i) => mappedOutline[i]);
const axis = alignmentEnd.map((v, i) => v - alignmentStart[i]);
const [east, south] = axis.map((v) => v / Math.hypot(...axis));
const world = (x, y, z) => [x * east + z * south, y, x * south - z * east];
const relative = ([x, z]) => [x * east + z * south, x * south - z * east];
const signedArea = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
const footprint = mappedOutline.map(relative);
const ring = signedArea(footprint) > 0 ? footprint : footprint.toReversed();
const surface = (slot, graph, roughness = 0.91) => ({
  slot,
  ...(graph ? { graph } : { localRef: 'palette:#ffffff' }),
  roughness,
  metallic: 0,
});
const surfaces = {
  brick: surface('wall', 'brick_flemish'),
  stone: surface('foundation', 'stone_limestone'),
  trim: surface('trim', 'plaster_lime'),
  roof: surface('roof', 'metal_standing_seam'),
  glass: surface('window', null, 0.55),
  accent: surface('trim', null),
};
const colors = Object.fromEntries(
  Object.entries({
    brick: 'a1624d',
    brickShade: '945746',
    brickDarker: '8e5542',
    stone: 'bdb29a',
    white: 'e3ddca',
    linen: 'd6cfb9',
    shade: 'bab4a0',
    roof: '686b63',
    roofDark: '515853',
    copper: '477363',
    green: '416355',
    glass: '4c5b5b',
    porch: '495c55',
    dark: '424941',
    gold: '9d8c60',
  }).map(([key, col]) => [key, rgb(col)]),
);
const up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
function elevation(x, z) {
  const [gx, , gz] = world(x, 0, z);
  const a = (gx - relief.origin[0]) / relief.stepMeters,
    b = (gz - relief.origin[1]) / relief.stepMeters;
  const i = Math.floor(a),
    j = Math.floor(b),
    h = relief.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], a - i), mix(h[j + 1][i], h[j + 1][i + 1], a - i), b - j) -
    relief.modelDatumElevationMeters
  );
}
function meshFace(out, slot, vertices, direction, color) {
  const n = normalFor(...vertices);
  if (!n.some(Boolean)) return;
  const p =
    n.reduce((sum, v, i) => sum + v * direction[i], 0) > 0 ? vertices : vertices.toReversed();
  (p.length === 3 ? triangle : face)(out, slot, p, color);
}
const area = (out, slot, poly, toPoint, direction, color) => {
  const indices = earcut(poly.flat());
  for (let i = 0; i < indices.length; i += 3)
    meshFace(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => toPoint(...poly[j])),
      direction,
      color,
    );
};
const rectangle = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function wallFrame(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [dz / length, -dx / length];
  return {
    length,
    n: world(normal[0], 0, normal[1]),
    at: (s, y, d = 0) =>
      world(a[0] + (dx * s) / length + normal[0] * d, y, a[1] + (dz * s) / length + normal[1] * d),
  };
}
function panel(out, slot, f, l, r, b, t, d, color) {
  meshFace(out, slot, [f.at(l, b, d), f.at(r, b, d), f.at(r, t, d), f.at(l, t, d)], f.n, color);
}
function box(out, slot, x0, x1, z0, z1, bottom, top, color) {
  const corners = rectangle(x0, x1, z0, z1);
  for (let i = 0; i < 4; i++) {
    const f = wallFrame(corners[i], corners[(i + 1) % 4]);
    panel(out, slot, f, 0, f.length, bottom, top, 0, color);
  }
  meshFace(
    out,
    slot,
    corners.map(([x, z]) => world(x, top, z)),
    up,
    color,
  );
}
function molding(out, x, z, width, depth, y, height, color = colors.white) {
  box(
    out,
    'trim',
    x - width / 2,
    x + width / 2,
    z - depth / 2,
    z + depth / 2,
    y,
    y + height,
    color,
  );
}
function profile(out, slot, x, z, steps, color, sides) {
  const [gx, , gz] = world(x, 0, z);
  loft(
    out,
    slot,
    steps.map(([y, r]) => radialRing(y, r, r, sides, [gx, gz])),
    color,
    { cap: false },
  );
}
function hipped(out, x, z, width, depth, y, height, lod, copper = false) {
  const fractions = lod > 0 ? [0, 0.43, 1] : [0, 1];
  const levels = fractions.map((t) => {
    const w = width * mix(0.5, 0.08, t),
      d = depth * mix(0.5, 0.11, t);
    return rectangle(x - w, x + w, z - d, z + d).map(([a, b]) =>
      world(a, y + height * Math.pow(t, copper ? 1.24 : 1), b),
    );
  });
  for (let i = 1; i < levels.length; i++)
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4,
        a = levels[i - 1],
        b = levels[i];
      const tint = copper
        ? j % 2
          ? colors.copper
          : colors.green
        : j % 2
          ? colors.roof
          : colors.roofDark;
      meshFace(out, 'roof', [a[j], a[k], b[k], b[j]], up, tint);
    }
  meshFace(out, 'roof', levels.at(-1), up, copper ? colors.copper : colors.roof);
}
function sash(out, f, x, y, w, h, lod, portico = false) {
  const bw = w / 2,
    stone = portico ? colors.white : colors.linen;
  if (lod >= 2)
    panel(out, 'trim', f, x - bw - 0.12, x + bw + 0.12, y - 0.11, y + h + 0.14, 0.038, stone);
  panel(out, 'glass', f, x - bw, x + bw, y, y + h, 0.065, portico ? colors.porch : colors.glass);
  if (lod >= 2) panel(out, 'trim', f, x - 0.023, x + 0.023, y + 0.01, y + h - 0.01, 0.084, stone);
  if (lod >= 3) {
    panel(out, 'trim', f, x - bw, x + bw, y + h * 0.55, y + h * 0.55 + 0.047, 0.085, stone);
    panel(out, 'trim', f, x - bw - 0.15, x + bw + 0.15, y - 0.14, y - 0.063, 0.12, stone);
  }
}
const isTowerLounge = (x, z) => x >= 5.9 && x < 22.3 && z > 76.4;
function sectionEave(x, z) {
  if (isTowerLounge(x, z)) return 1.95;
  const highWest = Math.max(0, Math.min(5, (x + 43) * -0.051));
  const eastWing = Math.max(0, Math.min(4.2, (z - 73) * 0.071));
  const connector = Math.max(0, Math.min(4.7, (x - 65) * 0.075));
  return 12.2 + highWest - eastWing - connector;
}
const roofSlope = (x, z) => {
  if (isTowerLounge(x, z)) return sectionEave(x, z);
  const front = Math.max(0, Math.min(3.2, (90 - z) * 0.18, (z - 18) * 0.13));
  const northWing = Math.max(0, Math.min(2.55, (z - 68) * 0.09, (157 - z) * 0.09));
  return sectionEave(x, z) + Math.max(front, northWing);
};
function envelope(out, lod) {
  area(out, 'roof', ring, (x, z) => world(x, roofSlope(x, z), z), up, colors.roof);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      f = wallFrame(a, b),
      m = between(a, b, 0.5);
    const lounge = isTowerLounge(...a) && isTowerLounge(...b);
    const bottomA = elevation(...a) - 0.3,
      bottomB = elevation(...b) - 0.3;
    const eaveA = sectionEave(...a),
      eaveB = sectionEave(...b),
      topA = roofSlope(...a),
      topB = roofSlope(...b);
    meshFace(
      out,
      lounge ? 'trim' : 'brick',
      [
        f.at(0, bottomA),
        f.at(f.length, bottomB),
        f.at(f.length, lod === 0 ? topB : eaveB),
        f.at(0, lod === 0 ? topA : eaveA),
      ],
      f.n,
      lounge ? colors.white : i % 4 === 0 ? colors.brickShade : colors.brick,
    );
    if (lod > 0 && Math.max(topA - eaveA, topB - eaveB) > 0.001) {
      const top = [
        f.at(0, eaveA),
        f.at(f.length, eaveB),
        ...(topB > eaveB + 0.001 ? [f.at(f.length, topB)] : []),
        ...(topA > eaveA + 0.001 ? [f.at(0, topA)] : []),
      ];
      meshFace(out, 'roof', top, f.n, colors.roof);
    }
    if (lod === 0 || f.length < (lod === 1 ? 5.7 : 3.1)) continue;
    meshFace(
      out,
      'trim',
      [
        f.at(0, eaveA - 0.23, 0.042),
        f.at(f.length, eaveB - 0.23, 0.042),
        f.at(f.length, eaveB + 0.035, 0.042),
        f.at(0, eaveA + 0.035, 0.042),
      ],
      f.n,
      colors.white,
    );
    const bay = Math.max(1, Math.round(f.length / (lod === 1 ? 8.2 : lod === 2 ? 5.65 : 3.5)));
    const base = Math.floor((Math.min(bottomA, bottomB) + 1.2) / 3.06) * 3.06;
    for (let y = base + 1.03; y < Math.min(eaveA, eaveB) - 2.14; y += 3.06) {
      if (y < elevation(...m) + 0.5) continue;
      for (let j = 0; j < bay; j++) {
        const s = ((j + 0.5) * f.length) / bay;
        const width = Math.min(1.18, (f.length / bay) * 0.47);
        sash(out, f, s, y, width, 1.74, lod);
      }
    }
  }
}
function veranda(out, lod) {
  const x = design.porticoCenter,
    z = design.porticoBack;
  const base = -4.3,
    mainTop = 4.33;
  const col = (cx, cz, h, r) =>
    profile(
      out,
      'trim',
      cx,
      cz,
      [
        [base, r * 1.33],
        [base + 0.31, r * 1.33],
        [base + 0.44, r],
        [h - 0.4, r * 0.84],
        [h - 0.24, r * 1.36],
        [h, r * 1.36],
      ],
      colors.white,
      lod === 0 ? 4 : lod === 1 ? 6 : 10,
    );
  molding(out, x, z + 4.04, 16.4, 9.2, mainTop, 0.7);
  for (const side of [-1, 1]) {
    const vx = x + side * 18.9;
    molding(out, vx, z + 1.7, 21.3, 4.3, -0.6, 0.47);
    if (lod >= 1) for (let j = 0; j < 5; j++) col(vx - 8.55 + j * 4.27, z + 3.47, -0.6, 0.22);
  }
  for (let i = 0; i < 6; i++) {
    const cx = x - 6.7 + i * 2.68;
    col(cx, z + 7.95, mainTop, 0.31);
    if (lod >= 2) col(cx, z + 4.37, mainTop, 0.27);
  }
  box(
    out,
    'stone',
    x - 8.625,
    x + 8.625,
    z + 7.39,
    z + 9.21,
    base - 0.34,
    base - 0.01,
    colors.stone,
  );
  molding(out, x, z + 8.16, 17.2, 0.32, mainTop + 1.0, 0.21);
  if (lod >= 2)
    for (let j = 0; j < 28; j++) {
      const cx = x - 8.25 + j * 0.61;
      box(
        out,
        'trim',
        cx - 0.053,
        cx + 0.053,
        z + 8.06,
        z + 8.27,
        mainTop + 0.69,
        mainTop + 1.1,
        colors.white,
      );
    }
  for (let step = 0; step < 3; step++) {
    const back = z + 8.36 + step * 0.52,
      front = back + 0.53;
    box(
      out,
      'stone',
      x - 7.8 - step * 0.14,
      x + 7.8 + step * 0.14,
      back,
      front,
      base - 1.27,
      base - 0.32 - step * 0.34,
      colors.stone,
    );
  }
  const north = wallFrame([x + 10, z + 0.1], [x - 10, z + 0.1]);
  const peak = 17.55;
  meshFace(
    out,
    'trim',
    [north.at(0, 12.38), north.at(20, 12.38), north.at(10, peak)],
    north.n,
    colors.white,
  );
  meshFace(
    out,
    'roof',
    [north.at(0, 12.38), north.at(10, peak), north.at(10, peak, -5.8), north.at(0, 12.38, -5.8)],
    up,
    colors.roof,
  );
  meshFace(
    out,
    'roof',
    [north.at(10, peak), north.at(20, 12.38), north.at(20, 12.38, -5.8), north.at(10, peak, -5.8)],
    up,
    colors.roof,
  );
  const eye = Array.from({ length: lod >= 2 ? 12 : 6 }, (_, i) => {
    const d = (2 * Math.PI * i) / (lod >= 2 ? 12 : 6);
    return [10 + Math.cos(d) * 0.72, 14.6 + Math.sin(d) * 0.41];
  });
  area(out, 'glass', eye, (u, y) => north.at(u, y, 0.043), north.n, colors.glass);
}
function towerFace(out, x, z, w, d, lo, hi, lod, upper) {
  box(out, 'brick', x - w / 2, x + w / 2, z - d / 2, z + d / 2, lo, hi, colors.brickDarker);
  const square = rectangle(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  for (let i = 0; i < 4; i++) {
    const f = wallFrame(square[i], square[(i + 1) % 4]);
    const n = upper ? 5 : 4,
      count = upper ? 2 : 5;
    for (let j = 0; j < n; j++) {
      const s = (f.length * (j + 0.5)) / n;
      if (!upper) {
        panel(out, 'glass', f, s - 1.07, s + 1.07, lo + 3.4, hi - 2.55, 0.048, colors.porch);
        if (lod > 0) {
          panel(out, 'trim', f, s - 1.32, s - 1.09, lo + 3.4, hi - 2.5, 0.096, colors.white);
          panel(out, 'trim', f, s + 1.09, s + 1.32, lo + 3.4, hi - 2.5, 0.096, colors.white);
        }
      }
      for (let k = 0; k < count; k++) {
        const y = lo + ((hi - lo) * (k + (upper ? 0.09 : 0.51))) / (count + 0.45);
        if (lod > 0 || (upper && k === 0 && j % 2 === 0))
          sash(out, f, s, y, upper ? 1.34 : 1.81, upper ? 2.19 : 2.35, lod, true);
      }
      if (upper && lod > 0 && j > 0 && j < n - 1) {
        for (const sign of [-1, 1]) {
          const u = s + sign * 0.89;
          panel(out, 'trim', f, u - 0.1, u + 0.1, lo + 0.28, hi - 0.48, 0.11, colors.white);
        }
      }
      if (lod >= 2 && !upper)
        for (const y of [lo + 3.41, hi - 3.13])
          panel(out, 'trim', f, s - 1.5, s + 1.5, y, y + 0.56, 0.13, colors.white);
    }
  }
}
function clock(out, lod) {
  const [x, z] = design.towerCenter,
    lo = design.towerBase,
    a = design.towerLowerCornice,
    b = design.towerAtticCornice,
    c = design.towerClockBase;
  const [w, d] = design.towerLower,
    [sw, sd] = design.towerUpper;
  towerFace(out, x, z, w, d, lo, a, lod, false);
  molding(out, x, z, w + 1.26, d + 1.26, a - 0.39, 0.47);
  hipped(out, x, z, w + 0.65, d + 0.66, a + 0.1, 2.2, lod, true);
  towerFace(out, x, z, sw, sd, a + 1.96, b, lod, true);
  molding(out, x, z, sw + 1.06, sd + 1.08, b - 0.27, 0.42);
  hipped(out, x, z, sw + 0.74, sd + 0.74, b + 0.18, c - b - 0.18, lod, true);
  const pavilion = wallFrame([x + sw * 0.34, z + sd * 0.45], [x - sw * 0.34, z + sd * 0.45]);
  const ridgeCenter = pavilion.length / 2,
    rise = 2.15;
  const pediment = [
    [0, b + 0.17],
    [pavilion.length, b + 0.17],
    ...Array.from({ length: 9 }, (_, i) => {
      const u = (i * Math.PI) / 8;
      return [ridgeCenter + ridgeCenter * Math.cos(u), b + 0.19 + rise * Math.sin(u)];
    }),
  ];
  area(out, 'trim', pediment, (u, y) => pavilion.at(u, y, 0.09), pavilion.n, colors.white);
  const fan = pediment.map(([u, y]) => [
    mix(ridgeCenter, u, 0.77),
    b + 0.33 + (y - b - 0.17) * 0.73,
  ]);
  if (lod > 0)
    area(out, 'glass', fan, (u, y) => pavilion.at(u, y, 0.119), pavilion.n, colors.porch);
  molding(out, x, z, 4.1, 4.15, c - 0.14, 3.07);
  molding(out, x, z, 4.49, 4.49, c + 2.74, 0.39);
  const faces = rectangle(x - 2.06, x + 2.06, z - 2.09, z + 2.09);
  for (let i = 0; i < 4; i++) {
    const f = wallFrame(faces[i], faces[(i + 1) % 4]),
      u = f.length / 2,
      y = c + 1.45;
    const n = lod >= 2 ? 20 : 8,
      q = Array.from({ length: n }, (_, j) => {
        const d = (2 * Math.PI * j) / n;
        return [u + 1.06 * Math.cos(d), y + 1.06 * Math.sin(d)];
      });
    area(out, 'trim', q, (s, v) => f.at(s, v, 0.035), f.n, colors.shade);
    if (lod >= 1) {
      const pale = q.map(([s, v]) => [mix(u, s, 0.91), mix(y, v, 0.91)]);
      area(out, 'trim', pale, (s, v) => f.at(s, v, 0.049), f.n, colors.white);
      panel(out, 'accent', f, u - 0.037, u + 0.043, y - 0.07, y + 0.65, 0.071, colors.dark);
      panel(out, 'accent', f, u - 0.42, u + 0.015, y - 0.044, y + 0.036, 0.073, colors.dark);
    }
  }
  const fillet = c + 3.07,
    high = design.towerFinial;
  profile(
    out,
    'trim',
    x,
    z,
    [
      [fillet, 1.41],
      [fillet + 0.33, 1.4],
      [high - 2.21, 1.02],
      [high - 1.93, 1.23],
    ],
    colors.white,
    lod > 0 ? 8 : 6,
  );
  profile(
    out,
    'roof',
    x,
    z,
    [
      [high - 1.93, 1.27],
      [high - 1.66, 1.17],
      [high - 1.19, 0.9],
      [high - 0.83, 0.47],
      [high - 0.74, 0.24],
    ],
    colors.copper,
    lod > 0 ? 10 : 6,
  );
  profile(
    out,
    'accent',
    x,
    z,
    [
      [high - 0.74, 0.1],
      [high, 0.045],
    ],
    colors.gold,
    6,
  );
}
function build(out, lod) {
  envelope(out, lod);
  veranda(out, lod);
  clock(out, lod);
}
export const hotelSkyline = (out) => build(out, 0);
export const hotelDistrict = (out) => build(out, 1);
export const hotelStreet = (out) => build(out, 2);
export const hotelCloseup = (out) => build(out, 3);
const recipe = 'omni-homestead-resort-model.mjs';
const camera = world(-158, 111, 282),
  lookAt = world(-8, 10, 23);
export const hotelModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: hotelCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The connected Homestead hotel, its Colonial Revival brick wings, white entrance colonnade and tiered 1929 clock tower.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: world(-18, 26, 25),
  portableGroundY: -7.8,
  mediumFiContext: {
    scale: 0.93,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: mappedOutline,
    minimumCoverage: 0.86,
    basis: 'Named 131-vertex mapped envelope of the connected hotel.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_limestone',
    'plaster_lime',
    'metal_standing_seam',
  ],
  qaCameras: [
    {
      name: 'lawn-portico-and-clock-tower',
      position: world(-35, 16, 175),
      lookAt: world(0, 18, 69),
    },
    {
      name: 'tower-clock-copper-roof-and-lantern',
      position: world(-22, 36, 130),
      lookAt: world(14, 38, 68),
    },
    {
      name: 'brick-wings-and-main-roof-plan',
      position: world(160, 137, -69),
      lookAt: world(3, 10, 28),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `hotel-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'hotelSkyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'hotelDistrict', 0.48],
        ['street', 'hotelStreet', 0.23],
        ['closeup', 'hotelCloseup', 0.082],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap outlines are ODbL. Both photos are CC0 own work by The Ninjaneer.',
};
