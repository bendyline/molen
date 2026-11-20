import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  stone: 'c6bbaa',
  trim: 'd5cbbb',
  foundation: 'a39d90',
  modern: 'c9c5b5',
  court: 'b6aa94',
  slate: '666c6c',
  flat: '848785',
  roofTrim: '737a77',
  glass: '4f6063',
  door: '504838',
  metal: '5f6562',
  clerestory: '697e83',
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.95),
  base: surface('foundation', 'stone_limestone_weathered', 0.97),
  slate: surface('roof', 'tile_ceramic', 0.92),
  lead: surface('roof', 'metal_standing_seam', 0.83, 0.12),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57 },
  timber: surface('trim', 'wood_plain', 0.91),
};
const floor = 2.59;
const eave = 12.9;
const wallBase = (p) => Math.min(grade(p) - 0.42, eave - 5);
const walls = (points, inside = false) =>
  pairs(closed(points)).map(([a, b]) => edge(a, b, areaSign(points) * (inside ? -1 : 1)));
function distantOutline(points) {
  return points.filter(([x, z], i) => {
    const [ax, az] = points[(i + points.length - 1) % points.length];
    const [bx, bz] = points[(i + 1) % points.length];
    const distance = Math.hypot(bx - ax, bz - az);
    return (
      distance < 0.35 || Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) / distance > 0.35
    );
  });
}

function roofWithCourts(out, outline, courts) {
  const loops = [outline, ...courts];
  const points = loops.flat();
  const holes = courts.map((_, i) => loops.slice(0, i + 1).reduce((n, loop) => n + loop.length, 0));
  const indices = earcut(points.flat(), holes);
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      'lead',
      indices.slice(i, i + 3).map((k) => at(points[k], eave)),
      up,
      c.flat,
    );
}

function belt(out, wall, top, color, offset = 0.16) {
  trimBlock(out, 'stone', wall, 0, wall.length, top - 0.24, top, 0.004, offset, color);
}

function opening(out, wall, u, y, level, style) {
  const width = style === 'modern' ? 1.11 : style === 'cloister' ? 0.85 : 0.78;
  const high = style === 'cloister' ? 2.65 : 2.44;
  if (style === 'modern') {
    panel(out, 'glass', wall, u - width, u + width, y, y + high, 0.022, c.glass);
    if (level > 1) panel(out, 'stone', wall, u - 0.045, u + 0.045, y, y + high, 0.067, c.trim);
  } else {
    arch(
      out,
      wall,
      u,
      y,
      y + high - 0.44,
      width,
      0.44,
      0.019,
      level === 1 ? 0 : 2,
      { inner: c.glass, trim: c.trim, width: 0.105 },
      { inner: 'glass', trim: 'stone' },
    );
  }
  if (level >= 2)
    trimBlock(
      out,
      'stone',
      wall,
      u - width - 0.14,
      u + width + 0.14,
      y - 0.13,
      y + 0.016,
      0.015,
      0.225,
      c.trim,
    );
}

function wallFaces(out, outline, level, inside = false) {
  for (const [i, wall] of walls(outline, inside).entries()) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const [x, z] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const modern = !inside && x < -46 && z < -19;
    const wallColor = inside ? c.court : modern ? c.modern : c.stone;
    const ha = wallBase(a),
      hb = wallBase(b);
    if (level === 0) {
      face(out, 'stone', [at(a, ha), at(b, hb), at(b, eave), at(a, eave)], wall.normal, wallColor);
      continue;
    }
    const plinth = Math.min(Math.max(ha, hb) + 0.65, eave - 4.6);
    face(
      out,
      'base',
      [at(a, ha), at(b, hb), at(b, plinth), at(a, plinth)],
      wall.normal,
      c.foundation,
    );
    face(
      out,
      'stone',
      [at(a, plinth), at(b, plinth), at(b, eave), at(a, eave)],
      wall.normal,
      wallColor,
    );
    if (wall.length < 1.35) continue;
    belt(out, wall, eave - 0.28, c.trim);
    if (level >= 2 && wall.length > 3) belt(out, wall, Math.min(7.0, plinth + 4.6), c.trim, 0.082);
    const minBayWidth = level === 3 ? 3.35 : 4.05;
    if (wall.length < minBayWidth || (x > 49.7 && !inside)) continue;
    const bays = Math.max(1, Math.round(wall.length / (modern ? 4.1 : inside ? 4.65 : 5.12)));
    for (let k = 0; k < bays; k++) {
      const u = ((k + 0.5) * wall.length) / bays;
      const g = mix(plinth, Math.max(plinth, floor), 0.55) + 0.97;
      const [px, , pz] = wall.p(u, 0);
      if (Math.abs(px - d.entrance[0]) < 0.5 && Math.abs(pz - d.entrance[1]) < 16.5) continue;
      opening(out, wall, u, g, level, modern ? 'modern' : inside ? 'cloister' : 'gallery');
      if (level >= 2 && g < 7.6 && !inside)
        opening(out, wall, u, 9.05, level, modern ? 'modern' : 'gallery');
    }
  }
}

