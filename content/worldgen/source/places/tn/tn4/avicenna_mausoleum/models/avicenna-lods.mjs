/** Complete distant composition; the detailed museum/tower master remains unchanged. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const map = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url))),
  outline = map.geometry.parts.find((p) => p.id === 698835433).local,
  stone = [0.53, 0.515, 0.46],
  light = [0.68, 0.66, 0.58],
  cement = [0.62, 0.6, 0.52],
  dark = [0.07, 0.073, 0.068];

// Use the public cap API for the concave museum and open stair passage.
function cap(out, ring, y, color, holes = [], slot = 'avicenna_granite') {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      slot,
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Avicenna museum roof triangulation failed');
  const mesh = temp.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3)
    triangle(
      out,
      slot,
      Array.from(mesh.indices.slice(i, i + 3), (j) =>
        Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
      ),
      color,
    );
}

function wall(out, a, b, y0, y1, color = stone) {
  face(
    out,
    'avicenna_granite',
    [
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
    ],
    color,
  );
}

function card(out, x0, x1, y0, y1, z, slot = 'shadow', color = dark) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}

/** A closed graded stair/ramp volume: no floating treads or reversed incline. */
function incline(out, a, b, width, y0, y1, curbs = false) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    target = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]),
    half = width / 2;
  face(
    target,
    'avicenna_granite',
    [
      [0, y0, half],
      [length, y1, half],
      [length, y1, -half],
      [0, y0, -half],
    ],
    light,
  );
  for (const sign of [-1, 1]) {
    const p = [
      [0, 0, sign * half],
      ...(y0 === 0 ? [] : [[0, y0, sign * half]]),
      [length, y1, sign * half],
      [length, 0, sign * half],
    ];
    if (sign > 0) p.reverse();
    if (p.length === 3) triangle(target, 'avicenna_granite', p, stone);
    else face(target, 'avicenna_granite', p, stone);
    if (curbs)
      beam(
        target,
        'avicenna_granite',
        [0, y0 + 0.2, sign * half],
        [length, y1 + 0.2, sign * half],
        0.24,
        0.32,
        light,
      );
  }
  face(
    target,
    'avicenna_granite',
    [
      [length, 0, -half],
      [length, y1, -half],
      [length, y1, half],
      [length, 0, half],
    ],
    stone,
  );
}

function recessedWall(out, a, b, y0, y1, holes) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    target = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]),
    xs = [...new Set([0, length, ...holes.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b),
    ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const x = (xs[i - 1] + xs[i]) / 2,
        y = (ys[j - 1] + ys[j]) / 2;
      if (!holes.some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1))
        card(target, xs[i - 1], xs[i], ys[j - 1], ys[j], 0, 'avicenna_granite', stone);
    }
  for (const h of holes) {
    const ring = [
      [h.x0, h.y0, 0],
      [h.x1, h.y0, 0],
      [h.x1, h.y1, 0],
      [h.x0, h.y1, 0],
    ];
    for (let i = 0; i < 4; i++) {
      const a = ring[i],
        b = ring[(i + 1) % 4];
      face(target, 'avicenna_granite', [b, a, [a[0], a[1], -0.35], [b[0], b[1], -0.35]], light);
    }
    card(target, h.x0, h.x1, h.y0, h.y1, -0.35);
  }
}

function access(out, a, b, width, y0, y1, count, district) {
  if (!district) return incline(out, a, b, width, y0, y1);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    target = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
  for (let i = 0; i < count; i++)
    box(
      target,
      'avicenna_granite',
      [(length * i) / count, y0, -width / 2],
      [(length * (i + 1)) / count, y0 + ((y1 - y0) * (i + 1)) / count, width / 2],
      light,
    );
}

