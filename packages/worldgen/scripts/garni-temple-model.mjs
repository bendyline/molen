/** Garni's restored peripteral temple. Dimensions follow Sahinyan (1979), pp.76–92.
 * Sculpture is original reconstruction, not a copied mesh or photograph.
 */
import { beam, loft, sphere } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { deform, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { lathe } from './lighthouse-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const tau = Math.PI * 2;
const stone = [0.36, 0.345, 0.32];
const oldStone = [0.22, 0.215, 0.205];
const trim = [0.42, 0.4, 0.365];
const floor = 2.81,
  capital = floor + 6.54,
  eave = 10.972;
const tint = (base, seed) => base.map((v) => v * (0.88 + ((seed * 37 + 19) % 23) / 100));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rect = (y, x, z) => [
  [-x, y, -z],
  [-x, y, z],
  [x, y, z],
  [x, y, -z],
];

function wall(out, x0, x1, y0, y1, z0, z1, seed = 0) {
  const rows = Math.max(1, Math.round((y1 - y0) / 0.58));
  for (let row = 0; row < rows; row++) {
    const a = y0 + ((y1 - y0) * row) / rows,
      b = y0 + ((y1 - y0) * (row + 1)) / rows;
    const width = x1 - x0,
      count = Math.max(1, Math.round(width / 1.05));
    const dx = width / count,
      cuts = [x0];
    for (let k = 1; k <= count; k++) {
      const x = x0 + (k - (row % 2) * 0.45) * dx;
      if (x < x1 - 0.02) cuts.push(x);
    }
    cuts.push(x1);
    for (let k = 1; k < cuts.length; k++)
      box(
        out,
        'stone',
        [cuts[k - 1] + 0.004, a + 0.004, z0],
        [cuts[k] - 0.004, b - 0.004, z1],
        tint(stone, seed + row * 31 + k),
      );
  }
}

/** Rounded leaf volume with a raised central vein, drawn in the local XY plane. */
function leaf(out, x, y, z, length, width, angle = 0, color = trim) {
  const t = transform(out, -0, [x, y, z]);
  const rotated = deform(t, ([u, v, w]) => [
    u * Math.cos(angle) - v * Math.sin(angle),
    u * Math.sin(angle) + v * Math.cos(angle),
    w,
  ]);
  const rings = [];
  for (let j = 0; j <= 8; j++) {
    const v = j / 8,
      r = Math.max(0.005, Math.sin(Math.PI * v) * width);
    rings.push(
      Array.from({ length: 8 }, (_, i) => {
        const a = (-i * tau) / 8;
        return [
          Math.cos(a) * r,
          v * length,
          Math.sin(a) * r * 0.32 + Math.sin(Math.PI * v) * width * 0.2,
        ];
      }),
    );
  }
  // Rings run along Y, with their XZ sections wound as the shared loft expects.
  loft(rotated, 'stone', rings, color);
  const vein = Array.from({ length: 9 }, (_, j) =>
    Array.from({ length: 6 }, (_, i) => {
      const v = j / 8,
        a = (-i * tau) / 6;
      return [
        Math.cos(a) * 0.008,
        v * length,
        Math.sin(Math.PI * v) * width * 0.53 + 0.007 + Math.sin(a) * 0.008,
      ];
    }),
  );
  loft(rotated, 'stone', vein, color);
}

function rosette(out, x, y, z, r, seed = 0) {
  for (let k = 0; k < 8; k++) leaf(out, x, y, z, r, r * 0.2, (k * tau) / 8, tint(trim, seed + k));
  sphere(out, 'stone', [x, y, z + 0.023], [r * 0.16, r * 0.16, r * 0.08], trim, 12, 6);
}

/** Ionic volute ribbon, with solid returns; two turns terminate in a raised eye. */
function volute(out, cx, y, z, hand) {
  // Volutes are carved into the pillow of the capital, not freestanding wire spirals.
  sphere(out, 'stone', [cx, y, z - 0.065], [0.178, 0.172, 0.035], stone, 32, 16);
  const rings = [];
  for (let i = 0; i <= 80; i++) {
    const u = i / 80,
      a = u * tau * 1.85,
      r = 0.155 * (1 - u) + 0.018;
    const x = cx + hand * r * Math.cos(a),
      yy = y + r * Math.sin(a);
    const dx = hand * (-0.155 * Math.cos(a) - r * tau * 1.85 * Math.sin(a));
    const dy = -0.155 * Math.sin(a) + r * tau * 1.85 * Math.cos(a),
      n = Math.hypot(dx, dy);
    const nx = (-dy / n) * 0.014,
      ny = (dx / n) * 0.014;
    rings.push([
      [x + nx, yy + ny, z - 0.055],
      [x + nx, yy + ny, z],
      [x - nx, yy - ny, z],
      [x - nx, yy - ny, z - 0.055],
    ]);
  }
  loft(out, 'stone', rings, trim);
  sphere(
    out,
    'stone',
    [cx + hand * 0.018 * Math.cos(tau * 1.85), y + 0.018 * Math.sin(tau * 1.85), z + 0.005],
    [0.023, 0.023, 0.025],
    trim,
    16,
    8,
  );
}

function column(out, x, z, angle, index) {
  const t = transform(out, angle, [x, 0, z]);
  box(t, 'stone', [-0.506, floor, -0.506], [0.506, floor + 0.115, 0.506], tint(trim, index));
  lathe(
    t,
    'stone',
    [
      [floor + 0.112, 0.475],
      [floor + 0.155, 0.475],
      [floor + 0.2, 0.445],
      [floor + 0.225, 0.415],
      [floor + 0.255, 0.397],
      [floor + 0.29, 0.418],
      [floor + 0.325, 0.418],
      [floor + 0.365, 0.346],
    ],
    trim,
    96,
  );
  const bottom = floor + 0.365,
    top = capital - 0.265;
  // Unfluted reconstructed drums; the small increase at one-third height is entasis.
  const radius = (y) => {
    const t = (y - bottom) / (top - bottom);
    return 0.346 + 0.029 * Math.sin(Math.PI * t) - 0.065 * t;
  };
  const drums = [
    bottom,
    bottom + 0.88,
    bottom + 1.81,
    bottom + 2.79,
    bottom + 3.66,
    bottom + 4.62,
    top,
  ];
  for (let j = 1; j < drums.length; j++) {
    const a = drums[j - 1] + (j === 1 ? 0 : 0.004),
      b = drums[j] - 0.004;
    const profiles = Array.from({ length: 7 }, (_, k) => {
      const y = a + ((b - a) * k) / 6;
      return [y, radius(y)];
    });
    lathe(
      t,
      'stone',
      profiles,
      tint(j === 3 && index % 4 === 1 ? oldStone : stone, index * 11 + j),
      96,
    );
  }
  lathe(
    t,
    'stone',
    [
      [top - 0.005, 0.289],
      [top + 0.025, 0.318],
      [top + 0.055, 0.318],
      [top + 0.085, 0.302],
      [top + 0.145, 0.39],
      [top + 0.18, 0.39],
    ],
    trim,
    96,
  );
  box(t, 'stone', [-0.505, capital - 0.07, -0.38], [0.505, capital, 0.38], trim);
  for (const direction of [0, Math.PI]) {
    const f = transform(t, direction);
    box(f, 'stone', [-0.34, capital - 0.185, 0.275], [0.34, capital - 0.08, 0.32], trim);
    for (const s of [-1, 1]) volute(f, s * 0.375, capital - 0.2, 0.405, s);
    for (let k = 0; k < 7; k++)
      sphere(
        f,
        'stone',
        [(k - 3) * 0.075, capital - 0.2, 0.333],
        [0.025, 0.045, 0.03],
        trim,
        10,
        6,
      );
  }
}

function podium(out) {
  const profiles = [
    [0, 6.02, 9.07],
    [0.23, 6.02, 9.07],
    [0.45, 5.88, 8.94],
    [0.72, 5.74, 8.8],
    [0.86, 5.69, 8.75],
    [2.1, 5.69, 8.75],
    [2.25, 5.81, 8.87],
    [2.42, 5.92, 8.98],
    [2.6, 5.92, 8.98],
    [floor, 5.747, 8.799],
  ];
  loft(
    out,
    'stone',
    profiles.map(([y, x, z]) => rect(y, x, z)),
    stone,
  );
  for (const [rotation, length, z] of [
    [0, 11.38, 8.755],
    [Math.PI, 11.38, 8.755],
    [Math.PI / 2, 17.5, 5.695],
    [-Math.PI / 2, 17.5, 5.695],
  ]) {
    const t = transform(out, rotation);
    wall(t, -length / 2, length / 2, 0.89, 2.1, z, z + 0.018, 11);
  }
  const stairWidth = 7.2,
    run = 0.39;
  for (let i = 0; i < 9; i++) {
    const y = ((i + 1) * floor) / 9,
      z = 11.7 - i * run;
    box(out, 'stone', [-stairWidth / 2, 0, z - run], [stairWidth / 2, y, z], tint(stone, i + 21));
    for (let j = 0; j < 6; j++)
      box(
        out,
        'stone',
        [-stairWidth / 2 + j * 1.2 + 0.008, y - 0.045, z - run],
        [-stairWidth / 2 + (j + 1) * 1.2 - 0.008, y + 0.005, z],
        tint(stone, i * 7 + j),
      );
  }
  for (const s of [-1, 1]) {
    const t = transform(out, 0, [s * 4.58, 0, 9.42]);
    loft(
      t,
      'stone',
      [
        [0.47, 0.89, 0.8],
        [0.63, 0.89, 0.8],
        [0.84, 0.73, 0.67],
        [2.2, 0.73, 0.67],
        [2.38, 0.82, 0.76],
        [2.59, 1.0, 0.91],
        [2.72, 1.0, 0.91],
      ].map(([y, x, z]) => rect(y, x, z)),
      trim,
    );
    // Original low relief suggestion of the kneeling stair figures; portrait accuracy pending.
    sphere(t, 'stone', [0, 1.44, 0.7], [0.22, 0.39, 0.13], oldStone, 24, 12);
    sphere(t, 'stone', [s * 0.055, 1.99, 0.72], [0.14, 0.175, 0.12], trim, 24, 12);
    for (const h of [-1, 1]) {
      tube(t, 'stone', [h * 0.13, 1.7, 0.75], [h * 0.36, 1.93, 0.78], 0.09, trim, 16);
      tube(t, 'stone', [h * 0.36, 1.93, 0.78], [h * 0.26, 2.18, 0.79], 0.075, trim, 16);
      sphere(t, 'stone', [h * 0.26, 2.18, 0.79], [0.09, 0.06, 0.07], trim, 16, 8);
      tube(t, 'stone', [h * 0.11, 1.28, 0.75], [h * 0.36, 0.98, 0.8], 0.13, oldStone, 16);
      tube(t, 'stone', [h * 0.36, 0.98, 0.8], [h * 0.1, 0.87, 0.81], 0.11, trim, 16);
    }
  }
}

function cella(out) {
  wall(out, -3.495, 3.495, floor, capital, -5.965, -4.995, 1);
  for (const s of [-1, 1]) {
    const t = transform(out, (s * Math.PI) / 2);
    wall(
      t,
      s === 1 ? -5.3 : -5.965,
      s === 1 ? 5.965 : 5.3,
      floor,
      capital,
      2.525,
      3.495,
      3 + (s + 1) * 7,
    );
  }
  // Central opening stays open into an actual inner chamber, with a slightly tapered jamb.
  const z = 3.768,
    doorTop = floor + 4.685;
  wall(out, -3.495, -1.145, floor, doorTop, 2.988, z, 32);
  wall(out, 1.145, 3.495, floor, doorTop, 2.988, z, 14);
  wall(out, -3.495, 3.495, doorTop, capital, 2.988, z, 6);
  for (const s of [-1, 1]) {
    const x = s * 1.145;
    beam(out, 'stone', [x, floor, z + 0.1], [s * 1.02, doorTop, z + 0.1], 0.16, 0.2, trim);
    beam(
      out,
      'stone',
      [x + s * 0.19, floor, z + 0.07],
      [s * 1.22, doorTop + 0.22, z + 0.07],
      0.1,
      0.18,
      trim,
    );
    box(out, 'stone', [s * 3.495 - 0.29, floor, 5.02], [s * 3.495 + 0.29, capital, 5.3], stone);
    box(
      out,
      'stone',
      [s * 3.495 - 0.38, capital - 0.2, 4.96],
      [s * 3.495 + 0.38, capital, 5.36],
      trim,
    );
  }
  for (const [y, w, h, d] of [
    [doorTop, 2.65, 0.16, 0.24],
    [doorTop + 0.16, 2.92, 0.16, 0.32],
    [doorTop + 0.32, 3.1, 0.14, 0.39],
  ])
    box(out, 'stone', [-w / 2, y, z - 0.1], [w / 2, y + h, z + d], trim);
  for (let k = -5; k <= 5; k++) rosette(out, k * 0.24, doorTop + 0.39, z + 0.405, 0.085, k + 8);
  box(out, 'stone', [-2.525, floor, -4.995], [2.525, floor + 0.035, 2.988], stone);
  // Shallow barrel vault: open doorway reveals the chamber instead of a black painted plane.
  const spring = 8.24,
    rise = 1.702,
    half = 2.525;
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI) / 48,
      b = ((i + 1) * Math.PI) / 48;
    face(
      out,
      'stone',
      [
        [Math.cos(a) * half, spring + Math.sin(a) * rise, -4.995],
        [Math.cos(a) * half, spring + Math.sin(a) * rise, 2.988],
        [Math.cos(b) * half, spring + Math.sin(b) * rise, 2.988],
        [Math.cos(b) * half, spring + Math.sin(b) * rise, -4.995],
      ],
      tint(stone, i),
    );
  }
}

