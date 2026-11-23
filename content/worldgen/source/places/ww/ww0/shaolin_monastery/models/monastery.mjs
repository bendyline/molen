import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  quad4,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  color,
  courtFace,
  eaveBand,
  edges,
  fitAtAngle,
  panel,
  panels,
  positioned,
  post,
  railing,
  rect,
  roof,
  secondary,
  stairs,
  surfaces,
} from './temple-architecture.mjs';
import site from '../site-controls.json' with { type: 'json' };

export { surfaces };
const angle = (site.planAngleDegrees * Math.PI) / 180;
const key = (id) => site.buildingFootprints.find((b) => b.id === id);
const halls = [
  { id: 181147412, bays: 3, platform: 1.14, height: 4.5, rise: 3.29 },
  {
    id: 181147411,
    bays: 5,
    platform: 3.04,
    height: 5.94,
    rise: 3.37,
    upper: 3.44,
    subtitle: 'mahavira',
  },
  { id: 181147422, bays: 5, platform: 1.83, height: 5.67, rise: 3.11, upper: 2.74 },
  { id: 181147417, bays: 3, platform: 0.73, height: 4.19, rise: 3.11 },
  { id: 181147420, bays: 3, platform: 0.87, height: 3.71, rise: 3.19 },
  { id: 181147421, bays: 5, platform: 1.68, height: 5.42, rise: 3.79 },
];
const towers = [
  { id: 181147416, tile: color.greenTile, tint: color.cream },
  { id: 181147418, tile: color.greyTile, tint: color.ochre },
];
const selected = new Set([site.gate.id, ...halls.map((s) => s.id), ...towers.map((s) => s.id)]);
const size = ({ plan: p }) =>
  p.reduce(
    (sum, [x, z], i) => sum + x * p[(i + 1) % p.length][1] - z * p[(i + 1) % p.length][0],
    0,
  );
const wings = site.buildingFootprints
  .filter((b) => !selected.has(b.id))
  .sort((a, b) => Math.abs(size(b)) - Math.abs(size(a)));
const highlight = new Set([
  181147415, 181147419, 1380903235, 1380903243, 1380903252, 243058095, 243058098, 243058101,
]);

function disk(out, f, u, y, r, detail) {
  const p = f.P,
    n = detail === 3 ? 36 : detail === 2 ? 20 : 12;
  const at = (t, w, d) => p(u + Math.cos(t) * w, y + Math.sin(t) * w, d);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    tri(out, 'shade', p(u, y, 0.079), at(a, r, 0.079), at(b, r, 0.079), color.black);
    if (detail >= 2)
      quad4(
        out,
        'stone',
        at(a, r * 1.18, 0.17),
        at(b, r * 1.18, 0.17),
        at(b, r, 0.17),
        at(a, r, 0.17),
        color.stone,
      );
  }
  if (detail >= 2) {
    const count = detail === 3 ? 11 : 5;
    for (let i = 0; i < count; i++) {
      const offset = ((i - (count - 1) * 0.5) * r) / (count * 0.55),
        s = Math.sqrt(r * r - offset * offset);
      panel(
        out,
        'wood',
        f,
        u + offset - 0.022,
        u + offset + 0.022,
        y - s,
        y + s,
        0.102,
        color.ochre,
      );
      panel(
        out,
        'wood',
        f,
        u - s,
        u + s,
        y + offset - 0.023,
        y + offset + 0.023,
        0.109,
        color.ochre,
      );
    }
  }
}

