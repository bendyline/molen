import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const y = d.floor;
const colors = palette({
  wall: 'c3b59d',
  stone: 'd1c1a8',
  carved: 'd8cab3',
  granite: 'a59b8b',
  paving: 'a79d8b',
  lead: '858a8b',
  leadShade: '707978',
  brick: 'b28d75',
  glass: '3b4040',
  door: '524339',
  bronze: 'a68f5d',
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar'),
  lead: surface('roof', 'metal_painted', 0.78, 0.15),
  trim: surface('trim', 'stone_marble', 0.86),
  granite: surface('foundation', 'stone_limestone_raw', 0.93),
  brick: surface('trim', 'brick', 0.91),
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91, metallic: 0 },
};
const [cx, cz] = d.harim.center;
const harimLeft = cx - d.harim.outer[0] / 2;
const harimRight = cx + d.harim.outer[0] / 2;
const harimFront = cz - d.harim.outer[1] / 2;
const harimBack = cz + d.harim.outer[1] / 2;
const [leftSide, rightSide] = d.galleries.sideBounds;

function mass(out, slot, outline, base, top, tint, roof = slot, roofTint = tint) {
  shell(out, outline, () => base, top, { wall: slot, color: tint, roof, roofColor: roofTint });
}

function upperRoof(out, support, ridge, topOuter, topInner) {
  const points = [
    at(support[0], topOuter),
    at(support[1], topOuter),
    at(ridge[1], topInner),
    at(ridge[0], topInner),
  ];
  face(out, 'lead', points, up, colors.lead);
  face(
    out,
    'lead',
    points.map(([x, h, z]) => [x, h - 0.18, z]),
    [0, -1, 0],
    colors.leadShade,
  );
  for (const [a, b] of pairs(closed(points))) {
    const outward = edge(
      [a[0], a[2]],
      [b[0], b[2]],
      areaSign(points.map(([x, , z]) => [x, z])),
    ).normal;
    face(
      out,
      'trim',
      [a, b, [b[0], b[1] - 0.19, b[2]], [a[0], a[1] - 0.19, a[2]]],
      outward,
      colors.stone,
    );
  }
}

function dome(out, center, radius, spring, apex, lod, major) {
  const segments = major ? [6, 12, 24, 36][lod] : [6, 8, 12, 18][lod];
  const raw =
    lod === 0
      ? [
          [0, 1],
          [0.67, 0.75],
          [1, 0.045],
        ]
      : lod === 1
        ? [
            [0, 1],
            [0.48, 0.92],
            [0.77, 0.65],
            [0.94, 0.34],
            [1, 0.044],
          ]
        : [
            [0, 1],
            [0.29, 0.967],
            [0.56, 0.852],
            [0.74, 0.686],
            [0.88, 0.49],
            [0.965, 0.276],
            [1, 0.044],
          ];
  ring(
    out,
    'lead',
    center,
    raw.map(([t, r]) => [mix(spring, apex, t), radius * r]),
    segments,
    colors.lead,
  );
  if (lod < 2) return;
  const finialScale = major ? 1 : 0.54;
  ring(
    out,
    'trim',
    center,
    [
      [apex - 0.05, 0.17 * finialScale],
      [apex + 0.22 * finialScale, 0.21 * finialScale],
      [apex + 0.42 * finialScale, 0.11 * finialScale],
      [apex + 0.62 * finialScale, 0.029 * finialScale],
    ],
    lod > 1 ? 9 : 6,
    colors.bronze,
  );
}

function hallRoofs(out, lod) {
  const radius = d.harim.domeDiameter / 2;
  const spring = y + d.harim.drumHeight;
  const apex = y + d.harim.apexHeight;
  for (const x of d.harim.domeX) {
    for (const z of d.harim.domeZ) {
      const drum =
        lod === 0
          ? [
              [spring - 1.66, radius + 0.29],
              [spring, radius],
            ]
          : [
              [spring - 1.66, radius + 0.29],
              [spring - 0.23, radius + 0.22],
              [spring, radius],
            ];
      ring(out, 'stone', [x, z], drum, [6, 10, 20, 20][lod], colors.stone);
      dome(out, [x, z], radius, spring, apex, lod, true);
    }
  }
}

