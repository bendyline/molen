import fs from 'node:fs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const {
  foundation,
  frontFloor,
  porchCornice,
  upperWindows,
  mainCornice,
  mansardTop,
  towerCornice,
  towerTop,
  crestTop,
} = plan.dimensions;
const outline = frame.geometry.outline;
const surfaces = {
  masonry: { slot: 'wall', graph: 'brick', roughness: 0.97 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94 },
  slateBand: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.94 },
  timber: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.7 },
  iron: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.77, metallic: 0.12 },
};
const brick = rgb('985344');
const shadeBrick = rgb('784239');
const limestone = rgb('d6c6a8');
const buff = rgb('bca88a');
const baseStone = rgb('a3937a');
const slate = rgb('5d6573');
const slateAccent = rgb('78808a');
const slateLight = rgb('a39188');
const timber = rgb('897461');
const darkDoor = rgb('49342d');
const glazed = rgb('706c64');
const darkIron = rgb('3f4542');
const stoneBand = { top: false };

const mainBox = [-5.45, -8.57, 8.17, 8.2];
const mainRoof = [-6.22, -9.72, 8.75, 9.62];
const towerBox = [5.48, -2.63, 10.7, 2.59];

const section = ([x0, z0, x1, z1], y) => [
  [x0, y, z1],
  [x1, y, z1],
  [x1, y, z0],
  [x0, y, z0],
];
const shrink = ([x0, z0, x1, z1], d) => [x0 + d, z0 + d, x1 - d, z1 - d];

function cap(out, slot, ring, y, color) {
  const points = ring.map(([x, z]) => [x, y, z]);
  const indexes = earcut(ring.flat(), [], 2);
  for (let i = 0; i < indexes.length; i += 3) {
    tri(out, slot, points[indexes[i]], points[indexes[i + 2]], points[indexes[i + 1]], color);
  }
}

function solid(out, slot, [x0, z0, x1, z1], floor, top, color) {
  abox(out, slot, [x0, floor, z0], [x1, top, z1], color, { bottom: false });
}

function slab(out, slot, ring, floor, top, color) {
  extrude(out, slot, ring, floor, top, color, stoneBand);
  cap(out, slot, ring, top, color);
}

function cornice(out, box, top, lod, brackets = true) {
  if (lod === 0) {
    solid(out, 'stone', shrink(box, -0.49), top - 0.41, top, limestone);
    return;
  }
  solid(out, 'stone', shrink(box, -0.21), top - 0.49, top - 0.36, buff);
  solid(out, 'timber', shrink(box, -0.34), top - 0.36, top - 0.16, timber);
  solid(out, 'stone', shrink(box, -0.49), top - 0.17, top, limestone);
  if (lod < 2 || !brackets) return;
  const points = section(box, 0);
  for (let edge = 0; edge < points.length; edge++) {
    const a = points[edge];
    const b = points[(edge + 1) % points.length];
    const f = facade([a[0], a[2]], [b[0] - a[0], b[2] - a[2]]);
    const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
    for (let x = 0.28; x < span - 0.17; x += lod === 3 ? 0.63 : 0.86) {
      fbox(out, 'timber', f, x - 0.08, x + 0.08, top - 0.73, top - 0.32, 0.0, 0.28, buff);
    }
  }
}

function roof(out, low, y0, bend, y1, high, y2, lod) {
  const pairs = [
    [section(low, y0), section(bend, y1)],
    [section(bend, y1), section(high, y2)],
  ];
  for (const [a, b] of pairs) {
    for (let edge = 0; edge < a.length; edge++) {
      const next = (edge + 1) % a.length;
      quad4(out, 'roof', a[edge], a[next], b[next], b[edge], slate);
      if ((lod === 1 && edge < 2) || lod >= 2)
        beam(out, 'stone', a[edge], b[edge], 0.09, 0.1, limestone);
    }
  }
  solid(out, 'roof', high, y2 - 0.06, y2, slate);
  if (lod < 2) return;
  const [a, b] = pairs[0];
  for (let edge = 0; edge < a.length; edge++) {
    const next = (edge + 1) % a.length;
    const normal = facade(
      [a[edge][0], a[edge][2]],
      [a[next][0] - a[edge][0], a[next][2] - a[edge][2]],
    ).normal;
    const patch = (u, v) =>
      a[edge].map((_, axis) => {
        const left = a[edge][axis] + v * (b[edge][axis] - a[edge][axis]);
        const right = a[next][axis] + v * (b[next][axis] - a[next][axis]);
        return (
          left + u * (right - left) + (axis === 1 ? 0.018 : normal[axis === 0 ? 0 : 1] * 0.022)
        );
      });
    quad4(
      out,
      'slateBand',
      patch(0.025, 0.31),
      patch(0.975, 0.31),
      patch(0.975, 0.36),
      patch(0.025, 0.36),
      slateAccent,
    );
    if (lod === 3) {
      const n = Math.floor(Math.hypot(a[next][0] - a[edge][0], a[next][2] - a[edge][2]) / 2.45);
      for (let i = 1; i < n; i++) {
        const x = i / n;
        quad4(
          out,
          'slateBand',
          patch(x, 0.245),
          patch(x + 0.033, 0.335),
          patch(x, 0.425),
          patch(x - 0.033, 0.335),
          slateLight,
        );
      }
    }
  }
}