// Strokes are hand-authored line coordinates in a one-unit square, read right to left.
const signStrokes = {
  gate: [
    [
      [
        [0.18, 0.75],
        [0.82, 0.75],
      ],
      [
        [0.5, 0.92],
        [0.5, 0.52],
      ],
      [
        [0.12, 0.52],
        [0.9, 0.52],
      ],
      [
        [0.2, 0.36],
        [0.83, 0.36],
      ],
      [
        [0.61, 0.53],
        [0.61, 0.13],
        [0.49, 0.08],
      ],
      [
        [0.27, 0.32],
        [0.41, 0.19],
      ],
    ],
    [
      [
        [0.08, 0.62],
        [0.47, 0.62],
      ],
      [
        [0.27, 0.88],
        [0.27, 0.08],
      ],
      [
        [0.27, 0.58],
        [0.08, 0.27],
      ],
      [
        [0.3, 0.57],
        [0.46, 0.39],
      ],
      [
        [0.51, 0.62],
        [0.91, 0.62],
      ],
      [
        [0.7, 0.9],
        [0.7, 0.09],
      ],
      [
        [0.69, 0.58],
        [0.5, 0.26],
      ],
      [
        [0.71, 0.57],
        [0.93, 0.3],
      ],
    ],
    [
      [
        [0.5, 0.88],
        [0.5, 0.4],
        [0.43, 0.34],
      ],
      [
        [0.3, 0.69],
        [0.19, 0.39],
      ],
      [
        [0.7, 0.69],
        [0.85, 0.47],
      ],
      [
        [0.75, 0.4],
        [0.63, 0.22],
        [0.32, 0.09],
      ],
    ],
  ],
  mahavira: [
    [
      [
        [0.13, 0.72],
        [0.5, 0.88],
        [0.87, 0.69],
      ],
      [
        [0.2, 0.55],
        [0.77, 0.55],
      ],
      [
        [0.18, 0.12],
        [0.18, 0.45],
        [0.78, 0.45],
        [0.78, 0.12],
      ],
      [
        [0.22, 0.28],
        [0.75, 0.28],
      ],
    ],
    [
      [
        [0.2, 0.7],
        [0.77, 0.7],
      ],
      [
        [0.24, 0.85],
        [0.78, 0.85],
        [0.7, 0.57],
        [0.32, 0.57],
      ],
      [
        [0.2, 0.51],
        [0.84, 0.51],
      ],
      [
        [0.24, 0.38],
        [0.74, 0.38],
        [0.74, 0.18],
        [0.24, 0.18],
        [0.24, 0.38],
      ],
      [
        [0.3, 0.15],
        [0.15, 0.04],
      ],
      [
        [0.69, 0.15],
        [0.86, 0.04],
      ],
    ],
    [
      [
        [0.12, 0.68],
        [0.48, 0.68],
      ],
      [
        [0.3, 0.9],
        [0.23, 0.48],
        [0.12, 0.25],
        [0.47, 0.37],
      ],
      [
        [0.72, 0.9],
        [0.54, 0.65],
        [0.49, 0.2],
      ],
      [
        [0.55, 0.67],
        [0.88, 0.67],
      ],
      [
        [0.56, 0.51],
        [0.83, 0.51],
      ],
      [
        [0.56, 0.35],
        [0.83, 0.35],
      ],
      [
        [0.71, 0.69],
        [0.71, 0.13],
      ],
      [
        [0.53, 0.13],
        [0.9, 0.13],
      ],
    ],
    [
      [
        [0.12, 0.64],
        [0.88, 0.64],
      ],
      [
        [0.5, 0.9],
        [0.44, 0.58],
        [0.34, 0.32],
        [0.1, 0.1],
      ],
      [
        [0.51, 0.64],
        [0.64, 0.38],
        [0.89, 0.1],
      ],
    ],
  ],
};

function tablet(out, x, z, y, key, detail) {
  if (!detail) return;
  const tall = key === 'gate' ? 1.01 : 0.91,
    w = tall * (key === 'gate' ? 2.3 : 2.9);
  const f = courtFace(x, z, w);
  fbox(out, 'wood', f, 0, w, y, y + tall, -0.11, 0.086, color.black);
  for (const yy of [y + 0.056, y + tall - 0.081])
    panel(out, 'metal', f, 0.07, w - 0.065, yy, yy + 0.018, 0.095, color.gold);
  if (detail < 2) return;
  const glyphs = signStrokes[key];
  for (const [i, strokes] of glyphs.entries()) {
    const span = (w - 0.29) / glyphs.length;
    const p = ([u, v]) =>
      f.P(0.145 + (i + 0.1 + u * 0.8) * span, y + tall * (0.13 + v * 0.72), 0.102);
    for (const points of strokes)
      for (let k = 1; k < points.length; k++)
        beam(out, 'metal', p(points[k - 1]), p(points[k]), 0.027, 0.022, color.gold);
  }
}

