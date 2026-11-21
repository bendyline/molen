import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  block,
  edge,
  face,
  opening,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  board: surface('wall', 'wood_plain'),
  roof: surface('roof', 'metal_corrugated', 0.75, 0.11),
  base: surface('foundation', 'concrete_plain'),
  trim: surface('trim', 'wood_plain'),
  window: surface('window', 'window_punched', 0.61),
};
const C = palette({
  board: 'ded6bb',
  exposed: 'd0c5a9',
  gable: 'e4dcc2',
  fascia: 'd1c9b0',
  dark: '6e7667',
  shadow: '626655',
  glass: '6d7970',
  iron: 'a0a5a1',
  ironShade: '8c9691',
  ironLight: 'afb4ad',
  base: 'a99b82',
  deck: 'a0937a',
});
const floor = 0.72;

function footing(out, grade, x, z, w, top = floor) {
  const base = grade([x, z]) - 0.14;
  block(out, 'base', x - w / 2, base, z - w / 2, w, top - base, w, C.base);
}

function liner(out, outline, top, color, lod, { windows = true, studwork = false } = {}) {
  shell(out, outline, () => floor, top, { wall: 'board', color, roofColor: color });
  for (let i = 0; i < outline.length; i++) {
    const wall = edge(outline[i], outline[(i + 1) % outline.length]);
    if (lod === 0 || !windows || wall.length < 4) continue;
    const n = Math.max(1, Math.round((wall.length - 1) / 3.25));
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) * wall.length) / n;
      opening(
        out,
        wall,
        x - 0.44,
        x + 0.44,
        1.76,
        Math.min(2.94, top - 0.54),
        'trim',
        C.glass,
        'window',
        C.fascia,
        lod,
        0.03,
      );
      if (lod >= 2) {
        const y = Math.min(3.09, top - 0.32);
        face(
          out,
          'roof',
          [
            wall.p(x - 0.64, y + 0.23, 0.015),
            wall.p(x + 0.64, y + 0.23, 0.015),
            wall.p(x + 0.64, y, 0.28),
            wall.p(x - 0.64, y, 0.28),
          ],
          up,
          C.ironShade,
        );
      }
    }
    if (studwork && lod >= 2)
      for (let x = 0.22; x < wall.length - 0.18; x += lod === 2 ? 1.08 : 0.59)
        panel(out, 'trim', wall, x, x + 0.063, floor + 0.05, top - 0.14, 0.018, C.exposed);
  }
}

function hip(out, x0, z0, x1, z1, eave, ridge, lod, color = C.iron) {
  const hipRun = Math.min((x1 - x0) / 2 - 0.14, (z1 - z0) * 0.46);
  const z = (z0 + z1) / 2;
  const corners = [
    [x0, eave, z0],
    [x1, eave, z0],
    [x1, eave, z1],
    [x0, eave, z1],
  ];
  const a = [x0 + hipRun, ridge, z];
  const b = [x1 - hipRun, ridge, z];
  face(out, 'roof', [corners[0], corners[1], b, a], up, C.ironShade);
  face(out, 'roof', [corners[1], corners[2], b], up, color);
  face(out, 'roof', [corners[2], corners[3], a, b], up, color);
  face(out, 'roof', [corners[3], corners[0], a], up, C.ironLight);
  if (lod > 0) {
    beam(out, 'roof', a, b, 0.13, 0.075, C.ironLight);
    for (let i = 0; i < corners.length; i++)
      beam(out, 'trim', corners[i], corners[(i + 1) % corners.length], 0.13, 0.12, C.fascia);
  }
}

function gable(out, left, right, center, half, eave, ridge, lod) {
  const north = center - half,
    south = center + half;
  const westPeak = [left, ridge, center],
    eastPeak = [right, ridge, center];
  const corners = [
    [left, eave, north],
    [right, eave, north],
    [right, eave, south],
    [left, eave, south],
  ];
  face(out, 'roof', [corners[0], corners[1], eastPeak, westPeak], up, C.ironShade);
  face(out, 'roof', [corners[2], corners[3], westPeak, eastPeak], up, C.ironLight);
  face(out, 'board', [corners[0], corners[3], westPeak], [-1, 0, 0], C.gable);
  face(out, 'board', [corners[1], corners[2], eastPeak], [1, 0, 0], C.gable);
  if (lod > 0) {
    beam(out, 'roof', westPeak, eastPeak, 0.12, 0.07, C.iron);
    for (const i of [0, 3]) beam(out, 'trim', corners[i], westPeak, 0.12, 0.09, C.fascia);
    for (const i of [1, 2]) beam(out, 'trim', corners[i], eastPeak, 0.12, 0.09, C.fascia);
  }
  if (lod >= 2) {
    const pitch = (ridge - eave) / half;
    const wall = edge([left, north], [left, south], -1);
    for (let y = eave + 0.22; y < ridge - 0.19; y += lod === 2 ? 0.31 : 0.15) {
      const trim = (y - eave) / pitch + 0.06;
      panel(out, 'trim', wall, trim, 2 * half - trim, y, y + 0.03, 0.024, C.exposed);
    }
  }
}

