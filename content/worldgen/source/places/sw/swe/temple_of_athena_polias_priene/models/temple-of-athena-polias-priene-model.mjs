/** The standing marble ruins at Priene, including the re-erected northern colonnade. */
import {
  block,
  face,
  palette,
  pavilion,
  rect,
  ring,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  marble: surface('wall', 'stone_marble', 0.9),
  aged: surface('trim', 'stone_limestone_raw', 0.94),
  base: surface('foundation', 'stone_ashlar', 0.95),
};
const colors = palette({
  light: 'e0dbcc',
  pale: 'd2cbbb',
  warm: 'c5bba6',
  grey: 'bab8aa',
  worn: 'a9a494',
  stone: '989483',
  deep: '817c6f',
});
const stoneTones = [colors.pale, colors.light, colors.grey, colors.warm];

function stone(out, x, y, z, width, height, depth, turn, color) {
  const corners = [
    [-0.48, -0.5],
    [0.41, -0.49],
    [0.51, -0.28],
    [0.47, 0.36],
    [0.24, 0.5],
    [-0.45, 0.46],
    [-0.52, 0.17],
  ];
  const c = Math.cos(turn),
    s = Math.sin(turn);
  const outline = corners.map(([u, v]) => [
    x + u * width * c - v * depth * s,
    z + u * width * s + v * depth * c,
  ]);
  shell(out, outline, () => y, y + height, { wall: 'aged', color, roofColor: color });
}

function columnDrum(out, [x, z], bottom, top, lower, upper, segments, flutes, color, turn = 0) {
  function point(i, y, radius) {
    const step = (i * 2 * Math.PI) / segments;
    const a = step + turn;
    const groove = flutes ? 0.046 * (0.5 - 0.5 * Math.cos(flutes * step)) : 0;
    return [x + Math.cos(a) * (radius - groove), y, z + Math.sin(a) * (radius - groove)];
  }
  const upperRim = [];
  for (let i = 0; i < segments; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / segments + turn;
    const corners = [
      point(i, bottom, lower),
      point(i + 1, bottom, lower),
      point(i + 1, top, upper),
      point(i, top, upper),
    ];
    face(out, 'marble', corners, [Math.cos(a), 0, Math.sin(a)], color);
    upperRim.push(corners[3]);
  }
  for (let i = 0; i < segments; i++)
    face(out, 'marble', [upperRim[i], upperRim[(i + 1) % segments], [x, top, z]], [0, 1, 0], color);
}

function capital(out, x, y, z, lod, index) {
  stone(out, x, y, z, 1.58, 0.22, 1.27, index * 0.019, colors.grey);
  stone(out, x + 0.045, y + 0.22, z, 1.42, 0.12, 1.15, -index * 0.012, colors.pale);
  if (lod === 0) return;
  for (const sign of [-1, 1]) {
    const p = x + sign * 0.64;
    const top = y + 0.11;
    const radius = 0.23 - (index === 1 && sign > 0 ? 0.055 : 0);
    for (const front of [-1, 1]) {
      const sides = lod === 1 ? 5 : lod === 2 ? 8 : 12;
      const at = (i, r) => [
        p + Math.cos((i * 2 * Math.PI) / sides) * r,
        top + Math.sin((i * 2 * Math.PI) / sides) * r,
        z,
      ];
      const edgeZ = z + front * 0.64;
      for (let i = 0; i < sides; i++) {
        const a = at(i, radius),
          b = at(i + 1, radius);
        const frontA = at(i, radius * 0.77),
          frontB = at(i + 1, radius * 0.77);
        frontA[2] = frontB[2] = edgeZ + front * 0.055;
        a[2] = b[2] = edgeZ - front * 0.08;
        face(out, 'aged', [a, b, frontB, frontA], [0, 0, front], colors.pale);
        if (lod === 3)
          face(
            out,
            'aged',
            [frontA, frontB, [p, top, edgeZ + front * 0.023]],
            [0, 0, front],
            colors.worn,
          );
      }
    }
  }
}