function lion(out, x, z, y, side, detail) {
  const tinted = color.stone;
  abox(out, 'stone', [x - 0.69, y - 0.16, z - 0.66], [x + 0.69, y + 0.26, z + 0.77], tinted, {
    bottom: false,
  });
  abox(out, 'stone', [x - 0.57, y + 0.26, z - 0.56], [x + 0.57, y + 0.71, z + 0.65], tinted, {
    bottom: false,
  });
  const n = detail === 3 ? 12 : 8,
    l = detail === 3 ? 8 : 4;
  sphere(out, 'stone', [x, y + 1.25, z - 0.1], [0.43, 0.56, 0.46], tinted, n, l);
  sphere(out, 'stone', [x, y + 1.81, z + 0.15], [0.37, 0.42, 0.36], tinted, n, l);
  sphere(out, 'stone', [x, y + 1.69, z + 0.43], [0.25, 0.21, 0.2], tinted, n, l);
  for (const s of [-1, 1]) {
    sphere(out, 'stone', [x + s * 0.28, y + 0.87, z + 0.45], [0.17, 0.16, 0.25], tinted, n, 4);
    sphere(out, 'stone', [x + s * 0.21, y + 2.04, z + 0.06], [0.125, 0.152, 0.123], tinted, 8, 4);
  }
  if (detail === 3) {
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI) / 6;
      sphere(
        out,
        'stone',
        [x + Math.cos(a) * 0.31, y + 1.71 + Math.sin(a) * 0.32, z - 0.025],
        [0.14, 0.14, 0.13],
        color.greyBrick,
        7,
        4,
      );
    }
    sphere(out, 'stone', [x - side * 0.27, y + 0.91, z + 0.61], [0.19, 0.18, 0.18], tinted, 8, 5);
  }
}

function mountainGate(out, detail) {
  const g = site.gate,
    b = key(g.id),
    {
      w,
      d,
      center: [x, z],
    } = fitAtAngle(b.plan);
  const y = b.base,
    floor = y + 1.77,
    spring = floor + 3.04,
    eave = floor + 4.75,
    face = edges(b.plan)
      .filter((f) => f.normal[1] > 0.7)
      .sort((a, b) => b.length - a.length)[0];
  extrude(out, 'stone', b.plan, b.foundation, floor, color.greyBrick);
  extrude(out, 'brick', b.plan, spring, eave, color.redBrick);
  for (const p of g.piers) extrude(out, 'brick', p, floor, spring, color.redBrick, { top: false });
  roof(out, x, z, w + 1.33, d + 1.29, eave, 3.43, detail, color.greenTile);
  const u = face.length * 0.5,
    mid = site.gate.center,
    wGate = site.gate.halfSpan * 2;
  const front = courtFace(mid, face.P(u, 0)[2] + 0.061, w * 0.99);
  stairs(out, front, front.length * 0.5, wGate + 0.79, y - 0.39, floor, 4.61, detail);
  if (!detail) return;
  for (const f of edges(b.plan)) if (f.length > 3.1) eaveBand(out, f, eave, detail);
  const ux = front.length * 0.5;
  for (const s of [-1, 1]) {
    disk(out, front, ux + s * Math.min(4.23, w * 0.3), floor + 1.79, 0.93, detail);
    fbox(
      out,
      'wood',
      front,
      ux + s * wGate * 0.5 - 0.13,
      ux + s * wGate * 0.5 + 0.13,
      floor,
      spring + 0.21,
      -0.2,
      0.13,
      color.vermillion,
    );
  }
  fbox(
    out,
    'wood',
    front,
    ux - wGate * 0.58,
    ux + wGate * 0.58,
    spring - 0.065,
    spring + 0.18,
    -0.17,
    0.19,
    color.vermillion,
  );
  tablet(out, mid, front.origin[1] + 0.4, eave - 1.45, 'gate', detail);
  if (detail >= 2)
    for (const sign of [-1, 1])
      lion(out, mid + sign * 3.77, front.origin[1] + 4.81, y - 0.28, sign, detail);
}

