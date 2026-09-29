/** Original Rouen clock-pavilion and belfry exterior from municipal records, cast measurements and the BnF survey. */

import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  annulus,
  archBay,
  column,
  cornice,
  deform,
  face,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const tau = Math.PI * 2;
const stone = [0.76, 0.73, 0.63],
  light = [0.86, 0.83, 0.71],
  lead = [0.27, 0.31, 0.32],
  gold = [0.91, 0.62, 0.2],
  navy = [0.025, 0.045, 0.09],
  dark = [0.065, 0.068, 0.064];
const map = JSON.parse(
  readFileSync(structureSourcePath('n0612_gros_horloge', 'map-frame.json'), 'utf8'),
);
function tube(out, slot, points, r, color) {
  for (let i = 1; i < points.length; i++) beam(out, slot, points[i - 1], points[i], r, r, color);
}
function circ(out, slot, x, y, z, rx, ry, width, color) {
  const p = Array.from({ length: 65 }, (_, i) => [
    x + rx * Math.sin((i * tau) / 64),
    y + ry * Math.cos((i * tau) / 64),
    z,
  ]);
  tube(out, slot, p, width, color);
}
function disc(out, slot, x, y, z, r, color) {
  for (let i = 0; i < 64; i++) {
    const p = (a) => [x + r * Math.sin(a), y + r * Math.cos(a), z];
    triangle(out, slot, [[x, y, z], p(((i + 1) * tau) / 64), p((i * tau) / 64)], color);
  }
}
function finial(out, x, z, y, h, slot = 'metal', color = lead) {
  loft(
    out,
    slot,
    [
      [0, 0.13],
      [0.1, 0.17],
      [0.16, 0.1],
      [0.32, 0.08],
      [0.4, 0.16],
      [0.49, 0.08],
      [0.67, 0.1],
      [0.77, 0.065],
      [1, 0.012],
    ].map(([t, r]) => radialRing(y + t * h, r * h, r * h, 12, [x, z])),
    color,
  );
}
function leaf(out, x, y, z, a, s, color = gold) {
  const points = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    points.push([
      x + Math.cos(a) * s * t - Math.sin(a) * Math.sin(t * Math.PI) * s * 0.23,
      y + Math.sin(a) * s * t + Math.cos(a) * Math.sin(t * Math.PI) * s * 0.23,
      z + 0.025 * Math.sin(t * Math.PI),
    ]);
  }
  tube(out, 'metal', points, 0.019, color);
}
function scroll(out, x, y, z, w, h, color = gold) {
  const p = [];
  for (let i = 0; i <= 38; i++) {
    const t = i / 38,
      a = t * Math.PI * 2.8,
      r = (1 - t) * 0.5 + 0.035;
    p.push([x + Math.cos(a) * w * r, y + Math.sin(a) * h * r, z]);
  }
  tube(out, 'metal', p, 0.026, color);
  for (const a of [-0.7, 0.7, 2.4, 3.8]) leaf(out, x, y, z, a, Math.min(w, h) * 0.45, color);
}
function smallBust(out, x, y, z, s, color = stone) {
  sphere(out, 'limestone_raw', [x, y + s * 0.45, z], [s * 0.18, s * 0.24, s * 0.12], color, 12, 9);
  sphere(
    out,
    'limestone_raw',
    [x, y + s * 0.18, z - 0.025],
    [s * 0.35, s * 0.2, s * 0.13],
    color,
    12,
    7,
  );
  box(
    out,
    'limestone_raw',
    [x - s * 0.34, y - s * 0.02, z - 0.12],
    [x + s * 0.34, y + s * 0.055, z + 0.09],
    color,
  );
}
function lamb(out, x, y, z, s, color = light) {
  sphere(out, 'limestone_raw', [x, y + s * 0.31, z], [s * 0.47, s * 0.22, s * 0.11], color, 12, 8);
  sphere(
    out,
    'limestone_raw',
    [x + s * 0.42, y + s * 0.46, z],
    [s * 0.18, s * 0.18, s * 0.105],
    color,
    10,
    7,
  );
  for (const u of [-0.29, -0.05, 0.21, 0.4])
    beam(
      out,
      'limestone_raw',
      [x + u * s, y + s * 0.2, z],
      [x + (u + 0.04) * s, y, z],
      s * 0.055,
      s * 0.065,
      color,
    );
  sphere(
    out,
    'limestone_raw',
    [x + s * 0.59, y + s * 0.43, z + 0.01],
    [s * 0.08, s * 0.05, s * 0.08],
    color,
    8,
    5,
  );
}
function angel(out, x, y, z, s, flip = 1) {
  smallBust(out, x, y, z, s, light);
  for (const k of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < 6; i++)
      pts.push([
        x + k * s * (0.13 + i * 0.07),
        y + s * (0.3 + 0.28 * Math.sin((i / 5) * Math.PI)),
        z - 0.03,
      ]);
    tube(out, 'limestone_raw', pts, s * 0.09, stone);
  }
  beam(
    out,
    'limestone_raw',
    [x, y + s * 0.25, z],
    [x + flip * s * 0.48, y + s * 0.47, z],
    s * 0.07,
    s * 0.07,
    light,
  );
}
function window(out, x, z, y, w, h, slot = 'limestone_raw', color = light) {
  box(out, 'shadow', [x - w / 2, y, z + 0.015], [x + w / 2, y + h, z + 0.025], dark);
  for (const q of [-w / 2, w / 2])
    box(
      out,
      slot,
      [x + q - 0.09, y - 0.07, z - 0.1],
      [x + q + 0.09, y + h + 0.07, z + 0.14],
      color,
    );
  for (const yy of [y, y + h * 0.47, y + h])
    box(
      out,
      slot,
      [x - w / 2 - 0.1, yy - 0.065, z - 0.06],
      [x + w / 2 + 0.1, yy + 0.065, z + 0.14],
      color,
    );
  box(out, 'wood', [x - 0.04, y, z + 0.045], [x + 0.04, y + h, z + 0.13], [0.28, 0.14, 0.1]);
  for (let j = 1; j < 5; j++)
    box(
      out,
      'metal',
      [x - w / 2, y + (j * h) / 5 - 0.012, z + 0.025],
      [x + w / 2, y + (j * h) / 5 + 0.012, z + 0.055],
      dark,
    );
}
function clock(out, z, reverse = false) {
  const y = 9.7,
    r = 1.25;
  box(out, 'metal', [-1.82, 7.92, z - 0.03], [1.82, 11.51, z + 0.025], navy);
  // The raised cloud circle and gilded stars surround the separate two-and-a-half metre dial.
  for (let i = 0; i < 80; i++) {
    const a = (i * tau) / 80,
      rr = 1.38 + 0.07 * Math.sin(i * 2.3);
    sphere(
      out,
      'metal',
      [Math.sin(a) * rr, y + Math.cos(a) * rr, z + 0.08],
      [0.13, 0.087, 0.053],
      navy,
      8,
      5,
    );
  }
  for (let i = 0; i < 74; i++) {
    const x = -1.65 + (i % 9) * 0.4,
      yy = 8.1 + Math.floor(i / 9) * 0.4;
    if (Math.hypot(x, yy - y) < 1.5 || Math.abs(x) > 1.72 || yy > 11.4) continue;
    for (let j = 0; j < 5; j++) {
      const a = (j * tau) / 5;
      beam(
        out,
        'metal',
        [x, yy, z + 0.06],
        [x + 0.047 * Math.sin(a), yy + 0.047 * Math.cos(a), z + 0.06],
        0.012,
        0.014,
        gold,
      );
    }
  }
  disc(out, 'metal', 0, y, z + 0.105, r, navy);
  disc(out, 'metal', 0, y, z + 0.13, 0.87, reverse ? [0.19, 0.11, 0.095] : [0.37, 0.105, 0.045]);
  for (const rr of [0.865, 0.903, 1.25, 1.3])
    circ(out, 'metal', 0, y, z + 0.16, rr, rr, 0.032, gold);
  const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const strokes = {
    I: [
      [0, 0, 0, 1],
      [-0.32, 0, 0.32, 0],
      [-0.32, 1, 0.32, 1],
    ],
    V: [
      [-0.5, 1, 0, 0],
      [0, 0, 0.5, 1],
    ],
    X: [
      [-0.5, 0, 0.5, 1],
      [-0.5, 1, 0.5, 0],
    ],
  };
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      label = numerals[i],
      at = (u, v) => [
        Math.sin(a) * (1.02 + v * 0.22) + Math.cos(a) * u,
        y + Math.cos(a) * (1.02 + v * 0.22) - Math.sin(a) * u,
        z + 0.195,
      ];
    for (let k = 0; k < label.length; k++)
      for (const [u, v, uu, vv] of strokes[label[k]]) {
        const cx = (k - (label.length - 1) / 2) * 0.092;
        beam(out, 'metal', at(cx + u * 0.066, v), at(cx + uu * 0.066, vv), 0.025, 0.022, light);
      }
    const b = a + Math.PI / 12;
    triangle(
      out,
      'metal',
      [
        [Math.sin(b) * 1.15, y + Math.cos(b) * 1.15, z + 0.19],
        [Math.sin(b + 0.025) * 1.1, y + Math.cos(b + 0.025) * 1.1, z + 0.19],
        [Math.sin(b - 0.025) * 1.1, y + Math.cos(b - 0.025) * 1.1, z + 0.19],
      ],
      gold,
    );
  }
  for (let i = 0; i < 24; i++) {
    const a = (i * tau) / 24,
      pts = [];
    for (let j = 0; j <= 14; j++) {
      const t = j / 14,
        rr = 0.16 + 0.67 * t,
        b = a + (i % 2 === 0 ? 0 : 0.038 * Math.sin(t * Math.PI * 4));
      pts.push([Math.sin(b) * rr, y + Math.cos(b) * rr, z + 0.22 + 0.015 * Math.sin(t * Math.PI)]);
    }
    tube(out, 'metal', pts, i % 2 ? 0.023 : 0.031, gold);
  }
  // One physical hour hand, fixed at ten for the static landmark; the lamb remains visible at its tip.
  const angle = -Math.PI / 3;
  beam(
    out,
    'metal',
    [0, y, z + 0.28],
    [Math.sin(angle) * 1.06, y + Math.cos(angle) * 1.06, z + 0.28],
    0.048,
    0.035,
    gold,
  );
  sphere(out, 'metal', [0, y, z + 0.29], [0.095, 0.095, 0.07], gold, 18, 10);
  lamb(out, Math.sin(angle) * 1.05 - 0.07, y + Math.cos(angle) * 1.05 - 0.06, z + 0.3, 0.18, gold);
  for (const s of [-1, 1]) {
    box(
      out,
      'metal',
      [s * 1.74 - 0.095, 7.8, z + 0.035],
      [s * 1.74 + 0.095, 11.6, z + 0.145],
      gold,
    );
    for (let i = 0; i < 8; i++) scroll(out, s * 1.74, 8.03 + i * 0.46, z + 0.165, 0.18, 0.33);
    for (const yy of [8.01, 11.42]) {
      circ(out, 'metal', s * 1.48, yy, z + 0.1, 0.19, 0.19, 0.033, gold);
      disc(out, 'metal', s * 1.48, yy, z + 0.12, 0.12, navy);
    }
  }
  for (const yy of [7.74, 7.91, 11.49, 11.7]) {
    box(out, 'metal', [-2.02, yy, z - 0.04], [2.02, yy + 0.095, z + 0.23], gold);
    for (let i = -4; i <= 4; i++) scroll(out, i * 0.43, yy + 0.15, z + 0.16, 0.37, 0.18);
  }
  // The weekday aperture contains a small original cart-and-animal relief, not invented printed text.
  face(
    out,
    'metal',
    [
      [-0.68, 8.03, z + 0.17],
      [0.68, 8.03, z + 0.17],
      [0.45, 8.53, z + 0.17],
      [-0.45, 8.53, z + 0.17],
    ],
    [0.045, 0.12, 0.12],
  );
  for (const s of [-1, 1]) {
    beam(out, 'metal', [s * 0.69, 8.03, z + 0.19], [s * 0.45, 8.53, z + 0.19], 0.037, 0.035, gold);
    lamb(out, s * 0.43, 8.07, z + 0.21, 0.34, [0.48, 0.35, 0.2]);
    circ(out, 'metal', s * 0.17, 8.12, z + 0.23, 0.09, 0.09, 0.022, gold);
  }
  smallBust(out, 0, 8.11, z + 0.2, 0.4, gold);
  // The lunar globe is 30 cm diameter, with opposed bright and dark hemispheres.
  circ(out, 'metal', 0, 11.97, z + 0.13, 0.235, 0.235, 0.037, gold);
  const globe = (a, b) => [
    0.15 * Math.sin(b) * Math.cos(a),
    11.97 + 0.15 * Math.cos(b),
    z + 0.12 + 0.15 * Math.sin(b) * Math.sin(a),
  ];
  for (let i = 0; i < 32; i++)
    for (let j = 0; j < 16; j++) {
      const a = (i * tau) / 32,
        b = ((i + 1) * tau) / 32,
        c = (j * Math.PI) / 16,
        d = ((j + 1) * Math.PI) / 16,
        color = Math.cos((a + b) / 2) > 0 ? [0.67, 0.68, 0.61] : [0.025, 0.032, 0.04];
      if (j === 0) triangle(out, 'metal', [globe(a, c), globe(a, d), globe(b, d)], color);
      else if (j === 15) triangle(out, 'metal', [globe(a, c), globe(a, d), globe(b, c)], color);
      else face(out, 'metal', [globe(a, c), globe(a, d), globe(b, d), globe(b, c)], color);
    }
  for (const s of [-1, 1]) {
    scroll(out, s * 0.47, 11.89, z + 0.12, 0.56, 0.35);
    finial(out, s * 1.65, z + 0.12, 11.6, 0.65, 'metal', gold);
  }
  finial(out, 0, z + 0.12, 12.2, 0.28, 'metal', gold);
}
function ribbedRoof(out, w, d, y0, y1) {
  const p = (x, s, t) => [
    x * (1 - 0.44 * t - 0.055 * Math.sin(t * Math.PI)),
    y0 + (y1 - y0) * t,
    ((s * d) / 2) * (1 - 0.82 * t - 0.05 * Math.sin(t * Math.PI)),
  ];
  loft(
    out,
    'metal',
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return [p(-w / 2, -1, t), p(w / 2, -1, t), p(w / 2, 1, t), p(-w / 2, 1, t)];
    }),
    lead,
  );
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 12; i++) {
      const x = -w / 2 + (i * w) / 12;
      tube(
        out,
        'metal',
        Array.from({ length: 13 }, (_, j) => p(x, s, j / 12)),
        0.026,
        [0.4, 0.43, 0.42],
      );
    }
    for (let j = 1; j < 9; j++) {
      const t = j / 9;
      beam(out, 'metal', p(-w / 2, s, t), p(w / 2, s, t), 0.024, 0.025, [0.4, 0.43, 0.42]);
    }
  }
}
function pavilion(out) {
  // The complete arch cast measures 7.44 x 4.61 x approximately 6.70 m, including its framing.
  for (const x of [-3.335, 3.335])
    box(out, 'limestone', [x - 0.385, 0, -2.305], [x + 0.385, 6.7, 2.305], stone);
  // The cast's full width includes arch framing against its neighbors; the raised pavilion itself follows the six-metre mapped span.
  box(out, 'limestone', [-3.05, 6.7, -2.12], [3.05, 14.0, 2.12], stone);
  for (const yy of [6.68, 6.89, 13.92, 14.12])
    box(out, 'limestone_raw', [-3.27, yy, -2.27], [3.27, yy + 0.12, 2.27], light);
  for (const s of [-1, 1]) {
    const o = transform(out, s === 1 ? 0 : Math.PI);
    archBay(o, 'limestone_raw', 0, 5.95, 0, 3.9, 1.65, 6.7, 2.305, 2.305, stone, {
      back: false,
      trim: 0.21,
    });
    for (let i = 0; i < 36; i++) {
      const x = -2.78 + (i * 5.56) / 35,
        yy = 3.9 + 1.65 * Math.sqrt(1 - (x / 2.975) ** 2) + 0.21;
      smallBust(o, x, yy, 2.52, 0.24, light);
    }
    for (const x of [-2.86, 2.86]) {
      circ(o, 'limestone_raw', x, 6.09, 2.39, 0.34, 0.34, 0.07, light);
      smallBust(o, x, 5.94, 2.46, 0.55, stone);
    }
    // Arms of Rouen: lamb with banner in a shield, accompanied by the two winged figures.
    loft(
      transform(o, 0, [0, 5.49, 2.39]),
      'limestone_raw',
      [
        [
          [-0.43, 0, 0],
          [0.43, 0, 0],
          [0.39, 0.68, 0],
          [-0.39, 0.68, 0],
        ],
        [
          [-0.42, 0, 0.11],
          [0.42, 0, 0.11],
          [0.39, 0.68, 0.11],
          [-0.39, 0.68, 0.11],
        ],
      ],
      light,
    );
    lamb(o, -0.08, 5.59, 2.54, 0.62);
    beam(o, 'limestone_raw', [0.15, 5.7, 2.55], [0.15, 6.14, 2.55], 0.026, 0.03, stone);
    box(o, 'limestone_raw', [0.15, 5.98, 2.535], [0.41, 6.13, 2.58], light);
    angel(o, -0.78, 5.56, 2.5, 0.67, 1);
    angel(o, 0.78, 5.56, 2.5, 0.67, -1);
    // Applied dial and upper window sit in front of the pavilion envelope.
    clock(o, 2.15, s === -1);
    window(o, 0, 2.17, 12.25, 0.97, 1.19, 'wood', [0.28, 0.13, 0.09]);
    for (const x of [-2.7, -1.04, 1.04, 2.7]) {
      column(o, 'limestone_raw', x, 2.2, 12.09, 13.91, 0.1, light, 12);
      scroll(o, x, 12.74, 2.36, 0.26, 0.58, stone);
    }
    for (let i = -8; i <= 8; i++) {
      scroll(o, i * 0.355, 7.12, 2.26, 0.3, 0.15, stone);
      scroll(o, i * 0.355, 13.81, 2.28, 0.29, 0.17, stone);
    }
  }
  // The barrel soffit is carved with a circular pastoral panel and two flanking panels.
  const soffit = (x) => 3.9 + 1.65 * Math.sqrt(1 - (x / 2.975) ** 2);
  for (const x of [-1.65, 0, 1.65]) {
    const rx = x === 0 ? 0.88 : 0.65,
      rz = 1.5;
    for (let i = 0; i < 64; i++) {
      const a = (i * tau) / 64,
        b = ((i + 1) * tau) / 64;
      beam(
        out,
        'limestone_raw',
        [x + Math.cos(a) * rx, soffit(x + Math.cos(a) * rx) - 0.045, Math.sin(a) * rz],
        [x + Math.cos(b) * rx, soffit(x + Math.cos(b) * rx) - 0.045, Math.sin(b) * rz],
        0.055,
        0.045,
        light,
      );
    }
    const relief = deform(out, ([u, v, depth]) => [u, soffit(u) - 0.035 - depth, v]);
    for (let k = -1; k <= 1; k++) lamb(relief, x + k * 0.27, -0.72 + k * 0.21, 0.015, 0.38, light);
    if (x === 0) {
      smallBust(relief, 0, 0.27, 0.055, 0.9, light);
      loft(
        relief,
        'limestone_raw',
        [radialRing(-0.2, 0.23, 0.08, 12, [0, 0.07]), radialRing(0.53, 0.18, 0.075, 12, [0, 0.07])],
        stone,
      );
      beam(relief, 'limestone_raw', [0.41, -0.15, 0.08], [0.41, 1.07, 0.08], 0.027, 0.028, stone);
      beam(relief, 'limestone_raw', [0.2, 0.89, 0.08], [0.6, 0.89, 0.08], 0.025, 0.028, stone);
    }
    // Shallow grasses, foliage and small architecture follow the pastoral vocabulary of the physical cast.
    for (let i = 0; i < 13; i++) {
      const u = x + Math.sin(i * 2.399) * rx * 0.74,
        v = Math.cos(i * 2.399) * rz * 0.77;
      for (const k of [-1, 0, 1])
        beam(
          relief,
          'limestone_raw',
          [u, v, 0.008],
          [u + k * 0.046, v + 0.14, 0.025],
          0.013,
          0.013,
          stone,
        );
    }
    if (x !== 0) {
      box(relief, 'limestone_raw', [x - 0.27, 0.63, 0.007], [x + 0.25, 0.98, 0.045], stone);
      for (let i = -1; i <= 1; i++)
        box(
          relief,
          'carvedstone',
          [x + i * 0.15 - 0.035, 0.68, 0.049],
          [x + i * 0.15 + 0.035, 0.84, 0.054],
          [0.38, 0.36, 0.3],
        );
      triangle(
        relief,
        'limestone_raw',
        [
          [x - 0.34, 0.98, 0.045],
          [x + 0.31, 0.98, 0.045],
          [x, 1.2, 0.045],
        ],
        light,
      );
    }
  }
  ribbedRoof(out, 6.58, 4.68, 14.27, 18.1);
  for (const s of [-1, 1]) {
    const o = transform(out, s === 1 ? 0 : Math.PI);
    box(o, 'metal', [-0.62, 14.9, 1.09], [0.62, 16.45, 1.35], lead);
    window(o, 0, 1.38, 15.03, 0.72, 0.98, 'metal', lead);
    beam(o, 'metal', [-0.77, 16.34, 1.44], [0, 16.89, 1.44], 0.12, 0.1, lead);
    beam(o, 'metal', [0, 16.89, 1.44], [0.77, 16.34, 1.44], 0.12, 0.1, lead);
    scroll(o, -0.68, 16.1, 1.44, 0.3, 0.42, lead);
    scroll(o, 0.68, 16.1, 1.44, 0.3, 0.42, lead);
  }
  for (const x of [-1.83, 0, 1.83]) finial(out, x, 0, 18.08, x === 0 ? 1.45 : 1.65);
  for (let i = -6; i <= 6; i++) {
    finial(out, i * 0.3, 0, 18.1, 0.37);
    scroll(out, i * 0.3, 18.35, 0.025, 0.2, 0.21, lead);
  }
}
function gothic(out, z, y, w, h, flame = false) {
  archBay(out, 'limestone_raw', 0, w, y, y + h * 0.63, h * 0.37, y + h + 0.24, z, 0.31, stone, {
    pointed: true,
    trim: 0.12,
  });
  for (const x of [-w / 2, w / 2])
    box(
      out,
      'limestone_raw',
      [x - 0.16, y - 0.14, z - 0.03],
      [x + 0.16, y + h * 0.67, z + 0.17],
      light,
    );
  for (const x of [-w * 0.166, w * 0.166])
    beam(out, 'limestone_raw', [x, y, z + 0.01], [x, y + h * 0.72, z + 0.01], 0.085, 0.09, light);
  for (let j = 0; j < 16; j++) {
    const yy = y + 0.15 + j * h * 0.039;
    box(out, 'wood', [-w / 2 + 0.09, yy, z - 0.19], [w / 2 - 0.09, yy + 0.065, z - 0.11], dark);
  }
  for (const x of [-w * 0.166, w * 0.166])
    circ(out, 'limestone_raw', x, y + h * 0.68, z + 0.06, w * 0.15, h * 0.12, 0.058, light);
  if (flame) {
    for (const s of [-1, 1])
      tube(
        out,
        'limestone_raw',
        Array.from({ length: 25 }, (_, i) => {
          const t = i / 24;
          return [s * w * 0.25 * Math.sin(t * Math.PI), y + h * 0.78 + t * h * 0.2, z + 0.045];
        }),
        0.063,
        light,
      );
  } else circ(out, 'limestone_raw', 0, y + h * 0.83, z + 0.05, w * 0.21, h * 0.13, 0.052, light);
}
function belfry(out) {
  const o = transform(out, 0, [-6.75, 0, -2.93]),
    w = 7.55,
    d = 8.6;
  box(o, 'limestone', [-w / 2, 0, -d / 2], [w / 2, 0.03, d / 2], stone);
  box(o, 'limestone', [-w / 2, 30.38, -d / 2], [w / 2, 30.4, d / 2], stone);
  for (const s of [-1, 1])
    for (const t of [-1, 1]) {
      const x = s * (w / 2 - 0.18),
        z = t * (d / 2 - 0.18);
      for (const [ya, yb, extra] of [
        [0, 9.25, 0.38],
        [9.25, 18.5, 0.3],
        [18.5, 29.9, 0.24],
      ])
        box(
          o,
          'limestone_raw',
          [x - 0.3 - extra / 2, ya, z - 0.31 - extra / 2],
          [x + 0.3 + extra / 2, yb, z + 0.31 + extra / 2],
          light,
        );
    }
  for (const y of [9.05, 18.15, 29.85, 30.55])
    cornice(o, 'limestone_raw', w + 0.05, d + 0.05, y, 0.34, light);
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2,
      oo = transform(o, a),
      ww = s % 2 ? d : w,
      zz = (s % 2 ? w : d) / 2;
    const holes = [
      { y: 12.1, h: 4.65, w: 1.93 },
      { y: 21.15, h: 7.05, w: 2.15 },
    ];
    const xs = [-ww / 2, -1.075, -0.965, 0.965, 1.075, ww / 2],
      ys = [0, 12.1, 16.99, 21.15, 28.44, 30.4];
    for (let i = 1; i < xs.length; i++)
      for (let j = 1; j < ys.length; j++) {
        const x = (xs[i - 1] + xs[i]) / 2,
          y = (ys[j - 1] + ys[j]) / 2;
        if (holes.some((h) => Math.abs(x) < h.w / 2 && y > h.y && y < h.y + h.h + 0.24)) continue;
        face(
          oo,
          'limestone',
          [
            [xs[i - 1], ys[j - 1], zz],
            [xs[i], ys[j - 1], zz],
            [xs[i], ys[j], zz],
            [xs[i - 1], ys[j], zz],
          ],
          stone,
        );
      }
    for (const [y, h, width, flame] of [
      [12.1, 4.65, 1.93, false],
      [21.15, 7.05, 2.15, true],
    ]) {
      gothic(oo, zz, y, width, h, flame);
    }
    for (const x of [-ww * 0.31, ww * 0.31])
      box(oo, 'limestone_raw', [x - 0.11, 9.4, zz - 0.01], [x + 0.11, 29.82, zz + 0.12], light);
    for (let k = -6; k <= 6; k++)
      box(
        oo,
        'limestone_raw',
        [k * 0.49 - 0.13, 30.18, zz - 0.08],
        [k * 0.49 + 0.13, 30.48, zz + 0.28],
        stone,
      );
  }
  // The city’s 2024 restoration account locates the dome's timber support at 31 m.
  const profile = [
    [30.9, 3.53],
    [31.28, 3.7],
    [31.53, 3.7],
    [31.68, 3.45],
    [32.2, 3.18],
    [33.0, 2.85],
    [33.8, 2.35],
    [34.55, 1.76],
    [35.03, 1.26],
    [35.17, 1.31],
    [35.38, 1.31],
    [35.55, 1.03],
  ];
  loft(
    o,
    'metal',
    profile.map(([y, r]) => radialRing(y, r, r * 1.02, 80)),
    lead,
  );
  for (let i = 0; i < 24; i++) {
    const a = (i * tau) / 24;
    tube(
      o,
      'metal',
      profile.map(([y, r]) => [Math.sin(a) * (r + 0.035), y, Math.cos(a) * (r * 1.02 + 0.035)]),
      0.042,
      [0.42, 0.45, 0.43],
    );
  }
  for (const y of [35.4, 38.77]) annulus(o, 'metal', 0.97, 1.24, y, y + 0.16, lead, 48);
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8;
    column(
      o,
      'metal',
      Math.sin(a) * 1.02,
      Math.cos(a) * 1.02,
      35.54,
      38.81,
      0.073,
      [0.42, 0.46, 0.43],
      12,
    );
  }
  loft(
    o,
    'metal',
    [
      [38.81, 1.23],
      [39.03, 1.3],
      [39.5, 1.19],
      [39.94, 0.88],
      [40.2, 0.45],
      [40.34, 0.27],
    ].map(([y, r]) => radialRing(y, r, r, 48)),
    lead,
  );
  // A visible bell sits within the open lantern; its support is part of the exterior silhouette.
  loft(
    o,
    'metal',
    [
      [36.4, 0.58],
      [36.55, 0.61],
      [36.76, 0.48],
      [37.3, 0.28],
      [37.62, 0.19],
    ].map(([y, r]) => radialRing(y, r, r, 32)),
    [0.34, 0.28, 0.14],
  );
  beam(o, 'metal', [0, 37.6, 0], [0, 38.9, 0], 0.11, 0.11, dark);
  finial(o, 0, 0, 40.3, 1.58);
  beam(o, 'metal', [0, 41.64, 0], [0, 43, 0], 0.033, 0.033, dark);
  beam(o, 'metal', [-0.58, 42.57, 0], [0.58, 42.57, 0], 0.034, 0.034, dark);
  scroll(o, -0.28, 42.57, 0, 0.38, 0.24, dark);
  scroll(o, 0.28, 42.57, 0, 0.38, 0.24, dark);
  // Octagonal rear stair turret shown on the original multi-level survey.
  const t = transform(o, 0, [-3.1, 0, 4.0]);
  loft(
    t,
    'limestone',
    [
      [0, 1.02],
      [28.4, 0.96],
      [30.8, 0.95],
    ].map(([y, r]) => radialRing(y, r, r, 8)),
    stone,
  );
  loft(
    t,
    'metal',
    [
      [30.8, 1.06],
      [32.9, 0.02],
    ].map(([y, r]) => radialRing(y, r, r, 8)),
    lead,
  );
  for (let i = 0; i < 8; i++) window(transform(t, (i * tau) / 8), 0, 0.95, 4 + i * 2.9, 0.27, 0.78);
}
function workshop(out) {
  const o = transform(out, Math.PI / 2, [-2.77, 0, -4.0]);
  // Small loggia/workshop stands against the streetward flank of the belfry, never a copied neighboring apartment block.
  box(o, 'limestone', [-1.28, 0, -0.62], [1.28, 7.82, 0.64], stone);
  for (const y of [0, 3.32, 7.74, 10.36]) cornice(o, 'limestone_raw', 2.6, 1.3, y, 0.2, light);
  for (const x of [-0.87, 0.87]) {
    archBay(o, 'limestone_raw', x, 0.6, 0.28, 1.77, 0.5, 2.49, 0.72, 0.24, stone, { trim: 0.09 });
    window(o, x, 0.74, 3.64, 0.61, 2.9);
  }
  box(o, 'plaster', [-1.26, 7.94, -0.62], [1.26, 10.37, 0.61], [0.84, 0.8, 0.67]);
  for (const x of [-1.23, 0, 1.23])
    box(o, 'wood', [x - 0.068, 7.94, 0.59], [x + 0.068, 10.37, 0.78], [0.22, 0.085, 0.055]);
  for (const y of [8.07, 9.11, 10.22])
    box(o, 'wood', [-1.28, y, 0.59], [1.28, y + 0.11, 0.78], [0.27, 0.115, 0.07]);
  window(o, 0, 0.82, 8.32, 0.99, 1.64, 'wood', [0.25, 0.1, 0.065]);
  const rr = transform(o, 0, [0, 0, 0.01]);
  ribbedRoof(rr, 2.84, 1.8, 10.55, 12.19);
  // Rococo fountain of Alpheus and Arethusa: curved basin, flanking pilasters, shell and two reclining figures.
  const f = transform(out, Math.PI / 2, [-2.68, 0, -6.98]);
  loft(
    f,
    'limestone_raw',
    [
      [0, 0.86],
      [0.14, 1.05],
      [0.45, 0.99],
      [0.54, 1.13],
    ].map(([y, r]) => radialRing(y, r, r * 0.47, 40, [0, 0.26])),
    stone,
  );
  box(f, 'limestone', [-1.16, 0.51, -0.28], [1.16, 5.7, 0.01], stone);
  for (const x of [-1.02, 1.02]) {
    column(f, 'limestone_raw', x, 0.13, 0.5, 5.31, 0.14, light, 12);
    finial(f, x, 0.13, 5.24, 0.42, 'limestone_raw', stone);
  }
  for (const x of [-0.62, 0.62]) {
    sphere(f, 'limestone_raw', [x, 4.06, 0.25], [0.33, 0.45, 0.22], light, 14, 10);
    smallBust(f, x * 0.63, 4.31, 0.28, 0.78, stone);
    beam(f, 'limestone_raw', [x, 4.02, 0.29], [x * 1.42, 3.55, 0.35], 0.14, 0.16, stone);
  }
  for (let j = 0; j < 14; j++) {
    const a = (j * Math.PI) / 13;
    beam(
      f,
      'limestone_raw',
      [0, 3.6, 0.11],
      [Math.cos(a) * 0.83, 3.6 + Math.sin(a) * 0.68, 0.19],
      0.077,
      0.074,
      light,
    );
  }
  for (const s of [-1, 1]) scroll(f, s * 0.79, 5.53, 0.13, 0.75, 0.81, stone);
  smallBust(f, 0, 5.33, 0.2, 0.64, light);
  box(f, 'limestone_raw', [-0.87, 0.62, -0.06], [0.87, 2.86, 0.13], light);
  box(f, 'carvedstone', [-0.69, 1.05, 0.14], [0.69, 2.37, 0.17], [0.23, 0.28, 0.26]);
}
function build(out) {
  pavilion(out);
  belfry(out);
  workshop(out);
}
export const grosHorloge = {
  id: 'n0612_gros_horloge',
  planId: 'N0612',
  title: 'Gros-Horloge',
  wikidata: 'Q3116957',
  authoringFile: 'gros-horloge-model.mjs',
  build,
  front:
    'Native +Z east-southeast along the street toward the cathedral; +X north-northeast across the pavilion',
  origin: 'Center of the exact mapped clock-pavilion footprint, Y=0 at the public street',
  brief:
    'Rouen’s complete landmark ensemble: a true lowered street arch with carved pastoral soffit and arms of Rouen; two raised Renaissance dials with Roman numerals, 24 sun rays, single lamb-tipped hour hands, lunar globes and weekday reliefs; metal-panel pavilion roof with dormers and ornate crest; adjoining buttressed Gothic belfry, tracery windows, ribbed dome and open bell lantern; original loggia/workshop and Rococo fountain.',
  refs: [
    'https://rouen.fr/gros-horloge',
    'https://rouen.fr/sites/default/files/legacy/rm536_0.pdf',
    'https://rouen.fr/sites/default/files/cm/2024-12-19/22-8ann.pdf',
    'https://www.citedelarchitecture.fr/fr/oeuvre/arche-du-pavillon-dit-du-gros-horloge',
    'https://gallica.bnf.fr/ark:/12148/btv1b10050434r',
    'https://pop.culture.gouv.fr/notice/merimee/IA00021886',
    'https://www.patrimoine-horloge.fr/as-rouen.html',
    'https://www.openstreetmap.org/way/63205872',
    'https://www.openstreetmap.org/way/63206189',
  ],
  facts: {
    castArchWidthMeters: 7.44,
    castArchDepthMeters: 4.61,
    castArchHeightMetersApproximate: 6.7,
    dialDiameterMeters: 2.5,
    lunarGlobeDiameterMeters: 0.3,
    sunRayCount: 24,
    domeTimberSupportHeightMeters: 31,
    totalHeightReconstructedMeters: 43,
  },
  scaleBasis:
    'The state museum’s physical arch cast records 7.44 m width, 4.61 m depth and approximately 6.70 m height. The clock-conservation study records 2.50 m dials and 0.30 m lunar spheres. Rouen magazine 536 (March 2024) places the restored dome timber support at 31 m; the lantern/finial is proportionally reconstructed to approximately 43 m from primary exterior photographs and the municipal cutaway. The 76 m figure in the educational booklet is inconsistent with this primary restoration datum and is not used. OSM exact-identity footprints fix the pavilion and adjoining belfry in the street; the original BnF multi-level survey separates the arch, belfry, loggia, rear stair turret and fountain. Intermediate facade levels and ornament are reconstructed proportions, not a survey.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    status: 'preview-proposal',
    evidence: map.basis,
    limitations:
      'The mapped pavilion is the open span; the wider measured cast includes its jamb/framing. The belfry has its own confirmed identity Q22952095. Adjacent apartment buildings remain outside the model; the small workshop and fountain are part of the landmark. Roof/finial height and ornaments are reconstructed from the cited primary views.',
  },
  limits: [
    'The architecture is a detailed original polygonal reconstruction. Carved angels, lambs, pastoral figures and the fountain group preserve placement and silhouette without claiming exact restoration-grade sculpture; no invented inscription text is added.',
    'The two clock faces are static at ten o’clock. Lunar hemispheres and the weekday cart are illustrative exterior states, not a live astronomical clock simulation.',
    'The 31 m dome-support datum is primary; approximately 43 m finial height and intermediate levels are proportional reconstruction. The adjacent historic town hall/apartment blocks are separate buildings and are intentionally excluded.',
  ],
  cameras: [
    { name: 'cathedral-side-ensemble', position: [40, 25, 65], lookAt: [-4, 20, 0] },
    { name: 'market-side-ensemble', position: [35, 25, -70], lookAt: [-4, 20, -2] },
    { name: 'renaissance-clock', position: [6, 11, 14], lookAt: [0, 9.9, 2] },
    { name: 'reverse-clock', position: [3, 10, -14], lookAt: [0, 9.8, -2] },
    { name: 'pastoral-arch', position: [1.5, 1.6, 8], lookAt: [0, 5.1, 0] },
    { name: 'gothic-tracery', position: [12, 23, 15], lookAt: [-6, 22, -3] },
    { name: 'ribbed-dome-and-lantern', position: [7, 40, 12], lookAt: [-6.8, 36.4, -2.9] },
    { name: 'workshop-and-fountain', position: [12, 7, -15], lookAt: [-2.6, 5, -5] },
    { name: 'far-silhouette', position: [58, 35, 67], lookAt: [-4, 21, -2] },
  ],
};
