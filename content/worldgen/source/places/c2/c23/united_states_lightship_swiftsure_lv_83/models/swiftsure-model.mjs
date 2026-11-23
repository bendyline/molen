import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  fan,
  lathe,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  tube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');

const red = rgb('9d483c');
const redDark = rgb('75352c');
const underwater = rgb('4a3630');
const white = rgb('e8e3d0');
const gray = rgb('a0a093');
const yellow = rgb('c6a36a');
const black = rgb('303b3a');
const glass = rgb('344a4c');
const deckColor = rgb('a08b6d');
const canvas = rgb('bdb8a0');
const surfaces = {
  hull: { slot: 'wall', graph: 'metal_painted', roughness: 0.86, metallic: 0.09 },
  deck: { slot: 'foundation', graph: 'wood_plain', roughness: 0.87 },
  cabin: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.85 },
  metal: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.71, metallic: 0.14 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46 },
};

const halfLength = plan.dimensions.lengthM / 2;
const halfBeam = plan.dimensions.beamM / 2;
// Deck breadth and sheer are keyed to the named plan outline and HAER WA-175 sheets 1 and 4.
const stations = [
  [-halfLength, 0.09, 3.73],
  [-19.22, 1.49, 3.69],
  [-18.28, 2.48, 3.63],
  [-16.36, 3.32, 3.51],
  [-13.9, 3.79, 3.39],
  [-9.16, 4.17, 3.24],
  [-3.65, 4.31, 3.21],
  [0.7, halfBeam, 3.25],
  [6.53, 4.26, 3.41],
  [12.55, 3.59, 3.88],
  [16.92, 2.36, 4.52],
  [18.72, 1.08, 4.83],
  [halfLength, 0.072, 5.05],
];

function profile(x) {
  const end = stations.findIndex(([station]) => station >= x);
  if (end <= 0) return end === 0 ? stations[0] : stations.at(-1);
  const [a, widthA, topA] = stations[end - 1];
  const [b, widthB, topB] = stations[end];
  const t = (x - a) / (b - a);
  return [x, widthA + (widthB - widthA) * t, topA + (topB - topA) * t];
}

const deckY = (x) => profile(x)[2] - 0.43;
const rake = (x) => -0.15 * (x < 0 ? -1 : 1) * Math.pow(Math.abs(x) / halfLength, 4);
const hullSide = (x, y) => {
  const [, width, top] = profile(x);
  return width * (0.92 + Math.min(1, Math.max(0, y / top)) * 0.08);
};

function hull(out, detail) {
  const crossSection = ([x, width, top], side) => {
    const sweep = rake(x);
    const endShift = x < 0 ? -sweep * 7 : sweep * 10;
    return [
      [x + endShift, -1.28, side * width * 0.64],
      [x + endShift * 0.68, -0.68, side * width * 0.87],
      [x + endShift * 0.42, -0.13, side * width * 0.914],
      [x + endShift * 0.36, 0.045, side * width * 0.923],
      [x, top * 0.33, side * width * 0.947],
      [x, top * 0.69, side * width * 0.975],
      [x, top, side * width],
    ];
  };
  const sections = detail ? stations : stations.filter((_, i) => ![1, 6, 11].includes(i));
  const band = [underwater, redDark, gray, red, red, red];
  for (const side of [-1, 1]) {
    const edge = sections.map((station) => crossSection(station, side));
    for (let i = 1; i < edge.length; i++) {
      const aft = edge[i - 1];
      const forward = edge[i];
      for (let j = 1; j < aft.length; j++) {
        const face = [aft[j - 1], forward[j - 1], forward[j], aft[j]];
        if (side < 0) face.reverse();
        const tint = band[j - 1];
        tri(out, 'hull', face[0], face[1], face[2], tint);
        tri(out, 'hull', face[0], face[2], face[3], tint);
      }
    }
  }
  for (let i = 1; i < sections.length; i++) {
    const sectionsAtEnds = [sections[i - 1], sections[i]];
    const a = crossSection(sectionsAtEnds[0], -1)[0];
    const b = crossSection(sectionsAtEnds[1], -1)[0];
    const c = crossSection(sectionsAtEnds[1], 1)[0];
    const d = crossSection(sectionsAtEnds[0], 1)[0];
    quad4(out, 'hull', a, b, c, d, underwater);
    const rim = ([x, width, top], side) => [x, top - 0.43, side * width * 0.985];
    const floor = [
      rim(sectionsAtEnds[0], 1),
      rim(sectionsAtEnds[1], 1),
      rim(sectionsAtEnds[1], -1),
      rim(sectionsAtEnds[0], -1),
    ];
    quad4(out, 'deck', ...floor, deckColor);
  }
  for (const [station, orientation] of [
    [sections[0], -1],
    [sections.at(-1), 1],
  ]) {
    const port = crossSection(station, orientation);
    const starboard = crossSection(station, -orientation);
    for (let j = 1; j < port.length; j++)
      quad4(out, 'hull', port[j - 1], starboard[j - 1], starboard[j], port[j], band[j - 1]);
  }
  for (const side of [-1, 1]) {
    const gunwale = sections.map(([x, width, top]) => [x, top, side * width]);
    tubePath(out, 'metal', gunwale, detail > 1 ? 0.055 : 0.066, redDark, detail > 1 ? 6 : 4);
    if (detail > 1) {
      for (const fraction of [0.33, 0.69]) {
        const panelSeam = sections.slice(1, -1).map(([x, , top]) => {
          const y = top * fraction;
          return [x, y, (hullSide(x, y) + 0.047) * side];
        });
        tubePath(out, 'metal', panelSeam, 0.022, redDark, 4);
      }
      for (const source of [3.52, 4.01]) {
        const row = sections
          .slice(2, -2)
          .map(([x, width]) => [x, deckY(x) + source - 3.05, side * (width - 0.14)]);
        tubePath(out, 'metal', row, 0.035, gray, 5);
      }
      for (let x = -16.8; x < 16; x += 1.65) {
        const z = side * (profile(x)[1] - 0.14);
        const y = deckY(x);
        tube(out, 'metal', [x, y, z], [x, y + 0.98, z], 0.035, gray, 5);
      }
    }
  }
}

