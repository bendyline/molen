/** Original reconstruction from Schwechten's published 1899 section/elevation.
 * Reference drawings and photographs remain external; uncertain details stay in the brief.
 */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  archBay,
  deform,
  facade,
  face,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { lathe } from './lighthouse-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const tau = Math.PI * 2;
const brick = [0.66, 0.33, 0.23],
  trim = [0.61, 0.29, 0.2];
const porphyry = [0.55, 0.42, 0.37],
  pale = [0.87, 0.84, 0.72];
const iron = [0.095, 0.105, 0.095];
const rect = (y, r) => [
  [-r, y, -r],
  [-r, y, r],
  [r, y, r],
  [r, y, -r],
];

function band(out, y, radius, height = 0.2, slot = 'brick', color = trim) {
  loft(
    out,
    slot,
    [rect(y, radius), rect(y + height * 0.42, radius + 0.12), rect(y + height, radius + 0.12)],
    color,
  );
}

/** Continuous open Gothic molding: no closed tube caps between segments. */
function archMolding(out, x, spring, radius, rise, z, width, depth, color = trim) {
  const rings = [];
  for (let i = 0; i <= 64; i++) {
    const u = -1 + i / 32;
    const curve = Math.sqrt(Math.max(0, 4 - (Math.abs(u) + 1) ** 2)) / Math.sqrt(3);
    // Nested profiles preserve a pointed cusp without a normal-offset self-intersection.
    const inner = [x + u * (radius - width / 2), spring + curve * (rise - width / 2)];
    const outer = [x + u * (radius + width / 2), spring + curve * (rise + width / 2)];
    rings.push([
      [...inner, z],
      [...inner, z - depth],
      [...outer, z - depth],
      [...outer, z],
    ]);
  }
  loft(out, 'brick', rings, color);
}

/** Pierced four-lobed panel. Each void has a real back-to-front reveal. */
function quatrefoil(out, x, y, z, size, slot = 'brick', color = trim) {
  const n = 64,
    d = 0.18;
  const p = (i, outer, zz) => {
    const a = (-i * tau) / n;
    const r = outer
      ? (size * 0.5) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
      : size * (0.29 + 0.075 * Math.cos(4 * a));
    return [x + Math.cos(a) * r, y + Math.sin(a) * r, zz];
  };
  for (let i = 0; i < n; i++) {
    face(out, slot, [p(i, true, z), p(i, false, z), p(i + 1, false, z), p(i + 1, true, z)], color);
    face(
      out,
      slot,
      [p(i + 1, true, z - d), p(i + 1, false, z - d), p(i, false, z - d), p(i, true, z - d)],
      color,
    );
    face(
      out,
      slot,
      [p(i, false, z), p(i, false, z - d), p(i + 1, false, z - d), p(i + 1, false, z)],
      color,
    );
  }
}

function rail(out, width, y, z, slot = 'brick', color = trim) {
  const count = Math.floor(width / 0.7),
    step = width / count;
  box(out, slot, [-width / 2, y, z - 0.22], [width / 2, y + 0.17, z + 0.06], color);
  box(out, slot, [-width / 2, y + 0.94, z - 0.25], [width / 2, y + 1.12, z + 0.09], color);
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + (i + 0.5) * step;
    quatrefoil(out, x, y + 0.55, z, step, slot, color);
  }
}

function masonryCone(out, x, z, y0, y1, radius, sides = 96) {
  // Visible projecting fired-brick courses follow the cone rather than a planar roof texture.
  const courses = Math.ceil((y1 - y0) / 0.135);
  for (let j = 0; j < courses; j++) {
    const a = y0 + ((y1 - y0) * j) / courses,
      b = y0 + ((y1 - y0) * (j + 1)) / courses;
    const r = Math.max(0.045, radius * (1 - j / courses));
    const s = Math.max(0.035, radius * (1 - (j + 1) / courses));
    loft(
      out,
      'brickroof',
      [
        radialRing(a, r + 0.022, r + 0.022, sides, [x, z]),
        radialRing(b - 0.019, s + 0.022, s + 0.022, sides, [x, z]),
        radialRing(b, s, s, sides, [x, z]),
        radialRing(b, s + 0.022, s + 0.022, sides, [x, z]),
      ],
      [0.62 - (j % 5) * 0.008, 0.31, 0.215],
      { cap: j === 0 },
    );
  }
  sphere(out, 'brick', [x, y1 + 0.06, z], [0.09, 0.12, 0.09], trim, 20, 12);
}

