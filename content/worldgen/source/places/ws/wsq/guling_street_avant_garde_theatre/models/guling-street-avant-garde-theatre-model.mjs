import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  edge,
  face,
  mix,
  opening,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stucco: surface('wall', 'stucco', 0.86),
  stone: surface('foundation', 'concrete_plain', 0.83),
  cornice: surface('trim', 'plaster_lime', 0.78),
  frame: surface('door', 'wood_plain', 0.75, 0.03),
  glazing: surface('window', 'window_punched', 0.58, 0.025),
  metal: surface('trim', 'metal_painted', 0.59, 0.26),
  roof: surface('roof', 'concrete_boardformed', 0.89),
};
const color = palette({
  stucco: 'bab7ab',
  front: 'd0cbbc',
  molding: 'd7d2c5',
  checked: 'b0a99b',
  concrete: 'a19e92',
  steps: 'a3a098',
  recessed: '969288',
  window: '454b4b',
  glass: '586366',
  interior: '3c4242',
  frame: '664d44',
  steel: 'aaa7a1',
  roof: '898781',
  cap: '8c8e88',
});
const lobbyGrade = 0.14;

function divideFootprint(points, groundZ) {
  const intersection = (i, j) => {
    const a = points[i],
      b = points[j];
    return [mix(a[0], b[0], (groundZ - a[1]) / (b[1] - a[1])), groundZ];
  };
  const left = intersection(4, 0),
    right = intersection(3, 2);
  return {
    front: [left, right, points[3], points[4]],
    rear: [left, points[0], points[1], points[2], right],
  };
}

function frontWall(out, wall, base, top, lod) {
  const w = wall.length;
  const middle = w / 2;
  const door = [middle - 1.56, middle + 1.56];
  const window = [middle - 1.7, middle + 1.7];
  const y = lobbyGrade;
  const doorTop = y + 2.98;
  const windowBase = y + 4.76,
    windowTop = y + 7.03;
  panel(out, 'stucco', wall, 0, w, base, y, 0, color.front);
  panel(out, 'stucco', wall, 0, w, doorTop, windowBase, 0, color.front);
  panel(out, 'stucco', wall, 0, w, windowTop, top, 0, color.front);
  for (const [bounds, bottom, high, recess] of [
    [door, y, doorTop, 0.23],
    [window, windowBase, windowTop, 0.125],
  ]) {
    const [left, right] = bounds;
    panel(out, 'stucco', wall, 0, left, bottom, high, 0, color.front);
    panel(out, 'stucco', wall, right, w, bottom, high, 0, color.front);
    panel(
      out,
      'glazing',
      wall,
      left,
      right,
      bottom,
      high,
      -recess,
      bottom === y ? color.interior : color.glass,
    );
    face(
      out,
      'stone',
      [
        wall.p(left, bottom, 0),
        wall.p(right, bottom, 0),
        wall.p(right, bottom, -recess),
        wall.p(left, bottom, -recess),
      ],
      up,
      color.concrete,
    );
    face(
      out,
      'stucco',
      [
        wall.p(left, high, 0),
        wall.p(right, high, 0),
        wall.p(right, high, -recess),
        wall.p(left, high, -recess),
      ],
      [0, -1, 0],
      color.recessed,
    );
    for (const [x, sign] of [
      [left, 1],
      [right, -1],
    ]) {
      face(
        out,
        'stucco',
        [
          wall.p(x, bottom, 0),
          wall.p(x, bottom, -recess),
          wall.p(x, high, -recess),
          wall.p(x, high, 0),
        ],
        [wall.normal[2] * sign, 0, -wall.normal[0] * sign],
        color.recessed,
      );
      trimBlock(
        out,
        'frame',
        wall,
        x - 0.058,
        x + 0.058,
        bottom,
        high,
        -recess + 0.015,
        0.031,
        color.frame,
      );
    }
    for (const x of [
      left + 0.35 * (right - left),
      (left + right) / 2,
      right - 0.35 * (right - left),
    ])
      panel(out, 'frame', wall, x - 0.041, x + 0.041, bottom, high, -recess + 0.027, color.frame);
    const transom = high - (bottom === y ? 0.52 : 0.61);
    panel(
      out,
      'frame',
      wall,
      left,
      right,
      transom - 0.058,
      transom + 0.058,
      -recess + 0.03,
      color.frame,
    );
    panel(out, 'frame', wall, left, right, high - 0.092, high, -recess + 0.03, color.frame);
  }
  for (const [low, high, run] of [
    [4.12, 4.29, 0.91],
    [4.28, 4.88, 1.02],
    [4.88, 4.97, 1.08],
    [7.88, 8.02, 0.26],
  ])
    trimBlock(out, 'cornice', wall, -0.28, w + 0.28, y + low, y + high, -0.045, run, color.molding);
  const crown = [
    wall.p(0, top - 0.03, 0.025),
    wall.p(w, top - 0.03, 0.025),
    wall.p(w, top + 0.235, 0.025),
    wall.p(middle, top + 0.48, 0.025),
    wall.p(0, top + 0.24, 0.025),
  ];
  face(out, 'cornice', crown, wall.normal, color.front);
  if (lod > 0) {
    for (const [a, b] of [
      [0.055, door[0] - 0.15],
      [door[1] + 0.15, w - 0.055],
    ]) {
      const n = lod < 3 ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const u = mix(a, b, (i + 0.5) / n);
        trimBlock(
          out,
          'cornice',
          wall,
          u - 0.019,
          u + 0.019,
          y + 0.09,
          y + 4.01,
          0.014,
          0.077,
          color.molding,
        );
      }
    }
    for (const [start, end] of [
      [0.08, window[0] - 0.07],
      [window[1] + 0.07, w - 0.08],
    ]) {
      for (let i = 0; i < 6; i++) {
        const u = mix(start, end, (i + 0.5) / 6);
        trimBlock(
          out,
          'cornice',
          wall,
          u - 0.017,
          u + 0.017,
          y + 5.0,
          y + 7.8,
          0.013,
          0.064,
          color.molding,
        );
      }
    }
    if (lod > 1)
      for (let i = 1; i <= 24; i++) {
        const u = (i * w) / 25;
        panel(out, 'cornice', wall, u - 0.019, u + 0.019, y + 4.32, y + 4.48, 1.025, color.checked);
      }
  }
  trimBlock(
    out,
    'cornice',
    wall,
    door[0] - 0.14,
    door[1] + 0.14,
    doorTop + 0.04,
    doorTop + 0.17,
    0.013,
    0.14,
    color.molding,
  );
  if (lod > 1)
    trimBlock(
      out,
      'cornice',
      wall,
      window[0] - 0.08,
      window[1] + 0.08,
      windowTop + 0.012,
      windowTop + 0.12,
      0.012,
      0.073,
      color.molding,
    );
}