function house(out, shape, detail) {
  const { x, width, beam, base, wall, roof } = shape;
  const l = x - width / 2;
  const r = x + width / 2;
  const w = beam / 2;
  const cut = shape.corner;
  const ring = [
    [l, -w + cut],
    [l + cut, -w],
    [r - cut, -w],
    [r, -w + cut],
    [r, w - cut],
    [r - cut, w],
    [l + cut, w],
    [l, w - cut],
  ];
  extrude(out, 'cabin', ring, base, base + wall, white, { top: false });
  const canopy = ring.map(([a, b]) => [x + (a - x) * 1.045, b * 1.065]);
  const top = base + wall + 0.14;
  extrude(out, 'metal', canopy, base + wall - 0.03, top, white, { top: false });
  fan(out, 'metal', canopy.map(([a, b]) => [a, top, b]).reverse(), white);
  const windowRow = (a, b, count) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    const [nx, nz] = [dz / length, -dx / length];
    const point = (u, y, offset) => [a[0] + dx * u + nx * offset, y, a[1] + dz * u + nz * offset];
    const y = base + wall * 0.43;
    const h = wall * 0.41;
    for (let i = 0; i < count; i++) {
      const start = (i + 0.16) / count;
      const end = (i + 0.84) / count;
      const panel = (slot, u, v, lo, hi, depth, tint) =>
        quad4(
          out,
          slot,
          point(v, lo, depth),
          point(u, lo, depth),
          point(u, hi, depth),
          point(v, hi, depth),
          tint,
        );
      panel('window', start, end, y, y + h, 0.025, glass);
      if (detail > 1) {
        const middle = (start + end) / 2;
        panel('metal', middle - 0.018, middle + 0.018, y, y + h, 0.042, white);
        panel('metal', start - 0.013, end + 0.013, y - 0.062, y, 0.042, gray);
      }
    }
  };
  if (detail > 0) {
    windowRow(ring[1], ring[2], shape.sideWindows);
    windowRow(ring[5], ring[6], shape.sideWindows);
    windowRow(ring[3], ring[4], shape.endWindows);
    windowRow(ring[7], ring[0], shape.endWindows);
  }
  if (roof && detail > 1) {
    const upper = base + wall + 0.14;
    const rail = canopy.map(([a, b]) => [a, upper + 0.74, b]);
    tubePath(out, 'metal', rail, 0.035, yellow, 5, true);
    for (const [a, b] of canopy)
      tube(out, 'metal', [a, upper, b], [a, upper + 0.74, b], 0.032, gray, 5);
  }
}

function cylinder(out, x, z, layers, slot, color, sides) {
  lathe(
    out,
    slot,
    [x, z],
    layers.map(([y, r]) => [y, r, r]),
    sides,
    color,
  );
}

