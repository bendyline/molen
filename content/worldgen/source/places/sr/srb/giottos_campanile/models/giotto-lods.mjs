/** Source-local component derivatives; the detailed master recipe remains unchanged. */
import {
  beam as extrudedBeam,
  loft,
  radialRing,
  sphere as roundSphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  cornice,
  dark,
  face,
  finial,
  column as profiledColumn,
  tau,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box as solidBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const box = solidBox;

export function giottoSkyline(out) {
  const marble = [0.92, 0.91, 0.84],
    green = [0.14, 0.27, 0.23],
    pink = [0.63, 0.4, 0.36];
  box(out, 'limestone', [-7.4, 0, -7.4], [7.4, 0.7, 7.4], marble);
  box(out, 'limestone', [-6, 0.7, -6], [6, 35.5, 6], marble);
  for (const x of [-5.94, 5.94])
    for (const z of [-5.94, 5.94])
      loft(
        out,
        'limestone',
        [
          radialRing(0.7, 1.46, 1.46, 8, [x, z], Math.PI / 8),
          radialRing(82, 1.46, 1.46, 8, [x, z], Math.PI / 8),
        ],
        marble,
      );
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    const panel = (x0, y0, x1, y1, z, color) =>
      face(
        wall,
        'limestone',
        [
          [x0, y0, z],
          [x1, y0, z],
          [x1, y1, z],
          [x0, y1, z],
        ],
        color,
      );
    if (side === 2) {
      panel(-6.48, 0.7, -0.925, 35.5, 6.48, marble);
      panel(0.925, 0.7, 6.48, 35.5, 6.48, marble);
      panel(-0.925, 4.37, 0.925, 35.5, 6.48, marble);
      face(
        wall,
        'shadow',
        [
          [-0.925, 0.7, 6.18],
          [0.925, 0.7, 6.18],
          [0.925, 4.37, 6.18],
          [-0.925, 4.37, 6.18],
        ],
        dark,
      );
    } else panel(-6.48, 0.7, 6.48, 35.5, 6.48, marble);
    for (const y of [4.8, 13.4, 25.4, 35.4]) {
      panel(-6.5, y, 6.5, y + 0.45, 6.66, green);
      panel(-6.5, y + 0.45, 6.5, y + 0.7, 6.67, pink);
    }
    for (const [y0, y1, count] of [
      [36.4, 52.2, 2],
      [53.2, 67, 2],
      [68.2, 81.1, 1],
    ]) {
      const centers = count === 2 ? [-2.75, 2.75] : [0],
        w = count === 2 ? 3.65 : 7.25,
        spring = y1 - 5.05,
        rise = count === 2 ? 2.7 : 3.15;
      let edge = -6.48;
      for (const x of centers) {
        panel(edge, y0, x - w / 2, y1, 6.48, marble);
        panel(x - w / 2, y0, x + w / 2, y0 + 1.1, 6.48, marble);
        for (let i = 0; i < 4; i++) {
          const a = -w / 2 + (w * i) / 4,
            b = -w / 2 + (w * (i + 1)) / 4,
            arch = (v) =>
              spring +
              (rise * Math.sqrt(Math.max(0, 4 - Math.pow(Math.abs(v) / (w / 2) + 1, 2)))) /
                Math.sqrt(3);
          face(
            wall,
            'limestone',
            [
              [x + a, arch(a), 6.48],
              [x + b, arch(b), 6.48],
              [x + b, y1, 6.48],
              [x + a, y1, 6.48],
            ],
            marble,
          );
        }
        for (const mx of count === 2 ? [0] : [-1.22, 1.22])
          panel(x + mx - 0.13, y0 + 1.1, x + mx + 0.13, spring + 0.35, 6.33, marble);
        edge = x + w / 2;
      }
      panel(edge, y0, 6.48, y1, 6.48, marble);
    }
    box(wall, 'limestone', [-8, 83.25, 7.62], [8, 84.7, 8.15], marble);
  }
  for (const [y0, y1] of [
    [36.4, 52.2],
    [53.2, 67],
    [68.2, 81.1],
  ]) {
    box(out, 'shadow', [-4.8, y0, -4.8], [4.8, y1, 4.8], [0.07, 0.075, 0.065]);
    box(out, 'limestone', [-7.32, y1, -7.32], [7.32, y1 + 0.68, 7.32], marble);
  }
  box(out, 'limestone', [-7.8, 82.9, -7.8], [7.8, 83.25, 7.8], marble);
  const square = (y, r) => [
    [-r, y, -r],
    [-r, y, r],
    [r, y, r],
    [r, y, -r],
  ];
  loft(out, 'limestone', [square(82, 7.3), square(82.9, 7.8)], marble);
}

