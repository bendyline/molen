import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  ribbon,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  chamferedRectangle,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const d = plan.dimensions;
const c = {
  stone: rgb('ae9678'),
  ashlar: rgb('c2a881'),
  cornice: rgb('d0b68d'),
  stucco: rgb('baa68b'),
  cream: rgb('e1cea0'),
  gold: rgb('cda65c'),
  dark: rgb('404044'),
  copper: rgb('ac8466'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.91 },
  ashlar: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.86 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.94 },
};
const box = (o, slot, x0, x1, y0, y1, z0, z1, color) =>
  abox(o, slot, [x0, y0, z0], [x1, y1, z1], color);
const band = (o, F, a, b, low, high, depth, color = c.cornice) =>
  fbox(o, 'ashlar', F, a, b, low, high, 0.02, depth, color);
const ringAt = (y, r, center, sides = 8) => radialRing(y, r, r, sides, center, Math.PI / 8);

function cap(out, slot, ring, height, color) {
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3).map((j) => [ring[j][0], height, ring[j][1]]);
    tri(out, slot, a, c, b, color);
  }
}

function arch(out, F, x, y, width, height, lod, head = 'round', bar = 0) {
  opening(out, F, x, y, width, height, {
    head,
    glassSlot: 'dark',
    glass: c.dark,
    frameSlot: 'ashlar',
    frame: c.ashlar,
    frameWidth: lod > 1 ? 0.2 : 0,
    frameDepth: 0.125,
    d: 0.048,
    sill: lod > 1,
    mullions: lod > 1 ? bar : 0,
  });
}

function body(out, lod) {
  const outline = frame.geometry.outline;
  extrude(out, 'stone', outline, d.foundation, d.aisleEave, c.stone, { top: false });
  cap(out, 'roof', outline, d.aisleEave - 0.018, c.stucco);
  ribbon(out, 'ashlar', outline, 15.65, 16.36, c.cornice, {
    offset: 0.21,
    inset: 0.025,
    minLength: 0.8,
  });
  const hw = d.naveWidth / 2,
    n = d.naveCenter;
  box(out, 'stone', -24.35, d.rear - 0.19, d.aisleEave - 0.16, d.naveEave, n - hw, n + hw, c.stone);
  gableRoof(
    out,
    'roof',
    [-24.23, n],
    [d.rear - 0.26, n],
    d.naveWidth,
    d.naveEave,
    d.naveRidge,
    c.copper,
    { overhang: 0.21, endSlot: 'stone', endColor: c.ashlar },
  );
  // Lower side ranges and raised eastern block follow the mapped basilica.
  box(out, 'stone', 25.93, d.rear, 16.33, 21.65, 9.98, 21.38, c.stone);
  box(out, 'roof', 26.0, d.rear - 0.12, 21.66, 21.85, 10.08, 21.26, c.stucco);
  const roofEdges = [
    [-24.2, 26.0, d.sideNorth, n - hw],
    [-24.6, 25.59, n + hw, d.sideSouth],
  ];
  for (const [a, b, z0, z1] of roofEdges) {
    const north = z1 < n,
      upper = north ? z1 : z0,
      outer = north ? z0 : z1;
    const elevated = 17.7;
    if (north)
      quad4(
        out,
        'roof',
        [a, d.aisleEave, outer],
        [a, elevated, upper],
        [b, elevated, upper],
        [b, d.aisleEave, outer],
        c.stucco,
      );
    else
      quad4(
        out,
        'roof',
        [a, elevated, upper],
        [a, d.aisleEave, outer],
        [b, d.aisleEave, outer],
        [b, elevated, upper],
        c.stucco,
      );
  }
  if (lod === 0) return;
  for (const [z, sign] of [
    [d.sideNorth, -1],
    [d.sideSouth, 1],
  ]) {
    const side = facade([0, z], [sign, 0]);
    const high = facade([0, n + sign * hw], [sign, 0]);
    for (const q of [-18.8, -9.3, 0.5, 10.3, 20.1, 30.3]) {
      arch(out, high, q * sign, 17.95, 2.05, 2.35, lod, 'round', 1);
      if (sign < 0 || q < 24) {
        arch(out, side, q * sign, 7.1, 2.13, 4.91, lod, 'round', 1);
        if (lod > 1) band(out, side, q * sign - 3.58, q * sign - 3.15, 3.2, 15.65, 0.39, c.ashlar);
      }
    }
  }
  const east = facade([d.rear, 0], [0, -1]);
  for (const z of [-16.0, -8.7, 0.9, 8.6, 16.5])
    arch(out, east, -z, 5.6, 2.4, 5.75, lod, 'round', 1);
  if (lod === 3)
    for (let z = -11.8; z <= 1.4; z += 1.1) {
      const ridge = d.naveRidge - 0.028 - (Math.abs(z - n) / hw) * (d.naveRidge - d.naveEave);
      box(out, 'roof', -22, 37.6, ridge - 0.03, ridge + 0.045, z, z + 0.045, c.copper);
    }
}

