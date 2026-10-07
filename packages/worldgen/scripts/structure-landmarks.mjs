import { lumenField, tMobilePark } from './seattle-stadiums.mjs';
import { arch, box, colors, gable, prism, profile, quad, tube } from './structure-mesh.mjs';

const C = colors;
const n = (code) => Number(code.slice(1));

function spire(out, height, radius = 1.1, color = C.steel, center = [0, 0]) {
  profile(
    out,
    [
      [height - 18, radius, radius],
      [height, 0.08, 0.08, 'trim', color],
    ],
    8,
    center,
  );
}

function stackedTower(out, h, widths, color, glass = C.glass) {
  let y0 = 0;
  for (let i = 0; i < widths.length; i++) {
    const y1 = h * ((i + 1) / widths.length);
    const w = widths[i];
    box(out, 'wall', [-w / 2, y0, -w * 0.38], [w / 2, y1, w * 0.38], color);
    const floors = Math.max(2, Math.round((y1 - y0) / 7));
    for (let f = 0; f < floors; f++) {
      const y = y0 + ((f + 0.5) * (y1 - y0)) / floors;
      for (let c = 0; c < Math.max(3, Math.round(w / 6)); c++) {
        const cols = Math.max(3, Math.round(w / 6));
        const x = -w / 2 + ((c + 0.5) * w) / cols;
        box(
          out,
          'window',
          [x - (w / cols) * 0.29, y - 1.5, w * 0.38 + 0.02],
          [x + (w / cols) * 0.29, y + 1.5, w * 0.38 + 0.07],
          glass,
        );
      }
    }
    box(
      out,
      'trim',
      [-w / 2 - 0.5, y1 - 0.7, -w * 0.38 - 0.5],
      [w / 2 + 0.5, y1, w * 0.38 + 0.5],
      color,
    );
    y0 = y1;
  }
}

function hall(out, w, d, h, color = C.stone, cx = 0) {
  box(out, 'wall', [cx - w / 2, 0, -d / 2], [cx + w / 2, h, d / 2], color);
  gable(out, cx - w / 2 - 1, cx + w / 2 + 1, -d / 2 - 1, d / 2 + 1, h, h * 0.25, C.roof);
  for (let x = -w / 2 + 5; x < w / 2; x += 8) {
    box(
      out,
      'window',
      [cx + x - 1.5, h * 0.34, d / 2 + 0.02],
      [cx + x + 1.5, h * 0.73, d / 2 + 0.12],
      C.glass,
    );
  }
}

function wheel(out, radius = 24) {
  const cy = radius + 9;
  for (let i = 0; i < 32; i++) {
    const t0 = (i / 32) * Math.PI * 2;
    const t1 = ((i + 1) / 32) * Math.PI * 2;
    const p = (t, z) => [radius * Math.cos(t), cy + radius * Math.sin(t), z];
    for (const z of [-1.6, 1.6]) tube(out, 'trim', p(t0, z), p(t1, z), 0.42, C.white, 6);
    if (i % 2 === 0) {
      tube(out, 'trim', [0, cy, 0], p(t0, 0), 0.19, C.steel, 5);
      const c = p(t0, 0);
      box(out, 'wall', [c[0] - 1.2, c[1] - 1.7, -2.4], [c[0] + 1.2, c[1] + 0.2, 2.4], C.white);
      box(out, 'window', [c[0] - 1.15, c[1] - 1.4, 2.41], [c[0] + 1.15, c[1] - 0.2, 2.47], C.glass);
    }
  }
  for (const x of [-13, 13]) tube(out, 'foundation', [x, 0, 0], [0, cy, 0], 0.9, C.steel, 8);
}