function sash(out, f, u, y, width, height, lod, options = {}) {
  const { head = 'flat', glass = glazed, color = limestone, mullions = 0 } = options;
  opening(out, f, u, y, width, height, {
    head: lod >= 2 ? head : 'flat',
    glass,
    frame: color,
    frameSlot: 'stone',
    frameWidth: lod >= 2 ? 0.14 : 0,
    frameDepth: 0.12,
    d: 0.034,
    sill: lod >= 2,
    mullions: lod >= 2 ? mullions : 0,
    transoms: lod >= 2 ? 1 : 0,
  });
}

function group(out, f, u, y, height, lod) {
  if (lod === 0) {
    sash(out, f, u, y, 3.1, height, lod);
    return;
  }
  sash(out, f, u, y, 1.12, height + 0.42, lod, { head: 'tudor' });
  for (const dx of [-1.07, 1.07]) sash(out, f, u + dx, y, 0.62, height, lod);
  fbox(out, 'stone', f, u - 1.65, u + 1.65, y - 0.23, y - 0.09, 0.01, 0.18, buff);
}

function gabledFace(out, f, u, y, width, rise, depth, lod) {
  const l = u - width / 2;
  const r = u + width / 2;
  tri(out, 'timber', f.P(l, y, depth), f.P(r, y, depth), f.P(u, y + rise, depth), timber);
  if (lod === 0) return;
  const points = [
    f.P(l - 0.13, y - 0.08, depth + 0.04),
    f.P(u, y + rise + 0.055, depth + 0.04),
    f.P(r + 0.13, y - 0.08, depth + 0.04),
  ];
  beamPath(out, 'stone', points, 0.13, 0.13, limestone);
  if (lod >= 2) {
    beam(
      out,
      'stone',
      f.P(u, y + 0.06, depth + 0.055),
      f.P(u, y + rise - 0.14, depth + 0.055),
      0.1,
      0.11,
      buff,
    );
  }
}

function dormer(out, a, b, width, sill, eave, peak, lod) {
  const f = facade(b, [b[1] - a[1], a[0] - b[0]]);
  fbox(
    out,
    'timber',
    f,
    -width / 2,
    width / 2,
    sill - 0.2,
    eave,
    -Math.hypot(a[0] - b[0], a[1] - b[1]),
    0,
    timber,
  );
  gableRoof(out, 'roof', a, b, width, eave, peak, slate, { overhang: 0.17 });
  gabledFace(out, f, 0, eave, width, peak - eave, 0.18, lod);
  if (lod >= 1) sash(out, f, 0, sill + 0.1, width * 0.65, eave - sill - 0.34, lod, { mullions: 1 });
}

function railing(out, f, l, r, y, height, d, lod, color, dense = false) {
  const slot = dense ? 'iron' : 'timber';
  const top = y + height;
  beam(out, slot, f.P(l, top, d), f.P(r, top, d), dense ? 0.036 : 0.075, 0.065, color);
  if (lod === 0) return;
  beam(out, slot, f.P(l, y + 0.09, d), f.P(r, y + 0.09, d), 0.035, 0.045, color);
  const spacing = lod === 3 && dense ? 0.22 : lod >= 2 ? 0.41 : 1.9;
  const count = Math.ceil((r - l) / spacing);
  for (let i = 0; i <= count; i++) {
    const u = l + ((r - l) * i) / count;
    beam(
      out,
      slot,
      f.P(u, y + 0.02, d),
      f.P(u, top + (dense && lod >= 2 ? 0.12 : 0), d),
      0.038,
      0.039,
      color,
    );
  }
}

