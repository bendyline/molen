import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.89 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const wall = rgb('cec5ae');
const warm = rgb('b8ab93');
const ash = rgb('a49680');
const ivory = rgb('e1d9c6');
const cap = rgb('cfc7b3');
const bronze = rgb('736859');
const shade = rgb('46413a');
const roof = rgb('a49d8d');
const center = 0.6;
const galleryRear = -98;
const entryFloor = 7.9;
const middleFloor = 15.5;
const roofLine = 22.9;

function box(out, slot, x0, x1, z0, z1, y0, y1, color, bottom = false) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom });
}

function clipAtGallery(ring) {
  const clipped = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const aInside = a[1] >= galleryRear;
    const bInside = b[1] >= galleryRear;
    if (aInside) clipped.push(a);
    if (aInside === bInside) continue;
    const t = (galleryRear - a[1]) / (b[1] - a[1]);
    clipped.push([a[0] + t * (b[0] - a[0]), galleryRear]);
  }
  return clipped;
}

const court = frame.geometry.holes[0];
const body = clipAtGallery(frame.geometry.outline);

function courtyardRoof(out, y) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      'roof',
      'palette:#ffffff',
      body,
      [court],
      () => y,
      [0, 1, 0],
      (p) => p,
      roof,
    )
  )
    throw new Error('Cannot triangulate the palace roof around the courtyard');
  const mesh = builder.finalize();
  const point = (index) => Array.from(mesh.positions.subarray(index * 3, index * 3 + 3));
  for (let i = 0; i < mesh.indices.length; i += 3)
    tri(
      out,
      'roof',
      point(mesh.indices[i]),
      point(mesh.indices[i + 1]),
      point(mesh.indices[i + 2]),
      roof,
    );
}

function rearWall(out, ring, detail) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (a[1] <= galleryRear && b[1] <= galleryRear) continue;
    const f = wallFace(a, b);
    if (f.length < 6.2) continue;
    const bays = Math.max(1, Math.round(f.length / (detail === 1 ? 10 : 6.9)));
    const pitch = f.length / bays;
    for (let j = 0; j < bays; j++) {
      const u = pitch * (0.5 + j);
      for (const [y, height] of [
        [5.7, 4.65],
        [12.25, 3.1],
      ]) {
        if (detail === 1 && y < 10) continue;
        const framed = detail === 3 || (detail === 2 && y > 10);
        opening(out, f, u, y, 1.95, height, {
          head: 'flat',
          glassSlot: 'dark',
          frameSlot: 'stone',
          glass: shade,
          frame: cap,
          frameWidth: framed ? 0.18 : 0,
          frameDepth: 0.1,
          sill: framed,
          mullions: detail === 3 ? 1 : 0,
          transoms: detail === 3 ? 1 : 0,
        });
      }
    }
    if (detail >= 2) fbox(out, 'stone', f, 0.08, f.length - 0.08, 17.47, 17.94, -0.08, 0.22, cap);
    if (detail >= 2)
      fbox(out, 'plaster', f, 0.08, f.length - 0.08, 11.15, 11.36, -0.02, 0.12, warm);
  }
}

function rearRanges(out, detail) {
  if (detail >= 1) extrude(out, 'stone', body, -6.5, 4.3, ash, { holes: [court], top: false });
  extrude(out, 'plaster', body, detail >= 1 ? 4.3 : -6.5, 17.9, wall, {
    holes: [court],
    top: false,
  });
  courtyardRoof(out, 17.9);
  if (detail >= 1) {
    extrude(out, 'stone', body, 17.9, 18.55, cap, { holes: [court], top: false });
    rearWall(out, outwardRing(body), detail);
    rearWall(out, outwardRing(court).reverse(), detail);
  }
  // The north state apartments rise behind the portico. The court remains open to the sky.
  box(out, 'plaster', -39.7, 40.7, -98.4, -83.8, 17.85, 22.38, wall);
  box(out, 'roof', -39.7, 40.7, -98.4, -83.8, 22.38, 22.59, roof);
}

const columns = [-39.15, -32.3, -25.0, -17.65, -10.35, -3.05, 4.25, 11.55, 18.85, 26.1, 33.4, 40.1];

