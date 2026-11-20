import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const ref = 'palette:#ffffff';
const stone = [0.65, 0.59, 0.48];
const shelf = [0.53, 0.49, 0.38];
const moss = [0.405, 0.448, 0.291];
const wall = [0.55, 0.494, 0.399];
const recessTone = [0.22, 0.185, 0.146];
const pigment = [0.15, 0.126, 0.102];
const shade = (color, gain) => color.map((n) => n * gain);
const quad = (out, p, color, slot = 'rough') =>
  out.addQuad(slot, ref, p, normalFor(...p), [], color);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const block = (out, x0, x1, y0, y1, z0, z1, color = stone) =>
  box(out, 'rough', [x0, y0, z0], [x1, y1, z1], color);

const bays = [
  { name: 'port-mahon', range: [0.052, 0.367], depth: 1.32, draw: portMahon },
  { name: 'port-philipe', range: [0.397, 0.655], depth: 0.76, draw: portPhilipe },
  { name: 'quartier-de-cazerne', range: [0.682, 0.944], depth: 0.89, draw: cazerne },
];

export function decureAlcoves(a, b) {
  const [x, , z] = b.right.map((v, i) => v - a.right[i]);
  const length = Math.hypot(x, z);
  const heading = Math.atan2(-z, x);
  const out = [z / length, 0, -x / length];
  const at = (t, distance = 0) => mix(a.right, b.right, t).map((v, i) => v + out[i] * distance);
  return bays.map((bay) => {
    const [first, last] = bay.range;
    return {
      ...bay,
      heading,
      left: at(first),
      right: at(last),
      back: at((first + last) / 2, bay.depth),
      width: (last - first) * length,
    };
  });
}

// The reliefs are cut into the backing rock. Hidden rear faces of shallow
// projections share that rock surface while their edges and fronts cast shadows.
function facade(out, outline, back, front, color) {
  const b = outline.map(([x, y]) => [x, y, back]);
  const f = outline.map(([x, y]) => [x, y, front]);
  out.addConvexPolygon('rough', ref, f, [0, 0, 1], [], color);
  for (let i = 0; i < f.length; i++) {
    const j = (i + 1) % f.length;
    quad(out, [b[i], b[j], f[j], f[i]], shade(color, i === 0 ? 0.91 : 1.02));
  }
}

function engravedArch(out, x, bottom, width, height, z, detail, color = recessTone) {
  const r = width / 2,
    spring = bottom + height - r;
  const steps = detail ? 7 : 5;
  const arc = Array.from({ length: steps }, (_, i) => {
    const a = (Math.PI * i) / (steps - 1);
    return [x + r * Math.cos(a), spring + r * Math.sin(a), z];
  });
  const p = [[x - r, bottom, z], [x + r, bottom, z], ...arc];
  out.addConvexPolygon('rough', ref, p, [0, 0, 1], [], color);
  if (!detail) return;
  const outer = arc.map(([u, v, depth]) => [
    x + (u - x) * 1.26,
    spring + (v - spring) * 1.26,
    depth + 0.014,
  ]);
  for (let i = 1; i < arc.length; i++)
    quad(out, [arc[i - 1], outer[i - 1], outer[i], arc[i]], shade(stone, 1.07));
}

function gate(out, x, base, w, height, depth, detailed) {
  const left = x - w / 2,
    right = x + w / 2;
  const radius = w * 0.216;
  const spring = base + height * 0.51;
  const top = base + height;
  const faces = detailed ? 8 : 4;
  const front = depth;
  const back = depth - 0.1;
  block(out, left, x - radius, base, top, back, front);
  block(out, x + radius, right, base, top, back, front);
  const arc = (i, z) => [
    x + radius * Math.cos((Math.PI * i) / faces),
    spring + radius * Math.sin((Math.PI * i) / faces),
    z,
  ];
  for (let i = 1; i <= faces; i++) {
    const a = arc(i - 1, front),
      b = arc(i, front);
    quad(
      out,
      [a, [a[0], top, front], [b[0], top, front], b],
      shade(stone, 1.01 + 0.042 * Math.cos(i)),
    );
    quad(out, [arc(i - 1, back), a, b, arc(i, back)], shade(stone, 0.77));
  }
  quad(
    out,
    [
      [x - radius, base, back],
      [x + radius, base, back],
      [x + radius, top, back],
      [x - radius, top, back],
    ],
    recessTone,
  );
  engravedArch(
    out,
    x,
    base,
    w * 0.43,
    spring + radius - base,
    back + 0.001,
    false,
    shade(recessTone, 0.78),
  );
}

