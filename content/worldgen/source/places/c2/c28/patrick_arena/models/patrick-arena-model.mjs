import { readFileSync } from 'node:fs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import {
  block,
  face,
  mix,
  pairs,
  palette,
  panel,
  plane,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const x = d.width / 2;
const z = d.depth / 2;
const base = d.floor;
const eave = base + d.eaveHeight;
const rise = d.ridgeHeight - d.eaveHeight;
const radius = (x * x + rise * rise) / (2 * rise);
const circleBase = eave - (radius - rise);

const color = palette({
  siding: '6f534b',
  tower: '624842',
  trim: 'ddd3bc',
  fascia: 'aa9a88',
  stone: '9e9483',
  roof: '777a74',
  seam: '656b68',
  glass: '34474a',
  glassLight: '566669',
  woodPanel: 'aa9783',
  door: '4c4335',
});
const surfaces = {
  wall: surface('wall', 'wood_painted_lap'),
  trim: surface('trim', 'wood_painted_shingle', 0.84),
  roof: surface('roof', 'metal_painted', 0.76, 0.11),
  base: surface('foundation', 'stone_limestone_raw', 0.93),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0 },
};

const roofY = (u) => circleBase + Math.sqrt(radius * radius - u * u);
const sidePlane = (wallX, facing) => ({
  normal: [facing, 0, 0],
  p: (u, h, offset = 0) => [wallX + facing * offset, h, u],
});
const front = plane(z, 1);
const back = plane(-z, -1);

function curve(lod) {
  const divisions = [10, 16, 24, 36][lod];
  return Array.from({ length: divisions + 1 }, (_, i) => {
    const u = mix(-x, x, i / divisions);
    return [u, roofY(u)];
  });
}

function barrel(out, lod) {
  for (const [[a, ha], [b, hb]] of pairs(curve(lod))) {
    face(
      out,
      'roof',
      [
        [a, ha + 0.12, -z - 0.33],
        [b, hb + 0.12, -z - 0.33],
        [b, hb + 0.12, z + 0.33],
        [a, ha + 0.12, z + 0.33],
      ],
      [0, 1, 0],
      color.roof,
    );
    for (const w of [front, back]) {
      face(
        out,
        'wall',
        [w.p(a, eave - 0.06), w.p(b, eave - 0.06), w.p(b, hb), w.p(a, ha)],
        w.normal,
        color.siding,
      );
      const span = x - d.towerWidth + 0.14;
      const left = Math.max(a, -span);
      const right = Math.min(b, span);
      if (left >= right) continue;
      const low = mix(ha, hb, (left - a) / (b - a));
      const high = mix(ha, hb, (right - a) / (b - a));
      face(
        out,
        'trim',
        [
          w.p(left, low - 0.13, 0.33),
          w.p(right, high - 0.13, 0.33),
          w.p(right, high + 0.14, 0.33),
          w.p(left, low + 0.14, 0.33),
        ],
        w.normal,
        color.trim,
      );
    }
    if (lod < 3) continue;
    for (let section = 1; section <= 19; section++) {
      const along = mix(-z, z, section / 20);
      face(
        out,
        'roof',
        [
          [a, ha + 0.125, along],
          [b, hb + 0.125, along],
          [b, hb + 0.125, along + 0.06],
          [a, ha + 0.125, along + 0.06],
        ],
        [0, 1, 0],
        color.seam,
      );
    }
  }
}

function sash(out, wall, l, r, bottom, top, columns, bands, lod, frame = 0.12) {
  panel(out, 'glass', wall, l, r, bottom, top, 0.024, color.glass);
  if (lod > 1) {
    panel(
      out,
      'glass',
      wall,
      l + frame,
      r - frame,
      top - (top - bottom) * 0.34,
      top - frame,
      0.028,
      color.glassLight,
    );
  }
  for (const u of [l, r]) {
    panel(out, 'trim', wall, u - frame, u + frame, bottom - frame, top + frame, 0.046, color.trim);
  }
  for (const h of [bottom, top]) {
    panel(out, 'trim', wall, l - frame, r + frame, h - frame, h + frame, 0.049, color.trim);
  }
  if (lod === 0) return;
  for (let i = 1; i < columns; i++) {
    const u = mix(l, r, i / columns);
    panel(out, 'trim', wall, u - frame * 0.64, u + frame * 0.64, bottom, top, 0.052, color.trim);
  }
  for (const band of bands) {
    const h = mix(bottom, top, band);
    panel(out, 'trim', wall, l, r, h - frame * 0.62, h + frame * 0.62, 0.055, color.trim);
  }
}

