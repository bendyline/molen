import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const layout = read('map-frame.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const tone = palette({
  grass: '82936b',
  slope: '798c60',
  cut: '878168',
  dressed: 'b4af9e',
  trim: 'c7c1b0',
  gray: 'a49f8f',
  roof: '747d78',
  shutters: '5f7064',
  glass: '637476',
  void: '303b36',
  weatheredTimber: '9b8871',
  chimney: 'a29988',
});
const surfaces = {
  sod: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
  earth: surface('foundation', 'earth_rammed', 0.96),
  stone: surface('wall', 'stone_limestone_weathered', 0.92),
  trim: surface('trim', 'stone_ashlar', 0.93),
  timber: surface('trim', 'wood_plain', 0.92),
  roof: surface('roof', 'metal_standing_seam', 0.73, 0.08),
  glass: surface('window', 'window_grid', 0.43),
};
const center = (points) => points.reduce((v, p) => add(v, scale(p, 1 / points.length)), [0, 0]);
const scale = ([x, z], v) => [x * v, z * v];
const add = ([x, z], [u, v]) => [x + u, z + v];
const minus = ([x, z], [u, v]) => [x - u, z - v];
const midpoint = (a, b, t = 0.5) => add(scale(a, 1 - t), scale(b, t));
const squaredDistance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

function nearestOnRing(p, ring) {
  let best = ring[0];
  let distance = Infinity;
  for (const [a, b] of pairs(closed(ring))) {
    const v = minus(b, a),
      w = minus(p, a);
    const t = Math.max(0, Math.min(1, (v[0] * w[0] + v[1] * w[1]) / squaredDistance(a, b)));
    const candidate = midpoint(a, b, t);
    const delta = squaredDistance(candidate, p);
    if (delta < distance) {
      distance = delta;
      best = candidate;
    }
  }
  return best;
}

function horizontalAnnulus(out, outer, inner, y, slot, color) {
  const geometry = [...outer, ...inner];
  const triangles = earcut(geometry.flat(), [outer.length]);
  for (let i = 0; i < triangles.length; i += 3) {
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((v) => at(geometry[v], y)),
      up,
      color,
    );
  }
}

function bankBand(out, rim, inside, top, { outer, lod }) {
  const wind = areaSign(rim) * (outer ? 1 : -1);
  for (const [a, p] of rim.entries()) {
    const b = (a + 1) % rim.length;
    const q = rim[b],
      u = inside[a],
      v = inside[b];
    const normal = edge(p, q, wind).normal;
    const low = grade(p) - 0.36,
      lowNext = grade(q) - 0.36;
    const middle = top * 0.26;
    if (outer && lod > 1) {
      face(
        out,
        'earth',
        [at(p, low), at(q, lowNext), at(q, middle), at(p, middle)],
        normal,
        tone.cut,
      );
      face(out, 'sod', [at(p, middle), at(q, middle), at(v, top), at(u, top)], normal, tone.slope);
    } else {
      face(out, 'sod', [at(p, low), at(q, lowNext), at(v, top), at(u, top)], normal, tone.slope);
    }
  }
}

function ramparts(out, lod) {
  const outer = lod === 0 ? d.outer.filter((_, i) => i % 2 === 0) : d.outer;
  const inner = lod === 0 ? d.court.filter((_, i) => i % 2 === 0) : d.court;
  const outerCrest = outer.map((p) => midpoint(p, nearestOnRing(p, d.court), 0.24));
  const innerCrest = inner.map((p) => midpoint(p, nearestOnRing(p, d.outer), 0.2));
  const crest = 4.68;
  bankBand(out, outer, outerCrest, crest, { outer: true, lod });
  bankBand(out, inner, innerCrest, crest, { outer: false, lod });
  horizontalAnnulus(out, outerCrest, innerCrest, crest, 'sod', tone.grass);

  const ravelin = lod === 0 ? d.ravelin.filter((_, i) => i % 2 === 0) : d.ravelin;
  const middle = center(ravelin);
  const crown = ravelin.map((p) => midpoint(p, middle, 0.22));
  bankBand(out, ravelin, crown, 2.7, { outer: true, lod });
  cap(out, 'sod', crown, 2.7, tone.grass);
}

