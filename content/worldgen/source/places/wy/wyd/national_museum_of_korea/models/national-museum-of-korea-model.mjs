import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  planarMid,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  granite: 'bbbbb1',
  side: 'b5b6ac',
  high: 'c4c4bb',
  fascia: 'a9ada9',
  foundation: 'b7b8ab',
  roof: '92968f',
  roofLight: 'a0a39b',
  glass: '778a88',
  glassShade: '657879',
  dark: '67706a',
  step: 'b7b7aa',
  wood: '7f5444',
  darkWood: '754438',
  green: '4e6d68',
  darkGreen: '48645b',
  grayTile: '575d58',
  bronze: '7c7051',
});
const surfaces = {
  stone: surface('wall', 'stone_granite', 0.92),
  paving: surface('foundation', 'stone_granite', 0.91),
  aluminum: surface('trim', 'metal_painted', 0.7, 0.18),
  roof: surface('roof', 'membrane', 0.94),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62, metallic: 0.07 },
  timber: surface('trim', 'wood_vertical', 0.89),
  tile: surface('roof', 'tile_glazed', 0.87),
  bronze: surface('trim', 'metal_bronze_cast', 0.83, 0.26),
};
const wallEdges = (p) => pairs(closed(p)).map(([a, b]) => edge(a, b, areaSign(p)));
const ground = (point) => Math.min(-0.12, grade(point) - 0.42);
const maxHeight = d.lowerHeightDatum + d.maximumHeight;
const plaza = d.openPlaza;
const visitorDeck = 8.57;

function clipThroughX(points, limit, direction) {
  const inside = ([x]) => (x - limit) * direction >= 0;
  const result = [];
  for (const [a, b] of pairs(closed(points))) {
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) {
      const t = (limit - a[0]) / (b[0] - a[0]);
      if (t > 1e-6 && t < 1 - 1e-6) result.push([limit, mix(a[1], b[1], t)]);
    }
  }
  return result;
}

function windowBands(out, w, high, level, broad) {
  const width = w.length;
  const count = Math.max(1, Math.floor(width / [25, 15, 9.8, 8.4][level]));
  const sizes =
    broad && high > 13
      ? [
          [4.47, 7.66],
          [high - 4.25, high - 2.45],
        ]
      : [[high - 0.33 * (high - 1), high - 1.47]];
  const shade = broad ? c.glass : c.glassShade;
  for (const [low, top] of sizes) {
    for (let j = 0; j < count; j++) {
      const left = (width * (j + 0.1)) / count;
      const right = (width * (j + 0.9)) / count;
      panel(out, 'glass', w, left, right, low, top, 0.067, shade);
      if (level > 0)
        panel(out, 'aluminum', w, left - 0.07, right + 0.07, low - 0.135, low, 0.094, c.fascia);
      if (level > 1) {
        const m = (left + right) * 0.5;
        panel(out, 'aluminum', w, m - 0.08, m + 0.08, low, top, 0.092, c.fascia);
      }
    }
  }
}

function museumWing(out, outline, high, level) {
  shell(out, outline, ground, high, {
    wall: 'stone',
    color: c.granite,
    roof: 'roof',
    roofColor: c.roof,
  });
  for (const [i, w] of wallEdges(outline).entries()) {
    if (w.length < 1.5) continue;
    const p = w.p(w.length * 0.5, 0);
    const broad = Math.abs(w.normal[2]) > 0.35 && w.length > 25;
    const base = grade([p[0], p[2]]);
    const lowerBand = Math.max(1.1, base + 1);
    if (w.length > 7 && high > 5) windowBands(out, w, high, level, broad);
    panel(out, 'stone', w, 0.04, w.length - 0.04, lowerBand - 0.29, lowerBand, 0.023, c.foundation);
    if (level > 0)
      trimBlock(
        out,
        'aluminum',
        w,
        0.025,
        w.length - 0.025,
        high - 0.42,
        high + 0.085,
        -0.04,
        0.13,
        c.fascia,
      );
    if (level < 2 || !broad || high < 13) continue;
    const div = Math.floor(w.length / 9.2);
    const yLow = Math.max(visitorDeck - 0.6, base + 0.6);
    for (let j = 1; j < div; j++) {
      const u = (w.length * j) / div;
      panel(
        out,
        'stone',
        w,
        u - 0.05,
        u + 0.05,
        yLow,
        high - 4.46,
        0.034,
        i % 2 ? c.fascia : c.side,
      );
    }
  }
}

