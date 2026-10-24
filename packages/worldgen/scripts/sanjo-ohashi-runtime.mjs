/** Source-authored browser levels; the detailed restoration master stays untouched. */
import './install-deterministic-math.mjs';
import { beam, cross, loft, normalize, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

export const sanjoRuntimeCandidateId = 'sanjo_ohashi_bridge';

export const sanjoRuntimeSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  curb: { slot: 'wall', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.65 },
  lattice: { slot: 'trim', graph: 'metal_asanoha', roughness: 0.5, metallic: 0.1 },
  paving: { slot: 'wall', graph: 'stone_checker_fine', roughness: 0.88, metallic: 0 },
  road: { slot: 'wall', roughness: 0.97, metallic: 0 },
  marking: { slot: 'wall', roughness: 0.97, metallic: 0 },
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = {
  concrete: linear('#aaa69b'),
  stone: linear('#aaa9a1'),
  iron: linear('#61544b'),
  timber: linear('#ddd3b7'),
  bronze: linear('#6c8b79'),
  lattice: linear('#c6cbca'),
  paving: [1, 1, 1],
  curb: linear('#b39394'),
  road: linear('#41484d'),
  marking: linear('#eee9d4'),
};
const length = 73.3,
  half = length / 2,
  width = 16.7;
export const sanjoDeckY = (x) => 4.55 + 0.52 * Math.cos((x * Math.PI) / length);
function railTube(out, slot, a, b, radius, color, sides) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  const u = normalize(cross(axis, [0, 1, 0])),
    v = cross(axis, u);
  const ring = (center) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = (i * Math.PI * 2) / sides;
      return center.map((x, k) => x + radius * (u[k] * Math.cos(angle) + v[k] * Math.sin(angle)));
    });
  loft(out, slot, [ring(a), ring(b)], color);
}
function slab(out, slot, x0, x1, z0, z1, low, high) {
  loft(
    out,
    slot,
    [low, high].map((h) => [
      [x0, h(x0), z0],
      [x0, h(x0), z1],
      [x1, h(x1), z1],
      [x1, h(x1), z0],
    ]),
    colors[slot],
  );
}
function lathe(out, slot, x, y, z, profile, sides) {
  loft(
    out,
    slot,
    profile.map(([h, r]) => radialRing(y + h, r, r, sides, [x, z])),
    colors[slot],
  );
}
function paving(out, side, x0, x1) {
  const a = side > 0 ? 4.62 : -width / 2,
    b = side > 0 ? width / 2 : -4.62;
  quad(
    out,
    'paving',
    [
      [x0, sanjoDeckY(x0) + 0.165, a],
      [x0, sanjoDeckY(x0) + 0.165, b],
      [x1, sanjoDeckY(x1) + 0.165, b],
      [x1, sanjoDeckY(x1) + 0.165, a],
    ],
    [0, 1, 0],
    colors.paving,
  );
}
function finial(out, x, z, r, d) {
  const y = sanjoDeckY(x) + 0.16,
    scale = r / 0.24;
  if (d <= 1) box(out, 'timber', [x - r, y, z - r], [x + r, y + 1.12, z + r], colors.timber);
  else
    lathe(
      out,
      'timber',
      x,
      y,
      z,
      [
        [0, r],
        [1.12, r],
      ],
      d === 2 ? 12 : 16,
    );
  // Preserve the characteristic bulb, collar and pointed tip, not micro-rings/bolts.
  const profile =
    d === 0
      ? [
          [0, 0.235],
          [0.9, 0.284],
          [1.28, 0.012],
        ]
      : d === 1
        ? [
            [0, 0.24],
            [0.54, 0.228],
            [0.9, 0.284],
            [1.28, 0.012],
          ]
        : [
            [0, 0.24],
            [0.06, 0.235],
            [0.17, 0.235],
            [0.54, 0.228],
            [0.69, 0.14],
            [0.83, 0.275],
            [0.9, 0.284],
            [1.03, 0.216],
            [1.28, 0.012],
          ];
  lathe(
    out,
    'bronze',
    x,
    y + 1.1,
    z,
    profile.map(([h, r]) => [h * scale * 0.64, r * scale]),
    d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 20,
  );
}
export function buildSanjoRuntime(out, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (d === undefined) throw new Error(`Unknown Sanjō level ${level}`);
  for (let row = 1; row < 9; row++) {
    const x = -half + (length * row) / 9,
      cap = sanjoDeckY(x) - 0.87;
    const columns = d === 0 ? [0, 6] : [0, 1, 2, 3, 4, 5, 6];
    for (const column of columns) {
      const z = -6.9 + column * 2.3;
      if (d <= 1)
        box(out, 'concrete', [x - 0.47, 0, z - 0.47], [x + 0.47, cap, z + 0.47], colors.concrete);
      else {
        lathe(
          out,
          'stone',
          x,
          0,
          z,
          [
            [0, 0.64],
            [1.08, 0.64],
          ],
          d === 2 ? 8 : 12,
        );
        lathe(
          out,
          'concrete',
          x,
          1.08,
          z,
          [
            [0, 0.47],
            [0.15, 0.46],
            [cap - 1.08, 0.42],
          ],
          d === 2 ? 10 : 16,
        );
      }
    }
    box(
      out,
      'concrete',
      [x - 0.42, cap - 0.22, -7.1],
      [x + 0.42, cap + 0.08, 7.1],
      colors.concrete,
    );
    if (d > 0) box(out, 'concrete', [x - 0.26, 1.12, -6.9], [x + 0.26, 1.49, 6.9], colors.concrete);
  }
  for (const x of [-half, half])
    box(
      out,
      'concrete',
      [x - 0.65, 0, -width / 2],
      [x + 0.65, sanjoDeckY(x) - 0.32, width / 2],
      colors.concrete,
    );
  for (let span = 0; span < 9; span++) {
    const x0 = -half + (length * span) / 9,
      x1 = -half + (length * (span + 1)) / 9;
    slab(out, 'concrete', x0, x1, -width / 2, width / 2, (x) => sanjoDeckY(x) - 0.3, sanjoDeckY);
    quad(
      out,
      'road',
      [
        [x0, sanjoDeckY(x0) + 0.025, -4.35],
        [x0, sanjoDeckY(x0) + 0.025, 4.35],
        [x1, sanjoDeckY(x1) + 0.025, 4.35],
        [x1, sanjoDeckY(x1) + 0.025, -4.35],
      ],
      [0, 1, 0],
      colors.road,
    );
    for (const side of [-1, 1]) {
      paving(out, side, x0, x1);
      if (d > 0)
        slab(
          out,
          'curb',
          x0,
          x1,
          side > 0 ? 4.3 : -4.62,
          side > 0 ? 4.62 : -4.3,
          sanjoDeckY,
          (x) => sanjoDeckY(x) + 0.18,
        );
      if (d >= 2)
        slab(
          out,
          'timber',
          x0,
          x1,
          side > 0 ? 8.1 : -8.35,
          side > 0 ? 8.35 : -8.1,
          (x) => sanjoDeckY(x) - 0.62,
          (x) => sanjoDeckY(x) - 0.02,
        );
    }
    if (d >= 2)
      for (let g = 0; g < 13; g++) {
        const z = -7.35 + g * 1.225;
        if (d === 2 && g > 0 && g < 12) {
          slab(
            out,
            'iron',
            x0 + 0.045,
            x1 - 0.045,
            z - 0.11,
            z + 0.11,
            (x) => sanjoDeckY(x) - 0.85,
            (x) => sanjoDeckY(x) - 0.3,
          );
          continue;
        }
        for (const [a, b, w] of [
          [-0.85, -0.8, 0.22],
          [-0.8, -0.35, 0.035],
          [-0.35, -0.3, 0.22],
        ])
          slab(
            out,
            'iron',
            x0 + 0.045,
            x1 - 0.045,
            z - w / 2,
            z + w / 2,
            (x) => sanjoDeckY(x) + a,
            (x) => sanjoDeckY(x) + b,
          );
      }
  }
  for (const side of [-1, 1]) {
    const z = side * (width / 2 - 0.21),
      pitch = (length - 0.6) / 36;
    for (let i = 0; i <= 36; i++) {
      const x = -half + 0.3 + i * pitch,
        y = sanjoDeckY(x) + 0.16;
      if (i % 6 === 0) finial(out, x, z, i === 0 || i === 36 ? 0.21 : 0.24, d);
      else if (d >= 2 || (d === 1 && i % 2 === 0))
        box(
          out,
          'timber',
          [x - 0.115, y, z - 0.12],
          [x + 0.115, y + 0.84, z + 0.12],
          colors.timber,
        );
      if (d >= 2 && i % 6 !== 0) {
        box(
          out,
          'iron',
          [x - 0.04, y + 0.39, z + side * 0.13 - 0.009],
          [x + 0.04, y + 0.66, z + side * 0.13 + 0.009],
          colors.iron,
        );
        if (d === 3)
          box(
            out,
            'iron',
            [x - 0.17, y + 0.49, z + side * 0.13 - 0.009],
            [x + 0.17, y + 0.56, z + side * 0.13 + 0.009],
            colors.iron,
          );
      }
    }
    const railSegments = d === 0 ? 3 : d <= 2 ? 9 : 36;
    for (let i = 0; i < railSegments; i++) {
      const a = -half + 0.3 + ((length - 0.6) * i) / railSegments,
        b = -half + 0.3 + ((length - 0.6) * (i + 1)) / railSegments;
      const heights = d === 0 ? [1.18] : [0.28, 0.69, 1.18];
      for (const h of heights) {
        if (d >= 2 && h === 1.18)
          railTube(
            out,
            'timber',
            [a, sanjoDeckY(a) + h, z],
            [b, sanjoDeckY(b) + h, z],
            0.105,
            colors.timber,
            d === 2 ? 8 : 12,
          );
        else
          beam(
            out,
            'timber',
            [a, sanjoDeckY(a) + h, z],
            [b, sanjoDeckY(b) + h, z],
            h === 1.18 ? 0.21 : 0.18,
            h === 0.28 ? 0.21 : 0.14,
            colors.timber,
          );
      }
    }
    if (d > 0) {
      const roadSegments = d === 1 ? 9 : 32,
        rz = side * 4.46;
      for (let i = 0; i <= roadSegments; i++) {
        const x = -half + 0.4 + ((length - 0.8) * i) / roadSegments,
          y = sanjoDeckY(x) + 0.17;
        box(out, 'iron', [x - 0.065, y, rz - 0.07], [x + 0.065, y + 0.94, rz + 0.07], colors.iron);
        if (i === roadSegments) continue;
        const end = -half + 0.4 + ((length - 0.8) * (i + 1)) / roadSegments;
        for (const h of [0.18, 0.78, 0.94])
          beam(
            out,
            'iron',
            [x, y + h, rz],
            [end, sanjoDeckY(end) + 0.17 + h, rz],
            0.055,
            0.055,
            colors.iron,
          );
        const p = [
          [x + 0.1, sanjoDeckY(x + 0.1) + 0.39, rz],
          [end - 0.1, sanjoDeckY(end - 0.1) + 0.39, rz],
          [end - 0.1, sanjoDeckY(end - 0.1) + 0.92, rz],
          [x + 0.1, sanjoDeckY(x + 0.1) + 0.92, rz],
        ];
        quad(out, 'lattice', p, [0, 0, 1], colors.lattice);
        quad(out, 'lattice', [...p].reverse(), [0, 0, -1], colors.lattice);
      }
    }
  }
  if (d > 0)
    for (let x = -half + 0.15; x < half; x += 3) {
      const end = Math.min(half, x + 2);
      quad(
        out,
        'marking',
        [
          [x, sanjoDeckY(x) + 0.03, -0.055],
          [x, sanjoDeckY(x) + 0.03, 0.055],
          [end, sanjoDeckY(end) + 0.03, 0.055],
          [end, sanjoDeckY(end) + 0.03, -0.055],
        ],
        [0, 1, 0],
        colors.marking,
      );
    }
}
export const buildSanjoSkyline = (out) => buildSanjoRuntime(out, 'skyline');