function hippedRoof(out, points, eave, rise) {
  const expanded = points.map((p) => midpoint(center(points), p, 1.025));
  const halfwayA = midpoint(expanded[0], expanded[1]);
  const halfwayB = midpoint(expanded[2], expanded[3]);
  const halfwayC = midpoint(expanded[1], expanded[2]);
  const halfwayD = midpoint(expanded[3], expanded[0]);
  const [a, b, r1, r2] =
    squaredDistance(halfwayA, halfwayB) < squaredDistance(halfwayC, halfwayD)
      ? [
          halfwayC,
          halfwayD,
          [midpoint(halfwayC, halfwayD, 0.22), 1, 2],
          [midpoint(halfwayD, halfwayC, 0.22), 3, 0],
        ]
      : [
          halfwayA,
          halfwayB,
          [midpoint(halfwayA, halfwayB, 0.22), 0, 1],
          [midpoint(halfwayB, halfwayA, 0.22), 2, 3],
        ];
  const ridge = eave + rise;
  const endA = at(r1[0], ridge),
    endB = at(r2[0], ridge);
  for (const [i, p] of expanded.entries()) {
    const j = (i + 1) % 4;
    const facePoints = [at(p, eave), at(expanded[j], eave)];
    if (i === r1[1]) facePoints.push(endA);
    else if (i === r2[1]) facePoints.push(endB);
    else if (squaredDistance(p, a) < squaredDistance(p, b)) facePoints.push(endB, endA);
    else facePoints.push(endA, endB);
    face(out, 'roof', facePoints, up, tone.roof);
  }
  return [r1[0], r2[0]];
}

function facingCourt(points) {
  const winding = areaSign(points);
  const walls = pairs(closed(points)).map(([a, b]) => edge(a, b, winding));
  return walls.reduce((chosen, w) => {
    const toward = (wall) => {
      const [x, , z] = wall.p(wall.length * 0.5, 0);
      return (-wall.normal[0] * x - wall.normal[2] * z) / Math.hypot(x, z);
    };
    return toward(w) > toward(chosen) ? w : chosen;
  });
}

function window(out, wall, u, y, height, width, lod) {
  const l = u - width / 2,
    r = u + width / 2;
  panel(out, 'trim', wall, l - 0.14, r + 0.14, y - 0.13, y + height + 0.15, 0.037, tone.trim);
  panel(out, 'glass', wall, l, r, y, y + height, 0.06, tone.glass);
  if (lod < 2) return;
  panel(out, 'timber', wall, u - 0.03, u + 0.03, y, y + height, 0.081, tone.shutters);
  for (const t of [0.34, 0.67]) {
    const v = y + t * height;
    panel(out, 'timber', wall, l, r, v - 0.025, v + 0.025, 0.084, tone.shutters);
  }
}

function arcade(out, wall, base, count, lod) {
  const pitch = wall.length / (count + 0.44);
  for (let i = 0; i < count; i++) {
    const x = wall.length * 0.5 + (i - (count - 1) * 0.5) * pitch;
    arch(
      out,
      wall,
      x,
      base + 0.14,
      base + 1.91,
      pitch * 0.322,
      1.15,
      0.067,
      lod,
      { inner: tone.void, trim: tone.trim, width: 0.22 },
      { inner: 'sod', trim: 'trim' },
    );
  }
}

function roundFace(out, wall, u, y, radius, offset, material, color, lod) {
  const segments = lod > 1 ? 12 : 8;
  const points = Array.from({ length: segments }, (_, i) => {
    const a = (i * 2 * Math.PI) / segments;
    return wall.p(u + radius * Math.cos(a), y + radius * Math.sin(a), offset);
  });
  face(out, material, points, wall.normal, color);
}

function barrackFront(out, wall, base, eave, lod) {
  const mid = wall.length * 0.5,
    w = 7.45;
  face(
    out,
    'trim',
    [
      wall.p(mid - w, eave - 0.31, 0.12),
      wall.p(mid + w, eave - 0.31, 0.12),
      wall.p(mid, eave + 2.42, 0.12),
    ],
    wall.normal,
    tone.trim,
  );
  if (lod === 0) return;
  roundFace(out, wall, mid, eave + 0.62, 0.74, 0.15, 'trim', tone.gray, lod);
  roundFace(out, wall, mid, eave + 0.62, 0.55, 0.18, 'glass', tone.glass, lod);
  panel(out, 'trim', wall, mid - w, mid + w, eave - 0.45, eave - 0.21, 0.15, tone.gray);
  arch(
    out,
    wall,
    mid,
    base + 0.04,
    base + 2.24,
    1.37,
    0.88,
    0.067,
    lod,
    { inner: tone.void, trim: tone.trim, width: 0.23 },
    { inner: 'sod', trim: 'trim' },
  );
  for (const f of [-1, 1]) {
    panel(
      out,
      'trim',
      wall,
      mid + f * 6.19 - 0.28,
      mid + f * 6.19 + 0.28,
      base + 0.12,
      eave - 0.42,
      0.09,
      tone.gray,
    );
  }
}