function mast(out, detail, x, platform, lower) {
  const base = deckY(x);
  const sides = [6, 10, 14, 18][detail];
  cylinder(
    out,
    x,
    0,
    [
      [base, 0.22],
      [platform + 0.22, 0.125],
    ],
    'metal',
    yellow,
    sides,
  );
  cylinder(
    out,
    x,
    0,
    [
      [platform - 0.48, 0.39],
      [platform - 0.31, 0.82],
      [platform - 0.22, 0.94],
      [platform, 0.94],
    ],
    'metal',
    yellow,
    sides,
  );
  cylinder(
    out,
    x,
    0,
    [
      [platform - 0.01, 0.31],
      [platform + 0.42, 0.29],
      [platform + 0.52, 0.43],
    ],
    'window',
    rgb('6f775b'),
    sides,
  );
  cylinder(
    out,
    x,
    0,
    [
      [platform + 0.52, 0.43],
      [platform + 0.62, 0.36],
      [platform + 0.82, 0.09],
    ],
    'metal',
    yellow,
    sides,
  );
  tube(
    out,
    'metal',
    [x, platform + 0.62, 0],
    [x, platform + 3.06, 0],
    0.049,
    yellow,
    sides > 8 ? 6 : 4,
  );
  tube(out, 'metal', [x, platform - 0.36, -3.4], [x, platform - 0.36, 3.4], 0.056, yellow, 5);
  if (detail > 0) {
    const ring = Array.from({ length: sides }, (_, i) => {
      const angle = (2 * Math.PI * i) / sides;
      return [x + 0.85 * Math.cos(angle), platform + 0.67, 0.85 * Math.sin(angle)];
    });
    tubePath(out, 'metal', ring, 0.034, yellow, 5, true);
    for (const p of ring.filter((_, i) => i % 2 === 0))
      tube(out, 'metal', [p[0], platform - 0.03, p[2]], p, 0.028, yellow, 5);
    if (lower) {
      cylinder(
        out,
        x,
        0,
        [
          [base + 5.56, 0.37],
          [base + 5.72, 0.64],
        ],
        'metal',
        yellow,
        sides,
      );
      const up = base + 6.17;
      tube(out, 'metal', [x - 0.29, up, -0.22], [x - 0.29, up, -0.78], 0.09, yellow, 7);
      tube(out, 'metal', [x - 0.29, up, 0.22], [x - 0.29, up, 0.78], 0.09, yellow, 7);
    }
  }
  if (detail > 1) {
    const p = [x, platform - 0.5, 0];
    for (const side of [-1, 1]) {
      for (const offset of detail === 3 ? [-2.86, -1.75, -0.65, 0.55] : [-2.55, -0.7]) {
        const end = x + offset;
        tube(
          out,
          'metal',
          p,
          [end, deckY(end) + 0.55, side * (profile(end)[1] - 0.55)],
          0.025,
          yellow,
          4,
        );
      }
    }
    if (detail === 3) {
      for (let y = base + 1; y < platform - 0.5; y += 0.35) {
        const t = (y - base) / (platform - base);
        const center = x - 0.42 * (1 - t);
        tube(out, 'metal', [center, y, -0.205], [center, y, 0.205], 0.024, yellow, 4);
      }
    }
  }
}

function portholes(out, detail) {
  const sides = detail === 3 ? 14 : 8;
  for (const sign of [-1, 1]) {
    for (const [x, y, size] of [
      [-17.25, 2.7, 0.13],
      [-15.6, 2.53, 0.13],
      [-14.16, 2.45, 0.13],
      [-12.5, 2.39, 0.13],
      [-10.44, 2.26, 0.15],
      [-8.56, 2.27, 0.14],
      [-6.6, 2.21, 0.14],
      [-4.7, 2.22, 0.14],
      [-2.84, 2.2, 0.14],
      [0.66, 2.23, 0.14],
      [2.45, 2.24, 0.14],
      [4.4, 2.31, 0.14],
      [6.27, 2.38, 0.14],
      [8.44, 2.47, 0.16],
      [10.4, 2.57, 0.16],
      [12.55, 2.76, 0.17],
      [14.49, 3.05, 0.15],
      [16.1, 1.73, 0.39],
      [17.76, 0.68, 0.36],
    ]) {
      const point = (angle, radius, offset) => {
        const a = x + radius * Math.cos(angle);
        const b = y + radius * Math.sin(angle);
        return [a, b, sign * (hullSide(a, b) + offset)];
      };
      const hawse = size > 0.2;
      const rimDepth = hawse && detail > 1 ? (x > 17 ? 0.36 : 0.21) : 0.055;
      const center = point(0, 0, hawse ? rimDepth - 0.024 : 0.052);
      for (let i = 0; i < sides; i++) {
        const a = (sign * 2 * Math.PI * i) / sides;
        const b = (sign * 2 * Math.PI * (i + 1)) / sides;
        tri(
          out,
          'window',
          center,
          point(a, size, rimDepth - 0.025),
          point(b, size, rimDepth - 0.025),
          black,
        );
        if (detail === 3 || hawse) {
          const thickness = hawse ? 0.127 : 0.045;
          quad4(
            out,
            'metal',
            point(b, size, rimDepth),
            point(a, size, rimDepth),
            point(a, size + thickness, rimDepth),
            point(b, size + thickness, rimDepth),
            hawse ? red : redDark,
          );
          if (hawse && detail > 1)
            quad4(
              out,
              'metal',
              point(a, size + thickness, rimDepth),
              point(a, size + thickness, 0.019),
              point(b, size + thickness, 0.019),
              point(b, size + thickness, rimDepth),
              redDark,
            );
        }
      }
    }
  }
}