/** Fascia segments form an open ring, preserving all four peristyle walks. */
function ring(out, y, h, x, z, width, color = trim) {
  box(out, 'stone', [-x, y, -z], [x, y + h, -z + width], color);
  box(out, 'stone', [-x, y, z - width], [x, y + h, z], color);
  box(out, 'stone', [-x, y, -z + width], [-x + width, y + h, z - width], color);
  box(out, 'stone', [x - width, y, -z + width], [x, y + h, z - width], color);
}

function lion(out, x, y, z) {
  sphere(out, 'stone', [x, y, z], [0.11, 0.12, 0.055], oldStone, 16, 10);
  for (let k = 0; k < 10; k++)
    leaf(
      out,
      x + Math.cos((k * tau) / 10) * 0.055,
      y + Math.sin((k * tau) / 10) * 0.055,
      z,
      0.075,
      0.025,
      (k * tau) / 10 - Math.PI / 2,
      trim,
    );
  sphere(out, 'stone', [x, y - 0.024, z + 0.057], [0.063, 0.041, 0.035], trim, 14, 8);
  sphere(out, 'shadow', [x, y - 0.031, z + 0.087], [0.022, 0.016, 0.008], [0.1, 0.1, 0.09], 12, 6);
  for (const s of [-1, 1])
    sphere(out, 'stone', [x + s * 0.037, y + 0.038, z + 0.044], [0.018, 0.019, 0.022], trim, 12, 6);
}