function stadium(out, canopy = false, retractable = false) {
  const rx = 72,
    rz = 50;
  for (let j = 0; j < 3; j++) {
    const y = 8 + j * 7;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2,
        b = ((i + 1) / 36) * Math.PI * 2;
      const p = (t) => [(rx - j * 5) * Math.cos(t), y, (rz - j * 4) * Math.sin(t)];
      tube(out, 'foundation', p(a), p(b), 2.7, j === 2 ? C.stone : C.concrete, 5);
    }
  }
  box(out, 'roof', [-52, 0, -33], [52, 0.2, 33], C.green);
  if (retractable) {
    for (const side of [-1, 1]) {
      box(out, 'roof', [-62, 25, side < 0 ? -52 : 10], [62, 28, side < 0 ? -10 : 52], C.roof);
      for (let x = -52; x <= 52; x += 18)
        tube(out, 'trim', [x, 26, side * 52], [x, 35, side * 12], 0.65, C.steel);
    }
  } else if (canopy) {
    for (const side of [-1, 1]) {
      box(out, 'roof', [-69, 27, side < 0 ? -58 : 17], [69, 29, side < 0 ? -17 : 58], C.roof);
      for (let x = -60; x <= 60; x += 20)
        tube(out, 'trim', [x, 8, side * 45], [x, 29, side * 43], 0.7, C.steel);
    }
  } else
    profile(
      out,
      [
        [20, 76, 54],
        [27, 68, 47, 'roof', C.roof],
        [35, 40, 30, 'roof', C.roof],
      ],
      36,
    );
}

function observation(out, h, shaft = 4, pod = 17, color = C.concrete) {
  profile(
    out,
    [
      [0, shaft + 3, shaft + 3],
      [h * 0.8, shaft, shaft, 'wall', color],
    ],
    16,
  );
  profile(
    out,
    [
      [h * 0.73, shaft, shaft],
      [h * 0.78, pod * 0.78, pod * 0.78, 'roof', C.white],
      [h * 0.83, pod, pod, 'window', C.glass],
      [h * 0.86, pod * 0.8, pod * 0.8, 'roof', C.white],
      [h * 0.9, shaft, shaft, 'roof', C.white],
    ],
    32,
  );
  spire(out, h, 0.6, color);
}

function lattice(out, h, base = 35, red = false) {
  const color = red ? C.orange : C.steel;
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      tube(out, 'wall', [x * base, 0, z * base], [x * 4, h * 0.8, z * 4], 0.95, color, 6);
      for (let y = 16; y < h * 0.78; y += 20) {
        const t = y / (h * 0.8),
          r = base + (4 - base) * t;
        tube(out, 'trim', [x * r, y, z * r], [-x * r, y + 18, z * r], 0.3, color, 5);
      }
    }
  for (const y of [h * 0.34, h * 0.66, h * 0.81])
    box(
      out,
      'roof',
      [-base * (1 - y / h) - 3, y, -base * (1 - y / h) - 3],
      [base * (1 - y / h) + 3, y + 3, base * (1 - y / h) + 3],
      color,
    );
  tube(out, 'trim', [0, h * 0.81, 0], [0, h, 0], 0.7, color, 8);
}

function clock(out, h, w = 18, longHall = false) {
  if (longHall) hall(out, 100, 27, 18, C.stone);
  box(out, 'wall', [-w / 2, 0, -w / 2], [w / 2, h * 0.82, w / 2], C.stone);
  box(
    out,
    'trim',
    [-w / 2 - 1, h * 0.73, -w / 2 - 1],
    [w / 2 + 1, h * 0.77, w / 2 + 1],
    C.paleStone,
  );
  for (const z of [-w / 2 - 0.12, w / 2 + 0.12]) {
    profile(
      out,
      [
        [h * 0.67, 4.3, 0.2],
        [h * 0.74, 4.3, 0.2, 'window', C.white],
      ],
      16,
      [0, z],
    );
    tube(out, 'trim', [0, h * 0.71, z + 0.18], [2.4, h * 0.71, z + 0.18], 0.25, C.dark, 5);
  }
  profile(
    out,
    [
      [h * 0.82, w * 0.53, w * 0.53],
      [h * 0.96, 0.7, 0.7, 'roof', C.roof],
    ],
    8,
  );
  spire(out, h, 0.4);
}

function rotunda(out) {
  profile(
    out,
    [
      [0, 24, 24],
      [9, 24, 24, 'foundation', C.paleStone],
      [12, 20, 20, 'roof', C.paleStone],
    ],
    32,
  );
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    tube(
      out,
      'wall',
      [17 * Math.cos(t), 12, 17 * Math.sin(t)],
      [17 * Math.cos(t), 31, 17 * Math.sin(t)],
      0.85,
      C.paleStone,
      8,
    );
  }
  profile(
    out,
    [
      [31, 21, 21],
      [34, 21, 21, 'roof', C.paleStone],
      [43, 13, 13, 'roof', C.copper],
      [49, 0.4, 0.4, 'roof', C.copper],
    ],
    32,
  );
}