export function giottoDistrict(out) {
  giottoSkyline(out);
  const marble = [0.92, 0.91, 0.84],
    green = [0.14, 0.27, 0.23],
    pink = [0.63, 0.4, 0.36];
  const panel = (wall, x, y, w, h, z, color) =>
    face(
      wall,
      'limestone',
      [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ],
      color,
    );
  const field = (wall, x, y, w, h, z, color, trim, b) => {
    panel(wall, x, y, w, h, z, color);
    panel(wall, x, y - b, w + 2 * b, b, z + 0.01, trim);
    panel(wall, x, y + h, w + 2 * b, b, z + 0.01, trim);
    panel(wall, x - w / 2 - b / 2, y, b, h, z + 0.01, trim);
    panel(wall, x + w / 2 + b / 2, y, b, h, z + 0.01, trim);
  };
  const polygon = (wall, x, y, r, n, angle, z, color) =>
    wall.addConvexPolygon(
      'limestone',
      'palette:#ffffff',
      Array.from({ length: n }, (_, i) => [
        x + Math.cos(angle + (i * tau) / n) * r,
        y + Math.sin(angle + (i * tau) / n) * r,
        z,
      ]),
      [0, 0, 1],
      (p) => [p[0], p[1]],
      color,
    );
  const stroke = (wall, a, b, width, z, color) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      d = Math.hypot(dx, dy),
      x = (-dy * width) / (2 * d),
      y = (dx * width) / (2 * d);
    face(
      wall,
      'limestone',
      [
        [a[0] - x, a[1] - y, z],
        [b[0] - x, b[1] - y, z],
        [b[0] + x, b[1] + y, z],
        [a[0] + x, a[1] + y, z],
      ],
      color,
    );
  };
  for (const x of [-5.94, 5.94])
    for (const z of [-5.94, 5.94])
      for (let side = 0; side < 4; side++) {
        const wall = transform(out, (side * Math.PI) / 2, [x, 0, z]);
        for (let j = 0; j < 5; j++) field(wall, 0, 3 + j * 17, 0.8, 10, 1.4, pink, green, 0.1);
      }
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 1.52;
      field(wall, x, 6, 1.2, 5.5, 6.56, pink, green, 0.15);
      polygon(wall, x, 8.8, 0.67, 4, 0, 6.67, marble);
      if (!(side === 2 && (i === 2 || i === 3)))
        polygon(wall, x, 3.5, 0.6, 6, Math.PI / 6, 6.67, pink);
    }
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 2.55;
      field(wall, x, 16.7, 1.66, 8.1, 6.57, green, marble, 0.13);
      for (let j = 0; j < 4; j++) {
        const a = -0.65 + (1.3 * j) / 4,
          b = -0.65 + (1.3 * (j + 1)) / 4,
          yy = (v) =>
            22.3 +
            (1.75 * Math.sqrt(Math.max(0, 4 - Math.pow(Math.abs(v) / 0.65 + 1, 2)))) / Math.sqrt(3);
        face(
          wall,
          'limestone',
          [
            [x + a, yy(a), 6.66],
            [x + b, yy(b), 6.66],
            [x + b, 24.4, 6.66],
            [x + a, 24.4, 6.66],
          ],
          marble,
        );
      }
      polygon(wall, x, 19.1, 0.34, 4, Math.PI / 4, 6.72, marble);
      polygon(wall, x, 21.05, 0.24, 8, 0, 6.72, marble);
      field(wall, x, 27.4, 1.4, 5.6, 6.57, pink, green, 0.16);
    }
    for (const [y0, y1, count] of [
      [36.4, 52.2, 2],
      [53.2, 67, 2],
      [68.2, 81.1, 1],
    ])
      for (const x of count === 2 ? [-2.75, 2.75] : [0]) {
        const w = count === 2 ? 3.65 : 7.25,
          spring = y1 - 5.05,
          rise = count === 2 ? 2.7 : 3.15;
        for (let ring = 0; ring < 2; ring++) {
          const r = w / 2 + 0.1 + ring * 0.14,
            h = rise + 0.1 + ring * 0.14;
          for (let j = 0; j < 6; j++) {
            const a = -r + (2 * r * j) / 6,
              b = -r + (2 * r * (j + 1)) / 6,
              yy = (v) =>
                spring +
                (h * Math.sqrt(Math.max(0, 4 - Math.pow(Math.abs(v) / r + 1, 2)))) / Math.sqrt(3);
            stroke(wall, [x + a, yy(a)], [x + b, yy(b)], 0.145, 6.74, ring % 2 ? marble : green);
          }
        }
        for (const s of [-1, 1]) {
          panel(wall, x + (s * w) / 2, y0 + 0.65, 0.44, spring - y0 - 0.65, 6.69, green);
          stroke(wall, [x + s * (w / 2 + 0.48), y1 - 2.55], [x, y1 - 0.45], 0.25, 6.76, green);
          stroke(wall, [x + s * (w / 2 + 0.48), y1 - 2.35], [x, y1 - 0.25], 0.18, 6.79, marble);
        }
      }
  }
}

