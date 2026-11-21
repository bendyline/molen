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
  opening,
  pairs,
  palette,
  panel,
  planarMid,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const h = d.heights;
const f = d.foundations;

const color = palette({
  wall: 'e3dccc',
  cream: 'dcd4bd',
  inner: 'cfc5ae',
  limestone: 'dfd2b7',
  shadowStone: 'b9ab94',
  sill: 'c9bba1',
  roof: '52544e',
  lowerRoof: '64514a',
  copper: '60756e',
  copperShade: '526862',
  stone: 'a59a89',
  crimson: '974b43',
  white: 'eee6d5',
  glass: '3e413d',
  door: '5e5141',
  porch: 'b0a28c',
});
const surfaces = {
  wall: surface('wall', 'plaster_lime', 0.91),
  trim: surface('trim', 'stone_limestone', 0.87),
  base: surface('foundation', 'stone_ashlar', 0.93),
  roof: surface('roof', 'metal_painted', 0.81, 0.09),
  shutter: surface('trim', 'wood_painted_lap', 0.9),
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.77, metallic: 0 },
};
const roofUp = h.upperFloor + 14.28;
const outerLevel = 3.31;
const lerpPoint = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const cross2 = ([a, b], [c, d]) => a * d - b * c;
const subtract = ([a, b], [c, d]) => [a - c, b - d];

function walls(out, poly, foundation, eaves, tint, reverse = false) {
  const sign = areaSign(poly) * (reverse ? -1 : 1);
  for (const [a, b] of pairs(closed(poly))) {
    face(
      out,
      'wall',
      [at(a, foundation), at(b, foundation), at(b, eaves), at(a, eaves)],
      edge(a, b, sign).normal,
      tint,
    );
  }
}

// Cast a ray through a closed footprint from the centre of its court.
function rayDistance(poly, center, direction) {
  const distances = [];
  for (const [p, q] of pairs(closed(poly))) {
    const start = subtract(p, center);
    const line = subtract(q, p);
    const basis = cross2(direction, line);
    if (Math.abs(basis) < 1e-9) continue;
    const u = cross2(start, direction) / basis,
      t = cross2(start, line) / basis;
    if (u >= -1e-7 && u <= 1.0000001 && t > 0) distances.push(t);
  }
  return Math.min(...distances);
}

function upperRoof(out) {
  const center = planarMid(d.court);
  const angles = [...d.upper, ...d.court]
    .map(([x, z]) => Math.atan2(z - center[1], x - center[0]))
    .sort((a, b) => a - b);
  const rays = angles
    .filter((angle, i) => !i || angle - angles[i - 1] > 1e-8)
    .map((angle) => {
      const direction = [Math.cos(angle), Math.sin(angle)];
      const inside = rayDistance(d.court, center, direction),
        outside = rayDistance(d.upper, center, direction);
      const point = (distance, height) => [
        center[0] + direction[0] * distance,
        height,
        center[1] + direction[1] * distance,
      ];
      return {
        outside: point(outside, roofUp),
        inside: point(inside, roofUp - 0.09),
        ridge: point(
          mix(inside, outside, 0.56),
          roofUp + Math.min(3.75, (outside - inside) * 0.29),
        ),
      };
    });
  for (const [a, b] of pairs(closed(rays))) {
    face(out, 'roof', [a.outside, b.outside, b.ridge, a.ridge], up, color.roof);
    face(out, 'roof', [a.ridge, b.ridge, b.inside, a.inside], up, color.roof);
  }
}

function shutters(out, w, u, sill, height, lod) {
  const head = sill + height;
  if (lod < 2) {
    panel(out, 'shutter', w, u - 0.61, u + 0.61, sill, head, 0.08, color.crimson);
    if (lod === 1) {
      panel(
        out,
        'shutter',
        w,
        u - 0.61,
        u + 0.61,
        sill + height * 0.39,
        sill + height * 0.63,
        0.09,
        color.white,
      );
      panel(out, 'opening', w, u - 0.27, u + 0.27, sill + 0.09, head - 0.03, 0.1, color.glass);
    }
    return;
  }
  opening(
    out,
    w,
    u - 0.33,
    u + 0.33,
    sill,
    head,
    'trim',
    color.glass,
    'opening',
    color.shadowStone,
    lod,
    0.058,
  );
  const size = 0.32;
  for (const x of [u - 0.39 - size, u + 0.39]) {
    panel(out, 'shutter', w, x, x + size, sill, head, 0.082, color.crimson);
    if (lod > 0)
      panel(
        out,
        'shutter',
        w,
        x,
        x + size,
        sill + height * 0.39,
        sill + height * 0.63,
        0.089,
        color.white,
      );
  }
}

