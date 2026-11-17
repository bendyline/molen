/** Yokohama's two standing former bonded warehouses. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const [shortOutline, longOutline] = map.geometry.polygons;
const { base, minimumFoundation, totalHeight, eaves, levels, innerPavilionIntervals } =
  plan.section;
const colors = Object.fromEntries(
  Object.entries({
    brick: 'a65c49',
    brickSun: 'b26953',
    pilaster: '96503f',
    reveal: '6e372e',
    deep: '5c423b',
    trim: 'a49686',
    plinth: '777373',
    roof: '5d6267',
    roofDark: '53585d',
    lead: '74747a',
    glass: '4f585a',
    mullion: '69584b',
    shed: '786252',
    iron: '694e42',
  }).map(([name, value]) => [name, rgb(value)]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.16 },
  detail: { slot: 'window', localRef: 'palette:#f6f0e5', roughness: 0.62, metallic: 0 },
};
const ref = 'palette:#ffffff';
const up = [0, 1, 0];
const at = ([x, z], y) => [x, y, z];

function face(out, slot, points, toward, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * toward[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      color,
    );
}

function cap(out, slot, ring, height, color) {
  const tessellator = new MeshBufferBuilder();
  if (!tessellator.addCap(slot, ref, ring, [], height, up, (p) => p, color))
    throw Error('Cannot triangulate the warehouse roof');
  const { positions, indices } = tessellator.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, points, up, color);
  }
}
function directedEdges(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + x * b[1] - z * b[0];
  }, 0);
  const points = area > 0 ? ring : [...ring].reverse();
  return points.map((a, i) => [a, points[(i + 1) % points.length]]);
}
function frame(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (b[0] - a[0]) / length,
    z = (b[1] - a[1]) / length;
  return {
    length,
    n: [z, 0, -x],
    x,
    z,
    a,
    b,
    at: (u, y, d = 0) => [a[0] + x * u + z * d, y, a[1] + z * u - x * d],
  };
}
function panel(out, slot, edge, left, right, low, high, depth, color) {
  face(
    out,
    slot,
    [
      edge.at(left, low, depth),
      edge.at(right, low, depth),
      edge.at(right, high, depth),
      edge.at(left, high, depth),
    ],
    edge.n,
    color,
  );
}
function ledge(out, edge, left, right, low, high, depth, color, slot = 'brick') {
  panel(out, slot, edge, left, right, low, high, depth, color);
  face(
    out,
    slot,
    [
      edge.at(left, high, depth),
      edge.at(right, high, depth),
      edge.at(right, high),
      edge.at(left, high),
    ],
    up,
    color,
  );
}
function edgePoint(edge, u) {
  const point = edge.at(u, 0);
  return [point[0], point[2]];
}

function cut(ring, axis, limit, direction) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const inside = (a[axis] - limit) * direction >= 0.00001;
    const next = (b[axis] - limit) * direction >= 0.00001;
    if (inside) result.push(a);
    if (inside !== next) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((value, j) => value + (b[j] - value) * t));
    }
  }
  return result;
}

function bounds(ring) {
  const x = ring.map((p) => p[0]),
    z = ring.map((p) => p[1]);
  return [Math.min(...x), Math.max(...x), Math.min(...z), Math.max(...z)];
}

function archedPane(out, f, u, y, h, w, lod, door = false) {
  const half = w / 2;
  const rise = door ? 0.38 : 0.24;
  const left = u - half;
  const right = u + half;
  const head = y + h - rise;
  const recess = door ? colors.deep : colors.glass;
  panel(out, 'detail', f, left, right, y, head, 0.047, recess);
  const detail = lod >= 2 ? (lod === 3 ? 7 : 4) : 2;
  const arc = (r, dy, d) =>
    Array.from({ length: detail + 1 }, (_, i) => {
      const angle = (Math.PI * i) / detail;
      return f.at(u - r * Math.cos(angle), head + (rise + dy) * Math.sin(angle), d);
    });
  const upper = arc(half, 0, 0.049);
  for (let i = 0; i < upper.length - 2; i++)
    face(out, 'detail', [upper[0], upper[i + 1], upper[i + 2]], f.n, recess);
  if (lod === 0) return;
  if (lod === 1) {
    panel(out, 'brick', f, left - 0.09, right + 0.09, y - 0.08, y + 0.013, 0.105, colors.reveal);
    return;
  }
  const trim = arc(half + 0.13, 0.15, 0.094);
  for (let i = 0; i < detail; i++)
    face(out, 'brick', [upper[i], upper[i + 1], trim[i + 1], trim[i]], f.n, colors.reveal);
  ledge(out, f, left - 0.12, right + 0.12, y - 0.105, y + 0.01, 0.16, colors.reveal);
  if (lod > 1) {
    ledge(out, f, left - 0.11, left, y, head, 0.095, colors.reveal);
    ledge(out, f, right, right + 0.11, y, head, 0.095, colors.reveal);
    for (const x of [u, ...(door ? [u - w * 0.24, u + w * 0.24] : [])])
      panel(out, 'detail', f, x - 0.023, x + 0.023, y + 0.08, head - 0.02, 0.061, colors.mullion);
    panel(out, 'detail', f, left, right, y + h * 0.53, y + h * 0.53 + 0.04, 0.063, colors.mullion);
  }
}

function facade(out, f, lod, plaza, pavilionXs) {
  panel(out, 'stone', f, 0, f.length, minimumFoundation, base, 0, colors.plinth);
  panel(out, 'brick', f, 0, f.length, base, eaves, 0, plaza ? colors.brickSun : colors.brick);
  for (const y of [base, 4.84, 8.81, 12.49])
    ledge(
      out,
      f,
      0,
      f.length,
      y - 0.15,
      y - 0.025,
      0.12,
      y === base ? colors.trim : colors.pilaster,
      y === base ? 'stone' : 'brick',
    );
  const isLong = f.length > 30;
  const count = Math.max(2, Math.round(f.length / (lod === 0 ? 10.8 : isLong ? 4.4 : 3.27)));
  const bay = f.length / count;
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) * bay;
    const loading = isLong && plaza && [1, 5, 9, 13, 17, 21, 25, 29].includes(i);
    for (const [level, y] of levels.entries())
      archedPane(
        out,
        f,
        u,
        loading && level === 0 ? base + 0.05 : y,
        loading && level === 0 ? 2.64 : 1.71,
        loading && level === 0 ? 1.59 : !isLong ? 1.04 : 1.02,
        lod,
        loading,
      );
    if (i % (lod === 0 ? 3 : 2) !== 0) continue;
    ledge(out, f, i * bay + 0.11, i * bay + 0.54, base, eaves + 0.23, 0.27, colors.pilaster);
    ledge(
      out,
      f,
      i * bay + 0.02,
      i * bay + 0.63,
      eaves - 0.25,
      eaves + 0.28,
      0.415,
      colors.brickSun,
    );
  }
  if (!plaza) return;
  for (const x of pavilionXs) {
    const u = (x - f.a[0]) / f.x;
    if (u > 3.25 && u < f.length - 3.25) cargoGable(out, f, u, lod);
  }
}

function cargoGable(out, f, u, lod) {
  const half = 2.8;
  const high = eaves + 2.3;
  const left = u - half,
    right = u + half;
  const front = 0.39;
  const po = [
    f.at(left, eaves - 0.01, front),
    f.at(right, eaves - 0.01, front),
    f.at(u, high, front),
  ];
  face(out, 'brick', po, f.n, colors.brickSun);
  face(
    out,
    'roof',
    [po[0], po[2], f.at(u, high + 0.87, -3.9), f.at(left, eaves + 1.03, -3.9)],
    up,
    colors.roofDark,
  );
  face(
    out,
    'roof',
    [po[2], po[1], f.at(right, eaves + 1.03, -3.9), f.at(u, high + 0.87, -3.9)],
    up,
    colors.roof,
  );
  ledge(out, f, left, left + 0.36, base + 0.1, eaves + 0.26, 0.63, colors.pilaster);
  ledge(out, f, right - 0.36, right, base + 0.1, eaves + 0.26, 0.63, colors.pilaster);
  if (lod > 0) {
    beam(out, 'brick', po[0], po[2], 0.18, 0.22, colors.pilaster);
    beam(out, 'brick', po[2], po[1], 0.18, 0.22, colors.pilaster);
    panel(
      out,
      'detail',
      f,
      u - 0.39,
      u + 0.39,
      eaves + 0.4,
      eaves + 1.02,
      front + 0.031,
      colors.deep,
    );
  }
}

function loadingGallery(out, f, lod) {
  const left = 2.75,
    right = f.length - 2.75;
  const stops = Math.max(2, Math.round((right - left) / (lod < 2 ? 8.8 : 4.85)));
  const levels = [0.46, 4.91, 8.75];
  for (const y of levels) {
    const a = f.at(left, y, -0.04),
      b = f.at(right, y, -0.04);
    const c = f.at(right, y - 0.03, 1.65),
      d = f.at(left, y - 0.03, 1.65);
    face(out, 'iron', [a, b, c, d], up, colors.shed);
    panel(out, 'iron', f, left, right, y - 0.17, y + 0.032, 1.67, colors.iron);
    if (y > 1.0) panel(out, 'iron', f, left, right, y + 0.92, y + 1.0, 1.635, colors.iron);
  }
  const roofY = 12.3;
  face(
    out,
    'roof',
    [
      f.at(left, roofY, -0.02),
      f.at(right, roofY, -0.02),
      f.at(right, roofY - 0.42, 1.78),
      f.at(left, roofY - 0.42, 1.78),
    ],
    up,
    colors.roofDark,
  );
  for (let i = 0; i <= stops; i++) {
    const u = left + ((right - left) * i) / stops;
    if (lod < 2) panel(out, 'iron', f, u - 0.06, u + 0.06, base, roofY - 0.44, 1.67, colors.iron);
    else {
      beam(
        out,
        'iron',
        f.at(u, base, 1.65),
        f.at(u, roofY - 0.42, 1.65),
        0.165,
        0.165,
        colors.iron,
      );
      for (const y of [4.91, 8.75]) {
        beam(
          out,
          'iron',
          f.at(u, y - 0.62, 0.24),
          f.at(u, y - 0.06, 1.59),
          0.084,
          0.081,
          colors.iron,
        );
      }
    }
  }
}

function roofs(out, ring, long, lod) {
  const [lo, hi, zMin, zMax] = bounds(ring);
  const r = (zMax - zMin) / 2,
    center = (zMax + zMin) / 2;
  const roofAt = ([x, z]) =>
    eaves +
    (totalHeight - eaves) *
      Math.max(
        0.0,
        Math.min(
          1 - Math.abs(z - center) / r,
          long ? (x - lo) / (0.88 * r) : 1,
          long ? (hi - x) / (0.88 * r) : 1,
        ),
      );
  const boundaries = long
    ? [lo - 1, lo + 0.88 * r, ...innerPavilionIntervals[1], hi - 0.88 * r, hi + 1]
    : [lo - 1, ...innerPavilionIntervals[0], hi + 1];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const strip = cut(cut(ring, 0, boundaries[i], 1), 0, boundaries[i + 1], -1);
    if (strip.length < 3) continue;
    for (const side of [-1, 1]) {
      const slope = cut(strip, 1, center, side);
      if (slope.length > 2) cap(out, 'roof', slope, roofAt, i % 2 ? colors.roofDark : colors.roof);
    }
  }
  const x1 = lo + (long ? 0.88 * r : 0);
  const x2 = hi - (long ? 0.88 * r : 0);
  beam(
    out,
    'iron',
    [x1, totalHeight + 0.028, center],
    [x2, totalHeight + 0.028, center],
    0.13,
    0.17,
    colors.lead,
  );
  if (lod > 0) {
    for (const x of innerPavilionIntervals[long ? 1 : 0]) {
      for (const z of [zMin + 0.54, zMax - 0.54]) {
        const top = roofAt([x, z]);
        beam(
          out,
          'iron',
          [x, totalHeight + 0.06, center],
          [x, top + 0.055, z],
          0.13,
          0.145,
          colors.lead,
        );
      }
      if (lod > 1)
        box(
          out,
          'brick',
          [x - 0.19, totalHeight - 0.13, center - 0.19],
          [x + 0.19, totalHeight + 0.65, center + 0.19],
          colors.pilaster,
        );
    }
  }
  for (const [i, [a, b]] of directedEdges(ring).entries()) {
    const f = frame(a, b);
    if (f.length > 30) continue;
    const mid = edgePoint(f, f.length / 2);
    face(out, 'brick', [at(a, eaves), at(b, eaves), at(mid, roofAt(mid))], f.n, colors.brickSun);
    if (!long && lod > 0) {
      for (const [p, q] of [
        [a, mid],
        [mid, b],
      ])
        beam(
          out,
          'brick',
          at(p, roofAt(p) + 0.05),
          at(q, roofAt(q) + 0.052),
          0.21,
          0.26,
          i % 2 ? colors.pilaster : colors.brickSun,
        );
    }
  }
}

function warehouse(out, ring, long, lod) {
  for (const [a, b] of directedEdges(ring)) {
    const f = frame(a, b);
    const plaza = f.length > 50 && (long ? f.n[2] > 0.8 : f.n[2] < -0.8);
    facade(out, f, lod, plaza, innerPavilionIntervals[long ? 1 : 0]);
    if (!long && f.length > 50 && f.n[2] > 0.8 && lod > 0) loadingGallery(out, f, lod);
  }
  roofs(out, ring, long, lod);
}
function build(out, lod) {
  warehouse(out, shortOutline, false, lod);
  warehouse(out, longOutline, true, lod);
}
export const warehouseSkyline = (out) => build(out, 0);
export const warehouseDistrict = (out) => build(out, 1);
export const warehouseStreet = (out) => build(out, 2);
export const warehouseCloseup = (out) => build(out, 3);

const recipe = 'yokohama-red-brick-warehouse-model.mjs';
const camera = [143, 64, 119],
  lookAt = [23, 5.7, -5];
export const yokohamaWarehouseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  category: 'landmark',
  build: warehouseCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: longOutline,
    outlines: [shortOutline],
    minimumCoverage: 0.995,
    basis: 'The two exact named warehouse exterior outlines leave the event plaza open.',
  },
  brief:
    'Shinko’s two red brick commercial warehouses, with the shorter post-earthquake hall, loading galleries, punched openings and repeated gables across the open event plaza.',
  camera,
  lookAt,
  sunDirection: [-38, 94, 114],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.68,
    cameraYaw: 0.91,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'two-warehouses-across-the-plaza', position: [143, 57, 89], lookAt: [24, 6.1, -7] },
    {
      name: 'red-brick-storeys-and-pier-gables',
      position: [123, 14, -0.5],
      lookAt: [42, 8.2, -27],
    },
    { name: 'short-warehouse-loading-gallery', position: [123, 16, 67], lookAt: [63, 6.6, 22] },
    {
      name: 'long-warehouse-hipped-roof-and-gables',
      position: [-36, 42, 28],
      lookAt: [22, 10.4, -43],
    },
    { name: 'three-arched-window-bands', position: [63, 7.2, -3.5], lookAt: [56, 6.8, -28] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `warehouses-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'warehouseSkyline',
    errorMeters: 1.18,
    surfaces,
    authoredLevels: {
      district: { export: 'warehouseDistrict', errorMeters: 0.56, surfaces },
      street: { export: 'warehouseStreet', errorMeters: 0.23, surfaces },
      closeup: { export: 'warehouseCloseup', errorMeters: 0.087, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on Binh Giang’s public-domain photograph, Yokohama Port Bureau documentation, ODbL OpenStreetMap and GSI DEM5A terrain.',
};
