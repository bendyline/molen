/** Original detailed exterior reconstruction from ASI plan and official/firsthand photographs. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const tau = Math.PI * 2,
  slot = 'yser_stone';
const sand = [0.61, 0.4, 0.22],
  light = [0.7, 0.53, 0.32],
  pale = [0.76, 0.66, 0.48];
const tint = (k, b = sand) =>
  b.map(
    (v, i) =>
      v * (0.91 + (0.13 * (((Math.sin(k * 8.719 + 1.3) * 43758.5) % 1) + 1)) / 2) +
      (i === 0 ? 0.01 : 0),
  );
// The plan is a stepped cross. Its projecting cardinal bays and reentrant corners remain visible on every level.
function plan(r) {
  const a = r * 0.32,
    b = r * 0.67;
  return [
    [a, -r],
    [-a, -r],
    [-a, -b],
    [-b, -b],
    [-b, -a],
    [-r, -a],
    [-r, a],
    [-b, a],
    [-b, b],
    [-a, b],
    [-a, r],
    [a, r],
    [a, b],
    [b, b],
    [b, a],
    [r, a],
    [r, -a],
    [b, -a],
    [b, -b],
    [a, -b],
  ];
}
function ring(out, r0, r1, y0, y1, color = sand, cap = true) {
  const p = plan(r0),
    q = plan(r1);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    face(
      out,
      slot,
      [
        [p[i][0], y0, p[i][1]],
        [p[j][0], y0, p[j][1]],
        [q[j][0], y1, q[j][1]],
        [q[i][0], y1, q[i][1]],
      ],
      color,
    );
    if (cap) {
      triangle(
        out,
        slot,
        [
          [0, y1, 0],
          [q[i][0], y1, q[i][1]],
          [q[j][0], y1, q[j][1]],
        ],
        color,
      );
      triangle(
        out,
        slot,
        [
          [0, y0, 0],
          [p[j][0], y0, p[j][1]],
          [p[i][0], y0, p[i][1]],
        ],
        color,
      );
    }
  }
}
function moulding(out, r, y, h, key) {
  const profile = [
    [0, -0.04],
    [0.09, 0],
    [0.17, 0.12],
    [0.23, 0.16],
    [0.32, 0.1],
    [0.39, 0.1],
    [0.48, 0.26],
    [0.62, 0.31],
    [0.72, 0.24],
    [0.8, 0.15],
    [0.91, 0.17],
    [1, 0.03],
  ];
  for (let i = 1; i < profile.length; i++)
    ring(
      out,
      r + profile[i - 1][1],
      r + profile[i][1],
      y + h * profile[i - 1][0],
      y + h * profile[i][0],
      tint(key + i),
    );
}
function floral(out, x, y, z, size, key) {
  const color = tint(key, light);
  sphere(out, slot, [x, y, z], [size * 0.19, size * 0.19, size * 0.14], color, 8, 5);
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8;
    sphere(
      out,
      slot,
      [x + Math.cos(a) * size * 0.39, y + Math.sin(a) * size * 0.39, z],
      [size * 0.2, size * 0.14, size * 0.1],
      color,
      7,
      4,
    );
  }
}
function pilaster(out, x, z, y0, y1, r, key) {
  box(out, slot, [x - r * 0.72, y0, z - 0.08], [x + r * 0.72, y0 + 0.16, z + 0.2], tint(key));
  box(
    out,
    slot,
    [x - r * 0.56, y0 + 0.16, z - 0.05],
    [x + r * 0.56, y1 - 0.23, z + 0.13],
    tint(key + 1),
  );
  for (let k = -1; k <= 1; k++)
    beam(
      out,
      slot,
      [x + k * r * 0.32, y0 + 0.29, z + 0.165],
      [x + k * r * 0.32, y1 - 0.31, z + 0.165],
      r * 0.105,
      0.04,
      tint(key + 3),
    );
  box(
    out,
    slot,
    [x - r * 0.85, y1 - 0.23, z - 0.07],
    [x + r * 0.85, y1 - 0.12, z + 0.24],
    tint(key + 5),
  );
  box(out, slot, [x - r, y1 - 0.12, z - 0.09], [x + r, y1, z + 0.31], tint(key + 7));
}
function figure(out, x, y, z, h, key) {
  const color = tint(key, light),
    robe = [0.64, 0.48, 0.29];
  box(out, slot, [x - h * 0.22, y, z - 0.06], [x + h * 0.22, y + 0.11, z + 0.21], color);
  // Original shallow sculptural figures retain crown, halo, robe, arms and feet; they do not reproduce undocumented iconographic attributes.
  sphere(
    out,
    slot,
    [x, y + h * 0.72, z + 0.05],
    [h * 0.205, h * 0.205, h * 0.042],
    tint(key + 3),
    14,
    7,
  );
  sphere(out, slot, [x, y + h * 0.69, z + 0.12], [h * 0.105, h * 0.135, h * 0.08], color, 10, 7);
  loft(
    out,
    slot,
    [
      radialRing(y + h * 0.29, h * 0.135, h * 0.07, 8, [x, z + 0.1]),
      radialRing(y + h * 0.57, h * 0.16, h * 0.075, 8, [x, z + 0.1]),
    ],
    color,
  );
  loft(
    out,
    slot,
    [
      radialRing(y + h * 0.12, h * 0.18, h * 0.095, 8, [x, z + 0.1]),
      radialRing(y + h * 0.34, h * 0.11, h * 0.075, 8, [x, z + 0.1]),
    ],
    tint(key + 9, robe),
  );
  loft(
    out,
    slot,
    [
      radialRing(y + h * 0.78, h * 0.1, h * 0.075, 8, [x, z + 0.12]),
      radialRing(y + h * 0.89, h * 0.045, h * 0.04, 8, [x, z + 0.12]),
    ],
    color,
  );
  for (const s of [-1, 1]) {
    const bend = key % 3 === 0 ? s : 1;
    beam(
      out,
      slot,
      [x + s * h * 0.12, y + h * 0.53, z + 0.12],
      [x + s * h * 0.23, y + h * (0.42 + 0.13 * bend), z + 0.19],
      h * 0.07,
      h * 0.065,
      color,
    );
    beam(
      out,
      slot,
      [x + s * h * 0.23, y + h * (0.42 + 0.13 * bend), z + 0.19],
      [x + s * h * 0.26, y + h * 0.58, z + 0.23],
      h * 0.064,
      h * 0.06,
      color,
    );
    box(
      out,
      slot,
      [x + s * h * 0.08 - h * 0.035, y + 0.11, z + 0.11],
      [x + s * h * 0.08 + h * 0.035, y + h * 0.2, z + 0.23],
      color,
    );
  }
  for (let k = -2; k <= 2; k++)
    beam(
      out,
      slot,
      [x + k * h * 0.045, y + h * 0.14, z + 0.187],
      [x + k * h * 0.026, y + h * 0.32, z + 0.177],
      h * 0.009,
      0.013,
      light,
    );
}
function relief(out, x, y, z, w, h, key) {
  box(out, slot, [x - w / 2, y, z - 0.025], [x + w / 2, y + h, z + 0.02], tint(key));
  for (const s of [-1, 1])
    pilaster(out, x + s * (w / 2 - 0.08), z + 0.03, y, y + h, 0.11, key + 4 + s);
  box(
    out,
    slot,
    [x - w / 2 - 0.07, y - 0.08, z - 0.04],
    [x + w / 2 + 0.07, y + 0.04, z + 0.16],
    light,
  );
  box(
    out,
    slot,
    [x - w / 2 - 0.09, y + h - 0.05, z - 0.04],
    [x + w / 2 + 0.09, y + h + 0.12, z + 0.2],
    tint(key + 7),
  );
  figure(out, x, y + 0.05, z + 0.04, h * 0.88, key);
  floral(out, x, y + h + 0.14, z + 0.2, 0.17, key + 11);
}
function jali(out, x, y, z, w, h, key) {
  const cols = 4,
    rows = 4;
  box(out, 'shadow', [x - w / 2, y, z - 0.18], [x + w / 2, y + h, z - 0.17], [0.07, 0.055, 0.035]);
  for (let i = 0; i <= cols; i++)
    box(
      out,
      slot,
      [x - w / 2 + (i * w) / cols - 0.034, y, z - 0.015],
      [x - w / 2 + (i * w) / cols + 0.034, y + h, z + 0.045],
      pale,
    );
  for (let j = 0; j <= rows; j++)
    box(
      out,
      slot,
      [x - w / 2, y + (j * h) / rows - 0.034, z - 0.015],
      [x + w / 2, y + (j * h) / rows + 0.034, z + 0.045],
      pale,
    );
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const xx = x - w / 2 + ((i + 0.5) * w) / cols,
        yy = y + ((j + 0.5) * h) / rows;
      beam(
        out,
        slot,
        [xx - (w / cols) * 0.25, yy - (h / rows) * 0.25, z + 0.005],
        [xx + (w / cols) * 0.25, yy + (h / rows) * 0.25, z + 0.005],
        0.028,
        0.034,
        tint(key, pale),
      );
      beam(
        out,
        slot,
        [xx + (w / cols) * 0.25, yy - (h / rows) * 0.25, z + 0.007],
        [xx - (w / cols) * 0.25, yy + (h / rows) * 0.25, z + 0.007],
        0.028,
        0.034,
        tint(key, pale),
      );
    }
}
function frieze(out, r, y, h, key, clearOpening = 0) {
  const p = plan(r);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      o = transform(out, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), [
        (a[0] + b[0]) / 2,
        0,
        (a[1] + b[1]) / 2,
      ]);
    const n = Math.max(1, Math.round(len / 0.23));
    for (let j = 0; j < n; j++) {
      const x = -len / 2 + ((j + 0.5) * len) / n;
      if (i % 5 === 0 && Math.abs(x) < clearOpening / 2 + 0.06) continue;
      box(o, slot, [x - 0.055, y, 0], [x + 0.055, y + h, 0.08], tint(key + i * 13 + j));
      if (j % 2 === 0) floral(o, x, y + h * 0.55, 0.09, h * 0.58, key + j);
    }
  }
}
function walls(out, r, y0, y1, window, key, upperScreen = null) {
  const p = plan(r);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const o = transform(out, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), [
      (a[0] + b[0]) / 2,
      0,
      (a[1] + b[1]) / 2,
    ]);
    const axial = i % 5 === 0,
      openings = axial ? [window, upperScreen].filter(Boolean) : [];
    const xs = [-len / 2, len / 2, ...openings.flatMap((w) => [-w.w / 2, w.w / 2])].sort(
        (a, b) => a - b,
      ),
      ys = [y0, y1, ...openings.flatMap((w) => [w.y, w.y + w.h])].sort((a, b) => a - b);
    for (let u = 1; u < xs.length; u++)
      for (let v = 1; v < ys.length; v++) {
        if (xs[u] - xs[u - 1] < 0.001 || ys[v] - ys[v - 1] < 0.001) continue;
        const cx = (xs[u] + xs[u - 1]) / 2,
          cy = (ys[v] + ys[v - 1]) / 2;
        if (
          openings.some(
            (opening) =>
              Math.abs(cx) < opening.w / 2 && cy > opening.y && cy < opening.y + opening.h,
          )
        )
          continue;
        face(
          o,
          slot,
          [
            [xs[u - 1], ys[v - 1], 0],
            [xs[u], ys[v - 1], 0],
            [xs[u], ys[v], 0],
            [xs[u - 1], ys[v], 0],
          ],
          tint(key + i),
        );
      }
    for (const opening of openings) {
      box(
        o,
        'shadow',
        [-opening.w / 2, opening.y, -0.4],
        [opening.w / 2, opening.y + opening.h, -0.39],
        [0.065, 0.047, 0.03],
      );
      for (const x of [-opening.w / 2, opening.w / 2])
        face(
          o,
          slot,
          [
            [x, opening.y, 0],
            [x, opening.y + opening.h, 0],
            [x, opening.y + opening.h, -0.41],
            [x, opening.y, -0.41],
          ],
          sand,
        );
      box(
        o,
        slot,
        [-opening.w / 2 - 0.09, opening.y - 0.07, -0.06],
        [opening.w / 2 + 0.09, opening.y + 0.06, 0.12],
        light,
      );
      box(
        o,
        slot,
        [-opening.w / 2 - 0.11, opening.y + opening.h - 0.03, -0.06],
        [opening.w / 2 + 0.11, opening.y + opening.h + 0.13, 0.19],
        light,
      );
    }
    if (axial && len > 2.1) {
      const w = Math.min(0.63, (len - window.w) / 2 - 0.16);
      for (const sign of [-1, 1])
        relief(
          o,
          sign * (len / 2 - w / 2 - 0.065),
          y0 + 0.2,
          0.03,
          w,
          Math.min(1.76, y1 - y0 - 0.35),
          key + i * 17 + sign,
        );
    }
    // All exterior returns retain small sculpted niches, pilasters and beaded borders.
    if (!axial && len > 0.55) {
      relief(
        o,
        0,
        y0 + 0.35,
        0,
        Math.min(len - 0.13, 0.9),
        Math.min(y1 - y0 - 0.6, 1.8),
        key + i * 7,
      );
      if (y1 - y0 > 2.7) {
        box(o, slot, [-len / 2 + 0.03, y1 - 0.68, 0], [len / 2 - 0.03, y1 - 0.59, 0.13], light);
        for (let j = -1; j <= 1; j++) floral(o, j * len * 0.27, y1 - 0.39, 0.065, 0.3, key + i + j);
      }
    }
  }
}
function balcony(out, r, y, w, h, key, screen = false) {
  for (let s = 0; s < 4; s++) {
    const o = transform(out, (s * Math.PI) / 2);
    box(o, slot, [-w / 2 - 0.28, y - 0.22, r - 0.25], [w / 2 + 0.28, y, r + 0.48], tint(key));
    for (const x of [-w / 2, w / 2]) {
      pilaster(o, x, r + 0.25, y, y + h, 0.16, key + 10);
      for (let j = 0; j < 3; j++)
        box(
          o,
          slot,
          [x - 0.11 - j * 0.025, y - 0.24 - j * 0.14, r - 0.12 + j * 0.07],
          [x + 0.11 + j * 0.025, y - 0.13 - j * 0.14, r + 0.4 - j * 0.09],
          tint(key + j),
        );
    }
    box(
      o,
      slot,
      [-w / 2 - 0.35, y + h - 0.12, r - 0.28],
      [w / 2 + 0.35, y + h + 0.14, r + 0.6],
      light,
    );
    box(o, slot, [-w / 2, y + 0.1, r + 0.22], [w / 2, y + 0.6, r + 0.35], sand);
    for (let j = 0; j < Math.floor(w / 0.3); j++)
      floral(o, -w / 2 + 0.17 + j * 0.3, y + 0.34, r + 0.365, 0.18, key + j);
    if (screen) jali(o, 0, y + 0.62, r + 0.24, w - 0.3, h - 0.83, key);
  }
}
function pavilion(out, r, y0, y1, key) {
  ring(out, r + 0.22, r + 0.22, y0, y0 + 0.25, tint(key));
  // The open upper pavilions have a square corner gallery behind their projecting cardinal balconies.
  box(out, slot, [-r * 0.84, y0, -r * 0.84], [r * 0.84, y0 + 0.25, r * 0.84], sand);
  box(out, slot, [-1.2, y0, -1.2], [1.2, y1, 1.2], sand);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * r * 0.73,
        z = sz * r * 0.73;
      box(out, slot, [x - 0.3, y0 + 0.2, z - 0.3], [x + 0.3, y1, z + 0.3], tint(key + sx + sz));
    }
  box(out, slot, [-r * 0.85, y1 - 0.11, -r * 0.85], [r * 0.85, y1 + 0.1, r * 0.85], light);
  for (let s = 0; s < 4; s++) {
    const o = transform(out, (s * Math.PI) / 2);
    for (const x of [-r * 0.73, -r * 0.25, r * 0.25, r * 0.73]) {
      const radii = [
        [y0 + 0.2, 0.21],
        [y0 + 0.4, 0.24],
        [y0 + 0.59, 0.16],
        [y1 - 0.4, 0.14],
        [y1 - 0.28, 0.28],
        [y1 - 0.1, 0.33],
      ];
      loft(
        o,
        slot,
        radii.map(([y, rad]) => radialRing(y, rad, rad, 12, [x, r * 0.72])),
        tint(key + s),
      );
    }
    box(o, slot, [-r * 0.89, y0 + 0.24, r * 0.65], [r * 0.89, y0 + 0.8, r * 0.79], sand);
    for (let k = -5; k <= 5; k++) floral(o, k * r * 0.145, y0 + 0.53, r * 0.8, 0.21, key + k);
    box(o, slot, [-r * 0.95, y1 - 0.12, r * 0.55], [r * 0.95, y1 + 0.12, r * 0.99], light);
    for (const x of [-r * 0.8, r * 0.8])
      relief(o, x, y0 + 0.82, r * 0.52, 0.48, y1 - y0 - 1.1, key + 15);
    for (const x of [-r * 0.73, -r * 0.25, r * 0.25, r * 0.73])
      for (let b = 0; b < 3; b++)
        box(
          o,
          slot,
          [x - 0.17 - b * 0.045, y1 - 0.38 + b * 0.095, r * 0.67],
          [x + 0.17 + b * 0.045, y1 - 0.27 + b * 0.095, r * 0.84 + b * 0.04],
          tint(key + b),
        );
  }
}
function build(out) {
  // Published 14.32 m maximum square support; the narrower stepped tower sits above it.
  for (let j = 0; j < 5; j++)
    box(
      out,
      slot,
      [-7.16 + j * 0.055, j * 0.38, -7.16 + j * 0.055],
      [7.16 - j * 0.055, (j + 1) * 0.38, 7.16 - j * 0.055],
      tint(10 + j),
    );
  for (let s = 0; s < 4; s++) {
    const o = transform(out, (s * Math.PI) / 2);
    for (let j = 0; j < 20; j++) {
      if (s === 0 && Math.abs(-6.65 + j * 0.7) < 1.2) continue;
      box(o, slot, [-6.85 + j * 0.7, 1.88, 6.72], [-6.3 + j * 0.7, 2.26, 6.98], sand);
      for (const x of [-6.75 + j * 0.7, -6.4 + j * 0.7])
        box(o, slot, [x - 0.043, 2.2, 6.73], [x + 0.043, 2.55, 6.88], pale);
      box(o, slot, [-6.88 + j * 0.7, 2.51, 6.68], [-6.27 + j * 0.7, 2.63, 7.01], light);
    }
  }
  for (let i = 0; i < 10; i++)
    box(
      out,
      slot,
      [-1.16, i * 0.19, 10.13 - i * 0.33],
      [1.16, (i + 1) * 0.19, 10.46 - i * 0.33],
      tint(40 + i),
    );
  box(out, slot, [-0.77, 1.9, 4.55], [0.77, 2.17, 5.22], light);
  box(out, slot, [-0.72, 2.17, 4.54], [0.72, 2.45, 4.89], light);
  const levels = [
    { a: 1.9, b: 6.25, r: 4.57 },
    { a: 6.25, b: 10.9, r: 4.57 },
    { a: 10.9, b: 14.85, r: 3.77 },
    { a: 14.85, b: 18.78, r: 3.73 },
    { a: 18.78, b: 22.7, r: 3.69 },
    { a: 22.7, b: 25.95, r: 3.64 },
    { a: 25.95, b: 28.7, r: 3.57 },
  ];
  for (let l = 0; l < levels.length; l++) {
    const { a, b, r } = levels[l],
      h = b - a;
    moulding(out, r, a, 0.55, 100 + l * 37);
    const win = {
      w: l === 0 ? 1.26 : 1.38,
      y: a + (l === 0 ? 0.55 : Math.min(1.47, h * 0.32)),
      h: l === 0 ? 2.5 : Math.min(1.32, h * 0.36),
    };
    walls(
      out,
      r,
      a + 0.55,
      b - 0.67,
      win,
      200 + l * 41,
      l === 0 ? { w: 1.1, y: a + 3.15, h: 0.52 } : null,
    );
    moulding(out, r, b - 0.67, 0.67, 300 + l * 19);
    frieze(out, r + 0.08, a + 0.61, 0.38, 400 + l * 31, l === 0 ? 1.26 : 0);
    frieze(out, r + 0.1, b - 0.8, 0.18, 600 + l * 31);
    for (let s = 0; s < 4; s++) {
      const o = transform(out, (s * Math.PI) / 2);
      for (const x of [-r * 0.26, r * 0.26])
        pilaster(o, x, r + 0.05, a + 0.9, b - 0.78, 0.145, 700 + l * 37 + s);
      if (l === 0 && s !== 0) jali(o, 0, a + 0.62, r + 0.012, 1.27, 1.27, 800 + s);
      if (l === 0) {
        jali(o, 0, a + 3.15, r + 0.04, 1.1, 0.52, 840 + s);
      } else if (s === 0)
        balcony(
          transform(out, (s * Math.PI) / 2),
          r,
          win.y - 0.1,
          1.54,
          win.h + 0.18,
          900 + l * 41,
          false,
        );
    }
  }
  moulding(out, 3.97, 28.7, 0.67, 1400);
  pavilion(out, 4.0, 29.37, 32.02, 1450);
  moulding(out, 4.07, 32.02, 0.66, 1550);
  // Ninth storey is a smaller open colonnaded pavilion, topped by the surviving ribbed domical cap.
  pavilion(out, 2.93, 32.68, 34.84, 1600);
  ring(out, 3.09, 3.19, 34.82, 34.99, light);
  ring(out, 3.19, 2.93, 34.99, 35.18, tint(1680));
  const profile = [
    [35.18, 2.76],
    [35.37, 2.66],
    [35.65, 2.31],
    [35.95, 1.94],
    [36.27, 1.54],
    [36.54, 1.05],
    [36.77, 0.44],
  ];
  const n = 96;
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * tau) / n,
        c = Math.cos(a),
        s = Math.sin(a),
        q = r / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25),
        rib = 1 + 0.014 * Math.cos(a * 24);
      return [c * q * rib, y, s * q * rib];
    }),
  );
  loft(out, slot, rings, tint(1700));
  for (let i = 0; i < 24; i++) {
    const a = (i * tau) / 24;
    for (let j = 1; j < profile.length; j++) {
      const p = ([y, r]) => {
        const c = Math.cos(a),
          s = Math.sin(a),
          q = r / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25);
        return [c * q, y + 0.018, s * q];
      };
      beam(out, slot, p(profile[j - 1]), p(profile[j]), 0.065, 0.045, light);
    }
  }
  loft(
    out,
    slot,
    [
      radialRing(36.75, 0.32, 0.32, 20),
      radialRing(36.87, 0.39, 0.39, 20),
      radialRing(37.02, 0.18, 0.18, 20),
      radialRing(37.19, 0.018, 0.018, 20),
    ],
    light,
  );
}
export const vijayaStambha = {
  id: 'n0611_vijaya_stambha',
  planId: 'N0611',
  title: 'Vijaya Stambha',
  wikidata: 'Q2724452',
  authoringFile: 'vijaya-stambha-model.mjs',
  build,
  front: 'Native +Z south, matching the ASI plan entrance; +X east',
  origin: 'Center of the square support terrace; Y=0 at the bottom of the exposed platform',
  brief:
    'Nine-storey Mewar victory monument: stepped cruciform carved sandstone shaft, broad lower pair of levels, dense relief niches and fluted pilasters, moulded projecting cornice bands, cardinal balcony windows and jali screens, two open upper pavilions and a ribbed domical crown. Original relief geometry preserves the documented sculpture rhythm without inventing inscription text.',
  refs: [
    'https://whc.unesco.org/uploads/nominations/247rev.pdf',
    'https://ignca.gov.in/Asi_data/88329.pdf',
    'https://www.tourism.rajasthan.gov.in/chittorgarh.html',
    'https://dsr.nii.ac.jp/toyobunko/La-100/V-1/page/0090.html.en',
    'https://franpritchett.com/00routesdata/1400_1499/rajputforts/chitor_tower/chitor_tower.html',
    'https://www.wikidata.org/wiki/Q2724452',
    'https://www.openstreetmap.org/way/1549061397',
  ],
  facts: {
    architecturalHeightMeters: 37.19,
    maximumBaseMeters: 14.32,
    stories: 9,
    documentedEntrance: 'south',
    lowerShaftWidthApproximateMeters: 9.14,
  },
  scaleBasis:
    'UNESCO nomination 247rev printed 2.47–2.48 reproduces the ASI stepped-cross plan and records 37.19 m overall height, 14.32 m maximum width and nine storeys. Thomas Holbein Hendley’s firsthand India volume 1 describes the narrower tower body as 30 ft wide; this is treated separately from the broad support terrace. Intermediate level heights and projections are proportional reconstructions from official tourism photos, UNESCO close views and Baudesson’s primary 1882 north/southwest/south-entrance photographs, checked against the modern comparison. No inconsistent printed raster scale is promoted to a new surveyed dimension.',
  geographicProposal: {
    anchor: [74.645123975, 24.887826525],
    heading: 0.026694748787334657,
    source: 'https://www.openstreetmap.org/way/1549061397',
    status: 'preview-proposal',
    evidence:
      'The ASI north-arrow plan establishes the southern entrance. The exact monument way 1549061397, identified by en:Vijaya_Stambha and 37.19 m height, supplies a refined center and north-edge azimuth. Its former standalone monument node became a corner of the new way on 2026-08-12. Native +Z follows the near-south entrance side; the mapped edge refines the general cardinal drawing by about 1.53 degrees. Raw attributed evidence is retained in map-frame.json.',
    limitations:
      'The mapped rectangle is the small upper roof, about 5.8 by 5.6 m, rather than the independently documented 14.32 m support terrace. It fixes center and orientation without being used to shrink the lower tower to the roof dimensions. Surrounding fort, garden and separate temples are excluded.',
  },
  limits: [
    'The exterior includes original shallow sculptural figures with robes, halos and crowns; individual deity identities, hand attributes, damaged inscriptions and carving faces are not represented as exact replicas. No fabricated legible inscription text is used.',
    'The documented height, maximum base and nine levels govern scale. The lower shaft width and upper setbacks follow primary historical dimensions and photographs; intermediate floor elevations, dome profile and mouldings remain proportional reconstruction.',
    'The source is current restored exterior appearance as in official tourism photographs. Interior stairs and chambers, separate fort buildings and gardens are outside the asset. Mapped upper-roof evidence fixes the center and axis; the ground terrace retains the independently documented larger dimensions.',
  ],
  cameras: [
    { name: 'south-entrance', position: [27, 24, 53], lookAt: [0, 18, 0] },
    { name: 'north-reliefs', position: [-28, 25, -49], lookAt: [0, 18, 0] },
    { name: 'lower-jali-and-carvings', position: [8, 8, 15], lookAt: [0, 6, 2] },
    { name: 'stepped-shaft', position: [12, 21, 17], lookAt: [0, 19, 0] },
    { name: 'balconies-and-cornices', position: [8, 28, 13], lookAt: [0, 26, 0] },
    { name: 'upper-pavilions', position: [11, 36, 14], lookAt: [0, 33, 0] },
    { name: 'ribbed-crown', position: [8, 43, 11], lookAt: [0, 35.4, 0] },
    { name: 'far-silhouette', position: [44, 29, 59], lookAt: [0, 18, 0] },
  ],
};