function entablature(out) {
  for (const [y, h, x, z, w] of [
    [capital, 0.2, 5.51, 7.62, 0.72],
    [capital + 0.2, 0.2, 5.56, 7.67, 0.77],
    [capital + 0.4, 0.2, 5.62, 7.73, 0.83],
    [capital + 0.6, 0.31, 5.65, 7.76, 0.86],
    [capital + 0.91, 0.12, 5.72, 7.83, 0.93],
    [capital + 1.13, 0.12, 5.84, 7.95, 1.05],
    [capital + 1.25, 0.14, 5.97, 8.08, 1.18],
    [capital + 1.39, 0.23, 6.12, 8.23, 1.33],
  ])
    ring(out, y, h, x, z, w, trim);
  for (const [angle, length, z] of [
    [0, 11.3, 7.78],
    [Math.PI, 11.3, 7.78],
    [Math.PI / 2, 15.5, 5.67],
    [-Math.PI / 2, 15.5, 5.67],
  ]) {
    const t = transform(out, angle);
    const count = Math.floor(length / 0.255);
    for (let k = 0; k <= count; k++) {
      const x = -length / 2 + (k * length) / count;
      box(
        t,
        'stone',
        [x - 0.067, capital + 1.03, z + 0.04],
        [x + 0.067, capital + 1.14, z + 0.2],
        trim,
      );
      if (k < count) {
        const xx = x + length / count / 2;
        leaf(t, xx, capital + 0.61, z + 0.018, 0.22, 0.05, 0, tint(trim, k));
        for (const s of [-1, 1])
          leaf(t, xx, capital + 0.63, z + 0.02, 0.15, 0.035, s * 0.65, tint(trim, k + 3));
        if (k % 3 === 0) lion(t, xx, capital + 1.47, z + 0.46);
      }
      sphere(t, 'stone', [x, capital + 0.54, z - 0.025], [0.035, 0.026, 0.025], trim, 10, 6);
    }
  }
  // Cof­fered slabs across the portico and narrow side walks, each with a recessed center.
  for (let iz = 0; iz < 8; iz++)
    for (let ix = 0; ix < 6; ix++) {
      const x = (ix - 2.5) * 1.94,
        z = (iz - 3.5) * 2.02;
      if (Math.abs(x) < 3.5 && z < 5.15 && z > -5.95) continue;
      const t = transform(out, 0, [x, 0, z]);
      const y = capital + 0.14,
        w = 1.94,
        d = 2.02;
      box(t, 'stone', [-w / 2, y, -d / 2], [w / 2, y + 0.18, d / 2], stone);
      for (const s of [-1, 1]) {
        box(
          t,
          'stone',
          [-w / 2, y - 0.09, s * (d / 2 - 0.09) - 0.07],
          [w / 2, y, s * (d / 2 - 0.09) + 0.07],
          trim,
        );
        box(
          t,
          'stone',
          [s * (w / 2 - 0.09) - 0.07, y - 0.09, -d / 2],
          [s * (w / 2 - 0.09) + 0.07, y, d / 2],
          trim,
        );
      }
      const down = deform(t, ([a, b, c]) => [a, y - c, b]);
      rosette(down, 0, 0, 0.015, 0.22, ix + iz);
    }
}