function pointedArch(out, w, middle, bottom, half, shoulder, rise, lod, fill = 'opening') {
  const count = [4, 6, 8, 12][lod];
  const profile = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count,
      x = (2 * t - 1) * half,
      u = Math.abs(2 * t - 1);
    return [middle + x, shoulder + rise * (1 - u * 0.52 - u * u * 0.48)];
  });
  const polygon = [[middle - half, bottom], ...profile, [middle + half, bottom]];
  face(
    out,
    fill,
    polygon.map(([u, h]) => w.p(u, h, 0.042)),
    w.normal,
    colors.glass,
  );
  if (lod < 2) return;
  beamPath(
    out,
    'trim',
    profile.map(([u, h]) => w.p(u, h, 0.075)),
    0.105,
    0.105,
    colors.carved,
  );
  if (lod > 1) {
    panel(
      out,
      'trim',
      w,
      middle - 0.035,
      middle + 0.035,
      bottom,
      shoulder + rise - 0.05,
      0.095,
      colors.stone,
    );
    panel(
      out,
      'trim',
      w,
      middle - half,
      middle + half,
      bottom - 0.07,
      bottom + 0.013,
      0.095,
      colors.stone,
    );
  }
}

function buttress(out, x, lod) {
  const z = harimBack + 0.03;
  const pierHeight = y + 11.22;
  if (lod === 0) {
    block(
      out,
      'stone',
      x - 0.8,
      d.foundation,
      z - 0.19,
      1.6,
      pierHeight - d.foundation,
      2.02,
      colors.stone,
    );
    ring(
      out,
      'stone',
      [x, z + 0.85],
      [
        [pierHeight - 0.19, 0.86],
        [pierHeight + 2.56, 0.86],
      ],
      5,
      colors.stone,
    );
    ring(
      out,
      'lead',
      [x, z + 0.85],
      [
        [pierHeight + 2.55, 0.95],
        [pierHeight + 3.48, 0.13],
      ],
      5,
      colors.lead,
    );
    return;
  } else {
    const low = rect(x - 1.11, z - 0.18, x + 1.11, z + 2.46);
    const high = rect(x - 0.77, z - 0.19, x + 0.77, z + 1.77);
    const sign = areaSign(low);
    for (let i = 0; i < low.length; i++) {
      const j = (i + 1) % low.length;
      const w = edge(low[i], low[j], sign);
      face(
        out,
        'stone',
        [
          at(low[i], d.foundation),
          at(low[j], d.foundation),
          at(high[j], pierHeight),
          at(high[i], pierHeight),
        ],
        w.normal,
        colors.stone,
      );
    }
    cap(out, 'trim', high, pierHeight, colors.carved);
  }
  const top = [x, z + 0.85];
  ring(
    out,
    'stone',
    top,
    [
      [pierHeight - 0.17, 0.86],
      [pierHeight + 2.48, 0.85],
      [pierHeight + 2.62, 0.93],
    ],
    lod === 0 ? 6 : 10,
    colors.stone,
  );
  ring(
    out,
    'lead',
    top,
    [
      [pierHeight + 2.62, 0.95],
      [pierHeight + 3.02, 0.72],
      [pierHeight + 3.32, 0.37],
      [pierHeight + 3.53, 0.055],
    ],
    lod === 0 ? 6 : 12,
    colors.lead,
  );
}

function prayerHall(out, lod) {
  const plan = rect(harimLeft, harimFront, harimRight, harimBack);
  const deck = y + d.harim.drumHeight - 1.05;
  mass(out, 'stone', plan, d.foundation, deck, colors.wall, 'lead', colors.leadShade);
  const northWall = plane(harimFront, -1),
    southWall = plane(harimBack, 1);
  if (lod > 0) {
    for (const wall of [northWall, southWall]) {
      panel(out, 'trim', wall, harimLeft, harimRight, y + 0.48, y + 0.7, 0.06, colors.stone);
      panel(
        out,
        'trim',
        wall,
        harimLeft,
        harimRight,
        deck - 0.45,
        deck - 0.13,
        0.11,
        colors.carved,
      );
    }
    for (const x of d.harim.domeX) {
      const deltas = lod === 1 ? [-2.35, 0, 2.35] : [-3.2, -1.57, 0, 1.57, 3.2];
      for (const dx of deltas) {
        const swing = 1 - Math.abs(dx) * 0.12;
        pointedArch(
          out,
          southWall,
          x + dx,
          y + 9.15,
          0.49,
          y + 10.2 + swing * 0.49,
          0.8 * swing,
          lod,
        );
      }
      for (const dx of [-2.65, 0, 2.65]) {
        opening(
          out,
          southWall,
          x + dx - 0.63,
          x + dx + 0.63,
          y + 1.65,
          y + 3.92,
          'trim',
          colors.glass,
          'opening',
          colors.carved,
          lod,
          0.043,
        );
      }
    }
    for (const x of [-12.28, 6.44]) {
      pointedArch(out, northWall, x, y + 0.27, 1.29, y + 3.62, 1.08, lod);
      for (const shift of [-3.22, 3.22]) {
        opening(
          out,
          northWall,
          x + shift - 0.53,
          x + shift + 0.53,
          y + 1.35,
          y + 3.5,
          'trim',
          colors.glass,
          'opening',
          colors.carved,
          lod,
          0.04,
        );
      }
    }
    for (const x of [harimLeft, harimRight]) {
      const w = edge([x, harimFront], [x, harimBack], x === harimRight ? 1 : -1);
      for (const u of [4.27, 9.36, 14.45, 19.58]) {
        pointedArch(out, w, u, y + 9.89, 0.53, y + 11.47, 0.63, lod);
        opening(
          out,
          w,
          u - 0.67,
          u + 0.67,
          y + 5.6,
          y + 7.85,
          'trim',
          colors.glass,
          'opening',
          colors.carved,
          lod,
          0.04,
        );
      }
    }
  }
  for (const x of [-20.75, -8.05, 2.17, 14.74]) buttress(out, x, lod);
  for (const x of [-21.26, 15.43]) {
    block(out, 'stone', x - 1.53, y - 0.36, harimFront - 3.8, 3.06, 14.65, 3.89, colors.wall);
    dome(out, [x, harimFront - 2.05], 1.48, y + 14.35, y + 15.78, lod, false);
  }
}

