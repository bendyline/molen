import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  shell: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  paving: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.92 },
  ribs: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  paint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.97 },
};

const ref = 'palette:#ffffff';
const concrete = [0.72, 0.69, 0.61];
const shadow = [0.39, 0.37, 0.32];
const roof = [0.71, 0.68, 0.59];
const tile = [0.61, 0.54, 0.45];
const seats = [0.5, 0.081, 0.073];
const trim = [0.22, 0.26, 0.26];
const stairNosing = [0.76, 0.45, 0.057];
const blue = [0.052, 0.254, 0.47];
const courtSkirt = [0.035, 0.139, 0.25];
const courtApron = [0.54, 0.55, 0.52];
const basketFrame = [0.078, 0.248, 0.145];
const cutawayBlue = [0.32, 0.42, 0.51];
const turquoise = [0.064, 0.45, 0.53];
const white = [0.94, 0.89, 0.76];
const courtY = 0.087;
// The four November 2011 views constrain the shell width and the entrance slot.
const horizontalScale = 1.14;
const cut = 0.21;
const first = Math.PI / 2 + cut;
const sweep = Math.PI * 2 - 2 * cut;
// The overhead photograph shows three recessed openings into the lower seating.
const entranceAngles = [3.07, 6.19, 2 * Math.PI + 0.736];

const tiers = {
  skyline: { spans: 20, rows: 3, detail: 0 },
  district: { spans: 34, rows: 7, detail: 1 },
  street: { spans: 48, rows: 11, detail: 2 },
  closeup: { spans: 64, rows: 13, detail: 3 },
  master: { spans: 80, rows: 13, detail: 4 },
};

function quad(out, slot, points, facing, color) {
  const normal = normalFor(points[0], points[1], points[2]);
  const direction = normal.reduce((sum, value, i) => sum + value * facing[i], 0);
  const face = direction >= 0 ? points : [points[0], points[3], points[2], points[1]];
  const n = direction >= 0 ? normal : normal.map((value) => -value);
  for (const triangle of [
    [face[0], face[1], face[2]],
    [face[0], face[2], face[3]],
  ]) {
    out.addTriangle(slot, ref, triangle, n, [], color);
  }
}

const onEllipse = (angle, [rx, rz, height]) => [rx * Math.cos(angle), height, rz * Math.sin(angle)];

function span(out, slot, start, end, from, to, facing, color) {
  quad(
    out,
    slot,
    [onEllipse(start, from), onEllipse(end, from), onEllipse(end, to), onEllipse(start, to)],
    facing,
    color,
  );
}

function entranceFacadeBay(out, angle, tier, gate) {
  const outward = [Math.cos(angle), 0, Math.sin(angle)];
  const windowBase = [1.643, 1.251, 0.299];
  const windowTop = [1.66, 1.266, 0.401];
  span(out, 'ribs', angle - 0.092, angle + 0.092, windowBase, windowTop, outward, trim);
  const grille = [0.55, 0.49, 0.38];
  if (tier.detail >= 3) {
    for (let i = -4; i <= 4; i++) {
      const bar = angle + i * 0.02;
      span(
        out,
        'ribs',
        bar - 0.0017,
        bar + 0.0017,
        [1.648, 1.256, windowBase[2]],
        [1.665, 1.271, windowTop[2]],
        outward,
        grille,
      );
    }
  }
  span(
    out,
    'ribs',
    angle - 0.092,
    angle + 0.092,
    [1.656, 1.264, 0.345],
    [1.657, 1.265, 0.351],
    outward,
    grille,
  );
  if (!gate) return;
  span(
    out,
    'ribs',
    angle - 0.081,
    angle + 0.081,
    [1.618, 1.233, 0.042],
    [1.641, 1.253, 0.168],
    outward,
    blue,
  );
  for (let i = -3; i <= 3; i++) {
    const bar = angle + i * 0.023;
    span(
      out,
      'ribs',
      bar - 0.0023,
      bar + 0.0023,
      [1.623, 1.238, 0.044],
      [1.646, 1.258, 0.163],
      outward,
      [0.48, 0.61, 0.66],
    );
  }
}