function hall(out, data, detail) {
  const b = key(data.id),
    {
      center: [x, z],
      w,
      d,
    } = fitAtAngle(b.plan);
  const y = b.base,
    floor = y + data.platform,
    eave = floor + data.height,
    frontZ = z + d * 0.5;
  const front = courtFace(x, frontZ, w),
    backZ = z - d * 0.5;
  extrude(out, 'stone', b.plan, b.foundation, floor, color.greyBrick);
  const inset = Math.min(1.57, d * 0.1);
  const body = rect(x - w * 0.5 + 0.45, x + w * 0.5 - 0.45, backZ + 0.42, frontZ - inset);
  extrude(out, 'wall', body, floor, eave, color.quietRed);
  const colY = eave - 0.42,
    postCount = data.bays + 1,
    span = (w - 1.35) / data.bays;
  for (let i = 0; i < postCount; i++) {
    const xPost = x - w * 0.5 + 0.675 + i * span;
    post(out, xPost, frontZ - 0.5, floor, colY, detail >= 2 ? 0.25 : 0.21, detail);
    if (detail && i < data.bays) {
      const q = xPost + span * 0.5 - (x - w * 0.5),
        wDoor = span * (i === Math.floor(data.bays / 2) ? 0.62 : 0.72);
      const f = courtFace(x, frontZ - inset + 0.048, w);
      panels(
        out,
        f,
        q - wDoor * 0.5,
        q + wDoor * 0.5,
        floor + 0.11,
        colY - 0.38,
        detail,
        color.vermillion,
        1,
      );
    }
  }
  const tile = data.upper ? color.greenTile : color.greyTile;
  roof(out, x, z, w + 0.93, d + 0.87, eave, data.rise, detail, tile);
  if (data.upper) {
    const layerY = eave + data.rise * 0.53,
      high = layerY + 2.15,
      ww = w * 0.71,
      dd = d * 0.67;
    const upper = rect(x - ww * 0.5, x + ww * 0.5, z - dd * 0.5, z + dd * 0.5);
    extrude(out, 'wood', upper, layerY, high, color.teal, { top: false });
    roof(out, x, z, ww + 0.31, dd + 0.37, high, data.upper, detail, tile);
    if (data.subtitle) tablet(out, x, z + dd * 0.5 + 0.59, layerY + 0.47, 'mahavira', detail);
    if (detail) eaveBand(out, courtFace(x, z + dd * 0.5, ww), high, detail);
  }
  const stepWidth = data.bays === 5 ? Math.min(7.56, w * 0.39) : Math.min(4.35, w * 0.37);
  stairs(out, front, w * 0.5, stepWidth, y - 0.3, floor, data.platform * 1.56 + 0.7, detail);
  if (detail) {
    eaveBand(out, front, eave, detail);
    eaveBand(out, wallFace([x + w * 0.5, backZ], [x - w * 0.5, backZ]), eave, detail);
  }
  if (detail >= 2) {
    railing(out, front, 0.28, (w - stepWidth) * 0.5 - 0.2, floor, detail);
    railing(out, front, (w + stepWidth) * 0.5 + 0.2, w - 0.28, floor, detail);
    if (data.subtitle && detail === 3)
      for (let i = 0; i < 5; i++) {
        const q = x + (i - 2) * span * 0.87;
        beam(
          out,
          'wood',
          [q, eave - 0.33, frontZ + 0.61],
          [q, eave - 1.0, frontZ + 0.61],
          0.05,
          0.045,
          color.timber,
        );
        sphere(
          out,
          'metal',
          [q, eave - 1.14, frontZ + 0.61],
          [0.239, 0.297, 0.239],
          color.vermillion,
          9,
          5,
        );
      }
  }
}

function bellStage(out, data, detail) {
  const b = key(data.id),
    {
      center: [x, z],
      w,
      d,
    } = fitAtAngle(b.plan);
  const y = b.base,
    lower = y + 4.2,
    eave = y + 8.9;
  extrude(out, 'wall', b.plan, b.foundation, lower, data.tint);
  roof(out, x, z, w + 0.59, d + 0.77, lower, 2.29, detail, data.tile);
  const top = rect(x - w * 0.35, x + w * 0.35, z - d * 0.31, z + d * 0.31);
  extrude(out, 'wood', top, lower + 1.47, eave, color.timber, { top: false });
  roof(out, x, z, w * 0.79, d * 0.77, eave, 2.67, detail, data.tile);
  if (detail)
    for (const f of edges(top)) {
      const u = f.length * 0.5,
        ww = f.length * 0.54;
      panels(out, f, u - ww * 0.5, u + ww * 0.5, lower + 2.03, eave - 0.72, detail, color.timber);
      eaveBand(out, f, eave, detail);
    }
}

function terraces(out, detail) {
  if (detail < 2) return;
  for (const row of site.terraces) {
    const f = courtFace(row.x, row.z, row.width);
    fbox(out, 'stone', f, 0, f.length, row.y - row.height, row.y, -0.29, 0.09, color.greyBrick);
    const half = (row.width - row.steps) * 0.5;
    railing(out, f, 0, half, row.y, detail);
    railing(out, f, row.width - half, row.width, row.y, detail);
    stairs(out, f, f.length * 0.5, row.steps, row.y - row.height, row.y, row.height * 1.46, detail);
  }
}
function build(out, detail) {
  const m = positioned(out, angle);
  mountainGate(m, detail);
  for (const h of halls) hall(m, h, detail);
  for (const t of towers) bellStage(m, t, detail);
  for (const b of detail ? wings : wings.slice(0, 14))
    secondary(m, b, detail, {
      highlight: highlight.has(b.id),
      wall: highlight.has(b.id) ? color.quietRed : color.greyBrick,
      tile: highlight.has(b.id) ? color.greenTile : color.greyTile,
    });
  terraces(m, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
