import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  floorSampler,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const terrain = floorSampler(read('terrain-grid.json'));
const { curtain } = read('native-map/baldwins-tower-mapped-curtain.json');
const footprint = outwardRing(map.geometry.outline);
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.93 },
  floor: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.95 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.93 },
};
const stone = rgb('a69e91');
const footing = rgb('8c816e');
const ashlar = rgb('b8b0a1');
const ledge = rgb('aa9d88');
const warm = rgb('ad9e87');
const pale = rgb('b3a68e');
const terrace = rgb('a09684');
const shadow = rgb('514940');
const iron = rgb('645d51');
const x = 3.477;
const z = 3.889;
const top = plan.dimensions.rooflineM;
const merlonH = plan.dimensions.merlonHeightM;
const porch = facade([x, 0], [0, -1]);

function panel(out, slot, f, left, right, y0, y1, tint, depth = 0) {
  quad4(
    out,
    slot,
    f.P(left, y0, depth),
    f.P(right, y0, depth),
    f.P(right, y1, depth),
    f.P(left, y1, depth),
    tint,
  );
}
function openingsWall(out, f, length, bottom, height, holes, lod) {
  let lower = bottom;
  for (const row of holes) {
    const { floor, ceiling, gaps } = row;
    panel(out, 'rubble', f, 0, length, lower, floor, stone);
    let previous = 0;
    for (const gap of gaps) {
      const [left, right, dr] = gap;
      panel(out, 'rubble', f, previous, left, floor, ceiling, stone);
      panel(out, 'dark', f, left, right, floor, ceiling, shadow, -dr);
      if (lod > 0) {
        const l0 = f.P(left, floor),
          l1 = f.P(left, ceiling),
          r0 = f.P(right, floor),
          r1 = f.P(right, ceiling);
        quad4(out, 'trim', l1, l0, f.P(left, floor, -dr), f.P(left, ceiling, -dr), ashlar);
        quad4(out, 'trim', r0, r1, f.P(right, ceiling, -dr), f.P(right, floor, -dr), ledge);
        quad4(out, 'trim', r1, l1, f.P(left, ceiling, -dr), f.P(right, ceiling, -dr), ledge);
        fbox(out, 'trim', f, left - 0.065, right + 0.065, floor - 0.1, floor, -dr, 0.06, pale);
      }
      previous = right;
    }
    panel(out, 'rubble', f, previous, length, floor, ceiling, stone);
    lower = ceiling;
  }
  panel(out, 'rubble', f, 0, length, lower, height, stone);
}

function square(a, b) {
  return outwardRing([
    [-a, -b],
    [-a, b],
    [a, b],
    [a, -b],
  ]);
}

function columnCourses(out, f, offset, dir, lod) {
  if (lod < 2) return;
  const breakHeight = 6.35;
  for (let i = 0; i < 14; i++) {
    const h = 0.37 + i * 0.424;
    const length = dir * (i % 2 === 0 ? 0.32 : 0.51);
    panel(
      out,
      'trim',
      f,
      Math.min(offset, offset + length),
      Math.max(offset, offset + length),
      h,
      Math.min(h + 0.39, breakHeight),
      i % 4 === 1 ? ledge : ashlar,
      0.018,
    );
  }
}