function exterior(out, tier) {
  const wallBase = [1.59, 1.205, 0.04];
  const wallTop = [1.66, 1.26, 0.463];
  const eave = [1.745, 1.33, 0.475];
  const shoulder = [1.575, 1.195, 0.635];
  const rim = [1.3, 0.985, 0.744];
  const well = [1.282, 0.966, 0.738];
  const wellBase = [1.28, 0.965, 0.61];
  for (let i = 0; i < tier.spans; i++) {
    const start = first + (sweep * i) / tier.spans;
    const end = first + (sweep * (i + 1)) / tier.spans;
    const mid = (start + end) * 0.5;
    const outward = [Math.cos(mid), 0, Math.sin(mid)];
    span(out, 'shell', start, end, wallBase, wallTop, outward, concrete);
    span(out, 'ribs', start, end, [1.656, 1.26, 0.404], [1.669, 1.269, 0.445], outward, trim);
    span(out, 'shell', start, end, wallTop, eave, [0, -1, 0], shadow);
    span(out, 'shell', start, end, eave, shoulder, outward, roof);
    span(out, 'shell', start, end, shoulder, rim, [0, 1, 0], roof);
    span(out, 'shell', start, end, rim, well, [0, 1, 0], concrete);
    span(
      out,
      'shell',
      start,
      end,
      well,
      wellBase,
      outward.map((v) => -v),
      shadow,
    );
  }
  for (const [angle, sign] of [
    [first, 1],
    [first + sweep, -1],
  ]) {
    const cheek = [sign, 0, 0];
    quad(
      out,
      'shell',
      [
        onEllipse(angle, wallBase),
        onEllipse(angle, wallTop),
        onEllipse(angle, wellBase),
        onEllipse(angle, [0.86, 0.56, 0.04]),
      ],
      cheek,
      cutawayBlue,
    );
    quad(
      out,
      'shell',
      [
        onEllipse(angle, wallTop),
        onEllipse(angle, eave),
        onEllipse(angle, shoulder),
        onEllipse(angle, wellBase),
      ],
      cheek,
      cutawayBlue,
    );
    quad(
      out,
      'shell',
      [
        onEllipse(angle, shoulder),
        onEllipse(angle, rim),
        onEllipse(angle, well),
        onEllipse(angle, wellBase),
      ],
      cheek,
      cutawayBlue,
    );
  }
  // The pale upper lip crosses the cutaway in the dated panoramas.
  const lip = [1.294, 0.979, 0.711];
  for (let i = 0; i < 4; i++) {
    const a = first - (2 * cut * (4 - i)) / 4;
    const b = a + cut / 2;
    span(out, 'shell', a, b, lip, rim, [0, 0, 1], concrete);
    span(out, 'shell', a, b, rim, well, [0, 1, 0], concrete);
    span(out, 'shell', a, b, well, lip, [0, 0, -1], shadow);
  }
  if (tier.detail === 0) return;
  const supports = tier.detail > 1 ? 23 : 15;
  for (let i = 0; i < supports; i++) {
    const angle = first + (sweep * (i + 0.5)) / supports;
    const foot = onEllipse(angle, [1.61, 1.225, 0.06]);
    const head = onEllipse(angle, [1.715, 1.3, 0.477]);
    beam(out, 'shell', foot, head, 0.055, 0.072, concrete);
    if (tier.detail < 2) continue;
    const hood = onEllipse(angle, [1.56, 1.18, 0.655]);
    const end = onEllipse(angle, [1.32, 1.007, 0.755]);
    beam(out, 'shell', hood, end, 0.028, 0.022, concrete);
    if (i > 0 && i < supports - 1) {
      const crown = [1.529, 1.161, 0.665];
      const cap = [1.392, 1.052, 0.722];
      const duct = [0.81, 0.78, 0.69];
      beam(out, 'ribs', onEllipse(angle, crown), onEllipse(angle + 0.023, cap), 0.023, 0.018, duct);
      beam(
        out,
        'ribs',
        onEllipse(angle - 0.055, cap),
        onEllipse(angle + 0.096, cap),
        0.025,
        0.02,
        duct,
      );
    }
    const gate = i === 0 || i === supports - 1;
    if (i < 4 || i >= supports - 4) {
      const inward = i < supports / 2 ? 1 : -1;
      entranceFacadeBay(out, angle + (inward * sweep) / (2 * supports), tier, gate);
    }
    if (i > 1 && i < supports - 2 && i % 3 === 0) {
      const door = angle + 0.1;
      span(
        out,
        'paint',
        door - 0.037,
        door + 0.037,
        [1.619, 1.232, 0.047],
        [1.643, 1.256, 0.152],
        [Math.cos(door), 0, Math.sin(door)],
        blue,
      );
    }
  }
  for (const x of [-1.31, 1.31])
    box(out, 'shell', [x - 0.068, 0.7, -0.057], [x + 0.068, 0.819, 0.057], concrete);
}

