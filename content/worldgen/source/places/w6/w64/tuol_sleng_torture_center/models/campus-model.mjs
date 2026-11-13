import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const earcut = require('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));

export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco' },
  concrete: { slot: 'trim', graph: 'concrete_plain' },
  roof: { slot: 'trim', graph: 'concrete_plain' },
  breeze: { slot: 'trim', graph: 'brick_stack' },
  paint: { slot: 'trim', graph: 'metal_painted' },
  wire: { slot: 'trim', graph: 'metal_painted' },
  paving: { slot: 'foundation', graph: 'stone_granite' },
  stone: { slot: 'foundation', graph: 'stone_granite' },
  path: { slot: 'trim', graph: 'brick_stack' },
  foliage: { slot: 'trim', localRef: 'palette:#ffffff', doubleSided: true, roughness: 0.94 },
  lawn: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.96 },
  trunk: { slot: 'trim', graph: 'wood_plain' },
};
const palette = {
  wall: [0.83, 0.79, 0.69],
  columns: [0.82, 0.81, 0.73],
  edge: [0.59, 0.58, 0.52],
  base: [0.59, 0.58, 0.53],
  roof: [0.57, 0.56, 0.52],
  breeze: [0.59, 0.46, 0.29],
  shutter: [0.27, 0.32, 0.31],
  slate: [0.025, 0.033, 0.029],
  shade: [0.055, 0.065, 0.059],
  wire: [0.14, 0.1, 0.078],
  path: [0.56, 0.42, 0.31],
  paleStone: [0.83, 0.83, 0.77],
  greyStone: [0.61, 0.63, 0.58],
  blackStone: [0.085, 0.091, 0.085],
  lawn: [0.26, 0.37, 0.15],
  leaves: [0.18, 0.28, 0.08],
  freshLeaves: [0.24, 0.35, 0.1],
  bark: [0.26, 0.2, 0.13],
};
const rank = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };

function transform(out, [x, z], angle, y = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const vector = ([a, b, d]) => [c * a - s * d, b, s * a + c * d];
  const point = (v) => {
    const [a, b, d] = vector(v);
    return [a + x, b + y, d + z];
  };
  return {
    addQuad: (slot, ref, points, normal, uvs, color) =>
      out.addQuad(slot, ref, points.map(point), vector(normal), uvs, color),
    addTriangle: (slot, ref, points, normal, uvs, color) =>
      out.addTriangle(slot, ref, points.map(point), vector(normal), uvs, color),
    addConvexPolygon: (slot, ref, points, normal, uv, color) =>
      out.addConvexPolygon(slot, ref, points.map(point), vector(normal), uv, color),
  };
}