function crossTop(out, x, z, low, height, width) {
  beam(out, 'ashlar', [x, low, z], [x, low + height, z], width, width, c.cream);
  beam(
    out,
    'ashlar',
    [x, low + height * 0.66, z - height * 0.28],
    [x, low + height * 0.66, z + height * 0.28],
    width,
    width,
    c.cream,
  );
}

function tower(out, tower, lod) {
  const t = d.tower,
    x = t.x,
    z = tower.z,
    pick = [x, z],
    half = t.foundationWidth / 2;
  box(out, 'stone', x - half, x + half, d.foundation, t.lowerTop, z - half, z + half, c.stone);
  const low = 10.6,
    top = t.bellTop,
    fb = 4.73;
  box(out, 'stone', x - fb, x + fb, low, top, z - fb, z + fb, c.ashlar);
  const bellEdges = [
    facade([x - fb, z], [0, 1]),
    facade([x + fb, z], [0, -1]),
    facade([x, z - fb], [-1, 0]),
    facade([x, z + fb], [1, 0]),
  ];
  for (const F of bellEdges) {
    for (const h of [21.85, 34.45]) band(out, F, -fb - 0.4, fb + 0.4, h - 0.24, h + 0.5, 0.66);
    if (lod >= 1) {
      for (const u of [-2.49, 0, 2.49]) arch(out, F, u, 23.3, 1.75, 7.68, lod);
      if (lod >= 2)
        for (const u of [-3.54, -1.28, 1.28, 3.54])
          band(out, F, u - 0.18, u + 0.18, 22.43, 32.8, 0.41, c.cornice);
    }
  }
  loft(
    out,
    'ashlar',
    [
      chamferedRectangle(x, 34.51, z, 9.8, 9.8, 1.35),
      chamferedRectangle(x, t.drumTop, z, 8.1, 8.1, 1.19),
    ],
    c.stone,
    { cap: false },
  );
  if (lod >= 1) {
    const r = 4.46;
    for (const F of [
      facade([x - r, z], [0, 1]),
      facade([x + r, z], [0, -1]),
      facade([x, z - r], [-1, 0]),
      facade([x, z + r], [1, 0]),
    ]) {
      for (const u of [-1.13, 1.13]) {
        const ellipse = Array.from({ length: lod > 1 ? 14 : 8 }, (_, i) => {
          const a = (2 * Math.PI * i) / (lod > 1 ? 14 : 8);
          const offset = 1.85 * Math.sin(a);
          return F.P(u + 0.76 * Math.cos(a), 39.23 + offset, 0.15 - 0.0915 * offset);
        });
        fan(out, 'dark', ellipse, c.dark);
        if (lod > 1)
          for (let i = 0; i < ellipse.length; i++)
            beam(
              out,
              'ashlar',
              ellipse[i],
              ellipse[(i + 1) % ellipse.length],
              0.11,
              0.11,
              c.cornice,
            );
      }
    }
  }
  const spring = t.drumTop,
    finial = tower.height - 1.28;
  const a = ringAt(spring, 4.47, pick),
    b = ringAt(spring + 4.8, 3.87, pick),
    peak = ringAt(finial, 0.1, pick);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      color = i % 2 ? c.cream : c.gold;
    quad4(out, 'roof', a[i], a[j], b[j], b[i], color);
    quad4(out, 'roof', b[i], b[j], peak[j], peak[i], color);
    if (lod > 1 && i % 2 === 0) {
      beam(out, 'ashlar', a[i], peak[i], 0.126, 0.126, c.cornice);
      const edgeX = x + (a[i][0] - x) * 1.025,
        edgeZ = z + (a[i][2] - z) * 1.025;
      loft(
        out,
        'ashlar',
        [
          ringAt(spring - 1.15, 0.56, [edgeX, edgeZ], 6),
          ringAt(spring + 1.15, 0.55, [edgeX, edgeZ], 6),
          ringAt(spring + 8.25, 0.064, [edgeX, edgeZ], 6),
        ],
        c.cream,
        { cap: false },
      );
    }
  }
  crossTop(out, x, z, finial, 1.28, 0.105);
}