function building(out, item, lod) {
  const { points, level, index } = item;
  const height = [7.95, 4.25, 6.25, 6.28, 5.53, 5.56][index];
  const eave = level + height,
    rise = [3.13, 1.52, 2.12, 2.13, 1.49, 1.49][index];
  shell(out, points, (p) => grade(p) - 0.29, level + 0.26, { wall: 'trim', color: tone.gray });
  shell(out, points, () => level + 0.25, eave, { wall: 'stone', color: tone.dressed });
  const footprint =
    index === 1
      ? [points[0], points[1], points[2], add(points[2], minus(points[0], points[1]))]
      : points;
  const ridge = hippedRoof(out, footprint, eave, rise);
  const facade = facingCourt(footprint);
  if (index === 0) {
    barrackFront(out, facade, level, eave, lod);
    for (let i = 0; i < 5; i++) {
      const [x, z] = midpoint(...ridge, (i + 0.4) / 4.8);
      block(out, 'stone', x - 0.4, eave + rise - 0.31, z - 0.52, 0.8, 1.73, 1.04, tone.chimney);
      if (lod > 0)
        block(out, 'trim', x - 0.48, eave + rise + 1.22, z - 0.6, 0.96, 0.25, 1.2, tone.trim);
    }
  }
  if (lod === 0) return;
  const n = [15, 3, 5, 5, 4, 4][index];
  const arched = index === 2 || index === 3;
  if (arched) arcade(out, facade, level, n, lod);
  if (index !== 1)
    panel(
      out,
      'trim',
      facade,
      0,
      facade.length,
      level + height * 0.59,
      level + height * 0.59 + 0.16,
      0.038,
      tone.trim,
    );
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) * facade.length) / n;
    window(out, facade, u, level + height * 0.64, height * 0.22, index === 1 ? 0.42 : 0.82, lod);
    if (index === 0 && i !== Math.floor(n / 2)) window(out, facade, u, level + 1.1, 1.89, 0.9, lod);
    if (index > 3 && i !== 1) window(out, facade, u, level + 0.98, 1.44, 0.8, lod);
  }
  if (index >= 4) {
    const u = facade.length * 0.375;
    panel(out, 'trim', facade, u - 0.87, u + 0.87, level + 0.1, level + 2.91, 0.061, tone.trim);
    panel(
      out,
      'timber',
      facade,
      u - 0.61,
      u + 0.61,
      level + 0.15,
      level + 2.64,
      0.083,
      tone.shutters,
    );
  }
}

function casemateFront(out, line, count, lod) {
  const w = facingCourt([
    line[0],
    line[1],
    midpoint(line[1], [0, 0], 0.009),
    midpoint(line[0], [0, 0], 0.009),
  ]);
  const plane =
    w.length >= 0.9 * Math.hypot(...minus(line[0], line[1])) ? w : edge(line[0], line[1]);
  const p = plane.length / count;
  panel(out, 'stone', plane, -0.2, plane.length + 0.2, -0.28, 3.41, 0.09, tone.gray);
  if (lod === 0) return;
  panel(out, 'trim', plane, -0.16, plane.length + 0.16, 3.37, 3.65, 0.15, tone.trim);
  for (let i = 0; i < count; i++) {
    arch(
      out,
      plane,
      (i + 0.5) * p,
      0.09,
      1.39,
      Math.min(0.91, p * 0.28),
      0.6,
      0.169,
      lod,
      { inner: tone.void, trim: tone.trim, width: 0.18 },
      { inner: 'sod', trim: 'trim' },
    );
  }
}