function entrancePlanting(out, tier) {
  for (const side of [-1, 1]) {
    const center = [side * 0.967, 1.182];
    loft(
      out,
      'paving',
      [radialRing(0.04, 0.257, 0.153, 12, center), radialRing(0.051, 0.252, 0.148, 12, center)],
      [0.39, 0.37, 0.3],
    );
    const foliage = [0.15, 0.21, 0.099];
    const count = tier.detail >= 3 ? 13 : 6;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      const h = 0.033 + 0.021 * (0.5 + 0.5 * Math.sin(i * 2.48 + side));
      const x = center[0] + 0.18 * Math.cos(angle);
      const z = center[1] + 0.083 * Math.sin(angle);
      const tone = foliage.map((value) => value * (0.79 + 0.33 * Math.abs(Math.cos(i * 1.6))));
      sphere(out, 'paint', [x, 0.054 + 0.52 * h, z], [0.067, h, 0.052], tone, 7, 4);
    }
    sphere(out, 'paint', [center[0], 0.081, center[1]], [0.175, 0.05, 0.079], foliage, 8, 4);
  }
}

function bowl(out, tier) {
  const inset = (f, y) => [0.86 + 0.409 * f, 0.56 + 0.403 * f, y];
  const step = sweep / tier.spans;
  const entranceWidth = Math.max(2, Math.round(0.22 / step));
  const entrances =
    tier.detail < 2
      ? []
      : entranceAngles.map((angle) => {
          const start = Math.round((angle - first) / step - entranceWidth / 2);
          return [start, start + entranceWidth];
        });
  const bottomRow = Math.floor(tier.rows * 0.27);
  const topRow = Math.ceil(tier.rows * 0.54);
  const endAisles = new Set(entrances.slice(0, 2).map(([left]) => left - 1));
  const low = bottomRow / tier.rows;
  const high = topRow / tier.rows;
  const floorY = 0.099 + 0.51 * low;
  const lintelY = 0.099 + 0.51 * high;
  for (const [left, right] of entrances) {
    const a = first + left * step;
    const b = first + right * step;
    const middle = (a + b) * 0.5;
    const inward = [-Math.cos(middle), 0, -Math.sin(middle)];
    span(out, 'shell', a, b, inset(low, floorY), inset(high, floorY), [0, 1, 0], shadow);
    span(
      out,
      'paint',
      a,
      b,
      inset(high, floorY),
      inset(high, lintelY - 0.023),
      inward,
      [0.122, 0.113, 0.1],
    );
    span(out, 'shell', a, b, inset(high, lintelY - 0.023), inset(high, lintelY), inward, concrete);
    // Close the sides of the recess against the adjacent stepped rows.
    for (const [angle, side] of [
      [a, 1],
      [b, -1],
    ]) {
      for (let row = bottomRow; row < topRow; row++) {
        const inner = row / tier.rows;
        const outer = (row + 1) / tier.rows;
        const y = 0.099 + 0.51 * inner;
        if (y > floorY) {
          quad(
            out,
            'shell',
            [
              onEllipse(angle, inset(inner, floorY)),
              onEllipse(angle, inset(outer, floorY)),
              onEllipse(angle, inset(outer, y)),
              onEllipse(angle, inset(inner, y)),
            ],
            [-side * Math.sin(angle), 0, side * Math.cos(angle)],
            shadow,
          );
        }
      }
    }
  }
  for (let row = 0; row < tier.rows; row++) {
    const lower = row / tier.rows;
    const upper = (row + 1) / tier.rows;
    const y0 = 0.099 + 0.51 * lower;
    const y1 = 0.099 + 0.51 * upper;
    if (lower < 0.23) {
      const steps = Math.ceil((2 * cut * tier.spans) / sweep);
      for (let j = 0; j < steps; j++) {
        const start = first - 2 * cut + (2 * cut * j) / steps;
        const end = first - 2 * cut + (2 * cut * (j + 1)) / steps;
        span(out, 'shell', start, end, inset(lower, y0), inset(upper, y0), [0, 1, 0], concrete);
        span(out, 'shell', start, end, inset(upper, y0), inset(upper, y1), [0, 0, -1], concrete);
      }
    }
    for (let i = 0; i < tier.spans; i++) {
      if (row >= bottomRow && row < topRow && entrances.some(([a, b]) => a <= i && i < b)) continue;
      const start = first + (sweep * i) / tier.spans;
      const end = first + (sweep * (i + 1)) / tier.spans;
      const middle = (start + end) * 0.5;
      const aisle = Math.abs(Math.cos(middle * 4)) < 0.12;
      span(out, 'shell', start, end, inset(lower, y0), inset(upper, y0), [0, 1, 0], concrete);
      span(
        out,
        'shell',
        start,
        end,
        inset(upper, y0),
        inset(upper, y1),
        [-Math.cos(middle), 0, -Math.sin(middle)],
        concrete,
      );
      if (row === 0 && tier.detail > 0) {
        span(
          out,
          'paint',
          start,
          end,
          inset(lower, 0.04),
          inset(lower, y0),
          [-Math.cos(middle), 0, -Math.sin(middle)],
          courtSkirt,
        );
      }
      // The overhead view records yellow stair noses beside the two end recesses.
      if (endAisles.has(i) && row >= bottomRow - 2 && row < topRow) {
        const rise = upper - lower;
        span(
          out,
          'paint',
          start + (end - start) * 0.17,
          end - (end - start) * 0.09,
          inset(lower + rise * 0.08, y0 + 0.0015),
          inset(lower + rise * 0.35, y0 + 0.0015),
          [0, 1, 0],
          stairNosing,
        );
        if (tier.detail >= 3) {
          const railAngle = start + (end - start) * 0.11;
          const foot = onEllipse(railAngle, inset(lower, y0));
          const top = onEllipse(railAngle, inset(lower, y0 + 0.036));
          const next = onEllipse(railAngle, inset(upper, y1 + 0.036));
          beam(out, 'ribs', foot, top, 0.003, 0.003, trim);
          beam(out, 'ribs', top, next, 0.0035, 0.0035, trim);
        }
        continue;
      }
      if (aisle || tier.detail === 0) continue;
      const seatAngle = (end - start) * 0.085;
      const spread = upper - lower;
      span(
        out,
        'paint',
        start + seatAngle,
        end - seatAngle,
        inset(upper - spread * 0.53, y0 + 0.006),
        inset(upper - spread * 0.13, y0 + 0.006),
        [0, 1, 0],
        seats,
      );
      if (tier.detail >= 2) {
        const count = tier.detail >= 3 ? 2 : 1;
        const pitch = (end - start - 2 * seatAngle) / count;
        for (let j = 0; j < count; j++) {
          const a = start + seatAngle + pitch * (j + 0.043);
          const b = start + seatAngle + pitch * (j + 0.957);
          const back = (height, lean) => {
            const inner = inset(upper - spread * 0.29 + lean, height);
            const outer = inset(upper - spread * 0.14 + lean, height);
            return [
              onEllipse(a, inner),
              onEllipse(b, inner),
              onEllipse(b, outer),
              onEllipse(a, outer),
            ];
          };
          loft(out, 'paint', [back(y0 + 0.004, 0), back(y0 + 0.023, spread * 0.06)], seats);
        }
      }
      const occupancy = (i * 91 + row * 53 + Math.floor(i / 7) * 11) % 17;
      if (tier.detail < 2 || occupancy >= tier.detail * 3) continue;
      const [x, y, z] = onEllipse(middle, inset(upper - spread * 0.37, y0 + 0.006));
      const shirts = [
        [0.12, 0.23, 0.46],
        [0.75, 0.61, 0.2],
        [0.62, 0.6, 0.54],
        [0.37, 0.085, 0.077],
      ];
      box(
        out,
        'paint',
        [x - 0.012, y, z - 0.012],
        [x + 0.012, y + 0.036, z + 0.012],
        shirts[(row + i) % shirts.length],
      );
      if (tier.detail >= 3)
        box(
          out,
          'paint',
          [x - 0.008, y + 0.036, z - 0.008],
          [x + 0.008, y + 0.051, z + 0.008],
          [0.57, 0.37, 0.26],
        );
    }
  }
}