function crest(out, box, y, height, lod) {
  const points = section(box, y);
  for (let edge = 0; edge < points.length; edge++) {
    const a = points[edge];
    const b = points[(edge + 1) % points.length];
    const f = facade([a[0], a[2]], [b[0] - a[0], b[2] - a[2]]);
    const width = Math.hypot(b[0] - a[0], b[2] - a[2]);
    railing(out, f, 0, width, y, height, 0, lod, darkIron, true);
    if (lod >= 1) {
      beam(out, 'iron', a, [a[0], y + height + 0.47, a[2]], 0.065, 0.063, darkIron);
    }
  }
}

function veranda(out, lod) {
  const f = facade([8.19, 0], [0, -1]);
  solid(out, 'base', [8.04, -7.47, 10.03, 6.85], -0.42, frontFloor, baseStone);
  solid(out, 'stone', [8.05, -7.6, 10.17, 6.99], frontFloor - 0.18, frontFloor, limestone);
  solid(out, 'timber', [8.01, -7.67, 10.23, 7.04], porchCornice - 0.33, porchCornice, timber);
  solid(
    out,
    'stone',
    [7.98, -7.82, 10.33, 7.19],
    porchCornice - 0.08,
    porchCornice + 0.12,
    limestone,
  );
  roof(
    out,
    [7.99, -7.83, 10.34, 7.2],
    porchCornice + 0.11,
    [8.12, -7.53, 9.96, 6.89],
    porchCornice + 0.46,
    [8.32, -7.39, 9.72, 6.79],
    porchCornice + 0.6,
    0,
  );
  for (let step = 0; step < 7; step++) {
    solid(
      out,
      'stone',
      [9.79, -1.36, 11.69 - step * 0.223, 1.3],
      -0.23,
      ((step + 1) * frontFloor) / 7,
      limestone,
    );
  }
  for (const u of [-6.78, -5.22, -2.94, -1.55, 1.49, 2.86, 5.23, 7.47]) {
    fbox(
      out,
      'timber',
      f,
      u - 0.096,
      u + 0.096,
      frontFloor,
      porchCornice - 0.25,
      1.61,
      1.89,
      timber,
    );
    if (lod >= 1) {
      for (const y of [frontFloor + 0.1, porchCornice - 0.55]) {
        fbox(out, 'stone', f, u - 0.16, u + 0.16, y - 0.08, y + 0.13, 1.54, 1.95, buff);
      }
    }
    if (lod >= 2) {
      for (const sign of [-1, 1]) {
        beam(
          out,
          'timber',
          f.P(u, porchCornice - 1.02, 1.85),
          f.P(u + 0.32 * sign, porchCornice - 0.32, 1.86),
          0.1,
          0.095,
          limestone,
        );
      }
    }
  }
  const canopyFront = 11.45;
  const canopyTop = porchCornice + 0.19;
  const canopy = [10.12, -1.63, canopyFront, 1.63];
  solid(out, 'stone', canopy, porchCornice - 0.13, canopyTop, limestone);
  gableRoof(out, 'roof', [10.47, 0], [canopyFront, 0], 3.26, canopyTop, canopyTop + 0.91, slate, {
    overhang: 0.11,
  });
  gabledFace(out, facade([canopyFront, 0], [0, -1]), 0, canopyTop, 3.26, 0.91, 0.12, lod);
  for (const z of [-1.53, 1.53]) {
    solid(
      out,
      'timber',
      [10.96, z - 0.12, 11.24, z + 0.12],
      frontFloor,
      porchCornice - 0.09,
      timber,
    );
    if (lod >= 1) {
      solid(out, 'stone', [10.04, z - 0.21, 11.43, z + 0.21], 0.01, frontFloor + 0.14, baseStone);
      solid(
        out,
        'stone',
        [10.93, z - 0.17, 11.27, z + 0.17],
        porchCornice - 0.38,
        porchCornice - 0.11,
        limestone,
      );
    }
  }
  if (lod >= 1) {
    railing(out, f, -6.86, -1.55, frontFloor, 0.61, 1.9, lod, limestone);
    railing(out, f, 1.51, 7.57, frontFloor, 0.61, 1.9, lod, limestone);
    railing(out, f, -7.17, 7.6, porchCornice + 0.58, 0.58, 1.43, lod, darkIron, true);
    for (const z of [-1.47, 1.41]) {
      beam(out, 'iron', [11.82, 0.77, z], [10.2, frontFloor + 0.73, z], 0.047, 0.047, darkIron);
      beam(out, 'iron', [11.82, 0.03, z], [11.82, 0.77, z], 0.055, 0.055, darkIron);
    }
  }
}