function roof(out) {
  const half = 6.12,
    length = 8.23,
    ridge = 12.68;
  const roofY = (x) => eave + (ridge - eave) * (1 - Math.abs(x) / half);
  for (const s of [-1, 1]) {
    const t = transform(out, s === 1 ? 0 : Math.PI);
    // Pediment field, with explicit clipped ashlar joints.
    for (let row = 0; row < 4; row++) {
      const y0 = eave + (row * (ridge - eave)) / 4,
        y1 = eave + ((row + 1) * (ridge - eave)) / 4;
      const a = half * (1 - (y0 - eave) / (ridge - eave)),
        b = half * (1 - (y1 - eave) / (ridge - eave));
      const polygon = [
        [-a, y0],
        [a, y0],
        [b, y1],
        [-b, y1],
      ];
      const n = Math.max(1, Math.ceil((a * 2) / 1.1));
      for (let k = 0; k < n; k++) {
        const x0 = -a + (2 * a * k) / n + 0.004,
          x1 = -a + (2 * a * (k + 1)) / n - 0.004;
        let clipped = polygon;
        for (const [bound, sign] of [
          [x0, 1],
          [x1, -1],
        ]) {
          const result = [];
          for (let j = 0; j < clipped.length; j++) {
            const p = clipped[j],
              q = clipped[(j + 1) % clipped.length],
              inside = sign * (p[0] - bound) >= 0,
              after = sign * (q[0] - bound) >= 0;
            if (inside) result.push(p);
            if (inside !== after) {
              const u = (bound - p[0]) / (q[0] - p[0]);
              result.push([bound, p[1] + u * (q[1] - p[1])]);
            }
          }
          clipped = result;
        }
        if (clipped.length < 3) continue;
        const pp = clipped
          .filter(
            (p, i) =>
              i === 0 || Math.hypot(p[0] - clipped[i - 1][0], p[1] - clipped[i - 1][1]) > 1e-7,
          )
          .map(([x, y]) => [x, y + 0.003, length - 0.2]);
        for (let j = 1; j < pp.length - 1; j++) {
          const a = pp[0],
            b = pp[j],
            c = pp[j + 1];
          if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-7)
            triangle(t, 'stone', [a, b, c], tint(stone, row * 11 + k));
        }
      }
    }
    for (const direction of [-1, 1]) {
      const a = [direction * half, eave, length],
        b = [0, ridge, length];
      beam(t, 'stone', a, b, 0.24, 0.35, trim);
      beam(
        t,
        'stone',
        [a[0], a[1] + 0.2, a[2] + 0.07],
        [b[0], b[1] + 0.2, b[2] + 0.07],
        0.21,
        0.43,
        trim,
      );
      const count = 28;
      for (let k = 0; k < count; k++) {
        const p = mix(a, b, (k + 0.5) / count),
          r = transform(t, 0, p);
        rosette(r, 0, 0.08, 0.285, 0.07, k);
        box(r, 'stone', [-0.05, -0.12, 0.09], [0.05, -0.015, 0.25], trim);
      }
    }
    for (const x of [-5.94, 0, 5.94]) {
      const y = roofY(x) + 0.24;
      box(t, 'stone', [x - 0.36, y, length - 0.24], [x + 0.36, y + 0.11, length + 0.12], trim);
      for (let k = -3; k <= 3; k++)
        leaf(
          t,
          x + k * 0.055,
          y + 0.11,
          length - 0.02,
          0.55 - Math.abs(k) * 0.07,
          0.07,
          -k * 0.23,
          trim,
        );
    }
  }
  // Individual basalt tile panels and raised cover joints, never a duplicated roof bitmap.
  for (const s of [-1, 1]) {
    const t = transform(out, s === 1 ? 0 : Math.PI);
    // A continuous stone underside seals the tile joints against sky light leaks.
    face(
      t,
      'stone',
      [
        [0, ridge - 0.07, -length],
        [0, ridge - 0.07, length],
        [half, eave - 0.07, length],
        [half, eave - 0.07, -length],
      ].toReversed(),
      stone,
    );
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 24; j++) {
        const x0 = (i * half) / 9 + 0.007,
          x1 = ((i + 1) * half) / 9 - 0.007,
          z0 = -length + (j * 2 * length) / 24 + 0.006,
          z1 = -length + ((j + 1) * 2 * length) / 24 - 0.006;
        const p = [
          [x0, roofY(x0) + 0.075, z0],
          [x0, roofY(x0) + 0.075, z1],
          [x1, roofY(x1) + 0.075, z1],
          [x1, roofY(x1) + 0.075, z0],
        ];
        face(t, 'stone', p, tint(stone, i * 29 + j));
        beam(
          t,
          'stone',
          [x0, roofY(x0) + 0.085, z0],
          [x1, roofY(x1) + 0.085, z0],
          0.055,
          0.055,
          trim,
        );
      }
  }
  beam(out, 'stone', [0, ridge + 0.1, -length], [0, ridge + 0.1, length], 0.22, 0.16, trim);
}