function label(out, text, y, width) {
  const faceOnly = {
    addQuad(slot, material, points, normal, uv, color) {
      if (normal[2] > 0.98) quad(out, points, color, slot);
    },
    addConvexPolygon() {},
  };
  const height = 0.085;
  const stroke = 0.0085;
  const z = 0.0195;
  const lookup = { Q: '0', O: '0', U: ' ', Z: ' ' };
  lettering(faceOnly, [...text].map((c) => lookup[c] ?? c).join(''), {
    width,
    height,
    y,
    z,
    color: pigment,
    slot: 'rough',
    stroke,
  });
  const extras = {
    Q: [[0.57, 0.3, 0.95, -0.05]],
    U: [
      [0, 1, 0, 0.2],
      [0, 0.2, 0.22, 0],
      [0.22, 0, 0.75, 0],
      [0.75, 0, 1, 0.2],
      [1, 0.2, 1, 1],
    ],
    Z: [
      [0, 1, 1, 1],
      [1, 1, 0, 0],
      [0, 0, 1, 0],
    ],
  };
  const advance = width / text.length;
  for (const [i, char] of [...text].entries()) {
    for (const [u, v, a, b] of extras[char] ?? []) {
      const p = [(i - text.length / 2 + u * 0.75) * advance, y + v * height, z + 0.002];
      const q = [(i - text.length / 2 + a * 0.75) * advance, y + b * height, z + 0.002];
      const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const dx = (-(q[1] - p[1]) * stroke) / (2 * length),
        dy = ((q[0] - p[0]) * stroke) / (2 * length);
      quad(
        out,
        [
          [p[0] + dx, p[1] + dy, p[2]],
          [p[0] - dx, p[1] - dy, p[2]],
          [q[0] - dx, q[1] - dy, q[2]],
          [q[0] + dx, q[1] + dy, q[2]],
        ],
        pigment,
      );
    }
  }
}

function tower(out, x, r, bottom, top, z, details, cap = false) {
  const sides = details ? 8 : 5;
  const ring = (y, k) => radialRing(y, r * k, r * 0.73 * k, sides, [x, z]);
  loft(
    out,
    'rough',
    details
      ? [ring(bottom, 1.12), ring(bottom + 0.072, 1.02), ring(top - 0.07, 1), ring(top, 1.13)]
      : [ring(bottom, 1.12), ring(top, 1.13)],
    shade(stone, 0.91),
  );
  if (cap) loft(out, 'rough', [ring(top, 1.13), ring(top + 0.16, 0.2)], stone);
  if (!details) return;
  for (const y of [bottom + 0.16, bottom + 0.39, top - 0.13])
    engravedArch(out, x, y, r * 0.33, 0.091, z + r * 0.735, false);
}

function stairs(out, x0, x1, y0, y1, z, run, steps, color = stone) {
  for (let i = 0; i < steps; i++) {
    const a = z + run * (1 - (i + 1) / steps);
    const top = y0 + ((y1 - y0) * (i + 1)) / steps;
    block(out, x0, x1, y0 - 0.016, top, a, a + run / steps, color);
  }
}

function diagonalSteps(out, x0, x1, min, top, z0, z1, count, color) {
  for (let i = 0; i < count; i++) {
    const a = x0 + ((x1 - x0) * i) / count,
      b = x0 + ((x1 - x0) * (i + 1)) / count;
    const y = min + ((top - min) * (i + 1)) / count;
    block(
      out,
      a,
      b,
      Math.min(min, top) - 0.035,
      Math.max(y, Math.min(min, top) + 0.024),
      z0,
      z1,
      color,
    );
  }
}

