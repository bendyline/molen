import { readFileSync } from 'node:fs';
import {
  fbox,
  lathe,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const controls = read('native-map/nimes-arena-geometry-controls');
const { nativeFittedOuterRadii: outer, nativeFittedArenaRadii: inner } = controls;
const offset = controls.nativeFittedArenaOffset;
const top = controls.topOfCorniceM;
const bayCount = controls.facadeBays;
const startAngle = -Math.PI / 2;
const turn = (2 * Math.PI) / bayCount;
const trackY = plan.dimensions.trackElevation + 0.11;

const ashlar = rgb('c2b49a');
const masonry = rgb('b5a68b');
const worn = rgb('a99b84');
const belt = rgb('b3a58a');
const archStone = rgb('cabda4');
const mortar = rgb('a29a87');
const shadow = rgb('6b6052');
const sand = rgb('c5b091');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95 },
  fascia: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.91 },
  seats: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.96 },
  deep: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.93 },
};

function ovalPoint(angle, out, inset = 0) {
  return [(out[0] - inset) * Math.cos(angle), (out[1] - inset) * Math.sin(angle)];
}

function trackPoint(angle) {
  const [x, z] = ovalPoint(angle, inner);
  return [x + offset[0], z + offset[1]];
}

function point3([x, z], y) {
  return [x, y, z];
}

function ringTop(out, slot, edge, innerEdge, y, count, color) {
  for (let i = 0; i < count; i++) {
    const a = startAngle - (2 * Math.PI * i) / count;
    const b = startAngle - (2 * Math.PI * (i + 1)) / count;
    quad4(
      out,
      slot,
      point3(edge(a), y),
      point3(edge(b), y),
      point3(innerEdge(b), y),
      point3(innerEdge(a), y),
      color,
    );
  }
}

function bayWall(out, f, base, ceiling, width, depth, level, mainEntrance, index) {
  const center = f.length / 2;
  const radius = width / 2;
  const spring = ceiling - radius - (mainEntrance ? 0.39 : 0.76);
  const edge = roundArch(radius, level === 2 ? 5 : 11);
  const left = center - radius;
  const right = center + radius;
  const p = f.P;
  // Both jambs, sandstone piers and real openings continue through the outer wall.
  fbox(out, 'wall', f, 0, left, base, ceiling, -depth, 0, masonry);
  fbox(out, 'wall', f, right, f.length, base, ceiling, -depth, 0, masonry);
  for (let i = 0; i < edge.length - 1; i++) {
    const [u, rise] = edge[i];
    const [v, nextRise] = edge[i + 1];
    const a = [center + u, spring + rise];
    const b = [center + v, spring + nextRise];
    quad4(out, 'wall', p(...a), p(...b), p(b[0], ceiling), p(a[0], ceiling), ashlar);
    quad4(
      out,
      'fascia',
      p(...b, -depth),
      p(...a, -depth),
      p(a[0], ceiling, -depth),
      p(b[0], ceiling, -depth),
      worn,
    );
    quad4(out, 'fascia', p(...b), p(...a), p(...a, -depth), p(...b, -depth), mortar);
    const outerArch = (point) => [
      center + (point[0] - center) * ((radius + 0.35) / radius),
      spring + (point[1] - spring) * ((radius + 0.35) / radius),
    ];
    quad4(
      out,
      'fascia',
      p(...a, 0.021),
      p(...b, 0.021),
      p(...outerArch(b), 0.021),
      p(...outerArch(a), 0.021),
      (i + index) % 5 === 0 ? masonry : archStone,
    );
  }
  if (level === 3) {
    for (const u of [left, right]) {
      fbox(out, 'fascia', f, u - 0.19, u + 0.19, spring - 0.13, spring + 0.04, -0.04, 0.14, belt);
    }
  }
}

function shallowBay(out, f, base, ceiling, width, level) {
  const p = f.P;
  const r = width / 2;
  const u = f.length / 2;
  const spring = ceiling - r - 0.63;
  const left = u - r;
  const right = u + r;
  quad4(out, 'wall', p(0, base), p(f.length, base), p(f.length, ceiling), p(0, ceiling), ashlar);
  quad4(
    out,
    'deep',
    p(left, base + 0.05, 0.018),
    p(right, base + 0.05, 0.018),
    p(right, spring, 0.018),
    p(left, spring, 0.018),
    shadow,
  );
  const arch = roundArch(r, level === 0 ? 2 : 5).map(([x, y]) => p(u + x, spring + y, 0.018));
  for (let i = 1; i < arch.length - 1; i++) {
    tri(out, 'deep', arch[0], arch[i + 1], arch[i], shadow);
  }
}

