import {
  beam,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { surfaces as entranceSurfaces, guardian } from './summer-palace-entrance-model.mjs';
import {
  courtRoof,
  dark,
  face,
  frame,
  levels,
  marble,
  red,
  solid,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['west-entrance']);
export const surfaces = {
  ...entranceSurfaces,
  brick: { slot: 'wall', graph: 'brick_longformat' },
};

const greyTile = [0.227, 0.235, 0.24];
const greyBrick = [0.41, 0.388, 0.359];
const stone = [0.56, 0.555, 0.532];
const metal = [0.28, 0.21, 0.134];
const glass = [0.31, 0.39, 0.38];
const fascia = [0.19, 0.298, 0.258];

function gateRoof(out, width, depth, y, detail) {
  const ridgeHalf = width * 0.372;
  const rise = 2.08;
  const profiles = detail === 0 ? [0, 0.5, 1] : [0, 0.22, 0.5, 0.74, 1];
  const position = (u, t, side) => {
    const half = width * 0.5 + (ridgeHalf - width * 0.5) * Math.min(1, t * 2);
    const lift = Math.max(0, (Math.abs(u) - 0.7) / 0.3) * (1 - t) * 0.21;
    return [
      u * half,
      y + rise * t * (0.69 + 0.31 * t) + lift,
      side * depth * (1 - t * 0.985) * 0.5,
    ];
  };
  for (let i = 1; i < profiles.length; i++) {
    const [a, b] = [profiles[i - 1], profiles[i]];
    for (const side of [-1, 1]) {
      for (const [left, right] of [
        [-1, -0.62],
        [-0.62, 0.62],
        [0.62, 1],
      ]) {
        face(
          out,
          'tile',
          [
            position(left, a, side),
            position(right, a, side),
            position(right, b, side),
            position(left, b, side),
          ],
          greyTile,
          up,
        );
      }
      face(
        out,
        a < 0.5 ? 'tile' : 'timber',
        [position(side, a, -1), position(side, a, 1), position(side, b, 1), position(side, b, -1)],
        a < 0.5 ? greyTile : fascia,
        [side, 0, 0],
      );
    }
  }
  box(
    out,
    'timber',
    [-width * 0.49, y - 0.19, -depth * 0.49],
    [width * 0.49, y + 0.02, depth * 0.49],
    dark,
  );
  beam(out, 'tile', [-ridgeHalf, y + rise, 0], [ridgeHalf, y + rise, 0], 0.22, 0.29, greyTile);
  if (detail < 2) return;
  for (const side of [-1, 1]) {
    beam(
      out,
      'tile',
      [side * (ridgeHalf - 0.1), y + rise, 0],
      [side * (ridgeHalf + 0.15), y + rise + 0.35, 0],
      0.21,
      0.2,
      greyTile,
    );
    if (detail < 3) continue;
    const count = Math.round(width / 0.31);
    for (let i = 1; i < count; i++) {
      const u = (i / count) * 2 - 1;
      for (const sign of [-1, 1]) {
        const a = position(u, 0, sign);
        const b = position(u, 0.04, sign);
        beam(out, 'tile', [a[0], a[1] + 0.033, a[2] + sign * 0.035], b, 0.105, 0.105, greyTile);
      }
    }
  }
}

function gatehouse(out, gate, detail) {
  const { width, depth, floor, bottom, walls } = gate;
  const body = frame(out, [0, 0], floor, 0);
  for (const [left, right] of [
    [-width / 2, -1.55],
    [1.55, width / 2],
  ])
    box(body, 'stone', [left, bottom - floor, -depth / 2], [right, 0, depth / 2], stone);
  for (const side of [-1, 1]) {
    const z = side * depth * 0.37;
    for (const x of [-5.42, -1.82, 1.82, 5.42]) {
      const postColor = x < 0 ? red : [0.4, 0.102, 0.069];
      if (detail === 0) beam(body, 'timber', [x, 0, z], [x, 3.63, z], 0.42, 0.42, postColor);
      else {
        const rings = [0, 3.63].map((y) =>
          radialRing(y, 0.215, 0.215, detail === 1 ? 8 : 12, [x, z]),
        );
        for (let i = 0; i < rings[0].length; i++) {
          const j = (i + 1) % rings[0].length;
          face(body, 'timber', [rings[0][i], rings[1][i], rings[1][j], rings[0][j]], postColor, [
            rings[0][i][0] + rings[0][j][0] - x * 2,
            0,
            rings[0][i][2] + rings[0][j][2] - z * 2,
          ]);
        }
        box(body, 'stone', [x - 0.28, 0, z - 0.28], [x + 0.28, 0.19, z + 0.28], marble);
      }
      if (detail >= 2)
        for (const [y, w, d] of [
          [3.26, 0.46, 0.28],
          [3.42, 0.69, 0.41],
          [3.55, 0.87, 0.52],
        ])
          box(body, 'timber', [x - w / 2, y, z - d], [x + w / 2, y + 0.14, z + d], fascia);
    }
    box(body, 'timber', [-5.8, 3.18, z - 0.22], [5.8, 3.42, z + 0.22], fascia);
    box(body, 'timber', [-6.11, 3.56, z - 0.24], [6.11, 3.76, z + 0.24], dark);
    for (const x of [-3.62, 3.62]) {
      box(body, 'brick', [x - 1.53, 0, z - 0.27], [x + 1.53, 0.57, z + 0.27], greyBrick);
      box(body, 'timber', [x - 1.53, 0.57, z - 0.16], [x + 1.53, 3.12, z + 0.16], red);
      if (detail >= 2) {
        for (const offset of [-1.22, -0.44, 0.44, 1.22])
          box(
            body,
            'timber',
            [x + offset - 0.055, 0.62, z - 0.2],
            [x + offset + 0.055, 3.06, z + 0.2],
            dark,
          );
        for (const y of [1.68, 2.53])
          box(body, 'timber', [x - 1.4, y, z - 0.185], [x + 1.4, y + 0.072, z + 0.185], dark);
      }
    }
  }
  for (const side of [-1, 1]) {
    const [x0, x1] = side < 0 ? [-5.72, -5.26] : [5.26, 5.72];
    box(body, 'brick', [x0, 0, -depth * 0.38], [x1, 3.28, depth * 0.38], greyBrick);
    const wall = walls[side < 0 ? 0 : 1];
    box(out, 'brick', [wall.from, wall.bottom, -0.58], [wall.to, wall.top, 0.18], greyBrick);
    box(
      out,
      'tile',
      [wall.from - 0.1, wall.top, -0.67],
      [wall.to + 0.1, wall.top + 0.21, 0.27],
      greyTile,
    );
  }
  box(body, 'timber', [-0.86, 3.02, depth * 0.37 + 0.19], [0.86, 3.3, depth * 0.37 + 0.31], dark);
  gateRoof(body, width + 1.1, depth + 0.64, 3.86, detail);
}

function queueRail(out, a, b, y, detail) {
  for (const h of [0.34, 0.88])
    beam(out, 'enamel', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.056, 0.056, metal);
  const n =
    detail < 2 ? 1 : Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (detail >= 3 ? 0.25 : 0.46));
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n;
    const z = a[1] + ((b[1] - a[1]) * i) / n;
    const width = i === 0 || i === n ? 0.07 : 0.037;
    beam(out, 'enamel', [x, y + 0.045, z], [x, y + 0.9, z], width, width, metal);
  }
}