function wallCrown(out, x0, x1, z0, z1, high, base) {
  const ledge = rect(x0, z0, x1, z1);
  const bottom = Math.min(base, high - 0.4);
  shell(out, ledge, () => bottom, high, {
    wall: 'stone',
    color: c.high,
    roof: 'roof',
    roofColor: c.roofLight,
  });
}

function centralPlaza(out, level) {
  const { left, right, front, back, approachZ } = plaza;
  const openTop = maxHeight - 6.05;
  const slab = rect(left - 1.05, back - 1.18, right + 1.29, front + 2.74);
  shell(out, slab, () => openTop, maxHeight, {
    wall: 'stone',
    color: c.high,
    roof: 'roof',
    roofColor: c.roof,
  });
  const lower = slab.map((p) => at(p, openTop));
  face(out, 'stone', [...lower].reverse(), [0, -1, 0], c.side);
  const deck = rect(left, back - 2.9, right, front - 0.12);
  shell(out, deck, ground, visitorDeck, {
    wall: 'paving',
    color: c.foundation,
    roof: 'paving',
    roofColor: c.step,
  });
  const stairLeft = left + 1.4;
  const stairRight = right - 2.7;
  const steps = [5, 11, 19, 33][level];
  stairs(out, grade, 'paving', stairLeft, stairRight, approachZ, front, visitorDeck, steps, c.step);
  const firstRise = Math.max(grade([stairLeft, approachZ]), grade([stairRight, approachZ])) + 0.08;
  const firstTread = mix(firstRise, visitorDeck, 1 / steps);
  const frontWall = edge([stairRight, approachZ], [stairLeft, approachZ]);
  const sections = Math.ceil(frontWall.length / 5);
  for (let i = 0; i < sections; i++) {
    const u = (frontWall.length * i) / sections;
    const v = (frontWall.length * (i + 1)) / sections;
    const floor = (distance) => {
      const [x, , z] = frontWall.p(distance, 0);
      return Math.min(firstTread - 0.12, grade([x, z]) - 0.45);
    };
    face(
      out,
      'paving',
      [
        frontWall.p(u, floor(u), 0.006),
        frontWall.p(v, floor(v), 0.006),
        frontWall.p(v, firstTread, 0.006),
        frontWall.p(u, firstTread, 0.006),
      ],
      frontWall.normal,
      c.foundation,
    );
  }
  for (const a of [left + 0.1, right - 2.65]) {
    const b = a + 2.22;
    face(
      out,
      'stone',
      [
        [a, grade([a, approachZ]) + 0.45, approachZ],
        [b, grade([b, approachZ]) + 0.45, approachZ],
        [b, visitorDeck + 0.49, front],
        [a, visitorDeck + 0.49, front],
      ],
      up,
      c.foundation,
    );
  }
  if (level > 0) {
    const packing = level === 1 ? 7 : 13;
    for (let i = 1; i < packing; i++) {
      const x = mix(left + 1, right - 1, i / packing);
      block(
        out,
        'aluminum',
        x,
        openTop - 0.19,
        back + 1.35,
        0.36,
        0.16,
        front - back - 2.45,
        c.fascia,
      );
    }
  }
  const frame = rect(left - 0.47, front - 0.5, left + 1.25, front + 1.52);
  const twin = rect(right - 1.66, front - 0.5, right + 0.31, front + 1.52);
  for (const p of [frame, twin])
    shell(out, p, () => visitorDeck, openTop, { wall: 'stone', color: c.side, roof: 'stone' });
}

function rotunda(out, level) {
  const outline = level === 0 ? d.rotunda.filter((_, i) => i % 2 === 0) : d.rotunda;
  const low = visitorDeck + 0.07;
  const high = 20.62;
  shell(out, outline, () => low, high, {
    wall: 'glass',
    color: c.glassShade,
    roof: 'roof',
    roofColor: c.roofLight,
  });
  if (level === 0) return;
  for (const w of wallEdges(outline)) {
    for (const y of [low + 0.08, low + 4.1, low + 8.2, high - 0.14])
      panel(out, 'aluminum', w, 0, w.length, y, y + 0.095, 0.054, c.fascia);
    const n = level > 1 ? 2 : 1;
    for (let j = 0; j < n; j++) {
      const u = 0.05 + (j * w.length) / n;
      panel(out, 'aluminum', w, u, u + 0.094, low, high, 0.059, c.fascia);
    }
  }
}