function col(out, [x, z], floor, head, r, lod, tint, square) {
  if (lod < 2 || square) {
    block(out, 'granite', x - r, floor, z - r, r * 2, head - floor, r * 2, tint);
    return;
  }
  ring(
    out,
    'granite',
    [x, z],
    [
      [floor, r * 1.27],
      [floor + 0.22, r * 1.26],
      [floor + 0.24, r],
      [head - 0.29, r * 0.82],
      [head - 0.2, r * 1.19],
      [head, r * 1.23],
    ],
    [4, 6, 8, 10][lod],
    tint,
  );
}

function arcade(out, a, b, bays, floor, spring, peak, capY, depth, lod, square) {
  const w = edge(a, b),
    pitch = w.length / bays;
  const across = [2, 4, 6, 10][lod],
    radius = square ? 0.54 : 0.22;
  for (let i = 0; i <= bays; i++) {
    const [x, , z] = w.p(i * pitch, floor);
    col(
      out,
      [x, z],
      floor,
      spring + 0.045,
      radius,
      lod,
      square ? colors.wall : colors.granite,
      square,
    );
  }
  if (lod === 0) return;
  for (let bay = 0; bay < bays; bay++) {
    const half = pitch * 0.5 - radius * 0.77,
      mid = (bay + 0.5) * pitch;
    const arch = Array.from({ length: across + 1 }, (_, i) => {
      const t = i / across,
        u = Math.abs(2 * t - 1);
      return [mid + (2 * t - 1) * half, mix(spring, peak, 1 - u * 0.61 - u * u * 0.39)];
    });
    if (lod > 1) {
      for (const d of [0, -depth]) {
        const n = w.normal.map((v) => (d === 0 ? v : -v));
        face(
          out,
          'stone',
          [
            w.p(bay * pitch, spring, d),
            w.p(arch[0][0], spring, d),
            w.p(arch[0][0], capY, d),
            w.p(bay * pitch, capY, d),
          ],
          n,
          colors.stone,
        );
        face(
          out,
          'stone',
          [
            w.p(arch.at(-1)[0], spring, d),
            w.p((bay + 1) * pitch, spring, d),
            w.p((bay + 1) * pitch, capY, d),
            w.p(arch.at(-1)[0], capY, d),
          ],
          n,
          colors.stone,
        );
      }
    }
    for (const [[u, h], [v, j]] of pairs(arch)) {
      for (const d of lod === 1 ? [0] : [0, -depth]) {
        const n = w.normal.map((k) => (d === 0 ? k : -k));
        face(
          out,
          square ? 'stone' : 'brick',
          [w.p(u, h, d), w.p(v, j, d), w.p(v, capY, d), w.p(u, capY, d)],
          n,
          square ? colors.stone : colors.brick,
        );
      }
      if (lod > 1)
        face(
          out,
          'stone',
          [w.p(v, j), w.p(u, h), w.p(u, h, -depth), w.p(v, j, -depth)],
          [0, -1, 0],
          colors.wall,
        );
    }
    if (lod >= 2)
      beamPath(
        out,
        'trim',
        arch.map(([u, h]) => w.p(u, h, 0.049)),
        0.083,
        0.095,
        colors.carved,
      );
  }
}