function veranda(out, grade, lod, a, b, width, eave, high, { rail = true, gap = 0 } = {}) {
  const wall = edge(a, b);
  const l = wall.length;
  const outerA = wall.p(0, eave),
    outerB = wall.p(l, eave);
  face(out, 'roof', [outerA, outerB, wall.p(l, high, -width), wall.p(0, high, -width)], up, C.iron);
  face(
    out,
    'trim',
    [wall.p(0, floor), wall.p(l, floor), wall.p(l, floor, -width), wall.p(0, floor, -width)],
    up,
    C.deck,
  );
  panel(out, 'trim', wall, 0, l, floor - 0.17, floor, 0.02, C.dark);
  if (lod > 0)
    beam(
      out,
      'trim',
      [outerA[0], eave - 0.09, outerA[2]],
      [outerB[0], eave - 0.09, outerB[2]],
      0.14,
      0.13,
      C.fascia,
    );
  const half = l * 0.5;
  const count = Math.max(2, Math.round(l / 2.6));
  const post = (u) => {
    const [x, , z] = wall.p(u, floor, -0.07);
    footing(out, grade, x, z, 0.28);
    block(out, 'trim', x - 0.057, floor, z - 0.057, 0.114, eave - floor, 0.114, C.fascia);
  };
  if (lod === 0) {
    post(0.08);
    post(l - 0.08);
    return;
  }
  for (let i = 0; i <= count; i++) {
    const u = 0.07 + ((l - 0.14) * i) / count;
    if (gap === 0 || Math.abs(u - half) > gap * 0.5) post(u);
  }
  if (gap > 0) for (const u of [half - gap / 2, half + gap / 2]) post(u);
  if (!rail || lod === 0) return;
  const runs =
    gap > 0
      ? [
          [0.05, half - gap / 2],
          [half + gap / 2, l - 0.05],
        ]
      : [[0.05, l - 0.05]];
  for (const [start, end] of runs) {
    for (const y of [floor + 0.16, floor + 0.95])
      beam(out, 'trim', wall.p(start, y, -0.07), wall.p(end, y, -0.07), 0.083, 0.065, C.dark);
    if (lod >= 2) {
      for (let u = start + 0.14; u < end - 0.11; u += lod === 2 ? 0.48 : 0.235)
        beam(
          out,
          'trim',
          wall.p(u, floor + 0.18, -0.07),
          wall.p(u, floor + 0.93, -0.07),
          0.047,
          0.045,
          C.dark,
        );
    }
  }
}

function timberRange(out, grade, lod, bounds, eave, ridge, verandaZ, studwork = false) {
  const [x0, z0, x1, z1] = bounds;
  const z = verandaZ === 'south' ? z1 - 2.13 : z1 - 0.48;
  const north = verandaZ === 'north' ? z0 + 2.04 : z0 + 0.48;
  const wall = rect(x0 + 0.42, north, x1 - 0.43, z);
  liner(out, wall, eave, studwork ? C.exposed : C.board, lod, { studwork });
  const skirt = verandaZ === 'south' ? 0.5 : -0.1;
  if (verandaZ === 'south')
    veranda(out, grade, lod, [x1, z1], [x0, z1], 2.13, eave - 1.06, eave, { rail: studwork });
  if (verandaZ === 'north')
    veranda(out, grade, lod, [x0, z0], [x1, z0], 2.04, eave - 0.94, eave, { rail: false });
  const roofNorth = Math.min(north - 0.43, z0 + 1.8);
  const roofSouth = Math.min(z1, z + skirt);
  hip(out, x0, roofNorth, x1, roofSouth, eave, ridge, lod);
  if (lod === 0) {
    block(
      out,
      'base',
      x0 + 0.86,
      -0.32,
      north + 0.23,
      x1 - x0 - 1.72,
      floor + 0.32,
      z - north - 0.48,
      C.base,
    );
    return;
  }
  const middle = (north + z) / 2;
  for (const px of [x0 + 0.65, (x0 + x1) / 2, x1 - 0.65])
    for (const pz of [north + 0.3, middle, z - 0.26]) footing(out, grade, px, pz, 0.32);
}

