/** Da Nang's five-tube dragon arches, from published engineering sections and primary photographs. */
import earcut from 'earcut';
import { beam, cross, loft, normalFor, normalize, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const gold = [0.98, 0.57, 0.018],
  lightGold = [1, 0.66, 0.025];
const gray = [0.62, 0.625, 0.59],
  steel = [0.34, 0.36, 0.35],
  dark = [0.12, 0.14, 0.14];
const piers = [-333, -269, -141, 59, 187, 259, 285, 309, 333];
const deck = (x) => 7.2 + 8.9 * Math.sin((Math.PI * (x + 333)) / 950);
const edgeWidth = (x) => 17.5 + 1.25 * (0.5 + 0.5 * Math.cos(((x + 333) * Math.PI) / 32));
const at = (x, h, z) => [x, deck(x) + h, z];

function slab(out, slot, x0, x1, z0, z1, low, high, color) {
  const ring = (x) => [
    [x, deck(x) + low, z0],
    [x, deck(x) + low, z1],
    [x, deck(x) + high, z1],
    [x, deck(x) + high, z0],
  ];
  loft(out, slot, [ring(x0).reverse(), ring(x1).reverse()], color);
}
function swept(out, slot, points, radius, color, sides = 32) {
  let previousU;
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const axis = normalize(b.map((n, j) => n - a[j]));
    const projection = previousU?.reduce((sum, n, k) => sum + n * axis[k], 0);
    const u = previousU
      ? normalize(previousU.map((n, k) => n - projection * axis[k]))
      : normalize(cross(axis, Math.abs(axis[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0]));
    previousU = u;
    const v = cross(axis, u),
      r = typeof radius === 'function' ? radius(i / (points.length - 1)) : radius;
    return Array.from({ length: sides }, (_, j) => {
      const angle = (2 * Math.PI * j) / sides;
      return p.map((n, k) => n + r * (u[k] * Math.cos(angle) + v[k] * Math.sin(angle)));
    });
  });
  loft(out, slot, rings, color);
}
/** Concave cut sheet with true edge thickness. The plane basis determines its direction. */
function sheet(out, slot, polygon, origin, u, v, thickness, color) {
  let points = polygon;
  const area = points.reduce((a, p, i) => {
    const q = points[(i + 1) % points.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area < 0) points = [...points].reverse();
  const normal = cross(u, v);
  const map = (p, h) => origin.map((n, k) => n + p[0] * u[k] + p[1] * v[k] + h * normal[k]);
  const back = points.map((p) => map(p, -thickness / 2)),
    front = points.map((p) => map(p, thickness / 2));
  loft(out, slot, [back, front], color, { cap: false });
  const indices = earcut(points.flat());
  for (let i = 0; i < indices.length; i += 3)
    for (const [ring, order] of [
      [front, [0, 1, 2]],
      [back, [2, 1, 0]],
    ]) {
      const ps = order.map((j) => ring[indices[i + j]]);
      out.addTriangle(
        slot,
        'palette:#ffffff',
        ps,
        normalFor(...ps),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
}
function bolt(out, p, direction, radius = 0.065, color = steel) {
  tube(
    out,
    'steel',
    p,
    p.map((n, k) => n + direction[k] * 0.08),
    radius,
    color,
    8,
  );
}
function foundations(out) {
  for (let i = 0; i < piers.length; i++) {
    const x = piers[i],
      top = deck(x) - 3.5;
    if (i === 0 || i === 8) {
      box(out, 'concrete', [x - 1.2, 0, -18.75], [x + 1.2, top + 3.1, 18.75], gray);
      continue;
    }
    const width = i < 5 ? 7.5 : 12,
      depth = i < 5 ? 5 : 2.4;
    loft(
      out,
      'concrete',
      [
        [
          [x - depth / 2, 0, -width / 2],
          [x - depth / 2, 0, width / 2],
          [x + depth / 2, 0, width / 2],
          [x + depth / 2, 0, -width / 2],
        ],
        [
          [x - depth / 2, top - 1, -width / 2],
          [x - depth / 2, top - 1, width / 2],
          [x + depth / 2, top - 1, width / 2],
          [x + depth / 2, top - 1, -width / 2],
        ],
      ],
      gray,
    );
    box(
      out,
      'concrete',
      [x - depth / 2 - 0.5, top - 1, -7.5],
      [x + depth / 2 + 0.5, top, 7.5],
      gray,
    );
    for (const z of [-5, 5])
      box(out, 'iron', [x - 0.65, top, z - 0.55], [x + 0.65, top + 0.18, z + 0.55], dark);
    if (i < 5) {
      // Integral concrete lower arches carry the shallow upper tube arches.
      for (const direction of [-1, 1]) {
        const rows = [];
        for (let step = 0; step <= 36; step++) {
          const t = step / 36,
            px = x + direction * 22 * t,
            y = deck(x) - 7 + 5.8 * t * t;
          const zwidth = 3.75 * (1 - t) + 2.6 * t;
          rows.push(
            [
              [px, y, -zwidth],
              [px, y, zwidth],
              [px, y + 1.8, zwidth],
              [px, y + 1.8, -zwidth],
            ].reverse(),
          );
        }
        if (direction < 0) rows.reverse();
        loft(out, 'concrete', rows, gray);
      }
      for (const z of [-13.5, 13.5]) {
        tube(out, 'iron', [x, 0, z], [x, 2.2, z], 0.55, [0.26, 0.28, 0.25], 32);
        tube(out, 'concrete', [x, 2.2, z], [x, 2.35, z], 0.5, gray, 32);
      }
    }
  }
}
function deckStructure(out) {
  for (let x = -333; x < 333; x += 2) {
    const end = Math.min(333, x + 2),
      nearPier = piers.some((p) => Math.abs((x + end) / 2 - p) < 18),
      w0 = edgeWidth(x),
      w1 = edgeWidth(end);
    //14m box with two10.5m wings. The diaphragm-free inner spaces are hidden.
    slab(
      out,
      nearPier ? 'concrete' : 'iron',
      x,
      end,
      -7,
      7,
      -3.5,
      -0.32,
      nearPier ? gray : [0.42, 0.43, 0.405],
    );
    slab(out, 'concrete', x, end, -17.5, 17.5, -0.32, 0, gray);
    for (const side of [-1, 1]) {
      const bottom = [
        [x, deck(x) - 0.22, side * 15.75],
        [end, deck(end) - 0.22, side * 15.75],
        [end, deck(end) - 0.22, side * w1],
        [x, deck(x) - 0.22, side * w0],
      ];
      const top = bottom.map((p) => [p[0], p[1] + 0.39, p[2]]);
      const n = normalFor(...bottom);
      loft(
        out,
        'concrete',
        n[1] > 0 ? [bottom, top] : [[...bottom].reverse(), [...top].reverse()],
        gray,
      );
      slab(
        out,
        'road',
        x,
        end,
        side > 0 ? 3 : -15.65,
        side > 0 ? 15.65 : -3,
        0,
        0.035,
        [0.095, 0.104, 0.11],
      );
      slab(
        out,
        'brick',
        x + 0.009,
        end - 0.009,
        side > 0 ? 15.75 : -17.2,
        side > 0 ? 17.2 : -15.75,
        0.18,
        0.205,
        [0.52, 0.18, 0.095],
      );
      const a = [x, deck(x) + 0.205, side * 17.2],
        b = [end, deck(end) + 0.205, side * 17.2],
        c = [end, deck(end) + 0.205, side * (w1 - 0.13)],
        d = [x, deck(x) + 0.205, side * (w0 - 0.13)];
      if (Math.max(w0, w1) > 17.33)
        quad(out, 'brick', side > 0 ? [a, b, c, d] : [d, c, b, a], [0, 1, 0], [0.52, 0.18, 0.095]);
    }
    slab(out, 'concrete', x, end, -3, 3, 0.02, 0.24, [0.54, 0.55, 0.515]);
  }
  for (let x = -329; x < 333; x += 4) {
    for (const side of [-1, 1]) {
      beam(out, 'iron', at(x, -3.25, side * 7), at(x, -0.32, side * 17.4), 0.15, 0.48, steel);
      for (const z of [10.5, 14])
        beam(
          out,
          'iron',
          at(x, -0.31, side * z),
          at(x, -3.25 + ((z - 7) * 2.93) / 10.4, side * z),
          0.1,
          0.14,
          steel,
        );
    }
  }
  //Expansion strips belong only to actual joints at the east approaches and abutments.
  for (const x of [-332.8, 259, 285, 309, 332.8])
    for (let k = 0; k < 4; k++)
      slab(out, 'iron', x + k * 0.065, x + k * 0.065 + 0.035, -17.4, 17.4, 0.04, 0.065, dark);
}
const tubeOffsets = [
  [0, 2.1],
  [-1.62, 0.78],
  [1.62, 0.78],
  [-1.53, -0.95],
  [1.53, -0.95],
];
function archPosition(x, a, b, rise, offset = [0, 0]) {
  const t = (x - a) / (b - a),
    y = deck(x) - 7.4 + 4 * rise * t * (1 - t);
  return [x, y + offset[1], offset[0]];
}
function dragonArches(out) {
  for (const [a, b, rise] of [
    [-269, -141, 24],
    [-141, 59, 33],
    [59, 187, 24],
  ]) {
    const segments = Math.ceil(b - a);
    for (const offset of tubeOffsets) {
      const points = Array.from({ length: segments + 1 }, (_, i) =>
        archPosition(a + ((b - a) * i) / segments, a, b, rise, offset),
      );
      swept(out, 'iron', points, 0.6096, gold, 48);
    }
    for (let x = a + 8; x < b; x += 8) {
      const p = archPosition(x, a, b, rise),
        slope =
          (deck(x + 0.05) - deck(x - 0.05)) / 0.1 +
          (4 * rise * (1 - (2 * (x - a)) / (b - a))) / (b - a),
        axis = normalize([1, slope, 0]);
      const across = [0, 0, 1],
        up = normalize([-slope, 1, 0]);
      //The real connector is a cut horseshoe plate, open between its lower arms.
      const outline = [
        [-2.16, -1.3],
        [-2.22, 0.9],
        [-1.86, 1.9],
        [-0.75, 2.65],
        [0.75, 2.65],
        [1.86, 1.9],
        [2.22, 0.9],
        [2.16, -1.3],
        [0.85, -1.3],
        [0.6, -0.2],
        [-0.6, -0.2],
        [-0.85, -1.3],
      ];
      sheet(out, 'iron', outline, p, across, up, 0.14, lightGold);
      for (const [z, h] of tubeOffsets) {
        const center = p.map((n, k) => n + across[k] * z + up[k] * h);
        tube(
          out,
          'iron',
          center.map((n, k) => n - axis[k] * 0.13),
          center.map((n, k) => n + axis[k] * 0.13),
          0.65,
          lightGold,
          48,
        );
        for (let j = 0; j < 12; j++) {
          const ang = (j * Math.PI) / 6,
            head = center.map(
              (n, k) =>
                n + 0.72 * (across[k] * Math.cos(ang) + up[k] * Math.sin(ang)) + axis[k] * 0.1,
            );
          bolt(out, head, axis, 0.045, lightGold);
        }
      }
      if (p[1] > deck(x) + 2.5) {
        for (const side of [-1, 1]) {
          const upper = p.map((n, k) => n + across[k] * side * 0.65 - up[k] * 0.55),
            lower = at(x, 0.38, side * 2.52);
          for (const delta of [-0.13, 0, 0.13]) {
            const lo = [lower[0] + delta, lower[1], lower[2]],
              hi = [upper[0] + delta, upper[1], upper[2]];
            tube(out, 'steel', lo, hi, 0.038, [0.35, 0.375, 0.365], 16);
          }
          const unit = normalize(upper.map((n, k) => n - lower[k]));
          tube(
            out,
            'steel',
            lower,
            lower.map((n, k) => n + unit[k] * 0.9),
            0.175,
            [0.34, 0.36, 0.35],
            24,
          );
          tube(
            out,
            'steel',
            upper,
            upper.map((n, k) => n - unit[k] * 0.65),
            0.175,
            [0.34, 0.36, 0.35],
            24,
          );
          for (const dx of [-0.3, 0.3]) {
            const poly = [
              [-0.38, 0],
              [0.38, 0],
              [0.16, 0.82],
              [-0.16, 0.82],
            ];
            sheet(
              out,
              'iron',
              poly,
              [lower[0] + dx, deck(x) + 0.22, lower[2]],
              [0, 0, 1],
              [0, 1, 0],
              0.1,
              steel,
            );
          }
        }
      }
      //Folded dorsal scales: three sheet faces leave honest thin edges and open rears.
      if (p[1] > deck(x) + 1.2) {
        const origin = p.map((n, k) => n + up[k] * 2.7);
        const apex = origin.map((n, k) => n + up[k] * 2.7 + axis[k] * 1.6);
        const corners = [
          origin.map((n, k) => n - axis[k] * 2.3 - across[k] * 0.58),
          origin.map((n, k) => n + axis[k] * 2.3 - across[k] * 0.58),
          origin.map((n, k) => n + axis[k] * 2.3 + across[k] * 0.58),
          origin.map((n, k) => n - axis[k] * 2.3 + across[k] * 0.58),
        ];
        for (let k = 0; k < 4; k++) {
          const ps = [corners[k], corners[(k + 1) % 4], apex];
          out.addTriangle(
            'iron',
            'palette:#ffffff',
            ps,
            normalFor(...ps),
            [
              [0, 0],
              [1, 0],
              [0.5, 1],
            ],
            k % 2 ? gold : lightGold,
          );
          out.addTriangle(
            'iron',
            'palette:#ffffff',
            [...ps].reverse(),
            normalFor(...[...ps].reverse()),
            [
              [0, 0],
              [1, 0],
              [0.5, 1],
            ],
            gold,
          );
        }
      }
      for (const side of [-1, 1]) {
        const light = p.map((n, k) => n + across[k] * side * 2.35);
        sphere(out, 'marking', light, [0.13, 0.1, 0.13], [0.78, 0.82, 0.71], 12, 6);
      }
    }
  }
}
function curvedHorn(out, points, r = 0.22) {
  const samples = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const a = points[Math.max(0, segment - 1)],
      b = points[segment],
      c = points[segment + 1],
      d = points[Math.min(points.length - 1, segment + 2)];
    for (let step = 0; step < 16; step++) {
      const t = step / 16;
      samples.push(
        b.map(
          (n, k) =>
            0.5 *
            (2 * n +
              (-a[k] + c[k]) * t +
              (2 * a[k] - 5 * n + 4 * c[k] - d[k]) * t * t +
              (-a[k] + 3 * n - 3 * c[k] + d[k]) * t * t * t),
        ),
      );
    }
  }
  samples.push(points.at(-1));
  swept(out, 'iron', samples, (t) => r * (1 - 0.97 * t), lightGold, 32);
}
function headAndTail(out) {
  //The head faces east. Structural tube bundles emerge from the deck, separately
  //from the three main arches. Its skin is cut and folded plate, not a solid animal.
  const base = 214,
    baseY = deck(base);
  const h = (x, y, z) => [base + x, baseY + y, z];
  for (const [z, y] of tubeOffsets) {
    const points = Array.from({ length: 49 }, (_, i) => {
      const t = i / 48;
      return h(
        -10 + 21 * t,
        0.2 + 15.5 * t + 1.5 * Math.sin(t * Math.PI),
        z * (1 + 0.23 * t) + y * 0.025,
      );
    });
    swept(out, 'iron', points, 0.61, gold, 48);
  }
  for (const side of [-1, 1]) {
    const cheek = [];
    //The photographed cheek is an open crescent with a serrated lower mane.
    //The circular cutout matters as much as the outer silhouette.
    for (let i = 0; i <= 72; i++) {
      const a = -0.08 - (3.25 * i) / 72,
        tooth = i % 6 === 3 ? 0.8 : 0;
      cheek.push([7.8 + (6.7 + tooth) * Math.cos(a), 14 + (4.7 + tooth) * Math.sin(a)]);
    }
    for (let i = 0; i <= 56; i++) {
      const a = -3.33 + (3.25 * i) / 56;
      cheek.push([7.8 + 4.65 * Math.cos(a), 14 + 2.45 * Math.sin(a)]);
    }
    sheet(out, 'iron', cheek, h(0, 0, side * 3.4), [1, 0, 0], [0, 1, 0], 0.14, gold);
    //The dark gold inside the curved cheek in the reference is a recessed plate,
    //not an open hole through the head. Keep its inset edge readable in closeups.
    const cheekInset = Array.from({ length: 96 }, (_, i) => {
      const a = (i * Math.PI * 2) / 96;
      return [7.8 + 4.8 * Math.cos(a), 14 + (Math.sin(a) > 0 ? 2.35 : 2.6) * Math.sin(a)];
    });
    sheet(
      out,
      'iron',
      cheekInset,
      h(0, 0, side * 3.2),
      [1, 0, 0],
      [0, 1, 0],
      0.1,
      [0.9, 0.46, 0.008],
    );
    const inner = cheek.map(([x, y]) => [x - 1.1, y - 1.3]);
    sheet(out, 'iron', inner, h(0, 0, side * 2.92), [1, 0, 0], [0, 1, 0], 0.11, [0.88, 0.4, 0.005]);
    const brow = [];
    for (let i = 0; i <= 48; i++) {
      const a = Math.PI - (Math.PI * i) / 48;
      brow.push([8.7 + 5.4 * Math.cos(a), 14.3 + 3.1 * Math.sin(a)]);
    }
    for (let i = 0; i <= 48; i++) {
      const a = (Math.PI * i) / 48;
      brow.push([8.7 + 4.1 * Math.cos(a), 14.1 + 1.65 * Math.sin(a)]);
    }
    sheet(out, 'iron', brow, h(0, 0, side * 3.42), [1, 0, 0], [0, 1, 0], 0.14, lightGold);
    //Overlapping curved sheet scales wrap the rising tube neck.
    for (let i = 0; i < 7; i++) {
      const x = -4 + i * 2.2,
        y = 3.5 + i * 1.45;
      const leaf = Array.from({ length: 25 }, (_, k) => {
        const a = Math.PI - (k * Math.PI) / 24;
        return [x + 0.7 + 2.4 * Math.cos(a), y + 0.6 + 0.9 * Math.sin(a)];
      });
      leaf.push([x + 1.5, y - 0.3], [x - 1.2, y - 2.9], [x - 0.6, y - 0.4]);
      sheet(
        out,
        'iron',
        leaf,
        h(0, 0, side * (2.2 + 0.1 * i)),
        [1, 0, 0],
        [0, 1, 0],
        0.11,
        i % 2 ? gold : lightGold,
      );
    }
    sphere(out, 'iron', h(9.1, 15.9, side * 3.57), [0.75, 0.77, 0.26], lightGold, 40, 20);
    sphere(out, 'glass', h(9.22, 16.05, side * 3.81), [0.47, 0.5, 0.12], [0.25, 0.34, 0.3], 32, 16);
    for (let i = 0; i < 10; i++) {
      const a = -3.1 + (2.9 * i) / 9,
        x = 7.8 + 5.55 * Math.cos(a),
        y = 14 + 3.45 * Math.sin(a);
      tube(out, 'iron', h(x, y, side * 3.47), h(x, y, side * 3.68), 0.25, lightGold, 24);
    }
    curvedHorn(
      out,
      [
        h(4.6, 14.1, side * 3.5),
        h(2.7, 13.2, side * 4.25),
        h(0.7, 13.3, side * 4.8),
        h(0, 14.5, side * 5.1),
        h(0.9, 15.1, side * 4.9),
      ],
      0.26,
    );
    curvedHorn(
      out,
      [
        h(10.5, 17, side * 1.1),
        h(9.5, 18.6, side * 1.8),
        h(7.6, 18.6, side * 2.5),
        h(7.1, 17.5, side * 2.9),
        h(8.2, 17, side * 2.95),
      ],
      0.48,
    );
  }
  //Open snout mouth points up/east, with five short visible fire/water outlets.
  for (const [z, y] of [
    [-2.1, 15.9],
    [-1.05, 16.65],
    [0, 17],
    [1.05, 16.65],
    [2.1, 15.9],
  ]) {
    tube(out, 'iron', h(12, y, z), h(15.6, y + 0.75, z), 0.63, gold, 40);
    tube(out, 'iron', h(15.59, y + 0.75, z), h(15.64, y + 0.76, z), 0.49, dark, 40);
    tube(out, 'steel', h(15.63, y + 0.76, z), h(15.78, y + 0.79, z), 0.16, steel, 24);
  }
  for (let i = 0; i < 8; i++) {
    const x = -6 + i * 2.5;
    sheet(
      out,
      'iron',
      [
        [x, 4.5 + i * 1.55],
        [x + 2.6, 6.2 + i * 1.55],
        [x + 1.7, 3.7 + i * 1.55],
      ],
      h(0, 0, 0),
      [1, 0, 0],
      [0, 1, 0],
      0.15,
      gold,
    );
  }
  //Tail rises westward from P1, with five decreasing tubes and a serrated fan.
  for (const [z, y] of tubeOffsets) {
    const points = Array.from({ length: 45 }, (_, i) => {
      const t = i / 44;
      return [
        -280 - 19 * t,
        deck(-280) + 0.1 + 8 * t + 2 * t * t + y * 0.5 * t,
        z * (1 - 0.63 * t),
      ];
    });
    swept(out, 'iron', points, (t) => 0.61 * (1 - 0.85 * t), gold, 40);
  }
  for (let i = 0; i < 8; i++) {
    const x = -281 - i * 2.15,
      y = deck(-280) + 0.5 + i * 1.13;
    sheet(
      out,
      'iron',
      [
        [x - 2.4, y + 1],
        [x - 3.6, y + 5.1],
        [x, y + 1.7],
        [x + 1, y],
      ],
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      0.2,
      lightGold,
    );
  }
}
function railsAndFurniture(out) {
  for (const side of [-1, 1]) {
    for (let x = -333; x < 333; x += 2) {
      const end = Math.min(333, x + 2),
        z = side * (edgeWidth(x) - 0.13),
        ze = side * (edgeWidth(end) - 0.13);
      for (const h of [0.39, 1.16])
        tube(out, 'iron', at(x, h, z), at(end, h, ze), 0.045, [0.62, 0.65, 0.58], 12);
      tube(out, 'iron', at(x, 0.22, z), at(x, 1.19, z), 0.048, [0.56, 0.61, 0.51], 12);
      for (let k = 1; k < 6; k++) {
        const t = k / 6,
          px = x + (end - x) * t,
          zz = z + (ze - z) * t;
        tube(out, 'iron', at(px, 0.4, zz), at(px, 1.15, zz), 0.017, [0.39, 0.5, 0.37], 8);
      }
      slab(out, 'concrete', x, end, side > 0 ? 3 : -3.18, side > 0 ? 3.18 : -3, 0.04, 0.28, gray);
    }
    for (let x = -318; x < 327; x += 28) {
      const z = side * (edgeWidth(x) - 0.45),
        p = at(x, 0.2, z);
      tube(out, 'iron', p, [x, p[1] + 9, z], 0.1, [0.68, 0.67, 0.59], 20);
      box(out, 'iron', [x - 0.22, p[1], z - 0.22], [x + 0.22, p[1] + 0.25, z + 0.22], steel);
      for (const dx of [-1, 1]) {
        const path = [
          [x, p[1] + 8.65, z],
          [x + dx * 0.65, p[1] + 9.3, z - side * 0.15],
          [x + dx * 2.25, p[1] + 9.55, z - side * 0.75],
          [x + dx * 3, p[1] + 9.6, z - side * 1.3],
        ];
        swept(out, 'iron', path, 0.055, [0.66, 0.64, 0.53], 16);
        sphere(out, 'iron', path.at(-1), [0.52, 0.12, 0.21], [0.68, 0.67, 0.58], 20, 10);
        sphere(
          out,
          'marking',
          [path.at(-1)[0], path.at(-1)[1] - 0.09, path.at(-1)[2]],
          [0.38, 0.045, 0.16],
          [0.85, 0.85, 0.75],
          20,
          8,
        );
      }
    }
    for (const z of [3.32, 14.9])
      for (let x = -333; x < 333; x += 4)
        slab(
          out,
          'marking',
          x,
          Math.min(333, x + 4),
          side * z - 0.075,
          side * z + 0.075,
          0.042,
          0.045,
          [0.84, 0.83, 0.74],
        );
    for (const z of [7.05, 10.8])
      for (let x = -330; x < 331; x += 9)
        slab(
          out,
          'marking',
          x,
          Math.min(332, x + 4.5),
          side * z - 0.075,
          side * z + 0.075,
          0.042,
          0.045,
          [0.84, 0.83, 0.74],
        );
  }
}
export function buildDragonBridge(out) {
  foundations(out);
  deckStructure(out);
  dragonArches(out);
  headAndTail(out);
  railsAndFurniture(out);
}

export const dragonBridgeStudy = {
  mapFrameDocument: 'map-frame.json',
  id: 'N0022',
  key: 'dragon_river_bridge',
  title: 'Dragon Bridge, Da Nang',
  wikidataId: 'Q5305270',
  build: buildDragonBridge,
  brief:
    'Hybrid five-span bridge with three five-tube yellow arches, real horseshoe connectors, triple-bar splayed hangers, folded dorsal plates, layered dragon head and tail, concrete lower arches, twin sidewalks and three eastern approach spans.',
  refs: [
    'https://www.wsp.com/en-us/projects/fire-breathing-dragon-bridge-vietnam',
    'https://www.asme.org/topics-resources/content/dragon-bridge-breathes-fire-into-economy',
    'https://doi.org/10.1051/e3sconf/20161000106',
    'https://www.e3s-conferences.org/articles/e3sconf/pdf/2016/05/e3sconf_seed2016_00106.pdf',
    'https://cttdt.danangportal.gov.vn/vi/w/cau-rong-bieu-tuong-kien-truc-moi-trong-thoi-ky-hoi-nhap-i',
    'https://www.openstreetmap.org/way/694831926',
  ],
  sourceFacts: {
    lengthMeters: 666,
    mainSpansMeters: [64, 128, 200, 128, 72],
    eastApproachesMeters: [26, 24, 24],
    mainBoxWidthMeters: 14,
    cantileverWingMeters: 10.5,
    widthRangeMeters: [35, 37.5],
    vehicleLaneCount: 6,
    vehicleLaneWidthMeters: 3.75,
    sidewalkWidthMeters: 2.5,
    tubesPerArch: 5,
    tubeDiameterMeters: 1.2,
    connectorPitchMeters: 8,
    hangerBars: 3,
    hangerBarDiameterMeters: 0.065,
    mainArchRiseMeters: 25,
    mainPierWidthMeters: 7.5,
    source:
      'Chinh et al., E3S Web of Conferences10,00106(2016), sections2.1–2.4 and figures6–15; WSP/ASME designer account; Da Nang city report.',
  },
  reconstruction: {
    notes:
      'Structural dimensions follow published sections. Grade, under-deck arch curvature, canopy-free promenade undulation, plate outlines, light poles, fasteners, head cheeks and horns are photo reconstructions. Head is layered sheet steel rather than a solid sculpted mesh. Dragon details require close comparison in current captures.',
  },
  nativeAxes: {
    x: 'east toward the dragon head and the coast',
    y: 'up from pier waterline reference',
    z: 'south',
  },
  geographic: (mapped) => {
    //Aerial support spacing puts the main west abutment about9m east of the coarse
    //mapped polygon start; the latter also includes ~100m beyond eastern approaches.
    const shift = -38.3,
      c = Math.cos(mapped.heading),
      s = Math.sin(mapped.heading),
      m = 111319.49079327358;
    return {
      anchor: [
        mapped.anchor[0] + (shift * c) / (m * Math.cos((mapped.anchor[1] * Math.PI) / 180)),
        mapped.anchor[1] + (shift * s) / m,
      ],
      heading: mapped.heading,
      elevationMode: 'terrain-contact',
      notes:
        'Exact mapped Q5305270/way694831926 gives axis, independently resolved east-facing dragon head. Published666m extent is shorter than coarse760.74m map polygon. Aerial support spacing gives provisional west-abutment offset9m from mapped start, shifting model origin38.3m west of polygon center. Vertical datum and approach fit remain pending.',
    };
  },
  limitations: [
    'Head sheet contours, pipe profiles and undulating sidewalks are photographic reconstruction; close comparison remains required.',
    'Pier underwater foundations and exact deck vertical curve are not surveyed. Actual river/approach terrain fit remains pending.',
    'Fire/water effects, temporary banners and vehicles are runtime effects or separate objects.',
  ],
  camera: { position: [460, 230, 390], lookAt: [0, 15, 0], fov: 48 },
  qaCameras: [
    { name: 'south-elevation', position: [0, 35, 535], lookAt: [0, 18, 0] },
    { name: 'north-elevation', position: [-15, 68, -510], lookAt: [0, 17, 0] },
    { name: 'main-arch', position: [-80, 29, 72], lookAt: [-41, 35, 0] },
    {
      name: 'horseshoe-and-hangers',
      position: [-15, deck(-15) + 1.7, 1],
      lookAt: [-5, deck(-5) + 22, 0],
    },
    { name: 'dorsal-scales', position: [-61, 60, 18], lookAt: [-42, 43, 0] },
    { name: 'head-south', position: [242, 33, 25], lookAt: [222, 28, 0] },
    { name: 'head-front', position: [259, 36, 8], lookAt: [224, 29, 0] },
    { name: 'head-rear', position: [193, 32, -19], lookAt: [220, 28, 0] },
    { name: 'tail', position: [-319, 22, 22], lookAt: [-287, 15, 0] },
    { name: 'lower-arch', position: [64, 5, 33], lookAt: [59, 8, 0] },
    { name: 'box-and-wings', position: [-56, 9, 24], lookAt: [-40, 12, 0] },
    { name: 'sidewalk-and-lights', position: [100, 20, 27], lookAt: [125, 18, 18] },
    { name: 'east-approaches', position: [310, 32, 70], lookAt: [285, 14, 0] },
  ],
};