export function buildLandmark(out, code, spec) {
  const id = n(code),
    h = spec.size[1];
  if (code[0] === 'A') {
    switch (id) {
      case 2:
        stackedTower(out, h * 0.86, [32, 28, 22, 16], C.stone);
        profile(
          out,
          [
            [h * 0.86, 12, 12],
            [h, 0.4, 0.4, 'roof', C.copper],
          ],
          8,
        );
        break;
      case 3:
        stackedTower(out, h, [55, 48, 40], C.dark, C.blueGlass);
        break;
      case 4: {
        const footprint = [
          [-48, -29],
          [33, -33],
          [53, 0],
          [28, 34],
          [-43, 27],
        ];
        prism(out, 'window', footprint, 0, h * 0.82, C.blueGlass);
        tube(out, 'trim', [-48, 0, -29], [28, h * 0.82, 34], 0.7, C.steel);
        for (let i = 0; i < 12; i++) {
          const x = -42 + i * 7;
          tube(out, 'trim', [x, 1, 28], [x + 10, h * 0.82, 28], 0.35, C.steel, 5);
        }
        box(out, 'roof', [-36, h * 0.82, -25], [37, h * 0.86, 26], C.steel);
        break;
      }
      case 5:
        for (const [x, r, color] of [
          [-30, 18, C.gold],
          [0, 24, C.orange],
          [30, 16, C.steel],
        ])
          profile(
            out,
            [
              [0, r, r * 0.7],
              [r * 0.8, r * 1.08, r * 0.8, 'wall', color],
              [r * 1.35, r * 0.6, r * 0.5, 'roof', color],
            ],
            24,
            [x, 0],
          );
        break;
      case 6:
        for (let i = 0; i < 3; i++) {
          const x = i * 35 - 35;
          hall(out, 33, 24, 12 + i * 2, C.brick, x);
          box(out, 'roof', [x - 15, 18 + i * 2, -12], [x + 15, 20 + i * 2, 12], C.roof);
        }
        break;
      case 7:
        stadium(out);
        break;
      case 8:
        tMobilePark(out);
        break;
      case 9:
        lumenField(out);
        break;
      case 10:
        for (const x of [-32, -11, 11, 32]) {
          arch(out, x, 7, 9, 26, -8, 16, 0.7, C.white);
          tube(out, 'wall', [x - 9, 0, -8], [x - 9, 7, -8], 0.9, C.white);
          tube(out, 'wall', [x + 9, 0, -8], [x + 9, 7, -8], 0.9, C.white);
        }
        break;
      case 11:
        wheel(out);
        break;
      case 12:
        hall(out, 72, 31, 22, C.stone);
        for (const x of [-31, 31]) {
          box(out, 'wall', [x - 5, 0, -15], [x + 5, 35, 15], C.stone);
          profile(
            out,
            [
              [35, 5, 5],
              [47, 0.4, 0.4, 'roof', C.roof],
            ],
            8,
            [x, 0],
          );
        }
        break;
      case 13:
        stadium(out);
        for (let i = 0; i < 16; i++) {
          const t = (i * Math.PI) / 8;
          tube(out, 'trim', [69 * Math.cos(t), 27, 47 * Math.sin(t)], [0, 41, 0], 0.28, C.steel, 4);
        }
        break;
      case 14:
        box(out, 'wall', [-27, 0, -26], [27, 25, 26], C.stone);
        observation(out, h, 5, 19);
        break;
      case 15:
        clock(out, h, 16, true);
        break;
      case 16:
        profile(
          out,
          [
            [0, 32, 28],
            [h * 0.96, 1.2, 1.2, 'window', C.blueGlass],
            [h, 0.2, 0.2, 'trim', C.steel],
          ],
          4,
        );
        for (const x of [-25, 25]) box(out, 'wall', [x - 10, 0, -24], [x + 10, 40, 24], C.stone);
        for (let i = 0; i < 10; i++)
          tube(out, 'trim', [-26 + i * 5, 0, 28 - i * 2], [0, h * 0.96, 0], 0.3, C.steel, 5);
        break;
      case 17:
        profile(
          out,
          [
            [0, 32, 25],
            [h * 0.92, 23, 20, 'window', C.blueGlass],
            [h, 8, 8, 'roof', C.steel],
          ],
          20,
        );
        for (const y of [h * 0.25, h * 0.5, h * 0.75])
          for (let i = 0; i < 20; i++) {
            const t = (i * Math.PI) / 10,
              u = ((i + 1) * Math.PI) / 10;
            tube(
              out,
              'trim',
              [30 * Math.cos(t), y, 23 * Math.sin(t)],
              [30 * Math.cos(u), y, 23 * Math.sin(u)],
              0.22,
              C.steel,
              4,
            );
          }
        break;
      case 18:
        profile(
          out,
          [
            [0, 11, 11],
            [h * 0.88, 9, 9, 'wall', C.paleStone],
            [h, 11, 11, 'roof', C.stone],
          ],
          20,
        );
        for (let i = 0; i < 12; i++) {
          const t = (i * Math.PI) / 6;
          tube(
            out,
            'trim',
            [10 * Math.cos(t), 3, 10 * Math.sin(t)],
            [9 * Math.cos(t), h * 0.88, 9 * Math.sin(t)],
            0.38,
            C.paleStone,
            5,
          );
        }
        break;
      case 19:
        rotunda(out);
        break;
      case 20:
        clock(out, h, 20);
        break;
      default:
        throw new Error(`Missing Pacific landmark ${code}`);
    }
    return;
  }
  switch (id) {
    case 1:
      stackedTower(out, h * 0.94, [52, 48, 41, 32, 23, 15], C.stone);
      spire(out, h, 1.8);
      break;
    case 2:
      stackedTower(out, h * 0.88, [45, 40, 32, 25], C.steel, C.blueGlass);
      for (let i = 0; i < 4; i++)
        arch(out, 0, h * (0.75 + i * 0.035), 11 - i * 2, 9, 17 + i, 0, 0.7, C.steel);
      spire(out, h);
      break;
    case 3:
      profile(
        out,
        [
          [0, 33, 33],
          [h * 0.82, 17, 17, 'window', C.blueGlass],
          [h * 0.96, 9, 9, 'roof', C.steel],
        ],
        8,
      );
      for (let i = 0; i < 8; i++) {
        const t = (i * Math.PI) / 4;
        tube(
          out,
          'trim',
          [31 * Math.cos(t), 0, 31 * Math.sin(t)],
          [17 * Math.cos(t), h * 0.82, 17 * Math.sin(t)],
          0.45,
          C.steel,
          5,
        );
      }
      box(out, 'foundation', [-40, 0, -40], [40, 12, 40], C.stone);
      spire(out, h);
      break;
    case 4:
      prism(
        out,
        'wall',
        [
          [-32, -17],
          [31, -17],
          [1, 20],
        ],
        0,
        h * 0.9,
        C.stone,
      );
      for (let y = 8; y < h * 0.9; y += 8)
        tube(out, 'trim', [-29, y, -17], [28, y, -17], 0.4, C.paleStone);
      box(out, 'trim', [-33, h * 0.9, -19], [32, h, 22], C.stone);
      break;
    case 5:
      hall(out, 135, 30, 24, C.paleStone);
      profile(
        out,
        [
          [24, 23, 23],
          [34, 23, 23, 'wall', C.paleStone],
          [h * 0.94, 3, 3, 'roof', C.white],
        ],
        28,
      );
      spire(out, h, 0.6);
      break;
    case 6:
      profile(
        out,
        [
          [0, 10, 10],
          [h * 0.94, 5, 5, 'wall', C.paleStone],
          [h, 0.2, 0.2, 'roof', C.paleStone],
        ],
        4,
      );
      box(out, 'foundation', [-14, 0, -14], [14, 3, 14], C.stone);
      for (const y of [h * 0.12, h * 0.35, h * 0.58, h * 0.81])
        box(
          out,
          'trim',
          [-9 + (y / h) * 4, y, -9 + (y / h) * 4],
          [9 - (y / h) * 4, y + 0.5, 9 - (y / h) * 4],
          C.white,
        );
      break;
    case 7:
      observation(out, h, 5, 22);
      break;
    case 8:
      lattice(out, h, 58);
      break;
    case 9:
      for (const x of [-20, 20])
        box(out, 'wall', [x - 12, 0, -8], [x + 12, h * 0.8, 8], C.paleStone);
      box(out, 'wall', [-33, h * 0.7, -8], [33, h, 8], C.paleStone);
      arch(out, 0, 8, 11, 19, 8, 0, 0.8, C.stone);
      break;
    case 10:
      clock(out, h, 18);
      break;
    case 11:
      for (const [x, z, w] of [
        [0, 0, 34],
        [-40, 0, 22],
        [40, 0, 22],
        [0, -32, 24],
      ]) {
        box(out, 'wall', [x - w / 2, 0, z - w / 2], [x + w / 2, 25, z + w / 2], C.stone);
        for (const dx of [-1, 1])
          for (const dz of [-1, 1])
            box(
              out,
              'trim',
              [x + (dx * w) / 2 - 2, 25, z + (dz * w) / 2 - 2],
              [x + (dx * w) / 2 + 2, 30, z + (dz * w) / 2 + 2],
              C.paleStone,
            );
      }
      break;
    case 12:
      for (let ring = 0; ring < 3; ring++) {
        const y = ring * 15;
        for (let i = 0; i < 32; i++) {
          const t = (i * Math.PI) / 16;
          const x = 55 * Math.cos(t),
            z = 40 * Math.sin(t);
          tube(out, 'wall', [x, y, z], [x, y + 12, z], 1.6, C.stone, 6);
        }
        profile(
          out,
          [
            [y, 58, 43],
            [y + 2, 58, 43, 'trim', C.stone],
          ],
          32,
        );
      }
      break;
    case 13:
      hall(out, 80, 36, 24, C.stone);
      for (const x of [-30, -16, 0, 16, 30]) {
        profile(
          out,
          [
            [20, 5, 5],
            [h * (x === 0 ? 1 : 0.78), 0.5, 0.5, 'wall', C.paleStone],
          ],
          8,
          [x, 0],
        );
      }
      break;
    case 14: {
      box(out, 'foundation', [-70, 0, -45], [70, 8, 45], C.stone);
      for (const [cx, w, peak] of [
        [-40, 38, 39],
        [0, 48, 52],
        [42, 36, 42],
      ]) {
        const p = (u, v) => [
          cx + w * (u - 0.5),
          8 + peak * Math.sin(Math.PI * u) * (1 - 0.28 * v),
          -33 + v * 66,
        ];
        for (let i = 0; i < 10; i++)
          for (let j = 0; j < 5; j++)
            quad(
              out,
              'roof',
              [
                p(i / 10, j / 5),
                p(i / 10, (j + 1) / 5),
                p((i + 1) / 10, (j + 1) / 5),
                p((i + 1) / 10, j / 5),
              ],
              [0, 1, 0],
              C.white,
            );
        for (let i = 0; i < 10; i++)
          tube(out, 'trim', p(i / 10, 0), p((i + 1) / 10, 0), 0.35, C.steel, 5);
      }
      break;
    }
    case 15:
      lattice(out, h, 35, true);
      break;
    case 16:
      observation(out, h, 7, 24, C.white);
      break;
    case 17:
      stackedTower(out, h, [51, 47, 43, 39, 35, 31, 27, 22], C.blueGlass, C.glass);
      break;
    case 18:
      for (const x of [-32, 32]) {
        profile(
          out,
          [
            [0, 22, 22],
            [h * 0.85, 13, 13, 'window', C.blueGlass],
            [h * 0.96, 6, 6, 'roof', C.steel],
          ],
          12,
          [x, 0],
        );
        spire(out, h, 0.8, C.steel, [x, 0]);
      }
      box(out, 'trim', [-32, h * 0.46, -5], [32, h * 0.48, 5], C.steel);
      break;
    case 19:
      for (let i = 0; i < 10; i++) {
        const y0 = (i * h) / 10,
          y1 = ((i + 1) * h) / 10,
          r = 35 - i * 2.6,
          a = i * 0.13;
        prism(
          out,
          'window',
          Array.from({ length: 8 }, (_, j) => [
            r * Math.cos((j * Math.PI) / 4 + a),
            r * Math.sin((j * Math.PI) / 4 + a),
          ]),
          y0,
          y1,
          C.blueGlass,
        );
      }
      break;
    case 20:
      stackedTower(out, h * 0.92, [76, 66, 55, 45, 36, 29, 22, 16, 10], C.steel, C.blueGlass);
      spire(out, h, 1);
      break;
    default:
      throw new Error(`Missing global landmark ${code}`);
  }
}