function checkpoint(out, gate, detail) {
  const { center, floor, bottom, width, depth } = gate;
  const body = frame(out, center, floor, 0);
  const [w, d] = [width / 2, depth / 2];
  box(body, 'stone', [-w, bottom - floor, -d - 0.3], [w, 0, d + 0.32], stone);
  for (const z of [-d + 0.3, d - 0.37]) {
    for (const x of [-w + 0.34, -1.17, 1.17, w - 0.34])
      beam(body, 'timber', [x, 0, z], [x, 2.8, z], 0.15, 0.15, dark);
    beam(body, 'timber', [-w + 0.2, 2.73, z], [w - 0.2, 2.73, z], 0.21, 0.19, dark);
  }
  courtRoof(body, width + 0.43, depth + 0.54, 2.92, 0.98, greyTile, detail, true, 0.13);
  for (const x of [-2.72, 2]) {
    box(body, 'glass', [x - 0.59, detail > 0 ? 0.89 : 0, -0.88], [x + 0.59, 2.16, 0.88], glass);
    if (detail === 0) continue;
    box(body, 'enamel', [x - 0.59, 0, -0.88], [x + 0.59, 0.89, 0.88], dark);
    box(body, 'enamel', [x - 0.63, 2.16, -0.92], [x + 0.63, 2.34, 0.92], dark);
    if (detail >= 2) {
      for (const dx of [-0.59, 0.59])
        for (const z of [-0.88, 0.88])
          beam(body, 'enamel', [x + dx, 0.86, z], [x + dx, 2.26, z], 0.074, 0.075, metal);
      for (const z of [-1.09, 1.19]) {
        box(body, 'enamel', [x + 0.52, 0, z - 0.13], [x + 0.78, 1.01, z + 0.13], metal);
        box(body, 'glass', [x + 0.57, 1.012, z - 0.055], [x + 0.73, 1.031, z + 0.055], glass);
      }
    }
  }
  if (detail >= 1)
    for (const x of [-3.57, -0.88, 0.88, 3.45])
      queueRail(body, [x, -d - 0.19], [x, d + 0.15], 0, detail);
}

