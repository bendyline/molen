/** Main Building No. 1, Nishi-Shinjuku. Native tier rings control the setbacks. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { sphere } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-gsi-grid.json');
const levels = plan.section;
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.84, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.08 },
  concrete: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.26, metallic: 0.16 },
};
const color = Object.fromEntries(
  Object.entries({
    granite: 'cdc9bd',
    light: 'dfdacc',
    fascia: 'c4beb0',
    recess: 'aaa69b',
    steel: 'cdd0cf',
    concrete: 'a8a8a1',
    roof: '989b98',
    glass: '7d8e96',
    glassPale: '93a3a9',
    glassDark: '687e86',
    glassLobby: '718486',
    shadow: '6a706b',
  }).map(([name, value]) => [name, rgb(value)]),
);
const paleWindows = [color.glass, color.glassPale, color.glass, color.glassDark, color.glass];
const lerp = (a, b, t) => a + (b - a) * t;
const winding = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - u * z;
  }, 0);
const outwardRing = (ring) => (winding(ring) < 0 ? ring.toReversed() : ring);
const tierRings = [0, 1].map((i) =>
  frame.features.slice(1 + 3 * i, 4 + 3 * i).map((f) => outwardRing(f.points)),
);

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters,
    v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = field.heightsMeters[j],
    b = field.heightsMeters[j + 1];
  return (
    lerp(lerp(a[i], a[i + 1], u - i), lerp(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function wallSurface(out, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const point = (p, y, depth = 0) => [
    a[0] + (dx * p + dz * depth) / length,
    y,
    a[1] + (dz * p - dx * depth) / length,
  ];
  return {
    length,
    point,
    panel(slot, x0, x1, bottom, top, depth, tint, bottomRight = bottom, topRight = top) {
      face(
        out,
        slot,
        [
          point(x1, bottomRight, depth),
          point(x0, bottom, depth),
          point(x0, top, depth),
          point(x1, topRight, depth),
        ],
        tint,
      );
    },
  };
}

function cap(out, slot, ring, y, tint) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      slot,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Mapped tower roof failed to triangulate');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (id) =>
      Array.from(positions.slice(id * 3, id * 3 + 3)),
    );
    triangle(out, slot, points, tint);
  }
}

function bands(out, edge, heights, depth, lod) {
  for (const high of heights) {
    const rise = lod < 2 ? 0.34 : 0.29;
    edge.panel('granite', 0, edge.length, high - rise, high, depth, color.fascia);
  }
}

function facade(out, edge, bottom, top, lod, index, podium = false) {
  const { length } = edge;
  const stone = length < 2.6 ? color.recess : color.granite;
  edge.panel('granite', 0, length, bottom, top, 0, stone);
  if (length < 2.45) return;

  const columns = Math.max(1, Math.round(length / (lod === 1 ? 5.8 : 3.3)));
  const unit = length / columns;
  if (lod === 0) {
    if (length < 8.7) return;
    const actualColumns = Math.max(1, Math.floor(length / 8.8));
    const actualWidth = length / actualColumns;
    for (let i = 0; i < actualColumns; i++) {
      const x = i * actualWidth;
      edge.panel(
        'glass',
        x + actualWidth * 0.18,
        x + actualWidth * 0.78,
        bottom + 1.45,
        top - 1.4,
        0.027,
        color.glass,
      );
    }
    return;
  }
  const height = top - bottom;
  const floors = Math.max(1, Math.round(height / (podium ? 4.8 : 4.55)));
  const floorRise = height / floors;
  const span = lod === 1 ? 4 : 1;
  for (let i = 0; i < columns; i++) {
    const p = i * unit;
    const narrow = podium ? 0.52 : 0.78;
    const left = p + (unit * (1 - narrow)) / 2,
      right = p + (unit * (1 + narrow)) / 2;
    if (lod > 1 && length > 7.2 && i > 0) {
      const rib = i % 2 === 0 ? 0.21 : 0.12;
      edge.panel('granite', p - rib, p + rib, bottom + 0.03, top - 0.08, 0.21, color.light);
    }
    for (let row = 0; row < floors; row += span) {
      const y = bottom + row * floorRise;
      const a = y + floorRise * (podium ? 0.29 : 0.23);
      const b = Math.min(top - 0.51, y + floorRise * span - (podium ? 1.27 : 0.81));
      if (b <= a) continue;
      const tone = paleWindows[(row * 3 + i + index) % paleWindows.length];
      edge.panel('glass', left, right, a, b, 0.046, tone);
      if (lod === 3 && unit >= 2.85) {
        const m = (left + right) / 2;
        edge.panel('metal', m - 0.052, m + 0.052, a, b, 0.084, color.steel);
      }
    }
  }
  if (lod > 1 && length > 6.4 && height > 20) {
    const heights = Array.from(
      { length: Math.floor((height - 1) / 18) },
      (_, i) => bottom + 18 * (i + 1),
    );
    bands(out, edge, heights, 0.081, lod);
  }
}

function footprintShell(out, ring, bottom, top, lod, root = false) {
  if (lod === 0) ring = groupedCrown(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const edge = wallSurface(out, a, b);
    if (root && lod === 0) {
      const aGround = Math.min(bottom - 0.46, ground(...a) - 0.36);
      const bGround = Math.min(bottom - 0.46, ground(...b) - 0.36);
      edge.panel('granite', 0, edge.length, aGround, top, 0, color.granite, bGround);
      if (edge.length > 9.9)
        edge.panel('glass', edge.length * 0.2, edge.length * 0.8, 6, top - 1.5, 0.04, color.glass);
    } else if (root) {
      const baseA = Math.min(bottom - 0.46, ground(...a) - 0.36);
      const baseB = Math.min(bottom - 0.46, ground(...b) - 0.36);
      edge.panel('concrete', 0, edge.length, baseA, bottom + 0.03, 0.005, color.concrete, baseB);
      facade(out, edge, bottom, levels.podiumTop, lod, i, true);
      facade(out, edge, levels.podiumTop, top, lod, 2 * i);
      if (lod > 0) bands(out, edge, [levels.podiumTop + 0.2, levels.podiumTop + 0.81], 0.18, lod);
    } else {
      facade(out, edge, bottom, top, lod, i);
    }
  }
  cap(out, 'roof', ring, top, color.roof);
}

function groupedCrown(ring) {
  const ends = ring.map((a, i) => {
    const p = ring[(i + ring.length - 1) % ring.length],
      b = ring[(i + 1) % ring.length];
    const ab = [b[0] - a[0], b[1] - a[1]],
      pa = [a[0] - p[0], a[1] - p[1]];
    return Math.abs(ab[0] * pa[1] - ab[1] * pa[0]) > Math.hypot(...ab) * Math.hypot(...pa) * 0.044;
  });
  return ring.filter((_, i) => ends[i]);
}

function crown(out, ring, centerX, centerZ, lod) {
  const edgeRing = groupedCrown(ring);
  const bottom = levels.observatoryTierTop,
    roof = levels.roofHeight;
  const openStart = levels.crownOpenBottom,
    openEnd = levels.crownOpenTop;
  const [x, z] = [centerX, centerZ];
  for (let i = 0; i < edgeRing.length; i++) {
    const a = edgeRing[i],
      b = edgeRing[(i + 1) % edgeRing.length];
    const edge = wallSurface(out, a, b);
    facade(out, edge, bottom, openStart, lod, i);
    if (edge.length < 11.5) {
      facade(out, edge, openStart, roof, lod, i);
      continue;
    }
    const pier = Math.min(2.65, edge.length * 0.18),
      far = edge.length - pier;
    edge.panel('granite', 0, pier, openStart, roof, 0, color.light);
    edge.panel('granite', far, edge.length, openStart, roof, 0, color.light);
    edge.panel('granite', pier, far, openEnd, roof, 0, color.fascia);
    edge.panel('granite', pier, far, openStart - 0.35, openStart, -0.13, color.recess);
    const p = edge.point;
    for (const [t, flip] of [
      [pier, false],
      [far, true],
    ]) {
      const wall = [
        p(t, openStart, 0),
        p(t, openStart, -2.03),
        p(t, openEnd, -2.03),
        p(t, openEnd, 0),
      ];
      face(out, 'metal', flip ? wall.toReversed() : wall, color.steel);
    }
    face(
      out,
      'metal',
      [p(pier, openEnd, 0), p(far, openEnd, 0), p(far, openEnd, -2.03), p(pier, openEnd, -2.03)],
      color.recess,
    );
    if (lod > 0) {
      for (const y of [openStart + 1.18, openEnd - 0.36])
        edge.panel('metal', pier, far, y, y + 0.54, -0.77, color.steel);
      const at = (pier + far) / 2;
      for (const v of [at - 0.64, at + 0.64])
        edge.panel(
          'metal',
          v - 0.16,
          v + 0.16,
          openStart + 1.35,
          openEnd - 0.18,
          -0.86,
          color.recess,
        );
    }
  }
  box(
    out,
    'metal',
    [x - 2.9, openStart - 0.31, z - 2.82],
    [x + 2.9, openEnd + 0.18, z + 2.82],
    color.concrete,
  );
  cap(out, 'roof', edgeRing, roof, color.roof);
  if (lod === 0) return;
  for (const [dx, dz, h, r] of [
    [4.2, -4.8, 226, 1.32],
    [-4.5, -4.25, 228.4, 1.46],
    [-4.65, 4.64, 230.7, 1.37],
    [5.0, 4.58, 228.8, 1.46],
  ]) {
    box(
      out,
      'metal',
      [x + dx - 0.16, openStart, z + dz - 0.16],
      [x + dx + 0.16, openEnd - 0.13, z + dz + 0.16],
      color.recess,
    );
    sphere(
      out,
      'metal',
      [x + dx, h, z + dz],
      [r * 1.42, 1.38, r * 0.84],
      color.steel,
      lod > 1 ? 10 : 6,
      lod > 1 ? 7 : 4,
    );
  }
  if (lod > 1) {
    box(out, 'metal', [x - 2.6, roof - 0.03, z - 2.65], [x + 2.4, roof, z + 2.1], color.steel);
    for (const sign of [-1, 1])
      tube(
        out,
        'metal',
        [x + sign * 4.1, roof - 4.7, z],
        [x + sign * 4.1, roof - 0.21, z],
        0.096,
        color.steel,
        5,
      );
  }
}

function lobby(out, lod) {
  const y = levels.terraceFloor;
  const z = 16.52;
  const spans = [
    [-14.57, -5.77],
    [-4.72, 4.73],
    [5.78, 14.54],
  ];
  for (const [left, right] of spans) {
    box(out, 'metal', [left, y - 0.02, z - 0.44], [right, 9.48, z + 0.42], color.recess);
    const width = (right - left) / (lod > 1 ? 6 : 3);
    for (let i = 0; i < (lod > 1 ? 6 : 3); i++) {
      const x = left + i * width;
      face(
        out,
        'glass',
        [
          [x, y + 0.21, z + 0.43],
          [x + width - 0.12, y + 0.21, z + 0.43],
          [x + width - 0.12, 8.65, z + 0.43],
          [x, 8.65, z + 0.43],
        ],
        color.glassLobby,
      );
    }
  }
  for (const x of [-15.08, -5.25, 5.24, 15.06]) {
    box(out, 'granite', [x - 0.36, y - 0.1, z - 0.58], [x + 0.36, 10.12, z + 1.01], color.light);
  }
  box(out, 'granite', [-15.76, 9.53, z - 0.64], [15.76, 10.66, z + 1.61], color.fascia);
  if (lod > 0) {
    box(out, 'concrete', [-15.97, y - 0.38, z - 0.39], [15.97, y + 0.01, z + 1.92], color.concrete);
    box(out, 'granite', [-15.77, 10.36, z + 1.58], [15.77, 10.49, z + 1.69], color.light);
  }
}

function build(out, lod) {
  footprintShell(
    out,
    outwardRing(frame.geometry.outline),
    levels.terraceFloor,
    levels.baseTop,
    lod,
    true,
  );
  for (const [lower, middle, upper] of tierRings) {
    footprintShell(out, lower, levels.baseTop - 0.035, levels.firstTierTop, lod);
    footprintShell(out, middle, levels.firstTierTop - 0.025, levels.observatoryTierTop, lod);
    const [x, z] = [0, 1].map((i) => upper.reduce((sum, p) => sum + p[i], 0) / upper.length);
    crown(out, upper, x, z, lod);
  }
  if (lod > 0) lobby(out, lod);
}
export const tochoSkyline = (out) => build(out, 0);
export const tochoDistrict = (out) => build(out, 1);
export const tochoStreet = (out) => build(out, 2);
export const tochoCloseup = (out) => build(out, 3);

const recipe = 'tokyo-metropolitan-government-model.mjs';
const camera = [191, 152, 344],
  lookAt = [0, 116, 0];
export const tochoModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: tochoCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.995,
    basis: 'Named Main Building No. 1 footprint way 89877471.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Kenzo Tange’s Main Building No. 1 in Nishi-Shinjuku, with its broad granite base, closely gridded facade, two tall stepped towers and open crowns.',
  camera,
  lookAt,
  sunDirection: [-72, 151, 117],
  portableGroundY: -0.14,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 2.0,
    cameraYaw: 0.29,
    groundY: 0,
    focus: { center: [0, 88, 0] },
    terrain: {
      descriptor: 'terrain-gsi-review.terrain.json',
      heightmap: 'terrain-gsi-review.height.png',
    },
  },
  qaCameras: [
    { name: 'main-towers-from-the-civic-plaza', position: camera, lookAt },
    { name: 'stone-entrance-and-window-grid', position: [36, 21, 79], lookAt: [0, 24, 14] },
    { name: 'open-crowns-and-mechanical-frames', position: [56, 253, 134], lookAt: [1, 226, -1] },
    { name: 'west-towers-and-rear-setbacks', position: [-183, 171, -317], lookAt: [0, 123, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `tocho-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'tochoSkyline',
    errorMeters: 1.89,
    surfaces,
    authoredLevels: {
      district: { export: 'tochoDistrict', errorMeters: 0.84, surfaces },
      street: { export: 'tochoStreet', errorMeters: 0.34, surfaces },
      closeup: { export: 'tochoCloseup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry with cleared CC0 source photographs. Native mapped footprint and tower parts are ODbL 1.0. Created by editing GSI Tiles (Fundamental Geospatial Data DEM5A elevation). Attribution is recorded in the frozen field.',
};