function tower(out, side, end, lod) {
  const width = d.towerWidth;
  const depth = d.towerDepth;
  const offset = 0.14;
  const left = side < 0 ? -x - offset : x + offset - width;
  const frontZ = end < 0 ? -z - offset : z + offset - depth;
  const height = d.towerHeight;
  const roofZ = frontZ + 0.12 * end;
  const roofX = left + 0.12 * side;
  block(out, 'wall', left, base - 0.15, frontZ, width, height, depth, color.tower);
  block(
    out,
    'trim',
    roofX - 0.25,
    base + height - 0.24,
    roofZ - 0.23,
    width + 0.5,
    0.29,
    depth + 0.46,
    color.fascia,
  );
  block(
    out,
    'roof',
    roofX - 0.38,
    base + height + 0.05,
    roofZ - 0.37,
    width + 0.76,
    0.17,
    depth + 0.74,
    color.roof,
  );
  const outerEnd = plane(end * (z + offset), end);
  const outerSide = sidePlane(side * (x + offset), side);
  const mid = left + width * 0.53;
  const sideMid = frontZ + depth * 0.46;
  for (const h of [4.38, 7.48, 10.55, 13.56]) {
    sash(out, outerEnd, mid - 0.91, mid + 0.91, base + h, base + h + 1.45, 3, [0.53], lod);
    if (lod > 0) {
      sash(out, outerSide, sideMid - 0.7, sideMid + 0.7, base + h, base + h + 1.45, 2, [0.53], lod);
    }
  }
  panel(
    out,
    'glass',
    outerSide,
    sideMid - 0.77,
    sideMid + 0.77,
    base + 0.03,
    base + 2.19,
    0.044,
    color.door,
  );
}

function mainWindows(out, lod) {
  for (const u of [-10.1, 10.1]) {
    sash(
      out,
      front,
      u - 2.83,
      u + 2.83,
      base + 5.18,
      base + 12.86,
      2,
      [0.23, 0.54, 0.76],
      lod,
      0.17,
    );
  }
  for (const [l, r] of [
    [-3.61, -1.48],
    [1.48, 3.61],
  ]) {
    sash(out, front, l, r, base + 5.13, base + 14.07, 1, [0.24, 0.5, 0.73], lod, 0.17);
  }
  sash(out, front, -1.48, 1.48, base + 5.13, base + 15.36, 2, [0.2, 0.45, 0.66, 0.84], lod, 0.19);
  if (lod > 1) {
    for (const [l, r] of [
      [-12.93, -7.27],
      [-3.61, 3.61],
      [7.27, 12.93],
    ]) {
      panel(
        out,
        'trim',
        front,
        l + 0.16,
        r - 0.16,
        base + 5.23,
        base + 6.94,
        0.034,
        color.woodPanel,
      );
      panel(out, 'trim', front, l - 0.13, r + 0.13, base + 5.04, base + 5.2, 0.09, color.trim);
    }
  }
}

function entrance(out, lod) {
  const left = -16.2;
  const right = 16.2;
  block(out, 'trim', left, base + 3.13, z, right - left, 0.22, 0.52, color.trim);
  block(
    out,
    'base',
    left - 0.55,
    base - 0.35,
    z - 0.15,
    right - left + 1.1,
    0.33,
    1.48,
    color.stone,
  );
  const divisions = [7, 11, 14, 14][lod];
  for (let i = 0; i < divisions; i++) {
    const l = mix(left + 0.23, right - 0.23, i / divisions);
    const r = mix(left + 0.23, right - 0.23, (i + 1) / divisions);
    const door = Math.abs((l + r) / 2) < 4.8;
    sash(
      out,
      front,
      l + 0.17,
      r - 0.17,
      base + (door ? 0.08 : 0.81),
      base + 3.04,
      2,
      [0.76],
      lod,
      0.082,
    );
    if (lod > 1 && door) {
      panel(out, 'trim', front, l + 0.31, r - 0.31, base + 1.17, base + 1.26, 0.076, color.fascia);
    }
  }
}