function buildGarni(out) {
  podium(out);
  cella(out);
  const frontX = [-5.141, -3.143, -1.084, 1.084, 3.143, 5.141];
  const z = [-7.249, -5.25, -3.15, -1.05, 1.05, 3.15, 5.25, 7.249];
  let index = 0;
  for (const zz of [z[0], z.at(-1)]) for (const x of frontX) column(out, x, zz, 0, index++);
  for (const x of [frontX[0], frontX.at(-1)])
    for (const zz of z.slice(1, -1)) column(out, x, zz, Math.PI / 2, index++);
  entablature(out);
  roof(out);
}

export const garniTemple = {
  id: 'n0498_garni_temple',
  planId: 'N0498',
  category: 'temple',
  title: 'Garni Temple',
  wikidata: 'Q684072',
  authoringFile: 'garni-temple-model.mjs',
  build: buildGarni,
  decorateMesh: compactAuthoredMesh,
  componentMap: { stone: 'garni_basalt' },
  size: [12.5, 13.6, 21],
  front: '+Z is the northern entrance and nine-step stair; signed geographic fit requires review',
  origin: 'Temple axis in plan, at the bottom-stair ground datum',
  brief:
    'Restored basalt peripteral temple with twenty-four smooth entasis columns assembled in drums, Ionic spiral capitals, an open cella doorway and barrel vault, sculpted entablature, dentils, coffered portico soffits, paired pediments, individual stone roof tiles, palmette acroteria and nine steps flanked by kneeling relief figures.',
  facts: {
    restoration: '1969–1975; Alexander Sahinyan',
    columns: 24,
    columnArrangement: [6, 8],
    columnHeightMeters: 6.54,
    columnBaseHeightMeters: [0.36, 0.37],
    columnLowerDiameterMeters: 0.692,
    columnEntasisDiameterMeters: 0.704,
    podiumHeightMeters: 2.81,
    podiumWidthMeters: 11.494,
    podiumLengthMeters: 17.598,
    entablatureHeightMeters: 1.622,
    cellaInteriorMeters: [5.05, 7.983],
    doorOpeningMeters: [2.29, 4.685],
    drawings:
      'Sahinyan, Proportional System of the Ancient Temple of Garni, Herald of the Social Sciences 12 (1979), pp.76–92',
    reading:
      'Measurements read in the accessible article text; downloaded drawing inspection was unavailable. Roof pitch and ornamental profiles are photographic reconstructions.',
  },
  refs: [
    'https://arar.sci.am/dlibra/publication/39737/edition/35633?language=en',
    'https://armeniahiddengems.aua.am/monument/garni-temple/',
    'https://www.openstreetmap.org/way/108255791',
  ],
  scaleBasis:
    'Sahinyan’s restoration measurements define the podium, order, column axes, doorway and cella. Modern photographs establish smooth drum shafts, varied restoration stones and carved decorative zones. The broad OSM outline is not used to stretch the measured temple dimensions.',
  geographicProposal: {
    anchor: [44.730218747, 40.11234151],
    heading: -2.886586468439,
    source: 'https://www.openstreetmap.org/way/108255791',
    orientationConfidence: 'axis-only',
    evidence:
      'Exact-QID mapped rectangle gives the site anchor and approximate axis. Local +Z is rotated toward the documented northern entrance.',
    limitations:
      'Mapped extent is substantially wider than the measured podium. A site rendering must resolve anchor offset, signed stair facing and ground datum before activation.',
  },
  limits: [
    'Exterior study in progress; maximum-fidelity and real-location placement approval remain pending.',
    'Individual ancient reliefs differ across the monument. Current foliage, lion heads and stair figures reconstruct their motifs without reproducing the distinct surviving carvings; facial anatomy and weathering need closer references.',
    'Roof pitch, acroterion profiles, coffer distribution, exact restored stone pattern and staircase cheek extents need drawing and photographic comparison. There is no claim of a measured survey for these elements.',
    'Adjacent palace, bathhouse, church ruins and surrounding precinct are outside this individual temple model.',
  ],
  cameras: [
    { name: 'front-order', position: [15, 9, 24], lookAt: [0, 7, 1] },
    { name: 'ionic-capital', position: [-3.4, 9.6, 10.5], lookAt: [-3.143, 9.05, 7.249] },
    { name: 'pediment-carving', position: [11, 13.4, 18], lookAt: [0, 11.4, 7.6] },
    { name: 'stair-relief', position: [7, 3.1, 13], lookAt: [4.58, 1.5, 9.6] },
    { name: 'portico-coffers', position: [1, 5.8, 8], lookAt: [0, 9.4, 5.8] },
    { name: 'cella-doorway', position: [0, 5, 9.8], lookAt: [0, 5.7, 2.8] },
    { name: 'rear-stonework', position: [-16, 7, -23], lookAt: [0, 5.6, 0] },
    { name: 'roof-tiles', position: [13, 21, 14], lookAt: [0, 11, 0] },
    { name: 'far-temple', position: [44, 24, 55], lookAt: [0, 6, 0] },
  ],
};