function palaceWindows(out, poly, floor, levels, lod, inward = false) {
  const sign = areaSign(poly) * (inward ? -1 : 1);
  for (const [a, b] of pairs(closed(poly))) {
    const w = edge(a, b, sign);
    if (w.length < (lod === 0 ? 5.5 : 2.4)) continue;
    const bays = Math.max(1, Math.floor(w.length / (lod === 0 ? 8.4 : lod === 1 ? 5.8 : 3.05)));
    for (let i = 0; i < bays; i++) {
      const u = ((i + 0.5) * w.length) / bays;
      for (let j = 0; j < levels; j++)
        shutters(out, w, u, floor + 0.89 + j * outerLevel, 1.13 + (j === 1 ? 0.14 : 0), lod);
    }
    if (lod > 1) {
      const eave = floor + levels * outerLevel + 0.85;
      panel(out, 'trim', w, 0, w.length, eave - 0.23, eave + 0.055, 0.064, color.white);
    }
  }
}

function upperCastle(out, lod) {
  walls(out, d.upper, f.upper, roofUp, color.wall);
  walls(out, d.court, h.upperFloor - 0.09, roofUp - 0.09, color.inner, true);
  cap(out, 'base', d.court, h.upperFloor - 0.035, color.porch);
  upperRoof(out);
  palaceWindows(out, d.upper, h.upperFloor, 4, lod);
  if (lod > 0) palaceWindows(out, d.court, h.upperFloor, 4, lod, true);
  const center = planarMid(d.belvedere);
  const ringBase = roofUp + 1.46;
  ring(
    out,
    'wall',
    center,
    [
      [ringBase - 0.8, 1.6],
      [ringBase + 3.66, 1.54],
    ],
    lod < 1 ? 6 : 10,
    color.wall,
  );
  ring(
    out,
    'trim',
    center,
    [
      [ringBase + 3.42, 1.66],
      [ringBase + 3.69, 1.66],
    ],
    lod < 1 ? 6 : 10,
    color.limestone,
  );
  ring(
    out,
    'roof',
    center,
    [
      [ringBase + 3.69, 1.45],
      [ringBase + 4.18, 1.16],
      [ringBase + 4.59, 1.07],
      [ringBase + 4.98, 1.21],
      [ringBase + 5.28, 1.16],
      [ringBase + 5.74, 0.67],
      [ringBase + 6.14, 0.53],
      [ringBase + 6.33, 0.062],
    ],
    [6, 8, 12, 16][lod],
    color.copper,
  );
  if (lod > 0) {
    for (const [x, z] of [
      [34.7, -25.2],
      [40.4, -23.8],
      [46.1, -23.5],
      [51.8, -22.4],
      [56.5, -21.88],
      [61.0, -29.4],
    ]) {
      block(out, 'trim', x - 0.31, roofUp + 0.26, z - 0.28, 0.62, 3.65, 0.56, color.limestone);
      block(out, 'base', x - 0.43, roofUp + 3.9, z - 0.4, 0.86, 0.18, 0.8, color.sill);
    }
  }
}

function hipRect(out, poly, y, height, tint, rise = () => 0) {
  const rotate = poly.map((p, i) => [p, poly[(i + 1) % 4], i]);
  const i = rotate.reduce(
    (long, [a, b, k]) =>
      Math.hypot(...subtract(a, b)) > Math.hypot(...subtract(poly[long], poly[(long + 1) % 4]))
        ? k
        : long,
    0,
  );
  const [a, b, c, d] = poly.slice(i).concat(poly.slice(0, i));
  const m = lerpPoint(a, d, 0.5),
    n = lerpPoint(b, c, 0.5);
  const eave = (point) => at(point, y + rise(point));
  const ridge = (point) => at(point, y + height + rise(point));
  const lo = ridge(lerpPoint(m, n, 0.16));
  const hi = ridge(lerpPoint(m, n, 0.84));
  face(out, 'roof', [eave(a), eave(b), hi, lo], up, tint);
  face(out, 'roof', [eave(d), eave(c), hi, lo], up, tint);
  face(out, 'roof', [eave(a), eave(d), lo], up, tint);
  face(out, 'roof', [eave(b), eave(c), hi], up, tint);
}

