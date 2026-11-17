/** Exterior masonry and joinery for the registered Tytuvėnai service buildings. */
import {
  arch,
  areaSign,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  shell,
} from './montreal-museum-pavilion-geometry.mjs';
import { blockBetween, churchModel, gable, plinth, wallX } from './tytuvenai-ensemble-geometry.mjs';

const colors = palette({
  lime: 'd6c9b4',
  trim: 'e0d0b7',
  brick: 'a46c54',
  stone: 'a29884',
  roof: 'aa664d',
  barnRoof: '876050',
  glass: '535958',
  wood: '6c5140',
  jamb: 'c6b392',
});

function halfHippedRoof(out, [left, right, north, south], eave, rise) {
  const center = (north + south) / 2;
  const width = (south - north) / 2;
  const cut = eave + 0.53 * rise;
  const span = width * 0.47;
  const ends = [left + 1.42, right - 1.42];
  const peaks = ends.map((x) => [x, eave + rise, center]);
  for (const [z, sign] of [
    [north, -1],
    [south, 1],
  ]) {
    face(
      out,
      'tile',
      [
        [left, eave, z],
        [right, eave, z],
        [right, cut, center + span * sign],
        peaks[1],
        peaks[0],
        [left, cut, center + span * sign],
      ],
      [0, 1, 0],
      colors.roof,
    );
  }
  for (const [index, x, normal] of [
    [0, left, -1],
    [1, right, 1],
  ]) {
    const h0 = [x, cut, center - span],
      h1 = [x, cut, center + span];
    face(out, 'tile', [h0, h1, peaks[index]], [normal, 0.55, 0], colors.roof);
    face(out, 'plaster', [[x, eave, north], [x, eave, south], h1, h0], [normal, 0, 0], colors.lime);
  }
}

function circleWindow(out, lod, wall, center, y, radius) {
  const n = [8, 10, 14, 18][lod];
  const ring = (r, d) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return wall.p(center + r * Math.cos(a), y + r * Math.sin(a), d);
    });
  face(out, 'glass', ring(radius, 0.028), wall.normal, colors.glass);
  if (lod === 0) return;
  const inner = ring(radius, 0.05),
    outer = ring(radius + 0.09, 0.06);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(out, 'plaster', [inner[i], inner[j], outer[j], outer[i]], wall.normal, colors.trim);
  }
}

function door(out, lod, wall, u, floor, width, height, rise) {
  arch(
    out,
    wall,
    u,
    floor + 0.065,
    floor + height - rise,
    width / 2,
    rise,
    0.038,
    lod,
    { inner: colors.wood, trim: colors.jamb, width: 0.13 },
    { inner: 'wood', trim: 'plaster' },
  );
  if (lod === 3)
    panel(
      out,
      'plaster',
      wall,
      u - 0.02,
      u + 0.02,
      floor + 0.14,
      floor + height - rise,
      0.063,
      colors.trim,
    );
}

function window(out, lod, wall, x, y, width, height) {
  opening(
    out,
    wall,
    x - width / 2,
    x + width / 2,
    y,
    y + height,
    'plaster',
    colors.glass,
    'glass',
    colors.jamb,
    lod,
    0.042,
  );
  if (lod > 1)
    panel(
      out,
      'plaster',
      wall,
      x - width / 2 - 0.088,
      x + width / 2 + 0.088,
      y - 0.1,
      y + 0.016,
      0.101,
      colors.trim,
    );
  if (lod > 2)
    panel(
      out,
      'plaster',
      wall,
      x - width / 2,
      x + width / 2,
      y + height * 0.48,
      y + height * 0.54,
      0.082,
      colors.trim,
    );
}