function ground(x, z) {
  const { origin, size, step, values } = layout.grade;
  const [u, v] = [x, z].map((p, i) =>
    Math.max(0, Math.min(size[i] - 1.001, (p - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * size[0] + i;
  return (
    (1 - b) * ((1 - a) * values[k] + a * values[k + 1]) +
    b * ((1 - a) * values[k + size[0]] + a * values[k + size[0] + 1])
  );
}

function groundRange(points) {
  const heights = points.map((p) => ground(...p));
  return [Math.min(...heights), Math.max(...heights)];
}

function sampledEdge(a, b, sections = 8) {
  return Array.from({ length: sections + 1 }, (_, i) =>
    a.map((v, j) => v + ((b[j] - v) * i) / sections),
  );
}

function pavement(out, x, z, w, d, material, tint, lift = 0.045) {
  const cols = Math.ceil(w / 4),
    rows = Math.ceil(d / 4);
  const point = (i, j) => {
    const xx = x + (w * i) / cols,
      zz = z + (d * j) / rows;
    return [xx, ground(xx, zz) + lift, zz];
  };
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const a = point(i, j),
        b = point(i, j + 1),
        c = point(i + 1, j + 1),
        d = point(i + 1, j);
      for (const tri of [
        [a, b, c],
        [a, c, d],
      ])
        out.addTriangle(
          material,
          '',
          tri,
          normalFor(...tri),
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          palette[tint],
        );
    }
}

function block(out, material, color, x, y, z, w, h, d) {
  box(out, material, [x, y, z], [x + w, y + h, z + d], palette[color]);
}

function panel(out, material, color, x, y, z, w, h) {
  quad(
    out,
    material,
    [
      [x, y, z],
      [x + w, y, z],
      [x + w, y + h, z],
      [x, y + h, z],
    ],
    [0, 0, 1],
    palette[color],
  );
}

function vents(out, x, y, z, w, h, detail) {
  const columns = detail >= 3 ? 12 : 7;
  const rows = detail >= 3 ? 4 : 2;
  const rib = detail >= 3 ? 0.044 : 0.073;
  panel(out, 'paint', 'shade', x, y, z + 0.003, w, h);
  if (detail === 1) {
    panel(out, 'breeze', 'breeze', x, y, z + 0.023, w, 0.09);
    return;
  }
  const ribFace = (x, y, w, h) =>
    detail >= 4
      ? block(out, 'breeze', 'breeze', x, y, z, w, h, 0.095)
      : panel(out, 'breeze', 'breeze', x, y, z + 0.032, w, h);
  for (let i = 0; i <= columns; i++) ribFace(x + (w * i) / columns - rib / 2, y, rib, h);
  for (let i = 0; i <= rows; i++) ribFace(x, y + (h * i) / rows - rib / 2, w, rib);
}

function shutter(out, x, y, z, w, h, detail) {
  if (detail >= 3) block(out, 'paint', 'shutter', x, y, z, w, h, 0.08);
  else panel(out, 'paint', 'shutter', x, y, z + 0.079, w, h);
  if (detail < 2) return;
  const rows = detail >= 3 ? 9 : 4;
  for (let i = 1; i < rows; i++)
    panel(out, 'paint', 'shade', x + 0.08, y + (h * i) / rows, z + 0.087, w - 0.16, 0.027);
  panel(out, 'paint', 'shutter', x + w / 2 - 0.032, y, z + 0.101, 0.064, h);
}

function frontBay(out, x, w, y, top, z, open, detail) {
  const gap = w * 0.65,
    start = x + (w - gap) / 2;
  const sill = y + (open ? 0.05 : 0.87),
    head = y + 2.24;
  panel(out, 'wall', 'wall', x, y, z, start - x, top - y);
  panel(out, 'wall', 'wall', start + gap, y, z, x + w - start - gap, top - y);
  panel(out, 'wall', 'wall', start, y, z, gap, sill - y);
  panel(out, 'wall', 'wall', start, head, z, gap, top - head);
  panel(out, 'paint', 'shade', start - 0.17, sill - 0.17, z - 0.34, gap + 0.34, head - sill + 0.34);
  if (detail >= 3) {
    for (const side of [start - 0.024, start + gap])
      block(out, 'wall', 'edge', side, sill, z - 0.26, 0.024, head - sill, 0.27);
    block(out, 'concrete', 'edge', start, sill - 0.04, z - 0.26, gap, 0.04, 0.28);
  }
  if (open) {
    shutter(out, start + 0.02, sill, z, gap * 0.23, head - sill, detail);
    shutter(out, start + gap * 0.76, sill, z, gap * 0.23, head - sill, detail);
  } else {
    shutter(out, start + 0.12, sill, z - 0.015, gap - 0.24, head - sill, detail);
  }
  vents(out, start, y + 2.46, z + 0.01, gap, 0.59, detail);
}

function wireScreen(out, length, y, detail) {
  const h = 2.34,
    z = 0.047;
  const spacing = detail === 2 ? 0.49 : detail === 3 ? 0.26 : 0.2;
  const width = detail === 2 ? 0.02 : 0.012;
  if (detail === 2) {
    for (let h0 = 0; h0 < h; h0 += spacing) panel(out, 'wire', 'wire', 0, y + h0, z, length, width);
    for (let x = 0; x < length - width; x += spacing)
      panel(out, 'wire', 'wire', x, y, z + 0.001, width, h);
    return;
  }
  const steps = Math.ceil(length / 1.1),
    drape = (i) => -0.055 * Math.sin(i * 1.31);
  for (let row = 0; row <= Math.ceil(h / spacing); row++) {
    const yy = y + row * spacing;
    if (yy > y + h) break;
    for (let i = 0; i < steps; i++) {
      const a = [(length * i) / steps, yy + drape(i), z];
      const b = [(length * (i + 1)) / steps, yy + drape(i + 1), z];
      beam(out, 'wire', a, b, width, width, palette.wire);
    }
  }
  for (let i = 0; i * spacing < length; i++)
    beam(
      out,
      'wire',
      [i * spacing, y - 0.02, z],
      [i * spacing + 0.04 * Math.sin(i), y + h - 0.03 * Math.sin(i), z],
      width,
      width,
      palette.wire,
    );
}

function school(out, school, detail) {
  const { length: l, width: w, height, bays, name, screen } = school;
  const c = Math.cos(school.azimuth),
    s = Math.sin(school.azimuth),
    [x0, z0] = school.front;
  const footprint = school.outline.flatMap((p, i) => sampledEdge(p, school.outline[(i + 1) % 4]));
  const [low, high] = groundRange(footprint);
  const front = transform(out, school.front, school.azimuth, high);
  const rear = transform(front, [l, -w + 0.17], Math.PI);
  const setback = -2.05,
    base = 0.19,
    pitch = 3.38,
    bay = l / bays;
  const roofY = base + 3 * pitch;
  block(front, 'concrete', 'base', 0, low - high - 0.45, -w, l, high - low + 0.64, w);
  block(front, 'roof', 'roof', -0.09, roofY - 0.2, -w - 0.06, l + 0.18, 0.22, w + 0.18);
  block(front, 'concrete', 'edge', 0, roofY, -0.135, l, height - roofY, 0.23);
  block(front, 'concrete', 'edge', 0, roofY, -w, l, 0.51, 0.25);
  for (const x of [0, l - 0.27]) {
    block(front, 'wall', 'wall', x, base, -w + 0.22, 0.27, height - base - 0.18, w - 0.25);
    if (detail >= 2) {
      const side =
        x === 0 ? transform(front, [0, -w], Math.PI / 2) : transform(front, [l, 0], -Math.PI / 2);
      for (let i = 0; i < 3; i++) {
        const xx = w * 0.53;
        panel(side, 'paint', 'shade', xx, base + pitch * i + 0.93, 0.007, 0.76, 1.91);
        shutter(side, xx + 0.04, base + pitch * i + 1.02, 0.012, 0.68, 1.74, detail);
      }
    }
  }
  for (let floor = 0; floor < 3; floor++) {
    const y = base + floor * pitch;
    if (floor > 0) {
      block(front, 'concrete', 'columns', 0, y - 0.22, -w, l, 0.22, w + 0.12);
      block(front, 'concrete', 'edge', 0, y - 0.06, -0.15, l, 0.71, 0.25);
      if (detail > 0) block(front, 'concrete', 'columns', 0, y + 0.65, -0.18, l, 0.08, 0.3);
    }
    for (let i = 0; i <= bays; i++) {
      const x = Math.min(l - 0.22, Math.max(0, bay * i - 0.11));
      if (detail < 3) panel(front, 'concrete', 'columns', x, y, -0.01, 0.22, pitch - 0.21);
      else block(front, 'concrete', 'columns', x, y, -0.26, 0.22, pitch - 0.21, 0.25);
    }
    if (detail === 0) {
      panel(front, 'wall', 'wall', 0, y, setback, l, pitch - 0.2);
      panel(front, 'paint', 'shade', 0.8, y + 0.84, setback + 0.008, l - 1.6, 1.36);
      panel(rear, 'wall', 'wall', 0, y, 0, l, pitch - 0.2);
      continue;
    }
    if (detail < 3) {
      panel(rear, 'wall', 'wall', 0, y, 0, l, pitch - 0.2);
      for (let i = 0; i < bays; i++)
        panel(rear, 'paint', 'shutter', bay * (i + 0.2), y + 0.93, 0.009, bay * 0.6, 1.35);
    }
    if (detail === 1) {
      panel(front, 'wall', 'wall', 0, y, setback, l, pitch - 0.2);
      for (let i = 0; i < bays; i++) {
        const x = bay * (i + 0.18);
        panel(front, 'paint', 'shutter', x, y + 0.87, setback + 0.012, bay * 0.64, 1.4);
        panel(front, 'breeze', 'breeze', x, y + 2.5, setback + 0.015, bay * 0.64, 0.5);
      }
      continue;
    }
    for (let i = 0; i < bays; i++) {
      const x = bay * i,
        open = (i + floor + name.charCodeAt(0)) % 3 === 0;
      frontBay(front, x, bay, y, y + pitch - 0.2, setback, open, detail);
      if (detail >= 3) frontBay(rear, x, bay, y, y + pitch - 0.2, 0, false, detail === 4 ? 2 : 1);
    }
    if (floor > 0 && screen && detail >= 2) wireScreen(front, l, y + 0.68, detail);
  }
  if (detail >= 2) {
    // Return staircase screen at the end of the gallery, with sheltered ground doors.
    const tower = name === 'D' || name === 'B' ? l - 1.64 : 0.28;
    block(front, 'wall', 'edge', tower, base + 0.18, -0.33, 1.3, roofY - base - 0.18, 0.31);
    for (let floor = 0; floor < 3; floor++)
      vents(front, tower + 0.25, base + pitch * floor + 0.9, 0, 0.77, 1.75, detail === 2 ? 1 : 2);
    for (let i = 0; i < 2; i++)
      block(
        front,
        'concrete',
        'base',
        0.58,
        -0.09,
        -0.15 + i * 0.23,
        l - 1.16,
        0.28 - i * 0.09,
        0.25,
      );
    const doorBay = { A: 1, B: 6, C: 5, D: 4 }[name];
    const stairX = (doorBay + 0.5) * bay;
    const landing = ground(x0 + stairX * c, z0 + stairX * s);
    const count = Math.max(1, Math.ceil((high - landing) / 0.18));
    for (let i = 0; i < count; i++) {
      const y = landing - high + ((high - landing) * i) / count;
      block(
        front,
        'paving',
        'greyStone',
        stairX - 1.2,
        y - 0.2,
        0.42 + 0.3 * (count - 1 - i),
        2.4,
        0.36,
        0.31,
      );
    }
  }
}

function annex(out, detail) {
  const outline = layout.annex.outline;
  const [low, high] = groundRange(outline);
  out = transform(out, [0, 0], 0, high);
  const triangles = earcut(outline.flat(), undefined, 2),
    height = 3.72;
  for (let i = 0; i < triangles.length; i += 3) {
    let points = triangles.slice(i, i + 3).map((j) => [outline[j][0], height, outline[j][1]]);
    if (normalFor(...points)[1] < 0) points = points.toReversed();
    out.addTriangle(
      'roof',
      '',
      points,
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      palette.roof,
    );
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[(i + 1) % outline.length],
      b = outline[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      dy = 0.25;
    const wall = transform(out, a, Math.atan2(b[1] - a[1], b[0] - a[0]));
    if (detail < 2) {
      panel(wall, 'wall', 'wall', 0, low - high - 0.38, 0, l, height + high - low + 0.38);
      continue;
    }
    block(wall, 'wall', 'wall', 0, low - high - 0.38, -0.15, l, height + high - low + 0.38, 0.15);
    block(wall, 'concrete', 'edge', -0.045, height - dy, -0.2, l + 0.09, dy + 0.08, 0.27);
    for (let x = 0.7; x + 1.35 < l; x += 2.55) {
      block(wall, 'paint', 'shade', x, 0.91, 0.005, 1.35, 1.65, 0.018);
      shutter(wall, x + 0.07, 0.98, 0.023, 1.21, 1.51, detail);
    }
  }
  block(out, 'roof', 'roof', -2.25, height, -9.8, 7.54, 0.38, 18.3);
}

function stonePlaque(out, x, z) {
  const w = 1.48,
    d = 1.11;
  const lo = (a, b) => [x + a, 0.12, z + b];
  const hi = (a, b) => [x + a, 0.18 + (0.27 * b) / d, z + b];
  const side = (points) => quad(out, 'stone', points, normalFor(...points), palette.blackStone);
  side([hi(0, d), hi(w, d), hi(w, 0), hi(0, 0)]);
  side([lo(w, d), hi(w, d), hi(0, d), lo(0, d)]);
  side([lo(0, 0), hi(0, 0), hi(w, 0), lo(w, 0)]);
  side([lo(0, d), hi(0, d), hi(0, 0), lo(0, 0)]);
  side([lo(w, 0), hi(w, 0), hi(w, d), lo(w, d)]);
}

function memorialCourts(out, detail) {
  const [mx, mz] = layout.northMemorial;
  const court = transform(out, layout.northMemorial, 0, ground(mx, mz));
  const square = (a, y, h, mat, tint) => block(court, mat, tint, -a / 2, y, -a / 2, a, h, a);
  for (const [x, z, w, d] of [
    [-10.4, -13.4, 4, 27.8],
    [8, -13.4, 2.4, 27.8],
    [-6.4, -9.2, 12.8, 18.4],
  ])
    pavement(out, mx + x, mz + z, w, d, 'lawn', 'lawn', 0.075);
  for (const x of [-13, 10.4]) pavement(out, mx + x, mz - 16, 2.6, 33, 'path', 'path');
  for (const z of [-16, 14.4]) pavement(out, mx - 10.4, mz + z, 20.8, 2.6, 'path', 'path');
  for (const x of [-8, 6.4]) pavement(out, mx + x, mz - 12, 1.6, 24, 'paving', 'greyStone');
  for (const z of [-10.8, 9.2]) pavement(out, mx - 6.4, mz + z, 12.8, 1.6, 'paving', 'greyStone');
  square(10.2, -0.75, 1.02, 'concrete', 'columns');
  square(9.94, 0.27, 0.45, 'concrete', 'columns');
  square(10.18, 0.72, 0.13, 'stone', 'paleStone');
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const edge = transform(court, [0, 0], angle);
    for (let i = 0; i < 5; i++)
      block(edge, 'paving', 'paleStone', -1.25, -0.13, 5.65 - i * 0.17, 2.5, 0.31 + i * 0.16, 0.18);
    if (detail >= 1) {
      for (const t of [-4.1, -2.05, 0.57, 2.62]) {
        const px = mx + Math.cos(angle) * (t + 0.74) - Math.sin(angle) * 7.9;
        const pz = mz + Math.sin(angle) * (t + 0.74) + Math.cos(angle) * 7.9;
        stonePlaque(transform(edge, [0, 0], 0, ground(px, pz) - ground(mx, mz)), t, 7.4);
      }
      block(edge, 'stone', 'blackStone', -0.68, 1.51, 0.84, 1.36, 1.39, 0.045);
    }
  }
  square(2.66, 0.85, 0.22, 'stone', 'greyStone');
  square(2.14, 1.07, 0.4, 'stone', 'greyStone');
  square(1.68, 1.47, 1.58, 'stone', 'greyStone');
  square(1.98, 3.05, 0.13, 'stone', 'paleStone');
  square(1.79, 3.18, 0.22, 'stone', 'greyStone');
  square(1.4, 3.4, 0.24, 'stone', 'greyStone');
  for (const a of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
    const petal = transform(court, [0, 0], a);
    beam(petal, 'stone', [0, 3.58, 0.22], [0, 4.32, 0.68], 0.31, 0.16, palette.greyStone);
  }
  const path = (x, z, w, d) => pavement(out, x, z, w, d, 'path', 'path');
  path(-17.4, 16, 2.44, 47.5);
  path(21, 14, 2.6, 57.5);
  path(-15, 14.6, 36, 2.1);
  path(-15, 57, 36, 2.3);
  path(-14.9, 37.1, 35.9, 2.0);
  for (const [z, d] of [
    [16.7, 20.4],
    [39.1, 17.9],
  ])
    pavement(out, -14.9, z, 35.9, d, 'lawn', 'lawn', 0.08);
  for (let i = 0; i < 14; i++) {
    const x = -10.8 + (i % 7) * 1.78,
      z = 61.05 + Math.floor(i / 7) * 2.17;
    const y = ground(x + 0.5, z + 0.8);
    block(out, 'stone', 'paleStone', x, y - 0.14, z, 1.01, 0.38, 1.61);
    block(out, 'stone', 'paleStone', x + 0.095, y + 0.24, z + 0.08, 0.82, 0.32, 1.45);
    if (detail > 0)
      block(out, 'stone', 'paleStone', x + 0.17, y + 0.56, z + 0.18, 0.67, 0.16, 0.26);
  }
}

function palm(out, x, z, h, detail) {
  const y = ground(x, z),
    tip = [x + 0.35, y + h, z - 0.19];
  beam(out, 'trunk', [x, y - 0.18, z], tip, 0.2, 0.2, palette.bark);
  const count = detail >= 2 ? 11 : 7;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const length = 2.15 + 0.49 * Math.sin(i * 1.81 + x);
    const tint = i % 3 === 0 ? palette.freshLeaves : palette.leaves;
    const point = (t, w) => [
      tip[0] + c * length * t - s * w,
      tip[1] + 0.82 * Math.sin(t * Math.PI) - 0.75 * t * t,
      tip[2] + s * length * t + c * w,
    ];
    const segments = detail >= 2 ? 6 : 3;
    for (let j = 0; j < segments; j++) {
      const a = j / segments,
        b = (j + 1) / segments,
        t = (a + b) / 2;
      const w = (0.2 + 0.18 * Math.sin(Math.PI * t)) * (1 - 0.7 * t);
      const left = [point(a, 0), point(t, -w), point(b, 0)];
      const right = [point(a, 0), point(b, 0), point(t, w)];
      for (const tri of [left, right])
        out.addTriangle(
          'foliage',
          '',
          tri,
          normalFor(...tri),
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          tint,
        );
    }
  }
}

function planting(out, detail) {
  const palms = [
    [-15, -59, 7.0],
    [-13, -20, 6.1],
    [19, -57, 7.5],
    [-13, 19, 7.7],
    [18, 18, 6.1],
    [19, 55, 7.5],
    [-13, 55, 6.3],
  ];
  for (const [x, z, h] of palms) palm(out, x, z, h, detail);
  for (const [x, z, h, r] of [
    [23, -62, 8.2, 3.0],
    [24, -52, 7.7, 2.9],
    [-13, -56, 5.7, 2.1],
    [-14, -27, 6.8, 2.6],
    [-16, 29, 6.2, 2.2],
    [24, 39, 5.5, 2.4],
    [16, 66, 6.0, 2.8],
  ]) {
    const y = ground(x, z);
    beam(
      out,
      'trunk',
      [x, y - 0.17, z],
      [x + 0.12, y + h - 0.6, z + 0.05],
      0.21,
      0.22,
      palette.bark,
    );
    const segments = detail >= 2 ? 9 : 6,
      rings = detail >= 2 ? 5 : 3;
    sphere(out, 'foliage', [x, y + h, z], [r, r * 0.6, r], palette.leaves, segments, rings);
    if (detail >= 1) {
      sphere(
        out,
        'foliage',
        [x - r * 0.42, y + h - 0.2, z - r * 0.21],
        [r * 0.77, r * 0.42, r * 0.66],
        palette.freshLeaves,
        segments,
        rings,
      );
      sphere(
        out,
        'foliage',
        [x + r * 0.33, y + h + 0.26, z + r * 0.4],
        [r * 0.74, r * 0.49, r * 0.62],
        palette.leaves,
        segments,
        rings,
      );
    }
  }
}

function boundary(out, detail) {
  const [x0, z0, x1, z1] = layout.boundary;
  const [gateStart, gateEnd] = layout.gate;
  const walls = [
    [[x0, z0], 0, x1 - x0],
    [[x0, z1], 0, x1 - x0],
    [[x0, z1], -Math.PI / 2, z1 - z0],
    [[x1, gateStart], -Math.PI / 2, gateStart - z0],
    [[x1, z1], -Math.PI / 2, z1 - gateEnd],
  ];
  for (const [origin, angle, length] of walls) {
    const outWall = transform(out, origin, angle);
    const sections = Math.ceil(length / (detail < 2 ? 7.5 : 3.75)),
      span = length / sections;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    for (let i = 0; i < sections; i++) {
      const x = i * span,
        center = x + span / 2;
      const y = ground(origin[0] + center * c, origin[1] + center * s);
      if (detail < 3) {
        panel(outWall, 'wall', 'wall', x, y - 0.52, 0.14, span, 2.92);
        const back = transform(outWall, [x + span, -0.14], Math.PI);
        panel(back, 'wall', 'wall', 0, y - 0.52, 0, span, 2.92);
        continue;
      }
      block(outWall, 'wall', 'wall', x, y - 0.52, -0.14, span, 2.92, 0.28);
      block(outWall, 'concrete', 'edge', x, y + 2.4, -0.21, span, 0.14, 0.42);
      if (detail >= 2) block(outWall, 'concrete', 'edge', x, y - 0.32, -0.24, 0.33, 2.93, 0.48);
      if (detail >= 3)
        for (let h = 2.68; h <= 3.05; h += 0.17)
          block(outWall, 'wire', 'wire', x, y + h, -0.02, span, 0.015, 0.02);
    }
  }
  for (const z of [gateStart - 0.46, gateEnd]) {
    const y = ground(x1, z);
    block(out, 'concrete', 'columns', x1 - 0.37, y - 0.45, z, 0.74, 3.36, 0.46);
    block(out, 'concrete', 'edge', x1 - 0.43, y + 2.91, z - 0.06, 0.86, 0.16, 0.58);
  }
}

export function buildCampus(out, level) {
  const detail = rank[level];
  if (detail === undefined) throw new Error(`Unknown museum level: ${level}`);
  for (const building of layout.schools) school(out, building, detail);
  annex(out, detail);
  if (detail === 0) {
    const [x, z] = layout.northMemorial,
      y = ground(x, z);
    block(out, 'paving', 'greyStone', x - 5.1, y - 0.65, z - 5.1, 10.2, 1.5, 10.2);
    block(out, 'stone', 'greyStone', x - 0.84, y + 0.85, z - 0.84, 1.68, 3.2, 1.68);
    return;
  }
  if (detail === 1) {
    const [x, z] = layout.northMemorial,
      y = ground(x, z);
    pavement(out, x - 11, z - 13, 22, 26, 'lawn', 'lawn', 0.075);
    pavement(out, -14.9, 17, 35.9, 39.7, 'lawn', 'lawn', 0.08);
    block(out, 'paving', 'paleStone', x - 5.1, y - 0.6, z - 5.1, 10.2, 1.45, 10.2);
    block(out, 'stone', 'greyStone', x - 0.84, y + 0.85, z - 0.84, 1.68, 3.2, 1.68);
    for (let i = 0; i < 14; i++) {
      const a = -10.8 + (i % 7) * 1.78,
        b = 61.05 + Math.floor(i / 7) * 2.17;
      block(out, 'stone', 'paleStone', a, ground(a, b) - 0.13, b, 1.01, 0.7, 1.61);
    }
    planting(out, 0);
    boundary(out, detail);
    return;
  }
  memorialCourts(out, detail);
  planting(out, detail);
  boundary(out, detail);
}

export const buildMaster = (out) => buildCampus(out, 'master');
export const buildSkyline = (out) => buildCampus(out, 'skyline');
export const buildDistrict = (out) => buildCampus(out, 'district');
export const buildStreet = (out) => buildCampus(out, 'street');
export const buildCloseup = (out) => buildCampus(out, 'closeup');