function oculus(out, w, u, cy, r, lod) {
  const steps = [7, 10, 16, 22][lod];
  const at = (i, rad, off) => {
    const a = (i * 2 * Math.PI) / steps;
    return w.p(u + Math.cos(a) * rad, cy + Math.sin(a) * rad, off);
  };
  if (lod === 0) {
    face(
      out,
      'opening',
      Array.from({ length: steps }, (_, i) => at(i, r, 0.1)),
      w.normal,
      color.glass,
    );
    return;
  }
  for (let i = 0; i < steps; i++) {
    const a = at(i, r, 0.1),
      b = at(i + 1, r, 0.1);
    face(out, 'opening', [w.p(u, cy, 0.1), a, b], w.normal, color.glass);
    if (lod > 0)
      face(
        out,
        'trim',
        [a, b, at(i + 1, r + 0.13, 0.13), at(i, r + 0.13, 0.13)],
        w.normal,
        color.limestone,
      );
  }
  if (lod > 1) {
    panel(out, 'trim', w, u - 0.021, u + 0.021, cy - r + 0.08, cy + r - 0.08, 0.155, color.sill);
    panel(out, 'trim', w, u - r + 0.08, u + r - 0.08, cy - 0.024, cy + 0.024, 0.155, color.sill);
  }
}

function spanishHall(out, lod) {
  const base = h.hallFloor,
    eaves = base + 8.35;
  const p = d.hall;
  walls(out, p, f.hall, eaves, color.cream);
  cap(out, 'roof', p, eaves - 0.002, color.copperShade);
  hipRect(
    out,
    [
      [7.05, -15.08],
      [58.72, -15.02],
      [58.82, -2.12],
      [7.08, -2.14],
    ],
    eaves,
    3.58,
    color.copper,
  );
  const w = edge(p[5], p[6], -1);
  const sill = base + 1.72;
  panel(out, 'base', w, 0, w.length, f.hall, base + 0.72, 0.04, color.sill);
  panel(out, 'trim', w, 0, w.length, base + 1.03, base + 1.3, 0.125, color.limestone);
  panel(out, 'trim', w, 0, w.length, eaves - 0.37, eaves + 0.05, 0.165, color.limestone);
  const n = lod === 0 ? 9 : lod === 1 ? 15 : 17;
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * w.length) / n;
    opening(
      out,
      w,
      x - 0.63,
      x + 0.63,
      sill,
      base + 4.86,
      'trim',
      color.glass,
      'opening',
      color.limestone,
      lod,
      0.126,
    );
    oculus(out, w, x, base + 6.4, 0.51, lod);
    if (lod > 0)
      panel(
        out,
        'trim',
        w,
        (i * w.length) / n + 0.019,
        (i * w.length) / n + 0.15,
        base + 1.33,
        eaves - 0.38,
        0.136,
        color.sill,
      );
    if (lod > 1) {
      for (const [low, high] of [
        [base + 0.36, base + 0.52],
        [base + 0.68, base + 0.79],
      ]) {
        panel(out, 'trim', w, x - 0.9, x + 0.9, low, high, 0.172, color.limestone);
      }
    }
  }
  const count = lod === 0 ? 4 : 7;
  for (let i = 0; i < count; i++) {
    const x = mix(11.2, 54.8, (i + 0.5) / count);
    const z = -4.5;
    const low = eaves + 0.78;
    block(out, 'wall', x - 0.68, low, z - 0.63, 1.36, 1.18, 1.27, color.shadowStone);
    hipRect(out, rect(x - 0.82, z - 0.89, x + 0.82, z + 0.92), low + 1.03, 0.62, color.copperShade);
    panel(
      out,
      'opening',
      plane(z + 0.657, 1),
      x - 0.27,
      x + 0.27,
      low + 0.16,
      low + 0.77,
      0.083,
      color.glass,
    );
  }
  const west = edge(p[5], p[1], 1);
  for (const x of [3.75, 6.0, 8.22]) oculus(out, west, x, base + 6.4, 0.49, lod);
  opening(
    out,
    west,
    5.65,
    7.01,
    base + 0.7,
    base + 4.42,
    'trim',
    color.door,
    'opening',
    color.limestone,
    lod,
    0.12,
  );
  if (lod > 0)
    stairs(
      out,
      grade,
      'base',
      7.85,
      10.68,
      3.11,
      -2.18,
      base + 0.19,
      [2, 4, 6, 7][lod],
      color.stone,
    );
}