function line(out, [x0, z0], [x1, z1], color, width = 0.005, y = courtY + 0.004) {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const dx = ((z1 - z0) * width * 0.5) / length;
  const dz = ((x1 - x0) * width * 0.5) / length;
  quad(
    out,
    'paint',
    [
      [x0 - dx, y, z0 + dz],
      [x1 - dx, y, z1 + dz],
      [x1 + dx, y, z1 - dz],
      [x0 + dx, y, z0 - dz],
    ],
    [0, 1, 0],
    color,
  );
}

function arc(out, center, radius, start, end, segments, color = white, y = courtY + 0.004) {
  for (let i = 0; i < segments; i++) {
    const a = start + ((end - start) * i) / segments;
    const b = start + ((end - start) * (i + 1)) / segments;
    line(
      out,
      [center + radius * Math.cos(a), radius * Math.sin(a)],
      [center + radius * Math.cos(b), radius * Math.sin(b)],
      color,
      0.005,
      y,
    );
  }
}

function landing(out, tier) {
  const height = 0.041;
  const tileRectangle = (left, front, right, back, color) =>
    quad(
      out,
      'paint',
      [
        [left, height, front],
        [left, height, back],
        [right, height, back],
        [right, height, front],
      ],
      [0, 1, 0],
      color,
    );
  const tileRing = (
    [left, front, right, back],
    [innerLeft, innerFront, innerRight, innerBack],
    color,
  ) => {
    tileRectangle(left, front, right, innerFront, color);
    tileRectangle(left, innerBack, right, back, color);
    tileRectangle(left, innerFront, innerLeft, innerBack, color);
    tileRectangle(innerRight, innerFront, right, innerBack, color);
  };
  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 12; column++) {
      const x = -0.528 + 0.088 * column;
      const z = 0.69 + 0.08 * row;
      const color = (row + column) % 2 === 0 ? [0.49, 0.45, 0.43] : [0.524, 0.48, 0.455];
      const bounds = [x, z, x + 0.086, z + 0.078];
      if (tier.detail < 3) {
        tileRectangle(...bounds, color);
        continue;
      }
      const cx = x + 0.043;
      const cz = z + 0.039;
      const square = (half) => [cx - half, cz - half, cx + half, cz + half];
      const hasBorder = row % 2 === 0 && column % 2 === 0;
      const center = square(0.007);
      if (hasBorder) {
        const outer = square(0.027);
        const inner = square(0.02);
        tileRing(bounds, outer, color);
        tileRing(outer, inner, [0.59, 0.538, 0.49]);
        tileRing(inner, center, color);
      } else {
        tileRing(bounds, center, color);
      }
      tileRectangle(...center, [0.64, 0.59, 0.53]);
    }
  }
}