function builder(cfg) {
  cfg = { flatPanels: true, ...cfg };
  const box = (out, slot, a, b, color) => {
    if (cfg.flatPanels && b[2] - a[2] <= 0.06)
      return face(
        out,
        slot,
        [
          [a[0], a[1], b[2]],
          [b[0], a[1], b[2]],
          [b[0], b[1], b[2]],
          [a[0], b[1], b[2]],
        ],
        color,
      );
    return solidBox(out, slot, a, b, color);
  };
  const beam = (out, slot, a, b, width, depth, color) => {
    if (cfg.flatBands && a[2] === b[2] && a[2] >= 6.3) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy),
        x = (-dy * width) / (2 * length),
        y = (dx * width) / (2 * length),
        z = a[2] + depth / 2;
      return face(
        out,
        slot,
        [
          [a[0] - x, a[1] - y, z],
          [b[0] - x, b[1] - y, z],
          [b[0] + x, b[1] + y, z],
          [a[0] + x, a[1] + y, z],
        ],
        color,
      );
    }
    return extrudedBeam(out, slot, a, b, width, depth, color);
  };
  const sphere = (out, slot, c, r, color, sides, rows) =>
    roundSphere(
      out,
      slot,
      c,
      r,
      color,
      Math.min(sides, cfg.sphereSides),
      Math.min(rows, cfg.sphereRows),
    );
  const column = (out, slot, x, z, y0, y1, r, color) => {
    if (cfg.profiled) return profiledColumn(out, slot, x, z, y0, y1, r, color, cfg.columnSides);
    loft(
      out,
      slot,
      [
        radialRing(y0, r, r, cfg.columnSides, [x, z]),
        radialRing(y1, r * 0.85, r * 0.85, cfg.columnSides, [x, z]),
      ],
      color,
    );
  };
  function frame(out, slot, x, y, w, h, z, border, color) {
    for (const [x0, y0, x1, y1] of [
      [x - w / 2 - border, y - border, x + w / 2 + border, y],
      [x - w / 2 - border, y + h, x + w / 2 + border, y + h + border],
      [x - w / 2 - border, y, x - w / 2, y + h],
      [x + w / 2, y, x + w / 2 + border, y + h],
    ])
      face(
        out,
        slot,
        [
          [x0, y0, z + 0.05],
          [x1, y0, z + 0.05],
          [x1, y1, z + 0.05],
          [x0, y1, z + 0.05],
        ],
        color,
      );
  }
  function archBay(
    out,
    slot,
    x,
    width,
    y0,
    spring,
    rise,
    top,
    z,
    depth,
    color,
    { pointed = false, back = true } = {},
  ) {
    const r = width / 2;
    if (back)
      face(
        out,
        'shadow',
        [
          [x - r, y0, z - depth],
          [x + r, y0, z - depth],
          [x + r, spring + rise, z - depth],
          [x - r, spring + rise, z - depth],
        ],
        dark,
      );
    const arch = (v) =>
      spring +
      rise *
        (pointed
          ? Math.sqrt(Math.max(0, 4 - Math.pow(Math.abs(v) / r + 1, 2))) / Math.sqrt(3)
          : Math.sqrt(Math.max(0, 1 - (v * v) / (r * r))));
    for (let i = 0; i < cfg.arch; i++) {
      const a = -r + (width * i) / cfg.arch,
        b = -r + (width * (i + 1)) / cfg.arch,
        ya = arch(a),
        yb = arch(b);
      if (top > Math.max(ya, yb))
        face(
          out,
          slot,
          [
            [x + a, ya, z],
            [x + b, yb, z],
            [x + b, top, z],
            [x + a, top, z],
          ],
          color,
        );
      face(
        out,
        slot,
        [
          [x + a, ya, z - depth],
          [x + b, yb, z - depth],
          [x + b, yb, z],
          [x + a, ya, z],
        ],
        color,
      );
    }
    if (spring > y0) {
      face(
        out,
        slot,
        [
          [x - r, y0, z],
          [x - r, y0, z - depth],
          [x - r, spring, z - depth],
          [x - r, spring, z],
        ],
        color,
      );
      face(
        out,
        slot,
        [
          [x + r, y0, z - depth],
          [x + r, y0, z],
          [x + r, spring, z],
          [x + r, spring, z - depth],
        ],
        color,
      );
    }
    face(
      out,
      slot,
      [
        [x - r, y0, z],
        [x + r, y0, z],
        [x + r, y0, z - depth],
        [x - r, y0, z - depth],
      ],
      color,
    );
  }
  function facade(out, slot, width, y0, y1, z, windows, color) {
    const xs = [
        ...new Set([
          -width / 2,
          width / 2,
          ...windows.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2]),
        ]),
      ].sort((a, b) => a - b),
      ys = [...new Set([y0, y1, ...windows.flatMap((w) => [w.y, w.top])])].sort((a, b) => a - b);
    for (let j = 1; j < ys.length; j++)
      for (let i = 1; i < xs.length; i++) {
        const x = (xs[i - 1] + xs[i]) / 2,
          y = (ys[j - 1] + ys[j]) / 2;
        if (windows.some((w) => x > w.x - w.w / 2 && x < w.x + w.w / 2 && y > w.y && y < w.top))
          continue;
        face(
          out,
          slot,
          [
            [xs[i - 1], ys[j - 1], z],
            [xs[i], ys[j - 1], z],
            [xs[i], ys[j], z],
            [xs[i - 1], ys[j], z],
          ],
          color,
        );
      }
    for (const w of windows)
      archBay(out, slot, w.x, w.w, w.y, w.spring, w.rise, w.top, z, w.depth ?? 0.45, color, w);
  }
  function buildGiotto(out) {
    const green = [0.14, 0.27, 0.23],
      pink = [0.63, 0.4, 0.36],
      marble = [0.92, 0.91, 0.84];
    const r = 6.48;
    box(out, 'limestone', [-7.4, 0, -7.4], [7.4, 0.7, 7.4], marble);
    box(out, 'limestone', [-6, 0.7, -6], [6, 35.5, 6], marble);
    for (const x of [-5.94, 5.94])
      for (const z of [-5.94, 5.94]) {
        loft(
          out,
          'limestone',
          [
            radialRing(0.7, 1.46, 1.46, 8, [x, z], Math.PI / 8),
            radialRing(82, 1.46, 1.46, 8, [x, z], Math.PI / 8),
          ],
          marble,
        );
        for (let j = 0; j < cfg.cornerRows; j++) {
          const y = 3 + (j * 72.1) / Math.max(1, cfg.cornerRows - 1),
            h = cfg.cornerRows === 15 ? 3.3 : 6.2;
          for (let side = 0; side < 4; side++) {
            const wall = transform(out, (side * Math.PI) / 2, [x, 0, z]);
            box(wall, 'limestone', [-0.38, y, 1.354], [0.38, y + h, 1.378], pink);
            frame(wall, 'limestone', 0, y, 0.8, h, 1.4, 0.1, green);
          }
        }
      }
    const ornament = (wall, x, y, radius, sides, rotation, color) => {
      const p = (i, r, z) => {
        const a = rotation + (i * tau) / sides;
        return [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
      };
      const points = Array.from({ length: sides }, (_, i) => p(i, radius, 6.58));
      wall.addConvexPolygon(
        'limestone',
        'palette:#ffffff',
        points,
        [0, 0, 1],
        (p) => [p[0], p[1]],
        color,
      );
      if (cfg.borders)
        for (let i = 0; i < sides; i++)
          face(
            wall,
            'limestone',
            [
              p(i, radius + 0.07, 6.63),
              p(i + 1, radius + 0.07, 6.63),
              p(i + 1, radius - 0.07, 6.63),
              p(i, radius - 0.07, 6.63),
            ],
            marble,
          );
      if (cfg.flowers)
        for (let i = 0; i < 8; i++) {
          const a = (i * tau) / 8,
            c = [x + Math.cos(a) * radius * 0.44, y + Math.sin(a) * radius * 0.44];
          const points = [
            [c[0], c[1] + radius * 0.17, 6.72],
            [c[0] - radius * 0.11, c[1], 6.72],
            [c[0], c[1] - radius * 0.17, 6.72],
            [c[0] + radius * 0.11, c[1], 6.72],
          ];
          face(wall, 'limestone', points, marble);
        }
    };

    for (let side = 0; side < 4; side++) {
      const wall = transform(out, (side * Math.PI) / 2);
      const door =
        side === 2
          ? [
              {
                x: 0,
                w: 1.85,
                y: 0.7,
                spring: 3.25,
                rise: 1.12,
                top: 4.6,
                depth: 0.3,
                pointed: true,
              },
            ]
          : [];
      facade(wall, 'limestone', 12.96, 0.7, 35.5, r, door, marble);
      // The two lowest narrative cycles retain their actual 26 + 28 panel count and shapes.
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 1.52;
        box(wall, 'limestone', [x - 0.6, 6, 6.495], [x + 0.6, 11.5, 6.52], pink);
        frame(wall, 'limestone', x, 6, 1.2, 5.5, 6.55, 0.15, green);
        ornament(wall, x, 8.8, 0.67, 4, 0, marble);
        if (!(side === 2 && i === 3) && !(side === 2 && i === 2))
          ornament(wall, x, 3.5, 0.6, 6, Math.PI / 6, pink);
      }
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 2.55;
        box(wall, 'limestone', [x - 0.83, 16.7, 6.49], [x + 0.83, 24.8, 6.54], green);
        frame(wall, 'limestone', x, 16.7, 1.66, 8.1, 6.57, 0.13, marble);
        archBay(wall, 'limestone', x, 1.3, 17.3, 22.3, 1.75, 24.4, 6.66, 0.14, marble, {
          pointed: true,
        });
        if (cfg.figures) {
          const robe = transform(wall, 0, [x, 0, 6.68]);
          loft(
            robe,
            'limestone',
            [
              radialRing(17.7, 0.35, 0.22, 12),
              radialRing(19.9, 0.27, 0.2, 12),
              radialRing(20.55, 0.33, 0.18, 12),
            ],
            marble,
          );
          sphere(robe, 'limestone', [0, 21.05, 0], [0.22, 0.31, 0.2], marble, 16, 8);
          beam(robe, 'limestone', [-0.27, 20.25, 0], [-0.15, 19.55, 0.25], 0.18, 0.18, marble);
          beam(robe, 'limestone', [0.27, 20.25, 0], [0.33, 19.15, 0.08], 0.17, 0.17, marble);
        }
        box(wall, 'limestone', [x - 0.7, 27.4, 6.49], [x + 0.7, 33, 6.53], pink);
        frame(wall, 'limestone', x, 27.4, 1.4, 5.6, 6.56, 0.16, green);
      }
      for (const y of [1.4, 4.8, 12.4, 14.1, 15.2, 25.4, 26.3, 34.1]) {
        for (const [a, b] of side === 2 && y === 1.4
          ? [
              [-6.5, -1.02],
              [1.02, 6.5],
            ]
          : [[-6.5, 6.5]]) {
          box(wall, 'limestone', [a, y, 6.48], [b, y + 0.24, 6.65], green);
          box(wall, 'limestone', [a, y + 0.28, 6.49], [b, y + 0.45, 6.64], pink);
        }
      }
    }
    // Pairs of biforas in the lower two open loggias, then the large three-light loggia.
    for (const [y0, y1, count] of [
      [36.4, 52.2, 2],
      [53.2, 67, 2],
      [68.2, 81.1, 1],
    ]) {
      box(out, 'darkstone', [-5.8, y0 - 0.3, -5.8], [5.8, y0, 5.8], [0.31, 0.32, 0.29]);
      // The opaque interior stair/bell envelope provides the deep shadow visible through the
      // exterior openings; otherwise one-sided facade panels incorrectly expose the sky.
      box(out, 'shadow', [-4.8, y0, -4.8], [4.8, y1, 4.8], [0.07, 0.075, 0.065]);
      for (let side = 0; side < 4; side++) {
        const wall = transform(out, (side * Math.PI) / 2);
        const xs = count === 2 ? [-2.75, 2.75] : [0];
        const width = count === 2 ? 3.65 : 7.25;
        const spring = y1 - 5.05,
          rise = count === 2 ? 2.7 : 3.15;
        facade(
          wall,
          'limestone',
          12.96,
          y0,
          y1,
          6.48,
          xs.map((x) => ({
            x,
            w: width,
            y: y0 + 1.1,
            spring,
            rise,
            top: y1 - 0.7,
            depth: 0.65,
            pointed: true,
            back: false,
          })),
          marble,
        );
        for (const x of xs) {
          for (let ring = 0; ring < cfg.bands; ring++) {
            const rr = width / 2 + 0.1 + ring * 0.14,
              hh = rise + 0.1 + ring * 0.14;
            for (let k = 0; k < cfg.bandSamples; k++) {
              const a = -rr + (k * rr * 2) / cfg.bandSamples,
                b = -rr + ((k + 1) * rr * 2) / cfg.bandSamples;
              const yy = (t) =>
                spring +
                (hh * Math.sqrt(Math.max(0, 4 - (Math.abs(t) / rr + 1) ** 2))) / Math.sqrt(3);
              beam(
                wall,
                'limestone',
                [x + a, yy(a), 6.67],
                [x + b, yy(b), 6.67],
                0.145,
                0.13,
                ring % 2 ? green : marble,
              );
            }
          }
          // Polychrome surrounds, pointed gables, crockets and narrow mullion columns.
          for (const s of [-1, 1]) {
            box(
              wall,
              'limestone',
              [x + (s * width) / 2 - 0.22, y0 + 0.65, 6.54],
              [x + (s * width) / 2 + 0.22, spring, 6.68],
              green,
            );
            column(
              wall,
              'limestone',
              x + (s * width) / 2,
              6.72,
              y0 + 0.8,
              spring,
              0.13,
              marble,
              12,
            );
          }
          const mullions = count === 2 ? [0] : [-1.22, 1.22];
          for (const mx of mullions)
            column(wall, 'limestone', x + mx, 6.33, y0 + 1.1, spring + 0.35, 0.13, marble, 16);
          const smallCenters = count === 2 ? [-0.94, 0.94] : [-2.43, 0, 2.43];
          for (const cx of smallCenters) {
            const rr = count === 2 ? 0.83 : 1.06;
            for (let k = 0; k < cfg.innerArch; k++) {
              const a = (k / cfg.innerArch) * Math.PI,
                b = ((k + 1) / cfg.innerArch) * Math.PI;
              beam(
                wall,
                'limestone',
                [x + cx + Math.cos(a) * rr, spring - 0.35 + Math.sin(a) * rr, 6.32],
                [x + cx + Math.cos(b) * rr, spring - 0.35 + Math.sin(b) * rr, 6.32],
                0.14,
                0.18,
                marble,
              );
            }
          }
          const peak = y1 - 0.45,
            base = peak - 2.1;
          for (const s of [-1, 1]) {
            beam(
              wall,
              'limestone',
              [x + s * (width / 2 + 0.48), base, 6.66],
              [x, peak, 6.66],
              0.25,
              0.2,
              green,
            );
            beam(
              wall,
              'limestone',
              [x + s * (width / 2 + 0.48), base + 0.2, 6.75],
              [x, peak + 0.2, 6.75],
              0.18,
              0.18,
              marble,
            );
            for (let k = 1; k <= cfg.crockets; k++) {
              const t = k / (cfg.crockets + 1);
              sphere(
                wall,
                'limestone',
                [x + s * (width / 2 + 0.48) * (1 - t), base + (peak - base) * t + 0.26, 6.78],
                [0.11, 0.16, 0.12],
                marble,
                8,
                6,
              );
            }
          }
          if (cfg.finials) finial(wall, x, peak + 0.22, 6.68, 0.48, marble);
        }
        for (const x of [-5.25, 5.25]) {
          box(wall, 'limestone', [x - 0.42, y0 + 2, 6.52], [x + 0.42, y1 - 2.5, 6.55], pink);
          frame(wall, 'limestone', x, y0 + 2, 0.84, y1 - y0 - 4.5, 6.58, 0.15, green);
        }
        for (let i = 0; i < 11; i++)
          ornament(wall, (i - 5) * 1.08, y0 + 0.2, 0.27, 4, Math.PI / 4, pink);
      }
      cornice(out, 'limestone', 14.1, 14.1, y1, 0.68, marble);
    }
    for (const y of [13.4, 35.4]) cornice(out, 'limestone', 14.3, 14.3, y, 0.9, marble);
    // Deep corbelled horizontal crown, with an open roof terrace and parapet lattice.
    for (let side = 0; side < 4; side++) {
      const wall = transform(out, (side * Math.PI) / 2);
      for (let i = 0; i < cfg.corbelCount; i++) {
        const x = -7 + (i * 14) / (cfg.corbelCount - 1);
        beam(wall, 'limestone', [x, 81.5, 6.6], [x, 82.9, 7.9], 0.28, 0.36, marble);
        box(wall, 'limestone', [x - 0.12, 83.55, 7.8], [x + 0.12, 84.42, 8.04], marble);
      }
      box(wall, 'limestone', [-8, 83.25, 7.58], [8, 83.55, 8.15], marble);
      box(wall, 'limestone', [-8.15, 84.42, 7.62], [8.15, 84.7, 8.15], marble);
      box(wall, 'limestone', [-7.5, 82.95, 7.5], [7.5, 83.2, 7.9], green);
    }
    box(out, 'limestone', [-7.8, 82.9, -7.8], [7.8, 83.25, 7.8], marble);
  }

  return buildGiotto;
}

export const giottoStreet = builder({
  flatBands: true,
  cornerRows: 8,
  arch: 8,
  bands: 2,
  bandSamples: 8,
  innerArch: 6,
  borders: true,
  flowers: false,
  figures: true,
  profiled: false,
  columnSides: 6,
  sphereSides: 8,
  sphereRows: 4,
  crockets: 0,
  finials: true,
  corbelCount: 12,
});

export const giottoCloseup = builder({
  cornerRows: 15,
  arch: 12,
  bands: 4,
  bandSamples: 12,
  innerArch: 10,
  borders: true,
  flowers: true,
  figures: true,
  profiled: true,
  columnSides: 8,
  sphereSides: 12,
  sphereRows: 6,
  crockets: 3,
  finials: true,
  corbelCount: 20,
});