function portMahon(out, w, detail) {
  const full = detail.boneFaces;
  const near = detail.joinery;
  const h = w * 0.47;
  block(out, -h, h, 0.095, 0.66, -0.024, 0.13, shelf);
  block(out, -h, h, 0.647, 0.716, -0.021, 0.36, moss);
  block(out, -h * 0.98, h * 0.98, 0.72, 1.162, -0.017, 0.218, shade(stone, 0.93));
  const center = 0.043;
  if (near) gate(out, center, 0.725, 0.52, 0.735, 0.345, full);
  else block(out, center - 0.26, center + 0.26, 0.725, 1.46, 0.13, 0.345, stone);
  facade(
    out,
    [
      [center - 0.247, 1.46],
      [center + 0.247, 1.46],
      [center + 0.17, 1.726],
      [center - 0.17, 1.726],
    ],
    0.025,
    0.262,
    stone,
  );
  for (const sign of [-1, 1]) {
    const x = sign * h * 0.65;
    block(out, x - 0.11, x + 0.11, 0.69, 1.309, 0.08, 0.265, stone);
    if (near) tower(out, x * 0.67, 0.095, 1.08, 1.55, 0.133, full, true);
    if (!full) continue;
    for (const y of [1.15, 1.24])
      for (const d of [-0.042, 0.042]) engravedArch(out, x + d, y, 0.029, 0.063, 0.266, false);
    for (let i = 0; i < 11; i++) {
      const u = sign * (0.31 + ((h * 0.98 - 0.31) * i) / 11);
      block(out, u - 0.024, u + 0.024, 1.15, 1.205, 0.109, 0.22, shade(stone, 0.9 + i * 0.013));
    }
  }
  if (!near) {
    facade(
      out,
      [
        [-h, 0.1],
        [h, 0.1],
        [h * 0.82, 0.19],
        [-h * 0.82, 0.19],
      ],
      0.54,
      0.75,
      moss,
    );
    return;
  }
  // Two crescents rise toward the gatehouse and leave the central basin open.
  for (const sign of [-1, 1]) {
    for (let i = 0; i < (full ? 11 : 5); i++) {
      const sides = full ? 11 : 5;
      const p = (j, outer, top) => {
        const angle = (j / sides) * 1.38;
        const x = sign * (0.145 + (h - 0.122 + (outer ? 0.042 : 0)) * Math.sin(angle));
        const z = 0.325 + (outer ? 0.737 : 0.694) * (1 - Math.cos(angle)) + (outer ? 0.038 : 0);
        return [x, 0.117 + (top ? 0.29 - (0.18 * j) / sides : 0), z];
      };
      const face = [
        p(i, false, false),
        p(i + 1, false, false),
        p(i + 1, false, true),
        p(i, false, true),
      ];
      const cap = [
        p(i, false, true),
        p(i + 1, false, true),
        p(i + 1, true, true),
        p(i, true, true),
      ];
      quad(out, sign > 0 ? face : face.reverse(), shade(stone, 0.93));
      quad(out, sign > 0 ? cap.toReversed() : cap, shade(moss, 1.05));
    }
    stairs(
      out,
      sign * 0.22 - 0.058,
      sign * 0.22 + 0.058,
      0.136,
      0.365,
      0.36,
      0.15,
      full ? 6 : 3,
      stone,
    );
  }
  engravedArch(out, 0.047, 0.12, 0.115, 0.2, 0.132, full, shade(recessTone, 0.86));
  stairs(out, -h * 0.89, h * 0.89, 0.086, 0.19, 0.934, 0.125, full ? 6 : 3, moss);
  if (full) {
    stairs(out, -0.15, 0.239, 0.668, 0.748, 0.35, 0.133, 5, stone);
    for (const x of [-0.126, 0.223]) engravedArch(out, x, 1.483, 0.095, 0.104, 0.265, false);
    label(out, 'PORT MAHON', 1.92, w * 0.63);
  }
}

function portPhilipe(out, w, detail) {
  const full = detail.boneFaces;
  const h = w * 0.455;
  facade(
    out,
    [
      [-h, 0.12],
      [h, 0.12],
      [h, 0.53],
      [h * 0.18, 0.78],
      [-h, 0.5],
    ],
    0.012,
    0.277,
    shelf,
  );
  facade(
    out,
    [
      [-h, 0.75],
      [h * 0.91, 0.75],
      [h * 0.75, 1.46],
      [h * 0.19, 1.44],
      [-h, 0.92],
    ],
    0.01,
    0.294,
    stone,
  );
  block(out, -h * 0.07, h * 0.9, 0.52, 1.246, 0.175, 0.399, stone);
  if (!detail.joinery) {
    block(out, h * 0.55, h * 0.99, 0.49, 1.47, 0.26, 0.48, shelf);
    return;
  }
  tower(out, h * 0.765, 0.173, 0.438, 1.51, 0.365, full);
  if (full) gate(out, h * 0.255, 0.534, 0.29, 0.53, 0.51, true);
  else engravedArch(out, h * 0.255, 0.555, 0.129, 0.32, 0.402, false);
  diagonalSteps(
    out,
    -h * 0.99,
    h * 0.47,
    0.708,
    1.397,
    0.313,
    0.41,
    full ? 14 : 5,
    shade(stone, 0.97),
  );
  diagonalSteps(
    out,
    -h * 0.43,
    h * 0.61,
    0.511,
    0.13,
    0.296,
    0.383,
    full ? 9 : 3,
    shade(stone, 0.9),
  );
  if (!full) return;
  block(out, -h * 0.18, h * 0.57, 1.415, 1.482, 0.178, 0.348, stone);
  for (let i = 0; i < 9; i++) {
    const x = -h * 0.15 + (h * 0.72 * i) / 9;
    block(out, x - 0.015, x + 0.015, 1.47, 1.521, 0.289, 0.357, shade(stone, 1.08));
  }
  for (let i = 0; i < 7; i++) {
    const x = -h * 0.84 + (h * 0.89 * i) / 7;
    engravedArch(out, x, 0.71 + (x / h + 0.84) * 0.275, 0.048, 0.083, 0.296, false);
  }
  engravedArch(out, -h * 0.35, 0.48, 0.107, 0.208, 0.278, true);
  label(out, 'PORT PHILIPE', 1.9, w * 0.73);
}