function hipped(out, bounds, low, high, inset, color) {
  const [x0, z0, x1, z1] = bounds;
  const base = rect(...bounds);
  const top = rect(x0 + inset[0], z0 + inset[1], x1 - inset[0], z1 - inset[1]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      'slate',
      [at(base[i], low), at(base[j], low), at(top[j], high), at(top[i], high)],
      up,
      color,
    );
  }
  face(
    out,
    'slate',
    top.map((p) => at(p, high)),
    up,
    color,
  );
}

function column(out, point, low, high, radius, level) {
  const sections = level < 2 ? 8 : 12;
  const rings = [
    [low, radius * 1.42],
    [low + 0.23, radius * 1.42],
    [low + 0.36, radius],
    [high - 0.45, radius * 0.87],
    [high - 0.19, radius * 1.22],
    [high, radius * 1.46],
  ];
  loft(
    out,
    'stone',
    rings.map(([y, r]) => radialRing(y, r, r, sections, point, Math.PI / sections)),
    c.trim,
  );
}

function rotunda(out, level) {
  const segments = [12, 16, 28, 40][level];
  const rings = [3, 4, 8, 12][level];
  const p = d.rotunda,
    radius = 8.45,
    spring = 15.8;
  loft(
    out,
    'stone',
    [eave - 0.08, spring].map((y) => radialRing(y, radius, radius, segments, p)),
    c.stone,
    { cap: false },
  );
  const profile = Array.from({ length: rings + 1 }, (_, i) => {
    const t = (i * Math.PI) / (rings * 2);
    const r = Math.max(0.46, radius * Math.cos(t));
    return radialRing(spring + 4.48 * Math.sin(t), r, r, segments, p);
  });
  loft(out, 'slate', profile, c.roofTrim);
  if (level > 0) {
    const center = radialRing(spring + 4.5, 0.48, 0.48, 12, p);
    face(out, 'glass', center, up, c.clerestory);
    const ring = radialRing(0, radius, radius, 8, p, Math.PI / 8).map(([x, , z]) => [x, z]);
    for (const [a, b] of pairs(closed(ring))) {
      const wall = edge(a, b, -1);
      panel(out, 'glass', wall, wall.length * 0.41, wall.length * 0.59, 14.0, 15.14, 0.68, c.glass);
    }
  }
}

function roofMassing(out, level) {
  const [x0, z0, x1, z1] = d.modernPavilion;
  shell(out, rect(x0 + 2, z0 + 1.5, x1 - 2, z1 - 1.5), () => eave - 0.03, eave + 3.13, {
    wall: 'stone',
    roof: 'lead',
    color: c.modern,
    roofColor: c.flat,
  });
  const [a, b, s, n] = d.gallery;
  hipped(out, [a + 1.2, b + 1.8, a + 10.3, n - 1.4], eave - 0.05, 16.28, [4, 3.3], c.slate);
  hipped(out, [a + 10.8, b + 5, s - 3.2, 12.0], eave - 0.04, 16.58, [4.3, 2.7], c.slate);
  hipped(out, [-21.9, 46.3, 50.45, 54.85], eave - 0.04, 15.8, [2.2, 3.3], c.slate);
  hipped(out, [-16.7, 88.8, 57.0, 99.5], eave - 0.03, 15.2, [3, 3], c.slate);
  hipped(out, [19.7, -60.4, 42.9, -38.4], eave - 0.05, 14.8, [3.4, 3.5], c.slate);
  rotunda(out, level);
  if (level > 0) {
    for (const [x, z, w, depth] of [
      [-87, -57, 21, 3.2],
      [-18, -9, 10, 8],
      [13, 7, 23, 4.1],
    ]) {
      block(out, 'lead', x, eave - 0.02 + (x < -50 ? 3.13 : 0), z, w, 0.32, depth, c.roofTrim);
      block(
        out,
        'glass',
        x + 0.25,
        eave + 0.28 + (x < -50 ? 3.13 : 0),
        z + 0.25,
        w - 0.5,
        0.165,
        depth - 0.5,
        c.clerestory,
      );
    }
  }
}