function court(out, tier) {
  box(out, 'paving', [-1.8, -0.11, -1.4], [1.8, 0.04, 1.44], tile);
  box(out, 'paint', [-0.61, 0.04, -0.343], [0.61, courtY - 0.007, 0.343], blue);
  box(out, 'paint', [-0.56, courtY - 0.008, -0.3], [0.56, courtY, 0.3], [0.69, 0.49, 0.322]);
  line(out, [0, -0.298], [0, 0.298], white);
  if (tier.detail === 0) return;
  // The concrete apron reaches the skirt at the foot of the seating.
  const apron = [0.862, 0.562, 0.047];
  const segments = tier.spans + Math.ceil((2 * cut * tier.spans) / sweep);
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    const b = (2 * Math.PI * (i + 1)) / segments;
    out.addTriangle(
      'shell',
      ref,
      [[0, apron[2], 0], onEllipse(b, apron), onEllipse(a, apron)],
      [0, 1, 0],
      [],
      courtApron,
    );
  }
  const boundary = [
    [-0.557, -0.297],
    [0.557, -0.297],
    [0.557, 0.297],
    [-0.557, 0.297],
  ];
  boundary.forEach((point, i) => {
    line(out, point, boundary[(i + 1) % 4], white);
  });
  if (tier.detail >= 2) {
    const secondaryLines = [0.86, 0.8, 0.68];
    for (const x of [-0.19, 0.19]) line(out, [x, -0.297], [x, 0.297], secondaryLines, 0.0035);
    for (const z of [-0.18, 0.18])
      line(out, [-0.19, z], [0.19, z], secondaryLines, 0.0035, courtY + 0.0035);
  }
  for (let i = 0; i < 20; i++) {
    const a = (2 * Math.PI * i) / 20;
    const b = (2 * Math.PI * (i + 1)) / 20;
    const y = courtY + 0.002;
    out.addTriangle(
      'paint',
      ref,
      [
        [0, y, 0],
        [0.07 * Math.cos(b), y, 0.07 * Math.sin(b)],
        [0.07 * Math.cos(a), y, 0.07 * Math.sin(a)],
      ],
      [0, 1, 0],
      [],
      turquoise,
    );
  }
  arc(out, 0, 0.071, 0, 2 * Math.PI, 20);
  for (const sign of [-1, 1]) {
    const freeThrow = sign * 0.329;
    quad(
      out,
      'paint',
      [
        [sign * 0.558, courtY + 0.002, -0.111],
        [freeThrow, courtY + 0.002, -0.07],
        [freeThrow, courtY + 0.002, 0.07],
        [sign * 0.558, courtY + 0.002, 0.111],
      ],
      [0, 1, 0],
      turquoise,
    );
    arc(out, freeThrow, 0.071, 0, 2 * Math.PI, 16);
    const inward = sign < 0 ? 0 : Math.PI;
    arc(out, sign * 0.49, 0.247, inward - Math.PI / 2, inward + Math.PI / 2, 18);
    if (tier.detail < 2) continue;
    for (const z of [-0.247, 0.247])
      line(out, [sign * 0.49, z], [sign * 0.557, z], white, 0.005, courtY + 0.0035);
    beam(
      out,
      'ribs',
      [sign * 0.592, courtY, 0],
      [sign * 0.592, 0.235, 0],
      0.016,
      0.017,
      basketFrame,
    );
    beam(out, 'ribs', [sign * 0.592, 0.23, 0], [sign * 0.53, 0.23, 0], 0.011, 0.011, basketFrame);
    box(
      out,
      'paint',
      [sign * 0.528 - 0.004, 0.207, -0.036],
      [sign * 0.528 + 0.004, 0.256, 0.036],
      white,
    );
    arc(out, sign * 0.501, 0.013, 0, 2 * Math.PI, 10, [0.7, 0.23, 0.062], 0.217);
  }
  if (tier.detail < 2) return;
  landing(out, tier);
  for (const [x, z, color] of [
    [-0.31, -0.11, blue],
    [-0.11, 0.12, white],
    [0.09, -0.18, blue],
    [0.22, 0.04, white],
    [0.36, 0.16, blue],
  ]) {
    box(
      out,
      'paint',
      [x - 0.012, courtY, z - 0.012],
      [x + 0.012, courtY + 0.048, z + 0.012],
      color,
    );
    box(
      out,
      'paint',
      [x - 0.008, courtY + 0.048, z - 0.008],
      [x + 0.008, courtY + 0.061, z + 0.008],
      [0.57, 0.37, 0.26],
    );
  }
}

export function buildArena(out, level) {
  const tier = tiers[level];
  const scaled =
    (method) =>
    (slot, ref, points, [nx, ny, nz], uv, color) => {
      const normal = [nx / horizontalScale, ny, nz / horizontalScale];
      const magnitude = Math.hypot(...normal);
      out[method](
        slot,
        ref,
        points.map(([x, y, z]) => [x * horizontalScale, y, z * horizontalScale]),
        normal.map((value) => value / magnitude),
        uv,
        color,
      );
    };
  const builder = {
    addQuad: scaled('addQuad'),
    addTriangle: scaled('addTriangle'),
    addConvexPolygon: scaled('addConvexPolygon'),
  };
  court(builder, tier);
  exterior(builder, tier);
  bowl(builder, tier);
  if (tier.detail >= 2) entrancePlanting(builder, tier);
}

export const buildSkyline = (out) => buildArena(out, 'skyline');
export const buildDistrict = (out) => buildArena(out, 'district');
export const buildStreet = (out) => buildArena(out, 'street');
export const buildCloseup = (out) => buildArena(out, 'closeup');