function gardenPavilion(out, outline, level, celadon) {
  const [x, z] = planarMid(outline);
  const base = grade([x, z]) + 0.14;
  const scale = (k) => outline.map(([a, b]) => [mix(x, a, k), mix(z, b, k)]);
  const plinth = scale(0.98);
  shell(out, plinth, () => base - 0.69, base + 0.31, {
    wall: 'paving',
    color: c.foundation,
    roof: 'paving',
  });
  const timber = celadon ? c.wood : c.darkWood;
  const top = base + (celadon ? 3.93 : 3.91);
  const rood = celadon ? c.green : c.grayTile;
  for (const [a, b] of scale(0.68)) {
    const width = celadon ? 0.205 : 0.242;
    block(
      out,
      'timber',
      a - width / 2,
      base + 0.32,
      b - width / 2,
      width,
      top - base - 0.23,
      width,
      timber,
    );
  }
  const cornice = scale(1.02);
  shell(out, cornice, () => top - 0.24, top, {
    wall: 'timber',
    color: celadon ? c.darkGreen : timber,
    roof: 'timber',
  });
  const profiles = [
    [1.06, 0.02],
    [level === 0 ? 0.55 : 0.75, 0.56],
    [0.12, celadon ? 2.34 : 2.8],
  ];
  const shoulders = profiles.map(([r, y]) => scale(r).map((p) => at(p, top + y)));
  for (const [lo, hi] of pairs(shoulders)) {
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length;
      face(out, 'tile', [lo[i], lo[j], hi[j], hi[i]], up, rood);
    }
  }
  cap(out, 'tile', scale(0.12), top + profiles.at(-1)[1], rood);
  if (!celadon) {
    const y = top - 1.35;
    ring(
      out,
      'bronze',
      [x, z],
      [
        [y - 0.74, 1.03],
        [y - 0.65, 0.91],
        [y - 0.34, 0.82],
        [y + 0.17, 0.61],
        [y + 0.23, 0.39],
      ],
      [8, 10, 16, 20][level],
      c.bronze,
    );
  }
}

const westernWing = clipThroughX(d.outline, plaza.left, -1);
const easternWing = clipThroughX(d.outline, plaza.right, 1);

function build(out, level) {
  museumWing(out, westernWing, d.roofHeights.west, level);
  museumWing(out, easternWing, d.roofHeights.east, level);
  museumWing(out, d.wingNorth, d.roofHeights.north, level);
  museumWing(out, d.wingBack, d.roofHeights.northBack, level);
  wallCrown(out, -178.7, plaza.left, 23.55, 27.96, 23.3, d.roofHeights.west - 0.05);
  wallCrown(out, plaza.right, 176.3, 25.4, 28.32, 25.87, d.roofHeights.east - 0.06);
  wallCrown(out, plaza.right + 2.35, 163.65, -35.9, -32.6, 22.9, d.roofHeights.east - 0.06);
  centralPlaza(out, level);
  rotunda(out, level);
  gardenPavilion(out, d.pavilion, level, true);
  gardenPavilion(out, d.bell, level, false);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'national-museum-of-korea-model.mjs';
const camera = [260, 149, 278];
const lookAt = [7, 11, 51];
const errors = { district: 0.95, street: 0.39, closeup: 0.14 };
export const nationalMuseumKoreaAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original relief at the public south approach and the nearby pond shoulder, with a separate lower datum for the stated architectural height.',
  brief:
    'Long fortress-like granite wings and an open covered public plaza at the National Museum of Korea, with the glass rotunda and garden pavilions.',
  camera,
  lookAt,
  sunDirection: [-4, 13, 11],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis: 'Named main museum shell and four additional mapped roofs.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'roofed-open-plaza-and-visitor-steps', position: [-35, 22, 122], lookAt: [-18, 14, 0] },
    {
      name: 'granite-museum-and-mirror-pond-approach',
      position: [-235, 79, 264],
      lookAt: [-7, 15, 40],
    },
    { name: 'northern-wing-and-plaza-throat', position: [107, 51, -174], lookAt: [-12, 14, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-museum-of-korea-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.94,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Mapzen and Copernicus elevation and © OpenStreetMap contributors.',
};