function tower(out, lod) {
  const base = 0.15;
  extrude(out, 'rubble', footprint, -4.76, base, footing, { top: false });
  for (let side = 0; side < footprint.length; side++) {
    const f = wallFace(footprint[side], footprint[(side + 1) % footprint.length]),
      L = f.length;
    const front = f.normal[0] > 0.95;
    const sideStrips = [1.2, 2.63, 4.05, 5.37]
      .filter((u) => u + 0.1 < L - 0.3)
      .map((u) => [u, u + 0.11, 0.19]);
    const lower = side === 2 ? [{ floor: 1.08, ceiling: 2.49, gaps: [[0.94, 1.73, 0.32]] }] : [];
    if (!front) lower.push({ floor: 4.37, ceiling: 5.65, gaps: sideStrips });
    openingsWall(out, f, L, base, 6.46, lower, lod);
    columnCourses(out, f, 0.093, 1, lod);
    columnCourses(out, f, L - 0.093, -1, lod);
    fbox(out, 'trim', f, 0, L, 6.38, 6.55, -0.025, 0.21, ledge);
  }
  const crown = square(x + 0.33, z + 0.33);
  for (let side = 0; side < crown.length; side++) {
    const f = wallFace(crown[side], crown[(side + 1) % crown.length]),
      L = f.length;
    const facingApproach = f.normal[0] > 0.95;
    const upperDoor = facingApproach
      ? [{ floor: 6.71, ceiling: 8.62, gaps: [[2.15, 3.05, 0.7]] }]
      : [];
    openingsWall(out, f, L, 6.46, top, upperDoor, lod);
    fbox(out, 'trim', f, 0, L, top - 0.11, top + 0.073, -0.055, 0.07, ashlar);
    const pitch = L / 6;
    for (let i = 0; i <= 6; i++) {
      const center = i * pitch,
        width = 0.4;
      const a = Math.max(0, center - width),
        b = Math.min(L, center + width);
      fbox(
        out,
        'rubble',
        f,
        a,
        b,
        top + 0.047,
        top + merlonH,
        -0.62,
        0.026,
        i % 2 === 0 ? stone : warm,
      );
      if (lod >= 2)
        fbox(
          out,
          'trim',
          f,
          a - 0.025,
          b + 0.025,
          top + merlonH - 0.08,
          top + merlonH + 0.035,
          -0.66,
          0.066,
          pale,
        );
    }
    if (!facingApproach) {
      const count = lod === 0 ? 3 : 5;
      for (let j = 0; j < count; j++) {
        const c = ((j + 0.5) * L) / count;
        fbox(out, 'trim', f, c - 0.24, c + 0.24, 6.13, 6.44, -0.23, 0.26, ashlar);
        if (lod > 0) {
          fbox(out, 'rubble', f, c - 0.17, c + 0.17, 6.43, 6.7, -0.08, 0.26, ledge);
          fbox(out, 'dark', f, c - 0.13, c + 0.13, 6.72, 7.12, -0.008, 0.013, shadow);
        }
      }
    }
  }
  const roof = square(x, z);
  fan(
    out,
    'floor',
    roof.map(([x, z]) => [x, top - 0.15, z]),
    terrace,
  );
}

function stairFlight(out, f, fromU, toU, fromY, toY, fromD, toD, lod, frontLow) {
  const sign = Math.sign(toU - fromU);
  const hand = fromY < 3.0 ? 0.6 : 0.45;
  const count = [2, 7, 15, 19][lod];
  const previous = (i) => fromU + ((toU - fromU) * i) / count;
  const ascending = (i) => fromY + ((toY - fromY) * i) / count;
  const stairMaterial = lod === 0 ? 'rubble' : 'trim';
  const side = (m, y, d) => f.P(m, y, d);
  const below = (i) => Math.min(ascending(i) - 0.065, frontLow);
  for (let i = 0; i < count; i++) {
    const a = previous(i),
      b = previous(i + 1),
      low = ascending(i),
      high = ascending(i + 1);
    const l = Math.min(a, b),
      r = Math.max(a, b);
    fbox(out, stairMaterial, f, l, r, below(i), high, fromD, toD, i % 5 === 3 ? ledge : ashlar);
    if (lod >= 2)
      fbox(
        out,
        'trim',
        f,
        l - 0.016,
        r + 0.009,
        high - 0.09,
        high + 0.01,
        fromD - 0.009,
        toD + 0.02,
        pale,
      );
  }
  if (lod > 0) {
    const rim = toD + 0.045;
    // Raked masonry cheek follows the actual direction of the stone flight.
    face(
      out,
      'rubble',
      [
        side(fromU, frontLow, rim),
        side(toU, frontLow, rim),
        side(toU, toY + hand, rim),
        side(fromU, fromY + hand, rim),
      ],
      [1, 0, 0],
      stone,
    );
    face(
      out,
      'trim',
      [
        side(fromU, fromY + hand, rim + 0.08),
        side(toU, toY + hand, rim + 0.08),
        side(toU, toY + hand, rim - 0.23),
        side(fromU, fromY + hand, rim - 0.23),
      ],
      up,
      ashlar,
    );
    if (lod === 3) {
      const a = side(fromU + sign * 0.1, fromY + 0.88, rim - 0.09);
      const b = side(toU - sign * 0.1, toY + 0.88, rim - 0.09);
      beam(out, 'dark', a, b, 0.043, 0.052, iron);
      for (let i = 0; i < 4; i++) {
        const t = (i + 0.27) / 3.7;
        const u = fromU + (toU - fromU) * t,
          y = fromY + (toY - fromY) * t;
        beam(
          out,
          'dark',
          side(u, y + hand, rim - 0.09),
          side(u, y + 0.89, rim - 0.09),
          0.046,
          0.046,
          iron,
        );
      }
    }
  }
}