function rangeWindows(out, p, y, lod, skipShort = false, rise = () => 0) {
  const sign = areaSign(p);
  for (const [a, b] of pairs(closed(p))) {
    const w = edge(a, b, sign);
    if (w.length < 4 || (skipShort && w.length < 7)) continue;
    const count = Math.max(1, Math.floor(w.length / (lod < 1 ? 8.1 : lod === 1 ? 6.2 : 4.25)));
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count;
      const x = u * w.length;
      const level = y + rise(lerpPoint(a, b, u));
      opening(
        out,
        w,
        x - 0.48,
        x + 0.48,
        level + 2.97,
        level + 4.67,
        'trim',
        color.glass,
        'opening',
        color.limestone,
        lod,
        0.073,
      );
      if (lod > 1)
        opening(
          out,
          w,
          x - 0.51,
          x + 0.51,
          level + 0.62,
          y + 2.0,
          'trim',
          color.glass,
          'opening',
          color.limestone,
          lod,
          0.078,
        );
    }
  }
}

function lowerCastle(out, lod) {
  const p = d.lower,
    eave = h.lowerFloor + 6.09;
  const rise = ([, z]) => Math.max(0, Math.min(1, (z - 39) / 43)) * 5.35;
  const sign = areaSign(p);
  for (const [a, b] of pairs(closed(p))) {
    face(
      out,
      'wall',
      [at(a, f.lower), at(b, f.lower), at(b, eave + rise(b)), at(a, eave + rise(a))],
      edge(a, b, sign).normal,
      color.cream,
    );
  }
  const triangles = earcut(p.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    face(
      out,
      'roof',
      triangles.slice(i, i + 3).map((index) => at(p[index], eave + rise(p[index]) - 0.014)),
      up,
      color.lowerRoof,
    );
  }
  for (const indices of [
    [0, 1, 4, 26],
    [4, 11, 24, 25],
    [11, 16, 22, 24],
    [16, 17, 20, 22],
  ]) {
    hipRect(
      out,
      indices.map((i) => p[i]),
      eave - 0.08,
      3.17,
      color.lowerRoof,
      rise,
    );
  }
  rangeWindows(out, p, h.lowerFloor, lod, false, rise);
  const annexRoof = h.annexFloor + 5.55;
  shell(out, d.annex, () => f.annex, annexRoof, {
    wall: 'wall',
    color: color.wall,
    roof: 'roof',
    roofColor: color.roof,
  });
  hipRect(out, [d.annex[0], d.annex[1], d.annex[6], d.annex[7]], annexRoof, 2.48, color.roof);
  rangeWindows(out, d.annex, h.annexFloor, lod, true);
}

function westernGate(out, lod) {
  for (const [p, y, foundation, height, pitch] of [
    [d.gatehouse, h.gatehouseFloor, f.gatehouse, 5.71, 2.26],
    [d.tower, h.towerFloor, f.tower, 13.35, 4.45],
  ]) {
    shell(out, p, () => foundation, y + height, {
      wall: 'wall',
      color: color.wall,
      roof: 'roof',
      roofColor: color.roof,
    });
    const outline = p.length === 4 ? p : [p[0], p[1], p[2], p.at(-1)];
    hipRect(out, outline, y + height - 0.09, pitch, color.roof);
    if (p === d.tower) palaceWindows(out, p, y, 3, lod);
    else rangeWindows(out, p, y, lod, true);
  }
}

function build(out, lod) {
  upperCastle(out, lod);
  spanishHall(out, lod);
  lowerCastle(out, lod);
  westernGate(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [-151, 99, 170];
const lookAt = [-1, 11, 5];
const recipe = 'ambras-castle-model.mjs';
export const ambrasModel = {
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
    'Independent native terrain beneath the garden-facing Spanish Hall. The upper court and lower ranges sit at their distinct terrain-constrained working elevations.',
  brief:
    'Ambras Castle in Innsbruck, including the white Upper Castle and red-and-white shutters, the Spanish Hall and its circular windows, the Lower Castle and two western ranges.',
  camera,
  lookAt,
  sunDirection: [-51, 70, 45],
  buildingCutout: {
    outline: d.outline,
    outlines: [d.upper, d.hall, d.lower, d.annex, d.tower, d.gatehouse],
    minimumCoverage: 0.92,
    basis: 'Only the six mapped building extents with authored structures replace generic volumes.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'upper-castle-and-spanish-hall', position: [-26, 31, 104], lookAt: [31, 13, -19] },
    { name: 'spanish-hall-from-the-garden', position: [38, 7, 49], lookAt: [31, 4, -6] },
    { name: 'lower-castle-pentagonal-court', position: [19, 63, 114], lookAt: [-38, 6, 43] },
    { name: 'upper-court-and-belvedere', position: [101, 67, -112], lookAt: [44, 18, -36] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ambras-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.85,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.57, surfaces },
      street: { export: 'street', errorMeters: 0.67, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.19, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The two exact creator-released photographs are public domain. Mapped geometry © OpenStreetMap contributors, ODbL 1.0.',
};
