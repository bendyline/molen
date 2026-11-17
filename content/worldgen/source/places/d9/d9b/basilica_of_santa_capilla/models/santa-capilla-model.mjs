/** The standing nineteenth-century Santa Capilla and its reconstructed neo-Gothic west portal. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const map = read('map-frame'),
  plan = read('plan-controls'),
  terrain = read('terrain-grid');
const outline = map.geometry.outline,
  dim = plan.dimensions;
const ref = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#3d4b49', roughness: 0.69, metallic: 0 },
  iron: { slot: 'trim', localRef: 'palette:#453a32', roughness: 0.75, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    pink: 'cd8b80',
    warm: 'd79a8e',
    deep: 'b97970',
    needle: 'd6a295',
    pale: 'e2dcd2',
    slate: '777775',
    cornice: 'c5c6bd',
    bronze: '745b48',
    cross: '655245',
    basalt: '6c6967',
    door: '52504a',
    shade: '6c6966',
    smoke: '53615f',
    glass: '70787c',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, v) => a + (b - a) * v;
const point = ([x, z], y) => [x, y, z];
function face(out, slot, points, facing, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * facing[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      n,
      points.map(([x, y, z]) => [x + z, y]),
      color,
    );
}
function edge(a, b, inside = [0, -13]) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const sign = -dz * (inside[0] - a[0]) + dx * (inside[1] - a[1]) < 0 ? 1 : -1;
  const n = [-sign * dz, 0, sign * dx];
  return {
    length,
    n,
    at: (u, y, d = 0) => [a[0] + dx * u + n[0] * d, y, a[1] + dz * u + n[2] * d],
  };
}
function panel(out, f, slot, x0, x1, y0, y1, d, color) {
  if (x1 - x0 < 0.00005 || y1 - y0 < 0.00005) return;
  face(out, slot, [f.at(x0, y0, d), f.at(x1, y0, d), f.at(x1, y1, d), f.at(x0, y1, d)], f.n, color);
}
function groundAt([x, , z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = (k) => mix(terrain.heightsMeters[k][i], terrain.heightsMeters[k][i + 1], u - i);
  return mix(row(j), row(j + 1), v - j) - terrain.modelDatumElevationMeters;
}
function trimLine(out, f, slot, a, b, d, width, color) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (-(b[1] - a[1]) * width) / (2 * length),
    dy = ((b[0] - a[0]) * width) / (2 * length);
  face(
    out,
    slot,
    [
      f.at(a[0] - dx, a[1] - dy, d),
      f.at(b[0] - dx, b[1] - dy, d),
      f.at(b[0] + dx, b[1] + dy, d),
      f.at(a[0] + dx, a[1] + dy, d),
    ],
    f.n,
    color,
  );
}
function trimPath(out, f, slot, points, d, width, color) {
  for (let i = 1; i < points.length; i++)
    trimLine(out, f, slot, points[i - 1], points[i], d, width, color);
}
function circle(out, f, x, y, r, border, d, level, panelColor = tint.smoke, style = 'quatrefoil') {
  const sides = level > 1 ? 20 : 10;
  const coords = (j, size) => [
    x + size * Math.cos((j * 2 * Math.PI) / sides),
    y + size * Math.sin((j * 2 * Math.PI) / sides),
  ];
  const p = ([u, v], offset = d) => f.at(u, v, offset);
  for (let j = 0; j < sides; j++) {
    const a = coords(j, r),
      b = coords(j + 1, r),
      aa = coords(j, r - border),
      bb = coords(j + 1, r - border);
    face(out, 'stone', [p(a), p(b), p(bb), p(aa)], f.n, tint.pale);
    face(out, 'glass', [p([x, y], d - 0.018), p(aa, d - 0.018), p(bb, d - 0.018)], f.n, panelColor);
  }
  if (level === 0 || (level === 1 && style !== 'rose')) return;
  const count = style === 'rose' ? 8 : 4;
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count,
      ro = r - border,
      lx = Math.cos(angle),
      ly = Math.sin(angle);
    const center = [x + lx * ro * 0.45, y + ly * ro * 0.45];
    const petal = [];
    for (let j = 0; j <= 8; j++) {
      const a = (j * 2 * Math.PI) / 8;
      petal.push([center[0] + ro * 0.31 * Math.cos(a), center[1] + ro * 0.31 * Math.sin(a)]);
    }
    if (style === 'rose')
      trimLine(
        out,
        f,
        'stone',
        [x + lx * ro * 0.16, y + ly * ro * 0.16],
        [x + lx * ro, y + ly * ro],
        d + 0.018,
        ro * 0.069,
        tint.cornice,
      );
    trimPath(out, f, 'stone', petal, d + 0.022, ro * 0.095, tint.cornice);
  }
}
function head(cx, spring, w, rise, segments) {
  const offset = (rise * rise - w * w) / (2 * w),
    radius = w + offset;
  return Array.from({ length: segments * 2 + 1 }, (_, i) => {
    const delta = w * (i / segments - 1);
    if (i === 0 || i === segments * 2) return [cx + delta, spring];
    return [
      cx + delta,
      spring + Math.sqrt(Math.max(0, radius * radius - Math.pow(Math.abs(delta) + offset, 2))),
    ];
  });
}
function opening(out, f, aperture, level) {
  const { x, width, bottom, spring, rise, kind } = aperture;
  const segments = level === 0 ? 2 : level === 1 ? 3 : 7;
  const w = width / 2,
    arch = head(x, spring, w, rise, segments),
    border = kind === 'door' ? 0.16 : 0.1;
  const depth = kind === 'door' ? 0.28 : 0.17,
    recess = -depth;
  const slot = kind === 'door' ? 'door' : 'glass',
    shadow = kind === 'door' ? tint.door : tint.smoke;
  if (level === 0) {
    const pane = [
      f.at(x - w, bottom, recess),
      f.at(x + w, bottom, recess),
      ...arch.toReversed().map(([u, v]) => f.at(u, v, recess)),
    ];
    out.addConvexPolygon(slot, ref, pane, f.n, (p) => [p[0] + p[2], p[1]], shadow);
    return arch;
  }
  const near = f.at(0, 0),
    far = f.at(1, 0);
  for (const dir of [-1, 1]) {
    const px = x + w * dir;
    face(
      out,
      'stone',
      [
        f.at(px, bottom, 0),
        f.at(px, bottom, recess),
        f.at(px, spring, recess),
        f.at(px, spring, 0),
      ],
      near.map((value, axis) => dir * (value - far[axis])),
      tint.shade,
    );
    panel(
      out,
      f,
      'stone',
      Math.min(px, px + dir * border),
      Math.max(px, px + dir * border),
      bottom,
      spring,
      0.046,
      tint.pale,
    );
  }
  const surround = head(x, spring, w + border, rise + border, segments);
  for (let i = 1; i < arch.length; i++) {
    const [x0, y0] = arch[i - 1],
      [x1, y1] = arch[i];
    face(
      out,
      'stone',
      [f.at(x0, y0, 0.032), f.at(x1, y1, 0.032), f.at(x1, y1, recess), f.at(x0, y0, recess)],
      [0, -1, 0],
      tint.shade,
    );
    face(
      out,
      'stone',
      [
        f.at(x0, y0, 0.048),
        f.at(x1, y1, 0.048),
        f.at(...surround[i], 0.048),
        f.at(...surround[i - 1], 0.048),
      ],
      f.n,
      tint.pale,
    );
    const pane = [f.at(x0, spring, recess), f.at(x1, spring, recess)];
    if (y1 > spring) pane.push(f.at(x1, y1, recess));
    if (y0 > spring) pane.push(f.at(x0, y0, recess));
    face(out, slot, pane, f.n, shadow);
  }
  panel(out, f, slot, x - w, x + w, bottom, spring, recess, shadow);
  if (level > 0) {
    const displayDepth = recess + 0.016;
    panel(
      out,
      f,
      kind === 'door' ? 'iron' : 'stone',
      x - 0.042,
      x + 0.042,
      bottom,
      spring + rise - 0.08,
      displayDepth,
      tint.cornice,
    );
    if (kind === 'door') {
      for (const y of [mix(bottom, spring, 0.38), mix(bottom, spring, 0.78)])
        panel(out, f, 'iron', x - w + 0.07, x + w - 0.07, y, y + 0.048, displayDepth, tint.bronze);
    }
    if (level > 1) {
      for (const dir of [-1, 1]) {
        const side = x + dir * w * 0.55;
        const bottomX = kind === 'door' ? side : x + dir * w * 0.35;
        const crest = [x + dir * w * 0.12, spring + rise * 0.87],
          n = [side, spring + rise * 0.8];
        trimPath(
          out,
          f,
          kind === 'door' ? 'iron' : 'stone',
          [[bottomX, bottom + 0.04], [bottomX, spring - 0.03], n, crest],
          displayDepth + 0.01,
          0.04,
          tint.bronze,
        );
      }
    }
  }
  return arch;
}
function wallWithOpenings(out, f, apertures, y0, y1, level) {
  let previous = 0;
  for (const a of [...apertures].sort((left, right) => left.x - right.x)) {
    const l = a.x - a.width / 2,
      r = a.x + a.width / 2;
    panel(out, f, 'plaster', previous, l, y0, y1, 0, tint.pink);
    panel(out, f, 'plaster', l, r, y0, a.bottom, 0, tint.deep);
    const arch = opening(out, f, a, level);
    for (let j = 1; j < arch.length; j++) {
      const [x0, base0] = arch[j - 1],
        [x1, base1] = arch[j];
      face(
        out,
        'plaster',
        [f.at(x0, base0), f.at(x1, base1), f.at(x1, y1), f.at(x0, y1)],
        f.n,
        tint.pink,
      );
    }
    previous = r;
  }
  panel(out, f, 'plaster', previous, f.length, y0, y1, 0, tint.pink);
}
function bands(out, f, start, end, y, level) {
  beam(out, 'stone', f.at(start, y, 0.14), f.at(end, y, 0.14), 0.32, 0.34, tint.cornice);
  if (level > 0) {
    beam(
      out,
      'stone',
      f.at(start, y - 0.27, 0.075),
      f.at(end, y - 0.27, 0.075),
      0.17,
      0.2,
      tint.pale,
    );
    beam(
      out,
      'stone',
      f.at(start, y + 0.23, 0.1),
      f.at(end, y + 0.23, 0.1),
      0.17,
      0.24,
      tint.slate,
    );
  }
}
function column(out, x, z, y0, y1, r, color, level) {
  const n = level > 1 ? 8 : 6;
  if (level === 1) {
    const ring = (y) => radialRing(y, r, r, n, [x, z]);
    loft(out, 'stone', [ring(y0), ring(y1)], color);
    return;
  }
  loft(
    out,
    'stone',
    [
      radialRing(y0, r * 1.18, r * 1.18, n, [x, z]),
      radialRing(y0 + 0.19, r, r, n, [x, z]),
      radialRing(y1 - 0.17, r, r, n, [x, z]),
      radialRing(y1, r * 1.26, r * 1.26, n, [x, z]),
    ],
    color,
  );
}
function pinnacle(out, x, z, y, height, radius, level, major = false) {
  const sides = major ? 8 : 4,
    angle = Math.PI / sides;
  const ring = (up, size) => radialRing(up, size, size, sides, [x, z], angle);
  const end = y + height;
  loft(
    out,
    'plaster',
    [
      ring(y, radius),
      ...(level > 1 || major ? [ring(y + height * 0.12, radius)] : []),
      ring(end, radius * (major ? 0.09 : 0.065)),
    ],
    major ? tint.needle : tint.warm,
  );
  if (level > 0) {
    for (let i = 0; i < sides; i++) {
      const alpha = ((2 * i + 1) * Math.PI) / sides,
        nx = Math.cos(alpha),
        nz = Math.sin(alpha);
      const foot = [x + nx * radius, y + height * 0.11, z + nz * radius],
        top = [x + nx * radius * 0.07, end, z + nz * radius * 0.07];
      if (major) beam(out, 'stone', foot, top, radius * 0.11, radius * 0.11, tint.pale);
      if (level > 1)
        for (const t of major ? [0.13, 0.25, 0.37, 0.5, 0.63, 0.76, 0.88] : [0.28, 0.51, 0.74]) {
          const lx = mix(foot[0], top[0], t),
            ly = mix(foot[1], top[1], t),
            lz = mix(foot[2], top[2], t);
          beam(
            out,
            'iron',
            [lx - nx * radius * 0.04, ly - 0.08, lz - nz * radius * 0.04],
            [lx + nx * radius * 0.14, ly + radius * 0.12, lz + nz * radius * 0.14],
            radius * 0.09,
            radius * 0.085,
            tint.bronze,
          );
        }
    }
  }
  if (!major && level > 0) {
    beam(out, 'iron', [x, end - 0.02, z], [x, end + radius * 0.93, z], 0.094, 0.092, tint.cross);
    beam(
      out,
      'iron',
      [x - radius * 0.3, end + radius * 0.56, z],
      [x + radius * 0.3, end + radius * 0.56, z],
      0.075,
      0.075,
      tint.cross,
    );
  }
}
function hood(out, f, x, y, width, level) {
  const heights = [0, 0.52, 1.19, 1.77, 2.04];
  const boundaries = [1, 0.81, 0.63, 0.34, 0];
  const pts = (side) => boundaries.map((u, i) => [x + u * width * side, y + heights[i]]);
  for (const side of [-1, 1]) {
    const path = pts(side);
    trimPath(out, f, 'stone', path, 0.16, 0.13, tint.pale);
    if (level > 1)
      for (let i = 0; i < 7; i++) {
        const t = (i / 7) * 4,
          j = Math.floor(t);
        const a = path[j],
          b = path[j + 1],
          xx = mix(a[0], b[0], t - j),
          yy = mix(a[1], b[1], t - j);
        trimLine(
          out,
          f,
          'stone',
          [xx, yy],
          [xx + side * 0.13, yy + 0.19],
          0.205,
          0.085,
          tint.cornice,
        );
      }
  }
  if (level > 0) {
    trimPath(
      out,
      f,
      'iron',
      [
        [x - 0.23, y + 2.21],
        [x, y + 2.45],
        [x + 0.22, y + 2.23],
      ],
      0.17,
      0.083,
      tint.bronze,
    );
    trimLine(out, f, 'iron', [x, y + 2.03], [x, y + 2.54], 0.17, 0.081, tint.bronze);
  }
}
function northElevation(out, f, level) {
  const centers = [0.16, 0.37, 0.59, 0.82].map((t) => f.length * t);
  const doors = centers.map((x) => {
    const bottom = Math.max(dim.threshold, groundAt(f.at(x, 0, 0.2)) + 0.2);
    return {
      x,
      width: 4.16,
      bottom,
      spring: 5.63,
      rise: 2.18,
      kind: 'door',
    };
  });
  wallWithOpenings(out, f, doors, dim.wallBase, dim.sideCornice, level);
  bands(out, f, 0, f.length, dim.sideCornice, level);
  const partition = [0.027, 0.265, 0.479, 0.706, 0.949, 0.988].map((t) => f.length * t);
  for (const [i, x] of partition.entries()) {
    const ground = Math.max(-0.4, groundAt(f.at(x, 0, 0.3)) - 0.28);
    const width = i === 0 ? 0.48 : 0.34;
    panel(out, f, 'plaster', x - width, x + width, ground, 11.25, 0.43, tint.deep);
    panel(
      out,
      f,
      'stone',
      x - width * 0.42,
      x + width * 0.42,
      ground + 0.22,
      10.65,
      0.471,
      tint.pale,
    );
    const bx = f.at(x, 11.18, 0.32);
    pinnacle(out, bx[0], bx[2], bx[1], i % 2 === 0 ? 3.48 : 3.1, 0.48, level);
  }
  if (level === 0) return;
  for (const { x } of doors) {
    hood(out, f, x, 6.76, 2.18, level);
    circle(out, f, x, 8.43, 0.45, 0.09, 0.1, level);
    for (const d of [-2.02, -0.86, 0.86, 2.02])
      circle(out, f, x + d, 9.76, 0.29, 0.065, 0.09, level === 3 ? 1 : 0);
  }
  if (level === 3) {
    for (let i = 1; i < 83; i++) {
      const x = (f.length * i) / 83;
      trimLine(out, f, 'iron', [x, 10.65], [x, 10.87], 0.13, 0.058, tint.bronze);
      trimLine(out, f, 'iron', [x - 0.06, 10.8], [x + 0.06, 10.8], 0.136, 0.06, tint.bronze);
    }
  }
}
function westElevation(out, f, level) {
  const middle = f.length / 2;
  const main = { x: middle, width: 4.2, bottom: 0.48, spring: 3.92, rise: 2.61, kind: 'door' };
  const doors = [
    { x: middle - 8.25, width: 3.06, bottom: 0.49, spring: 3.42, rise: 1.66, kind: 'door' },
    main,
    { x: middle + 8.25, width: 3.06, bottom: 0.49, spring: 3.42, rise: 1.66, kind: 'door' },
  ];
  wallWithOpenings(out, f, doors, dim.wallBase, dim.sideCornice, level);
  for (const dir of [-1, 1]) {
    const x = middle + dir * 8.25;
    face(
      out,
      'plaster',
      [f.at(x - 3.25, dim.sideCornice), f.at(x + 3.25, dim.sideCornice), f.at(x, 12.18)],
      f.n,
      tint.warm,
    );
    bands(out, f, x - 3.14, x + 3.14, 10.27, level);
    if (level > 0) {
      hood(out, f, x, 4.92, 1.87, level);
      circle(out, f, x, 8.12, 1.06, 0.14, 0.13, level);
    }
    for (const offset of [-3.03, 3.03]) {
      const u = x + offset,
        p = f.at(u, 10.7, 0.32);
      panel(out, f, 'plaster', u - 0.28, u + 0.28, 0.43, 10.87, 0.37, tint.deep);
      pinnacle(out, p[0], p[2], p[1], 3.5, 0.44, level);
    }
  }
  const shoulder = 6.11;
  panel(out, f, 'plaster', middle - shoulder, middle + shoulder, 10.36, 11.03, 0.19, tint.pink);
  face(
    out,
    'plaster',
    [
      f.at(middle - shoulder, 11.02, 0.19),
      f.at(middle + shoulder, 11.02, 0.19),
      f.at(middle, dim.westCenterGable, 0.19),
    ],
    f.n,
    tint.warm,
  );
  trimPath(
    out,
    f,
    'stone',
    [
      [middle - shoulder, 11.02],
      [middle, dim.westCenterGable],
      [middle + shoulder, 11.02],
    ],
    0.23,
    0.24,
    tint.pale,
  );
  for (const offset of level > 0 ? [-2.79, -2.45, 2.45, 2.79] : []) {
    const p = f.at(middle + offset, 0.5, 0.25);
    column(out, p[0], p[2], 0.47, 6.87, 0.13, tint.pale, level);
  }
  if (level > 0) {
    hood(out, f, middle, 5.82, 2.39, level);
    circle(out, f, middle, 10.05, 1.91, 0.17, 0.24, level, tint.smoke, 'rose');
    const stat = f.at(middle, 7.88, 0.2);
    beam(
      out,
      'stone',
      [stat[0], stat[1] - 0.05, stat[2]],
      [stat[0], stat[1] + 0.65, stat[2]],
      0.22,
      0.19,
      tint.pale,
    );
  }
  for (const d of [-1, 1]) {
    const p = f.at(middle + d * 4.59, 8.75, -0.67);
    const [x, y, z] = p;
    const y1 = y + 3.65;
    if (level === 0)
      box(out, 'plaster', [x - 0.57, y, z - 0.57], [x + 0.57, y1, z + 0.57], tint.deep);
    else
      for (const u of [-0.52, 0.52])
        for (const v of [-0.52, 0.52]) column(out, x + u, z + v, y, y1, 0.12, tint.pale, level);
    box(
      out,
      'stone',
      [x - 0.66, y1 - 0.09, z - 0.66],
      [x + 0.66, y1 + 0.08, z + 0.66],
      tint.cornice,
    );
    pinnacle(out, x, z, y1, 7.55, 0.73, level);
  }
  for (let i = 0; i < 3; i++)
    box(
      out,
      'stone',
      [-11.7, dim.wallBase, 0.2 + i * 0.34],
      [11.7, 0.46 - i * 0.12, 0.52 + i * 0.34],
      tint.basalt,
    );
}
function bellTower(out, level) {
  const [x, z] = dim.towerCenter,
    n = 8,
    offset = Math.PI / n,
    r = dim.towerDrumRadius;
  const ring = (y, size) => radialRing(y, size, size, n, [x, z], offset);
  const base = dim.bellStageBase,
    crown = dim.bellStageTop;
  loft(out, 'plaster', [ring(8.8, 2.81), ring(base, 2.62), ring(base + 0.31, r)], tint.deep);
  if (level === 0) {
    loft(out, 'plaster', [ring(base + 0.27, r), ring(crown - 0.15, r)], tint.warm);
    const positions = ring(base + 0.3, r);
    for (let i = 0; i < n; i += 2) {
      const [a, b] = [positions[i], positions[(i + 1) % n]],
        f = edge([a[0], a[2]], [b[0], b[2]], [x, z]);
      const middle = f.length / 2;
      panel(
        out,
        f,
        'glass',
        middle - 0.46,
        middle + 0.46,
        base + 0.71,
        crown - 1.57,
        0.04,
        tint.smoke,
      );
      face(
        out,
        'glass',
        [
          f.at(middle - 0.46, crown - 1.57, 0.04),
          f.at(middle + 0.46, crown - 1.57, 0.04),
          f.at(middle, crown - 0.67, 0.04),
        ],
        f.n,
        tint.smoke,
      );
    }
  }
  const lower = ring(base + 0.29, r),
    upper = ring(crown - 0.4, r);
  for (let i = 0; level > 0 && i < n; i++) {
    const [a, b] = [lower[i], lower[(i + 1) % n]],
      f = edge([a[0], a[2]], [b[0], b[2]], [x, z]);
    wallWithOpenings(
      out,
      f,
      [
        {
          x: f.length / 2,
          width: 1.07,
          bottom: base + 0.86,
          spring: crown - 1.81,
          rise: 0.94,
          kind: 'lancet',
        },
      ],
      base + 0.29,
      crown - 0.4,
      level,
    );
    const high = upper[i],
      next = upper[(i + 1) % n];
    face(out, 'plaster', [high, next, f.at(f.length / 2, crown + 0.73, 0.06)], f.n, tint.deep);
    if (level > 0) {
      const x0 = f.length / 2;
      trimPath(
        out,
        f,
        'stone',
        [
          [0, crown - 0.4],
          [x0, crown + 0.83],
          [f.length, crown - 0.4],
        ],
        0.11,
        0.14,
        tint.pale,
      );
      column(out, a[0], a[2], base + 0.38, crown - 0.22, 0.105, tint.pale, level);
      if (level > 1) pinnacle(out, high[0], high[2], crown - 0.12, 1.3, 0.2, level - 1);
    }
  }
  loft(
    out,
    'stone',
    [ring(crown - 0.39, 2.55), ring(crown - 0.19, 2.49), ring(crown, 2.39)],
    tint.pale,
  );
  pinnacle(out, x, z, crown - 0.05, dim.needlePoint - crown + 0.05, 2.23, level, true);
  beam(
    out,
    'iron',
    [x, dim.needlePoint - 0.14, z],
    [x, dim.crossFinial, z],
    0.17,
    0.17,
    tint.cross,
  );
  beam(out, 'iron', [x - 0.65, 28.85, z], [x + 0.65, 28.85, z], 0.13, 0.13, tint.cross);
  if (level > 0) {
    for (const u of [-0.65, 0.65])
      beam(out, 'iron', [x + u, 28.72, z], [x + u, 28.96, z], 0.1, 0.1, tint.bronze);
  }
}
function roofsAndRear(out, level) {
  const south = edge(outline[1], outline[2]),
    north = edge(outline[4], outline[0]);
  for (const f of [south, edge(outline[2], outline[3]), edge(outline[3], outline[4])]) {
    const windows =
      level < 2
        ? []
        : [0.22, 0.54, 0.8].map((t) => ({
            x: f.length * t,
            width: 0.93,
            bottom: 4.3,
            spring: 6.48,
            rise: 0.69,
            kind: 'lancet',
          }));
    wallWithOpenings(out, f, windows, dim.wallBase, dim.sideCornice, level);
    bands(out, f, 0, f.length, dim.sideCornice, level);
  }
  out.addConvexPolygon(
    'roof',
    ref,
    outline.map((v) => point(v, dim.sideCornice)),
    up,
    (p) => [p[0], p[2]],
    tint.slate,
  );
  box(out, 'plaster', [-4.16, 10.39, -32.86], [4.12, dim.clerestoryTop, -1.55], tint.deep);
  box(
    out,
    'roof',
    [-4.35, dim.clerestoryTop - 0.05, -33.01],
    [4.31, dim.clerestoryTop + 0.12, -1.42],
    tint.slate,
  );
  if (level > 0)
    for (const z of [-9.1, -14.16, -19.38, -24.41, -29.51]) {
      box(
        out,
        'stone',
        [-1.51, dim.clerestoryTop + 0.11, z - 0.84],
        [1.48, dim.clerestoryTop + 0.31, z + 0.83],
        tint.cornice,
      );
      box(
        out,
        'glass',
        [-1.29, dim.clerestoryTop + 0.29, z - 0.7],
        [1.25, dim.clerestoryTop + 0.39, z + 0.68],
        tint.glass,
      );
    }
  if (level > 1)
    for (const f of [south, north]) {
      for (const t of [0.24, 0.54, 0.79]) {
        const [x, y, z] = f.at(f.length * t, dim.sideCornice, -0.54);
        box(out, 'roof', [x - 0.13, y, z - 0.25], [x + 0.13, y + 0.48, z + 0.25], tint.slate);
      }
    }
}
function build(out, level) {
  roofsAndRear(out, level);
  northElevation(out, edge(outline[4], outline[0]), level);
  westElevation(out, edge(outline[0], outline[1]), level);
  bellTower(out, level);
}
export const santaCapillaSkyline = (out) => build(out, 0);
export const santaCapillaDistrict = (out) => build(out, 1);
export const santaCapillaStreet = (out) => build(out, 2);
export const santaCapillaCloseup = (out) => build(out, 3);
const recipe = 'santa-capilla-model.mjs',
  camera = [-38, 23, 42],
  lookAt = [0, 11, -9];
export const santaCapillaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  build: santaCapillaCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: { outline, minimumCoverage: 0.995, basis: 'Exact mapped basilica footprint.' },
  brief:
    'Caracas’s standing salmon-painted Santa Capilla, with pale Gothic mouldings, a long arcaded street wall, three west portals and the slender crowning cross.',
  camera,
  lookAt,
  sunDirection: [-59, 93, 112],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.32,
    groundY: 0,
    cameraYaw: -0.57,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'west-triple-portal-and-spire', position: [-1.3, 12.2, 49], lookAt: [0, 13.2, -3] },
    { name: 'urdaneta-north-elevation', position: [-43, 15, -28], lookAt: [-10, 11, -14.7] },
    { name: 'bell-stage-and-steeple-detail', position: [-23, 22, 17], lookAt: [0, 21.6, -3.3] },
    { name: 'nave-roofs-and-rear', position: [25, 32, -51], lookAt: [0, 10, -17] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'santa-capilla-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'santaCapillaSkyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: {
      district: { export: 'santaCapillaDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'santaCapillaStreet', errorMeters: 0.14, surfaces },
      closeup: { export: 'santaCapillaCloseup', errorMeters: 0.057, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry from two exact CC0 photographs by Wilfredor, attributed map and terrain, and historical and conservation descriptions.',
};