function stairs(out, lod) {
  // Lower approach doubles back onto the upper exterior stair at the doorway landing.
  fbox(out, 'floor', porch, -3.59, 3.52, -0.25, 1.02, 0.02, 2.08, footing);
  stairFlight(out, porch, 3.57, -2.01, 1.03, 6.6, 0.08, 1.58, lod, 0.91);
  fbox(out, 'trim', porch, -2.65, -1.0, 6.39, 6.69, -0.002, 1.6, ashlar);
  stairFlight(out, porch, -1.02, 3.51, 6.7, top - 0.14, 0.38, 1.18, lod, 6.41);
  if (lod > 0) fbox(out, 'trim', porch, 3.09, 3.96, top - 0.24, top - 0.1, 0.29, 1.19, terrace);
}

function curtainWalls(out, lod) {
  const nodes = new Map(curtain.map((row) => [row.node, row.point]));
  const chains = [
    ['3145371418', '306244600', '306244700'],
    ['3145371420', '306244628', '306244539', '3145371416'],
  ];
  for (const chain of chains) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = nodes.get(chain[i]),
        b = nodes.get(chain[i + 1]);
      const f = wallFace(a, b);
      const n = Math.ceil(f.length / 2.45);
      for (let j = 0; j < n; j++) {
        const l = (f.length * j) / n,
          r = (f.length * (j + 1)) / n;
        const q = f.P(l, 0),
          p = f.P(r, 0),
          h = terrain([q[0], q[2]]),
          hh = terrain([p[0], p[2]]);
        const ledge1 = Math.max(2.19, h + 2.46),
          ledge2 = Math.max(2.19, hh + 2.46);
        const A = f.P(l, h - 1.55, 1.16),
          B = f.P(r, hh - 1.55, 1.16),
          C = f.P(r, ledge2, 1.16),
          D = f.P(l, ledge1, 1.16);
        const a2 = f.P(l, h - 1.18, -1.16),
          b2 = f.P(r, hh - 1.18, -1.16),
          c2 = f.P(r, ledge2, -1.16),
          d2 = f.P(l, ledge1, -1.16);
        quad4(out, 'rubble', A, B, C, D, stone);
        quad4(out, 'rubble', b2, a2, d2, c2, j % 4 === 1 ? footing : stone);
        quad4(out, 'floor', D, C, c2, d2, terrace);
        if (j === n - 1) quad4(out, 'rubble', B, b2, c2, C, ledge);
        if ((j + i) % 2 === 0 && (lod > 0 || j % 3 === 0)) {
          const top = (ledge1 + ledge2) / 2;
          fbox(out, 'rubble', f, l + 0.15, r - 0.25, top - 0.27, top + 0.78, 0.48, 1.17, pale);
        }
      }
    }
  }
}

function build(out, lod) {
  tower(out, lod);
  stairs(out, lod);
  curtainWalls(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'baldwins-tower-tsarevets-model.mjs';
const title = 'Baldwin’s Tower at Tsarevets';
const camera = [56, 26, -35],
  lookAt = [3, 5.4, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Reconstructed stone tower of Tsarevets Fortress with a cantilevered crenellated crown, exposed stairs and mapped curtain walls immediately alongside.',
  camera,
  lookAt,
  sunDirection: [53, 52, -41],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: footprint,
    minimumCoverage: 0.9,
    basis: 'The individually named native tower footprint only.',
  },
  embeddedCanonicalGraphs: ['stone_limestone_weathered', 'stone_ashlar', 'stone_drywall'],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'cliff-side-tower-and-stair', position: camera, lookAt },
    {
      name: 'upper-door-landing-and-crenellations',
      position: [25, 13, -12],
      lookAt: [2.5, 7.4, 0],
    },
    { name: 'mapped-curtain-and-tower-roof', position: [-26, 34, 46], lookAt: [2, 5, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'baldwins-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.044, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from a photographer-released Public Domain original, native OpenStreetMap ODbL geometry, and Mapzen open elevation tiles.',
};