function streetWindows(out, wall, base, top, lod, rear) {
  const n = Math.max(1, Math.floor(wall.length / (rear ? 3.15 : 3.2)));
  const step = wall.length / n;
  const y = lobbyGrade;
  const rows = rear
    ? [
        [1.55, 3.12],
        [4.88, 6.67],
        [8.02, 9.52],
      ]
    : [
        [1.27, 3.31],
        [4.96, 7.25],
      ];
  for (const [low, high] of rows) {
    if (lod === 0 && low < 4) continue;
    for (let i = 0; i < n; i++) {
      const center = (i + 0.5) * step;
      const half = Math.min(step * 0.29, 0.82);
      opening(
        out,
        wall,
        center - half,
        center + half,
        y + low,
        y + high,
        'cornice',
        color.window,
        'glazing',
        color.frame,
        lod,
        0.015,
      );
      if (lod > 1)
        trimBlock(
          out,
          'cornice',
          wall,
          center - half - 0.1,
          center + half + 0.1,
          y + low - 0.12,
          y + low,
          0.01,
          0.19,
          color.molding,
        );
    }
  }
  const one = rear ? 7.48 : 4.43;
  panel(out, 'cornice', wall, 0, wall.length, y + one - 0.07, y + one + 0.07, 0.044, color.molding);
  panel(out, 'cornice', wall, 0, wall.length, top - 0.48, top - 0.36, 0.043, color.molding);
  if (lod < 2) return;
  for (let i = 1; i < n; i++) {
    const u = step * i;
    trimBlock(
      out,
      'cornice',
      wall,
      u - 0.065,
      u + 0.065,
      y + 0.44,
      top - 0.51,
      0.014,
      0.077,
      color.front,
    );
  }
  panel(out, 'stone', wall, 0, wall.length, base, y + 0.48, 0.018, color.concrete);
}