function mainPortal(out, f, level) {
  const u = f.length / 2;
  const p = f.P;
  tri(
    out,
    'fascia',
    p(u - 2.59, 9.28, 0.167),
    p(u + 2.59, 9.28, 0.167),
    p(u, 11.02, 0.167),
    archStone,
  );
  fbox(out, 'fascia', f, u - 2.61, u + 2.61, 9.08, 9.32, 0.13, 0.41, belt);
  if (level === 3) {
    for (const side of [-1, 1]) {
      const a = u + side * 1.59;
      fbox(out, 'fascia', f, a - 0.24, a + 0.24, 9.66, 10.04, 0.15, 0.38, worn);
    }
  }
}

function arcade(out, level) {
  const depth = 5.15;
  for (let i = 0; i < bayCount; i++) {
    const angle = startAngle - i * turn;
    const a = ovalPoint(angle + turn / 2, outer);
    const b = ovalPoint(angle - turn / 2, outer);
    const f = wallFace(a, b);
    const entrance = i === 0;
    const width = f.length - (entrance ? 0.81 : 1.42);

    if (level > 1) {
      bayWall(out, f, -0.59, 9.25, width, depth, level, entrance, i);
      bayWall(out, f, 10.62, 18.93, width - 0.22, depth, level, false, i);
      // The upper arcade has a low solid sill, and the outer ring retains its balcony cornice.
      fbox(out, 'fascia', f, 0, f.length, 9.25, 10.62, -depth, 0.13, belt);
      fbox(out, 'fascia', f, 0, f.length, 18.93, top, -depth, 0.17, belt);
      fbox(out, 'fascia', f, 0, f.length, top - 0.58, top - 0.21, -depth, 0.41, archStone);
    } else {
      shallowBay(out, f, -0.59, 9.25, width, level);
      shallowBay(out, f, 10.62, 18.93, width - 0.22, level);
      const p = f.P;
      quad4(out, 'fascia', p(0, 9.25), p(f.length, 9.25), p(f.length, 10.62), p(0, 10.62), belt);
      quad4(out, 'fascia', p(0, 18.93), p(f.length, 18.93), p(f.length, top), p(0, top), belt);
    }
    if (level === 0) continue;
    if (level === 1) {
      const p = f.P;
      quad4(
        out,
        'fascia',
        p(0.015, 10.58, 0.05),
        p(0.38, 10.58, 0.05),
        p(0.38, 18.86, 0.05),
        p(0.015, 18.86, 0.05),
        belt,
      );
      if (entrance) mainPortal(out, f, level);
      continue;
    }
    const column = f.P(0.18, 0, 0.025);
    lathe(
      out,
      'fascia',
      [column[0], column[2]],
      [
        [10.58, 0.49, 0.49],
        [10.9, 0.49, 0.49],
        [11.16, 0.34, 0.34],
        [18.3, 0.29, 0.29],
        [18.51, 0.43, 0.43],
        [18.85, 0.45, 0.45],
      ],
      level === 3 ? 8 : 4,
      i % 6 === 0 ? masonry : ashlar,
      { capTop: false },
    );
    if (level > 1) {
      fbox(
        out,
        'fascia',
        f,
        0.025,
        0.66,
        top - 0.23,
        top + 0.31,
        -0.06,
        0.48,
        i % 9 === 0 ? worn : belt,
      );
    }
    if (entrance) mainPortal(out, f, level);
  }
}

function galleryWall(out) {
  const inset = 8.25;
  for (let i = 0; i < bayCount; i++) {
    if (i % 15 === 0) continue;
    const angle = startAngle - i * turn;
    const a = ovalPoint(angle + turn / 2, outer, inset);
    const b = ovalPoint(angle - turn / 2, outer, inset);
    quad4(
      out,
      'wall',
      point3(a, -0.72),
      point3(b, -0.72),
      point3(b, top - 0.15),
      point3(a, top - 0.15),
      worn,
    );
  }
}