function westFace(out, lod) {
  const F = facade([d.front - 0.31, d.naveCenter], [0, 1]);
  const left = -10.22,
    right = 10.23,
    eave = 23.04,
    rise = 5.7;
  // Continuous portal wall with a projecting segmental pediment.
  fbox(out, 'stone', F, left, right, d.baseFloor, eave, -0.91, 0.03, c.stone);
  const count = [8, 10, 14, 20][lod];
  const span = (right - left) / 2;
  const curve = Array.from({ length: count + 1 }, (_, i) => {
    const u = left + ((right - left) * i) / count;
    const t = u / span;
    return [u, eave + rise * (1 - t * t)];
  });
  const root = (u, y, depth) => F.P(u, y, depth);
  fan(
    out,
    'ashlar',
    [
      root(left, eave, 0.45),
      root(right, eave, 0.45),
      ...curve
        .slice(1, -1)
        .reverse()
        .map(([u, y]) => root(u, y, 0.45)),
    ],
    c.ashlar,
  );
  for (let i = 0; i < curve.length - 1; i++) {
    const [u, y] = curve[i],
      [v, h] = curve[i + 1];
    quad4(
      out,
      'ashlar',
      root(u, y - 0.19, 0.54),
      root(v, h - 0.19, 0.54),
      root(v, h + 0.17, 0.54),
      root(u, y + 0.17, 0.54),
      c.cornice,
    );
    if (lod >= 2 && i % 2 === 0) {
      band(out, F, u - 0.12, u + 0.12, y + 0.03, y + 0.89, 0.58);
      loft(
        out,
        'ashlar',
        [
          ringAt(y + 0.82, 0.18, [d.front - 0.75, d.naveCenter + u], 5),
          ringAt(y + 1.31, 0.046, [d.front - 0.75, d.naveCenter + u], 5),
        ],
        c.cream,
        { cap: false },
      );
    }
  }
  for (const [u, w, h] of [
    [-6.5, 2.75, 5.9],
    [0, 4.03, 8.62],
    [6.5, 2.75, 5.9],
  ]) {
    arch(out, F, u, d.baseFloor, w, h, lod);
    if (lod > 1)
      for (const sign of [-1, 1]) {
        const j = u + sign * (w / 2 + 0.44);
        band(out, F, j - 0.21, j + 0.21, 0.72, h - 0.04, 0.34, c.ashlar);
      }
  }
  if (lod >= 1) {
    arch(out, F, 0, 12.6, 3.59, 5.0, lod);
    band(out, F, -span, span, 21.4, 21.96, 0.3);
    band(out, F, -1.78, 1.78, 27.2, 31.33, 0.53, c.ashlar);
    const clock = Array.from({ length: 16 }, (_, i) => {
      const angle = (Math.PI * i) / 8;
      return root(0.67 * Math.cos(angle), 29.7 + 0.67 * Math.sin(angle), 0.56);
    });
    fan(out, 'dark', clock, c.dark);
    crossTop(out, d.front - 0.83, d.naveCenter, 31.25, 2.05, 0.17);
  }
  if (lod >= 1) {
    for (const dir of [-1, 1]) {
      const u = 6.5 * dir;
      const circular = Array.from({ length: 14 }, (_, i) => {
        const a = (2 * Math.PI * i) / 14;
        return root(u + 0.9 * Math.cos(a), 12.97 + 0.9 * Math.sin(a), 0.087);
      });
      fan(out, 'dark', circular, c.dark);
      if (lod >= 2) {
        for (const x of [9.88, 11.08, 14.12, 14.84]) {
          const q = dir * x;
          band(out, F, q - 0.17, q + 0.17, 0.81, 21.34, 0.43, c.cornice);
        }
        for (let i = 0; i < circular.length; i++) {
          beam(
            out,
            'ashlar',
            circular[i],
            circular[(i + 1) % circular.length],
            0.12,
            0.11,
            c.cornice,
          );
        }
      }
    }
  }
  const steps = lidSteps(lod);
  for (let i = 0; i < steps; i++)
    fbox(
      out,
      'ashlar',
      F,
      -11.25,
      11.25,
      -0.22,
      d.baseFloor * (1 - i / steps),
      0.06 + (0.56 * i) / steps,
      0.06 + (0.56 * (i + 1)) / steps,
      c.ashlar,
    );
}
const lidSteps = (lod) => [1, 2, 3, 4][lod];