function residence(out, lod, outline, floor, eave, rise, kind) {
  const xs = outline.map((p) => p[0]),
    zs = outline.map((p) => p[1]);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    north = Math.min(...zs),
    south = Math.max(...zs);
  const westEnd = wallX(left, -1),
    eastEnd = wallX(right, 1);
  const granary = kind === 'granary';
  const xRoofStart = granary ? left - 0.18 : left;
  const xRoofEnd = granary ? right : right + 0.2;
  const halfWidth = (south - north) / 2 + 0.17;
  const center = (south + north) / 2;
  if (granary) {
    halfHippedRoof(out, [xRoofStart, xRoofEnd, north - 0.17, south + 0.17], eave, rise);
    circleWindow(out, lod, wallX(xRoofStart, -1), center, eave + 0.79, 0.46);
    circleWindow(out, lod, wallX(xRoofEnd, 1), center, eave + 0.79, 0.46);
    door(out, lod, westEnd, -0.5, floor, 1.24, 2.38, 0.36);
    const vent = [left + 3.45, left + 4.27, north + 2.78, north + 3.52];
    blockBetween(out, 'plaster', vent, eave + 0.4, eave + 2.75, colors.lime);
    if (lod > 0)
      blockBetween(
        out,
        'stone',
        [vent[0] - 0.08, vent[1] + 0.08, vent[2] - 0.08, vent[3] + 0.08],
        eave + 2.64,
        eave + 2.82,
        colors.stone,
      );
  } else {
    gable(
      out,
      [xRoofStart, center],
      [xRoofEnd, center],
      halfWidth,
      eave,
      rise,
      colors.roof,
      'plaster',
      colors.lime,
    );
    const chimney = [right - 4.31, right - 3.52, center - 0.58, center + 0.36];
    blockBetween(out, 'plaster', chimney, eave + 1.7, eave + 3.47, colors.lime);
    if (lod > 0)
      blockBetween(
        out,
        'plaster',
        [chimney[0] - 0.08, chimney[1] + 0.08, chimney[2] - 0.08, chimney[3] + 0.08],
        eave + 3.31,
        eave + 3.51,
        colors.trim,
      );
    window(out, lod, eastEnd, 0.28, floor + 1.18, 0.91, 1.32);
  }
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, areaSign(outline));
    if (w.length < 16) continue;
    const n = granary ? 5 : 6;
    if (lod > 0) panel(out, 'plaster', w, 0, w.length, eave - 0.25, eave, 0.097, colors.trim);
    for (let i = 0; i < n; i++) {
      const x = (w.length * (i + 0.5)) / n;
      if (!granary && i === 2) door(out, lod, w, x, floor, 1.19, 2.29, 0.16);
      else window(out, lod, w, x, floor + 1.12, granary ? 0.9 : 0.98, 1.24);
      if (granary) window(out, lod, w, x, floor + 4.06, 0.82, 1.32);
    }
  }
}

function livestockBarn(out, lod, outline, floor, eave, rise, kind) {
  const xs = outline.map((p) => p[0]),
    zs = outline.map((p) => p[1]);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    north = Math.min(...zs),
    south = Math.max(...zs);
  const first = kind === 'first-barn';
  const center = (south + north) / 2,
    half = (south - north) / 2 + 0.15;
  gable(
    out,
    [left - (first ? 0.14 : 0), center],
    [right + (first ? 0 : 0.14), center],
    half,
    eave,
    rise,
    colors.barnRoof,
    'brick',
    colors.brick,
  );
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, areaSign(outline));
    if (w.length < 4.3) continue;
    if (lod > 0) panel(out, 'brick', w, 0, w.length, eave - 0.2, eave, 0.129, colors.brick);
    if (w.length < 15) {
      if (lod > 1 && (first ? w.normal[0] < -0.78 : w.normal[0] > 0.78))
        window(out, lod, w, w.length / 2, eave + 0.5, 0.66, 0.44);
      continue;
    }
    const n = Math.round(w.length / (first ? 5.9 : 5.6));
    for (let i = 0; i < n; i++) {
      const u = (w.length * (i + 0.5)) / n;
      if (i === Math.floor(n / 2) || (first && i === 1))
        door(out, lod, w, u, floor, first ? 2.64 : 2.21, first ? 3.15 : 2.83, 0.52);
      else window(out, lod, w, u, floor + 1.4, first ? 0.76 : 0.64, 0.71);
      if (!first && lod > 1 && i % 2 === 0)
        panel(out, 'glass', w, u - 0.25, u + 0.25, floor - 0.21, floor + 0.06, 0.066, colors.glass);
    }
  }
}

function draw(out, lod, { outline, kind, floor, eaves, rise }, grade) {
  const eave = floor + eaves;
  const barn = kind === 'first-barn' || kind === 'second-barn';
  const slot = barn ? 'brick' : 'plaster';
  const color = barn ? colors.brick : colors.lime;
  plinth(out, outline, floor, grade, colors.stone);
  shell(out, outline, () => floor + 0.18, eave, { wall: slot, color });
  if (barn) livestockBarn(out, lod, outline, floor, eave, rise, kind);
  else residence(out, lod, outline, floor, eave, rise, kind);
}

export function outbuildingModel(url, config) {
  const slots = ['plaster', 'stone', 'tile', 'glass', 'wood'];
  if (config.barn) slots.unshift('brick');
  const asset = churchModel(url, { ...config, slots }, draw);
  asset.model.category = 'house';
  asset.model.sourceLicense =
    'Independent reconstruction from the Lithuanian heritage register, national cadastral geometry, OpenStreetMap and open terrain tiles.';
  asset.model.recipeDependencies.push('tytuvenai-outbuilding-geometry.mjs');
  return asset;
}