function rowEdge(angle, t) {
  const a = trackPoint(angle);
  const b = ovalPoint(angle, outer, 6.0);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function cavityHeight(t) {
  return 0.62 + 17.45 * t + 0.53 * t * t;
}

function band(out, r1, r2, base, topY, sectors, row, level) {
  for (let i = 0; i < sectors; i++) {
    const a = startAngle - (2 * Math.PI * i) / sectors;
    const b = startAngle - (2 * Math.PI * (i + 1)) / sectors;
    const first = rowEdge(a, r1);
    const second = rowEdge(b, r1);
    const third = rowEdge(b, r2);
    const fourth = rowEdge(a, r2);
    const edge = (row * 37 + i * 23) % 13;
    const color = level > 1 && edge < 3 ? worn : edge < 8 ? masonry : ashlar;
    const outerY = level === 0 ? topY + (cavityHeight(r2) - cavityHeight(r1)) : topY;
    // The seating surface faces the centre of the bowl. Risers are open on the low side.
    quad4(
      out,
      'seats',
      point3(second, topY),
      point3(first, topY),
      point3(fourth, outerY),
      point3(third, outerY),
      color,
    );
    if (level > 0) {
      quad4(
        out,
        'seats',
        point3(second, base),
        point3(first, base),
        point3(first, topY),
        point3(second, topY),
        mortar,
      );
    }
  }
}

function bowl(out, level) {
  const trackSides = level === 3 ? 80 : level === 2 ? 60 : 30;
  const center = point3(offset, trackY);
  for (let i = 0; i < trackSides; i++) {
    const a = startAngle - (2 * Math.PI * i) / trackSides;
    const b = startAngle - (2 * Math.PI * (i + 1)) / trackSides;
    tri(out, 'paving', center, point3(trackPoint(a), trackY), point3(trackPoint(b), trackY), sand);
  }
  if (level === 0) {
    for (let i = 0; i < 4; i++) {
      const start = i / 4;
      band(out, start, (i + 1) / 4, 0, cavityHeight(start), 12, i, 0);
    }
    return;
  }
  const groups = [[2, 3, 3, 3], [4, 8, 8, 8], controls.historicSeatRowGroups][level - 1];
  const stops = [0.15, 0.46, 0.735, 1];
  const segments = level === 3 ? 90 : 30;
  let start = 0;
  for (let i = 0; i < groups.length; i++) {
    const stop = stops[i];
    const stride = (stop - start) / groups[i];
    for (let j = 0; j < groups[i]; j++) {
      const inner = start + j * stride;
      const outer = inner + stride;
      const y = cavityHeight(outer);
      const yBase = i + j === 0 ? trackY : cavityHeight(inner);
      band(out, inner, outer, yBase, y, segments, j, level);
    }
    start = stop;
  }
  ringTop(
    out,
    'fascia',
    (a) => ovalPoint(a, outer, 0.13),
    (a) => rowEdge(a, 1),
    top - 0.11,
    level === 1 ? 60 : 120,
    masonry,
  );
}

function build(out, level) {
  arcade(out, level);
  if (level > 1) galleryWall(out);
  bowl(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'arena-of-nimes-model.mjs';
const camera = [-92, 51, -118];
const lookAt = [0, 7.7, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'amphitheatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The surviving Roman limestone amphitheatre, with two complete round-headed arcades encircling its tiered bowl and sand arena.',
  camera,
  lookAt,
  sunDirection: [-34, 45, -73],
  mediumFiContext: {
    scale: 0.85,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis:
      'Native relation 534466 enables removal of generic replacements of the mapped outer walls.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_limestone_weathered', 'gravel'],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'whole-arena-and-tiered-seating', position: camera, lookAt },
    { name: 'principal-facade-and-arcades', position: [0, 9, -74], lookAt: [0, 11, -48] },
    { name: 'cavea-four-seating-levels', position: [-26, 34, 23], lookAt: [9, 7.4, -17] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'arena-of-nimes-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.34, surfaces },
      street: { export: 'street', errorMeters: 0.53, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.16, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on public-domain Rijksmuseum records and renderings, written city and operator records, native mapping and the open national terrain dataset.',
};
