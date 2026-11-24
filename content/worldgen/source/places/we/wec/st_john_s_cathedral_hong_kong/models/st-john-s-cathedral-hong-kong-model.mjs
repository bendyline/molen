import fs from 'node:fs';
import {
  beam,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { nave, tower, crossings, aisleEave, base, wallFoot } = plan.dimensions;
const wall = rgb('ccc0a9');
const stone = rgb('d3c8af');
const granite = rgb('a29785');
const copper = rgb('415449');
const glazing = rgb('35413e');
const door = rgb('41362b');
const surfaces = {
  roughcast: { slot: 'wall', graph: 'stucco', roughness: 0.96 },
  granite: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.92 },
  dress: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.9 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
  doors: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.89 },
};
const block = (out, slot, x0, x1, z0, z1, y0, y1, color) =>
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
const roof = (out, a, b, width, eave, ridge) =>
  gableRoof(out, 'metal', a, b, width, eave, ridge, copper, {
    overhang: 0.25,
    endSlot: 'roughcast',
    endColor: wall,
  });
function lancet(out, F, u, y, w, h, lod, mullions = 0, portal = false) {
  opening(out, F, u, y, w, h, {
    head: 'pointed',
    glassSlot: portal ? 'doors' : 'glass',
    frameSlot: 'dress',
    glass: portal ? door : glazing,
    frame: stone,
    d: 0.048,
    frameWidth: lod > 1 ? Math.min(w * 0.105, 0.23) : 0,
    frameDepth: 0.13,
    sill: !portal && lod > 1,
    mullions: lod > 0 ? mullions : 0,
  });
}
function oculus(out, F, y, radius, lod) {
  const n = lod > 1 ? 14 : 8;
  const ring = (r, d) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return F.P(r * Math.cos(a), y + r * Math.sin(a), d);
    });
  fan(out, 'dress', ring(radius, 0.09), stone);
  fan(out, 'glass', ring(radius * 0.74, 0.12), glazing);
  if (lod > 1) {
    for (const i of [-1, 0, 1]) {
      const dx = radius * i * 0.31;
      beam(
        out,
        'dress',
        F.P(dx, y - radius * 0.57, 0.141),
        F.P(dx, y + radius * 0.57, 0.141),
        0.045,
        0.04,
        stone,
      );
    }
  }
}
function buttress(out, F, u, top, width, lod) {
  fbox(out, 'dress', F, u - width / 2, u + width / 2, base - 0.1, top * 0.57, -0.07, 0.65, stone);
  fbox(out, 'dress', F, u - width * 0.36, u + width * 0.36, top * 0.55, top, -0.07, 0.32, stone);
  if (lod > 1)
    fbox(
      out,
      'dress',
      F,
      u - width * 0.56,
      u + width * 0.56,
      top * 0.57,
      top * 0.57 + 0.2,
      0.02,
      0.7,
      granite,
    );
}
function aisleRoof(out, sign, west, east, outer) {
  const inner = nave.z + (sign * nave.width) / 2;
  const P = [west, aisleEave + 2.25, inner],
    Q = [east, aisleEave + 2.25, inner];
  const A = [west, aisleEave - 0.08, outer + sign * 0.22],
    B = [east, aisleEave - 0.08, outer + sign * 0.22];
  if (sign > 0) quad4(out, 'metal', A, B, Q, P, copper);
  else quad4(out, 'metal', B, A, P, Q, copper);
  tri(out, 'roughcast', sign > 0 ? P : A, [west, aisleEave, inner], sign > 0 ? A : P, wall);
  tri(out, 'roughcast', sign > 0 ? B : Q, [east, aisleEave, inner], sign > 0 ? Q : B, wall);
}
function cross(out, x, y, z, eastFacing) {
  block(out, 'dress', x - 0.09, x + 0.09, z - 0.09, z + 0.09, y, y + 0.87, stone);
  const width = eastFacing ? [0.08, 0.31] : [0.31, 0.08];
  block(
    out,
    'dress',
    x - width[0],
    x + width[0],
    z - width[1],
    z + width[1],
    y + 0.52,
    y + 0.68,
    stone,
  );
}
function cathedralBody(out, lod) {
  const ring = frame.geometry.outline;
  extrude(out, 'granite', ring, wallFoot, base, granite, { top: false });
  extrude(out, 'roughcast', ring, base - 0.02, aisleEave, wall, { top: false });
  ribbon(out, 'dress', ring, base - 0.12, base + 0.15, stone, {
    offset: 0.09,
    minLength: 0.7,
    inset: 0,
  });
  block(
    out,
    'roughcast',
    nave.west,
    nave.east,
    nave.z - nave.width / 2,
    nave.z + nave.width / 2,
    aisleEave - 0.05,
    nave.eave,
    wall,
  );
  roof(out, [nave.west, nave.z], [nave.east, nave.z], nave.width, nave.eave, nave.ridge);
  for (const [sign, westOuter, eastOuter] of [
    [-1, -4.87, -8.99],
    [1, 11.33, 15.59],
  ]) {
    aisleRoof(out, sign, nave.west, crossings[0].west + 0.18, westOuter);
    aisleRoof(out, sign, sign > 0 ? 10.47 : 14.67, nave.east, eastOuter);
    const c = crossings[sign > 0 ? 1 : 0];
    const x = (c.west + c.east) / 2;
    // The south aisle projects further only on the west side of the eastern attachment.
    const crossWidth = sign > 0 ? 11.25 : c.east - c.west;
    const center = sign > 0 ? c.west + crossWidth / 2 : x;
    const innerEnd = nave.z + sign * 0.42;
    block(
      out,
      'roughcast',
      center - crossWidth / 2,
      center + crossWidth / 2,
      Math.min(c.end, innerEnd),
      Math.max(c.end, innerEnd),
      aisleEave - 0.02,
      c.eave,
      wall,
    );
    roof(out, [center, innerEnd], [center, c.end], crossWidth, c.eave, c.ridge);
    const F = facade([center, c.end], [sign, 0]);
    lancet(out, F, 0, 3.15, 1.37, 7.35, lod, 1);
    lancet(out, F, -2.22, 3.15, 1.07, 5.93, lod);
    lancet(out, F, 2.22, 3.15, 1.07, 5.93, lod);
    if (lod > 0) {
      oculus(out, F, 12.3, 0.49, lod);
      buttress(out, F, -crossWidth / 2 + 0.56, c.eave + 0.28, 0.78, lod);
      buttress(out, F, crossWidth / 2 - 0.56, c.eave + 0.28, 0.78, lod);
      cross(out, center, c.ridge, c.end - sign * 0.1, false);
      const high = facade([0, nave.z + (sign * nave.width) / 2], [sign, 0]);
      for (const x of [-11.1, -7.3, -3.49, 17.5, 21.15, 24.8, 28.45]) {
        lancet(out, high, x * sign, 10.05, 1.28, 1.38, lod, 1);
        if (lod > 1)
          fbox(out, 'dress', high, x * sign + 1.55, x * sign + 1.83, 9.8, 12.15, 0.01, 0.21, stone);
      }
      for (const [z, xs] of [
        [westOuter, [-10.7, -6.63, -2.58]],
        [eastOuter, [17.53, 21.7, 25.9, 29.3]],
      ]) {
        const F = facade([0, z], [sign, 0]);
        for (const x of xs) {
          lancet(out, F, x * sign, 2.25, 1.53, 4.02, lod, 1);
          if (x < 29) buttress(out, F, (x + 1.73) * sign, 6.57, 0.69, lod);
        }
      }
    }
  }
  const choir = facade([nave.east, nave.z], [0, -1]);
  lancet(out, choir, 0, 3.6, 5.18, 10.54, lod, 4);
  if (lod > 0) {
    for (const u of [-5.7, 5.7]) buttress(out, choir, u, 12, 0.81, lod);
    for (const u of [-9.3, 9.3]) lancet(out, choir, u, 2.2, 1.38, 4.2, lod, 1);
    cross(out, nave.east - 0.1, nave.ridge, nave.z, true);
  }
  if (lod > 1) {
    for (const u of [-1.53, -0.52, 0.52, 1.53]) {
      const height = Math.abs(u) > 1 ? 11.44 : 12.4;
      const n = 5;
      const points = Array.from({ length: n + 1 }, (_, i) => {
        const a = (Math.PI * i) / n;
        return choir.P(u + 0.47 * Math.cos(a), height + 0.62 * Math.sin(a), 0.155);
      });
      for (let i = 0; i < n; i++) beam(out, 'dress', points[i], points[i + 1], 0.065, 0.07, stone);
    }
  }
}
function battlements(out, ring, baseY, topY, count = 4) {
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const bay = F.length / count;
    fbox(out, 'dress', F, 0, F.length, baseY, baseY + 0.24, -0.36, 0.14, stone);
    for (let j = 0; j < count; j++)
      fbox(
        out,
        'dress',
        F,
        bay * (j + 0.14),
        bay * (j + 0.65),
        baseY + 0.22,
        topY,
        -0.46,
        0.12,
        stone,
      );
  }
}
function westTower(out, lod) {
  const t = tower;
  const z = (t.north + t.south) / 2;
  const x = (t.west + t.east) / 2;
  const ring = [
    [t.west, t.north],
    [t.west, t.south],
    [t.east, t.south],
    [t.east, t.north],
  ];
  block(out, 'roughcast', t.west, t.east, t.north, t.south, base - 0.03, t.ledge, wall);
  block(
    out,
    'metal',
    t.west + 0.2,
    t.east - 0.2,
    t.north + 0.2,
    t.south - 0.2,
    t.ledge - 0.15,
    t.ledge + 0.1,
    copper,
  );
  block(
    out,
    'dress',
    t.west - 0.14,
    t.east + 0.14,
    t.north - 0.14,
    t.south + 0.14,
    t.ledge - 0.35,
    t.ledge,
    stone,
  );
  battlements(out, ring, t.ledge, t.parapet);
  const main = facade([t.west, z], [0, 1]);
  if (lod === 3) {
    const mark = [
      [-0.44, 5.86],
      [-0.26, 5.49],
      [-0.08, 5.86],
    ];
    const R = [
      [0.04, 5.49],
      [0.04, 5.86],
      [0.32, 5.86],
      [0.41, 5.75],
      [0.3, 5.67],
      [0.045, 5.67],
    ];
    for (const letter of [
      mark,
      R,
      [
        [0.25, 5.67],
        [0.42, 5.49],
      ],
    ]) {
      for (let i = 0; i < letter.length - 1; i++)
        beam(
          out,
          'dress',
          main.P(...letter[i], 0.104),
          main.P(...letter[i + 1], 0.104),
          0.048,
          0.036,
          granite,
        );
    }
  }
  lancet(out, main, 0, 0.42, 2.85, 5.02, lod, 0, true);
  for (const u of [-1.04, 1.04]) lancet(out, main, u, 7.05, 1.47, 7.22, lod, 1);
  oculus(out, main, 16.4, 0.97, lod);
  for (const F of [
    main,
    facade([x, t.north], [-1, 0]),
    facade([x, t.south], [1, 0]),
    facade([t.east, z], [0, -1]),
  ]) {
    for (const u of [-1.08, 1.08]) lancet(out, F, u, 19.17, 1.42, 3.13, lod);
    if (lod > 0)
      for (const y of [6.58, 14.71, 18.04, 22.49])
        fbox(out, 'dress', F, -2.5, 2.5, y, y + 0.22, 0.01, 0.22, stone);
  }
  if (lod > 0) {
    for (const s of [-1, 1]) {
      const u = s * 3.25;
      buttress(out, main, u, 20.4, 0.86, lod);
      if (lod > 1)
        for (const y of [8.7, 10.23, 15.3])
          fbox(out, 'dress', main, u - 0.38, u + 0.38, y, y + 0.17, -0.02, 0.38, granite);
    }
  }
  for (const zz of [t.north + 0.61, t.south - 0.61]) {
    const xx = t.west + 0.49;
    const radius = 0.99;
    const segments = lod > 1 ? 10 : 8;
    const polygon = radialRing(0, radius, radius, segments, [xx, zz])
      .map(([px, , pz]) => [px, pz])
      .reverse();
    extrude(out, 'roughcast', polygon, base, t.ledge + 0.2, wall, { top: false });
    battlements(out, polygon, t.ledge + 0.2, t.top - (zz > z ? 0.55 : 0), 1);
    if (lod > 0) {
      const F = facade([xx - radius, zz], [0, 1]);
      for (const y of [7.6, 11.15, 15.1]) lancet(out, F, 0, y, 0.31, 1.32, lod);
    }
  }
  if (lod > 1) {
    const steps = 3;
    for (let i = 0; i < steps; i++)
      block(
        out,
        'granite',
        t.west - 0.42 * (steps - i),
        t.west + 0.03,
        z - 1.76,
        z + 1.76,
        -0.13,
        0.17 * (i + 1),
        granite,
      );
  }
}

function build(out, lod) {
  cathedralBody(out, lod);
  westTower(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'st-john-s-cathedral-hong-kong-model.mjs';
const camera = [-60, 32, -62];
const lookAt = [1, 8, 1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Garden Road’s 1849 Gothic cathedral with a square crenellated west tower, dark green crossed roofs, roughcast walls and granite dressings.',
  camera,
  lookAt,
  sunDirection: [-18, 34, -22],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Only the named cathedral footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'bell-tower-and-north-crossing', position: camera, lookAt },
    { name: 'eastern-lancet-and-granite-buttresses', position: [67, 23, 44], lookAt: [16, 7, 4] },
    { name: 'low-west-tower-and-entrance', position: [-52, 12, 15], lookAt: [-18, 11, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'st-johns-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.54, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Hong Kong Lands Department open spatial data.',
};