function portals(out, lod) {
  const [north, south] = d.passages;
  for (const [line, sign] of [
    [north, -1],
    [south, 1],
  ]) {
    const [x, z] = line[0],
      w = 7.6;
    const path = edge([x - w * 0.5, z + sign * 0.13], [x + w * 0.5, z + sign * 0.13], -sign);
    panel(out, 'stone', path, -0.59, w + 0.59, -0.28, 3.79, 0.0, tone.gray);
    panel(out, 'trim', path, -0.42, w + 0.42, 3.68, 3.98, 0.14, tone.trim);
    arch(
      out,
      path,
      w * 0.5,
      0.1,
      2.05,
      1.34,
      1.12,
      0.06,
      lod,
      { inner: tone.void, trim: tone.trim, width: 0.23 },
      { inner: 'sod', trim: 'trim' },
    );
    if (lod > 0) {
      panel(out, 'trim', path, w * 0.5 - 0.78, w * 0.5 + 0.78, 3.24, 3.63, 0.075, tone.trim);
      for (const u of [0.5, w - 0.5]) {
        panel(out, 'trim', path, u - 0.48, u + 0.48, -0.11, 3.72, 0.03, tone.gray);
      }
    }
  }
}

function bridge(out, line, lod) {
  const [a, b] = line;
  const w = edge(a, b),
    width = 1.78,
    sill = 0.54;
  const outline = [
    w.p(0, sill, width),
    w.p(w.length, sill, width),
    w.p(w.length, sill, -width),
    w.p(0, sill, -width),
  ].map(([x, , z]) => [x, z]);
  shell(out, outline, () => sill - 0.26, sill, { wall: 'timber', color: tone.weatheredTimber });
  for (const side of [-1, 1]) {
    const atSide = (u, y) => w.p(u, y, side * (width - 0.07));
    beamPath(
      out,
      'timber',
      [atSide(0, sill + 1.04), atSide(w.length, sill + 1.04)],
      0.15,
      0.19,
      tone.weatheredTimber,
    );
    const count = lod === 0 ? 5 : lod === 1 ? 8 : lod === 2 ? 14 : 16;
    for (let i = 0; i < count; i++) {
      const u = 0.23 + ((w.length - 0.46) * i) / (count - 1);
      beamPath(
        out,
        'timber',
        [atSide(u, sill - 0.01), atSide(u, sill + 1.07)],
        0.17,
        0.17,
        tone.weatheredTimber,
      );
    }
    if (lod > 1)
      beamPath(
        out,
        'timber',
        [atSide(0, sill + 0.52), atSide(w.length, sill + 0.52)],
        0.1,
        0.11,
        tone.weatheredTimber,
      );
  }
}

function build(out, lod) {
  ramparts(out, lod);
  for (const item of d.buildings) building(out, item, lod);
  casemateFront(out, d.casemates[0], 11, lod);
  casemateFront(out, d.casemates[1], 6, lod);
  portals(out, lod);
  for (const line of d.bridges) bridge(out, line, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-lennox-model.mjs';
const camera = [240, 194, 267];
const lookAt = [-2, 2, 12];
export const lennoxModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'palace-castle-fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'exact-native-frame',
  groundContactBasis:
    'Original island elevation at the open parade ground. The ramparts sit above the independent raw field, while the mapped moat remains world terrain.',
  brief:
    'Fort Lennox on Île aux Noix, with four grass-covered bastions around the open parade, the arcaded gate buildings, stone barracks, twin magazines, south ravelin and two bridges.',
  camera,
  lookAt,
  sunDirection: [-38, 72, 68],
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: layout.geometry.outline,
    outlines: layout.geometry.polygons,
    minimumCoverage: 0.91,
    basis: 'Individually mapped fort, ravelin and six roofed heritage structures.',
  },
  qaCameras: [
    { name: 'parade-and-barracks', position: [28, 21, 14], lookAt: [-54, 3, -4] },
    { name: 'north-bridge-and-gate', position: [32, 10, -126], lookAt: [5, 2, -88] },
    { name: 'officers-and-guardhouse', position: [3, 11, -7], lookAt: [4, 3, -62] },
    { name: 'ravelin-and-fort-enclosure', position: [189, 159, 209], lookAt: [-8, 2, 14] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-lennox-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.69, surfaces },
      street: { export: 'street', errorMeters: 0.24, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. The Archives of Ontario 1923 lantern slide I0017513 is in the public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
