/** Brands farmhouse and the 2011 museum wing, Herenstreek, in August 2024. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid'),
  [outline] = read('map-frame').geometry.polygons;
const { house, wingHeight, parapet, wingFrontZ, wingFrontX, entryCenter } = plan.section;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.91, metallic: 0 },
  wood: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.86, metallic: 0 },
  thatch: { slot: 'roof', graph: 'thatch', roughness: 0.94, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
  glass: { slot: 'window', localRef: white, roughness: 0.55, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    house: 'a17c6b',
    houseShade: '956f5d',
    brickBase: '88786a',
    wing: 'a08b7d',
    wood: '8d8170',
    woodDark: '796e5d',
    thatch: '8a7e5a',
    thatchLight: '998964',
    thatchDark: '786d51',
    fascia: 'c7c3ae',
    roof: '787b6f',
    white: 'cfd0bd',
    glass: '4b625d',
    glassLight: '688076',
    green: '526b58',
    shadow: '414b43',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (
    lerp(lerp(a[i], a[i + 1], dx), lerp(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters
  );
}
function face(out, slot, p, expected, tint) {
  let normal = normalFor(...p);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  if (p.length === 4) quad(out, slot, p, normal, tint);
  else if (p.length === 3)
    out.addTriangle(
      slot,
      white,
      p,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
  else out.addConvexPolygon(slot, white, p, normal, (v) => [v[0], v[2]], tint);
}
function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  return {
    length,
    normal: [uz, 0, -ux],
    at: (u, y, d = 0) => [a[0] + ux * u + uz * d, y, a[1] + uz * u - ux * d],
  };
}
function panel(out, wall, slot, a, b, low, high, color, d = 0) {
  face(
    out,
    slot,
    [wall.at(a, low, d), wall.at(b, low, d), wall.at(b, high, d), wall.at(a, high, d)],
    wall.normal,
    color,
  );
}
function sash(out, wall, u, y, w, h, lod, door = false) {
  const a = u - w / 2,
    b = u + w / 2;
  panel(out, wall, 'wood', a - 0.072, b + 0.072, y - 0.07, y + h + 0.074, c.white, 0.034);
  panel(out, wall, 'glass', a, b, y, y + h, door ? c.green : c.glass, 0.055);
  if (lod > 0) {
    panel(out, wall, 'wood', u - 0.025, u + 0.025, y, y + h, c.white, 0.077);
    panel(out, wall, 'wood', a, b, y + h * 0.63, y + h * 0.63 + 0.048, c.white, 0.077);
  }
  if (lod > 1) {
    panel(out, wall, 'wood', a - 0.098, b + 0.098, y - 0.112, y - 0.045, c.fascia, 0.116);
    panel(out, wall, 'glass', a + 0.05, u - 0.04, y + h * 0.69, y + h - 0.063, c.glassLight, 0.071);
  }
}
const perimeter = cleanRing(outline);
const area = perimeter.reduce((sum, [x, z], i) => {
  const [a, b] = perimeter[(i + 1) % perimeter.length];
  return sum + x * b - z * a;
}, 0);
if (area < 0) perimeter.reverse();

const roofBreak = -6.95;
function roofPart(ring, old) {
  const inside = ([x]) => (old ? x < roofBreak : x >= roofBreak);
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const kept = inside(a) ? [a] : [];
    if (inside(a) !== inside(b))
      kept.push([roofBreak, lerp(a[1], b[1], (roofBreak - a[0]) / (b[0] - a[0]))]);
    return kept;
  });
}
function envelope(out, lod) {
  const cap = earcut(perimeter.flat());
  for (let i = 0; i < cap.length; i += 3) {
    const triangle = cap.slice(i, i + 3).map((index) => perimeter[index]);
    for (const old of [true, false]) {
      const ring = roofPart(triangle, old);
      const y = old ? house.eave - 0.016 : wingHeight;
      if (ring.length >= 3)
        face(
          out,
          'metal',
          ring.map(([x, z]) => [x, y, z]),
          up,
          c.roof,
        );
    }
  }
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i],
      b = perimeter[(i + 1) % perimeter.length],
      wall = edge(a, b),
      w = wall.length;
    const x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2;
    const old = x < roofBreak,
      top = old ? house.eave : wingHeight;
    const base = Math.min(-0.44, ground(...a) - 0.36, ground(...b) - 0.36);
    panel(out, wall, 'brick', 0, w, base, top, old ? c.house : c.wing);
    if (lod > 0 && w > 0.38) panel(out, wall, 'brick', 0, w, base, 0.39, c.brickBase, 0.016);
    if (!old) {
      panel(out, wall, 'wood', 0, w, top - 0.45, parapet, c.wood, 0.044);
      panel(out, wall, 'metal', -0.1, w + 0.1, parapet - 0.046, parapet + 0.033, c.woodDark, 0.11);
    }
    if (w < 3.8 || z > 6.9) continue;
    if (old) {
      for (const f of w > 8 ? [0.28, 0.72] : [0.5]) sash(out, wall, w * f, 1.05, 0.81, 1.48, lod);
    } else if (lod > 0 && w > 6.7) {
      for (const f of [0.27, 0.74])
        sash(out, wall, w * f, 1.28, Math.min(1.73, w * 0.26), 1.37, lod);
    }
  }
}
function thatchedRoof(out, lod) {
  const [left, right] = house.x,
    [far, near] = house.z,
    x = (left + right) / 2;
  const { eave, clippedGable: clip, ridge } = house;
  const xLeft = lerp(left, x, (clip - eave) / (ridge - eave));
  const xRight = lerp(right, x, (clip - eave) / (ridge - eave));
  const end = 0.26,
    f = far - end,
    n = near + end;
  const lowLeft = left - 0.37,
    lowRight = right + 0.37;
  const ridgeFar = [x, ridge, far + 3.27],
    ridgeNear = [x, ridge, near - 3.02];
  for (const [x0, x1, tint] of [
    [lowLeft, xLeft, c.thatch],
    [lowRight, xRight, c.thatchDark],
  ]) {
    face(
      out,
      'thatch',
      [[x0, eave, f], [x0, eave, n], [x1, clip, n], ridgeNear, ridgeFar, [x1, clip, f]],
      up,
      tint,
    );
    if (lod > 0) {
      const fascia = [
        [x0, eave - 0.095, f],
        [x0, eave - 0.095, n],
      ];
      beamPath(out, 'thatch', fascia, 0.19, 0.19, c.thatchDark);
    }
  }
  for (const [z, p, sign] of [
    [f, ridgeFar, -1],
    [n, ridgeNear, 1],
  ]) {
    face(out, 'thatch', [[xLeft, clip, z], [xRight, clip, z], p], up, c.thatchLight);
    const w =
      z === n
        ? edge([right, near + 0.06], [left, near + 0.06])
        : edge([left, far - 0.05], [right, far - 0.05]);
    face(
      out,
      'brick',
      [
        [left, eave - 0.045, w.at(0, 0)[2]],
        [right, eave - 0.045, w.at(0, 0)[2]],
        [xRight, clip - 0.07, w.at(0, 0)[2]],
        [xLeft, clip - 0.07, w.at(0, 0)[2]],
      ],
      [0, 0, sign],
      c.houseShade,
    );
    if (lod > 0)
      beamPath(
        out,
        'wood',
        [
          [lowLeft, eave - 0.095, z],
          [xLeft, clip - 0.065, z],
          [xRight, clip - 0.065, z],
          [lowRight, eave - 0.095, z],
        ],
        0.088,
        0.072,
        c.fascia,
      );
    for (const f of [0.34, 0.52, 0.7]) sash(out, w, w.length * f, 3.72, 0.65, 0.95, lod);
    if (z === n) {
      const facade = edge([right, 11.36], [left, 11.36]);
      for (const [u, y, w, h, door] of [
        [2.01, 0.26, 0.88, 2.34, true],
        [5.23, 0.68, 1.77, 1.9, false],
        [9.0, 0.71, 1.76, 1.91, false],
      ])
        sash(out, facade, u, y, w, h, lod, door);
    }
  }
  if (lod > 0) beamPath(out, 'thatch', [ridgeFar, ridgeNear], 0.24, 0.27, c.thatchLight);
  box(out, 'brick', x - 0.72, ridge - 0.73, 2.85, 0.88, 1.31, 0.65, c.house);
  if (lod > 1) box(out, 'brick', x - 0.72, ridge + 0.54, 2.85, 1.0, 0.12, 0.77, c.brickBase);
}
function modernWing(out, lod) {
  const [left, right] = wingFrontX,
    front = edge([right, wingFrontZ], [left, wingFrontZ]);
  const u = right - entryCenter;
  panel(out, front, 'glass', u - 2.23, u + 2.23, 0.16, 3.52, c.glass, 0.046);
  box(out, 'metal', entryCenter, 3.57, wingFrontZ + 0.46, 5.11, 0.2, 1.16, c.woodDark);
  box(
    out,
    'brick',
    entryCenter,
    Math.min(0.04, ground(entryCenter, wingFrontZ + 0.67) - 0.12),
    wingFrontZ + 0.46,
    5.22,
    0.15,
    0.99,
    c.brickBase,
  );
  if (lod > 0) {
    for (const d of [-2.23, -1.22, 0, 1.15, 2.23])
      panel(out, front, 'metal', u + d - 0.032, u + d + 0.032, 0.16, 3.52, c.fascia, 0.075);
    panel(out, front, 'metal', u - 2.2, u + 2.2, 2.55, 2.62, c.fascia, 0.078);
    panel(out, front, 'wood', u + 3.25, u + 7.8, 2.27, 3.12, c.wood, 0.06);
    panel(out, front, 'glass', u + 3.31, u + 7.71, 2.34, 3.05, c.shadow, 0.082);
  }
  if (lod > 1) {
    for (const x of [entryCenter - 2.44, entryCenter + 2.42])
      box(out, 'metal', x, 0.09, wingFrontZ + 0.84, 0.074, 3.47, 0.075, c.fascia);
    for (let i = 0; i < (lod === 3 ? 6 : 3); i++) {
      const d = i * 0.56;
      panel(
        out,
        front,
        'wood',
        u + 8.1 + d,
        u + 8.37 + d,
        2.1,
        2.46 + (i % 2) * 0.17,
        c.woodDark,
        0.081,
      );
    }
  }
  if (lod > 0) {
    box(out, 'metal', 3.55, wingHeight - 0.01, -3.28, 2.41, 0.43, 1.36, c.fascia);
    box(out, 'metal', 3.55, wingHeight + 0.4, -3.28, 2.52, 0.078, 1.45, c.white);
  }
}
function build(out, lod) {
  envelope(out, lod);
  thatchedRoof(out, lod);
  modernWing(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const recipe = 'museum-collectie-brands-model.mjs',
  camera = [36, 15, 52],
  lookAt = [0, 3.7, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.34],
    ['street', 'museumStreet', 0.12],
    ['closeup', 'museumCloseup', 0.034],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: museumCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The thatched Brands farmhouse and its low, flat-roofed museum wing at Herenstreek in Nieuw-Dordrecht.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis: 'Named BAG-sourced OpenStreetMap museum way 270644031, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'wood_weatherboard', 'thatch', 'metal_painted'],
  qaCameras: [
    {
      name: 'herenstreek-farmhouse-and-new-wing',
      position: [14, 6.2, 48],
      lookAt: [-1.2, 3.8, 5.2],
    },
    {
      name: 'thatched-gables-and-brick-farmhouse',
      position: [-32, 10, 28],
      lookAt: [-13.3, 4.5, 4.5],
    },
    { name: 'library-roof-and-connecting-bays', position: [35, 19, -30], lookAt: [3.5, 3.4, -1.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-museum-collectie-brands-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. The Qualla photo has a first-party CC0 release.',
};