function ticketOffice(out, site, detail) {
  const { frame: bounds, outline, grade, toe, role } = site;
  const { center, width, depth, angle } = bounds;
  const body = frame(out, center, grade, angle);
  const x = width / 2,
    z = depth / 2;
  solid(out, 'stone', outline, toe, grade + 0.16, stone);
  box(body, 'brick', [-x, 0.16, -z], [x, 2.88, z], greyBrick);
  if (detail > 0)
    for (const side of [-1, 1]) {
      const count = role === 'ticket-office' ? 5 : 2;
      for (let i = 0; i < count; i++) {
        const u = width * ((i + 0.5) / count - 0.5);
        const w = Math.min(0.88, width / (count * 2.4));
        const front = side * z;
        box(body, 'timber', [u - w, 0.64, front - 0.08], [u + w, 2.46, front + 0.08], red);
        box(
          body,
          'glass',
          [u - w * 0.78, 1.13, front - 0.101],
          [u + w * 0.78, 2.22, front + 0.101],
          glass,
        );
        if (detail >= 2)
          box(
            body,
            'timber',
            [u - 0.045, 1.14, front - 0.13],
            [u + 0.045, 2.21, front + 0.13],
            dark,
          );
      }
    }
  courtRoof(
    body,
    width + 0.45,
    depth + 0.62,
    3.02,
    Math.min(1.77, depth * 0.23),
    greyTile,
    detail,
    true,
    0.15,
  );
}

function crossing(out, bridge, detail) {
  const { width, offset, toe, abutments } = bridge;
  const profile = detail === 0 ? bridge.profile.filter((_, i) => i % 2 === 0) : bridge.profile;
  const x0 = offset - width / 2;
  const x1 = offset + width / 2;
  const at =
    (x, d = 0) =>
    ([u, y, z]) => [x + u, y + d, z];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    face(out, 'stone', [at(x0)(a), at(x0)(b), at(x1)(b), at(x1)(a)], stone, up);
    face(
      out,
      'stone',
      [at(x0, -0.67)(a), at(x1, -0.67)(a), at(x1, -0.67)(b), at(x0, -0.67)(b)],
      stone,
      [0, -1, 0],
    );
    for (const [x, sign] of [
      [x0, -1],
      [x1, 1],
    ]) {
      face(out, 'stone', [at(x)(a), at(x)(b), at(x, -0.67)(b), at(x, -0.67)(a)], stone, [
        sign,
        0,
        0,
      ]);
      if (detail > 0) beam(out, 'marble', at(x, 0.16)(a), at(x, 0.16)(b), 0.24, 0.35, marble);
    }
  }
  for (const { from, to, y, x } of abutments)
    box(out, 'stone', [x0 + x, toe, from], [x1 + x, y - 0.01, to], stone);
  const a = profile[0],
    b = profile.at(-1);
  for (const x of [x0, x1]) {
    const n = detail === 0 ? 2 : Math.ceil(Math.abs(b[2] - a[2]) / 2.55);
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const z = a[2] + ((b[2] - a[2]) * i) / n;
      const k = Math.min(profile.length - 2, Math.floor((i / n) * (profile.length - 1)));
      const [p, q] = [profile[k], profile[k + 1]];
      const t = (z - p[2]) / (q[2] - p[2]);
      return [x + p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, z];
    });
    for (const [i, [px, y, z]] of points.entries()) {
      box(out, 'marble', [px - 0.19, y + 0.04, z - 0.18], [px + 0.19, y + 1.02, z + 0.18], marble);
      if (detail >= 2)
        box(
          out,
          'marble',
          [px - 0.213, y + 0.94, z - 0.218],
          [px + 0.213, y + 1.087, z + 0.218],
          marble,
        );
      if (!i) continue;
      const [ux, h, uz] = points[i - 1];
      for (const [height, thick] of [
        [0.33, 0.41],
        [0.82, 0.13],
      ].slice(detail === 0 ? 1 : 0))
        beam(out, 'marble', [ux, h + height, uz], [px, y + height, z], thick, 0.17, marble);
      if (detail >= 2) {
        const left = uz + (z - uz) * 0.1;
        const right = uz + (z - uz) * 0.9;
        const mid = (z + uz) / 2;
        const lowY = (y + h) / 2 + 0.51;
        for (const side of [-1, 1]) {
          beam(
            out,
            'marble',
            [px, lowY, left],
            [px, lowY + side * 0.105, mid],
            0.088,
            0.145,
            marble,
          );
          beam(
            out,
            'marble',
            [px, lowY + side * 0.105, mid],
            [px, lowY, right],
            0.088,
            0.145,
            marble,
          );
        }
      }
    }
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  const { gate, canopy, lions, bridge, walks } = layout.westGate;
  gatehouse(out, gate, detail);
  checkpoint(out, canopy, detail);
  crossing(out, bridge, detail);
  for (const walk of walks)
    for (let i = 1; i < walk.length; i++)
      face(out, 'stone', [...walk[i - 1], ...walk[i].toReversed()], stone, up);
  for (const lion of lions) {
    if (detail === 0) continue;
    guardian(out, lion, detail);
    if (detail >= 2) {
      const { x, z, grade } = lion;
      const left = x - 1.05,
        right = x + 1.05;
      queueRail(out, [left, z - 0.98], [left, z + 1.03], grade, detail);
      queueRail(out, [right, z - 0.98], [right, z + 1.03], grade, detail);
      queueRail(out, [left, z + 1.03], [right, z + 1.03], grade, detail);
    }
  }
  for (const site of layout.sites) ticketOffice(out, site, detail);
}