function turret(out, x, z) {
  const t = transform(out, 0, [x, 0, z]);
  lathe(
    transform(t, Math.PI / 8),
    'brick',
    [
      [11.35, 1.08],
      [11.7, 1.14],
      [12.05, 1.14],
    ],
    trim,
    8,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      wall = transform(t, a);
    facade(
      wall,
      'brick',
      0.875,
      12.05,
      15.75,
      1.055,
      [
        {
          x: 0,
          w: 0.46,
          y: 12.5,
          spring: 14.5,
          rise: 0.45,
          top: 15.2,
          depth: 0.2,
          pointed: true,
          back: true,
          trim: 0.035,
        },
      ],
      brick,
    );
    archMolding(wall, 0, 14.5, 0.26, 0.5, 1.11, 0.09, 0.12);
    box(wall, 'brick', [-0.45, 12.05, 1.02], [-0.35, 15.95, 1.17], trim);
    box(wall, 'brick', [0.35, 12.05, 1.02], [0.45, 15.95, 1.17], trim);
    sphere(wall, 'brick', [0.4, 16.02, 1.1], [0.085, 0.15, 0.085], trim, 12, 8);
  }
  lathe(
    transform(t, Math.PI / 8),
    'brick',
    [
      [15.65, 1.15],
      [15.89, 1.25],
      [16.04, 1.23],
    ],
    trim,
    8,
  );
  masonryCone(t, 0, 0, 16.04, 19.2, 1.19, 64);
  tube(t, 'metal', [0, 19.2, 0], [0, 19.7, 0], 0.035, iron, 12);
}

function vault(out, floor, spring, top, span, slot = 'brick') {
  // Four pointed intersecting vault ribs, with the section's central hanging boss.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    let previous;
    for (let j = 0; j <= 40; j++) {
      const t = j / 40,
        r = span * (1 - t);
      const p = [
        Math.cos(a) * r,
        spring + (top - spring) * Math.sin((t * Math.PI) / 2),
        Math.sin(a) * r,
      ];
      if (previous) beam(out, slot, previous, p, 0.095, 0.13, pale);
      previous = p;
    }
    box(
      out,
      slot,
      [Math.cos(a) * span - 0.14, floor, Math.sin(a) * span - 0.14],
      [Math.cos(a) * span + 0.14, spring, Math.sin(a) * span + 0.14],
      pale,
    );
  }
  sphere(out, slot, [0, top - 0.05, 0], [0.25, 0.15, 0.25], pale, 24, 12);
}