function galleries(out, lod) {
  const front = d.galleries.northOuterZ,
    inner = d.galleries.northInnerZ;
  const firstEdge = [leftSide, front],
    secondEdge = [rightSide, front];
  const fillFloor = y - 0.065;
  const outset = fillFloor + 0.16;
  const outerEave = y + d.galleries.outerEave;
  const innerEave = y + d.galleries.innerEave;
  const floorOutline = d.outline.map(([x, z]) => [x, z]);
  mass(out, 'granite', floorOutline, d.foundation, fillFloor, colors.paving);
  arcade(
    out,
    firstEdge,
    secondEdge,
    [5, 11, 19, 19][lod],
    outset,
    lod === 0 ? outerEave - 0.27 : y + 3.65,
    y + 5.87,
    outerEave - 0.25,
    0.27,
    lod,
    false,
  );
  upperRoof(
    out,
    [
      [leftSide - 0.3, front - 0.44],
      [rightSide + 0.3, front - 0.44],
    ],
    [
      [leftSide - 0.3, inner - 0.32],
      [rightSide + 0.3, inner - 0.32],
    ],
    outerEave,
    y + 8.76,
  );
  arcade(
    out,
    [harimLeft, inner],
    [harimRight, inner],
    [3, 6, 9, 9][lod],
    outset,
    lod === 0 ? innerEave - 0.24 : y + 4.3,
    y + 7.02,
    innerEave - 0.22,
    0.55,
    lod,
    true,
  );
  upperRoof(
    out,
    [
      [harimLeft - 0.38, inner - 0.31],
      [harimRight + 0.38, inner - 0.31],
    ],
    [
      [harimLeft - 0.38, harimFront + 0.14],
      [harimRight + 0.38, harimFront + 0.14],
    ],
    innerEave,
    y + 13.25,
  );
  for (const x of [leftSide, rightSide]) {
    const left = x < 0,
      frontSide = [x, front + 0.03],
      rearSide = [x, harimBack - 0.23];
    const ends = left ? [rearSide, frontSide] : [frontSide, rearSide];
    const inward = left ? harimLeft + 0.2 : harimRight - 0.2;
    arcade(
      out,
      ...ends,
      [2, 4, 7, 7][lod],
      outset,
      lod === 0 ? y + 6.36 : y + 3.09,
      y + 5.35,
      y + 6.39,
      0.57,
      lod,
      true,
    );
    const upper = y + 6.31;
    const outerRoof = y + 10.43;
    const w = edge(...ends);
    const gap = w.length / [3, 5, 9, 9][lod];
    for (let u = 0; u <= w.length + 0.01; u += gap) {
      const [x, , z] = w.p(u, 0);
      col(out, [x, z], upper, outerRoof - 0.26, lod === 0 ? 0.15 : 0.185, lod, colors.stone, false);
    }
    panel(out, 'trim', w, 0, w.length, upper - 0.11, upper + 0.88, 0.075, colors.stone);
    upperRoof(
      out,
      [
        [x + (left ? -0.25 : 0.25), front + 0.55],
        [x + (left ? -0.25 : 0.25), harimBack - 0.13],
      ],
      [
        [inward, front + 3.33],
        [inward, harimBack - 0.13],
      ],
      outerRoof,
      y + 12.36,
    );
  }
  if (lod > 0)
    stairs(out, grade, 'granite', -7.4, 1.55, front - 3.2, front - 0.02, outset, 4, colors.paving);
}

