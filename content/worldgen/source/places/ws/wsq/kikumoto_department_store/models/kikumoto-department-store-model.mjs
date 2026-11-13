/** Surviving Kikumoto Department Store, as photographed in November 2003. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [main, annex, rooftop] = frame.geometry.polygons;
const whole = [...main.slice(0, 4), ...annex.slice(1, 4), main[4]];
const section = plan.section;
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.77, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.18 },
  concrete: { slot: 'roof', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.26, metallic: 0.29 },
  signs: { slot: 'trim', localRef: 'palette:#fefefe', roughness: 0.78, metallic: 0.06 },
};
const tint = Object.fromEntries(
  Object.entries({
    granite: '68625a',
    darkStone: '4b4641',
    paleStone: '7c756b',
    roof: '93928a',
    service: '7b776f',
    frame: '303839',
    mullion: '313839',
    sill: '62665f',
    shaded: '333838',
    store: '465253',
    storeLight: '64706e',
    warmPanel: '8f8a78',
    yellow: 'c6bd37',
    yellowTop: 'ddd05c',
    red: '843d29',
    olive: '687a35',
    ivory: 'e0d3a4',
    logo: '7f9953',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const glassTints = [
  '758486',
  '879494',
  '687779',
  '8f9999',
  '778888',
  '91a0a2',
  '61747a',
  'a4aeb0',
].map(rgb);
const mirrorTints = [
  '627279',
  '79888e',
  '53646d',
  '879699',
  '697a7f',
  '74888c',
  '445961',
  '99a7aa',
].map(rgb);
const bankTints = [
  '5a6666',
  '6d7977',
  '465758',
  '7a8581',
  '556b6c',
  '677673',
  '394e52',
  '929d97',
].map(rgb);
const lerp = (a, b, t) => a + (b - a) * t;

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    lerp(lerp(h[j][i], h[j][i + 1], u - i), lerp(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function oriented(out, slot, p, normal, color) {
  const n = normalFor(...p);
  const points = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? p : p.toReversed();
  if (points.length === 4) face(out, slot, points, color);
  else triangle(out, slot, points, color);
}

function side(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const along = [dx / length, dz / length],
    normal = [-along[1], 0, along[0]];
  return {
    length,
    normal,
    at: (u, y, d = 0) => [
      a[0] + along[0] * u + normal[0] * d,
      y,
      a[1] + along[1] * u + normal[2] * d,
    ],
    ground: (u) => grade(a[0] + along[0] * u, a[1] + along[1] * u),
  };
}

function rectangle(out, s, slot, left, low, right, high, depth, color) {
  oriented(
    out,
    slot,
    [
      s.at(left, low, depth),
      s.at(right, low, depth),
      s.at(right, high, depth),
      s.at(left, high, depth),
    ],
    s.normal,
    color,
  );
}

function band(out, s, slot, left, low, right, high, depth, color, edgeColor = color) {
  rectangle(out, s, slot, left, low, right, high, depth, color);
  const a = [
    s.at(left, low, 0),
    s.at(right, low, 0),
    s.at(right, low, depth),
    s.at(left, low, depth),
  ];
  const b = [
    s.at(left, high, 0),
    s.at(right, high, 0),
    s.at(right, high, depth),
    s.at(left, high, depth),
  ];
  oriented(out, slot, a, [0, -1, 0], edgeColor);
  oriented(out, slot, b, [0, 1, 0], edgeColor);
}

function walls(out, ring, low, high, color) {
  for (let i = 0; i < ring.length; i++) {
    const s = side(ring[i], ring[(i + 1) % ring.length]);
    const parts = Math.ceil(s.length / 5.5);
    for (let j = 0; j < parts; j++) {
      const a = (s.length * j) / parts,
        b = (s.length * (j + 1)) / parts;
      oriented(
        out,
        'granite',
        [s.at(a, low(s, a)), s.at(b, low(s, b)), s.at(b, high), s.at(a, high)],
        s.normal,
        color,
      );
    }
  }
}

function roof(out, ring, y, color) {
  const order = earcut(ring.flat());
  for (let i = 0; i < order.length; i += 3)
    oriented(
      out,
      'concrete',
      order.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
      [0, 1, 0],
      color,
    );
}

function roofline(out, ring, low, high, color) {
  for (let i = 0; i < ring.length; i++) {
    const s = side(ring[i], ring[(i + 1) % ring.length]);
    band(out, s, 'granite', 0, low, s.length, high, 0.087, color, tint.paleStone);
  }
}

function curtain(out, s, bays, lod, color, bias) {
  const bottom = section.glassBottom,
    top = section.glassTop;
  const size = s.length / bays;
  for (let bay = 0; bay < bays; bay++) {
    const setback = bays === 1 ? 0.7 : 0.37;
    const left = bay * size + setback,
      right = (bay + 1) * size - setback;
    band(
      out,
      s,
      'metal',
      left - 0.1,
      bottom - 0.13,
      right + 0.1,
      top + 0.1,
      0.061,
      tint.frame,
      tint.mullion,
    );
    const cols = [2, 4, 4, 4][lod],
      rows = [4, 8, section.glassRows, section.glassRows][lod];
    for (let col = 0; col < cols; col++)
      for (let row = 0; row < rows; row++) {
        const width = (right - left) / cols,
          height = (top - bottom) / rows;
        const x = left + col * width,
          y = bottom + row * height;
        const pane =
          row === 0 && lod >= 2
            ? color[6]
            : color[(bay * 3 + col * 5 + row * 2 + Math.floor(row / 3) + bias) % color.length];
        const gap = lod === 0 ? 0.032 : 0.02;
        rectangle(
          out,
          s,
          'glass',
          x + gap,
          y + gap,
          x + width - gap,
          y + height - gap,
          0.077,
          pane,
        );
        if (lod >= 2 && col === (bay + 1) % cols && row % 3 === 1) {
          const sashWidth = 0.64 * width;
          rectangle(
            out,
            s,
            'metal',
            x + 0.2 * width,
            y + 0.1,
            x + 0.2 * width + sashWidth,
            y + height - 0.11,
            0.086,
            tint.mullion,
          );
          rectangle(
            out,
            s,
            'glass',
            x + 0.2 * width + 0.048,
            y + 0.15,
            x + 0.2 * width + sashWidth - 0.048,
            y + height - 0.16,
            0.095,
            color[(row + bias + 3) % color.length],
          );
        }
      }
    if (lod >= 1)
      for (let col = 1; col < cols; col++) {
        const x = lerp(left, right, col / cols);
        rectangle(out, s, 'metal', x - 0.021, bottom, x + 0.021, top, 0.088, tint.mullion);
      }
  }
}

// Original simplified strokes for the building and tenant names visible on the 2003 fascia.
const glyph = {
  國: [
    [
      [0.08, 0.08],
      [0.08, 0.92],
      [0.92, 0.92],
      [0.92, 0.08],
      [0.08, 0.08],
    ],
    [
      [0.21, 0.72],
      [0.8, 0.72],
    ],
    [
      [0.26, 0.34],
      [0.26, 0.57],
      [0.49, 0.57],
      [0.49, 0.34],
      [0.26, 0.34],
    ],
    [
      [0.24, 0.25],
      [0.52, 0.27],
    ],
    [
      [0.58, 0.82],
      [0.63, 0.49],
      [0.77, 0.22],
      [0.82, 0.36],
    ],
    [
      [0.79, 0.64],
      [0.65, 0.45],
      [0.5, 0.31],
    ],
    [
      [0.71, 0.84],
      [0.77, 0.79],
    ],
  ],
  泰: [
    [
      [0.22, 0.83],
      [0.8, 0.83],
    ],
    [
      [0.27, 0.72],
      [0.75, 0.72],
    ],
    [
      [0.12, 0.6],
      [0.88, 0.6],
    ],
    [
      [0.54, 0.93],
      [0.5, 0.65],
      [0.33, 0.47],
      [0.11, 0.37],
    ],
    [
      [0.59, 0.61],
      [0.73, 0.47],
      [0.9, 0.39],
    ],
    [
      [0.51, 0.48],
      [0.51, 0.1],
      [0.4, 0.1],
    ],
    [
      [0.29, 0.37],
      [0.39, 0.31],
    ],
    [
      [0.26, 0.16],
      [0.4, 0.24],
    ],
    [
      [0.73, 0.39],
      [0.62, 0.31],
    ],
    [
      [0.59, 0.25],
      [0.78, 0.15],
    ],
  ],
  金: [
    [
      [0.09, 0.55],
      [0.31, 0.73],
      [0.5, 0.93],
      [0.7, 0.73],
      [0.91, 0.55],
    ],
    [
      [0.31, 0.57],
      [0.69, 0.57],
    ],
    [
      [0.21, 0.41],
      [0.79, 0.41],
    ],
    [
      [0.5, 0.58],
      [0.5, 0.11],
    ],
    [
      [0.12, 0.12],
      [0.88, 0.12],
    ],
    [
      [0.29, 0.33],
      [0.38, 0.2],
    ],
    [
      [0.71, 0.34],
      [0.62, 0.21],
    ],
  ],
  控: [
    [
      [0.08, 0.65],
      [0.37, 0.65],
    ],
    [
      [0.24, 0.91],
      [0.24, 0.15],
      [0.12, 0.12],
    ],
    [
      [0.09, 0.37],
      [0.36, 0.5],
    ],
    [
      [0.66, 0.91],
      [0.71, 0.81],
    ],
    [
      [0.45, 0.64],
      [0.45, 0.77],
      [0.92, 0.77],
      [0.92, 0.66],
    ],
    [
      [0.61, 0.7],
      [0.47, 0.52],
    ],
    [
      [0.76, 0.7],
      [0.89, 0.53],
    ],
    [
      [0.49, 0.45],
      [0.88, 0.45],
    ],
    [
      [0.68, 0.45],
      [0.68, 0.16],
    ],
    [
      [0.43, 0.16],
      [0.94, 0.16],
    ],
  ],
  世: [
    [
      [0.07, 0.67],
      [0.93, 0.67],
    ],
    [
      [0.23, 0.87],
      [0.23, 0.13],
      [0.9, 0.13],
    ],
    [
      [0.47, 0.9],
      [0.47, 0.4],
      [0.72, 0.4],
      [0.72, 0.9],
    ],
  ],
  華: [
    [
      [0.11, 0.79],
      [0.89, 0.79],
    ],
    [
      [0.33, 0.92],
      [0.33, 0.7],
    ],
    [
      [0.68, 0.92],
      [0.68, 0.7],
    ],
    [
      [0.19, 0.61],
      [0.82, 0.61],
    ],
    [
      [0.12, 0.46],
      [0.89, 0.46],
    ],
    [
      [0.26, 0.63],
      [0.26, 0.35],
    ],
    [
      [0.5, 0.63],
      [0.5, 0.1],
    ],
    [
      [0.74, 0.63],
      [0.74, 0.35],
    ],
    [
      [0.19, 0.34],
      [0.82, 0.34],
    ],
    [
      [0.08, 0.22],
      [0.94, 0.22],
    ],
  ],
  銀: [
    [
      [0.06, 0.63],
      [0.23, 0.91],
      [0.4, 0.68],
    ],
    [
      [0.13, 0.63],
      [0.37, 0.63],
    ],
    [
      [0.09, 0.49],
      [0.43, 0.49],
    ],
    [
      [0.25, 0.63],
      [0.25, 0.18],
    ],
    [
      [0.08, 0.16],
      [0.44, 0.22],
    ],
    [
      [0.12, 0.4],
      [0.17, 0.28],
    ],
    [
      [0.37, 0.39],
      [0.32, 0.28],
    ],
    [
      [0.52, 0.13],
      [0.52, 0.86],
      [0.87, 0.86],
      [0.87, 0.5],
      [0.52, 0.5],
    ],
    [
      [0.54, 0.68],
      [0.86, 0.68],
    ],
    [
      [0.52, 0.14],
      [0.7, 0.22],
    ],
    [
      [0.65, 0.48],
      [0.74, 0.31],
      [0.94, 0.12],
    ],
    [
      [0.91, 0.42],
      [0.76, 0.32],
    ],
  ],
  行: [
    [
      [0.3, 0.9],
      [0.08, 0.68],
    ],
    [
      [0.35, 0.65],
      [0.08, 0.4],
    ],
    [
      [0.23, 0.52],
      [0.23, 0.1],
    ],
    [
      [0.51, 0.79],
      [0.91, 0.79],
    ],
    [
      [0.46, 0.58],
      [0.96, 0.58],
    ],
    [
      [0.75, 0.58],
      [0.75, 0.14],
      [0.62, 0.11],
    ],
  ],
  融: [
    [
      [0.05, 0.86],
      [0.53, 0.86],
    ],
    [
      [0.12, 0.72],
      [0.45, 0.72],
      [0.45, 0.55],
      [0.12, 0.55],
      [0.12, 0.72],
    ],
    [
      [0.08, 0.14],
      [0.08, 0.47],
      [0.49, 0.47],
      [0.49, 0.13],
      [0.4, 0.11],
    ],
    [
      [0.17, 0.34],
      [0.37, 0.34],
    ],
    [
      [0.28, 0.33],
      [0.28, 0.16],
    ],
    [
      [0.6, 0.73],
      [0.88, 0.73],
      [0.88, 0.4],
      [0.6, 0.4],
      [0.6, 0.73],
    ],
    [
      [0.74, 0.9],
      [0.74, 0.18],
    ],
    [
      [0.56, 0.16],
      [0.92, 0.22],
    ],
    [
      [0.86, 0.31],
      [0.96, 0.13],
    ],
  ],
  大: [
    [
      [0.09, 0.59],
      [0.91, 0.59],
    ],
    [
      [0.52, 0.9],
      [0.5, 0.58],
      [0.38, 0.34],
      [0.09, 0.12],
    ],
    [
      [0.52, 0.57],
      [0.65, 0.33],
      [0.92, 0.12],
    ],
  ],
  樓: [
    [
      [0.07, 0.65],
      [0.39, 0.65],
    ],
    [
      [0.22, 0.91],
      [0.22, 0.1],
    ],
    [
      [0.22, 0.6],
      [0.07, 0.37],
    ],
    [
      [0.23, 0.58],
      [0.39, 0.46],
    ],
    [
      [0.46, 0.81],
      [0.9, 0.81],
      [0.9, 0.57],
      [0.46, 0.57],
      [0.46, 0.81],
    ],
    [
      [0.42, 0.69],
      [0.94, 0.69],
    ],
    [
      [0.68, 0.91],
      [0.68, 0.5],
    ],
    [
      [0.42, 0.44],
      [0.95, 0.44],
    ],
    [
      [0.6, 0.49],
      [0.55, 0.31],
      [0.88, 0.12],
    ],
    [
      [0.83, 0.4],
      [0.77, 0.26],
      [0.48, 0.13],
    ],
  ],
};

function character(out, s, ch, x, y, size, depth, color) {
  for (const stroke of glyph[ch])
    for (let i = 1; i < stroke.length; i++) {
      const [a, b] = stroke[i - 1],
        [c, d] = stroke[i];
      const width = (0.025 * size) / Math.hypot(c - a, d - b),
        ox = (b - d) * width,
        oy = (c - a) * width;
      const points = [
        [x + a * size + ox, y + b * size + oy],
        [x + c * size + ox, y + d * size + oy],
        [x + c * size - ox, y + d * size - oy],
        [x + a * size - ox, y + b * size - oy],
      ];
      oriented(
        out,
        'signs',
        points.map((p) => s.at(...p, depth)),
        s.normal,
        color,
      );
    }
}

function storefront(out, s, lod, kind) {
  const bottom = section.fasciaBottom,
    top = section.fasciaTop;
  band(out, s, 'signs', 0, bottom, s.length, top, 0.19, tint.yellow, tint.yellowTop);
  band(out, s, 'metal', 0, bottom - 0.12, s.length, bottom, 0.105, tint.frame);
  band(out, s, 'metal', 0, top, s.length, top + 0.092, 0.105, tint.sill);
  const doors = kind === 'corner' ? 2 : Math.max(2, Math.round(s.length / 2.45));
  for (let i = 0; i < doors; i++) {
    const width = s.length / doors,
      left = i * width + 0.12,
      right = (i + 1) * width - 0.12;
    const floor = Math.max(s.ground(left), s.ground(right)) + 0.075;
    if (floor >= bottom - 0.51) continue;
    rectangle(out, s, 'metal', left, floor, right, bottom - 0.16, 0.016, tint.shaded);
    rectangle(
      out,
      s,
      'glass',
      left + 0.05,
      floor + 0.055,
      right - 0.05,
      bottom - 0.24,
      0.035,
      i % 3 === 0 ? tint.storeLight : tint.store,
    );
    if (lod >= 1) {
      const mid = (left + right) / 2;
      rectangle(out, s, 'metal', mid - 0.025, floor, mid + 0.025, bottom - 0.2, 0.046, tint.frame);
      rectangle(out, s, 'metal', left, floor + 0.35, right, floor + 0.395, 0.051, tint.sill);
      if (lod === 3 && bottom - floor > 1.6) {
        for (const x of [mid - 0.11, mid + 0.11]) {
          rectangle(
            out,
            s,
            'metal',
            x - 0.018,
            floor + 0.85,
            x + 0.018,
            floor + 1.18,
            0.061,
            tint.paleStone,
          );
        }
        rectangle(out, s, 'metal', left, bottom - 0.41, right, bottom - 0.36, 0.053, tint.sill);
      }
    }
  }
  if (lod >= 2) {
    const text = kind === 'corner' ? '國泰金控' : '國泰世華銀行';
    const size = kind === 'corner' ? 0.53 : 0.56;
    const start = (s.length - text.length * size * 1.17) / 2;
    for (const [i, ch] of [...text].entries())
      character(out, s, ch, start + i * size * 1.17, bottom + 0.27, size, 0.197, tint.red);
  }
}

function fasciaCorner(out, a, b) {
  const low = section.fasciaBottom,
    high = section.fasciaTop;
  const at = (s, u, y, depth = 0.19) => s.at(u, y, depth);
  const normal = a.normal.map((value, i) => value + b.normal[i]);
  oriented(
    out,
    'signs',
    [at(a, a.length, low), at(b, 0, low), at(b, 0, high), at(a, a.length, high)],
    normal,
    tint.yellow,
  );
  for (const [y, ny] of [
    [low, -1],
    [high, 1],
  ]) {
    oriented(
      out,
      'signs',
      [at(a, a.length, y, 0), at(a, a.length, y), at(b, 0, y)],
      [0, ny, 0],
      tint.yellowTop,
    );
  }
}

function verticalSign(out, s, lod) {
  const x = 0.57;
  rectangle(out, s, 'granite', 0.02, 5.1, 1.21, 24.85, 0.095, tint.darkStone);
  rectangle(out, s, 'signs', x - 0.33, 19.85, x + 0.33, 20.46, 0.107, tint.logo);
  if (lod >= 1)
    for (const [i, ch] of [...'國泰金融大樓'].entries())
      character(out, s, ch, x - 0.35, 19.04 - i * 1.4, 0.7, 0.115, tint.ivory);
}

function serviceSide(out, s, lod) {
  if (lod === 0) return;
  const count = Math.max(2, Math.round(s.length / 4.1));
  for (let i = 0; i < count; i++)
    for (const y of [8.1, 11.48, 14.85, 18.23, 21.62]) {
      const x = (s.length * (i + 0.5)) / count;
      rectangle(out, s, 'metal', x - 0.73, y - 0.04, x + 0.73, y + 1.11, 0.022, tint.frame);
      rectangle(out, s, 'glass', x - 0.66, y, x + 0.66, y + 1.06, 0.038, tint.store);
      if (lod >= 2) rectangle(out, s, 'metal', x - 0.023, y, x + 0.023, y + 1.06, 0.045, tint.sill);
    }
}

function build(out, lod) {
  walls(out, whole, (s, u) => s.ground(u) - 0.25, section.roof, tint.granite);
  roof(out, whole, section.roof, tint.roof);
  roofline(out, whole, section.roof - 0.48, section.parapetTop, tint.paleStone);
  walls(out, rooftop, () => section.roof - 0.015, section.rooftop, tint.service);
  roof(out, rooftop, section.rooftop, tint.roof);
  roofline(out, rooftop, section.rooftop - 0.19, section.rooftop + 0.08, tint.paleStone);
  const streets = whole.slice(0, 4).map((a, i) => side(a, whole[i + 1]));
  const colors = [glassTints, mirrorTints, mirrorTints, bankTints];
  for (const [i, s] of streets.entries()) {
    curtain(out, s, i === 1 ? 1 : 2, lod, colors[i], i * 2);
    storefront(out, s, lod, i === 1 ? 'corner' : 'street');
  }
  fasciaCorner(out, streets[0], streets[1]);
  fasciaCorner(out, streets[1], streets[2]);
  verticalSign(out, streets[3], lod);
  for (let i = 4; i < whole.length; i++)
    serviceSide(out, side(whole[i], whole[(i + 1) % whole.length]), lod);
}
export const kikumotoSkyline = (out) => build(out, 0);
export const kikumotoDistrict = (out) => build(out, 1);
export const kikumotoStreet = (out) => build(out, 2);
export const kikumotoCloseup = (out) => build(out, 3);
const recipe = 'kikumoto-department-store-model.mjs';
const camera = [41, 23, 44],
  lookAt = [-1.5, 12.5, -6.8];
export const kikumotoModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: kikumotoCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former Kikumoto Department Store at the Hengyang and Bo’ai corner, in its glass-clad 2003 appearance with a yellow Cathay fascia and stepped rooftop.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-19, 45, 32],
  mediumFiContext: {
    scale: 1.05,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: whole,
    outlines: [main, annex],
    minimumCoverage: 0.92,
    basis: 'Named historic main and mapped attached northern volume at 148–150 Bo’ai Road.',
  },
  embeddedCanonicalGraphs: ['stone_granite', 'metal_painted', 'concrete_plain'],
  qaCameras: [
    {
      name: 'hengyang-and-boai-glazed-corner',
      position: [31.5, 8.1, 35.7],
      lookAt: [2.7, 12.0, -3.1],
    },
    { name: 'yellow-fascia-and-bank-entrance', position: [21, 3.3, 22.8], lookAt: [4.8, 5.1, 5.1] },
    {
      name: 'boai-sign-and-setback-rooftop',
      position: [36.5, 31.0, -25.0],
      lookAt: [3.0, 16.0, -8.0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-store-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'kikumotoSkyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'kikumotoDistrict', 0.39],
        ['street', 'kikumotoStreet', 0.135],
        ['closeup', 'kikumotoCloseup', 0.053],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The footprint is ODbL. The exact Qualla photo by Yang wl is public domain.',
};