function elevations(out, lod) {
  const sideBays = [7, 12, 14, 14][lod];
  for (const side of [-1, 1]) {
    const w = sidePlane(x * side, side);
    panel(out, 'trim', w, -z, z, eave - 0.16, eave + 0.065, 0.083, color.fascia);
    const lo = -z + d.towerDepth + 2.15;
    const hi = z - d.towerDepth - 2.15;
    for (let i = 0; i < sideBays; i++) {
      const mid = mix(lo, hi, i / (sideBays - 1));
      const upper = i % 3 === 1 ? 1.04 : 0.8;
      const lower = i % 4 === 1 ? 0.68 : 0.53;
      sash(out, w, mid - lower, mid + lower, base + 1.42, base + 3.04, 1, [0.67], lod, 0.083);
      sash(out, w, mid - upper, mid + upper, base + 5.3, base + 7.17, 3, [], lod, 0.094);
      if (lod > 2)
        panel(
          out,
          'trim',
          w,
          mid - 1.09,
          mid + 1.09,
          base + 5.24,
          base + 5.34,
          0.108,
          color.fascia,
        );
    }
    if (lod > 1) {
      for (const mid of [-24.5, 15.7]) {
        sash(out, w, mid - 0.78, mid + 0.78, base + 0.18, base + 2.49, 1, [0.76], lod);
      }
    }
  }
  for (const mid of [-11.9, -4, 4, 11.9]) {
    sash(out, back, mid - 1.1, mid + 1.1, base + 5.12, base + 7.27, 3, [0.68], lod);
  }
}

function build(out, lod) {
  block(
    out,
    'base',
    -x - 0.075,
    d.foundation,
    -z - 0.075,
    2 * x + 0.15,
    base - d.foundation + 0.16,
    2 * z + 0.15,
    color.stone,
  );
  block(out, 'wall', -x, base - 0.01, -z, 2 * x, eave - base, 2 * z, color.siding);
  barrel(out, lod);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) tower(out, side, end, lod);
  }
  mainWindows(out, lod);
  entrance(out, lod);
  elevations(out, lod);
  if (lod > 0)
    lettering(out, 'ARENA', {
      width: 10.45,
      height: 1.49,
      y: base + 16.5,
      z: z + 0.095,
      stroke: 0.15,
      color: color.trim,
      slot: 'trim',
    });
}

export const arenaSkyline = (out) => build(out, 0);
export const arenaDistrict = (out) => build(out, 1);
export const arenaStreet = (out) => build(out, 2);
export const arenaCloseup = (out) => build(out, 3);

const camera = [-91, 49, 128];
const lookAt = [-2, 7.7, 7];
const recipe = 'patrick-arena-model.mjs';
const terrain = {
  descriptor: 'terrain-review.terrain.json',
  heightmap: 'terrain-review.height.png',
};
export const arenaModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'performance-sport',
  surfaces,
  build: arenaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'Independent original DEM at the estimated front entrance line near Cadboro Bay Road.',
  brief:
    'Oak Bay’s 1911 timber ice arena as it appeared for the 1925 Stanley Cup, with its barrel roof, four square corner towers, tall sash windows and street-facing entrance.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-26, 44, 37],
  mediumFiContext: { scale: 1, terrain },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'stadium-lettering.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'arena-from-cadboro', position: [-53, 20, 117], lookAt: [0, 8, 42] },
    { name: 'west-tower-and-windows', position: [-51, 12, 37], lookAt: [-16, 7, 20] },
    { name: 'north-and-east-roofs', position: [85, 40, -112], lookAt: [1, 8, -7] },
    { name: 'front-print-geometry', position: [-5, 7, 130], lookAt: [0, 11, 47] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'arena-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'arenaSkyline',
    errorMeters: 1.9,
    surfaces,
    authoredLevels: {
      district: { export: 'arenaDistrict', errorMeters: 0.82, surfaces },
      street: { export: 'arenaStreet', errorMeters: 0.33, surfaces },
      closeup: { export: 'arenaCloseup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The Dwyer photograph published on January 2, 1912 is public domain. Street survey controls © OpenStreetMap contributors, ODbL 1.0.',
};