function standingColumn(out, x, z, floor, plan, lod, index) {
  const r = plan.shaftLowerDiameter / 2;
  block(out, 'aged', x - 0.79, floor, z - 0.77, 1.58, 0.18, 1.54, colors.worn);
  if (lod > 0)
    ring(
      out,
      'aged',
      [x, z],
      [
        [floor + 0.15, 0.77],
        [floor + 0.24, 0.73],
        [floor + 0.38, 0.65],
      ],
      [6, 8, 12, 18][lod],
      colors.grey,
    );
  const height = plan.columnHeight + [0.06, -0.03, 0.05, -0.02, -0.07][index];
  const start = floor + 0.37;
  const top = floor + height - 0.34;
  const splits =
    lod === 0
      ? [0, 1]
      : lod === 1
        ? [0, 0.34, 0.69, 1]
        : [0, 0.13, 0.29, 0.43, 0.57, 0.72, 0.86, 1];
  const sides = [8, 12, 48, 72][lod];
  for (let j = 0; j < splits.length - 1; j++) {
    const a = splits[j],
      b = splits[j + 1];
    const drift = lod > 1 ? (((j * 5 + index * 7) % 9) - 4) * 0.004 : 0;
    columnDrum(
      out,
      [x + drift, z - drift],
      start + (top - start) * a,
      start + (top - start) * b - (b === 1 ? 0 : 0.016),
      r * (1 - 0.155 * a),
      r * (1 - 0.155 * b),
      sides,
      lod > 1 ? plan.flutes : 0,
      stoneTones[(j * 3 + index) % stoneTones.length],
      index * 0.018,
    );
  }
  capital(out, x, top, z, lod, index);
}

function steppedPlatform(out, plan, grade, lod) {
  const { stylobateLength: length, stylobateWidth: width, floor, stepHeights, stepSetbacks } = plan;
  const totalSetback = stepSetbacks[0] + stepSetbacks[1];
  const lowest = floor - stepHeights.reduce((sum, h) => sum + h, 0);
  const platform = (margin) =>
    rect(-length / 2 - margin, -width / 2 - margin, length / 2 + margin, width / 2 + margin);
  shell(
    out,
    platform(totalSetback + 0.06),
    (p) => Math.min(lowest - 0.37, grade(p) - 0.24),
    lowest,
    { wall: 'base', color: colors.stone },
  );
  const setbacks = [totalSetback, stepSetbacks[1], 0];
  let y = lowest;
  for (let i = 0; i < stepHeights.length; i++) {
    const top = y + stepHeights[i];
    shell(out, platform(setbacks[i]), () => y, top, {
      wall: 'aged',
      color: stoneTones[i],
      roofColor: colors.worn,
    });
    y = top;
  }
  if (lod === 0) return;
  for (const sign of [-1, 1]) {
    const z = sign * (width / 2 - 0.25);
    const count = lod === 3 ? 16 : 10;
    for (let j = 0; j < count; j++) {
      const x = -length / 2 + ((j + 0.5) * length) / count;
      const brokenLength = (length / count) * (0.89 + 0.032 * (j % 3));
      stone(
        out,
        x,
        floor - 0.045,
        z,
        brokenLength,
        0.12 + 0.045 * (j % 4),
        0.59 + 0.07 * (j % 2),
        ((j % 4) - 1.5) * 0.025,
        stoneTones[(j + (sign === 1 ? 2 : 0)) % stoneTones.length],
      );
    }
  }
}

function fallenDrum(out, x, y, z, turn, lod, color) {
  const segments = [6, 10, 20, 48][lod];
  const c = Math.cos(turn),
    s = Math.sin(turn);
  const step = (2 * Math.PI) / segments;
  const at = (i, end) => {
    const a = i * step;
    const notch = lod === 3 && i % 2 ? 0.038 : 0;
    const r = 0.62 - notch;
    return [
      x + c * end - s * r * Math.cos(a),
      y + r * Math.sin(a),
      z + s * end + c * r * Math.cos(a),
    ];
  };
  for (let i = 0; i < segments; i++) {
    const a = (i + 0.5) * step;
    face(
      out,
      'marble',
      [at(i, -0.57), at(i + 1, -0.57), at(i + 1, 0.57), at(i, 0.57)],
      [-s * Math.cos(a), Math.sin(a), c * Math.cos(a)],
      color,
    );
    for (const end of [-0.57, 0.57]) {
      face(
        out,
        'aged',
        [at(i, end), at(i + 1, end), [x + c * end, y, z + s * end]],
        [Math.sign(end) * c, 0, Math.sign(end) * s],
        colors.worn,
      );
    }
  }
}