const letters = {
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.2, 0.4],
      [0.8, 0.4],
    ],
  ],
  B: [
    [
      [0, 0],
      [0, 1],
      [0.65, 1],
      [1, 0.8],
      [0.65, 0.52],
      [0, 0.52],
    ],
    [
      [0.65, 0.52],
      [1, 0.25],
      [0.65, 0],
      [0, 0],
    ],
  ],
  C: [
    [
      [1, 0.85],
      [0.7, 1],
      [0.2, 1],
      [0, 0.75],
      [0, 0.25],
      [0.2, 0],
      [0.8, 0],
      [1, 0.15],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.6, 1],
      [1, 0.75],
      [1, 0.25],
      [0.6, 0],
      [0, 0],
    ],
  ],
  E: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0.5],
      [0.75, 0.5],
    ],
  ],
  G: [
    [
      [1, 0.8],
      [0.75, 1],
      [0.2, 1],
      [0, 0.75],
      [0, 0.25],
      [0.2, 0],
      [1, 0],
      [1, 0.5],
      [0.55, 0.5],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 1],
      [1, 1],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 1],
      [0, 0.45],
      [1, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.5, 0.48],
      [1, 1],
      [1, 0],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
  O: [
    [
      [0.2, 0],
      [0, 0.2],
      [0, 0.8],
      [0.2, 1],
      [0.8, 1],
      [1, 0.8],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.7, 1],
      [1, 0.8],
      [1, 0.65],
      [0.7, 0.5],
      [0, 0.5],
    ],
    [
      [0.5, 0.5],
      [1, 0],
    ],
  ],
  S: [
    [
      [1, 0.85],
      [0.8, 1],
      [0.2, 1],
      [0, 0.8],
      [0.2, 0.55],
      [0.8, 0.45],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
      [0, 0.15],
    ],
  ],
  T: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0, 1],
      [1, 1],
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
  W: [
    [
      [0, 1],
      [0.2, 0],
      [0.5, 0.55],
      [0.8, 0],
      [1, 1],
    ],
  ],
  Z: [
    [
      [0, 1],
      [1, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  1: [
    [
      [0.2, 0.8],
      [0.55, 1],
      [0.55, 0],
    ],
    [
      [0.2, 0],
      [0.85, 0],
    ],
  ],
  8: [
    [
      [0.2, 0],
      [0, 0.2],
      [0.2, 0.5],
      [0, 0.8],
      [0.2, 1],
      [0.8, 1],
      [1, 0.8],
      [0.8, 0.5],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
    ],
    [
      [0.2, 0.5],
      [0.8, 0.5],
    ],
  ],
  9: [
    [
      [0.9, 0],
      [1, 0.8],
      [0.8, 1],
      [0.2, 1],
      [0, 0.8],
      [0, 0.6],
      [0.2, 0.45],
      [1, 0.45],
    ],
  ],
  7: [
    [
      [0, 1],
      [1, 1],
      [0.35, 0],
    ],
  ],
};

function inscription(out, text, y, z, width = 6.6) {
  const step = width / text.length,
    h = 0.58;
  for (const [i, c] of [...text].entries())
    for (const line of letters[c] ?? [])
      for (let j = 1; j < line.length; j++) {
        const at = ([u, v]) => [-width / 2 + (i + 0.12 + u * 0.72) * step, y + v * h, z];
        beam(out, 'metal', at(line[j - 1]), at(line[j]), 0.028, 0.024, iron);
      }
}

function terrace(out) {
  box(out, 'stone', [-12.05, 0, -12.05], [12.05, 3.85, 12.05], porphyry);
  box(out, 'stone', [-12.3, 3.85, -12.3], [12.3, 4, 12.3], porphyry);
  for (let side = 0; side < 4; side++) {
    const t = transform(out, (side * Math.PI) / 2);
    for (const s of [-1, 1]) {
      const w = transform(t, 0, [s * 7.8, 0, 0]);
      // Low terrace arcade, distinct from the Gothic tower's four-lobed gallery rail.
      for (let j = 0; j < 12; j++) {
        const x = -4.2 + j * 0.72;
        box(w, 'stone', [x - 0.06, 4, 11.93], [x + 0.06, 4.83, 12.18], porphyry);
        archBay(w, 'stone', x + 0.36, 0.6, 4, 4.53, 0.3, 4.96, 12.16, 0.2, porphyry, {
          back: false,
          trim: 0,
        });
      }
      box(w, 'stone', [-4.32, 4.96, 11.82], [4.32, 5.14, 12.28], porphyry);
    }
    if (side % 2 === 0) {
      // Main stair with independently modeled risers, treads and sloping balustrades.
      for (let j = 0; j < 24; j++) {
        const y = (j + 1) / 6,
          z = 19.6 - j * 0.32;
        box(t, 'stone', [-2.75, 0, z - 0.33], [2.75, y, z], porphyry);
      }
      for (const s of [-1, 1]) {
        beam(t, 'stone', [s * 3.03, 0.9, 19.6], [s * 3.03, 4.9, 12], 0.24, 0.34, porphyry);
        for (let j = 0; j <= 24; j++) {
          const y = j / 6,
            z = 19.6 - (j * 7.6) / 24;
          box(
            t,
            'stone',
            [s * 3.03 - 0.1, y, z - 0.1],
            [s * 3.03 + 0.1, y + 0.9, z + 0.1],
            porphyry,
          );
        }
      }
    } else {
      box(t, 'stone', [-3.5, 4, 11.93], [3.5, 4.25, 12.18], porphyry);
      rail(t, 7, 4.18, 12.14, 'stone', porphyry);
    }
    // Rock-faced plinth block courses, with varied but deterministic joints.
    for (let row = 0; row < 7; row++)
      for (let j = 0; j < 23; j++) {
        const x = -11.96 + j * 1.03;
        box(
          t,
          'stone',
          [x, 0.12 + row * 0.52, 12.045],
          [x + 0.985, 0.6 + row * 0.52, 12.075 + ((j * 7 + row) % 4) * 0.007],
          porphyry.map((v) => v * (0.91 + ((j * 3 + row * 5) % 7) * 0.02)),
        );
      }
  }
  for (const x of [-12, 12])
    for (const z of [-12, 12]) {
      loft(
        out,
        'stone',
        [
          [0, 1],
          [4, 0.73],
          [5.4, 0.6],
          [6, 0.74],
          [6.22, 0.81],
        ].map(([y, r]) => rect(y, r).map((p) => [p[0] + x, p[1], p[2] + z])),
        porphyry,
      );
      lathe(
        transform(out, 0, [x, 0, z]),
        'metal',
        [
          [6.22, 0.44],
          [6.42, 0.66],
          [6.62, 0.8],
          [6.72, 0.82],
        ],
        iron,
        48,
      );
    }
}

function buildGrunewaldTower(out) {
  terrace(out);
  box(out, 'brick', [-5.25, 4, -5.25], [5.25, 4.35, 5.25], trim);
  for (let side = 0; side < 4; side++) {
    const t = transform(out, (side * Math.PI) / 2);
    facade(
      t,
      'brick',
      10,
      4.35,
      11.5,
      5,
      [
        {
          x: 0,
          w: 4.3,
          y: 4.35,
          spring: 8.1,
          rise: 2.32,
          top: 11.5,
          depth: 1.0,
          pointed: true,
          back: false,
          trim: 0,
        },
      ],
      brick,
    );
    // Interior back face leaves the memorial hall open in all four directions.
    const inside = transform(t, Math.PI, [0, 0, 9]);
    facade(
      inside,
      'brick',
      8,
      4.35,
      11.5,
      5,
      [
        {
          x: 0,
          w: 4.3,
          y: 4.35,
          spring: 8.1,
          rise: 2.32,
          top: 11.5,
          depth: 0.02,
          pointed: true,
          back: false,
          trim: 0,
        },
      ],
      brick,
    );
    for (let k = 0; k < 5; k++) {
      archMolding(t, 0, 8.1, 2.15 + k * 0.13, 2.32 + k * 0.13, 5.06 + k * 0.07, 0.095, 0.12);
      for (const s of [-1, 1])
        box(
          t,
          'brick',
          [s * (2.15 + k * 0.13) - 0.047, 4.35, 5 + k * 0.07],
          [s * (2.15 + k * 0.13) + 0.047, 8.1, 5.14 + k * 0.07],
          trim,
        );
    }
    for (const x of [-4.15, 4.15]) {
      box(t, 'brick', [x - 0.39, 4.35, 4.93], [x + 0.39, 11.58, 5.03], trim);
      facade(
        transform(t, 0, [x, 0, 0]),
        'brick',
        0.78,
        4.35,
        11.58,
        5.45,
        [
          {
            x: 0,
            w: 0.36,
            y: 6.65,
            spring: 8.05,
            rise: 0.38,
            top: 8.8,
            depth: 0.24,
            pointed: true,
            trim: 0.04,
          },
        ],
        brick,
      );
      for (const s of [-1, 1])
        box(
          t,
          'brick',
          [x + s * 0.38 - 0.01, 4.35, 5.02],
          [x + s * 0.38 + 0.01, 11.58, 5.45],
          trim,
        );
      box(t, 'brick', [x - 0.39, 11.56, 5.02], [x + 0.39, 11.58, 5.45], trim);
    }
    rail(t, 8.7, 11.68, 5.38);
    // Recessed upper triplet behind the lower gallery.
    facade(
      t,
      'brick',
      7.2,
      11.7,
      18.05,
      3.6,
      [-0.85, 0, 0.85].map((x) => ({
        x,
        w: 0.52,
        y: 14.7,
        spring: 16.12,
        rise: 0.46,
        top: 16.7,
        depth: 0.3,
        pointed: true,
        trim: 0.06,
      })),
      brick,
    );
    box(t, 'brick', [-1.6, 12.15, 3.63], [1.6, 14.2, 3.65], trim);
    facade(
      t,
      'brick',
      3.2,
      12.15,
      14.35,
      4.22,
      [
        {
          x: 0,
          w: 2.2,
          y: 12.15,
          spring: 13.04,
          rise: 0.75,
          top: 14.35,
          depth: 0.45,
          pointed: true,
          back: true,
          trim: 0.08,
        },
      ],
      brick,
    );
    for (const s of [-1, 1])
      box(t, 'brick', [s * 1.59 - 0.01, 12.15, 3.64], [s * 1.59 + 0.01, 14.35, 4.22], trim);
    box(t, 'brick', [-1.68, 14.35, 3.62], [1.68, 14.56, 4.36], trim);
  }
  band(out, 11.3, 5.24, 0.38);
  box(out, 'brick', [-4.8, 11.45, -4.8], [4.8, 11.68, 4.8], trim);
  vault(out, 4.35, 8.2, 11.12, 5.1, 'limestone');
  for (const x of [-4.35, 4.35]) for (const z of [-4.35, 4.35]) turret(out, x, z);
  band(out, 17.78, 3.62, 0.3);
  for (let side = 0; side < 4; side++) {
    const t = transform(out, (side * Math.PI) / 2);
    const tapered = deform(t, ([x, y, z]) => {
      const scale = 1 - ((y - 18.08) / 18) * 0.055;
      return [x * scale, y, z * scale];
    });
    const openings = (
      side % 2 === 0
        ? [{ x: 0, y: 24.2 }]
        : [
            { x: -0.35, y: 29.6 },
            { x: 0.35, y: 29.6 },
            { x: 0, y: 21.3 },
          ]
    ).map((w) => ({
      ...w,
      w: 0.24,
      spring: w.y + 1.05,
      rise: 0.22,
      top: w.y + 1.45,
      depth: 0.5,
      pointed: true,
      trim: 0.025,
    }));
    facade(tapered, 'brick', 7.2, 18.08, 35.45, 3.6, openings, brick);
    if (side === 0 || side === 2) {
      box(t, 'brick', [-3.5, 18.08, 3.55], [3.5, 19.65, 3.74], trim);
      inscription(t, side === 0 ? 'KOENIG WILHELM I' : 'DER KREIS TELTOW', 18.96, 3.77);
      inscription(t, side === 0 ? 'ZUM GEDAECHTNISS' : 'BAUTE MICH 1897', 18.21, 3.77);
    }
    // Published shield field retained for a separately reviewed heraldic relief.
    const shield = [
      [-1.15, 33.92, 3.5],
      [1.15, 33.92, 3.5],
      [0.96, 31.85, 3.5],
      [0, 31.12, 3.5],
      [-0.96, 31.85, 3.5],
    ];
    if (side % 2 === 0)
      for (let i = 1; i < shield.length - 1; i++)
        triangle(t, 'plaster', [shield[0], shield[i + 1], shield[i]], pale);
    for (let i = 0; i < 7; i++) {
      const x = -3.35 + i * 1.12;
      loft(
        transform(t, 0, [x, 0, 0]),
        'brick',
        [
          [34.65, 0.17, 3.25],
          [35.18, 0.25, 3.7],
          [35.73, 0.28, 4.15],
        ].map(([y, w, z]) => [
          [-w, y, z - 0.43],
          [-w, y, z],
          [w, y, z],
          [w, y, z - 0.43],
        ]),
        trim,
      );
    }
  }
  band(out, 35.65, 4.12, 0.35);
  box(out, 'brick', [-4.23, 35.9, -4.23], [4.23, 36.05, 4.23], trim);
  for (let side = 0; side < 4; side++) {
    const t = transform(out, (side * Math.PI) / 2);
    rail(t, 7.8, 36.05, 4.11);
    facade(
      t,
      'brick',
      7.35,
      36.05,
      42.55,
      3.675,
      [
        {
          x: 0,
          w: 5.05,
          y: 36.05,
          spring: 39.25,
          rise: 2.26,
          top: 42.55,
          depth: 0.65,
          pointed: true,
          back: false,
          trim: 0,
        },
      ],
      brick,
    );
    for (let k = 0; k < 3; k++)
      archMolding(t, 0, 39.25, 2.525 + k * 0.12, 2.26 + k * 0.13, 3.74 + k * 0.08, 0.11, 0.18);
    // One corner per face: the four rotations supply four distinct pinnacles.
    {
      const s = 1;
      lathe(
        transform(t, 0, [s * 3.42, 0, 3.42]),
        'brick',
        [
          [36.05, 0.3],
          [36.32, 0.37],
          [41.75, 0.28],
          [42.1, 0.44],
          [42.8, 0.35],
          [44.5, 0.24],
        ],
        trim,
        24,
      );
      masonryCone(t, s * 3.42, 3.42, 44.5, 46, 0.32, 32);
    }
    // Four high ornamental gables, with true recessed blind lancets.
    const gable = transform(t, 0, [0, 0, 3.55]);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.82,
        height = i === 1 ? 3.9 : 2.25;
      box(gable, 'plaster', [x - 0.23, 42.88, 0], [x + 0.23, 42.88 + height, 0.05], pale);
      for (const s of [-1, 1])
        beam(
          gable,
          'brick',
          [x + s * 0.3, 42.55, 0.2],
          [x + s * 0.3, 42.88 + height, 0.2],
          0.12,
          0.14,
          trim,
        );
    }
    triangle(
      gable,
      'brick',
      [
        [-3.25, 42.55, -0.04],
        [3.25, 42.55, -0.04],
        [0, 47.6, -0.04],
      ],
      brick,
    );
    const front = [
      [-3.25, 42.55, -0.04],
      [3.25, 42.55, -0.04],
      [0, 47.6, -0.04],
    ];
    const back = front.map(([x, y]) => [x, y, -0.34]);
    triangle(gable, 'brick', back.toReversed(), brick);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      face(gable, 'brick', [front[i], back[i], back[j], front[j]], brick);
    }
    for (const s of [-1, 1])
      beam(gable, 'brick', [s * 3.3, 42.53, 0.1], [0, 47.7, 0.1], 0.25, 0.3, trim);
    box(gable, 'brick', [-3.55, 42.45, -0.1], [3.55, 42.69, 0.3], trim);
  }
  vault(out, 36.05, 39.25, 42.6, 4.15);
  masonryCone(out, 0, 0, 42.55, 54.72, 3.53, 160);
  tube(out, 'metal', [0, 54.7, 0], [0, 55, 0], 0.032, iron, 12);
}