const letters = {
  S: [
    [
      [1, 0.9],
      [0.75, 1],
      [0.2, 1],
      [0, 0.79],
      [0.1, 0.61],
      [0.9, 0.41],
      [1, 0.22],
      [0.8, 0],
      [0.2, 0],
      [0, 0.11],
    ],
  ],
  W: [
    [
      [0, 1],
      [0.18, 0],
      [0.5, 0.55],
      [0.82, 0],
      [1, 1],
    ],
  ],
  I: [
    [
      [0.25, 1],
      [0.75, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
    [
      [0.25, 0],
      [0.75, 0],
    ],
  ],
  F: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0.54],
      [0.77, 0.54],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0.2],
      [0.2, 0],
      [0.8, 0],
      [1, 0.2],
      [1, 1],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.82, 1],
      [1, 0.82],
      [1, 0.65],
      [0.8, 0.48],
      [0, 0.48],
    ],
    [
      [0.46, 0.48],
      [1, 0],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.52],
      [0.77, 0.52],
    ],
  ],
};
function vesselName(out) {
  for (const side of [-1, 1]) {
    for (const [index, letter] of [...'SWIFTSURE'].entries()) {
      const base = -7.6 + side * (index - 4) * 1.02;
      const point = (u, v) => {
        const x = base + side * (u - 0.5) * 0.68;
        const y = 0.84 + v * 1.27;
        return [x, y, side * (hullSide(x, y) + 0.045)];
      };
      for (const line of letters[letter]) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1];
          const b = line[i];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const u = ((a[1] - b[1]) / l) * 0.08;
          const v = ((b[0] - a[0]) / l) * 0.054;
          quad4(
            out,
            'metal',
            point(a[0] + u, a[1] + v),
            point(a[0] - u, a[1] - v),
            point(b[0] - u, b[1] - v),
            point(b[0] + u, b[1] + v),
            white,
          );
        }
      }
    }
  }
}