function cazerne(out, w, detail) {
  const full = detail.boneFaces;
  const h = w * 0.467;
  facade(
    out,
    [
      [-h, 0.11],
      [h, 0.11],
      [h, 0.58],
      [-h, 0.484],
    ],
    -0.01,
    0.324,
    moss,
  );
  facade(
    out,
    [
      [-h, 0.38],
      [h, 0.5],
      [h, 0.712],
      [-h, 0.619],
    ],
    0.008,
    0.475,
    shade(moss, 1.1),
  );
  block(out, -h, h, 0.681, 1.529, 0.024, 0.267, stone);
  facade(
    out,
    [
      [-h, 1.477],
      [h, 1.477],
      [h * 0.84, 1.68],
      [-h * 0.89, 1.68],
    ],
    0.021,
    0.231,
    shade(moss, 1.05),
  );
  facade(
    out,
    [
      [-0.28, 1.48],
      [0.28, 1.48],
      [0.199, 1.791],
      [-0.199, 1.791],
    ],
    0.023,
    0.275,
    stone,
  );
  if (!detail.joinery) return;
  const center = -0.017;
  if (full) gate(out, center, 0.69, 0.29, 0.716, 0.368, true);
  else engravedArch(out, center, 0.728, 0.133, 0.467, 0.271, false);
  for (const sign of [-1, 1]) {
    tower(out, sign * h * 0.919, 0.086, 0.7, 1.471, 0.246, full, true);
    for (let j = 0; j < (full ? 4 : 2); j++) {
      const x = sign * (0.16 + ((h - 0.245) * j) / (full ? 4 : 2));
      block(out, x - 0.027, x + 0.027, 0.702, 1.452, 0.235, 0.311, shade(stone, j % 2 ? 1 : 0.94));
      if (!full) continue;
      for (const y of [0.687, 1.426])
        block(out, x - 0.038, x + 0.038, y, y + 0.05, 0.225, 0.326, stone);
      if (j === 0) continue;
      for (const y of [0.826, 1.131])
        engravedArch(out, x + sign * 0.043, y, 0.044, 0.135, 0.269, true);
      engravedArch(out, x + sign * 0.008, 1.573, 0.052, 0.067, 0.234, false);
    }
  }
  if (!full) return;
  for (let i = 0; i < 12; i++) {
    const x = -h * 0.9 + (1.8 * h * i) / 11;
    engravedArch(out, x, 0.12 + i * 0.009, 0.065, 0.16, 0.327, true, moss);
  }
  stairs(out, -0.233, 0.22, 0.596, 0.7, 0.278, 0.244, 5, shade(moss, 1.17));
  label(out, 'QUARTIER', 2.032, w * 0.49);
  label(out, 'DE CAZERNE', 1.916, w * 0.61);
}

export function buildDecureAlcoves(out, a, b, detail) {
  const alcoves = decureAlcoves(a, b);
  const top = ([x, y, z], t) => [x, y + t, z];
  const higher = (point) => top(point, a.head);
  let cursor = a.right;
  for (const bay of alcoves) {
    quad(out, [cursor, bay.left, higher(bay.left), higher(cursor)], wall);
    const aligned = transform(out, bay.heading, bay.back);
    const w = bay.width / 2,
      d = bay.depth;
    const left = [-w, 0, d],
      right = [w, 0, d],
      backL = [-w, 0, 0],
      backR = [w, 0, 0];
    quad(aligned, [left, right, backR, backL], shelf, 'foundation');
    quad(aligned, [backL, backR, higher(backR), higher(backL)], wall);
    quad(aligned, [left, backL, higher(backL), higher(left)], shade(wall, 0.87));
    quad(aligned, [backR, right, higher(right), higher(backR)], wall);
    quad(aligned, [higher(backL), higher(backR), higher(right), higher(left)], shade(wall, 0.85));
    bay.draw(aligned, bay.width, detail);
    cursor = bay.right;
  }
  quad(out, [cursor, b.right, top(b.right, b.head), higher(cursor)], wall);
}
