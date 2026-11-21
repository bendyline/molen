import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { buildChineseHipRoof } from '../../../../../../../../packages/worldgen/scripts/chinese-roof-geometry.mjs';
import {
  arch,
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import controls from '../plan-controls.json' with { type: 'json' };

const surfaces = {
  wall: surface('wall', 'plaster_lime'),
  tile: surface('roof', 'tile_ceramic'),
  glaze: surface('trim', 'tile_glazed', 0.66, 0.04),
  foundation: surface('foundation', 'stone_ashlar'),
  timber: surface('wall', 'wood_plain'),
  metal: surface('trim', 'metal_bronze_cast', 0.58, 0.29),
};
const C = palette({
  cream: 'b8a783',
  stone: 'a49a87',
  pale: 'd5c6a8',
  roof: '4e5967',
  red: '98624f',
  navy: '505d6b',
  teal: '608982',
  gold: 'b49a67',
  green: '82966e',
  arc: '5e635d',
  dark: '423b33',
  copper: '9c825a',
});
const tileColors = [C.teal, C.navy, C.gold, C.red, C.green, C.pale];

function roof(out, lod, metrics) {
  const draw = (slot, points, normal) => face(out, slot, points, normal, C.roof);
  buildChineseHipRoof(draw, metrics, lod, 'tile');
}

function trimBand(out, w, left, right, y, h, lod, ornament = true) {
  if (right - left < 0.2) return;
  if (lod >= 2) {
    trimBlock(out, 'glaze', w, left, right, y, y + h, 0.009, 0.16, C.teal);
    panel(out, 'glaze', w, left, right, y + h * 0.07, y + h * 0.18, 0.189, C.pale);
    panel(out, 'glaze', w, left, right, y + h * 0.81, y + h * 0.94, 0.19, C.pale);
  } else {
    panel(out, 'glaze', w, left, right, y, y + h, 0.049, C.teal);
  }
  if (lod < 2 || !ornament) return;
  const n = Math.max(2, Math.ceil((right - left) / (lod === 3 ? 0.42 : 0.86)));
  const dx = (right - left) / n;
  const off = 0.192,
    mid = y + h * 0.5;
  for (let i = 0; i < n; i++) {
    const u = left + dx * (i + 0.5);
    face(
      out,
      'glaze',
      [
        w.p(u - dx * 0.36, mid, off),
        w.p(u, mid - h * 0.23, off),
        w.p(u + dx * 0.36, mid, off),
        w.p(u, mid + h * 0.23, off),
      ],
      w.normal,
      tileColors[(i + (n % 4)) % tileColors.length],
    );
  }
}

function roundPlinth(out, points, grade, top) {
  shell(out, points, (p) => Math.min(top - 0.25, grade(p) - 0.3), top, {
    wall: 'foundation',
    color: C.stone,
    roofColor: C.pale,
  });
}

function towerFoot(p, spanX, spanZ) {
  const [x, z] = p;
  const s = spanX / 2,
    t = spanZ / 2;
  const a = s * 0.68,
    b = t * 0.68;
  return [
    [x - a, z - t],
    [x + a, z - t],
    [x + s, z - b],
    [x + s, z + b],
    [x + a, z + t],
    [x - a, z + t],
    [x - s, z + b],
    [x - s, z - b],
  ];
}

function spire(out, at, start, h, lod) {
  const n = [6, 8, 12, 16][lod];
  if (lod < 2) {
    ring(
      out,
      'glaze',
      at,
      [
        [start, h * 0.36],
        [start + h * 0.32, h * 0.32],
        [start + h * 0.67, h * 0.15],
        [start + h, 0.04],
      ],
      n,
      C.pale,
    );
    return;
  }
  ring(
    out,
    'glaze',
    at,
    [
      [start, h * 0.36],
      [start + h * 0.14, h * 0.4],
      [start + h * 0.35, h * 0.28],
      [start + h * 0.52, h * 0.25],
      [start + h * 0.72, h * 0.16],
      [start + h * 0.83, h * 0.13],
      [start + h * 0.99, 0.055],
      [start + h, 0.038],
    ],
    n,
    C.pale,
  );
}

function pilaster(out, x, z, base, h, lod) {
  const n = [5, 6, 10, 12][lod];
  const r = h > 4.4 ? 0.31 : 0.22;
  if (lod === 0) {
    block(out, 'glaze', x - r, base, z - r, r * 2, h, r * 2, C.pale);
    return;
  }
  ring(
    out,
    'glaze',
    [x, z],
    [
      [base, r * 1.2],
      [base + 0.29, r],
      [base + h - 0.3, r * 0.83],
      [base + h, r],
    ],
    n,
    C.pale,
  );
  if (lod >= 2) {
    for (const [i, y] of [base + h * 0.24, base + h * 0.58, base + h * 0.82].entries()) {
      ring(
        out,
        'glaze',
        [x, z],
        [
          [y - 0.13, r * 1.05],
          [y + 0.1, r * 1.1],
        ],
        n,
        tileColors[i],
      );
    }
  }
}

function glazedPanel(out, w, left, right, bottom, height, lod) {
  panel(out, 'glaze', w, left, right, bottom, bottom + height, 0.17, C.pale);
  trimBand(out, w, left + 0.08, right - 0.08, bottom + 0.17, height * 0.25, lod);
  trimBand(out, w, left + 0.08, right - 0.08, bottom + height * 0.61, height * 0.23, lod);
}

function archOpening(out, w, center, base, spring, radius, rise, y, lod, depth) {
  const n = [4, 6, 10, 14][lod];
  for (let i = 0; i < n; i++) {
    const p = (Math.PI * i) / n,
      q = (Math.PI * (i + 1)) / n;
    const x = center + radius * Math.cos(p),
      u = center + radius * Math.cos(q);
    const h = spring + rise * Math.sin(p),
      k = spring + rise * Math.sin(q);
    face(out, 'wall', [w.p(x, h), w.p(u, k), w.p(u, y), w.p(x, y)], w.normal, C.cream);
    if (lod > 0) {
      face(
        out,
        'glaze',
        [w.p(x, h, 0.04), w.p(u, k, 0.04), w.p(u, k + 0.17, 0.06), w.p(x, h + 0.17, 0.06)],
        w.normal,
        C.teal,
      );
      face(
        out,
        'wall',
        [w.p(x, h), w.p(u, k), w.p(u, k, -depth), w.p(x, h, -depth)],
        [0, -1, 0],
        C.pale,
      );
    }
  }
  for (const dir of [-1, 1]) {
    const x = center + dir * radius;
    if (lod > 0)
      trimBlock(out, 'glaze', w, x - 0.094, x + 0.094, base, spring, -0.21, 0.13, C.teal);
  }
}

function frontEntrance(out, lod, grade, y) {
  const z = -7.03;
  const w = plane(z, -1);
  const top = y + 5.1;
  const openings = [
    { x: -3.97, radius: 1.1, spring: y + 2.42, rise: 0.84 },
    { x: 0, radius: 2.02, spring: y + 2.88, rise: 1.28 },
    { x: 3.97, radius: 1.1, spring: y + 2.42, rise: 0.84 },
  ];
  let cursor = -8.7;
  for (const { x, radius, spring, rise } of openings) {
    panel(out, 'wall', w, cursor, x - radius, y, top, 0, C.cream);
    archOpening(out, w, x, y, spring, radius, rise, top, lod, 0.69);
    cursor = x + radius;
  }
  panel(out, 'wall', w, cursor, 8.7, y, top, 0, C.cream);
  trimBand(out, w, -8.6, 8.6, y + 4.57, 0.48, lod);
  trimBand(out, w, -8.62, -5.13, y + 0.24, 0.36, lod);
  trimBand(out, w, 5.13, 8.62, y + 0.24, 0.36, lod);
  for (const x of [-8.2, -5.5, -2.45, 2.45, 5.5, 8.2]) {
    pilaster(out, x, z - 0.21, y, 4.8, lod);
    if (lod >= 2 && Math.abs(x) === 8.2) glazedPanel(out, w, x - 0.6, x + 0.6, y + 0.82, 2.15, lod);
  }
  const side = rect(-8.7, z, 8.7, -1.85);
  shell(
    out,
    side,
    () => y,
    top - 0.11,
    {
      wall: 'wall',
      color: C.cream,
      roof: 'foundation',
      roofColor: C.stone,
    },
    (i) => i !== 0 && i !== 2,
  );
  panel(out, 'timber', plane(-1.87, -1), -8.65, 8.65, y, top - 0.4, 0.01, C.dark);
  roof(out, lod, { x: 0, z: -4.83, width: 17.5, depth: 6.2, low: y + 5.03, rise: 1.26 });
  if (lod > 0)
    roof(out, lod, { x: 0, z: -7.47, width: 6.1, depth: 2.19, low: y + 5.38, rise: 1.05 });
  stairs(out, grade, 'foundation', -5.69, 5.69, -11.03, -8.12, y, lod >= 2 ? 7 : 3, C.stone);
}

function outerShrine(out, lod, x, y) {
  const z = -3.3;
  const foundation = y + 5.1;
  const first = towerFoot([x, z], 4.78, 4.34);
  shell(out, first, () => foundation, foundation + 4.05, { wall: 'wall', color: C.cream });
  const w = plane(z - 2.18, -1);
  arch(
    out,
    w,
    x,
    foundation + 0.55,
    foundation + 2.22,
    0.87,
    0.78,
    0.051,
    lod,
    { inner: C.dark, trim: C.teal, width: 0.14 },
    { inner: 'timber', trim: 'glaze' },
  );
  trimBand(out, w, x - 1.69, x + 1.69, foundation + 3.12, 0.49, lod);
  roof(out, lod, { x, z, width: 5.0, depth: 4.78, low: foundation + 3.98, rise: 1.47 });
  const high = foundation + 5.14;
  const upper = towerFoot([x, z], 3.55, 3.34);
  shell(out, upper, () => high, high + 2.4, { wall: 'wall', color: C.cream });
  const end = plane(z - 1.69, -1);
  arch(
    out,
    end,
    x,
    high + 0.45,
    high + 1.27,
    0.57,
    0.42,
    0.045,
    lod,
    { inner: C.arc, trim: C.gold, width: 0.105 },
    { inner: 'timber', trim: 'glaze' },
  );
  roof(out, lod, { x, z, width: 3.7, depth: 3.7, low: high + 2.3, rise: 1.4 });
  if (lod > 0) spire(out, [x, z], high + 3.66, 2.18, lod);
}

function octagonalLevel(out, lod, base, high, width, depth, balcony, open = false) {
  const center = [0, 1.85];
  const polygon = towerFoot(center, width, depth);
  const sign = areaSign(polygon);
  const style = { wall: 'wall', color: C.cream, roof: 'glaze', roofColor: C.pale };
  if (!open || lod === 0) {
    shell(out, polygon, () => base, high, style);
  } else {
    for (const [x, z] of polygon) pilaster(out, x, z, base, high - base, lod);
    cap(out, 'wall', polygon, high, C.pale);
    const bellY = base + (high - base) * 0.39;
    const r = width * 0.22;
    ring(
      out,
      'metal',
      center,
      [
        [bellY, r],
        [bellY + 0.11, r],
        [high - 0.45, r * 0.57],
        [high - 0.21, r * 0.32],
      ],
      lod === 3 ? 20 : 12,
      C.copper,
    );
  }
  if (balcony > 0) {
    const rail = towerFoot(center, width + balcony, depth + balcony);
    shell(out, rail, () => base - 0.32, base, { wall: 'glaze', color: C.pale, roofColor: C.stone });
    if (lod > 0)
      for (const [a, b] of pairs(closed(rail))) {
        const w = edge(a, b, sign);
        trimBand(out, w, 0.07, w.length - 0.07, base + 0.018, 0.56, lod);
      }
  }
  if (open || lod === 0) return;
  for (const [a, b] of pairs(closed(polygon))) {
    const w = edge(a, b, sign),
      span = w.length;
    if (span < 1.18) continue;
    const y = base + 0.42;
    trimBand(out, w, 0.1, span - 0.1, high - 0.68, 0.41, lod);
    if (w.normal[2] >= -0.35 && lod < 2) continue;
    arch(
      out,
      w,
      span / 2,
      y,
      base + (high - base) * 0.48,
      Math.min(1.03, span * 0.29),
      Math.min(0.61, (high - base) * 0.28),
      0.049,
      lod === 1 ? 0 : lod,
      { inner: C.arc, trim: C.teal, width: 0.12 },
      { inner: 'timber', trim: 'glaze' },
    );
  }
}

function bellTower(out, lod, grade, dimensions) {
  const ground = grade([0, -8.1]);
  const y = Math.max(0.12, ground + 0.72);
  roundPlinth(out, dimensions.outline, grade, y);
  frontEntrance(out, lod, grade, y);
  for (const x of [-6.25, 6.25]) outerShrine(out, lod, x, y);
  const levels = [
    { base: 0.0, top: 5.01, w: 11.3, d: 10.0, cornice: 0 },
    { base: 5.01, top: 11.55, w: 8.62, d: 7.9, cornice: 0.89 },
    { base: 11.55, top: 17.64, w: 6.58, d: 6.4, cornice: 1.45 },
    { base: 17.64, top: 23.42, w: 5.23, d: 5.15, cornice: 1.51, open: true },
    { base: 23.42, top: 27.95, w: 4.06, d: 3.9, cornice: 0.83 },
    { base: 27.95, top: 32.18, w: 3.1, d: 3.0, cornice: 0.74 },
    { base: 32.18, top: 35.05, w: 2.43, d: 2.4, cornice: 0.62 },
  ];
  for (const [index, layer] of levels.entries()) {
    const top = y + layer.top - (index > 3 ? 0.58 : 0.93);
    octagonalLevel(out, lod, y + layer.base, top, layer.w, layer.d, layer.cornice, layer.open);
    if (index === 3 && lod > 0) {
      ring(
        out,
        'glaze',
        [0, 1.85],
        [
          [top - 0.22, 3.41],
          [top + 0.13, 3.55],
          [top + 0.33, 3.36],
        ],
        lod === 3 ? 24 : 12,
        C.pale,
      );
    }
    if (index === 0 && lod === 0) continue;
    roof(out, lod, {
      x: 0,
      z: 1.85,
      width: layer.w + 0.7,
      depth: layer.d + 0.63,
      low: top - 0.02,
      rise: Math.min(1.25, Math.max(0.66, layer.w * 0.16)),
    });
  }
  spire(out, [0, 1.85], y + 35.05, dimensions.bellTowerHeightMeters - 35.05, lod);
}

function sideHall(out, lod, polygon, grade, metrics) {
  const center = planarMid(polygon);
  const base = Math.max(grade(center) + 0.46, ...polygon.map((p) => grade(p) + 0.09));
  const top = base + metrics.wallHeight;
  roundPlinth(out, polygon, grade, base);
  shell(out, polygon, () => base, top, { wall: 'wall', color: C.cream, roofColor: C.cream });
  const sign = areaSign(polygon);
  for (const [a, b] of pairs(closed(polygon))) {
    const w = edge(a, b, sign);
    if (w.length < 2.1) continue;
    trimBand(out, w, 0.1, w.length - 0.1, top - 0.65, 0.48, lod);
    if (lod < 1 || (lod === 1 && w.normal[2] > 0.13)) continue;
    const n = Math.max(
      1,
      Math.floor(w.length / (lod === 1 ? metrics.baySpacing * 1.65 : metrics.baySpacing)),
    );
    for (let i = 0; i < n; i++) {
      const u = (w.length * (i + 0.5)) / n;
      const high = Math.min(base + 2.75, top - 0.99);
      const radius = metrics.wallHeight > 4 ? 0.74 : 0.56;
      arch(
        out,
        w,
        u,
        base + 0.35,
        base + 1.64,
        radius,
        high - base - 1.64,
        0.047,
        lod === 1 ? 0 : lod,
        { inner: C.dark, trim: C.teal, width: 0.12 },
        { inner: 'timber', trim: 'glaze' },
      );
    }
  }
  roof(out, lod, {
    x: metrics.x ?? center[0],
    z: metrics.z ?? center[1],
    width: metrics.width,
    depth: metrics.depth,
    low: top - 0.035,
    rise: metrics.rise,
    angle: metrics.angle,
  });
}

function build(out, lod, dimensions, grade) {
  bellTower(out, lod, grade, dimensions);
  const main = dimensions.mainHall;
  const [width, depth] = dimensions.documentedHallDimensions;
  sideHall(out, lod, main.slice(1, 5), grade, {
    x: 27.65,
    z: 32.02,
    width,
    depth,
    angle: 1.203,
    wallHeight: 7.0,
    rise: 3.3,
    baySpacing: 3.3,
  });
  sideHall(out, lod, [main[0], main[1], ...main.slice(4)], grade, {
    x: 10.37,
    z: 19.5,
    width: 33.2,
    depth: 10.1,
    angle: -0.1,
    wallHeight: 6.6,
    rise: 2.6,
    baySpacing: 3.6,
  });
  sideHall(out, lod, dimensions.northHall, grade, {
    width: 27.6,
    depth: 15.5,
    angle: 1.85,
    wallHeight: 4.7,
    rise: 2.05,
    baySpacing: 3.7,
  });
  sideHall(out, lod, dimensions.courtyardSide, grade, {
    width: 31,
    depth: 14.0,
    angle: 1.86,
    wallHeight: 3.55,
    rise: 1.68,
    baySpacing: 4.2,
  });
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Linh Phước Temple in Trại Mát. Dark blue upturned tile eaves, ceramic bands and relief-like color accents, a seven-tier bell tower, twin lower shrines, and attached temple ranges on the original steep terrain.',
    camera: [52, 30, -77],
    lookAt: [4, 12, 1],
    sun: [-230, 510, -480],
    yaw: -0.64,
    views: [
      { name: 'three-portal-front-and-tower', position: [14, 10.4, -52], lookAt: [0, 17.3, 0] },
      { name: 'bell-storey-and-mosaic-eaves', position: [28, 34, -27], lookAt: [0, 20, 1] },
      { name: 'temple-and-south-ranges', position: [55, 29, 66], lookAt: [7, 8.5, 13] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'landmark';
model.recipeDependencies.push('chinese-roof-geometry.mjs', 'khmer-structure-geometry.mjs');
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.88,
  basis:
    'Replacing the exact named mapped volume of Linh Tháp while preserving other site buildings.',
};
