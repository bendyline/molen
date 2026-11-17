/** The Louvre Palace galleries, roof pavilions, court façades and pyramid group. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { volodymyrDeckTriangles as triangulate } from '../../../../../../../../packages/worldgen/scripts/volodymyr-deck-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.88 },
  ashlar: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.9 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.83 },
  lead: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.3 },
  glazing: { slot: 'window', graph: 'window_grid', roughness: 0.29, metallic: 0.18 },
};
const stone = [0.74, 0.615, 0.465],
  base = [0.54, 0.446, 0.337],
  light = [0.83, 0.706, 0.537],
  dark = [0.148, 0.171, 0.167];
const slate = [0.24, 0.269, 0.278],
  lead = [0.35, 0.389, 0.403],
  glass = [0.32, 0.53, 0.61];
const up = [0, 1, 0],
  down = [0, -1, 0],
  clip = (x, a, b) => Math.max(a, Math.min(b, x));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

function triangle(out, slot, points, color, direction) {
  const normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.8) return;
  if (direction && dot(normal, direction) < 0) {
    points = points.toReversed();
    out.addTriangle(
      slot,
      '',
      points,
      normal.map((v) => -v),
      undefined,
      color,
    );
  } else out.addTriangle(slot, '', points, normal, undefined, color);
}
function quad(out, slot, [a, b, c, d], color, direction) {
  triangle(out, slot, [a, b, c], color, direction);
  triangle(out, slot, [a, c, d], color, direction);
}
function area(ring) {
  return (
    ring.reduce((sum, [x, z], i) => {
      const [u, v] = ring[(i + 1) % ring.length];
      return sum + x * v - u * z;
    }, 0) / 2
  );
}
function shell(out, rings, bottom, top, detail) {
  for (const ring of rings)
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length];
      quad(
        out,
        'wall',
        [
          [a[0], bottom, a[1]],
          [b[0], bottom, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        stone,
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  for (const corners of triangulate(rings[0], rings.slice(1))) {
    triangle(
      out,
      'slate',
      corners.map(([x, z]) => [x, top, z]),
      slate,
      up,
    );
    if (detail >= 2)
      triangle(
        out,
        'ashlar',
        corners.map(([x, z]) => [x, bottom, z]),
        base,
        down,
      );
  }
}
function frame(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const u = dx / length,
    v = dz / length;
  return {
    length,
    point: (distance, y, offset = 0) => [
      a[0] + u * distance - v * offset,
      y,
      a[1] + v * distance + u * offset,
    ],
    normal: [v, 0, -u],
  };
}
function roof(out, form, width, height, y, detail, steep) {
  const { length, point } = form,
    eave = width / 2;
  if (steep) {
    const steepRoof = [
      [0, y, length, eave],
      [0.1, y + height * 0.73, length * 0.9, eave * 0.62],
      [0.23, y + height * 0.96, length * 0.77, eave * 0.23],
      [0.42, y + height, length * 0.58, eave * 0.105],
    ];
    const rings = (detail === 0 ? [steepRoof[0], steepRoof[2], steepRoof[3]] : steepRoof).map(
      ([from, h, to, w]) => [
        point(from, h, w),
        point(to, h, w),
        point(to, h, -w),
        point(from, h, -w),
      ],
    );
    loft(out, 'slate', rings, slate);
    if (detail >= 2)
      beam(
        out,
        'lead',
        point(length * 0.39, y + height + 0.09),
        point(length * 0.61, y + height + 0.09),
        0.28,
        0.32,
        lead,
      );
    return;
  }
  const h = Math.min(width * 0.22, height),
    heel = Math.min(length * 0.16, 3.4);
  for (const side of [-1, 1]) {
    quad(
      out,
      'slate',
      [
        point(0, y, side * eave),
        point(length, y, side * eave),
        point(length - heel, y + h),
        point(heel, y + h),
      ],
      slate,
      up,
    );
  }
  for (const end of [0, length]) {
    const inward = end === 0 ? heel : length - heel;
    triangle(
      out,
      'slate',
      [point(end, y, -eave), point(inward, y + h), point(end, y, eave)],
      slate,
      up,
    );
  }
  if (detail >= 2)
    beam(
      out,
      'lead',
      point(heel, y + h + 0.05),
      point(length - heel, y + h + 0.05),
      0.18,
      0.21,
      lead,
    );
}
function decoratedWindow(out, form, x, y, width, height, arched, detail, offset) {
  const { point, normal } = form,
    radius = width / 2,
    spring = height - Math.min(radius, height * 0.31);
  let face;
  if (arched && detail >= 2) {
    const apron = [
      [x - radius, y],
      [x + radius, y],
    ];
    const arch = Array.from({ length: detail === 4 ? 9 : 5 }, (_, i) => {
      const t = (i * Math.PI) / (detail === 4 ? 8 : 4);
      return [x + Math.cos(t) * radius, y + spring + Math.sin(t) * (height - spring)];
    });
    face = [...apron, ...arch];
  } else
    face = [
      [x - radius, y],
      [x + radius, y],
      [x + radius, y + height],
      [x - radius, y + height],
    ];
  const fill = ([u, v], w) => point(u, v, w);
  const mid = point(x, y + height * 0.37, offset - 0.012);
  for (const [i, a] of face.entries()) {
    const b = face[(i + 1) % face.length];
    triangle(out, 'lead', [fill(a, offset + 0.062), fill(b, offset + 0.062), mid], dark, normal);
  }
  if (detail < 3) return;
  const margin = 0.18;
  const expanded = face.map(([u, v]) => [
    u + (u < x ? -margin : margin),
    v + (v > y + height * 0.5 ? margin : -margin),
  ]);
  for (const [i, a] of face.entries()) {
    const z = (i + 1) % face.length,
      b = face[z];
    quad(
      out,
      'wall',
      [
        fill(a, offset - 0.025),
        fill(b, offset - 0.025),
        fill(expanded[z], offset - 0.13),
        fill(expanded[i], offset - 0.13),
      ],
      light,
      normal,
    );
  }
  beam(
    out,
    'wall',
    point(x - radius - 0.14, y, offset - 0.12),
    point(x + radius + 0.14, y, offset - 0.12),
    0.29,
    0.22,
    light,
  );
  if (detail === 4) {
    beam(
      out,
      'lead',
      point(x, y + 0.05, offset - 0.028),
      point(x, y + height - 0.19, offset + 0.035),
      0.07,
      0.08,
      lead,
    );
    beam(
      out,
      'lead',
      point(x - radius + 0.06, y + height * 0.63, offset + 0.035),
      point(x + radius - 0.06, y + height * 0.63, offset + 0.035),
      0.07,
      0.08,
      lead,
    );
  }
}
function façade(out, rings, detail) {
  if (!detail) return;
  for (const ring of rings)
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length],
        f = frame(a, b);
      if (f.length < (detail === 1 ? 8 : 5.5)) continue;
      const { point, normal, length } = f,
        n = Math.max(
          1,
          Math.floor(
            length / (detail === 1 ? 12.5 : detail === 2 ? 7.4 : detail === 3 ? 5.1 : 4.7),
          ),
        );
      for (const [y, x] of [
        [3.1, 0.25],
        [8.4, 0.49],
        [14.1, 0.48],
        [18.3, 0.67],
      ]) {
        if (detail === 1 && y < 13) continue;
        const h = y === 18.3 ? 0.25 : 0.13;
        quad(
          out,
          'wall',
          [
            point(0.1, y - h, -x),
            point(length - 0.1, y - h, -x),
            point(length - 0.1, y + h, -x),
            point(0.1, y + h, -x),
          ],
          light,
          normal,
        );
      }
      const step = length / n;
      const stories =
        detail === 1
          ? [[10.6, 3.0]]
          : [
              [1.75, 4],
              [7.8, 3.8],
              [13.15, 3.1],
            ];
      for (let j = 0; j < n; j++) {
        const x = (j + 0.5) * step,
          width = Math.min(2.12, step * 0.48),
          at = 0.031;
        for (const [index, [y, h]] of stories.entries())
          decoratedWindow(out, f, x, y, width, h, index === 0 || detail === 4, detail, -at);
        if (detail >= 3 && j > 0) {
          const x0 = j * step;
          beam(out, 'wall', point(x0, 6.95, -0.3), point(x0, 17.95, -0.3), 0.56, 0.47, light);
          if (detail === 4) {
            beam(
              out,
              'wall',
              point(x0 - 0.38, 7, -0.34),
              point(x0 + 0.38, 7, -0.34),
              0.35,
              0.28,
              light,
            );
            beam(
              out,
              'wall',
              point(x0 - 0.44, 17.7, -0.34),
              point(x0 + 0.44, 17.7, -0.34),
              0.41,
              0.3,
              light,
            );
          }
        }
      }
    }
}
function courtyardFacades(out, ring, detail) {
  if (detail < 2) return;
  for (const [a, b] of [
    [
      [178, -79],
      [184, 31],
    ],
    [
      [304, 31],
      [300, -90],
    ],
    [
      [290, -91],
      [184, -86],
    ],
    [
      [185, 34],
      [296, 27],
    ],
  ]) {
    const f = frame(a, b),
      count = Math.floor(f.length / 5.35);
    for (let i = 0; i < count; i++) {
      const d = (f.length * (i + 0.5)) / count;
      const [x, , z] = f.point(d, 0);
      const nearest = ring.reduce(
        (best, p, j) => {
          const q = ring[(j + 1) % ring.length],
            dx = q[0] - p[0],
            dz = q[1] - p[1];
          const t = clip(((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
          const u = p[0] + dx * t,
            v = p[1] + dz * t,
            distance = Math.hypot(u - x, v - z);
          return distance < best.distance ? { u, v, distance } : best;
        },
        { distance: Infinity, u: 0, v: 0 },
      );
      if (nearest.distance > 12) continue;
      const d2 = (nearest.u - x) * f.normal[0] + (nearest.v - z) * f.normal[2];
      for (const [index, [h, span]] of [
        [8.25, 3.2],
        [13.25, 2.9],
      ].entries()) {
        decoratedWindow(out, f, d, h, 1.88, span, index === 0, detail === 4 ? 3 : 2, -d2 - 0.35);
      }
    }
  }
}
function pavilion(out, control, detail) {
  const [, x, z, width, depth, wall, rise] = control;
  const z0 = z - depth / 2;
  box(
    out,
    'wall',
    [x - width / 2, 14.9, z - depth / 2],
    [x + width / 2, wall, z + depth / 2],
    stone,
  );
  if (detail >= 2)
    for (const dy of [wall - 2.18, wall - 0.22])
      box(
        out,
        'wall',
        [x - width / 2 - 0.29, dy - 0.22, z - depth / 2 - 0.28],
        [x + width / 2 + 0.29, dy + 0.22, z + depth / 2 + 0.28],
        light,
      );
  roof(
    out,
    frame([x - width / 2, z], [x + width / 2, z]),
    depth + 0.48,
    rise,
    wall + 0.18,
    detail,
    true,
  );
  if (detail === 0) return;
  for (const side of [-1, 1]) {
    const order =
      side === -1
        ? [
            [x - width / 2, z0],
            [x + width / 2, z0],
          ]
        : [
            [x + width / 2, z + depth / 2],
            [x - width / 2, z + depth / 2],
          ];
    const front = frame(...order);
    const count = width > 21 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const slot = (width * (i + 0.5)) / count;
      decoratedWindow(
        out,
        front,
        slot,
        17.36,
        Math.min(2.22, (width / count) * 0.5),
        Math.min(4.28, wall - 17.7),
        true,
        detail,
        -0.03,
      );
    }
    if (detail >= 2) {
      const axis = -0.31;
      const y = wall - 1.06,
        half = width * 0.32;
      triangle(
        out,
        'wall',
        [
          front.point(width / 2 - half, y, axis),
          front.point(width / 2 + half, y, axis),
          front.point(width / 2, y + Math.min(3.7, width * 0.145), axis),
        ],
        light,
        front.normal,
      );
    }
  }
  if (detail === 4) {
    const y = wall + rise - 0.2;
    beam(out, 'lead', [x - width * 0.21, y, z], [x + width * 0.21, y, z], 0.43, 0.37, lead);
    beam(out, 'lead', [x, y, z], [x, y + 1.45, z], 0.18, 0.16, lead);
  }
}
function colonnade(out, detail) {
  const front = frame([319, -77], [327, 28]),
    { point, length } = front;
  if (detail === 0) return;
  const count = detail === 1 ? 12 : 25;
  for (let i = 0; i < count; i++) {
    const t = ((i + 0.5) * length) / count;
    if (Math.abs(i - (count - 1) / 2) < 1) continue;
    const [x, , z] = point(t, 0, -1.35);
    const sides = detail >= 3 ? 8 : 4;
    loft(
      out,
      'wall',
      [
        radialRing(8.4, 0.57, 0.57, sides, [x, z]),
        ...(detail >= 2
          ? [
              radialRing(9.05, 0.44, 0.44, sides, [x, z]),
              radialRing(16.52, 0.39, 0.39, sides, [x, z]),
            ]
          : []),
        radialRing(16.93, 0.65, 0.65, sides, [x, z]),
      ],
      light,
      { cap: false },
    );
  }
  if (detail >= 2)
    beam(out, 'wall', point(1, 17.31, -1.13), point(length - 1, 17.31, -1.13), 0.86, 0.6, light);
}
function pyramids(out, detail) {
  for (const shape of layout.pyramids) {
    const base = shape.base.map(([x, z]) => [x, shape.ground, z]),
      center = base[0].map((_, i) => base.reduce((n, p) => n + p[i], 0) / 4);
    const peak = [center[0], center[1] + shape.height, center[2]];
    for (const [i, a] of base.entries()) {
      const b = base[(i + 1) % base.length];
      triangle(out, 'glazing', [a, b, peak], glass, [
        a[0] + b[0] - 2 * center[0],
        0,
        a[2] + b[2] - 2 * center[2],
      ]);
      if (detail === 0) continue;
      beam(out, 'lead', a, peak, shape.height > 10 ? 0.17 : 0.07, 0.135, lead);
      beam(out, 'lead', a, b, 0.17, 0.18, lead);
      if (detail < 2 || shape.height < 10) continue;
      const count = detail === 2 ? 8 : detail === 3 ? 13 : 18;
      const lerp = (p, q, t) => p.map((v, j) => v + (q[j] - v) * t);
      for (let j = 1; j < count; j++) {
        const t = j / count,
          p = lerp(a, peak, t),
          q = lerp(b, peak, t);
        beam(out, 'lead', p, q, 0.052, 0.055, lead);
        beam(out, 'lead', lerp(a, b, t), lerp(a, peak, 1 - t), 0.052, 0.055, lead);
        beam(out, 'lead', lerp(a, b, t), lerp(b, peak, t), 0.052, 0.055, lead);
      }
    }
  }
}
function courtRoofs(out, detail) {
  for (const { corners, eave, rise, form } of layout.coveredCourts) {
    const canopy = form === 'canopy';
    const point = (u, v) => {
      const weights = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
      const x = corners.reduce((n, p, i) => n + p[0] * weights[i], 0);
      const z = corners.reduce((n, p, i) => n + p[1] * weights[i], 0);
      const crown = canopy
        ? (0.3 + 0.7 * Math.sin(Math.PI * v)) * (0.64 + 0.36 * Math.sin(2 * Math.PI * u))
        : Math.min(u * 4, (1 - u) * 4, v * 2, (1 - v) * 2, 1);
      return [x, eave + rise * crown, z];
    };
    const divisions = canopy ? detail + 4 : detail < 2 ? 4 : detail === 2 ? 8 : 12;
    const bands = canopy && detail >= 2 ? 4 : 2;
    const slot = canopy ? 'lead' : 'glazing';
    const color = canopy ? [0.59, 0.44, 0.24] : [0.41, 0.55, 0.57];
    for (let i = 0; i < divisions; i++) {
      for (let j = 0; j < bands; j++) {
        const u = i / divisions;
        const v = j / bands;
        const nextU = (i + 1) / divisions;
        const nextV = (j + 1) / bands;
        const a = point(u, v);
        const b = point(nextU, v);
        const c = point(nextU, nextV);
        const d = point(u, nextV);
        quad(out, slot, [a, b, c, d], color, up);
        if (!canopy && detail >= 2 && i % 2 === 0) beam(out, 'lead', a, d, 0.105, 0.12, lead);
        if (!canopy && detail >= 3 && j === 1) beam(out, 'lead', a, b, 0.095, 0.12, lead);
      }
    }
  }
}
function build(out, detail) {
  const rings = layout.bases[detail];
  if (area(rings[0]) <= 0) throw Error('Louvre footprint must have area');
  shell(out, rings, -9.3, 18.42, detail);
  for (const [, a, b, , halfWidth] of layout.ranges)
    roof(out, frame(a, b), halfWidth * 2.55, 4.9, 18.47, detail, false);
  façade(out, rings, detail);
  courtyardFacades(out, rings[1], detail);
  for (const p of layout.pavilions) pavilion(out, p, detail);
  colonnade(out, detail);
  pyramids(out, detail);
  courtRoofs(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