function fittings(out, detail) {
  const weatherDeck = deckY(4);
  const funnel = -1.45;
  const base = deckY(funnel);
  const sides = [7, 11, 15, 19][detail];
  cylinder(
    out,
    funnel,
    0,
    [
      [base - 0.02, 0.8],
      [base + 1.03, 0.8],
      [base + 1.03, 0.54],
      [base + 5.21, 0.48],
    ],
    'metal',
    yellow,
    sides,
  );
  cylinder(
    out,
    funnel,
    0,
    [
      [base + 5.19, 0.51],
      [base + 6.65, 0.49],
      [base + 6.69, 0.55],
    ],
    'metal',
    black,
    sides,
  );
  if (detail > 0) {
    for (const z of [-0.92, 0.92]) {
      const vent = [
        [-3.3, base, z],
        [-3.3, base + 1.5, z],
        [-3.13, base + 1.77, z],
        [-2.84, base + 1.77, z],
      ];
      tubePath(out, 'metal', vent, 0.14, yellow, detail > 1 ? 8 : 5);
    }
    for (const [x, w, h, z] of [
      [11.2, 1.18, 0.48, 0],
      [15.2, 0.8, 0.52, 0],
      [-7.1, 1.14, 0.37, 0],
      [-15.4, 0.7, 0.6, 0],
      [-17, 0.96, 0.37, -0.35],
    ]) {
      const y = deckY(x);
      abox(out, 'deck', [x - w / 2, y - 0.1, z - 0.63], [x + w / 2, y + h, z + 0.63], canvas);
      abox(
        out,
        'metal',
        [x - w * 0.57, y + h, z - 0.71],
        [x + w * 0.57, y + h + 0.09, z + 0.71],
        yellow,
      );
    }
    for (const [x, side] of [
      [14.7, -1],
      [14.7, 1],
      [-16.7, -1],
      [-16.7, 1],
    ]) {
      const z = side * profile(x)[1] * 0.67;
      const y = deckY(x);
      cylinder(
        out,
        x,
        z,
        [
          [y, 0.17],
          [y + 0.36, 0.14],
          [y + 0.43, 0.21],
        ],
        'metal',
        black,
        sides,
      );
    }
    const x = 16.37,
      z = -1.05,
      y = deckY(x);
    const davit = [
      [x, y, z],
      [x + 0.12, y + 1.45, z],
      [x + 0.44, y + 2.29, z],
      [x + 0.93, y + 2.62, z],
      [x + 1.45, y + 2.72, z],
    ];
    tubePath(out, 'metal', davit, 0.112, yellow, detail > 1 ? 8 : 5);
    tube(out, 'metal', davit.at(-1), [davit.at(-1)[0], y + 2.31, z], 0.03, black, 4);
  }
  if (detail > 1) {
    const rail = [
      [3.45, weatherDeck + 3.15, -1.73],
      [3.45, weatherDeck + 3.15, 1.73],
    ];
    tube(out, 'metal', rail[0], rail[1], 0.036, gray, 5);
    tube(out, 'metal', [-9.9, 15.76, 0.05], [4.42, 17.03, 0.05], 0.026, black, 4);
    tube(out, 'metal', [4.42, 16.74, 0], [18.4, deckY(18.4) + 1.11, 0], 0.027, black, 4);
    tube(out, 'metal', [-9.9, 15.52, 0], [-18.7, deckY(-18.7) + 0.94, 0], 0.026, black, 4);
  }
}

function build(out, detail) {
  hull(out, detail);
  house(
    out,
    {
      x: 4.3,
      width: 10.1,
      beam: 4.55,
      corner: 0.47,
      base: 2.73,
      wall: 1.99,
      sideWindows: 5,
      endWindows: 2,
    },
    detail,
  );
  house(
    out,
    {
      x: 7.15,
      width: 4.05,
      beam: 3.74,
      corner: 0.48,
      base: 4.76,
      wall: 1.75,
      sideWindows: 2,
      endWindows: 3,
      roof: true,
    },
    detail,
  );
  house(
    out,
    {
      x: -12.25,
      width: 5.4,
      beam: 3.84,
      corner: 0.17,
      base: 2.8,
      wall: 1.88,
      sideWindows: 4,
      endWindows: 2,
    },
    detail,
  );
  mast(out, detail, 4.42, plan.dimensions.forwardLightPlatformApproxM, true);
  mast(out, detail, -9.9, plan.dimensions.aftLightPlatformApproxM, false);
  fittings(out, detail);
  if (detail > 0) {
    vesselName(out);
    portholes(out, detail);
  }
  if (detail > 1) {
    for (const x of [18.43, -18.4]) {
      const y = deckY(x);
      tube(out, 'metal', [x, y, 0], [x + 0.15, y + 2.65, 0], 0.047, yellow, 6);
    }
    const chain = [
      [14.5, 4.61, -1.83],
      [16.67, 4.61, -1.3],
      [18.57, 4.84, -0.63],
    ];
    tubePath(out, 'metal', chain, 0.048, black, 6);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'swiftsure-model.mjs';
const camera = [32, 20, -46];
const lookAt = [1.6, 8.3, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'lighthouse',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The preserved red steel and timber lightship with twin yellow beacon masts and a black-topped funnel at Seattle’s Historic Ships Wharf.',
  camera,
  lookAt,
  sunDirection: [38, 64, -51],
  mediumFiContext: {
    scale: 1.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.93,
    basis: 'The individually tagged museum ship hull only.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'place-recipe-kit.mjs',
    'polygon-triangulation.mjs',
    'structure-mesh.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'bow-hawsepipes-and-pilothouse', position: [36, 11, -23], lookAt: [11, 6.4, 0] },
    { name: 'starboard-name-and-twin-lights', position: [4, 14, -53], lookAt },
    { name: 'after-cabin-and-open-lantern-decks', position: [-40, 29, 34], lookAt: [-4, 8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'swiftsure-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.41, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.048, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model informed by Ciar’s published public-domain Qualla close-up, U.S. Lighthouse Board drawings, federal HAER and USDA photographs, OpenStreetMap, and USGS elevation.',
};