function southAndNorthBays(out, lod) {
  for (const sign of [-1, 1]) {
    const outer = sign === 1 ? 9.41 : 9.73;
    const w = sign === 1 ? [-2.7, 4.53] : [-2.56, 4.58];
    solid(
      out,
      'masonry',
      [-4.08, Math.min(sign * 7.98, sign * outer), 6.02, Math.max(sign * 7.98, sign * outer)],
      0.77,
      mainCornice - 0.32,
      brick,
    );
    const plane = facade([0, sign * outer], [sign, 0]);
    for (const x of w) {
      const edge = x * sign;
      fbox(
        out,
        'masonry',
        plane,
        edge - 1.66,
        edge + 1.66,
        0.82,
        mainCornice - 0.22,
        -0.12,
        0.28,
        brick,
      );
      const bay = facade([0, sign * (outer + 0.28)], [sign, 0]);
      group(out, bay, edge, 1.65, 3.32, lod);
      group(out, bay, edge, upperWindows - 0.36, 3.15, lod);
      if (sign === 1 || lod >= 1) {
        dormer(
          out,
          [x, sign * 6.16],
          [x, sign * (outer + 0.13)],
          3.08,
          mainCornice - 0.28,
          mainCornice + 2.27,
          mainCornice + 3.87,
          lod,
        );
      }
    }
  }
}

function rearWing(out, lod) {
  const wing = outline.slice(21, 35);
  wing.push([-6.86, -3.4], [-6.86, 4.93]);
  slab(out, 'masonry', wing, 0.61, 6.39, shadeBrick);
  solid(out, 'masonry', [-8.35, -3.41, -5.19, 5.1], 0.54, 7.11, shadeBrick);
  roof(
    out,
    [-24.1, -3.68, -5.89, 3.69],
    6.42,
    [-23.73, -3.26, -6.37, 3.27],
    7.68,
    [-22.78, -2.4, -7.22, 2.47],
    8.13,
    lod,
  );
  roof(
    out,
    [-20.04, 2.79, -15.22, 7.24],
    6.41,
    [-19.78, 3.1, -15.5, 6.98],
    7.61,
    [-19.11, 3.84, -16.13, 6.25],
    8.04,
    lod,
  );
  if (lod === 0) return;
  for (const sign of [-1, 1]) {
    const wall = facade([0, sign * (sign === 1 ? 3.4 : 3.42)], [sign, 0]);
    for (const x of [-21.4, -13.65, -10.7]) {
      sash(out, wall, x * sign, 1.3, 0.87, 2.47, lod, { head: 'tudor' });
      sash(out, wall, x * sign, 4.47, 0.84, 1.4, lod);
    }
  }
  const end = facade([-23.85, 0], [0, 1]);
  for (const z of [-1.9, 0.1, 1.98]) {
    sash(out, end, z, 1.4, 0.81, 2.55, lod);
    sash(out, end, z, 4.42, 0.8, 1.39, lod);
  }
}