export const grunewaldTower = {
  id: 'n0616_grunewald_tower',
  planId: 'N0616',
  title: 'Grunewald Tower',
  wikidata: 'Q833787',
  authoringFile: 'grunewald-tower-model.mjs',
  build: buildGrunewaldTower,
  componentMap: { stone: 'grunewald_stone' },
  size: [26, 55, 40],
  front:
    '+Z faces the principal stair and the Koenig Wilhelm inscription; signed azimuth awaits review',
  origin: 'Tower axis at the lower terrace-stair ground datum; platform is four metres higher',
  brief:
    'Red-brick memorial and observation tower on a raised porphyry terrace, with four open pointed memorial-hall arches, clustered corner turrets, pierced gallery rails, tapered inscribed shaft, corbelled upper viewing hall, four decorated gables and a course-built conical brick roof.',
  facts: {
    heightMeters: 55,
    upperViewingFloorMeters: 36,
    terraceHeightMeters: 4,
    stairsToView: 204,
    architect: 'Franz Schwechten',
    construction: '1897–1899',
    section: 'Centralblatt der Bauverwaltung 19 (1899), no.21, pp.122–123',
    sectionStatus:
      'Historic section used for proportional reconstruction, cross-checked against exterior photographs',
    mappedTerraceMeters: [26.068, 26.045],
    catalogHeightDiscrepancyMeters: 56,
  },
  refs: [
    'https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/tuerme/artikel.1129193.php',
    'https://www.berlin.de/sehenswuerdigkeiten/3560626-3558930-grunewaldturm.html',
    'https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046482',
    'https://commons.wikimedia.org/wiki/File:1899_Grunewaldturm2.gif',
    'https://commons.wikimedia.org/wiki/File:1899_Grunewaldturm1.gif',
    'https://commons.wikimedia.org/wiki/File:Berlin_Grunewaldturm.JPG',
    'https://de.wikisource.org/wiki/Die_Gartenlaube_(1899)/Heft_8',
    'https://www.openstreetmap.org/way/23722446',
  ],
  scaleBasis:
    'Berlin’s official visitor and district records give a 55 m tower and 36 m viewing floor. The 1899 section supplies proportions, with a four-metre terrace confirmed by the contemporary Gartenlaube account. The mapped 26.068 × 26.045 m outline describes the broad terrace, not the slender shaft. Unreferenced catalog height 56 m is not used.',
  geographicProposal: {
    anchor: [13.196730627, 52.478193956],
    heading: 0.615054807783,
    source: 'https://www.openstreetmap.org/way/23722446',
    orientationConfidence: 'axis-only',
    evidence: 'Exact-QID mapped terrace supplies the anchor and undirected square plan axes.',
    limitations:
      'The principal stair/inscription side, sloping terrace ground and absolute elevation need a site-fit review; square footprint alone does not fix facing.',
  },
  limits: [
    'Architectural reconstruction in progress; maximum-fidelity and placement approval remain pending.',
    'The memorial statue, heraldic eagle reliefs, bronze portrait medallions and mosaic vault have not yet been authored. Shield fields are intentionally plain pending source-backed relief work.',
    'Balustrade motifs, portal profiles, terrace side stairs, lantern fixtures and roof equipment need detailed comparison. The historical woodcut is not proof of the current post-restoration configuration.',
    'Inscriptions use original line glyphs with the documented wording; they do not reproduce the historic letter carving or casing. The inaccessible internal stair and basement rooms are outside this first exterior pass.',
  ],
  cameras: [
    { name: 'memorial-portal', position: [11, 8, 19], lookAt: [0, 8, 0] },
    { name: 'corner-turrets', position: [16, 16, 19], lookAt: [0, 15, 0] },
    { name: 'upper-gallery', position: [13, 40, 17], lookAt: [0, 39, 0] },
    { name: 'brick-roof', position: [13, 51, 16], lookAt: [0, 48, 0] },
    { name: 'terrace-stairs', position: [23, 9, 31], lookAt: [0, 4, 9] },
    { name: 'far-silhouette', position: [78, 40, 92], lookAt: [0, 27, 0] },
  ],
};