function column(out, x, z, y0, y1, detail, pier = false) {
  const radius = y0 < 10 ? 0.63 : 0.53;
  if (detail === 0) {
    box(out, 'stone', x - radius, x + radius, z - radius, z + radius, y0, y1, cap);
    return;
  }
  const half = radius * 1.35;
  if (detail >= 2) box(out, 'stone', x - half, x + half, z - half, z + half, y0, y0 + 0.28, warm);
  box(out, 'stone', x - half, x + half, z - half, z + half, y1 - 0.31, y1, ivory, detail >= 2);
  if (pier) {
    box(out, 'plaster', x - radius, x + radius, z - radius, z + radius, y0 + 0.28, y1 - 0.31, wall);
    return;
  }
  const sides = [4, 6, 12, 18][detail];
  const rings = [
    [y0 + 0.26, radius * 1.03],
    [y0 + 0.53, radius],
    [y1 - 0.89, radius * 0.78],
    [y1 - 0.31, radius * 1.24],
  ];
  if (detail >= 2) {
    rings.splice(2, 0, [y0 + 0.78, radius * 0.94]);
    rings.splice(-1, 0, [y1 - 0.65, radius * 0.96]);
  }
  lathe(
    out,
    'stone',
    [x, z],
    rings.map(([y, r]) => [y, r, r]),
    sides,
    cap,
    { capTop: false },
  );
}

function rail(out, x0, x1, z, y0, y1, detail, span = 0.83) {
  const height = 0.96;
  for (const lift of [0.065, height]) {
    const width = lift === height ? 0.2 : 0.27;
    if (y0 === y1)
      box(
        out,
        'stone',
        x0,
        x1,
        z - width / 2,
        z + width / 2,
        y0 + lift - 0.06,
        y0 + lift + 0.06,
        cap,
      );
    else beam(out, 'stone', [x0, y0 + lift, z], [x1, y1 + lift, z], width, 0.15, cap);
  }
  const count = Math.max(1, Math.floor((x1 - x0) / (detail === 1 ? 3.5 : span)));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t;
    if (detail === 3)
      lathe(
        out,
        'stone',
        [x, z],
        [
          [y + 0.12, 0.118, 0.118],
          [y + 0.35, 0.141, 0.141],
          [y + 0.65, 0.075, 0.075],
          [y + 0.92, 0.1, 0.1],
        ],
        4,
        cap,
        { capTop: false },
      );
    else box(out, 'stone', x - 0.1, x + 0.1, z - 0.105, z + 0.105, y + 0.12, y + 0.91, warm);
  }
}

function upperGallery(out, detail) {
  for (const y of [entryFloor, middleFloor, roofLine]) {
    const upper = y === roofLine;
    box(out, 'stone', -40.25, 41.15, -112.75, -97.95, y - 0.78, y, cap, true);
    box(out, 'stone', -18.52, 19.72, -114.65, -111.9, y - 0.79, y, ivory, true);
    if (detail >= 1) {
      box(out, 'stone', -40.85, 41.65, -113.11, -97.62, y - 0.48, y - 0.25, ivory, true);
      box(out, 'stone', -18.75, 19.95, -114.95, -112.65, y - 0.48, y - 0.25, ivory, true);
    }
    if (detail === 0 || y === entryFloor) continue;
    for (let i = 0; i < columns.length - 1; i++) {
      if (upper && i >= 3 && i <= 7) continue;
      const z = i >= 3 && i <= 7 ? -114.12 : -112.25;
      rail(out, columns[i] + 0.7, columns[i + 1] - 0.7, z, y, y, detail);
    }
  }
  for (const [y0, y1] of [
    [entryFloor, middleFloor - 0.76],
    [middleFloor, roofLine - 0.76],
  ]) {
    columns.forEach((x, i) =>
      column(
        out,
        x,
        i >= 3 && i <= 8 ? -113.52 : -111.61,
        y0,
        y1,
        detail,
        i === 0 || i === columns.length - 1,
      ),
    );
    for (const x of [columns[0], columns.at(-1)]) column(out, x, -104.45, y0, y1, detail, true);
  }
  const f = facade([center, -99.94], [-1, 0]);
  box(out, 'plaster', -39.8, 41, -100, -97.7, entryFloor, 22.4, warm);
  for (let i = 0; detail >= 1 && i < columns.length - 1; i++) {
    const u = center - (columns[i] + columns[i + 1]) / 2;
    for (const y of [entryFloor + 0.2, middleFloor + 1.35])
      opening(out, f, u, y, 2.45, 3.86, {
        glassSlot: 'dark',
        frameSlot: 'stone',
        glass: shade,
        frame: cap,
        frameWidth: detail >= 2 ? 0.17 : 0,
        mullions: detail === 3 ? 1 : 0,
      });
  }
}