function museum(out, district = false) {
  cap(out, outline, 5.5, light, [
    [
      [-25.4, -0.9],
      [-7, -0.9],
      [-7, 1.4],
      [-25.4, 1.4],
    ],
  ]);
  cap(out, outline, 0.03, stone);
  for (let i = 0; i < outline.length; i++)
    if (i !== 8 && i !== 9) wall(out, outline[(i + 1) % outline.length], outline[i], 0, 5.5);

  box(out, 'avicenna_granite', [-12.17, 0.93, 16.9], [15.22, 1.08, 20.3], light);
  if (district)
    recessedWall(out, [-12.2, 16.92], [15.25, 16.92], 1.08, 5.5, [
      { x0: 11.35, x1: 15.85, y0: 1.08, y1: 4.58 },
      ...[-8.6, -3.7, 8.8, 12.5].map((x) => ({
        x0: x + 12.2 - 0.73,
        x1: x + 12.2 + 0.73,
        y0: 2.65,
        y1: 4.25,
      })),
    ]);
  else {
    wall(out, [-12.2, 16.92], [15.25, 16.92], 1.08, 5.5);
    for (const x of [-8.6, -3.7, 8.8, 12.5]) card(out, x - 0.73, x + 0.73, 2.65, 4.25, 16.93);
  }
  card(out, -0.85, 3.65, 1.08, 4.58, district ? 16.58 : 16.93, 'metal', [0.2, 0.19, 0.155]);
  for (let i = 0; i < 10; i++) {
    const x = -11.3 + (25.45 * i) / 9;
    loft(
      out,
      'avicenna_granite',
      [
        radialRing(1.08, 0.475, 0.475, district ? 12 : 6, [x, 20.12]),
        radialRing(5.18, 0.375, 0.375, district ? 12 : 6, [x, 20.12]),
      ],
      light,
      { cap: false },
    );
  }
  box(out, 'avicenna_granite', [-12.25, 5.18, 16.8], [15.3, 5.5, 20.4], light);

  access(out, [1.4, 21.65], [1.4, 20.3], 27.4, 0, 1.08, 6, district);
  access(out, [37.35, 16.45], [37.35, 4.68], 1.42, 0, 5.5, 33, district);
  access(out, [-12.25, 24.48], [-18.54, 24.48], 2.85, 0, 5.5, 30, district);
  access(out, [-25.4, 0.25], [-7, 0.25], 2.25, 0, 7.5, 43, district);
  for (const z of [-1.03, 1.54]) wall(out, [-25.4, z], [-7, z], 0, 5.5);
  for (const sign of [-1, 1]) {
    incline(out, [sign * 3.2, -12.15], [sign * 22, -12.15], 2.8, 0.08, 5.5, true);
    box(
      out,
      'avicenna_granite',
      [sign * 22 - 0.48, 5.32, -13.55],
      [sign * 22 + 0.48, 5.5, -7.5],
      light,
    );
  }
  for (const [a, b, c, d] of [
    [10.2, 34, -7.8, 10.8],
    [-23.2, -10, 4.4, 20.2],
  ]) {
    cap(
      out,
      [
        [a, c],
        [b, c],
        [b, d],
        [a, d],
      ],
      5.575,
      [0.25, 0.3, 0.19],
      [],
      'turf',
    );
    for (const z of [c - 0.14, d + 0.14])
      box(out, 'avicenna_granite', [a - 0.28, 5.5, z - 0.14], [b + 0.28, 5.78, z + 0.14], stone);
    for (const x of [a - 0.14, b + 0.14])
      box(out, 'avicenna_granite', [x - 0.14, 5.5, c], [x + 0.14, 5.78, d], stone);
  }
  for (const x of [-5.5, 5.5])
    for (const z of [-9.3, 11.5]) {
      box(out, 'avicenna_granite', [x - 0.42, 5.5, z - 0.42], [x + 0.42, 6.27, z + 0.42], stone);
      box(out, 'avicenna_granite', [x - 0.62, 6.27, z - 0.62], [x + 0.62, 6.45, z + 0.62], light);
    }
}

function memorial(out, district = false) {
  if (!district)
    box(out, 'avicenna_granite', [-6.9795, 5.5, -6.7725], [6.9795, 7.32, 6.7725], stone);
  for (let side = 0; side < 4; side++) {
    const target = transform(out, (side * Math.PI) / 2),
      z = side % 2 ? 6.98 : 6.773;
    if (district) {
      const width = side % 2 ? 13.545 : 13.959;
      recessedWall(
        target,
        [-width / 2, z],
        [width / 2, z],
        5.5,
        7.32,
        [-3.05, 0, 3.05].map((x) => ({
          x0: x - 1.08 + width / 2,
          x1: x + 1.08 + width / 2,
          y0: 6.17,
          y1: 7.07,
        })),
      );
    } else
      for (const x of [-3.05, 0, 3.05]) card(target, x - 1.08, x + 1.08, 6.17, 7.07, z + 0.005);
  }
  box(out, 'avicenna_granite', [-7.11, 7.32, -6.92], [7.11, 7.5, 6.92], light);
  // All twelve independent, open ribs survive even at the skyline tier.
  for (let i = 0; i < 12; i++) {
    const target = transform(out, (i * Math.PI) / 6 + Math.PI / 12, [0.44, 0, -0.04]),
      ring = (y, outer, inner, half) => {
        const p = [
          [outer, y, half],
          [outer, y, -half],
          [inner, y, -half],
        ];
        if (district)
          for (let j = 1; j <= 4; j++) {
            const a = -Math.PI / 2 - (j * Math.PI) / 4;
            p.push([inner + Math.cos(a) * half, y, Math.sin(a) * half]);
          }
        else p.push([inner, y, half]);
        return p;
      };
    loft(
      target,
      'concrete',
      [
        ring(7.5, 3.85, 2.7, 0.19),
        ...(district ? [ring(7.85, 3.8, 2.71, 0.185)] : []),
        ring(23.85, 2.28, 1.6, 0.16),
        ring(25.1, 2.2, 1.6, 0.16),
      ],
      cement,
      { cap: false },
    );
  }
  const center = [0.44, -0.04];
  loft(
    out,
    'concrete',
    [
      [23.73, 1.73],
      [24.05, 1.91],
      [24.92, 1.82],
      [25.1, 2.05],
    ].map(([y, r]) => radialRing(y, r, r, district ? 24 : 8, center)),
    cement,
    { cap: false },
  );
  loft(
    out,
    'concrete',
    [
      radialRing(25.1, 2.05, 2.05, district ? 24 : 8, center),
      radialRing(28.5, 0.016, 0.016, district ? 24 : 8, center),
    ],
    light,
  );
  box(out, 'avicenna_granite', [-0.74, 7.5, -1.02], [1.5, 7.78, 0.94], light);
  box(out, 'metal', [-0.53, 7.78, -0.83], [1.27, 8.17, 0.75], [0.43, 0.35, 0.19]);
  box(out, 'metal', [-0.57, 8.17, -0.87], [1.31, 8.24, 0.79], [0.63, 0.53, 0.32]);
}

export function avicennaSkyline(out) {
  const target = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        out[method](
          slot,
          ref,
          p,
          n,
          uv,
          ['shadow', 'turf'].includes(slot) ? color : color.map((v) => v * 0.65),
        ),
    ]),
  );
  museum(target);
  memorial(target);
}

export function avicennaDistrict(out) {
  museum(out, true);
  memorial(out, true);
}
