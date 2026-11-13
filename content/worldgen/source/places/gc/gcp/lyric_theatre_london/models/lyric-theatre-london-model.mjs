/** The Lyric Theatre and retained Hunter house in April 2007. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  deform,
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.89, metallic: 0 },
  canopy: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.77, metallic: 0.25 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0.05 },
};
const tint = Object.fromEntries(
  Object.entries({
    brick: '9e5d4e',
    house: '9b6054',
    back: '89675e',
    slate: '565c69',
    flat: '6b6662',
    stone: 'c8c1b1',
    highlight: 'dbd2bf',
    shadow: 'a6a094',
    glass: '434b55',
    canopy: '46484c',
    gold: 'e0d5b4',
    sign: '283047',
    board: '303038',
    pink: 'ed729f',
    timber: '59443a',
    paleBlue: '2e658d',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const front = (x) => {
  const [a, b, c] = plan.main.streetVertices.map((i) => outline[i]);
  const [start, end] = x < b[0] ? [a, b] : [b, c];
  return mix(start[1], end[1], (x - start[0]) / (end[0] - start[0]));
};
const mainFacade = (x, y, depth = 0) => [x, y, front(x) + depth];
const houseStart = outline[0],
  houseEnd = outline[16];
const houseLength = Math.hypot(houseEnd[0] - houseStart[0], houseEnd[1] - houseStart[1]);
const houseVector = [
  (houseEnd[0] - houseStart[0]) / houseLength,
  (houseEnd[1] - houseStart[1]) / houseLength,
];
const houseFacade = (x, y, depth = 0) => [
  houseStart[0] + x * houseVector[0] - depth * houseVector[1],
  y,
  houseStart[1] + x * houseVector[1] + depth * houseVector[0],
];

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const rows = terrain.heightsMeters;
  return (
    mix(
      mix(rows[j][i], rows[j][i + 1], u - i),
      mix(rows[j + 1][i], rows[j + 1][i + 1], u - i),
      v - j,
    ) - terrain.modelDatumElevationMeters
  );
}

function panel(out, slot, points, normal, color) {
  const n = normalFor(...points);
  const ordered =
    n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, color);
  else triangle(out, slot, ordered, color);
}

function surface(out, slot, point, polygon, depth, color, normal) {
  const triangles = earcut(polygon.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    panel(
      out,
      slot,
      triangles.slice(i, i + 3).map((j) => point(...polygon[j], depth)),
      normal,
      color,
    );
  }
}

function trim(out, slot, point, polygon, depth, color, lod) {
  const normal = normalFor(point(0, 0, depth), point(1, 0, depth), point(0, 1, depth));
  surface(out, slot, point, polygon, depth, color, normal);
  if (lod >= 2) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      face(
        out,
        slot,
        [
          point(...b, depth - 0.13),
          point(...a, depth - 0.13),
          point(...a, depth),
          point(...b, depth),
        ],
        color,
      );
    }
  }
}

function opening(x, y, width, height, arched, steps) {
  const left = x - width / 2,
    right = x + width / 2;
  if (!arched) return rect(left, y, right, y + height);
  const spring = y + height - width / 2;
  const arch = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i * Math.PI) / steps;
    return [x + (width / 2) * Math.cos(a), spring + (width / 2) * Math.sin(a)];
  });
  return [[left, y], [right, y], ...arch];
}

function window(out, point, x, y, width, height, arched, lod, depth = 0.095) {
  const steps = [3, 4, 7, 10][lod];
  const rim = lod >= 2 ? 0.14 : 0.18;
  const outer = opening(x, y - rim, width + 2 * rim, height + 2 * rim, arched, steps);
  trim(out, 'stone', point, outer, depth + 0.09, tint.stone, 0);
  trim(
    out,
    'detail',
    point,
    opening(x, y, width, height, arched, steps),
    depth + 0.105,
    tint.glass,
    0,
  );
  if (lod >= 1) {
    trim(
      out,
      'stone',
      point,
      rect(x - width / 2 - 0.19, y - 0.14, x + width / 2 + 0.19, y - 0.03),
      depth + 0.22,
      tint.highlight,
      lod,
    );
    trim(
      out,
      'detail',
      point,
      rect(x - 0.027, y + 0.03, x + 0.027, y + height - (arched ? width / 2 : 0.035)),
      depth + 0.12,
      tint.shadow,
      0,
    );
    trim(
      out,
      'detail',
      point,
      rect(x - width / 2, y + 0.65 * height, x + width / 2, y + 0.65 * height + 0.047),
      depth + 0.123,
      tint.shadow,
      0,
    );
  }
}

function roof(out, ring, y, color = tint.slate) {
  surface(out, 'slate', (x, z) => [x, y, z], ring, 0, color, [0, 1, 0]);
}

function roofGable(out, a, b, c, d, eave, ridge) {
  const e = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2];
  const f = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
  const p = ([x, z], y) => [x, y, z];
  panel(out, 'slate', [p(a, eave), p(b, eave), p(f, ridge), p(e, ridge)], [0, 1, 0], tint.slate);
  panel(out, 'slate', [p(d, eave), p(c, eave), p(f, ridge), p(e, ridge)], [0, 1, 0], tint.slate);
  const startNormal = [a[0] - b[0], 0, a[1] - b[1]];
  panel(out, 'brick', [p(a, eave), p(d, eave), p(e, ridge)], startNormal, tint.back);
  panel(
    out,
    'brick',
    [p(b, eave), p(c, eave), p(f, ridge)],
    startNormal.map((v) => -v),
    tint.back,
  );
}

function shell(out, lod) {
  const y = plan.main.eaves;
  const houseEaves = plan.hunterHouse.eaves;
  const split = (i, t) => outline[i].map((value, axis) => mix(value, outline[i + 1][axis], t));
  const houseBackA = split(15, 0.6),
    houseBackB = split(1, 0.37);
  function wall(a, b, eave, color) {
    panel(
      out,
      'brick',
      [
        [a[0], grade(...a) - 0.27, a[1]],
        [b[0], grade(...b) - 0.27, b[1]],
        [b[0], eave, b[1]],
        [a[0], eave, a[1]],
      ],
      [a[1] - b[1], 0, b[0] - a[0]],
      color,
    );
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[(i + 1) % outline.length],
      b = outline[i];
    if (i === 1) {
      wall(a, houseBackB, y, tint.back);
      wall(houseBackB, b, houseEaves, tint.house);
    } else if (i === 15) {
      wall(a, houseBackA, houseEaves, tint.house);
      wall(houseBackA, b, y, tint.back);
    } else {
      const isHouse = i === 0 || i >= 16;
      wall(
        a,
        b,
        isHouse ? houseEaves : y,
        isHouse ? tint.house : i === 11 || i === 12 ? tint.brick : tint.back,
      );
    }
    if (lod >= 1 && (i === 5 || i === 6 || i === 7)) {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      const point = (u, h, depth = 0) => [
        a[0] + (u * dx - depth * dz) / length,
        h,
        a[1] + (u * dz + depth * dx) / length,
      ];
      for (const x of [0.28 * length, 0.72 * length])
        window(out, point, x, 6.0, 0.72, 1.65, false, lod - 1);
    }
  }
  roof(out, [houseBackB, ...outline.slice(2, 16), houseBackA], y);
  roof(out, [houseBackA, ...outline.slice(16), outline[0], outline[1], houseBackB], houseEaves);
  const join = (p, height) => [p[0], height, p[1]];
  panel(
    out,
    'brick',
    [
      join(houseBackA, houseEaves),
      join(houseBackB, houseEaves),
      join(houseBackB, y),
      join(houseBackA, y),
    ],
    [-1, 0, 0],
    tint.back,
  );
  roofGable(
    out,
    outline[16],
    outline[0],
    houseBackB,
    houseBackA,
    plan.hunterHouse.eaves,
    plan.hunterHouse.ridge,
  );
  roofGable(out, [-5.7, 19.95], [18.7, 20.1], [24.7, 3.05], [-4.3, 3.05], y, plan.main.ridge);
  box(out, 'brick', [-12.4, y - 0.025, -3.3], [2.6, plan.stage.top, 7.7], tint.back);
  roofGable(
    out,
    [-12.55, -3.5],
    [2.75, -3.5],
    [2.75, 7.85],
    [-12.55, 7.85],
    plan.stage.top,
    plan.stage.roofPeak,
  );
  for (const x of [-1.8, 9.4]) {
    box(out, 'brick', [x, 16.0, 12.4], [x + 0.84, 19.02, 13.35], tint.brick);
    box(out, 'stone', [x - 0.1, 18.94, 12.3], [x + 0.94, 19.19, 13.45], tint.stone);
  }
}

function pediment(out, x, y, width, rise, lod) {
  const peak = y + rise;
  trim(
    out,
    'brick',
    mainFacade,
    [
      [x - width / 2, y],
      [x + width / 2, y],
      [x, peak],
    ],
    0.27,
    tint.brick,
    lod,
  );
  trim(
    out,
    'stone',
    mainFacade,
    [
      [x - width / 2 - 0.12, y],
      [x, peak + 0.17],
      [x + width / 2 + 0.12, y],
      [x + width / 2 - 0.2, y],
      [x, peak - 0.16],
      [x - width / 2 + 0.2, y],
    ],
    0.36,
    tint.highlight,
    0,
  );
}

function dormerRoof(out, x, width, eave, peak, depth) {
  const front = (u, h) => mainFacade(u, h, 0.26);
  const back = (u, h) => mainFacade(u, h, -depth);
  const backEave = eave - Math.min(0.75, depth * 0.12);
  const backPeak = Math.max(backEave + 0.12, peak - Math.min(2.05, depth * 0.43));
  for (const side of [-1, 1]) {
    const edge = x + (side * width) / 2;
    panel(
      out,
      'slate',
      [front(edge, eave), back(edge, backEave), back(x, backPeak), front(x, peak)],
      [0, 1, 0],
      tint.slate,
    );
    panel(
      out,
      'brick',
      [front(edge, 13.45), back(edge, 13.45), back(edge, backEave), front(edge, eave)],
      [side, 0, 0],
      tint.back,
    );
  }
  panel(
    out,
    'brick',
    [back(x - width / 2, backEave), back(x + width / 2, backEave), back(x, backPeak)],
    [0, 0, -1],
    tint.back,
  );
}

function words(out, text, point, x, y, depth, width, height, color, stroke) {
  const target = deform(out, ([u, v, w]) => point(u + x, v + y, w + depth));
  lettering(target, text, { width, height, color, slot: 'detail', stroke });
  const index = text.indexOf('Y');
  if (index >= 0) {
    const advance = width / text.length;
    const left = (index - text.length / 2) * advance;
    const middle = left + advance * 0.375;
    const join = [middle, height * 0.52, 0];
    for (const endpoint of [
      [left, height, 0],
      [left + advance * 0.75, height, 0],
      [middle, 0, 0],
    ])
      beam(target, 'detail', join, endpoint, stroke, stroke, color);
  }
}

function shaftesbury(out, lod) {
  const bays = [
    [-3.4, 4.35],
    [0.75, 3.35],
    [5.45, 5.7],
    [10.25, 3.39],
    [15.5, 5.93],
  ];
  for (const [index, [x, width]] of bays.entries()) {
    const pavilion = index % 2 === 0;
    const count = plan.main.windowCounts[index];
    const start = x - width / 2,
      end = x + width / 2;
    for (const y of [4.32, 9.45, 13.47]) {
      trim(
        out,
        'stone',
        mainFacade,
        rect(start, y, end, y + (y > 13 ? 0.31 : 0.16)),
        0.23,
        tint.stone,
        lod,
      );
    }
    for (const u of [start + 0.09, end - 0.09]) {
      trim(
        out,
        'stone',
        mainFacade,
        rect(u - 0.095, 5.05, u + 0.095, 13.53),
        0.19,
        tint.shadow,
        lod,
      );
      if (lod >= 2)
        for (const y of [9.15, 13.13]) {
          trim(
            out,
            'stone',
            mainFacade,
            rect(u - 0.17, y, u + 0.17, y + 0.3),
            0.225,
            tint.highlight,
            lod,
          );
        }
    }
    for (let i = 0; i < count; i++) {
      const u = x + width * ((i + 0.5) / count - 0.5) * 0.9;
      const w = Math.min((width / count) * 0.62, 1.32);
      window(out, mainFacade, u, 5.93, w, 3.1, pavilion, lod);
      if (lod > 0 || i % 2 === 0) window(out, mainFacade, u, 10.03, w, 2.65, false, lod);
      if (lod >= 2 && pavilion) pediment(out, u, 9.12, w + 0.25, 0.26, 0);
    }
    if (pavilion) {
      const rise = index === 2 ? 2.85 : 2.52;
      trim(
        out,
        'brick',
        mainFacade,
        rect(start + 0.03, 13.45, end - 0.03, plan.main.gablePeak - rise),
        0.25,
        tint.brick,
        lod,
      );
      pediment(out, x, plan.main.gablePeak - rise, width, rise, lod);
      dormerRoof(out, x, width - 0.05, plan.main.gablePeak - rise, plan.main.gablePeak, 7.6);
      for (const offset of [-0.21, 0.21])
        window(
          out,
          mainFacade,
          x + width * offset,
          14.18,
          Math.min(1.18, width * 0.24),
          2.4,
          true,
          lod,
          0.25,
        );
      if (index === 2 && lod >= 2)
        words(out, 'LYRIC THEATRE', mainFacade, x, 16.6, 0.38, 3.9, 0.32, tint.highlight, 0.03);
    } else {
      for (const offset of [-0.23, 0.23]) {
        const u = x + width * offset;
        trim(
          out,
          'stone',
          mainFacade,
          rect(u - 0.53, 13.56, u + 0.53, 15.79),
          0.19,
          tint.stone,
          lod,
        );
        pediment(out, u, 15.79, 1.13, 0.49, lod);
        dormerRoof(out, u, 1.06, 15.79, 16.28, 3.15);
        window(out, mainFacade, u, 13.89, 0.64, 1.56, false, lod, 0.21);
      }
    }
    if (index !== 4) {
      const archWidth = Math.min(2.65, width * 0.72);
      const base = grade(x, front(x)) - 0.1;
      trim(
        out,
        'stone',
        mainFacade,
        opening(x, base, archWidth + 0.36, 4.19, true, [4, 6, 8, 12][lod]),
        0.19,
        tint.stone,
        lod,
      );
      trim(
        out,
        'timber',
        mainFacade,
        opening(x, base + 0.05, archWidth, 3.91, true, [4, 6, 8, 12][lod]),
        0.215,
        tint.timber,
        0,
      );
    }
  }
}

function entrance(out, lod) {
  const p = plan.entrance,
    x = p.center,
    d = p.canopyProjection;
  const a = x - p.canopyWidth / 2,
    b = x + p.canopyWidth / 2;
  const canopy = (u, y, z) => [u, y, front(x) + z];
  const base = grade(x, front(x) + 1) - 0.08;
  panel(
    out,
    'canopy',
    [
      canopy(a, p.canopyLipHeight, d),
      canopy(b, p.canopyLipHeight, d),
      canopy(b, p.canopyBackHeight, -0.1),
      canopy(a, p.canopyBackHeight, -0.1),
    ],
    [0, 1, 0],
    tint.canopy,
  );
  trim(
    out,
    'detail',
    canopy,
    rect(a, p.canopyLipHeight - 0.23, b, p.canopyLipHeight),
    d + 0.02,
    tint.board,
    lod,
  );
  for (const u of [a, b]) {
    triangle(
      out,
      'canopy',
      [
        canopy(u, p.canopyBackHeight, -0.1),
        canopy(u, p.canopyLipHeight, d),
        canopy(u, p.canopyLipHeight, -0.1),
      ],
      tint.canopy,
    );
  }
  trim(out, 'stone', mainFacade, rect(a, base, b, 3.68), 0.15, tint.shadow, 0);
  for (let i = 0; i < 4; i++) {
    const u = mix(a + 0.81, b - 0.81, i / 3);
    trim(
      out,
      'timber',
      mainFacade,
      rect(u - 0.6, base + 0.03, u + 0.6, 3.38),
      0.18,
      tint.timber,
      lod,
    );
    if (lod > 0) {
      trim(out, 'detail', mainFacade, rect(u - 0.37, 1.73, u + 0.37, 3.12), 0.21, tint.glass, 0);
      trim(out, 'timber', mainFacade, rect(u - 0.045, 1.73, u + 0.045, 3.12), 0.24, tint.timber, 0);
    }
  }
  trim(out, 'stone', mainFacade, rect(a + 0.1, 5.1, b - 0.1, 5.26), 0.37, tint.stone, lod);
  trim(out, 'stone', mainFacade, rect(a + 0.1, 5.76, b - 0.1, 5.89), 0.37, tint.highlight, lod);
  for (let i = 0; i < [5, 9, 14, 19][lod]; i++) {
    const u = a + 0.31 + ((p.canopyWidth - 0.62) * i) / ([5, 9, 14, 19][lod] - 1);
    trim(
      out,
      'stone',
      mainFacade,
      [
        [u - 0.075, 5.21],
        [u + 0.075, 5.21],
        [u + 0.11, 5.54],
        [u + 0.065, 5.77],
        [u - 0.065, 5.77],
        [u - 0.11, 5.54],
      ],
      0.33,
      tint.stone,
      0,
    );
  }
  const boardX = x - 1.57;
  trim(
    out,
    'stone',
    mainFacade,
    rect(boardX - 2.3, 6.08, boardX + 2.3, 9.99),
    0.52,
    tint.shadow,
    lod,
  );
  trim(
    out,
    'detail',
    mainFacade,
    rect(boardX - 2.2, 6.18, boardX + 2.2, 9.89),
    0.56,
    tint.board,
    0,
  );
  const bladeX = x - 0.18;
  const bladeZ = front(bladeX) + 0.82;
  box(
    out,
    'detail',
    [bladeX - 0.105, 15.46, bladeZ - 0.7],
    [bladeX + 0.105, 20.14, bladeZ + 0.7],
    tint.sign,
  );
  if (lod >= 1) {
    const bladeSide = (u, y, v) => [bladeX + 0.113 + v, y, bladeZ - u];
    const backSide = (u, y, v) => [bladeX - 0.113 - v, y, bladeZ + u];
    for (const [i, letter] of [...'LYRIC'].entries()) {
      for (const side of [bladeSide, backSide])
        words(out, letter, side, 0.1, 19.31 - i * 0.85, 0, 0.76, 0.63, tint.gold, 0.046);
    }
  }
  if (lod >= 2) {
    words(out, 'CABARET', mainFacade, boardX + 0.1, 7.75, 0.61, 3.85, 0.56, tint.pink, 0.062);
    words(
      out,
      'LYRIC THEATRE',
      canopy,
      x + 0.05,
      p.canopyLipHeight - 0.192,
      d + 0.045,
      2.73,
      0.153,
      tint.gold,
      0.022,
    );
  }
}

function hunterHouse(out, lod) {
  const y = plan.hunterHouse.eaves;
  trim(out, 'stone', houseFacade, rect(0, y - 0.28, houseLength, y - 0.02), 0.19, tint.stone, lod);
  for (let i = 0; i < plan.hunterHouse.sashBays; i++) {
    const x = (houseLength * (i + 0.5)) / plan.hunterHouse.sashBays;
    for (const h of [4.12, 7.1, 9.86]) window(out, houseFacade, x, h, 0.99, 1.87, false, lod);
    if (lod > 0)
      trim(out, 'timber', houseFacade, rect(x - 0.47, 0.15, x + 0.47, 2.69), 0.11, tint.timber, 0);
  }
  if (lod >= 2) {
    const x = houseLength * 0.44;
    const marker = Array.from({ length: 12 }, (_, i) => [
      x + 0.3 * Math.cos((i * Math.PI) / 6),
      3.4 + 0.3 * Math.sin((i * Math.PI) / 6),
    ]);
    trim(out, 'detail', houseFacade, marker, 0.18, tint.paleBlue, 0);
  }
}

function build(out, lod) {
  shell(out, lod);
  shaftesbury(out, lod);
  entrance(out, lod);
  hunterHouse(out, lod);
}
export const lyricSkyline = (out) => build(out, 0);
export const lyricDistrict = (out) => build(out, 1);
export const lyricStreet = (out) => build(out, 2);
export const lyricCloseup = (out) => build(out, 3);
const recipe = 'lyric-theatre-london-model.mjs';
const camera = [-44, 25, 70],
  lookAt = [-4, 8.5, 3];
export const lyricModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: [
    'heritage-tower-detail-mesh.mjs',
    'polygon-triangulation.mjs',
    'stadium-lettering.mjs',
  ],
  surfaces,
  build: lyricCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Lyric Theatre as photographed in 2007, with its brick and stone Shaftesbury Avenue front, slate roofs, theatre canopy and retained Hunter house on Great Windmill Street.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-24, 38, 45],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named mapped Lyric Theatre envelope, including the Hunter house and stage end.',
  },
  embeddedCanonicalGraphs: [
    'brick',
    'stone_limestone',
    'slate',
    'metal_standing_seam',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'shaftesbury-avenue-pavilions-and-canopy',
      position: [-10, 7.2, 49],
      lookAt: [7, 9.5, 20],
    },
    { name: 'right-hand-entrance-and-signs', position: [4.6, 5, 39], lookAt: [14.1, 7.6, 22] },
    { name: 'hunter-house-and-stage-roofs', position: [-58, 22, -4], lookAt: [-15, 8.4, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-theatre-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'lyricSkyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'lyricDistrict', 0.48],
        ['street', 'lyricStreet', 0.17],
        ['closeup', 'lyricCloseup', 0.065],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped footprint is ODbL. The exact Qualla photo was released worldwide to the public domain by KF.',
};