function pediment(out, detail) {
  const front = -114.52,
    back = -109.3,
    left = -19.2,
    right = 20.4;
  const y = roofLine + 0.14,
    apex = 27.4;
  const a = [left, y, front],
    b = [right, y, front],
    c = [center, apex, front];
  const d = [left, y, back],
    e = [right, y, back],
    f = [center, apex, back];
  tri(out, 'plaster', b, a, c, warm);
  tri(out, 'plaster', d, e, f, warm);
  quad4(out, 'roof', a, d, f, c, roof);
  quad4(out, 'roof', b, c, f, e, roof);
  box(
    out,
    'stone',
    left - 0.37,
    right + 0.37,
    front - 0.36,
    back + 0.16,
    roofLine - 0.015,
    y + 0.35,
    ivory,
    true,
  );
  for (const [from, to] of [
    [a, c],
    [c, b],
  ]) {
    const z = front - 0.11;
    beam(out, 'stone', [from[0], from[1] + 0.13, z], [to[0], to[1] + 0.13, z], 0.41, 0.49, ivory);
  }
  if (detail < 2) return;
  const seal = facade([center, front - 0.031], [-1, 0]);
  opening(out, seal, 0, y + 0.72, 1.48, 1.9, {
    head: 'round',
    glassSlot: 'stone',
    frameSlot: 'stone',
    glass: warm,
    frame: ivory,
    frameWidth: 0.13,
    frameDepth: 0.14,
    sill: false,
  });
  for (const sign of [-1, 1])
    beam(
      out,
      'stone',
      [center + sign * 0.51, y + 0.76, front - 0.11],
      [center + sign * 1.77, y + 1.23, front - 0.12],
      0.18,
      0.19,
      cap,
    );
}

function podium(out, detail) {
  const z = -119.7,
    f = facade([center, z], [-1, 0]);
  const stairsGround = 0.54;
  const span = 26.3,
    half = 1.92,
    spring = 3.78,
    lintel = entryFloor - 0.29;
  const sides = [4, 6, 10, 14][detail];
  let cursor = -span / 2;
  const deckBack = -111.58;
  for (const u of [-7.15, 0, 7.15]) {
    fbox(out, 'stone', f, cursor, u - half, -0.85, lintel, z - deckBack, 0, warm);
    const arch = roundArch(half, sides);
    for (let i = 0; i < arch.length - 1; i++) {
      const [u0, h0] = arch[i],
        [u1, h1] = arch[i + 1];
      quad4(
        out,
        'stone',
        f.P(u + u0, spring + h0),
        f.P(u + u1, spring + h1),
        f.P(u + u1, lintel),
        f.P(u + u0, lintel),
        warm,
      );
      quad4(
        out,
        'stone',
        f.P(u + u1, spring + h1),
        f.P(u + u0, spring + h0),
        f.P(u + u0, spring + h0, -1.55),
        f.P(u + u1, spring + h1, -1.55),
        ash,
      );
    }
    // The open arch has deep jambs and a dark back, behind the stone face.
    for (const sign of [-1, 1]) {
      const x = u + sign * half;
      const jamb = [
        f.P(x, stairsGround, 0),
        f.P(x, stairsGround, -1.55),
        f.P(x, spring, -1.55),
        f.P(x, spring, 0),
      ];
      quad4(out, 'stone', ...(sign > 0 ? jamb.reverse() : jamb), ash);
    }
    cursor = u + half;
  }
  fbox(out, 'stone', f, cursor, span / 2, -0.85, lintel, z - deckBack, 0, warm);
  fbox(out, 'dark', f, -span / 2, span / 2, stairsGround - 0.04, lintel, -3.68, -3.54, shade);
  fbox(
    out,
    'stone',
    f,
    -span / 2 - 0.17,
    span / 2 + 0.17,
    lintel,
    entryFloor,
    z - deckBack + 0.05,
    0.28,
    cap,
    { bottom: true },
  );
  if (detail >= 1) {
    rail(out, center - span / 2, center + span / 2, z - 0.06, entryFloor, entryFloor, detail);
    for (const u of [-7.15, 0, 7.15])
      opening(out, f, u, stairsGround, half * 2, spring + half - stairsGround, {
        head: 'round',
        glassSlot: 'dark',
        frameSlot: 'stone',
        glass: shade,
        frame: cap,
        frameWidth: 0.18,
        frameDepth: 0.16,
        d: -1.58,
        sill: false,
      });
  }
}

