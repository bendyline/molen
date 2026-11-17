/** Two Bay Lake hotel towers linked by the Sky Way Bridge. All lengths are metres. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireGeometry = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireGeometry('earcut');
const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const [mainOutline, bayOutline, bridgeOutline] = frame.geometry.polygons;
const { main, bayLake } = plan;
const surfaces = {
  mass: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  slabs: { slot: 'foundation', graph: 'stone_travertine', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_panel', roughness: 0.95, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51, metallic: 0.13 },
};
const tint = Object.fromEntries(
  Object.entries({
    ivory: 'ddd3bd',
    cream: 'eee8d8',
    pier: 'cfc3a6',
    pale: 'd5d0c1',
    roof: 'b0a79a',
    dark: '49585b',
    pane: '516c74',
    cyan: '5e7981',
    shadow: '354348',
    guard: '9da9a5',
    steel: '747875',
    terrace: 'c4bca9',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const scale = (color, factor) => color.map((value) => Math.min(1, value * factor));
const corner = ([x, z], y) => [x, y, z];

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => ring[j]);
    const cross = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    triangle(
      out,
      slot,
      (cross > 0 ? [a, b, c] : [a, c, b]).map((p) => corner(p, y)),
      color,
    );
  }
}

function signedArea(ring) {
  return ring.reduce((area, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return area + a[0] * b[1] - a[1] * b[0];
  }, 0);
}

function insetRing(ring, amount) {
  const winding = Math.sign(signedArea(ring));
  return ring.map(([x, z], i) => {
    const a = ring[(i + ring.length - 1) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [
      x - ((b[1] - a[1]) / length) * amount * winding,
      z + ((b[0] - a[0]) / length) * amount * winding,
    ];
  });
}

function boundary(out, slot, ring, y0, y1, color) {
  const signed = signedArea(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const points = [corner(a, y0), corner(a, y1), corner(b, y1), corner(b, y0)];
    face(out, slot, signed > 0 ? points : points.reverse(), color);
  }
}

function slab(out, slot, ring, y0, y1, color) {
  boundary(out, slot, ring, y0, y1, color);
  cap(out, slot, ring, y1, color);
}

const zNorth = main.centerZ - main.length / 2;
const zSouth = main.centerZ + main.length / 2;
const baseHalfWidth = main.width / 2;
const sideX = (y) => mix(baseHalfWidth, main.roofHalfWidth, Math.max(0, y) / main.roomTopY);

function mainFacade(out, lod) {
  const roomStart = main.roomSlabY;
  const roomEnd = main.roomTopY;
  const bands = lod === 0 ? 6 : 11;
  const bayCount = [2, 5, 14, 26][lod];
  const endTrim = 2.65;
  for (const direction of [-1, 1]) {
    const point = (y, z, offset = 0) => [direction * (sideX(y) + offset), y, z];
    const wall = (slot, y0, y1, z0, z1, color, offset = 0) => {
      const coords = [
        point(y0, z0, offset),
        point(y1, z0, offset),
        point(y1, z1, offset),
        point(y0, z1, offset),
      ];
      face(out, slot, direction > 0 ? coords : coords.reverse(), color);
    };
    const start = zNorth + endTrim;
    const finish = zSouth - endTrim;
    wall('mass', -0.4, 7.6, start, finish, tint.ivory);
    wall('glass', 7.6, roomStart, start, finish, tint.shadow, -0.74);
    for (let level = 0; level < bands; level++) {
      const y = mix(roomStart, roomEnd, level / bands);
      const next = mix(roomStart, roomEnd, (level + 1) / bands);
      wall('slabs', y, y + 0.66, start, finish, tint.cream, 0.08);
      wall('glass', y + 0.67, next, start, finish, tint.dark, -0.52);
      if (lod > 0) {
        wall('steel', y + 0.7, y + 1.48, start, finish, tint.guard, -0.13);
        for (let i = 1; i < bayCount; i++) {
          const z = mix(start, finish, i / bayCount);
          wall(
            'glass',
            y + 1.5,
            next - 0.21,
            z + 0.08,
            z + (finish - start) / bayCount - 0.08,
            scale(i % 3 === 0 ? tint.cyan : tint.pane, 0.81 + 0.05 * ((i + level) % 4)),
            -0.44,
          );
          wall('mass', y + 0.66, next, z - 0.077, z + 0.077, tint.cream, -0.39);
        }
      }
    }
    const numberOfFins = lod === 0 ? 4 : 14;
    for (let i = 0; i <= numberOfFins; i++) {
      const z = mix(zNorth + 0.38, zSouth - 0.38, i / numberOfFins);
      const depth = i === 0 || i === numberOfFins ? 1.05 : 0.47;
      const lower = [direction * (baseHalfWidth - 0.16), 0, z];
      const upper = [direction * (main.roofHalfWidth + 0.21), roomEnd + 0.3, z];
      beam(out, 'mass', lower, upper, depth, depth * 1.85, tint.pier);
    }
    if (lod > 0) {
      for (let i = 0; i < 9; i++) {
        const a = mix(zNorth + 5, zSouth - 5, i / 9);
        const b = mix(zNorth + 5, zSouth - 5, (i + 1) / 9);
        wall(
          'glass',
          1.05,
          5.6,
          a + 0.44,
          b - 0.44,
          scale(tint.pane, 0.85 + 0.06 * (i % 3)),
          0.035,
        );
      }
    }
  }
  box(out, 'mass', [-baseHalfWidth, -0.55, zNorth], [baseHalfWidth, 6.45, zSouth], tint.ivory);
  box(
    out,
    'roof',
    [-main.roofHalfWidth - 0.4, 50.25, zNorth - 0.34],
    [main.roofHalfWidth + 0.4, 51.0, zSouth + 0.34],
    tint.roof,
  );
  box(out, 'mass', [-16.8, 50.85, -23.0], [15.7, 55.17, 29.3], tint.pale);
  box(out, 'glass', [-16.88, 51.85, -23.08], [15.78, 54.22, 29.38], tint.pane);
  box(out, 'slabs', [-17.3, 54.43, -23.65], [16.1, 55.3, 29.8], tint.cream);
  box(out, 'roof', [-13.7, 55.28, -21.4], [12.55, main.height, 27.6], tint.pale);
  if (lod > 0)
    for (let z = -22; z < 29; z += 4.6)
      for (const x of [-16.87, 15.75])
        box(out, 'mass', [x - 0.068, 51.84, z], [x + 0.068, 54.44, z + 0.22], tint.cream);
}

function mainEnds(out, lod) {
  for (const direction of [-1, 1]) {
    const za = direction < 0 ? zNorth - 0.1 : zSouth - 0.8;
    const zb = za + 0.93;
    const limits = [-sideX(7.3) + 1.15, -18.2, -11.3, -8.0, -1.3, sideX(7.3) - 1.15];
    for (let i = 0; i < limits.length - 1; i += 2)
      box(out, 'mass', [limits[i], 6.42, za], [limits[i + 1], 16.86, zb], tint.ivory);
    const front = direction < 0 ? za - 0.01 : zb + 0.01;
    const endPanel = (slot, points, color) => {
      const map = points.map(([x, y]) => [x, y, front]);
      face(out, slot, direction > 0 ? map : map.reverse(), color);
    };
    const base = 17.0;
    const top = 49.9;
    endPanel(
      'glass',
      [
        [-sideX(base), base],
        [sideX(base), base],
        [sideX(top), top],
        [-sideX(top), top],
      ],
      tint.shadow,
    );
    for (const edge of [-1, 1]) {
      const inner = edge * 12.7;
      const points = [
        [edge * (sideX(base) + 0.13), base],
        [inner, base],
        [inner, top],
        [edge * (sideX(top) + 0.15), top],
      ];
      endPanel('mass', edge > 0 ? points.reverse() : points, tint.ivory);
    }
    if (lod > 0) {
      for (let x = -10.7; x < 11.5; x += 4.3)
        beam(
          out,
          'mass',
          [x, base, front + direction * 0.065],
          [x, top, front + direction * 0.065],
          0.32,
          0.54,
          tint.pier,
        );
      for (let y = 22.2; y < 49.5; y += 5.42)
        box(out, 'steel', [-12.64, y, front - 0.105], [12.64, y + 0.27, front + 0.105], tint.guard);
    }
  }
  for (const axis of frame.geometry.centerlines) {
    const x = axis.reduce((sum, p) => sum + p[0], 0) / axis.length;
    const railY = main.monorailY;
    box(
      out,
      'slabs',
      [x - 0.43, railY - 1.26, zNorth - 31],
      [x + 0.43, railY - 0.26, zSouth + 28],
      tint.pale,
    );
    box(
      out,
      'steel',
      [x - 0.21, railY - 0.29, zNorth - 31],
      [x + 0.21, railY, zSouth + 28],
      tint.steel,
    );
    for (const z of [zNorth - 24, zSouth + 20])
      box(out, 'mass', [x - 0.55, -0.4, z - 0.65], [x + 0.55, railY - 1.02, z + 0.65], tint.pier);
  }
  box(out, 'slabs', [-1.35, 10.25, zNorth + 0.55], [9.95, 11.8, zSouth - 0.6], tint.terrace);
  box(
    out,
    'mass',
    [15.8, 7.2, zNorth - 4.05],
    [27.0, main.bridgeY - 0.025, zNorth + 7.5],
    tint.ivory,
  );
}

function spacing(ring, step) {
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const count = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    return Array.from({ length: count }, (_, j) => lerp(a, b, j / count));
  });
}

function bayTower(out, lod) {
  const full = bayLake.outerArc.concat(bayLake.innerArc);
  const sparse = bayLake.outerArc
    .filter((_, i) => i % 2 === 0 || i === bayLake.outerArc.length - 1)
    .concat(bayLake.innerArc.filter((_, i) => i % 2 === 0 || i === bayLake.innerArc.length - 1));
  const ring = lod < 2 ? sparse : full;
  const steps = lod < 2 ? ring : spacing(ring, lod === 2 ? 8.2 : 4.45);
  const top = bayLake.roofDeckY;
  const inset = insetRing(ring, lod ? 0.84 : 0.28);
  slab(out, 'mass', ring, -0.63, 2.0, tint.ivory);
  boundary(out, 'glass', inset, 2.0, top, tint.pane);
  cap(out, 'roof', ring, top, tint.roof);
  const floorStep = [5, 2, 1, 1][lod];
  for (let level = 1; level <= bayLake.floors; level += floorStep) {
    const y = 0.63 + level * bayLake.floorInterval;
    boundary(out, 'slabs', ring, y, y + 0.5, tint.cream);
    if (lod > 1) boundary(out, 'steel', ring, y + 0.5, y + 1.29, tint.guard);
  }
  if (lod > 0) {
    const piers = insetRing(steps, 0.54);
    const bars = insetRing(steps, 0.76);
    const forward = signedArea(steps) > 0;
    for (let i = 0; i < steps.length; i++) {
      const p = piers[i];
      const w = lod === 1 ? 0.21 : 0.14;
      box(out, 'mass', [p[0] - w, 2.0, p[1] - w], [p[0] + w, top, p[1] + w], tint.pale);
      if (lod > 1 && i % 3 !== 1) {
        const q = lerp(bars[i], bars[(i + 1) % steps.length], 0.5);
        box(
          out,
          'steel',
          [q[0] - 0.048, 4.07, q[1] - 0.048],
          [q[0] + 0.048, top, q[1] + 0.048],
          tint.guard,
        );
      }
      if (lod > 1 && i % 5 === 2) {
        const p = bars[i];
        const q = bars[(i + 1) % steps.length];
        const a = lerp(p, q, 0.18);
        const b = lerp(p, q, 0.79);
        const pane = [corner(a, 3.0), corner(a, top - 0.38), corner(b, top - 0.38), corner(b, 3.0)];
        face(out, 'glass', forward ? pane : pane.reverse(), tint.cyan);
      }
    }
  }
  const caps = [
    [
      [73.9, -131],
      [75.2, -125],
      [80.4, -123.1],
      [85.1, -127.2],
      [84.7, -133.2],
      [79.6, -135.1],
    ],
    [
      [71.6, -202],
      [76.1, -206.8],
      [82.5, -206.4],
      [85.3, -202.9],
      [81.3, -198.2],
      [75.5, -198],
    ],
    [
      [132.1, -219],
      [137.5, -219],
      [142.7, -215.6],
      [144.3, -210.9],
      [141.6, -208.2],
      [136.3, -208.7],
      [132.1, -212.4],
    ],
    [
      [132.2, -112.2],
      [137.0, -112.8],
      [143.6, -116.0],
      [144.5, -120.6],
      [141.1, -124.0],
      [134.8, -124.1],
      [132.6, -121.3],
    ],
  ];
  for (const tower of lod === 0 ? caps.slice(2) : caps) {
    slab(out, 'glass', tower, 0, 52.0, tint.cyan);
    slab(out, 'mass', tower, 52.0, 53.15, tint.ivory);
    if (lod > 1)
      for (let y = 4.01; y < 52; y += bayLake.floorInterval)
        boundary(
          out,
          'slabs',
          tower.map((p) => lerp(p, tower[2], -0.029)),
          y,
          y + 0.24,
          tint.cream,
        );
  }
  const lounge = [
    [66.0, -178.7],
    [80.2, -180.7],
    [88.7, -175.3],
    [88.5, -151.3],
    [81.8, -145.6],
    [66.0, -147.1],
  ];
  slab(out, 'mass', lounge, top, 52.74, tint.ivory);
  slab(out, 'glass', lounge, 52.74, bayLake.loungeY, tint.pane);
  slab(out, 'slabs', lounge, 56.4, 57.1, tint.cream);
  for (const z of [-177.0, -148.3]) {
    const start = [64.8, 52.2, z];
    const end = [67.4, 59.12, z];
    beam(out, 'mass', start, end, 1.15, 1.67, tint.ivory);
  }
  box(out, 'mass', [66.85, 58.6, -177.6], [68.35, 60.05, -147.1], tint.ivory);
  if (lod > 0) {
    const portico = [
      [54.3, -171.9],
      [65.3, -174.6],
      [65.3, -151.9],
      [54.3, -155.6],
    ];
    slab(out, 'mass', portico, 5.43, 6.28, tint.ivory);
    for (const [x, z] of [
      [55.0, -170.1],
      [55.0, -156.6],
    ]) {
      box(out, 'mass', [x - 0.4, -0.45, z - 0.44], [x + 0.4, 5.46, z + 0.44], tint.pier);
    }
  }
}

function skyWay(out, lod) {
  const ring =
    lod > 1 ? bridgeOutline : bridgeOutline.filter((_, i) => i % (lod === 0 ? 6 : 3) === 0);
  const y = main.bridgeY;
  slab(out, 'mass', ring, y - 0.63, y, tint.pier);
  slab(out, 'roof', ring, y + 2.75, y + 3.02, tint.pale);
  if (lod === 0) {
    boundary(out, 'steel', ring, y + 0.99, y + 1.19, tint.steel);
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (lod > 0)
      beam(out, 'steel', corner(a, y + 1.12), corner(b, y + 1.12), 0.071, 0.07, tint.steel);
    if (lod > 0 && i % 2 === 0)
      beam(out, 'mass', corner(a, y), corner(a, y + 2.76), 0.105, 0.13, tint.pale);
  }
  for (const [x, z] of [
    [37, -86],
    [53, -94],
    [69, -105],
  ])
    box(out, 'mass', [x - 0.42, -0.46, z - 0.53], [x + 0.42, y - 0.6, z + 0.53], tint.pier);
}

function build(out, lod) {
  mainFacade(out, lod);
  mainEnds(out, lod);
  bayTower(out, lod);
  skyWay(out, lod);
}
export const contemporaryResortSkyline = (out) => build(out, 0);
export const contemporaryResortDistrict = (out) => build(out, 1);
export const contemporaryResortStreet = (out) => build(out, 2);
export const contemporaryResortCloseup = (out) => build(out, 3);

const recipe = 'disney-contemporary-resort-model.mjs';
const camera = [385, 82, -72];
const lookAt = [48, 24, -69];
export const contemporaryResortModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'hotel-commercial',
  build: contemporaryResortCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: mainOutline,
    outlines: [mainOutline, bayOutline],
    minimumCoverage: 0.84,
    basis:
      'Use the two individually mapped hotel outlines to suppress intersecting fallback masses. The independently mapped convention center and South Garden Wing retain their own footprints.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The 1971 resort A-frame and the 2009 crescent Bay Lake Tower with their raised Sky Way Bridge, the two monorail beams through the main concourse, rooftop restaurant and tiered balconies.',
  camera,
  lookAt,
  sunDirection: [155, 75, 74],
  portableGroundY: -0.6,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.05,
    cameraYaw: -0.45,
    focus: { center: [44, 23, -74] },
    groundY: -0.6,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'both-towers-from-the-east', position: camera, lookAt },
    { name: 'west-entries-and-bay-lake-curve', position: [-280, 40, -97], lookAt: [50, 23, -73] },
    { name: 'a-frame-monorail-and-terraces', position: [-53, 19, -121], lookAt: [-4, 25, -33] },
    { name: 'sky-way-bridge-and-inner-crescent', position: [161, 27, -78], lookAt: [60, 15, -92] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'resort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'contemporaryResortSkyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'contemporaryResortDistrict', 0.86],
        ['street', 'contemporaryResortStreet', 0.33],
        ['closeup', 'contemporaryResortCloseup', 0.1],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original modeled geometry. The two reference photos are public domain. OpenStreetMap geometry is ODbL 1.0.',
  limitations: plan.limitations,
};