function mainEntrance(out, level) {
  const [x, z] = d.entrance;
  const left = z - 14.8,
    right = z + 14.8;
  const venue = edge([x - 0.22, right], [x - 0.22, left]);
  const doorWall = edge([x - 0.3, right], [x - 0.3, left]);
  for (const u of [6.9, 14.8, 22.7])
    arch(
      out,
      doorWall,
      u,
      floor,
      7.74,
      1.85,
      1.23,
      0.021,
      Math.min(2, level),
      { inner: c.door, trim: c.trim, width: 0.23 },
      { inner: 'timber', trim: 'stone' },
    );
  const stepCount = level === 0 ? 5 : 11;
  for (let i = 0; i < stepCount; i++) {
    const run = mix(x - 7.3, x - 0.23, i / stepCount);
    const y = mix(0.62, floor, (i + 1) / stepCount);
    const rectStep = rect(run, z - 9.05, x - 0.22, z + 9.05);
    shell(out, rectStep, (p) => Math.min(y - 0.21, grade(p) - 0.14), y, {
      wall: 'base',
      roof: 'base',
      color: c.foundation,
      roofColor: c.trim,
    });
  }
  const cornice = 12.63;
  trimBlock(out, 'stone', venue, 0, 29.6, cornice - 0.56, cornice + 0.05, 0.01, 0.37, c.trim);
  trimBlock(out, 'stone', venue, 0, 29.6, cornice + 0.42, cornice + 0.68, 0.01, 0.22, c.trim);
  if (level === 0) return;
  for (const n of [-13.7, -10.9, -4, 4, 10.9, 13.7])
    column(out, [x - 0.75, z + n], floor, cornice - 0.61, 0.43, level);

  const count = level === 1 ? 20 : 38;
  for (let i = 0; i <= count; i++) {
    const u = 0.24 + (29.11 * i) / count;
    trimBlock(
      out,
      'stone',
      venue,
      u - 0.12,
      u + 0.12,
      cornice - 0.02,
      cornice + 0.45,
      0.028,
      0.16,
      c.trim,
    );
  }
  if (level >= 2)
    for (const center of [6.9, 14.8, 22.7]) {
      const w = 1.8;
      panel(
        out,
        'timber',
        doorWall,
        center - 0.035,
        center + 0.035,
        floor + 0.05,
        7.66,
        0.052,
        c.stone,
      );
      for (const u of [center - w, center + w])
        trimBlock(out, 'stone', doorWall, u - 0.13, u + 0.13, floor, 7.79, 0.016, 0.11, c.trim);
    }
}

function build(out, level) {
  const outline = level < 2 ? distantOutline(d.outline) : d.outline;
  const courts = level < 2 ? d.courts.map(distantOutline) : d.courts;
  wallFaces(out, outline, level);
  for (const points of courts) wallFaces(out, points, level, true);
  roofWithCourts(out, outline, courts);
  roofMassing(out, level);
  mainEntrance(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'art-and-history-museum-model.mjs';
const camera = [-209, 121, 165];
const lookAt = [-17, 8, 1];
const errors = { district: 1.15, street: 0.53, closeup: 0.17 };
export const artAndHistoryMuseumAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Unmodified Cinquantenaire elevation in the west entry approach.',
  brief:
    'The Brussels Cinquantenaire museum with its classical west entry, modern Antiquities Pavilion, rotunda and cloister courts.',
  camera,
  lookAt,
  sunDirection: [-106, 129, 35],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.87,
    basis: 'Museum-only native outline with Autoworld excluded.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'albert-elisabeth-entry-and-steps',
      position: [-82, 12, 14.9],
      lookAt: [-32, 7.4, 14.9],
    },
    { name: 'cloister-courtyard-and-wings', position: [-19, 62, 131], lookAt: [15, 6.7, 64] },
    {
      name: 'antiquities-pavilion-and-main-roofs',
      position: [-146, 71, -90],
      lookAt: [-48, 11, -25],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'art-and-history-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.4,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