function house(out, lod) {
  slab(out, 'base', outline, foundation, 0.77, baseStone);
  solid(out, 'masonry', mainBox, 0.58, mainCornice - 0.35, brick);
  cornice(out, mainBox, mainCornice, lod);
  const mainRim = [-5.25, -5.54, 6.06, 5.34];
  roof(
    out,
    mainRoof,
    mainCornice - 0.05,
    [-5.65, -6.09, 6.58, 5.96],
    mansardTop - 0.67,
    mainRim,
    mansardTop,
    lod,
  );
  crest(out, mainRim, mansardTop + 0.015, 0.55, lod);
  for (const z of [-4.68, 4.34]) {
    dormer(out, [5.58, z], [8.46, z], 2.51, 11.76, 13.69, 14.79, lod);
  }
  const east = facade([8.17, 0], [0, -1]);
  const west = facade([-5.45, 0], [0, 1]);
  for (const u of [-4.83, 4.87]) {
    group(out, east, u, upperWindows, 2.78, lod);
    group(out, west, u, upperWindows - 0.18, 2.64, lod);
  }
  if (lod >= 1) {
    for (const u of [-5.81, -3.81, 3.82, 5.84])
      sash(out, east, u, 1.6, 0.92, 3.06, lod, { color: timber, glass: darkDoor });
    sash(out, west, 0, upperWindows - 0.1, 1.37, 2.62, lod, { head: 'tudor' });
    const corners = [
      [-5.46, -8.56],
      [-5.46, 8.16],
      [8.15, -8.56],
      [8.15, 8.16],
    ];
    for (const [x, z] of corners) {
      for (const y of [1.01, 5.56, 9.63]) {
        solid(out, 'stone', [x - 0.21, z - 0.22, x + 0.21, z + 0.22], y, y + 0.33, limestone);
      }
    }
  }
  for (const [x, z] of [
    [-3.47, -5.95],
    [-3.03, 5.86],
  ]) {
    solid(out, 'masonry', [x - 0.33, z - 0.35, x + 0.33, z + 0.35], 12.8, 16.2, shadeBrick);
    solid(out, 'stone', [x - 0.43, z - 0.42, x + 0.43, z + 0.42], 16.19, 16.34, buff);
  }
}

function tower(out, lod) {
  solid(out, 'masonry', towerBox, frontFloor, towerCornice - 0.39, brick);
  cornice(out, towerBox, towerCornice, lod);
  const f = facade([towerBox[2], 0], [0, -1]);
  sash(out, f, 0, frontFloor, 2.22, 3.78, lod, { color: timber, glass: darkDoor, mullions: 1 });
  group(out, f, 0, 6.45, 2.65, lod);
  group(out, f, 0, 11.75, 3.8, lod);
  if (lod >= 1) {
    for (const z of [-2.52, 2.49]) {
      const flankSign = Math.sign(z);
      sash(out, facade([7.92, z], [flankSign, 0]), 0, 12.12, 0.96, 2.92, lod, { head: 'tudor' });
    }
    for (const y of [6.36, 11.66]) {
      fbox(out, 'stone', f, -1.8, 1.8, y - 0.25, y, 0.03, 0.78, limestone);
      railing(out, f, -1.67, 1.67, y, 0.58, 0.74, lod, limestone);
    }
  }
  const lowerCap = [6.43, -1.73, 9.74, 1.71];
  roof(
    out,
    [4.87, -3.16, 11.26, 3.1],
    towerCornice - 0.01,
    [6.08, -2.03, 10.03, 2.0],
    21.79,
    lowerCap,
    22.53,
    lod,
  );
  for (const [a, b] of [
    [
      [8.72, 0],
      [10.96, 0],
    ],
    [
      [7.34, 1.35],
      [7.34, 2.87],
    ],
    [
      [7.34, -1.34],
      [7.34, -2.87],
    ],
  ])
    dormer(out, a, b, 1.76, 18.08, 19.87, 21.13, lod);
  cornice(out, lowerCap, 22.77, lod, false);
  const topRim = [7.16, -0.92, 8.98, 0.9];
  roof(
    out,
    [6.24, -1.95, 9.96, 1.92],
    22.73,
    [6.94, -1.18, 9.2, 1.13],
    towerTop - 0.44,
    topRim,
    towerTop,
    lod,
  );
  dormer(out, [8.59, 0], [9.72, 0], 1.3, 22.91, 23.53, 24.68, lod);
  crest(out, topRim, towerTop + 0.06, crestTop - towerTop - 0.51, lod);
}

function build(out, lod) {
  house(out, lod);
  rearWing(out, lod);
  southAndNorthBays(out, lod);
  veranda(out, lod);
  tower(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'vaile-mansion-model.mjs';
const camera = [53, 24, 46];
const lookAt = [-1.7, 9.6, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'residential',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Vaile Mansion in Independence, Missouri, with a slate mansard, tall center tower, veranda, and attached rear wing.',
  camera,
  lookAt,
  sunDirection: [51, 58, 32],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.93,
    basis: 'The named house footprint and attached rear wing.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'east-veranda-tower-and-paired-dormers', position: [60, 11, -5], lookAt: [7, 11.8, 0] },
    { name: 'south-window-bays-and-rear-wing', position: [5, 20, 49], lookAt: [-4, 9.2, 0] },
    { name: 'bracketed-eaves-and-roof-cresting', position: [34, 23, -21], lookAt: [5.7, 17.4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'vaile-mansion-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.58,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.088, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.032, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