function minaret(out, lod) {
  const [x, z] = d.minaret.center,
    balcony = y + d.minaret.balcony,
    top = y + d.minaret.top;
  block(out, 'stone', x - 1.62, y - 0.02, z - 1.85, 3.24, 15.37, 3.73, colors.stone);
  const count = [6, 10, 20, 32][lod];
  const shaft =
    lod === 0
      ? [
          [y + 15.28, 1.49],
          [y + 18.32, 0.93],
          [balcony - 0.38, 0.8],
          [balcony, 1.57],
          [balcony + 0.62, 1.48],
          [balcony + 0.68, 0.68],
          [top - 5.65, 0.59],
        ]
      : [
          [y + 15.28, 1.63],
          [y + 15.57, 1.66],
          [y + 15.81, 1.39],
          [y + 18.12, 0.94],
          [y + 18.27, 1.05],
          [y + 18.48, 0.91],
          [balcony - 0.93, 0.81],
          [balcony - 0.79, 0.97],
          [balcony - 0.54, 1.14],
          [balcony - 0.31, 1.39],
          [balcony, 1.59],
          [balcony + 0.61, 1.59],
          [balcony + 0.7, 0.68],
          [top - 6.05, 0.6],
          [top - 5.69, 0.72],
        ];
  ring(out, 'stone', [x, z], shaft, count, colors.stone);
  ring(
    out,
    'lead',
    [x, z],
    [
      [top - 5.7, 0.73],
      [top - 0.65, 0.08],
    ],
    count,
    colors.leadShade,
  );
  if (lod > 0)
    ring(
      out,
      'trim',
      [x, z],
      [
        [top - 0.68, 0.096],
        [top - 0.43, 0.22],
        [top - 0.21, 0.1],
        [top, 0.037],
      ],
      count,
      colors.bronze,
    );
  if (lod < 2) return;
  const slot = edge([x - 0.84, z - 1.86], [x + 0.84, z - 1.86]);
  opening(
    out,
    slot,
    0.66,
    1.02,
    y + 11.82,
    y + 13.68,
    'trim',
    colors.glass,
    'opening',
    colors.carved,
    lod,
    0.031,
  );
}

function turbe(out, lod) {
  const t = d.tombPlacement,
    [x, z] = t.center;
  const floor = t.floor,
    eave = floor + t.wallHeight,
    top = floor + t.top;
  const corners = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * 2 * Math.PI) / 8;
    return [x + 4.99 * Math.cos(a), z + 4.99 * Math.sin(a)];
  });
  const foot = lod === 0 ? corners : d.tomb;
  mass(out, 'granite', foot, t.foundation, floor + 0.15, colors.paving);
  mass(out, 'stone', corners, floor, eave, colors.wall);
  ring(
    out,
    'stone',
    t.center,
    [
      [eave - 0.1, 4.7],
      [eave + 0.26, 4.78],
      [eave + 0.48, 4.34],
    ],
    8,
    colors.stone,
  );
  dome(out, t.center, 4.32, eave + 0.46, top, lod, false);
  if (lod === 0) return;
  for (const [[a, b], i] of pairs(closed(corners)).map((value, index) => [value, index])) {
    const w = edge(a, b),
      u = w.length * 0.5;
    if (i === 5) {
      pointedArch(out, w, u, floor + 0.18, 0.78, floor + 2.52, 0.63, lod);
    } else {
      opening(
        out,
        w,
        u - 0.54,
        u + 0.54,
        floor + 1.17,
        floor + 2.97,
        'trim',
        colors.glass,
        'opening',
        colors.carved,
        lod,
        0.04,
      );
      pointedArch(out, w, u, floor + 3.6, 0.43, floor + 4.59, 0.43, lod);
    }
  }
}

function build(out, lod) {
  prayerHall(out, lod);
  hallRoofs(out, lod);
  galleries(out, lod);
  minaret(out, lod);
  turbe(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'piyale-pasha-mosque-model.mjs';
const camera = [104, 50, -109],
  lookAt = [-2, 11, 6];
const field = { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' };
export const piyaleModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-exterior',
  groundContactBasis:
    'Open north courtyard fixes the datum, with an independently sampled lower southern tomb and axial prayer hall base.',
  brief:
    'Piyale Pasha Mosque with six matching lead domes, double galleries, a 39.5-meter north minaret and nearby octagonal türbe.',
  camera,
  lookAt,
  sunDirection: [-49, 62, -39],
  embeddedCanonicalGraphs: Object.values(surfaces)
    .map((s) => s.graph)
    .filter(Boolean),
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.tomb],
    minimumCoverage: 0.9,
    basis:
      'Suppress the generic mosque and octagonal tomb geometries using their separate native outlines.',
  },
  mediumFiContext: { scale: 1, groundY: -0.17, terrain: field },
  qaCameras: [
    { name: 'double-portico-and-north-minaret', position: [-18, 17, -83], lookAt: [-3, 15, -5] },
    { name: 'six-lead-domes-and-east-gallery', position: [57, 44, 9], lookAt: [-2, 15, 5] },
    { name: 'qibla-buttresses-and-turbe', position: [-55, 31, 78], lookAt: [-4, 9, 23] },
    { name: 'whole-six-domed-mosque', position: [-87, 64, -67], lookAt: [-2, 10, 7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'piyale-pasha-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.28,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.0, surfaces },
      street: { export: 'street', errorMeters: 0.45, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.17, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original Molen geometry. Uses the public-domain 1912 Gurlitt plan and ODbL 1.0 OpenStreetMap control points.',
};