function frontAccess(out, wall, ground, lod) {
  const center = wall.length / 2;
  const y0 = ground(wall.p(center, 0, 1.16).filter((_, i) => i !== 1));
  const p = (u, y, d) => wall.p(u + center, y, d);
  const stepBase = Math.min(y0, lobbyGrade - 0.3);
  const span = lobbyGrade - stepBase;
  const x = center - wall.length * 0.5 - 0.23;
  for (let i = 0; i < 3; i++) {
    const z = 1.25 - i * 0.29;
    trimBlock(
      out,
      'stone',
      wall,
      x,
      wall.length + 0.3,
      stepBase,
      stepBase + (span * (i + 1)) / 3,
      z - 0.31,
      z,
      color.steps,
    );
  }
  trimBlock(
    out,
    'stone',
    wall,
    x,
    wall.length + 0.32,
    stepBase,
    lobbyGrade,
    -0.02,
    0.41,
    color.steps,
  );
  if (lod < 2) return;
  const a = p(0.92, lobbyGrade + 0.88, 1.23),
    b = p(3.24, stepBase + 0.77, 1.66);
  beamPath(out, 'metal', [a, b], 0.052, 0.052, color.steel);
  const left = 0.92,
    right = 3.24;
  for (let i = 0; i < (lod === 3 ? 12 : 6); i++) {
    const t = i / (lod === 3 ? 11 : 5);
    const u = mix(left, right, t),
      d = mix(1.23, 1.66, t);
    beamPath(
      out,
      'metal',
      [p(u, mix(lobbyGrade, stepBase, t), d), p(u, mix(a[1], b[1], t), d)],
      0.032,
      0.034,
      color.steel,
    );
  }
}

function draw(out, lod, controls, grade) {
  const { outline, frontEaves, rearEaves } = controls;
  const { front, rear } = divideFootprint(outline, 1.81);
  const baseline = (p) => Math.min(grade(p) - 0.24, -0.37);
  const frontRoof = lobbyGrade + frontEaves;
  const rearRoof = lobbyGrade + rearEaves;
  const style = { wall: 'stucco', color: color.stucco, roof: 'roof', roofColor: color.roof };
  shell(out, front, baseline, frontRoof, style, (i) => i !== 0 && i !== 2);
  shell(out, rear, baseline, rearRoof, style);
  const entry = edge(front[2], front[3], areaSign(front));
  frontWall(out, entry, Math.min(...outline.map(baseline)), frontRoof, lod);
  frontAccess(out, entry, grade, lod);
  // The four street sides are continuous below the taller rear wall.
  for (const [points, edges, top, rearWing] of [
    [front, [1, 3], frontRoof, false],
    [rear, [0, 1, 2, 3], rearRoof, true],
  ])
    for (const i of edges) {
      const next = (i + 1) % points.length;
      const wall = edge(points[i], points[next], areaSign(points));
      streetWindows(
        out,
        wall,
        Math.min(baseline(points[i]), baseline(points[next])),
        top,
        lod,
        rearWing,
      );
    }
  shell(out, rect(-4.83, 3.4, 3.68, 7.45), () => rearRoof - 0.02, rearRoof + 0.61, {
    wall: 'stucco',
    color: color.recessed,
    roof: 'roof',
    roofColor: color.cap,
  });
  if (lod > 0) {
    block(out, 'roof', -2.1, rearRoof + 0.62, 4.88, 1.15, 0.34, 1.29, color.cap);
    panel(
      out,
      'cornice',
      entry,
      0,
      entry.length,
      frontRoof - 0.48,
      frontRoof - 0.32,
      0.06,
      color.molding,
    );
  }
}

const theatre = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-17, 14, -26],
    lookAt: [0, 4.6, 0.1],
    sun: [-350, 500, -680],
    yaw: -1.1,
    brief:
      'The restored former Zhongzheng Second Precinct building, with an Art Deco corner entrance, two street-front floors and taller rear theatre.',
    views: [
      {
        name: 'art-deco-corner-entry-and-balcony',
        position: [1.1, 5.6, -23],
        lookAt: [1.1, 4.45, -7.7],
      },
      {
        name: 'two-storey-street-and-rear-workshops',
        position: [18, 13, -12],
        lookAt: [2, 4.6, 0],
      },
      { name: 'lane-five-rear-and-footprint', position: [-15, 30, 21], lookAt: [0, 3.6, 2] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = theatre;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...theatre.model,
  category: 'theatre',
  recipeDependencies: [...theatre.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.9,
    basis: 'The exact named historic theatre footprint replaces the generic corner building.',
  },
};