function dome(out, lod) {
  const p = d.dome,
    center = [p.x, p.z],
    r = p.radius,
    faceCount = lod >= 2 ? 16 : 8;
  const rings = [
    ringAt(p.base, r, center, faceCount),
    ringAt(p.spring, r * 1.06, center, faceCount),
  ];
  loft(out, 'stone', rings, c.ashlar, { cap: false });
  const n = [4, 5, 8, 12][lod];
  const profile = Array.from({ length: n + 1 }, (_, i) => {
    const a = ((Math.PI / 2) * i) / n;
    return ringAt(
      p.spring + Math.sin(a) * (p.crest - p.spring),
      Math.max(0.95, Math.cos(a) * r),
      center,
      faceCount,
    );
  });
  loft(out, 'roof', profile, c.copper, { cap: false });
  loft(
    out,
    'ashlar',
    [
      ringAt(p.crest - 0.1, 1.27, center, 8),
      ringAt(p.crest + 3.76, 1.17, center, 8),
      ringAt(p.lanternTip - 0.81, 0.16, center, 8),
    ],
    c.ashlar,
    { cap: false },
  );
  crossTop(out, p.x, p.z, p.lanternTip - 0.85, 0.85, 0.095);
  if (lod > 0) {
    for (const [ax, az] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const F = facade([p.x + ax * r, p.z + az * r], [az, -ax]);
      arch(out, F, 0, p.base + 0.85, 2.3, 3.7, lod, 'round', 1);
    }
  }
  if (lod >= 2)
    for (let i = 0; i < faceCount; i += 2) {
      for (let j = 1; j < profile.length; j++)
        beam(out, 'ashlar', profile[j - 1][i], profile[j][i], 0.085, 0.085, c.cream);
    }
}

function build(out, lod) {
  body(out, lod);
  tower(out, d.north, lod);
  tower(out, d.south, lod);
  westFace(out, lod);
  dome(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [-106, 54, 77],
  lookAt = [-8, 22, -4],
  recipe = 'guadalajara-cathedral-model.mjs';
const levels = { district: 0.92, street: 0.24, closeup: 0.085 };
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  category: 'cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Guadalajara’s cathedral with its measured twin spires, segmented plaza-facing stone front, and eastern basilica roof.',
  camera,
  lookAt,
  sunDirection: [-39, 64, 37],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Cathedral way only. The Sagrario remains a separate building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-portals-pediment-and-spires', position: [-127, 23, -2], lookAt: [-31, 26, -4.8] },
    { name: 'south-side-and-cathedral-roof', position: [-47, 53, 111], lookAt: [-9, 19, -4.6] },
    { name: 'east-lantern-and-basilica', position: [104, 39, 53], lookAt: [5, 18, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'guadalajara-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.55,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(levels).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