function stairFlight(out, start, end, y0, y1, z0, z1, detail, side) {
  const left = Math.min(start, end),
    right = Math.max(start, end);
  const low = side > 0 ? y0 : y1,
    high = side > 0 ? y1 : y0;
  if (detail === 0)
    quad4(
      out,
      'stone',
      [left, low, z1],
      [right, high, z1],
      [right, high, z0],
      [left, low, z0],
      cap,
    );
  const steps = [0, 6, 17, 31][detail];
  for (let i = 0; i < steps; i++) {
    const x0 = start + ((end - start) * i) / steps;
    const x1 = start + ((end - start) * (i + 1)) / steps;
    box(
      out,
      'stone',
      Math.min(x0, x1),
      Math.max(x0, x1),
      z0 + 0.18,
      z1,
      -1.52,
      y0 + ((y1 - y0) * (i + 1)) / steps,
      i % 2 === 0 ? cap : warm,
    );
  }
  const face = [
    [right, -0.72, z0],
    [left, -0.72, z0],
    [left, low + 0.18, z0],
    [right, high + 0.18, z0],
  ];
  quad4(out, 'stone', ...face, warm);
  if (detail >= 1) rail(out, left, right, z0 + 0.12, low + 0.15, high + 0.15, detail);
}

function returnStairs(out, detail) {
  for (const sign of [-1, 1]) {
    const inner = center + sign * 12.95,
      outer = center + sign * 32.6;
    const innerEnd = center + sign * 11.95;
    stairFlight(out, inner, outer, 0.53, 4.23, -120.5, -116.02, detail, sign);
    stairFlight(out, outer, innerEnd, 4.23, entryFloor, -116.02, -111.54, detail, -sign);
    const a = outer,
      b = outer + sign * 4.2;
    box(out, 'stone', Math.min(a, b), Math.max(a, b), -120.5, -111.53, -1.5, 4.23, warm);
    if (detail >= 1) {
      rail(out, Math.min(a, b), Math.max(a, b), -120.41, 4.23, 4.23, detail);
      const x = (a + b) / 2;
      opening(out, facade([x, -120.51], [-1, 0]), 0, 0.3, 1.76, 2.85, {
        glassSlot: 'dark',
        frameSlot: 'stone',
        glass: shade,
        frame: cap,
        frameWidth: 0.18,
        sill: false,
      });
    }
  }
}

function build(out, detail) {
  rearRanges(out, detail);
  for (const [a, b] of [
    [-40.0, -35.5],
    [35.9, 41.05],
  ]) {
    box(out, 'stone', a, b, -112.55, -98, -3.6, entryFloor - 0.75, warm);
  }
  box(out, 'stone', -35.55, 36.0, -111.57, -98, -3.6, entryFloor - 0.75, warm);
  podium(out, detail);
  returnStairs(out, detail);
  upperGallery(out, detail);
  pediment(out, detail);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'falaknuma-palace-model.mjs';
const camera = [106, 121, -219],
  lookAt = [-28, 11, -5];
const facadeCamera = [0.6, 9.5, -192],
  facadeTarget = [0.6, 12.1, -109];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Falaknuma Palace in Hyderabad, with a two-storey classical portico above twin north stairs and connected ranges around an open court.',
  camera,
  lookAt,
  sunDirection: [-48, 71, -58],
  mediumFiContext: {
    scale: 1.16,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.88,
    basis: 'Native palace envelope with the open courtyard preserved in the model.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-classical-front', position: facadeCamera, lookAt: facadeTarget },
    { name: 'north-stairs-and-colonnades', position: [35, 9.4, -153], lookAt: [3, 10, -114] },
    { name: 'open-court-and-ranges', position: [-130, 113, 144], lookAt: [-25, 8, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'falaknuma-palace-' + reviewLod,
    position: facadeCamera,
    lookAt: facadeTarget,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.66, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
};
