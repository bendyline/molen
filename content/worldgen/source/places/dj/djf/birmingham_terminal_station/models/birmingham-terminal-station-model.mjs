/** Birmingham Terminal Station, circa 1913. The plan is registered to the Fifth Avenue subway. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const {
  domeTop,
  towerTop,
  domeDiameter,
  frontFloor,
  trackLevel,
  subwayClearance,
  subwayHalfWidth,
  subwayApproachEnd,
  subwayMouthZ,
  railBayWidth,
  platformWidth,
  pierInterval,
} = plan.section;
const foundation = -3.8;

const surfaces = {
  masonry: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  sandstone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89, metallic: 0 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.67, metallic: 0.26 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    buff: 'c5a483',
    lightBuff: 'd0b295',
    shadedBrick: 'ac8c71',
    stone: 'c2b8a4',
    lightStone: 'd3cabb',
    grayStone: 'a69d89',
    terraCotta: 'ad593c',
    ridge: '8d4a38',
    bronze: '5d6d63',
    darkBronze: '46564e',
    glass: '455052',
    lightGlass: '697575',
    opening: '343b35',
    concrete: 'b3aa9a',
    soot: '8e897d',
    ballast: '716d64',
    asphalt: '77756d',
    rail: '57544e',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

function rectangle(out, slot, x0, x1, y0, y1, z, tint) {
  if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}

function archProfile(x, width, spring, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = (Math.PI * i) / segments;
    return [
      x - (width / 2) * Math.cos(angle),
      i === 0 || i === segments ? spring : spring + rise * Math.sin(angle),
    ];
  });
}

function steppedArch(out, slot, inner, outer, z, tint) {
  for (let i = 1; i < inner.length; i++) {
    const point = ([x, y]) => [x, y, z];
    face(out, slot, [inner[i - 1], inner[i], outer[i], outer[i - 1]].map(point), tint);
  }
}

function opening(out, x, z, width, bottom, spring, rise, lod, monumental = false) {
  const half = width / 2;
  const n = monumental ? [4, 6, 10, 14][lod] : [2, 4, 6, 8][lod];
  const trace = archProfile(x, width, spring, rise, n);
  const outer = archProfile(
    x,
    width + (monumental ? 1.12 : 0.37),
    spring,
    rise + (monumental ? 0.56 : 0.18),
    n,
  );
  const inset = monumental ? 0.34 : 0.09;
  const reveal = z - inset;
  rectangle(out, 'glass', x - half, x + half, bottom, spring, reveal, color.glass);
  for (let i = 1; i < trace.length; i++) {
    triangle(
      out,
      'glass',
      [
        [x, spring, reveal],
        [...trace[i], reveal],
        [...trace[i - 1], reveal],
      ],
      color.glass,
    );
    if (lod > 1 && monumental) {
      const [a, b] = [trace[i - 1], trace[i]];
      face(
        out,
        'sandstone',
        [
          [...a, z],
          [...a, reveal],
          [...b, reveal],
          [...b, z],
        ],
        color.grayStone,
      );
    }
  }
  if (lod || monumental) steppedArch(out, 'sandstone', trace, outer, z + 0.014, color.stone);
  if (lod > 1 || monumental) {
    for (const sign of [-1, 1]) {
      const a = x + sign * half,
        b = x + sign * (half + (monumental ? 0.46 : 0.15));
      rectangle(out, 'sandstone', Math.min(a, b), Math.max(a, b), bottom, spring, z, color.stone);
      if (lod > 1 && monumental) {
        const jamb = [
          [a, bottom, reveal],
          [a, spring, reveal],
          [a, spring, z],
          [a, bottom, z],
        ];
        face(out, 'sandstone', sign < 0 ? jamb : [...jamb].reverse(), color.grayStone);
      }
    }
    rectangle(
      out,
      'sandstone',
      x - half - 0.21,
      x + half + 0.21,
      bottom - 0.17,
      bottom,
      z + 0.06,
      color.lightStone,
    );
  }
  if (lod > 1 || (monumental && lod)) {
    const divisions = monumental ? (lod > 1 ? 5 : 3) : 2;
    for (let i = 1; i < divisions; i++) {
      const t = (2 * i) / divisions - 1,
        cx = x + half * t,
        top = spring + rise * Math.sqrt(1 - t * t);
      rectangle(out, 'copper', cx - 0.042, cx + 0.042, bottom, top, reveal + 0.019, color.bronze);
    }
    rectangle(
      out,
      'copper',
      x - half,
      x + half,
      spring - 0.07,
      spring + 0.055,
      reveal + 0.024,
      color.darkBronze,
    );
    if (monumental && lod > 1) {
      for (const y of [bottom + (spring - bottom) / 3, bottom + (2 * (spring - bottom)) / 3]) {
        rectangle(
          out,
          'copper',
          x - half,
          x + half,
          y - 0.04,
          y + 0.04,
          reveal + 0.022,
          color.bronze,
        );
      }
      const rim = archProfile(x, width + 1.65, spring, rise + 0.81, n);
      steppedArch(out, 'sandstone', outer, rim, z + 0.022, color.grayStone);
      const i = Math.floor(n / 2);
      box(
        out,
        'sandstone',
        [x - 0.55, rim[i][1] - 0.3, z - 0.02],
        [x + 0.55, rim[i][1] + 0.23, z + 0.19],
        color.lightStone,
      );
    }
  }
}

function windowAtWall(out, x, z, width, bottom, spring, rise, lod) {
  if (lod >= 2) opening(out, x, z + 0.103, width, bottom, spring, rise, lod);
  else
    rectangle(
      out,
      'glass',
      x - width / 2,
      x + width / 2,
      bottom,
      spring + rise * 0.72,
      z + 0.027,
      color.glass,
    );
}

function fullRoof(out, x0, x1, z0, z1, y, rise, slot = 'tile', tint = color.terraCotta) {
  const rx = Math.min((x1 - x0) * 0.25, (z1 - z0) * 0.33);
  const rz = Math.min((z1 - z0) * 0.42, (x1 - x0) * 0.32);
  loft(
    out,
    slot,
    [
      [
        [x0, y, z1],
        [x1, y, z1],
        [x1, y, z0],
        [x0, y, z0],
      ],
      [
        [x0 + rx, y + rise, z1 - rz],
        [x1 - rx, y + rise, z1 - rz],
        [x1 - rx, y + rise, z0 + rz],
        [x0 + rx, y + rise, z0 + rz],
      ],
    ],
    tint,
  );
}

function cornice(out, [x0, x1, z0, z1], y, overhang = 0.42) {
  box(
    out,
    'sandstone',
    [x0 - overhang * 0.55, y - 0.42, z0 - overhang * 0.55],
    [x1 + overhang * 0.55, y - 0.16, z1 + overhang * 0.55],
    color.grayStone,
  );
  box(
    out,
    'sandstone',
    [x0 - overhang, y - 0.16, z0 - overhang],
    [x1 + overhang, y + 0.07, z1 + overhang],
    color.stone,
  );
}

function rangeWindows(out, x0, x1, z, count, y, height, lod, clerestory = false) {
  const step = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const x = x0 + (i + 0.5) * step;
    const width = Math.min(2.25, step * 0.61);
    windowAtWall(out, x, z, width, y, y + height - 0.45, 0.45, lod);
    if (clerestory && lod)
      windowAtWall(out, x, z, width * 0.82, y + height + 0.55, y + height + 0.78, 0.72, lod);
  }
}

function projectWindowedRange(out, bounds, eave, rise, lod, dining = false) {
  const [x0, x1, z0, z1] = bounds;
  box(out, 'masonry', [x0, foundation, z0], [x1, eave, z1], color.buff);
  fullRoof(out, x0 - 0.4, x1 + 0.4, z0 - 0.53, z1 + 0.4, eave, rise);
  cornice(out, bounds, eave);
  const bottom = frontFloor + 1.05;
  for (const y of dining ? [0.36, 4.45] : [0.38, 3.42]) {
    box(
      out,
      'sandstone',
      [x0 - 0.045, y, z0 - 0.045],
      [x1 + 0.045, y + 0.18, z1 + 0.045],
      color.grayStone,
    );
  }
  if (!lod && x1 - x0 > 28) return;
  rangeWindows(out, x0, x1, z1, Math.ceil((x1 - x0) / (lod > 1 ? 5 : 8)), bottom, 2.7, lod, dining);
  if (lod) {
    const rear = transform(out, Math.PI, [(x0 + x1) / 2, 0, z0]);
    rangeWindows(
      rear,
      -(x1 - x0) / 2,
      (x1 - x0) / 2,
      0,
      Math.ceil((x1 - x0) / 7),
      bottom,
      2.65,
      lod,
    );
  }
  if (dining) {
    for (const [edge, sign] of [
      [x0, -1],
      [x1, 1],
    ]) {
      const side = transform(out, (sign * Math.PI) / 2, [edge, 0, 0]);
      rangeWindows(
        side,
        sign < 0 ? z0 : -z1,
        sign < 0 ? z1 : -z0,
        0,
        lod > 1 ? 7 : 4,
        bottom,
        2.7,
        lod,
        true,
      );
    }
    const middle = (x0 + x1) / 2,
      width = 9.2;
    pediment(out, middle, z1 + 0.22, eave - 1.9, width, 4.15, lod, true);
    if (lod) windowAtWall(out, middle, z1 + 0.24, 3.3, eave - 1.67, eave + 0.06, 0.8, lod);
  }
}

function pediment(out, x, z, y, width, rise, lod, rounded = false) {
  const inner = rounded
    ? archProfile(x, width, y, rise, [4, 6, 10, 12][lod])
    : [
        [x - width / 2, y],
        [x, y + rise],
        [x + width / 2, y],
      ];
  const exterior = rounded
    ? archProfile(x, width + 0.58, y, rise + 0.28, [4, 6, 10, 12][lod])
    : [
        [x - width / 2 - 0.42, y],
        [x, y + rise + 0.39],
        [x + width / 2 + 0.42, y],
      ];
  for (let i = 1; i < inner.length; i++) {
    const [a, b] = [inner[i - 1], inner[i]];
    if (a[1] === y || b[1] === y)
      triangle(
        out,
        'masonry',
        [[a[0], y, z], [b[0], y, z], a[1] === y ? [...b, z] : [...a, z]],
        color.lightBuff,
      );
    else
      face(
        out,
        'masonry',
        [
          [a[0], y, z],
          [b[0], y, z],
          [...b, z],
          [...a, z],
        ],
        color.lightBuff,
      );
  }
  steppedArch(out, 'sandstone', inner, exterior, z + 0.06, color.lightStone);
  rectangle(
    out,
    'sandstone',
    x - width / 2 - 0.42,
    x + width / 2 + 0.42,
    y - 0.21,
    y,
    z + 0.065,
    color.stone,
  );
}

function wallWithMonumentalWindow(
  out,
  x0,
  x1,
  z,
  bottom,
  top,
  windowWidth,
  windowBottom,
  spring,
  rise,
  lod,
) {
  const x = (x0 + x1) / 2,
    half = windowWidth / 2;
  const trace = archProfile(x, windowWidth, spring, rise, [4, 6, 10, 14][lod]);
  rectangle(out, 'masonry', x0, x - half, bottom, top, z, color.buff);
  rectangle(out, 'masonry', x + half, x1, bottom, top, z, color.buff);
  rectangle(out, 'masonry', x - half, x + half, bottom, windowBottom, z, color.buff);
  for (let i = 1; i < trace.length; i++) {
    const [a, b] = [trace[i - 1], trace[i]];
    face(
      out,
      'masonry',
      [
        [...a, z],
        [...b, z],
        [b[0], top, z],
        [a[0], top, z],
      ],
      color.buff,
    );
  }
  opening(out, x, z, windowWidth, windowBottom, spring, rise, lod, true);
  if (lod > 1) {
    const band = (left, right, y, height) =>
      box(out, 'sandstone', [left, y, z - 0.01], [right, y + height, z + 0.14], color.stone);
    band(x0, x1, bottom + 0.63, 0.29);
    band(x0, x1, windowBottom - 0.46, 0.14);
    for (const [left, right] of [
      [x0, x - half - 0.7],
      [x + half + 0.7, x1],
    ]) {
      for (let y = windowBottom + 0.6; y < top - 0.7; y += 1.38) {
        band(left, right, y, 0.13);
      }
    }
  }
}

function dome(out, lod) {
  const radius = domeDiameter / 2;
  const n = [8, 16, 24, 40][lod];
  const rings = (levels) => levels.map(([y, r]) => radialRing(y, r, r, n));
  loft(
    out,
    'masonry',
    rings([
      [19.3, radius + 0.16],
      [22.47, radius + 0.16],
    ]),
    color.lightBuff,
  );
  loft(
    out,
    'sandstone',
    rings([
      [22.25, radius + 0.19],
      [22.64, radius + 0.67],
      [22.9, radius + 0.67],
    ]),
    color.lightStone,
  );
  const profile = [
    [22.9, 10.15],
    [24.56, 9.22],
    [27.08, 7.37],
    [28.88, 4.5],
    [29.62, 1.63],
    [29.71, 0.42],
  ];
  const indices =
    lod === 0 ? [0, 2, 4, 5] : lod === 1 ? [0, 1, 2, 4, 5] : profile.map((_, index) => index);
  loft(out, 'tile', rings(indices.map((i) => profile[i])), color.terraCotta);
  loft(
    out,
    'copper',
    rings([
      [29.67, 0.49],
      [29.98, 0.32],
      [30.13, 0.16],
      [domeTop, 0.065],
    ]),
    color.darkBronze,
  );
  if (lod > 1) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const point = ([y, r]) => [(r + 0.037) * Math.cos(angle), y, (r + 0.037) * Math.sin(angle)];
      for (let j = 1; j < profile.length; j++)
        beam(out, 'tile', point(profile[j - 1]), point(profile[j]), 0.13, 0.11, color.ridge);
    }
  }
}

function mainHeadHouse(out, lod) {
  box(out, 'masonry', [-17.97, 4.48, -19.8], [17.15, 18.6, 12.43], color.buff);
  const projections = [
    [-17.9, -10.34, 12.88, 17.86, 4.76, 10.02, 14.18, 2.72],
    [-10.33, 9.91, 19.43, 20.02, 7.25, 9.6, 14.88, 3.76],
    [9.92, 17.14, 12.88, 17.86, 4.76, 10.02, 14.18, 2.72],
  ];
  for (const [x0, x1, z, top, w, y, spring, rise] of projections) {
    wallWithMonumentalWindow(out, x0, x1, z, 5.03, top, w, y, spring, rise, lod);
    if (z > 14) {
      for (const [edge, sign] of [
        [x0, -1],
        [x1, 1],
      ]) {
        const side = transform(out, (sign * Math.PI) / 2, [edge, 0, 0]);
        rectangle(
          side,
          'masonry',
          sign < 0 ? 12.73 : -z,
          sign < 0 ? z : -12.73,
          4.91,
          top,
          0,
          color.buff,
        );
      }
      cornice(out, [x0, x1, 10.7, z], top);
      pediment(out, (x0 + x1) / 2, z + 0.25, top - 0.01, x1 - x0 + 0.65, 3.2, lod);
      if (lod > 1) {
        const cx = (x0 + x1) / 2;
        const token = archProfile(cx, 1.7, top + 1.17, 0.78, 8);
        const outer = archProfile(cx, 2.76, top + 1.17, 1.19, 8);
        steppedArch(out, 'sandstone', token, outer, z + 0.322, color.lightStone);
        rectangle(
          out,
          'sandstone',
          cx - 0.6,
          cx + 0.6,
          top + 0.56,
          top + 1.52,
          z + 0.34,
          color.stone,
        );
      }
    } else {
      cornice(out, [x0, x1, 7.8, z], top, 0.58);
      fullRoof(out, x0 - 0.51, x1 + 0.51, 6.44, z + 0.51, top, 1.48);
    }
    if (lod) {
      for (const q of [x0 + 0.74, x1 - 0.74])
        box(
          out,
          'sandstone',
          [q - 0.27, 5.05, z - 0.06],
          [q + 0.27, top - 0.43, z + 0.17],
          color.grayStone,
        );
    }
  }
  const lowerZ = 19.47;
  for (const [x0, x1] of [
    [-17.97, -subwayHalfWidth],
    [subwayHalfWidth, 17.15],
  ]) {
    box(out, 'masonry', [x0, foundation, -9], [x1, 5.04, 12.76], color.buff);
  }
  box(
    out,
    'masonry',
    [-subwayHalfWidth, frontFloor, -19.8],
    [subwayHalfWidth, 5.04, lowerZ],
    color.buff,
  );
  for (const x of [-6.3, -2.45, 1.4, 5.25]) {
    windowAtWall(out, x, lowerZ, 2.51, frontFloor + 0.19, 3.19, 0.65, lod);
  }
  if (lod) {
    const rear = transform(out, Math.PI, [0, 0, -19.85]);
    for (const x of [-11.3, 0, 11.3]) windowAtWall(rear, x, 0.05, 5.05, 8.78, 14.12, 2.4, lod);
  }
  cornice(out, [-17.97, 17.15, -20, 12.88], 18.46, 0.35);
  dome(out, lod);
}

function tower(out, x, z, lod) {
  const half = 4.2,
    shaftLow = 8.1,
    eave = 27.9;
  const bounds = [x - half, x + half, z - half, z + half];
  box(
    out,
    'masonry',
    [x - half, shaftLow, z - half],
    [x + half, eave, z + half],
    color.shadedBrick,
  );
  if (lod) {
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const side = transform(out, angle, [x, 0, z]);
      const trace = archProfile(0, 3.34, 23.48, 1.77, [4, 6, 10, 14][lod]);
      const outer = archProfile(0, 4.43, 23.48, 2.26, [4, 6, 10, 14][lod]);
      rectangle(
        side,
        'sandstone',
        -1.67,
        1.67,
        shaftLow + 0.66,
        23.48,
        half + 0.057,
        color.grayStone,
      );
      for (let i = 1; i < trace.length; i++)
        triangle(
          side,
          'sandstone',
          [
            [0, 23.48, half + 0.057],
            [...trace[i], half + 0.057],
            [...trace[i - 1], half + 0.057],
          ],
          color.grayStone,
        );
      steppedArch(side, 'sandstone', trace, outer, half + 0.065, color.stone);
      for (const sign of [-1, 1]) {
        const a = sign * 1.67,
          b = sign * 2.215;
        rectangle(
          side,
          'sandstone',
          Math.min(a, b),
          Math.max(a, b),
          shaftLow + 0.64,
          23.48,
          half + 0.06,
          color.stone,
        );
        if (lod > 1)
          for (const y of [10, 12.15, 14.3, 16.45, 18.6, 20.75, 22.9])
            rectangle(
              side,
              'sandstone',
              sign * 3.58 - 0.53,
              sign * 3.58 + 0.53,
              y,
              y + 0.13,
              half + 0.018,
              color.stone,
            );
      }
      rectangle(side, 'glass', -0.39, 0.39, 16, 17.64, half + 0.08, color.opening);
      rectangle(side, 'glass', -0.39, 0.39, 11.88, 13.31, half + 0.08, color.opening);
      if (lod > 1) {
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6,
            b = ((i + 1) * Math.PI) / 6;
          triangle(
            side,
            'glass',
            [
              [0, 22.86, half + 0.084],
              [Math.cos(a) * 0.88, 22.86 + Math.sin(a) * 0.88, half + 0.084],
              [Math.cos(b) * 0.88, 22.86 + Math.sin(b) * 0.88, half + 0.084],
            ],
            color.glass,
          );
        }
      }
    }
  }
  cornice(out, bounds, eave, 0.72);
  fullRoof(out, x - 5.34, x + 5.34, z - 5.34, z + 5.34, eave, 0.99);
  const n = 8,
    phase = Math.PI / 8;
  const ring = (y, r) => radialRing(y, r, r, n, [x, z], phase);
  loft(out, 'sandstone', [ring(28.78, 3.83), ring(29.58, 3.49), ring(30.38, 3.4)], color.stone);
  const bottom = ring(30.39, 3.22),
    top = ring(35.25, 3.2);
  if (!lod) loft(out, 'masonry', [bottom, top], color.grayStone);
  else
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const point = (t, y) => [
        bottom[i][0] * (1 - t) + bottom[j][0] * t,
        y,
        bottom[i][2] * (1 - t) + bottom[j][2] * t,
      ];
      const view = (a, b, y0, y1) => [point(a, y0), point(b, y0), point(b, y1), point(a, y1)];
      face(out, 'masonry', view(0, 0.23, 30.39, 35.15), color.buff);
      face(out, 'masonry', view(0.77, 1, 30.39, 35.15), color.buff);
      face(out, 'sandstone', view(0.23, 0.77, 33.87, 35.15), color.stone);
      face(out, 'sandstone', view(0.23, 0.77, 30.39, 31.03), color.grayStone);
      if (lod > 1)
        beam(out, 'sandstone', point(0.11, 30.27), point(0.11, 35.24), 0.2, 0.2, color.lightStone);
    }
  loft(
    out,
    'sandstone',
    [ring(35.15, 3.26), ring(35.37, 3.57), ring(35.65, 3.59), ring(35.87, 3.19)],
    color.lightStone,
  );
  loft(
    out,
    'tile',
    [ring(35.83, 3.18), ring(36.55, 2.82), ring(37.4, 2.21), ring(38.24, 1.23), ring(38.63, 0.38)],
    color.terraCotta,
  );
  loft(
    out,
    'copper',
    [ring(38.56, 0.39), ring(38.88, 0.29), ring(towerTop, 0.055)],
    color.darkBronze,
  );
}

function facadeCanopy(out, x0, x1, faceZ, lod) {
  const top = 4.85,
    z = faceZ + 3.25;
  box(out, 'copper', [x0, top - 0.31, faceZ - 0.25], [x1, top, z], color.bronze);
  box(out, 'copper', [x0, top - 0.55, z - 0.09], [x1, top - 0.3, z + 0.04], color.darkBronze);
  if (lod) {
    const count = Math.max(2, Math.round((x1 - x0) / 4.6));
    for (let i = 0; i <= count; i++) {
      const x = x0 + 0.24 + ((x1 - x0 - 0.48) * i) / count;
      box(
        out,
        'copper',
        [x - 0.11, frontFloor, z - 0.32],
        [x + 0.11, top - 0.3, z - 0.1],
        color.darkBronze,
      );
      if (lod > 1)
        beam(
          out,
          'copper',
          [x, top - 1.02, z - 0.22],
          [x, top - 0.41, z - 1.22],
          0.13,
          0.12,
          color.bronze,
        );
    }
  }
}

function stationWings(out, lod) {
  const detailing = [
    [[-130.39, -113.03, -19.65, 11.365], 6.45, 1.55, false],
    [[-113.03, -62.82, -19.65, 0.827], 6.45, 1.45, false],
    [[61.58, 110.968, -20.2, -1.86], 6.45, 1.45, false],
    [[-62.82, -42.362, -19.84, 22.937], 8.65, 3.25, true],
    [[41.949, 61.58, -20.2, 22.937], 8.65, 3.25, true],
    [[-42.362, -33.683, -19.84, 12.81], 8.63, 1.8, false],
    [[-33.683, -17.978, -19.84, 20.458], 8.63, 1.8, false],
    [[17.151, 33.063, -20.2, 20.458], 8.63, 1.8, false],
    [[33.063, 41.949, -20.2, 12.605], 8.63, 1.8, false],
  ];
  for (const [bounds, eave, rise, lively] of detailing)
    projectWindowedRange(out, bounds, eave, rise, lod, lively);
  tower(out, -38.03, 8.77, lod);
  tower(out, 37.53, 8.91, lod);
  for (const [a, b, z] of [
    [-40, -10.1, 20.46],
    [-10.1, 9.7, 19.5],
    [9.7, 40, 20.46],
  ])
    facadeCanopy(out, a, b, z, lod);
  if (lod > 1) {
    for (const sign of [-1, 1]) {
      const x = sign * 13.15;
      box(out, 'sandstone', [x - 5.2, 0.04, 21.69], [x + 5.2, 0.37, 24.06], color.stone);
      box(out, 'sandstone', [x - 5.2, -0.19, 22.79], [x + 5.2, 0.04, 24.75], color.grayStone);
    }
  }
}

function subwayAndPlaza(out, lod) {
  const width = subwayHalfWidth;
  const y = -subwayClearance - 0.34;
  const start = subwayMouthZ,
    end = subwayApproachEnd;
  const halfCut = width + 0.55;
  const yEnd = -0.39;
  const ramp = [
    [0, y, start - 12],
    [0, y, start],
    [0, y + 0.95, start + 33],
    [0, yEnd, end],
  ];
  for (let i = 1; i < ramp.length; i++) {
    const [, a, z0] = ramp[i - 1],
      [, b, z1] = ramp[i];
    face(
      out,
      'concrete',
      [
        [-width, a, z0],
        [-width, b, z1],
        [width, b, z1],
        [width, a, z0],
      ],
      color.asphalt,
    );
    for (const side of [-1, 1]) {
      const x = width * side;
      const plane = [
        [x, a, z0],
        [x, b, z1],
        [x, 0.15, z1],
        [x, 0.15, z0],
      ];
      face(out, 'sandstone', side < 0 ? plane : [...plane].reverse(), color.grayStone);
      if (i > 1 && lod)
        beam(
          out,
          'sandstone',
          [side * halfCut, 0.27, z0],
          [side * halfCut, 0.27, z1],
          0.88,
          0.49,
          color.stone,
        );
    }
  }
  box(out, 'sandstone', [-width, 0.04, start - 0.75], [width, 0.68, start + 0.29], color.grayStone);
  for (const side of [-1, 1]) {
    const [x0, x1] = side < 0 ? [-25.5, -width] : [width, 25.5];
    box(out, 'concrete', [x0, -2.7, start - 2.18], [x1, 0.2, start + 16.05], color.concrete);
    box(out, 'sandstone', [x0, 0.14, start + 15.68], [x1, 0.29, start + 16.05], color.grayStone);
  }
  if (lod) {
    box(out, 'glass', [-width, y, start - 10.5], [width, 0.01, start - 10.35], color.opening);
    if (lod > 1) {
      for (const x of [-7.45, 7.45]) {
        box(
          out,
          'concrete',
          [x - 0.62, y + 0.12, start - 10.2],
          [x + 0.62, y + 0.26, start - 0.35],
          color.concrete,
        );
      }
    }
  }
}

function platformCover(out, x0, x1, z0, z1, y, fall, slot, tint, lod) {
  const middle = (z0 + z1) / 2;
  for (const [a, b, ya, yb] of [
    [z0, middle, y, y - fall],
    [middle, z1, y - fall, y],
  ]) {
    face(
      out,
      slot,
      [
        [x0, ya, a],
        [x0, yb, b],
        [x1, yb, b],
        [x1, ya, a],
      ],
      tint,
    );
    face(
      out,
      slot,
      [
        [x1, ya - 0.28, a],
        [x1, yb - 0.28, b],
        [x0, yb - 0.28, b],
        [x0, ya - 0.28, a],
      ],
      color.soot,
    );
    if (lod < 2) continue;
    for (const x of [x0, x1]) {
      const plane = [
        [x, ya, a],
        [x, yb, b],
        [x, yb - 0.28, b],
        [x, ya - 0.28, a],
      ];
      face(out, slot, x === x0 ? plane : [...plane].reverse(), color.soot);
    }
  }
  if (lod < 2) return;
  for (const z of [z0, z1])
    box(out, slot, [x0, y - 0.17, z - 0.09], [x1, y + 0.045, z + 0.09], color.soot);
}

function trainShed(out, lod) {
  const short = [-96.916, 89.064],
    long = [-130.392, 109.52];
  const trackY = trackLevel;
  const shedRoofHigh = trackY + 6.4;
  const platformRoof = trackY + 4.72;
  box(out, 'concrete', [-130.392, -1.38, -28.56], [110.968, trackY + 0.26, -20.13], color.concrete);
  platformCover(
    out,
    -130.39,
    110.968,
    -28.69,
    -19.95,
    platformRoof + 0.72,
    0.12,
    'concrete',
    color.concrete,
    lod,
  );
  for (let j = 0; j < 5; j++) {
    const [x0, x1] = j >= 3 ? long : short;
    const z = -34.1 - j * railBayWidth;
    const half = railBayWidth / 2;
    platformCover(
      out,
      x0,
      x1,
      z - platformWidth * 0.64,
      z + platformWidth * 0.64,
      platformRoof,
      0.31,
      'concrete',
      color.concrete,
      lod,
    );
    platformCover(
      out,
      x0,
      x1,
      z + platformWidth * 0.36,
      z + half + 0.22,
      shedRoofHigh,
      0.38,
      'concrete',
      color.concrete,
      lod,
    );
    platformCover(
      out,
      x0,
      x1,
      z - half - 0.22,
      z - platformWidth * 0.36,
      shedRoofHigh,
      0.38,
      'concrete',
      color.concrete,
      lod,
    );
    if (lod)
      box(
        out,
        'concrete',
        [x0, trackY - 0.83, z - platformWidth * 0.5],
        [x1, trackY + 0.32, z + platformWidth * 0.5],
        color.concrete,
      );
    for (const sign of [-1, 1]) {
      const r = z + sign * 4.65;
      if (lod) {
        box(out, 'concrete', [x0, trackY - 0.48, r - 1.05], [x1, trackY, r + 1.05], color.ballast);
        for (const offset of [-0.718, 0.718])
          box(
            out,
            'copper',
            [x0, trackY, r + offset - 0.045],
            [x1, trackY + 0.11, r + offset + 0.045],
            color.rail,
          );
      }
    }
    const interval = lod >= 2 ? pierInterval : lod === 1 ? pierInterval * 3 : 60;
    for (let x = x0 + 3.4; x < x1; x += interval) {
      if (lod === 0 && x > x0 + 65 && x < x1 - 6) continue;
      if (lod <= 1)
        rectangle(
          transform(out, Math.PI / 2, [x, 0, z]),
          'concrete',
          -0.32,
          0.32,
          trackY + 0.32,
          platformRoof - 0.29,
          0,
          color.soot,
        );
      else {
        box(
          out,
          'concrete',
          [x - 0.19, trackY + 0.32, z - 0.21],
          [x + 0.19, platformRoof - 0.32, z + 0.21],
          color.concrete,
        );
        // The tall track shade branches from the center pier through the low
        // platform umbrella. Keep the overlapping clerestory gap visible.
        const pier = Math.round((x - x0 - 3.4) / interval);
        if (lod === 3 || pier % 2 === 0) {
          for (const sign of [-1, 1]) {
            beam(
              out,
              'concrete',
              [x, platformRoof - 0.93, z],
              [x, shedRoofHigh - 0.41, z + sign * 4.05],
              0.28,
              0.26,
              color.soot,
            );
          }
        }
      }
    }
  }
  if (lod > 1) {
    for (let x = -88.8; x < 85; x += 12.2) {
      box(
        out,
        'glass',
        [x - 1.22, platformRoof + 0.69, -25.94],
        [x + 1.22, platformRoof + 0.8, -23.2],
        color.lightGlass,
      );
    }
  }
}

function build(out, lod) {
  mainHeadHouse(out, lod);
  stationWings(out, lod);
  subwayAndPlaza(out, lod);
  trainShed(out, lod);
}

function simplifiedTower(out, x, z) {
  box(out, 'masonry', [x - 4.2, 8.1, z - 4.2], [x + 4.2, 27.9, z + 4.2], color.shadedBrick);
  rectangle(out, 'sandstone', x - 1.35, x + 1.35, 9.5, 25.4, z + 4.22, color.grayStone);
  fullRoof(out, x - 5.26, x + 5.26, z - 5.26, z + 5.26, 27.9, 1.58);
  const ring = (y, r) => radialRing(y, r, r, 6, [x, z]);
  loft(out, 'sandstone', [ring(29.46, 3.29), ring(35.3, 3.29)], color.stone);
  loft(
    out,
    'tile',
    [ring(35.27, 3.55), ring(36.79, 2.58), ring(38.6, 0.45), ring(towerTop, 0.055)],
    color.terraCotta,
  );
}

export function terminalSkyline(out) {
  const wings = [
    [-130.39, -62.82, -19.8, 0.83, 6.45, 1.45],
    [-130.39, -113.03, 0.83, 11.36, 6.45, 1.45],
    [61.58, 110.97, -20.25, -1.86, 6.45, 1.45],
    [-62.82, -42.36, -19.84, 22.94, 8.65, 3.25],
    [41.95, 61.58, -20.2, 22.94, 8.65, 3.25],
    [-42.36, -17.97, -19.84, 19.6, 8.63, 1.6],
    [17.15, 41.95, -20.2, 19.6, 8.63, 1.6],
  ];
  for (const [x0, x1, z0, z1, y, rise] of wings) {
    box(out, 'masonry', [x0, foundation, z0], [x1, y, z1], color.buff);
    fullRoof(out, x0 - 0.4, x1 + 0.4, z0 - 0.4, z1 + 0.4, y, rise);
  }
  box(out, 'masonry', [-17.97, foundation, -19.8], [17.15, 18.6, 12.6], color.buff);
  box(out, 'masonry', [-10.33, 0.22, 12.54], [9.91, 20.02, 19.43], color.buff);
  pediment(out, -0.2, 19.51, 20, 20.9, 3.2, 0);
  for (const [x, z, w] of [
    [-13.9, 12.7, 4.8],
    [-0.2, 19.47, 7.25],
    [13.4, 12.7, 4.8],
  ]) {
    const profile = archProfile(x, w, 14.2, 3.15, 4);
    rectangle(out, 'glass', x - w / 2, x + w / 2, 9.8, 14.2, z, color.glass);
    for (let i = 1; i < profile.length; i++)
      triangle(
        out,
        'glass',
        [
          [x, 14.2, z],
          [...profile[i], z],
          [...profile[i - 1], z],
        ],
        color.glass,
      );
  }
  dome(out, 0);
  simplifiedTower(out, -38.03, 8.77);
  simplifiedTower(out, 37.53, 8.91);
  facadeCanopy(out, -39, 39, 20.44, 0);
  subwayAndPlaza(out, 0);
  trainShed(out, 0);
}
export const terminalDistrict = (out) => build(out, 1);
export const terminalStreet = (out) => build(out, 2);
export const terminalCloseup = (out) => build(out, 3);
const recipe = 'birmingham-terminal-station-model.mjs';
const camera = [128, 82, 211],
  lookAt = [-8, 11, -21];
const cutWidth = subwayHalfWidth + 0.08;
export const terminalModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: terminalCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  brief:
    'The Byzantine Revival Birmingham Terminal Station circa 1913, including its twin lantern towers, large terracotta dome, Fifth Avenue subway approach and attached reinforced-concrete train shed.',
  camera,
  lookAt,
  sunDirection: [-70, 87, 135],
  portableGroundY: -5.85,
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_sandstone_raw',
    'concrete_plain',
    'tile_ceramic',
    'metal_copper',
  ],
  mediumFiContext: {
    scale: 1,
    groundY: -0.1,
    far: 4400,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: [
      [-cutWidth, subwayMouthZ - 1],
      [cutWidth, subwayMouthZ - 1],
      [cutWidth, subwayApproachEnd],
      [-cutWidth, subwayApproachEnd],
    ],
    basis:
      'Fifth Avenue subway mouth and approach only, from the native Sanborn survey and Marye’s section. Independent terrain and surrounding grade remain intact.',
  },
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    outlines: frame.geometry.polygons,
    basis: 'Historical station and attached train shed footprint traced from Sanborn sheet 21.',
  },
  qaCameras: [
    { name: 'west-headhouse-and-subway', position: [2, 17, 137], lookAt: [0, 12, 4] },
    { name: 'south-tower-and-waiting-wing', position: [78, 14, 55], lookAt: [22, 17, 12] },
    { name: 'umbrella-train-shed', position: [-147, 11, -104], lookAt: [-63, 5, -56] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-terminal-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'terminalSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'terminalDistrict', 0.47],
        ['street', 'terminalStreet', 0.22],
        ['closeup', 'terminalCloseup', 0.08],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceDocuments: plan.requiredSourceDocuments,
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Public-domain Qualla postcards, public-domain 1911 survey, and Marye’s original 1909 U.S. periodical report and drawings. OpenStreetMap tunnel geometry under ODbL 1.0.',
};
