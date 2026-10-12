/** N0564 complete medium-fi exterior. Original heritage draft remains unchanged. Measured envelopes; local carved and brick ornament is proportional reconstruction. */
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const brick = [0.76, 0.58, 0.37],
  ref = 'palette:#ffffff',
  tau = Math.PI * 2;
function detail(out, mode) {
  function tri(out, slot, points, color) {
    out.addTriangle(
      slot,
      ref,
      points,
      normalFor(...points),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
  function face(out, slot, points, color) {
    quad(out, slot, points, normalFor(...points), color);
  }
  function rotatedBox(out, slot, lo, hi, color, rotation) {
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    const transform = (points) => points.map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]);
    box(
      {
        addQuad(_slot, _ref, points, _normal, _uv, tint) {
          face(out, slot, transform(points), tint);
        },
      },
      slot,
      lo,
      hi,
      color,
    );
  }
  function marker(out, slot, a, b, tint, angle = 0) {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    face(
      out,
      slot,
      [
        [a[0], a[1], b[2]],
        [b[0], a[1], b[2]],
        [b[0], b[1], b[2]],
        [a[0], b[1], b[2]],
      ].map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]),
      tint,
    );
  }
  function corniceProfile(out, sides) {
    const count = mode === 'skyline' ? 2 : 6,
      profile = [[7.23, 36.4]];
    for (let i = 0; i < count; i++) {
      const y = 36.4 + ((i + 1) * 0.57) / count,
        r = 7.35 + ((i + 1) * 0.525) / count;
      profile.push([r, profile.at(-1)[1]], [r, y]);
    }
    // Continuous exterior profile avoids the draft's invisible concentric interior ring surfaces.
    for (let j = 0; j < profile.length - 1; j++)
      for (let i = 0; i < sides; i++) {
        const a = (-i * tau) / sides,
          b = (-(i + 1) * tau) / sides,
          p = (r, y, t) => [r * Math.cos(t), y, r * Math.sin(t)],
          lo = profile[j],
          hi = profile[j + 1];
        face(out, 'brick', [p(...lo, a), p(...lo, b), p(...hi, b), p(...hi, a)], brick);
      }
  }
  function pointedWoodDoor(out) {
    const half = 0.6105,
      bottom = 0.4,
      shoulder = 3.96,
      top = 4.728,
      z = 4.25,
      parts = mode === 'skyline' ? 4 : 12;
    for (let i = 0; i < parts; i++) {
      const x0 = -half + (2 * half * i) / parts,
        x1 = -half + (2 * half * (i + 1)) / parts,
        h = (x) => shoulder + (top - shoulder) * Math.pow(1 - Math.abs(x) / half, 0.68);
      face(
        out,
        'wood',
        [
          [x0, bottom, z],
          [x1, bottom, z],
          [x1, h(x1), z],
          [x0, h(x0), z],
        ],
        [0.35, 0.22, 0.12],
      );
    }
    if (mode === 'skyline') return;
    box(out, 'wood', [-0.016, 0.4, z + 0.002], [0.016, 3.96, z + 0.045], [0.22, 0.14, 0.08]);
    for (const x of [-0.57, 0.03])
      for (const y of [0.63, 1.74, 2.84]) {
        box(out, 'wood', [x, y, z + 0.004], [x + 0.54, y + 0.065, z + 0.05], [0.44, 0.28, 0.16]);
        box(out, 'wood', [x, y, z + 0.004], [x + 0.06, y + 0.9, z + 0.05], [0.44, 0.28, 0.16]);
        box(
          out,
          'wood',
          [x + 0.48, y, z + 0.004],
          [x + 0.54, y + 0.9, z + 0.05],
          [0.44, 0.28, 0.16],
        );
        box(
          out,
          'wood',
          [x, y + 0.835, z + 0.004],
          [x + 0.54, y + 0.9, z + 0.05],
          [0.44, 0.28, 0.16],
        );
      }
    for (let i = 0; i < 12; i++) {
      const x0 = -half + (2 * half * i) / 12,
        x1 = -half + (2 * half * (i + 1)) / 12,
        h = (x) => shoulder + (top - shoulder) * Math.pow(1 - Math.abs(x) / half, 0.68);
      face(
        out,
        'wood',
        [
          [x0, h(x0), z + 0.005],
          [x1, h(x1), z + 0.005],
          [x1, h(x1) + 0.06, z + 0.015],
          [x0, h(x0) + 0.06, z + 0.015],
        ],
        [0.46, 0.31, 0.18],
      );
    }
  }
  function entranceNiches(out) {
    // Figure77/78: three deep espar/cell indications at the inner pointed arch.
    // These are closed local recesses, not three passages or a fabricated restored entrance.
    if (mode === 'skyline') return;
    const cells = [
      [-0.61, 4.33, 0.25, 0.55, 4.7],
      [0.61, 4.33, 0.25, 0.55, 4.7],
      [0, 4.75, 0.35, 0.52, 4.7],
    ];
    const inner = (x) =>
      Math.abs(x) >= 0.6105 ? 3.96 : 3.96 + 0.768 * Math.pow(1 - Math.abs(x) / 0.6105, 0.68);
    const outer = (x) => 4.855 + 1.11 * Math.pow(1 - Math.abs(x) / 0.785, 0.65);
    const xs = [
      ...new Set([
        -0.785,
        0.785,
        -0.6105,
        0.6105,
        0,
        ...cells.flatMap(([x, , w]) => [x - w / 2, x + w / 2]),
      ]),
    ].sort((a, b) => a - b);
    const ys = [...new Set([3.96, 5.965, ...cells.flatMap(([, y, , h]) => [y, y + h])])].sort(
      (a, b) => a - b,
    );
    // The niches belong to a continuous brick spandrel above the inner doorway.
    // Omit their rectangles and fill the pointed upper corners below.
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i],
          x1 = xs[i + 1],
          x = (x0 + x1) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (cells.some(([c, b, w, h]) => Math.abs(x - c) < w / 2 && y > b && y < b + h)) continue;
        const b0 = Math.max(ys[j], inner(x0)),
          b1 = Math.max(ys[j], inner(x1)),
          t0 = Math.min(ys[j + 1], outer(x0)),
          t1 = Math.min(ys[j + 1], outer(x1));
        if (t0 <= b0 + 0.00001 && t1 <= b1 + 0.00001) continue;
        const p = [
          [x0, b0, 4.7],
          [x1, b1, 4.7],
          [x1, Math.max(b1, t1), 4.7],
          [x0, Math.max(b0, t0), 4.7],
        ].filter(
          (v, k, a) => !a.slice(0, k).some((q) => Math.hypot(v[0] - q[0], v[1] - q[1]) < 0.00001),
        );
        if (p.length === 3)
          tri(
            out,
            'brick',
            p,
            brick.map((v) => v * 0.94),
          );
        else if (p.length === 4)
          face(
            out,
            'brick',
            p,
            brick.map((v) => v * 0.94),
          );
      }
    for (const [x, y, w, h, z] of cells) {
      const front = [
        [-w / 2, 0],
        [w / 2, 0],
        [w / 2, h * 0.53],
        [0, h],
        [-w / 2, h * 0.53],
      ].map(([u, v]) => [x + u, y + v, z]);
      const back = front.map(([u, v]) => [u, v, z - 0.17]);
      for (const sign of [-1, 1])
        tri(
          out,
          'brick',
          sign < 0
            ? [
                [x - w / 2, y + h * 0.53, z],
                [x, y + h, z],
                [x - w / 2, y + h, z],
              ]
            : [
                [x, y + h, z],
                [x + w / 2, y + h * 0.53, z],
                [x + w / 2, y + h, z],
              ],
          brick.map((v) => v * 0.94),
        );
      face(out, 'shadow', [back[0], back[1], back[2], back[3]], [0.3, 0.22, 0.13]);
      tri(out, 'shadow', [back[0], back[3], back[4]], [0.3, 0.22, 0.13]);
      for (let i = 0; i < 5; i++) {
        const k = (i + 1) % 5;
        face(
          out,
          'brick',
          [front[i], front[k], back[k], back[i]],
          brick.map((v) => v * 0.91),
        );
      }
      if (mode === 'district') continue;
      // Shallow stepped rhomboid/cross setting above the central niche, visible in the measured drawing.
      if (x === 0) {
        for (const [dx, dy] of [
          [-0.12, 0.65],
          [0, 0.77],
          [0.12, 0.65],
          [0, 0.53],
        ])
          box(
            out,
            'brick',
            [dx - 0.075, y + dy, z + 0.015],
            [dx + 0.075, y + dy + 0.06, z + 0.08],
            [0.69, 0.51, 0.31],
          );
      }
    }
    // Radial exterior voussoir strips follow the pointed opening, not a generic square lintel.
    if (mode === 'street' || mode === 'closeup' || mode === 'master')
      for (let i = 0; i < 16; i++) {
        const half = 0.785,
          x0 = -half + (2 * half * i) / 16,
          x1 = -half + (2 * half * (i + 1)) / 16,
          h = (x) => 5.965 - 1.11 + 1.11 * Math.pow(1 - Math.abs(x) / half, 0.65),
          z = (x) => Math.sqrt(7.45 ** 2 - x * x);
        face(
          out,
          'brick',
          [
            [x0, h(x0) + 0.025, z(x0) + 0.013],
            [x1, h(x1) + 0.025, z(x1) + 0.013],
            [x1, h(x1) + 0.24, z(x1) + 0.018],
            [x0, h(x0) + 0.24, z(x0) + 0.018],
          ],
          [0.81, 0.64, 0.43],
        );
      }
  }
  // Original normalized stroke interpretations of the ten distinct relief panels, after nomination figures67–76.
  // Reading order starts at southeast of the east door and runs clockwise. Proportions are averaged;
  // these do not certify a readable epigraphic transcription or exact ancient brick positions.
  const panels = [
    [
      [
        [0.03, 0.12],
        [0.2, 0.12],
        [0.2, 0.8],
      ],
      [
        [0.2, 0.12],
        [0.34, 0.12],
        [0.34, 0.92],
      ],
      [
        [0.34, 0.12],
        [0.5, 0.12],
        [0.5, 0.4],
        [0.58, 0.3],
        [0.61, 0.13],
        [0.78, 0.13],
        [0.78, 0.94],
      ],
      [
        [0.8, 0.13],
        [0.91, 0.13],
        [0.91, 0.92],
      ],
      [
        [0.02, 0.36],
        [0.09, 0.48],
        [0.15, 0.36],
      ],
      [
        [0.4, 0.22],
        [0.47, 0.45],
        [0.52, 0.24],
      ],
      [
        [0.68, 0.2],
        [0.71, 0.38],
        [0.74, 0.2],
      ],
    ],
    [
      [
        [0.03, 0.12],
        [0.13, 0.12],
        [0.13, 0.82],
      ],
      [
        [0.16, 0.13],
        [0.34, 0.13],
        [0.28, 0.46],
        [0.4, 0.46],
        [0.4, 0.89],
      ],
      [
        [0.42, 0.12],
        [0.52, 0.12],
        [0.52, 0.37],
        [0.61, 0.37],
        [0.61, 0.13],
        [0.69, 0.13],
        [0.69, 0.82],
      ],
      [
        [0.72, 0.14],
        [0.81, 0.14],
        [0.84, 0.33],
        [0.92, 0.2],
      ],
      [
        [0.77, 0.38],
        [0.87, 0.48],
        [0.94, 0.28],
      ],
    ],
    [
      [
        [0.02, 0.12],
        [0.1, 0.12],
        [0.1, 0.9],
      ],
      [
        [0.12, 0.12],
        [0.25, 0.12],
        [0.25, 0.85],
      ],
      [
        [0.28, 0.15],
        [0.28, 0.38],
        [0.35, 0.38],
        [0.35, 0.16],
        [0.41, 0.16],
        [0.41, 0.38],
        [0.49, 0.38],
        [0.49, 0.16],
      ],
      [
        [0.52, 0.16],
        [0.52, 0.42],
        [0.6, 0.42],
        [0.6, 0.15],
        [0.67, 0.15],
        [0.67, 0.37],
        [0.73, 0.37],
        [0.73, 0.15],
      ],
      [
        [0.76, 0.17],
        [0.93, 0.8],
      ],
      [
        [0.77, 0.8],
        [0.94, 0.17],
      ],
      [
        [0.94, 0.12],
        [0.98, 0.12],
        [0.98, 0.86],
      ],
    ],
    [
      [
        [0.02, 0.12],
        [0.09, 0.12],
        [0.09, 0.34],
        [0.18, 0.34],
      ],
      [
        [0.22, 0.14],
        [0.39, 0.14],
        [0.24, 0.79],
      ],
      [
        [0.26, 0.15],
        [0.37, 0.73],
      ],
      [
        [0.45, 0.1],
        [0.45, 0.9],
      ],
      [
        [0.45, 0.12],
        [0.55, 0.12],
        [0.55, 0.38],
        [0.64, 0.38],
        [0.64, 0.15],
        [0.7, 0.15],
        [0.7, 0.78],
      ],
      [
        [0.76, 0.14],
        [0.92, 0.77],
      ],
      [
        [0.77, 0.78],
        [0.93, 0.16],
      ],
      [
        [0.94, 0.13],
        [0.98, 0.13],
        [0.98, 0.86],
      ],
    ],
    [
      [
        [0.03, 0.1],
        [0.03, 0.35],
        [0.19, 0.35],
        [0.21, 0.44],
        [0.09, 0.44],
      ],
      [
        [0.26, 0.13],
        [0.31, 0.13],
        [0.31, 0.35],
        [0.37, 0.4],
        [0.4, 0.15],
      ],
      [
        [0.42, 0.14],
        [0.42, 0.43],
        [0.48, 0.43],
        [0.48, 0.15],
      ],
      [
        [0.53, 0.12],
        [0.59, 0.12],
        [0.59, 0.37],
        [0.65, 0.43],
        [0.65, 0.16],
        [0.71, 0.16],
        [0.71, 0.47],
        [0.76, 0.47],
        [0.76, 0.13],
      ],
      [
        [0.79, 0.16],
        [0.87, 0.16],
        [0.87, 0.93],
      ],
      [
        [0.88, 0.18],
        [0.95, 0.18],
        [0.93, 0.33],
        [0.98, 0.37],
      ],
    ],
    [
      [
        [0.04, 0.13],
        [0.14, 0.13],
        [0.14, 0.44],
        [0.19, 0.44],
        [0.19, 0.89],
      ],
      [
        [0.22, 0.14],
        [0.37, 0.14],
        [0.26, 0.36],
        [0.41, 0.23],
      ],
      [
        [0.43, 0.13],
        [0.43, 0.43],
        [0.36, 0.29],
        [0.39, 0.16],
      ],
      [
        [0.53, 0.11],
        [0.58, 0.11],
        [0.58, 0.4],
        [0.66, 0.43],
        [0.66, 0.14],
        [0.74, 0.14],
        [0.74, 0.87],
      ],
      [
        [0.75, 0.13],
        [0.83, 0.13],
        [0.83, 0.45],
        [0.88, 0.45],
        [0.88, 0.15],
      ],
      [
        [0.89, 0.15],
        [0.97, 0.19],
        [0.94, 0.35],
      ],
    ],
    [
      [
        [0.03, 0.12],
        [0.08, 0.12],
        [0.08, 0.5],
      ],
      [
        [0.1, 0.13],
        [0.24, 0.13],
        [0.14, 0.5],
      ],
      [
        [0.14, 0.14],
        [0.24, 0.49],
      ],
      [
        [0.27, 0.12],
        [0.27, 0.43],
        [0.32, 0.43],
        [0.32, 0.13],
        [0.37, 0.13],
        [0.37, 0.46],
        [0.43, 0.46],
        [0.43, 0.16],
      ],
      [
        [0.46, 0.12],
        [0.53, 0.12],
        [0.53, 0.45],
        [0.6, 0.45],
        [0.55, 0.18],
      ],
      [
        [0.61, 0.13],
        [0.66, 0.13],
        [0.66, 0.56],
      ],
      [
        [0.69, 0.12],
        [0.69, 0.4],
        [0.77, 0.4],
        [0.77, 0.14],
        [0.83, 0.14],
        [0.83, 0.43],
        [0.88, 0.43],
        [0.88, 0.12],
      ],
      [
        [0.91, 0.13],
        [0.96, 0.13],
        [0.96, 0.49],
      ],
    ],
    [
      [
        [0.03, 0.13],
        [0.14, 0.13],
        [0.14, 0.5],
      ],
      [
        [0.16, 0.12],
        [0.16, 0.43],
        [0.27, 0.43],
        [0.27, 0.34],
        [0.38, 0.34],
      ],
      [
        [0.4, 0.14],
        [0.49, 0.14],
        [0.49, 0.44],
        [0.44, 0.3],
        [0.44, 0.15],
      ],
      [
        [0.54, 0.12],
        [0.54, 0.9],
      ],
      [
        [0.54, 0.14],
        [0.69, 0.14],
        [0.72, 0.3],
        [0.78, 0.15],
        [0.84, 0.15],
        [0.84, 0.4],
      ],
      [
        [0.87, 0.13],
        [0.94, 0.13],
        [0.94, 0.47],
      ],
      [
        [0.94, 0.13],
        [0.98, 0.3],
      ],
    ],
    [
      [
        [0.03, 0.11],
        [0.09, 0.11],
        [0.09, 0.48],
      ],
      [
        [0.12, 0.14],
        [0.23, 0.14],
        [0.13, 0.49],
      ],
      [
        [0.23, 0.49],
        [0.16, 0.2],
      ],
      [
        [0.26, 0.13],
        [0.26, 0.44],
        [0.34, 0.44],
        [0.34, 0.15],
        [0.4, 0.15],
        [0.4, 0.44],
        [0.47, 0.44],
        [0.47, 0.13],
      ],
      [
        [0.52, 0.12],
        [0.59, 0.12],
        [0.59, 0.39],
        [0.67, 0.39],
        [0.67, 0.14],
      ],
      [
        [0.73, 0.13],
        [0.78, 0.13],
        [0.78, 0.49],
        [0.83, 0.49],
        [0.83, 0.12],
      ],
      [
        [0.87, 0.13],
        [0.94, 0.13],
        [0.94, 0.47],
      ],
      [
        [0.96, 0.12],
        [0.98, 0.28],
      ],
    ],
    [
      [
        [0.03, 0.12],
        [0.03, 0.37],
        [0.16, 0.37],
        [0.16, 0.2],
        [0.24, 0.2],
        [0.24, 0.47],
        [0.29, 0.47],
        [0.29, 0.16],
      ],
      [
        [0.31, 0.15],
        [0.31, 0.45],
        [0.37, 0.45],
        [0.37, 0.15],
      ],
      [
        [0.42, 0.12],
        [0.49, 0.12],
        [0.49, 0.47],
        [0.56, 0.47],
        [0.56, 0.16],
      ],
      [
        [0.61, 0.12],
        [0.66, 0.12],
        [0.66, 0.4],
        [0.73, 0.43],
        [0.73, 0.14],
        [0.8, 0.14],
        [0.8, 0.93],
      ],
      [
        [0.82, 0.12],
        [0.92, 0.12],
        [0.92, 0.49],
      ],
      [
        [0.94, 0.13],
        [0.98, 0.13],
        [0.98, 0.34],
      ],
    ],
  ];
  function inscriptionBands(out) {
    for (let i = 0; i < 10; i++)
      for (const y of [8.1, 34.4]) {
        const angle = (-(i + 1) * tau) / 10,
          z = (8.648 - (8.648 - 7.729) * Math.min(y / 36, 1)) * 0.869 + 0.04;
        if (mode === 'skyline' || mode === 'district') {
          marker(
            out,
            'brick',
            [-0.98, y, z],
            [0.98, y + 0.78, z + 0.035],
            [0.62, 0.45, 0.28],
            angle,
          );
          for (const dy of [0, 0.72])
            marker(
              out,
              'brick',
              [-1.02, y + dy, z],
              [1.02, y + dy + 0.06, z + 0.101],
              brick,
              angle,
            );
        } else {
          rotatedBox(
            out,
            'brick',
            [-0.98, y, z],
            [0.98, y + 0.78, z + 0.035],
            [0.62, 0.45, 0.28],
            angle,
          );
          for (const dy of [0, 0.72])
            rotatedBox(
              out,
              'brick',
              [-1.02, y + dy, z + 0.035],
              [1.02, y + dy + 0.06, z + 0.1],
              brick,
              angle,
            );
        }
        if (mode === 'skyline') continue;
        // Rounded/diagonal letter edges are reduced to the principal historic stroke rhythm.
        for (const path of panels[i])
          for (let j = 0; j < path.length - 1; j++) {
            const [a, b] = [path[j], path[j + 1]].map(([u, v]) => [
              -0.91 + u * 1.82,
              y + 0.07 + v * 0.62,
            ]);
            const dx = b[0] - a[0],
              dy = b[1] - a[1],
              length = Math.hypot(dx, dy),
              w = 0.025,
              n = [(-dy / length) * w, (dx / length) * w];
            const points = [
              [a[0] - n[0], a[1] - n[1]],
              [b[0] - n[0], b[1] - n[1]],
              [b[0] + n[0], b[1] + n[1]],
              [a[0] + n[0], a[1] + n[1]],
            ];
            const transform = (x, y, z) => [
              x * Math.cos(angle) + z * Math.sin(angle),
              y,
              -x * Math.sin(angle) + z * Math.cos(angle),
            ];
            const front = points.map(([x, y]) => transform(x, y, z + 0.095)),
              back = points.map(([x, y]) => transform(x, y, z + 0.036));
            face(out, 'brick', front, [0.8, 0.64, 0.45]);
            if (mode !== 'district')
              for (let k = 0; k < 4; k++) {
                const l = (k + 1) % 4;
                face(out, 'brick', [front[k], front[l], back[l], back[k]], [0.74, 0.55, 0.34]);
              }
          }
      }
  }
  function buildGonbad(out) {
    const shaftTop = 36.971,
      top = 52.844,
      sides = { master: 160, closeup: 160, street: 80, district: 40, skyline: 20 }[mode];
    const outer = (y) => 8.648 - (8.648 - 7.729) * Math.min(y / 36, 1);
    const cylinder = (y) => outer(y) * 0.869;
    // Ten right-angle flanges separated by short curved bays; entrance centered on +Z.
    const plan = (y, expanded = 0) => {
      const R = outer(y) + expanded,
        r = cylinder(y) + expanded,
        a = (R - Math.sqrt(2 * r * r - R * R)) / 2;
      const delta = Math.atan2(a, R - a),
        points = [];
      for (let n = 0; n < 10; n++) {
        const angle = Math.PI / 2 + Math.PI / 10 - (n * tau) / 10;
        points.push([Math.cos(angle + delta) * r, y, Math.sin(angle + delta) * r]);
        points.push([Math.cos(angle) * R, y, Math.sin(angle) * R]);
        points.push([Math.cos(angle - delta) * r, y, Math.sin(angle - delta) * r]);
        for (
          let j = 1;
          j < { master: 5, closeup: 5, street: 4, district: 3, skyline: 1 }[mode];
          j++
        ) {
          const t =
            angle -
            delta -
            ((tau / 10 - 2 * delta) * j) /
              { master: 5, closeup: 5, street: 4, district: 3, skyline: 1 }[mode];
          points.push([Math.cos(t) * r, y, Math.sin(t) * r]);
        }
      }
      return points;
    };
    // Thin circular pavement datum. The draft's 40 cm solid disc hid both access steps.
    loft(
      out,
      'brick',
      [radialRing(0, 8.82, 8.82, sides), radialRing(0.02, 8.82, 8.82, sides)],
      brick,
    );
    const levels =
      mode === 'master' || mode === 'closeup'
        ? [0.02, 0.4, 1.2, 5.965, 8.1, 9, 34.4, 35.3, shaftTop]
        : [0.02, 0.4, 5.965, shaftTop];
    for (let j = 0; j < levels.length - 1; j++) {
      const lo = plan(levels[j]),
        hi = plan(levels[j + 1]);
      for (let i = 0; i < lo.length; i++) {
        const k = (i + 1) % lo.length;
        const midX = (lo[i][0] + lo[k][0]) / 2,
          midZ = (lo[i][2] + lo[k][2]) / 2;
        // Door cuts only the center bay, with custom curved top below.
        if (midZ > 0 && Math.abs(midX) < 1 && levels[j] >= 0.4 && levels[j] < 5.965) continue;
        face(
          out,
          'brick',
          [lo[i], lo[k], hi[k], hi[i]],
          brick.map((v) => v * (1 + 0.025 * Math.sin(i * 1.71))),
        );
      }
    }
    // Entrance arch spans the removed central bay. Its measured exterior opening is 1.57 × 5.565 m.
    const doorBottom = 0.4,
      doorTop = doorBottom + 5.565,
      half = 0.785;
    const wallZ = (x, y) => Math.sqrt(cylinder(y) ** 2 - x * x);
    const xCuts = [
      -1.18,
      -half,
      ...Array.from(
        { length: mode === 'skyline' ? 9 : 17 },
        (_, i) => -half + (2 * half * i) / (mode === 'skyline' ? 8 : 16),
      ),
      half,
      1.18,
    ];
    for (let i = 0; i < xCuts.length - 1; i++) {
      const x0 = xCuts[i],
        x1 = xCuts[i + 1];
      if (x1 - x0 < 0.00001) continue;
      const arc = (x) =>
        Math.abs(x) >= half
          ? doorBottom
          : doorTop - 1.11 + 1.11 * Math.pow(1 - Math.abs(x) / half, 0.65);
      const y0 = arc(x0),
        y1 = arc(x1),
        roof = 5.97;
      face(
        out,
        'brick',
        [
          [x0, y0, wallZ(x0, y0)],
          [x1, y1, wallZ(x1, y1)],
          [x1, roof, wallZ(x1, roof)],
          [x0, roof, wallZ(x0, roof)],
        ],
        brick,
      );
      if (Math.abs((x0 + x1) / 2) < half) {
        face(
          out,
          'brick',
          [
            [x1, y1, wallZ(x1, y1)],
            [x0, y0, wallZ(x0, y0)],
            [x0, y0, 4.2],
            [x1, y1, 4.2],
          ],
          brick,
        );
      }
    }
    for (const s of [-1, 1]) {
      const jamb = [
        [s * half, doorBottom, 4.2],
        [s * half, doorBottom, wallZ(half, doorBottom)],
        [s * half, doorTop - 1.11, wallZ(half, doorTop - 1.11)],
        [s * half, doorTop - 1.11, 4.2],
      ];
      face(out, 'brick', s < 0 ? jamb.reverse() : jamb, brick);
    }
    // Exterior-only model: an opaque dark interior closes the rear of the entrance.
    // The modern timber infill fits the measured 1.221 × 4.328 m inner opening.
    face(
      out,
      'shadow',
      [
        [-half, doorBottom, 4.12],
        [half, doorBottom, 4.12],
        [half, doorTop, 4.12],
        [-half, doorTop, 4.12],
      ],
      [0.14, 0.12, 0.09],
    );
    pointedWoodDoor(out);
    entranceNiches(out);
    box(out, 'brick', [-1.25, 0.02, 7.4], [1.25, 0.2, 8.9], brick);
    box(out, 'brick', [-1.1, 0.2, 7.4], [1.1, 0.4, 8.55], brick);
    inscriptionBands(out);
    corniceProfile(out, sides);
    const coneBase = 7.9;
    const yCuts = [shaftTop, 40.5, 42.35, top - 0.18, top];
    for (let j = 0; j < yCuts.length - 1; j++) {
      const y0 = yCuts[j],
        y1 = yCuts[j + 1],
        r0 = (coneBase * (top - y0)) / (top - shaftTop),
        r1 = (coneBase * (top - y1)) / (top - shaftTop);
      const angles = [
        ...new Set([
          ...Array.from({ length: sides + 1 }, (_, i) => (-i * tau) / sides),
          (-3 * Math.PI) / 2 - Math.PI / 40,
          (-3 * Math.PI) / 2 + Math.PI / 40,
        ]),
      ].sort((a, b) => b - a);
      for (let i = 0; i < angles.length - 1; i++) {
        const a = angles[i],
          b = angles[i + 1],
          mid = (a + b) / 2;
        const wrap = Math.atan2(Math.sin(mid - Math.PI / 2), Math.cos(mid - Math.PI / 2));
        if (j === 1 && Math.abs(wrap) < 0.08) continue;
        const p = (t, y, r) => [r * Math.cos(t), y, r * Math.sin(t)];
        const points = [p(a, y0, r0), p(b, y0, r0), p(b, y1, r1), p(a, y1, r1)];
        if (r1 === 0) tri(out, 'brickroof', [points[0], points[1], [0, top, 0]], [0.56, 0.43, 0.3]);
        else face(out, 'brickroof', points, [0.56, 0.43, 0.3]);
      }
    }
    // Close every edge of the roof aperture. The rear plane follows the cone slope,
    // so oblique views cannot see sky through a gap beside an axis-aligned backing.
    const aperture = [];
    for (const [y, angle] of [
      [40.5, Math.PI / 2 + Math.PI / 40],
      [40.5, Math.PI / 2 - Math.PI / 40],
      [42.35, Math.PI / 2 - Math.PI / 40],
      [42.35, Math.PI / 2 + Math.PI / 40],
    ]) {
      const r = (coneBase * (top - y)) / (top - shaftTop);
      aperture.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
    }
    const backing = aperture.map(([x, y, z]) => [x, y, z - 0.8]);
    face(out, 'shadow', backing, [0.14, 0.12, 0.09]);
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      face(out, 'brickroof', [aperture[k], backing[k], backing[i], aperture[i]], [0.56, 0.43, 0.3]);
    }
    const soffit = radialRing(shaftTop, coneBase, coneBase, sides).reverse();
    out.addConvexPolygon(
      'brickroof',
      ref,
      soffit,
      [0, -1, 0],
      (p) => [p[0], p[2]],
      [0.56, 0.43, 0.3],
    );
  }
  buildGonbad(out);
}
export function buildGonbadReviewed(o) {
  detail(o, 'master');
}
export function buildGonbadCloseup(o) {
  detail(o, 'closeup');
}
export function buildGonbadStreet(o) {
  detail(o, 'street');
}
export function buildGonbadDistrict(o) {
  detail(o, 'district');
}
// Canonical graph averages keep far tints consistent with the textured near levels.
const means = {
  brick: [0.620345, 0.549823, 0.504963],
  brickroof: [0.620345, 0.549823, 0.504963],
  wood: [0.825128, 0.825128, 0.825128],
  shadow: [1, 1, 1],
};
export function buildGonbadSkyline(destination) {
  detail(
    {
      addQuad: (s, _r, p, n, u, c) =>
        destination.addQuad(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addTriangle: (s, _r, p, n, u, c) =>
        destination.addTriangle(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addConvexPolygon: (s, _r, p, n, u, c) =>
        destination.addConvexPolygon(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
    },
    'skyline',
  );
}