function draw(out, lod, { courtroomArchiveWidthMeters, courtVerandahWidthMeters }, grade) {
  const hallWest = -20.46,
    hallEast = -5.6;
  const center = 0.15;
  const half = courtroomArchiveWidthMeters / 2;
  const front = -23.02;
  const zNorth = -6.68,
    zSouth = 6.93;

  const hall = rect(hallWest, center - half, hallEast, center + half);
  liner(out, hall, 4.54, C.board, lod);
  if (lod === 0) {
    block(
      out,
      'base',
      hallWest + 0.28,
      -0.3,
      center - half + 0.23,
      hallEast - hallWest - 0.56,
      floor + 0.3,
      2 * half - 0.46,
      C.base,
    );
  } else {
    for (const x of [hallWest + 0.34, -15.5, -10.8, hallEast - 0.21])
      for (const z of [center - half + 0.2, center, center + half - 0.2])
        footing(out, grade, x, z, 0.34);
  }
  veranda(out, grade, lod, [front, zNorth], [-11.12, zNorth], 2.79, 3.31, 4.55);
  veranda(out, grade, lod, [-10.52, zSouth], [front, zSouth], 2.94, 3.31, 4.55);
  veranda(out, grade, lod, [front, zSouth], [front, zNorth], courtVerandahWidthMeters, 3.31, 4.47, {
    gap: 2.44,
  });
  gable(out, hallWest - 0.29, hallEast + 0.28, center, half + 0.45, 4.55, 7.33, lod);
  gable(out, front - 0.16, hallWest + 0.12, center, 2.19, 3.34, 5.16, lod);
  const westFace = edge([hallWest, center + half], [hallWest, center - half]);
  opening(
    out,
    westFace,
    half - 0.65,
    half + 0.65,
    floor,
    2.97,
    'trim',
    C.dark,
    'trim',
    C.fascia,
    lod,
    0.06,
  );
  panel(out, 'window', westFace, half - 0.54, half + 0.54, 3.01, 3.38, 0.06, C.glass);
  for (const z of [center - 1.45, center + 1.45]) footing(out, grade, front + 0.24, z, 0.38);
  for (let i = 0; i < 5; i++) {
    const x = front - 1.61 + i * 0.32;
    const bottom = grade([x, center]) - 0.14;
    const top = (floor * (i + 1)) / 5;
    block(out, 'trim', x, bottom, center - 1.15, 0.33, top - bottom, 2.3, C.deck);
  }
  if (lod >= 2) {
    for (const x of [hallWest - 0.29, front - 0.16])
      beam(
        out,
        'trim',
        [x, x === front - 0.16 ? 5.12 : 7.29, center],
        [x, x === front - 0.16 ? 5.63 : 7.91, center],
        0.098,
        0.098,
        C.dark,
      );
  }

  timberRange(out, grade, lod, [-11.07, -17.79, 12.66, -5.45], 3.93, 6.04, 'south', true);
  timberRange(out, grade, lod, [-10.98, -6.8, -0.87, 7.72], 4.16, 6.44, 'south');
  timberRange(out, grade, lod, [-10.47, 7.68, 16.59, 14.72], 3.53, 5.2, 'north');
  timberRange(out, grade, lod, [-0.96, -3.57, 13.58, 3.36], 3.41, 4.95, 'south');
}
const court = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-47, 20, -37],
    lookAt: [-4, 3.0, -0.7],
    yaw: -2.45,
    sun: [-450, 570, -420],
    brief:
      'Raised timber Cloncurry Courthouse with its double gables, deep verandas and corrugated iron roofs over several building phases.',
    views: [
      { name: 'scheaffe-street-gables', position: [-37, 6.4, 0], lookAt: [-17.6, 3.9, 0] },
      { name: 'daintree-street-older-range', position: [-23, 11, -32], lookAt: [-3, 3.5, -9] },
      { name: 'southern-wing-and-rear-link', position: [24, 9, 27], lookAt: [1, 3, 5] },
      { name: 'court-and-office-roofs', position: [-18, 54, -27], lookAt: [-4, 2, -2] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = court;
export const model = {
  ...court.model,
  category: 'courthouse',
  recipeDependencies: [...court.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent geometry using the standing map, original state elevations, public-domain Crown plan and factual heritage description.',
};