function fallenMasonry(out, plan, grade, lod) {
  const y = plan.floor;
  // The surviving cella reads as low interrupted walling between the two aisles.
  for (const side of [-1, 1]) {
    for (const [start, length, height] of [
      [-13.3, 4.2, 0.55],
      [-8.9, 5.7, 0.84],
      [-2.6, 5.7, 0.46],
      [4.1, 7.2, 0.67],
    ]) {
      const segments = lod === 0 ? 1 : lod === 1 ? 2 : 3;
      for (let i = 0; i < segments; i++) {
        const w = length / segments;
        stone(
          out,
          start + (i + 0.5) * w,
          y,
          side * (5.4 + 0.08 * (i % 2)),
          w * 0.97,
          height * (1 - 0.12 * (i % 3)),
          0.89,
          i * 0.023,
          colors.grey,
        );
      }
    }
  }
  for (const [x, z, w, h, d, a] of [
    [-12.6, 0.9, 1.2, 0.68, 4.6, -0.053],
    [-7.6, 4.4, 2.25, 0.48, 0.91, 0.34],
    [-1.7, -1.1, 1.85, 0.63, 0.94, -0.43],
    [2.9, 2.5, 2.34, 0.62, 0.95, 0.15],
    [7.7, -0.6, 1.88, 0.54, 1.04, 0.32],
    [11.8, 1.9, 2.3, 0.81, 1.2, -0.23],
    [14.3, 7.3, 1.64, 0.73, 1.21, -0.43],
    [-6.4, 8.05, 2.1, 0.98, 0.98, 0.24],
  ])
    stone(out, x, y, z, w, h, d, a, colors.stone);
  const stumps = [
    [-17.665, -8.83, 1.28],
    [-14.132, -8.83, 0.62],
    [-10.599, -8.83, 0.44],
    [-3.533, -8.83, 0.75],
    [17.665, 8.83, 0.71],
    [7.066, 8.83, 0.31],
  ];
  for (const [x, z, h] of stumps)
    columnDrum(
      out,
      [x, z],
      y,
      y + h,
      0.64,
      0.58,
      [6, 8, 16, 32][lod],
      lod === 3 ? 8 : 0,
      colors.grey,
    );
  if (lod === 0) return;
  for (const [i, x, z, angle] of [
    [0, -17.4, 11.7, 0.49],
    [1, -13.2, 12.4, -0.12],
    [2, -7.25, 12.1, 0.91],
    [3, 1.1, 11.5, 0.23],
    [4, 5.05, 12.65, -0.39],
    [5, 8.22, 11.55, 0.61],
    [6, 13.54, 12.3, 0.29],
    [7, 18.43, 11.85, 0.78],
  ]) {
    if (i % 2 === 0) {
      fallenDrum(out, x, grade([x, z]) + 0.49, z, angle, lod, stoneTones[i / 2]);
      continue;
    }
    stone(
      out,
      x,
      grade([x, z]) - 0.15,
      z,
      1.05 + (i % 3) * 0.29,
      0.48 + (i % 4) * 0.14,
      1.28,
      angle,
      stoneTones[i % stoneTones.length],
    );
  }
}

function draw(out, lod, plan, grade) {
  steppedPlatform(out, plan, grade, lod);
  const north = -(plan.centerSpacing * 5) / 2;
  for (let i = 0; i < plan.standingColumnCount; i++) {
    const x = (5 - i) * plan.centerSpacing;
    standingColumn(out, x, north, plan.floor, plan, lod, i);
  }
  fallenMasonry(out, plan, grade, lod);
}

const temple = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [41, 22, 34],
    lookAt: [1, 4, 0],
    yaw: -0.62,
    sun: [210, 440, 330],
    brief:
      'Five restored weathered Ionic columns with irregular drum joints and volutes above the stepped marble platform and broken cella of the Athena temple.',
    views: [
      { name: 'restored-north-columns', position: [16, 6.2, 10.5], lookAt: [8, 5.5, -8.4] },
      { name: 'stylobate-and-cella-remains', position: [-28, 15, 26], lookAt: [-2, 1.9, 0] },
      { name: 'fallen-ashlar-and-column-drums', position: [9, 4.1, 18.5], lookAt: [1, 1.5, 8.2] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = temple;
export const model = { ...temple.model, category: 'ruins' };
